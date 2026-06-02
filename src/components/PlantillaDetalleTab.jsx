"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Download, Columns, Filter, ArrowUpDown, ChevronLeft, 
  ChevronRight as ChevronRightIcon, ChevronDown, ChevronsLeft, ChevronsRight, 
  X, Check, RotateCcw, Activity, Users, UserCheck, UserMinus, 
  UserX, CalendarDays, Briefcase, Network, ArrowUp, ArrowUpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";

const STATUS_COLORS = { "Activo": "#621f32", "Vacante": "#bc955c", "Suspendido": "#3b82f6", "Licencia": "#8b5cf6", "Licencia Médica": "#10b981" };
const STATUS_ICONS = { "Activo": UserCheck, "Vacante": UserMinus, "Suspendido": UserX, "Licencia": CalendarDays, "Licencia Médica": Activity };
const STATUS_BADGE_STYLES = {
  "Activo": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30" },
  "Vacante": { bg: "bg-[#bc955c]/8 dark:bg-[#bc955c]/15", text: "text-[#a37944] dark:text-[#ebd1ac]", border: "border-[#bc955c]/20 dark:border-[#bc955c]/30" },
  "Suspendido": { bg: "bg-blue-50/50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-300", border: "border-blue-200/50 dark:border-blue-900/40" },
  "Licencia": { bg: "bg-purple-50/50 dark:bg-purple-950/20", text: "text-purple-600 dark:text-purple-300", border: "border-purple-200/50 dark:border-purple-900/40" },
  "Licencia Médica": { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/50 dark:border-emerald-900/40" }
};

const mapEstadoNomina = (val) => {
  if (!val || val.trim() === "") return "Vacante";
  switch (val.trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Licencia";
    case "P": return "Licencia Médica";
    default: return "Vacante";
  }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Configuración de todas las claves posibles (fuera del componente para evitar re-creación)
const ALL_DETAIL_KEYS = [
  "posicion", "estado_nomina", "id_empleado", "rfc", "curp", "nombres", "motivo", 
  "fecha_efectiva_personal", "fecha_de_captura", "qna", "fecha_prevista_de_salida", 
  "nj", "codigo_presupuestal", "nivel", "numeral", "ua", "cent", "dir", "subd", "jd", 
  "depto", "aduana", "tipo", "estado", "municipio", "ua2", "escala", "smb", "smn", 
  "partida", "tipo_de_contratacion", "cd_un", "unidad_de_negocio", "cd_ua", 
  "unidad_administrativa", "cd_pto_funcional", "nombre_puesto_funcional", 
  "id_departamento", "departamento", "dependencia_directa", "observaciones", 
  "ubicacion", "descripcion_ubicacion", "posicion_civil_sedena_semar", 
  "personal_militar_o_civil", "tipo_de_personal_sedena_semar", "rango", 
  "fecha_de_ingreso", "val_estat", "status_jefe_inm_posicion", "numempleado", 
  "sindicato", "entidad_federativa", "tipo_de_aduana", "dg_o_aduana_compactada", 
  "estado_en_nomina", "ua_validacion", "validando_posicion_por_documento", 
  "nj_comp", "nj_ok", "columna", "nombre_nj", "nj_operativo_comb"
];

const DATE_KEYS = ["fecha_efectiva_personal", "fecha_de_captura", "fecha_prevista_de_salida", "fecha_de_ingreso"];

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

export default function PlantillaDetalleTab({ detalle = [], resumen = {}, isPending, startTransition, cardRef, isLoading }) {
  const [mounted, setMounted] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  useEffect(() => setMounted(true), []);
  const [columns, setColumns] = useState([
    { key: "posicion", label: "Posición", width: 110, visible: true, isBasic: true },
    { key: "estado_nomina", label: "Estado Nómina", width: 120, visible: true, isBasic: true },
    { key: "id_empleado", label: "Id Empleado", width: 115, visible: true, isBasic: true },
    { key: "rfc", label: "RFC", width: 140, visible: true, isBasic: true },
    { key: "curp", label: "CURP", width: 185, visible: true, isBasic: true },
    { key: "nombres", label: "Nombres", width: 280, visible: true, isBasic: true },
    { key: "motivo", label: "Motivo", width: 200, visible: true, isBasic: true },
    { key: "fecha_efectiva_personal", label: "Fecha efectiva (Personal)", width: 180, visible: true, isBasic: true },
    { key: "fecha_de_captura", label: "Fecha de captura", width: 150, visible: true, isBasic: true },
    { key: "qna", label: "Qna", width: 80, visible: true, isBasic: true },
    { key: "fecha_prevista_de_salida", label: "Fecha prevista de salida", width: 180, visible: true, isBasic: true },
    { key: "nj", label: "NJ", width: 120, visible: true, isBasic: true },
    { key: "codigo_presupuestal", label: "Código Presupuestal", width: 150, visible: true, isBasic: true },
    { key: "nivel", label: "Nivel", width: 85, visible: true, isBasic: true },

    { key: "numeral", label: "numeral", width: 100, visible: false, isBasic: false },
    { key: "ua", label: "ua", width: 150, visible: false, isBasic: false },
    { key: "cent", label: "cent", width: 80, visible: false, isBasic: false },
    { key: "dir", label: "dir", width: 80, visible: false, isBasic: false },
    { key: "subd", label: "subd", width: 80, visible: false, isBasic: false },
    { key: "jd", label: "jd", width: 80, visible: false, isBasic: false },
    { key: "depto", label: "depto", width: 120, visible: false, isBasic: false },
    { key: "aduana", label: "Aduana", width: 200, visible: false, isBasic: false },
    { key: "tipo", label: "tipo", width: 130, visible: false, isBasic: false },
    { key: "estado", label: "estado", width: 150, visible: false, isBasic: false },
    { key: "municipio", label: "municipio", width: 180, visible: false, isBasic: false },
    { key: "ua2", label: "ua2", width: 200, visible: false, isBasic: false },
    { key: "escala", label: "Escala", width: 120, visible: false, isBasic: false },
    { key: "smb", label: "SMB", width: 100, visible: false, isBasic: false },
    { key: "smn", label: "SMN", width: 100, visible: false, isBasic: false },
    { key: "partida", label: "Partida", width: 100, visible: false, isBasic: false },
    { key: "tipo_de_contratacion", label: "TIPO DE CONTRATACIÓN", width: 180, visible: false, isBasic: false },
    { key: "cd_un", label: "Cd UN", width: 100, visible: false, isBasic: false },
    { key: "unidad_de_negocio", label: "Unidad de Negocio", width: 250, visible: false, isBasic: false },
    { key: "cd_ua", label: "Cd UA", width: 100, visible: false, isBasic: false },
    { key: "unidad_administrativa", label: "Unidad Administrativa", width: 280, visible: false, isBasic: false },
    { key: "cd_pto_funcional", label: "Cd Pto Funcional", width: 120, visible: false, isBasic: false },
    { key: "nombre_puesto_funcional", label: "Nombre Puesto Funcional", width: 250, visible: false, isBasic: false },
    { key: "id_departamento", label: "Id Departamento", width: 120, visible: false, isBasic: false },
    { key: "departamento", label: "Departamento", width: 200, visible: false, isBasic: false },
    { key: "dependencia_directa", label: "DependenciaDirecta", width: 250, visible: false, isBasic: false },
    { key: "observaciones", label: "OBSERVACIONES", width: 200, visible: false, isBasic: false },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: false, isBasic: false },
    { key: "descripcion_ubicacion", label: "Descripción ubicación", width: 200, visible: false, isBasic: false },
    { key: "posicion_civil_sedena_semar", label: "Posición _Civil / SEDENA / SEMAR", width: 250, visible: false, isBasic: false },
    { key: "personal_militar_o_civil", label: "Personal Militar o Civil", width: 180, visible: false, isBasic: false },
    { key: "tipo_de_personal_sedena_semar", label: "Tipo de personal SEDENA / SEMAR", width: 220, visible: false, isBasic: false },
    { key: "rango", label: "Rango", width: 150, visible: false, isBasic: false },
    { key: "fecha_de_ingreso", label: "Fecha de ingreso", width: 130, visible: false, isBasic: false },
    { key: "val_estat", label: "Val_estat", width: 100, visible: false, isBasic: false },
    { key: "status_jefe_inm_posicion", label: "Status Jefe Inm Posición", width: 180, visible: false, isBasic: false },
    { key: "numempleado", label: "Numempleado", width: 120, visible: false, isBasic: false },
    { key: "sindicato", label: "Sindicato", width: 150, visible: false, isBasic: false },
    { key: "entidad_federativa", label: "Entidad Federativa", width: 180, visible: false, isBasic: false },
    { key: "tipo_de_aduana", label: "Tipo de Aduana", width: 130, visible: false, isBasic: false },
    { key: "dg_o_aduana_compactada", label: "DG o Aduana compactada", width: 200, visible: false, isBasic: false },
    { key: "estado_en_nomina", label: "Estado en nomina", width: 150, visible: false, isBasic: false },
    { key: "ua_validacion", label: "UA Validación", width: 180, visible: false, isBasic: false },
    { key: "validando_posicion_por_documento", label: "Validando de posición por documento", width: 250, visible: false, isBasic: false },
    { key: "nj_comp", label: "NJ COMP", width: 150, visible: false, isBasic: false },
    { key: "nj_ok", label: "NJ OK", width: 150, visible: false, isBasic: false },
    { key: "columna", label: "Columna", width: 150, visible: false, isBasic: false },
    { key: "nombre_nj", label: "nombreNJ", width: 150, visible: false, isBasic: false },
    { key: "nj_operativo_comb", label: "NJOperativoComb", width: 150, visible: false, isBasic: false },
  ]);

  const [globalSearch, setGlobalSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState({ estado_nomina: ["Activo"] });
  const [textFilters, setTextFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [activeConditionDropdown, setActiveConditionDropdown] = useState(null);
  const [tempSelectedValues, setTempSelectedValues] = useState([]);
  const [filterSearchText, setFilterSearchText] = useState("");
  const [columnSearchText, setColumnSearchText] = useState("");
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [isCadenaModalOpen, setIsCadenaModalOpen] = useState(false);
  const [cadenaQuery, setCadenaQuery] = useState("");
  const [cadenaData, setCadenaData] = useState(null);
  const [showCadenaSuggestions, setShowCadenaSuggestions] = useState(false);
  const cadenaSuggestions = useMemo(() => {
    const q = cadenaQuery.trim().toLowerCase();
    if (q.length < 2 || !detalle) return [];
    return detalle.filter(row => 
      String(row.posicion || "").toLowerCase().includes(q) ||
      String(row.nombres || "").toLowerCase().includes(q) ||
      String(row.numempleado || "").toLowerCase().includes(q)
    ).slice(0, 5);
  }, [cadenaQuery, detalle]);
  const [isCadenaLoading, setIsCadenaLoading] = useState(false);
  const [cadenaError, setCadenaError] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [cardWidth, setCardWidth] = useState(null);
  const [expandedDateNodes, setExpandedDateNodes] = useState({});

  const handleBuscarCadena = async (e) => {
    e?.preventDefault();
    if (!cadenaQuery.trim()) return;
    setIsCadenaLoading(true);
    setCadenaError(null);
    setCadenaData(null);
    try {
      const response = await VacantesService.getCadenaMando(cadenaQuery.trim());
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detail || "Error al buscar la cadena de mando");
      }
      setCadenaData(data);
    } catch (err) {
      setCadenaError(err.message || "Error al buscar la cadena de mando");
    } finally {
      setIsCadenaLoading(false);
    }
  };

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

  const isMonoColumn = useCallback((key) => ["posicion", "id_empleado", "rfc", "curp", "nivel", "codigo_presupuestal", "ua", "cd_ua", "cent", "dir", "subd", "jd", "depto", "numeral"].includes(key), []);

  const toggleColumnVisibility = (key) => {
    setColumns(prev => prev.map(col => (col.key === key ? { ...col, visible: !col.visible } : col)));
  };

  const isDateColumn = useCallback((colKey) => {
    return DATE_KEYS.includes(colKey);
  }, []);

  // OPTIMIZACIÓN CRÍTICA: Los cálculos pesados dependen solo de los datos y de la columna activa
  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      detalle.forEach(row => {
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
  }, [detalle, activeFilterDropdown, parseDateParts]);

  const uniqueColumnValues = useMemo(() => {
    const valuesMap = {};
    const targetKeys = ["estado_nomina"];
    if (activeFilterDropdown && !targetKeys.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const counts = {};
      detalle.forEach(row => {
        let val = key === "estado_nomina" ? mapEstadoNomina(row[key]) : String(row[key] || "").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      valuesMap[key] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    });
    return valuesMap;
  }, [detalle, activeFilterDropdown]);

  const toggleDateNode = (path) => {
    setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      targetRawValues = detalle
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'month') {
      const year = parentPath;
      targetRawValues = detalle
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      targetRawValues = detalle
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

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) setActiveFilterDropdown(null);
    else {
      setActiveFilterDropdown(colKey);
      setFilterSearchText("");
      setTempSelectedValues(columnFilters[colKey] || uniqueColumnValues[colKey].map(v => v.value));
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
    startTransition(() => { 
      setColumnFilters({}); 
      setTextFilters({});
      setGlobalSearch(""); 
      setSortConfig({ key: null, direction: null }); 
    });
  };

  const handleStatusFilter = (label) => {
    const current = columnFilters["estado_nomina"] || [];
    const next = current.includes(label) ? current.filter(s => s !== label) : [...current, label];
    const newFilters = { ...columnFilters };
    if (next.length === 0 || next.length === uniqueColumnValues["estado_nomina"]?.length) delete newFilters["estado_nomina"];
    else newFilters["estado_nomina"] = next;
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
    let result = detalle.filter(row => {
      if (deferredGlobalSearch) {
        const searchText = deferredGlobalSearch.toLowerCase();
        if (!Object.entries(row).some(([key, val]) => (key === "estado_nomina" ? mapEstadoNomina(val) : String(val || "")).toLowerCase().includes(searchText))) return false;
      }
      for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals.includes(colKey === "estado_nomina" ? mapEstadoNomina(row[colKey]) : String(row[colKey] || "").trim())) return false;
      }
      for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {
        if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
        const searchText = filterObj.value;
        const condition = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        
        const val = colKey === "estado_nomina" ? mapEstadoNomina(row[colKey]) : String(row[colKey] || "");
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
      return true;
    });
    if (sortConfig.key && sortConfig.direction) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let valA = key === "estado_nomina" ? mapEstadoNomina(a[key]) : String(a[key] || "").trim();
        let valB = key === "estado_nomina" ? mapEstadoNomina(b[key]) : String(b[key] || "").trim();
        const numA = Number(valA), numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) return direction === "asc" ? numA - numB : numB - numA;
        return direction === "asc" ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }
    return result;
  }, [detalle, deferredGlobalSearch, columnFilters, deferredTextFilters, sortConfig, isMonoColumn]);

  const rowHeight = 37, containerHeight = 800;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Plantilla_Empleados");

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
          dataRow[col.key] = col.key === "estado_nomina" ? mapEstadoNomina(row[col.key]) : row[col.key];
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
      a.download = "Plantilla_Empleados_Activos.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error al exportar a Excel: " + error.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const donutData = useMemo(() => {
    const total = resumen?.total_registros || 11957;
    const slices = [
      { label: "Activo", count: resumen?.Activo || 9421, color: STATUS_COLORS["Activo"] },
      { label: "Vacante", count: resumen?.Vacante || 2482, color: STATUS_COLORS["Vacante"] },
      { label: "Suspendido", count: resumen?.Suspendido || 23, color: STATUS_COLORS["Suspendido"] },
      { label: "Licencia Médica", count: resumen?.Licencia_Medica || 27, color: STATUS_COLORS["Licencia Médica"] },
      { label: "Licencia", count: resumen?.Licencia || 4, color: STATUS_COLORS["Licencia"] }
    ];
    let cumulativePercent = 0;
    return slices.map(slice => {
      const percent = slice.count / total, startPercent = cumulativePercent;
      cumulativePercent += percent;
      const endPercent = cumulativePercent;
      const getCoords = (p) => { const angle = 2 * Math.PI * p - Math.PI / 2; return [Math.cos(angle), Math.sin(angle)]; };
      const [startX, startY] = getCoords(startPercent), [endX, endY] = getCoords(endPercent);
      const largeArc = percent > 0.5 ? 1 : 0;
      return { ...slice, percent, pathData: `M ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} L 0 0 Z` };
    });
  }, [resumen]);

  const activeHoverData = hoveredSlice !== null ? donutData[hoveredSlice] : null;
  const activeStatusFilter = columnFilters["estado_nomina"] || [];

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6">
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch">
            <div className="lg:col-span-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center min-h-[180px]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 w-full text-center">Distribución de Estatus</h3>
              <div className="relative size-28 flex items-center justify-center">
                <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90 select-none"><defs><mask id="donut-mask-detalle"><circle cx="0" cy="0" r="1" fill="white" /><circle cx="0" cy="0" r="0.65" fill="black" /></mask></defs><g mask="url(#donut-mask-detalle)">{donutData.map((slice, i) => (<path key={slice.label} d={slice.pathData} fill={slice.color} className="cursor-pointer transition-all duration-300 origin-center hover:opacity-90" style={{ transform: hoveredSlice === i ? "scale(1.04)" : "scale(1.0)", opacity: activeStatusFilter.length > 0 && !activeStatusFilter.includes(slice.label) ? 0.35 : 1 }} onMouseEnter={() => setHoveredSlice(i)} onMouseLeave={() => setHoveredSlice(null)} onClick={() => handleStatusFilter(slice.label)} />))}</g></svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center flex-col p-1"><AnimatePresence mode="wait">{activeHoverData ? (<motion.div key={activeHoverData.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}><span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[80px]">{activeHoverData.label}</span><br /><span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">{formatNumber(activeHoverData.count)}</span><br /><span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full mt-1 border border-current" style={{ color: activeHoverData.color, backgroundColor: `${activeHoverData.color}15` }}>{(activeHoverData.percent * 100).toFixed(1)}%</span></motion.div>) : (<motion.div key="total" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}><span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total</span><br /><span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">{formatNumber(resumen?.total_registros || 11957)}</span><br /><span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full">100%</span></motion.div>)}</AnimatePresence></div>
              </div>
            </div>
            <div className="lg:col-span-9 grid grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3">{donutData.map((slice, index) => { const IconComponent = STATUS_ICONS[slice.label] || Users; const isActiveFilter = activeStatusFilter.includes(slice.label); return (<motion.div key={slice.label} onMouseEnter={() => setHoveredSlice(index)} onMouseLeave={() => setHoveredSlice(null)} onClick={() => handleStatusFilter(slice.label)} whileHover={{ scale: 1.03, y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className={`rounded-xl px-3 py-3 border-2 transition-all duration-200 shadow-sm flex flex-col justify-between group cursor-pointer relative overflow-hidden ${isActiveFilter ? "border-[#621f32] dark:border-[#bc955c] shadow-md bg-white dark:bg-slate-900" : activeStatusFilter.length > 0 ? "border-slate-200/50 dark:border-slate-800/80 opacity-55 hover:opacity-85 bg-white/60 dark:bg-slate-900/60" : hoveredSlice === index ? "border-[#621f32]/40 dark:border-[#bc955c]/40 shadow-md bg-white dark:bg-slate-900" : "border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60"}`}><div className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-200 pointer-events-none" style={{ backgroundColor: slice.color }} />{isActiveFilter && (<div className="absolute top-2 right-2 z-20"><span className="relative flex size-1.5 rounded-full" style={{ backgroundColor: slice.color }}><span className="animate-ping absolute inline-flex size-1.5 rounded-full opacity-75" style={{ backgroundColor: slice.color }} /></span></div>)}<div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${slice.color}15`, color: slice.color }}><IconComponent className="size-3.5" /></div><span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{slice.label}</span></div><div><h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{formatNumber(slice.count)}</h4><div className="w-full bg-slate-100 dark:bg-slate-800/60 h-1 rounded-full overflow-hidden mt-2"><motion.div className="h-full rounded-full" style={{ backgroundColor: slice.color }} initial={{ width: 0 }} animate={{ width: `${slice.percent * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} /></div><p className="text-[8px] font-bold text-slate-400 mt-1">{(slice.percent * 100).toFixed(1)}%</p></div></motion.div>); })}<motion.div whileHover={{ scale: 1.03, y: -2 }} onClick={() => { startTransition(() => setColumnFilters({})); }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className={`bg-gradient-to-br from-[#621f32] via-[#4d1827] to-[#bc955c] rounded-xl px-3 py-3 shadow-md flex flex-col justify-between text-white relative overflow-hidden group cursor-pointer transition-all duration-200 ${activeStatusFilter.length === 0 ? "ring-2 ring-white/30 shadow-lg" : ""}`}><div className="absolute -top-8 -right-8 size-24 bg-[#bc955c]/15 rounded-full blur-xl group-hover:bg-[#bc955c]/25 transition-colors duration-300 pointer-events-none" /><div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-white/10 text-white rounded-lg flex items-center justify-center flex-shrink-0"><Briefcase className="size-3.5" /></div><span className="text-[9px] font-black uppercase tracking-wider text-white/70 truncate">Posiciones Totales</span></div><div><h4 className="text-xl font-black tracking-tight text-white leading-none">{formatNumber(resumen?.total_registros || 11957)}</h4><div className="w-full bg-white/15 h-1 rounded-full overflow-hidden mt-2"><div className="h-full bg-white/60 rounded-full w-full" /></div><p className="text-[8px] font-bold text-white/60 mt-1">100%</p></div></motion.div></div>
          </div>
        </Zoom>
      </div>

      <div className="w-full flex justify-center mt-4">
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl max-h-[calc(100vh-144px)] h-fit flex flex-col sticky bottom-0 z-30 overflow-hidden w-full scroll-mt-36" style={{ width: cardWidth ? `${cardWidth}px` : '100%', maxWidth: cardWidth ? 'none' : '100%' }}>
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); startTransition(() => setGlobalSearch(e.target.value)); }} placeholder="Buscar..." className="bg-transparent text-slate-800 text-xs font-bold w-full outline-none" />
                  {searchQuery && <button onClick={() => { setSearchQuery(""); startTransition(() => setGlobalSearch("")); }} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none">{formatNumber(filteredSortedData.length)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{activeStatusFilter.map(status => (<button key={status} onClick={() => handleStatusFilter(status)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm transition-all hover:opacity-80 active:scale-95 cursor-pointer" style={{ backgroundColor: `${STATUS_COLORS[status]}12`, color: STATUS_COLORS[status], borderColor: `${STATUS_COLORS[status]}30` }}>{STATUS_ICONS[status] && React.createElement(STATUS_ICONS[status], { className: "size-3" })}<span>{status}</span><X className="size-3" /></button>))}</div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {selectedCell && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 py-2 px-3.5 bg-[#621f32]/5 dark:bg-[#bc955c]/5 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 group">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[#621f32] dark:text-[#bc955c] flex-shrink-0">{getColumnLetter(selectedCell.col)}{selectedCell.row + 1}</span>
                      <span className="hidden md:inline whitespace-nowrap">Col: <strong className="text-slate-700 dark:text-slate-200">{columns.filter(c => c.visible)[selectedCell.col]?.label}</strong></span>
                      <span className="opacity-30 hidden md:inline">|</span>
                      <span className="max-w-[150px] sm:max-w-[300px] lg:max-w-[450px] truncate">Val: <strong className="text-slate-700 dark:text-slate-200">{(() => { const v = filteredSortedData[selectedCell.row]?.[columns.filter(c => c.visible)[selectedCell.col]?.key]; if (!v) return "-"; if (columns.filter(c => c.visible)[selectedCell.col]?.key === "estado_nomina") return mapEstadoNomina(v); return String(v); })()}</strong></span>
                      <button onClick={() => setIsCellModalOpen(true)} className="ml-1 p-1 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] rounded-md shadow-sm hover:opacity-90 active:scale-95 transition-all flex-shrink-0" title="Ver detalle completo"><ChevronRightIcon className="size-3" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={resetAllFilters} disabled={Object.keys(columnFilters).length === 0 && !globalSearch && !sortConfig.key && !Object.values(textFilters).some(v => v && v.value)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-900/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all duration-300 shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"><RotateCcw className="size-3.5" /><span>Restablecer Filtros</span></button>
              <button onClick={() => setIsCadenaModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 to-white dark:from-slate-900 dark:to-slate-950 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer flex-shrink-0"><Network className="size-3.5" /><span>Cadena de Mando</span></button>
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"><Columns className="size-3.5" /><span>Columnas</span></button>
              <button 
                onClick={handleExportExcel} 
                disabled={isExportingExcel}
                className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 disabled:opacity-75 disabled:pointer-events-none"
              >
                {isExportingExcel ? (
                  <div className="size-3.5 border-2 border-white/20 border-t-white dark:border-[#3e131f]/20 dark:border-t-[#3e131f] rounded-full animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>{isExportingExcel ? "Cargando..." : "Excel"}</span>
              </button>
            </div>
          </div>

          <div onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="overflow-auto relative flex-1 mx-2 lg:mx-6 mb-4 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner" style={{ height: '75vh', minHeight: '600px' }}>
            <AnimatePresence>{isPending && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/30 backdrop-blur-[3px] z-40 flex items-center justify-center"><div className="flex flex-col items-center gap-3.5 p-6 bg-white/95 rounded-[2rem] shadow-2xl border border-slate-200/50"><div className="size-8 border-[4px] border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" /><span className="text-[10px] font-black uppercase text-[#621f32] bg-[#621f32]/5 px-3.5 py-1 rounded-xl">Procesando...</span></div></motion.div>)}</AnimatePresence>
            <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 50 + columns.filter(c => c.visible).reduce((sum, col) => sum + col.width, 0) }}>
              <colgroup><col style={{ width: 50 }} />{columns.filter(c => c.visible).map(col => <col key={col.key} style={{ width: col.width }} />)}</colgroup>
              <thead className="bg-[#501929]/90 dark:bg-[#3e131f]/90 text-white sticky top-0 z-30 shadow-md">
                <tr>
                  <th className="sticky left-0 top-0 z-40 bg-[#40121e]/90 text-center align-middle border-r border-[#621f32]/35">#</th>
                  {columns.filter(c => c.visible).map((col, index) => (<th key={col.key} className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${selectedCell?.col === index ? "bg-[#621f32] text-white" : "bg-[#501929] text-slate-200"}`}><div className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => handleMouseDown(e, columns.findIndex(c => c.key === col.key), 'left')} /><div className="flex flex-col items-center gap-1 w-full"><span className="text-[9px] font-mono text-[#bc955c]">{getColumnLetter(index)}</span><div className="flex items-center justify-between w-full"><div onClick={() => handleSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5"><span>{col.label}</span><ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} /></div><button onClick={(e) => { e.stopPropagation(); openFilterDropdown(col.key); }} className={`p-1 rounded-md transition-colors ${columnFilters[col.key] ? "text-amber-300" : "text-white/60"}`}><Filter className="size-3 fill-current" /></button></div></div><div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => handleMouseDown(e, columns.findIndex(c => c.key === col.key), 'right')} /></th>))}
                </tr>
                <tr className="bg-[#40121e]/80 dark:bg-[#2b0d15]/80 backdrop-blur-md">
                  <th className="sticky left-0 z-40 bg-[#40121e]/90 dark:bg-[#2b0d15]/90 border-r border-[#621f32]/35">
                    <button 
                      onClick={() => setTextFilters({})}
                      disabled={!mounted || (Object.keys(textFilters).length === 0 || Object.values(textFilters).every(v => !v || !v.value))}
                      title="Limpiar filtros de columna"
                      className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </th>
                  {columns.filter(c => c.visible).map((col) => {
                    const filterObj = textFilters[col.key] || { value: "", condition: isMonoColumn(col.key) ? "starts_with" : "contains" };
                    const condition = filterObj.condition || (isMonoColumn(col.key) ? "starts_with" : "contains");
                    
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
                      <th key={`filter-${col.key}`} className="p-1.5 border-r border-[#621f32]/30 relative">
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
              <tbody ref={tbodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-450 uppercase tracking-widest animate-pulse">Cargando plantilla (11,955 registros)...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.filter(c => c.visible).length + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="size-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <Search className="size-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-700 dark:text-slate-300">Sin coincidencias</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">Intenta ajustar tus filtros de búsqueda</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {startIndex > 0 && <tr style={{ height: startIndex * rowHeight }}><td colSpan={columns.filter(c => c.visible).length + 1} /></tr>}
                    {paginatedData.map((row, rowIdx) => { const actualRowIdx = startIndex + rowIdx; return (<tr key={row.id || actualRowIdx} className="hover:bg-[#621f32]/[0.015] h-[37px]" onClick={() => setSelectedCell({ row: actualRowIdx, col: selectedCell?.col ?? 0 })}><td className={`sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle ${selectedCell?.row === actualRowIdx ? "bg-[#621f32]/20 text-[#621f32] font-black border-l-[#621f32] border-l-2" : "bg-slate-50/85 text-slate-400"}`}>{actualRowIdx + 1}</td>{columns.filter(c => c.visible).map((col, colIdx) => { const val = row[col.key], isSelected = selectedCell?.row === actualRowIdx && selectedCell?.col === colIdx; if (col.key === "estado_nomina") { const est = mapEstadoNomina(val), Icon = STATUS_ICONS[est] || UserCheck, badge = STATUS_BADGE_STYLES[est] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" }; return (<td key={col.key} onClick={(e) => { e.stopPropagation(); setSelectedCell({ row: actualRowIdx, col: colIdx }); }} className={`px-4 text-[10px] border-r align-middle h-[37px] transition-all ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : "bg-white/10"}`}><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}><Icon className="size-3" />{est}</span></td>); } return (<td key={col.key} onClick={(e) => { e.stopPropagation(); setSelectedCell({ row: actualRowIdx, col: colIdx }); }} className={`px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : "bg-white/10 text-slate-700"} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"}`}>{val === undefined || val === null || String(val).trim() === "" ? <span className="text-slate-300 dark:text-slate-700 italic">-</span> : String(val)}</td>); })}</tr>); })}
                    {endIndex < filteredSortedData.length && <tr style={{ height: (filteredSortedData.length - endIndex) * rowHeight }}><td colSpan={columns.filter(c => c.visible).length + 1} /></tr>}
                  </>
                )}
              </tbody>
            </table>
          </div>


          <div className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />
        </div>
      </div>

      {mounted && createPortal(
        <>
        <AnimatePresence>
          {isColumnsModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsColumnsModalOpen(false)} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full flex flex-col z-[100] overflow-hidden max-h-[90vh]">
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
                  <button onClick={() => setIsColumnsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="size-6" /></button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-[1.2rem] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#621f32]/10 transition-all">
                    <Search className="size-4 text-slate-400 mr-3" />
                    <input 
                      type="text" 
                      value={columnSearchText} 
                      onChange={(e) => setColumnSearchText(e.target.value)} 
                      placeholder="Buscar columna por nombre..." 
                      className="bg-transparent text-sm w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400" 
                    />
                    {columnSearchText && <button onClick={() => setColumnSearchText("")} className="text-slate-300 hover:text-slate-500 ml-2"><X className="size-4" /></button>}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => startTransition(() => setColumns(prev => prev.map(c => ({ ...c, visible: true }))))}
                      className="flex-1 sm:flex-none px-5 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                    >
                      Mostrar todas
                    </button>
                    <button 
                      onClick={() => startTransition(() => setColumns(prev => prev.map(c => ({ ...c, visible: false }))))}
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
                      className={`flex items-start gap-4 p-4 border-2 rounded-[1.5rem] text-left transition-all duration-200 group relative overflow-hidden ${
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
                {columns.filter(col => col.label.toLowerCase().includes(columnSearchText.toLowerCase())).length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Search className="size-12 mb-4 opacity-20" />
                    <p className="font-bold">No se encontraron columnas</p>
                  </div>
                )}
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
            </div>
          )}
        </AnimatePresence>

      <AnimatePresence>
        {isCadenaModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCadenaModalOpen(false)} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col z-[100] overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 sticky top-0">
                <div className="flex items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] rounded-2xl shadow-lg shadow-[#621f32]/20 dark:shadow-[#bc955c]/20">
                      <Network className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Cadena de Mando</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Explorador de jerarquía operativa</p>
                    </div>
                  </div>
                  <button onClick={() => setIsCadenaModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"><X className="size-5" /></button>
                </div>
                
                <form onSubmit={handleBuscarCadena} className="relative flex items-center bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] rounded-[1.2rem] px-4 py-3 shadow-sm transition-all">
                  <Search className="size-5 text-slate-400 mr-3" />
                  <input 
                    type="text" 
                    value={cadenaQuery} 
                    onChange={(e) => {
                      setCadenaQuery(e.target.value);
                      setShowCadenaSuggestions(true);
                      setCadenaError(null);
                    }} 
                    onFocus={() => setShowCadenaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCadenaSuggestions(false), 200)}
                    placeholder="Buscar por Número de Posición, Nombre o Num Empleado..." 
                    className="bg-transparent text-sm sm:text-base w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400" 
                  />
                  <button type="submit" disabled={isCadenaLoading || !cadenaQuery.trim()} className="ml-2 px-5 py-2.5 bg-[#621f32] dark:bg-[#bc955c] hover:bg-[#802842] dark:hover:bg-[#d0ab75] text-white dark:text-[#3e131f] text-xs font-black uppercase rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                    {isCadenaLoading ? "Buscando..." : "Buscar"}
                  </button>

                  {/* Sugerencias Autocomplete */}
                  <AnimatePresence>
                    {showCadenaSuggestions && cadenaSuggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        {cadenaSuggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCadenaQuery(sug.posicion || sug.numempleado);
                              setShowCadenaSuggestions(false);
                            }}
                            className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col transition-colors group"
                          >
                            <span className="font-black text-sm text-slate-800 dark:text-slate-200 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors">{sug.nombres}</span>
                            <span className="text-xs text-slate-500 font-bold mt-0.5">
                              POS: <span className="text-slate-700 dark:text-slate-400">{sug.posicion}</span> 
                              {sug.numempleado && <span className="ml-3 border-l border-slate-300 dark:border-slate-700 pl-3">NUM EMP: <span className="text-slate-700 dark:text-slate-400">{sug.numempleado}</span></span>}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar relative">
                {isCadenaLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="size-12 border-4 border-[#621f32]/20 border-t-[#621f32] dark:border-[#bc955c]/20 dark:border-t-[#bc955c] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest animate-pulse">Rastreando jerarquía...</p>
                  </div>
                ) : cadenaError ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="size-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                      <UserX className="size-8" />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">Sin resultados</h4>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-md">{cadenaError}</p>
                  </div>
                ) : cadenaData && cadenaData.cadena ? (
                  <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col items-center">
                    {/* Pirámide / Organigrama Centrado */}
                    <div className="flex flex-col items-center relative w-full">
                      {[...cadenaData.cadena].reverse().map((nodo, idx, arr) => {
                        const isTopBoss = idx === 0;
                        const isBaseEmployee = idx === arr.length - 1;
                        
                        return (
                          <React.Fragment key={`${nodo.Posicion}-${idx}`}>
                            <motion.div 
                              initial={{ opacity: 0, y: -20, scale: 0.95 }} 
                              animate={{ opacity: 1, y: 0, scale: 1 }} 
                              transition={{ delay: idx * 0.15, type: 'spring', stiffness: 100 }}
                              className={`relative w-full sm:w-[500px] z-10 transition-all duration-300 hover:scale-[1.02] ${isTopBoss ? 'mb-2' : ''}`}
                            >
                              <div className={`bg-white dark:bg-slate-900 border-2 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group flex flex-col items-center text-center
                                ${isTopBoss ? 'border-[#bc955c] dark:border-[#bc955c] shadow-[#bc955c]/10' : 
                                  isBaseEmployee ? 'border-[#621f32] dark:border-[#621f32] shadow-[#621f32]/10' : 
                                  'border-slate-200 dark:border-slate-800'}`}
                              >
                                {/* Background Decoration */}
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                  {isTopBoss ? <Users className="size-32 text-[#bc955c]" /> : 
                                   isBaseEmployee ? <Users className="size-32 text-[#621f32]" /> : 
                                   <ArrowUpCircle className="size-32" />}
                                </div>

                                {/* Header Tag */}
                                {isTopBoss && (
                                  <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#bc955c] to-[#9a7848] text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-sm">
                                    Cúspide de Jerarquía
                                  </span>
                                )}
                                {isBaseEmployee && (
                                  <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#621f32] to-[#4a1726] text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-sm">
                                    Empleado Consultado
                                  </span>
                                )}
                                {!isTopBoss && !isBaseEmployee && (
                                  <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full mb-4">
                                    Mando Superior (Nivel {nodo.Nivel_Hacia_Arriba})
                                  </span>
                                )}

                                {/* Name & Title */}
                                <h4 className={`text-xl sm:text-2xl font-black leading-tight mb-2
                                  ${isTopBoss ? 'text-slate-800 dark:text-white' : 
                                    isBaseEmployee ? 'text-slate-800 dark:text-white' : 
                                    'text-slate-700 dark:text-slate-200'}`}
                                >
                                  {nodo.Empleado || "Sin Nombre"}
                                </h4>
                                <p className={`text-sm font-bold uppercase tracking-wide mb-5 px-4
                                  ${isTopBoss ? 'text-[#bc955c]' : 
                                    isBaseEmployee ? 'text-[#621f32]' : 
                                    'text-slate-500 dark:text-slate-400'}`}
                                >
                                  {nodo.Puesto_Funcional || "Puesto no especificado"}
                                </p>
                                
                                {/* Info Pills */}
                                <div className="flex flex-wrap justify-center gap-3 w-full">
                                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/50 flex-1 min-w-[120px]">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Posición</span>
                                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{nodo.Posicion}</span>
                                  </div>
                                  {nodo.Nivel && (
                                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/50 flex-1 min-w-[120px]">
                                      <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nivel</span>
                                      <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{nodo.Nivel}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>

                            {/* Línea Conectora Centrada (Excepto después del último elemento) */}
                            {!isBaseEmployee && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 40 }}
                                transition={{ delay: (idx * 0.15) + 0.1, duration: 0.3 }}
                                className="w-1 h-10 bg-gradient-to-b from-[#bc955c] via-slate-300 dark:via-slate-700 to-[#621f32] rounded-full my-2 relative z-0"
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <div className="size-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <Network className="size-10 text-slate-400 dark:text-slate-600" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Buscar Jerarquía</h4>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-sm">Ingresa la posición, nombre o número de empleado para visualizar toda su cadena de mando hacia arriba.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>,
        document.body
      )}

      {/* Dropdown de Filtro por Valores Únicos */}
      <AnimatePresence>
        {activeFilterDropdown && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveFilterDropdown(null)} className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} ref={dropdownRef} className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-[450px] max-w-[95vw] max-h-[500px] flex flex-col overflow-hidden z-[70]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Filter className="size-3 text-[#621f32] dark:text-[#bc955c]" />
                    Filtrar {columns.find(c => c.key === activeFilterDropdown)?.label}
                  </h4>
                  <button onClick={() => setActiveFilterDropdown(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="size-4" /></button>
                </div>
                <div className="relative flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                  <Search className="size-3 text-slate-400 mr-2" />
                  <input type="text" value={filterSearchText} onChange={(e) => setFilterSearchText(e.target.value)} placeholder="Buscar valor..." className="bg-transparent text-[11px] w-full outline-none text-slate-700 dark:text-slate-200 font-bold" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white dark:bg-slate-900">
                {isDateColumn(activeFilterDropdown) ? (
                  <div className="flex flex-col gap-1 p-2">
                    {Object.keys(dateHierarchies[activeFilterDropdown] || {}).sort((a,b) => b - a).map(year => {
                      const yearData = dateHierarchies[activeFilterDropdown][year];
                      const isYearExpanded = expandedDateNodes[year];
                      const yearLeafValues = [...new Set(detalle.filter(row => parseDateParts(row[activeFilterDropdown])?.year === year).map(row => String(row[activeFilterDropdown] || "").trim()))];
                      const isYearSelected = yearLeafValues.length > 0 && yearLeafValues.every(v => tempSelectedValues.includes(v));
                      const isYearPartial = !isYearSelected && yearLeafValues.some(v => tempSelectedValues.includes(v));

                      return (
                        <div key={year} className="flex flex-col">
                          <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group">
                            <button onClick={() => toggleDateNode(year)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400">
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
                                const monthLeafValues = [...new Set(detalle.filter(row => {
                                  const p = parseDateParts(row[activeFilterDropdown]);
                                  return p && p.year === year && p.month === month;
                                }).map(row => String(row[activeFilterDropdown] || "").trim()))];
                                const isMonthSelected = monthLeafValues.length > 0 && monthLeafValues.every(v => tempSelectedValues.includes(v));
                                const isMonthPartial = !isMonthSelected && monthLeafValues.some(v => tempSelectedValues.includes(v));

                                return (
                                  <div key={month} className="flex flex-col">
                                    <div className="flex items-center gap-2 px-2 py-1 group">
                                      <button onClick={() => toggleDateNode(monthPath)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400">
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
                                          const dayMatches = detalle.filter(row => {
                                            const p = parseDateParts(row[activeFilterDropdown]);
                                            return p && p.year === year && p.month === month && p.day === day;
                                          });
                                          const dayUniqueValues = [...new Set(dayMatches.map(row => String(row[activeFilterDropdown] || "").trim()))];
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
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => {
                      const allVals = uniqueColumnValues[activeFilterDropdown].map(v => v.value);
                      setTempSelectedValues(tempSelectedValues.length === allVals.length ? [] : allVals);
                    }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group">
                      <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${tempSelectedValues.length === (uniqueColumnValues[activeFilterDropdown]?.length || 0) ? "bg-[#621f32] border-[#621f32]" : "border-slate-300 dark:border-slate-600"}`}>
                        {tempSelectedValues.length === (uniqueColumnValues[activeFilterDropdown]?.length || 0) && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]">Seleccionar Todo</span>
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
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
                            <button key={value} onClick={() => {
                              setTempSelectedValues(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
                            }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group">
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
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-2">
                <button onClick={() => clearColumnFilter(activeFilterDropdown)} className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all">Limpiar</button>
                <button onClick={() => applyColumnFilter(activeFilterDropdown)} className="flex-[2] px-3 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[10px] font-black uppercase rounded-xl shadow-lg shadow-[#621f32]/20 dark:shadow-none hover:opacity-90 active:scale-95 transition-all">Aplicar Filtro</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                        if (col?.key === "estado_nomina") return mapEstadoNomina(v);
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
    </div>
  );
}
