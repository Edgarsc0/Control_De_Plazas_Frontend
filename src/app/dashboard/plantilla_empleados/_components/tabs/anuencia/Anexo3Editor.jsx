"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertTriangle,
  Layers,
  RotateCcw,
  ChevronDown,
  GripVertical,
  Save,
  History,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { VacantesService } from "@/services/vacantes.service";
import { exportarAnexo3 } from "./anexo3Excel";
import Anexo3VersionesModal from "./Anexo3VersionesModal";

const fmtMoneda = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

// Igual que en el Anexo 2: 'YYYY-MM-DD' se formatea en UTC para que el huso
// del navegador no recorra la fecha un día.
const FMT_FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
});
const fmtFecha = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y) return "—";
  return FMT_FECHA.format(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
};

const finDeAnio = (iso) => `${String(iso || "").slice(0, 4)}-12-31`;

const CABECERAS_PLAZA = ["Código", "U.R.", "Nivel", "Zona", "Código presupuestal"];
const CABECERAS_PLAZA_FIN = ["Categoría", "Plazas", "Sueldo"];

// Id fijo de la zona de soltar para crear una hoja nueva — nunca coincide
// con una `clave` real de grupo (esas siempre son "<algo>||<fecha>").
const ZONA_NUEVA_HOJA_ID = "__nueva_hoja__";

const nuevoIdReasignacion = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Fila arrastrable de UNA plaza dentro de una hoja del Anexo 3. */
function FilaPlazaArrastrable({ plaza }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plaza.codigo,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-slate-50 dark:border-slate-800/50 bg-white dark:bg-slate-950">
      <td className="w-7 px-1 py-1.5 text-slate-300 dark:text-slate-700">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Arrastrar a otra hoja del mismo período"
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 touch-none"
        >
          <GripVertical className="size-3.5" />
        </button>
      </td>
      <td className="px-2 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{plaza.codigo}</td>
      <td className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{plaza.unidad_responsable}</td>
      <td className="px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">{plaza.nivel}</td>
      <td className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{plaza.zona}</td>
      <td className="px-2 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300">{plaza.codigo_presupuestal}</td>
      <td
        title="Sólo informativa — no se incluye en el .xlsx del Anexo 3"
        className="px-2 py-1.5 text-[11px] text-blue-800 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/20 max-w-[180px] truncate"
      >
        {plaza.unidad_administrativa || "—"}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={plaza.denominacion}>
        {plaza.denominacion}
      </td>
      <td className="px-2 py-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200 text-center">{plaza.cantidad}</td>
      <td className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 text-right whitespace-nowrap">{fmtMoneda(plaza.sueldo)}</td>
    </tr>
  );
}

/** Cuerpo de la tabla de una hoja — a la vez zona donde SOLTAR (droppable),
 * incluso cuando queda vacía (todas sus plazas se arrastraron a otra hoja). */
function CuerpoHojaDroppable({ clave, children }) {
  const { setNodeRef } = useDroppable({ id: clave });
  return (
    <tbody ref={setNodeRef} className="min-h-[2.5rem]">
      {children}
    </tbody>
  );
}

/** Zona para soltar una plaza FUERA de cualquier hoja — crea una hoja nueva
 * con esa plaza, con la misma fecha de alta solicitada. Sólo se muestra
 * mientras hay un arrastre en curso. */
function ZonaNuevaHoja({ visible }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONA_NUEVA_HOJA_ID });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-5 text-[11px] font-black uppercase tracking-wider transition-colors ${
        isOver
          ? "border-[#621f32] dark:border-[#bc955c] bg-[#621f32]/10 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c]"
          : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
      }`}
    >
      <Plus className="size-3.5" />
      <span>Agregar una hoja</span>
    </div>
  );
}

/**
 * Editor del Anexo 3 antes de descargarlo — a diferencia de una previa de
 * sólo lectura, aquí se puede corregir a mano el acomodo de plazas entre
 * hojas (arrastrando filas, sólo entre hojas del MISMO período/fecha de
 * alta — mezclar períodos rompería la valuación) y guardar el resultado
 * como una versión reabrible más tarde.
 *
 * Es pantalla completa (no un diálogo chico) porque con hasta ~30 hojas más
 * el drag-and-drop y el historial de versiones ya no cabe cómodo en un
 * modal centrado — pero sigue siendo un componente hijo montado desde
 * AnuenciaTab.jsx (no una ruta propia): el Anexo 3 se arma con las `hojas`
 * en memoria del Anexo 2, que pueden no estar guardadas todavía.
 */
export default function Anexo3Editor({ open, onClose, hojas, nombreArchivo, anexoIdActual }) {
  const { toast } = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [reasignaciones, setReasignaciones] = useState({});
  const [generando, setGenerando] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);

  // Copia editable de `grupos` sólo para pintar el drag-and-drop en vivo —
  // se resincroniza con la verdad del servidor cada vez que `grupos` cambia
  // (después de cada `cargar()`), nunca se calcula nada de dinero aquí.
  const [gruposVista, setGruposVista] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Versión guardada que se está editando (si se abrió una del historial).
  const [versionIdActual, setVersionIdActual] = useState(null);
  const [versionNombre, setVersionNombre] = useState("");
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [isVersionesOpen, setIsVersionesOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const cargar = useCallback(async (ovr, reas) => {
    setCargando(true);
    setError(null);
    try {
      const res = await VacantesService.prepararAnexo3(hojas, ovr, reas);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo preparar el Anexo 3.");
      setGrupos(data.grupos || []);
      setAvisos(data.avisos || []);
    } catch (err) {
      setError(err.message || "Error al preparar el Anexo 3.");
      setGrupos([]);
      setAvisos([]);
    } finally {
      setCargando(false);
    }
  }, [hojas]);

  useEffect(() => {
    if (!open) return;
    setOverrides({});
    setReasignaciones({});
    setAvisosAbiertos(false);
    setVersionIdActual(null);
    setVersionNombre("");
    cargar({}, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cargar]);

  useEffect(() => {
    setGruposVista(
      grupos.map((g) => ({ clave: g.clave, fecha_inicio: g.fecha_inicio, detalle_plazas: g.detalle_plazas || [] }))
    );
  }, [grupos]);

  /** Cambia un campo de un grupo y recalcula: el monto depende del período. */
  const aplicarOverride = (clave, campo, valor) => {
    const siguientes = { ...overrides, [clave]: { ...(overrides[clave] || {}), [campo]: valor } };
    setOverrides(siguientes);
    // El nombre de hoja no afecta el cálculo; la fecha sí.
    if (campo === "fecha_fin") cargar(siguientes, reasignaciones);
    else setGrupos((prev) => prev.map((g) => (g.clave === clave ? { ...g, nombre_hoja: valor } : g)));
  };

  // --- Drag-and-drop entre hojas del mismo período -------------------------
  const claveDeCodigo = useCallback(
    (codigo) => gruposVista.find((g) => g.detalle_plazas.some((p) => p.codigo === codigo))?.clave,
    [gruposVista]
  );
  const fechaDeClave = useCallback(
    (clave) => gruposVista.find((g) => g.clave === clave)?.fecha_inicio,
    [gruposVista]
  );
  const activePlaza = useMemo(() => {
    for (const g of gruposVista) {
      const p = g.detalle_plazas.find((x) => x.codigo === activeId);
      if (p) return p;
    }
    return null;
  }, [activeId, gruposVista]);

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragCancel = () => setActiveId(null);

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    const codigoActivo = active.id;
    const overId = over.id;
    const claveOrigen = claveDeCodigo(codigoActivo);
    // `overId` puede ser el código de otra plaza, o directamente la clave de
    // la hoja (al soltar sobre espacio vacío de una hoja sin plazas).
    const claveDestino = gruposVista.some((g) => g.clave === overId) ? overId : claveDeCodigo(overId);
    if (!claveDestino || claveDestino === claveOrigen) return;
    // Nunca se mezclan períodos — si no coincide la fecha, no se mueve nada
    // (la plaza se queda visualmente donde estaba, no "engancha").
    if (fechaDeClave(claveDestino) !== fechaDeClave(claveOrigen)) return;

    setGruposVista((prev) => {
      const idxOrigen = prev.findIndex((g) => g.clave === claveOrigen);
      const idxDestino = prev.findIndex((g) => g.clave === claveDestino);
      if (idxOrigen === -1 || idxDestino === -1) return prev;
      const origen = prev[idxOrigen];
      const destino = prev[idxDestino];
      const idxPlaza = origen.detalle_plazas.findIndex((p) => p.codigo === codigoActivo);
      if (idxPlaza === -1) return prev;
      const plaza = origen.detalle_plazas[idxPlaza];

      let posicion = destino.detalle_plazas.findIndex((p) => p.codigo === overId);
      if (posicion === -1) posicion = destino.detalle_plazas.length;
      const nuevoDestino = [...destino.detalle_plazas];
      nuevoDestino.splice(posicion, 0, plaza);

      const siguiente = [...prev];
      siguiente[idxOrigen] = { ...origen, detalle_plazas: origen.detalle_plazas.filter((p) => p.codigo !== codigoActivo) };
      siguiente[idxDestino] = { ...destino, detalle_plazas: nuevoDestino };
      return siguiente;
    });
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    const { active, over } = event;
    const codigo = active.id;
    const grupoOrigen = grupos.find((g) => (g.detalle_plazas || []).some((p) => p.codigo === codigo));
    if (!grupoOrigen) return;

    // Se soltó fuera de cualquier hoja: crea una hoja nueva (nombre y UA en
    // blanco, el usuario los pone a mano) con la misma fecha de alta de la
    // plaza que se arrastró — cada suelta aquí es una hoja nueva distinta.
    if (over?.id === ZONA_NUEVA_HOJA_ID) {
      const claveNueva = `nueva:${nuevoIdReasignacion()}||${grupoOrigen.fecha_inicio}`;
      const siguientesReasignaciones = { ...reasignaciones, [codigo]: claveNueva };
      setReasignaciones(siguientesReasignaciones);
      cargar(overrides, siguientesReasignaciones);
      return;
    }

    const claveFinal = claveDeCodigo(codigo);
    if (!claveFinal || claveFinal === grupoOrigen.clave) return; // no cambió de hoja
    const siguientesReasignaciones = { ...reasignaciones, [codigo]: claveFinal };
    setReasignaciones(siguientesReasignaciones);
    cargar(overrides, siguientesReasignaciones);
  };

  // --- Descarga y versiones --------------------------------------------------
  const handleDescargar = async () => {
    setGenerando(true);
    try {
      await exportarAnexo3(grupos, `Anexo 3 - ${nombreArchivo || "FUMP"}`);
      toast.success(`Anexo 3 generado con ${grupos.length} ${grupos.length === 1 ? "hoja" : "hojas"}.`);
    } catch (err) {
      console.error("Error al generar el Anexo 3:", err);
      toast.error("No se pudo generar el archivo del Anexo 3.");
    } finally {
      setGenerando(false);
    }
  };

  const handleGuardarVersion = async (comoNueva) => {
    if (!anexoIdActual) {
      toast.error("Guarda el Anexo 2 primero — las versiones de su Anexo 3 se guardan ligadas a él.");
      return;
    }
    const nombre = versionNombre.trim();
    if (!nombre) {
      toast.error("Ponle un nombre a la versión antes de guardarla.");
      return;
    }
    setGuardandoVersion(true);
    try {
      if (versionIdActual && !comoNueva) {
        const res = await VacantesService.actualizarAnexo3Version(versionIdActual, { nombre, overrides, reasignaciones, grupos });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.nombre?.[0] || data?.error || "No se pudo actualizar la versión.");
        toast.success("Versión actualizada.");
      } else {
        const res = await VacantesService.crearAnexo3Version({ anexo: anexoIdActual, nombre, overrides, reasignaciones, grupos });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.nombre?.[0] || data?.error || "No se pudo guardar la versión.");
        setVersionIdActual(data.id);
        toast.success("Versión guardada.");
      }
    } catch (err) {
      toast.error(err.message || "No se pudo guardar la versión.");
    } finally {
      setGuardandoVersion(false);
    }
  };

  const handleCargarVersion = (detalle) => {
    setVersionIdActual(detalle.id);
    setVersionNombre(detalle.nombre || "");
    setOverrides(detalle.overrides || {});
    setReasignaciones(detalle.reasignaciones || {});
    cargar(detalle.overrides || {}, detalle.reasignaciones || {});
    toast.success(`Versión "${detalle.nombre}" cargada — sigue ajustando o descárgala de nuevo.`);
  };

  const hayPeriodoInvalido = grupos.some((g) => g.periodo_invalido);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex flex-col"
          >
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between gap-4 shrink-0 flex-wrap">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Generar Anexo 3 (FUMP)</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                    Una hoja por Unidad Administrativa y período · arrastra una plaza a otra hoja del MISMO período para moverla
                    {versionIdActual && <span className="text-[#621f32] dark:text-[#bc955c]"> · editando versión &quot;{versionNombre}&quot;</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={versionNombre}
                  onChange={(e) => setVersionNombre(e.target.value)}
                  placeholder="Nombre de la versión..."
                  className="px-2.5 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors w-40"
                />
                <button
                  onClick={() => handleGuardarVersion(false)}
                  disabled={guardandoVersion || cargando}
                  title={versionIdActual ? "Actualizar esta versión" : "Guardar como versión nueva"}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {guardandoVersion ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>{versionIdActual ? "Guardar" : "Guardar versión"}</span>
                </button>
                {versionIdActual && (
                  <button
                    onClick={() => handleGuardarVersion(true)}
                    disabled={guardandoVersion || cargando}
                    title="Guardar como una versión nueva, sin tocar la actual"
                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    Guardar como nueva
                  </button>
                )}
                <button
                  onClick={() => setIsVersionesOpen(true)}
                  title="Ver versiones guardadas de este Anexo 3"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
                >
                  <History className="size-3.5" />
                  <span>Versiones</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 max-w-6xl w-full mx-auto">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agrupando y valuando plazas...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                  <AlertTriangle className="size-8 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
                </div>
              ) : (
                <>
                  {avisos.length > 0 && (
                    <div className="rounded-2xl border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAvisosAbiertos((v) => !v)}
                        className="w-full flex items-center gap-2 p-4 cursor-pointer"
                      >
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500 shrink-0" />
                        <p className="text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider flex-1 text-left">
                          {avisos.length} {avisos.length === 1 ? "plaza no se incluyó" : "plazas no se incluyeron"}
                        </p>
                        <ChevronDown
                          className={`size-4 text-amber-600 dark:text-amber-500 shrink-0 transition-transform ${avisosAbiertos ? "rotate-180" : ""}`}
                        />
                      </button>
                      {avisosAbiertos && (
                        <ul className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar px-4 pb-4">
                          {avisos.map((a, i) => (
                            <li key={i} className="text-[11px] text-amber-900/90 dark:text-amber-300/90">
                              <span className="font-black">{a.codigo || "—"}</span>
                              {a.codigo_presupuestal ? <span className="opacity-70"> ({a.codigo_presupuestal})</span> : null}
                              {" — "}{a.motivo}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {grupos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                      <Layers className="size-8 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-bold text-slate-500">No hay ninguna plaza que se pueda valuar.</p>
                      <p className="text-xs text-slate-400">Revisa los avisos de arriba.</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      {grupos.map((g) => {
                        const vista = gruposVista.find((v) => v.clave === g.clave);
                        const detallePlazas = vista?.detalle_plazas || g.detalle_plazas || [];
                        return (
                          <div key={g.clave} className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-950 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3">
                              <div className="flex flex-col gap-1 min-w-[220px] flex-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre de la hoja</label>
                                <input
                                  type="text"
                                  value={g.nombre_hoja}
                                  maxLength={31}
                                  onChange={(e) => aplicarOverride(g.clave, "nombre_hoja", e.target.value)}
                                  className="px-2.5 py-1.5 text-[12px] font-black text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Del (fecha de alta)</label>
                                <span className="px-2.5 py-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300">{fmtFecha(g.fecha_inicio)}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Al</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={g.fecha_fin}
                                    onChange={(e) => aplicarOverride(g.clave, "fecha_fin", e.target.value)}
                                    className="px-2.5 py-1.5 text-[12px] font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                                  />
                                  {g.fecha_fin !== finDeAnio(g.fecha_inicio) && (
                                    <button
                                      onClick={() => aplicarOverride(g.clave, "fecha_fin", finDeAnio(g.fecha_inicio))}
                                      title="Volver al 31 de diciembre"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {g.periodo_invalido && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Período</label>
                                  <span className="px-2.5 py-1.5 text-[12px] font-black text-red-600">Fechas inválidas</span>
                                </div>
                              )}
                            </div>

                            <div className="px-4 py-3">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate" title={g.unidad_administrativa}>
                                {g.unidad_administrativa}
                              </p>
                              <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800">
                                      <th className="w-7" />
                                      {CABECERAS_PLAZA.map((h) => (
                                        <th key={h} className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                      ))}
                                      <th
                                        title="Sólo informativa — no se incluye en el .xlsx del Anexo 3"
                                        className="px-2 py-1.5 text-[9px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap bg-blue-50 dark:bg-blue-950/40"
                                      >
                                        Unidad Administrativa
                                      </th>
                                      {CABECERAS_PLAZA_FIN.map((h) => (
                                        <th key={h} className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <SortableContext items={detallePlazas.map((p) => p.codigo)} strategy={verticalListSortingStrategy}>
                                    <CuerpoHojaDroppable clave={g.clave}>
                                      {detallePlazas.map((p) => (
                                        <FilaPlazaArrastrable key={p.codigo} plaza={p} />
                                      ))}
                                    </CuerpoHojaDroppable>
                                  </SortableContext>
                                </table>
                              </div>

                              {g.valuacion && (
                                <div className="mt-3 flex flex-wrap items-center justify-end gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                  {[
                                    ["Período colectivo", g.valuacion.total.periodo, true],
                                    ["Complemento", g.valuacion.total.complemento, false],
                                    ["Regularizable (12m)", g.valuacion.total.anual, false],
                                  ].map(([label, valor, destacado]) => (
                                    <div key={label} className="text-right">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                      <p className={`text-[13px] font-black ${destacado ? "text-[#621f32] dark:text-[#bc955c]" : "text-slate-600 dark:text-slate-300"}`}>
                                        {fmtMoneda(valor)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <ZonaNuevaHoja visible={Boolean(activeId)} />

                      <DragOverlay>
                        {activePlaza && (
                          <div className="rounded-xl border border-[#621f32]/40 dark:border-[#bc955c]/40 bg-white dark:bg-slate-900 shadow-2xl px-3 py-2 flex items-center gap-3 text-[11px]">
                            <GripVertical className="size-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{activePlaza.codigo}</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{activePlaza.denominacion}</span>
                          </div>
                        )}
                      </DragOverlay>
                    </DndContext>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between gap-3 shrink-0">
              <p className="text-[11px] font-bold text-slate-400">
                {grupos.length > 0 && `${grupos.length} ${grupos.length === 1 ? "hoja" : "hojas"} · ${grupos.reduce((t, g) => t + g.total_plazas, 0)} plazas`}
              </p>
              <button
                onClick={handleDescargar}
                disabled={generando || cargando || grupos.length === 0 || hayPeriodoInvalido}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {generando ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                <span>{generando ? "Generando..." : "Descargar Anexo 3"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Anexo3VersionesModal
        open={isVersionesOpen}
        onClose={() => setIsVersionesOpen(false)}
        anexoId={anexoIdActual}
        onCargar={handleCargarVersion}
      />
    </>,
    document.body
  );
}
