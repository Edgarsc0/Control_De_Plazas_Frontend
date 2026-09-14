"use client";

import { LayoutGrid } from "lucide-react";
import { WIDGET_REGISTRY } from "./widgetRegistry";

/**
 * Barra lateral con el catálogo de módulos del sistema disponibles para
 * agregar al tablero. Cada tarjeta es arrastrable con drag nativo HTML5
 * (`draggable`) — es exactamente lo que `react-grid-layout` espera recibir
 * en su mecanismo de drop externo (`dropConfig`/`onDrop` en
 * PersonalizableGrid.jsx), no requiere `@dnd-kit`.
 *
 * `onDragStartType`/`onDragEndType` avisan al grid qué widget se está
 * arrastrando (para poder mostrar el placeholder del tamaño correcto vía
 * `onDropDragOver`) — el `dataTransfer` del evento nativo no es legible de
 * forma confiable durante el `dragover` en todos los navegadores, así que el
 * tipo se comunica también por estado de React, no solo por dataTransfer.
 */
export default function CatalogSidebar({ usedTypes, onDragStartType, onDragEndType }) {
  const entries = Object.values(WIDGET_REGISTRY);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70">
        <LayoutGrid className="size-4 text-[#621f32] dark:text-[#bc955c]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Módulos del sistema
        </h3>
      </div>
      <p className="shrink-0 px-4 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
        Arrastra un módulo hacia el tablero para agregarlo. Puedes repetir el mismo módulo varias veces.
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
        {entries.map((entry) => {
          const Icon = entry.icon;
          const count = usedTypes?.filter((t) => t === entry.type).length || 0;
          return (
            <div
              key={entry.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", entry.type);
                e.dataTransfer.effectAllowed = "copy";
                onDragStartType?.(entry.type);
              }}
              onDragEnd={() => onDragEndType?.()}
              className="group flex items-center gap-3 px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 transition-colors select-none"
              title="Arrastra hacia el tablero"
            >
              <div className="shrink-0 size-8 rounded-lg bg-[#621f32]/8 dark:bg-[#621f32]/15 flex items-center justify-center text-[#621f32] dark:text-[#bc955c]">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{entry.label}</p>
                {count > 0 && (
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {count} en el tablero
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
