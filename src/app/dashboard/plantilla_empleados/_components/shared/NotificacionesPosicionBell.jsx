"use client";

import { useState } from "react";
import { Bell, X, Clock, MailCheck, Trash2, ChevronDown, Briefcase, UserX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ModalShell from "@/components/shared/ModalShell";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { formatDateEsMx } from "@/utils/columnFilters";

const TIPO_META = {
  VACANTE: { label: "Vacante", icon: UserX, className: "bg-red-50 text-red-600 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40" },
  OCUPACION: { label: "Ocupación", icon: Briefcase, className: "bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" },
};

// Campos del `detalle_enviado` (snapshot congelado del correo, ver
// notificaciones_posicion.py) a mostrar y en qué orden, por tipo. Solo se
// pintan los que vengan con valor — muchos son opcionales según la
// categoría de vacancia (A/B/C) o si hubo match en cp_tbl_mov_completo.
const DETALLE_CAMPOS = {
  VACANTE: [
    ["categoria_label", "Categoría"],
    ["categoria_descripcion", "Descripción"],
    ["fecha_vacancia", "Fecha de vacancia"],
    ["empleado_nombre", "Empleado"],
    ["empleado_num", "No. Empleado"],
    ["accion_nombre", "Acción administrativa"],
    ["motivo_nombre", "Motivo"],
    ["fecha_efectiva", "Fecha efectiva"],
    ["fecha_captura", "Fecha de captura"],
    ["por", "Ejecutado por"],
    ["posicion_destino", "Posición destino"],
  ],
  OCUPACION: [
    ["nombres", "Nombre del ocupante"],
    ["numempleado", "No. Empleado"],
    ["accion_nombre", "Acción administrativa"],
    ["motivo", "Motivo"],
    ["fecha_efectiva", "Fecha efectiva"],
    ["fecha_captura", "Fecha de captura"],
    ["por", "Ejecutado por"],
    ["rfc", "RFC"],
    ["curp", "CURP"],
    ["fecha_prevista_de_salida", "Fecha prevista de salida"],
  ],
};

function TipoBadge({ tipo }) {
  const meta = TIPO_META[tipo] || TIPO_META.VACANTE;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wide ${meta.className}`}>
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

function DetalleGrid({ tipo, detalle }) {
  const campos = (DETALLE_CAMPOS[tipo] || []).filter(([key]) => {
    const v = detalle?.[key];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
  if (campos.length === 0) {
    return <p className="text-[11px] text-slate-400 italic px-1">Sin datos adicionales para esta notificación.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-1 pt-1">
      {campos.map(([key, label]) => (
        <div key={key} className="flex flex-col min-w-0">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{label}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={String(detalle[key])}>{String(detalle[key])}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Campanita "Notificaciones de posición": suscripciones PENDIENTES (aún no
 * cambia el estado de la posición) y YA LLEGADAS (correo enviado, con el
 * detalle completo que traía ese correo). Comparte el mismo estado que el
 * menú contextual de la columna Posición (CopyCellMenu) — cancelar aquí
 * también actualiza "isSubscribed" allá, y viceversa.
 *
 * @param {Object} props
 * @param {Array} props.suscripciones - `suscripciones` de `useSuscripcionesPosicion`.
 * @param {(id: number) => Promise<void>} props.onCancel - `cancelar` de `useSuscripcionesPosicion` (cancela si pendiente, descarta si ya llegó).
 */
export default function NotificacionesPosicionBell({ suscripciones, onCancel }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  // Suscripción sobre la que se pidió cancelar/descartar, en espera de
  // confirmación en el modal (ver ConfirmModal más abajo) — nunca se llama
  // a `onCancel` directo desde la lista.
  const [confirmTarget, setConfirmTarget] = useState(null);

  const pendientes = suscripciones.filter((s) => s.activa);
  const llegadas = suscripciones
    .filter((s) => !s.activa && s.notificado_en)
    .sort((a, b) => new Date(b.notificado_en) - new Date(a.notificado_en));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Notificaciones de posición"
        aria-label="Notificaciones de posición"
        className="relative shrink-0 flex items-center justify-center size-8 rounded-xl bg-[#621f32]/8 dark:bg-[#621f32]/20 text-[#621f32] dark:text-[#bc955c] hover:bg-[#621f32]/15 dark:hover:bg-[#621f32]/30 active:scale-95 transition-all cursor-pointer"
      >
        <Bell className="size-4" />
        {llegadas.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[9px] font-black leading-none shadow-sm ring-2 ring-white dark:ring-slate-950">
            {llegadas.length > 99 ? "99+" : llegadas.length}
          </span>
        )}
      </button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        icon={Bell}
        eyebrow="Columna Posición"
        title="Notificaciones de posición"
        subtitle="Avisos por correo de vacancia/ocupación a los que te suscribiste"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Clock className="size-3.5 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes ({pendientes.length})</span>
            </div>
            {pendientes.length === 0 ? (
              <div className="flex items-center justify-center py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">No tienes avisos pendientes.</span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                {pendientes.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-950">
                    <TipoBadge tipo={s.tipo} />
                    <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono truncate">{s.posicion}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">{formatDateEsMx(s.creado_en)}</span>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ id: s.id, posicion: s.posicion, modo: "cancelar" })}
                      title="Cancelar aviso"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <MailCheck className="size-3.5 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recibidas ({llegadas.length})</span>
            </div>
            {llegadas.length === 0 ? (
              <div className="flex items-center justify-center py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Aún no te ha llegado ninguna.</span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                {llegadas.map((s) => {
                  const isExpanded = expandedId === s.id;
                  return (
                    <div key={s.id} className="bg-white dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                      >
                        <TipoBadge tipo={s.tipo} />
                        <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono truncate">{s.posicion}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">{formatDateEsMx(s.notificado_en)}</span>
                        <ChevronDown className={`size-3.5 shrink-0 text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setConfirmTarget({ id: s.id, posicion: s.posicion, modo: "descartar" }); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setConfirmTarget({ id: s.id, posicion: s.posicion, modo: "descartar" }); } }}
                          title="Descartar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-1 bg-slate-50/60 dark:bg-slate-900/30">
                              <DetalleGrid tipo={s.tipo} detalle={s.detalle_enviado} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ModalShell>

      <ConfirmModal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => onCancel(confirmTarget.id)}
        title={confirmTarget?.modo === "descartar" ? "¿Descartar esta notificación?" : "¿Cancelar este aviso?"}
        message={
          confirmTarget?.modo === "descartar"
            ? `Se eliminará el registro de la notificación de la posición ${confirmTarget?.posicion}. No podrás volver a ver este detalle.`
            : `Ya no se te avisará por correo cuando la posición ${confirmTarget?.posicion} cambie de estado. Puedes volver a suscribirte cuando quieras.`
        }
        confirmLabel={confirmTarget?.modo === "descartar" ? "Descartar" : "Cancelar aviso"}
        cancelLabel="Volver"
      />
    </>
  );
}
