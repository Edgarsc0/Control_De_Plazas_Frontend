"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";

const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Sólo pide la fecha — el resultado NO se muestra aquí. Al confirmar, cierra
 * y delega a `onConfirm(fecha)` (en PlantillaDetalleTab: `activarHistorico`),
 * que sustituye el dataset de la tabla PRINCIPAL de la pestaña (misma
 * `DataTable` compartida) por la reconstrucción histórica — con su propio
 * botón "Volver a la plantilla actual" para regresar a los datos en vivo.
 * Antes este modal tenía su propia tabla/columnas/filtros completos; se
 * simplificó a sólo este paso porque el resultado debe verse en la tabla que
 * el usuario ya conoce (con sus mismos filtros/orden/columnas), no en una
 * tabla aparte dentro de un modal.
 */
export default function PlantillaHistoricaModal({ open, onClose, onConfirm }) {
  const [fecha, setFecha] = useState(hoyISO());

  const handleConfirm = () => {
    if (!fecha) return;
    onConfirm(fecha);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="md"
      icon={CalendarClock}
      eyebrow="Plantilla Detalle"
      title="Consultar plantillas pasadas"
      subtitle="Reconstruye la plantilla completa a una fecha pasada"
      bodyClassName="p-8"
    >
      <div className="flex flex-col items-center justify-center gap-6 py-2">
        <div className="size-16 rounded-full bg-[#621f32]/8 dark:bg-[#bc955c]/10 flex items-center justify-center">
          <CalendarClock className="size-7 text-[#621f32] dark:text-[#bc955c]" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1.5">Selecciona la fecha a consultar</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se reconstruirá la plantilla completa (todas las plazas, con su estado Activa/Inactiva y su ocupante en ese momento) tal como estaba ese día, y se mostrará en esta misma tabla. La primera consulta a una fecha nueva puede tardar hasta un minuto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            min="2022-01-01"
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            className="px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#621f32]/15"
          />
          <button
            onClick={handleConfirm}
            disabled={!fecha}
            className="px-6 py-3 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-2xl text-[11px] uppercase transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            Aceptar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
