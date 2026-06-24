"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Check, SlidersHorizontal, X, Plus, Trash2 } from "lucide-react";
import { normalizeForSearch, matchesTextCondition, parseFlexibleDate, CONDITION_OPTIONS } from "@/utils/columnFilters";
import { ADV_DATE_CONDITIONS, ADV_COMPARE_TYPE_OPTIONS, ADV_LOGIC_OPTIONS } from "@/utils/advancedFilters";

/** Select con panel flotante (portal), usado por las condiciones del modal de filtros avanzados. */
function AdvFilterSelect({ value, options, onChange, placeholder = "Seleccionar...", searchable = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelRect, setPanelRect] = useState(null);
  const triggerRef = useRef(null);

  const selected = options.find(o => o.key === value);
  const filteredOptions = searchable && search
    ? options.filter(o => normalizeForSearch(o.label).includes(normalizeForSearch(search)))
    : options;

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPanelRect({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220) });
    setIsOpen(true);
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); isOpen ? setIsOpen(false) : openPanel(); }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 transition-colors cursor-pointer"
      >
        <span className={`truncate ${!selected ? "text-slate-400 font-semibold" : ""}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`size-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && panelRect && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); setSearch(""); }} />
          <div
            style={{ position: "fixed", top: panelRect.top, left: panelRect.left, width: panelRect.width }}
            className="z-[210] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            {searchable && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
                  <Search className="size-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Buscar columna..."
                    className="bg-transparent text-[11px] w-full outline-none text-slate-700 dark:text-slate-200 font-bold"
                  />
                </div>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
              {filteredOptions.length === 0 && (
                <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase">Sin resultados</div>
              )}
              {filteredOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(opt.key); setIsOpen(false); setSearch(""); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-bold transition-colors cursor-pointer ${value === opt.key ? "bg-[#621f32]/10 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c]" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.key && <Check className="size-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function toDateInputValue(val) {
  if (!val || String(val).trim() === "") return "";
  const d = parseFlexibleDate(val);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Input de valor con autocompletado de sugerencias (o `<input type="date">` si
 * la columna es de fecha). Las sugerencias se obtienen vía `fetchSuggestions`
 * (inyectado por el caller: Movimientos pega al backend, los tabs client-side
 * calculan distinct values del arreglo en memoria) y se cachean por columna en
 * un ref local a esta instancia del modal.
 */
function AdvValueAutocomplete({ column, value, onChange, isDate, fetchSuggestions }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [panelRect, setPanelRect] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const allValuesRef = useRef([]);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    allValuesRef.current = [];
    setSuggestions([]);
    if (!column || !fetchSuggestions) return;

    const cached = cacheRef.current.get(column);
    if (cached) {
      allValuesRef.current = cached;
      return;
    }

    setLoading(true);
    Promise.resolve(fetchSuggestions(column))
      .then(list => {
        const safeList = Array.isArray(list) ? list : [];
        cacheRef.current.set(column, safeList);
        allValuesRef.current = safeList;
      })
      .catch(err => console.error("Error loading value suggestions:", err))
      .finally(() => setLoading(false));
  }, [column, fetchSuggestions]);

  const refreshSuggestions = (text) => {
    const list = allValuesRef.current;
    const next = text ? list.filter(v => matchesTextCondition(v.value, "contains", text, { normalize: true })) : list;
    setSuggestions(next.slice(0, 8));
  };

  const openPanel = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPanelRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    refreshSuggestions(value);
    setIsOpen(true);
  };

  if (isDate) {
    return (
      <input
        type="date"
        value={toDateInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={!column}
        className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-[#621f32]/40 dark:focus:border-[#bc955c]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); refreshSuggestions(e.target.value); setIsOpen(true); }}
        onFocus={openPanel}
        onKeyDown={(e) => {
          if (e.key === "Tab" && isOpen && suggestions.length > 0) {
            e.preventDefault();
            onChange(suggestions[0].value);
            setIsOpen(false);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        disabled={!column}
        placeholder={column ? "Escribe el valor..." : "Selecciona una columna primero..."}
        className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-[#621f32]/40 dark:focus:border-[#bc955c]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {isOpen && panelRect && column && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setIsOpen(false)} />
          <div
            style={{ position: "fixed", top: panelRect.top, left: panelRect.left, width: panelRect.width }}
            className="z-[210] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar p-1"
          >
            {loading && <div className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Cargando...</div>}
            {!loading && suggestions.length === 0 && <div className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Sin sugerencias</div>}
            {!loading && suggestions.map(s => (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(s.value); setIsOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <span className="truncate">{s.value || "(Vacío)"}</span>
                <span className="text-[9px] text-slate-400 shrink-0">{s.count}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/**
 * Modal de "Filtros avanzados" compartido por los tabs de plantilla. Solo UI +
 * orquestación del formulario; el estado (`conditions`) y la aplicación viven
 * en `useAdvancedFilters`, la evaluación pura en `@/utils/advancedFilters`.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {boolean} props.mounted - Gate de `createPortal` (evita mismatch de hidratación SSR).
 * @param {Array<{key:string,label:string}>} props.columns - Columnas disponibles (visibles o no).
 * @param {Object[]} props.conditions - `advancedConditions` del hook.
 * @param {() => void} props.onAddCondition
 * @param {(id:any) => void} props.onRemoveCondition
 * @param {(id:any, patch:Object) => void} props.onUpdateCondition
 * @param {() => void} props.onApply
 * @param {(key:string) => boolean} props.isDateColumn
 * @param {(column:string) => (Array<{value,count}>|Promise<Array<{value,count}>>)} [props.fetchSuggestions] - Sugerencias de valor para el autocompletado; omitir desactiva el autocompletado.
 */
export default function AdvancedFiltersModal({
  open, onClose, mounted = true,
  columns, conditions,
  onAddCondition, onRemoveCondition, onUpdateCondition, onApply,
  isDateColumn, fetchSuggestions,
}) {
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-3xl w-full flex flex-col z-[100] overflow-hidden max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-lg">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Filtros avanzados</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Combina condiciones sobre cualquier columna</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X className="size-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar flex flex-col gap-2.5">
              {conditions.map((cond, idx) => {
                const colOptions = columns.map(c => ({ key: c.key, label: c.label }));
                const isDateCol = cond.column && isDateColumn(cond.column);
                const conditionOptions = isDateCol ? ADV_DATE_CONDITIONS : CONDITION_OPTIONS;

                return (
                  <div key={cond.id} className="flex flex-col gap-2.5">
                    {idx > 0 && (
                      <div className="flex items-center gap-2 -my-0.5">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                        <div className="w-24">
                          <AdvFilterSelect
                            value={cond.logic}
                            options={ADV_LOGIC_OPTIONS}
                            onChange={(val) => onUpdateCondition(cond.id, { logic: val })}
                          />
                        </div>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      </div>
                    )}
                    <div className="relative bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Condición {idx + 1}</span>
                        {conditions.length > 1 && (
                          <button onClick={() => onRemoveCondition(cond.id)} className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer" title="Eliminar condición">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 mb-1 block">Columna</span>
                          <AdvFilterSelect
                            value={cond.column}
                            options={colOptions}
                            searchable
                            placeholder="Selecciona columna..."
                            onChange={(val) => onUpdateCondition(cond.id, { column: val })}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 mb-1 block">Condición</span>
                          <AdvFilterSelect
                            value={cond.condition}
                            options={conditionOptions}
                            placeholder="Selecciona condición..."
                            onChange={(val) => onUpdateCondition(cond.id, { condition: val })}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 mb-1 block">Comparar con</span>
                          <AdvFilterSelect
                            value={cond.compareType}
                            options={ADV_COMPARE_TYPE_OPTIONS}
                            onChange={(val) => onUpdateCondition(cond.id, { compareType: val })}
                          />
                        </div>
                      </div>

                      {cond.compareType === "campo" ? (
                        <div className="mt-2">
                          <span className="text-[10px] font-medium text-slate-400 mb-1 block">Columna a comparar</span>
                          <AdvFilterSelect
                            value={cond.compareColumn}
                            options={colOptions}
                            searchable
                            placeholder="Selecciona columna..."
                            onChange={(val) => onUpdateCondition(cond.id, { compareColumn: val })}
                          />
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="text-[10px] font-medium text-slate-400 mb-1 block">Valor</span>
                          <AdvValueAutocomplete
                            column={cond.column}
                            value={cond.value}
                            onChange={(val) => onUpdateCondition(cond.id, { value: val })}
                            isDate={isDateCol}
                            fetchSuggestions={fetchSuggestions}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={onAddCondition}
                className="self-start flex items-center gap-1.5 px-3.5 py-2 border border-dashed border-slate-200 dark:border-slate-700 hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" /><span>Agregar condición</span>
              </button>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onApply}
                className="w-full bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] font-semibold py-2.5 rounded-xl text-xs transition-opacity active:scale-[0.99] hover:opacity-90"
              >
                Aplicar Filtros
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Botón de toolbar para abrir el modal, con badge de condiciones aplicadas. */
export function AdvancedFiltersButton({ onClick, appliedCount = 0 }) {
  return (
    <button onClick={onClick} className="relative flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer">
      <SlidersHorizontal className="size-3.5" /><span>Filtros Avanzados</span>
      {appliedCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[9px] font-black rounded-full">{appliedCount}</span>
      )}
    </button>
  );
}
