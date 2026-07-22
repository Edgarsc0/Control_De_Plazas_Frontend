"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, XCircle, AlertTriangle, Info, User, Hash, Calendar, Eye, Activity, Layers } from "lucide-react";

// Compartido con MovimientosTab (columna "Fecha de Vacancia" de su tabla, que
// usa estos mismos textos en su propio tooltip) — única fuente de verdad para
// no repetir las descripciones de categoría/insubsistencia en dos archivos.
export const CATEGORIA_VACANCIA_TOOLTIP = {
  A: "Posición vacante porque empleado que la ocupaba causó baja",
  B: "Posición vacante porque empleado que la ocupaba cambió a otra posición, vacancia = fecha en que tomó esa nueva posición",
  C: "Posición vacante porque jamás tuvo ocupante, vacancia = fecha creación posición",
};

export const TUVO_INSUBSISTENCIA_TOOLTIP = {
  S: "La fecha de vacancia ignoró una Insubsistencia (Nombramiento o Contrato HH) y, si la acompañaba, su Contratación/Recontratación, recalculando con el movimiento válido siguiente",
  N: "La fecha de vacancia se calculó sin encontrar insubsistencias en el historial de la posición",
};

const VACANCIA_CATEGORIA_STYLE = {
  A: {
    icon: XCircle,
    label: "Baja de Personal",
    gradient: "from-red-500 to-red-600",
    ring: "shadow-red-500/20",
    badgeBg: "bg-red-50 dark:bg-red-950/30",
    badgeText: "text-red-600 dark:text-red-400",
    badgeBorder: "border-red-200/60 dark:border-red-900/40",
    accent: "text-red-600 dark:text-red-400",
  },
  B: {
    icon: Layers,
    label: "Cambio de Posición",
    gradient: "from-blue-500 to-blue-600",
    ring: "shadow-blue-500/20",
    badgeBg: "bg-blue-50 dark:bg-blue-950/30",
    badgeText: "text-blue-600 dark:text-blue-400",
    badgeBorder: "border-blue-200/60 dark:border-blue-900/40",
    accent: "text-blue-600 dark:text-blue-400",
  },
  C: {
    icon: Eye,
    label: "Nunca Ocupada",
    gradient: "from-slate-400 to-slate-500",
    ring: "shadow-slate-500/10",
    badgeBg: "bg-slate-100 dark:bg-slate-800/60",
    badgeText: "text-slate-500 dark:text-slate-400",
    badgeBorder: "border-slate-200/60 dark:border-slate-700",
    accent: "text-slate-500 dark:text-slate-400",
  },
};

const VACANCIA_CATEGORIA_DEFAULT = {
  icon: Activity,
  label: "Vacancia",
  gradient: "from-[#621f32] to-[#8d2c48]",
  ring: "shadow-[#621f32]/20",
  badgeBg: "bg-[#621f32]/8",
  badgeText: "text-[#621f32]",
  badgeBorder: "border-[#621f32]/20",
  accent: "text-[#621f32] dark:text-[#bc955c]",
};

/**
 * Modal de detalle dinámico (por categoría A/B/C) de la vacancia de una
 * posición — consume la respuesta de `VacantesService.getMovPosVacanciaDetalle`.
 * Compartido entre MovimientosTab (columna "Fecha de Vacancia") y
 * EmployeesModal (columna del mismo nombre en los cuadros de vacancia).
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {?Object} props.detalle - Respuesta de getMovPosVacanciaDetalle (o null mientras carga).
 * @param {boolean} props.isLoading
 */
export default function VacanciaDetalleModal({ open, onClose, detalle, isLoading }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (() => {
        const catStyle = VACANCIA_CATEGORIA_STYLE[detalle?.categoria_vacancia] || VACANCIA_CATEGORIA_DEFAULT;
        const CatIcon = catStyle.icon;
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/85 shadow-[0_32px_96px_-24px_rgba(15,23,42,0.3)] w-full max-w-lg overflow-hidden flex flex-col z-[90]"
            >
              <div className={`h-1.5 w-full bg-gradient-to-r ${catStyle.gradient}`} />

              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 bg-gradient-to-br ${catStyle.gradient} text-white rounded-2xl shadow-md ${catStyle.ring} shrink-0`}>
                    <CatIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Detalle de Vacancia</h3>
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
                    <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando detalle...</p>
                  </div>
                ) : !detalle ? null : detalle.error && !detalle.categoria_vacancia ? (
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
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.08
                        }
                      }
                    }}
                    className="flex flex-col gap-5"
                  >
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                      }}
                      className={`flex flex-col gap-2 p-4 rounded-2xl border relative overflow-hidden ${catStyle.badgeBg} ${catStyle.badgeBorder}`}
                    >
                      <div className="absolute right-4 top-4 opacity-[0.08] pointer-events-none">
                        <CatIcon className="size-16" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white dark:bg-slate-900/60 shadow-sm border border-slate-200/40 dark:border-slate-800/40 ${catStyle.badgeText}`}>
                          Categoría {detalle.categoria_vacancia}
                        </span>
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          {catStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed pr-12">
                        {CATEGORIA_VACANCIA_TOOLTIP[detalle.categoria_vacancia]}
                      </p>
                    </motion.div>

                    {detalle.error && (
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 12 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-3"
                      >
                        <Info className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{detalle.error}</p>
                      </motion.div>
                    )}

                    {detalle.tuvo_insubsistencia === "S" && (
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 12 },
                          visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                        }}
                        className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex flex-col gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Insubsistencia Detectada</span>
                        </div>
                        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium leading-relaxed">
                          {TUVO_INSUBSISTENCIA_TOOLTIP.S}
                        </p>

                        {detalle.insubsistencia?.error ? (
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{detalle.insubsistencia.error}</p>
                        ) : detalle.insubsistencia && (
                          <>
                            <div className="flex items-center gap-3 pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                              <div className="size-10 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-3">
                                {detalle.insubsistencia.empleado?.nombre_completo
                                  ? detalle.insubsistencia.empleado.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                                  : <User className="size-4" />
                                }
                              </div>
                              <div className="min-w-0 flex-1 mt-3">
                                <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 truncate" title={detalle.insubsistencia.empleado?.nombre_completo}>
                                  {detalle.insubsistencia.empleado?.nombre_completo || '—'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-semibold text-amber-600/70 dark:text-amber-500/70">ID Empleado:</span>
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                                    {detalle.insubsistencia.empleado?.num_empleado || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black uppercase text-amber-600/70 dark:text-amber-500/70 tracking-[0.15em] mb-1 block">Motivo</label>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{detalle.insubsistencia.motivo_nombre || '—'}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-amber-600/70 dark:text-amber-500/70 tracking-[0.15em] mb-1 block">Posición</label>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">{detalle.insubsistencia.posicion || '—'}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-amber-600/70 dark:text-amber-500/70 tracking-[0.15em] mb-1 block">Fecha Insubsistencia</label>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{detalle.insubsistencia.fecha_efectiva || '—'}</p>
                              </div>
                              <div>
                                <label className="text-[9px] font-black uppercase text-amber-600/70 dark:text-amber-500/70 tracking-[0.15em] mb-1 block">Fecha Captura</label>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{detalle.insubsistencia.fecha_captura || '—'}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}

                    {!detalle.error && (
                      <>
                        <motion.div
                          variants={{
                            hidden: { opacity: 0, y: 12 },
                            visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                          }}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">Fecha de Vacancia</span>
                              <Calendar className="size-3.5 text-slate-400 group-hover:text-[#bc955c] transition-colors" />
                            </div>
                            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{detalle.fecha_vacancia || '—'}</p>
                          </div>
                          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em]">
                                {detalle.categoria_vacancia === "B" ? "Posición Destino" : "Nº Posición"}
                              </span>
                              <Hash className="size-3.5 text-slate-400 group-hover:text-[#bc955c] transition-colors" />
                            </div>
                            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 font-mono">
                              {detalle.categoria_vacancia === "B" ? detalle.posicion_destino : detalle.no_pos_actual || '—'}
                            </p>
                          </div>
                        </motion.div>

                        {(detalle.categoria_vacancia === "A" || detalle.categoria_vacancia === "B") && (
                          <>
                            <motion.div
                              variants={{
                                hidden: { opacity: 0, y: 12 },
                                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                              }}
                              className="p-4 bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-950/40 dark:to-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                            >
                              <div className="size-12 bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-[#621f32]/10 shrink-0">
                                {detalle.empleado?.nombre_completo
                                  ? detalle.empleado.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                                  : <User className="size-5" />
                                }
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] block mb-1">
                                  {detalle.categoria_vacancia === "A" ? "Empleado Saliente (Baja)" : "Empleado Trasladado"}
                                </span>
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
                              variants={{
                                hidden: { opacity: 0, y: 12 },
                                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                              }}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                            >
                              <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                <div>
                                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2 block">
                                    {detalle.categoria_vacancia === "A" ? "Motivo de Baja" : "Motivo del Cambio"}
                                  </label>
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
                                    <span className="inline-block text-[10px] font-bold text-[#621f32] dark:text-[#bc955c] bg-[#621f32]/5 dark:bg-[#bc955c]/10 px-2 py-0.5 rounded font-mono">
                                      Acción: {detalle.accion}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}

                        {detalle.categoria_vacancia === "C" && (
                          <motion.div
                            variants={{
                              hidden: { opacity: 0, y: 12 },
                              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                            }}
                            className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                          >
                            <div className="p-2 bg-slate-100 dark:bg-slate-850 rounded-xl text-slate-500 shrink-0 h-fit">
                              <Eye className="size-4.5" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] block mb-1">Nota del Sistema</span>
                              <p className="text-xs font-medium text-slate-650 dark:text-slate-400 leading-relaxed">
                                Esta posición nunca ha tenido un ocupante registrado. Las fechas y detalles reflejados corresponden al primer movimiento documentado en el historial de esta plaza.
                              </p>
                            </div>
                          </motion.div>
                        )}

                        <motion.div
                          variants={{
                            hidden: { opacity: 0, y: 12 },
                            visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
                          }}
                          className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-4 divide-x divide-slate-200/60 dark:divide-slate-800/80"
                        >
                          <div className="flex flex-col">
                            <label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.15em] mb-1.5">Fecha Efectiva</label>
                            <p className={`text-sm font-extrabold ${catStyle.accent}`}>{detalle.fecha_efectiva || '—'}</p>
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
        );
      })()}
    </AnimatePresence>,
    document.body
  );
}
