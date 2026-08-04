"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Download, Columns, ChevronLeft, 
  ChevronRight as ChevronRightIcon, ChevronDown, 
  X, Check, RotateCcw, Filter, ArrowUpDown, Briefcase
, UserCheck, Eye, BarChart, ArrowLeft, ChevronRight, PieChart, MousePointerClick, ChevronsLeft, ChevronsRight, ListFilter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Zoom } from "@/components/shared/Reveal";
import { VacantesService } from "@/services/vacantes.service";
import { addExcelLetterhead } from "@/utils/excelLetterhead";
import EmpleadoTimelineModal from "../../modals/EmpleadoTimelineModal";
import PosicionTimelineModal from "../../modals/PosicionTimelineModal";
import { EmployeeRecordModal } from "../../shared/EmployeesModal";
import ExportConFotosModal from "../../shared/ExportConFotosModal";
import ColumnsModal from "../../shared/ColumnsModal";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import DataTable from "../../shared/DataTable";
import CopyCellMenu from "../../shared/CopyCellMenu";
import CeldaValorModal from "../../shared/CeldaValorModal";
import ModalShell from "@/components/shared/ModalShell";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import MobileSortDrawer from "@/components/ui/MobileSortDrawer";
import MobileColumnPickerDrawer from "@/components/ui/MobileColumnPickerDrawer";
import MobileServerPager from "@/components/ui/MobileServerPager";
import AdvancedFiltersModal, { AdvancedFiltersButton } from "../../shared/AdvancedFiltersModal";
import { normalizeForSearch, finalizeFilterDropdownValues, resolveColumnFilterCommit, sortValueCounts, formatDateEsMx, normalizeDateSearchTerm } from "@/utils/columnFilters";
import { labelUN, labelUA } from "@/utils/catalogosUnUa";
import { getDeptoInfo } from "@/utils/organigramaCatalog";
import { getAccionInfo, getMotivoInfo } from "@/utils/accionesMotivosCatalog";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { usePersistedState } from "../../../_hooks/usePersistedState";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import { useAdvancedFilters } from "../../../_hooks/useAdvancedFilters";
import { useOrganigramaCatalog } from "../../../_hooks/useOrganigramaCatalog";
import { useAccionesMotivosCatalog } from "../../../_hooks/useAccionesMotivosCatalog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/hooks/useToast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Referencia estable (no recreada en cada render) para no invalidar el React.memo de DataTable.
const noop = () => {};

const DATE_KEYS = ["fecha_efectiva", "fecha_captura", "salida_prevista", "fecha_ult_actz", "ult_inicio", "fecha_inicial", "fecha_entrada", "fecha_posicion"];
const isDateColumn = (key) => DATE_KEYS.includes(key);

// Únicas columnas realmente numéricas en el modelo (CpTblMovCompleto290526):
// el resto son CharField aunque su contenido parezca numérico (códigos,
// "grado", "escala" de texto, etc.) — filtrar backend >/< sobre esas
// requeriría castear texto arbitrario, así que no se ofrecen ahí.
const NUMBER_KEYS = ["sec", "sal_base", "antiguo_empr"];
const isNumericColumn = (key) => NUMBER_KEYS.includes(key);
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Nombre + ap. paterno + ap. materno combinados en una sola celda (columna
// "nombre" unificada). Mismo criterio que ya usaba `MobileCardList`.
const buildFullName = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(" ").trim();

const getColumnLetter = (index) => {
  let temp = index, letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

const getConditionLabel = (cond) => {
  switch (cond) {
    case "contains": return "Contiene";
    case "not_contains": return "No contiene";
    case "starts_with": return "Comienza con";
    case "not_starts_with": return "No comienza con";
    case "ends_with": return "Termina con";
    case "not_ends_with": return "No termina con";
    case "equals": return "Es igual a";
    case "not_equals": return "Diferente de";
    default: return "Contiene";
  }
};

const isMonoColumn = (key) => [
  "posicion", "num_empleado", "rfc", "curp", "nv_jerarquico", "un", "id_persona"
].includes(key);

const getTextFilterParams = (filters) => {
  const params = {};
  Object.entries(filters).forEach(([key, filterObj]) => {
    if (!filterObj || !filterObj.value) return;
    const { value, condition } = filterObj;
    let queryKey = `${key}__icontains`;
    switch (condition) {
      case "contains":
        queryKey = `${key}__icontains`;
        break;
      case "not_contains":
        queryKey = `exclude__${key}__icontains`;
        break;
      case "starts_with":
        queryKey = `${key}__istartswith`;
        break;
      case "not_starts_with":
        queryKey = `exclude__${key}__istartswith`;
        break;
      case "ends_with":
        queryKey = `${key}__iendswith`;
        break;
      case "not_ends_with":
        queryKey = `exclude__${key}__iendswith`;
        break;
      case "equals":
        queryKey = `${key}__iexact`;
        break;
      case "not_equals":
        queryKey = `exclude__${key}__iexact`;
        break;
    }
    params[queryKey] = value;
  });
  return params;
};


const BitacoraDateSelector = ({ distinctDates, selectedDates, onChange, triggerClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});

  const hierarchy = useMemo(() => {
    const years = {};
    distinctDates.forEach(d => {
      if (!d.value) return;
      const [year, month, day] = d.value.split('-');
      if (!years[year]) years[year] = { count: 0, months: {} };
      years[year].count += d.count;
      
      if (!years[year].months[month]) years[year].months[month] = { count: 0, days: [] };
      years[year].months[month].count += d.count;
      years[year].months[month].days.push({ day, count: d.count, fullDate: d.value });
    });
    
    // Sort logic
    Object.keys(years).forEach(y => {
      Object.keys(years[y].months).forEach(m => {
        years[y].months[m].days.sort((a,b) => parseInt(a.day) - parseInt(b.day));
      });
    });
    return years;
  }, [distinctDates]);

  // Selections
  const isSelected = (dateStr) => selectedDates.includes(dateStr);
  const toggleDate = (dateStr) => {
    if (isSelected(dateStr)) onChange(selectedDates.filter(d => d !== dateStr));
    else onChange([...selectedDates, dateStr]);
  };

  const selectYear = (year, select) => {
    const datesInYear = distinctDates.filter(d => d.value.startsWith(year)).map(d => d.value);
    if (select) {
      const newSel = new Set([...selectedDates, ...datesInYear]);
      onChange(Array.from(newSel));
    } else {
      onChange(selectedDates.filter(d => !d.startsWith(year)));
    }
  };

  const selectMonth = (year, month, select) => {
    const prefix = `${year}-${month}`;
    const datesInMonth = distinctDates.filter(d => d.value.startsWith(prefix)).map(d => d.value);
    if (select) {
      const newSel = new Set([...selectedDates, ...datesInMonth]);
      onChange(Array.from(newSel));
    } else {
      onChange(selectedDates.filter(d => !d.startsWith(prefix)));
    }
  };

  const modalContent = (
    <ModalShell
      open={isOpen}
      onClose={() => setIsOpen(false)}
      size="sm"
      icon={Filter}
      eyebrow="Filtro"
      title="Filtrar Bitácora"
      subtitle="Selecciona fechas de captura"
      footer={
        <>
          <button onClick={() => onChange([])} className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer">Limpiar</button>
          <button onClick={() => setIsOpen(false)} className="flex-[2] px-3 py-2.5 bg-[#621f32] text-white text-[10px] font-black uppercase rounded-full shadow-lg shadow-[#621f32]/20 hover:bg-[#4a1726] active:scale-95 transition-all cursor-pointer">Aceptar</button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        {distinctDates.length > 0 && (
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 flex gap-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
            <button onClick={() => onChange(distinctDates.map(d => d.value))} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Marcar Todo</button>
            <button onClick={() => onChange([])} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Desmarcar Todo</button>
          </div>
        )}
        {Object.keys(hierarchy).sort((a, b) => b.localeCompare(a)).map(year => {
                    const yearData = hierarchy[year];
                    const isYearExpanded = expandedYears[year];
                    const yearDates = distinctDates.filter(d => d.value.startsWith(year)).map(d => d.value);
                    const isYearSelected = yearDates.length > 0 && yearDates.every(v => selectedDates.includes(v));
                    const isYearPartial = !isYearSelected && yearDates.some(v => selectedDates.includes(v));

                    return (
                      <div key={year} className="flex flex-col">
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group">
                          <button onClick={() => setExpandedYears(p => ({ ...p, [year]: !p[year] }))} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                            {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          </button>
                          <div onClick={() => selectYear(year, !isYearSelected)} className="flex items-center gap-2 cursor-pointer flex-1">
                            <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${isYearSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                              {isYearSelected && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                              {isYearPartial && <div className="size-1.5 bg-[#621f32] dark:bg-[#bc955c] rounded-sm" />}
                            </div>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200">{year}</span>
                            <span className="text-[10px] font-black text-slate-400">({yearData.count})</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); selectYear(year, true); }} title="Marcar todo el año" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Todo</button>
                            <button onClick={(e) => { e.stopPropagation(); selectYear(year, false); }} title="Desmarcar todo el año" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Ninguno</button>
                          </div>
                        </div>

                        {isYearExpanded && (
                          <div className="ml-6 flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2 mt-1 mb-2 gap-1">
                            {Object.keys(yearData.months).sort().map(month => {
                              const monthData = yearData.months[month];
                              const mKey = `${year}-${month}`;
                              const isMonthExpanded = expandedMonths[mKey];
                              const monthDates = distinctDates.filter(d => d.value.startsWith(mKey)).map(d => d.value);
                              const isMonthSelected = monthDates.length > 0 && monthDates.every(v => selectedDates.includes(v));
                              const isMonthPartial = !isMonthSelected && monthDates.some(v => selectedDates.includes(v));

                              return (
                                <div key={mKey} className="flex flex-col">
                                  <div className="flex items-center gap-2 px-2 py-1 group">
                                    <button onClick={() => setExpandedMonths(p => ({ ...p, [mKey]: !p[mKey] }))} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400">
                                      {isMonthExpanded ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
                                    </button>
                                    <div onClick={() => selectMonth(year, month, !isMonthSelected)} className="flex items-center gap-2 cursor-pointer flex-1">
                                      <div className={`size-3.5 rounded border flex items-center justify-center transition-all ${isMonthSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                        {isMonthSelected && <Check className="size-2 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                        {isMonthPartial && <div className="size-1 bg-[#621f32] dark:bg-[#bc955c] rounded-xs" />}
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{MONTH_NAMES[parseInt(month, 10) - 1] || month}</span>
                                      <span className="text-[9px] font-black text-slate-500">({monthData.count})</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button onClick={(e) => { e.stopPropagation(); selectMonth(year, month, true); }} title="Marcar todo el mes" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Todo</button>
                                      <button onClick={(e) => { e.stopPropagation(); selectMonth(year, month, false); }} title="Desmarcar todo el mes" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Ninguno</button>
                                    </div>
                                  </div>

                                  {isMonthExpanded && (
                                    <div className="ml-6 grid grid-cols-2 gap-x-2 border-l border-slate-50 dark:border-slate-800/50 pl-2 py-1 mt-1">
                                      {monthData.days.map(d => {
                                        const isDaySelected = isSelected(d.fullDate);
                                        return (
                                          <div key={d.fullDate} onClick={() => toggleDate(d.fullDate)} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer group">
                                            <div className={`size-3 rounded border flex items-center justify-center transition-all ${isDaySelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                              {isDaySelected && <Check className="size-2 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]">{d.day}</span>
                                            <span className="text-[8px] font-black text-slate-300">({d.count})</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
      </div>
    </ModalShell>
  );

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={triggerClassName || "flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-[#621f32]/50 transition-colors"}>
        <span className="text-[10px] text-slate-400 font-bold uppercase">Bitácora:</span>
        <span className="font-bold text-xs text-[#621f32] dark:text-[#bc955c] truncate max-w-[200px]">
          {/* 7.9 QA: DD/MM/AAAA — antes mostraba el ISO crudo (2026-07-18). */}
          {selectedDates.length === 0 ? "Ninguna" : selectedDates.length === 1 ? formatDateEsMx(selectedDates[0]) : `${selectedDates.length} fechas`}
        </span>
      </button>
      {modalContent}
    </>
  );
};

export default function MovimientosPersonalTab({ isPending, startTransition, cardRef }) {
  const { hasPermission } = useAuth();
  const canViewFotoMovimientos = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);
  const [mounted, setMounted] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isExportFotosModalOpen, setIsExportFotosModalOpen] = useState(false);
  const [isExportingConFotos, setIsExportingConFotos] = useState(false);
  const exportConFotosAbortRef = useRef(null);
  const { toast } = useToast();
  const [data, setData] = useState([]);
  const tbodyRef = useRef(null);
  const bitacoraDateInputRef = useRef(null);

  const deptoCatalog = useOrganigramaCatalog();
  const { accionesCatalog, motivosCatalog } = useAccionesMotivosCatalog();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // 7.3 QA: persistir configuración por usuario en localStorage.
  const [sortConfig, setSortConfig] = usePersistedState("movimientos_personal_sort", { key: "fecha_efectiva,fecha_captura", direction: "desc" });
  const [isSortDrawerOpen, setIsSortDrawerOpen] = useState(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const { selectedCell, setSelectedCell, isCellModalOpen, setIsCellModalOpen, selectedRowData, setSelectedRowData, contextMenu, setContextMenu } = useCellSelection();
  const arrowRepeatRef = useRef(0);

  const {
    isAdvancedFiltersOpen, setIsAdvancedFiltersOpen,
    advancedConditions,
    appliedAdvancedFilters,
    addAdvancedCondition, removeAdvancedCondition, updateAdvancedCondition,
    applyAdvancedFilters, resetAdvancedFilters,
  } = useAdvancedFilters({
    mode: "server",
    isDateColumn,
    isNumericColumn,
    onApply: () => { setLoading(true); setPage(1); },
  });

  // Subtab State
  const [activeSubTab, setActiveSubTab] = useState("movimientos"); // "movimientos" or "bitacora"
  
  // Bitacora Date Selector State
  const [distinctDates, setDistinctDates] = useState([]);
  const [distinctDatesLoading, setDistinctDatesLoading] = useState(true);
  const [bitacoraDates, setBitacoraDates] = useState([getTodayString()]);

  // Stats for personal movements
  const [statsData, setStatsData] = useState({ by_year: {}, all: [] });
  const [selectedYear, setSelectedYear] = useState("all");
  const [statsLoading, setStatsLoading] = useState(true);

  // Toggle between pie chart and temporal bar chart
  const [statsViewMode, setStatsViewMode] = useState("pie"); // "pie" or "bar"
  const [barChartLevel, setBarChartLevel] = useState("year"); // "year", "month", "day"
  const [barChartSelection, setBarChartSelection] = useState({ year: null, month: null });

  useEffect(() => {
    const ctrl = new AbortController();
    setStatsLoading(true);
    const params = {};
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }
    VacantesService.getMovimientosPersonalStats(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        if (resData && (resData.by_year || resData.all)) {
          setStatsData(resData);
        }
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("Error fetching movements stats:", err); })
      .finally(() => { if (!ctrl.signal.aborted) setStatsLoading(false); });
    return () => ctrl.abort();
  }, [activeSubTab, bitacoraDates]);

  const activeStatsList = useMemo(() => {
    if (selectedYear === "all") {
      return statsData.all || [];
    }
    return statsData.by_year[selectedYear] || [];
  }, [statsData, selectedYear]);

  const pieTotal = useMemo(() => {
    return activeStatsList.reduce((s, d) => s + d.total, 0);
  }, [activeStatsList]);

  const PIE_COLORS = [
    "#621f32", "#bc955c", "#8d2c48", "#d4a96a", "#4a1625",
    "#e8c280", "#3d1020", "#a07040", "#7a2038", "#f0d090",
    "#2d0a18", "#c8a050", "#b06040", "#6a1828", "#dbb870",
  ];

  const pieSlices = useMemo(() => {
    if (!activeStatsList.length || pieTotal === 0) return [];
    const R = 80, cx = 100, cy = 100;
    let angle = -Math.PI / 2;
    return activeStatsList.map((d, i) => {
      const slice = (d.total / pieTotal) * 2 * Math.PI;
      const x1 = cx + R * Math.cos(angle);
      const y1 = cy + R * Math.sin(angle);
      angle += slice;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      const largeArc = slice > Math.PI ? 1 : 0;
      const midAngle = angle - slice / 2;
      return {
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: PIE_COLORS[i % PIE_COLORS.length],
        midAngle,
        pct: ((d.total / pieTotal) * 100).toFixed(1),
        ...d,
      };
    });
  }, [activeStatsList, pieTotal]);

  // Conteo real de "motivos diferentes" por acción (reemplaza mapa hardcodeado).
  // Se calcula bajo demanda por acción visible, cacheado por contexto de filtro (bitácora/fecha).
  const motivosCountRef = useRef({});
  const [motivosCountVersion, setMotivosCountVersion] = useState(0);

  useEffect(() => {
    const contextKey = activeSubTab === "bitacora" ? `bitacora:${bitacoraDates.join(",")}` : "global";
    const namesToFetch = activeStatsList
      .map((d) => d.accion_nombre)
      .filter((name) => name && !(`${contextKey}|${name}` in motivosCountRef.current));

    if (namesToFetch.length === 0) return;

    const controller = new AbortController();
    Promise.all(
      namesToFetch.map((accion) => {
        const params = { accion_nombre: accion };
        if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
          params.fecha_captura__in = bitacoraDates.join(",");
        }
        return VacantesService.getMovimientosPersonalStats(params, { signal: controller.signal })
          .then((res) => res.json())
          .then((resData) => {
            motivosCountRef.current[`${contextKey}|${accion}`] = (resData?.all || []).length;
          })
          .catch((err) => { if (err.name !== "AbortError") console.error("Error fetching motivos count:", err); });
      })
    ).then(() => setMotivosCountVersion((v) => v + 1));

    return () => controller.abort();
  }, [activeStatsList, activeSubTab, bitacoraDates]);

  const getMotivosCount = useCallback((accion) => {
    const contextKey = activeSubTab === "bitacora" ? `bitacora:${bitacoraDates.join(",")}` : "global";
    return motivosCountRef.current[`${contextKey}|${accion}`];
  }, [activeSubTab, bitacoraDates, motivosCountVersion]);

  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [pieTooltipPos, setPieTooltipPos] = useState({ x: 0, y: 0 });

  // State moved to the top to avoid ReferenceErrors
  // Fetch distinct dates for Bitacora on mount
  useEffect(() => {
    VacantesService.getMovimientosPersonal({ distinct_field: "fecha_captura" })
      .then((res) => res.json())
      .then((resData) => {
        if (Array.isArray(resData)) {
          const todayStr = getTodayString();
          let dates = resData.filter(d => d.value);
          const hasToday = dates.some((d) => d.value === todayStr);
          if (!hasToday) dates.unshift({ value: todayStr, count: 0 });
          setDistinctDates(dates);
        }
      })
      .finally(() => setDistinctDatesLoading(false));
  }, []);

  const filters = useColumnFilters({ storageKey: "movimientos_personal_filters" });
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    expandedDateNodes, setExpandedDateNodes,
    debouncedFilterSearchText,
  } = filters;

  // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, debouncedSearch, sortConfig.key, sortConfig.direction, appliedAdvancedFilters]);

  const [debouncedTextFilters, setDebouncedTextFilters] = useState({});
  const [cardWidth, setCardWidth] = useState(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [selectedNumEmpleado, setSelectedNumEmpleado] = useState(null);
  const [posicionTimelineModalOpen, setPosicionTimelineModalOpen] = useState(false);
  const [selectedPosicion, setSelectedPosicion] = useState(null);
  const [selectedActionName, setSelectedActionName] = useState(null);
  const [motifStatsData, setMotifStatsData] = useState({ by_year: {}, all: [] });
  const [selectedMotifYear, setSelectedMotifYear] = useState("all");
  const [motifStatsLoading, setMotifStatsLoading] = useState(false);
  const [hoveredMotifSlice, setHoveredMotifSlice] = useState(null);

  useEffect(() => {
    const val = textFilters.accion_nombre?.value;
    if (!val) {
      setSelectedActionName(null);
    } else {
      setSelectedActionName(val);
    }
  }, [textFilters.accion_nombre]);

  useEffect(() => {
    if (!selectedActionName) {
      setMotifStatsData({ by_year: {}, all: [] });
      return;
    }
    const ctrl = new AbortController();
    setMotifStatsLoading(true);
    const params = { accion_nombre: selectedActionName };
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }
    VacantesService.getMovimientosPersonalStats(params, { signal: ctrl.signal })
      .then(res => res.json())
      .then(resData => {
        if (resData && (resData.by_year || resData.all)) {
          setMotifStatsData(resData);
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Error fetching motif stats:", err); })
      .finally(() => { if (!ctrl.signal.aborted) setMotifStatsLoading(false); });
    return () => ctrl.abort();
  }, [selectedActionName, activeSubTab, bitacoraDates]);

  useEffect(() => {
    setSelectedMotifYear("all");
  }, [selectedActionName]);

  useEffect(() => {
    setPage(1);
  }, [selectedYear, selectedMotifYear]);

  const activeMotifStatsList = useMemo(() => {
    if (selectedMotifYear === "all") {
      return motifStatsData.all || [];
    }
    return motifStatsData.by_year[selectedMotifYear] || [];
  }, [motifStatsData, selectedMotifYear]);

  const motifPieTotal = useMemo(() => {
    return activeMotifStatsList.reduce((s, d) => s + d.total, 0);
  }, [activeMotifStatsList]);

  const motifPieSlices = useMemo(() => {
    if (!activeMotifStatsList.length || motifPieTotal === 0) return [];
    const R = 80, cx = 100, cy = 100;
    let angle = -Math.PI / 2;
    return activeMotifStatsList.map((d, i) => {
      const slice = (d.total / motifPieTotal) * 2 * Math.PI;
      const x1 = cx + R * Math.cos(angle);
      const y1 = cy + R * Math.sin(angle);
      angle += slice;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      const largeArc = slice > Math.PI ? 1 : 0;
      const midAngle = angle - slice / 2;
      return {
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: PIE_COLORS[i % PIE_COLORS.length],
        midAngle,
        pct: ((d.total / motifPieTotal) * 100).toFixed(1),
        ...d,
      };
    });
  }, [activeMotifStatsList, motifPieTotal]);

  const handleActionClick = useCallback((accion) => {
    if (!accion) return;
    setSelectedActionName(accion);
    setTextFilters(prev => ({
      ...prev,
      accion_nombre: {
        value: accion,
        condition: "contains"
      }
    }));
  }, []);

  const handleMotifClick = useCallback((motivo) => {
    if (!motivo) return;
    setTextFilters(prev => ({
      ...prev,
      motivo_nombre: {
        value: motivo,
        condition: "contains"
      }
    }));
  }, []);

  const handleCloseMotifStats = useCallback(() => {
    setSelectedActionName(null);
    setTextFilters(prev => {
      const next = { ...prev };
      delete next.accion_nombre;
      delete next.motivo_nombre;
      return next;
    });
  }, []);

  const [hasInitializedTemp, setHasInitializedTemp] = useState(false);
  // Valores alcanzables de la columna activa dado el resto de filtros (todos
  // EXCEPTO el propio de esa columna) — fetch "por defecto" (sin buscar);
  // también el universo por defecto para listar/jerarquía de fecha.
  const [reachableColumnValues, setReachableColumnValues] = useState({});
  // Resultados de buscar en TODA la columna (universo completo, sin el resto
  // de filtros) — sólo se piden mientras hay texto en el buscador del dropdown.
  const [searchColumnValues, setSearchColumnValues] = useState({});
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const dropdownRef = useRef(null);


  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { columns, setColumns, toggleVisibility: toggleColumnVisibility, isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen } = useColumnState([
    { key: "posicion", label: "Posición", width: 110, visible: true, isBasic: true },
    { key: "num_empleado", label: "No. Empleado", width: 120, visible: true, isBasic: true },
    // Unifica nombre + ap. paterno + ap. materno en una sola celda (antes 3
    // columnas separadas). El filtro/orden de esta columna siguen operando
    // sólo sobre `nombre` (backend no tiene un campo combinado) — ver
    // `buildFullName` para el armado de la celda y la exportación a Excel.
    { key: "nombre", label: "Nombre Completo", width: 260, visible: true, isBasic: true },
    { key: "accion_nombre", label: "Nombre Acción", width: 180, visible: true, isBasic: true },
    { key: "motivo_nombre", label: "Nombre Motivo", width: 180, visible: true, isBasic: true },
    { key: "fecha_efectiva", label: "Fecha Efectiva", width: 130, visible: true, isBasic: true },
    { key: "sec", label: "Sec", width: 80, visible: true, isBasic: true },
    { key: "fecha_captura", label: "Fecha Captura", width: 130, visible: true, isBasic: true },
    { key: "est_hr", label: "Est. Hr", width: 100, visible: false, isBasic: false },
    { key: "estado_pago", label: "Estado Pago", width: 110, visible: false, isBasic: false },
    { key: "partida_presup", label: "Partida Presup.", width: 120, visible: false, isBasic: false },
    { key: "un", label: "UN", width: 100, visible: false, isBasic: false },
    { key: "un_admin", label: "UN Admin.", width: 250, visible: true, isBasic: true },
    { key: "id_depto", label: "Id Depto", width: 100, visible: false, isBasic: false },
    { key: "depen_direc", label: "Depen. Direc.", width: 250, visible: false, isBasic: false },
    { key: "plan_sal", label: "Plan Sal.", width: 110, visible: false, isBasic: false },
    { key: "grado", label: "Grado", width: 90, visible: false, isBasic: false },
    { key: "escala", label: "Escala", width: 95, visible: false, isBasic: false },
    { key: "puesto_ptal", label: "Puesto Ptal.", width: 250, visible: false, isBasic: false },
    { key: "nivel_tabular", label: "Nivel Tabular", width: 110, visible: false, isBasic: false },
    { key: "gp_pago", label: "Gp Pago", width: 100, visible: false, isBasic: false },
    { key: "prog_benef", label: "Prog. Benef.", width: 150, visible: false, isBasic: false },
    { key: "sal_base", label: "Sal. Base", width: 120, visible: false, isBasic: false },
    { key: "cd_puesto", label: "Cd Puesto", width: 110, visible: false, isBasic: false },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true, isBasic: true },
    { key: "id_estbl", label: "Id Estbl", width: 100, visible: false, isBasic: false },
    { key: "salida_prevista", label: "Salida Prevista", width: 130, visible: false, isBasic: false },
    { key: "fecha_ult_actz", label: "Fecha Últ. Actz.", width: 150, visible: false, isBasic: false },
    { key: "por", label: "Por", width: 120, visible: false, isBasic: false },
    { key: "ult_inicio", label: "Últ. Inicio", width: 130, visible: false, isBasic: false },
    { key: "fecha_inicial", label: "Fecha Inicial", width: 130, visible: false, isBasic: false },
    { key: "gp_trabajo", label: "Gp Trabajo", width: 150, visible: false, isBasic: false },
    { key: "grupo_cd_sal", label: "Grupo Cd Sal", width: 120, visible: false, isBasic: false },
    { key: "antiguo_empr", label: "Antiguo Empr.", width: 120, visible: false, isBasic: false },
    { key: "rfc", label: "RFC", width: 140, visible: true, isBasic: true },
    { key: "curp", label: "CURP", width: 185, visible: true, isBasic: true },
    { key: "id_persona", label: "Id Persona", width: 120, visible: false, isBasic: false },
    { key: "desc_larga_p", label: "Desc. Larga P", width: 250, visible: false, isBasic: false },
    { key: "nv_jerarquico", label: "Nv. Jerárquico", width: 130, visible: false, isBasic: false },
    { key: "desc_larga_un", label: "Desc. Larga UN", width: 250, visible: false, isBasic: false },
    { key: "sexo", label: "Sexo", width: 90, visible: false, isBasic: false },
    { key: "fecha_entrada", label: "Fecha Entrada", width: 130, visible: false, isBasic: false },
    { key: "fecha_posicion", label: "Fecha Posición", width: 130, visible: false, isBasic: false },
  ], "movimientos_personal_columns");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTextFilters(textFilters);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [textFilters]);

  useEffect(() => {
    if (activeSubTab === "bitacora" && bitacoraDates.length === 0) return;
    const ctrl = new AbortController();
    setLoading(true);
    const filterParams = getTextFilterParams(debouncedTextFilters);
    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        colParams[`${key}__in`] = values.join(",");
      }
    });

    const yearFilter = selectedActionName 
      ? (selectedMotifYear !== "all" ? selectedMotifYear : null)
      : (selectedYear !== "all" ? selectedYear : null);

    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch,
      ...filterParams,
      ...colParams
    };
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }

    if (sortConfig.key) {
      params.sort_by = sortConfig.key;
      params.sort_order = sortConfig.direction;
    } else if (activeSubTab === "bitacora") {
      params.sort_by = "fecha_captura,fecha_ult_actz";
      params.sort_order = "desc";
    }

    if (yearFilter && activeSubTab !== "bitacora") {
      params.fecha_efectiva__year = yearFilter;
    }

    if (appliedAdvancedFilters.length > 0) {
      params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
    }

    VacantesService.getMovimientosPersonal(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        setData(resData.results || []);
        setCount(resData.count || 0);
      })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [activeSubTab, bitacoraDates, page, pageSize, debouncedSearch, debouncedTextFilters, columnFilters, sortConfig, selectedYear, selectedMotifYear, selectedActionName, appliedAdvancedFilters]);

  const handleRequestSort = (key) => {
    const actualKey = key === "fecha_efectiva" ? "fecha_efectiva,fecha_captura" : key;
    let direction = "asc";
    if (sortConfig.key === actualKey && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === actualKey && sortConfig.direction === "desc") {
      direction = null;
    }
    setSortConfig({ key: actualKey, direction });
    setPage(1);
  };

  const fetchAdvValueSuggestions = useCallback((column) =>
    VacantesService.getMovimientosPersonal({ distinct_field: column, distinct_search: "" })
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? data : [])), []);

  // Universo listado/jerarquía de fecha de la columna activa: valores
  // alcanzables (fetch por defecto) unidos con los de "buscar en toda la
  // columna" cuando hay texto en el buscador (si no, es exactamente lo
  // alcanzable — mismo costo/forma que antes).
  const mergedColumnValues = useMemo(() => {
    if (!activeFilterDropdown) return {};
    const reachableList = reachableColumnValues[activeFilterDropdown] || [];
    if (!debouncedFilterSearchText) return { [activeFilterDropdown]: reachableList };
    const searchList = searchColumnValues[activeFilterDropdown] || [];
    const merged = new Map(reachableList.map((v) => [v.value, v]));
    searchList.forEach((v) => { if (!merged.has(v.value)) merged.set(v.value, v); });
    return { [activeFilterDropdown]: sortValueCounts([...merged.values()]) };
  }, [activeFilterDropdown, reachableColumnValues, searchColumnValues, debouncedFilterSearchText]);

  // Valores alcanzables (plano, sin conteo) de la columna activa — gobierna
  // qué se puede marcar/desmarcar en ColumnFilterDropdown.
  const reachableValues = useMemo(
    () => (reachableColumnValues[activeFilterDropdown] || []).map((v) => v.value),
    [activeFilterDropdown, reachableColumnValues]
  );

  const movPersonalDropdownValues = useMemo(() => {
    if (!activeFilterDropdown || isDateColumn(activeFilterDropdown)) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };
    const list = mergedColumnValues[activeFilterDropdown] || [];
    const searchNorm = normalizeForSearch(filterSearchText);
    const filtered = list.filter((v) => normalizeForSearch(v.value).includes(searchNorm));
    return finalizeFilterDropdownValues({
      baseUniqueValues: list,
      filtered,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
      reachableValues,
    });
  }, [activeFilterDropdown, isDateColumn, mergedColumnValues, reachableValues, filterSearchText, tempSelectedValues, columnFilters]);

  const renderCell = useCallback(({ row, col, colIdx, actualRowIdx, isSticky, leftOffset, isSelected }) => {
    const globalRowIdx = (page - 1) * pageSize + actualRowIdx;
    const isSelectedRow = selectedCell?.rowIdx === globalRowIdx;
    let val = col.key === "nombre" ? buildFullName(row) : row[col.key];
    if (val === null || val === undefined) val = "";
    if (col.key === "fecha_ult_actz" && val) {
      try { const d = new Date(val); if (!isNaN(d.getTime())) val = d.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch (e) {}
    } else if (isDateColumn(col.key) && val) {
      // 7.9 QA: resto de columnas de fecha (fecha_efectiva, fecha_captura...)
      // a DD/MM/AAAA — antes se mostraban crudas (ISO) via el fallback String(val).
      val = formatDateEsMx(val);
    } else if (["sal_base", "smb", "smn", "sueldo_bruto", "sueldo_neto"].includes(col.key) && val) {
      val = `$${formatNumber(val)}`;
    }
    const deptoInfo = col.key === "id_depto" ? getDeptoInfo(deptoCatalog, val) : null;
    const accionInfo = col.key === "accion_nombre" ? getAccionInfo(accionesCatalog, val) : null;
    const motivoInfo = col.key === "motivo_nombre" ? getMotivoInfo(motivosCatalog, val) : null;
    const catalogInfo = deptoInfo || accionInfo || motivoInfo;
    let cellClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "ring-2 ring-inset ring-[#621f32] dark:ring-[#bc955c] bg-white dark:bg-slate-950 font-black text-[#621f32] dark:text-[#bc955c] shadow-lg relative z-[25]" : "font-semibold text-slate-700 dark:text-slate-300"}`;
    if (isSticky) cellClass += isSelectedRow ? " bg-[#f0e4e6] dark:bg-[#621f32]/20" : " bg-white/95 dark:bg-slate-900/95";
    if (col.key === "posicion" || col.key === "num_empleado") cellClass += " font-mono font-bold hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer";
    else if (col.key === "accion_nombre" && val && val.toLowerCase().includes("baja")) cellClass += " text-red-600 dark:text-red-400";
    else if (col.key === "motivo_nombre" && val && val.toLowerCase().includes("baja")) cellClass += " text-red-600 dark:text-red-400";
    if (catalogInfo) cellClass += " cursor-help";
    const handleCellClick = (e) => {
      if (col.key === "posicion" && val) { e.stopPropagation(); setSelectedPosicion(val); setPosicionTimelineModalOpen(true); }
      else if (col.key === "num_empleado" && val) { e.stopPropagation(); setSelectedNumEmpleado(val); setTimelineModalOpen(true); }
      else { setSelectedCell({ rowIdx: globalRowIdx, colIdx, colName: col.label, value: val }); }
    };
    const handleCellContext = (e) => { e.preventDefault(); e.stopPropagation(); handleCellContextMenu(e, val, e.currentTarget.getBoundingClientRect()); };
    const cellContent = val ? (
      (col.key === "posicion" || col.key === "num_empleado") ? (
        <div className="flex items-center justify-between gap-2">
          <span>{String(val)}</span>
          <MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title={col.key === "posicion" ? "Clic para ver histórico de la posición" : "Clic para ver histórico del empleado"} />
        </div>
      ) : String(val)
    ) : "-";
    const tdElement = (
      <td key={catalogInfo ? undefined : col.key} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: isSelected ? 25 : 20 } : {}} className={cellClass}
        onClick={handleCellClick}
        onContextMenu={handleCellContext}
      >
        {cellContent}
      </td>
    );
    if (deptoInfo) {
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>{tdElement}</TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{deptoInfo.nombre}</span>
              <span className="text-[10px] opacity-80">Nivel: {deptoInfo.nivel || "N/D"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (accionInfo) {
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>{tdElement}</TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{accionInfo.action}</span>
              <span className="text-[10px] opacity-80">{accionInfo.descripcion || "Sin descripción"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (motivoInfo) {
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>{tdElement}</TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{motivoInfo.cd_motivo}</span>
              <span className="text-[10px] opacity-80">{motivoInfo.descripcion_larga || "Sin descripción"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    return tdElement;
  }, [page, pageSize, selectedCell, deptoCatalog, accionesCatalog, motivosCatalog]);

  const handleCellContextMenu = useCallback((e, value, rect) => {
    setContextMenu({ x: e.clientX, y: e.clientY, value, rect });
  }, []);

  // Params compartidos por el export normal (client-side, sin fotos) y el
  // nuevo export con fotos (backend) — mismos filtros/orden que ya usa
  // `getMovimientosPersonal`, para que ambos reflejen exactamente lo que la
  // tabla tiene filtrado en ese momento.
  const buildExportParams = useCallback(() => {
    const filterParams = getTextFilterParams(debouncedTextFilters);
    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        colParams[`${key}__in`] = values.join(",");
      }
    });

    const yearFilter = selectedActionName
      ? (selectedMotifYear !== "all" ? selectedMotifYear : null)
      : (selectedYear !== "all" ? selectedYear : null);

    const params = {
      no_pagination: true,
      search: debouncedSearch,
      ...filterParams,
      ...colParams
    };

    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }

    if (sortConfig.key) {
      params.sort_by = sortConfig.key;
      params.sort_order = sortConfig.direction;
    } else if (activeSubTab === "bitacora") {
      params.sort_by = "fecha_captura,fecha_ult_actz";
      params.sort_order = "desc";
    }

    if (yearFilter && activeSubTab !== "bitacora") {
      params.fecha_efectiva__year = yearFilter;
    }

    if (appliedAdvancedFilters.length > 0) {
      params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
    }

    return params;
  }, [debouncedTextFilters, columnFilters, selectedActionName, selectedMotifYear, selectedYear, debouncedSearch, activeSubTab, bitacoraDates, sortConfig, appliedAdvancedFilters]);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const params = buildExportParams();
      const res = await VacantesService.getMovimientosPersonal(params);
      const allData = await res.json();

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(activeSubTab === "bitacora" ? `Bitácora ${bitacoraDates.length === 0 ? "Ninguno" : bitacoraDates.length === 1 ? bitacoraDates[0] : `${bitacoraDates.length} fechas`}` : "Movimientos de Personal");

      const visibleCols = columns.filter((c) => c.visible);
      worksheet.columns = visibleCols.map((c) => ({
        key: c.key,
        width: 15,
      }));

      const off = addExcelLetterhead(workbook, worksheet, visibleCols.length);
      const headerRowNum = off + 1;
      const headerRow = worksheet.getRow(headerRowNum);
      visibleCols.forEach((c, i) => { headerRow.getCell(i + 1).value = c.label; });

      allData.forEach((row) => {
        const rowData = {};
        visibleCols.forEach((c) => {
          rowData[c.key] = c.key === "nombre" ? buildFullName(row) : row[c.key];
        });
        const addedRow = worksheet.addRow(rowData);
        addedRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBC955C' } },
            left: { style: 'thin', color: { argb: 'FFBC955C' } },
            bottom: { style: 'thin', color: { argb: 'FFBC955C' } },
            right: { style: 'thin', color: { argb: 'FFBC955C' } }
          };
        });
      });

      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2B4C7E" }
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFBC955C' } },
          left: { style: 'medium', color: { argb: 'FFBC955C' } },
          bottom: { style: 'medium', color: { argb: 'FFBC955C' } },
          right: { style: 'medium', color: { argb: 'FFBC955C' } }
        };
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
          if (rowNumber <= off) return;
          const cellValue = cell.value ? cell.value.toString() : "";
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${activeSubTab === "bitacora" ? "Bitacora" : "Movimientos"}_${bitacoraDates.length === 0 ? "Ninguno" : bitacoraDates.length === 1 ? bitacoraDates[0] : `${bitacoraDates.length} fechas`}.xlsx`;
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Botón "Exportar a Excel": con permiso de foto en este tab, se ofrece
  // elegir incluirlas (modal) antes de exportar; sin el permiso, exporta
  // directo como siempre (sin fotos, 100% client-side, sin cambios).
  const handleOpenExportClick = () => {
    if (canViewFotoMovimientos) {
      setIsExportFotosModalOpen(true);
    } else {
      handleExportExcel();
    }
  };

  const handleConfirmExportConFotos = async (incluirFotos) => {
    if (!incluirFotos) {
      setIsExportFotosModalOpen(false);
      handleExportExcel();
      return;
    }
    const controller = new AbortController();
    exportConFotosAbortRef.current = controller;
    setIsExportingConFotos(true);
    try {
      const visibleCols = columns.filter(c => c.visible);
      const params = buildExportParams();
      const res = await VacantesService.exportarMovimientosPersonalConFotos(
        params,
        visibleCols.map(c => ({ key: c.key, label: c.label })),
        true,
        { signal: controller.signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Error al generar el Excel con fotografías.");
      }
      // Ver nota en PlantillaDetalleTab.jsx: la extensión depende de si el
      // backend incluyó la macro VBA (VBA_HABILITADO en excel_fotos.py).
      const extension = res.headers.get("Content-Type")?.includes("macroEnabled") ? "xlsm" : "xlsx";
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Movimientos_Personal_ConFotos.${extension}`;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsExportFotosModalOpen(false);
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Error al generar el Excel con fotografías.");
      }
    } finally {
      setIsExportingConFotos(false);
      exportConFotosAbortRef.current = null;
    }
  };

  const handleCancelExportConFotos = () => {
    exportConFotosAbortRef.current?.abort();
  };

  const handleDownloadYearReport = async (year) => {
    if (!year || isDownloadingReport) return;
    setIsDownloadingReport(true);
    try {
      // Catálogo de departamentos y fetch de movimientos en paralelo
      const [res, deptoRes] = await Promise.all([
        VacantesService.getMovimientosPersonal({
          no_pagination: true,
          fecha_captura__year: year,
          sort_by: "accion_nombre,fecha_captura,fecha_efectiva",
          sort_order: "asc",
        }),
        VacantesService.getOrganigramaDeptos(),
      ]);
      const rows = await res.json();
      const allRows = Array.isArray(rows) ? rows : [];

      const deptoData = await deptoRes.json();
      const DEPTO_CATALOG = new Map(
        Array.isArray(deptoData)
          ? deptoData.map((d) => [String(d.departamento || "").trim(), String(d.descripcion_larga || "").trim()])
          : []
      );
      const labelDepto = (code) => {
        if (!code && code !== 0) return "—";
        const raw = String(code).trim();
        const name = DEPTO_CATALOG.get(raw);
        return name ? `${raw} (${name})` : raw;
      };

      // Agregaciones
      const accionCounts = new Map();   // accion_nombre -> total
      const accionMotivos = new Map();  // accion_nombre -> Map(motivo_nombre -> total)
      allRows.forEach((row) => {
        const accion = String(row.accion_nombre || "Sin acción").trim();
        const motivo = String(row.motivo_nombre || "Sin motivo").trim();
        accionCounts.set(accion, (accionCounts.get(accion) || 0) + 1);
        if (!accionMotivos.has(accion)) accionMotivos.set(accion, new Map());
        accionMotivos.get(accion).set(motivo, (accionMotivos.get(accion).get(motivo) || 0) + 1);
      });

      const totalMovs = allRows.length;
      const accionesSorted = [...accionCounts.entries()].sort((a, b) => b[1] - a[1]);

      // Nombre seguro para hoja de Excel (máx 31 chars, sin \ / * ? [ ] :)
      const safeSheetName = (name) => name.replace(/[\\/*?[\]:]/g, '-').substring(0, 31);
      const accionSheetNames = new Map([...accionCounts.keys()].map(a => [a, safeSheetName(a)]));

      // Índices de allRows agrupados por accion_nombre (para generar hojas por acción)
      const rowsByAccion = new Map();
      allRows.forEach((row, idx) => {
        const accion = String(row.accion_nombre || "Sin acción").trim();
        if (!rowsByAccion.has(accion)) rowsByAccion.set(accion, []);
        rowsByAccion.get(accion).push(idx);
      });

      // ── Detalle Cambio Adscripción ────────────────────────────────────────────
      // Para cada fila con motivo "Cmbio Adscripción *", buscamos el registro
      // inmediatamente anterior del mismo empleado (historia completa, sin filtro
      // de año) y comparamos UN / UN Admin.
      const MOTIVOS_ADSC = new Set([
        "Cmbio Adscripción s/Cambio Sal",
        "Cmbio Adscripción c/Cambio Sal",
      ]);

      // detalleAdscripcion: índice en allRows -> texto del detalle
      const detalleAdscripcion = new Map();

      const adscRows = allRows
        .map((row, idx) => ({ row, idx }))
        .filter(({ row }) => MOTIVOS_ADSC.has(String(row.motivo_nombre || "").trim()));

      if (adscRows.length > 0) {
        const empIds = [...new Set(adscRows.map(({ row }) => row.num_empleado).filter(Boolean))];

        // Traer TODO el historial de esos empleados via raw SQL (sin filtro de año)
        // ordenado por num_empleado, fecha_efectiva, sec ASC directo en DB
        const hRes = await VacantesService.getMovimientosPersonalHistorial(empIds);
        const hData = await hRes.json();
        const histRows = Array.isArray(hData) ? hData : [];

        // Agrupar historial por empleado
        const byEmp = new Map();
        histRows.forEach((r) => {
          const k = String(r.num_empleado || "");
          if (!byEmp.has(k)) byEmp.set(k, []);
          byEmp.get(k).push(r);
        });

        adscRows.forEach(({ row, idx }) => {
          const empKey = String(row.num_empleado || "");
          const hist = byEmp.get(empKey) || [];

          // Localizar este registro exacto en el historial
          const rowFecha  = String(row.fecha_efectiva || "");
          const rowSec    = String(row.sec            || "");
          const rowPos    = String(row.posicion       || "");
          const rowMotivo = String(row.motivo_nombre  || "").trim();

          const pos = hist.findIndex(
            (r) =>
              String(r.fecha_efectiva || "") === rowFecha &&
              String(r.sec            || "") === rowSec   &&
              String(r.posicion       || "") === rowPos   &&
              String(r.motivo_nombre  || "").trim() === rowMotivo
          );

          if (pos > 0) {
            const prev = hist[pos - 1];
            detalleAdscripcion.set(idx, {
              ua_antes:     labelUA(String(prev.un_admin || "").trim()),
              ua_despues:   labelUA(String(row.un_admin  || "").trim()),
              un_antes:     labelUN(String(prev.un       || "").trim()),
              un_despues:   labelUN(String(row.un        || "").trim()),
              depto_antes:  labelDepto(String(prev.id_depto || "").trim()),
              depto_despues:labelDepto(String(row.id_depto  || "").trim()),
            });
          }
        });
      }

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "ANAM — Eje Central";
      workbook.created = new Date();

      // ── Paleta ──────────────────────────────────────────────────────────────
      const VINO      = "FF621F32";
      const ORO       = "FFBC955C";
      const AZUL      = "FF2B4C7E";
      const VINO_LITE = "FFF3E7EB";
      const ORO_LITE  = "FFF6EEE0";
      const GRIS      = "FFE2D9C9";
      const LINK      = "FF0563C1";

      const thin = {
        top:    { style: "thin", color: { argb: GRIS } },
        left:   { style: "thin", color: { argb: GRIS } },
        bottom: { style: "thin", color: { argb: GRIS } },
        right:  { style: "thin", color: { argb: GRIS } },
      };
      const medOro = (side) => ({ style: "medium", color: { argb: ORO } });
      const headerBorder = { top: medOro(), left: medOro(), bottom: medOro(), right: medOro() };

      // ── Hoja 1: Detalle ─────────────────────────────────────────────────────
      const detName = `Año ${year}`;
      const ws = workbook.addWorksheet(detName, { views: [{ state: "frozen", ySplit: 1 }] });

      // Las 6 columnas de adscripción van al final
      const ADSC_COLS = [
        { header: "Unidad Administrativa Antes",   key: "__adsc_ua_antes__",     width: 38 },
        { header: "Unidad Administrativa Después",  key: "__adsc_ua_despues__",   width: 38 },
        { header: "Unidad de Negocio Antes",        key: "__adsc_un_antes__",     width: 38 },
        { header: "Unidad de Negocio Después",      key: "__adsc_un_despues__",   width: 38 },
        { header: "Departamento Antes",             key: "__adsc_depto_antes__",  width: 28 },
        { header: "Departamento Después",           key: "__adsc_depto_despues__",width: 28 },
      ];
      const totalDataCols = columns.length + ADSC_COLS.length;
      ws.columns = [
        ...columns.map((c) => ({ header: c.label, key: c.key, width: 15 })),
        ...ADSC_COLS,
      ];

      allRows.forEach((row, idx) => {
        const rd = {};
        columns.forEach((c) => { rd[c.key] = c.key === "nombre" ? buildFullName(row) : row[c.key]; });
        const det = detalleAdscripcion.get(idx);
        rd.__adsc_ua_antes__     = det ? det.ua_antes     : "";
        rd.__adsc_ua_despues__   = det ? det.ua_despues   : "";
        rd.__adsc_un_antes__     = det ? det.un_antes     : "";
        rd.__adsc_un_despues__   = det ? det.un_despues   : "";
        rd.__adsc_depto_antes__  = det ? det.depto_antes  : "";
        rd.__adsc_depto_despues__= det ? det.depto_despues: "";
        const addedRow = ws.addRow(rd);
        addedRow.eachCell((cell) => { cell.border = thin; });
        // Resaltar las 6 celdas de adscripción cuando hay registro previo
        if (det) {
          for (let ci = columns.length + 1; ci <= totalDataCols; ci++) {
            addedRow.getCell(ci).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: VINO } };
          }
        }
      });

      // Estilo encabezado detalle
      const detHeader = ws.getRow(1);
      detHeader.height = 24;
      detHeader.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
        cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = headerBorder;
      });
      // Las 6 columnas de adscripción tienen encabezado vino para distinguirlas
      for (let ci = columns.length + 1; ci <= totalDataCols; ci++) {
        const hc = detHeader.getCell(ci);
        hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO } };
        hc.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      }

      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalMovs + 1, column: totalDataCols } };

      // Auto-ancho columnas detalle (excluye la extra que ya tiene width fijo)
      ws.columns.slice(0, columns.length).forEach((col) => {
        let max = col.header ? col.header.length : 0;
        col.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value != null ? String(cell.value) : "";
          if (v.length > max) max = v.length;
        });
        col.width = Math.min(Math.max(max + 2, 10), 50);
      });

      // ── Hoja 2: Resumen ──────────────────────────────────────────────────────
      const rs = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
      rs.getColumn(1).width = 46;
      rs.getColumn(2).width = 16;
      rs.getColumn(3).width = 14;
      rs.getColumn(4).width = 26;

      // Membretado institucional solo en Resumen (hoja de entrada) — las hojas de
      // detalle ("Año YYYY", por acción) no lo llevan porque sus hipervínculos
      // ("#'hoja'!A2") y autoFilter asumen encabezado fijo en la fila 1.
      addExcelLetterhead(workbook, rs, 4);

      // Helpers de estilo Resumen
      const secTitle = (text) => {
        const r = rs.addRow([text]);
        rs.mergeCells(r.number, 1, r.number, 4);
        const c = r.getCell(1);
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO } };
        c.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        r.height = 26;
      };
      const tableHeader = (labels) => {
        const r = rs.addRow(labels);
        labels.forEach((_, i) => {
          const c = r.getCell(i + 1);
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
          c.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
          c.alignment = { horizontal: "center", vertical: "middle" };
          c.border = thin;
        });
        r.height = 22;
        return r;
      };
      const dataCell = (cell, value, opts = {}) => {
        cell.value = value;
        cell.font = { name: "Segoe UI", size: 10, ...(opts.font || {}) };
        cell.alignment = { ...(opts.align || {}) };
        cell.border = thin;
        if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
        if (opts.numFmt) cell.numFmt = opts.numFmt;
      };

      // ── Título ───────────────────────────────────────────────────────────────
      const tit = rs.addRow([`Reporte de Movimientos de Personal — Año ${year}`]);
      rs.mergeCells(tit.number, 1, tit.number, 4);
      tit.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO } };
      tit.getCell(1).font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      tit.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      tit.height = 40;

      const sub = rs.addRow([`Total de movimientos: ${totalMovs}   ·   ${accionesSorted.length} acciones distintas`]);
      rs.mergeCells(sub.number, 1, sub.number, 4);
      sub.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO } };
      sub.getCell(1).font = { name: "Segoe UI", size: 10, color: { argb: ORO } };
      sub.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      sub.height = 18;

      rs.addRow([]);

      // ── Tabla 1: Acciones ────────────────────────────────────────────────────
      secTitle("Acciones  ·  Clic en Total → ver detalle");
      tableHeader(["Acción", "Total", "% del total", "Participación visual"]);
      const firstAccRow = rs.rowCount + 1;

      accionesSorted.forEach(([accion, cnt]) => {
        const r = rs.addRow([]);
        const pct = totalMovs > 0 ? cnt / totalMovs : 0;
        const accionSheet = accionSheetNames.get(accion) || detName;

        dataCell(r.getCell(1), accion, { font: { bold: true, color: { argb: VINO } } });

        // Hipervínculo a la hoja pre-filtrada de esa acción (A2 = primera fila de datos)
        r.getCell(2).value = { formula: `HYPERLINK("#'${accionSheet}'!A2","${cnt}")`, result: cnt };
        r.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: LINK }, underline: true };
        r.getCell(2).alignment = { horizontal: "center" };
        r.getCell(2).border = thin;

        dataCell(r.getCell(3), pct, { numFmt: "0.0%", align: { horizontal: "center" } });

        // Columna D: valor numérico invisible — el data bar la usa
        r.getCell(4).value = cnt;
        r.getCell(4).font = { color: { argb: "FFFFFFFF" }, size: 1 };
        r.getCell(4).border = thin;
        r.height = 18;
      });

      const lastAccRow = rs.rowCount;

      // Fila TOTAL
      const tot = rs.addRow(["TOTAL", totalMovs, 1, ""]);
      tot.getCell(3).numFmt = "0%";
      [1, 2, 3, 4].forEach((i) => {
        tot.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORO_LITE } };
        tot.getCell(i).font = { name: "Segoe UI", size: 10, bold: true };
        tot.getCell(i).border = thin;
        if (i > 1) tot.getCell(i).alignment = { horizontal: "center" };
      });
      tot.height = 20;

      // Data bar en columna D
      rs.addConditionalFormatting({
        ref: `D${firstAccRow}:D${lastAccRow}`,
        rules: [{ type: "dataBar", cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: VINO }, gradient: true, border: false, showValue: false }],
      });

      rs.addRow([]);

      // ── Tabla 2: Motivos por Acción ──────────────────────────────────────────
      secTitle("Motivos por Acción  ·  Clic en Total → ver detalle");
      tableHeader(["Acción / Motivo", "Total", "% dentro de la acción", "% del total"]);

      accionesSorted.forEach(([accion, accCnt]) => {
        const mMap = accionMotivos.get(accion) || new Map();
        const motivosSorted = [...mMap.entries()].sort((a, b) => b[1] - a[1]);
        const accionSheet = accionSheetNames.get(accion) || detName;

        // Fila encabezado de acción
        const ar = rs.addRow([]);
        dataCell(ar.getCell(1), accion, { font: { bold: true, color: { argb: VINO } }, fill: VINO_LITE });
        ar.getCell(1).border = thin;

        ar.getCell(2).value = { formula: `HYPERLINK("#'${accionSheet}'!A2","${accCnt}")`, result: accCnt };
        ar.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: LINK }, underline: true };
        ar.getCell(2).alignment = { horizontal: "center" };
        ar.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO_LITE } };
        ar.getCell(2).border = thin;

        dataCell(ar.getCell(3), "", { fill: VINO_LITE });
        dataCell(ar.getCell(4), "", { fill: VINO_LITE });
        ar.height = 20;

        // Filas de motivo
        motivosSorted.forEach(([motivo, mCnt]) => {
          const mr = rs.addRow([]);
          const pctAcc  = accCnt  > 0 ? mCnt / accCnt  : 0;
          const pctTot  = totalMovs > 0 ? mCnt / totalMovs : 0;

          dataCell(mr.getCell(1), `    ${motivo}`, { font: { color: { argb: "FF374151" } } });
          dataCell(mr.getCell(2), mCnt, { align: { horizontal: "center" }, font: { bold: true, color: { argb: VINO } } });
          dataCell(mr.getCell(3), pctAcc, { numFmt: "0.0%", align: { horizontal: "center" } });
          dataCell(mr.getCell(4), pctTot, { numFmt: "0.0%", align: { horizontal: "center" } });
          mr.height = 17;
        });
      });

      // ── Hojas por Acción (pre-filtradas) ────────────────────────────────────
      for (const [accion, idxList] of rowsByAccion) {
        const sheetName = accionSheetNames.get(accion) || accion;
        const aws = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
        aws.columns = [
          ...columns.map((c) => ({ header: c.label, key: c.key, width: 15 })),
          ...ADSC_COLS,
        ];

        idxList.forEach((idx) => {
          const row = allRows[idx];
          const rd = {};
          columns.forEach((c) => { rd[c.key] = c.key === "nombre" ? buildFullName(row) : row[c.key]; });
          const det = detalleAdscripcion.get(idx);
          rd.__adsc_ua_antes__     = det ? det.ua_antes     : "";
          rd.__adsc_ua_despues__   = det ? det.ua_despues   : "";
          rd.__adsc_un_antes__     = det ? det.un_antes     : "";
          rd.__adsc_un_despues__   = det ? det.un_despues   : "";
          rd.__adsc_depto_antes__  = det ? det.depto_antes  : "";
          rd.__adsc_depto_despues__= det ? det.depto_despues: "";
          const addedRow = aws.addRow(rd);
          addedRow.eachCell((cell) => { cell.border = thin; });
          if (det) {
            for (let ci = columns.length + 1; ci <= totalDataCols; ci++) {
              addedRow.getCell(ci).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: VINO } };
            }
          }
        });

        const awsHeader = aws.getRow(1);
        awsHeader.height = 24;
        awsHeader.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
          cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = headerBorder;
        });
        for (let ci = columns.length + 1; ci <= totalDataCols; ci++) {
          const hc = awsHeader.getCell(ci);
          hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VINO } };
          hc.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        }

        aws.autoFilter = { from: { row: 1, column: 1 }, to: { row: idxList.length + 1, column: totalDataCols } };

        aws.columns.slice(0, columns.length).forEach((col) => {
          let max = col.header ? col.header.length : 0;
          col.eachCell({ includeEmpty: false }, (cell) => {
            const v = cell.value != null ? String(cell.value) : "";
            if (v.length > max) max = v.length;
          });
          col.width = Math.min(Math.max(max + 2, 10), 50);
        });
      }

      // ── Exportar ─────────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Reporte_Movimientos_${year}.xlsx`;
      link.click();
    } catch (err) {
      console.error("Error generando reporte del año:", err);
    } finally {
      setIsDownloadingReport(false);
    }
  };


  const handleMouseDown = (e, index, direction = 'right') => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns(prevCols => {
        const newCols = [...prevCols];
        const newWidth = direction === 'left' ? startWidth - deltaX : startWidth + deltaX;
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
    setTextFilters({});
    setColumnFilters({});
    setSearchQuery("");
    setSortConfig({ key: "fecha_efectiva,fecha_captura", direction: "desc" });
    resetAdvancedFilters();
    setPage(1);
  };

  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  // No usa `new Date(...)` (ver el mismo bug documentado en formatDateEsMx /
  // utils/columnFilters.parseDateParts): interpreta "YYYY-MM-DD" como
  // medianoche UTC, y leerla con getters locales en México (UTC-6) resta un
  // día — agrupaba la fecha en el árbol año/mes/día bajo el mes/año anterior.
  const parseDateParts = useCallback((val) => {
    if (!val || String(val).trim() === "") return null;
    const dateSection = String(val).trim().split(/[T ]/)[0];
    const sep = dateSection.includes('/') ? '/' : dateSection.includes('-') ? '-' : null;
    if (!sep) return null;
    const parts = dateSection.split(sep);
    if (parts.length !== 3) return null;
    const [a, b, c] = parts;
    const [year, month, day] = a.length === 4 ? [a, b, c] : [c, b, a];
    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    return {
      year,
      month: month.padStart(2, '0'),
      day: day.padStart(2, '0'),
      monthName: MONTH_NAMES[monthNum - 1]
    };
  }, []);

  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    if (!activeFilterDropdown || !isDateColumn(activeFilterDropdown)) return hierarchies;

    const valuesList = mergedColumnValues[activeFilterDropdown] || [];
    const years = {};

    valuesList.forEach(item => {
      const val = item.value;
      const parts = parseDateParts(val);
      if (!parts) return;
      const { year, month, day, monthName } = parts;
      if (!years[year]) years[year] = { count: 0, months: {} };
      years[year].count += item.count;

      if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
      years[year].months[month].count += item.count;

      years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + item.count;
    });

    hierarchies[activeFilterDropdown] = years;
    return hierarchies;
  }, [mergedColumnValues, activeFilterDropdown, parseDateParts]);

  const temporalChartData = useMemo(() => {
    if (barChartLevel === "year") {
      const grouped = {};
      distinctDates.forEach(d => {
        if (!d.value) return;
        const y = d.value.split('-')[0];
        grouped[y] = (grouped[y] || 0) + d.count;
      });
      return Object.entries(grouped).map(([label, total]) => ({ label, total, type: 'year' })).sort((a,b) => a.label.localeCompare(b.label));
    }
    if (barChartLevel === "month" && barChartSelection.year) {
      const grouped = {};
      distinctDates.forEach(d => {
        if (!d.value || !d.value.startsWith(barChartSelection.year)) return;
        const m = d.value.split('-')[1];
        grouped[m] = (grouped[m] || 0) + d.count;
      });
      return Object.entries(grouped).map(([label, total]) => ({ 
        label, 
        name: MONTH_NAMES[parseInt(label, 10) - 1], 
        total, 
        type: 'month' 
      })).sort((a,b) => a.label.localeCompare(b.label));
    }
    if (barChartLevel === "day" && barChartSelection.year && barChartSelection.month) {
      const prefix = `${barChartSelection.year}-${barChartSelection.month}`;
      const grouped = {};
      distinctDates.forEach(d => {
        if (!d.value || !d.value.startsWith(prefix)) return;
        const day = d.value.split('-')[2];
        grouped[day] = (grouped[day] || 0) + d.count;
      });
      return Object.entries(grouped).map(([label, total]) => ({ 
        label, 
        total, 
        type: 'day',
        fullDate: `${prefix}-${label}`
      })).sort((a,b) => parseInt(a.label, 10) - parseInt(b.label, 10));
    }
    return [];
  }, [distinctDates, barChartLevel, barChartSelection]);

  const handleTemporalBarClick = useCallback((d) => {
    setActiveSubTab("bitacora");
    setPage(1);
    setSelectedActionName(null);
    setTextFilters({});
    setColumnFilters({});

    if (d.type === 'year') {
      setBarChartSelection({ year: d.label, month: null });
      setBarChartLevel("month");
      const datesInYear = distinctDates.filter(date => date.value && date.value.startsWith(d.label)).map(date => date.value);
      setBitacoraDates(datesInYear);
    } else if (d.type === 'month') {
      setBarChartSelection(prev => ({ ...prev, month: d.label }));
      setBarChartLevel("day");
      const prefix = `${barChartSelection.year}-${d.label}`;
      const datesInMonth = distinctDates.filter(date => date.value && date.value.startsWith(prefix)).map(date => date.value);
      setBitacoraDates(datesInMonth);
    } else if (d.type === 'day') {
      setBitacoraDates([d.fullDate]);
    }
  }, [distinctDates, barChartSelection]);

  const toggleDateNode = (path) => {
    setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const valuesList = mergedColumnValues[colKey] || [];
    let targetRawValues = [];
    
    if (type === 'year') {
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === value;
        })
        .map(item => String(item.value || "").trim());
    } else if (type === 'month') {
      const year = parentPath;
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === value;
        })
        .map(item => String(item.value || "").trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(item => String(item.value || "").trim());
    }

    // Sólo togglear lo alcanzable dado el resto de filtros (el nodo ya
    // aparece deshabilitado en el dropdown cuando nada de él es alcanzable).
    const reachableSet = new Set(reachableValues);
    const uniqueTargetValues = [...new Set(targetRawValues)].filter(v => reachableSet.has(v));
    if (uniqueTargetValues.length === 0) return;
    const allInTemp = uniqueTargetValues.every(v => tempSelectedValues.includes(v));

    if (allInTemp) {
      setTempSelectedValues(prev => prev.filter(v => !uniqueTargetValues.includes(v)));
    } else {
      setTempSelectedValues(prev => [...new Set([...prev, ...uniqueTargetValues])]);
    }
  };

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) {
      setActiveFilterDropdown(null);
      return;
    }

    setActiveFilterDropdown(colKey);
    setFilterSearchText("");
    setHasInitializedTemp(false);
    setTempSelectedValues(columnFilters[colKey] || []);
  };

  // Valores alcanzables (fetch "por defecto", sin buscar): universo dado el
  // resto de filtros/vista activos (búsqueda global, texto por columna, otros
  // column filters, año/acción/bitácora seleccionados, avanzados), excepto el
  // de la propia columna.
  useEffect(() => {
    if (!activeFilterDropdown) return;
    const ctrl = new AbortController();
    setLoadingUniqueValues(true);
    const filterParams = getTextFilterParams(debouncedTextFilters);
    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (key === activeFilterDropdown) return;
      if (values && values.length > 0) {
        colParams[`${key}__in`] = values.join(",");
      }
    });

    const yearFilter = selectedActionName
      ? (selectedMotifYear !== "all" ? selectedMotifYear : null)
      : (selectedYear !== "all" ? selectedYear : null);

    const params = {
      distinct_field: activeFilterDropdown,
      distinct_search: "",
      search: debouncedSearch,
      ...filterParams,
      ...colParams,
    };
    if (yearFilter && activeSubTab !== "bitacora") {
      params.fecha_efectiva__year = yearFilter;
    }
    if (selectedActionName) {
      params.accion_nombre = selectedActionName;
    }
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }
    if (appliedAdvancedFilters.length > 0) {
      params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
    }

    VacantesService.getMovimientosPersonal(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        const valuesList = sortValueCounts(Array.isArray(resData) ? resData : []);
        setReachableColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
        setHasInitializedTemp(prevInit => {
          if (!prevInit) {
            if (columnFilters[activeFilterDropdown]) {
              setTempSelectedValues(columnFilters[activeFilterDropdown]);
            } else {
              setTempSelectedValues(valuesList.map(v => v.value));
            }
            return true;
          }
          return prevInit;
        });
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("Error valores alcanzables de columna:", err); })
      .finally(() => { if (!ctrl.signal.aborted) setLoadingUniqueValues(false); });
    return () => ctrl.abort();
  }, [activeFilterDropdown, debouncedSearch, debouncedTextFilters, columnFilters, selectedActionName, selectedMotifYear, selectedYear, activeSubTab, bitacoraDates, appliedAdvancedFilters]);

  // Buscar en TODA la columna: sólo cuando hay texto en el buscador del
  // dropdown, universo completo sin el resto de filtros — igual al que antes
  // disparaba el tab "Todos los datos". No bloquea la lista con un skeleton
  // (no depende de `loadingUniqueValues`): mientras llega, se ve la lista de
  // alcanzables ya cargada.
  useEffect(() => {
    if (!activeFilterDropdown || !debouncedFilterSearchText) return;
    const ctrl = new AbortController();
    const params = {
      distinct_field: activeFilterDropdown,
      // BUG QA: buscar "16/07/2026" (formato DD/MM/AAAA que muestra toda la UI)
      // no matcheaba nada — el backend hace icontains contra el valor crudo
      // ISO ("2026-07-16"). Se traduce antes de mandarlo.
      distinct_search: isDateColumn(activeFilterDropdown) ? normalizeDateSearchTerm(debouncedFilterSearchText) : debouncedFilterSearchText,
    };
    VacantesService.getMovimientosPersonal(params, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => {
        const valuesList = sortValueCounts(Array.isArray(resData) ? resData : []);
        setSearchColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
      })
      .catch((err) => { if (err.name !== "AbortError") console.error("Error buscando en toda la columna:", err); });
    return () => ctrl.abort();
  }, [activeFilterDropdown, debouncedFilterSearchText]);

  const applyColumnFilter = (colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
    let newFilters = { ...columnFilters };
    if (shouldClear) {
      delete newFilters[colKey];
    } else {
      newFilters[colKey] = valuesToCommit;
    }
    setColumnFilters(newFilters);
    setPage(1);
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    let newFilters = { ...columnFilters };
    delete newFilters[colKey];
    setColumnFilters(newFilters);
    setPage(1);
    setActiveFilterDropdown(null);
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  useEffect(() => {
    if (!selectedCell || !tbodyRef.current) return;
    const { rowIdx, colIdx } = selectedCell;
    const container = tbodyRef.current.closest('.overflow-auto') || tbodyRef.current.parentElement;
    if (!container) return;
    const rowHeight = 37, headerHeight = 36;
    const rowTop = (rowIdx % pageSize) * rowHeight;
    const rowBottom = rowTop + rowHeight;
    if (rowTop < container.scrollTop + headerHeight) container.scrollTop = Math.max(0, rowTop - headerHeight);
    else if (rowBottom > container.scrollTop + container.clientHeight) container.scrollTop = rowBottom - container.clientHeight + headerHeight;
    const visibleCols = columns.filter(c => c.visible);
    if (!visibleCols[colIdx]) return;
    const frozenWidth = 95 + (visibleCols[0]?.width || 110) + (visibleCols[1]?.width || 120);
    let colLeft = 95;
    for (let i = 0; i < colIdx; i++) colLeft += visibleCols[i].width || 120;
    const colRight = colLeft + (visibleCols[colIdx].width || 120);
    if (colIdx >= 2) {
      if (colLeft < container.scrollLeft + frozenWidth) container.scrollLeft = Math.max(0, colLeft - frozenWidth - 20);
      else if (colRight > container.scrollLeft + container.clientWidth) container.scrollLeft = colRight - container.clientWidth + 20;
    }
  }, [selectedCell, columns, page, pageSize]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e.key.startsWith('Arrow')) {
        if (e.key === 'Escape') setContextMenu(null);
        return;
      }
      e.preventDefault();
      if (e.repeat) arrowRepeatRef.current += 1; else arrowRepeatRef.current = 1;
      let step = 1; if (arrowRepeatRef.current > 5) step = 2; if (arrowRepeatRef.current > 12) step = 5; if (arrowRepeatRef.current > 20) step = 10;
      const visibleColsArray = columns.filter(c => c.visible);
      const visibleCols = visibleColsArray.length;
      setSelectedCell(prev => {
        if (!prev) return prev;
        const minRowIdx = (page - 1) * pageSize, maxRowIdx = minRowIdx + data.length - 1;
        let newRowIdx = prev.rowIdx, newColIdx = prev.colIdx;
        if (e.key === 'ArrowUp') newRowIdx = Math.max(minRowIdx, prev.rowIdx - step);
        if (e.key === 'ArrowDown') newRowIdx = Math.min(maxRowIdx, prev.rowIdx + step);
        if (e.key === 'ArrowLeft') newColIdx = Math.max(0, prev.colIdx - step);
        if (e.key === 'ArrowRight') newColIdx = Math.min(visibleCols - 1, prev.colIdx + step);
        return { rowIdx: newRowIdx, colIdx: newColIdx, colName: visibleColsArray[newColIdx]?.label || prev.colName, value: data[newRowIdx - minRowIdx]?.[visibleColsArray[newColIdx]?.key] };
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, columns, page, pageSize]);

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6 pt-2">
      {/* Statistics Card and Pie Chart */}
        <Zoom triggerOnce>
          <div className="flex flex-col gap-3 mb-6 w-full">
            {/* Tabs Toggle (Moved here) — oculto en móvil, sólo pie ahí */}
            <div className="hidden md:flex items-center gap-2 self-start bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm relative z-10 shadow-sm ml-1">
              <button
                onClick={() => setStatsViewMode("pie")}
                className={`min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statsViewMode === "pie" ? "bg-white dark:bg-slate-800 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                Distribución (Pie)
              </button>
              <button
                onClick={() => setStatsViewMode("bar")}
                className={`min-h-11 md:min-h-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statsViewMode === "bar" ? "bg-white dark:bg-slate-800 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                En el tiempo (Barras)
              </button>
            </div>

            {/* BUG-10 QA: en Bitácora, la tarjeta de la izquierda muestra el total
                del día(s) seleccionado(s) (puede ser 0 si aún no hay capturas),
                mientras que "En el tiempo" es un navegador histórico global (para
                saltar a cualquier fecha pasada) — son dos datasets distintos a
                propósito; se aclara para que no se lean como una contradicción. */}
            {activeSubTab === "bitacora" && statsViewMode === "bar" && (
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 -mt-1 ml-1">
                "En el tiempo" muestra el histórico completo de capturas (para saltar a otra fecha) — no el total del día seleccionado en la tarjeta.
              </p>
            )}

            <div className="flex flex-col lg:flex-row gap-5 items-stretch w-full">
                    {statsLoading ? (
              <div className="flex-shrink-0 lg:w-56">
                <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-[#621f32]/90 text-white shadow-xl shadow-[#621f32]/25 ring-2 ring-white/20 animate-pulse">
                  <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-white/20 size-8" />
                    <div className="h-3 w-28 bg-white/20 rounded-md" />
                  </div>
                  
                  <div className="flex flex-col relative z-10 gap-2">
                    <div className="h-10 w-24 bg-white/20 rounded-lg" />
                    <div className="h-3 w-32 bg-white/10 rounded-md mt-2" />
                  </div>

                  <div className="mt-4 relative z-10">
                    <div className="h-2.5 w-20 bg-white/10 rounded-md mb-2" />
                    <div className="h-10 min-h-10 max-h-10 w-full bg-white/20 rounded-xl flex-shrink-0" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 lg:w-56">
                <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-gradient-to-br from-[#621f32] to-[#8a2a46] text-white shadow-xl shadow-[#621f32]/25 ring-2 ring-white/20">
                  <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-white/20 text-white">
                      <Briefcase className="size-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Total de Movimientos</span>
                  </div>
                  
                  <div className="flex flex-col relative z-10">
                    <span className="text-5xl font-black tracking-tighter text-white">
                      {formatNumber(pieTotal)}
                    </span>
                    <span className="text-xs text-white/60 mt-2 relative z-10 font-semibold">
                      {activeStatsList.length} acciones distintas
                    </span>
                  </div>

                  {/* Year Selector */}
                  <div className="mt-4 relative z-10">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/75 block mb-1">Año de Efectividad</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 !h-10 !min-h-10 !max-h-10 flex-shrink-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:text-slate-500 shadow-sm transition-colors">
                        <SelectValue placeholder="Seleccionar año" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="bg-white border border-slate-200 text-slate-850 max-h-60 rounded-xl shadow-xl [&_svg]:text-slate-800 w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="all" className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                          Todos los años
                        </SelectItem>
                        {Object.keys(statsData.by_year).sort((a, b) => b.localeCompare(a)).map(year => (
                          <SelectItem key={year} value={year} className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 flex-1 min-h-[224px]">              {statsViewMode === "pie" ? (
                statsLoading ? (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center animate-pulse">
                {/* SVG skeleton */}
                <div className="relative shrink-0 size-[180px] rounded-full border-[22px] border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-900/50" />
                </div>
                {/* Legend skeleton */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="shrink-0 size-2.5 rounded-full bg-slate-200 dark:bg-slate-850" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-24" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-10 ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            ) : pieSlices.length > 0 ? (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center">
                <div className="relative shrink-0" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                  <svg viewBox="0 0 200 200" width="180" height="180" className="drop-shadow-md">
                    {pieSlices.map((slice, i) => (
                      <path
                        key={i}
                        d={slice.d}
                        fill={slice.color}
                        opacity={hoveredSlice === null || hoveredSlice === i ? 1 : 0.35}
                        stroke="white"
                        strokeWidth="1.5"
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice(i)} onPointerDown={() => setHoveredSlice(i)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => handleActionClick(slice.accion_nombre)}
                        style={hoveredSlice === i ? { filter: 'brightness(1.15)', transform: 'scale(1.03)', transformOrigin: 'center' } : {}}
                      />
                    ))}
                    {/* Donut hole */}
                    <circle cx="100" cy="100" r="42" fill="white" className="dark:fill-slate-900" />
                    <text x="100" y="96" textAnchor="middle" className="text-[9px]" fill="#621f32" fontWeight="900" fontSize="11">
                      {hoveredSlice !== null ? pieSlices[hoveredSlice].pct + "%" : formatNumber(pieTotal)}
                    </text>
                    <text x="100" y="110" textAnchor="middle" fill="#999" fontSize="7" fontWeight="600">
                      {hoveredSlice !== null ? "del total" : "movimientos"}
                    </text>
                  </svg>
                </div>

                {/* Leyenda */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-48 overflow-y-auto pr-1" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                  {pieSlices.map((slice, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredSlice(i)} onPointerDown={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => handleActionClick(slice.accion_nombre)}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                        hoveredSlice === null || hoveredSlice === i ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={`${slice.accion_nombre} (con ${getMotivosCount(slice.accion_nombre) ?? "…"} motivos diferentes)`}>
                        {slice.accion_nombre} <span className="text-[9px] font-normal text-slate-500 dark:text-slate-500"> (con {getMotivosCount(slice.accion_nombre) ?? "…"} motivos diferentes)</span>
                      </span>
                      <span className="text-[10px] font-black text-slate-500 shrink-0">
                        {formatNumber(slice.total)}
                        <span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null) : (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col items-center justify-center relative min-h-[224px]">
                {distinctDatesLoading ? (
                  <div className="w-full h-full flex items-end justify-between gap-1 sm:gap-2 px-2 pb-2 animate-pulse">
                    {[40, 65, 50, 80, 60, 90, 45, 70, 55, 85].map((h, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-[20px] max-w-[60px]">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-t-md" style={{ height: `${h}%` }} />
                        <div className="h-2 w-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : temporalChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <BarChart className="size-8 mb-2 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-wider">No hay datos temporales</span>
                  </div>
                ) : (
                  <>
                    {/* Header with back button */}
                    <div className="absolute top-4 left-5 flex items-center gap-2">
                      {(barChartLevel === "month" || barChartLevel === "day") && (
                        <button
                          onClick={() => {
                            if (barChartLevel === "day") {
                              setBarChartLevel("month");
                              setBarChartSelection(p => ({ ...p, month: null }));
                            } else {
                              setBarChartLevel("year");
                              setBarChartSelection({ year: null, month: null });
                            }
                          }}
                          className="flex items-center justify-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors text-slate-500"
                          title="Regresar"
                        >
                          <ArrowLeft className="size-4" />
                        </button>
                      )}
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c] flex items-center gap-1.5">
                        <span className={barChartLevel === "year" ? "" : "text-slate-400 font-semibold cursor-pointer"} onClick={() => { setBarChartLevel("year"); setBarChartSelection({ year: null, month: null }); }}>Años</span>
                        {barChartLevel !== "year" && (
                          <>
                            <ChevronRight className="size-3 text-slate-300" />
                            <span className={barChartLevel === "month" ? "" : "text-slate-400 font-semibold cursor-pointer"} onClick={() => { setBarChartLevel("month"); setBarChartSelection(p => ({ ...p, month: null })); }}>{barChartSelection.year}</span>
                          </>
                        )}
                        {barChartLevel === "day" && (
                          <>
                            <ChevronRight className="size-3 text-slate-300" />
                            <span>{MONTH_NAMES[parseInt(barChartSelection.month, 10) - 1]}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="absolute top-4 right-5 flex items-center gap-3">
                      {barChartSelection.year && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadYearReport(barChartSelection.year); }}
                          disabled={isDownloadingReport}
                          title={`Descargar reporte Excel del año ${barChartSelection.year}`}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-xl text-[9px] uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {isDownloadingReport ? (
                            <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <Download className="size-3" />
                          )}
                          {isDownloadingReport ? "Generando..." : `Descargar Reporte del año ${barChartSelection.year}`}
                        </button>
                      )}
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total en el periodo</span>
                        <span className="text-xl font-black text-[#621f32] dark:text-[#bc955c] leading-none">
                          {formatNumber(temporalChartData.reduce((acc, curr) => acc + curr.total, 0))}
                        </span>
                      </div>
                    </div>

                    <div className="w-full flex-1 flex items-end justify-between gap-1 sm:gap-2 mt-8 px-2 overflow-x-auto pb-2 custom-scrollbar">
                      {temporalChartData.map((d, i) => (
                        <div 
                          key={d.label} 
                          className="flex flex-col items-center group cursor-pointer flex-1 min-w-[20px] max-w-[60px]" 
                          onClick={() => handleTemporalBarClick(d)}
                        >
                          <div className="text-[11px] font-black text-slate-500 mb-1 whitespace-nowrap">
                            {formatNumber(d.total)}
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md relative flex items-end justify-center h-32 mt-auto">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max((d.total / Math.max(...temporalChartData.map(t => t.total))) * 100, 2)}%` }}
                              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.03 }}
                              className="w-full bg-gradient-to-t from-[#621f32] to-[#8a2a46] dark:from-[#8b6b3e] dark:to-[#bc955c] rounded-t-md transition-colors group-hover:brightness-110"
                            />
                          </div>
                          <div className="text-[11px] font-black uppercase mt-2 text-slate-700 dark:text-slate-300 truncate w-full text-center" title={d.name || d.label}>
                            {d.name ? d.name.substring(0, 3) : d.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>

            <AnimatePresence>
              {selectedActionName && (
                <>
                  {/* Motif stats card */}
                  <motion.div
                    key="motif-card"
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex-shrink-0 lg:w-56 flex flex-col gap-2"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#bc955c] dark:text-[#d4a96a] px-1 truncate" title={`Motivos de ${selectedActionName}`}>
                      Motivos de {selectedActionName}
                    </div>
                    {motifStatsLoading ? (
                      <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-[#bc955c]/90 text-slate-950 shadow-xl shadow-[#bc955c]/25 ring-2 ring-white/20 animate-pulse min-h-[224px]">
                        <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                        <div className="flex items-center gap-2 mb-3 relative z-10 pr-4">
                          <div className="p-2 rounded-xl bg-slate-950/20 text-slate-950 shrink-0">
                            <Filter className="size-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/90 truncate" title={`${selectedActionName}`}>
                            {selectedActionName}
                          </span>
                        </div>
                        
                        <div className="flex flex-col relative z-10 gap-2">
                          <div className="h-10 w-24 bg-slate-950/20 rounded-lg" />
                          <div className="h-3 w-32 bg-slate-950/10 rounded-md mt-2" />
                        </div>

                        <div className="mt-4 relative z-10">
                          <div className="h-2.5 w-20 bg-slate-950/10 rounded-md mb-2" />
                          <div className="h-10 min-h-10 max-h-10 w-full bg-slate-950/20 rounded-xl flex-shrink-0" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-gradient-to-br from-[#bc955c] to-[#9a753c] text-slate-950 shadow-xl shadow-[#bc955c]/25 ring-2 ring-white/20 min-h-[224px]">
                        <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-30 bg-white" />
                        
                        {/* Close button in top-right */}
                        <button 
                          onClick={handleCloseMotifStats} 
                          className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-950/10 text-slate-950 transition-colors z-20 cursor-pointer"
                          title="Cerrar distribución por motivos"
                        >
                          <X className="size-3.5" />
                        </button>

                        <div className="flex items-center gap-2 mb-3 relative z-10 pr-4">
                          <div className="p-2 rounded-xl bg-slate-950/15 text-slate-950 shrink-0">
                            <Filter className="size-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/90 truncate" title={`${selectedActionName}`}>
                            {selectedActionName}
                          </span>
                        </div>
                        
                        <div className="flex flex-col relative z-10">
                          <span className="text-5xl font-black tracking-tighter text-slate-950">
                            {formatNumber(motifPieTotal)}
                          </span>
                          <span className="text-xs text-slate-950/70 mt-2 relative z-10 font-semibold truncate">
                            {activeMotifStatsList.length} motivos distintos
                          </span>
                        </div>

                        {/* Year Selector for Motifs */}
                        <div className="mt-4 relative z-10">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-950/75 block mb-1">Año de Efectividad</label>
                          <Select value={selectedMotifYear} onValueChange={setSelectedMotifYear}>
                            <SelectTrigger className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 !h-10 !min-h-10 !max-h-10 flex-shrink-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:text-slate-500 shadow-sm transition-colors">
                              <SelectValue placeholder="Seleccionar año" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="bg-white border border-slate-200 text-slate-850 max-h-60 rounded-xl shadow-xl [&_svg]:text-slate-800 w-[var(--radix-select-trigger-width)]">
                              <SelectItem value="all" className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                                Todos los años
                              </SelectItem>
                              {Object.keys(motifStatsData.by_year).sort((a, b) => b.localeCompare(a)).map(year => (
                                <SelectItem key={year} value={year} className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Motif Pie chart */}
                  <motion.div
                    key="motif-pie"
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex-1 flex flex-col gap-2"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 truncate">
                      Distribución por Motivos
                    </div>
                    <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center min-h-[224px] overflow-hidden w-full">
                      {motifStatsLoading ? (
                        <div className="flex-1 flex flex-col md:flex-row gap-6 items-center w-full animate-pulse">
                          <div className="relative shrink-0 size-[180px] rounded-full border-[22px] border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-900/50" />
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="flex items-center gap-2 py-1">
                                <span className="shrink-0 size-2.5 rounded-full bg-slate-200 dark:bg-slate-850" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-24" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-10 ml-auto" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : motifPieSlices.length > 0 ? (
                        <>
                          <div className="relative shrink-0" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                            <svg viewBox="0 0 200 200" width="180" height="180" className="drop-shadow-md">
                              {motifPieSlices.map((slice, i) => (
                                <path
                                  key={i}
                                  d={slice.d}
                                  fill={slice.color}
                                  opacity={hoveredMotifSlice === null || hoveredMotifSlice === i ? 1 : 0.35}
                                  stroke="white"
                                  strokeWidth="1.5"
                                  className="transition-all duration-200 cursor-pointer"
                                  onMouseEnter={() => setHoveredMotifSlice(i)} onPointerDown={() => setHoveredMotifSlice(i)}
                                  onMouseLeave={() => setHoveredMotifSlice(null)}
                                  onClick={() => handleMotifClick(slice.motivo_nombre)}
                                  style={hoveredMotifSlice === i ? { filter: 'brightness(1.15)', transform: 'scale(1.03)', transformOrigin: 'center' } : {}}
                                />
                              ))}
                              <circle cx="100" cy="100" r="42" fill="white" className="dark:fill-slate-900" />
                              <text x="100" y="96" textAnchor="middle" className="text-[9px]" fill="#bc955c" fontWeight="900" fontSize="11">
                                {hoveredMotifSlice !== null ? motifPieSlices[hoveredMotifSlice].pct + "%" : formatNumber(motifPieTotal)}
                              </text>
                              <text x="100" y="110" textAnchor="middle" fill="#999" fontSize="7" fontWeight="600">
                                {hoveredMotifSlice !== null ? "del total" : "motivos"}
                              </text>
                            </svg>
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-48 overflow-y-auto pr-1 w-full" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                            {motifPieSlices.map((slice, i) => (
                              <div
                                key={i}
                                onMouseEnter={() => setHoveredMotifSlice(i)} onPointerDown={() => setHoveredMotifSlice(i)}
                                onMouseLeave={() => setHoveredMotifSlice(null)}
                                onClick={() => handleMotifClick(slice.motivo_nombre)}
                                className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                                  hoveredMotifSlice === null || hoveredMotifSlice === i ? 'opacity-100' : 'opacity-40'
                                }`}
                              >
                                <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={slice.motivo_nombre}>
                                  {slice.motivo_nombre}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 shrink-0">
                                  {formatNumber(slice.total)}
                                  <span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center w-full min-h-[180px]">
                          <span className="text-xs text-slate-400 font-medium">No hay datos de motivos para esta acción en el año seleccionado</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          </div>
        </Zoom>
      </div>
      <div className="w-full flex justify-center mt-4">
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl h-fit flex flex-col z-30 overflow-hidden w-full md:max-h-[calc(100vh-var(--stack-h))] md:sticky md:bottom-0 md:scroll-mt-[var(--stack-h)]" style={{ width: cardWidth ? `${cardWidth}px` : '100%' }}>
          <div className="flex items-center gap-2 p-3 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-800/80">
            {[
              { id: "movimientos", label: "Movimientos de Personal", icon: Briefcase },
              { id: "bitacora", label: "Bitácora de Movimientos", icon: UserCheck }
            ].map((sub) => {
              const Icon = sub.icon;
              return (
                <button key={sub.id} onClick={() => { setActiveSubTab(sub.id); setPage(1); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${activeSubTab === sub.id ? "bg-[#621f32] text-white shadow-md" : "text-slate-500 hover:text-[#621f32]"}`}>
                  <Icon className="size-3.5" />
                  {sub.label}
                </button>
              );
            })}
          </div>

          <MobileTableToolbar
            searchValue={searchQuery}
            onSearch={(v) => setSearchQuery(v)}
            /* El total lo manda el servidor: `data.length` es sólo la página
               actual y hacía que el chip dijera "50" con 152 526 registros
               detrás. */
            count={count}
            primaryAction={{ icon: Download, label: "Exportar a Excel", onClick: handleOpenExportClick, loading: isExportingExcel, disabled: data.length === 0 }}
            actions={[
              // El orden vive en los encabezados de `DataTable` (oculta en móvil).
              { icon: ArrowUpDown, label: "Ordenar", onClick: () => setIsSortDrawerOpen(true) },
              // Idem: el embudo por columna sólo existía en el encabezado.
              { icon: ListFilter, label: "Filtrar por columna", onClick: () => setIsColumnPickerOpen(true), badge: Object.keys(columnFilters).length + Object.values(textFilters).filter(f => f?.value).length },
              { icon: RotateCcw, label: "Restablecer filtros", onClick: () => { setTextFilters({}); setColumnFilters({}); setSortConfig({ key: null, direction: null }); setSearchQuery(""); resetAdvancedFilters(); } },
              { icon: Filter, label: "Filtros avanzados", onClick: () => setIsAdvancedFiltersOpen(true), badge: appliedAdvancedFilters.length },
              { icon: Columns, label: "Columnas", onClick: () => setIsColumnsModalOpen(true) },
            ]}
          />

          {/* Paginación de servidor en móvil: sin esto sólo era alcanzable la
              primera página (ver MobileServerPager). */}
          <MobileServerPager
            page={page}
            totalPages={totalPages}
            count={count}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={setPageSize}
            loading={loading}
          />

          {activeSubTab === "bitacora" && (
            <div className="md:hidden flex items-center gap-2 px-4 pb-3 -mt-1 bg-slate-50/40 dark:bg-slate-900/20">
              <BitacoraDateSelector
                distinctDates={distinctDates}
                selectedDates={bitacoraDates}
                onChange={setBitacoraDates}
                triggerClassName="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm active:scale-[0.98] transition-transform"
              />
              <button
                onClick={() => { setBitacoraDates([getTodayString()]); setTextFilters({}); setColumnFilters({}); }}
                className="shrink-0 px-3.5 py-3 bg-[#621f32]/10 text-[#621f32] active:bg-[#621f32]/20 dark:bg-[#bc955c]/10 dark:text-[#bc955c] dark:active:bg-[#bc955c]/20 text-[9px] font-black uppercase tracking-wider rounded-2xl transition-colors"
              >
                Hoy
              </button>
            </div>
          )}

          <MobileColumnPickerDrawer

            open={isColumnPickerOpen}

            onOpenChange={setIsColumnPickerOpen}

            columns={columns}

            columnFilters={columnFilters}

            textFilters={textFilters}

            onPick={openFilterDropdown}

          />


          <MobileSortDrawer
            open={isSortDrawerOpen}
            onOpenChange={setIsSortDrawerOpen}
            columns={columns}
            sortConfig={sortConfig}
            onSort={setSortConfig}
          />

          <div className="hidden md:flex p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
              {activeSubTab === "bitacora" ? (
                <div className="flex items-center gap-2">
                  <BitacoraDateSelector distinctDates={distinctDates} selectedDates={bitacoraDates} onChange={setBitacoraDates} />
                  <button onClick={() => { setBitacoraDates([getTodayString()]); setTextFilters({}); setColumnFilters({}); }} className="px-3 py-2 bg-[#621f32]/10 text-[#621f32] hover:bg-[#621f32]/20 dark:bg-[#bc955c]/10 dark:text-[#bc955c] dark:hover:bg-[#bc955c]/20 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors">
                    Movimientos de hoy
                  </button>
                </div>
              ) : (
                <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Buscar..." 
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold w-full outline-none" 
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-655 ml-1.5 mr-1">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              
              <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                <span className="text-[9px] font-black uppercase text-slate-500 leading-none mb-1">Registros</span>
                <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none">
                  {formatNumber(count)}
                </span>
              </div>

              <div className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-200/30 dark:border-slate-800/30">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-[10px] text-slate-400 font-bold uppercase select-none">Mostrar:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-2 py-1 min-h-11 md:min-h-0 rounded-xl font-bold outline-none text-[#621f32] dark:text-[#bc955c] text-[11px] cursor-pointer"
                  >
                    {[25, 50, 100, 200].map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-1">
                  {/* 7.12 QA: paginación server-side sólo tenía ‹ › — se agregan
                      primera/última página y un campo para saltar a la página N. */}
                  <button onClick={() => setPage(1)} disabled={page === 1 || loading} title="Primera página" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronsLeft className="size-3.5" />
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} title="Página anterior" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[10px] font-black uppercase text-slate-550 dark:text-slate-400 select-none whitespace-nowrap flex items-center gap-1">
                    Pág.
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n) && n >= 1 && n <= totalPages) setPage(n);
                      }}
                      disabled={loading}
                      className="w-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-center text-[#621f32] dark:text-[#bc955c] font-black outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    de <span className="text-[#621f32] dark:text-[#bc955c]">{totalPages}</span>
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} title="Página siguiente" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages || loading} title="Última página" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronsRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:text-[#621f32] dark:hover:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer">
                <Columns className="size-3.5" />
                <span className="hidden sm:inline">Columnas</span>
              </button>
              <button
                onClick={() => {
                  setTextFilters({});
                  setColumnFilters({});
                  setSortConfig({ key: null, direction: null });
                  setSearchQuery("");
                  resetAdvancedFilters();
                }}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:text-[#621f32] dark:hover:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Restablecer"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <AdvancedFiltersButton onClick={() => setIsAdvancedFiltersOpen(true)} appliedCount={appliedAdvancedFilters.length} />
              <button onClick={handleOpenExportClick} disabled={isExportingExcel || data.length === 0} className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 disabled:opacity-75 disabled:pointer-events-none">
                {isExportingExcel ? (
                  <div className="size-3.5 border-2 border-white/20 border-t-white dark:border-[#3e131f]/20 dark:border-t-[#3e131f] rounded-full animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>{isExportingExcel ? "Exportando..." : "Excel"}</span>
              </button>
            </div>
          </div>
          
          <div className="hidden md:block absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />

            {/* Tabla densa: sólo desktop */}
            <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
            <DataTable
            containerRef={tbodyRef}
            onScroll={() => {}}
            columns={columns}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            activeConditionDropdown={activeConditionDropdown}
            setActiveConditionDropdown={setActiveConditionDropdown}
            selectedCell={selectedCell}
            onSelectCell={noop}
            onRowClick={noop}
            isRowSelected={(idx) => selectedCell?.rowIdx === (page - 1) * pageSize + idx}
            isCellSelected={(idx, colIdx) => selectedCell?.rowIdx === (page - 1) * pageSize + idx && selectedCell?.colIdx === colIdx}
            isColSelected={(idx) => selectedCell?.colIdx === idx}
            onCellContextMenu={handleCellContextMenu}
            onShowRecord={setSelectedRowData}
            sortConfig={sortConfig}
            onSort={handleRequestSort}
            onOpenFilter={openFilterDropdown}
            onResizeStart={handleMouseDown}
            getColumnLetter={getColumnLetter}
            isMonoColumn={isMonoColumn}
            isPending={false}
            isLoading={loading}
            loadingVariant="skeleton"
            rowNumberOffset={(page - 1) * pageSize}
            data={data}
            startIndex={0}
            endIndex={data.length}
            totalCount={data.length}
            rowHeight={37}
            renderCell={renderCell}
          />
            </div>

            {/* Vista de tarjetas: sólo móvil */}
            <div className="md:hidden">
              <MobileCardList
                data={data}
                config={{
                  // `sec` no es único por posición (varias filas de fechas
                  // distintas comparten sec=0) — usar el id real (PK) evita
                  // colisiones de key de React que duplican/omiten tarjetas.
                  getRowId: (r, i) => r.id ?? `${r.posicion ?? ""}-${r.sec ?? i}-${i}`,
                  getTitle: (r) => [r.nombre, r.ap_pat, r.ap_mat].filter(Boolean).join(" ").trim() || "Sin nombre",
                  getSubtitle: (r) => (r.posicion ? `POS ${r.posicion}` : (r.num_empleado ? `Emp ${r.num_empleado}` : "")),
                  renderBadge: (r) => (r.accion_nombre ? <span className="inline-flex items-center px-2 py-1 rounded-md border text-[9px] font-black uppercase bg-[#621f32]/8 text-[#621f32] border-[#621f32]/20 max-w-[120px] truncate">{r.accion_nombre}</span> : null),
                  fields: [
                    { key: "num_empleado", label: "No. Empleado", mono: true },
                    { key: "motivo_nombre", label: "Motivo" },
                    { key: "fecha_efectiva", label: "F. Efectiva" },
                    { key: "fecha_captura", label: "F. Captura" },
                    { key: "un_admin", label: "Unidad Admin" },
                    { key: "sec", label: "Sec", mono: true },
                  ],
                }}
                onCardClick={(row) => setSelectedRowData(row)}
                isLoading={loading}
                isPending={false}
                /* `data` ya es UNA página del servidor: se muestra entera para
                   que la única navegación sea la de MobileServerPager (dos
                   paginadores encadenados confundían de dónde venía cada
                   "página"). */
                pageSize={pageSize}
              />
            </div>

      </div>
    </div>

      {/* Columns Select Modal */}
            <ColumnsModal
        open={isColumnsModalOpen}
        columns={columns}
        onToggle={toggleColumnVisibility}
        onShowAll={() => setColumns(prev => prev.map(c => ({ ...c, visible: true })))}
        onHideAll={() => setColumns(prev => prev.map(c => ({ ...c, visible: false })))}
        onClose={() => setIsColumnsModalOpen(false)}
      />

      <AdvancedFiltersModal
        open={isAdvancedFiltersOpen}
        onClose={() => setIsAdvancedFiltersOpen(false)}
        mounted={mounted}
        columns={columns}
        conditions={advancedConditions}
        onAddCondition={addAdvancedCondition}
        onRemoveCondition={removeAdvancedCondition}
        onUpdateCondition={updateAdvancedCondition}
        onApply={applyAdvancedFilters}
        isDateColumn={isDateColumn}
        isNumericColumn={isNumericColumn}
        fetchSuggestions={fetchAdvValueSuggestions}
      />

      {/* Dropdown de Filtro por Valores Únicos */}
      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={columns.find(c => c.key === activeFilterDropdown)?.label}
            isDate={isDateColumn(activeFilterDropdown)}
            data={data}
            filters={filters}
            dropdownValues={movPersonalDropdownValues}
            dateHierarchy={dateHierarchies[activeFilterDropdown]}
            dateValues={(mergedColumnValues[activeFilterDropdown] || []).map(i => i.value)}
            reachableValues={reachableValues}
            loadingValues={loadingUniqueValues}
            onDateSelection={(type, value, parentPath) => handleDateSelection(activeFilterDropdown, type, value, parentPath)}
            onToggleDateNode={(path) => setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }))}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

      {/* Cell Detail Modal */}
      <CeldaValorModal
        open={isCellModalOpen && !!selectedCell}
        onClose={() => setIsCellModalOpen(false)}
        columnLabel={selectedCell?.colName}
        cellRef={selectedCell ? `${getColumnLetter(selectedCell.colIdx)}${selectedCell.rowIdx + 1}` : ""}
        value={selectedCell?.value}
      />

      {/* PIE CHART TOOLTIP */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {(hoveredSlice !== null && pieSlices[hoveredSlice]) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{ top: pieTooltipPos.y - 60, left: pieTooltipPos.x + 15 }}
              className="fixed z-[10000] pointer-events-none bg-slate-900/95 dark:bg-slate-950 backdrop-blur-md border border-slate-700 shadow-2xl rounded-xl p-3 flex flex-col gap-1 min-w-[160px]"
            >
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full shadow-sm" style={{ backgroundColor: pieSlices[hoveredSlice].color }} />
                <span className="text-[11px] font-black uppercase text-white truncate max-w-[200px]">
                  {pieSlices[hoveredSlice].accion_nombre}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400 font-semibold">Total</span>
                <span className="text-xs font-black text-[#bc955c]">{formatNumber(pieSlices[hoveredSlice].total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold">Porcentaje</span>
                <span className="text-[11px] font-black text-slate-200">{pieSlices[hoveredSlice].pct}%</span>
              </div>
            </motion.div>
          )}
          {(hoveredMotifSlice !== null && motifPieSlices[hoveredMotifSlice]) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{ top: pieTooltipPos.y - 60, left: pieTooltipPos.x + 15 }}
              className="fixed z-[10000] pointer-events-none bg-slate-900/95 dark:bg-slate-950 backdrop-blur-md border border-slate-700 shadow-2xl rounded-xl p-3 flex flex-col gap-1 min-w-[160px]"
            >
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full shadow-sm" style={{ backgroundColor: motifPieSlices[hoveredMotifSlice].color }} />
                <span className="text-[11px] font-black uppercase text-white truncate max-w-[200px]">
                  {motifPieSlices[hoveredMotifSlice].motivo_nombre}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400 font-semibold">Total</span>
                <span className="text-xs font-black text-[#bc955c]">{formatNumber(motifPieSlices[hoveredMotifSlice].total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold">Porcentaje</span>
                <span className="text-[11px] font-black text-slate-200">{motifPieSlices[hoveredMotifSlice].pct}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />
      <AnimatePresence>
        {selectedRowData && (() => {
          const mappedEmployee = {
            ...selectedRowData,
            id_empleado: selectedRowData.num_empleado,
            nombres: selectedRowData.nombre_completo,
            nivel: selectedRowData.nv_jerarquico || selectedRowData.grado,
          };
          return (
            <EmployeeRecordModal
              isOpen={!!selectedRowData}
              onClose={() => setSelectedRowData(null)}
              record={mappedEmployee}
              columns={columns}
              canViewPhoto={canViewFotoMovimientos}
            />
          );
        })()}
      </AnimatePresence>



      <EmpleadoTimelineModal
        open={timelineModalOpen}
        onOpenChange={setTimelineModalOpen}
        numEmpleado={selectedNumEmpleado}
      />
      
      <PosicionTimelineModal
        open={posicionTimelineModalOpen}
        onOpenChange={setPosicionTimelineModalOpen}
        posicion={selectedPosicion}
      />

      <ExportConFotosModal
        open={isExportFotosModalOpen}
        onClose={() => setIsExportFotosModalOpen(false)}
        onConfirm={handleConfirmExportConFotos}
        isExporting={isExportingConFotos}
        onCancelExport={handleCancelExportConFotos}
        rowCount={count}
      />
    </div>
  );
}



