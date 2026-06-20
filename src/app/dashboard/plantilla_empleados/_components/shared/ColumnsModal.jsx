"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Columns, Search, X, Check } from "lucide-react";

/**
 * Modal genérico para configurar la visibilidad de columnas de una tabla.
 * Reutilizable por todos los tabs de plantilla. Mantiene su propio estado de
 * búsqueda; el resto del estado de columnas lo provee `useColumnState`.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el modal está visible.
 * @param {Array<{key: string, label: string, visible: boolean, isBasic?: boolean}>} props.columns - Columnas configurables.
 * @param {(key: string) => void} props.onToggle - Alterna la visibilidad de una columna.
 * @param {() => void} props.onShowAll - Muestra todas las columnas.
 * @param {() => void} props.onHideAll - Oculta todas las columnas.
 * @param {() => void} props.onClose - Cierra el modal.
 * @returns {JSX.Element|null}
 */
export default function ColumnsModal({ open, columns = [], onToggle, onShowAll, onHideAll, onClose }) {
  const [search, setSearch] = useState("");

  if (typeof document === "undefined") return null;

  const filtered = columns.filter((col) => col.label.toLowerCase().includes(search.toLowerCase()));

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="columns-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="size-6" /></button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-[1.2rem] px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#621f32]/10 transition-all">
                  <Search className="size-4 text-slate-400 mr-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar columna por nombre..."
                    className="bg-transparent text-sm w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400"
                  />
                  {search && <button onClick={() => setSearch("")} className="text-slate-300 hover:text-slate-500 ml-2"><X className="size-4" /></button>}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onShowAll}
                    className="flex-1 sm:flex-none px-5 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                  >
                    Mostrar todas
                  </button>
                  <button
                    onClick={onHideAll}
                    className="flex-1 sm:flex-none px-5 py-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-black uppercase rounded-xl border border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all active:scale-95"
                  >
                    Borrar todas
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => onToggle(col.key)}
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
              {filtered.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <Search className="size-12 mb-4 opacity-20" />
                  <p className="font-bold">No se encontraron columnas</p>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-[#621f32] to-[#8d2c48] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-[#621f32]/20 dark:shadow-none active:scale-[0.98] hover:opacity-90"
              >
                Confirmar Selección
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
