"use client";

import { AlertTriangle } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";

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
  return (
    <ModalShell
      open={open}
      onClose={applying ? undefined : onClose}
      size="sm"
      icon={AlertTriangle}
      eyebrow="Confirmación requerida"
      title="Se modificarán datos en producción"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={applying}
            className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-full text-xs uppercase tracking-widest transition-all active:scale-[0.98] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={applying}
            className="flex-1 px-5 py-3 bg-[#621f32] text-white font-black rounded-full text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#621f32]/20 active:scale-[0.98] hover:bg-[#4a1726] disabled:opacity-50 cursor-pointer"
          >
            {applying ? "Aplicando..." : "Aceptar y aplicar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Vas a marcar <span className="font-black text-[#621f32] dark:text-[#e3c793]">"{columnLabel}"</span> como la fuente de prioridad del nivel jerárquico.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Al aceptar, se cruzará <span className="font-mono text-xs">cat_nivel_jerarquico_plaza</span> contra las posiciones que coincidan y se sobreescribirán:
        </p>
        <ul className="text-xs font-semibold text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
          <li><span className="font-mono">MOV_POS</span>: columna <span className="font-mono">Nvl Direc</span> (posición activa vigente).</li>
          <li><span className="font-mono">EMPLEADOS_COMPLETOS_SIG</span>: columnas <span className="font-mono">NJ, NJ COMP, NJ OK, nombreNJ, NJOperativoComb</span>.</li>
        </ul>
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 leading-relaxed">
          Esta prioridad queda guardada y se reaplica automáticamente en cada sincronización de ZAFIRO (cada 30 min), porque esas tablas se recargan completas.
        </p>
      </div>
    </ModalShell>
  );
}
