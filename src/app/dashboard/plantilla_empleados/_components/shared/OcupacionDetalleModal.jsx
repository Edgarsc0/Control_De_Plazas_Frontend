"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, XCircle, Info, User, Hash, Calendar, UserCheck } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/**
 * Modal de detalle del registro decisivo (cp_tbl_mov_completo_29_05_26) que
 * originó la fecha de ocupación vigente de una posición — consume la
 * respuesta de `VacantesService.getMovPosOcupacionDetalle`. Mismo esqueleto
 * visual que VacanciaDetalleModal, sin las variantes A/B/C (aquí siempre es
 * "el movimiento que abrió la racha actual del ocupante").
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {?Object} props.detalle - Respuesta de getMovPosOcupacionDetalle (o null mientras carga).
 * @param {boolean} props.isLoading
 */
export default function OcupacionDetalleModal({ open, onClose, detalle, isLoading }) {
  useBodyScrollLock(open);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/85 shadow-[0_32px_96px_-24px_rgba(15,23,42,0.3)] w-full max-w-lg overflow-hidden flex flex-col z-[90]"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-emerald-600" />

            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/20 shrink-0">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Detalle de Ocupación</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posición</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300 rounded-md text-[10px] font-mono font-bold">
                      {detalle?.no_pos_actual || '—'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 max-h-[65vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="size-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando detalle...</p>
                </div>
              ) : !detalle ? null : detalle.error && !detalle.fecha_ocupacion ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <XCircle className="size-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{detalle.error}</p>
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
                  }}
                  className="flex flex-col gap-5"
                >
                  {detalle.error && (
                    <motion.div
                      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                      className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-3"
                    >
                      <Info className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{detalle.error}</p>
                    </motion.div>
                  )}

                  {!detalle.error && (
                    <>
                      <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } } }}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">Fecha de Ocupación</span>
                            <Calendar className="size-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{detalle.fecha_ocupacion || '—'}</p>
                        </div>
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">Nº Posición</span>
                            <Hash className="size-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 font-mono">{detalle.no_pos_actual || '—'}</p>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } } }}
                        className="p-4 bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-950/40 dark:to-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="size-12 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-emerald-500/10 shrink-0">
                          {detalle.empleado?.nombre_completo
                            ? detalle.empleado.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                            : <User className="size-5" />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] block mb-1">Ocupante Actual</span>
                          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 truncate" title={detalle.empleado?.nombre_completo}>
                            {detalle.empleado?.nombre_completo || '—'}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-semibold text-slate-400">ID Empleado:</span>
                            <span className="text-[10px] font-bold text-slate-650 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {detalle.empleado?.num_empleado || '—'}
                            </span>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } } }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2 block">Motivo</label>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{detalle.motivo_nombre || '—'}</p>
                          </div>
                          {detalle.motivo && (
                            <div className="mt-2.5">
                              <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded font-mono">
                                Cód. {detalle.motivo}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2 block">Acción Administrativa</label>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{detalle.accion_nombre || '—'}</p>
                          </div>
                          {detalle.accion && (
                            <div className="mt-2.5">
                              <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded font-mono">
                                Acción: {detalle.accion}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>

                      <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } } }}
                        className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-4 divide-x divide-slate-200/60 dark:divide-slate-800/80"
                      >
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-1.5">Fecha Efectiva</label>
                          <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{detalle.fecha_efectiva || '—'}</p>
                        </div>
                        <div className="flex flex-col pl-4">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-1.5">Fecha de Captura</label>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{detalle.fecha_captura || '—'}</p>
                        </div>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              )}
            </div>

            <div className="px-6 py-4.5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/30 dark:bg-slate-850/10 gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-[#621f32] to-[#8d2c48] dark:from-[#bc955c] dark:to-[#d4af73] text-white dark:text-[#3e131f] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-md shadow-[#621f32]/10 dark:shadow-[#bc955c]/10"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
