"use client";

import { useEffect, useState } from "react";
import { History, Loader2, FileWarning, User } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx } from "@/utils/columnFilters";
import ModalShell from "@/components/shared/ModalShell";

const formatFecha = (iso) => (iso ? formatDateEsMx(iso, { withTime: true }) : "—");

/**
 * Historial de CAMBIOS de un Anexo 2 ya guardado — a diferencia de
 * AnuenciaHistorialModal.jsx (que lista TODOS los anexos guardados para
 * abrir uno, botón "Abrir"), este modal es sobre UN solo anexo: cada
 * guardado que tuvo (manual o auto-guardado), con quién y cuándo, y un
 * resumen legible de qué cambió (hojas/plazas agregadas o eliminadas,
 * campos editados a mano) — ver `AnuenciaAnexoCambio` /
 * `_diff_hojas_anuencia` en el backend.
 */
export default function AnuenciaHistorialCambiosModal({ open, onClose, anexoId, nombreArchivo }) {
  const [cambios, setCambios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !anexoId) return;
    let active = true;
    setCargando(true);
    setError(null);
    VacantesService.getAnuenciaAnexoHistorialCambios(anexoId)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el historial de cambios."))))
      .then((data) => { if (active) setCambios(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el historial de cambios."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [open, anexoId]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="md"
      icon={History}
      eyebrow="Anuencia"
      title="Historial de cambios"
      subtitle={nombreArchivo}
    >
      {!anexoId ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <History className="size-8 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-500">Guarda este Anexo 2 primero.</p>
          <p className="text-xs text-slate-400">El historial de cambios sólo existe para anexos ya guardados en el servidor.</p>
        </div>
      ) : cargando ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando historial...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <FileWarning className="size-8 text-amber-500" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      ) : cambios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <History className="size-8 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-500">Todavía no hay cambios registrados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cambios.map((entrada) => (
            <div
              key={entrada.id}
              className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200">
                  <User className="size-3.5 text-[#621f32] dark:text-[#bc955c]" />
                  {entrada.usuario_nombre || "—"}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {formatFecha(entrada.fecha)}
                </span>
              </div>
              <ul className="flex flex-col gap-1 pl-1">
                {(entrada.cambios || []).map((linea, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed before:content-['•'] before:mr-1.5 before:text-[#bc955c]"
                  >
                    {linea}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
