"use client";

import { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from "react";
import { Loader2, AlertTriangle, FileQuestion, ChevronDown, ArrowRightLeft, GitCommitHorizontal } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { formatDateEsMx } from "@/utils/columnFilters";
import { getMovimientoDiff } from "../../_utils/movimientosDiff";

gsap.registerPlugin(useGSAP);

const GOLD = "#bc955c";
const AMBER = "#f59e0b";
const LANE_MIN_WIDTH = 260;

const formatDate = (value) => (value ? formatDateEsMx(value) : "-");

// Carriles = posiciones distintas que tuvo el empleado, en orden de PRIMERA
// aparición cronológica (movimientos ya vienen ASC por fecha_efectiva/sec
// desde el backend, ver MovimientosPersonalHistorialView) — la posición más
// antigua queda a la izquierda, la vigente al final (derecha).
const useLanes = (movimientos) => {
    return useMemo(() => {
        const byPosicion = new Map();
        movimientos.forEach((mov) => {
            const existente = byPosicion.get(mov.posicion);
            if (!existente) {
                byPosicion.set(mov.posicion, {
                    posicion: mov.posicion,
                    puestoPtal: mov.puesto_ptal,
                    nivel: mov.nivel_tabular,
                    primeraFecha: mov.fecha_efectiva,
                    ultimaFecha: mov.fecha_efectiva,
                });
            } else {
                existente.puestoPtal = mov.puesto_ptal || existente.puestoPtal;
                existente.nivel = mov.nivel_tabular || existente.nivel;
                existente.ultimaFecha = mov.fecha_efectiva;
            }
        });
        const ultimaPosicion = movimientos[movimientos.length - 1]?.posicion;
        return [...byPosicion.values()].map((lane, index) => ({
            ...lane,
            index,
            esActual: lane.posicion === ultimaPosicion,
        }));
    }, [movimientos]);
};

// Un movimiento por tarjeta, colapsada por defecto. Al expandir muestra el
// diff contra su inmediato anterior cronológico (cualquiera sea su carril).
const MovementCard = ({ mov, laneIndex, rowIndex, diff, cambioDePosicion, esPrimero, expanded, onToggle, cardRef }) => {
    // Colapsado por defecto: al abrir el detalle del movimiento solo se ve
    // "Cambios detectados" — "Sin cambios" es secundario y se despliega aparte.
    const [showUnchanged, setShowUnchanged] = useState(false);
    const detailRef = useRef(null);

    // Se dispara solo al ABRIR el detalle (el bloque se desmonta al cerrar,
    // así que cada apertura es un montaje nuevo): el panel entra con un
    // acordeón (height 0 -> auto) y las filas de "Cambios detectados" se
    // suman con stagger, en vez del aparecer/desaparecer seco de antes.
    useGSAP(() => {
        if (!expanded || !detailRef.current) return;
        const el = detailRef.current;
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from(el, { autoAlpha: 0, height: 0, y: -6, duration: 0.28 });
        const rows = el.querySelectorAll(".hist-diff-row");
        if (rows.length) tl.from(rows, { autoAlpha: 0, x: -8, stagger: 0.04, duration: 0.22, ease: "power1.out" }, "-=0.12");
    }, { dependencies: [expanded] });

    // "Sin cambios" es un despliegue aparte (ver toggle abajo) — se anima
    // independiente para no repetir la entrada de todo el panel cada vez.
    useGSAP(() => {
        if (!showUnchanged || !detailRef.current) return;
        const chips = detailRef.current.querySelectorAll(".hist-unchanged-chip");
        if (chips.length) gsap.from(chips, { autoAlpha: 0, y: 4, stagger: 0.02, duration: 0.2, ease: "power1.out" });
    }, { dependencies: [showUnchanged] });

    return (
        <div
            ref={cardRef}
            style={{ gridColumn: laneIndex + 1, gridRow: rowIndex + 1 }}
            className="relative"
        >
            <button
                type="button"
                onClick={onToggle}
                className={`group w-full text-left rounded-xl border bg-white dark:bg-slate-900 shadow-sm px-3.5 py-3 transition-all cursor-pointer ${expanded
                    ? "border-[#bc955c] ring-2 ring-[#bc955c]/15"
                    : "border-slate-200 dark:border-slate-800 hover:border-[#bc955c]/50 hover:shadow-md"}`}
            >
                {cambioDePosicion && (
                    <span className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500">
                        <ArrowRightLeft className="size-2.5" />
                        Cambio de posición
                    </span>
                )}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h5 className="text-[12px] font-black uppercase text-[#621f32] dark:text-[#e3c793] leading-tight truncate" title={mov.accion_nombre}>
                            {mov.accion_nombre || "—"}
                        </h5>
                        <span className="mt-1 inline-block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-full">
                            {mov.motivo_nombre || "—"}
                        </span>
                    </div>
                    <ChevronDown className={`size-4 shrink-0 mt-0.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">F. Efectiva</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatDate(mov.fecha_efectiva)}</span>
                    </div>
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">F. Captura</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{formatDate(mov.fecha_captura)}</span>
                    </div>
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Sec</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{mov.sec ?? "-"}</span>
                    </div>
                    <div className="min-w-0">
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Por</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400 truncate block" title={mov.por || undefined}>{mov.por || "-"}</span>
                    </div>
                </div>
            </button>

            {expanded && (
                <div ref={detailRef} className="mt-1.5 overflow-hidden rounded-xl border border-dashed border-[#621f32]/20 dark:border-slate-800 bg-[#621f32]/[0.03] dark:bg-slate-900/40 px-3.5 py-3">
                    {esPrimero ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            Movimiento inicial de este historial — no hay un registro anterior con el cual comparar.
                        </p>
                    ) : (
                        <>
                            <div className="mb-2.5">
                                <h6 className="text-[9px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c] mb-1.5">
                                    Cambios detectados{diff.differences.length > 0 ? ` (${diff.differences.length})` : ""}
                                </h6>
                                {diff.differences.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Sin cambios de datos respecto al movimiento anterior.</p>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {diff.differences.map((d) => (
                                            <div key={d.key} className="hist-diff-row flex flex-wrap items-center gap-1.5 text-[10px] bg-white dark:bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-100 dark:border-slate-800">
                                                <span className="font-black text-slate-600 dark:text-slate-300 mr-0.5">{d.label}:</span>
                                                <span className="line-through italic text-slate-400 dark:text-slate-600 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{d.oldValue}</span>
                                                <span className="text-slate-400">→</span>
                                                <span className="font-black text-[#621f32] dark:text-[#e3c793] px-1 py-0.5 bg-[#621f32]/10 dark:bg-[#bc955c]/10 rounded">{d.newValue}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {diff.unchanged.length > 0 && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setShowUnchanged((v) => !v); }}
                                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 mb-1.5 cursor-pointer"
                                    >
                                        <ChevronDown className={`size-3 transition-transform ${showUnchanged ? "rotate-180" : ""}`} />
                                        Sin cambios ({diff.unchanged.length})
                                    </button>
                                    {showUnchanged && (
                                        <div className="flex flex-wrap gap-1">
                                            {diff.unchanged.map((u) => (
                                                <span key={u.key} title={u.value} className="hist-unchanged-chip text-[9px] font-semibold text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-md truncate max-w-[160px]">
                                                    {u.label}: {u.value}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default function HistorialMovimientosTab({ estado, numEmpleado }) {
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const canvasRef = useRef(null);
    const bgLayerRef = useRef(null);
    const cardRefs = useRef(new Map());
    const laneRefs = useRef(new Map());
    const pathRefs = useRef(new Map());
    const introKeyRef = useRef(null);
    const [paths, setPaths] = useState([]);
    const [dividers, setDividers] = useState([]);
    const [laneBands, setLaneBands] = useState([]);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const movimientos = estado.data || [];
    const lanes = useLanes(movimientos);
    const laneIndexByPosicion = useMemo(() => new Map(lanes.map((l) => [l.posicion, l.index])), [lanes]);

    const toggleExpanded = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const recomputeLayout = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || movimientos.length === 0) return;
        const canvasRect = canvas.getBoundingClientRect();
        setCanvasSize({ width: canvas.scrollWidth, height: canvas.scrollHeight });

        const next = [];
        for (let i = 0; i < movimientos.length - 1; i++) {
            const elA = cardRefs.current.get(movimientos[i].id);
            const elB = cardRefs.current.get(movimientos[i + 1].id);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            const xA = rectA.left - canvasRect.left + rectA.width / 2;
            const yA = rectA.bottom - canvasRect.top;
            const xB = rectB.left - canvasRect.left + rectB.width / 2;
            const yB = rectB.top - canvasRect.top;
            const cambio = movimientos[i].posicion !== movimientos[i + 1].posicion;
            const d = Math.abs(xA - xB) < 1
                ? `M ${xA} ${yA} L ${xB} ${yB}`
                : `M ${xA} ${yA} V ${(yA + yB) / 2} H ${xB} V ${yB}`;
            next.push({ id: `${movimientos[i].id}-${movimientos[i + 1].id}`, d, cambio });
        }
        setPaths(next);

        // Líneas punteadas divisorias entre carriles — a la mitad del gap
        // entre la cabecera de un carril y el siguiente (mismas columnas que
        // ambos grids, ver comentario de alineación arriba). Mismos cortes
        // se reutilizan como límites de las bandas de sombreado intercalado.
        const dividerXs = [];
        for (let i = 0; i < lanes.length - 1; i++) {
            const elA = laneRefs.current.get(lanes[i].posicion);
            const elB = laneRefs.current.get(lanes[i + 1].posicion);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            dividerXs.push(((rectA.right - canvasRect.left) + (rectB.left - canvasRect.left)) / 2);
        }
        setDividers(dividerXs.map((x, i) => ({ posicion: lanes[i].posicion, x })));

        if (dividerXs.length === lanes.length - 1) {
            const boundaries = [0, ...dividerXs, canvas.scrollWidth];
            setLaneBands(
                lanes
                    .map((lane, i) => ({ posicion: lane.posicion, left: boundaries[i], width: boundaries[i + 1] - boundaries[i], shaded: i % 2 === 1 }))
                    .filter((band) => band.shaded)
            );
        }
    }, [movimientos, lanes]);

    useLayoutEffect(() => {
        recomputeLayout();
    }, [recomputeLayout, expandedIds]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => recomputeLayout());
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [recomputeLayout]);

    // "Construcción" animada del diagrama — una sola vez por dataset cargado
    // (identificado por `estado.data`, referencia estable mientras solo se
    // expanden/colapsan tarjetas): fondo + carriles entran, las tarjetas
    // aparecen en orden cronológico y los conectores se "dibujan" en cascada.
    // Recomputes posteriores (expand/collapse, resize) NO repiten la intro.
    useGSAP(() => {
        if (!canvasRef.current || movimientos.length === 0) return;
        const expectedConnectors = Math.max(movimientos.length - 1, 0);
        if (paths.length !== expectedConnectors) return; // layout aún no calculado
        if (introKeyRef.current === estado.data) return; // este dataset ya se animó
        introKeyRef.current = estado.data;

        const laneEls = lanes.map((l) => laneRefs.current.get(l.posicion)).filter(Boolean);
        const cardEls = movimientos.map((m) => cardRefs.current.get(m.id)).filter(Boolean);
        const pathEls = paths.map((p) => pathRefs.current.get(p.id)).filter(Boolean);

        const reduceMotion = typeof window !== "undefined"
            && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
            paths.forEach((p) => {
                const el = pathRefs.current.get(p.id);
                if (el) gsap.set(el, { strokeDasharray: p.cambio ? "6 4" : "none" });
            });
            return;
        }

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        if (bgLayerRef.current) tl.from(bgLayerRef.current, { autoAlpha: 0, duration: 0.5 }, 0);
        if (laneEls.length) tl.from(laneEls, { autoAlpha: 0, y: -10, duration: 0.35, stagger: 0.05 }, 0.05);
        if (cardEls.length) {
            tl.from(cardEls, { autoAlpha: 0, y: 14, scale: 0.97, duration: 0.32, stagger: 0.045, ease: "back.out(1.5)" }, "-=0.15");
        }
        pathEls.forEach((el, i) => {
            const length = el.getTotalLength();
            const cambio = paths[i]?.cambio;
            gsap.set(el, { strokeDasharray: length, strokeDashoffset: length });
            tl.to(el, {
                strokeDashoffset: 0,
                duration: 0.4,
                ease: "power2.inOut",
                onComplete: () => gsap.set(el, { strokeDasharray: cambio ? "6 4" : "none" }),
            }, i === 0 ? "-=0.1" : "<0.08");
        });
    }, { scope: canvasRef, dependencies: [movimientos, lanes, paths] });

    if (estado.status === "loading" || estado.status === "idle") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <Loader2 className="size-7 text-[#621f32]/40 dark:text-slate-600 animate-spin mb-3" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cargando historial de movimientos...</p>
            </div>
        );
    }

    if (estado.status === "error") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-4 border-2 border-double border-red-200 dark:border-red-900/50">
                    <AlertTriangle className="size-6 text-red-400 dark:text-red-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">No se pudo cargar el historial de movimientos</p>
                <p className="text-xs text-slate-400 mt-1">Intenta cerrar y volver a abrir el expediente</p>
            </div>
        );
    }

    if (estado.status === "empty" || movimientos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                    <FileQuestion className="size-6 text-[#621f32]/40 dark:text-slate-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">Sin movimientos registrados</p>
                <p className="text-xs text-slate-400 mt-1">No hay historial en cp_tbl_mov_completo_29_05_26 para el número de empleado {numEmpleado}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <GitCommitHorizontal className="size-3.5 text-[#bc955c]" />
                {movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"} · {lanes.length} {lanes.length === 1 ? "posición" : "posiciones"}
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">— desplaza horizontalmente para ver todos los carriles</span>
            </div>

            {/* max-h + overflow-auto (x e y) propios: así el scrollbar horizontal
                queda siempre visible al fondo de este panel, sin tener que
                bajar todo el modal para encontrarlo. */}
            <div className="overflow-auto custom-scrollbar rounded-xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-4 max-h-[55vh]">
                <div ref={canvasRef} className="relative" style={{ minWidth: lanes.length * LANE_MIN_WIDTH }}>
                    {/* Fondo (sombreado + conectores + divisores) agrupado en una sola
                        capa para poder hacerle un fundido de entrada conjunto con GSAP. */}
                    <div ref={bgLayerRef} className="absolute inset-0 pointer-events-none">
                        {/* Sombreado intercalado por carril — misma columna que la
                            cabecera y las tarjetas de ese carril, ver laneBands arriba. */}
                        {laneBands.map((band) => (
                            <div
                                key={band.posicion}
                                className="absolute top-0 bottom-0 bg-slate-100/70 dark:bg-slate-900/50"
                                style={{ left: band.left, width: band.width }}
                            />
                        ))}
                        <svg
                            className="absolute top-0 left-0"
                            width={canvasSize.width}
                            height={canvasSize.height}
                        >
                            <defs>
                                <marker id="hist-arrow-gold" viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 Z" fill={GOLD} />
                                </marker>
                                <marker id="hist-arrow-amber" viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 Z" fill={AMBER} />
                                </marker>
                            </defs>
                            {paths.map((p) => (
                                <path
                                    key={p.id}
                                    ref={(el) => {
                                        if (el) pathRefs.current.set(p.id, el);
                                        else pathRefs.current.delete(p.id);
                                    }}
                                    d={p.d}
                                    fill="none"
                                    stroke={p.cambio ? AMBER : GOLD}
                                    strokeWidth={p.cambio ? 2.5 : 2}
                                    strokeDasharray={p.cambio ? "6 4" : undefined}
                                    strokeLinecap="round"
                                    opacity={p.cambio ? 0.85 : 0.55}
                                    markerEnd={`url(#${p.cambio ? "hist-arrow-amber" : "hist-arrow-gold"})`}
                                />
                            ))}
                        </svg>

                        {/* Líneas punteadas divisorias entre carriles — separación visual
                            de cada columna de posición a lo largo de todo el diagrama */}
                        {dividers.map((d) => (
                            <div
                                key={d.posicion}
                                className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 dark:border-slate-700"
                                style={{ left: d.x }}
                            />
                        ))}
                    </div>

                    {/* Cabeceras de carril */}
                    <div className="relative z-10 pb-4">
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH - 20}px, 1fr))` }}>
                            {lanes.map((lane) => (
                                <div
                                    key={lane.posicion}
                                    ref={(el) => {
                                        if (el) laneRefs.current.set(lane.posicion, el);
                                        else laneRefs.current.delete(lane.posicion);
                                    }}
                                    className={`rounded-xl border px-3 py-2.5 ${lane.esActual
                                        ? "border-[#621f32] dark:border-[#bc955c] bg-[#621f32]/[0.06] dark:bg-slate-900"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"}`}
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-mono text-[13px] font-black text-[#621f32] dark:text-[#e3c793] truncate">{lane.posicion || "—"}</span>
                                        {lane.esActual && (
                                            <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-white bg-[#621f32] dark:bg-[#bc955c] dark:text-slate-950 px-1.5 py-0.5 rounded-full">Actual</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {lane.nivel && (
                                            <span className="shrink-0 font-mono text-[9px] font-black uppercase text-[#7a5a30] dark:text-[#e3c793] bg-[#bc955c]/15 dark:bg-[#bc955c]/15 border border-[#bc955c]/30 px-1.5 py-0.5 rounded">
                                                Nivel {lane.nivel}
                                            </span>
                                        )}
                                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate" title={lane.puestoPtal || undefined}>
                                            {lane.puestoPtal || "Sin puesto"}
                                        </p>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 mt-1">
                                        {formatDate(lane.primeraFecha)} — {lane.esActual ? "actual" : formatDate(lane.ultimaFecha)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tarjetas de movimiento, una por fila cronológica global */}
                    <div className="relative z-10 grid gap-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH - 20}px, 1fr))`, gridAutoRows: "min-content" }}>
                        {movimientos.map((mov, i) => {
                            const laneIndex = laneIndexByPosicion.get(mov.posicion) ?? 0;
                            const esPrimero = i === 0;
                            const diff = esPrimero ? { differences: [], unchanged: [] } : getMovimientoDiff(mov, movimientos[i - 1]);
                            const cambioDePosicion = !esPrimero && mov.posicion !== movimientos[i - 1].posicion;
                            return (
                                <MovementCard
                                    key={mov.id}
                                    mov={mov}
                                    laneIndex={laneIndex}
                                    rowIndex={i}
                                    diff={diff}
                                    cambioDePosicion={cambioDePosicion}
                                    esPrimero={esPrimero}
                                    expanded={expandedIds.has(mov.id)}
                                    onToggle={() => toggleExpanded(mov.id)}
                                    cardRef={(el) => {
                                        if (el) cardRefs.current.set(mov.id, el);
                                        else cardRefs.current.delete(mov.id);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
