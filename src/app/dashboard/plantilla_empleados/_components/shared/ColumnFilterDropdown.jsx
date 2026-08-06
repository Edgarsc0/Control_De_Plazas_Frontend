"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Filter, X, Search, Check, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import {
  CONDITION_OPTIONS,
  CONDITION_SHORTHANDS,
  getConditionLabel,
  parseDateParts,
  defaultGetCellValue,
  normalizeForSearch,
  HIGH_CARDINALITY_THRESHOLD,
} from "@/utils/columnFilters";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const ROW_HEIGHT = 36;
const OVERSCAN = 6;
// Columnas tipo ID (Posición, No. Posición) superan los miles de valores
// únicos: renderizar el checkbox-list ahí no sirve como filtro categórico,
// nadie escanea miles de opciones. Se oculta la lista hasta que el usuario
// busque, dejando el buscador con condición como único camino práctico.

/** Envuelve en `<mark>` la subcadena de `text` que matchea `needle` (sin distinguir acentos/mayúsculas). */
function highlightMatch(text, needle) {
  const str = text ?? "";
  if (!needle) return str;
  const idx = normalizeForSearch(str).indexOf(normalizeForSearch(needle));
  if (idx === -1) return str;
  return (
    <>
      {str.slice(0, idx)}
      <mark className="bg-[#bc955c]/40 text-inherit rounded-sm px-0.5">{str.slice(idx, idx + needle.length)}</mark>
      {str.slice(idx + needle.length)}
    </>
  );
}

/**
 * Dropdown de filtro por columna (estilo Excel) reutilizable por los tabs de
 * plantilla. El estado lo aporta `useColumnFilters` (prop `filters`) y la
 * lógica pesada (valores calculados, jerarquía de fecha, selección por nodo de
 * fecha) la inyecta el tab por props. La lista de valores se renderiza
 * virtualizada (sin límite artificial de 100 resultados) para poder scrollear
 * columnas con miles de valores únicos sin depender del buscador.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el dropdown está visible.
 * @param {string} props.columnKey - Clave de la columna activa.
 * @param {string} [props.columnLabel] - Etiqueta a mostrar en el título.
 * @param {boolean} props.isDate - Si la columna es de fecha (muestra árbol en lugar de lista).
 * @param {Object[]} props.data - Filas (para calcular hojas del árbol de fecha).
 * @param {(row: Object, key: string) => string} [props.getCellValue] - Accesor de valor de celda.
 * @param {Object} props.filters - Instancia de `useColumnFilters` (estado + setters).
 * @param {{allVals: string[], isAllSelected: boolean, isPartialSelected: boolean, visibleVals: string[], isVisibleAllSelected: boolean, isVisiblePartialSelected: boolean, sliced: Array<{value: string, count: number, reachable: boolean}>, filteredCount: number}} props.dropdownValues - Valores ya calculados para la lista (`reachable` = alcanzable dado el resto de filtros; ver `finalizeFilterDropdownValues`).
 * @param {Object} [props.dateHierarchy] - Jerarquía año→mes→día de la columna (si es fecha).
 * @param {(type: ('year'|'month'|'day'), value: string, parentPath?: string) => void} props.onDateSelection - Selección por nodo de fecha.
 * @param {(path: string) => void} props.onToggleDateNode - Expandir/colapsar nodo de fecha.
 * @param {() => void} props.onApply - Aplica el filtro de la columna.
 * @param {() => void} props.onClear - Limpia el filtro de la columna.
 * @param {() => void} props.onClose - Cierra el dropdown.
 * @param {?string[]} [props.reachableValues=null] - Sólo para columnas de fecha: valores hoja alcanzables considerando el resto de filtros (todas las columnas EXCEPTO la propia). `null` = sin restricción. En columnas no-fecha la alcanzabilidad ya viene por valor en `dropdownValues.sliced[].reachable`.
 * @param {string} [props.zIndexClass] - Clase de z-index del contenedor (stacking context de fondo+panel). Override para usarlo dentro de modales con z-index propio más alto que el z-[60] por defecto.
 * @returns {JSX.Element}
 */
export default function ColumnFilterDropdown({
  open,
  columnKey,
  columnLabel,
  isDate,
  data = [],
  getCellValue = defaultGetCellValue,
  filters,
  dropdownValues,
  dateHierarchy,
  onDateSelection,
  onToggleDateNode,
  onApply,
  onClear,
  onClose,
  loadingValues = false,
  dateValues = null,
  allDateLeafValues = null,
  reachableValues = null,
  dimBackdrop = true,
  renderValueLabel = null,
  zIndexClass = "z-[60]",
}) {
  const {
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    tempSelectedValues, setTempSelectedValues,
    expandedDateNodes,
  } = filters;

  const listScrollRef = useRef(null);
  const searchInputRef = useRef(null);
  const panelRef = useRef(null);
  const groupSnapshotRef = useRef(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(280);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  useBodyScrollLock(open);

  // Reordena localmente (sin tocar dropdownValues) en 3 grupos: seleccionados
  // arriba, disponibles (reachable, sin seleccionar) en medio, desactivados
  // (no reachable) siempre abajo. El orden de grupo se congela en
  // `groupSnapshotRef` al abrir el modal (ver efecto abajo) y no se
  // recalcula en vivo: si se recalculara en cada click, al desmarcar un
  // valor éste saltaría inmediatamente a media lista, dando la sensación de
  // que "se pierde". El usuario ve el nuevo orden recién al reabrir el
  // dropdown. Valores sin snapshot (aún no capturados) caen a su grupo en
  // vivo como fallback.
  const rawSliced = dropdownValues?.sliced || [];
  const tempSelectedSet = new Set(tempSelectedValues);
  const groupOf = (item) => (item.reachable && tempSelectedSet.has(item.value) ? 0 : item.reachable ? 1 : 2);
  const sliced = [...rawSliced].sort((a, b) => {
    const aGroup = groupSnapshotRef.current.has(a.value) ? groupSnapshotRef.current.get(a.value) : groupOf(a);
    const bGroup = groupSnapshotRef.current.has(b.value) ? groupSnapshotRef.current.get(b.value) : groupOf(b);
    return aGroup - bGroup;
  });
  const isHighCardinality = !isDate && (dropdownValues?.allVals?.length || 0) > HIGH_CARDINALITY_THRESHOLD;
  const listHidden = isHighCardinality && !filterSearchText;

  // Cambió la columna, el resultado de la búsqueda, o se acaba de abrir el
  // modal: el índice resaltado y el scroll ya no corresponden a la lista
  // actual, y toca congelar el orden de grupos (seleccionado/disponible/
  // desactivado) de nuevo — ver `groupSnapshotRef` arriba.
  useEffect(() => {
    setHighlightIndex(-1);
    setScrollTop(0);
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
    const snapshot = new Map();
    (dropdownValues?.sliced || []).forEach((item) => {
      snapshot.set(item.value, item.reachable && tempSelectedSet.has(item.value) ? 0 : item.reachable ? 1 : 2);
    });
    groupSnapshotRef.current = snapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey, isDate, dropdownValues?.filteredCount, open]);

  // Cambió la columna: la búsqueda/condición de la columna anterior no debe
  // heredarse a la nueva (filterSearchText/filterSearchCondition viven una sola
  // vez por tabla en useColumnFilters, no por columna).
  useEffect(() => {
    setFilterSearchText("");
    setFilterSearchCondition("contains");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey]);

  useEffect(() => {
    if (open && listScrollRef.current) setViewportHeight(listScrollRef.current.clientHeight || 280);
  }, [open, isDate]);

  const ensureRowVisible = (idx) => {
    const el = listScrollRef.current;
    if (!el) return;
    const itemTop = idx * ROW_HEIGHT;
    const itemBottom = itemTop + ROW_HEIGHT;
    if (itemTop < el.scrollTop) { el.scrollTop = itemTop; setScrollTop(itemTop); }
    else if (itemBottom > el.scrollTop + el.clientHeight) { const next = itemBottom - el.clientHeight; el.scrollTop = next; setScrollTop(next); }
  };

  const handlePanelKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (isFilterSearchConditionOpen) setIsFilterSearchConditionOpen(false);
      else onClose();
      return;
    }
    if (isDate) {
      if (e.key === "Enter") { e.preventDefault(); onApply(); }
      return;
    }
    if (listHidden) {
      if (e.key === "Enter") { e.preventDefault(); onApply(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // Mueve el foco del buscador al panel: si se queda en el input, la
      // siguiente pulsación de Espacio escribe un espacio en vez de
      // marcar/desmarcar la fila resaltada. Enfocar el panel (en vez de solo
      // quitarle el foco al input) mantiene el foco dentro del modal para que
      // seguir navegando con flechas/Espacio funcione.
      panelRef.current?.focus();
      setHighlightIndex((i) => { const next = Math.min(i + 1, sliced.length - 1); ensureRowVisible(next); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      panelRef.current?.focus();
      setHighlightIndex((i) => { const next = Math.max(i - 1, 0); ensureRowVisible(next); return next; });
    } else if (e.key === " " && highlightIndex >= 0 && document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      const item = sliced[highlightIndex];
      if (item?.reachable) setTempSelectedValues((prev) => (prev.includes(item.value) ? prev.filter((v) => v !== item.value) : [...prev, item.value]));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onApply();
    }
  };

  // Hojas de fecha: en modo server se calculan desde `dateValues` (valores únicos
  // del backend); en cliente, desde las filas (`data`). El predicado recibe las
  // partes ya parseadas {year, month, day}.
  const dateLeaves = (partsPredicate) => {
    if (dateValues) {
      return [...new Set(dateValues.filter((v) => { const p = parseDateParts(v); return p && partsPredicate(p); }).map((v) => String(v).trim()))];
    }
    return [...new Set(data.filter((row) => { const p = parseDateParts(row[columnKey]); return p && partsPredicate(p); }).map((row) => getCellValue(row, columnKey).trim()))];
  };

  // Fallback calculado localmente: no depende de que el tab padre pase
  // `allDateLeafValues` (varios tabs no lo hacían y el botón global quedaba oculto).
  const resolvedAllDateLeafValues = isDate ? (allDateLeafValues || dateLeaves(() => true)) : [];

  // Alcanzabilidad de nodos de fecha (año/mes/día): `null` = sin restricción
  // (todo alcanzable). Un nodo se deshabilita únicamente cuando NINGUNA de sus
  // hojas es alcanzable dado el resto de filtros (no el propio de esta columna).
  const reachableDateSet = reachableValues ? new Set(reachableValues) : null;
  const filterReachable = (values) => (reachableDateSet ? values.filter((v) => reachableDateSet.has(v)) : values);

  const markValues = (values) => setTempSelectedValues((prev) => [...new Set([...prev, ...filterReachable(values)])]);
  const unmarkValues = (values) => setTempSelectedValues((prev) => prev.filter((v) => !values.includes(v)));

  // Filtra el árbol año→mes→día por el texto del buscador. BUG QA 2026-07-23:
  // el buscador se veía activo en columnas de fecha pero no tenía ningún
  // efecto — el árbol se armaba sólo desde `dateHierarchy`, ignorando
  // `filterSearchText`. Un año/mes sobrevive si él mismo matchea (año, nombre
  // de mes) o si CUALQUIERA de sus días matchea (por día suelto o por fecha
  // completa dd/mm/aaaa), igual que como se ve la fecha en el resto de la UI.
  const dateSearchText = isDate ? normalizeForSearch(filterSearchText.trim()) : "";
  const filteredDateHierarchy = useMemo(() => {
    if (!isDate || !dateSearchText) return dateHierarchy || {};
    const result = {};
    Object.entries(dateHierarchy || {}).forEach(([year, yearData]) => {
      const yearSelfMatch = normalizeForSearch(year).includes(dateSearchText);
      const months = {};
      Object.entries(yearData.months || {}).forEach(([month, monthData]) => {
        const monthSelfMatch = yearSelfMatch
          || normalizeForSearch(monthData.name).includes(dateSearchText)
          || normalizeForSearch(`${month}/${year}`).includes(dateSearchText);
        const days = {};
        Object.entries(monthData.days || {}).forEach(([day, count]) => {
          const dayMatch = monthSelfMatch
            || day.includes(dateSearchText)
            || normalizeForSearch(`${day}/${month}/${year}`).includes(dateSearchText)
            || normalizeForSearch(`${day}-${month}-${year}`).includes(dateSearchText);
          if (dayMatch) days[day] = count;
        });
        if (monthSelfMatch || Object.keys(days).length > 0) {
          months[month] = monthSelfMatch ? monthData : { ...monthData, days };
        }
      });
      if (yearSelfMatch || Object.keys(months).length > 0) {
        result[year] = yearSelfMatch ? yearData : { ...yearData, months };
      }
    });
    return result;
  }, [isDate, dateHierarchy, dateSearchText]);
  // Con búsqueda activa, expandir automáticamente año/mes filtrados (si no,
  // el usuario vería la lista "vacía" hasta expandir manualmente cada nodo).
  const isDateNodeExpanded = (path) => (dateSearchText ? true : expandedDateNodes[path]);

  // Hojas visibles tras el buscador del árbol (subconjunto de
  // resolvedAllDateLeafValues) — "Marcar/Desmarcar Todo" debe operar solo
  // sobre esto cuando hay búsqueda activa, igual que "Seleccionar Todo" en
  // columnas no-fecha (ver dropdownValues.visibleVals más abajo).
  const visibleDateLeafValues = useMemo(() => {
    if (!isDate) return [];
    if (!dateSearchText) return resolvedAllDateLeafValues;
    return dateLeaves((p) => {
      const yearData = filteredDateHierarchy[p.year];
      const monthData = yearData?.months?.[p.month];
      return !!monthData && Object.prototype.hasOwnProperty.call(monthData.days, p.day);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDate, dateSearchText, filteredDateHierarchy, resolvedAllDateLeafValues]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="filter-dropdown" className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className={`fixed inset-0 ${dimBackdrop ? "bg-black/40 backdrop-blur-sm" : ""}`} />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onKeyDown={handlePanelKeyDown}
            className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-[450px] max-w-[95vw] max-h-[500px] flex flex-col overflow-hidden z-[70] outline-none"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Filter className="size-3 text-[#621f32] dark:text-[#bc955c]" />
                  Filtrar {columnLabel}
                </h4>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="size-4" /></button>
              </div>
              <div className="relative flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm gap-2">
                {!isDate && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsFilterSearchConditionOpen(o => !o); }}
                    title={`Condición: ${getConditionLabel(filterSearchCondition)}`}
                    className="shrink-0 size-5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 text-[9px] font-black cursor-pointer select-none transition-colors"
                  >
                    {CONDITION_SHORTHANDS[filterSearchCondition] || "*"}
                  </button>
                )}
                <Search className="size-3 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  value={filterSearchText}
                  onChange={(e) => setFilterSearchText(e.target.value)}
                  placeholder="Buscar valor..."
                  className="bg-transparent text-[11px] w-full outline-none text-slate-700 dark:text-slate-200 font-bold"
                />
                {filterSearchText && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFilterSearchText(""); }} title="Limpiar búsqueda" className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <X className="size-3" />
                  </button>
                )}
                {isFilterSearchConditionOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => { e.stopPropagation(); setIsFilterSearchConditionOpen(false); }} />
                    <div className="absolute top-full left-0 mt-1 z-50 w-40 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-left text-slate-200">
                      {CONDITION_OPTIONS.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFilterSearchCondition(item.key); setIsFilterSearchConditionOpen(false); }}
                          className={`px-2 py-1 text-[9px] font-bold rounded-lg text-left transition-colors cursor-pointer w-full flex items-center justify-between ${filterSearchCondition === item.key ? "bg-[#bc955c] text-slate-950" : "hover:bg-white/10"}`}
                        >
                          <span>{item.label}</span>
                          {filterSearchCondition === item.key && <Check className="size-2.5" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {!isDate && dropdownValues && (
                <div className="mt-2 text-[9px] font-black uppercase text-slate-500 dark:text-slate-500 px-0.5">
                  {filterSearchText
                    ? `${dropdownValues.sliced.filter((v) => v.reachable && tempSelectedValues.includes(v.value)).length} de ${dropdownValues.visibleVals.length} visibles seleccionados`
                    : `${dropdownValues.sliced.filter((v) => v.reachable && tempSelectedValues.includes(v.value)).length} de ${dropdownValues.allVals.length} seleccionados`}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900">
              {loadingValues ? (
                <div className="flex flex-col gap-2 p-3 overflow-y-auto">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <div className="size-3 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="size-4 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${35 + (i % 3) * 15}%` }} />
                    </div>
                  ))}
                </div>
              ) : isDate ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  <div className="flex flex-col gap-1">
                    {resolvedAllDateLeafValues.length > 0 && (
                      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 flex gap-2 px-1 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
                        <button onClick={() => markValues(visibleDateLeafValues)} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Marcar Todo</button>
                        <button onClick={() => unmarkValues(visibleDateLeafValues)} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Desmarcar Todo</button>
                      </div>
                    )}
                    {Object.keys(filteredDateHierarchy).length === 0 && (
                      <div className="text-center py-8 text-[10px] font-black uppercase text-slate-400">Sin resultados</div>
                    )}
                    {Object.keys(filteredDateHierarchy).sort((a, b) => b - a).map(year => {
                      const yearData = filteredDateHierarchy[year];
                      const isYearExpanded = isDateNodeExpanded(year);
                      const yearLeafValues = dateLeaves(p => p.year === year);
                      const yearReachableLeafValues = filterReachable(yearLeafValues);
                      const isYearDisabled = yearReachableLeafValues.length === 0;
                      const isYearSelected = yearReachableLeafValues.length > 0 && yearReachableLeafValues.every(v => tempSelectedValues.includes(v));
                      const isYearPartial = !isYearSelected && yearReachableLeafValues.some(v => tempSelectedValues.includes(v));

                      return (
                        <div key={year} className="flex flex-col">
                          <div className={`flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group ${isYearDisabled ? "opacity-40" : ""}`}>
                            <button onClick={() => onToggleDateNode(year)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                              {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
                            </button>
                            <div
                              onClick={isYearDisabled ? undefined : () => onDateSelection('year', year)}
                              title={isYearDisabled ? "No disponible con los filtros actuales" : undefined}
                              className={`flex items-center gap-2 flex-1 ${isYearDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${isYearSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                {isYearSelected && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                {isYearPartial && <div className="size-1.5 bg-[#621f32] dark:bg-[#bc955c] rounded-sm" />}
                              </div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">{year}</span>
                              <span className="text-[10px] font-black text-slate-400">({yearData.count})</span>
                            </div>
                            {!isYearDisabled && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); markValues(yearLeafValues); }} title="Marcar todo el año" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Todo</button>
                                <button onClick={(e) => { e.stopPropagation(); unmarkValues(yearLeafValues); }} title="Desmarcar todo el año" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Ninguno</button>
                              </div>
                            )}
                          </div>

                          {isYearExpanded && (
                            <div className="ml-6 flex flex-col border-l border-slate-100 dark:border-slate-800 pl-2 mt-1 mb-2 gap-1">
                              {Object.keys(yearData.months).sort().map(month => {
                                const monthData = yearData.months[month];
                                const monthPath = `${year}-${month}`;
                                const isMonthExpanded = isDateNodeExpanded(monthPath);
                                const monthLeafValues = dateLeaves(p => p.year === year && p.month === month);
                                const monthReachableLeafValues = filterReachable(monthLeafValues);
                                const isMonthDisabled = monthReachableLeafValues.length === 0;
                                const isMonthSelected = monthReachableLeafValues.length > 0 && monthReachableLeafValues.every(v => tempSelectedValues.includes(v));
                                const isMonthPartial = !isMonthSelected && monthReachableLeafValues.some(v => tempSelectedValues.includes(v));

                                return (
                                  <div key={month} className="flex flex-col">
                                    <div className={`flex items-center gap-2 px-2 py-1 group ${isMonthDisabled ? "opacity-40" : ""}`}>
                                      <button onClick={() => onToggleDateNode(monthPath)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400">
                                        {isMonthExpanded ? <ChevronDown className="size-2.5" /> : <ChevronRightIcon className="size-2.5" />}
                                      </button>
                                      <div
                                        onClick={isMonthDisabled ? undefined : () => onDateSelection('month', month, year)}
                                        title={isMonthDisabled ? "No disponible con los filtros actuales" : undefined}
                                        className={`flex items-center gap-2 flex-1 ${isMonthDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                                      >
                                        <div className={`size-3.5 rounded border flex items-center justify-center transition-all ${isMonthSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                          {isMonthSelected && <Check className="size-2 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                          {isMonthPartial && <div className="size-1 bg-[#621f32] dark:bg-[#bc955c] rounded-xs" />}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{monthData.name}</span>
                                        <span className="text-[9px] font-black text-slate-500">({monthData.count})</span>
                                      </div>
                                      {!isMonthDisabled && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button onClick={(e) => { e.stopPropagation(); markValues(monthLeafValues); }} title="Marcar todo el mes" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Todo</button>
                                          <button onClick={(e) => { e.stopPropagation(); unmarkValues(monthLeafValues); }} title="Desmarcar todo el mes" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Ninguno</button>
                                        </div>
                                      )}
                                    </div>

                                    {isMonthExpanded && (
                                      <div className="ml-6 grid grid-cols-2 gap-x-2 border-l border-slate-50 dark:border-slate-800/50 pl-2 py-1 mt-1">
                                        {Object.keys(monthData.days).sort().map(day => {
                                          const count = monthData.days[day];
                                          const dayUniqueValues = dateLeaves(p => p.year === year && p.month === month && p.day === day);
                                          const dayReachableValues = filterReachable(dayUniqueValues);
                                          const isDayDisabled = dayReachableValues.length === 0;
                                          const isDaySelected = dayReachableValues.length > 0 && dayReachableValues.every(v => tempSelectedValues.includes(v));

                                          return (
                                            <div
                                              key={day}
                                              onClick={isDayDisabled ? undefined : () => onDateSelection('day', day, monthPath)}
                                              title={isDayDisabled ? "No disponible con los filtros actuales" : undefined}
                                              className={`flex items-center gap-2 px-2 py-1 rounded group ${isDayDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"}`}
                                            >
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
                </div>
              ) : (
                <>
                  <div className="shrink-0 p-2 pb-1 border-b border-slate-50 dark:border-slate-800/50">
                    <button
                      onClick={() => {
                        const { visibleVals, isVisibleAllSelected } = dropdownValues;
                        const reachableVisibleVals = filterReachable(visibleVals);
                        setTempSelectedValues((prev) => (isVisibleAllSelected ? prev.filter((v) => !visibleVals.includes(v)) : [...new Set([...prev, ...reachableVisibleVals])]));
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group w-full"
                    >
                      <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${dropdownValues.isVisibleAllSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                        {dropdownValues.isVisibleAllSelected && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                        {dropdownValues.isVisiblePartialSelected && <div className="size-1.5 bg-[#621f32] dark:bg-[#bc955c] rounded-sm" />}
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]">
                        Seleccionar Todo
                      </span>
                    </button>
                  </div>
                  <div ref={listScrollRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
                    {listHidden ? (
                      <div className="text-center py-8 px-4 text-[10px] font-black uppercase text-slate-400">
                        Escribe para buscar entre {dropdownValues.allVals.length.toLocaleString("es-MX")} valores
                      </div>
                    ) : sliced.length === 0 ? (
                      <div className="text-center py-8 text-[10px] font-black uppercase text-slate-400">Sin resultados</div>
                    ) : (
                      (() => {
                        const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
                        const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
                        const endIdx = Math.min(sliced.length, startIdx + visibleCount);
                        const visibleSlice = sliced.slice(startIdx, endIdx);
                        return (
                          <div style={{ height: sliced.length * ROW_HEIGHT, position: "relative" }}>
                            {visibleSlice.map((item, i) => {
                              const idx = startIdx + i;
                              const { value, count, reachable } = item;
                              const isChecked = reachable && tempSelectedSet.has(value);
                              const isHighlighted = idx === highlightIndex;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={!reachable}
                                  title={reachable ? undefined : "No disponible con los filtros actuales"}
                                  onClick={reachable ? () => setTempSelectedValues((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value])) : undefined}
                                  onMouseEnter={() => setHighlightIndex(idx)}
                                  style={{ position: "absolute", top: idx * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                                  className={`flex items-center gap-3 px-3 rounded-xl transition-colors text-left ${!reachable ? "opacity-40 cursor-not-allowed" : isHighlighted ? "bg-slate-100 dark:bg-slate-800/70" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                                >
                                  <div className={`size-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${isChecked ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                                    {isChecked && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                                  </div>
                                  <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                                      {value ? (renderValueLabel ? renderValueLabel(value, filterSearchText) : highlightMatch(value, filterSearchText)) : "(Vacío)"}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-lg shrink-0">{count}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-2">
              <button onClick={onClear} className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all">Limpiar</button>
              <button onClick={onApply} className="flex-[2] px-3 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[10px] font-black uppercase rounded-xl shadow-lg shadow-[#621f32]/20 dark:shadow-none hover:opacity-90 active:scale-95 transition-all">Aplicar Filtro</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
