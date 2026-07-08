"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Modal de advertencia antes de aplicar una fuente de prioridad de nivel
 * jerárquico. Al aceptar, se sobreescriben columnas de nivel jerárquico en
 * MOV_POS y EMPLEADOS_COMPLETOS_SIG donde la posición coincida con
 * cat_nivel_jerarquico_plaza.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string} props.columnLabel - Label de la columna origen (ej. "Nivel Jerárquico").
 * @param {boolean} props.applying
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export default function PrioridadNivelJerarquicoModal({ open, columnLabel, applying, onConfirm, onClose }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="prioridad-nj-modal" className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={applying ? undefined : onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full flex flex-col z-[110] overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">Se modificarán datos en producción</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Confirmación requerida</p>
                  </div>
                </div>
                {!applying && (
                  <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="size-6" /></button>
                )}
              </div>
            </div>

            <div className="p-8 flex flex-col gap-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Vas a marcar <span className="font-black text-[#621f32] dark:text-[#bc955c]">"{columnLabel}"</span> como la fuente de prioridad del nivel jerárquico.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Al aceptar, se cruzará <span className="font-mono text-xs">cat_nivel_jerarquico_plaza</span> contra las posiciones que coincidan y se sobreescribirán:
              </p>
              <ul className="text-xs font-semibold text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
                <li><span className="font-mono">MOV_POS</span>: columna <span className="font-mono">Nvl Direc</span> (posición activa vigente).</li>
                <li><span className="font-mono">EMPLEADOS_COMPLETOS_SIG</span>: columnas <span className="font-mono">NJ, NJ COMP, NJ OK, nombreNJ, NJOperativoComb</span>.</li>
              </ul>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl p-3 leading-relaxed">
                Esta prioridad queda guardada y se reaplica automáticamente en cada sincronización de ZAFIRO (cada 30 min), porque esas tablas se recargan completas.
              </p>
            </div>

            <div className="p-8 pt-0 flex gap-3">
              <button
                onClick={onClose}
                disabled={applying}
                className="flex-1 px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-[0.98] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={applying}
                className="flex-1 px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-amber-500/20 active:scale-[0.98] hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {applying ? "Aplicando..." : "Aceptar y aplicar"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
