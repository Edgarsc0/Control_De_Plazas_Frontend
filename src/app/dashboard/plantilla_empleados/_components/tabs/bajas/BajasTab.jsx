"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Download, Columns, Filter, ArrowUpDown, ChevronLeft, 
  ChevronRight as ChevronRightIcon, ChevronDown, ChevronsLeft, ChevronsRight, 
  X, Check, RotateCcw, Activity, Briefcase, CheckCircle2, XCircle, Layers, Users,
  Calendar, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";
import { EmployeeRecordModal } from "../../shared/EmployeesModal";
import ColumnsModal from "../../shared/ColumnsModal";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import DataTable from "../../shared/DataTable";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import AdvancedFiltersModal, { AdvancedFiltersButton } from "../../shared/AdvancedFiltersModal";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection } from "../../../_hooks/useCellSelection";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import { useAdvancedFilters } from "../../../_hooks/useAdvancedFilters";
import { matchesTextCondition, getUniqueColumnValues } from "@/utils/columnFilters";
import { evaluateAdvancedFilters } from "@/utils/advancedFilters";
import DatePicker from "react-datepicker";

const MOV_STATUS_BADGE_STYLES = {
  "A": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30", label: "Activo" },
  "I": { bg: "bg-red-50/50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-300", border: "border-red-200/50 dark:border-red-900/40", label: "Inactivo" }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const ALL_MOV_KEYS = [
  "posicion", "no_empleado", "nombre_completo", "primer_apellido", "segundo_apellido", 
  "accion", "accion_descr", "motivo", "motivo_descr", "fecha_efectiva", "sequencia_efectiva", 
  "fecha_aplicacion", "humanos_status", "nomina_status", "partida", "unidad_general", 
  "unidad_admon", "departamento", "dependencia_directa", "plan_salarial", "grado", "escala", 
  "puesto_presupuestal", "nivel_tabular", "grupo_de_pago", "beneficios", "smb", "puesto", 
  "ubicacion", "inmueble", "fecha_prevista", "ultima_actualizacion", "ultimo_operador", 
  "ultima_fecha_ingreso", "fecha_ingreso", "grupo_trabajo", "codigo_grupo", "fecha_asignacion", 
  "rfc", "curp", "id_persona", "nivel", "nivel1", "unidad_administrativa", "genero", 
  "fecha_entrada_posicion", "fecha_posicion"
];

const DATE_KEYS_MOV = ["fecha_efectiva", "fecha_aplicacion", "ultima_actualizacion", "fecha_ingreso"];

export default function BajasTab({ bajasData = [], bajasMotivos = [], bajasHistorico = [], isPending, startTransition, cardRef }) {
  const [mounted, setMounted] = useState(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  useEffect(() => setMounted(true), []);

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(450);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width) {
          setChartWidth(entry.contentRect.width);
        }
      }
    });
    resizeObserver.observe(chartContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const lineChartData = useMemo(() => {
    if (!bajasHistorico || bajasHistorico.length === 0) return null;
    
    const sorted = [...bajasHistorico].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const values = sorted.map(d => d.registros_bajas);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const valRange = maxVal - minVal || 10;
    
    const padding = valRange * 0.15;
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;
    const yRange = yMax - yMin;

    const width = chartWidth;
    const height = 150;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    
    const points = sorted.map((d, index) => {
      const x = paddingLeft + (sorted.length > 1 ? (index / (sorted.length - 1)) * plotWidth : plotWidth / 2);
      const y = paddingTop + plotHeight - ((d.registros_bajas - yMin) / yRange) * plotHeight;
      return {
        x,
        y,
        fecha: d.fecha,
        valor: d.registros_bajas
      };
    });
    
    let pathD = "";
    if (points.length > 1) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    }
    
    let areaD = "";
    if (points.length > 1) {
      areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;
    }
    
    return {
      points,
      pathD,
      areaD,
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      plotWidth,
      plotHeight,
      yMin,
      yMax,
      sorted
    };
  }, [bajasHistorico, chartWidth]);

  const handleMotiveClick = useCallback((motivo) => {
    if (!motivo) return;
    setTextFilters(prev => ({
      ...prev,
      motivo_descr: {
        value: motivo,
        condition: "contains"
      }
    }));
    if (cardRef?.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [cardRef]);

  const { columns, setColumns, toggleVisibility: toggleColumnVisibility, isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen } = useColumnState([
    { key: "posicion", label: "Posición", width: 120, visible: true },
    { key: "no_empleado", label: "No. Empleado", width: 120, visible: true },
    { key: "nombre_completo", label: "Nombre Completo", width: 250, visible: true },
    { key: "motivo_descr", label: "Motivo", width: 250, visible: true },
    { key: "fecha_efectiva", label: "Fecha Efectiva", width: 120, visible: true },
    { key: "unidad_admon", label: "Unidad Admon", width: 250, visible: true },
    { key: "departamento", label: "Departamento", width: 250, visible: true },
    { key: "puesto", label: "Puesto", width: 250, visible: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true },
    { key: "accion_descr", label: "Acción", width: 200, visible: true },
    { key: "nomina_status", label: "Estatus Nómina", width: 150, visible: true },
    { key: "humanos_status", label: "Estatus RH", width: 150, visible: true },
    { key: "partida", label: "Partida", width: 120, visible: true },
    { key: "nivel", label: "Nivel", width: 100, visible: true },
    { key: "rfc", label: "RFC", width: 150, visible: false },
    { key: "curp", label: "CURP", width: 180, visible: false },
    { key: "genero", label: "Género", width: 100, visible: false }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [scrollTop, setScrollTop] = useState(0);
  const { selectedCell, setSelectedCell, isCellModalOpen, setIsCellModalOpen, selectedRowData, setSelectedRowData, contextMenu, setContextMenu } = useCellSelection();
  const filters = useColumnFilters();
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
  } = filters;
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [modalHistoryData, setModalHistoryData] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [cardWidth, setCardWidth] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('tabla');
  const [comparingIndex, setComparingIndex] = useState(null);
  const [timelineSearch, setTimelineSearch] = useState('');

  const timelineData = useMemo(() => {
    if (!modalHistoryData || modalHistoryData.length === 0) return [];
    
    // modalHistoryData is already sorted newest to oldest.
    // Reverse it to oldest->newest so we can compute the chronological diffs correctly.
    const sorted = [...modalHistoryData].reverse();
    const excludedKeys = ['id', 'fecha_efectiva', 'sequencia_efectiva', 'fecha_aplicacion', 'ultima_actualizacion', 'ultimo_operador', 'motivo', 'motivo_descr', 'accion', 'accion_descr', 'total_movimientos'];
    
    const computed = sorted.map((row, index) => {
      const changes = [];
      if (index > 0) {
        const prevRow = sorted[index - 1];
        ALL_MOV_KEYS.forEach(key => {
          if (!excludedKeys.includes(key) && row[key] !== prevRow[key]) {
            changes.push({
              key,
              label: columns.find(c => c.key === key)?.label || key.replace(/_/g, ' ').toUpperCase(),
              before: prevRow[key] === null || prevRow[key] === '' ? '-' : String(prevRow[key]),
              after: row[key] === null || row[key] === '' ? '-' : String(row[key])
            });
          }
        });
      }
      return { ...row, changes };
    });
    
    // Reverse again so that the timeline displays newest first
    return computed.reverse();
  }, [modalHistoryData, columns]);

  const filteredTimelineData = useMemo(() => {
    if (!timelineSearch) return timelineData;
    const lower = timelineSearch.toLowerCase();
    return timelineData.filter(row => 
      (row.motivo_descr && String(row.motivo_descr).toLowerCase().includes(lower)) || 
      (row.motivo && String(row.motivo).toLowerCase().includes(lower)) ||
      (row.accion_descr && String(row.accion_descr).toLowerCase().includes(lower))
    );
  }, [timelineData, timelineSearch]);

  const tableDataToRender = useMemo(() => {
    if (activeModalTab === 'tabla') return modalHistoryData;
    if (activeModalTab === 'diff_table' && comparingIndex !== null && filteredTimelineData) {
      const current = filteredTimelineData[comparingIndex];
      // Since it's reversed (newest to oldest), the chronological 'previous' record is at comparingIndex + 1
      const previous = comparingIndex < filteredTimelineData.length - 1 ? filteredTimelineData[comparingIndex + 1] : null;
      return [current, previous].filter(Boolean);
    }
    return null;
  }, [activeModalTab, comparingIndex, modalHistoryData, filteredTimelineData]);

  const deferredTextFilters = useDeferredValue(textFilters);
  const deferredGlobalSearch = useDeferredValue(globalSearch);

  const dropdownRef = useRef(null);
  const tbodyRef = useRef(null);

  const MONTH_NAMES = useMemo(() => ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"], []);

  const parseDateParts = useCallback((val) => {
    if (!val || String(val).trim() === "") return null;
    let d = new Date(val);
    if (isNaN(d.getTime())) {
      const parts = String(val).split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]);
        else d = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear().toString(),
      month: (d.getMonth() + 1).toString().padStart(2, '0'),
      day: d.getDate().toString().padStart(2, '0'),
      monthName: MONTH_NAMES[d.getMonth()]
    };
  }, [MONTH_NAMES]);

    
  const getColumnLetter = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const isMonoColumn = useCallback((key) => ["posicion", "no_empleado", "partida", "grado", "escala", "nivel"].includes(key), []);


  const isDateColumn = useCallback((colKey) => {
    return DATE_KEYS_MOV.includes(colKey);
  }, []);

  const getAdvCellValue = useCallback((row, key) =>
    row[key] === null || row[key] === undefined ? "" : String(row[key]), []);

  const fetchAdvSuggestions = useCallback((column) =>
    getUniqueColumnValues(bajasData, column, getAdvCellValue), [bajasData, getAdvCellValue]);

  const {
    isAdvancedFiltersOpen, setIsAdvancedFiltersOpen,
    advancedConditions,
    appliedAdvancedFilters,
    addAdvancedCondition, removeAdvancedCondition, updateAdvancedCondition,
    applyAdvancedFilters, resetAdvancedFilters,
  } = useAdvancedFilters({ mode: "client", isDateColumn });

  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS_MOV.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      bajasData.forEach(row => {
        const val = row[key];
        const parts = parseDateParts(val);
        if (!parts) return;
        const { year, month, day, monthName } = parts;
        if (!years[year]) years[year] = { count: 0, months: {} };
        years[year].count++;
        if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
        years[year].months[month].count++;
        years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + 1;
      });
      hierarchies[key] = years;
    });
    return hierarchies;
  }, [bajasData, activeFilterDropdown, parseDateParts]);

  const uniqueColumnValues = useMemo(() => {
    const valuesMap = {};
    const targetKeys = ["estado_psn"];
    if (activeFilterDropdown && !targetKeys.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const counts = {};
      bajasData.forEach(row => {
        let val = String(row[key] || "").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      valuesMap[key] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    });
    return valuesMap;
  }, [bajasData, activeFilterDropdown]);

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      targetRawValues = bajasData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'month') {
      const year = parentPath;
      targetRawValues = bajasData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      targetRawValues = bajasData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(row => String(row[colKey] || "").trim());
    }

    const uniqueTargetValues = [...new Set(targetRawValues)];
    const allInTemp = uniqueTargetValues.every(v => tempSelectedValues.includes(v));

    if (allInTemp) {
      setTempSelectedValues(prev => prev.filter(v => !uniqueTargetValues.includes(v)));
    } else {
      setTempSelectedValues(prev => [...new Set([...prev, ...uniqueTargetValues])]);
    }
  };

  const toggleDateNode = (path) => {
    setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) setActiveFilterDropdown(null);
    else {
      setActiveFilterDropdown(colKey);
      setFilterDropdownTab('todos');
      setFilterSearchText("");
      // Computar valores únicos inline desde los datos (el memo uniqueColumnValues es
      // lazy y aún no se ha recomputado para la columna recién activada).
      setTempSelectedValues(columnFilters[colKey] || [...new Set(bajasData.map(row => String(row[colKey] || "").trim()))]);
    }
  };

  const applyColumnFilter = (colKey) => {
    const totalUnique = uniqueColumnValues[colKey].map(v => v.value);
    startTransition(() => {
      if (tempSelectedValues.length === totalUnique.length) {
        const newFilters = { ...columnFilters };
        delete newFilters[colKey];
        setColumnFilters(newFilters);
      } else {
        setColumnFilters({ ...columnFilters, [colKey]: tempSelectedValues });
      }
    });
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    startTransition(() => {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    });
    setActiveFilterDropdown(null);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    resetAdvancedFilters();
    startTransition(() => {
      setColumnFilters({});
      setTextFilters({});
      setGlobalSearch("");
      setSortConfig({ key: null, direction: null });
    });
  };

  const handleStatusFilter = (label) => {
    const current = [];
    const next = current.includes(label) ? current.filter(s => s !== label) : [...current, label];
    const newFilters = { ...columnFilters };
    if (next.length === 0 || next.length === uniqueColumnValues["estado_psn"]?.length) delete newFilters["estado_psn"];
    else newFilters["estado_psn"] = next;
    startTransition(() => { setColumnFilters(newFilters); setScrollTop(0); });
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

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    else if (sortConfig.key === key && sortConfig.direction === "desc") direction = null;
    setSortConfig({ key, direction });
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setActiveFilterDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const shouldLock = !!activeFilterDropdown || isColumnsModalOpen;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activeFilterDropdown, isColumnsModalOpen]);

  const filteredSortedData = useMemo(() => {
    let result = bajasData.filter(row => {
      if (deferredGlobalSearch) {
        const searchText = deferredGlobalSearch.toLowerCase();
        if (!Object.entries(row).some(([key, val]) => String(val || "").toLowerCase().includes(searchText))) return false;
      }
      for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals.includes(String(row[colKey] || "").trim())) return false;
      }
      for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {
        if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
        const searchText = filterObj.value;
        const condition = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        
        const val = String(row[colKey] || "");
        const lowerVal = val.toLowerCase().trim();
        const lowerSearch = searchText.toLowerCase().trim();
        
        switch (condition) {
          case "contains":
            if (!lowerVal.includes(lowerSearch)) return false;
            break;
          case "not_contains":
            if (lowerVal.includes(lowerSearch)) return false;
            break;
          case "starts_with":
            if (!lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "not_starts_with":
            if (lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "ends_with":
            if (!lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "not_ends_with":
            if (lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "equals":
            if (lowerVal !== lowerSearch) return false;
            break;
          case "not_equals":
            if (lowerVal === lowerSearch) return false;
            break;
          default:
            if (!lowerVal.includes(lowerSearch)) return false;
        }
      }
      if (!evaluateAdvancedFilters(row, appliedAdvancedFilters, { getCellValue: getAdvCellValue, isDateColumn })) return false;
      return true;
    });
    if (sortConfig.key && sortConfig.direction) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let valA = String(a[key] || "").trim(), valB = String(b[key] || "").trim();
        const numA = Number(valA), numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) return direction === "asc" ? numA - numB : numB - numA;
        return direction === "asc" ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" }) : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: "base" });
      });
    }
    return result;
  }, [bajasData, deferredGlobalSearch, columnFilters, deferredTextFilters, sortConfig, isMonoColumn, appliedAdvancedFilters, getAdvCellValue, isDateColumn]);


  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };

    let baseUniqueValues = uniqueColumnValues[activeFilterDropdown] || [];
    if (filterDropdownTab === 'actuales') {
      const counts = {};
      filteredSortedData.forEach(row => {
        const val = String(row[activeFilterDropdown] || "").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      baseUniqueValues = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => (a.value === "" ? -1 : b.value === "" ? 1 : b.count - a.count));
    }

    const allVals = baseUniqueValues.map(v => v.value);
    const isAllSelected = allVals.length > 0 && allVals.every(v => tempSelectedValues.includes(v));
    const filtered = baseUniqueValues.filter(v => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));

    return { allVals, isAllSelected, sliced: filtered.slice(0, 100), filteredCount: filtered.length };
  }, [activeFilterDropdown, uniqueColumnValues, filterDropdownTab, filteredSortedData, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText]);

  useEffect(() => {
    let active = true;
    if (isHistoryModalOpen && selectedCell) {
      const posicion = filteredSortedData[selectedCell.row]?.posicion;
      if (posicion) {
        setIsModalLoading(true);
        VacantesService.getMovPosHistoria(posicion)
          .then(res => res.json())
          .then(data => {
            if (active) {
              setModalHistoryData(data);
              setIsModalLoading(false);
            }
          })
          .catch(err => {
            console.error("Error fetching history:", err);
            if (active) {
              setIsModalLoading(false);
            }
          });
      }
    } else {
      setModalHistoryData(null);
    }
    return () => { active = false; };
  }, [isHistoryModalOpen, selectedCell, filteredSortedData]);

  const rowHeight = 37, containerHeight = 800;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    if (col.key === "estado_psn") {
      const badge = MOV_STATUS_BADGE_STYLES[value] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: value };
      return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-[10px] border-r align-middle h-[37px] transition-all ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span></td>);
    }
    const isPosicionCol = col.key === "posicion";
    const handleCellClick = (e) => { onClick(e); if (isPosicionCol) { setActiveModalTab('tabla'); setComparingIndex(null); setTimelineSearch(''); setIsHistoryModalOpen(true); } };
    return (<td key={col.key} onClick={handleCellClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${isPosicionCol ? "cursor-pointer hover:bg-[#621f32]/10 hover:text-[#621f32] hover:underline" : ""}`}>{col.key === "total_movimientos" ? (<div className="flex justify-center">{value !== undefined && value !== null ? (<span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#621f32]/10 text-[#621f32] dark:bg-[#bc955c]/20 dark:text-[#bc955c] border border-[#621f32]/20 dark:border-[#bc955c]/30 text-[10px] font-black leading-none shadow-sm" title={`${value} movimientos históricos`}>{value}</span>) : <span className="text-slate-300">-</span>}</div>) : value === undefined || value === null || String(value).trim() === "" ? (<span className="text-slate-300">-</span>) : (String(value))}</td>);
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Empleados_Bajas");

      const visibleCols = columns.filter(c => c.visible);

      // Define columns
      worksheet.columns = visibleCols.map(col => ({
        header: col.label,
        key: col.key,
        width: 15
      }));

      // Add rows
      filteredSortedData.forEach(row => {
        const dataRow = {};
        visibleCols.forEach(col => {
          dataRow[col.key] = row[col.key];
        });
        worksheet.addRow(dataRow);
      });

      // Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell(cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2B4C7E" } // Navy Blue
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFBC955C" } },
          left: { style: "thin", color: { argb: "FFBC955C" } },
          bottom: { style: "thin", color: { argb: "FFBC955C" } },
          right: { style: "thin", color: { argb: "FFBC955C" } }
        };
      });

      // Data rows styling
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        row.height = 20;
        const isZebra = rowNumber % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = {
            name: "Segoe UI",
            size: 9
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFBC955C" } },
            left: { style: "thin", color: { argb: "FFBC955C" } },
            bottom: { style: "thin", color: { argb: "FFBC955C" } },
            right: { style: "thin", color: { argb: "FFBC955C" } }
          };
          if (isZebra) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF4F7FA" } // Zebra background
            };
          }

          const colKey = visibleCols[colNumber - 1]?.key;
          if (isMonoColumn(colKey)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const val = cell.value ? String(cell.value) : "";
          maxLen = Math.max(maxLen, val.length);
        });
        column.width = Math.max(maxLen + 4, 12);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Empleados_Bajas.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeStatusFilter = [];

  // ── Pie chart helpers ──
  const PIE_COLORS = [
    "#621f32", "#bc955c", "#8d2c48", "#d4a96a", "#4a1625",
    "#e8c280", "#3d1020", "#a07040", "#7a2038", "#f0d090",
    "#2d0a18", "#c8a050", "#b06040", "#6a1828", "#dbb870",
  ];

  const pieTotal = bajasMotivos.reduce((s, d) => s + d.total, 0);

  const pieSlices = useMemo(() => {
    if (!bajasMotivos.length || pieTotal === 0) return [];
    const R = 80, cx = 100, cy = 100;
    let angle = -Math.PI / 2;
    return bajasMotivos.map((d, i) => {
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
  }, [bajasMotivos, pieTotal]);

  const [hoveredSlice, setHoveredSlice] = useState(null);

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6 pt-2">
        <Zoom triggerOnce>
          <div className="flex flex-col lg:flex-row gap-5 mb-6 items-stretch w-full">
            {/* Stat card */}
            <div className="flex-shrink-0 lg:w-56">
              <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-gradient-to-br from-[#621f32] to-[#8a2a46] text-white shadow-xl shadow-[#621f32]/25 ring-2 ring-white/20">
                <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <div className="p-2 rounded-xl bg-white/20 text-white">
                    <Users className="size-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Total de Bajas</span>
                </div>
                <span className="text-5xl font-black tracking-tighter relative z-10 text-white">{formatNumber(bajasData.length)}</span>
                <span className="text-xs text-white/60 mt-2 relative z-10 font-semibold">{bajasMotivos.length} motivos distintos</span>
              </div>
            </div>

            {/* Pie chart */}
            {pieSlices.length > 0 && (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center">
                <div className="relative shrink-0">
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
                        onClick={() => handleMotiveClick(slice.motivo)}
                        style={hoveredSlice === i ? { filter: 'brightness(1.15)' } : {}}
                      />
                    ))}
                    {/* Donut hole */}
                    <circle cx="100" cy="100" r="42" fill="white" className="dark:fill-slate-900" />
                    <text x="100" y="96" textAnchor="middle" className="text-[9px]" fill="#621f32" fontWeight="900" fontSize="11">
                      {hoveredSlice !== null ? pieSlices[hoveredSlice].pct + "%" : formatNumber(pieTotal)}
                    </text>
                    <text x="100" y="110" textAnchor="middle" fill="#999" fontSize="7" fontWeight="600">
                      {hoveredSlice !== null ? "del total" : "bajas"}
                    </text>
                  </svg>
                </div>

                {/* Leyenda */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pieSlices.map((slice, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => handleMotiveClick(slice.motivo)}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                        hoveredSlice === null || hoveredSlice === i ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={slice.motivo}>
                        {slice.motivo}
                      </span>
                      <span className="text-[10px] font-black text-slate-500 shrink-0">
                        {formatNumber(slice.total)}
                        <span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Line chart (Historial de Bajas) */}
            {lineChartData && (
              <div ref={chartContainerRef} className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col justify-between select-none">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#621f32]/10 text-[#621f32] dark:text-[#f3dcd4] dark:bg-[#621f32]/30">
                      <Activity className="size-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Historial de Bajas</span>
                  </div>
                  {hoveredPointIndex !== null ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#621f32] text-white shadow-md border border-[#621f32]/30 dark:border-[#621f32]/50 transition-all duration-300">
                      <Calendar className="size-3 text-white/90" />
                      <span className="opacity-95">
                        {(() => {
                          const parts = lineChartData.points[hoveredPointIndex].fecha.split("-");
                          return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : lineChartData.points[hoveredPointIndex].fecha;
                        })()}
                      </span>
                      <span className="w-px h-3.5 bg-white/20" />
                      <span className="font-semibold text-rose-200">
                        {formatNumber(lineChartData.points[hoveredPointIndex].valor)} bajas
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200/40 dark:border-slate-700/40">
                      Pasa el cursor por los puntos
                    </span>
                  )}
                </div>

                <div className="relative w-full overflow-visible" style={{ height: 125 }}>
                  <svg
                    viewBox={`0 0 ${lineChartData.width} ${lineChartData.height}`}
                    width="100%"
                    height="125"
                    className="overflow-visible"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#621f32" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#621f32" stopOpacity="0.0" />
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Horizontal Grid lines and Y-axis labels */}
                    {[0, 0.5, 1].map((ratio, i) => {
                      const y = lineChartData.paddingTop + ratio * lineChartData.plotHeight;
                      const val = Math.round(lineChartData.yMax - ratio * (lineChartData.yMax - lineChartData.yMin));
                      return (
                        <g key={i} className="opacity-40">
                          <line
                            x1={lineChartData.paddingLeft}
                            y1={y}
                            x2={lineChartData.width - lineChartData.paddingRight}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeWidth="0.8"
                            strokeDasharray="4 4"
                          />
                          <text
                            x={lineChartData.paddingLeft - 8}
                            y={y + 3}
                            textAnchor="end"
                            fontSize="8"
                            fontWeight="bold"
                            fill="#000000"
                            className="dark:fill-white"
                          >
                            {formatNumber(val)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Gradient Area Fill */}
                    {lineChartData.areaD && (
                      <path
                        d={lineChartData.areaD}
                        fill="url(#chartGradient)"
                      />
                    )}

                    {/* Vertical guideline for hovered point */}
                    {hoveredPointIndex !== null && (
                      <line
                        x1={lineChartData.points[hoveredPointIndex].x}
                        y1={lineChartData.paddingTop}
                        x2={lineChartData.points[hoveredPointIndex].x}
                        y2={lineChartData.paddingTop + lineChartData.plotHeight}
                        stroke="#621f32"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        className="opacity-60"
                      />
                    )}

                    {/* Connecting Line */}
                    {lineChartData.pathD && (
                      <path
                        d={lineChartData.pathD}
                        fill="none"
                        stroke="#621f32"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow)"
                      />
                    )}

                    {/* Interactive Dots */}
                    {lineChartData.points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredPointIndex === i ? 6 : 3.5}
                          fill={hoveredPointIndex === i ? "#621f32" : "#ffffff"}
                          stroke="#621f32"
                          strokeWidth={hoveredPointIndex === i ? 2.5 : 2}
                          className="transition-all duration-150 cursor-pointer"
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        />
                        {/* Interactive overlay for easier hovering */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="15"
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        />
                      </g>
                    ))}

                    {/* X-axis labels (Dates) directly aligned under each mapped point */}
                    {lineChartData.points.map((p, i) => {
                      const parts = p.fecha.split("-");
                      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : p.fecha;
                      return (
                        <text
                          key={i}
                          x={p.x}
                          y={lineChartData.height - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="normal"
                          fill={hoveredPointIndex === i ? "#621f32" : "#000000"}
                          className="dark:fill-white transition-all duration-150"
                        >
                          {label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </Zoom>
      </div>

      <div className="w-full flex items-start justify-center">
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl h-fit flex flex-col z-30 overflow-hidden w-full md:max-h-[calc(100vh-var(--stack-h))] md:sticky md:bottom-0 md:scroll-mt-[var(--stack-h)]" style={{ width: cardWidth ? `${cardWidth}px` : '100%', maxWidth: cardWidth ? 'none' : '100%' }}>
          <MobileTableToolbar
            searchValue={searchQuery}
            onSearch={(v) => { setSearchQuery(v); startTransition(() => setGlobalSearch(v)); }}
            count={filteredSortedData.length}
            primaryAction={{ icon: Download, label: "Exportar a Excel", onClick: handleExportExcel, loading: isExportingExcel }}
            actions={[
              { icon: RotateCcw, label: "Restablecer filtros", onClick: resetAllFilters },
              { icon: Filter, label: "Filtros avanzados", onClick: () => setIsAdvancedFiltersOpen(true), badge: appliedAdvancedFilters.length },
              { icon: Columns, label: "Columnas", onClick: () => setIsColumnsModalOpen(true) },
            ]}
          />

          <div className="hidden md:flex p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); startTransition(() => setGlobalSearch(e.target.value)); }} placeholder="Buscar..." className="bg-transparent text-slate-800 text-xs font-bold w-full outline-none" />
                  {searchQuery && <button onClick={() => { setSearchQuery(""); startTransition(() => setGlobalSearch("")); }} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none">{formatNumber(filteredSortedData.length)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{activeStatusFilter.map(status => (<button key={status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm transition-all hover:opacity-80 active:scale-95 cursor-pointer" style={{ backgroundColor: status === "A" ? "#621f3212" : "#1f293712", color: status === "A" ? "#621f32" : "#1f2937", borderColor: status === "A" ? "#621f3230" : "#1f293730" }}><span>{status === "A" ? "Activo" : "Inactivo"}</span><X className="size-3" /></button>))}</div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {selectedCell && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 py-2 px-3.5 bg-[#621f32]/5 dark:bg-[#bc955c]/5 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 group">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[#621f32] dark:text-[#bc955c] flex-shrink-0">{getColumnLetter(selectedCell.col)}{selectedCell.row + 1}</span>
                      <span className="max-w-[120px] sm:max-w-[180px] md:max-w-[250px] truncate">Col: <strong className="text-slate-700 dark:text-slate-200">{columns.filter(c => c.visible)[selectedCell.col]?.label}</strong></span>
                      <span className="opacity-30">|</span>
                      <span className="max-w-[150px] sm:max-w-[250px] md:max-w-[350px] truncate">Val: <strong className="text-slate-700 dark:text-slate-200">{(() => { const v = filteredSortedData[selectedCell.row]?.[columns.filter(c => c.visible)[selectedCell.col]?.key]; return !v ? "-" : String(v); })()}</strong></span>
                      <button onClick={() => setIsCellModalOpen(true)} className="ml-1 p-1 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] rounded-md shadow-sm hover:opacity-90 active:scale-95 transition-all flex-shrink-0" title="Ver detalle completo"><ChevronRightIcon className="size-3" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={resetAllFilters} disabled={Object.keys(columnFilters).length === 0 && !globalSearch && !sortConfig.key && !Object.values(textFilters).some(v => v && v.value) && appliedAdvancedFilters.length === 0} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-950/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all duration-300 shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"><RotateCcw className="size-3.5" /><span>Restablecer Filtros</span></button>
              <AdvancedFiltersButton onClick={() => setIsAdvancedFiltersOpen(true)} appliedCount={appliedAdvancedFilters.length} />
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer"><Columns className="size-3.5" /><span>Columnas</span></button>
              <button 
                onClick={handleExportExcel} 
                disabled={isExportingExcel}
                className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] text-white font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
              >
                {isExportingExcel ? (
                  <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>{isExportingExcel ? "Cargando..." : "Excel"}</span>
              </button>
            </div>
          </div>

          {/* Tabla densa: sólo desktop */}
          <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
          <DataTable
            tbodyRef={tbodyRef}
            onScroll={setScrollTop}
            columns={columns}
            columnFilters={columnFilters}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            activeConditionDropdown={activeConditionDropdown}
            setActiveConditionDropdown={setActiveConditionDropdown}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            onRowContextMenu={(e, row) => setContextMenu({ x: e.clientX, y: e.clientY, row })}
            onShowRecord={setSelectedRowData}
            sortConfig={sortConfig}
            onSort={handleSort}
            onOpenFilter={openFilterDropdown}
            onResizeStart={handleMouseDown}
            getColumnLetter={getColumnLetter}
            isMonoColumn={isMonoColumn}
            isPending={isPending}
            isLoading={false}
            data={paginatedData}
            startIndex={startIndex}
            endIndex={endIndex}
            totalCount={filteredSortedData.length}
            rowHeight={rowHeight}
            renderCell={renderCell}
          />
          </div>

          {/* Vista de tarjetas: sólo móvil */}
          <div className="md:hidden">
            <MobileCardList
              data={filteredSortedData}
              config={{
                getRowId: (r, i) => r.id ?? r.posicion ?? r.no_empleado ?? i,
                getTitle: (r) => r.nombre_completo || "Sin nombre",
                getSubtitle: (r) => (r.posicion ? `POS ${r.posicion}` : ""),
                renderBadge: (r) => (r.accion_descr ? <span className="inline-flex items-center px-2 py-1 rounded-md border text-[9px] font-black uppercase bg-[#621f32]/8 text-[#621f32] border-[#621f32]/20 max-w-[110px] truncate">{r.accion_descr}</span> : null),
                fields: [
                  { key: "no_empleado", label: "No. Empleado", mono: true },
                  { key: "motivo_descr", label: "Motivo" },
                  { key: "fecha_efectiva", label: "F. Efectiva" },
                  { key: "unidad_admon", label: "Unidad" },
                  { key: "puesto", label: "Puesto" },
                  { key: "nomina_status", label: "Estatus Nómina" },
                ],
              }}
              onCardClick={(row) => setSelectedRowData(row)}
              isLoading={false}
              isPending={isPending}
            />
          </div>

          <div className="hidden md:block absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />
        </div>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
                    <ColumnsModal
            open={isColumnsModalOpen}
            columns={columns}
            onToggle={toggleColumnVisibility}
            onShowAll={() => setColumns(prev => prev.map(c => ({ ...c, visible: true })))}
            onHideAll={() => setColumns(prev => prev.map(c => ({ ...c, visible: false })))}
            onClose={() => setIsColumnsModalOpen(false)}
          />
        </AnimatePresence>,
        document.body
      )}

      {/* Dropdown de Filtro por Valores Únicos */}
      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={columns.find(c => c.key === activeFilterDropdown)?.label}
            isDate={isDateColumn(activeFilterDropdown)}
            data={bajasData}
            filters={filters}
            dropdownValues={filterDropdownValues}
            dateHierarchy={dateHierarchies[activeFilterDropdown]}
            onDateSelection={(type, value, parentPath) => handleDateSelection(activeFilterDropdown, type, value, parentPath)}
            onToggleDateNode={(path) => setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }))}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

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
        fetchSuggestions={fetchAdvSuggestions}
      />

      {/* Modal de Detalle de Posición Histórica */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedCell && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 rounded-none border border-slate-200 dark:border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.4)] w-full max-w-[98vw] max-h-[80vh] flex flex-col z-[90] overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-[#621f32] to-[#802842] text-white rounded-none shadow-md shadow-[#621f32]/20">
                      <Briefcase className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">Detalle de Posición</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Posición: {filteredSortedData[selectedCell.row]?.posicion || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center bg-slate-200/50 dark:bg-slate-800 p-1 rounded-none border border-slate-200 dark:border-slate-700 ml-4">
                    <button onClick={() => { setActiveModalTab('tabla'); setComparingIndex(null); }} className={`px-4 py-1.5 text-xs font-black uppercase transition-all ${activeModalTab === 'tabla' ? 'bg-white dark:bg-slate-600 text-[#621f32] dark:text-[#bc955c] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tabla</button>
                    <button onClick={() => { setActiveModalTab('timeline'); setComparingIndex(null); }} className={`px-4 py-1.5 text-xs font-black uppercase transition-all ${activeModalTab === 'timeline' ? 'bg-white dark:bg-slate-600 text-[#621f32] dark:text-[#bc955c] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Línea del Tiempo</button>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 transition-all active:scale-95">
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-0 bg-slate-100/50 dark:bg-slate-900/50">
                {isModalLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando historial...</p>
                  </div>
                ) : activeModalTab === 'tabla' || activeModalTab === 'diff_table' ? (
                  <div className="w-full flex flex-col h-full">
                    {activeModalTab === 'diff_table' && (
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 sticky left-0 z-40">
                        <div>
                          <h4 className="font-black text-[#621f32] dark:text-[#bc955c] uppercase text-sm">
                            {comparingIndex === 0 ? "Registro Inicial" : "Comparación Detallada"}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {comparingIndex === 0 ? "Vista tabular completa del estado inicial de la posición." : "Vista tabular completa: el movimiento seleccionado vs. su estado inmediato anterior."}
                          </p>
                        </div>
                        <button onClick={() => { setActiveModalTab('timeline'); setComparingIndex(null); }} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-600 dark:text-slate-300 hover:text-[#621f32] transition-colors shadow-sm active:scale-95 flex items-center gap-2">
                          ← Volver a Línea del Tiempo
                        </button>
                      </div>
                    )}
                    <div className="w-full overflow-auto">
                    {tableDataToRender && tableDataToRender.length > 0 ? (
                      <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 50 + columns.reduce((sum, col) => sum + col.width, 0) }}>
                        <colgroup><col style={{ width: 50 }} />{columns.map(col => <col key={col.key} style={{ width: col.width }} />)}</colgroup>
                        <thead className="bg-[#501929]/90 dark:bg-[#3e131f]/90 text-white sticky top-0 z-30 shadow-md border-b border-[#bc955c]/30">
                          <tr>
                            <th className="sticky left-0 top-0 z-40 bg-[#40121e]/90 dark:bg-[#2b0d15]/90 backdrop-blur-md border-r border-b border-[#621f32]/35 w-[50px] min-w-[50px] text-center align-middle">#</th>
                            {columns.map((col, index) => (
                              <th key={col.key} className="relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors bg-[#501929] text-slate-200">
                                <div className="flex flex-col items-center gap-1 w-full">
                                  <span className="text-[9px] font-mono text-[#bc955c]">{getColumnLetter(index)}</span>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-1.5 flex-1 truncate py-0.5"><span>{col.label}</span></div>
                                  </div>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {tableDataToRender.map((rowData, index) => (
                            <tr key={rowData.id || index} className="hover:bg-[#621f32]/[0.015] h-[37px]">
                              <td className={`sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle ${activeModalTab === 'diff_table' && index === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : activeModalTab === 'diff_table' && index === 1 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30' : 'bg-slate-50/85 text-slate-400'}`}>
                                {activeModalTab === 'diff_table' ? (index === 0 ? 'Ahora' : 'Antes') : (tableDataToRender.length - index)}
                              </td>
                              {columns.map((col) => {
                                const val = rowData[col.key];
                                if (col.key === "estado_psn") {
                                  const badge = MOV_STATUS_BADGE_STYLES[val] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: val };
                                  return (
                                    <td key={col.key} className="px-4 text-[10px] border-r align-middle h-[37px] transition-all bg-white/10">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
                                        {badge.label}
                                      </span>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={col.key} className={`px-4 text-xs border-r truncate h-[37px] align-middle bg-white/10 text-slate-700 ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"}`}>
                                    {val === undefined || val === null || String(val).trim() === "" ? <span className="text-slate-300">-</span> : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-20 text-slate-500 font-medium">No se encontraron registros de historia para esta posición.</div>
                    )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
                    <div className="relative max-w-md mx-auto sm:mx-0 w-full ml-4 sm:ml-6">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="size-4 text-slate-400" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Buscar por motivo o código..." 
                        value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#621f32]/50 focus:border-[#621f32] sm:text-sm transition-all shadow-sm"
                      />
                    </div>
                    {filteredTimelineData && filteredTimelineData.length > 0 ? (
                      <div className="relative border-l-2 border-[#621f32]/20 ml-4 sm:ml-6 flex flex-col gap-8 sm:gap-10 py-4">
                        {filteredTimelineData.map((row, index) => (
                          <div 
                            key={row.id || index} 
                            className="relative pl-8 sm:pl-10 group cursor-pointer"
                            onClick={() => {
                              setComparingIndex(index);
                              setActiveModalTab('diff_table');
                            }}
                          >
                            <div className="absolute -left-[11px] top-1 size-5 rounded-full bg-white dark:bg-slate-900 border-4 border-[#621f32] dark:border-[#bc955c] group-hover:scale-125 transition-transform shadow-md" />
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm transition-all rounded-none border-l-4 border-l-[#621f32] dark:border-l-[#bc955c] hover:shadow-lg hover:border-[#621f32]/60">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <h4 className="text-base font-black text-slate-800 dark:text-white uppercase">{row.motivo || 'Actualización Inicial'}</h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.bg || 'bg-slate-50'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.text || 'text-slate-600'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.border || 'border-slate-200'}`}>{MOV_STATUS_BADGE_STYLES[row.estado_psn]?.label || row.estado_psn || '-'}</span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-400">Cod. Motivo: <span className="font-mono text-slate-500 dark:text-slate-300">{row.cd_motivo || 'N/A'}</span></p>
                                </div>
                                <span className="bg-[#621f32]/5 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c] px-4 py-1.5 rounded-none text-xs font-black uppercase border border-[#621f32]/20 dark:border-[#bc955c]/30">
                                  Efectiva: {row.f_efva || '-'}
                                </span>
                              </div>
                              
                              {row.changes && row.changes.length > 0 ? (
                                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/60">
                                  <p className="text-[10px] uppercase font-black tracking-widest text-[#621f32] dark:text-[#bc955c] mb-4">Cambios Detectados</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {row.changes.map((change, cIdx) => (
                                      <div key={cIdx} className="bg-slate-50/80 dark:bg-slate-950/50 rounded-lg p-3 border border-slate-200/60 dark:border-slate-800">
                                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-2 truncate" title={change.label}>{change.label}</p>
                                        <div className="flex flex-col gap-1.5">
                                          <div className="flex items-start gap-2">
                                            <span className="text-[8px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-1 py-0.5 rounded border border-rose-200 dark:border-rose-900 w-10 text-center shrink-0">Antes</span>
                                            <span className="text-xs font-medium text-slate-500 line-through truncate" title={change.before}>{change.before}</span>
                                          </div>
                                          <div className="flex items-start gap-2">
                                            <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded border border-emerald-200 dark:border-emerald-900 w-10 text-center shrink-0">Ahora</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={change.after}>{change.after}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                index === 0 ? (
                                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                                    Registro inicial o creación de la posición.
                                  </div>
                                ) : (
                                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                                    No se detectaron cambios estructurales en este movimiento.
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-slate-500 font-medium">No se encontraron registros de historia para esta posición.</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Detalle de Celda Completa */}
      <AnimatePresence>
        {isCellModalOpen && selectedCell && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCellModalOpen(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#621f32] text-white rounded-lg">
                    <Search className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Detalle de Celda</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getColumnLetter(selectedCell.col)}{selectedCell.row + 1}</p>
                  </div>
                </div>
                <button onClick={() => setIsCellModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X className="size-5" /></button>
              </div>
              <div className="p-8 flex flex-col gap-6">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 block">Columna</label>
                  <p className="text-base font-bold text-[#621f32] dark:text-[#bc955c]">{columns.filter(c => c.visible)[selectedCell.col]?.label}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 block">Valor completo</label>
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed break-words whitespace-pre-wrap">
                      {(() => { 
                        const row = filteredSortedData[selectedCell.row];
                        const col = columns.filter(c => c.visible)[selectedCell.col];
                        const v = row?.[col?.key]; 
                        if (!v) return "(Vacío)";
                        return String(v); 
                      })()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 text-right bg-slate-50/30 dark:bg-slate-800/10">
                <button onClick={() => setIsCellModalOpen(false)} className="px-6 py-2.5 bg-slate-900 dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[10px] font-black uppercase rounded-xl transition-all hover:opacity-90 active:scale-95">Cerrar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
      {selectedRowData && (() => {
        const mappedEmployee = {
          ...selectedRowData,
          id_empleado: selectedRowData.no_empleado,
          nombres: selectedRowData.nombre_completo,
          nivel: selectedRowData.nivel || selectedRowData.nivel_tabular,
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
    </div>
  );
}
