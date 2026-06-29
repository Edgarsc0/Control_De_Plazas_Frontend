"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import {
  Search, Download, Columns, Filter, ArrowUpDown, ChevronLeft,
  ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight,
  X, RotateCcw, Activity, Briefcase, CheckCircle2, XCircle, Layers, UserCheck, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";
import HistoryDataTable from "@/components/ui/HistoryDataTable";
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
import { matchesTextCondition } from "@/utils/columnFilters";

const MOV_STATUS_BADGE_STYLES = {
  "A": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30", label: "Activo" },
  "I": { bg: "bg-red-50/50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-300", border: "border-red-200/50 dark:border-red-900/40", label: "Inactivo" }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const extractRawList = (data) => {
  if (!data) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

// "A" en backend puede venir con variantes ("Activo", "A "); "I" no las tiene.
const ESTADO_PSN_VARIANTS = { A: ["A", "Activo", "A "], I: ["I"] };

// estadoKeys vacío/ausente = sin filtro de estado = "Todas las Posiciones".
const filterByEstado = (list, estadoKeys) => {
  if (!estadoKeys || estadoKeys.length === 0) return list;
  const allowed = estadoKeys.flatMap(k => ESTADO_PSN_VARIANTS[k] || [k]);
  return list.filter(row => allowed.includes(row.estado_psn));
};

const ALL_MOV_KEYS = [
  "no_pos_actual", "estado_psn", "f_efva", "cd_motivo", "motivo", "cd_un", 
  "unidad_de_negocio", "unidad_adva", "cd_departamento", "cd_puesto", 
  "puesto_ptal", "estado_ptal", "fecha_est", "maximo", "depnd_drt", 
  "depnd_indrt", "ubicacion", "nvl_direc", "plan_sal", "grado", "esc", 
  "partida_ptal", "gp_pago", "prog_beneficios", "fecha_captura", "fh_ult_actz", "por",
  "hr_estd_semn", "descr", "gp_trabajo", "org_code", "grupo_cd_sal", "formal_desc", 
  "pto_compt", "posn_clv", "presupuesto", "nombre_puesto", "fecha_vacancia"
];

const DATE_KEYS_MOV = ["f_efva", "fecha_est", "fecha_captura", "fh_ult_actz", "fecha_vacancia"];

// Server-side distinct_search only supports icontains; only safe to forward
// for "positive" conditions (a match always implies icontains too).
const isServerSafeSearchCondition = (condition) => ["contains", "starts_with", "ends_with", "equals"].includes(condition);

// "" real se descarta en buildQuery (val === '') antes de armar la URL, así
// que seleccionar solo "(Vacío)" nunca llegaba al backend. El backend espera
// este sentinel para reconocer la selección de "(Vacío)".
const EMPTY_VALUE_TOKEN = "__EMPTY__";
const encodeFilterValues = (values) => values.map(v => (v === "" ? EMPTY_VALUE_TOKEN : v)).join(",");

export default function MovimientosTab({ movPosData: initialMovPosData = [], detalle = [], isPending, startTransition, cardRef }) {
  const [movPosData, setMovPosData] = useState(() => filterByEstado(extractRawList(initialMovPosData), ["A"]));

  // Cache del set completo (sin filtro de estado, is_latest=true) que el backend
  // ya manda en una sola llamada. Activas/Inactivas/Todas se derivan de aquí
  // client-side sin pegarle a la red ni mostrar skeleton.
  const fullLatestDataRef = useRef(null);
  if (fullLatestDataRef.current === null && initialMovPosData &&
      (Array.isArray(initialMovPosData.results) || Array.isArray(initialMovPosData))) {
    const rawList = extractRawList(initialMovPosData);
    fullLatestDataRef.current = { list: rawList, stats: initialMovPosData.stats || null };
  }

  const [mounted, setMounted] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  useEffect(() => setMounted(true), []);
  const { columns, setColumns, toggleVisibility: toggleColumnVisibility, isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen } = useColumnState([
    { key: "no_pos_actual", label: "No. Posición", width: 130, visible: true, isBasic: true },
    { key: "total_movimientos", label: "Histórico", width: 100, visible: true, isBasic: true },
    { key: "ocupacion", label: "Ocupación", width: 120, visible: true, isBasic: true },
    { key: "fecha_vacancia", label: "Fecha de Vacancia", width: 140, visible: true, isBasic: true },
    { key: "estado_psn", label: "Estado (A/I)", width: 110, visible: true, isBasic: true },
    { key: "f_efva", label: "Fecha Efectiva", width: 130, visible: true, isBasic: true },
    { key: "cd_motivo", label: "Cod. Motivo", width: 120, visible: true, isBasic: true },
    { key: "motivo", label: "Motivo", width: 250, visible: true, isBasic: true },
    { key: "cd_un", label: "Cod. UN", width: 100, visible: true, isBasic: true },
    { key: "unidad_de_negocio", label: "Unidad Negocio", width: 280, visible: true, isBasic: true },
    { key: "unidad_adva", label: "Unidad Adva", width: 250, visible: true, isBasic: true },
    { key: "cd_departamento", label: "Cod. Depto", width: 120, visible: true, isBasic: true },
    { key: "cd_puesto", label: "Cod. Puesto", width: 120, visible: true, isBasic: true },
    { key: "puesto_ptal", label: "Puesto Ptal", width: 250, visible: true, isBasic: true },
    { key: "estado_ptal", label: "Estado Ptal", width: 130, visible: true, isBasic: true },
    { key: "fecha_est", label: "Fecha Est", width: 130, visible: true, isBasic: true },
    { key: "maximo", label: "Máximo", width: 100, visible: true, isBasic: true },
    { key: "depnd_drt", label: "Depnd Drt", width: 250, visible: true, isBasic: true },
    { key: "depnd_indrt", label: "Depnd Indrt", width: 250, visible: true, isBasic: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true, isBasic: true },
    { key: "nvl_direc", label: "Nvl Direc", width: 100, visible: true, isBasic: true },
    { key: "plan_sal", label: "Plan Sal", width: 120, visible: true, isBasic: true },
    { key: "grado", label: "Grado", width: 100, visible: true, isBasic: true },
    { key: "esc", label: "Esc", width: 100, visible: true, isBasic: true },
    { key: "partida_ptal", label: "Partida Ptal", width: 150, visible: true, isBasic: true },
    { key: "gp_pago", label: "Gp Pago", width: 120, visible: true, isBasic: true },
    { key: "prog_beneficios", label: "Prog Beneficios", width: 150, visible: true, isBasic: true },
    { key: "fecha_captura", label: "Fecha Captura", width: 140, visible: true, isBasic: true },
    { key: "fh_ult_actz", label: "F/H Últ Actz", width: 150, visible: true, isBasic: true },
    { key: "por", label: "Por", width: 180, visible: true, isBasic: true },
    { key: "hr_estd_semn", label: "Hr Estd/Semn", width: 120, visible: true, isBasic: true },
    { key: "descr", label: "Descr", width: 200, visible: true, isBasic: true },
    { key: "gp_trabajo", label: "Gp Trabajo", width: 150, visible: true, isBasic: true },
    { key: "org_code", label: "Org Code", width: 120, visible: true, isBasic: true },
    { key: "grupo_cd_sal", label: "Grupo Cd Sal", width: 150, visible: true, isBasic: true },
    { key: "formal_desc", label: "Formal Desc", width: 200, visible: true, isBasic: true },
    { key: "pto_compt", label: "Pto Compt", width: 120, visible: true, isBasic: true },
    { key: "posn_clv", label: "Posn Clv", width: 120, visible: true, isBasic: true },
    { key: "presupuesto", label: "Presupuesto", width: 120, visible: true, isBasic: true },
    { key: "nombre_puesto", label: "Nombre Puesto", width: 250, visible: true, isBasic: true },
  ]);

  const filters = useColumnFilters({ initialColumnFilters: { estado_psn: ["A"], is_latest: ["true"] } });
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [scrollTop, setScrollTop] = useState(0);
  const { selectedCell, setSelectedCell, isCellModalOpen, setIsCellModalOpen, selectedRowData, setSelectedRowData, contextMenu, setContextMenu } = useCellSelection();
  const arrowRepeatRef = useRef(0);

  const isDateColumn = useCallback((colKey) => {
    return DATE_KEYS_MOV.includes(colKey);
  }, []);

  const {
    isAdvancedFiltersOpen, setIsAdvancedFiltersOpen,
    advancedConditions,
    appliedAdvancedFilters,
    addAdvancedCondition, removeAdvancedCondition, updateAdvancedCondition,
    applyAdvancedFilters, resetAdvancedFilters,
  } = useAdvancedFilters({
    mode: "server",
    isDateColumn,
    onApply: () => { setLoading(true); setPage(1); },
  });

  const [count, setCount] = useState(() => filterByEstado(extractRawList(initialMovPosData), ["A"]).length || 0);
  const hasInitialData = initialMovPosData && (Array.isArray(initialMovPosData.results) || Array.isArray(initialMovPosData));
  const [loading, setLoading] = useState(!hasInitialData);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [stats, setStats] = useState(() => {
    if (initialMovPosData && initialMovPosData.stats) return initialMovPosData.stats;
    return {
      total_movimientos: 0,
      todas_posiciones: 0,
      posiciones_activas: 0,
      posiciones_inactivas: 0
    };
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedTextFilters, setDebouncedTextFilters] = useState({});

  useEffect(() => {
    // Nothing actually pending: skip regardless of how many times this
    // effect fires (React StrictMode dev double-invoke included).
    if (searchQuery === debouncedSearch) return;
    const handler = setTimeout(() => {
      setLoading(true);
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    // Same no-op guard as above, by content (object refs always differ).
    if (JSON.stringify(textFilters) === JSON.stringify(debouncedTextFilters)) return;
    const handler = setTimeout(() => {
      setLoading(true);
      setDebouncedTextFilters(textFilters);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [textFilters, debouncedTextFilters]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters]);

  const [uniqueColumnValues, setUniqueColumnValues] = useState({});
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const [hasInitializedTemp, setHasInitializedTemp] = useState(false);


  const uniqueValuesCacheRef = useRef({});
  const movPosDataCacheRef = useRef({});

  const hasFetched = useRef(false);

  useEffect(() => {
    // Solo toggle de estado (Activas/Inactivas/Todas) + is_latest=true, sin
    // búsqueda/orden/filtros/paginación reales: el backend ya manda el set
    // completo en una sola llamada (is_latest=true bypassa paginación), así
    // que esto se resuelve client-side desde fullLatestDataRef sin red ni skeleton.
    const onlyStatusToggle =
      debouncedSearch === "" &&
      Object.keys(debouncedTextFilters).length === 0 &&
      sortConfig.key === null &&
      page === 1 &&
      pageSize === 50 &&
      appliedAdvancedFilters.length === 0 &&
      columnFilters.is_latest?.length === 1 && columnFilters.is_latest[0] === "true" &&
      Object.keys(columnFilters).every(k => k === "estado_psn" || k === "is_latest");

    if (onlyStatusToggle) {
      if (fullLatestDataRef.current) {
        const { list, stats: cachedStats } = fullLatestDataRef.current;
        const view = filterByEstado(list, columnFilters.estado_psn);
        setMovPosData(view);
        setCount(view.length);
        if (cachedStats) setStats(cachedStats);
        setLoading(false);
        return;
      }

      setLoading(true);
      VacantesService.getMovPosDetalle({ is_latest: "true" })
        .then(res => res.json())
        .then(resData => {
          const rawList = extractRawList(resData);
          fullLatestDataRef.current = { list: rawList, stats: resData.stats || null };
          const view = filterByEstado(rawList, columnFilters.estado_psn);
          setMovPosData(view);
          setCount(view.length);
          if (resData.stats) setStats(resData.stats);
        })
        .catch(err => console.error("Error loading MovPosDetalle:", err))
        .finally(() => setLoading(false));
      return;
    }

    hasFetched.current = true;

    setLoading(true);

    const filterParams = {};
    Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
      if (filterObj && filterObj.value && filterObj.value.trim()) {
        const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        let suffix = "";
        if (cond === "contains") suffix = "__icontains";
        else if (cond === "not_contains") {
          filterParams[`exclude__${colKey}__icontains`] = filterObj.value.trim();
          return;
        }
        else if (cond === "starts_with") suffix = "__istartswith";
        else if (cond === "not_starts_with") {
          filterParams[`exclude__${colKey}__istartswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "ends_with") suffix = "__iendswith";
        else if (cond === "not_ends_with") {
          filterParams[`exclude__${colKey}__iendswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "equals") suffix = "__iexact";
        else if (cond === "not_equals") {
          filterParams[`exclude__${colKey}__iexact`] = filterObj.value.trim();
          return;
        }
        
        filterParams[`${colKey}${suffix}`] = filterObj.value.trim();
      }
    });

    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (key === "is_latest") return;
      if (values && values.length > 0) {
        colParams[`${key}__in`] = encodeFilterValues(values);
      }
    });

    const isLatestVal = columnFilters.is_latest?.includes("true") ? "true" : "false";

    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch,
      is_latest: isLatestVal,
      ...filterParams,
      ...colParams
    };

    if (sortConfig.key) {
      if (sortConfig.key === "custom_movimientos") {
        params.sort_by = "f_efva,fecha_captura,no_pos_actual";
        params.sort_order = "desc";
      } else {
        params.sort_by = sortConfig.key;
        params.sort_order = sortConfig.direction || "asc";
      }
    }

    if (appliedAdvancedFilters.length > 0) {
      params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
    }

    const signature = JSON.stringify(params);
    const cached = movPosDataCacheRef.current[signature];
    if (cached) {
      setMovPosData(cached.results || []);
      setCount(cached.count || 0);
      if (cached.stats) setStats(cached.stats);
      setLoading(false);
      return;
    }

    VacantesService.getMovPosDetalle(params)
      .then(res => res.json())
      .then(resData => {
        movPosDataCacheRef.current[signature] = resData;
        setMovPosData(resData.results || []);
        setCount(resData.count || 0);
        if (resData.stats) {
          setStats(resData.stats);
        }
      })
      .catch(err => console.error("Error loading MovPosDetalle:", err))
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, debouncedTextFilters, columnFilters, sortConfig, appliedAdvancedFilters]);

  useEffect(() => {
    if (!activeFilterDropdown) return;
    // "Vista actual" is computed entirely client-side from filteredSortedData
    // (see render below) — no need to hit the backend while that tab is active,
    // it was firing a request on every keystroke in the search box for nothing.
    if (filterDropdownTab === 'actuales' && !DATE_KEYS_MOV.includes(activeFilterDropdown)) return;

    // "Todos los datos" = distinct values over the WHOLE table, with no filters
    // applied at all (not even is_latest/search/other column filters). The
    // already-filtered view lives in the "Vista actual" tab, computed
    // client-side from filteredSortedData.
    const isDateCol = DATE_KEYS_MOV.includes(activeFilterDropdown);
    const params = {
      distinct_field: activeFilterDropdown,
      distinct_search: (isDateCol || isServerSafeSearchCondition(filterSearchCondition)) ? debouncedFilterSearchText : "",
      is_latest: "false"
    };

    const signature = JSON.stringify(params);
    const initTempSelected = (valuesList) => {
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
    };

    const cached = uniqueValuesCacheRef.current[activeFilterDropdown];
    if (cached && cached.signature === signature) {
      // Same column, same effective filters/search as last fetch: reuse cached values.
      setUniqueColumnValues(prev => (prev[activeFilterDropdown] === cached.values ? prev : { ...prev, [activeFilterDropdown]: cached.values }));
      initTempSelected(cached.values);
      setLoadingUniqueValues(false);
      return;
    }

    setLoadingUniqueValues(true);
    VacantesService.getMovPosDetalle(params)
      .then(res => res.json())
      .then(resData => {
        const valuesList = Array.isArray(resData) ? resData : [];
        uniqueValuesCacheRef.current[activeFilterDropdown] = { signature, values: valuesList };
        setUniqueColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
        initTempSelected(valuesList);
      })
      .catch(err => console.error("Error loading unique values:", err))
      .finally(() => setLoadingUniqueValues(false));
  }, [activeFilterDropdown, debouncedFilterSearchText, columnFilters, filterDropdownTab, filterSearchCondition]);
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
    const excludedKeys = ['id', 'f_efva', 'fecha_captura', 'fh_ult_actz', 'motivo', 'cd_motivo', 'por', 'total_movimientos'];
    
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
      (row.motivo && String(row.motivo).toLowerCase().includes(lower)) || 
      (row.cd_motivo && String(row.cd_motivo).toLowerCase().includes(lower))
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

  const isMonoColumn = useCallback((key) => ["no_pos_actual", "cd_un", "cd_departamento", "cd_puesto", "maximo", "grado", "esc", "partida_ptal"].includes(key), []);

  const fetchAdvValueSuggestions = useCallback((column) =>
    VacantesService.getMovPosDetalle({ distinct_field: column, distinct_search: "", is_latest: "false" })
      .then(res => res.json())
      .then(data => (Array.isArray(data) ? data : [])), []);

  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS_MOV.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      const valuesList = uniqueColumnValues[key] || [];
      valuesList.forEach(item => {
        const val = item.value;
        const count = item.count;
        const parts = parseDateParts(val);
        if (!parts) return;
        const { year, month, day, monthName } = parts;
        if (!years[year]) years[year] = { count: 0, months: {} };
        years[year].count += count;
        if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
        years[year].months[month].count += count;
        years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + count;
      });
      hierarchies[key] = years;
    });
    return hierarchies;
  }, [uniqueColumnValues, activeFilterDropdown, parseDateParts]);

  const allDateLeafValues = useMemo(() => {
    if (!activeFilterDropdown || !isDateColumn(activeFilterDropdown)) return [];
    return [...new Set((uniqueColumnValues[activeFilterDropdown] || []).map(item => String(item.value).trim()))];
  }, [uniqueColumnValues, activeFilterDropdown, isDateColumn]);

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'month') {
      const year = parentPath;
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(item => String(item.value).trim());
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
    if (activeFilterDropdown === colKey) {
      setActiveFilterDropdown(null);
      setHasInitializedTemp(false);
    } else {
      setHasInitializedTemp(false);
      setActiveFilterDropdown(colKey);
      setFilterDropdownTab('todos');
      setFilterSearchText("");
      setFilterSearchCondition(isMonoColumn(colKey) ? "starts_with" : "contains");
      setIsFilterSearchConditionOpen(false);
      if (columnFilters[colKey]) {
        setTempSelectedValues(columnFilters[colKey]);
      } else {
        setTempSelectedValues([]);
      }
    }
  };

  const applyColumnFilter = (colKey) => {
    const totalUnique = (uniqueColumnValues[colKey] || []).map(v => v.value);
    startTransition(() => {
      if (tempSelectedValues.length === totalUnique.length || tempSelectedValues.length === 0) {
        const newFilters = { ...columnFilters };
        delete newFilters[colKey];
        setColumnFilters(newFilters);
      } else {
        setColumnFilters({ ...columnFilters, [colKey]: tempSelectedValues });
      }
    });
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };

  const clearColumnFilter = (colKey) => {
    startTransition(() => {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    });
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setLoading(true);
    resetAdvancedFilters();
    startTransition(() => {
      setColumnFilters({});
      setTextFilters({});
      setGlobalSearch("");
      setSortConfig({ key: null, direction: null });
    });
  };

  const handleStatusFilter = (label) => {
    const current = columnFilters["estado_psn"] || [];
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
    setLoading(true);
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

  // Adjust ContextMenu position to prevent clipping
  useEffect(() => {
    if (contextMenu) {
      const menuWidth = 256; // estimated w-64
      const menuHeight = 280; // estimated height
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

      let { x, y } = contextMenu;
      let adjusted = false;

      if (x + menuWidth > windowWidth) {
        x = windowWidth - menuWidth - 16;
        adjusted = true;
      }
      if (y + menuHeight > windowHeight) {
        y = windowHeight - menuHeight - 16;
        adjusted = true;
      }

      if (adjusted) {
        setContextMenu({ ...contextMenu, x, y });
      }
    }
  }, [contextMenu]);

  const filteredSortedData = movPosData;

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown || isDateColumn(activeFilterDropdown)) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };

    let baseUniqueValues = (uniqueColumnValues[activeFilterDropdown] || []).map(v => typeof v === 'object' ? v : { value: v, count: 0 });
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
    const filtered = baseUniqueValues.filter(v => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText));

    return { allVals, isAllSelected, sliced: filtered.slice(0, 100), filteredCount: filtered.length };
  }, [activeFilterDropdown, isDateColumn, uniqueColumnValues, filterDropdownTab, filteredSortedData, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText]);

  useEffect(() => {
    let active = true;
    if (isHistoryModalOpen && selectedCell) {
      const posicion = filteredSortedData[selectedCell.row]?.no_pos_actual;
      if (posicion) {
        setIsModalLoading(true);
        VacantesService.getMovPosHistoria(posicion)
          .then(res => res.json())
          .then(data => {
            if (active) {
              // Ensure data is sorted strictly descending by fecha_captura (newest to oldest)
              const sortedData = [...data].sort((a, b) => new Date(b.fecha_captura || 0) - new Date(a.fecha_captura || 0));
              setModalHistoryData(sortedData);
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

  const isLatestFilter = columnFilters.is_latest?.includes("true");
  const rowHeight = 37, containerHeight = 800;
  const totalPages = isLatestFilter ? 1 : (Math.ceil(count / pageSize) || 1);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    if (col.key === "estado_psn") {
      const badge = MOV_STATUS_BADGE_STYLES[value] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: value };
      return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={`px-4 text-[10px] border-r align-middle h-[37px] transition-all ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span></td>);
    }
    const isPosicionCol = col.key === "no_pos_actual";
    const handleCellClick = (e) => { onClick(e); if (isPosicionCol) { setActiveModalTab('tabla'); setComparingIndex(null); setTimelineSearch(''); setIsHistoryModalOpen(true); } };
    return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={handleCellClick} className={`px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${isPosicionCol ? "cursor-pointer hover:bg-[#621f32]/10 hover:text-[#621f32] hover:underline" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}>{col.key === "total_movimientos" ? (<div className="flex justify-center">{value !== undefined && value !== null ? (<span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#621f32]/10 text-[#621f32] dark:bg-[#bc955c]/20 dark:text-[#bc955c] border border-[#621f32]/20 dark:border-[#bc955c]/30 text-[10px] font-black leading-none shadow-sm" title={`${value} movimientos históricos`}>{value}</span>) : <span className="text-slate-300">-</span>}</div>) : col.key === "ocupacion" ? (<div className="flex items-center">{value && (<span className={`inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase leading-none shadow-sm ${value === 'Ocupada' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{value}</span>)}</div>) : value === undefined || value === null || String(value).trim() === "" ? (<span className="text-slate-300">-</span>) : isPosicionCol ? (<div className="flex items-center justify-between gap-2"><span>{String(value)}</span></div>) : (String(value))}</td>);
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const visibleCols = columns.filter(c => c.visible);

      const filterParams = {};
      Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
        if (filterObj && filterObj.value && filterObj.value.trim()) {
          const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
          if (cond === "not_contains") { filterParams[`exclude__${colKey}__icontains`] = filterObj.value.trim(); return; }
          if (cond === "not_starts_with") { filterParams[`exclude__${colKey}__istartswith`] = filterObj.value.trim(); return; }
          if (cond === "not_ends_with") { filterParams[`exclude__${colKey}__iendswith`] = filterObj.value.trim(); return; }
          if (cond === "not_equals") { filterParams[`exclude__${colKey}__iexact`] = filterObj.value.trim(); return; }
          const suffixMap = { contains: "__icontains", starts_with: "__istartswith", ends_with: "__iendswith", equals: "__iexact" };
          filterParams[`${colKey}${suffixMap[cond] || "__icontains"}`] = filterObj.value.trim();
        }
      });

      const colParams = {};
      Object.entries(columnFilters).forEach(([key, values]) => {
        if (key === "is_latest") return;
        if (values && values.length > 0) colParams[`${key}__in`] = encodeFilterValues(values);
      });

      const isLatestVal = columnFilters.is_latest?.includes("true") ? "true" : "false";
      const params = {
        search: debouncedSearch,
        is_latest: isLatestVal,
        visible_columns: visibleCols.map(c => c.key).join(","),
        ...filterParams,
        ...colParams,
      };

      if (sortConfig.key) {
        params.sort_by = sortConfig.key === "custom_movimientos" ? "f_efva,fecha_captura,no_pos_actual" : sortConfig.key;
        params.sort_order = sortConfig.key === "custom_movimientos" ? "desc" : (sortConfig.direction || "asc");
      }

      if (appliedAdvancedFilters.length > 0) {
        params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
      }

      const res = await VacantesService.exportMovPosExcel(params);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Movimientos_Posiciones.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error al exportar a Excel: " + error.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeStatusFilter = columnFilters["estado_psn"] || [];


  // Auto-scroll when navigating with keyboard
  useEffect(() => {
    if (!selectedCell) return;
    const container = document.querySelector('.overflow-auto.relative.flex-1') || document.querySelector('.overflow-auto');
    if (!container) return;
    
    const { row, col } = selectedCell;
    const rowHeight = 37; 
    const headerHeight = 36;
    const rowTop = row * rowHeight;
    const rowBottom = rowTop + rowHeight;
    
    if (rowTop < container.scrollTop + headerHeight) {
      container.scrollTop = Math.max(0, rowTop - headerHeight);
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = rowBottom - container.clientHeight + headerHeight;
    }
    
    const visibleCols = columns.filter(c => c.visible);
    if (!visibleCols[col]) return;
    
    const frozenWidth = 95; // 50 (index) + 45 (ver)
    let colLeft = frozenWidth;
    for (let i = 0; i < col; i++) {
      colLeft += visibleCols[i].width;
    }
    const colRight = colLeft + visibleCols[col].width;
    
    if (colLeft < container.scrollLeft + frozenWidth) {
      container.scrollLeft = colLeft - frozenWidth;
    } else if (colRight > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = colRight - container.clientWidth + 20; // 20px padding for visibility
    }
  }, [selectedCell, columns]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e.key.startsWith('Arrow')) {
        if (e.key === 'Escape') setContextMenu(null);
        return;
      }
      
      e.preventDefault();
      
      if (e.repeat) {
        arrowRepeatRef.current += 1;
      } else {
        arrowRepeatRef.current = 1;
      }
      
      let step = 1;
      if (arrowRepeatRef.current > 5) step = 2;
      if (arrowRepeatRef.current > 12) step = 5;
      if (arrowRepeatRef.current > 20) step = 10;
      if (arrowRepeatRef.current > 35) step = 20;
      
      const visibleCols = columns.filter(c => c.visible).length;
      
      setSelectedCell(prev => {
        if (!prev) return prev; 
        let newRow = prev.row;
        let newCol = prev.col;
        if (e.key === 'ArrowUp') newRow = Math.max(0, prev.row - step);
        if (e.key === 'ArrowDown') newRow = Math.min(filteredSortedData.length - 1, prev.row + step);
        if (e.key === 'ArrowLeft') newCol = Math.max(0, prev.col - step);
        if (e.key === 'ArrowRight') newCol = Math.min(visibleCols - 1, prev.col + step);
        return { row: newRow, col: newCol };
      });
    };

    const handleKeyUp = (e) => {
      if (e.key.startsWith('Arrow')) {
        arrowRepeatRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [filteredSortedData, columns]);
  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6 pt-2">
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6 items-stretch w-full max-w-6xl mx-auto">
            <div onClick={() => { startTransition(() => { const newF = { ...columnFilters }; newF.estado_psn = ["A"]; newF.is_latest = ["true"]; setColumnFilters(newF); }); }} className={`relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 group ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && columnFilters.is_latest?.includes("true") ? "bg-gradient-to-br from-[#621f32] to-[#8a2a46] text-white shadow-xl shadow-[#621f32]/25 scale-[1.02] ring-2 ring-white/20" : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:bg-white dark:hover:bg-slate-900"}`}>
              <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 transition-all ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && columnFilters.is_latest?.includes("true") ? "bg-white" : "bg-[#621f32]"}`} />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-2 rounded-xl transition-colors ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && columnFilters.is_latest?.includes("true") ? "bg-white/20 text-white" : "bg-[#621f32]/10 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c]"}`}>
                  <CheckCircle2 className="size-4" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && columnFilters.is_latest?.includes("true") ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>Posiciones Activas</span>
              </div>
              <span className={`text-4xl font-black tracking-tighter relative z-10 ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && columnFilters.is_latest?.includes("true") ? "text-white" : "text-[#621f32] dark:text-[#bc955c]"}`}>{formatNumber(stats.posiciones_activas)}</span>
            </div>

            <div onClick={() => { startTransition(() => { const newF = { ...columnFilters }; newF.estado_psn = ["I"]; newF.is_latest = ["true"]; setColumnFilters(newF); }); }} className={`relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 group ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && columnFilters.is_latest?.includes("true") ? "bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-950 text-white shadow-xl shadow-slate-900/25 scale-[1.02] ring-2 ring-white/20" : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:bg-white dark:hover:bg-slate-900"}`}>
              <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 transition-all ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && columnFilters.is_latest?.includes("true") ? "bg-white" : "bg-slate-500"}`} />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-2 rounded-xl transition-colors ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && columnFilters.is_latest?.includes("true") ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                  <XCircle className="size-4" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && columnFilters.is_latest?.includes("true") ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>Posiciones Inactivas</span>
              </div>
              <span className={`text-4xl font-black tracking-tighter relative z-10 ${activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && columnFilters.is_latest?.includes("true") ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>{formatNumber(stats.posiciones_inactivas)}</span>
            </div>

            <div onClick={() => { startTransition(() => { const newF = { ...columnFilters }; delete newF.estado_psn; newF.is_latest = ["true"]; setColumnFilters(newF); setSortConfig({ key: null, direction: null }); }); }} className={`relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 group ${activeStatusFilter.length === 0 && columnFilters.is_latest?.includes("true") ? "bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl shadow-emerald-600/25 scale-[1.02] ring-2 ring-white/20" : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:bg-white dark:hover:bg-slate-900"}`}>
              <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 transition-all ${activeStatusFilter.length === 0 && columnFilters.is_latest?.includes("true") ? "bg-white" : "bg-emerald-500"}`} />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-2 rounded-xl transition-colors ${activeStatusFilter.length === 0 && columnFilters.is_latest?.includes("true") ? "bg-white/20 text-white" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"}`}>
                  <Layers className="size-4" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${activeStatusFilter.length === 0 && columnFilters.is_latest?.includes("true") ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>Todas las Posiciones</span>
              </div>
              <span className={`text-4xl font-black tracking-tighter relative z-10 ${activeStatusFilter.length === 0 && columnFilters.is_latest?.includes("true") ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`}>{formatNumber(stats.todas_posiciones)}</span>
            </div>

            <div onClick={() => { setLoading(true); startTransition(() => { const newF = { ...columnFilters }; delete newF.estado_psn; delete newF.is_latest; setColumnFilters(newF); setSortConfig({ key: "custom_movimientos", direction: "desc" }); }); }} className={`relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 group ${!columnFilters.is_latest || !columnFilters.is_latest?.includes("true") ? "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-600/25 scale-[1.02] ring-2 ring-white/20" : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:bg-white dark:hover:bg-slate-900"}`}>
              <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 transition-all ${!columnFilters.is_latest || !columnFilters.is_latest?.includes("true") ? "bg-white" : "bg-indigo-500"}`} />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-2 rounded-xl transition-colors ${!columnFilters.is_latest || !columnFilters.is_latest?.includes("true") ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"}`}>
                  <Activity className="size-4" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${!columnFilters.is_latest || !columnFilters.is_latest?.includes("true") ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>Mov. de Posiciones</span>
              </div>
              <span className={`text-4xl font-black tracking-tighter relative z-10 ${!columnFilters.is_latest || !columnFilters.is_latest?.includes("true") ? "text-white" : "text-indigo-600 dark:text-indigo-400"}`}>{formatNumber(stats.total_movimientos)}</span>
            </div>
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
            chips={activeStatusFilter.map(status => (
              <button key={status} onClick={() => handleStatusFilter(status)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border active:scale-95 transition-transform" style={{ backgroundColor: status === "A" ? "#621f3212" : "#1f293712", color: status === "A" ? "#621f32" : "#1f2937", borderColor: status === "A" ? "#621f3230" : "#1f293730" }}>
                <span>{status === "A" ? "Activo" : "Inactivo"}</span><X className="size-3" />
              </button>
            ))}
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
              <div className="flex flex-wrap items-center gap-2">{activeStatusFilter.map(status => (<button key={status} onClick={() => handleStatusFilter(status)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm transition-all hover:opacity-80 active:scale-95 cursor-pointer" style={{ backgroundColor: status === "A" ? "#621f3212" : "#1f293712", color: status === "A" ? "#621f32" : "#1f2937", borderColor: status === "A" ? "#621f3230" : "#1f293730" }}><span>{status === "A" ? "Activo" : "Inactivo"}</span><X className="size-3" /></button>))}</div>
            </div>
            <div className="flex items-center gap-3">
              {/* Pagination controls */}
              {!isLatestFilter && (
                <div className="flex items-center gap-4 shrink-0 mr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Mostrar:</span>
                    <select 
                      value={pageSize} 
                      onChange={(e) => {
                        setLoading(true);
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase text-[#621f32] dark:text-[#bc955c] outline-none cursor-pointer"
                    >
                      {[25, 50, 100, 250, 500].map(sz => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 select-none">
                    <button 
                      onClick={() => { setLoading(true); setPage(p => Math.max(1, p - 1)); }} 
                      disabled={page === 1 || loading}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 px-1">
                      Pág. <span className="text-[#621f32] dark:text-[#bc955c]">{page}</span> de <span className="text-[#621f32] dark:text-[#bc955c]">{totalPages}</span>
                    </span>
                    <button 
                      onClick={() => { setLoading(true); setPage(p => Math.min(totalPages, p + 1)); }} 
                      disabled={page === totalPages || loading}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

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
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer"><Columns className="size-3.5" /><span>Columnas</span></button>
              <AdvancedFiltersButton onClick={() => setIsAdvancedFiltersOpen(true)} appliedCount={appliedAdvancedFilters.length} />
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
            isLoading={loading}
            loadingVariant="skeleton"
            rowNumberOffset={(page - 1) * pageSize}
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
                getRowId: (r, i) => r.id ?? r.no_pos_actual ?? i,
                getTitle: (r) => r.nombre_puesto || (r.no_pos_actual ? `Posición ${r.no_pos_actual}` : "Posición"),
                getSubtitle: (r) => (r.no_pos_actual ? `POS ${r.no_pos_actual}` : ""),
                renderBadge: (r) => {
                  const a = r.estado_psn === "A";
                  return <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[9px] font-black uppercase ${a ? "bg-[#621f32]/8 text-[#621f32] border-[#621f32]/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}>{a ? "Activo" : "Inactivo"}</span>;
                },
                fields: [
                  { key: "total_movimientos", label: "Histórico", mono: true },
                  { key: "ocupacion", label: "Ocupación" },
                  { key: "fecha_vacancia", label: "Vacancia" },
                  { key: "motivo", label: "Motivo" },
                  { key: "unidad_de_negocio", label: "Unidad" },
                  { key: "f_efva", label: "F. Efectiva" },
                ],
              }}
              onCardClick={(row) => setSelectedRowData(row)}
              isLoading={loading}
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
            data={movPosData}
            filters={filters}
            dropdownValues={filterDropdownValues}
            dateHierarchy={dateHierarchies[activeFilterDropdown]}
            dateValues={(uniqueColumnValues[activeFilterDropdown] || []).map(i => i.value)}
            allDateLeafValues={allDateLeafValues}
            loadingValues={loadingUniqueValues}
            onDateSelection={(type, value, parentPath) => handleDateSelection(activeFilterDropdown, type, value, parentPath)}
            onToggleDateNode={(path) => setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }))}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Detalle de Posición Histórica */}
      {mounted && createPortal(
        <AnimatePresence>
        {isHistoryModalOpen && selectedCell && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_rgba(0,0,0,0.25)] w-full max-w-[96vw] max-h-[85vh] flex flex-col z-[90] overflow-hidden"
            >
              {/* ── Header ── */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="p-2.5 bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white rounded-xl shadow-lg shadow-[#621f32]/20 shrink-0">
                    <Briefcase className="size-5" />
                  </div>
                  {/* Title */}
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                      Detalle de Posición
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      # {filteredSortedData[selectedCell.row]?.no_pos_actual || 'N/A'}
                    </p>
                  </div>
                  {/* Tab switcher */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 ml-2">
                    <button
                      onClick={() => { setActiveModalTab('tabla'); setComparingIndex(null); }}
                      className={`px-4 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all ${activeModalTab === 'tabla' ? 'bg-white dark:bg-slate-600 text-[#621f32] dark:text-[#bc955c] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >Tabla</button>
                    <button
                      onClick={() => { setActiveModalTab('timeline'); setComparingIndex(null); }}
                      className={`px-4 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all ${activeModalTab === 'timeline' ? 'bg-white dark:bg-slate-600 text-[#621f32] dark:text-[#bc955c] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >Línea del Tiempo</button>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-auto bg-slate-50/60 dark:bg-slate-900/50">
                {isModalLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando historial...</p>
                  </div>
                ) : activeModalTab === 'tabla' || activeModalTab === 'diff_table' ? (
                  <div className="w-full flex flex-col h-full">
                    {activeModalTab === 'diff_table' && (
                      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/70 sticky left-0 z-40">
                        <div>
                          <h4 className="font-black text-[#621f32] dark:text-[#bc955c] uppercase text-xs tracking-wider">
                            {comparingIndex === 0 ? 'Registro Inicial' : 'Comparación Detallada'}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {comparingIndex === 0 ? 'Vista tabular del estado inicial.' : 'Movimiento seleccionado vs. estado anterior.'}
                          </p>
                        </div>
                        <button
                          onClick={() => { setActiveModalTab('timeline'); setComparingIndex(null); }}
                          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 hover:text-[#621f32] transition-colors shadow-sm active:scale-95 flex items-center gap-2"
                        >
                          ← Volver
                        </button>
                      </div>
                    )}
                    <div className={`w-full ${activeModalTab === 'tabla' ? 'flex-1 flex flex-col min-h-0' : 'overflow-auto'}`}>
                      {tableDataToRender && tableDataToRender.length > 0 ? (
                        activeModalTab === 'tabla' ? (
                          <HistoryDataTable data={modalHistoryData} />
                        ) : (
                          <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: 'fixed', width: 50 + columns.reduce((sum, col) => sum + col.width, 0) }}>
                          <colgroup><col style={{ width: 50 }} />{columns.map(col => <col key={col.key} style={{ width: col.width }} />)}</colgroup>
                          <thead className="bg-[#501929]/90 dark:bg-[#3e131f]/90 text-white sticky top-0 z-30 shadow-md border-b border-[#bc955c]/30">
                            <tr>
                              <th className="sticky left-0 top-0 z-40 bg-[#40121e]/90 dark:bg-[#2b0d15]/90 backdrop-blur-md border-r border-b border-[#621f32]/35 w-[50px] min-w-[50px] text-center align-middle">#</th>
                              {columns.map((col, index) => (
                                <th key={col.key} className="relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 bg-[#501929] text-slate-200">
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
                                  if (col.key === 'estado_psn') {
                                    const badge = MOV_STATUS_BADGE_STYLES[val] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: val };
                                    return (
                                      <td key={col.key} className="px-4 text-[10px] border-r align-middle h-[37px] bg-white/10">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={col.key} className={`px-4 text-xs border-r truncate h-[37px] align-middle bg-white/10 text-slate-950 dark:text-slate-50 ${isMonoColumn(col.key) ? 'font-mono font-bold' : 'font-bold'}`}>
                                      {val === undefined || val === null || String(val).trim() === '' ? <span className="text-slate-300">-</span> : String(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )
                      ) : (
                        <div className="text-center py-20 text-slate-400 text-sm font-medium">No se encontraron registros de historia para esta posición.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Timeline ── */
                  <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
                    {/* Search */}
                    <div className="relative max-w-md mx-auto sm:mx-0 w-full ml-4 sm:ml-6">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="size-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por motivo o código..."
                        value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#621f32]/30 focus:border-[#621f32] text-sm transition-all shadow-sm"
                      />
                    </div>

                    {filteredTimelineData && filteredTimelineData.length > 0 ? (
                      <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 sm:ml-6 flex flex-col gap-8 py-6 before:absolute before:inset-0 before:-left-[2px] before:w-[2px] before:bg-gradient-to-b before:from-[#621f32] before:via-[#621f32]/40 before:to-transparent before:h-full before:z-0">
                        {filteredTimelineData.map((row, index) => (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.8), ease: "easeOut" }}
                            key={row.id || index}
                            className="relative pl-8 sm:pl-12 group cursor-pointer z-10"
                            onClick={() => { setComparingIndex(index); setActiveModalTab('diff_table'); }}
                          >
                            {/* Timeline dot */}
                            <div className="absolute -left-[11px] top-6 size-5 rounded-full bg-white dark:bg-slate-900 border-[4px] border-slate-300 dark:border-slate-700 group-hover:border-[#621f32] dark:group-hover:border-[#bc955c] group-hover:scale-125 transition-all duration-300 shadow-sm z-20" />
                            {/* Dot glow */}
                            <div className="absolute -left-[19px] top-4 size-9 rounded-full bg-[#621f32]/0 group-hover:bg-[#621f32]/15 dark:group-hover:bg-[#bc955c]/15 blur-sm transition-all duration-300 z-10" />

                            {/* Connecting line */}
                            <div className="absolute left-[9px] top-8 w-6 sm:w-10 h-[2px] bg-slate-200 dark:bg-slate-800 group-hover:bg-[#621f32]/30 dark:group-hover:bg-[#bc955c]/30 transition-colors duration-300" />

                            {/* Card */}
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-[1.5rem] p-5 sm:p-7 shadow-sm transition-all duration-300 group-hover:shadow-[0_12px_40px_-12px_rgba(98,31,50,0.15)] group-hover:border-[#621f32]/40 dark:group-hover:border-[#bc955c]/40 group-hover:-translate-y-1 group-hover:bg-white dark:group-hover:bg-slate-900 overflow-hidden relative">
                              {/* Top accent line */}
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:from-[#621f32] group-hover:via-[#bc955c] group-hover:to-[#621f32] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <div>
                                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{row.motivo || 'Actualización Inicial'}</h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.bg || 'bg-slate-50'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.text || 'text-slate-600'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.border || 'border-slate-200'}`}>
                                      {MOV_STATUS_BADGE_STYLES[row.estado_psn]?.label || row.estado_psn || '-'}
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-400">Cod. Motivo: <span className="font-mono text-slate-500 dark:text-slate-300">{row.cd_motivo || 'N/A'}</span></p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="bg-[#621f32]/6 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c] px-3 py-1 rounded-xl text-[10px] font-black uppercase border border-[#621f32]/20 dark:border-[#bc955c]/30">
                                    Efectiva: {row.f_efva || '-'}
                                  </span>
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-xl text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700">
                                    Captura: {row.fecha_captura || '-'}
                                  </span>
                                </div>
                              </div>

                              {row.changes && row.changes.length > 0 ? (
                                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-[#621f32]/10 dark:bg-[#bc955c]/10 rounded-lg">
                                      <Activity className="size-3.5 text-[#621f32] dark:text-[#bc955c]" />
                                    </div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-800 dark:text-slate-200">Cambios Estructurales</p>
                                    <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{row.changes.length} detectados</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {row.changes.map((change, cIdx) => (
                                      <div key={cIdx} className="group/change flex flex-col bg-slate-50/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-800 transition-all duration-200 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700">
                                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-3 truncate flex items-center gap-1.5" title={change.label}>
                                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                          {change.label}
                                        </p>
                                        <div className="flex items-center gap-2 sm:gap-3">
                                          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                                            <span className="text-[8px] font-bold uppercase text-slate-400 px-2 py-0.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-md text-center w-full border border-slate-200 dark:border-slate-700/50">Anterior</span>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 line-through truncate w-full text-center" title={change.before}>{change.before}</span>
                                          </div>
                                          <div className="shrink-0 text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-900 rounded-full p-1 border border-slate-200 dark:border-slate-800 group-hover/change:border-[#bc955c]/50 group-hover/change:text-[#bc955c] transition-colors shadow-sm">
                                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                          </div>
                                          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                                            <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md text-center w-full border border-emerald-100 dark:border-emerald-800/50">Nuevo</span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-white truncate w-full text-center" title={change.after}>{change.after}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-5 p-4 bg-slate-50/80 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-3 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
                                  <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                                    <CheckCircle2 className="size-4 text-emerald-500" />
                                  </div>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {index === 0 ? 'Registro de creación (datos iniciales de la posición).' : 'Actualización administrativa sin cambios estructurales.'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-slate-400 text-sm font-medium">No se encontraron registros de historia para esta posición.</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de Detalle de Celda Completa */}
      {mounted && createPortal(
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
      </AnimatePresence>,
      document.body
      )}

      {contextMenu && (
        <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
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
      
      {selectedRowData && (() => {
        const empDetail = detalle.find(emp => String(emp.posicion) === String(selectedRowData.no_pos_actual));
        const matchingEmployee = {
          ...(empDetail || {}),
          ...selectedRowData,
          posicion: selectedRowData.no_pos_actual,
          id_empleado: selectedRowData.id_empleado || (empDetail && empDetail.id_empleado) || "N/A",
          rfc: selectedRowData.rfc || (empDetail && empDetail.rfc) || "N/A",
          nivel: selectedRowData.nivel || selectedRowData.nvl_direc || selectedRowData.grado || (empDetail && empDetail.nivel) || "N/A",
          nombres: selectedRowData.nombres || selectedRowData.nombre_completo || (empDetail && empDetail.nombres) || "DATOS HISTÓRICOS DE POSICIÓN"
        };
        return (
          <EmployeeRecordModal
            isOpen={!!selectedRowData}
            onClose={() => setSelectedRowData(null)}
            record={matchingEmployee}
            columns={columns}
          />
        );
      })()}

    </div>
  );
}



