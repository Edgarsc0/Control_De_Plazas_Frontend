"use client";

import { Search } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";

/**
 * Valor completo de una celda de tabla (cuando el texto está truncado).
 * Componente compartido por los tabs de plantilla — antes eran 4 copias casi
 * idénticas (Bajas, Movimientos, PlantillaDetalle, MovimientosPersonal).
 * Puramente presentacional: cada tab resuelve `columnLabel`/`cellRef`/`value`
 * con su propia lógica de acceso a datos antes de pasarlos aquí.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.columnLabel] - Nombre de la columna.
 * @param {string} [props.cellRef] - Referencia estilo hoja de cálculo (ej. "C12").
 * @param {*} props.value - Valor completo de la celda.
 */
export default function CeldaValorModal({ open, onClose, columnLabel, cellRef, value }) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="sm"
      icon={Search}
      eyebrow="Valor completo"
      title={columnLabel || "Detalle de celda"}
      subtitle={cellRef}
      footer={
        <button
          onClick={onClose}
          className="px-5 py-2.5 bg-[#621f32] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-[#4a1726] transition-all active:scale-95 cursor-pointer"
        >
          Cerrar
        </button>
      }
    >
      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 min-h-[80px] max-h-[50vh] overflow-y-auto custom-scrollbar">
        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed break-words whitespace-pre-wrap">
          {hasValue ? (
            String(value)
          ) : (
            <span className="text-slate-400 dark:text-slate-600 italic">Dato vacío / No especificado</span>
          )}
        </p>
      </div>
    </ModalShell>
  );
}
