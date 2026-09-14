"use client";

import { GripVertical, X } from "lucide-react";

/**
 * Chrome común de cada widget dentro de la cuadrícula del tablero
 * personalizable: barra de título (con la clase `widget-drag-handle`, único
 * punto desde el que `react-grid-layout` puede iniciar el arrastre — ver
 * `dragConfig.handle` en PersonalizableGrid.jsx) + botón de eliminar.
 *
 * Sin esto, arrastrar el widget completo interferiría con los inputs/botones
 * interactivos de su contenido (buscadores, tablas, etc.).
 */
export default function WidgetFrame({ label, onRemove, editable = true, children }) {
  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
      <div
        className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-950/40 ${editable ? "widget-drag-handle cursor-move" : ""}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {editable && <GripVertical className="size-3.5 text-slate-400 shrink-0" />}
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
            {label}
          </span>
        </div>
        {editable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Quitar del tablero"
            className="shrink-0 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
