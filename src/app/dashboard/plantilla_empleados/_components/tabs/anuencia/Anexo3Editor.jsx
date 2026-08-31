"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
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

// Prefijo de las zonas de soltar "entre dos hojas" que crean una hoja nueva
// — nunca coincide con una `clave` real de grupo ni con un código de plaza.
const PREFIJO_GAP = "__gap__";
const gapId = (claveAnterior, claveSiguiente) => `${PREFIJO_GAP}::${claveAnterior || ""}::${claveSiguiente || ""}`;

const nuevoIdReasignacion = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Posición de orden de una `clave` de grupo: el prefijo numérico antes de
// "||" para una hoja natural del Anexo 2 ("3||2026-07-01" -> 3), o la
// posición que se le incrustó al crearla para una hoja nueva
// ("nueva:1.5:<uuid>||2026-07-01" -> 1.5) — así una hoja nueva creada entre
// dos hojas mantiene ese lugar en las próximas veces que se recalcule,
// porque la posición viaja dentro de `reasignaciones` (ver handleDragEnd).
// `null` si no se puede determinar (no debería pasar salvo datos corruptos).
const posicionDeClave = (clave) => {
  if (!clave) return null;
  const prefijo = String(clave).split("||")[0];
  if (/^-?\d+$/.test(prefijo)) return Number(prefijo);
  const coincide = /^nueva:(-?[\d.]+):/.exec(prefijo);
  return coincide ? Number(coincide[1]) : null;
};

/** Zona angosta para soltar una plaza ENTRE dos hojas (o antes de la
 * primera / después de la última) — crea una hoja nueva justo ahí, con la
 * misma fecha de alta solicitada de la plaza que se soltó. Sólo se muestra
 * mientras hay un arrastre en curso; se ensancha al pasar por encima. */
function ZonaGapNuevaHoja({ claveAnterior, claveSiguiente, visible }) {
  const { setNodeRef, isOver } = useDroppable({ id: gapId(claveAnterior, claveSiguiente) });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed overflow-hidden transition-all duration-150 ${
        isOver
          ? "h-11 border-[#621f32] dark:border-[#bc955c] bg-[#621f32]/10 dark:bg-[#bc955c]/10"
          : "h-2.5 border-slate-200 dark:border-slate-800"
      }`}
    >
      {isOver && (
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#621f32] dark:text-[#bc955c]">
          <Plus className="size-3" />
          Agregar una hoja aquí
        </span>
      )}
    </div>
  );
}

/** Fila arrastrable de UNA plaza dentro de una hoja del Anexo 3. */
function FilaPlazaArrastrable({ plaza, onMenuContextual }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plaza.codigo,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenuContextual(e, plaza);
      }}
      className="border-b border-slate-50 dark:border-slate-800/50 bg-white dark:bg-slate-950"
    >
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

/**
 * Tarjeta completa de UNA hoja del Anexo 3 — arrastrable como bloque entero
 * (agarradera propia, separada del botón de colapsar) para reordenar en qué
 * lugar de la lista aparece, sin tocar qué plazas trae ni su identidad
 * (nombre/UA siguen viniendo de `g`, ver AnuenciaAnexo3View). El id de este
 * `useSortable` lleva el prefijo "hoja:" para no chocar con el id que
 * `CuerpoHojaDroppable` ya usa para la MISMA `clave` (arrastrar una plaza
 * hasta el cuerpo de la tabla).
 */
function TarjetaHoja({ g, detallePlazas, colapsada, seleccionada, onToggleColapso, onAplicarOverride, onMenuContextual, registrarRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `hoja:${g.clave}`,
    data: { type: "hoja", clave: g.clave },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registrarRef(el);
      }}
      style={style}
      className={`rounded-2xl border overflow-hidden scroll-mt-4 transition-colors ${
        seleccionada
          ? "border-[#621f32] dark:border-[#bc955c] ring-2 ring-[#621f32]/30 dark:ring-[#bc955c]/30"
          : "border-slate-200/70 dark:border-slate-800/70"
      } bg-white dark:bg-slate-950`}
    >
      <div className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Arrastrar para reordenar esta hoja"
          className="cursor-grab active:cursor-grabbing p-1.5 -m-1.5 rounded-lg text-slate-300 dark:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 touch-none shrink-0"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleColapso}
          className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
        >
          <ChevronDown className={`size-4 text-slate-400 shrink-0 transition-transform ${colapsada ? "-rotate-90" : ""}`} />
          <span className="text-[12px] font-black text-slate-800 dark:text-slate-100 truncate">{g.nombre_hoja}</span>
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
            {fmtFecha(g.fecha_inicio)} — {fmtFecha(g.fecha_fin)}
          </span>
        </button>
      </div>

      {!colapsada && (
        <>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 border-b flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[220px] flex-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre de la hoja</label>
              <input
                type="text"
                value={g.nombre_hoja}
                maxLength={31}
                onChange={(e) => onAplicarOverride(g.clave, "nombre_hoja", e.target.value)}
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
                  onChange={(e) => onAplicarOverride(g.clave, "fecha_fin", e.target.value)}
                  className="px-2.5 py-1.5 text-[12px] font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                />
                {g.fecha_fin !== finDeAnio(g.fecha_inicio) && (
                  <button
                    onClick={() => onAplicarOverride(g.clave, "fecha_fin", finDeAnio(g.fecha_inicio))}
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
                      <FilaPlazaArrastrable
                        key={p.codigo}
                        plaza={p}
                        onMenuContextual={(evento, plaza) => onMenuContextual(evento, plaza, g)}
                      />
                    ))}
                  </CuerpoHojaDroppable>
                </SortableContext>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total de plazas en esta hoja</p>
                <p className="text-[13px] font-black text-slate-700 dark:text-slate-200">{g.total_plazas}</p>
              </div>
              {g.valuacion && (
                <div className="flex flex-wrap items-center justify-end gap-4">
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
        </>
      )}
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
 * Vive en su propia pestaña del navegador (ver Anexo3TabContent.jsx) — con
 * hasta ~30 hojas más el drag-and-drop, el resumen lateral y el historial de
 * versiones ya no cabe cómodo compartiendo pestaña con el Anexo 2, y así el
 * Anexo 2 puede quedar bloqueado mientras este editor sigue abierto (evita
 * que la captura en memoria que se le pasó se desactualice a medias).
 */
export default function Anexo3Editor({ hojas, nombreArchivo, anexoIdActual, onCerrar }) {
  const { toast } = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [reasignaciones, setReasignaciones] = useState({});
  const [generando, setGenerando] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);

  // Colapso por hoja — arrancan TODAS colapsadas en cuanto llega un grupo
  // nuevo (ver más abajo); el usuario expande la que quiera ver completa.
  const [colapsadas, setColapsadas] = useState({});

  // Copia editable de `grupos` sólo para pintar el drag-and-drop en vivo —
  // se resincroniza con la verdad del servidor cada vez que `grupos` cambia
  // (después de cada `cargar()`), nunca se calcula nada de dinero aquí.
  const [gruposVista, setGruposVista] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Orden visual de las hojas — copia local de las claves en el orden en que
  // se dibujan, para poder previsualizar el reacomodo mientras se arrastra
  // una hoja completa (igual que `gruposVista` hace para las plazas). Se
  // resincroniza con el orden real cada vez que llegan `grupos` nuevos.
  const [ordenVisualHojas, setOrdenVisualHojas] = useState([]);
  const [activeHojaClave, setActiveHojaClave] = useState(null);

  // Versión guardada que se está editando (si se abrió una del historial).
  const [versionIdActual, setVersionIdActual] = useState(null);
  const [versionNombre, setVersionNombre] = useState("");
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [isVersionesOpen, setIsVersionesOpen] = useState(false);

  // Para el "ir a esta hoja" del resumen lateral: la referencia al DOM de
  // cada hoja (para el scroll) y cuál está seleccionada (para iluminarla en
  // ambas columnas).
  const hojaRefs = useRef({});
  const [hojaSeleccionada, setHojaSeleccionada] = useState(null);

  // Menú contextual (clic derecho sobre una plaza) para la segunda forma de
  // crear una hoja nueva a partir de una plaza, sin arrastrar.
  const [menuContextual, setMenuContextual] = useState(null); // { x, y, codigo, claveOrigen }

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
    cargar({}, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGruposVista(
      grupos.map((g) => ({ clave: g.clave, fecha_inicio: g.fecha_inicio, detalle_plazas: g.detalle_plazas || [] }))
    );
    setOrdenVisualHojas(grupos.map((g) => g.clave));
    // Toda hoja nueva (incluida una creada al arrastrar fuera) arranca
    // colapsada; una hoja que ya no aparece (se quedó sin plazas) se olvida.
    setColapsadas((prev) => {
      let cambio = false;
      const siguiente = { ...prev };
      for (const g of grupos) {
        if (!(g.clave in siguiente)) {
          siguiente[g.clave] = true;
          cambio = true;
        }
      }
      for (const clave of Object.keys(siguiente)) {
        if (!grupos.some((g) => g.clave === clave)) {
          delete siguiente[clave];
          cambio = true;
        }
      }
      return cambio ? siguiente : prev;
    });
  }, [grupos]);

  const toggleColapso = (clave) => setColapsadas((prev) => ({ ...prev, [clave]: !prev[clave] }));
  const irAHoja = (clave) => {
    setHojaSeleccionada(clave);
    hojaRefs.current[clave]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const expandirTodo = () => setColapsadas((prev) => {
    const siguiente = { ...prev };
    for (const g of grupos) siguiente[g.clave] = false;
    return siguiente;
  });
  const colapsarTodo = () => setColapsadas((prev) => {
    const siguiente = { ...prev };
    for (const g of grupos) siguiente[g.clave] = true;
    return siguiente;
  });

  // --- Resumen del Anexo 2 (columna lateral) --------------------------------
  const resumenAnexo2 = useMemo(() => {
    let total = 0;
    let permanentes = 0;
    let eventuales = 0;
    for (const hoja of hojas || []) {
      for (const fila of hoja.filas || []) {
        if (!String(fila.codigo || "").trim()) continue;
        const cantidad = Math.max(1, parseInt(fila.numero_plazas, 10) || 1);
        total += cantidad;
        const tipo = String(fila.tipo_contratacion || "").trim().toLowerCase();
        if (tipo.startsWith("perman")) permanentes += cantidad;
        else if (tipo.startsWith("event")) eventuales += cantidad;
      }
    }
    return { total, permanentes, eventuales };
  }, [hojas]);

  /** Cambia un campo de un grupo y recalcula: el monto depende del período. */
  const aplicarOverride = (clave, campo, valor) => {
    const siguientes = { ...overrides, [clave]: { ...(overrides[clave] || {}), [campo]: valor } };
    setOverrides(siguientes);
    // El nombre de hoja no afecta el cálculo; la fecha sí.
    if (campo === "fecha_fin") cargar(siguientes, reasignaciones);
    else setGrupos((prev) => prev.map((g) => (g.clave === clave ? { ...g, nombre_hoja: valor } : g)));
  };

  // Grupos indexados por clave, y esa misma lista en el orden VISUAL actual
  // (`ordenVisualHojas`, que se reordena en vivo mientras se arrastra una
  // hoja) — así el reacomodo se ve al instante sin esperar la respuesta del
  // servidor, igual que `gruposVista` para las plazas.
  const gruposPorClave = useMemo(() => new Map(grupos.map((g) => [g.clave, g])), [grupos]);
  const gruposEnOrdenVisual = useMemo(
    () => ordenVisualHojas.map((clave) => gruposPorClave.get(clave)).filter(Boolean),
    [ordenVisualHojas, gruposPorClave]
  );

  // Orden efectivo de una hoja para calcular dónde cae un reacomodo nuevo: el
  // override manual si ya se arrastró antes, si no la posición natural (ver
  // `posicionDeClave`) — mismo criterio que usa el backend para ordenar.
  const ordenEfectivo = useCallback(
    (clave) => {
      const ov = overrides[clave];
      if (ov && typeof ov.orden === "number") return ov.orden;
      return posicionDeClave(clave) ?? 0;
    },
    [overrides]
  );

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
  const activeHoja = useMemo(
    () => (activeHojaClave ? gruposPorClave.get(activeHojaClave) : null),
    [activeHojaClave, gruposPorClave]
  );

  const handleDragStart = (event) => {
    if (event.active.data.current?.type === "hoja") {
      setActiveHojaClave(event.active.data.current.clave);
    } else {
      setActiveId(event.active.id);
    }
  };
  const handleDragCancel = () => {
    setActiveId(null);
    setActiveHojaClave(null);
    // Si se canceló a medio arrastrar una hoja, el orden visual pudo haberse
    // adelantado (ver handleDragOverHoja) — se regresa al orden real.
    setOrdenVisualHojas(grupos.map((g) => g.clave));
  };

  // --- Arrastrar una hoja COMPLETA para reordenarla -------------------------
  const handleDragOverHoja = (event) => {
    const { active, over } = event;
    const claveActiva = active.data.current?.clave;
    const claveOver = over?.data?.current?.type === "hoja" ? over.data.current.clave : null;
    if (!claveActiva || !claveOver || claveOver === claveActiva) return;
    setOrdenVisualHojas((prev) => {
      const oldIndex = prev.indexOf(claveActiva);
      const newIndex = prev.indexOf(claveOver);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleDragEndHoja = (event) => {
    setActiveHojaClave(null);
    const claveActiva = event.active.data.current?.clave;
    if (!claveActiva) return;
    const idx = ordenVisualHojas.indexOf(claveActiva);
    if (idx === -1) return;
    const claveAnterior = ordenVisualHojas[idx - 1] || null;
    const claveSiguiente = ordenVisualHojas[idx + 1] || null;
    const posAnterior = claveAnterior ? ordenEfectivo(claveAnterior) : null;
    const posSiguiente = claveSiguiente ? ordenEfectivo(claveSiguiente) : null;

    let nuevoOrden;
    if (posAnterior != null && posSiguiente != null) nuevoOrden = (posAnterior + posSiguiente) / 2;
    else if (posAnterior != null) nuevoOrden = posAnterior + 1;
    else if (posSiguiente != null) nuevoOrden = posSiguiente - 1;
    else nuevoOrden = 0;

    if (nuevoOrden === ordenEfectivo(claveActiva)) return; // no se movió de verdad

    const siguientesOverrides = { ...overrides, [claveActiva]: { ...(overrides[claveActiva] || {}), orden: nuevoOrden } };
    setOverrides(siguientesOverrides);
    cargar(siguientesOverrides, reasignaciones);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (active.data.current?.type === "hoja") return handleDragOverHoja(event);
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

  // Crea una hoja nueva a partir de UNA plaza (nombre y UA en blanco, el
  // usuario los pone a mano) con la misma fecha de alta de esa plaza, en la
  // posición entre `claveAnterior` y `claveSiguiente` (cualquiera puede ser
  // `null` si es antes de la primera hoja o después de la última). Usan esto
  // tanto soltar en un hueco entre hojas como el menú contextual.
  const crearHojaNuevaEnPosicion = useCallback((codigo, grupoOrigen, claveAnterior, claveSiguiente) => {
    const posAnterior = posicionDeClave(claveAnterior);
    const posSiguiente = posicionDeClave(claveSiguiente);
    let posicion;
    if (posAnterior != null && posSiguiente != null) posicion = (posAnterior + posSiguiente) / 2;
    else if (posAnterior != null) posicion = posAnterior + 1;
    else if (posSiguiente != null) posicion = posSiguiente - 1;
    else posicion = 0;

    const claveNueva = `nueva:${posicion}:${nuevoIdReasignacion()}||${grupoOrigen.fecha_inicio}`;
    const siguientesReasignaciones = { ...reasignaciones, [codigo]: claveNueva };
    setReasignaciones(siguientesReasignaciones);
    cargar(overrides, siguientesReasignaciones);
  }, [reasignaciones, overrides, cargar]);

  const handleDragEnd = (event) => {
    if (event.active.data.current?.type === "hoja") return handleDragEndHoja(event);
    setActiveId(null);
    const { active, over } = event;
    const codigo = active.id;
    const grupoOrigen = grupos.find((g) => (g.detalle_plazas || []).some((p) => p.codigo === codigo));
    if (!grupoOrigen) return;

    // Se soltó en el hueco entre dos hojas (o antes de la primera / después
    // de la última): crea una hoja nueva justo ahí.
    const overId = String(over?.id || "");
    if (overId.startsWith(`${PREFIJO_GAP}::`)) {
      const [, claveAnterior, claveSiguiente] = overId.split("::");
      crearHojaNuevaEnPosicion(codigo, grupoOrigen, claveAnterior || null, claveSiguiente || null);
      return;
    }

    const claveFinal = claveDeCodigo(codigo);
    if (!claveFinal || claveFinal === grupoOrigen.clave) return; // no cambió de hoja
    const siguientesReasignaciones = { ...reasignaciones, [codigo]: claveFinal };
    setReasignaciones(siguientesReasignaciones);
    cargar(overrides, siguientesReasignaciones);
  };

  // --- Menú contextual: "Generar nueva hoja a partir de esta plaza" --------
  const abrirMenuContextual = (evento, plaza, grupoOrigen) => {
    setMenuContextual({ x: evento.clientX, y: evento.clientY, codigo: plaza.codigo, claveOrigen: grupoOrigen.clave });
  };
  const cerrarMenuContextual = () => setMenuContextual(null);

  useEffect(() => {
    if (!menuContextual) return undefined;
    const alPresionarTecla = (e) => { if (e.key === "Escape") cerrarMenuContextual(); };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [menuContextual]);

  const handleGenerarHojaDesdeMenu = () => {
    if (!menuContextual) return;
    const { codigo, claveOrigen } = menuContextual;
    const grupoOrigen = grupos.find((g) => g.clave === claveOrigen);
    cerrarMenuContextual();
    if (!grupoOrigen) return;
    const indice = grupos.findIndex((g) => g.clave === claveOrigen);
    const claveSiguiente = grupos[indice + 1]?.clave || null;
    crearHojaNuevaEnPosicion(codigo, grupoOrigen, claveOrigen, claveSiguiente);
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

  return (
    <div className="h-screen w-full bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] text-white rounded-2xl shadow-md shrink-0">
            <FileSpreadsheet className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Generar Anexo 3 (FUMP)</h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
              Una hoja por Unidad Administrativa y período · arrastra una plaza a otra hoja del MISMO período para moverla, o arrastra el ícono ⠿ de una hoja para reordenarla
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
            onClick={onCerrar}
            title="Cerrar esta pestaña y volver a poder editar el Anexo 2"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl border border-slate-200/60 dark:border-slate-800/80 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 overflow-y-auto custom-scrollbar p-4 space-y-5">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Resumen del Anexo 2</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Total de plazas</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{resumenAnexo2.total}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Permanentes</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{resumenAnexo2.permanentes}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Eventuales</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{resumenAnexo2.eventuales}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Hojas a generar{grupos.length > 0 && ` (${grupos.length})`}
            </p>
            <div className="space-y-1">
              {grupos.map((g) => (
                <button
                  key={g.clave}
                  type="button"
                  onClick={() => irAHoja(g.clave)}
                  title={g.nombre_hoja}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                    hojaSeleccionada === g.clave
                      ? "bg-[#621f32]/10 dark:bg-[#bc955c]/10 border-[#621f32]/50 dark:border-[#bc955c]/50"
                      : "border-transparent hover:bg-white dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{g.nombre_hoja}</span>
                  <span className="text-[10px] font-black text-slate-400 shrink-0">{g.total_plazas}</span>
                </button>
              ))}
              {grupos.length === 0 && (
                <p className="text-[11px] text-slate-400 italic">
                  {cargando ? "Calculando..." : "Sin hojas todavía."}
                </p>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
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
                <>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={expandirTodo}
                      disabled={cargando}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      Expandir todo
                    </button>
                    <button
                      type="button"
                      onClick={colapsarTodo}
                      disabled={cargando}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      Colapsar todo
                    </button>
                  </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext items={gruposEnOrdenVisual.map((g) => `hoja:${g.clave}`)} strategy={verticalListSortingStrategy}>
                    {gruposEnOrdenVisual.map((g, indice) => {
                      const vista = gruposVista.find((v) => v.clave === g.clave);
                      const detallePlazas = vista?.detalle_plazas || g.detalle_plazas || [];
                      const colapsada = colapsadas[g.clave] ?? true;
                      const claveAnterior = gruposEnOrdenVisual[indice - 1]?.clave || null;
                      return (
                        <Fragment key={g.clave}>
                          <ZonaGapNuevaHoja claveAnterior={claveAnterior} claveSiguiente={g.clave} visible={Boolean(activeId)} />
                          <TarjetaHoja
                            g={g}
                            detallePlazas={detallePlazas}
                            colapsada={colapsada}
                            seleccionada={hojaSeleccionada === g.clave}
                            onToggleColapso={() => toggleColapso(g.clave)}
                            onAplicarOverride={aplicarOverride}
                            onMenuContextual={abrirMenuContextual}
                            registrarRef={(el) => { hojaRefs.current[g.clave] = el; }}
                          />
                        </Fragment>
                      );
                    })}
                  </SortableContext>

                  <ZonaGapNuevaHoja
                    claveAnterior={gruposEnOrdenVisual[gruposEnOrdenVisual.length - 1]?.clave || null}
                    claveSiguiente={null}
                    visible={Boolean(activeId)}
                  />

                  <DragOverlay>
                    {activePlaza && (
                      <div className="rounded-xl border border-[#621f32]/40 dark:border-[#bc955c]/40 bg-white dark:bg-slate-900 shadow-2xl px-3 py-2 flex items-center gap-3 text-[11px]">
                        <GripVertical className="size-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{activePlaza.codigo}</span>
                        <span className="text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{activePlaza.denominacion}</span>
                      </div>
                    )}
                    {activeHoja && (
                      <div className="rounded-xl border border-[#621f32]/40 dark:border-[#bc955c]/40 bg-white dark:bg-slate-900 shadow-2xl px-4 py-3 flex items-center gap-3 text-[11px] opacity-95">
                        <GripVertical className="size-4 text-slate-400 shrink-0" />
                        <span className="font-black text-slate-800 dark:text-slate-100">{activeHoja.nombre_hoja}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{activeHoja.total_plazas} plazas</span>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
                </>
              )}
            </>
          )}
        </div>
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

      <Anexo3VersionesModal
        open={isVersionesOpen}
        onClose={() => setIsVersionesOpen(false)}
        anexoId={anexoIdActual}
        onCargar={handleCargarVersion}
      />

      {menuContextual && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={cerrarMenuContextual} onContextMenu={(e) => { e.preventDefault(); cerrarMenuContextual(); }} />
          <div
            className="fixed z-[61] min-w-[260px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl py-1"
            style={{ top: menuContextual.y, left: menuContextual.x }}
          >
            <button
              type="button"
              onClick={handleGenerarHojaDesdeMenu}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <Plus className="size-3.5 shrink-0" />
              <span>Generar nueva hoja a partir de esta plaza</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
