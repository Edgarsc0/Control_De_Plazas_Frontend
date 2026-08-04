"use client";

import { useState } from "react";
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
 * @param {Array<{key?: string, label: string, mono?: boolean, render?: (row: Object) => *, onClick?: (row: Object) => void, valueClassName?: (row: Object) => string}>} [props.config.fields] - Pares clave/valor del cuerpo. `onClick` hace el valor clicable (detiene la propagación al tap de la tarjeta).
 * @param {(row: Object, index: number) => void} [props.onClick] - Tap en la tarjeta (abrir expediente).
 * @returns {JSX.Element}
 */
export default function DataCard({ row, index = 0, config = {}, onClick }) {
  const { getTitle, getSubtitle, renderBadge, fields = [] } = config;
  // `title` no existe en táctil: los valores largos ("Agencia Nacional de
  // Adua…", una CURP) quedaban truncados sin forma de leerlos. Un toque sobre
  // el valor lo despliega en su sitio (y no abre el expediente).
  const [expanded, setExpanded] = useState(() => new Set());
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
          <h3 className="text-sm font-black text-slate-800 dark:text-white truncate leading-tight" title={typeof title === "string" ? title : undefined}>
            {title || <span className="text-slate-400 dark:text-slate-600 italic font-bold">Sin nombre</span>}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate" title={typeof subtitle === "string" ? subtitle : undefined}>
              {subtitle}
            </p>
          )}
        </div>
        {/* El badge se acota y el chevron va en columna propia: con badges
            largos ("Licencia Médica S/Sueldo") ambos se pisaban. */}
        <div className="flex items-center gap-1.5 shrink-0 max-w-[52%]">
          <span className="min-w-0 flex justify-end">{renderBadge && renderBadge(row)}</span>
          <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors" />
        </div>
      </div>

      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
          {fields.map((f) => {
            const raw = f.render ? f.render(row) : row?.[f.key];
            const empty = raw === undefined || raw === null || String(raw).trim() === "";
            const clickable = !empty && typeof f.onClick === "function";
            const extraClass = f.valueClassName ? f.valueClassName(row) : "";
            return (
              <div key={f.key || f.label} className="min-w-0">
                <span className="block text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-600 mb-0.5 truncate" title={f.label}>
                  {f.label}
                </span>
                <span
                  onClick={
                    clickable
                      ? (e) => { e.stopPropagation(); f.onClick(row); }
                      : empty
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            const key = f.key || f.label;
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key); else next.add(key);
                              return next;
                            });
                          }
                  }
                  title={empty ? undefined : String(raw)}
                  className={`block text-[11px] font-bold text-slate-700 dark:text-slate-300 ${
                    expanded.has(f.key || f.label) ? "whitespace-normal break-words" : "truncate"
                  } ${f.mono ? "font-mono" : ""} ${clickable || !empty ? "cursor-pointer" : ""} ${extraClass}`}
                >
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
