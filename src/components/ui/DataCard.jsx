"use client";

import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

/**
 * Tarjeta móvil genérica para una fila de datos. En pantallas `< md` sustituye a
 * la fila de la tabla densa estilo Excel (`DataTable`). El tab provee la `config`
 * de dominio (qué campos mostrar y cómo formatearlos); esta tarjeta sólo dibuja.
 *
 * @param {Object} props
 * @param {Object} props.row - Fila de datos.
 * @param {number} props.index - Índice dentro de la lista visible (para el stagger).
 * @param {Object} props.config - Config de presentación.
 * @param {(row: Object) => (string|JSX.Element)} [props.config.getTitle] - Título de la tarjeta.
 * @param {(row: Object) => (string|JSX.Element)} [props.config.getSubtitle] - Subtítulo (mono).
 * @param {(row: Object) => JSX.Element} [props.config.renderBadge] - Badge superior derecho (estado).
 * @param {Array<{key?: string, label: string, mono?: boolean, render?: (row: Object) => *}>} [props.config.fields] - Pares clave/valor del cuerpo.
 * @param {(row: Object, index: number) => void} [props.onClick] - Tap en la tarjeta (abrir expediente).
 * @returns {JSX.Element}
 */
export default function DataCard({ row, index = 0, config = {}, onClick }) {
  const { getTitle, getSubtitle, renderBadge, fields = [] } = config;
  const title = getTitle ? getTitle(row) : "";
  const subtitle = getSubtitle ? getSubtitle(row) : "";

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(row, index)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.02 }}
      className="group w-full text-left bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm active:scale-[0.99] hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-all flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-800 dark:text-white truncate leading-tight">
            {title || <span className="text-slate-400 dark:text-slate-600 italic font-bold">Sin nombre</span>}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {renderBadge && renderBadge(row)}
          <ChevronRight className="size-4 text-slate-300 dark:text-slate-600 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors" />
        </div>
      </div>

      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
          {fields.map((f) => {
            const raw = f.render ? f.render(row) : row?.[f.key];
            const empty = raw === undefined || raw === null || String(raw).trim() === "";
            return (
              <div key={f.key || f.label} className="min-w-0">
                <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-600 mb-0.5">
                  {f.label}
                </span>
                <span className={`block text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate ${f.mono ? "font-mono" : ""}`}>
                  {empty ? <span className="text-slate-300 dark:text-slate-700 italic">—</span> : String(raw)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.button>
  );
}
