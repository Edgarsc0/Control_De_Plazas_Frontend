"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Archive, RotateCcw, Eye, Loader2, FileWarning, Search, ChevronLeft, Check } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx } from "@/utils/columnFilters";

const formatFecha = (iso) => (iso ? formatDateEsMx(iso, { withTime: true }) : "—");

/**
 * Anexo 2 eliminados (soft delete) — botón "Anexos eliminados" del sub-tab
 * Anuencia, sólo visible con el permiso `view_anuencia_eliminados` (ver
 * AnuenciaTab.jsx). Un Anexo 2 eliminado nunca se borra de la base de datos
 * (ver `AnuenciaAnexo.eliminado`) — este modal es la única forma de:
 *  - "Ver": consultar su contenido completo (hojas y plazas) SIN reactivarlo
 *    (`AnuenciaAnexoViewSet.eliminado_detalle`).
 *  - "Reactivar": deshacer el soft delete — vuelve al historial normal y sus
 *    plazas vuelven a marcarse "en anuencia" en Mov. Posiciones de inmediato.
 * A diferencia de AnuenciaHistorialModal.jsx, "Ver" no abre el editor (esto
 * es sólo consulta de un registro que, mientras siga eliminado, no se puede
 * modificar) — el detalle se muestra aquí mismo, en modo lectura.
 */
export default function AnexosEliminadosModal({ open, onClose }) {
  const { toast } = useToast();
  const [paso, setPaso] = useState("lista"); // "lista" | "detalle"
  const [anexos, setAnexos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [idEnProceso, setIdEnProceso] = useState(null);
  const [idAConfirmar, setIdAConfirmar] = useState(null);

  const [detalle, setDetalle] = useState(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setPaso("lista");
    setBusqueda("");
    setDetalle(null);
    setIdAConfirmar(null);
    let active = true;
    setCargando(true);
    setError(null);
    VacantesService.getAnuenciaAnexosEliminados()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar los Anexo 2 eliminados."))))
      .then((data) => { if (active) setAnexos(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar los Anexo 2 eliminados."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [open]);

  const termino = busqueda.trim().toLowerCase();
  const anexosFiltrados = termino
    ? anexos.filter((a) => {
        const nombre = (a.nombre_archivo || "").toLowerCase();
        const uas = (a.unidades_administrativas || []).join(" ").toLowerCase();
        return nombre.includes(termino) || uas.includes(termino);
      })
    : anexos;

  const handleVer = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.getAnuenciaAnexoEliminadoDetalle(id);
      if (!res.ok) throw new Error("No se pudo abrir el detalle de ese Anexo 2.");
      const data = await res.json();
      setDetalle(data);
      setPaso("detalle");
    } catch (err) {
      toast.error(err.message || "No se pudo abrir el detalle de ese Anexo 2.");
    } finally {
      setIdEnProceso(null);
    }
  };

  const handleReactivar = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.reactivarAnuenciaAnexo(id);
      if (!res.ok) throw new Error("No se pudo reactivar el Anexo 2.");
      setAnexos((prev) => prev.filter((a) => a.id !== id));
      toast.success("Anexo 2 reactivado — sus plazas ya vuelven a marcarse \"en anuencia\".");
      if (paso === "detalle" && detalle?.id === id) {
        setPaso("lista");
        setDetalle(null);
      }
    } catch (err) {
      toast.error(err.message || "No se pudo reactivar el Anexo 2.");
    } finally {
      setIdEnProceso(null);
      setIdAConfirmar(null);
    }
  };

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
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/85 shadow-[0_32px_96px_-24px_rgba(15,23,42,0.3)] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col z-[90]"
          >
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                {paso === "detalle" && (
                  <button
                    onClick={() => { setPaso("lista"); setDetalle(null); }}
                    className="p-2 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Volver a la lista"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
                  <Archive className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                    {paso === "lista" ? "Anexos eliminados" : detalle?.nombre_archivo?.trim() || `Anexo #${detalle?.id}`}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                    {paso === "lista"
                      ? "Anexo 2 eliminados — el registro se conserva, sólo dejó de aparecer en el historial"
                      : "Detalle en sólo lectura — no se puede editar mientras siga eliminado"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {paso === "lista" && !cargando && !error && anexos.length > 0 && (
              <div className="px-4 pt-4 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o unidad administrativa..."
                    className="w-full pl-9 pr-3 py-2.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {paso === "detalle" ? (
                !detalle ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-[11px] text-amber-900/90 dark:text-amber-300/90">
                      Eliminado por <strong>{detalle.eliminado_por_email || "—"}</strong> el {formatFecha(detalle.eliminado_en)}.
                    </div>
                    {(detalle.hojas || []).map((h) => (
                      <div key={h._id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800/70">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{h.nombre}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{h.unidad_administrativa || "—"}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-slate-400 dark:text-slate-500 uppercase text-[9px] font-black">
                                <th className="text-left px-3 py-1.5">Código</th>
                                <th className="text-left px-3 py-1.5">Puesto</th>
                                <th className="text-left px-3 py-1.5">Nivel</th>
                                <th className="text-right px-3 py-1.5">Plazas</th>
                                <th className="text-left px-3 py-1.5">Tipo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(h.filas || []).filter((f) => f.codigo).map((f) => (
                                <tr key={f._id} className="border-t border-slate-100 dark:border-slate-800/70">
                                  <td className="px-3 py-1.5 font-mono font-bold text-slate-700 dark:text-slate-200">{f.codigo}</td>
                                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{f.denominacion_puesto || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{f.nivel_salarial || "—"}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-300">{f.numero_plazas || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{f.tipo_contratacion || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => handleReactivar(detalle.id)}
                      disabled={idEnProceso === detalle.id}
                      className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {idEnProceso === detalle.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                      <span>Reactivar este Anexo 2</span>
                    </button>
                  </div>
                )
              ) : cargando ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando Anexo 2 eliminados...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <FileWarning className="size-8 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
                </div>
              ) : anexos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Archive className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">No hay ningún Anexo 2 eliminado.</p>
                </div>
              ) : anexosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Search className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">Sin resultados para &quot;{busqueda.trim()}&quot;.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {anexosFiltrados.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                          {a.nombre_archivo?.trim() || `Anexo #${a.id}`}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {a.unidades_administrativas?.length ? a.unidades_administrativas.join(" · ") : "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {a.total_hojas} {a.total_hojas === 1 ? "hoja" : "hojas"} · {a.total_filas} {a.total_filas === 1 ? "plaza" : "plazas"}
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                          Eliminado por <span className="font-bold">{a.eliminado_por_email || "—"}</span> el {formatFecha(a.eliminado_en)}
                        </p>
                      </div>

                      {idAConfirmar === a.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1">¿Reactivar?</span>
                          <button
                            onClick={() => handleReactivar(a.id)}
                            disabled={idEnProceso === a.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {idEnProceso === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            <span>Sí</span>
                          </button>
                          <button
                            onClick={() => setIdAConfirmar(null)}
                            disabled={idEnProceso === a.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleVer(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Ver detalle (sólo lectura)"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {idEnProceso === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                            <span>Ver</span>
                          </button>
                          <button
                            onClick={() => setIdAConfirmar(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Reactivar"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Reactivar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
