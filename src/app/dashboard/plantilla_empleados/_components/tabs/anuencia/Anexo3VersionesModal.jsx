"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, History, FolderOpen, Loader2, FileWarning, Search } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx } from "@/utils/columnFilters";

const formatFecha = (iso) => (iso ? formatDateEsMx(iso, { withTime: true }) : "—");

/**
 * Historial de versiones guardadas del Anexo 3 de UN Anexo 2 en particular
 * (`anexoId`) — el acomodo de plazas entre hojas del Anexo 3 se puede
 * corregir a mano (ver Anexo3Editor.jsx), y cada corrección guardada es una
 * versión distinta. Mismo patrón que AnuenciaHistorialModal.jsx, pero sin
 * "Descargar" (el .xlsx del Anexo 3 se genera desde el propio editor, no
 * desde aquí) y siempre acotado a `anexoId`.
 */
export default function Anexo3VersionesModal({ open, onClose, anexoId, onCargar }) {
  const { toast } = useToast();
  const [versiones, setVersiones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [idEnProceso, setIdEnProceso] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !anexoId) return;
    let active = true;
    setCargando(true);
    setError(null);
    setBusqueda("");
    VacantesService.getAnexo3Versiones(anexoId)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el historial de versiones."))))
      .then((data) => { if (active) setVersiones(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el historial de versiones."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [open, anexoId]);

  const termino = busqueda.trim().toLowerCase();
  const versionesFiltradas = termino
    ? versiones.filter((v) => (v.nombre || "").toLowerCase().includes(termino) || (v.creado_por_email || "").toLowerCase().includes(termino))
    : versiones;

  const handleAbrir = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.getAnexo3Version(id);
      if (!res.ok) throw new Error("No se pudo abrir la versión.");
      const detalle = await res.json();
      onCargar(detalle);
      onClose();
    } catch (err) {
      toast.error(err.message || "No se pudo abrir la versión.");
    } finally {
      setIdEnProceso(null);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/85 shadow-[0_32px_96px_-24px_rgba(15,23,42,0.3)] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col z-[90]"
          >
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
                  <History className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Versiones del Anexo 3</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Acomodos guardados de este Anexo 2</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {!cargando && !error && versiones.length > 0 && (
              <div className="px-4 pt-4 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o quién la creó..."
                    className="w-full pl-9 pr-3 py-2.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando versiones...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <FileWarning className="size-8 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
                </div>
              ) : versiones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <History className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">Todavía no se ha guardado ninguna versión.</p>
                  <p className="text-xs text-slate-400">Ajusta el acomodo de plazas y usa &quot;Guardar versión&quot;.</p>
                </div>
              ) : versionesFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <Search className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">Sin resultados para &quot;{busqueda.trim()}&quot;.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {versionesFiltradas.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{v.nombre}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {v.total_hojas} {v.total_hojas === 1 ? "hoja" : "hojas"} ·{" "}
                          {v.total_plazas} {v.total_plazas === 1 ? "plaza" : "plazas"} · creada por{" "}
                          <span className="font-bold text-slate-600 dark:text-slate-300">{v.creado_por_email || "—"}</span> el {formatFecha(v.creado_en)}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Última modificación: {formatFecha(v.actualizado_en)} por {v.actualizado_por_email || "—"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleAbrir(v.id)}
                          disabled={idEnProceso === v.id}
                          title="Abrir esta versión"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          {idEnProceso === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                          <span>Abrir</span>
                        </button>
                      </div>
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
