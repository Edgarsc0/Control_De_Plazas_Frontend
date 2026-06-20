"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Download, Columns, ChevronLeft, 
  ChevronRight as ChevronRightIcon, ChevronDown, 
  X, Check, RotateCcw, Filter, ArrowUpDown, Briefcase
, UserCheck, Eye, BarChart, ArrowLeft, ChevronRight, PieChart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";
import EmpleadoTimelineModal from "../../modals/EmpleadoTimelineModal";
import PosicionTimelineModal from "../../modals/PosicionTimelineModal";
import { EmployeeRecordModal } from "../../shared/EmployeesModal";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection } from "../../../_hooks/useCellSelection";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATE_KEYS = ["fecha_efectiva", "fecha_captura", "salida_prevista", "fecha_ult_actz", "ult_inicio", "fecha_inicial", "fecha_entrada", "fecha_posicion"];
const isDateColumn = (key) => DATE_KEYS.includes(key);
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const MOTIVOS_COUNT_MAP = {
  "Baja": 18,
  "Cambio Organizacional": 12,
  "Recontratación": 6,
  "Cambio Posición": 5,
  "Reclutamiento Interno": 5,
  "Suspensión": 4,
  "Contratación": 3,
  "Cambio Remuneración": 2,
  "Continuidad": 2,
  "Incorporación Temporal por Mandato": 1,
  "Licencia Médica S/Sueldo": 1,
  "Licencia Pre-Jubilatoria": 1,
  "Licencia s/Goce de Sueldo": 1,
  "Reincorp Licencia Médica": 1,
  "Reincorp Suspensión": 1,
  "Reincorporación Licencia s/Goce de Sueldo": 1
};

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


const BitacoraDateSelector = ({ distinctDates, selectedDates, onChange }) => {
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

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm hover:border-[#621f32]/50 transition-colors">
        <span className="text-[10px] text-slate-400 font-bold uppercase">Bitácora:</span>
        <span className="font-bold text-xs text-[#621f32] dark:text-[#bc955c] truncate max-w-[200px]">
          {selectedDates.length === 0 ? "Ninguna" : selectedDates.length === 1 ? selectedDates[0] : `${selectedDates.length} fechas`}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
              <h3 className="font-black text-[#621f32] dark:text-[#bc955c] uppercase tracking-wider text-sm">Seleccionar Fechas</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <X className="size-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-2">
               <button onClick={() => onChange(distinctDates.map(d=>d.value))} className="text-[10px] font-bold text-[#621f32] dark:text-[#bc955c] px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Seleccionar Todo</button>
               <button onClick={() => onChange([])} className="text-[10px] font-bold text-slate-500 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Desmarcar Todo</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {Object.keys(hierarchy).sort((a,b)=>b.localeCompare(a)).map(year => (
                <div key={year} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950/50 cursor-pointer" onClick={() => setExpandedYears(p => ({...p, [year]: !p[year]}))}>
                    <div className="flex items-center gap-2">
                      {expandedYears[year] ? <ChevronDown className="size-4 text-slate-500"/> : <ChevronRight className="size-4 text-slate-500"/>}
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{year} <span className="text-xs text-slate-400">({hierarchy[year].count})</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); selectYear(year, true); }} className="text-[9px] font-bold text-emerald-600 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">Todo</button>
                      <button onClick={(e) => { e.stopPropagation(); selectYear(year, false); }} className="text-[9px] font-bold text-rose-600 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">Nada</button>
                    </div>
                  </div>
                  
                  {expandedYears[year] && (
                    <div className="p-2 flex flex-col gap-2 bg-white dark:bg-slate-900">
                      {Object.keys(hierarchy[year].months).sort((a,b)=>b.localeCompare(a)).map(month => {
                        const mKey = `${year}-${month}`;
                        return (
                          <div key={mKey} className="ml-4 border-l-2 border-slate-100 dark:border-slate-800 pl-2">
                            <div className="flex items-center justify-between cursor-pointer py-1" onClick={() => setExpandedMonths(p => ({...p, [mKey]: !p[mKey]}))}>
                              <div className="flex items-center gap-2">
                                {expandedMonths[mKey] ? <ChevronDown className="size-3 text-slate-400"/> : <ChevronRight className="size-3 text-slate-400"/>}
                                <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Mes {month} <span className="text-[10px] text-slate-400">({hierarchy[year].months[month].count})</span></span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); selectMonth(year, month, true); }} className="text-[8px] font-bold text-emerald-600 px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Todo</button>
                                <button onClick={(e) => { e.stopPropagation(); selectMonth(year, month, false); }} className="text-[8px] font-bold text-rose-600 px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Nada</button>
                              </div>
                            </div>
                            
                            {expandedMonths[mKey] && (
                              <div className="ml-5 mt-1 flex flex-wrap gap-2">
                                {hierarchy[year].months[month].days.map(d => (
                                  <button
                                    key={d.fullDate}
                                    onClick={() => toggleDate(d.fullDate)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${isSelected(d.fullDate) ? "bg-[#621f32] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                                  >
                                    {d.day} <span className="opacity-75">({d.count})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
              <button onClick={() => setIsOpen(false)} className="px-6 py-2 bg-[#621f32] hover:bg-[#802842] dark:bg-[#bc955c] dark:hover:bg-[#d0ab75] text-white dark:text-[#3e131f] font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-md">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function MovimientosPersonalTab({ isPending, startTransition, cardRef }) {
  const [mounted, setMounted] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [data, setData] = useState([]);
  const tbodyRef = useRef(null);
  const bitacoraDateInputRef = useRef(null);

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "fecha_efectiva,fecha_captura", direction: "desc" });
  const { selectedCell, setSelectedCell, isCellModalOpen, setIsCellModalOpen, selectedRowData, setSelectedRowData, contextMenu, setContextMenu } = useCellSelection();
  const arrowRepeatRef = useRef(0);

  // Subtab State
  const [activeSubTab, setActiveSubTab] = useState("movimientos"); // "movimientos" or "bitacora"
  
  // Bitacora Date Selector State
  const [distinctDates, setDistinctDates] = useState([]);
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
    setStatsLoading(true);
    const params = {};
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }
    VacantesService.getMovimientosPersonalStats(params)
      .then((res) => res.json())
      .then((resData) => {
        if (resData && (resData.by_year || resData.all)) {
          setStatsData(resData);
        }
      })
      .catch((err) => console.error("Error fetching movements stats:", err))
      .finally(() => setStatsLoading(false));
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
      });
  }, []);

  const [columnSearchText, setColumnSearchText] = useState("");
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    filterDropdownTab, setFilterDropdownTab,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    expandedDateNodes, setExpandedDateNodes,
    debouncedFilterSearchText,
  } = useColumnFilters();
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
    setMotifStatsLoading(true);
    const params = { accion_nombre: selectedActionName };
    if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
      params.fecha_captura__in = bitacoraDates.join(",");
    }
    VacantesService.getMovimientosPersonalStats(params)
      .then(res => res.json())
      .then(resData => {
        if (resData && (resData.by_year || resData.all)) {
          setMotifStatsData(resData);
        }
      })
      .catch(err => console.error("Error fetching motif stats:", err))
      .finally(() => setMotifStatsLoading(false));
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
  const [uniqueColumnValues, setUniqueColumnValues] = useState({});
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
    { key: "nombre", label: "Nombre", width: 150, visible: true, isBasic: true },
    { key: "ap_pat", label: "Ap. Paterno", width: 150, visible: true, isBasic: true },
    { key: "ap_mat", label: "Ap. Materno", width: 150, visible: true, isBasic: true },
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
  ]);

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

    VacantesService.getMovimientosPersonal(params)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData.results || []);
        setCount(resData.count || 0);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeSubTab, bitacoraDates, page, pageSize, debouncedSearch, debouncedTextFilters, columnFilters, sortConfig, selectedYear, selectedMotifYear, selectedActionName]);

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

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
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

      const res = await VacantesService.getMovimientosPersonal(params);
      const allData = await res.json();

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(activeSubTab === "bitacora" ? `Bitácora ${bitacoraDates.length === 0 ? "Ninguno" : bitacoraDates.length === 1 ? bitacoraDates[0] : `${bitacoraDates.length} fechas`}` : "Movimientos de Personal");

      const visibleCols = columns.filter((c) => c.visible);
      worksheet.columns = visibleCols.map((c) => ({
        header: c.label,
        key: c.key,
        width: 15,
      }));

      allData.forEach((row) => {
        const rowData = {};
        visibleCols.forEach((c) => {
          rowData[c.key] = row[c.key];
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

      const headerRow = worksheet.getRow(1);
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
        column.eachCell({ includeEmpty: true }, (cell) => {
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
    setPage(1);
  };

  const isDateColumn = (key) => ["fecha_efectiva", "fecha_captura", "fecha_ult_actz", "fecha_inicial", "fecha_entrada", "fecha_posicion"].includes(key);

  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const parseDateParts = useCallback((val) => {
    if (!val || String(val).trim() === "") return null;
    let valStr = String(val).trim().split('T')[0];
    const parts = valStr.split(/[-/]/);
    let d;
    if (parts.length === 3) {
      if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]);
      else d = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      d = new Date(val);
    }
    
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear().toString(),
      month: (d.getMonth() + 1).toString().padStart(2, '0'),
      day: d.getDate().toString().padStart(2, '0'),
      monthName: MONTH_NAMES[d.getMonth()]
    };
  }, []);

  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    if (!activeFilterDropdown || !isDateColumn(activeFilterDropdown)) return hierarchies;

    const valuesList = uniqueColumnValues[activeFilterDropdown] || [];
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
  }, [uniqueColumnValues, activeFilterDropdown, parseDateParts]);

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
    const valuesList = uniqueColumnValues[colKey] || [];
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

    const uniqueTargetValues = [...new Set(targetRawValues)];
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
    setFilterDropdownTab('todos');
    setFilterSearchText("");
    setHasInitializedTemp(false);
    setTempSelectedValues(columnFilters[colKey] || []);
  };

  useEffect(() => {
    if (!activeFilterDropdown) return;
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
      distinct_search: debouncedFilterSearchText,
    };

    if (filterDropdownTab === 'actuales') {
      Object.assign(params, {
        search: debouncedSearch,
        ...filterParams,
        ...colParams
      });
      if (yearFilter && activeSubTab !== "bitacora") {
        params.fecha_efectiva__year = yearFilter;
      }
      if (selectedActionName) {
        params.accion_nombre = selectedActionName;
      }
      if (activeSubTab === "bitacora" && bitacoraDates.length > 0) {
        params.fecha_captura__in = bitacoraDates.join(",");
      }
    }

    VacantesService.getMovimientosPersonal(params)
      .then((res) => res.json())
      .then((resData) => {
        const valuesList = Array.isArray(resData) ? resData : [];
        setUniqueColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
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
      .catch((err) => console.error("Error al obtener valores únicos:", err))
      .finally(() => setLoadingUniqueValues(false));
  }, [activeFilterDropdown, debouncedFilterSearchText, debouncedSearch, debouncedTextFilters, columnFilters, selectedActionName, selectedMotifYear, selectedYear, filterDropdownTab, activeSubTab, bitacoraDates]);

  const applyColumnFilter = (colKey) => {
    let newFilters = { ...columnFilters };
    if (tempSelectedValues.length === 0) {
      delete newFilters[colKey];
    } else {
      newFilters[colKey] = tempSelectedValues;
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
            {/* Tabs Toggle (Moved here) */}
            <div className="flex items-center gap-2 self-start bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm relative z-10 shadow-sm ml-1">
              <button
                onClick={() => setStatsViewMode("pie")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statsViewMode === "pie" ? "bg-white dark:bg-slate-800 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                Distribución (Pie)
              </button>
              <button
                onClick={() => setStatsViewMode("bar")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${statsViewMode === "bar" ? "bg-white dark:bg-slate-800 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                En el tiempo (Barras)
              </button>
            </div>

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
                        onMouseEnter={() => setHoveredSlice(i)}
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
                      onMouseEnter={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => handleActionClick(slice.accion_nombre)}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                        hoveredSlice === null || hoveredSlice === i ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={`${slice.accion_nombre} (con ${MOTIVOS_COUNT_MAP[slice.accion_nombre] || 0} motivos diferentes)`}>
                        {slice.accion_nombre} <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500"> (con {MOTIVOS_COUNT_MAP[slice.accion_nombre] || 0} motivos diferentes)</span>
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
                {temporalChartData.length === 0 ? (
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

                    <div className="absolute top-4 right-5 flex flex-col items-end">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total en el periodo</span>
                      <span className="text-xl font-black text-[#621f32] dark:text-[#bc955c] leading-none">
                        {formatNumber(temporalChartData.reduce((acc, curr) => acc + curr.total, 0))}
                      </span>
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
                                  onMouseEnter={() => setHoveredMotifSlice(i)}
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
                                onMouseEnter={() => setHoveredMotifSlice(i)}
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
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl max-h-[calc(100vh-144px)] h-fit flex flex-col sticky bottom-0 z-30 overflow-hidden w-full scroll-mt-36" style={{ width: cardWidth ? `${cardWidth}px` : '100%' }}>
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

          <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
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
                <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
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
                    className="bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 px-2 py-1 rounded-xl font-bold outline-none text-[#621f32] dark:text-[#bc955c] text-[11px] cursor-pointer"
                  >
                    {[25, 50, 100, 200].map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[10px] font-black uppercase text-slate-550 dark:text-slate-400 select-none whitespace-nowrap">
                    Pág. <span className="text-[#621f32] dark:text-[#bc955c]">{page}</span> de <span className="text-[#621f32] dark:text-[#bc955c]">{totalPages}</span>
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
                    <ChevronRightIcon className="size-3.5" />
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
                }} 
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:text-[#621f32] dark:hover:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Restablecer"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button onClick={handleExportExcel} disabled={isExportingExcel || data.length === 0} className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 disabled:opacity-75 disabled:pointer-events-none">
                {isExportingExcel ? (
                  <div className="size-3.5 border-2 border-white/20 border-t-white dark:border-[#3e131f]/20 dark:border-t-[#3e131f] rounded-full animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>{isExportingExcel ? "Exportando..." : "Excel"}</span>
              </button>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />

            {/* Shared Scrollable Table Area */}
            <div 
              ref={tbodyRef}
              className="overflow-auto relative flex-1 mx-2 lg:mx-6 mb-4 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner" 
              style={{ height: '70vh', minHeight: '500px' }}
            >
                <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 95 + columns.filter(c => c.visible).reduce((sum, col) => sum + col.width, 0) }}>
                  <colgroup>
                    <col style={{ width: 50 }} />
                    <col style={{ width: 45 }} />
                    {columns.filter(c => c.visible).map(col => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                  </colgroup>
                  <thead className="bg-[#501929] dark:bg-[#3e131f] text-white sticky top-0 z-30 shadow-md">
                    <tr>
                      <th className="sticky left-0 top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35">#</th>
                      <th className="sticky left-[50px] top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35 px-1">
                        <span className="text-[9px] font-bold text-slate-300">VER</span>
                      </th>
                      {columns.filter(c => c.visible).map((col, index, arr) => {
                        const isSticky = index < 2;
                        let leftOffset = 95;
                        if (index === 1) leftOffset = 95 + arr[0].width;
                        
                        const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
                        const bgClass = selectedCell?.colName === col.label 
                          ? "bg-[#621f32] text-white" 
                          : (hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : "bg-[#501929] text-slate-200");
                        
                        return (
                          <th 
                            key={col.key} 
                            style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}}
                            className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${bgClass} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}
                          >
                            {hasFilter && (
                              <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />
                            )}
                            <div className="flex flex-col items-center gap-1 w-full">
                              <span className={`text-[9px] font-mono ${hasFilter ? 'text-[#3e131f]/70' : 'text-[#bc955c]'}`}>
                                {getColumnLetter(index)}
                              </span>
                              <div className="flex items-center justify-between w-full">
                                <div onClick={() => handleRequestSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5">
                                  <span>{col.label}</span>
                                  <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key || (col.key === "fecha_efectiva" && sortConfig.key === "fecha_efectiva,fecha_captura") ? "opacity-100" : "opacity-0"}`} />
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openFilterDropdown(col.key); }} 
                                  className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}
                                >
                                  <Filter className="size-3 fill-current" />
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    
                <tr className="bg-[#40121e] dark:bg-[#2b0d15]">
                  <th className="sticky left-0 z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35">
                    <button 
                      onClick={() => setTextFilters({})}
                      disabled={!mounted || (Object.keys(textFilters).length === 0 || Object.values(textFilters).every(v => !v || !v.value))}
                      title="Limpiar filtros de columna"
                      className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </th>
                  <th className="sticky left-[50px] z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35"></th>
                  {columns.filter(c => c.visible).map((col, colIdx, arr) => {
                    const filterObj = textFilters[col.key] || { value: "", condition: isMonoColumn(col.key) ? "starts_with" : "contains" };
                    const condition = filterObj.condition || (isMonoColumn(col.key) ? "starts_with" : "contains");
                    const isSticky = colIdx < 2;
                    let leftOffset = 95;
                    if (colIdx === 1) leftOffset = 95 + arr[0].width;
                    
                    const conditionShorthands = {
                      contains: "*",
                      not_contains: "!*",
                      starts_with: "^",
                      not_starts_with: "!^",
                      ends_with: "$",
                      not_ends_with: "!$",
                      equals: "=",
                      not_equals: "!="
                    };
                    const symbol = conditionShorthands[condition] || "*";

                    return (
                      <th key={`filter-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`p-1.5 border-r border-[#621f32]/30 relative ${isSticky ? 'bg-[#40121e] dark:bg-[#2b0d15] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                        <div className="relative flex items-center w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveConditionDropdown(activeConditionDropdown === col.key ? null : col.key);
                            }}
                            title={`Condición: ${getConditionLabel(condition)}`}
                            className="absolute left-1.5 z-10 size-4 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 rounded text-white text-[8px] font-black cursor-pointer select-none transition-colors"
                          >
                            {symbol}
                          </button>
                          <input
                            type="text"
                            value={filterObj.value || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTextFilters(prev => {
                                const next = { ...prev };
                                if (val === "") {
                                  delete next[col.key];
                                } else {
                                  next[col.key] = {
                                    value: val,
                                    condition: condition
                                  };
                                }
                                return next;
                              });
                            }}
                            placeholder="Filtrar..."
                            className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-white text-[9px] font-bold placeholder-white/30 rounded-md py-1.5 pl-7 pr-2 outline-none transition-all border border-white/5 focus:border-[#bc955c]/50"
                          />
                          {activeConditionDropdown === col.key && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveConditionDropdown(null);
                                }}
                              />
                              <div className="absolute top-full left-0 mt-1 z-50 w-36 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-left text-slate-200">
                                {[
                                  { key: "contains", label: "Contiene (*)" },
                                  { key: "not_contains", label: "No contiene (!*)" },
                                  { key: "starts_with", label: "Comienza con (^)" },
                                  { key: "not_starts_with", label: "No comienza con (!^)" },
                                  { key: "ends_with", label: "Termina con ($)" },
                                  { key: "not_ends_with", label: "No termina con (!$)" },
                                  { key: "equals", label: "Es igual a (=)" },
                                  { key: "not_equals", label: "Diferente de (!=)" }
                                ].map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTextFilters(prev => ({
                                        ...prev,
                                        [col.key]: {
                                          value: filterObj.value,
                                          condition: item.key
                                        }
                                      }));
                                      setActiveConditionDropdown(null);
                                    }}
                                    className={`px-2 py-1 text-[9px] font-bold rounded-lg text-left transition-colors cursor-pointer w-full flex items-center justify-between ${condition === item.key ? "bg-[#bc955c] text-slate-950" : "hover:bg-white/10"}`}
                                  >
                                    <span>{item.label}</span>
                                    {condition === item.key && <Check className="size-2.5" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-355 bg-white/20 dark:bg-slate-900/10">
                    {loading ? (
                      [...Array(15)].map((_, rowIdx) => (
                        <tr key={`skeleton-${rowIdx}`} className="h-[37px] animate-pulse">
                          <td className="sticky left-0 bg-[#f0e4e6] dark:bg-[#3e131f] z-20 text-center border-r h-[37px] px-4"><div className="h-3 w-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                          <td className="sticky left-[50px] bg-[#f0e4e6] dark:bg-[#3e131f] z-20 text-center border-r h-[37px] px-2"><div className="h-4 w-5 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                          {columns.filter(c => c.visible).map((col, colIdx, arr) => {
                            const isSticky = colIdx < 2;
                            let leftOffset = 95;
                            if (colIdx === 1) leftOffset = 95 + arr[0].width;
                            return (
                              <td key={`sk-${rowIdx}-${colIdx}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {}} className={`px-4 border-r align-middle ${isSticky ? 'bg-[#f0e4e6] dark:bg-[#3e131f]' : 'bg-white/5'}`}>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6 animate-pulse" />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={2 + columns.filter(c => c.visible).length} className="py-40 bg-white/40 dark:bg-slate-900/40">
                          <div className="flex flex-col items-center justify-center">
                            <div className="size-16 bg-gray-100 dark:bg-slate-850 rounded-full flex items-center justify-center mb-4 shadow-inner">
                              <Search className="size-8 text-gray-400" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350">No se encontraron resultados</h4>
                            <p className="text-xs text-slate-500 mt-1">Intenta con otros filtros de búsqueda</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.map((row, rowIdx) => {
                        const globalIdx = (page - 1) * pageSize + rowIdx + 1;
                        const isSelectedRow = selectedCell?.rowIdx === ((page - 1) * pageSize + rowIdx);
                        const rowBg = isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "hover:bg-[#621f32]/[0.015] dark:hover:bg-[#bc955c]/[0.015]";
                        
                        return (
                          <tr 
                            key={`row-${rowIdx}`} 
                            className={`h-[37px] transition-colors cursor-pointer ${rowBg}`}
                          >
                            <td 
                              className={`sticky left-0 z-20 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle text-slate-400 ${isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "bg-white dark:bg-slate-950"}`}
                              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row }); }}
                            >
                              {globalIdx}
                            </td>
                            <td 
                              className={`sticky left-[50px] z-20 text-center border-r h-[37px] px-1 align-middle ${isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "bg-white dark:bg-slate-950"}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeSubTab === "movimientos") {
                                    setSelectedRowData(row);
                                  } else {
                                    // Set some state for bitacora if needed, or share the same state
                                    setSelectedRowData(row);
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-[#621f32] text-slate-400 hover:text-white dark:bg-slate-800 dark:hover:bg-[#bc955c] dark:text-slate-500 dark:hover:text-[#3e131f] rounded-md transition-all group"
                                title="Ver registro completo"
                              >
                                <Eye className="size-3" />
                              </button>
                            </td>
                            {columns.filter(c => c.visible).map((col, colIdx, arr) => {
                              const isSticky = colIdx < 2;
                              let leftOffset = 95;
                              if (colIdx === 1) leftOffset = 95 + arr[0].width;
                              
                              let val = row[col.key];
                              if (val === null || val === undefined) val = "";
                              
                              if (col.key === "fecha_ult_actz" && val) {
                                try {
                                  const dateObj = new Date(val);
                                  if (!isNaN(dateObj.getTime())) {
                                    val = dateObj.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
                                  }
                                } catch(e){}
                              } else if (["sal_base", "smb", "smn", "sueldo_bruto", "sueldo_neto"].includes(col.key) && val) {
                                val = `$${formatNumber(val)}`;
                              }
                              
                              const isSelectedCell = isSelectedRow && selectedCell?.colIdx === colIdx;
                              let cellClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelectedCell ? "ring-2 ring-inset ring-[#621f32] dark:ring-[#bc955c] bg-white dark:bg-slate-950 font-black text-[#621f32] dark:text-[#bc955c] shadow-lg relative z-[25]" : "font-semibold"}`;
                              
                              if (isSticky) {
                                cellClass += isSelectedRow ? " bg-[#f0e4e6] dark:bg-[#621f32]/20" : " bg-white/95 dark:bg-slate-900/95";
                              }

                              if (col.key === "posicion" || col.key === "num_empleado") {
                                cellClass += " font-mono font-bold hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer";
                              } else if (col.key === "accion_nombre" && val && val.toLowerCase().includes("baja")) {
                                cellClass += " text-red-600 dark:text-red-400";
                              } else if (col.key === "motivo_nombre" && val && val.toLowerCase().includes("baja")) {
                                cellClass += " text-red-600 dark:text-red-400";
                              }

                              return (
                                <td 
                                  key={col.key} 
                                  style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: isSelectedCell ? 25 : 20 } : {}}
                                  className={cellClass}
                                  onClick={(e) => {
                                    if (col.key === "posicion" && val) {
                                      e.stopPropagation();
                                      setSelectedPosicion(val);
                                      setPosicionTimelineModalOpen(true);
                                    } else if (col.key === "num_empleado" && val) {
                                      e.stopPropagation();
                                      setSelectedNumEmpleado(val);
                                      setTimelineModalOpen(true);
                                    } else {
                                      const minRowIdx = (page - 1) * pageSize;
                                      setSelectedCell({ rowIdx: minRowIdx + rowIdx, colIdx, colName: col.label, value: val });
                                    }
                                  }}
                                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row }); }}
                                >
                                  {String(val) || "-"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
            </div>

      </div>
    </div>

      {/* Columns Select Modal */}
      {mounted && isColumnsModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsColumnsModalOpen(false)} 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full flex flex-col z-[100] overflow-hidden max-h-[90vh]"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#621f32] to-[#802842] text-white rounded-2xl shadow-lg shadow-[#621f32]/20">
                    <Columns className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">Configurar Columnas</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Personaliza tu vista de datos</p>
                  </div>
                </div>
                <button onClick={() => setIsColumnsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"><X className="size-6" /></button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 shadow-inner w-full flex-1">
                  <Search className="size-4 text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    value={columnSearchText} 
                    onChange={e => setColumnSearchText(e.target.value)} 
                    placeholder="Buscar columna..." 
                    className="bg-transparent text-sm w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400" 
                  />
                  {columnSearchText && <button onClick={() => setColumnSearchText("")} className="text-slate-300 hover:text-slate-500 ml-2"><X className="size-4" /></button>}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setColumns(prev => prev.map(c => ({ ...c, visible: true })))}
                    className="flex-1 sm:flex-none px-5 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                  >
                    Mostrar todas
                  </button>
                  <button 
                    onClick={() => setColumns(prev => prev.map(c => ({ ...c, visible: false })))}
                    className="flex-1 sm:flex-none px-5 py-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-black uppercase rounded-xl border border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all active:scale-95"
                  >
                    Borrar todas
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {columns.filter(col => col.label.toLowerCase().includes(columnSearchText.toLowerCase())).map((col) => (
                  <button 
                    key={col.key} 
                    onClick={() => toggleColumnVisibility(col.key)} 
                    className={`flex items-start gap-4 p-4 border-2 rounded-[1.5rem] text-left transition-all duration-205 group relative overflow-hidden ${
                      col.visible 
                      ? "border-[#621f32]/40 bg-[#621f32]/[0.03] dark:bg-[#bc955c]/[0.03] dark:border-[#bc955c]/40" 
                      : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className={`mt-0.5 size-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                      col.visible 
                      ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" 
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 group-hover:border-slate-400"
                    }`}>
                      {col.visible && <Check className="size-3 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${col.visible ? "text-[#621f32] dark:text-[#bc955c]" : "text-slate-600 dark:text-slate-400"}`}>{col.label}</p>
                      <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 mt-0.5 block">{col.isBasic ? "Campo Principal" : "Campo Extra"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button 
                onClick={() => setIsColumnsModalOpen(false)} 
                className="w-full bg-gradient-to-r from-[#621f32] to-[#8d2c48] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-[#621f32]/20 dark:shadow-none active:scale-[0.98] hover:opacity-90"
              >
                Confirmar Selección
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Dropdown de Filtro por Valores Únicos */}
      <AnimatePresence>
        {activeFilterDropdown && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setActiveFilterDropdown(null)} 
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              ref={dropdownRef} 
              className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-[450px] max-w-[95vw] max-h-[500px] flex flex-col overflow-hidden z-[70]"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Filter className="size-3 text-[#621f32] dark:text-[#bc955c]" />
                    Filtrar {columns.find(c => c.key === activeFilterDropdown)?.label}
                  </h4>
                  <button onClick={() => setActiveFilterDropdown(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="size-4" /></button>
                </div>
                {!isDateColumn(activeFilterDropdown) && (
                  <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg mb-3">
                    <button onClick={(e) => { e.stopPropagation(); setFilterDropdownTab('todos'); }} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${filterDropdownTab === 'todos' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#621f32] dark:text-[#bc955c]' : 'text-slate-500 hover:text-slate-700'}`}>Todos los datos</button>
                    <button onClick={(e) => { e.stopPropagation(); setFilterDropdownTab('actuales'); }} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${filterDropdownTab === 'actuales' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#621f32] dark:text-[#bc955c]' : 'text-slate-500 hover:text-slate-700'}`}>Vista actual</button>
                  </div>
                )}
                <div className="relative flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                  <Search className="size-3 text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    value={filterSearchText} 
                    onChange={(e) => setFilterSearchText(e.target.value)} 
                    placeholder="Buscar valor..." 
                    className="bg-transparent text-[11px] w-full outline-none text-slate-700 dark:text-slate-200 font-bold" 
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white dark:bg-slate-900">
                {loadingUniqueValues ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="size-6 border-2 border-t-[#621f32] border-[#621f32]/20 dark:border-t-[#bc955c] dark:border-[#bc955c]/20 rounded-full animate-spin mb-2" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Cargando valores...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {/* Top Select/Deselect action buttons */}
                    {(() => {
                      const visibleVals = (uniqueColumnValues[activeFilterDropdown] || []).map(v => v.value);
                      return (
                        <div className="flex gap-2 px-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
                          <button 
                            type="button"
                            onClick={() => {
                              setTempSelectedValues(prev => [...new Set([...prev, ...visibleVals])]);
                            }} 
                            className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 text-[9px] font-black uppercase text-center rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                          >
                            Seleccionar Todo
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              setTempSelectedValues(prev => prev.filter(v => !visibleVals.includes(v)));
                            }} 
                            className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 text-[9px] font-black uppercase text-center rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                          >
                            Deseleccionar Todo
                          </button>
                        </div>
                      );
}
)()}

                    {/* Conditional rendering depending on column type */}
                    {isDateColumn(activeFilterDropdown) ? (
                      <div className="flex flex-col gap-1 p-2">
                        {(() => {
                          const valuesList = uniqueColumnValues[activeFilterDropdown] || [];
                          return Object.keys(dateHierarchies[activeFilterDropdown] || {}).sort((a,b) => b - a).map(year => {
                            const yearData = dateHierarchies[activeFilterDropdown][year];
                            const isYearExpanded = expandedDateNodes[year];
                            const yearLeafValues = [...new Set(
                              valuesList
                                .filter(item => parseDateParts(item.value)?.year === year)
                                .map(item => String(item.value || "").trim())
                            )];
                            const isYearSelected = yearLeafValues.length > 0 && yearLeafValues.every(v => tempSelectedValues.includes(v));
                            const isYearPartial = !isYearSelected && yearLeafValues.some(v => tempSelectedValues.includes(v));

                            return (
                              <div key={year} className="flex flex-col">
                                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group">
                                  <button type="button" onClick={() => toggleDateNode(year)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 cursor-pointer">
                                    {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
                                  </button>
                                  <div onClick={() => handleDateSelection(activeFilterDropdown, 'year', year)} className="flex items-center gap-2 cursor-pointer flex-1">
                                    <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${isYearSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                      {isYearSelected && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                      {isYearPartial && <div className="size-1.5 bg-[#621f32] dark:bg-[#bc955c] rounded-sm" />}
                                    </div>
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{year}</span>
                                    <span className="text-[10px] font-black text-slate-400">({yearData.count})</span>
                                  </div>
                                </div>
                                
                                {isYearExpanded && (
                                  <div className="ml-6 flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2 mt-1 mb-2 gap-1">
                                    {Object.keys(yearData.months).sort().map(month => {
                                      const monthData = yearData.months[month];
                                      const monthPath = `${year}-${month}`;
                                      const isMonthExpanded = expandedDateNodes[monthPath];
                                      const monthLeafValues = [...new Set(
                                        valuesList
                                          .filter(item => {
                                            const p = parseDateParts(item.value);
                                            return p && p.year === year && p.month === month;
                                          })
                                          .map(item => String(item.value || "").trim())
                                      )];
                                      const isMonthSelected = monthLeafValues.length > 0 && monthLeafValues.every(v => tempSelectedValues.includes(v));
                                      const isMonthPartial = !isMonthSelected && monthLeafValues.some(v => tempSelectedValues.includes(v));

                                      return (
                                        <div key={month} className="flex flex-col">
                                          <div className="flex items-center gap-2 px-2 py-1 group">
                                            <button type="button" onClick={() => toggleDateNode(monthPath)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 cursor-pointer">
                                              {isMonthExpanded ? <ChevronDown className="size-2.5" /> : <ChevronRightIcon className="size-2.5" />}
                                            </button>
                                            <div onClick={() => handleDateSelection(activeFilterDropdown, 'month', month, year)} className="flex items-center gap-2 cursor-pointer flex-1">
                                              <div className={`size-3.5 rounded border flex items-center justify-center transition-all ${isMonthSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                                {isMonthSelected && <Check className="size-2 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                                {isMonthPartial && <div className="size-1 bg-[#621f32] dark:bg-[#bc955c] rounded-xs" />}
                                              </div>
                                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{monthData.name}</span>
                                              <span className="text-[9px] font-black text-slate-400">({monthData.count})</span>
                                            </div>
                                          </div>

                                          {isMonthExpanded && (
                                            <div className="ml-6 grid grid-cols-2 gap-x-2 border-l border-slate-50 dark:border-slate-800/50 pl-2 py-1 mt-1">
                                              {Object.keys(monthData.days).sort().map(day => {
                                                const count = monthData.days[day];
                                                const dayUniqueValues = [...new Set(
                                                  valuesList
                                                    .filter(item => {
                                                      const p = parseDateParts(item.value);
                                                      return p && p.year === year && p.month === month && p.day === day;
                                                    })
                                                    .map(item => String(item.value || "").trim())
                                                )];
                                                const isDaySelected = dayUniqueValues.length > 0 && dayUniqueValues.every(v => tempSelectedValues.includes(v));

                                                return (
                                                  <div key={day} onClick={() => handleDateSelection(activeFilterDropdown, 'day', day, monthPath)} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer group">
                                                    <div className={`size-3 rounded border flex items-center justify-center transition-all ${isDaySelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                                      {isDaySelected && <Check className="size-2 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]">{day}</span>
                                                    <span className="text-[8px] font-black text-slate-300">({count})</span>
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
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                    {(() => {
                      const tempSelectedSet = new Set(tempSelectedValues);
                      const searchNormalized = filterSearchText ? String(filterSearchText).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
                      const filtered = uniqueColumnValues[activeFilterDropdown]?.filter(v => {
                        const valNormalized = v.value ? String(v.value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
                        return valNormalized.includes(searchNormalized);
                      }) || [];
                      const sliced = filtered.slice(0, 100);
                      return (
                        <>
                          {sliced.map(({ value, count }) => (
                            <button 
                              key={value} 
                              onClick={() => {
                                setTempSelectedValues(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
                              }} 
                              className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group"
                            >
                              <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${tempSelectedSet.has(value) ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                {tempSelectedSet.has(value) && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                              </div>
                              <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{value || "(Vacío)"}</span>
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg">{count}</span>
                              </div>
                            </button>
                          ))}
                          {filtered.length > 100 && (
                            <div className="text-center py-3 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                              Mostrando 100 de {filtered.length} resultados. Usa el buscador.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-2">
                <button onClick={() => clearColumnFilter(activeFilterDropdown)} className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all">Limpiar</button>
                <button onClick={() => applyColumnFilter(activeFilterDropdown)} className="flex-[2] px-3 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[10px] font-black uppercase rounded-xl shadow-lg shadow-[#621f32]/20 dark:shadow-none hover:opacity-90 active:scale-95 transition-all">Aplicar Filtro</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cell Detail Modal */}
      {mounted && isCellModalOpen && selectedCell && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsCellModalOpen(false)} 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-8 max-w-lg w-full z-[100] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-extrabold text-[#621f32] dark:text-[#bc955c] uppercase tracking-wider">{selectedCell.colName}</h4>
              <button onClick={() => setIsCellModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"><X className="size-5" /></button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 p-6 rounded-2xl min-h-[100px] max-h-[400px] overflow-y-auto custom-scrollbar font-bold text-slate-800 dark:text-slate-100 break-words leading-relaxed text-sm select-all">
              {selectedCell.value === null || selectedCell.value === undefined || String(selectedCell.value).trim() === "" ? (
                <span className="text-slate-400 italic">Dato vacío / No especificado</span>
              ) : (
                String(selectedCell.value)
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {contextMenu && (
        <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
      )}

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
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            key="context-menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl py-1.5 w-56"
          >
            <button
              onClick={() => {
                setSelectedRowData(contextMenu.row);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#621f32]/10 hover:text-[#621f32] dark:hover:bg-[#bc955c]/20 dark:hover:text-[#bc955c] flex items-center gap-3 transition-colors"
            >
              <Briefcase className="size-4" />
              Ver Registro Completo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
    </div>
  );
}



