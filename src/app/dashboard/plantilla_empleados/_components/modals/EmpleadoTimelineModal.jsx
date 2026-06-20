"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Activity, Loader2, ArrowUpRight, MapPin, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Note: using framer-motion as it seems imported differently sometimes, I'll use "motion/react" if it was "motion/react" in the tab
import { VacantesService } from "@/services/vacantes.service";

// format date if needed
const formatDate = (dateString) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC", // Avoid offset shift for YYYY-MM-DD
  });
};

const IGNORED_DIFF_FIELDS = [
  "sec", "fecha_captura", "fecha_ult_actz", "por", "fecha_descarga",
  "accion", "accion_nombre", "motivo", "motivo_nombre", "fecha_efectiva",
  "id", "num_empleado", "nombre", "ap_pat", "ap_mat", "columna_C", "columna_D",
  "rfc", "curp", "sexo"
];

const FIELD_LABELS = {
  sal_base: "Salario Base",
  puesto_ptal: "Puesto",
  ubicacion: "Ubicación",
  un_admin: "Unidad Administrativa",
  posicion: "Posición",
  nivel_tabular: "Nivel Tabular",
  estado_pago: "Estado Pago",
  est_hr: "Estatus HR",
  partida_presup: "Partida Presupuestal",
  cd_puesto: "Código Puesto",
  gp_pago: "Grupo Pago",
  escala: "Escala",
  grado: "Grado",
  plan_sal: "Plan Salarial",
  prog_benef: "Programa Benef.",
  id_estbl: "Id Establecimiento",
  grupo_cd_sal: "Grupo CD Sal",
  gp_trabajo: "Grupo Trabajo",
  antiguo_empr: "Antigüedad Emp.",
  nv_jerarquico: "Nivel Jerárquico",
  desc_larga_un: "Desc. Unidad Admin.",
  desc_larga_p: "Desc. Puesto"
};

const getDifferences = (current, previous) => {
  if (!previous) return [];
  const differences = [];
  for (const key in current) {
    if (IGNORED_DIFF_FIELDS.includes(key)) continue;
    const curVal = String(current[key] || "").trim();
    const prevVal = String(previous[key] || "").trim();
    if (curVal !== prevVal) {
      differences.push({
        key,
        label: FIELD_LABELS[key] || key.toUpperCase(),
        oldValue: prevVal || "(Vacío)",
        newValue: curVal || "(Vacío)"
      });
    }
  }
  return differences;
};

const COLUMNS = [
  { key: "posicion", label: "Posición", width: 110 },
  { key: "num_empleado", label: "No. Empleado", width: 120 },
  { key: "nombre", label: "Nombre", width: 150 },
  { key: "ap_pat", label: "Ap. Paterno", width: 150 },
  { key: "ap_mat", label: "Ap. Materno", width: 150 },
  { key: "accion_nombre", label: "Nombre Acción", width: 180 },
  { key: "motivo_nombre", label: "Nombre Motivo", width: 180 },
  { key: "fecha_efectiva", label: "Fecha Efectiva", width: 130 },
  { key: "sec", label: "Sec", width: 80 },
  { key: "fecha_captura", label: "Fecha Captura", width: 130 },
  { key: "est_hr", label: "Est. Hr", width: 100 },
  { key: "estado_pago", label: "Estado Pago", width: 110 },
  { key: "partida_presup", label: "Partida Presup.", width: 120 },
  { key: "un", label: "UN", width: 100 },
  { key: "un_admin", label: "UN Admin.", width: 250 },
  { key: "id_depto", label: "Id Depto", width: 100 },
  { key: "depen_direc", label: "Depen. Direc.", width: 250 },
  { key: "plan_sal", label: "Plan Sal.", width: 110 },
  { key: "grado", label: "Grado", width: 90 },
  { key: "escala", label: "Escala", width: 95 },
  { key: "puesto_ptal", label: "Puesto Ptal.", width: 250 },
  { key: "nivel_tabular", label: "Nivel Tabular", width: 110 },
  { key: "gp_pago", label: "Gp Pago", width: 100 },
  { key: "prog_benef", label: "Prog. Benef.", width: 150 },
  { key: "sal_base", label: "Sal. Base", width: 120 },
  { key: "cd_puesto", label: "Cd Puesto", width: 110 },
  { key: "ubicacion", label: "Ubicación", width: 200 },
  { key: "id_estbl", label: "Id Estbl", width: 100 },
  { key: "salida_prevista", label: "Salida Prevista", width: 130 },
  { key: "fecha_ult_actz", label: "Fecha Últ. Actz.", width: 150 },
  { key: "por", label: "Por", width: 120 },
  { key: "ult_inicio", label: "Últ. Inicio", width: 130 },
  { key: "fecha_inicial", label: "Fecha Inicial", width: 130 },
  { key: "gp_trabajo", label: "Gp Trabajo", width: 150 },
  { key: "grupo_cd_sal", label: "Grupo Cd Sal", width: 120 },
  { key: "antiguo_empr", label: "Antiguo Empr.", width: 120 },
  { key: "rfc", label: "RFC", width: 140 },
  { key: "curp", label: "CURP", width: 185 },
  { key: "id_persona", label: "Id Persona", width: 120 },
  { key: "desc_larga_p", label: "Desc. Larga P", width: 250 },
  { key: "nv_jerarquico", label: "Nv. Jerárquico", width: 130 },
  { key: "desc_larga_un", label: "Desc. Larga UN", width: 250 },
  { key: "sexo", label: "Sexo", width: 90 },
  { key: "fecha_entrada", label: "Fecha Entrada", width: 130 },
  { key: "fecha_posicion", label: "Fecha Posición", width: 130 }
];

export default function EmpleadoTimelineModal({ open, onOpenChange, numEmpleado }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("timeline"); // "timeline" | "table"
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = data.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(val => String(val || "").toLowerCase().includes(q));
  });

  useEffect(() => {
    if (open && numEmpleado) {
      setLoading(true);
      VacantesService.getMovimientosPersonal({
        num_empleado__iexact: numEmpleado,
        sort_by: "fecha_efectiva,sec",
        sort_order: "desc",
        no_pagination: true,
      })
        .then((res) => res.json())
        .then((resData) => {
          setData(resData || []);
        })
        .catch((err) => console.error("Error fetching timeline:", err))
        .finally(() => setLoading(false));
    } else {
      setData([]);
    }
  }, [open, numEmpleado]);

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
        className={`relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full z-[110] flex flex-col overflow-hidden h-[80vh] transition-all duration-500 ease-in-out ${activeTab === "table" ? "max-w-[95vw]" : "max-w-3xl"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] flex items-center justify-center shadow-md">
              <Activity className="size-6 text-white dark:text-[#3e131f]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#621f32] dark:text-[#bc955c] leading-tight">
                Detalle de Empleado
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                No. Empleado: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{numEmpleado}</span>
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
        
        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button 
            onClick={() => setActiveTab("timeline")}
            className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${activeTab === "timeline" ? "border-[#621f32] text-[#621f32] dark:border-[#bc955c] dark:text-[#bc955c]" : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
          >
            Línea de Tiempo
          </button>
          <button 
            onClick={() => setActiveTab("table")}
            className={`pb-3 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${activeTab === "table" ? "border-[#621f32] text-[#621f32] dark:border-[#bc955c] dark:text-[#bc955c]" : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
          >
            Vista de Tabla
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/50 custom-scrollbar relative flex flex-col">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#621f32] dark:text-[#bc955c]">
              <Loader2 className="size-10 animate-spin mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Cargando movimientos...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[200px]">
              <Search className="size-12 mb-4 opacity-50" />
              <p className="font-bold">No se encontraron movimientos.</p>
            </div>
          ) : activeTab === "timeline" ? (
            <div className="relative border-l-2 border-[#621f32]/20 dark:border-[#bc955c]/20 ml-14 p-8 pb-4 w-full max-w-2xl">
              {data.map((mov, idx) => (
                <div key={idx} className="mb-10 relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[33px] top-1">
                    <div className="size-4 rounded-full bg-white dark:bg-slate-900 border-[4px] border-[#621f32] dark:border-[#bc955c] shadow-md z-10 relative" />
                    {idx === 0 && (
                      <div className="absolute inset-0 size-4 rounded-full bg-[#621f32] dark:bg-[#bc955c] animate-ping opacity-75" />
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 ml-6 hover:shadow-md hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-all">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase text-[#621f32] dark:text-[#bc955c] tracking-wider mb-1">
                          {mov.accion_nombre || "Desconocido"}
                        </h4>
                        <p className="text-xs font-bold text-slate-500 uppercase bg-slate-100 dark:bg-slate-700/50 inline-block px-2 py-0.5 rounded-md">
                          {mov.motivo_nombre || "Motivo N/A"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Fecha Efectiva</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatDate(mov.fecha_efectiva)}
                          </span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Fecha Captura</span>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                            {formatDate(mov.fecha_captura)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mt-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                      <div className="flex items-start gap-2">
                        <ArrowUpRight className="size-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Posición & Puesto</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            <span className="font-mono text-[#621f32] dark:text-[#bc955c] mr-2">{mov.posicion}</span>
                            {mov.puesto_ptal || "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="size-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Ubicación / UN</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {mov.ubicacion || "-"}
                            <br />
                            <span className="text-slate-500">{mov.un_admin || "-"}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {idx === 0 && (
                      <div className="mt-4 inline-flex items-center justify-center px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500">
                        Movimiento más reciente
                      </div>
                    )}
                    
                    {/* Differences */}
                    {(() => {
                      const diffs = getDifferences(mov, data[idx + 1]);
                      if (diffs.length > 0) {
                        return (
                          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                              Cambios Detectados:
                            </h5>
                            <div className="flex flex-col gap-2">
                              {diffs.map((diff, dIdx) => (
                                <div key={dIdx} className="flex items-center flex-wrap gap-2 text-xs bg-slate-50/50 dark:bg-slate-900/20 p-2 rounded-lg border border-slate-100/50 dark:border-slate-800/50">
                                  <span className="font-bold text-slate-600 dark:text-slate-300 mr-1 min-w-[120px]">{diff.label}:</span>
                                  <span className="line-through text-slate-400 dark:text-slate-500 italic px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{diff.oldValue}</span>
                                  <span className="text-slate-400 mx-1">➜</span>
                                  <span className="font-black text-[#621f32] dark:text-[#bc955c] px-1.5 py-0.5 bg-[#621f32]/10 dark:bg-[#bc955c]/10 rounded shadow-sm">{diff.newValue}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">Registros ({filteredData.length})</h4>
                <div className="relative flex items-center pr-3 pl-4 py-2 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-xl transition-all shadow-sm w-64">
                  <Search className="text-slate-400 size-3.5 mr-2" />
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Filtrar tabla..." 
                    className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold w-full outline-none" 
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 ml-1">
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-auto border border-slate-200/50 dark:border-slate-800/80 rounded-xl shadow-inner flex-1 bg-white/50 dark:bg-slate-900/20 custom-scrollbar relative">
                <table className="text-left text-gray-500 border-collapse w-max min-w-full">
                  <thead className="bg-[#501929]/90 dark:bg-[#3e131f]/90 text-white sticky top-0 z-30 shadow-md">
                    <tr>
                      <th className="sticky left-0 z-40 bg-[#40121e]/90 text-center align-middle border-r border-[#621f32]/35 py-2.5 px-3 font-black text-[10px] uppercase">
                        #
                      </th>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className="py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 bg-[#501929] text-slate-200 whitespace-nowrap" style={{ minWidth: col.width }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-350">
                    {filteredData.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-[#621f32]/[0.015] h-[37px] transition-colors">
                        <td className="sticky left-0 z-25 text-center font-mono text-[10px] border-r px-3 align-middle bg-slate-50/85 text-slate-400">
                          {rowIdx + 1}
                        </td>
                        {COLUMNS.map((col) => {
                          const val = row[col.key];
                          return (
                            <td key={col.key} className="px-4 text-xs border-r truncate align-middle font-semibold bg-white/10" style={{ maxWidth: col.width }}>
                              {val === null || val === undefined || String(val).trim() === "" ? (
                                <span className="text-slate-350 dark:text-slate-750 italic">-</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length + 1} className="py-12 text-center text-slate-500 font-semibold italic text-xs">
                          No hay registros que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
