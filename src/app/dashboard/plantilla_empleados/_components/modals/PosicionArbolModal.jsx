"use client";

/**
 * PosicionArbolModal
 * ==================
 * Reemplaza al antiguo "Historial de Ocupantes" (lista vertical) al hacer
 * clic en la columna de posición: dibuja el TRONCO de esa plaza como un
 * canvas de nodos pannable/zoomable (arrastrar para mover, rueda para zoom)
 * — un círculo por periodo (creación, ocupación, vacancia, insubsistencia...),
 * de arriba (más viejo) hacia abajo (hoy).
 *
 * Viene de ArbolMovimientosSubTab (el antiguo subtab "Árbol de movimientos",
 * eliminado), pero SIN su expansión recursiva: aquí no se puede desplegar la
 * trayectoria de un empleado ni la historia de otra plaza — un solo nodo raíz
 * por consulta, sin ramas. En su lugar, cada nodo de ocupación muestra hacia
 * dónde/de dónde se movió el empleado (ver `origenMap`/`destinoPlaza` abajo).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Draggable } from "gsap/Draggable";
import {
    AlertTriangle,
    ArrowRight,
    Ban,
    Briefcase,
    Building2,
    Clock,
    Layers,
    Loader2,
    Minus,
    Plus,
    Scan,
    Sparkles,
    User,
    X,
} from "lucide-react";
import ModalShell, { Pill } from "@/components/shared/ModalShell";
import { VacantesService } from "@/services/vacantes.service";
import FotoEmpleadoCell from "../shared/FotoEmpleadoCell";

gsap.registerPlugin(useGSAP, Draggable);

const ESTILO_NODO = {
    creacion: { label: "Creación de la plaza", icon: Sparkles, bg: "#94a3b8", size: 48 },
    vacancia: { label: "Vacante", icon: Clock, bg: "#d97706", size: 34 },
    ocupacion: { label: "Ocupación", icon: User, bg: "#621f32", size: 58 },
    insubsistencia: { label: "Insubsistencia", icon: Ban, bg: "#e11d48", size: 42 },
    transito: { label: "Movimiento de paso", icon: ArrowRight, bg: "#7c3aed", size: 32 },
};
const LINEA_GRIS = "#94a3b8";
// Espaciado holgado: la etiqueta es una tarjeta multilínea (fecha con año,
// tipo de periodo, entrada→salida, nombre), no una sola línea corta.
const ROW_HEIGHT = 170;

const fmtFecha = (iso) => {
    if (!iso) return null;
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
};
const fmtDias = (n) => {
    if (n == null) return "";
    if (n === 0) return "mismo día";
    if (n === 1) return "1 día";
    if (n < 365) return `${n} días`;
    const años = Math.floor(n / 365);
    const meses = Math.floor((n % 365) / 30);
    return meses > 0 ? `${años}a ${meses}m` : `${años} año${años > 1 ? "s" : ""}`;
};

/* ------------------------------------------------------------------ */
/* Un nodo del tronco: círculo + etiqueta debajo. Sin botón de          */
/* expansión — este canvas nunca abre historia de empleado ni de otra   */
/* plaza. Si el empleado llegó de otra plaza o salió hacia otra, un      */
/* badge con flecha a cada lado del círculo lo indica.                   */
/* ------------------------------------------------------------------ */
function Nodo({ node, origin, seleccionado, onSelect, canViewPhoto }) {
    const { periodo, origenPlaza, destinoPlaza } = node;
    const tipo = periodo.tipo_periodo || "ocupacion";
    const estilo = ESTILO_NODO[tipo] || ESTILO_NODO.ocupacion;
    const Icono = estilo.icon;
    const halo = "#621f32";
    const abierto = periodo.fecha_fin == null;
    const nombre = periodo.nombre_completo || "";

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: origin.x + node.x, top: origin.y + node.y }}
        >
            <div data-node-inner className="flex cursor-pointer flex-col items-center">
                <div className="relative">
                    <div
                        className="flex items-center justify-center overflow-hidden rounded-full shadow-lg transition-transform hover:scale-110"
                        style={{
                            width: estilo.size,
                            height: estilo.size,
                            background: estilo.bg,
                            boxShadow: seleccionado
                                ? `0 0 0 4px white, 0 0 0 7px ${halo}`
                                : abierto
                                  ? `0 0 0 3px white, 0 0 0 5px #10b981`
                                  : "0 2px 8px rgba(0,0,0,0.25)",
                        }}
                    >
                        {tipo === "ocupacion" && periodo.num_empleado && canViewPhoto ? (
                            <FotoEmpleadoCell
                                numempleado={periodo.num_empleado}
                                size={estilo.size}
                                fallbackClassName="bg-[#621f32]"
                                fallbackIconClassName="text-white"
                            />
                        ) : (
                            <Icono className="text-white" style={{ width: estilo.size * 0.42, height: estilo.size * 0.42 }} />
                        )}
                    </div>

                    {/* Llegó de otra plaza: badge a la izquierda, flecha apuntando
                        hacia el nodo (simula su llegada). */}
                    {origenPlaza && (
                        <div
                            title={`Llegó desde la plaza ${origenPlaza}`}
                            className="absolute right-full top-1/2 mr-2.5 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                            <span className="font-mono">{origenPlaza}</span>
                            <ArrowRight className="size-3" />
                        </div>
                    )}

                    {/* Salió hacia otra plaza: badge a la derecha, flecha emanando
                        del nodo hacia afuera. */}
                    {destinoPlaza && (
                        <div
                            title={`Se trasladó a la plaza ${destinoPlaza}`}
                            className="absolute left-full top-1/2 ml-2.5 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700 shadow-sm dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
                        >
                            <ArrowRight className="size-3" />
                            <span className="font-mono">{destinoPlaza}</span>
                        </div>
                    )}
                </div>

                <div className="mt-1.5 flex max-w-[150px] flex-col items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-1 text-center shadow-sm">
                    <span className="whitespace-nowrap text-[10px] font-bold text-slate-700">
                        {fmtFecha(periodo.fecha_inicio)}
                        {" – "}
                        {periodo.fecha_fin ? fmtFecha(periodo.fecha_fin) : "vigente"}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        {periodo.num_gestion ? `Gestión ${periodo.num_gestion}` : estilo.label}
                    </span>
                    {(periodo.accion_entrada || periodo.accion_salida) && (
                        <span className="line-clamp-2 text-[9px] text-slate-400">
                            {periodo.accion_entrada || "—"}
                            {periodo.accion_salida ? ` → ${periodo.accion_salida}` : ""}
                        </span>
                    )}
                    {nombre && (
                        <span className="w-full truncate text-[10px] font-bold text-[#621f32]">{nombre}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Panel de detalle del nodo seleccionado (fijo, no se mueve con el    */
/* canvas: evita medir posiciones DOM bajo pan/zoom).                  */
/* ------------------------------------------------------------------ */
function PanelDetalle({ node, onCerrar }) {
    if (!node) return null;
    const { periodo, origenPlaza, destinoPlaza } = node;
    const tipo = periodo.tipo_periodo || "ocupacion";
    const estilo = ESTILO_NODO[tipo] || ESTILO_NODO.ocupacion;
    const Icono = estilo.icon;

    return (
        <div className="absolute bottom-3 left-3 right-3 z-20 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:left-4 md:right-auto">
            <button
                onClick={onCerrar}
                className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
                <X className="size-3.5" />
            </button>

            <div className="flex items-center gap-2">
                <span
                    className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: estilo.bg }}
                >
                    <Icono className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {periodo.num_gestion ? `Gestión ${periodo.num_gestion}` : estilo.label}
                        {(tipo === "insubsistencia" || tipo === "transito") && (
                            <span className="ml-1.5 font-normal normal-case text-rose-500">no cuenta como gestión</span>
                        )}
                    </p>
                    {periodo.nombre_completo && (
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{periodo.nombre_completo}</p>
                    )}
                </div>
            </div>

            {Boolean(periodo.inconsistente) && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <AlertTriangle className="size-3" />
                    El dato de origen se contradice en este periodo.
                </p>
            )}

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {fmtFecha(periodo.fecha_inicio)} {" → "}
                {periodo.fecha_fin == null ? (
                    <span className="font-semibold text-emerald-600">vigente</span>
                ) : (
                    fmtFecha(periodo.fecha_fin)
                )}
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                <span className="font-medium">{fmtDias(periodo.dias)}</span>
            </p>

            {(origenPlaza || destinoPlaza) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    {origenPlaza && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            <span className="font-mono">{origenPlaza}</span>
                            <ArrowRight className="size-3" />
                            Llegó aquí
                        </span>
                    )}
                    {destinoPlaza && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                            Se trasladó
                            <ArrowRight className="size-3" />
                            <span className="font-mono">{destinoPlaza}</span>
                        </span>
                    )}
                </p>
            )}

            {(periodo.accion_entrada || periodo.accion_salida) && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {periodo.accion_entrada && (
                        <span>{periodo.accion_entrada}{periodo.motivo_entrada ? ` · ${periodo.motivo_entrada}` : ""}</span>
                    )}
                    {periodo.accion_salida && (
                        <>
                            <ArrowRight className="size-3 text-slate-300 dark:text-slate-700" />
                            <span>{periodo.accion_salida}{periodo.motivo_salida ? ` · ${periodo.motivo_salida}` : ""}</span>
                        </>
                    )}
                </p>
            )}

            {(periodo.nivel_entrada || periodo.nivel_salida) && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-400 dark:text-slate-500">Nivel:</span>
                    <span>{periodo.nivel_entrada || "—"}</span>
                    {periodo.nivel_salida && periodo.nivel_salida !== periodo.nivel_entrada && (
                        <>
                            <ArrowRight className="size-3 text-slate-300 dark:text-slate-700" />
                            <span>{periodo.nivel_salida}</span>
                        </>
                    )}
                </p>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */
export default function PosicionArbolModal({ open, onOpenChange, posicion, canViewPhoto = true }) {
    const [plaza, setPlaza] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [seleccionado, setSeleccionado] = useState(null);
    const [zoom, setZoom] = useState(1);
    // clave del nodo (mov:<id_registro_inicio>) -> plaza de la que vino ese
    // ocupante, resuelta cruzando la historia de CADA empleado del tronco.
    const [origenMap, setOrigenMap] = useState({});

    const contenedorRef = useRef(null);
    const viewportRef = useRef(null);
    const worldRef = useRef(null);
    const draggableRef = useRef(null);

    useEffect(() => {
        if (!open || !posicion) {
            setPlaza(null);
            setError(null);
            setSeleccionado(null);
            setOrigenMap({});
            return;
        }
        const ctrl = new AbortController();
        setCargando(true);
        setError(null);
        setSeleccionado(null);
        VacantesService.getHistoriaPlaza(posicion, { signal: ctrl.signal })
            .then(async (res) => {
                if (!res.ok) {
                    const cuerpo = await res.json().catch(() => ({}));
                    throw new Error(cuerpo.detail || `No se encontró la plaza ${posicion}.`);
                }
                return res.json();
            })
            .then((datos) => {
                if (!ctrl.signal.aborted) setPlaza(datos);
            })
            .catch((e) => {
                if (e.name !== "AbortError") setError(e.message);
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setCargando(false);
            });
        return () => ctrl.abort();
    }, [open, posicion]);

    // Origen de cada ocupante: se cruza la historia COMPLETA de cada empleado
    // que pasó por esta plaza (mismo endpoint que alimentaba la rama de
    // "trayectoria del empleado" del antiguo Árbol de movimientos) — si el
    // tramo inmediatamente anterior de ese empleado cerró por traslado, esa
    // plaza es de donde llegó.
    useEffect(() => {
        if (!open || !plaza) {
            setOrigenMap({});
            return;
        }
        const empleados = [...new Set(plaza.periodos.filter((p) => p.num_empleado).map((p) => p.num_empleado))];
        if (empleados.length === 0) {
            setOrigenMap({});
            return;
        }
        const ctrl = new AbortController();
        Promise.all(
            empleados.map((emp) =>
                VacantesService.getHistoriaEmpleado(emp, { signal: ctrl.signal })
                    .then((res) => (res.ok ? res.json() : null))
                    .catch(() => null)
            )
        ).then((resultados) => {
            if (ctrl.signal.aborted) return;
            const mapa = {};
            resultados.forEach((datos) => {
                const tramos = datos?.tramos;
                if (!Array.isArray(tramos)) return;
                for (let i = 1; i < tramos.length; i++) {
                    const actual = tramos[i];
                    const anterior = tramos[i - 1];
                    if (actual.id_registro_inicio != null && anterior.tipo_cierre === "traslado" && anterior.posicion) {
                        mapa[`mov:${actual.id_registro_inicio}`] = anterior.posicion;
                    }
                }
            });
            setOrigenMap(mapa);
        });
        return () => ctrl.abort();
    }, [open, plaza]);

    /* ---------------- Layout: sólo el tronco, sin ramas -------------- */
    const { nodes, edges } = useMemo(() => {
        if (!plaza) return { nodes: [], edges: [] };
        const ordenados = [...plaza.periodos].sort((a, b) => {
            const fa = a.fecha_inicio || "0000-00-00";
            const fb = b.fecha_inicio || "0000-00-00";
            if (fa !== fb) return fa < fb ? -1 : 1;
            const puntualA = a.fecha_fin && a.fecha_fin === a.fecha_inicio ? 0 : 1;
            const puntualB = b.fecha_fin && b.fecha_fin === b.fecha_inicio ? 0 : 1;
            if (puntualA !== puntualB) return puntualA - puntualB;
            return (a.id_registro_inicio || 0) - (b.id_registro_inicio || 0);
        });
        const nodos = ordenados.map((periodo, i) => {
            const id = periodo.id_registro_inicio != null ? `mov:${periodo.id_registro_inicio}` : `idx:${i}`;
            return {
                id,
                periodo,
                x: 0,
                y: i * ROW_HEIGHT,
                origenPlaza: origenMap[id] || null,
                destinoPlaza: periodo.tipo_cierre === "traslado" && periodo.posicion_destino ? periodo.posicion_destino : null,
            };
        });
        const bordes = [];
        for (let i = 1; i < nodos.length; i++) {
            bordes.push({ id: `e:${i}`, x1: nodos[i - 1].x, y1: nodos[i - 1].y, x2: nodos[i].x, y2: nodos[i].y });
        }
        return { nodes: nodos, edges: bordes };
    }, [plaza, origenMap]);

    const bbox = useMemo(() => {
        const PAD_Y = 110; // etiqueta multilínea de hasta 150px de ancho
        const PAD_X = 230; // + hueco para los badges de origen/destino a los lados
        if (nodes.length === 0) return { minX: -PAD_X, maxX: PAD_X, minY: -PAD_Y, maxY: PAD_Y };
        const ys = nodes.map((n) => n.y);
        return { minX: -PAD_X, maxX: PAD_X, minY: Math.min(...ys) - PAD_Y, maxY: Math.max(...ys) + PAD_Y + 40 };
    }, [nodes]);

    const origin = { x: -bbox.minX, y: -bbox.minY };
    const worldW = bbox.maxX - bbox.minX;
    const worldH = bbox.maxY - bbox.minY;

    const nodoSeleccionado = useMemo(() => {
        if (!seleccionado) return null;
        return nodes.find((n) => n.id === seleccionado) || null;
    }, [seleccionado, nodes]);

    // Resumen: cuenta cada tipo de periodo del tronco (gestiones/insubsistencias
    // ya las manda el backend; vacancias y el total se derivan aquí mismo).
    const resumen = useMemo(() => {
        if (!plaza) return null;
        const vacancias = plaza.periodos.filter((p) => p.tipo_periodo === "vacancia").length;
        return [
            { label: "Gestiones", valor: plaza.num_gestiones, icon: Briefcase },
            { label: "Vacancias", valor: vacancias, icon: Clock },
            { label: "Insubsistencias", valor: plaza.num_insubsistencias, icon: Ban },
            { label: "Periodos", valor: plaza.periodos.length, icon: Layers },
        ];
    }, [plaza]);

    // Tiempo total que la plaza ha estado vacante vs. ocupada (suma de `dias`
    // por tipo de periodo) — lo primero que se ve del modal, arriba del resumen.
    const duracion = useMemo(() => {
        if (!plaza) return null;
        const sumarDias = (tipo) =>
            plaza.periodos.filter((p) => p.tipo_periodo === tipo).reduce((acc, p) => acc + (p.dias || 0), 0);
        const diasVacante = sumarDias("vacancia");
        const diasOcupada = sumarDias("ocupacion");
        const total = diasVacante + diasOcupada;
        if (total === 0) return null;
        return {
            diasVacante,
            diasOcupada,
            pctVacante: (diasVacante / total) * 100,
            pctOcupada: (diasOcupada / total) * 100,
        };
    }, [plaza]);

    /* ---------------- Pan (Draggable) + zoom (rueda) ------------------ */
    useGSAP(
        () => {
            if (!open || !plaza || !viewportRef.current || !worldRef.current) return;

            const vp = viewportRef.current.getBoundingClientRect();
            gsap.set(worldRef.current, { x: vp.width / 2 - origin.x, y: 36, scale: 1 });
            setZoom(1);

            draggableRef.current?.[0]?.kill();
            draggableRef.current = Draggable.create(worldRef.current, {
                type: "x,y",
                trigger: viewportRef.current,
                allowEventDefault: true,
                dragClickables: true,
            });

            const onWheel = (e) => {
                e.preventDefault();
                const rect = viewportRef.current.getBoundingClientRect();
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                const cur = gsap.getProperty(worldRef.current, "scale");
                const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
                const next = Math.min(2.2, Math.max(0.35, cur * factor));
                const curX = gsap.getProperty(worldRef.current, "x");
                const curY = gsap.getProperty(worldRef.current, "y");
                const worldX = (cx - curX) / cur;
                const worldY = (cy - curY) / cur;
                gsap.to(worldRef.current, {
                    scale: next,
                    x: cx - worldX * next,
                    y: cy - worldY * next,
                    duration: 0.2,
                    ease: "power2.out",
                    onUpdate: () => setZoom(gsap.getProperty(worldRef.current, "scale")),
                });
            };
            const vpEl = viewportRef.current;
            vpEl.addEventListener("wheel", onWheel, { passive: false });

            return () => {
                vpEl.removeEventListener("wheel", onWheel);
                draggableRef.current?.[0]?.kill();
            };
        },
        { scope: contenedorRef, dependencies: [open, plaza] }
    );

    /* ---------------- Entrada animada del tronco ---------------------- */
    useGSAP(
        () => {
            if (!open || !plaza || !worldRef.current) return;
            const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reducido) {
                gsap.set("[data-node-inner]", { opacity: 1, scale: 1, y: 0 });
                return;
            }
            gsap.fromTo(
                "[data-node-inner]",
                { opacity: 0, scale: 0, y: -14 },
                { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(1.6)", stagger: { each: 0.055, amount: 1.1 } }
            );
        },
        { scope: contenedorRef, dependencies: [open, plaza] }
    );

    const centrar = useCallback(() => {
        if (!viewportRef.current || !worldRef.current) return;
        const vp = viewportRef.current.getBoundingClientRect();
        gsap.to(worldRef.current, {
            x: vp.width / 2 - origin.x,
            y: 36,
            scale: 1,
            duration: 0.4,
            ease: "power2.out",
            onUpdate: () => setZoom(gsap.getProperty(worldRef.current, "scale")),
        });
    }, [origin.x]);

    const zoomBoton = useCallback((factor) => {
        if (!viewportRef.current || !worldRef.current) return;
        const vp = viewportRef.current.getBoundingClientRect();
        const cx = vp.width / 2;
        const cy = vp.height / 2;
        const cur = gsap.getProperty(worldRef.current, "scale");
        const next = Math.min(2.2, Math.max(0.35, cur * factor));
        const curX = gsap.getProperty(worldRef.current, "x");
        const curY = gsap.getProperty(worldRef.current, "y");
        const worldX = (cx - curX) / cur;
        const worldY = (cy - curY) / cur;
        gsap.to(worldRef.current, {
            scale: next,
            x: cx - worldX * next,
            y: cy - worldY * next,
            duration: 0.25,
            ease: "power2.out",
            onUpdate: () => setZoom(gsap.getProperty(worldRef.current, "scale")),
        });
    }, []);

    return (
        <ModalShell
            open={open}
            onClose={() => onOpenChange(false)}
            size="xl"
            resizable
            minWidth={900}
            maxWidth={1500}
            fixedHeight
            icon={Building2}
            eyebrow="Árbol de movimientos"
            title={`Posición ${posicion || ""}`}
            subtitle="Tronco de la plaza: creación, ocupaciones, vacancias e insubsistencias"
            bodyClassName="p-0 flex flex-col"
            headerExtra={
                plaza && (
                    <>
                        <Pill tone={plaza.ocupada ? "emerald" : "amber"} className="hidden sm:inline-flex">
                            {plaza.ocupada ? "Ocupada" : "Vacante"}
                        </Pill>
                        {plaza.tiene_inconsistencias && (
                            <Pill tone="rose" className="hidden sm:inline-flex">
                                <AlertTriangle className="mr-1 size-3" />
                                Inconsistencias
                            </Pill>
                        )}
                    </>
                )
            }
        >
            {/* Tiempo vacante vs. ocupada: lo primero que se ve, arriba de todo. */}
            {duracion && (
                <div className="shrink-0 border-b border-slate-100 px-5 py-3 dark:border-slate-800/60 sm:px-7">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                            <Clock className="size-3.5" />
                            Vacante: {fmtDias(duracion.diasVacante)}
                        </span>
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                            <User className="size-3.5" />
                            Ocupada: {fmtDias(duracion.diasOcupada)}
                        </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                            className="h-full bg-amber-400"
                            style={{ width: `${duracion.pctVacante}%` }}
                            title={`Vacante: ${fmtDias(duracion.diasVacante)}`}
                        />
                        <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${duracion.pctOcupada}%` }}
                            title={`Ocupada: ${fmtDias(duracion.diasOcupada)}`}
                        />
                    </div>
                </div>
            )}

            {/* Resumen: cuenta cada tipo de periodo del tronco. */}
            {resumen && (
                <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800/60 dark:bg-slate-900/30 sm:px-7">
                    {resumen.map((r) => (
                        <div key={r.label} className="flex items-center gap-2">
                            <div className="rounded-lg bg-[#621f32]/8 p-1.5 text-[#621f32] dark:bg-[#bc955c]/10 dark:text-[#bc955c]">
                                <r.icon className="size-3.5" />
                            </div>
                            <span className="text-lg font-black leading-none text-slate-800 dark:text-white">{r.valor}</span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{r.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Canvas */}
            <div ref={contenedorRef} className="relative min-h-0 flex-1 overflow-hidden">
                {cargando ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#621f32] dark:text-[#bc955c]">
                        <Loader2 className="mb-4 size-10 animate-spin" />
                        <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Cargando historia de la plaza...</p>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-rose-600">
                        <AlertTriangle className="mb-3 size-10" />
                        <p className="text-sm font-semibold">{error}</p>
                    </div>
                ) : (
                    <>
                        <div
                            ref={viewportRef}
                            className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950/40"
                            style={{
                                backgroundImage: "radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)",
                                backgroundSize: "22px 22px",
                                touchAction: "none",
                                cursor: "grab",
                            }}
                            onClick={() => setSeleccionado(null)}
                        >
                            <div ref={worldRef} className="absolute left-0 top-0" style={{ width: worldW, height: worldH }}>
                                <svg
                                    className="pointer-events-none absolute left-0 top-0"
                                    width={worldW}
                                    height={worldH}
                                    style={{ overflow: "visible" }}
                                >
                                    {edges.map((e) => (
                                        <line
                                            key={e.id}
                                            x1={origin.x + e.x1}
                                            y1={origin.y + e.y1}
                                            x2={origin.x + e.x2}
                                            y2={origin.y + e.y2}
                                            stroke={LINEA_GRIS}
                                            strokeWidth={2.5}
                                            strokeLinecap="round"
                                        />
                                    ))}
                                </svg>

                                {nodes.map((n) => (
                                    <Nodo
                                        key={n.id}
                                        node={n}
                                        origin={origin}
                                        seleccionado={seleccionado === n.id}
                                        onSelect={(node) => setSeleccionado(node.id)}
                                        canViewPhoto={canViewPhoto}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Controles de zoom */}
                        <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1">
                            <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                <button onClick={() => zoomBoton(1.25)} className="flex size-9 items-center justify-center text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                                    <Plus className="size-4" />
                                </button>
                                <div className="border-t border-slate-100 px-1 py-1 text-center text-[10px] font-bold text-slate-400 dark:border-slate-800">
                                    {Math.round(zoom * 100)}%
                                </div>
                                <button onClick={() => zoomBoton(0.8)} className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
                                    <Minus className="size-4" />
                                </button>
                                <button onClick={centrar} className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
                                    <Scan className="size-4" />
                                </button>
                            </div>
                            <span className="pointer-events-none mt-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:bg-slate-900/80">
                                arrastra · rueda
                            </span>
                        </div>

                        <PanelDetalle node={nodoSeleccionado} onCerrar={() => setSeleccionado(null)} />
                    </>
                )}
            </div>
        </ModalShell>
    );
}
