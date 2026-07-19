"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Zoom } from "react-awesome-reveal";
import {
  AreaChart, Area, ResponsiveContainer, YAxis, Tooltip as RechartsTooltip,
} from "recharts";
import {
  Search, Download, Columns, X, RotateCcw,
  ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight, CheckCircle2, XCircle,
  Layers, Users, GitCompareArrows, ListFilter, Check,
} from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DataTable from "../../shared/DataTable";
import ColumnsModal from "../../shared/ColumnsModal";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import CopyCellMenu from "../../shared/CopyCellMenu";
import AlineacionDetalleModal from "../../modals/AlineacionDetalleModal";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { usePersistedState } from "../../../_hooks/usePersistedState";
import { finalizeFilterDropdownValues, normalizeForSearch, sortValueCounts } from "@/utils/columnFilters";

// Mismos 14 pares de columnas que compara el backend (ver ALINEACIÓN_PLAZA_PERSONA
// y `ALINEACION_CAMPOS` en plantilla/views.py). El key de columna en la tabla es
// `match_<key>`: así el filtro/orden de columna genérico (igual que el resto de
// tabs de Mov. Posiciones) funciona gratis sobre "Coincide"/"Difiere".
const ALINEACION_CAMPOS = [
  { key: "cd_un", label: "Código Unidad de Negocio" },
  { key: "cd_ua", label: "Código Unidad Administrativa" },
  { key: "nivel_jerarquico", label: "Nivel Jerárquico" },
  { key: "id_departamento", label: "Id Departamento" },
  { key: "cd_pto_funcional", label: "Código Puesto Funcional" },
  { key: "nombre_pto_funcional", label: "Nombre Puesto Funcional" },
  { key: "codigo_presupuestal", label: "Código Presupuestal" },
  { key: "escala", label: "Escala" },
  { key: "grado", label: "Grado" },
  { key: "partida", label: "Partida" },
  { key: "tipo_contratacion", label: "Tipo de Contratación" },
  { key: "dependencia_directa", label: "Dependencia Directa" },
  { key: "ubicacion", label: "Ubicación" },
];

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getColumnLetter = (index) => {
  let temp = index, letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

const noop = () => {};

const formatFechaCorta = (iso) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

// Tooltip del mini-histórico dentro de la tarjeta "Alineación General"
// (fondo oscuro, distinto del CustomTooltip claro de las demás gráficas).
const HistoricoAlineacionTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[9px] font-black uppercase text-slate-500">{formatFechaCorta(p.fecha)}</p>
      <p className="text-sm font-black text-[#621f32] dark:text-[#bc955c]">{p.porcentaje_alineacion_general}%</p>
    </div>
  );
};

// Campos con catálogo de descripción legible detrás del código (ver
// TOOLTIP_ALINEACION_CAMPOS en plantilla/views.py): tooltip muestra el nombre
// de la Unidad de Negocio / Unidad Administrativa / Nivel Jerárquico / Departamento.
const TOOLTIP_ALINEACION_KEYS = new Set(["cd_un", "cd_ua", "nivel_jerarquico", "id_departamento"]);

const TEXT_CONDITION_SUFFIX = {
  contains: "icontains",
  not_contains: "icontains",
  starts_with: "istartswith",
  not_starts_with: "istartswith",
  ends_with: "iendswith",
  not_ends_with: "iendswith",
  equals: "iexact",
  not_equals: "iexact",
};
const isExcludeCondition = (cond) => cond?.startsWith("not_");

export default function AlineacionOrganizacionalTab({ isPending, startTransition, cardRef }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [historicoAlineacion, setHistoricoAlineacion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // 7.3 QA: persistir configuración por usuario en localStorage.
  const [sortConfig, setSortConfig] = usePersistedState("alineacion_sort", { key: null, direction: null });
  const [cardWidth, setCardWidth] = useState(null);
  const [detalleRow, setDetalleRow] = useState(null);
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [diffFields, setDiffFields] = useState([]);
  const [diffFieldsOpen, setDiffFieldsOpen] = useState(false);
  const tbodyRef = useRef(null);
  const containerRef = useRef(null);
  const diffFieldsRef = useRef(null);

  const { selectedCell, setSelectedCell, contextMenu, setContextMenu } = useCellSelection();

  const filters = useColumnFilters({ storageKey: "alineacion_filters" });
  const {
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    filterDropdownTab, setFilterDropdownTab,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    filterSearchText, setFilterSearchText,
    debouncedFilterSearchText,
  } = filters;

  // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, debouncedSearch, sortConfig.key, sortConfig.direction, diffFields]);

  const [debouncedTextFilters, setDebouncedTextFilters] = useState({});
  const [uniqueColumnValues, setUniqueColumnValues] = useState({});
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const [hasInitializedTemp, setHasInitializedTemp] = useState(false);

  const columnasBase = useMemo(() => ([
    { key: "no_pos_actual", label: "No. Posición", width: 120, visible: true, isBasic: true },
    { key: "nombre_puesto", label: "Nombre Puesto (MOV_POS)", width: 240, visible: true, isBasic: true },
    { key: "ocupante_nombre", label: "Ocupante", width: 220, visible: true, isBasic: true },
    { key: "ocupacion", label: "Ocupación", width: 110, visible: true, isBasic: true },
    { key: "estado_alineacion", label: "Estado de Alineación", width: 175, visible: true, isBasic: true },
    { key: "num_diferencias", label: "Núm. Diferencias", width: 150, visible: true, isBasic: true },
  ]), []);

  // Por cada campo: 2 columnas de valor bajo un header fusionado con el nombre
  // del campo arriba y "MOV_POS"/"PLANTILLA" abajo (`col.group`, ver DataTable),
  // + 1 columna de estado (Coincide/Difiere) oculta por defecto (togglable
  // desde "Columnas") para poder seguir filtrando "difiere en este campo".
  const columnasComparacion = useMemo(() => ALINEACION_CAMPOS.flatMap((c) => ([
    { key: `mov_${c.key}`, label: "MOV_POS", group: c.label, width: 200, visible: true, isBasic: false, alineacionKey: c.key, valorTipo: "mov" },
    { key: `emp_${c.key}`, label: "PLANTILLA", group: c.label, width: 200, visible: true, isBasic: false, alineacionKey: c.key, valorTipo: "emp" },
    { key: `match_${c.key}`, label: `${c.label} · Estado`, width: 140, visible: false, isBasic: false, alineacionKey: c.key, valorTipo: "match" },
  ])), []);

  const initialColumns = useMemo(() => [...columnasBase, ...columnasComparacion], [columnasBase, columnasComparacion]);

  const {
    columns, setColumns, toggleVisibility: toggleColumnVisibility,
    isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen,
  } = useColumnState(initialColumns, "alineacion_columns");

  const isMonoColumn = useCallback((key) => key === "no_pos_actual", []);

  useEffect(() => {
    if (!diffFieldsOpen) return;
    const handler = (e) => {
      if (diffFieldsRef.current && !diffFieldsRef.current.contains(e.target)) setDiffFieldsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [diffFieldsOpen]);

  const toggleDiffField = useCallback((key) => {
    setLoading(true);
    setDiffFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPage(1);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => { setLoading(true); setDebouncedSearch(searchQuery); setPage(1); }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => { setLoading(true); setDebouncedTextFilters(textFilters); setPage(1); }, 450);
    return () => clearTimeout(handler);
  }, [textFilters]);

  const buildBaseParams = useCallback(() => {
    const filterParams = {};
    Object.entries(debouncedTextFilters).forEach(([key, filterObj]) => {
      if (!filterObj || !filterObj.value || !filterObj.value.trim()) return;
      const cond = filterObj.condition || (isMonoColumn(key) ? "starts_with" : "contains");
      const suffix = TEXT_CONDITION_SUFFIX[cond] || "icontains";
      const paramKey = isExcludeCondition(cond) ? `exclude__${key}__${suffix}` : `${key}__${suffix}`;
      filterParams[paramKey] = filterObj.value.trim();
    });
    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values && values.length > 0) colParams[`${key}__in`] = values.join(",");
    });
    const params = { search: debouncedSearch, ...filterParams, ...colParams };
    if (diffFields.length > 0) params.diff_fields = diffFields.join(",");
    if (sortConfig.key) {
      params.sort_by = sortConfig.key;
      params.sort_order = sortConfig.direction || "asc";
    }
    return params;
  }, [debouncedSearch, debouncedTextFilters, columnFilters, diffFields, sortConfig, isMonoColumn]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params = { ...buildBaseParams(), page, page_size: pageSize };
    VacantesService.getMovPosAlineacion(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        setData(resData.results || []);
        setCount(resData.count || 0);
        if (resData.stats) setStats(resData.stats);
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("Error cargando alineación organizacional:", err); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [page, pageSize, buildBaseParams]);

  // Histórico diario del % de Alineación General (independiente de filtros/página;
  // lo actualiza la tarea Celery `importar_zafiro` cada vez que corre, ver
  // `_actualizar_historico_alineacion_general` en plantilla/tasks.py).
  useEffect(() => {
    const ctrl = new AbortController();
    VacantesService.getMovPosAlineacionHistorico({ dias: 90 }, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => setHistoricoAlineacion(resData.results || []))
      .catch((err) => { if (err.name !== "AbortError") console.error("Error cargando histórico de alineación:", err); });
    return () => ctrl.abort();
  }, []);

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
    setActiveFilterDropdown(colKey);
    setFilterDropdownTab("todos");
    setFilterSearchText("");
    setHasInitializedTemp(false);
    setTempSelectedValues(columnFilters[colKey] || []);
  };

  useEffect(() => {
    if (!activeFilterDropdown) return;
    const ctrl = new AbortController();
    setLoadingUniqueValues(true);
    const params = { distinct_field: activeFilterDropdown, distinct_search: debouncedFilterSearchText };
    if (filterDropdownTab === "actuales") {
      // "Vista actual": valores únicos ya acotados por el resto de filtros activos
      // (todos menos la columna que se está filtrando).
      Object.assign(params, buildBaseParams());
      delete params[`${activeFilterDropdown}__in`];
    }
    VacantesService.getMovPosAlineacion(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        const valuesList = sortValueCounts(Array.isArray(resData) ? resData : []);
        setUniqueColumnValues((prev) => ({ ...prev, [activeFilterDropdown]: valuesList }));
        setHasInitializedTemp((prevInit) => {
          if (!prevInit) {
            if (columnFilters[activeFilterDropdown]) setTempSelectedValues(columnFilters[activeFilterDropdown]);
            else setTempSelectedValues(valuesList.map((v) => v.value));
            return true;
          }
          return prevInit;
        });
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("Error valores únicos de columna:", err); })
      .finally(() => { if (!ctrl.signal.aborted) setLoadingUniqueValues(false); });
    return () => ctrl.abort();
  }, [activeFilterDropdown, debouncedFilterSearchText, columnFilters, filterDropdownTab, buildBaseParams]);

  const applyColumnFilter = (colKey) => {
    const newFilters = { ...columnFilters };
    if (tempSelectedValues.length === 0) delete newFilters[colKey];
    else newFilters[colKey] = tempSelectedValues;
    setLoading(true);
    setColumnFilters(newFilters);
    setPage(1);
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    const newFilters = { ...columnFilters };
    delete newFilters[colKey];
    setLoading(true);
    setColumnFilters(newFilters);
    setPage(1);
    setActiveFilterDropdown(null);
  };

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };
    const list = uniqueColumnValues[activeFilterDropdown] || [];
    const searchNorm = normalizeForSearch(filterSearchText);
    const filtered = list.filter((v) => normalizeForSearch(v.value).includes(searchNorm));
    return finalizeFilterDropdownValues({
      baseUniqueValues: list,
      filtered,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
    });
  }, [activeFilterDropdown, uniqueColumnValues, filterSearchText, tempSelectedValues, columnFilters]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    else if (sortConfig.key === key && sortConfig.direction === "desc") direction = null;
    setLoading(true);
    setSortConfig({ key: direction ? key : null, direction });
    setPage(1);
  };

  const handleMouseDown = (e, index, direction = "right") => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns((prevCols) => {
        const newCols = [...prevCols];
        const newWidth = direction === "left" ? startWidth - deltaX : startWidth + deltaX;
        newCols[index] = { ...newCols[index], width: Math.max(60, newWidth) };
        return newCols;
      });
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleCardResizeMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const rect = cardRef.current?.getBoundingClientRect();
    const startWidth = rect ? rect.width : 1280;
    const maxAllowedWidth = window.innerWidth - 48;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setCardWidth(Math.max(400, Math.min(maxAllowedWidth, startWidth + 2 * deltaX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const resetAllFilters = () => {
    setLoading(true);
    setTextFilters({});
    setColumnFilters({});
    setSearchQuery("");
    setDebouncedSearch("");
    setDiffFields([]);
    setSortConfig({ key: null, direction: null });
    setPage(1);
  };

  const canReset = useMemo(() => {
    return !!debouncedSearch || Object.keys(columnFilters).length > 0 || diffFields.length > 0
      || Object.values(textFilters).some((v) => v && v.value) || !!sortConfig.key;
  }, [debouncedSearch, columnFilters, diffFields, textFilters, sortConfig]);

  // `updates`: { [field]: value|null }. Usa la forma funcional de `setColumnFilters`
  // para poder limpiar más de una columna en un solo click (p.ej. la tarjeta
  // "Todas") sin que la 2ª actualización pise a la 1ª por closure obsoleto
  // dentro del mismo batch de React.
  const handleCardFilter = useCallback((updates) => {
    setLoading(true);
    startTransition(() => {
      setColumnFilters((prev) => {
        const newF = { ...prev };
        Object.entries(updates).forEach(([field, value]) => {
          if (value === null) delete newF[field];
          else newF[field] = [value];
        });
        return newF;
      });
      setPage(1);
    });
  }, [startTransition]);

  const cardData = useMemo(() => {
    if (!stats) return [];
    const estadoActivo = columnFilters.estado_alineacion?.[0];
    const ocupacionActiva = columnFilters.ocupacion?.[0];
    return [
      {
        key: "todas", label: "Plazas Activas", count: stats.total_activas, icon: Layers, color: "#621f32",
        isActive: !estadoActivo && !ocupacionActiva,
        onClick: () => handleCardFilter({ estado_alineacion: null, ocupacion: null }),
      },
      {
        key: "alineadas", label: "Alineadas", count: stats.total_alineadas, icon: CheckCircle2, color: "#059669",
        isActive: estadoActivo === "Alineada",
        onClick: () => handleCardFilter({ estado_alineacion: estadoActivo === "Alineada" ? null : "Alineada" }),
      },
      {
        key: "diferencias", label: "Con Diferencias", count: stats.total_con_diferencias, icon: XCircle, color: "#dc2626",
        isActive: estadoActivo === "Con Diferencias",
        onClick: () => handleCardFilter({ estado_alineacion: estadoActivo === "Con Diferencias" ? null : "Con Diferencias" }),
        breakdown: [
          { label: "Ocupadas", count: stats.con_diferencias_ocupadas },
          { label: "Vacantes", count: stats.con_diferencias_vacantes },
        ],
      },
      {
        key: "vacantes", label: "Vacantes", count: stats.total_vacantes, icon: Users, color: "#94a3b8",
        isActive: ocupacionActiva === "Vacante",
        onClick: () => handleCardFilter({ ocupacion: ocupacionActiva === "Vacante" ? null : "Vacante" }),
      },
    ];
  }, [stats, columnFilters, handleCardFilter]);

  const rankingColumnasProblema = useMemo(() => {
    if (!stats?.por_campo) return [];
    const top = Object.values(stats.por_campo)
      .filter((c) => c.difieren > 0)
      .sort((a, b) => b.difieren - a.difieren)
      .slice(0, 5);
    // % de cada columna sobre el total de discrepancias de todas las columnas
    // (suma de "difieren" de los 14 campos, no solo de las 5 mostradas), para
    // que la altura de la barra refleje su peso real dentro del total.
    const totalDifieren = Object.values(stats.por_campo).reduce((acc, c) => acc + c.difieren, 0);
    const maxDifieren = top.length ? top[0].difieren : 0;
    return top.map((c) => ({
      ...c,
      porcentajeDelTotal: totalDifieren ? Math.round((c.difieren / totalDifieren) * 1000) / 10 : 0,
      alturaPct: maxDifieren ? Math.round((c.difieren / maxDifieren) * 100) : 0,
    }));
  }, [stats]);

  const renderCell = useCallback(({ row, col, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    let cellClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "ring-2 ring-inset ring-[#621f32] dark:ring-[#bc955c] bg-white dark:bg-slate-950 font-black text-[#621f32] dark:text-[#bc955c] shadow-lg relative z-[25]" : "font-semibold text-slate-700 dark:text-slate-300"}`;
    if (isSticky) cellClass += " bg-white/95 dark:bg-slate-900/95";

    let content;
    let tooltipNombre = null;
    if (col.alineacionKey) {
      const detalle = row.alineacion_detalle?.[col.alineacionKey];
      const coincide = row[`match_${col.alineacionKey}`] === "Coincide";
      if (col.valorTipo === "match") {
        content = (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${coincide ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"}`}>
            {coincide ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {coincide ? "Coincide" : "Difiere"}
          </span>
        );
      } else {
        const valor = col.valorTipo === "mov" ? detalle?.mov_pos_valor : detalle?.empleados_sig_valor;
        if (TOOLTIP_ALINEACION_KEYS.has(col.alineacionKey)) {
          tooltipNombre = col.valorTipo === "mov" ? detalle?.mov_pos_nombre : detalle?.empleados_sig_nombre;
        }
        content = (
          <div className="flex items-center gap-1.5">
            {col.valorTipo === "mov" && (
              coincide ? (
                <CheckCircle2 className={`size-3.5 shrink-0 ${detalle?.ambos_vacios ? "text-slate-300 dark:text-slate-600" : "text-emerald-500"}`} />
              ) : (
                <XCircle className="size-3.5 shrink-0 text-red-500" />
              )
            )}
            <span className={!coincide ? "text-red-600 dark:text-red-400 font-bold" : ""}>{valor ?? "-"}</span>
          </div>
        );
      }
    } else if (col.key === "estado_alineacion") {
      const alineada = row.estado_alineacion === "Alineada";
      content = (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${alineada ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"}`}>
          {alineada ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
          {row.estado_alineacion}
        </span>
      );
    } else if (col.key === "num_diferencias") {
      const sinDiferencias = row.num_diferencias === 0;
      content = (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${sinDiferencias ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"}`}>
          {row.num_diferencias}/{row.campos_totales}
        </span>
      );
    } else if (col.key === "ocupacion") {
      const ocupada = row.ocupacion === "Ocupada";
      content = (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${ocupada ? "bg-[#621f32]/8 text-[#621f32] border-[#621f32]/20" : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}>
          {row.ocupacion}
        </span>
      );
    } else {
      content = row[col.key] || "-";
    }

    const tdStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: isSelected ? 25 : 20 } : {};

    if (tooltipNombre) {
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={tdStyle} className={`${cellClass} cursor-help`} onClick={onClick} onContextMenu={onContextMenu}>
              {content}
            </td>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipNombre}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <td
        key={col.key}
        style={tdStyle}
        className={cellClass}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        {content}
      </td>
    );
  }, []);

  const handleCellContextMenu = useCallback((e, value, rect) => {
    setContextMenu({ x: e.clientX, y: e.clientY, value, rect });
  }, [setContextMenu]);

  const handleShowRecord = useCallback((row) => {
    setDetalleRow(row);
    setIsDetalleOpen(true);
  }, []);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const params = { ...buildBaseParams(), no_pagination: true };
      const res = await VacantesService.getMovPosAlineacion(params);
      const resData = await res.json();
      const allData = resData.results || [];

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Alineación Organizacional");

      const visibleCols = columns.filter((c) => c.visible);
      worksheet.columns = visibleCols.map((c) => ({ header: c.group ? `${c.group} (${c.label})` : c.label, key: c.key, width: 24 }));

      allData.forEach((row) => {
        const rowData = {};
        visibleCols.forEach((c) => {
          if (c.alineacionKey) {
            const detalle = row.alineacion_detalle?.[c.alineacionKey];
            if (c.valorTipo === "match") {
              rowData[c.key] = detalle ? (detalle.coincide ? "Coincide" : "Difiere") : "";
            } else {
              rowData[c.key] = detalle ? (c.valorTipo === "mov" ? detalle.mov_pos_valor : detalle.empleados_sig_valor) : "";
            }
          } else {
            rowData[c.key] = row[c.key];
          }
        });
        const addedRow = worksheet.addRow(rowData);
        addedRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFBC955C" } },
            left: { style: "thin", color: { argb: "FFBC955C" } },
            bottom: { style: "thin", color: { argb: "FFBC955C" } },
            right: { style: "thin", color: { argb: "FFBC955C" } },
          };
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B4C7E" } };
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "medium", color: { argb: "FFBC955C" } },
          left: { style: "medium", color: { argb: "FFBC955C" } },
          bottom: { style: "medium", color: { argb: "FFBC955C" } },
          right: { style: "medium", color: { argb: "FFBC955C" } },
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Alineacion_Organizacional.xlsx";
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6 pt-2">
        <Zoom triggerOnce>
          <div className="flex flex-col lg:flex-row gap-4 mb-6 w-full items-stretch">
            {/* % de Alineación General */}
            <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between shrink-0 lg:w-64 bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white shadow-xl shadow-[#621f32]/25">
              <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-2 rounded-xl bg-white/15"><GitCompareArrows className="size-4" /></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Alineación General</span>
              </div>
              <div className="relative z-10">
                <span className="text-4xl font-black leading-none">
                  {stats ? `${stats.porcentaje_alineacion_general}%` : "—"}
                </span>
                <p className="text-[11px] font-bold text-white/70 mt-2">
                  {stats ? `${formatNumber(stats.total_alineadas)} de ${formatNumber(stats.total_activas)} plazas 100% alineadas` : "Cargando..."}
                </p>
                {historicoAlineacion.length > 1 && (
                  <div className="mt-3 -mx-1 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicoAlineacion} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <defs>
                          <linearGradient id="alineacionHistoricoFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <YAxis hide domain={[(dataMin) => Math.max(0, Math.floor(dataMin) - 5), 100]} />
                        <RechartsTooltip content={<HistoricoAlineacionTooltip />} cursor={{ stroke: "#ffffff", strokeOpacity: 0.35 }} />
                        <Area
                          type="monotone"
                          dataKey="porcentaje_alineacion_general"
                          stroke="#ffffff"
                          strokeWidth={2}
                          fill="url(#alineacionHistoricoFill)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjetas clicables */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(stats ? cardData : Array.from({ length: 4 })).map((card, idx) => card ? (
                <button
                  key={card.key}
                  onClick={card.onClick}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${card.isActive ? "border-transparent shadow-lg" : "border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 hover:shadow-md"}`}
                  style={card.isActive ? { backgroundColor: `${card.color}14`, borderColor: `${card.color}40` } : {}}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className="size-4" style={{ color: card.color }} />
                    <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">{card.label}</span>
                  </div>
                  <span className="text-2xl font-black" style={{ color: card.color }}>{formatNumber(card.count)}</span>
                  {card.breakdown && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      {card.breakdown.map((b) => (
                        <span key={b.label} className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          {b.label}: <span className="font-black" style={{ color: card.color }}>{formatNumber(b.count)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ) : (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 animate-pulse h-[86px]" />
              ))}
            </div>

            {/* Ranking columnas con más discrepancias (barras verticales) */}
            <div className="relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col shrink-0 lg:w-80 border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 block shrink-0">Columnas con más discrepancias</span>
              {rankingColumnasProblema.length > 0 ? (
                <div className="flex-1 flex items-end justify-between gap-2 min-h-[96px]">
                  {rankingColumnasProblema.map((c) => {
                    const active = c.key ? diffFields.includes(c.key) : false;
                    return (
                      <Tooltip key={c.key || c.label}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => c.key && toggleDiffField(c.key)}
                            className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer min-w-0"
                          >
                            <span className={`text-[9px] font-black leading-none ${active ? "text-[#621f32] dark:text-[#bc955c]" : "text-red-500 dark:text-red-400"}`}>{formatNumber(c.difieren)}</span>
                            <div className={`w-full flex items-end h-20 rounded-md overflow-hidden ${active ? "bg-[#621f32]/10 dark:bg-[#bc955c]/10 ring-2 ring-[#621f32] dark:ring-[#bc955c]" : "bg-slate-100 dark:bg-slate-800"}`}>
                              <div className={`w-full rounded-t-md ${active ? "bg-[#621f32] dark:bg-[#bc955c]" : "bg-red-500/70"}`} style={{ height: `${Math.max(c.alturaPct, 4)}%` }} />
                            </div>
                            <span className={`text-[8px] font-bold truncate w-full text-center leading-tight ${active ? "text-[#621f32] dark:text-[#bc955c]" : "text-slate-500 dark:text-slate-400"}`}>{c.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{c.label}: {formatNumber(c.difieren)} difieren ({c.porcentajeDelTotal}% del total de discrepancias) · clic para {active ? "quitar" : "aplicar"} filtro</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-slate-400 min-h-[96px]">Sin discrepancias</div>
              )}
            </div>
          </div>
        </Zoom>
      </div>

      <div className="w-full flex items-start justify-center">
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl h-fit flex flex-col z-30 overflow-hidden w-full md:max-h-[calc(100vh-var(--stack-h))] md:sticky md:bottom-0 md:scroll-mt-[var(--stack-h)]" style={{ width: cardWidth ? `${cardWidth}px` : "100%", maxWidth: cardWidth ? "none" : "100%" }}>
          <MobileTableToolbar
            searchValue={searchQuery}
            onSearch={(v) => setSearchQuery(v)}
            count={count}
            primaryAction={{ icon: Download, label: "Exportar a Excel", onClick: handleExportExcel, loading: isExportingExcel }}
            actions={[
              { icon: RotateCcw, label: "Restablecer filtros", onClick: resetAllFilters, disabled: !canReset },
              { icon: Columns, label: "Columnas", onClick: () => setIsColumnsModalOpen(true) },
            ]}
          />

          <div className="hidden md:flex p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar posición, puesto, ocupante..."
                    className="bg-transparent text-slate-800 text-xs font-bold w-full outline-none"
                  />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-500 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none">{formatNumber(count)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 shrink-0 mr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Mostrar:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setLoading(true); setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase text-[#621f32] dark:text-[#bc955c] outline-none cursor-pointer"
                  >
                    {[25, 50, 100, 250, 500].map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 select-none">
                  {/* 7.12 QA: paginación server-side sólo tenía ‹ › — se agregan
                      primera/última página y un campo para saltar a la página N. */}
                  <button onClick={() => { setLoading(true); setPage(1); }} disabled={page === 1 || loading} title="Primera página" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronsLeft className="size-3.5" />
                  </button>
                  <button onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }} disabled={page === 1 || loading} title="Página anterior" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 px-1 flex items-center gap-1">
                    Pág.
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n) && n >= 1 && n <= totalPages) { setLoading(true); setPage(n); }
                      }}
                      disabled={loading}
                      className="w-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-center text-[#621f32] dark:text-[#bc955c] font-black outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    de <span className="text-[#621f32] dark:text-[#bc955c]">{totalPages}</span>
                  </span>
                  <button onClick={() => { setLoading(true); setPage((p) => Math.min(totalPages, p + 1)); }} disabled={page === totalPages || loading} title="Página siguiente" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                  <button onClick={() => { setLoading(true); setPage(totalPages); }} disabled={page === totalPages || loading} title="Última página" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronsRight className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="relative shrink-0" ref={diffFieldsRef}>
                <button
                  onClick={() => setDiffFieldsOpen((o) => !o)}
                  className={`flex items-center gap-2 px-5 py-3.5 border rounded-2xl text-[10px] font-black uppercase transition-all duration-300 shadow-sm active:scale-95 cursor-pointer ${diffFields.length > 0 ? "border-[#621f32]/40 dark:border-[#bc955c]/40 bg-[#621f32]/8 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c]" : "border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] hover:shadow"}`}
                >
                  <ListFilter className="size-3.5" />
                  <span>Diferencia en Campo{diffFields.length > 0 ? ` (${diffFields.length})` : ""}</span>
                </button>
                {diffFieldsOpen && (
                  <div className="absolute z-40 top-full mt-2 right-0 w-72 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                      <span className="text-[9px] font-black uppercase text-slate-500">Ver plazas que difieren en...</span>
                      {diffFields.length > 0 && (
                        <button
                          onClick={() => { setLoading(true); setDiffFields([]); setPage(1); }}
                          className="text-[9px] font-bold uppercase text-red-500 hover:text-red-600 cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    {ALINEACION_CAMPOS.map((c) => {
                      const checked = diffFields.includes(c.key);
                      return (
                        <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                          <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleDiffField(c.key)} />
                          <div className={`size-3.5 rounded-md border flex items-center justify-center shrink-0 ${checked ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-700"}`}>
                            {checked && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex-1">{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={resetAllFilters} disabled={!canReset} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-950/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all duration-300 shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0">
                <RotateCcw className="size-3.5" /><span>Restablecer Filtros</span>
              </button>
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer">
                <Columns className="size-3.5" /><span>Columnas</span>
              </button>
              <button onClick={handleExportExcel} disabled={isExportingExcel} className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] text-white font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-75 disabled:pointer-events-none">
                {isExportingExcel ? <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Download className="size-3.5" />}
                <span>{isExportingExcel ? "Cargando..." : "Excel"}</span>
              </button>
            </div>
          </div>

          <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
            <DataTable
              containerRef={containerRef}
              tbodyRef={tbodyRef}
              onScroll={noop}
              columns={columns}
              columnFilters={columnFilters}
              textFilters={textFilters}
              setTextFilters={setTextFilters}
              activeConditionDropdown={activeConditionDropdown}
              setActiveConditionDropdown={setActiveConditionDropdown}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              onCellContextMenu={handleCellContextMenu}
              onShowRecord={handleShowRecord}
              sortConfig={sortConfig}
              onSort={handleSort}
              onOpenFilter={openFilterDropdown}
              onResizeStart={handleMouseDown}
              getColumnLetter={getColumnLetter}
              isMonoColumn={isMonoColumn}
              isPending={isPending}
              isLoading={loading}
              loadingVariant="skeleton"
              rowNumberOffset={(page - 1) * pageSize}
              data={data}
              startIndex={0}
              endIndex={data.length}
              totalCount={data.length}
              rowHeight={37}
              getRowId={(row, i) => row.id ?? row.no_pos_actual ?? i}
              renderCell={renderCell}
            />
          </div>

          <div className="md:hidden">
            <MobileCardList
              data={data}
              config={{
                getRowId: (r, i) => r.id ?? r.no_pos_actual ?? i,
                getTitle: (r) => r.nombre_puesto || (r.no_pos_actual ? `Posición ${r.no_pos_actual}` : "Posición"),
                getSubtitle: (r) => (r.no_pos_actual ? `POS ${r.no_pos_actual}` : ""),
                renderBadge: (r) => {
                  const alineada = r.estado_alineacion === "Alineada";
                  return (
                    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[9px] font-black uppercase ${alineada ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {r.campos_coincidentes}/{r.campos_totales}
                    </span>
                  );
                },
                fields: [
                  { key: "ocupante_nombre", label: "Ocupante" },
                  { key: "ocupacion", label: "Ocupación" },
                  { key: "estado_alineacion", label: "Estado" },
                ],
              }}
              onCardClick={handleShowRecord}
              isLoading={loading}
              isPending={isPending}
            />
          </div>

          <div className="hidden md:block absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />
        </div>
      </div>

      {mounted && (
        <ColumnsModal
          open={isColumnsModalOpen}
          columns={columns}
          onToggle={toggleColumnVisibility}
          onShowAll={() => setColumns((prev) => prev.map((c) => ({ ...c, visible: true })))}
          onHideAll={() => setColumns((prev) => prev.map((c) => ({ ...c, visible: false })))}
          onClose={() => setIsColumnsModalOpen(false)}
        />
      )}

      {activeFilterDropdown && (
        <ColumnFilterDropdown
          open={!!activeFilterDropdown}
          columnKey={activeFilterDropdown}
          columnLabel={columns.find((c) => c.key === activeFilterDropdown)?.label}
          isDate={false}
          data={data}
          filters={filters}
          dropdownValues={filterDropdownValues}
          loadingValues={loadingUniqueValues}
          onDateSelection={noop}
          onToggleDateNode={noop}
          onApply={() => applyColumnFilter(activeFilterDropdown)}
          onClear={() => clearColumnFilter(activeFilterDropdown)}
          onClose={() => setActiveFilterDropdown(null)}
        />
      )}

      <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />

      <AlineacionDetalleModal
        open={isDetalleOpen}
        row={detalleRow}
        onClose={() => setIsDetalleOpen(false)}
      />
    </div>
  );
}
