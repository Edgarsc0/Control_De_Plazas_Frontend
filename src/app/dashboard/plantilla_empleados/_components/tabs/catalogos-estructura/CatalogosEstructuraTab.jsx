"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { Search, RotateCcw, Plus, RefreshCw, ArrowUpDown } from "lucide-react";
import DataTable from "../../shared/DataTable";
import CopyCellMenu from "../../shared/CopyCellMenu";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import CatalogRecordModal from "./CatalogRecordModal";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import MobileSortDrawer from "@/components/ui/MobileSortDrawer";
import NivelesJerarquicosPlazaSubtab from "./NivelesJerarquicosPlazaSubtab";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import {
  applyColumnFilters,
  getUniqueColumnValues,
  matchesTextCondition,
  finalizeFilterDropdownValues,
  resolveColumnFilterCommit,
  formatDateEsMx,
} from "@/utils/columnFilters";
import { CATALOGOS_CONFIG, CATALOGOS_ORDER, MONO_CATALOG_COLUMN_KEYS } from "./catalogosConfig";

const CATALOG_DESCRIPTIONS = {
  acciones: "Catálogo de códigos de acciones con su descripción y caso de uso.",
  motivos: "Catálogo de códigos de acciones motivos con su descripción y casos de uso.",
  pto_func: "Catálogo de Puestos funcionales. Crea o edita códigos de puestos funcionales.",
  cod_presupuestal: "Catálogo de salarios brutos y netos por código presupuestal y escala.",
  organigrama_anam: "Catálogo de estructura organizacional ANAM: unidad de negocio, departamento, nivel de dirección y posiciones de gerente/director.",
  correccion_posicion: "Corrige el Código, Tipo de Aduana y DG de Aduana compactada por posición cuando no coinciden con la plantilla del Excel (ej. al realinear una posición a otra unidad).",
};

const ROW_HEIGHT = 37;

/**
 * Router del tab "Catálogos": los 4 catálogos genéricos (cat_acciones,
 * cat_acciones_motivos, CAT_PTO_FUNC, rc_cat_cod_presupuestal) comparten el
 * CRUD de fila-única de `GenericCatalogSubtab`. "Niveles Jerárquicos por
 * Plaza" no encaja en ese molde (selección múltiple + asignación en bloque),
 * así que vive en su propio componente autocontenido.
 */
export default function CatalogosEstructuraTab({ activeCatalog, onBeforeRefreshDetalle }) {
  if (activeCatalog === "niveles_jerarquicos") {
    return <NivelesJerarquicosPlazaSubtab onBeforeRefreshDetalle={onBeforeRefreshDetalle} />;
  }
  return <GenericCatalogSubtab activeCatalog={activeCatalog} />;
}

/**
 * CRUD genérico (modal de registro único) de los 4 catálogos de estructura
 * organizacional. Autocontenido: hace su propio fetch, no depende de los
 * datos "secundarios" del padre (a diferencia de Bajas/Cuadros de Vacancia).
 */
function GenericCatalogSubtab({ activeCatalog }) {
  const config = CATALOGOS_CONFIG[activeCatalog];

  const [isSortDrawerOpen, setIsSortDrawerOpen] = useState(false);

  const [dataByCatalog, setDataByCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalState, setModalState] = useState({ open: false, mode: "create", record: null });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Alto disponible hasta el borde de la ventana: se mide en vivo (no un calc()
  // con números mágicos) porque el header dinámico de arriba (título, banner de
  // error) cambia de tamaño; así la tabla siempre llega exacto al fondo del
  // viewport sin dejar hueco ni obligar scroll de página.
  const tableWrapRef = useRef(null);
  const [tableHeight, setTableHeight] = useState(0);
  useEffect(() => {
    const recompute = () => {
      const el = tableWrapRef.current;
      if (!el) return;
      setTableHeight(Math.max(200, window.innerHeight - el.getBoundingClientRect().top));
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [activeCatalog, loadError]);

  const data = dataByCatalog[activeCatalog] || [];

  const { columns, setColumns } = useColumnState(config.columns);
  useEffect(() => {
    setColumns(CATALOGOS_CONFIG[activeCatalog].columns);
  }, [activeCatalog, setColumns]);

  const { selectedCell, setSelectedCell, contextMenu, setContextMenu } = useCellSelection();

  const filters = useColumnFilters();
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    activeConditionDropdown, setActiveConditionDropdown,
    setTempSelectedValues,
    tempSelectedValues,
    setFilterSearchText,
    filterSearchCondition,
    debouncedFilterSearchText,
  } = filters;

  // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, globalSearch, sortConfig.key, sortConfig.direction, activeCatalog]);

  const isMonoColumn = useCallback((key) => MONO_CATALOG_COLUMN_KEYS.includes(key), []);

  // Tarjetas móviles: las 2 primeras columnas de negocio hacen de
  // subtítulo/título y el resto (sin las de auditoría) van como campos.
  const mobileTitleColumns = useMemo(
    () => columns.filter((c) => c.visible && !c.audit).slice(0, 2),
    [columns]
  );
  const mobileFieldColumns = useMemo(() => {
    const titleKeys = new Set(mobileTitleColumns.map((c) => c.key));
    return columns.filter((c) => c.visible && !titleKeys.has(c.key));
  }, [columns, mobileTitleColumns]);

  const getCellValue = useCallback((row, key) => {
    const v = row?.[key];
    if (v === null || v === undefined) return "";
    if (key === "fecha_modificacion") return new Date(v).toLocaleString("es-MX");
    return String(v);
  }, []);

  const fetchCatalog = useCallback(async (catalogKey) => {
    const res = await CATALOGOS_CONFIG[catalogKey].list();
    if (!res.ok) throw new Error(`Error al cargar el catálogo "${CATALOGOS_CONFIG[catalogKey].label}"`);
    return res.json();
  }, []);

  // Los catálogos "lazy" (hoy solo `correccion_posicion`, ~11,432 filas —
  // mucho más grande que el resto) no se cargan aquí: se piden aparte, solo
  // cuando el usuario entra a ese sub-tab (ver el efecto justo abajo).
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const eager = CATALOGOS_ORDER.filter((k) => !CATALOGOS_CONFIG[k].lazy);
      const entries = await Promise.all(eager.map(async (k) => [k, await fetchCatalog(k)]));
      setDataByCatalog(Object.fromEntries(entries));
    } catch {
      setLoadError("No se pudieron cargar los catálogos. Intenta recargar.");
    } finally {
      setLoading(false);
    }
  }, [fetchCatalog]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Carga bajo demanda de catálogos "lazy" al entrar a su sub-tab — una sola
  // vez por sesión de la pestaña (se cachea en `dataByCatalog`, igual que
  // los demás, así que cambiar de sub-tab y volver no vuelve a pedir nada).
  useEffect(() => {
    if (!config?.lazy || dataByCatalog[activeCatalog]) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchCatalog(activeCatalog)
      .then((data) => { if (!cancelled) setDataByCatalog((prev) => ({ ...prev, [activeCatalog]: data })); })
      .catch(() => { if (!cancelled) setLoadError(`No se pudo cargar el catálogo "${config.label}".`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeCatalog, config, dataByCatalog, fetchCatalog]);

  // Cambió de catálogo: los filtros/orden/selección de la tabla anterior no aplican (claves distintas).
  useEffect(() => {
    setColumnFilters({});
    setTextFilters({});
    setActiveFilterDropdown(null);
    setActiveConditionDropdown(null);
    setSortConfig({ key: null, direction: null });
    setSelectedCell(null);
    setGlobalSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalog]);

  useEffect(() => {
    document.body.style.overflow = activeFilterDropdown ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [activeFilterDropdown]);

  const filteredData = useMemo(() => applyColumnFilters(data, {
    globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn,
  }), [data, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData;
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  const getColumnLetter = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const handleResizeStart = (e, index, direction = "right") => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns((prev) => {
        const next = [...prev];
        const newWidth = direction === "left" ? startWidth - deltaX : startWidth + deltaX;
        next[index] = { ...next[index], width: Math.max(60, newWidth) };
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Valores (con conteo) alcanzables de una columna dado el resto de filtros
  // (todos EXCEPTO el propio de esa columna). El conteo se reutiliza en
  // `filterDropdownValues` para que el badge del dropdown sea dinámico
  // (antes mostraba el conteo del dataset completo, ignorando el resto de
  // filtros activos).
  const computeReachableValues = useCallback((colKey) => {
    const { [colKey]: _omitCF, ...otherColumnFilters } = columnFilters;
    const { [colKey]: _omitTF, ...otherTextFilters } = textFilters;
    const reachableData = applyColumnFilters(data, {
      globalSearch, columnFilters: otherColumnFilters, textFilters: otherTextFilters, getCellValue, isMonoColumn,
    });
    return getUniqueColumnValues(reachableData, colKey, getCellValue);
  }, [data, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]);

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
    setActiveFilterDropdown(colKey);
    setFilterSearchText("");
    setTempSelectedValues(columnFilters[colKey] || computeReachableValues(colKey).map((v) => v.value));
  };

  const applyColumnFilter = (colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
    if (shouldClear) {
      setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    } else {
      setColumnFilters((prev) => ({ ...prev, [colKey]: valuesToCommit }));
    }
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    setActiveFilterDropdown(null);
  };

  const dropdownUniqueValues = useMemo(() => {
    if (!activeFilterDropdown) return [];
    return getUniqueColumnValues(data, activeFilterDropdown, getCellValue);
  }, [activeFilterDropdown, data, getCellValue]);

  const reachableList = useMemo(
    () => (activeFilterDropdown ? computeReachableValues(activeFilterDropdown) : []),
    [activeFilterDropdown, computeReachableValues]
  );
  const reachableValues = useMemo(() => reachableList.map((v) => v.value), [reachableList]);
  const reachableCounts = useMemo(() => Object.fromEntries(reachableList.map((v) => [v.value, v.count])), [reachableList]);

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) {
      return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
    }
    // Conteo dinámico: `dropdownUniqueValues` es sobre el dataset completo sin
    // considerar el resto de filtros; se sobreescribe con `reachableCounts`.
    const baseUniqueValues = dropdownUniqueValues.map((v) => ({ ...v, count: reachableCounts[v.value] ?? 0 }));
    const filteredVals = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered: filteredVals,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
      reachableValues,
    });
  }, [activeFilterDropdown, dropdownUniqueValues, reachableValues, reachableCounts, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

  const hasActiveFilters = !!globalSearch || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some((f) => f?.value);
  const resetAllFilters = () => {
    setGlobalSearch("");
    setColumnFilters({});
    setTextFilters({});
    setActiveFilterDropdown(null);
    setActiveConditionDropdown(null);
  };

  const renderCell = ({ col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
    const display = col.type === "datetime" && value
      ? formatDateEsMx(value, { withTime: true })
      : (value === null || value === undefined || String(value).trim() === "" ? null : String(value));
    return (
      <td
        key={col.key}
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={stickyStyle}
        className={`px-4 text-xs border-r truncate h-[37px] align-middle ${
          isSelected
            ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
            : "bg-white/5 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300"
        } ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${col.audit ? "text-slate-400 italic font-normal" : ""}`}
      >
        {display ?? <span className="text-slate-300">-</span>}
      </td>
    );
  };

  const openCreateModal = () => setModalState({ open: true, mode: "create", record: null });
  const openEditModal = (record) => setModalState({ open: true, mode: "edit", record });
  const closeModal = () => setModalState((prev) => ({ ...prev, open: false }));

  const refreshActiveCatalog = useCallback(async () => {
    const fresh = await fetchCatalog(activeCatalog);
    setDataByCatalog((prev) => ({ ...prev, [activeCatalog]: fresh }));
  }, [activeCatalog, fetchCatalog]);

  const handleSave = async (payload) => {
    const cfg = CATALOGOS_CONFIG[activeCatalog];
    const res = modalState.mode === "edit"
      ? await cfg.update(modalState.record, payload)
      : await cfg.create(payload);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body
        ? Object.entries(body).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ")
        : "Error al guardar el registro";
      throw new Error(msg);
    }
    await refreshActiveCatalog();
  };

  const handleDelete = async () => {
    const cfg = CATALOGOS_CONFIG[activeCatalog];
    const res = await cfg.remove(modalState.record);
    if (!res.ok) throw new Error("No se pudo eliminar el registro");
    await refreshActiveCatalog();
  };

  // Columnas de auditoría (fecha_modificacion, modificado_por) o con
  // `disabledOnEdit` (llaves primarias) no admiten pegar: son de solo lectura
  // o forman parte de la URL del registro, no del payload editable.
  const isPasteableColumn = useCallback((colKey) => {
    const col = config.columns.find((c) => c.key === colKey);
    if (!col || col.audit) return false;
    const field = config.formFields.find((f) => f.key === colKey);
    return !field?.disabledOnEdit;
  }, [config]);

  const handlePasteCell = useCallback(async (text) => {
    const { row, colKey } = contextMenu || {};
    if (!row || !colKey || !isPasteableColumn(colKey)) return;
    const cfg = CATALOGOS_CONFIG[activeCatalog];
    const res = await cfg.update(row, { ...row, [colKey]: text });
    if (!res.ok) throw new Error("No se pudo pegar el valor");
    await refreshActiveCatalog();
  }, [contextMenu, activeCatalog, isPasteableColumn, refreshActiveCatalog]);

  return (
    <div className="animate-in fade-in duration-400 flex flex-col bg-white/5 dark:bg-slate-950/10 backdrop-blur-lg border-y border-gray-200/80 dark:border-slate-800/80 shadow-2xl">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-slate-900/15">
        {/* Información y descripción del catálogo (Alineado a la izquierda) */}
        <div className="flex items-center gap-3 min-w-[280px] max-w-full md:max-w-md lg:max-w-xl">
          {config.icon && (
            <div className="p-2.5 bg-[#621f32]/10 dark:bg-[#621f32]/20 text-[#621f32] rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <config.icon className="w-5 h-5 transition-transform duration-300 hover:scale-110" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {config.label}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {CATALOG_DESCRIPTIONS[activeCatalog]}
            </p>
          </div>
        </div>

        {/* Controles de búsqueda y filtros (Alineado a la derecha).
            Sólo desktop: la tabla que operan vive en `hidden md:flex`, así que
            en móvil eran botones que no llevaban a ninguna parte — "Nuevo
            Registro" incluso abría el alta sobre una tabla invisible. */}
        <div className="hidden md:flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-medium text-gray-600 dark:text-slate-300 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 transition-all w-48"
            />
          </div>
          <button
            onClick={resetAllFilters}
            disabled={!hasActiveFilters}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 hover:border-red-200 transition-all tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar filtros
          </button>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#621f32]/5 border border-[#621f32]/20 rounded-xl text-[9px] font-black uppercase text-[#621f32] hover:bg-[#621f32]/10 transition-all tracking-wider cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Recargar
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#621f32] rounded-xl text-[9px] font-black uppercase text-white hover:bg-[#4d1827] transition-all tracking-wider shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Registro
          </button>
        </div>
      </div>

      {loadError && (
        <div className="px-6 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400">{loadError}</div>
      )}

      {/* ── Tabla densa: sólo desktop ─────────────────────────────────────── */}
      <div ref={tableWrapRef} className="hidden md:flex md:flex-col" style={{ height: tableHeight || undefined }}>
        <DataTable
          fillHeight
          onScroll={() => {}}
          columns={columns}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          textFilters={textFilters}
          setTextFilters={setTextFilters}
          activeConditionDropdown={activeConditionDropdown}
          setActiveConditionDropdown={setActiveConditionDropdown}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          onCellContextMenu={(e, value, rect, row, colKey) => setContextMenu({ x: e.clientX, y: e.clientY, value, rect, row, colKey })}
          onShowRecord={(row) => openEditModal(row)}
          enableKeyboardNav
          onEscape={() => setContextMenu(null)}
          sortConfig={sortConfig}
          onSort={handleSort}
          onOpenFilter={openFilterDropdown}
          onResizeStart={handleResizeStart}
          getColumnLetter={getColumnLetter}
          isMonoColumn={isMonoColumn}
          isPending={false}
          isLoading={loading}
          loadingMessage="Cargando catálogo..."
          data={sortedData}
          startIndex={0}
          endIndex={sortedData.length}
          totalCount={sortedData.length}
          rowHeight={ROW_HEIGHT}
          getRowId={(row) => config.getRowId(row)}
          renderCell={renderCell}
          fillWidth
        />
      </div>

      {/* ── Vista móvil: toolbar + tarjetas (la tabla densa es sólo desktop) ── */}
      <div className="md:hidden">
        <MobileTableToolbar
          searchValue={globalSearch}
          onSearch={setGlobalSearch}
          count={sortedData.length}
          searchPlaceholder={`Buscar en ${config?.label || "catálogo"}...`}
          primaryAction={{ icon: Plus, label: "Nuevo Registro", onClick: openCreateModal }}
          actions={[
            { icon: ArrowUpDown, label: "Ordenar", onClick: () => setIsSortDrawerOpen(true) },
            { icon: RotateCcw, label: "Reiniciar filtros", onClick: resetAllFilters, disabled: !hasActiveFilters },
            { icon: RefreshCw, label: "Recargar", onClick: loadAll },
          ]}
        />

        <MobileSortDrawer
          open={isSortDrawerOpen}
          onOpenChange={setIsSortDrawerOpen}
          columns={columns}
          sortConfig={sortConfig}
          onSort={setSortConfig}
        />

        <MobileCardList
          data={sortedData}
          isLoading={loading}
          config={{
            getRowId: (row, i) => config?.getRowId?.(row) ?? i,
            // Título/subtítulo: las dos primeras columnas visibles no-auditoría
            // (en todos los catálogos son código + descripción).
            getTitle: (row) => {
              const c = mobileTitleColumns[1] || mobileTitleColumns[0];
              return c ? String(row[c.key] ?? "") || "—" : "—";
            },
            getSubtitle: (row) => {
              const c = mobileTitleColumns[0];
              return c ? String(row[c.key] ?? "") : "";
            },
            fields: mobileFieldColumns.map((c) => ({
              key: c.key,
              label: c.label,
              mono: isMonoColumn(c.key),
              render: (row) => getCellValue(row, c.key) || "—",
            })),
          }}
          onCardClick={(row) => openEditModal(row)}
        />
      </div>

      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={config.columns.find((c) => c.key === activeFilterDropdown)?.label}
            isDate={false}
            data={data}
            getCellValue={getCellValue}
            filters={filters}
            dropdownValues={filterDropdownValues}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

      <CopyCellMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onPaste={handlePasteCell}
        canPaste={!!contextMenu?.colKey && isPasteableColumn(contextMenu.colKey)}
      />

      <CatalogRecordModal
        open={modalState.open}
        mode={modalState.mode}
        config={config}
        initialValues={modalState.record}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
