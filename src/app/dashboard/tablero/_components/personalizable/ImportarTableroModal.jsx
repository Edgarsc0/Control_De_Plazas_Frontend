"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import { MODO_IMPORTACION, totalEscritorios } from "./portabilidadTablero";

const nombreEscritorio = (nombres, i) => (nombres[i] || "").trim() || `Escritorio ${i + 1}`;

/**
 * Pregunta dónde colocar lo importado: en el escritorio actual, en uno nuevo o
 * en uno existente (y, para administradores, reemplazando todo el tablero).
 *
 * @param {{nombre: string, widgets: Array}[]} importados - escritorios del archivo.
 * @param {Array} widgets @param {string[]} nombres - tablero destino actual.
 * @param {?number} escritorioActual - índice del escritorio en pantalla; null si no hay (administración).
 * @param {boolean} [permitirReemplazar] - ofrece "Reemplazar todo el tablero".
 * @param {(importados: Array, opciones: {modo: string, destino: number}) => void} onConfirmar
 */
export default function ImportarTableroModal({
  open, onClose, importados, widgets, nombres, escritorioActual = null, permitirReemplazar = false, onConfirmar, titulo = "Importar dashboard",
}) {
  const total = totalEscritorios(widgets, nombres);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [modo, setModo] = useState("nuevo");
  const [destino, setDestino] = useState(0);

  // "actual" es una opción de interfaz: se traduce a ESCRITORIO con destino fijo.
  useEffect(() => {
    if (!open) return;
    setSeleccion(new Set(importados.map((_, i) => i)));
    setModo(escritorioActual !== null ? "actual" : "nuevo");
    setDestino(escritorioActual ?? 0);
  }, [open, importados, escritorioActual]);

  const opciones = useMemo(() => [
    ...(escritorioActual !== null
      ? [{ id: "actual", titulo: `En el escritorio actual («${nombreEscritorio(nombres, escritorioActual)}»)`, detalle: "Los módulos se acomodan en los huecos libres." }]
      : []),
    { id: "nuevo", titulo: seleccion.size > 1 ? "En escritorios nuevos" : "En un escritorio nuevo", detalle: "Se agregan al final; no se toca lo que ya tienes." },
    { id: "existente", titulo: "En un escritorio existente", detalle: "Elige cuál abajo." },
    ...(permitirReemplazar
      ? [{ id: "reemplazar", titulo: "Reemplazar todo el tablero", detalle: "Se descarta lo que hay hoy." }]
      : []),
  ], [escritorioActual, nombres, seleccion.size, permitirReemplazar]);

  const alternar = (i) => setSeleccion((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const confirmar = () => {
    const elegidos = importados.filter((_, i) => seleccion.has(i));
    if (modo === "actual") onConfirmar(elegidos, { modo: MODO_IMPORTACION.ESCRITORIO, destino: escritorioActual });
    else if (modo === "existente") onConfirmar(elegidos, { modo: MODO_IMPORTACION.ESCRITORIO, destino });
    else if (modo === "reemplazar") onConfirmar(elegidos, { modo: MODO_IMPORTACION.REEMPLAZAR });
    else onConfirmar(elegidos, { modo: MODO_IMPORTACION.NUEVO });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="sm"
      icon={Upload}
      title={titulo}
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
            onClick={confirmar}
            disabled={seleccion.size === 0}
            className="px-5 py-2.5 bg-[#621f32] hover:bg-[#4d1827] text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            Importar
          </button>
        </div>
      }
    >
      {importados.length > 1 && (
        <>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Escritorios del archivo</p>
          <ul className="flex flex-col gap-1 mb-5">
            {importados.map((esc, i) => (
              <li key={i}>
                <label className="flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                  <input type="checkbox" checked={seleccion.has(i)} onChange={() => alternar(i)} className="size-4 accent-[#621f32]" />
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{esc.nombre || `Escritorio ${i + 1}`}</span>
                  <span className="shrink-0 text-xs text-slate-400">{esc.widgets.length} módulo(s)</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">¿Dónde importarlo?</p>
      <div className="flex flex-col gap-1" role="radiogroup">
        {opciones.map((op) => (
          <label key={op.id} className="flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
            <input type="radio" name="destino-importacion" checked={modo === op.id} onChange={() => setModo(op.id)} className="mt-1 size-4 accent-[#621f32]" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{op.titulo}</span>
              <span className="block text-xs text-slate-400">{op.detalle}</span>
            </span>
          </label>
        ))}
      </div>

      {modo === "existente" && (
        <select
          value={destino}
          onChange={(e) => setDestino(Number(e.target.value))}
          aria-label="Escritorio destino"
          className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-100 outline-none focus:border-[#621f32]"
        >
          {Array.from({ length: total }, (_, i) => (
            <option key={i} value={i}>{nombreEscritorio(nombres, i)}</option>
          ))}
        </select>
      )}
    </ModalShell>
  );
}
