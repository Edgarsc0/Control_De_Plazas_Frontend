"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, History, FolderOpen, Download, Loader2, FileWarning, Search, Trash2, Check } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx } from "@/utils/columnFilters";
import { exportarAnexo2 } from "./anexo2Excel";

const formatFecha = (iso) => (iso ? formatDateEsMx(iso, { withTime: true }) : "—");

/**
 * Historial de anexos de Anuencia guardados en el servidor (a diferencia del
 * borrador en localStorage de AnuenciaTab.jsx, que sólo vive en ESTE
 * navegador) — cada uno se creó al descargar un Anexo 2 (ver
 * `AnuenciaAnexoViewSet.perform_create`). Desde aquí se puede:
 *  - "Abrir": recuperarlo completo dentro del editor para seguir editándolo
 *    (bubblea el detalle a `onCargar`, AnuenciaTab.jsx aplica el estado).
 *  - "Descargar": re-generar su .xlsx tal cual quedó guardado, sin tocar lo
 *    que el usuario tenga abierto ahora mismo en el editor.
 *  - "Eliminar" (ícono de bote de basura, con confirmación inline): soft
 *    delete — el registro nunca se borra de la base de datos (auditoría),
 *    sólo deja de aparecer aquí y sus plazas dejan de marcarse como "en
 *    anuencia" en Mov. Posiciones (ver `AnuenciaAnexoViewSet.eliminar`).
 * Todas quedan auditadas (ver `generado_por`/`generado_en`/`veces_generado`/
 * `eliminado_por`/`eliminado_en` en el modelo).
 */
export default function AnuenciaHistorialModal({ open, onClose, onCargar, anexoIdActual, onEliminadoAnexoActual }) {
  const { toast } = useToast();
  const [anexos, setAnexos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [idEnProceso, setIdEnProceso] = useState(null); // fila con una acción (abrir/descargar) en curso
  const [busqueda, setBusqueda] = useState("");
  const [idAConfirmar, setIdAConfirmar] = useState(null); // fila mostrando "¿Seguro que quieres eliminarlo?"

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCargando(true);
    setError(null);
    setBusqueda("");
    VacantesService.getAnuenciaAnexos()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el historial."))))
      .then((data) => { if (active) setAnexos(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el historial."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [open]);

  // Filtro client-side: la lista ya viene completa del servidor (sin
  // paginación) y trae tanto el nombre del archivo como las UAs de cada
  // anexo (ver AnuenciaAnexoListSerializer), así que no hace falta ir de
  // nuevo al backend para buscar entre lo que ya está cargado.
  const termino = busqueda.trim().toLowerCase();
  const anexosFiltrados = termino
    ? anexos.filter((a) => {
        const nombre = (a.nombre_archivo || "").toLowerCase();
        const uas = (a.unidades_administrativas || []).join(" ").toLowerCase();
        const creador = (a.creado_por_email || "").toLowerCase();
        return nombre.includes(termino) || uas.includes(termino) || creador.includes(termino);
      })
    : anexos;

  const handleAbrir = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.getAnuenciaAnexo(id);
      if (!res.ok) throw new Error("No se pudo abrir el anexo.");
      const detalle = await res.json();
      onCargar(detalle);
      onClose();
    } catch (err) {
      toast.error(err.message || "No se pudo abrir el anexo.");
    } finally {
      setIdEnProceso(null);
    }
  };

  const handleDescargar = async (id) => {
    setIdEnProceso(id);
    try {
      const resDetalle = await VacantesService.getAnuenciaAnexo(id);
      if (!resDetalle.ok) throw new Error("No se pudo cargar el anexo.");
      const detalle = await resDetalle.json();

      await exportarAnexo2({
        hojas: detalle.hojas || [],
        firmaNombre: detalle.firma_nombre,
        firmaPuesto: detalle.firma_puesto,
        nombreArchivo: detalle.nombre_archivo,
      });

      // Se audita DESPUÉS de generar el archivo — si la descarga falla no
      // debe quedar registrado como generado.
      const resGenerar = await VacantesService.generarAnuenciaAnexo(id);
      if (resGenerar.ok) {
        const actualizado = await resGenerar.json();
        setAnexos((prev) => prev.map((a) => (a.id === id ? { ...a, generado_en: actualizado.generado_en, generado_por_email: actualizado.generado_por_email, veces_generado: actualizado.veces_generado } : a)));
      }
    } catch (err) {
      toast.error(err.message || "No se pudo generar el .xlsx.");
    } finally {
      setIdEnProceso(null);
    }
  };

  /** Soft delete — nunca borra la fila (ver `AnuenciaAnexoViewSet.eliminar`):
   * sólo la saca del historial y libera sus plazas en Mov. Posiciones. */
  const handleEliminar = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.eliminarAnuenciaAnexo(id);
      if (!res.ok) throw new Error("No se pudo eliminar el anexo.");
      setAnexos((prev) => prev.filter((a) => a.id !== id));
      // Si el anexo que se acaba de eliminar es justo el que está abierto en
      // el editor detrás de este modal, seguir mostrándolo/dejando editarlo
      // no tiene sentido — ya no existe como anexo activo. AnuenciaTab.jsx
      // resuelve esto cargando una plantilla en blanco de inmediato.
      if (String(id) === String(anexoIdActual)) {
        onEliminadoAnexoActual?.();
      } else {
        toast.success("Anexo 2 eliminado — sus plazas ya no cuentan como \"en anuencia\".");
      }
    } catch (err) {
      toast.error(err.message || "No se pudo eliminar el anexo.");
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
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
                  <History className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Historial de Anuencia</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Anexos 2 guardados en este sistema</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {!cargando && !error && anexos.length > 0 && (
              <div className="px-4 pt-4 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, unidad administrativa o quién lo creó..."
                    className="w-full pl-9 pr-3 py-2.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando historial...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <FileWarning className="size-8 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
                </div>
              ) : anexos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <History className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">Aún no se ha generado ningún Anexo 2.</p>
                  <p className="text-xs text-slate-400">Cada vez que descargues uno, aparecerá aquí.</p>
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
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                          {a.nombre_archivo?.trim() || `Anexo #${a.id}`}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {a.unidades_administrativas?.length ? a.unidades_administrativas.join(" · ") : "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {a.total_hojas} {a.total_hojas === 1 ? "hoja" : "hojas"} ·{" "}
                          {a.total_filas} {a.total_filas === 1 ? "plaza" : "plazas"} · creado por{" "}
                          <span className="font-bold text-slate-600 dark:text-slate-300">{a.creado_por_email || "—"}</span> el {formatFecha(a.creado_en)}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Última modificación: {formatFecha(a.actualizado_en)} por {a.actualizado_por_email || "—"}
                          {" · "}Generado {a.veces_generado} {a.veces_generado === 1 ? "vez" : "veces"}
                          {a.generado_en ? ` (última: ${formatFecha(a.generado_en)})` : ""}
                        </p>
                      </div>

                      {idAConfirmar === a.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1">¿Eliminar?</span>
                          <button
                            onClick={() => handleEliminar(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Sí, eliminar (el registro se conserva para auditoría, sólo deja de aparecer aquí)"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {idEnProceso === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            <span>Sí</span>
                          </button>
                          <button
                            onClick={() => setIdAConfirmar(null)}
                            disabled={idEnProceso === a.id}
                            title="Cancelar"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAbrir(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Abrir en el editor"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {idEnProceso === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                            <span>Abrir</span>
                          </button>
                          <button
                            onClick={() => handleDescargar(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Volver a generar el .xlsx"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            {idEnProceso === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                            <span>Descargar</span>
                          </button>
                          <button
                            onClick={() => setIdAConfirmar(a.id)}
                            disabled={idEnProceso === a.id}
                            title="Eliminar (no se pierde el historial: sólo deja de aparecer aquí y sus plazas quedan libres)"
                            className="flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
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
