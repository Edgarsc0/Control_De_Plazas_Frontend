"use client";

import { motion, AnimatePresence } from "motion/react";
import { Filter, X, Search, Check, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import {
  CONDITION_OPTIONS,
  CONDITION_SHORTHANDS,
  getConditionLabel,
  parseDateParts,
  defaultGetCellValue,
} from "@/utils/columnFilters";

/**
 * Dropdown de filtro por columna (estilo Excel) reutilizable por los tabs de
 * plantilla. Markup idéntico al original; el estado lo aporta `useColumnFilters`
 * (prop `filters`) y la lógica pesada (valores calculados, jerarquía de fecha,
 * selección por nodo de fecha) la inyecta el tab por props.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el dropdown está visible.
 * @param {string} props.columnKey - Clave de la columna activa.
 * @param {string} [props.columnLabel] - Etiqueta a mostrar en el título.
 * @param {boolean} props.isDate - Si la columna es de fecha (muestra árbol en lugar de lista).
 * @param {Object[]} props.data - Filas (para calcular hojas del árbol de fecha).
 * @param {(row: Object, key: string) => string} [props.getCellValue] - Accesor de valor de celda.
 * @param {Object} props.filters - Instancia de `useColumnFilters` (estado + setters).
 * @param {{allVals: string[], isAllSelected: boolean, sliced: Array<{value: string, count: number}>, filteredCount: number}} props.dropdownValues - Valores ya calculados para la lista.
 * @param {Object} [props.dateHierarchy] - Jerarquía año→mes→día de la columna (si es fecha).
 * @param {(type: ('year'|'month'|'day'), value: string, parentPath?: string) => void} props.onDateSelection - Selección por nodo de fecha.
 * @param {(path: string) => void} props.onToggleDateNode - Expandir/colapsar nodo de fecha.
 * @param {() => void} props.onApply - Aplica el filtro de la columna.
 * @param {() => void} props.onClear - Limpia el filtro de la columna.
 * @param {() => void} props.onClose - Cierra el dropdown.
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
}) {
  const {
    filterDropdownTab, setFilterDropdownTab,
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    tempSelectedValues, setTempSelectedValues,
    expandedDateNodes,
  } = filters;

  // Hojas de fecha: en modo server se calculan desde `dateValues` (valores únicos
  // del backend); en cliente, desde las filas (`data`). El predicado recibe las
  // partes ya parseadas {year, month, day}.
  const dateLeaves = (partsPredicate) => {
    if (dateValues) {
      return [...new Set(dateValues.filter((v) => { const p = parseDateParts(v); return p && partsPredicate(p); }).map((v) => String(v).trim()))];
    }
    return [...new Set(data.filter((row) => { const p = parseDateParts(row[columnKey]); return p && partsPredicate(p); }).map((row) => getCellValue(row, columnKey).trim()))];
  };

  return (
    <AnimatePresence>
      {open && (
        <div key="filter-dropdown" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-[450px] max-w-[95vw] max-h-[500px] flex flex-col overflow-hidden z-[70]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Filter className="size-3 text-[#621f32] dark:text-[#bc955c]" />
                  Filtrar {columnLabel}
                </h4>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="size-4" /></button>
              </div>
              {!isDate && (
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg mb-3">
                  <button onClick={(e) => { e.stopPropagation(); setFilterDropdownTab('todos'); }} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${filterDropdownTab === 'todos' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#621f32] dark:text-[#bc955c]' : 'text-slate-500 hover:text-slate-700'}`}>Todos los datos</button>
                  <button onClick={(e) => { e.stopPropagation(); setFilterDropdownTab('actuales'); }} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${filterDropdownTab === 'actuales' ? 'bg-white dark:bg-slate-700 shadow-sm text-[#621f32] dark:text-[#bc955c]' : 'text-slate-500 hover:text-slate-700'}`}>Vista actual</button>
                </div>
              )}
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
                <Search className="size-3 text-slate-400" />
                <input type="text" value={filterSearchText} onChange={(e) => setFilterSearchText(e.target.value)} placeholder="Buscar valor..." className="bg-transparent text-[11px] w-full outline-none text-slate-700 dark:text-slate-200 font-bold" />
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
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white dark:bg-slate-900">
              {loadingValues ? (
                <div className="flex flex-col gap-2 p-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <div className="size-3 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="size-4 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${35 + (i % 3) * 15}%` }} />
                    </div>
                  ))}
                </div>
              ) : isDate ? (
                <div className="flex flex-col gap-1 p-2">
                  {allDateLeafValues && (
                    <div className="flex gap-2 px-1 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800">
                      <button onClick={() => setTempSelectedValues(allDateLeafValues)} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Marcar Todo</button>
                      <button onClick={() => setTempSelectedValues([])} className="flex-1 text-[10px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Desmarcar Todo</button>
                    </div>
                  )}
                  {Object.keys(dateHierarchy || {}).sort((a, b) => b - a).map(year => {
                    const yearData = dateHierarchy[year];
                    const isYearExpanded = expandedDateNodes[year];
                    const yearLeafValues = dateLeaves(p => p.year === year);
                    const isYearSelected = yearLeafValues.length > 0 && yearLeafValues.every(v => tempSelectedValues.includes(v));
                    const isYearPartial = !isYearSelected && yearLeafValues.some(v => tempSelectedValues.includes(v));

                    return (
                      <div key={year} className="flex flex-col">
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group">
                          <button onClick={() => onToggleDateNode(year)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                            {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRightIcon className="size-3" />}
                          </button>
                          <div onClick={() => onDateSelection('year', year)} className="flex items-center gap-2 cursor-pointer flex-1">
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
                              const monthLeafValues = dateLeaves(p => p.year === year && p.month === month);
                              const isMonthSelected = monthLeafValues.length > 0 && monthLeafValues.every(v => tempSelectedValues.includes(v));
                              const isMonthPartial = !isMonthSelected && monthLeafValues.some(v => tempSelectedValues.includes(v));

                              return (
                                <div key={month} className="flex flex-col">
                                  <div className="flex items-center gap-2 px-2 py-1 group">
                                    <button onClick={() => onToggleDateNode(monthPath)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-400">
                                      {isMonthExpanded ? <ChevronDown className="size-2.5" /> : <ChevronRightIcon className="size-2.5" />}
                                    </button>
                                    <div onClick={() => onDateSelection('month', month, year)} className="flex items-center gap-2 cursor-pointer flex-1">
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
                                        const dayUniqueValues = dateLeaves(p => p.year === year && p.month === month && p.day === day);
                                        const isDaySelected = dayUniqueValues.length > 0 && dayUniqueValues.every(v => tempSelectedValues.includes(v));

                                        return (
                                          <div key={day} onClick={() => onDateSelection('day', day, monthPath)} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer group">
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
                  {(() => {
                    const { allVals, isAllSelected, sliced, filteredCount } = dropdownValues;
                    const tempSelectedSet = new Set(tempSelectedValues);

                    return (
                      <>
                        <button onClick={() => {
                          setTempSelectedValues(isAllSelected ? [] : allVals);
                        }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group">
                          <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${isAllSelected ? "bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]" : "border-slate-300 dark:border-slate-600"}`}>
                            {isAllSelected && <Check className="size-2.5 text-white dark:text-[#3e131f]" strokeWidth={4} />}
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]">Seleccionar Todo</span>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
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
                        {filteredCount > 100 && (
                          <div className="text-center py-3 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                            Mostrando 100 de {filteredCount} resultados. Usa el buscador.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-2">
              <button onClick={onClear} className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all">Limpiar</button>
              <button onClick={onApply} className="flex-[2] px-3 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[10px] font-black uppercase rounded-xl shadow-lg shadow-[#621f32]/20 dark:shadow-none hover:opacity-90 active:scale-95 transition-all">Aplicar Filtro</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
