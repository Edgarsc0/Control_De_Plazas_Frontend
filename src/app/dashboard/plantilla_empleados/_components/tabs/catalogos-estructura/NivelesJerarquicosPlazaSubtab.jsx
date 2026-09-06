"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Layers, Search, RotateCcw, CheckSquare, Square, X, Monitor } from "lucide-react";
import { CatalogoEstructuraService } from "@/services/catalogo_estructura.service";
import { apiFetch } from "@/lib/fetch-interceptor";
import DataTable from "../../shared/DataTable";
import { animateColumnWidth, killColumnWidthAnimation } from "../../shared/columnResize";
import CopyCellMenu from "../../shared/CopyCellMenu";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import PrioridadNivelJerarquicoModal from "./PrioridadNivelJerarquicoModal";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { usePersistedState } from "../../../_hooks/usePersistedState";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import {
  applyColumnFilters,
  getUniqueColumnValues,
  matchesTextCondition,
  finalizeFilterDropdownValues,
  resolveColumnFilterCommit,
  formatDateEsMx,
} from "@/utils/columnFilters";

const ROW_HEIGHT = 37;
const MONO_COLUMN_KEYS = ["plaza"];
const ESTADO_OPTIONS = [
  { id: "todos", label: "Todos" },
  { id: "sin_asignar", label: "Sin asignar" },
  { id: "asignado", label: "Asignado" },
];

const COLUMNS = [
  { key: "plaza", label: "Plaza", width: 150, visible: true },
  { key: "nivel_jerarquico", label: "Nivel Jerárquico", width: 320, visible: true },
  { key: "nvl_direc_origen", label: "Nvl Direc (referencia MOV_POS)", width: 340, visible: true },
  { key: "fecha_modificacion", label: "Última Modificación", width: 180, audit: true, type: "datetime", visible: true },
];

/**
 * Subtab "Niveles Jerárquicos por Plaza": a diferencia de los otros 4
 * catálogos (CRUD de registro único vía modal), aquí el flujo es selección
 * múltiple de plazas + asignación en bloque de un mismo nivel jerárquico
 * (enum NJ+Descripción, cat_nivel_jerarquico_plaza). Usa la misma `DataTable`
 * compartida (filtros/orden estilo Excel) pero reemplaza el botón "VER" de la
 * columna sticky por un checkbox de selección múltiple vía `renderRowAction`.
 */
export default function NivelesJerarquicosPlazaSubtab({ onBeforeRefreshDetalle }) {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [opciones, setOpciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 7.3 QA: persistir configuración por usuario en localStorage.
  const [sortConfig, setSortConfig] = usePersistedState("niveles_jerarquicos_sort", { key: null, direction: null });

  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [selected, setSelected] = useState(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);

  const [assignValue, setAssignValue] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success" | "error", text }

  // Prioridad de nivel jerárquico: qué columna manda como fuente de verdad al
  // cruzar contra MOV_POS/EMPLEADOS_COMPLETOS_SIG (checkboxes mutuamente
  // excluyentes en el header de "nivel_jerarquico" y "nvl_direc_origen").
  const [prioridadFuente, setPrioridadFuente] = useState(null);
  const [prioridadLoading, setPrioridadLoading] = useState(true);
  const [pendingFuente, setPendingFuente] = useState(null);
  const [aplicandoPrioridad, setAplicandoPrioridad] = useState(false);

  const { columns, setColumns, resetWidth } = useColumnState(COLUMNS, "niveles_jerarquicos_columns");
  const tableContainerRef = useRef(null);
  const { selectedCell, setSelectedCell, contextMenu, setContextMenu } = useCellSelection();

  const filters = useColumnFilters({ storageKey: "niveles_jerarquicos_filters" });
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
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, globalSearch, sortConfig.key, sortConfig.direction, estadoFiltro]);

  const isMonoColumn = useCallback((key) => MONO_COLUMN_KEYS.includes(key), []);

  // `nvl_direc_origen` es el mismo número de escala (1-8) que `nivel_jerarquico`,
  // sólo que tal cual vino de MOV_POS al sincronizar (sin curar). `opciones` ya
  // trae las 10 combinaciones oficiales (nivel 3 tiene 2 descripciones válidas:
  // Director / Titular de Aduana), así que se arma el mapa desde ahí en vez de
  // duplicar el enum de negocio en el frontend.
  const descripcionesPorNivel = useMemo(() => {
    const map = new Map();
    opciones.forEach((o) => {
      const nivel = Number.parseInt(o.label, 10);
      if (Number.isNaN(nivel)) return;
      const actuales = map.get(nivel) || [];
      actuales.push(o.descripcion_nivel_jerarquico);
      map.set(nivel, actuales);
    });
    return map;
  }, [opciones]);

  const getCellValue = useCallback((row, key) => {
    if (key === "nivel_jerarquico") {
      return row?.descripcion_nivel_jerarquico ? `${row.nivel_jerarquico} — ${row.descripcion_nivel_jerarquico}` : "";
    }
    if (key === "nvl_direc_origen") {
      const raw = row?.nvl_direc_origen;
      if (raw === null || raw === undefined || String(raw).trim() === "") return "";
      const descs = descripcionesPorNivel.get(Number.parseInt(raw, 10));
      return descs ? `${raw} — ${descs.join(" / ")}` : String(raw);
    }
    const v = row?.[key];
    if (v === null || v === undefined) return "";
    if (key === "fecha_modificacion") return new Date(v).toLocaleString("es-MX");
    return String(v);
  }, [descripcionesPorNivel]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dataRes, opcionesRes] = await Promise.all([
        CatalogoEstructuraService.getNivelesJerarquicosPlaza(),
        CatalogoEstructuraService.getNivelesJerarquicosOpciones(),
      ]);
      if (!dataRes.ok) throw new Error("No se pudo cargar el catálogo de niveles jerárquicos por plaza.");
      if (!opcionesRes.ok) throw new Error("No se pudieron cargar las opciones de nivel jerárquico.");
      setData(await dataRes.json());
      setOpciones(await opcionesRes.json());
    } catch (err) {
      setError(err?.message || "No se pudo cargar el catálogo. Intenta recargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await CatalogoEstructuraService.getNivelJerarquicoPrioridad();
        if (res.ok) setPrioridadFuente((await res.json()).fuente || null);
      } finally {
        setPrioridadLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!assignValue && opciones.length > 0) setAssignValue(opciones[0].descripcion_nivel_jerarquico);
  }, [opciones, assignValue]);

  useEffect(() => {
    document.body.style.overflow = activeFilterDropdown ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [activeFilterDropdown]);

  // Filtro rápido sin_asignar/asignado (independiente de los filtros estilo Excel de la tabla).
  const estadoFilteredData = useMemo(() => {
    if (estadoFiltro === "sin_asignar") return data.filter((r) => !r.descripcion_nivel_jerarquico);
    if (estadoFiltro === "asignado") return data.filter((r) => !!r.descripcion_nivel_jerarquico);
    return data;
  }, [data, estadoFiltro]);

  const filteredData = useMemo(() => applyColumnFilters(estadoFilteredData, {
    globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn,
  }), [estadoFilteredData, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData;
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      const av = getCellValue(a, key), bv = getCellValue(b, key);
      if (av === bv) return 0;
      if (av === "") return 1;
      if (bv === "") return -1;
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortConfig, getCellValue]);

  // Miles de plazas posibles: sin esto React montaba un <tr> por fila entera
  // (de ahí la lentitud/warning de Firefox). Mismo patrón de ventana con
  // overscan que el resto de tabs de plantilla (MovimientosTab, BajasTab...).
  const containerHeight = 800;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 15);
  const endIndex = Math.min(sortedData.length, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT) + 15);
  const pagedData = useMemo(() => sortedData.slice(startIndex, endIndex), [sortedData, startIndex, endIndex]);

  useEffect(() => { setScrollTop(0); }, [globalSearch, columnFilters, textFilters, estadoFiltro, sortConfig]);

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
    const target = columns[index];
    const startX = e.clientX, startWidth = target.width;
    let latestWidth = startWidth;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestWidth = Math.max(60, direction === "left" ? startWidth - deltaX : startWidth + deltaX);
      if (!animateColumnWidth(tableContainerRef, target.key, latestWidth)) {
        setColumns((prev) => prev.map((c) => (c.key === target.key ? { ...c, width: latestWidth } : c)));
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      killColumnWidthAnimation(tableContainerRef, target.key);
      setColumns((prev) => prev.map((c) => (c.key === target.key ? { ...c, width: latestWidth } : c)));
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
    const reachableData = applyColumnFilters(estadoFilteredData, {
      globalSearch, columnFilters: otherColumnFilters, textFilters: otherTextFilters, getCellValue, isMonoColumn,
    });
    return getUniqueColumnValues(reachableData, colKey, getCellValue);
  }, [estadoFilteredData, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]);

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
    return getUniqueColumnValues(estadoFilteredData, activeFilterDropdown, getCellValue);
  }, [activeFilterDropdown, estadoFilteredData, getCellValue]);

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
    // Conteo dinámico: `dropdownUniqueValues` es sobre el dataset visible sin
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

  const hasActiveFilters = !!globalSearch || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some((f) => f?.value) || estadoFiltro !== "todos";
  const resetAllFilters = () => {
    setGlobalSearch("");
    setColumnFilters({});
    setTextFilters({});
    setActiveFilterDropdown(null);
    setActiveConditionDropdown(null);
    setEstadoFiltro("todos");
  };

  const toggleRow = useCallback((plaza) => {
    if (!plaza) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(plaza) ? next.delete(plaza) : next.add(plaza);
      return next;
    });
  }, []);

  const allFilteredSelected = sortedData.length > 0 && sortedData.every((r) => selected.has(r.plaza));

  const toggleSelectAllFiltered = () => {
    setSelected((prev) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(prev);
      sortedData.forEach((r) => next.add(r.plaza));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const isRowSelected = useCallback((idx) => selected.has(sortedData[idx]?.plaza), [selected, sortedData]);
  const onRowClick = useCallback((idx) => toggleRow(sortedData[idx]?.plaza), [toggleRow, sortedData]);

  const renderRowAction = useCallback(({ row, isSelected }) => (
    <button
      onClick={(e) => { e.stopPropagation(); toggleRow(row.plaza); }}
      className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:text-slate-500 dark:hover:text-[#bc955c] transition-colors cursor-pointer"
      title={isSelected ? "Quitar de la selección" : "Agregar a la selección"}
    >
      {isSelected ? <CheckSquare className="size-4 text-[#621f32]" /> : <Square className="size-4" />}
    </button>
  ), [toggleRow]);

  const handleBulkAssign = async () => {
    if (selected.size === 0 || !assignValue) return;
    setAssigning(true);
    setBanner(null);
    try {
      const res = await CatalogoEstructuraService.bulkAssignNivelJerarquico(Array.from(selected), assignValue);
      if (!res.ok) throw new Error("No se pudo asignar el nivel jerárquico a la selección.");
      const body = await res.json();
      setBanner({ type: "success", text: `Nivel jerárquico asignado a ${body.actualizadas} plaza(s).` });
      clearSelection();
      // Prende el skeleton de "Plantilla Detalle" DESDE ACÁ, no después de
      // recargar el catálogo y limpiar la caché: esos dos pasos son
      // request(s) de red que pueden tardar varios segundos, y si el
      // usuario se cambia de tab durante esa ventana (antes de llegar al
      // router.refresh() de abajo) no debe ver la tabla quieta sin ningún
      // indicativo — el nivel ya se guardó, solo falta que se refleje.
      onBeforeRefreshDetalle?.();
      await load();
      // El bulk-assign ya propagó el nivel a EMPLEADOS_COMPLETOS_SIG/MOV_POS
      // en el backend; acá solo limpiamos la caché del servidor (Redis) y
      // refrescamos el Server Component de la página para que Plantilla
      // Detalle/Movimientos no sigan sirviendo el valor viejo hasta que
      // expire el TTL del cache. No crítico: si falla (ej. el usuario no
      // tiene permiso de Monitoreo ZAFIRO), el TTL lo resuelve solo.
      try {
        await apiFetch("/plantilla/bitacora/invalidar-cache-manual/", { method: "POST" });
      } catch {
        // silencioso a propósito, ver comentario arriba.
      }
      router.refresh();
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "No se pudo asignar el nivel jerárquico." });
    } finally {
      setAssigning(false);
    }
  };

  const handleTogglePrioridad = useCallback((fuente) => {
    if (prioridadFuente !== fuente) setPendingFuente(fuente);
  }, [prioridadFuente]);

  const closePendingPrioridad = () => { if (!aplicandoPrioridad) setPendingFuente(null); };

  const confirmarPrioridad = async () => {
    if (!pendingFuente) return;
    setAplicandoPrioridad(true);
    setBanner(null);
    try {
      const res = await CatalogoEstructuraService.aplicarNivelJerarquicoPrioridad(pendingFuente);
      if (!res.ok) throw new Error("No se pudo aplicar la prioridad de nivel jerárquico.");
      const body = await res.json();
      setPrioridadFuente(body.fuente);
      setBanner({ type: "success", text: `Prioridad aplicada: ${body.empleados_actualizados} empleado(s) en EMPLEADOS_COMPLETOS_SIG y ${body.posiciones_actualizadas} posición(es) en MOV_POS.` });
      setPendingFuente(null);
      await load();
      // Reejecuta el Server Component de la página (force-dynamic) para que
      // Plantilla Detalle/Movimientos reciban `detalle`/`movPosData` frescos
      // al cambiar de tab, sin esperar el TTL del cache del backend.
      router.refresh();
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "No se pudo aplicar la prioridad de nivel jerárquico." });
    } finally {
      setAplicandoPrioridad(false);
    }
  };

  const renderColumnHeaderExtra = useCallback((col) => {
    if (col.key !== "nivel_jerarquico" && col.key !== "nvl_direc_origen") return null;
    // Si aún no se ha fijado ninguna prioridad en BD (config.fuente null), se
    // muestra "nvl_direc_origen" marcado por default: es el dato tal cual
    // viene de MOV_POS (sin curar a mano), la opción segura para no asumir
    // que el nivel_jerarquico manual ya manda cuando en realidad no hay
    // ninguna prioridad aplicada todavía.
    const checked = prioridadFuente === col.key
      || (prioridadFuente === null && !prioridadLoading && col.key === "nvl_direc_origen");
    return (
      <label
        title="Prioridad de nivel jerárquico: al aplicar, sobreescribe MOV_POS y EMPLEADOS_COMPLETOS_SIG donde la posición coincida"
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={prioridadLoading}
          onChange={() => handleTogglePrioridad(col.key)}
          className="size-3 accent-[#bc955c] cursor-pointer"
        />
        <span className="text-[8px] font-black uppercase text-white/80 whitespace-nowrap">Prioridad NJ</span>
      </label>
    );
  }, [prioridadFuente, prioridadLoading, handleTogglePrioridad]);

  const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
    let display;
    if (col.key === "nivel_jerarquico") {
      // Chequear con `descripcion_nivel_jerarquico` (no con `value`/nivel_jerarquico):
      // nivel 0 (Titular ANAM) es número válido pero falsy, `value ? ... : null` lo
      // mandaba a "Sin asignar". Además ahora se muestra la descripción completa,
      // no sólo el número.
      display = row.descripcion_nivel_jerarquico
        ? `${row.nivel_jerarquico} — ${row.descripcion_nivel_jerarquico}`
        : null;
    } else if (col.key === "nvl_direc_origen") {
      const raw = row.nvl_direc_origen;
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        display = null;
      } else {
        const descs = descripcionesPorNivel.get(Number.parseInt(raw, 10));
        display = descs ? `${raw} — ${descs.join(" / ")}` : String(raw);
      }
    } else if (col.type === "datetime" && value) {
      display = formatDateEsMx(value, { withTime: true });
    } else {
      display = value === null || value === undefined || String(value).trim() === "" ? null : String(value);
    }
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
        {display ?? (col.key === "nivel_jerarquico"
          ? <span className="text-slate-300 italic">Sin asignar</span>
          : <span className="text-slate-300">-</span>)}
      </td>
    );
  };

  return (
    <div className="animate-in fade-in duration-400 flex flex-col bg-white/5 dark:bg-slate-950/10 backdrop-blur-lg border-y border-gray-200/80 dark:border-slate-800/80 shadow-2xl">
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-slate-900/15">
        <div className="flex items-center gap-3 min-w-[280px] max-w-full md:max-w-md lg:max-w-xl">
          <div className="p-2.5 bg-[#621f32]/10 dark:bg-[#621f32]/20 text-[#621f32] rounded-xl flex items-center justify-center shrink-0 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Niveles Jerárquicos por Plaza</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Selecciona varias plazas y asígnales el mismo nivel jerárquico. Tabla física: <span className="font-mono">cat_nivel_jerarquico_plaza</span>.
            </p>
          </div>
        </div>

        {/* Sólo desktop: operan sobre la tabla, que vive en `hidden md:flex`. */}
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
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 cursor-pointer"
          >
            {ESTADO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button
            onClick={resetAllFilters}
            disabled={!hasActiveFilters}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-600 hover:border-red-200 transition-all tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar filtros
          </button>
          <button
            onClick={toggleSelectAllFiltered}
            disabled={sortedData.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {allFilteredSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />} Seleccionar filtradas
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400">{error}</div>
      )}
      {banner && (
        <div className={`px-6 py-2 border-b text-xs font-semibold ${banner.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400"}`}>
          {banner.text}
        </div>
      )}

      {/* ── Barra de asignación en bloque: sólo con selección activa ────────── */}
      {selected.size > 0 && (
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 bg-[#621f32]/[0.06] dark:bg-[#621f32]/[0.12] border-b border-[#621f32]/15">
          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-wider">{selected.size} plaza(s) seleccionada(s)</span>
          <select
            value={assignValue}
            onChange={(e) => setAssignValue(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-[#621f32]/30 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 cursor-pointer min-w-[280px]"
          >
            {opciones.map((o) => (
              <option key={o.descripcion_nivel_jerarquico} value={o.descripcion_nivel_jerarquico}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={assigning || !assignValue}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#621f32] rounded-xl text-[9px] font-black uppercase text-white hover:bg-[#4d1827] transition-all tracking-wider shadow-sm disabled:opacity-50 cursor-pointer"
          >
            Asignar a seleccionados
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[9px] font-black uppercase text-gray-500 hover:bg-white/60 dark:hover:bg-slate-800 transition-all tracking-wider cursor-pointer"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        </div>
      )}

      {/* ── Tabla densa: sólo desktop ─────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col" style={{ height: "calc(100vh - 280px)" }}>
        <DataTable
          containerRef={tableContainerRef}
          fillHeight
          onScroll={setScrollTop}
          columns={columns}
          columnFilters={columnFilters}
          setColumnFilters={setColumnFilters}
          textFilters={textFilters}
          setTextFilters={setTextFilters}
          activeConditionDropdown={activeConditionDropdown}
          setActiveConditionDropdown={setActiveConditionDropdown}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          onCellContextMenu={(e, value, rect) => setContextMenu({ x: e.clientX, y: e.clientY, value, rect })}
          isRowSelected={isRowSelected}
          onRowClick={onRowClick}
          renderRowAction={renderRowAction}
          rowActionHeaderLabel="SEL"
          renderColumnHeaderExtra={renderColumnHeaderExtra}
          sortConfig={sortConfig}
          onSort={handleSort}
          onOpenFilter={openFilterDropdown}
          onResizeStart={handleResizeStart}
          onResizeReset={(index) => resetWidth(columns[index]?.key)}
          getColumnLetter={getColumnLetter}
          isMonoColumn={isMonoColumn}
          isPending={false}
          isLoading={loading}
          loadingMessage="Cargando plazas..."
          data={pagedData}
          startIndex={startIndex}
          endIndex={endIndex}
          totalCount={sortedData.length}
          rowHeight={ROW_HEIGHT}
          getRowId={(row) => row.plaza}
          renderCell={renderCell}
          fillWidth
        />
      </div>

      {/* ── Aviso móvil: la administración de catálogos requiere escritorio ── */}
      <div className="md:hidden flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
        <div className="p-3 rounded-2xl bg-[#621f32]/8 text-[#621f32] dark:text-[#bc955c]">
          <Monitor className="size-6" />
        </div>
        <p className="text-sm font-bold text-gray-600 dark:text-slate-300">
          «Niveles Jerárquicos por Plaza» requiere pantalla grande
        </p>
        <p className="text-xs text-gray-400 max-w-xs">
          Esta vista asigna niveles a varias plazas a la vez sobre una tabla ancha; ábrela desde una computadora.
        </p>
      </div>

      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={COLUMNS.find((c) => c.key === activeFilterDropdown)?.label}
            isDate={false}
            data={estadoFilteredData}
            getCellValue={getCellValue}
            filters={filters}
            dropdownValues={filterDropdownValues}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

      <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />

      <PrioridadNivelJerarquicoModal
        open={!!pendingFuente}
        columnLabel={COLUMNS.find((c) => c.key === pendingFuente)?.label}
        applying={aplicandoPrioridad}
        onConfirm={confirmarPrioridad}
        onClose={closePendingPrioridad}
      />
    </div>
  );
}
