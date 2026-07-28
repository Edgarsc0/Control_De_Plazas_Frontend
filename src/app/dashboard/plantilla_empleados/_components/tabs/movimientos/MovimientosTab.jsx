"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import {
  Search, Download, Columns, Filter, ArrowUpDown, ChevronLeft,
  ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight,
  X, RotateCcw, Activity, Briefcase, CheckCircle2, XCircle, Layers, UserCheck,
  MousePointerClick, Loader2, Copy, Check, History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";
import HistoryDataTable from "@/components/ui/HistoryDataTable";
import { EmployeeRecordModal } from "../../shared/EmployeesModal";
import VacanciaDetalleModal, { CATEGORIA_VACANCIA_TOOLTIP, TUVO_INSUBSISTENCIA_TOOLTIP } from "../../shared/VacanciaDetalleModal";
import ColumnsModal from "../../shared/ColumnsModal";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import DataTable from "../../shared/DataTable";
import CopyCellMenu from "../../shared/CopyCellMenu";
import CeldaValorModal from "../../shared/CeldaValorModal";
import CeldaHistorialModal from "../../shared/CeldaHistorialModal";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import AdvancedFiltersModal, { AdvancedFiltersButton } from "../../shared/AdvancedFiltersModal";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { usePersistedState } from "../../../_hooks/usePersistedState";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import { useAdvancedFilters } from "../../../_hooks/useAdvancedFilters";
import { matchesTextCondition, finalizeFilterDropdownValues, resolveColumnFilterCommit, sortValueCounts, normalizeForSearch, formatDateEsMx, parseDateParts } from "@/utils/columnFilters";
import { getDeptoInfo } from "@/utils/organigramaCatalog";
import { useOrganigramaCatalog } from "../../../_hooks/useOrganigramaCatalog";
import { getMotivoInfo } from "@/utils/accionesMotivosCatalog";
import { useAccionesMotivosCatalog } from "../../../_hooks/useAccionesMotivosCatalog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

const TUVO_INSUBSISTENCIA_BADGE = {
  S: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200/60 dark:border-amber-900/40", label: "Sí" },
  N: { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-500 dark:text-slate-400", border: "border-slate-200/60 dark:border-slate-700", label: "No" },
};

const MOV_STATUS_BADGE_STYLES = {
  "A": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30", label: "Activo" },
  "I": { bg: "bg-red-50/50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-300", border: "border-red-200/50 dark:border-red-900/40", label: "Inactivo" }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Construye la fecha en horario LOCAL (no UTC) a partir de un string
// 'YYYY-MM-DD' — `new Date(str)` interpreta ese formato como UTC medianoche,
// lo que puede restar un día al comparar contra "hoy" en zonas horarias
// negativas (México).
const parseIsoDate = (str) => {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Días restantes (positivo = futuro, negativo = ya venció) entre hoy y la
// fecha ISO recibida — base de la "semaforización" de fecha_anuencia y del
// tooltip de fecha_vacancia.
const daysUntil = (str) => {
  const target = parseIsoDate(str);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

// Semáforo de "Fecha de Anuencia": 20+ días = verde, 10-19 = ámbar, 9 o
// menos (incluye ya vencida) = rojo.
const getAnuenciaColorClasses = (dias) => {
  if (dias === null) return null;
  if (dias >= 20) return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
  if (dias >= 10) return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
  return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
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
  "pto_compt", "posn_clv", "presupuesto", "nombre_puesto", "fecha_vacancia",
  "categoria_vacancia", "tuvo_insubsistencia",
];

const DATE_KEYS_MOV = ["f_efva", "fecha_est", "fecha_captura", "fh_ult_actz", "fecha_vacancia", "fecha_anuencia"];

// Server-side distinct_search only supports icontains; only safe to forward
// for "positive" conditions (a match always implies icontains too).
const isServerSafeSearchCondition = (condition) => ["contains", "starts_with", "ends_with", "equals"].includes(condition);

// "" real se descarta en buildQuery (val === '') antes de armar la URL, así
// que seleccionar solo "(Vacío)" nunca llegaba al backend. El backend espera
// este sentinel para reconocer la selección de "(Vacío)".
const EMPTY_VALUE_TOKEN = "__EMPTY__";
const encodeFilterValues = (values) => values.map(v => (v === "" ? EMPTY_VALUE_TOKEN : v)).join(",");

// Única columna de MOV_POS con edición manual (CeldaOverride, tabla="MOV_POS"):
// `fecha_anuencia`. Constante de módulo para que la referencia sea estable y no
// re-dispare los fetch del modal de historial.
const HISTORIAL_COLUMNS_MOV_POS = [{ key: "fecha_anuencia", label: "Fecha de Anuencia" }];

export default function MovimientosTab({ movPosData: initialMovPosData = [], detalle = [], isPending, startTransition, cardRef, onCardTitleChange }) {
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
  const { hasPermission } = useAuth();
  const canEditFechaAnuencia = hasPermission(PERMISSIONS.EDIT_PLANTILLA_MOV_POSICIONES);
  const canViewFotoMovPosiciones = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO);
  // Edición inline (doble clic) de "Fecha de Anuencia" — por default es
  // fecha_vacancia + 30 días (calculada al vuelo, ver annotate_fecha_anuencia
  // en el backend); el usuario puede sobreescribirla y ese override persiste
  // independiente de MOV_POS (que se trunca/recarga cada 30 min).
  const [editingAnuencia, setEditingAnuencia] = useState(null); // { noPosActual, value, originalValue, saving, error } | null
  const editAnuenciaCancelledRef = useRef(false);
  const deptoCatalog = useOrganigramaCatalog();
  const { motivosCatalog } = useAccionesMotivosCatalog();
  const { columns, setColumns, toggleVisibility: toggleColumnVisibility, isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen } = useColumnState([
    { key: "no_pos_actual", label: "No. Posición", width: 130, visible: true, isBasic: true },
    { key: "total_movimientos", label: "Histórico", width: 100, visible: true, isBasic: true },
    { key: "ocupacion", label: "Ocupación", width: 120, visible: true, isBasic: true },
    { key: "fecha_vacancia", label: "Fecha de Vacancia", width: 140, visible: true, isBasic: true },
    { key: "fecha_anuencia", label: "Fecha de Anuencia", width: 140, visible: true, isBasic: true },
    { key: "categoria_vacancia", label: "Categoría Vacancia", width: 180, visible: true, isBasic: true },
    { key: "tuvo_insubsistencia", label: "Tuvo Insubsistencia", width: 160, visible: true, isBasic: true },
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
  ], "movimientos_columns");

  const filters = useColumnFilters({ initialColumnFilters: { estado_psn: ["A"], is_latest: ["true"] }, storageKey: "movimientos_filters" });
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
  const [searchQuery, setSearchQuery] = useState("");
  // 7.3 QA: persistir configuración por usuario en localStorage.
  const [sortConfig, setSortConfig] = usePersistedState("movimientos_sort", { key: null, direction: null });
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

  // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, globalSearch, sortConfig.key, sortConfig.direction, appliedAdvancedFilters]);

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

  const activeStatusFilter = columnFilters["estado_psn"] || [];
  const isLatestFilter = columnFilters.is_latest?.includes("true");
  const isMonoColumn = useCallback((key) => ["no_pos_actual", "cd_un", "cd_departamento", "cd_puesto", "maximo", "grado", "esc", "partida_ptal"].includes(key), []);

  const [hoveredSlice, setHoveredSlice] = useState(null);

  const donutData = useMemo(() => {
    const total = stats.todas_posiciones || (stats.posiciones_activas + stats.posiciones_inactivas) || 1;
    const slices = [
      { label: "Activo", count: stats.posiciones_activas || 0, color: "#621f32", key: "A" },
      { label: "Inactivo", count: stats.posiciones_inactivas || 0, color: "#dc2626", key: "I" },
    ];
    let cumulativePercent = 0;
    return slices.map(slice => {
      const percent = slice.count / total, startPercent = cumulativePercent;
      cumulativePercent += percent;
      const endPercent = cumulativePercent;
      const getCoords = (p) => { const angle = 2 * Math.PI * p - Math.PI / 2; return [Math.cos(angle), Math.sin(angle)]; };
      const [startX, startY] = getCoords(startPercent), [endX, endY] = getCoords(endPercent);
      const largeArc = percent > 0.5 ? 1 : 0;
      return { ...slice, percent, pathData: `M ${startX.toFixed(8)} ${startY.toFixed(8)} A 1 1 0 ${largeArc} 1 ${endX.toFixed(8)} ${endY.toFixed(8)} L 0 0 Z` };
    });
  }, [stats]);

  const activeHoverData = hoveredSlice !== null ? donutData[hoveredSlice] : null;

  const handleTabCardClick = (type) => {
    if (type === "A") {
      startTransition(() => {
        const newF = { ...columnFilters };
        newF.estado_psn = ["A"];
        newF.is_latest = ["true"];
        delete newF.ocupacion;
        setColumnFilters(newF);
        setScrollTop(0);
      });
    } else if (type === "I") {
      startTransition(() => {
        const newF = { ...columnFilters };
        newF.estado_psn = ["I"];
        newF.is_latest = ["true"];
        delete newF.ocupacion;
        setColumnFilters(newF);
        setScrollTop(0);
      });
    } else if (type === "Todas") {
      startTransition(() => {
        const newF = { ...columnFilters };
        delete newF.estado_psn;
        newF.is_latest = ["true"];
        delete newF.ocupacion;
        setColumnFilters(newF);
        setSortConfig({ key: null, direction: null });
        setScrollTop(0);
      });
    } else if (type === "Movimientos") {
      setLoading(true);
      startTransition(() => {
        const newF = { ...columnFilters };
        delete newF.estado_psn;
        delete newF.is_latest;
        delete newF.ocupacion;
        setColumnFilters(newF);
        setSortConfig({ key: "custom_movimientos", direction: "desc" });
        setScrollTop(0);
      });
    }
  };

  const activeOcupacionFilter = columnFilters["ocupacion"]?.length === 1 ? columnFilters["ocupacion"][0] : null;

  const handleOcupacionFilter = (e, value) => {
    e.stopPropagation();
    setLoading(true);
    startTransition(() => {
      const newF = { ...columnFilters, estado_psn: ["A"], is_latest: ["true"] };
      if (activeOcupacionFilter === value) {
        delete newF.ocupacion;
      } else {
        newF.ocupacion = [value];
      }
      setColumnFilters(newF);
      setScrollTop(0);
    });
  };

  const cardData = useMemo(() => {
    const total = stats.todas_posiciones || 1;
    return [
      {
        key: "A",
        label: "Posiciones Activas",
        count: stats.posiciones_activas,
        percent: stats.posiciones_activas / total,
        color: "#621f32",
        icon: CheckCircle2,
        isActive: activeStatusFilter.length === 1 && activeStatusFilter[0] === "A" && isLatestFilter,
        onClick: () => handleTabCardClick("A"),
        hoverIndex: 0,
      },
      {
        key: "I",
        label: "Posiciones Inactivas",
        count: stats.posiciones_inactivas,
        percent: stats.posiciones_inactivas / total,
        color: "#dc2626",
        icon: XCircle,
        isActive: activeStatusFilter.length === 1 && activeStatusFilter[0] === "I" && isLatestFilter,
        onClick: () => handleTabCardClick("I"),
        hoverIndex: 1,
      },
      {
        key: "Todas",
        label: "Todas las Posiciones",
        count: stats.todas_posiciones,
        percent: 1.0,
        color: "#059669",
        icon: Layers,
        isActive: activeStatusFilter.length === 0 && isLatestFilter,
        onClick: () => handleTabCardClick("Todas"),
        hoverIndex: null,
      },
      {
        key: "Movimientos",
        label: "Mov. de Posiciones",
        count: stats.total_movimientos,
        percent: null,
        color: "#4f46e5",
        icon: Activity,
        isActive: !isLatestFilter,
        onClick: () => handleTabCardClick("Movimientos"),
        hoverIndex: null,
      }
    ];
  }, [stats, activeStatusFilter, isLatestFilter]);

  const isAnyCardActive = useMemo(() => cardData.some(c => c.isActive), [cardData]);

  const activeCard = useMemo(() => {
    return cardData.find(c => c.isActive);
  }, [cardData]);

  useEffect(() => {
    if (onCardTitleChange && activeCard) {
      onCardTitleChange(activeCard.label);
    }
  }, [activeCard, onCardTitleChange]);

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

  // Valores alcanzables de la columna activa dado el resto de filtros (todos
  // EXCEPTO el propio de esa columna) — fetch "por defecto" (sin buscar);
  // también el universo por defecto para listar/jerarquía de fecha.
  const [reachableColumnValues, setReachableColumnValues] = useState({});
  // Resultados de buscar en TODA la columna (universo completo bajo el mismo
  // scope de card Activas/Inactivas/Todas, sin el resto de filtros) — sólo se
  // piden mientras hay texto en el buscador del dropdown.
  const [searchColumnValues, setSearchColumnValues] = useState({});
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const [hasInitializedTemp, setHasInitializedTemp] = useState(false);


  const reachableValuesCacheRef = useRef({});
  const searchValuesCacheRef = useRef({});
  const movPosDataCacheRef = useRef({});

  const hasFetched = useRef(false);

  // El tab se mantiene montado al cambiar de tab (ver `visitedTabs` en
  // ClientComponent), así que un `router.refresh()` disparado desde otra
  // pestaña (ej. Catálogos > aplicar prioridad de nivel jerárquico) sólo
  // llega como cambio de referencia en `initialMovPosData`. Sin esto, tanto
  // `fullLatestDataRef` (fast-path del toggle Activas/Inactivas/Todas) como
  // `movPosDataCacheRef` (cache por firma de filtros/orden/página) seguirían
  // sirviendo el dataset viejo indefinidamente.
  const initialMovPosDataRef = useRef(initialMovPosData);
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (initialMovPosDataRef.current === initialMovPosData) return;
    initialMovPosDataRef.current = initialMovPosData;
    fullLatestDataRef.current = null;
    movPosDataCacheRef.current = {};
    setRefreshTick((t) => t + 1);
  }, [initialMovPosData]);

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

      const toggleCtrl = new AbortController();
      setLoading(true);
      VacantesService.getMovPosDetalle({ is_latest: "true" }, { signal: toggleCtrl.signal })
        .then(res => res.json())
        .then(resData => {
          const rawList = extractRawList(resData);
          fullLatestDataRef.current = { list: rawList, stats: resData.stats || null };
          const view = filterByEstado(rawList, columnFilters.estado_psn);
          setMovPosData(view);
          setCount(view.length);
          if (resData.stats) setStats(resData.stats);
        })
        .catch(err => { if (err.name !== "AbortError") console.error("Error loading MovPosDetalle:", err); })
        .finally(() => setLoading(false));
      return () => toggleCtrl.abort();
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

    const listCtrl = new AbortController();
    VacantesService.getMovPosDetalle(params, { signal: listCtrl.signal })
      .then(res => res.json())
      .then(resData => {
        movPosDataCacheRef.current[signature] = resData;
        setMovPosData(resData.results || []);
        setCount(resData.count || 0);
        if (resData.stats) {
          setStats(resData.stats);
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Error loading MovPosDetalle:", err); })
      .finally(() => setLoading(false));
    return () => listCtrl.abort();
  }, [page, pageSize, debouncedSearch, debouncedTextFilters, columnFilters, sortConfig, appliedAdvancedFilters, refreshTick]);

  // Valores alcanzables (fetch "por defecto", sin buscar): distinct values
  // scopeados igual que el card activo (Activas/Inactivas/Todas -> última
  // posición por Nº Pos Actual, filtrada por Estado Psn si aplica; Mov. de
  // Posiciones -> tabla MOV_POS completa) MÁS el resto de filtros/búsqueda
  // activos en la tabla (search, texto por columna, otros column filters,
  // avanzados), excepto el de la propia columna (no debe filtrarse contra sí
  // misma). Antes esto se calculaba client-side desde `filteredSortedData`,
  // que en modo paginado es solo la página actual (50 filas) — el conteo no
  // reflejaba el total filtrado real.
  useEffect(() => {
    if (!activeFilterDropdown) return;

    const params = {
      distinct_field: activeFilterDropdown,
      distinct_search: "",
      is_latest: isLatestFilter ? "true" : "false"
    };
    if (isLatestFilter && activeStatusFilter.length === 1) {
      params.estado_psn__in = activeStatusFilter[0];
    }

    params.search = debouncedSearch;
    Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
      if (!filterObj || !filterObj.value || !filterObj.value.trim()) return;
      const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
      let suffix = "";
      if (cond === "contains") suffix = "__icontains";
      else if (cond === "not_contains") { params[`exclude__${colKey}__icontains`] = filterObj.value.trim(); return; }
      else if (cond === "starts_with") suffix = "__istartswith";
      else if (cond === "not_starts_with") { params[`exclude__${colKey}__istartswith`] = filterObj.value.trim(); return; }
      else if (cond === "ends_with") suffix = "__iendswith";
      else if (cond === "not_ends_with") { params[`exclude__${colKey}__iendswith`] = filterObj.value.trim(); return; }
      else if (cond === "equals") suffix = "__iexact";
      else if (cond === "not_equals") { params[`exclude__${colKey}__iexact`] = filterObj.value.trim(); return; }
      params[`${colKey}${suffix}`] = filterObj.value.trim();
    });
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (key === "is_latest" || key === "estado_psn" || key === activeFilterDropdown) return;
      if (values && values.length > 0) {
        params[`${key}__in`] = encodeFilterValues(values);
      }
    });
    if (appliedAdvancedFilters.length > 0) {
      params.advanced_filters = JSON.stringify(appliedAdvancedFilters);
    }

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

    const cached = reachableValuesCacheRef.current[activeFilterDropdown];
    if (cached && cached.signature === signature) {
      // Same column, same effective filters as last fetch: reuse cached values.
      setReachableColumnValues(prev => (prev[activeFilterDropdown] === cached.values ? prev : { ...prev, [activeFilterDropdown]: cached.values }));
      initTempSelected(cached.values);
      setLoadingUniqueValues(false);
      return;
    }

    setLoadingUniqueValues(true);
    const ctrl = new AbortController();
    VacantesService.getMovPosDetalle(params, { signal: ctrl.signal })
      .then(res => res.json())
      .then(resData => {
        const valuesList = sortValueCounts(Array.isArray(resData) ? resData : []);
        reachableValuesCacheRef.current[activeFilterDropdown] = { signature, values: valuesList };
        setReachableColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
        initTempSelected(valuesList);
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Error cargando valores alcanzables:", err); })
      .finally(() => setLoadingUniqueValues(false));
    return () => ctrl.abort();
  }, [activeFilterDropdown, columnFilters, debouncedSearch, debouncedTextFilters, appliedAdvancedFilters, isLatestFilter, activeStatusFilter, isMonoColumn]);

  // Buscar en TODA la columna: sólo cuando hay texto en el buscador del
  // dropdown, igual al que antes disparaba el tab "Todos los datos" — mismo
  // scope de card (is_latest/estado_psn) pero sin el resto de filtros. No
  // depende de `loadingUniqueValues` (no bloquea la lista con un skeleton en
  // cada tecla): mientras llega, se ve la lista de alcanzables ya cargada.
  useEffect(() => {
    if (!activeFilterDropdown || !debouncedFilterSearchText) return;
    const isDateCol = DATE_KEYS_MOV.includes(activeFilterDropdown);
    const params = {
      distinct_field: activeFilterDropdown,
      distinct_search: (isDateCol || isServerSafeSearchCondition(filterSearchCondition)) ? debouncedFilterSearchText : "",
      is_latest: isLatestFilter ? "true" : "false"
    };
    if (isLatestFilter && activeStatusFilter.length === 1) {
      params.estado_psn__in = activeStatusFilter[0];
    }

    const signature = JSON.stringify(params);
    const cached = searchValuesCacheRef.current[activeFilterDropdown];
    if (cached && cached.signature === signature) {
      setSearchColumnValues(prev => (prev[activeFilterDropdown] === cached.values ? prev : { ...prev, [activeFilterDropdown]: cached.values }));
      return;
    }

    const ctrl = new AbortController();
    VacantesService.getMovPosDetalle(params, { signal: ctrl.signal })
      .then(res => res.json())
      .then(resData => {
        const valuesList = sortValueCounts(Array.isArray(resData) ? resData : []);
        searchValuesCacheRef.current[activeFilterDropdown] = { signature, values: valuesList };
        setSearchColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Error buscando en toda la columna:", err); });
    return () => ctrl.abort();
  }, [activeFilterDropdown, debouncedFilterSearchText, filterSearchCondition, isLatestFilter, activeStatusFilter]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [modalHistoryData, setModalHistoryData] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [cardWidth, setCardWidth] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('timeline');
  const [comparingIndex, setComparingIndex] = useState(null);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [copiedPorIndex, setCopiedPorIndex] = useState(null);
  const { toast } = useToast();

  // navigator.clipboard requiere secure context (HTTPS o localhost);
  // en el servidor por IP/HTTP plano no existe, cae a execCommand.
  const copyPor = async (text, index) => {
    const value = text || '';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPorIndex(index);
      toast.success('Se ha copiado al portapapeles!');
      setTimeout(() => setCopiedPorIndex(null), 1200);
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  // Modal "Historial de Cambios" — mismo componente del tab Detalle, pero
  // contra el historial de CeldaOverride de la tabla MOV_POS.
  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  const openHistorialModal = useCallback(() => setIsHistorialModalOpen(true), []);
  const formatHistorialValue = useCallback((colKey, val) => (
    DATE_KEYS_MOV.includes(colKey) || colKey === "fecha_anuencia" ? formatDateEsMx(val) : String(val)
  ), []);

  const [isVacanciaModalOpen, setIsVacanciaModalOpen] = useState(false);
  const [vacanciaRowId, setVacanciaRowId] = useState(null);
  const [vacanciaDetalle, setVacanciaDetalle] = useState(null);
  const [isVacanciaLoading, setIsVacanciaLoading] = useState(false);

  const openVacanciaModal = useCallback((row) => {
    if (!row || row.id === undefined || row.id === null) return;
    setSelectedRowData(null);
    setVacanciaRowId(row.id);
    setIsVacanciaModalOpen(true);
  }, []);

  // ── Edición inline de "Fecha de Anuencia" (doble clic) ─────────────────
  const startEditAnuencia = useCallback((row) => {
    if (!canEditFechaAnuencia) return;
    const current = row.fecha_anuencia && String(row.fecha_anuencia).trim() !== "" ? String(row.fecha_anuencia) : "";
    setEditingAnuencia({ noPosActual: row.no_pos_actual, value: current, originalValue: current, saving: false, error: null });
  }, [canEditFechaAnuencia]);

  const commitEditAnuencia = useCallback(async () => {
    if (!editingAnuencia || editingAnuencia.saving) return;
    const { noPosActual, value, originalValue } = editingAnuencia;
    if (value === originalValue) { setEditingAnuencia(null); return; }
    if (!value) {
      // Campo vaciado por el usuario: revertir al cálculo automático.
      setEditingAnuencia((c) => (c ? { ...c, saving: true, error: null } : c));
      try {
        const res = await VacantesService.deleteFechaAnuenciaOverride(noPosActual);
        if (!res.ok) throw new Error("No se pudo revertir a la fecha automática.");
        const body = await res.json();
        setMovPosData((prev) => prev.map((r) => (r.no_pos_actual === noPosActual ? { ...r, fecha_anuencia: body.fecha_anuencia ?? "", fecha_anuencia_override: false } : r)));
        // Evita que un futuro cambio de filtro/orden/página que coincida con
        // una firma ya cacheada sirva la respuesta vieja (sin este revert).
        movPosDataCacheRef.current = {};
        setEditingAnuencia(null);
      } catch (err) {
        setEditingAnuencia((c) => (c ? { ...c, saving: false, error: err.message || "Error al guardar." } : c));
      }
      return;
    }
    setEditingAnuencia((c) => (c ? { ...c, saving: true, error: null } : c));
    try {
      const res = await VacantesService.patchFechaAnuenciaOverride(noPosActual, value);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo guardar la fecha.");
      }
      const body = await res.json();
      setMovPosData((prev) => prev.map((r) => (r.no_pos_actual === noPosActual ? { ...r, fecha_anuencia: body.fecha_anuencia, fecha_anuencia_override: true } : r)));
      // Ídem: sin esto, volver a la misma firma de filtros/orden/página
      // mostraría la fecha de antes del override.
      movPosDataCacheRef.current = {};
      setEditingAnuencia(null);
    } catch (err) {
      setEditingAnuencia((c) => (c ? { ...c, saving: false, error: err.message || "Error al guardar." } : c));
    }
  }, [editingAnuencia]);

  const handleAnuenciaKeyDown = useCallback((e) => {
    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); editAnuenciaCancelledRef.current = true; setEditingAnuencia(null); }
  }, []);

  const handleAnuenciaBlur = useCallback(() => {
    if (editAnuenciaCancelledRef.current) { editAnuenciaCancelledRef.current = false; return; }
    commitEditAnuencia();
  }, [commitEditAnuencia]);

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
    const lower = normalizeForSearch(timelineSearch);
    return timelineData.filter(row =>
      (row.motivo && normalizeForSearch(row.motivo).includes(lower)) ||
      (row.cd_motivo && normalizeForSearch(row.cd_motivo).includes(lower))
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



  const getColumnLetter = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const fetchAdvValueSuggestions = useCallback((column) =>
    VacantesService.getMovPosDetalle({ distinct_field: column, distinct_search: "", is_latest: "false" })
      .then(res => res.json())
      .then(data => (Array.isArray(data) ? data : [])), []);

  // Universo listado/jerarquía de fecha de la columna activa: valores
  // alcanzables (fetch por defecto) unidos con los de "buscar en toda la
  // columna" cuando hay texto en el buscador (si no, es exactamente lo
  // alcanzable — mismo costo/forma que antes).
  const mergedColumnValues = useMemo(() => {
    if (!activeFilterDropdown) return {};
    const reachableList = reachableColumnValues[activeFilterDropdown] || [];
    if (!debouncedFilterSearchText) return { [activeFilterDropdown]: reachableList };
    const searchList = searchColumnValues[activeFilterDropdown] || [];
    const merged = new Map(reachableList.map(v => [v.value, v]));
    searchList.forEach(v => { if (!merged.has(v.value)) merged.set(v.value, v); });
    return { [activeFilterDropdown]: sortValueCounts([...merged.values()]) };
  }, [activeFilterDropdown, reachableColumnValues, searchColumnValues, debouncedFilterSearchText]);

  // Valores alcanzables (plano, sin conteo) de la columna activa — gobierna
  // qué se puede marcar/desmarcar en ColumnFilterDropdown.
  const reachableValues = useMemo(
    () => (reachableColumnValues[activeFilterDropdown] || []).map(v => v.value),
    [activeFilterDropdown, reachableColumnValues]
  );

  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS_MOV.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      const valuesList = mergedColumnValues[key] || [];
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
  }, [mergedColumnValues, activeFilterDropdown, parseDateParts]);

  const allDateLeafValues = useMemo(() => {
    if (!activeFilterDropdown || !isDateColumn(activeFilterDropdown)) return [];
    return [...new Set((mergedColumnValues[activeFilterDropdown] || []).map(item => String(item.value).trim()))];
  }, [mergedColumnValues, activeFilterDropdown, isDateColumn]);

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      const valuesList = mergedColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'month') {
      const year = parentPath;
      const valuesList = mergedColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      const valuesList = mergedColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(item => String(item.value).trim());
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

  // Compara contra `reachableValues` (no se achica al buscar dentro del
  // dropdown, a diferencia del viejo listado único) para decidir si la
  // selección equivale a "sin filtro".
  const applyColumnFilter = (colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
    if (shouldClear) {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    } else {
      setColumnFilters({ ...columnFilters, [colKey]: valuesToCommit });
    }
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };

  const clearColumnFilter = (colKey) => {
    const newFilters = { ...columnFilters };
    delete newFilters[colKey];
    setColumnFilters(newFilters);
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setLoading(true);
    resetAdvancedFilters();
    startTransition(() => {
      const newFilters = {};
      if (columnFilters.estado_psn) {
        newFilters.estado_psn = columnFilters.estado_psn;
      }
      if (columnFilters.is_latest) {
        newFilters.is_latest = columnFilters.is_latest;
      }
      setColumnFilters(newFilters);
      setTextFilters({});
      setGlobalSearch("");
      
      const isLatest = columnFilters.is_latest?.includes("true");
      if (!isLatest) {
        setSortConfig({ key: "custom_movimientos", direction: "desc" });
      } else {
        setSortConfig({ key: null, direction: null });
      }
    });
  };

  const handleStatusFilter = (label) => {
    const current = columnFilters["estado_psn"] || [];
    const next = current.includes(label) ? current.filter(s => s !== label) : [...current, label];
    const newFilters = { ...columnFilters };
    if (next.length === 0 || next.length === reachableColumnValues["estado_psn"]?.length) delete newFilters["estado_psn"];
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
    const shouldLock = 
      !!activeFilterDropdown || 
      isColumnsModalOpen || 
      isVacanciaModalOpen || 
      isHistoryModalOpen || 
      isCellModalOpen || 
      isAdvancedFiltersOpen || 
      !!selectedRowData;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    activeFilterDropdown, 
    isColumnsModalOpen, 
    isVacanciaModalOpen, 
    isHistoryModalOpen, 
    isCellModalOpen, 
    isAdvancedFiltersOpen, 
    selectedRowData
  ]);

  const filteredSortedData = movPosData;

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown || isDateColumn(activeFilterDropdown)) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };

    // El universo (alcanzables + búsqueda en toda la columna cuando aplica) ya
    // llega resuelto del backend (ver los dos useEffect de arriba) — no hay
    // que recalcular nada client-side (antes se recontaba desde
    // `filteredSortedData`, que en modo paginado es solo la página actual).
    const baseUniqueValues = (mergedColumnValues[activeFilterDropdown] || []).map(v => typeof v === 'object' ? v : { value: v, count: 0 });

    const filtered = baseUniqueValues.filter(v => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText));

    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
      reachableValues,
    });
  }, [activeFilterDropdown, isDateColumn, mergedColumnValues, reachableValues, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

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

  useEffect(() => {
    let active = true;
    if (isVacanciaModalOpen && vacanciaRowId !== null) {
      setIsVacanciaLoading(true);
      setVacanciaDetalle(null);
      VacantesService.getMovPosVacanciaDetalle(vacanciaRowId)
        .then(res => res.json())
        .then(data => {
          if (active) setVacanciaDetalle(data);
        })
        .catch(err => {
          console.error("Error fetching vacancia detalle:", err);
          if (active) setVacanciaDetalle({ error: "Error al cargar el detalle de la vacancia." });
        })
        .finally(() => { if (active) setIsVacanciaLoading(false); });
    } else {
      setVacanciaDetalle(null);
    }
    return () => { active = false; };
  }, [isVacanciaModalOpen, vacanciaRowId]);

  const rowHeight = 37, containerHeight = 800;
  const totalPages = isLatestFilter ? 1 : (Math.ceil(count / pageSize) || 1);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const renderCell = useCallback(({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    if (col.key === "estado_psn") {
      const badge = MOV_STATUS_BADGE_STYLES[value] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: value };
      return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={`px-4 text-[10px] border-r align-middle h-[37px] transition-all ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span></td>);
    }
    const isPosicionCol = col.key === "no_pos_actual";
    // 7.6 QA: la columna "Histórico" (total_movimientos) mostraba sólo un
    // número sin acción — ahora abre el mismo timeline que la columna Posición.
    const isHistoricoCol = col.key === "total_movimientos";
    const handleCellClick = (e) => { onClick(e); if (isPosicionCol || isHistoricoCol) { setActiveModalTab('timeline'); setComparingIndex(null); setTimelineSearch(''); setIsHistoryModalOpen(true); } };
    if (col.key === "fecha_vacancia") {
      const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} font-semibold ${hasValue ? "cursor-pointer hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c]" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const handleVacanciaClick = (e) => { onClick(e); if (hasValue) openVacanciaModal(row); };
      const content = hasValue ? (<div className="flex items-center justify-between gap-2"><span>{formatDateEsMx(value)}</span><MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title="Clic para ver detalle de vacancia" /></div>) : <span className="text-slate-300">-</span>;
      return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={handleVacanciaClick} className={tdClassName}>{content}</td>);
    }
    if (col.key === "fecha_anuencia") {
      const isEditingThis = editingAnuencia?.noPosActual === row.no_pos_actual;
      if (isEditingThis) {
        const tdClassNameEdit = `px-2 text-xs border-r h-[37px] align-middle relative ${isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10"} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
        return (
          <td key={col.key} style={stickyStyle} className={tdClassNameEdit}>
            <input
              type="date"
              autoFocus
              value={editingAnuencia.value}
              disabled={editingAnuencia.saving}
              onChange={(e) => setEditingAnuencia((c) => (c ? { ...c, value: e.target.value } : c))}
              onKeyDown={handleAnuenciaKeyDown}
              onBlur={handleAnuenciaBlur}
              className="w-full h-full px-1 text-xs font-semibold bg-white dark:bg-slate-900 border border-[#621f32] rounded outline-none disabled:opacity-50"
            />
            {editingAnuencia.error && (
              <span className="absolute left-1 top-full mt-0.5 z-20 text-[9px] font-bold text-red-600 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">{editingAnuencia.error}</span>
            )}
          </td>
        );
      }
      const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
      const dias = hasValue ? daysUntil(value) : null;
      const isOverride = !!row.fecha_anuencia_override;
      // El override manual (azul) tiene prioridad visual sobre el semáforo de
      // urgencia — "editado a mano" es la señal más relevante para identificarlo.
      const colorClasses = isOverride
        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
        : (dias !== null ? getAnuenciaColorClasses(dias) : null);
      // El color (semáforo o azul de override) se conserva SIEMPRE, incluso
      // seleccionada — antes `isSelected` reemplazaba el fondo por blanco,
      // apagando el color mientras la celda estaba seleccionada.
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle font-semibold ${
        colorClasses || (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")
      } ${isSelected ? "ring-2 ring-[#621f32] z-10 shadow-md" : ""} ${canEditFechaAnuencia ? "cursor-pointer" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = hasValue ? formatDateEsMx(value) : <span className="text-slate-300">-</span>;
      const handleAnuenciaDoubleClick = (e) => { e.stopPropagation(); startEditAnuencia(row); };
      if (dias === null) {
        return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} onDoubleClick={handleAnuenciaDoubleClick} className={tdClassName} title={canEditFechaAnuencia ? "Doble clic para editar" : undefined}>{content}</td>);
      }
      // Tooltip con los días restantes para llegar a esta fecha (o los que
      // ya pasaron desde que venció) — ver daysUntil.
      const tooltipMsg = (dias > 0
        ? `Faltan ${dias} ${dias === 1 ? "día" : "días"} para la fecha de anuencia`
        : dias === 0
        ? "Hoy vence la fecha de anuencia"
        : `La fecha de anuencia venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`
      ) + (isOverride ? " (fecha editada manualmente)" : "");
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} onDoubleClick={handleAnuenciaDoubleClick} className={tdClassName}>{content}</td>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipMsg}{canEditFechaAnuencia ? " — doble clic para editar" : ""}</TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "categoria_vacancia") {
      const cat = value ? String(value).trim().toUpperCase() : "";
      const tooltipText = CATEGORIA_VACANCIA_TOOLTIP[cat];
      const content = cat === "" ? <span className="text-slate-300">-</span> : String(value);
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} font-semibold ${tooltipText ? "cursor-help" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      if (!tooltipText) {
        return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>);
      }
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "tuvo_insubsistencia") {
      const key = value ? String(value).trim().toUpperCase() : "N";
      const badge = TUVO_INSUBSISTENCIA_BADGE[key] || TUVO_INSUBSISTENCIA_BADGE.N;
      const tooltipText = TUVO_INSUBSISTENCIA_TOOLTIP[key];
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} cursor-help ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>{badge.label}</span>;
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "ocupacion") {
      const isOcupada = value === "Ocupada";
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${
        isSelected
          ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
          : isSticky
          ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
          : "bg-white/10 text-slate-700 dark:text-slate-300"
      } font-semibold ${isOcupada ? "cursor-help" : ""} ${
        isSticky ? "shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]" : ""
      }`;
      const badge = value && (
        <span
          className={`inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase leading-none shadow-sm ${
            isOcupada
              ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
              : "bg-slate-100 text-slate-500 border border-slate-200"
          }`}
        >
          {value}
        </span>
      );
      const content = <div className="flex items-center">{badge}</div>;

      if (isOcupada && (row.ocupante_id || row.ocupante_nombre)) {
        return (
          <Tooltip key={col.key}>
            <TooltipTrigger asChild>
              <td
                style={stickyStyle}
                onContextMenu={onContextMenu}
                onClick={handleCellClick}
                className={tdClassName}
              >
                {content}
              </td>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-slate-900 dark:bg-slate-800 text-slate-100 dark:text-slate-100 border border-slate-700/60 p-2.5 rounded-lg shadow-xl z-50 text-xs flex flex-col gap-1 min-w-[240px] max-w-[360px] w-max"
            >
              <div className="font-bold border-b border-slate-800 pb-1 mb-1 text-emerald-400">
                Ocupante de la Plaza
              </div>
              <div className="flex justify-between gap-4 items-center">
                <span className="text-slate-400 font-medium">No. Empleado:</span>
                <span className="font-mono font-bold">{row.ocupante_id || "N/A"}</span>
              </div>
              <div className="mt-0.5 leading-relaxed break-words">
                <span className="text-slate-400 font-medium">Nombre: </span>
                <span className="font-bold">{row.ocupante_nombre || "N/A"}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }

      return (
        <td
          key={col.key}
          style={stickyStyle}
          onContextMenu={onContextMenu}
          onClick={handleCellClick}
          className={tdClassName}
        >
          {content}
        </td>
      );
    }
    if (col.key === "motivo") {
      const motivoInfo = getMotivoInfo(motivosCatalog, value);
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} font-semibold ${motivoInfo ? "cursor-help" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = value === undefined || value === null || String(value).trim() === "" ? <span className="text-slate-300">-</span> : String(value);
      if (!motivoInfo) {
        return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>);
      }
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{motivoInfo.cd_motivo}</span>
              <span className="text-[10px] opacity-80">{motivoInfo.descripcion_larga || "Sin descripción"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "cd_departamento") {
      const deptoInfo = getDeptoInfo(deptoCatalog, value);
      const tdClassName = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${deptoInfo ? "cursor-help" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = value === undefined || value === null || String(value).trim() === "" ? <span className="text-slate-300">-</span> : String(value);
      if (!deptoInfo) {
        return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>);
      }
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onContextMenu={onContextMenu} onClick={onClick} className={tdClassName}>{content}</td>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{deptoInfo.nombre}</span>
              <span className="text-[10px] opacity-80">Nivel: {deptoInfo.nivel || "N/D"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={handleCellClick} className={`px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${isPosicionCol || isHistoricoCol ? "cursor-pointer hover:bg-[#621f32]/10 hover:text-[#621f32] hover:underline" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}>{col.key === "total_movimientos" ? (<div className="flex justify-center items-center gap-1">{value !== undefined && value !== null ? (<><span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#621f32]/10 text-[#621f32] dark:bg-[#bc955c]/20 dark:text-[#bc955c] border border-[#621f32]/20 dark:border-[#bc955c]/30 text-[10px] font-black leading-none shadow-sm">{value}</span><MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title="Clic para ver histórico de la posición" /></>) : <span className="text-slate-300">-</span>}</div>) : value === undefined || value === null || String(value).trim() === "" ? (<span className="text-slate-300">-</span>) : isPosicionCol ? (<div className="flex items-center justify-between gap-2"><span>{String(value)}</span><MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title="Clic para ver histórico de la posición" /></div>) : (isDateColumn(col.key) ? formatDateEsMx(value) : String(value))}</td>);
  }, [isMonoColumn, isDateColumn, openVacanciaModal, setActiveModalTab, setComparingIndex, setTimelineSearch, setIsHistoryModalOpen, deptoCatalog, motivosCatalog, editingAnuencia, canEditFechaAnuencia, startEditAnuencia, handleAnuenciaKeyDown, handleAnuenciaBlur]);

  const handleCellContextMenu = useCallback((e, value, rect) => {
    setContextMenu({ x: e.clientX, y: e.clientY, value, rect });
  }, []);

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

  const canReset = useMemo(() => {
    const isLatest = columnFilters.is_latest?.includes("true");
    const defaultSortKey = isLatest ? null : "custom_movimientos";
    const defaultSortDir = isLatest ? null : "desc";
    const hasActiveSort = sortConfig.key !== defaultSortKey || (sortConfig.key && sortConfig.direction !== defaultSortDir);
    const hasColumnFilters = Object.keys(columnFilters).some(k => k !== "estado_psn" && k !== "is_latest");
    const hasTextFilters = Object.values(textFilters).some(v => v && v.value);
    const hasAdvancedFilters = appliedAdvancedFilters.length > 0;
    const hasGlobalSearch = !!globalSearch;
    return hasGlobalSearch || hasColumnFilters || hasTextFilters || hasAdvancedFilters || hasActiveSort;
  }, [columnFilters, sortConfig, textFilters, appliedAdvancedFilters, globalSearch]);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="w-full flex flex-col">
      <div className="w-full px-4 lg:px-6 pt-2">
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch max-w-6xl mx-auto">
            {/* Donut Chart */}
            <div className="lg:col-span-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center min-h-[180px]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-3 w-full text-center">Distribución de Estatus</h3>
              <div className="relative size-28 flex items-center justify-center">
                <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90 select-none">
                  <defs>
                    <mask id="donut-mask-movimientos">
                      <circle cx="0" cy="0" r="1" fill="white" />
                      <circle cx="0" cy="0" r="0.65" fill="black" />
                    </mask>
                  </defs>
                  <g mask="url(#donut-mask-movimientos)">
                    {donutData.map((slice, i) => (
                      <path
                        key={slice.label}
                        d={slice.pathData}
                        fill={slice.color}
                        className="cursor-pointer transition-all duration-300 origin-center hover:opacity-90"
                        style={{
                          transform: hoveredSlice === i ? "scale(1.04)" : "scale(1.0)",
                          opacity: activeStatusFilter.length > 0 && !activeStatusFilter.includes(slice.key) ? 0.35 : 1
                        }}
                        onMouseEnter={() => setHoveredSlice(i)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => handleTabCardClick(slice.key)}
                      />
                    ))}
                  </g>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center flex-col p-1">
                  <AnimatePresence mode="wait">
                    {activeHoverData ? (
                      <motion.div
                        key={activeHoverData.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[80px]">
                          {activeHoverData.label}
                        </span>
                        <br />
                        <span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">
                          {formatNumber(activeHoverData.count)}
                        </span>
                        <br />
                        <span
                          className="text-[8px] font-extrabold px-2 py-0.5 rounded-full mt-1 border border-current"
                          style={{
                            color: activeHoverData.color,
                            backgroundColor: `${activeHoverData.color}15`
                          }}
                        >
                          {(activeHoverData.percent * 100).toFixed(1)}%
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="total"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Total L.
                        </span>
                        <br />
                        <span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">
                          {formatNumber(stats.todas_posiciones)}
                        </span>
                        <br />
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full">
                          100%
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Grid of cards */}
            <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {cardData.map((card, index) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.key}
                    onMouseEnter={() => {
                      if (card.hoverIndex !== null) setHoveredSlice(card.hoverIndex);
                    }}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`rounded-xl border-2 transition-all duration-200 shadow-sm flex flex-col relative overflow-hidden ${
                      card.isActive
                        ? "border-[#621f32] dark:border-[#bc955c] shadow-md bg-white dark:bg-slate-900"
                        : isAnyCardActive
                        ? "border-slate-200/50 dark:border-slate-800/80 opacity-55 hover:opacity-85 bg-white/60 dark:bg-slate-900/60"
                        : hoveredSlice === card.hoverIndex && card.hoverIndex !== null
                        ? "border-[#621f32]/40 dark:border-[#bc955c]/40 shadow-md bg-white dark:bg-slate-900"
                        : "border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60"
                    }`}
                  >
                    {card.isActive && (
                      <div className="absolute top-2 right-2 z-20">
                        <span className="relative flex size-1.5 rounded-full" style={{ backgroundColor: card.color }}>
                          <span
                            className="animate-ping absolute inline-flex size-1.5 rounded-full opacity-75"
                            style={{ backgroundColor: card.color }}
                          />
                        </span>
                      </div>
                    )}
                    <motion.div
                      onClick={card.onClick}
                      whileHover={{ scale: 1.03, y: -2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="px-3 py-3 flex flex-col justify-between flex-1 group cursor-pointer relative"
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-200 pointer-events-none"
                        style={{ backgroundColor: card.color }}
                      />
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="p-1.5 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${card.color}15`, color: card.color }}
                        >
                          <IconComponent className="size-3.5" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500 truncate">
                          {card.label}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                          {formatNumber(card.count)}
                        </h4>
                        <div className="w-full bg-slate-100 dark:bg-slate-800/60 h-1 rounded-full overflow-hidden mt-2">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: card.color }}
                            initial={{ width: 0 }}
                            animate={{ width: card.percent !== null ? `${card.percent * 100}%` : "100%" }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 mt-1">
                          {card.percent !== null ? `${(card.percent * 100).toFixed(1)}%` : "Historial completo"}
                        </p>
                      </div>
                    </motion.div>
                    {card.key === "A" && (
                      <div className="px-3 pb-3">
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                          <button
                            onClick={(e) => handleOcupacionFilter(e, "Ocupada")}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all ${
                              activeOcupacionFilter === "Ocupada"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-slate-200/60 dark:border-slate-700/60 hover:text-emerald-600 hover:border-emerald-300"
                            }`}
                          >
                            <UserCheck className="size-3" /> Ocupadas
                          </button>
                          <button
                            onClick={(e) => handleOcupacionFilter(e, "Vacante")}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all ${
                              activeOcupacionFilter === "Vacante"
                                ? "bg-[#bc955c]/10 text-[#8d6a3d] dark:text-[#ebd1ac] border-[#bc955c]/30"
                                : "bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-slate-200/60 dark:border-slate-700/60 hover:text-[#bc955c] hover:border-[#bc955c]/40"
                            }`}
                          >
                            <Briefcase className="size-3" /> Vacantes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
              { icon: RotateCcw, label: "Restablecer filtros", onClick: resetAllFilters, disabled: !canReset },
              { icon: Filter, label: "Filtros avanzados", onClick: () => setIsAdvancedFiltersOpen(true), badge: appliedAdvancedFilters.length },
              { icon: Columns, label: "Columnas", onClick: () => setIsColumnsModalOpen(true) },
              { icon: History, label: "Historial de Cambios", onClick: openHistorialModal },
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
                  <span className="text-[9px] font-black uppercase text-slate-500 leading-none mb-1">Registros</span>
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
                    {/* 7.12 QA: paginación server-side sólo tenía ‹ › — se agregan
                        primera/última página y un campo para saltar a la página N. */}
                    <button
                      onClick={() => { setLoading(true); setPage(1); }}
                      disabled={page === 1 || loading}
                      title="Primera página"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronsLeft className="size-3.5" />
                    </button>
                    <button
                      onClick={() => { setLoading(true); setPage(p => Math.max(1, p - 1)); }}
                      disabled={page === 1 || loading}
                      title="Página anterior"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
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
                    <button
                      onClick={() => { setLoading(true); setPage(p => Math.min(totalPages, p + 1)); }}
                      disabled={page === totalPages || loading}
                      title="Página siguiente"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </button>
                    <button
                      onClick={() => { setLoading(true); setPage(totalPages); }}
                      disabled={page === totalPages || loading}
                      title="Última página"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      <ChevronsRight className="size-3.5" />
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
              <button onClick={resetAllFilters} disabled={!canReset} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-950/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all duration-300 shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"><RotateCcw className="size-3.5" /><span>Restablecer Filtros</span></button>
              <button onClick={openHistorialModal} title="Ver historial de ediciones manuales de esta tabla" className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer flex-shrink-0"><History className="size-3.5" /><span>Historial de Cambios</span></button>
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
            setColumnFilters={setColumnFilters}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            activeConditionDropdown={activeConditionDropdown}
            setActiveConditionDropdown={setActiveConditionDropdown}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            onCellContextMenu={handleCellContextMenu}
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
                  {
                    key: "fecha_vacancia",
                    label: "Vacancia",
                    onClick: (r) => {
                      const hasValue = r.fecha_vacancia !== undefined && r.fecha_vacancia !== null && String(r.fecha_vacancia).trim() !== "";
                      if (hasValue) openVacanciaModal(r);
                    },
                    valueClassName: () => "text-[#621f32] dark:text-[#bc955c] underline decoration-dotted underline-offset-2",
                  },
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
            dateValues={(mergedColumnValues[activeFilterDropdown] || []).map(i => i.value)}
            allDateLeafValues={allDateLeafValues}
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

      {/* Modal de Detalle de Posición Histórica */}
      {mounted && createPortal(
        <AnimatePresence>
        {isHistoryModalOpen && selectedCell && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full z-[9999] flex flex-col overflow-hidden h-[80vh] transition-[max-width] duration-500 ease-in-out ${activeModalTab === 'timeline' ? 'max-w-3xl' : 'max-w-[95vw]'}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-gradient-to-br from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] flex items-center justify-center shadow-md">
                    <Briefcase className="size-6 text-white dark:text-[#3e131f]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#621f32] dark:text-[#bc955c] leading-tight">
                      Detalle de Posición
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      No. Posición: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{filteredSortedData[selectedCell.row]?.no_pos_actual || 'N/A'}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 px-6 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button
                  onClick={() => { setActiveModalTab('timeline'); setComparingIndex(null); }}
                  className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${activeModalTab === 'timeline' ? 'border-[#621f32] text-[#621f32] dark:border-[#bc955c] dark:text-[#bc955c]' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  Línea de Tiempo
                </button>
                <button
                  onClick={() => { setActiveModalTab('tabla'); setComparingIndex(null); }}
                  className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${(activeModalTab === 'tabla' || activeModalTab === 'diff_table') ? 'border-[#621f32] text-[#621f32] dark:border-[#bc955c] dark:text-[#bc955c]' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  Vista de Tabla
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/50 custom-scrollbar relative flex flex-col">
                {isModalLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#621f32] dark:text-[#bc955c]">
                    <Loader2 className="size-10 animate-spin mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Cargando historial...</p>
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
                                    <td key={col.key} className={`px-4 text-xs border-r truncate h-[37px] align-middle bg-white/10 text-slate-600 dark:text-slate-300 ${isMonoColumn(col.key) ? 'font-mono font-bold' : 'font-medium'}`}>
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
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[200px]">
                          <Search className="size-12 mb-4 opacity-50" />
                          <p className="font-bold">No se encontraron registros de historia para esta posición.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Timeline ── */
                  <div className="w-full px-4 sm:px-6 pt-3 pb-6 flex flex-col gap-6">
                    {/* Search */}
                    <div className="relative max-w-md mx-auto sm:mx-0 w-full">
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
                      <div className="relative border-l-2 border-[#621f32]/20 dark:border-[#bc955c]/20 ml-14 flex flex-col">
                        {filteredTimelineData.map((row, index) => (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.8), ease: "easeOut" }}
                            key={row.id || index}
                            className="mb-10 relative group cursor-pointer"
                            onClick={() => { setComparingIndex(index); setActiveModalTab('diff_table'); }}
                          >
                            {/* Timeline dot */}
                            <div className="absolute -left-[33px] top-4">
                              <div className="size-4 rounded-full bg-white dark:bg-slate-900 border-[4px] border-[#621f32] dark:border-[#bc955c] shadow-md z-10 relative" />
                              {index === 0 && (
                                <div className="absolute inset-0 size-4 rounded-full bg-[#621f32] dark:bg-[#bc955c] animate-ping opacity-75" />
                              )}
                            </div>

                            {/* Card */}
                            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 ml-6 hover:shadow-md hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-all">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div>
                                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                    <h4 className="text-sm font-black uppercase text-[#621f32] dark:text-[#bc955c] tracking-wider">{row.motivo || 'Actualización Inicial'}</h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.bg || 'bg-slate-50'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.text || 'text-slate-600'} ${MOV_STATUS_BADGE_STYLES[row.estado_psn]?.border || 'border-slate-200'}`}>
                                      {MOV_STATUS_BADGE_STYLES[row.estado_psn]?.label || row.estado_psn || '-'}
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700/50 inline-block px-2 py-0.5 rounded-md">
                                    Cod. Motivo: {row.cd_motivo || 'N/A'}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Fecha Efectiva</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{row.f_efva || '-'}</span>
                                  </div>
                                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Fecha Captura</span>
                                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{row.fecha_captura || '-'}</span>
                                  </div>
                                </div>
                              </div>

                              {index === 0 && (
                                <div className="mt-4 inline-flex items-center justify-center px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500">
                                  Movimiento más reciente
                                </div>
                              )}

                              {row.changes && row.changes.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    Cambios Detectados:
                                  </h5>
                                  <div className="flex flex-col gap-2">
                                    {row.changes.map((change, cIdx) => (
                                      <div key={cIdx} className="flex items-center flex-wrap gap-2 text-xs bg-slate-50/50 dark:bg-slate-900/20 p-2 rounded-lg border border-slate-100/50 dark:border-slate-800/50">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 mr-1 min-w-[120px]">{change.label}:</span>
                                        <span className="line-through text-slate-400 dark:text-slate-500 italic px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{change.before}</span>
                                        <span className="text-slate-400 mx-1">➜</span>
                                        <span className="font-black text-[#621f32] dark:text-[#bc955c] px-1.5 py-0.5 bg-[#621f32]/10 dark:bg-[#bc955c]/10 rounded shadow-sm">{change.after}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 text-xs flex items-center gap-2">
                                <span className="font-bold text-slate-500 dark:text-slate-400">Movimiento realizado por: </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{row.por || '-'}</span>
                                {row.por && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); copyPor(row.por, index); }}
                                    title="Copiar valor"
                                    className="p-1 rounded-md text-slate-400 hover:text-[#621f32] hover:bg-[#621f32]/10 dark:hover:text-[#bc955c] dark:hover:bg-[#bc955c]/10 transition-colors"
                                  >
                                    {copiedPorIndex === index ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[200px]">
                        <Search className="size-12 mb-4 opacity-50" />
                        <p className="font-bold">No se encontraron registros de historia para esta posición.</p>
                      </div>
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

      {/* Modal de Detalle de Vacancia */}
      <VacanciaDetalleModal
        open={isVacanciaModalOpen}
        onClose={() => setIsVacanciaModalOpen(false)}
        detalle={vacanciaDetalle}
        isLoading={isVacanciaLoading}
      />


      {/* Modal de Detalle de Celda Completa */}
      <CeldaValorModal
        open={isCellModalOpen && !!selectedCell}
        onClose={() => setIsCellModalOpen(false)}
        columnLabel={selectedCell ? columns.filter(c => c.visible)[selectedCell.col]?.label : ""}
        cellRef={selectedCell ? `${getColumnLetter(selectedCell.col)}${selectedCell.row + 1}` : ""}
        value={(() => {
          if (!selectedCell) return null;
          const row = filteredSortedData[selectedCell.row];
          const col = columns.filter(c => c.visible)[selectedCell.col];
          return row?.[col?.key] ?? null;
        })()}
      />

      {/* Historial de ediciones manuales de MOV_POS (CeldaOverride tabla="MOV_POS") */}
      <CeldaHistorialModal
        open={isHistorialModalOpen}
        onClose={() => setIsHistorialModalOpen(false)}
        columns={HISTORIAL_COLUMNS_MOV_POS}
        formatValue={formatHistorialValue}
        fetchHistorial={VacantesService.getMovPosOverrideHistorial}
        subtitle="MOV_POS · Auditoría de ediciones manuales"
        posicionPlaceholder="No. Posición exacta..."
      />

      <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />
      
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
            fieldClickHandlers={{ fecha_vacancia: (r) => openVacanciaModal(r) }}
            canViewPhoto={canViewFotoMovPosiciones}
          />
        );
      })()}

    </div>
    </TooltipProvider>
  );
}



