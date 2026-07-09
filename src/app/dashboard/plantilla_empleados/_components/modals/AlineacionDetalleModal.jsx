"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, XCircle, GitCompareArrows, Briefcase, User } from "lucide-react";

/**
 * Modal de detalle de alineación de una plaza: muestra, campo a campo, el
 * valor en MOV_POS vs. el valor en EMPLEADOS_COMPLETOS_SIG y si coinciden.
 * Recibe la fila ya cargada (sin fetch adicional: `alineacion_detalle` viene
 * calculado por el backend en `/plantilla/mov_pos_alineacion/`).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.row - Fila del dataset de alineación.
 * @param {() => void} props.onClose
 */
export default function AlineacionDetalleModal({ open, row, onClose }) {
  if (typeof document === "undefined") return null;

  const detalle = row?.alineacion_detalle || {};
  const campos = Object.values(detalle);
  const esAlineada = row?.estado_alineacion === "Alineada";

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <div key="alineacion-detalle-modal" className="fixed inset-0 z-[9000] flex items-center justify-center p-2 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_rgba(0,0,0,0.25)] w-full max-w-3xl max-h-[88vh] flex flex-col z-[9010] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2.5 bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white rounded-xl shadow-lg shadow-[#621f32]/20 shrink-0">
                  <GitCompareArrows className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-slate-700 dark:text-slate-100 leading-tight truncate">
                    Alineación de la Plaza #{row.no_pos_actual}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                    {row.nombre_puesto || "Sin nombre de puesto"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border ${esAlineada ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40"}`}>
                {esAlineada ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                {row.estado_alineacion} · {row.campos_coincidentes}/{row.campos_totales} campos
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-[#621f32]/8 text-[#621f32] dark:bg-[#bc955c]/10 dark:text-[#bc955c] border border-[#621f32]/15 dark:border-[#bc955c]/20">
                <User className="size-3.5" />
                {row.ocupacion}{row.ocupante_nombre ? `: ${row.ocupante_nombre}` : ""}
              </span>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/60 dark:bg-slate-900/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-black uppercase text-[10px]">Campo</th>
                    <th className="px-4 py-2.5 font-black uppercase text-[10px]">
                      <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3" />MOV_POS</span>
                    </th>
                    <th className="px-4 py-2.5 font-black uppercase text-[10px]">
                      <span className="inline-flex items-center gap-1.5"><User className="size-3" />EMPLEADOS_COMPLETOS_SIG</span>
                    </th>
                    <th className="px-4 py-2.5 font-black uppercase text-[10px] text-center">Coincide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {campos.map((campo, idx) => (
                    <tr
                      key={idx}
                      className={campo.coincide ? "bg-white dark:bg-slate-900" : "bg-red-100/80 dark:bg-red-950/40 border-l-4 border-red-400 dark:border-red-600"}
                    >
                      <td className={`px-4 py-3 font-bold align-top ${campo.coincide ? "text-slate-600 dark:text-slate-300" : "text-red-700 dark:text-red-400"}`}>{campo.label}</td>
                      <td className={`px-4 py-3 font-mono align-top break-all ${campo.coincide ? "text-slate-700 dark:text-slate-200" : "text-red-700 dark:text-red-400 font-semibold"}`}>{campo.mov_pos_valor}</td>
                      <td className={`px-4 py-3 font-mono align-top break-all ${campo.coincide ? "text-slate-700 dark:text-slate-200" : "text-red-700 dark:text-red-400 font-semibold"}`}>{campo.empleados_sig_valor}</td>
                      <td className="px-4 py-3 text-center align-top">
                        {campo.coincide ? (
                          <CheckCircle2 className={`size-4 inline-block ${campo.ambos_vacios ? "text-slate-300 dark:text-slate-600" : "text-emerald-500"}`} title={campo.ambos_vacios ? "Ambos vacíos" : "Coincide"} />
                        ) : (
                          <XCircle className="size-4 inline-block text-red-500" title="Difiere" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
