"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, FilePlus2, FolderOpen, Loader2, FileWarning, Search, ChevronLeft, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";
import { crearFilaVacia, crearHojaVacia, ordenarFilasPorNivel, OFICIO_AUTORIZACION_EVENTUAL } from "./anexo2Schema";

/**
 * Agrega plazas seleccionadas en Mov. Posiciones (clic derecho sobre la
 * columna "Código", ver MovimientosTab.jsx) a un Anexo 2 ya guardado — dos
 * pasos: primero cuál Anexo 2, luego a cuál de sus hojas (o una hoja nueva).
 * A diferencia de otros usos de "hoja por Unidad de Negocio", aquí el propio
 * usuario elige la hoja destino: los Anexo 2 reales pueden traer varias
 * Unidades de Negocio juntas a propósito (para compartir una sola
 * justificación entre ellas), así que agrupar automáticamente por Unidad de
 * Negocio produciría hojas duplicadas o rompería ese agrupamiento manual.
 *
 * Cada plaza se resuelve con el MISMO autollenado que usa la captura manual
 * del Anexo 2 (`AnuenciaLookupView`, ver `VacantesService.getAnuenciaLookup`)
 * — no se reimplementa esa lógica aquí. Las filas nuevas se intercalan con
 * `ordenarFilasPorNivel` (la misma regla jerárquica que ya usa AnuenciaTab.jsx),
 * así que no hace falta decidir en qué posición insertarlas a mano.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   plazas: {codigo: string, anuenciaAnexoNombre: string}[],
 *   onAgregado: () => void,
 * }} props
 */
export default function AgregarAAnexo2Modal({ open, onClose, plazas, onAgregado }) {
  const { toast } = useToast();
  const [paso, setPaso] = useState("anexo"); // "anexo" | "hoja"

  const [anexos, setAnexos] = useState([]);
  const [cargandoAnexos, setCargandoAnexos] = useState(false);
  const [errorAnexos, setErrorAnexos] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const [anexoSeleccionado, setAnexoSeleccionado] = useState(null); // { id, nombre_archivo, ... } (resumen de la lista)
  const [detalleAnexo, setDetalleAnexo] = useState(null); // detalle completo (con `hojas`)
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [nombreHojaNueva, setNombreHojaNueva] = useState("");

  const [agregando, setAgregando] = useState(false);
  const [resultado, setResultado] = useState(null); // { agregadas, omitidas, errores } | null

  useBodyScrollLock(open);

  const plazasValidas = (plazas || []).filter((p) => p.codigo);
  const yaEnAnuencia = plazasValidas.filter((p) => p.anuenciaAnexoNombre);
  const disponibles = plazasValidas.filter((p) => !p.anuenciaAnexoNombre);

  useEffect(() => {
    if (!open) return;
    setPaso("anexo");
    setBusqueda("");
    setAnexoSeleccionado(null);
    setDetalleAnexo(null);
    setNombreHojaNueva("");
    setResultado(null);
    let active = true;
    setCargandoAnexos(true);
    setErrorAnexos(null);
    VacantesService.getAnuenciaAnexos()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la lista de Anexo 2."))))
      .then((data) => { if (active) setAnexos(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setErrorAnexos(err.message || "Error al cargar los Anexo 2."); })
      .finally(() => { if (active) setCargandoAnexos(false); });
    return () => { active = false; };
  }, [open]);

  const termino = busqueda.trim().toLowerCase();
  const anexosFiltrados = termino
    ? anexos.filter((a) => (a.nombre_archivo || "").toLowerCase().includes(termino))
    : anexos;

  const handleElegirAnexo = async (a) => {
    setAnexoSeleccionado(a);
    setCargandoDetalle(true);
    try {
      const res = await VacantesService.getAnuenciaAnexo(a.id);
      if (!res.ok) throw new Error("No se pudo abrir ese Anexo 2.");
      const detalle = await res.json();
      setDetalleAnexo(detalle);
      setPaso("hoja");
    } catch (err) {
      toast.error(err.message || "No se pudo abrir ese Anexo 2.");
      setAnexoSeleccionado(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleVolver = () => {
    setPaso("anexo");
    setAnexoSeleccionado(null);
    setDetalleAnexo(null);
    setNombreHojaNueva("");
  };

  /** Resuelve una plaza vía el mismo autollenado que usa la captura manual
   * del Anexo 2 y arma su `fila` — null si el código ya no existe. */
  const resolverFila = async (codigo) => {
    const res = await VacantesService.getAnuenciaLookup(codigo);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...crearFilaVacia(),
      codigo: data.codigo ?? codigo,
      ramo: data.ramo ?? "",
      unidad_responsable: data.unidad_responsable ?? "",
      denominacion_puesto: data.denominacion_puesto ?? "",
      nivel_salarial: data.nivel_salarial ?? "",
      rango_salarial: data.rango_salarial ?? "",
      numero_plazas: data.numero_plazas ?? 1,
      tipo_contratacion: data.tipo_contratacion ?? "",
      fecha_inicio_vacancia: data.fecha_inicio_vacancia ?? "",
      oficio_autorizacion: data.tipo_contratacion === "Eventual" ? OFICIO_AUTORIZACION_EVENTUAL : "",
      _movPosId: data.mov_pos_id ?? null,
    };
  };

  const handleConfirmarHoja = async (hojaObjetivo) => {
    if (disponibles.length === 0) return;
    setAgregando(true);
    try {
      const resueltas = await Promise.all(disponibles.map((p) => resolverFila(p.codigo)));
      const filasNuevas = resueltas.filter(Boolean);
      const codigosConError = disponibles.filter((_, i) => !resueltas[i]).map((p) => p.codigo);

      if (filasNuevas.length === 0) {
        toast.error("Ninguna de las plazas se pudo resolver — puede que ya no existan en MOV_POS.");
        setAgregando(false);
        return;
      }

      const esHojaNueva = hojaObjetivo === "__nueva__";
      let hojasActualizadas;
      if (esHojaNueva) {
        const hojaNueva = { ...crearHojaVacia(nombreHojaNueva.trim() || "Hoja nueva"), filas: ordenarFilasPorNivel(filasNuevas) };
        hojasActualizadas = [...(detalleAnexo.hojas || []), hojaNueva];
      } else {
        hojasActualizadas = (detalleAnexo.hojas || []).map((h) =>
          h._id === hojaObjetivo._id ? { ...h, filas: ordenarFilasPorNivel([...(h.filas || []), ...filasNuevas]) } : h
        );
      }

      const res = await VacantesService.actualizarAnuenciaAnexo(anexoSeleccionado.id, { hojas: hojasActualizadas });
      if (!res.ok) throw new Error("No se pudo guardar el Anexo 2 con las plazas nuevas.");

      setResultado({ agregadas: filasNuevas.length, omitidas: yaEnAnuencia.length, errores: codigosConError });
      toast.success(`${filasNuevas.length} ${filasNuevas.length === 1 ? "plaza agregada" : "plazas agregadas"} a "${anexoSeleccionado.nombre_archivo}".`);
      onAgregado?.();
    } catch (err) {
      toast.error(err.message || "No se pudo completar la operación.");
    } finally {
      setAgregando(false);
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
                {paso === "hoja" && !resultado && (
                  <button
                    onClick={handleVolver}
                    className="p-2 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Elegir otro Anexo 2"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
                  <FilePlus2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Agregar a Anexo 2</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                    {paso === "anexo"
                      ? `${plazasValidas.length} ${plazasValidas.length === 1 ? "plaza seleccionada" : "plazas seleccionadas"} · elige el Anexo 2 destino`
                      : `A cuál hoja de "${anexoSeleccionado?.nombre_archivo}"`}
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

            {yaEnAnuencia.length > 0 && !resultado && (
              <div className="mx-4 mt-4 shrink-0 flex items-start gap-2 rounded-xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/20 p-3">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90">
                  {yaEnAnuencia.length} {yaEnAnuencia.length === 1 ? "de las plazas seleccionadas ya está" : "de las plazas seleccionadas ya están"} en anuencia y no se {yaEnAnuencia.length === 1 ? "va a agregar" : "van a agregar"} de nuevo: {yaEnAnuencia.map((p) => p.codigo).join(", ")}.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {resultado ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <CheckCircle2 className="size-10 text-emerald-500" />
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {resultado.agregadas} {resultado.agregadas === 1 ? "plaza agregada" : "plazas agregadas"} a &quot;{anexoSeleccionado?.nombre_archivo}&quot;
                  </p>
                  {resultado.omitidas > 0 && (
                    <p className="text-xs text-slate-500">{resultado.omitidas} se omitieron por ya estar en anuencia.</p>
                  )}
                  {resultado.errores.length > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">No se pudieron resolver: {resultado.errores.join(", ")}.</p>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              ) : paso === "anexo" ? (
                <>
                  {!cargandoAnexos && !errorAnexos && anexos.length > 0 && (
                    <div className="pb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar por nombre del Anexo 2..."
                          className="w-full pl-9 pr-3 py-2.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {cargandoAnexos ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando Anexo 2 guardados...</p>
                    </div>
                  ) : errorAnexos ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <FileWarning className="size-8 text-amber-500" />
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{errorAnexos}</p>
                    </div>
                  ) : anexos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <FilePlus2 className="size-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-bold text-slate-500">Aún no se ha guardado ningún Anexo 2.</p>
                      <p className="text-xs text-slate-400">Guarda uno desde el sub-tab Anuencia primero.</p>
                    </div>
                  ) : anexosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <Search className="size-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-bold text-slate-500">Sin resultados para &quot;{busqueda.trim()}&quot;.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {anexosFiltrados.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleElegirAnexo(a)}
                          disabled={cargandoDetalle}
                          className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
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
                          </div>
                          {cargandoDetalle && anexoSeleccionado?.id === a.id ? (
                            <Loader2 className="size-4 animate-spin text-[#621f32] dark:text-[#bc955c] shrink-0" />
                          ) : (
                            <FolderOpen className="size-4 text-slate-300 dark:text-slate-700 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  {(detalleAnexo?.hojas || []).map((h) => (
                    <button
                      key={h._id}
                      onClick={() => handleConfirmarHoja(h)}
                      disabled={agregando || disponibles.length === 0}
                      className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{h.nombre}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{h.unidad_administrativa || "—"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{(h.filas || []).length} {(h.filas || []).length === 1 ? "plaza" : "plazas"} actualmente</p>
                      </div>
                      {agregando ? <Loader2 className="size-4 animate-spin text-[#621f32] dark:text-[#bc955c] shrink-0" /> : null}
                    </button>
                  ))}

                  <div className="flex items-center gap-2 p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Plus className="size-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={nombreHojaNueva}
                      onChange={(e) => setNombreHojaNueva(e.target.value)}
                      placeholder="Nombre de una hoja nueva..."
                      maxLength={31}
                      className="flex-1 min-w-0 text-[12px] font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none"
                    />
                    <button
                      onClick={() => handleConfirmarHoja("__nueva__")}
                      disabled={agregando || disponibles.length === 0 || !nombreHojaNueva.trim()}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {agregando ? <Loader2 className="size-3.5 animate-spin" /> : "Crear y agregar"}
                    </button>
                  </div>
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
