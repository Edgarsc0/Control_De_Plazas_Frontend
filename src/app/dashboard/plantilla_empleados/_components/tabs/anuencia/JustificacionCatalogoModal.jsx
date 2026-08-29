"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, BookMarked, Plus, Trash2, Loader2, FileWarning } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";

/**
 * Catálogo de justificaciones reutilizables para el Anexo 2 (sub-tab
 * "Anuencia", ver AnuenciaTab.jsx) — muchas solicitudes repiten argumentos
 * casi idénticos, así que el usuario guarda aquí nombre + texto de las que
 * usa seguido y las inserta en la hoja que esté editando con "Agregar", en
 * vez de reescribirlas cada vez.
 */
export default function JustificacionCatalogoModal({ open, onClose, onAgregar }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [idEnProceso, setIdEnProceso] = useState(null);

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [textoNuevo, setTextoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCargando(true);
    setError(null);
    VacantesService.getAnuenciaJustificaciones()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el catálogo."))))
      .then((data) => { if (active) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el catálogo."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [open]);

  // El formulario de alta se limpia solo mientras el modal está cerrado —
  // así reabrirlo no arrastra un borrador a medio escribir de la vez pasada.
  useEffect(() => {
    if (!open) {
      setNombreNuevo("");
      setTextoNuevo("");
    }
  }, [open]);

  const handleGuardarNueva = async (e) => {
    e.preventDefault();
    const nombre = nombreNuevo.trim();
    const texto = textoNuevo.trim();
    if (!nombre || !texto) return;

    setGuardando(true);
    try {
      const res = await VacantesService.crearAnuenciaJustificacion({ nombre, texto });
      if (!res.ok) throw new Error();
      const creada = await res.json();
      setItems((prev) => [...prev, creada].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setNombreNuevo("");
      setTextoNuevo("");
      toast.success("Justificación agregada al catálogo.");
    } catch {
      toast.error("No se pudo guardar la justificación.");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    setIdEnProceso(id);
    try {
      const res = await VacantesService.eliminarAnuenciaJustificacion(id);
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error("No se pudo eliminar la justificación.");
    } finally {
      setIdEnProceso(null);
    }
  };

  const handleAgregar = (item) => {
    onAgregar(item.texto);
    toast.success(`"${item.nombre}" agregada a la justificación de la hoja actual.`);
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
                  <BookMarked className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Catálogo de Justificaciones</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Guarda las que usas seguido y agrégalas con un clic</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Alta de una nueva justificación */}
            <form onSubmit={handleGuardarNueva} className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 shrink-0">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Nombre (ej. Cubrir licencia médica)"
                  maxLength={255}
                  className="w-full px-3 py-2 text-[12px] font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                />
                <textarea
                  value={textoNuevo}
                  onChange={(e) => setTextoNuevo(e.target.value)}
                  placeholder="Texto de la justificación..."
                  rows={3}
                  className="w-full px-3 py-2 text-[12px] text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors resize-y"
                />
                <button
                  type="submit"
                  disabled={guardando || !nombreNuevo.trim() || !textoNuevo.trim()}
                  className="self-end flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  <span>Guardar en catálogo</span>
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando catálogo...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <FileWarning className="size-8 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <BookMarked className="size-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-500">Aún no hay justificaciones guardadas.</p>
                  <p className="text-xs text-slate-400">Agrega la primera arriba.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group/item flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">{item.texto}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleEliminar(item.id)}
                          disabled={idEnProceso === item.id}
                          title="Eliminar del catálogo"
                          className="opacity-0 group-hover/item:opacity-100 focus:opacity-100 transition-opacity p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          {idEnProceso === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </button>
                        <button
                          onClick={() => handleAgregar(item)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>Agregar</span>
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
