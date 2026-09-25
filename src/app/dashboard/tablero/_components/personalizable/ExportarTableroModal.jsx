"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import { construirExportacion, descargarJson, totalEscritorios } from "./portabilidadTablero";

/**
 * Selector de escritorios + descarga del JSON. Sirve para el tablero propio y
 * para el de otro usuario (`widgets`/`nombres` son los que se quieren exportar).
 *
 * @param {string} nombreArchivo - nombre con el que se descarga el JSON.
 * @param {string} [descripcion] - texto bajo el título.
 * @param {(cantidad: number) => void} [onExportado]
 */
export default function ExportarTableroModal({ open, onClose, widgets, nombres, nombreArchivo, descripcion, onExportado }) {
  const total = totalEscritorios(widgets, nombres);
  const escritorios = useMemo(
    () => Array.from({ length: total }, (_, i) => ({
      indice: i,
      nombre: (nombres[i] || "").trim() || `Escritorio ${i + 1}`,
      modulos: widgets.filter((w) => (w.page ?? 0) === i).length,
    })),
    [widgets, nombres, total]
  );
  const [seleccion, setSeleccion] = useState(() => new Set());

  // Al abrir, todo marcado.
  useEffect(() => {
    if (open) setSeleccion(new Set(escritorios.map((e) => e.indice)));
  }, [open, escritorios]);

  const alternar = (indice) => setSeleccion((prev) => {
    const next = new Set(prev);
    if (next.has(indice)) next.delete(indice); else next.add(indice);
    return next;
  });
  const todosMarcados = seleccion.size === escritorios.length;

  const exportar = () => {
    descargarJson(construirExportacion(widgets, nombres, [...seleccion]), nombreArchivo);
    onExportado?.(seleccion.size);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="sm"
      icon={Download}
      title="Exportar dashboard"
      bodyClassName="p-5 sm:p-6"
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={seleccion.size === 0}
            className="px-5 py-2.5 bg-[#621f32] hover:bg-[#4d1827] text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            Exportar ({seleccion.size})
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
        {descripcion || "Elige los escritorios que quieres incluir en el archivo."}
      </p>
      <label className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg text-xs font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
        <input
          type="checkbox"
          checked={todosMarcados}
          onChange={() => setSeleccion(todosMarcados ? new Set() : new Set(escritorios.map((e) => e.indice)))}
          className="size-4 accent-[#621f32]"
        />
        Seleccionar todos
      </label>
      <ul className="flex flex-col gap-1">
        {escritorios.map((e) => (
          <li key={e.indice}>
            <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
              <input type="checkbox" checked={seleccion.has(e.indice)} onChange={() => alternar(e.indice)} className="size-4 accent-[#621f32]" />
              <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{e.nombre}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {e.modulos === 0 ? "vacío" : e.modulos === 1 ? "1 módulo" : `${e.modulos} módulos`}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
