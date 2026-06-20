"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users, Loader2, DollarSign, Briefcase, Calendar, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VacantesService } from "@/services/vacantes.service";

const formatDate = (dateString) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const formatCurrency = (val) => {
  if (!val || isNaN(val)) return "-";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);
};

export default function PosicionTimelineModal({ open, onOpenChange, posicion }) {
  const [occupants, setOccupants] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && posicion) {
      setLoading(true);
      VacantesService.getMovimientosPersonal({
        posicion__iexact: posicion,
        sort_by: "fecha_efectiva",
        sort_order: "asc", // ASC to process timeline from start to finish
        no_pagination: true,
      })
        .then((res) => res.json())
        .then((resData) => {
          const data = resData || [];
          const processedOccupants = [];
          let currentOccupant = null;

          data.forEach((row) => {
            if (!currentOccupant || currentOccupant.num_empleado !== row.num_empleado) {
              if (currentOccupant) {
                processedOccupants.push(currentOccupant);
              }
              currentOccupant = {
                num_empleado: row.num_empleado,
                nombreCompleto: `${row.nombre || ""} ${row.ap_pat || ""} ${row.ap_mat || ""}`.trim(),
                fecha_inicio: row.fecha_efectiva,
                fecha_fin: row.fecha_efectiva,
                puesto_inicio: row.nivel_tabular,
                puesto_fin: row.nivel_tabular,
                salario_inicio: row.sal_base,
                salario_fin: row.sal_base,
                ultimo_motivo: row.motivo_nombre,
                ultima_accion: row.accion_nombre,
                fue_baja: false
              };
            } else {
              currentOccupant.fecha_fin = row.fecha_efectiva;
              currentOccupant.puesto_fin = row.nivel_tabular;
              currentOccupant.salario_fin = row.sal_base;
              currentOccupant.ultimo_motivo = row.motivo_nombre;
              currentOccupant.ultima_accion = row.accion_nombre;
            }
          });
          
          if (currentOccupant) {
            processedOccupants.push(currentOccupant);
          }

          // Check if the last record is a termination (Baja). If not, they are currently in the position.
          processedOccupants.forEach((occ, idx) => {
             // If there's someone after them, they definitely left. 
             // Alternatively, if their last action implies a Baja ('Baja', 'Renuncia', 'Terminó', 'TER').
             const actionStr = (occ.ultima_accion || "").toLowerCase();
             const motivoStr = (occ.ultimo_motivo || "").toLowerCase();
             if (idx < processedOccupants.length - 1 || actionStr.includes("baja") || motivoStr.includes("terminó") || motivoStr.includes("renuncia")) {
               occ.fue_baja = true;
             }
          });

          // Reverse to show most recent first
          processedOccupants.reverse();
          setOccupants(processedOccupants);
        })
        .catch((err) => console.error("Error fetching position timeline:", err))
        .finally(() => setLoading(false));
    } else {
      setOccupants([]);
    }
  }, [open, posicion]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl z-[110] flex flex-col overflow-hidden h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-[#bc955c] to-[#d0ab75] dark:from-[#621f32] dark:to-[#802842] flex items-center justify-center shadow-md">
              <Users className="size-6 text-white dark:text-[#f8ecee]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#621f32] dark:text-[#bc955c] leading-tight">
                Historial de Ocupantes
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Posición: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{posicion}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/50 custom-scrollbar relative flex flex-col">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#621f32] dark:text-[#bc955c]">
              <Loader2 className="size-10 animate-spin mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Analizando ocupantes...</p>
            </div>
          ) : occupants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[200px]">
              <Users className="size-12 mb-4 opacity-50" />
              <p className="font-bold">No se encontraron ocupantes históricos.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-[#bc955c]/30 dark:border-[#bc955c]/20 ml-14 p-8 pb-4 w-full max-w-2xl">
              {occupants.map((occ, idx) => (
                <div key={idx} className="mb-10 relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[33px] top-4">
                    <div className="size-4 rounded-full bg-white dark:bg-slate-900 border-[4px] border-[#bc955c] shadow-md z-10 relative" />
                    {idx === 0 && !occ.fue_baja && (
                      <div className="absolute inset-0 size-4 rounded-full bg-[#bc955c] animate-ping opacity-75" />
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 ml-6 hover:shadow-md hover:border-[#bc955c]/30 transition-all">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-base font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight">
                          {occ.nombreCompleto}
                        </h4>
                        <p className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">
                          #{occ.num_empleado}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <Calendar className="size-3 text-slate-400" />
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">
                          {formatDate(occ.fecha_inicio)}
                        </span>
                        <ArrowRight className="size-3 text-slate-300" />
                        <span className={`font-mono font-bold ${occ.fue_baja ? "text-rose-600 dark:text-rose-500" : "text-amber-600 dark:text-amber-500"}`}>
                          {occ.fue_baja ? formatDate(occ.fecha_fin) : "Presente"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mt-4 text-xs">
                      {/* Puesto */}
                      <div className="flex flex-col bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Briefcase className="size-3.5 text-slate-400" />
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Nivel Tabular</span>
                        </div>
                        {occ.puesto_inicio !== occ.puesto_fin ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="line-through text-slate-400">{occ.puesto_inicio || "-"}</span>
                            <span className="text-slate-300">➜</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{occ.puesto_fin || "-"}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-700 dark:text-slate-200">{occ.puesto_inicio || "-"}</span>
                        )}
                      </div>

                      {/* Salario */}
                      <div className="flex flex-col bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-1.5 mb-2">
                          <DollarSign className="size-3.5 text-slate-400" />
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Salario Base</span>
                        </div>
                        {occ.salario_inicio !== occ.salario_fin ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="line-through text-slate-400 font-mono">{formatCurrency(occ.salario_inicio)}</span>
                            <span className="text-slate-300">➜</span>
                            <span className="font-bold text-[#621f32] dark:text-[#bc955c] font-mono bg-[#621f32]/10 dark:bg-[#bc955c]/10 px-1.5 py-0.5 rounded">{formatCurrency(occ.salario_fin)}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{formatCurrency(occ.salario_inicio)}</span>
                        )}
                      </div>
                    </div>

                    {/* Footer badge para estado actual */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-3">
                      {occ.fue_baja ? (
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Motivo de Salida</span>
                          <span className="text-xs font-black text-rose-600/80 dark:text-rose-400 uppercase tracking-tight">
                            {occ.ultimo_motivo || occ.ultima_accion || "Baja"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Estatus</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                            Ocupando Posición Actual
                          </span>
                        </div>
                      )}

                      {idx === 0 && !occ.fue_baja && (
                        <div className="inline-flex items-center justify-center px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500">
                          Ocupante Actual
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
