"use client";

/**
 * RotacionAduanasSubTab
 * =====================
 * Subtab "Rotación de titulares de Aduanas" de MovimientosPersonalTab.
 *
 * Una columna por aduana (50), y dentro de cada una una SUBCOLUMNA (carril)
 * por cada plaza que haya ocupado algún titular en esa aduana — mismo
 * mecanismo de carriles/conectores que shared/HistorialMovimientosTab (grid
 * por posición + trazos SVG entre tarjetas consecutivas), aplicado aquí por
 * aduana en vez de por empleado.
 *
 * El backend (plantilla/rotacion_aduanas.py) entrega gestiones completas (una
 * por titular) con su tramo de movimientos crudo; TODA la segmentación por
 * plaza vive aquí (ver construirSegmentos): una gestión se parte en tantas
 * tarjetas como rachas consecutivas de la misma `posicion` haya en su tramo.
 * El conector entre dos tarjetas consecutivas de la MISMA aduana es dorado si
 * ambas comparten plaza y ámbar (punteado) si cambian — igual criterio que
 * Historial, que solo distingue "cambió de posición o no". Eso también pinta
 * de ámbar el conector cuando un titular nuevo reocupa una plaza distinta a
 * la que dejó vacante el anterior, que es información real y no un caso a
 * excluir.
 *
 * Los traslados a OTRA aduana siguen sin dibujarse como línea (saturarían el
 * diagrama con 50 columnas, ver comentario original más abajo): "Pasó a otra
 * aduana" sigue siendo un botón que hace scroll+resalta la tarjeta de
 * llegada, ahora resuelta a la PRIMERA tarjeta (primer segmento) de la
 * gestión destino en su propia columna.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowLeftRight,
    ArrowRight,
    Ban,
    Building2,
    Calendar,
    ChevronDown,
    ChevronLeft,
    Clock,
    FileSpreadsheet,
    Loader2,
    LogOut,
    RefreshCw,
    Search,
    UserCheck,
    Users,
    UserX,
    X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import ExcelJS from "exceljs";

gsap.registerPlugin(useGSAP);

import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx, normalizeForSearch } from "@/utils/columnFilters";
import {
    LETTERHEAD_LOGO_BASE64,
    LETTERHEAD_LOGO_WIDTH,
    LETTERHEAD_LOGO_HEIGHT,
} from "@/assets/letterhead-logo";
import { getMovimientoDiff } from "../../../_utils/movimientosDiff";
import FotoEmpleadoCell from "../../shared/FotoEmpleadoCell";

const GOLD = "#bc955c";
const AMBER = "#f59e0b";
const LANE_W = 360;

const TIPO_SALIDA = {
    ACTIVO: { etiqueta: "Titular actual", clase: "emerald" },
    TRASLADO_ADUANA: { etiqueta: "Pasó a otra aduana", clase: "amber" },
    BAJA: { etiqueta: "Baja", clase: "slate" },
    SALIDA_PUESTO: { etiqueta: "Pasó a otro puesto", clase: "sky" },
    // Salida interna: la gestión sigue viva, solo cambió de plaza dentro de
    // la misma aduana. Reutiliza el tono ámbar de TRASLADO_ADUANA (misma idea
    // — "se movió" — pero aquí resuelta con una línea, no con un botón).
    CAMBIO_PLAZA: { etiqueta: "Cambió de plaza", clase: "amber" },
};

/**
 * Clases completas por variante: Tailwind no puede resolver nombres armados
 * en tiempo de ejecución. Misma paleta institucional (maroon/gold/slate) y
 * mismo layout de tarjeta que shared/HistorialMovimientosTab — antes cada
 * tipo de salida tenía su propio color de acento (emerald/amber/slate/sky)
 * con fondo teñido, aquí solo el borde acentúa y el fondo es blanco liso.
 */
const ESTILO_TARJETA = {
    emerald: "border-[#621f32]/30 dark:border-[#621f32]/50 bg-white dark:bg-slate-900",
    amber: "border-amber-400/70 dark:border-amber-700/60 bg-white dark:bg-slate-900",
    slate: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
    sky: "border-[#bc955c]/50 dark:border-[#bc955c]/40 bg-white dark:bg-slate-900",
};

const ESTILO_ETIQUETA = {
    emerald: "bg-[#621f32]/10 text-[#621f32] dark:bg-[#621f32]/20 dark:text-[#e3c793]",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    sky: "bg-[#bc955c]/15 text-[#7a5a30] dark:bg-[#bc955c]/20 dark:text-[#bc955c]",
};

/**
 * Chips-filtro del encabezado: cada uno es a la vez leyenda (color/ícono) y
 * control — clic filtra `aduanas` para mostrar solo las que tienen al menos
 * un segmento de ese tipo (o, para SIN_TITULAR/VACANCIA, una condición propia
 * de la aduana). Las claves ACTIVO/TRASLADO_ADUANA/CAMBIO_PLAZA/SALIDA_PUESTO/
 * BAJA coinciden con `TIPO_SALIDA` a propósito, para que el filtro reutilice
 * exactamente la misma clasificación que ya pinta cada tarjeta.
 */
const FILTRO_META = {
    ACTIVO: {
        label: "Con titular",
        icon: UserCheck,
        accent: "maroon",
        desc: "Muestra solo las aduanas que hoy tienen un titular en funciones.",
    },
    TRASLADO_ADUANA: {
        label: "Traslados",
        icon: ArrowRight,
        accent: "amber",
        desc: "Muestra solo las aduanas con algún titular que se trasladó a otra aduana.",
    },
    CAMBIO_PLAZA: {
        label: "Cambios de plaza",
        icon: ArrowLeftRight,
        accent: "amber",
        dashed: true,
        desc: "Muestra solo las aduanas donde un titular cambió de plaza sin salir de la aduana.",
    },
    SALIDA_PUESTO: {
        label: "Otro puesto",
        icon: LogOut,
        accent: "gold",
        desc: "Muestra solo las aduanas con algún titular que dejó el puesto para ocupar otro distinto.",
    },
    BAJA: {
        label: "Bajas",
        icon: UserX,
        accent: "slate",
        desc: "Muestra solo las aduanas con algún titular dado de baja.",
    },
    INSUBSISTENCIA: {
        label: "Insubsistencias",
        icon: Ban,
        accent: "rose",
        desc: "Muestra solo las aduanas con algún nombramiento declarado insubsistente (anulado, nunca llegó a ejercer).",
    },
    SIN_TITULAR: {
        label: "Acéfalas hoy",
        icon: AlertTriangle,
        accent: "rose",
        desc: "Muestra solo las aduanas que hoy no tienen titular.",
    },
    VACANCIA: {
        label: "Con vacancias",
        icon: Clock,
        accent: "slate",
        desc: "Muestra solo las aduanas que en algún momento se quedaron sin titular.",
    },
};

const ACCENT_FILTRO = {
    maroon: { text: "text-[#621f32] dark:text-[#e3c793]", border: "border-[#621f32] dark:border-[#bc955c]", bg: "bg-[#621f32]/5 dark:bg-[#621f32]/15" },
    amber: { text: "text-amber-700 dark:text-amber-500", border: "border-amber-500 dark:border-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
    gold: { text: "text-[#7a5a30] dark:text-[#bc955c]", border: "border-[#bc955c] dark:border-[#bc955c]", bg: "bg-[#bc955c]/10" },
    slate: { text: "text-slate-700 dark:text-slate-200", border: "border-slate-500 dark:border-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50" },
    rose: { text: "text-rose-700 dark:text-rose-500", border: "border-rose-500 dark:border-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30" },
};

/**
 * Ficha de la fila de estadísticas: número (mono, como el resto de cifras de
 * la vista) + etiqueta debajo, sin píldora ni ícono de color de fondo — el
 * subrayado de 2px es la ÚNICA marca de color, y solo aparece si el filtro
 * está activo. Deliberadamente distinto del "chip con ícono" genérico.
 */
function ChipFiltro({ tipoKey, count, active, onToggle }) {
    const meta = FILTRO_META[tipoKey];
    const Icon = meta.icon;
    const c = ACCENT_FILTRO[meta.accent];
    return (
        <div className="group/chip relative">
            <button
                type="button"
                onClick={() => onToggle(tipoKey)}
                aria-pressed={active}
                aria-label={meta.desc}
                className={`flex min-w-[64px] cursor-pointer flex-col items-start gap-1 border-b-2 px-3 py-2 text-left transition-colors ${
                    active ? `${meta.dashed ? "border-dashed" : "border-solid"} ${c.border} ${c.bg}` : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40"
                }`}
            >
                <span className="flex items-center gap-1.5">
                    <Icon className={`size-3 shrink-0 ${active ? c.text : "text-slate-400"}`} />
                    <span className={`font-mono text-sm font-black leading-none ${active ? c.text : "text-slate-700 dark:text-slate-200"}`}>{count}</span>
                </span>
                <span className={`text-[8px] font-bold uppercase tracking-wider ${active ? c.text : "text-slate-400"}`}>{meta.label}</span>
            </button>

            {/* Tooltip propio (no `title` nativo): explica en lenguaje de
                negocio qué hará el clic, aparece arriba de la ficha. */}
            <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-[10px] font-semibold normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/chip:opacity-100 group-focus-within/chip:opacity-100 dark:bg-slate-800"
            >
                {active ? "Ya está aplicado. Clic de nuevo para quitarlo y ver todas las aduanas." : meta.desc}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
            </div>
        </div>
    );
}

function StatPlano({ icon: Icon, value, label }) {
    return (
        <span className="flex flex-col items-start gap-1 px-3 py-2">
            <span className="flex items-center gap-1.5">
                <Icon className="size-3 shrink-0 text-[#bc955c]" />
                <span className="font-mono text-sm font-black leading-none text-slate-700 dark:text-slate-200">{value}</span>
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        </span>
    );
}

const fecha = (valor) => (valor ? formatDateEsMx(valor) : "—");

const duracion = (dias) => {
    if (dias === null || dias === undefined) return "";
    if (dias < 365) return `${dias} ${dias === 1 ? "día" : "días"}`;
    return `${(dias / 365.25).toFixed(1).replace(".", ",")} años`;
};

/** Días entre dos fechas ISO ("YYYY-MM-DD"); `hasta` nulo = hoy. */
const diasEntre = (desde, hasta) => {
    if (!desde) return null;
    const fin = hasta ? new Date(hasta) : new Date();
    const ini = new Date(desde);
    const ms = fin - ini;
    return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
};

/**
 * Nombramiento declarado insubsistente: una BAJA cuyo motivo es justo eso
 * (texto crudo de cp_tbl_mov_completo_29_05_26, p. ej. "Insubsistencia
 * Nombramiento*") — el nombramiento se anuló, el titular nunca llegó a
 * ejercer realmente. Caso real conocido: 1 de 728 filas de titularidad,
 * mismo día entrada+salida (ver plaza 10300079, Ciudad Reynosa, 2025-09-01).
 */
const esInsubsistencia = (segmento) =>
    segmento.tipoSalida === "BAJA" && normalizeForSearch(segmento.salidaMotivo || "").includes("insubsistencia");

/** Llave única de una gestión: aduana + titular + fecha en que entró a ella. */
const claveGestion = (aduanaNombre, gestion) => `${aduanaNombre}|${gestion.num_empleado}|${gestion.fecha_entrada}`;

/**
 * Parte el tramo de una gestión (entrada + `movimientos`) en rachas
 * consecutivas de la misma `posicion` — cada racha es una tarjeta que vive en
 * la subcolumna (carril) de esa plaza.
 *
 * `items` es la fila REAL de cp_tbl_mov_completo_29_05_26 de cada movimiento
 * del tramo (entrada incluida vía `entrada_completo`, todas las columnas —
 * ver _fila_completa en rotacion_aduanas.py), en el mismo orden cronológico
 * (fecha_efectiva ASC, sec ASC — ver _trayectorias_de_titulares en views.py)
 * en que el backend ya arma el tramo. El diff de cada movimiento NUNCA se
 * reinicia al cambiar de plaza: se empareja contra el índice `idx - 1` de
 * `items`, campo por campo (getMovimientoDiff recorre TODAS las columnas no
 * ignoradas), igual que HistorialMovimientosTab empareja `movimientos[i]`
 * contra `movimientos[i-1]` de su propia lista plana sin importar en qué
 * carril caiga cada uno. Un cambio de plaza es apenas OTRA diferencia
 * detectada (`posicion`), no un corte en la cadena de comparación.
 *
 * El primer ítem de la gestión (la entrada) no entra al acordeón de ningún
 * segmento: no tiene un predecesor válido DENTRO de esta gestión (el
 * movimiento anterior real pertenece a otro puesto/aduana). El resto de los
 * ítems que abren un segmento nuevo (cambios de plaza) sí se muestran — son
 * el movimiento real que causó el cambio y su predecesor es el último ítem
 * del segmento anterior.
 */
function construirSegmentos(gestion) {
    // Fallback defensivo: una respuesta cacheada de ANTES de que el backend
    // empezara a mandar `entrada_completo` (rollout/caché de 30 min) no trae
    // ese campo — se arma una fila mínima en su lugar en vez de tronar; el
    // diff del primer movimiento pierde riqueza hasta que el caché se
    // refresque, pero la columna sigue siendo usable.
    const entrada = gestion.entrada_completo || {
        posicion: gestion.plaza_entrada,
        fecha_efectiva: gestion.fecha_entrada,
        motivo_nombre: gestion.entrada_motivo_nombre,
        nivel_tabular: gestion.nivel_tabular,
    };
    const items = [entrada, ...(gestion.movimientos || [])];

    const crudos = [];
    items.forEach((item, idx) => {
        const ultimo = crudos[crudos.length - 1];
        if (ultimo && ultimo.plaza === item.posicion) {
            ultimo.idxs.push(idx);
        } else {
            crudos.push({ plaza: item.posicion, idxs: [idx] });
        }
    });

    return crudos.map((seg, i) => {
        const esPrimero = i === 0;
        const esUltimo = i === crudos.length - 1;
        const siguiente = crudos[i + 1];
        const idxInicio = seg.idxs[0];
        const idxsMostrados = esPrimero ? seg.idxs.slice(1) : seg.idxs;

        // Solo el último segmento de una gestión que sale por SALIDA_PUESTO
        // tiene a dónde expandirse: `salida_completo` es la MISMA fila que
        // describe la entrada al nuevo puesto (ver rotacion_aduanas.py), así
        // que diffearla contra el último movimiento dentro de la aduana
        // (`items[items.length - 1]`) muestra exactamente qué cambió al
        // salir de la titularidad. Fallback defensivo: si la respuesta viene
        // de un caché anterior a que el backend mandara `salida_completo`,
        // simplemente no hay botón de detalle (no hay dato que mostrar).
        const siguienteMovimiento =
            esUltimo && gestion.tipo_salida === "SALIDA_PUESTO" && gestion.salida_completo
                ? { item: gestion.salida_completo, anterior: items[items.length - 1] }
                : null;

        return {
            clave: `${gestion.aduana}|${gestion.num_empleado}|${gestion.fecha_entrada}|seg${i}`,
            claveGestion: claveGestion(gestion.aduana, gestion),
            plaza: seg.plaza,
            esPrimero,
            esUltimo,
            fechaDesde: items[idxInicio].fecha_efectiva,
            fechaHasta: esUltimo ? gestion.fecha_salida : items[siguiente.idxs[0]].fecha_efectiva,
            fechaCapturaDesde: items[idxInicio].fecha_captura,
            fechaCapturaHasta: esUltimo ? gestion.salida_fecha_captura : items[siguiente.idxs[0]].fecha_captura,
            entradaMotivo: esPrimero ? gestion.entrada_motivo_nombre : items[idxInicio].motivo_nombre,
            entradaOrigen: esPrimero ? gestion.origen : { tipo: "PLAZA", valor: items[idxInicio - 1].posicion },
            salidaMotivo: esUltimo ? gestion.salida_motivo_nombre : items[siguiente.idxs[0]].motivo_nombre,
            tipoSalida: esUltimo ? gestion.tipo_salida : "CAMBIO_PLAZA",
            salidaDestinoUnidad: esUltimo ? gestion.salida_destino_unidad : null,
            salidaDestinoPuesto: esUltimo ? gestion.salida_destino_puesto : null,
            salidaDestinoPlaza: esUltimo ? null : siguiente.plaza,
            // Clave del segmento que sigue DENTRO de esta misma gestión (el
            // siguiente cambio de plaza) — permite enlazar el Excel sin
            // adivinar por posición de fila, igual que `destinoSegmentoPorClave`
            // hace para TRASLADO_ADUANA a nivel de aduana distinta.
            claveSiguienteSegmento: esUltimo ? null : `${gestion.aduana}|${gestion.num_empleado}|${gestion.fecha_entrada}|seg${i + 1}`,
            // Espejo de la anterior, para enlazar "Procedencia" cuando viene
            // de un cambio de plaza DENTRO de esta misma gestión.
            claveSegmentoAnterior: esPrimero ? null : `${gestion.aduana}|${gestion.num_empleado}|${gestion.fecha_entrada}|seg${i - 1}`,
            siguienteMovimiento,
            movimientos: idxsMostrados.map((idx) => ({ item: items[idx], anterior: items[idx - 1] })),
            gestion,
        };
    });
}

/**
 * Línea de tiempo completa de una aduana: segmentos (uno por racha de plaza
 * de cada gestión) + vacancias, todo en un solo arreglo cronológico — mismo
 * papel que `movimientos` en Historial, pero aquí puede mezclar varios
 * titulares distintos porque es una aduana, no una persona.
 *
 * Cada vacancia se "ancla" a la plaza que quedó vacía (la del segmento
 * anterior) o, si no hay anterior, a la del segmento siguiente — así siempre
 * cae en una subcolumna concreta y el conector con sus vecinos tiene de dónde
 * salir/llegar.
 */
function construirEntradasAduana(aduana) {
    const entradas = [];
    (aduana.gestiones || []).forEach((gestion) => {
        construirSegmentos(gestion).forEach((seg) => {
            entradas.push({ tipo: "segmento", fecha: seg.fechaDesde, clave: seg.clave, dato: seg });
        });
    });
    (aduana.vacancias || []).forEach((v, i) => {
        entradas.push({
            tipo: "vacancia",
            fecha: v.desde,
            clave: `vac|${aduana.aduana}|${v.desde}|${i}`,
            dato: v,
        });
    });

    entradas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    entradas.forEach((e, i) => {
        if (e.tipo !== "vacancia") return;
        const anterior = entradas[i - 1];
        const siguiente = entradas[i + 1];
        e.dato.plazaAncla =
            (anterior?.tipo === "segmento" && anterior.dato.plaza) ||
            (siguiente?.tipo === "segmento" && siguiente.dato.plaza) ||
            (aduana.plazas || [])[0] ||
            "—";
    });

    return entradas;
}

/**
 * Para cada gestión que sale por TRASLADO_ADUANA, resuelve la llave de la
 * gestión que la recibe en la aduana destino. El backend garantiza que ambas
 * describen la MISMA fila de movimiento (ver rotacion_aduanas.py:_armar_gestion):
 * la salida de una es literalmente la entrada de la otra, así que el cruce
 * por aduana+num_empleado+fecha nunca es ambiguo.
 */
function construirDestinos(aduanas) {
    const porClave = new Map();
    aduanas.forEach((a) => {
        (a.gestiones || []).forEach((g) => {
            porClave.set(claveGestion(a.aduana, g), true);
        });
    });

    const destinoPorClave = new Map();
    aduanas.forEach((a) => {
        (a.gestiones || []).forEach((g) => {
            if (g.tipo_salida !== "TRASLADO_ADUANA" || !g.salida_destino_unidad) return;
            const haciaClave = `${g.salida_destino_unidad}|${g.num_empleado}|${g.fecha_salida}`;
            if (!porClave.has(haciaClave)) return;
            destinoPorClave.set(claveGestion(a.aduana, g), haciaClave);
        });
    });
    return destinoPorClave;
}

function TarjetaVacancia({ vacancia }) {
    return (
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
                <AlertTriangle className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {vacancia.abierta ? "Acéfala hoy" : "Sin titular"}
                </span>
                <span className="ml-auto font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {duracion(vacancia.dias)}
                </span>
            </div>
            <p className="mt-2 border-t border-dashed border-slate-300/70 pt-2 font-mono text-[10px] text-slate-500 dark:border-slate-700/60 dark:text-slate-500">
                {fecha(vacancia.desde)} → {vacancia.hasta ? fecha(vacancia.hasta) : "hoy"}
            </p>
        </div>
    );
}

/**
 * Fila de un movimiento dentro del acordeón "N mov." de una tarjeta de
 * segmento — su propio botón/flecha despliega el diff contra el registro
 * INMEDIATO ANTERIOR (el movimiento previo del mismo tramo, o la entrada a
 * la plaza si es el primero), igual mecánica que MovementCard en
 * HistorialMovimientosTab.
 */
function FilaMovimiento({ mov, diff }) {
    const [abierta, setAbierta] = useState(false);
    const [showUnchanged, setShowUnchanged] = useState(false);
    const detailRef = useRef(null);

    // Entrada del panel de diff: SOLO fundido + deslizado (nunca `height`) —
    // el panel nace ya a su alto natural ("auto"), así que abrir "Sin
    // cambios" después (que agrega contenido al mismo contenedor) lo hace
    // crecer solo, sin que quede un alto fijo pegado de una animación previa
    // que lo recorte. Las filas de "Cambios detectados" entran en cascada.
    useGSAP(() => {
        if (!abierta || !detailRef.current) return;
        const el = detailRef.current;
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from(el, { autoAlpha: 0, y: -6, duration: 0.28 });
        const filas = el.querySelectorAll(".diff-row");
        if (filas.length) tl.from(filas, { autoAlpha: 0, x: -8, stagger: 0.04, duration: 0.22, ease: "power1.out" }, "-=0.12");
    }, { dependencies: [abierta] });

    // "Sin cambios" es un despliegue aparte — se anima independiente para no
    // repetir la entrada de todo el panel cada vez que se abre/cierra.
    useGSAP(() => {
        if (!showUnchanged || !detailRef.current) return;
        const chips = detailRef.current.querySelectorAll(".unchanged-chip");
        if (chips.length) gsap.from(chips, { autoAlpha: 0, y: 4, stagger: 0.02, duration: 0.2, ease: "power1.out" });
    }, { dependencies: [showUnchanged] });

    return (
        <li className="text-[10px]">
            <button
                type="button"
                onClick={() => setAbierta((v) => !v)}
                aria-expanded={abierta}
                className="flex w-full cursor-pointer items-baseline gap-2 text-left transition-colors hover:text-[#621f32] dark:hover:text-[#bc955c]"
            >
                <span className="w-[62px] shrink-0 font-mono text-slate-400">{fecha(mov.fecha_efectiva)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">{mov.motivo_nombre}</span>
                {mov.sal_base ? (
                    <span className="shrink-0 font-mono text-slate-400">
                        ${Math.round(mov.sal_base).toLocaleString("es-MX")}
                    </span>
                ) : null}
                <ChevronDown className={`size-3 shrink-0 text-slate-400 transition-transform ${abierta ? "rotate-180" : ""}`} />
            </button>

            {abierta && (
                <div ref={detailRef} className="mt-1.5 mb-1 overflow-hidden rounded-lg border border-dashed border-[#621f32]/20 bg-[#621f32]/[0.03] px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                    <h6 className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">
                        Cambios detectados{diff.differences.length > 0 ? ` (${diff.differences.length})` : ""}
                    </h6>
                    {diff.differences.length === 0 ? (
                        <p className="text-[9px] italic text-slate-400">Sin cambios de datos respecto al movimiento anterior.</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {diff.differences.map((d) => (
                                <div key={d.key} className="diff-row flex flex-wrap items-center gap-1 rounded border border-slate-100 bg-white px-1.5 py-1 text-[9px] dark:border-slate-800 dark:bg-slate-950">
                                    <span className="mr-0.5 font-black text-slate-600 dark:text-slate-300">{d.label}:</span>
                                    <span className="rounded bg-slate-100 px-1 py-0.5 italic text-slate-400 line-through dark:bg-slate-800 dark:text-slate-600">{d.oldValue}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="rounded bg-[#621f32]/10 px-1 py-0.5 font-black text-[#621f32] dark:bg-[#bc955c]/10 dark:text-[#e3c793]">{d.newValue}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {diff.unchanged.length > 0 && (
                        <div className="mt-1.5">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowUnchanged((v) => !v); }}
                                className="mb-1 flex cursor-pointer items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                            >
                                <ChevronDown className={`size-2.5 transition-transform ${showUnchanged ? "rotate-180" : ""}`} />
                                Sin cambios ({diff.unchanged.length})
                            </button>
                            {showUnchanged && (
                                <div className="flex flex-col gap-1">
                                    {diff.unchanged.map((u) => (
                                        <span key={u.key} title={u.value} className="unchanged-chip truncate rounded bg-slate-100 px-1 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-500">
                                            {u.label}: {u.value}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </li>
    );
}

/**
 * Panel del botón "Pasó a otro puesto" → flecha hacia abajo: diff campo por
 * campo entre la fila que lo saca de la aduana (`mov`, que por construcción
 * ya ES la fila de entrada al nuevo puesto — ver rotacion_aduanas.py) y el
 * último movimiento que tuvo DENTRO de la titularidad de esta aduana
 * (`anterior`). Misma mecánica visual que el acordeón "N mov." / FilaMovimiento,
 * pero independiente: aquí no hay fila que colapsar, solo el detalle.
 */
function PanelSiguienteMovimiento({ mov, anterior }) {
    const diff = useMemo(() => getMovimientoDiff(mov, anterior), [mov, anterior]);
    const [showUnchanged, setShowUnchanged] = useState(false);
    const panelRef = useRef(null);

    useGSAP(() => {
        if (!panelRef.current) return;
        const el = panelRef.current;
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from(el, { autoAlpha: 0, y: -6, duration: 0.28 });
        const filas = el.querySelectorAll(".diff-row");
        if (filas.length) tl.from(filas, { autoAlpha: 0, x: -8, stagger: 0.04, duration: 0.22, ease: "power1.out" }, "-=0.12");
    }, []);

    return (
        <div ref={panelRef} className="mt-2 overflow-hidden rounded-lg border border-dashed border-[#bc955c]/30 bg-[#bc955c]/[0.04] px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <h6 className="text-[8px] font-black uppercase tracking-widest text-[#7a5a30] dark:text-[#bc955c]">
                    Siguiente movimiento{diff.differences.length > 0 ? ` (${diff.differences.length} cambios)` : ""}
                </h6>
                <span className="shrink-0 font-mono text-[9px] font-bold text-slate-400">
                    {fecha(mov.fecha_efectiva)}
                    {mov.fecha_captura && (
                        <span className="ml-1.5 font-semibold text-slate-400/70" title="Fecha de captura">
                            · Cap. {fecha(mov.fecha_captura)}
                        </span>
                    )}
                </span>
            </div>
            <p className="mb-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                {mov.motivo_nombre}
                {mov.cd_puesto && <span className="font-bold text-[#7a5a30] dark:text-[#bc955c]"> · {mov.cd_puesto}</span>}
            </p>
            {diff.differences.length === 0 ? (
                <p className="text-[9px] italic text-slate-400">Sin cambios de datos respecto a la salida de la aduana.</p>
            ) : (
                <div className="flex flex-col gap-1">
                    {diff.differences.map((d) => (
                        <div key={d.key} className="diff-row flex flex-wrap items-center gap-1 rounded border border-slate-100 bg-white px-1.5 py-1 text-[9px] dark:border-slate-800 dark:bg-slate-950">
                            <span className="mr-0.5 font-black text-slate-600 dark:text-slate-300">{d.label}:</span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 italic text-slate-400 line-through dark:bg-slate-800 dark:text-slate-600">{d.oldValue}</span>
                            <span className="text-slate-400">→</span>
                            <span className="rounded bg-[#621f32]/10 px-1 py-0.5 font-black text-[#621f32] dark:bg-[#bc955c]/10 dark:text-[#e3c793]">{d.newValue}</span>
                        </div>
                    ))}
                </div>
            )}
            {diff.unchanged.length > 0 && (
                <div className="mt-1.5">
                    <button
                        type="button"
                        onClick={() => setShowUnchanged((v) => !v)}
                        className="mb-1 flex cursor-pointer items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
                    >
                        <ChevronDown className={`size-2.5 transition-transform ${showUnchanged ? "rotate-180" : ""}`} />
                        Sin cambios ({diff.unchanged.length})
                    </button>
                    {showUnchanged && (
                        <div className="flex flex-col gap-1">
                            {diff.unchanged.map((u) => (
                                <span key={u.key} title={u.value} className="unchanged-chip truncate rounded bg-slate-100 px-1 py-0.5 text-[8px] font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-500">
                                    {u.label}: {u.value}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TarjetaSegmento({ segmento, clave, cardRef, canViewPhoto, scrollRootRef, claveDestino, onIrADestino }) {
    const [abierta, setAbierta] = useState(false);
    const [mostrarSiguiente, setMostrarSiguiente] = useState(false);
    const meta = TIPO_SALIDA[segmento.tipoSalida] || TIPO_SALIDA.BAJA;
    const g = segmento.gestion;
    const movimientos = segmento.movimientos || [];
    const dias = diasEntre(segmento.fechaDesde, segmento.fechaHasta);

    return (
        <div ref={cardRef} className={`rounded-xl border shadow-sm transition-all hover:shadow-md hover:border-[#bc955c]/50 ${ESTILO_TARJETA[meta.clase]}`}>
            <div className="p-3.5">
                <div className="flex items-start gap-2.5">
                    <FotoEmpleadoCell
                        numempleado={g.num_empleado}
                        rootRef={scrollRootRef}
                        enabled={canViewPhoto}
                        size={36}
                        caption={g.cd_puesto ? `${g.nombre} · ${g.cd_puesto}` : g.nombre}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <h4 className="min-w-0 truncate text-[12px] font-black uppercase leading-tight tracking-tight text-[#621f32] dark:text-[#e3c793]">
                                {g.nombre}
                            </h4>
                            {g.corregida_por_mov_pos && (
                                <span
                                    title="Unidad corregida contra MOV_POS: la fila de personal conservó el código de unidad anterior a la renumeración."
                                    className="shrink-0 cursor-help rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                >
                                    ajustada
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-slate-400">#{g.num_empleado}</p>
                    </div>
                </div>

                {/* Periodo de fechas efectivas de este segmento (plaza), misma
                    cuadrícula Desde/Hasta que usa HistorialMovimientosTab. */}
                <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Desde</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{fecha(segmento.fechaDesde)}</span>
                    </div>
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Hasta</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                            {segmento.fechaHasta ? fecha(segmento.fechaHasta) : "hoy"}
                        </span>
                    </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] font-medium text-slate-400">
                    <Calendar className="size-3 shrink-0" />
                    {duracion(dias)}
                </div>

                <div className="mt-3 space-y-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                    <p>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Entra</span>{" "}
                        {segmento.entradaMotivo}
                        {segmento.entradaOrigen?.tipo === "ADUANA" && (
                            <span className="text-slate-400"> · desde {nombreCorto(segmento.entradaOrigen.valor)}</span>
                        )}
                        {segmento.entradaOrigen?.tipo === "PLAZA" && (
                            <span className="font-bold text-amber-700 dark:text-amber-500"> · desde plaza {segmento.entradaOrigen.valor}</span>
                        )}
                    </p>
                    {segmento.salidaMotivo && (
                        <p>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Sale</span>{" "}
                            {segmento.salidaMotivo}
                            {segmento.tipoSalida === "TRASLADO_ADUANA" && segmento.salidaDestinoUnidad && (
                                <span className="font-bold text-amber-700 dark:text-amber-500">
                                    {" "}
                                    · a {nombreCorto(segmento.salidaDestinoUnidad)}
                                </span>
                            )}
                            {segmento.tipoSalida === "SALIDA_PUESTO" && segmento.salidaDestinoPuesto && (
                                <span className="font-bold text-[#7a5a30] dark:text-[#bc955c]">
                                    {" "}
                                    · {segmento.salidaDestinoPuesto}
                                </span>
                            )}
                            {segmento.tipoSalida === "CAMBIO_PLAZA" && segmento.salidaDestinoPlaza && (
                                <span className="font-bold text-amber-700 dark:text-amber-500">
                                    {" "}
                                    · a plaza {segmento.salidaDestinoPlaza}
                                </span>
                            )}
                        </p>
                    )}
                    <p className="font-mono text-[10px] text-slate-400">
                        Plaza {segmento.plaza} · {g.nivel_tabular} · {g.cd_puesto}
                    </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    {claveDestino ? (
                        <button
                            type="button"
                            onClick={() => onIrADestino(claveDestino, clave)}
                            title="Ir a la tarjeta donde llega a la aduana destino"
                            className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-transform hover:scale-105 ${ESTILO_ETIQUETA[meta.clase]}`}
                        >
                            {meta.etiqueta}
                            <ArrowRight className="size-2.5" />
                        </button>
                    ) : (
                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${ESTILO_ETIQUETA[meta.clase]}`}>
                            {meta.etiqueta}
                        </span>
                    )}
                    {segmento.siguienteMovimiento && (
                        <button
                            type="button"
                            onClick={() => setMostrarSiguiente((v) => !v)}
                            aria-expanded={mostrarSiguiente}
                            title="Ver el siguiente movimiento y qué cambió al salir de la aduana"
                            className={`flex cursor-pointer items-center justify-center rounded-md p-1 transition-colors hover:opacity-75 ${ESTILO_ETIQUETA[meta.clase]}`}
                        >
                            <ChevronDown className={`size-3 transition-transform ${mostrarSiguiente ? "rotate-180" : ""}`} />
                        </button>
                    )}
                    {movimientos.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setAbierta((v) => !v)}
                            aria-expanded={abierta}
                            className="ml-auto flex cursor-pointer items-center gap-1 text-[10px] font-bold text-slate-400 transition-colors hover:text-[#621f32] dark:hover:text-[#bc955c]"
                        >
                            {movimientos.length} mov.
                            <ChevronDown className={`size-3 transition-transform ${abierta ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>

                {mostrarSiguiente && segmento.siguienteMovimiento && (
                    <PanelSiguienteMovimiento
                        mov={segmento.siguienteMovimiento.item}
                        anterior={segmento.siguienteMovimiento.anterior}
                    />
                )}
            </div>

            <AnimatePresence initial={false}>
                {abierta && movimientos.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-slate-200/70 dark:border-slate-700/70"
                    >
                        <ul className="space-y-1 px-4 py-3">
                            {movimientos.map(({ item, anterior }, i) => (
                                <FilaMovimiento
                                    key={`${item.fecha_efectiva}-${i}`}
                                    mov={item}
                                    diff={getMovimientoDiff(item, anterior)}
                                />
                            ))}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function nombreCorto(nombre) {
    if (!nombre) return "";
    return nombre.split(" con sede")[0].replace(/^Aduana del /, "").replace(/^Aduana de /, "").trim();
}

/**
 * Código de UA VIGENTE de una aduana — `codigos_ua` (backend) junta TODOS los
 * códigos que tuvo alguna vez (antes y después de la renumeración del
 * 2022-07-01) sin orden cronológico, así que mostrarlo tal cual confunde
 * (p. ej. "107 → 183" en Ciudad Reynosa sugiere que 107 es el código viejo
 * cuando es al revés). `codigo_ua_actual` ya viene resuelto contra el
 * catálogo vigente; el fallback al último de `codigos_ua` es solo para
 * cachés viejas de antes de que el backend mandara ese campo.
 */
function codigoUaActual(aduana) {
    return aduana.codigo_ua_actual || aduana.codigos_ua?.[aduana.codigos_ua.length - 1] || "—";
}

// ─── Exportación a Excel ────────────────────────────────────────────────────
// Reporte formal (membretado institucional REPETIDO por rebanada de página —
// ver addLetterheadRepetido más abajo, distinto del membrete único que usa
// el resto del sistema en excelLetterhead.js) con una leyenda de colores
// propia del diagrama (además de la leyenda de generación que ya trae el
// membrete) y una fila-banda por aduana para conservar, en formato tabular,
// la misma agrupación "una columna por aduana" que se ve en pantalla.

// Mismos 6 tipos que TIPO_SALIDA + VACANCIA (que en pantalla es su propia
// tarjeta, sin tipoSalida) — fondo claro + texto oscuro para que se lea bien
// impreso, salvo ACTIVO que usa el guinda institucional sólido para resaltar
// al titular vigente igual que la cabecera "Vigente" del carril en pantalla.
const EXCEL_TIPO_COLOR = {
    ACTIVO: { bg: "FF621F32", text: "FFFFFFFF" },
    TRASLADO_ADUANA: { bg: "FFFEF3C7", text: "FF92400E" },
    CAMBIO_PLAZA: { bg: "FFFDE68A", text: "FF78350F" },
    SALIDA_PUESTO: { bg: "FFEFE3D0", text: "FF7A5A30" },
    BAJA: { bg: "FFE2E8F0", text: "FF334155" },
    INSUBSISTENCIA: { bg: "FFFECACA", text: "FF991B1B" },
    VACANCIA: { bg: "FFF1F5F9", text: "FF64748B" },
};
// Tinte suave para resaltar la FILA COMPLETA de una insubsistencia (no solo
// la celda de tipo) — "destacar", a pedido explícito, no solo clasificar.
const EXCEL_FILA_INSUBSISTENCIA_BG = "FFFEF2F2";

// Etiquetas cortas (caben en la columna angosta del layout 2x3 del Excel
// sin necesitar dos líneas) + descripción breve — el detalle largo ya no
// hace falta aquí, la columna "Tipo de Movimiento" de la tabla usa la
// etiqueta completa de TIPO_SALIDA.
const EXCEL_LEYENDA = [
    { tipo: "ACTIVO", label: "Activo", desc: "Sigue activo en la plaza hoy." },
    { tipo: "TRASLADO_ADUANA", label: "Traslado", desc: "Se fue a otra aduana." },
    { tipo: "CAMBIO_PLAZA", label: "Cambio plaza", desc: "Cambió de plaza, misma aduana." },
    { tipo: "SALIDA_PUESTO", label: "Otro puesto", desc: "Dejó el puesto de mando." },
    { tipo: "BAJA", label: "Baja", desc: "Baja del sistema." },
    { tipo: "VACANCIA", label: "Vacante", desc: "Sin titular en ese periodo." },
];

const EXPORT_COLUMNS_ROTACION = [
    { key: "aduana", header: "Aduana", width: 30 },
    { key: "codigosUa", header: "Código UA", width: 13 },
    { key: "plaza", header: "Plaza", width: 13 },
    { key: "nivel", header: "Nivel Tabular", width: 13 },
    { key: "puesto", header: "Código de Puesto", width: 15 },
    { key: "nombrePuestoFuncional", header: "Nombre Puesto Funcional", width: 34 },
    { key: "numEmpleado", header: "No. Empleado", width: 12 },
    { key: "titular", header: "Titular", width: 32 },
    { key: "fechaDesde", header: "Fecha Efectiva Desde", width: 14 },
    { key: "fechaCapturaDesde", header: "Fecha Captura Desde", width: 14 },
    { key: "fechaHasta", header: "Fecha Efectiva Hasta", width: 14 },
    { key: "fechaCapturaHasta", header: "Fecha Captura Hasta", width: 14 },
    { key: "duracion", header: "Duración", width: 14 },
    { key: "motivoEntrada", header: "Motivo de Entrada", width: 30 },
    { key: "procedencia", header: "Procedencia", width: 26 },
    { key: "motivoSalida", header: "Motivo de Salida", width: 30 },
    { key: "tipoMovimiento", header: "Tipo de Movimiento", width: 22 },
    { key: "destino", header: "Destino", width: 26 },
    // Detalle del puesto destino (solo SALIDA_PUESTO, vía gestion.salida_completo)
    // en columnas propias en vez de todo apachurrado en "Destino".
    { key: "puestoDestino", header: "Código Puesto Destino", width: 18 },
    { key: "nombrePuestoFuncionalDestino", header: "Nombre Puesto Funcional Destino", width: 34 },
    { key: "uaDestino", header: "UA Destino", width: 26 },
    { key: "deptoDestino", header: "Departamento Destino", width: 18 },
    { key: "depDirectaDestino", header: "Dependencia Directa Destino", width: 20 },
];

// Alto de fila / tamaño de imagen calibrados con margen (mismo criterio que
// downloadExcelConFoto en HistorialMovimientosTab: la fila necesita más aire
// que la imagen para que esta NUNCA toque el borde inferior — una imagen
// flotante se dibuja POR ENCIMA de los bordes de celda).
const FOTO_ROW_HEIGHT = 78;
const FOTO_COL_WIDTH = 20;

/**
 * Trae, en paralelo con concurrencia acotada, la fotografía de cada
 * `numempleado` único vía el mismo endpoint (`EmpleadoFotoView`) que ya usa
 * la tarjeta en pantalla (FotoEmpleadoCell) — permission-gated por
 * `canViewPhoto` sin necesidad de checar nada nuevo aquí. Concurrencia (no
 * secuencial) porque una rotación típica trae más de 100 titulares distintos
 * y pedirlos uno por uno haría el export insoportablemente lento; acotada
 * (no todo de golpe con Promise.all) para no tronar el backend con un pico
 * de peticiones simultáneas.
 */
async function precargarFotosRotacion(numerosEmpleado) {
    const unicos = [...new Set(numerosEmpleado.filter(Boolean).map(String))];
    const resultado = new Map();
    const CONCURRENCIA = 8;
    let idx = 0;

    async function worker() {
        while (idx < unicos.length) {
            const numero = unicos[idx++];
            try {
                const res = await VacantesService.getEmpleadoFoto(numero);
                if (res.ok) {
                    const blob = await res.blob();
                    const buffer = await blob.arrayBuffer();
                    resultado.set(numero, { buffer, extension: blob.type.includes("png") ? "png" : "jpeg" });
                }
            } catch {
                // Sin foto para este titular: se continúa con el resto.
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, unicos.length) }, worker));
    return resultado;
}

function textoOrigen(origen) {
    if (!origen) return "—";
    if (origen.tipo === "ADUANA") return `Aduana: ${nombreCorto(origen.valor)}`;
    if (origen.tipo === "PLAZA") return `Plaza ${origen.valor}`;
    if (origen.tipo === "PUESTO") return `Puesto ${origen.valor}`;
    return "—";
}

function textoDestino(seg) {
    if (seg.tipoSalida === "TRASLADO_ADUANA") return seg.salidaDestinoUnidad ? `Aduana: ${nombreCorto(seg.salidaDestinoUnidad)}` : "—";
    if (seg.tipoSalida === "CAMBIO_PLAZA") return seg.salidaDestinoPlaza ? `Plaza ${seg.salidaDestinoPlaza}` : "—";
    if (seg.tipoSalida === "SALIDA_PUESTO") return seg.salidaDestinoPuesto ? `Puesto ${seg.salidaDestinoPuesto}` : "—";
    return "—";
}

/**
 * Detalle del puesto destino, en columnas propias — solo para SALIDA_PUESTO,
 * a partir de `gestion.salida_completo` (fila cruda del movimiento que lo
 * saca de la aduana, ver rotacion_aduanas.py: es la MISMA fila que la
 * entrada al nuevo puesto). "—" en cualquier otro tipo de salida o si la
 * respuesta viene de un caché anterior a que el backend mandara ese campo.
 */
function detalleDestinoPuesto(seg) {
    const s = seg.tipoSalida === "SALIDA_PUESTO" ? seg.gestion?.salida_completo : null;
    if (!s) {
        return {
            puestoDestino: "—",
            nombrePuestoFuncionalDestino: "—",
            uaDestino: "—",
            deptoDestino: "—",
            depDirectaDestino: "—",
        };
    }
    return {
        puestoDestino: s.cd_puesto || "—",
        nombrePuestoFuncionalDestino: s.nombre_puesto_funcional || "—",
        uaDestino: s.un_admin ? `${s.un_admin}${s.desc_larga_un ? ` — ${nombreCorto(s.desc_larga_un)}` : ""}` : "—",
        deptoDestino: s.id_depto || "—",
        depDirectaDestino: s.depen_direc || "—",
    };
}

const LETTERHEAD_TITLE_LINES = [
    "AGENCIA NACIONAL DE ADUANAS DE MÉXICO",
    "UNIDAD DE ADMINISTRACIÓN Y FINANZAS",
    "DIRECCIÓN DE RECURSOS HUMANOS",
];

function fmtFechaHoraGeneracionLetterhead() {
    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const hora = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${hora} horas del ${fecha}`;
}

// Ancho, en columnas, de cada "rebanada" del membrete repetido — calibrado
// contra el reporte de referencia (4 copias de logo+título en un layout de
// 24 columnas, 6 columnas cada una).
const LETTERHEAD_SEGMENT_COLS = 6;

/**
 * Membretado institucional (logo + título + leyenda de generación) REPETIDO
 * cada `LETTERHEAD_SEGMENT_COLS` columnas a lo ancho de la hoja — a pedido
 * explícito, distinto del membrete único de `addExcelLetterhead` (compartido
 * por el resto de exports del sistema): esta tabla es demasiado ancha para
 * una sola página impresa, así que cada "rebanada" horizontal que Excel
 * imprime en su propia hoja de papel trae su propio logo/título en vez de
 * quedar sin membrete en las páginas 2, 3, 4...
 *
 * El logo se registra UNA sola vez (`workbook.addImage`) y se ancla N veces
 * — cada ancla es una referencia barata, no duplica los bytes de la imagen.
 */
function addLetterheadRepetido(workbook, worksheet, numCols, logoWidth = 260) {
    const logoHeight = Math.round((logoWidth * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);
    const imageId = workbook.addImage({ base64: LETTERHEAD_LOGO_BASE64, extension: "png" });
    const fechaGeneracion = fmtFechaHoraGeneracionLetterhead();

    const segmentos = [];
    for (let inicio = 1; inicio <= numCols; inicio += LETTERHEAD_SEGMENT_COLS) {
        segmentos.push([inicio, Math.min(inicio + LETTERHEAD_SEGMENT_COLS - 1, numCols)]);
    }

    segmentos.forEach(([colIni]) => {
        worksheet.addImage(imageId, {
            tl: { col: colIni - 1 + 0.05, row: 0.05 },
            ext: { width: logoWidth, height: logoHeight },
        });
    });
    worksheet.getRow(1).height = Math.max(Math.round(logoHeight * 1.05), 34);

    segmentos.forEach(([colIni, colFin]) => {
        const letraIni = worksheet.getColumn(colIni).letter;
        const letraFin = worksheet.getColumn(colFin).letter;
        worksheet.mergeCells(`${letraIni}2:${letraFin}2`);
        const cell = worksheet.getCell(`${letraIni}2`);
        cell.value = LETTERHEAD_TITLE_LINES.join("\n");
        cell.font = { bold: true, size: 11, name: "Calibri", color: { argb: "FF621F32" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    worksheet.getRow(2).height = 54;

    segmentos.forEach(([colIni, colFin]) => {
        const letraIni = worksheet.getColumn(colIni).letter;
        const letraFin = worksheet.getColumn(colFin).letter;
        worksheet.mergeCells(`${letraIni}3:${letraFin}3`);
        const cell = worksheet.getCell(`${letraIni}3`);
        cell.value = `Reporte generado por el sistema de control de plazas a las ${fechaGeneracion}.`;
        cell.font = { italic: true, size: 9, color: { argb: "FF64748B" }, name: "Calibri" };
        cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    worksheet.getRow(3).height = 18;

    worksheet.getRow(4).height = 8;

    return 4;
}

/**
 * Arma y descarga el Excel formal de rotación de titulares de aduanas:
 * membrete institucional, leyenda de colores del diagrama, y una fila por
 * segmento/vacancia (mismas `entradasPorAduana` que ya alimentan el
 * diagrama en pantalla) agrupadas por aduana con una banda separadora.
 * Exporta exactamente las aduanas visibles (`aduanas`, ya filtradas por
 * búsqueda/chips) para que el archivo coincida con lo que el usuario ve.
 */
async function exportarRotacionAExcel({ aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, filtrosTipo, canViewPhoto }) {
    // Fotos: una por titular ÚNICO (no por fila — el mismo titular puede
    // repetir varias filas/segmentos), pedidas ANTES de armar el workbook
    // porque cuántas columnas tiene la tabla (numCols, usado por el
    // membrete/leyenda/bandas de ancho completo) depende de si hay columna
    // "Foto" o no.
    let fotosPorEmpleado = new Map();
    if (canViewPhoto) {
        const numerosEmpleado = [];
        aduanas.forEach((aduana) => {
            (entradasPorAduana.get(aduana.aduana) || []).forEach((entrada) => {
                if (entrada.tipo === "segmento" && entrada.dato.gestion?.num_empleado) {
                    numerosEmpleado.push(entrada.dato.gestion.num_empleado);
                }
            });
        });
        fotosPorEmpleado = await precargarFotosRotacion(numerosEmpleado);
    }
    const incluirFotos = fotosPorEmpleado.size > 0;
    const imageIdPorEmpleado = new Map();

    const columns = incluirFotos
        ? [{ key: "__foto", header: "Foto", width: FOTO_COL_WIDTH }, ...EXPORT_COLUMNS_ROTACION]
        : EXPORT_COLUMNS_ROTACION;
    const tipoMovimientoCol = columns.findIndex((c) => c.key === "tipoMovimiento") + 1;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rotación de Aduanas");
    const numCols = columns.length;
    worksheet.columns = columns.map(({ key, width }) => ({ key, width }));

    // Logo más grande que el estándar (260px) — pedido explícito para este
    // reporte, no toca el tamaño de los demás exports del sistema.
    let row = addLetterheadRepetido(workbook, worksheet, numCols, 560) + 1;
    const lastCol = worksheet.getColumn(numCols).letter;

    // Título del reporte, ancho completo.
    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    const tituloCell = worksheet.getCell(`A${row}`);
    tituloCell.value = "ROTACIÓN DE TITULARES DE ADUANAS";
    tituloCell.font = { name: "Calibri", bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
    tituloCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(row).height = 26;
    row += 1;

    // Leyenda de tipos de movimiento: los 6 tipos en UNA sola fila,
    // repartidos a lo ancho de A:O (justo debajo del título del reporte) —
    // cada uno su propia franja de color con "Etiqueta: descripción breve".
    // Franjas balanceadas por ANCHO real de columna (no por cantidad de
    // columnas) para que la leyenda siga cubriendo A:{lastCol} completo
    // aunque la tabla tenga más columnas que antes (ver EXPORT_COLUMNS_ROTACION).
    // Franjas definidas contra el layout SIN columna "Foto" y desplazadas por
    // `colOffset` (1 si hay foto, 0 si no) — así la leyenda sigue cuadrando
    // exacto tenga o no esa columna extra.
    const colOffset = incluirFotos ? 1 : 0;
    const LEGEND_SPANS_BASE = [[1, 5], [6, 8], [9, 14], [15, 17], [18, 20], [21, EXPORT_COLUMNS_ROTACION.length]];
    const LEGEND_SPANS = LEGEND_SPANS_BASE.map(([a, b]) => [a + colOffset, b + colOffset]);
    const legendRowNum = row;
    EXCEL_LEYENDA.forEach(({ label, desc, tipo }, i) => {
        const [colIni, colFin] = LEGEND_SPANS[i];
        const letraIni = worksheet.getColumn(colIni).letter;
        const letraFin = worksheet.getColumn(colFin).letter;
        worksheet.mergeCells(`${letraIni}${legendRowNum}:${letraFin}${legendRowNum}`);
        const colores = EXCEL_TIPO_COLOR[tipo];
        const cell = worksheet.getCell(`${letraIni}${legendRowNum}`);
        cell.value = `${label}: ${desc}`;
        cell.font = { name: "Calibri", size: 14, bold: true, color: { argb: colores.text } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colores.bg } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        const chipBorder = { style: "thin", color: { argb: "FFFFFFFF" } };
        cell.border = { top: chipBorder, bottom: chipBorder, left: chipBorder, right: chipBorder };
    });
    // Fila más alta que antes (26 -> 56): letra 14pt en celdas angostas
    // envuelve a 2-3 líneas, con 26pt el texto se veía cortado.
    worksheet.getRow(legendRowNum).height = 56;
    row += 1;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    const statsCell = worksheet.getCell(`A${row}`);
    statsCell.value = `${resumen.aduanas} aduanas · ${resumen.titulares} titulares · ${resumen.gestiones} gestiones · ${resumen.vacancias} vacancias · ${resumen.acefalasHoy} acéfalas hoy`;
    statsCell.font = { name: "Calibri", italic: true, size: 10, color: { argb: "FF621F32" } };
    statsCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(row).height = 18;
    row += 1;

    const notasFiltro = [];
    if (busqueda?.trim()) notasFiltro.push(`búsqueda "${busqueda.trim()}"`);
    if (filtrosTipo?.length) notasFiltro.push(`filtro${filtrosTipo.length > 1 ? "s" : ""}: ${filtrosTipo.map((t) => FILTRO_META[t]?.label || t).join(", ")}`);
    if (notasFiltro.length > 0) {
        worksheet.mergeCells(`A${row}:${lastCol}${row}`);
        const filtroCell = worksheet.getCell(`A${row}`);
        filtroCell.value = `Vista exportada con ${notasFiltro.join(" · ")}.`;
        filtroCell.font = { name: "Calibri", italic: true, size: 9, color: { argb: "FFB45309" } };
        filtroCell.alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getRow(row).height = 16;
        row += 1;
    }

    row += 1;

    const headerRowNum = row;
    const headerRow = worksheet.getRow(headerRowNum);
    const goldBorder = { style: "thin", color: { argb: "FFBC955C" } };
    // Estilo por CELDA, acotado a `numCols` — nunca `headerRow.font/.fill`
    // directo (eso aplica el estilo al "row" de ExcelJS, que Excel renderiza
    // extendido hasta el final de la hoja: la fila de encabezado se ve
    // "infinita" hacia la derecha al abrir el archivo).
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.border = { top: goldBorder, left: goldBorder, bottom: goldBorder, right: goldBorder };
        cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    headerRow.height = 24;
    row += 1;

    const thinGray = { style: "thin", color: { argb: "FFE2E8F0" } };

    // Enlaces "Cambió de plaza" / "Pasó a otra aduana": se resuelven en una
    // segunda pasada, después de escribir TODAS las filas, porque el destino
    // de un traslado a otra aduana puede caer en una fila que todavía no se
    // ha escrito (esa aduana viene más abajo en el reporte) o ya se escribió
    // (viene más arriba) — no hay forma de saberlo de antemano.
    const filaPorClave = new Map(); // clave de segmento -> número de fila en el Excel
    const enlacesPendientes = []; // { filaOrigen, columna, claveDestino } | { filaOrigen, columna, claveViaOrigen }

    // Inverso de destinoSegmentoPorClave, pero a nivel de SEGMENTO (no de
    // gestión): se llena durante el recorrido principal, justo cuando se
    // procesa la fila que SALE por TRASLADO_ADUANA (ahí es donde se conoce a
    // la vez la clave del segmento que sale y la del segmento al que llega —
    // ver más abajo). Alimenta el enlace de "Procedencia" en la fila de
    // llegada cuando el origen fue otra aduana. Queda completo recién al
    // terminar el recorrido, por eso "Procedencia" también se resuelve en la
    // segunda pasada, nunca en el momento de escribir esa fila.
    const origenSegmentoPorClave = new Map();

    aduanas.forEach((aduana) => {
        const entradas = entradasPorAduana.get(aduana.aduana) || [];

        // Banda por aduana: una sola celda ancho completo con el titular
        // actual (o "Sin titular actualmente") — el nombre de la aduana y el
        // código UA ya están en las columnas de la tabla de cada fila, no
        // hace falta repetirlos aquí.
        const tieneTitular = !!aduana.titular_actual;
        const bandaRow = worksheet.getRow(row);

        worksheet.mergeCells(`A${row}:${lastCol}${row}`);
        const estadoCell = worksheet.getCell(`A${row}`);
        estadoCell.value = tieneTitular ? `Titular actual: ${aduana.titular_actual}` : "Sin titular actualmente";
        estadoCell.font = { name: "Calibri", bold: !tieneTitular, italic: !tieneTitular, size: 9.5, color: { argb: tieneTitular ? "FF3E131F" : "FFBE123C" } };
        estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tieneTitular ? "FFF5EBEF" : "FFFFF1F2" } };
        estadoCell.alignment = { vertical: "middle", horizontal: "center" };

        const bandBorder = { style: "thin", color: { argb: "FFBC955C" } };
        for (let c = 1; c <= numCols; c++) {
            bandaRow.getCell(c).border = {
                top: bandBorder,
                bottom: bandBorder,
                left: c === 1 ? bandBorder : undefined,
                right: c === numCols ? bandBorder : undefined,
            };
        }
        bandaRow.height = 22;
        row += 1;

        if (entradas.length === 0) {
            worksheet.mergeCells(`A${row}:${lastCol}${row}`);
            const vacCell = worksheet.getCell(`A${row}`);
            vacCell.value = "Sin gestiones registradas.";
            vacCell.font = { name: "Calibri", italic: true, size: 9, color: { argb: "FF94A3B8" } };
            vacCell.alignment = { vertical: "middle", horizontal: "center" };
            row += 1;
            return;
        }

        entradas.forEach((entrada, i) => {
            const isVacancia = entrada.tipo === "vacancia";
            const seg = entrada.dato;

            let values;
            let tipoColorKey;
            if (isVacancia) {
                values = {
                    aduana: aduana.aduana_corta,
                    codigosUa: codigoUaActual(aduana),
                    plaza: seg.plazaAncla || "—",
                    nivel: "—",
                    puesto: "—",
                    nombrePuestoFuncional: "—",
                    numEmpleado: "—",
                    titular: seg.abierta ? "— Acéfala hoy —" : "— Vacante —",
                    fechaDesde: fecha(seg.desde),
                    fechaCapturaDesde: "—",
                    fechaHasta: seg.hasta ? fecha(seg.hasta) : "—",
                    fechaCapturaHasta: "—",
                    duracion: duracion(seg.dias),
                    motivoEntrada: "—",
                    procedencia: "—",
                    motivoSalida: "—",
                    tipoMovimiento: seg.abierta ? "Acéfala hoy" : "Vacante",
                    destino: "—",
                    puestoDestino: "—",
                    nombrePuestoFuncionalDestino: "—",
                    uaDestino: "—",
                    deptoDestino: "—",
                    depDirectaDestino: "—",
                };
                tipoColorKey = "VACANCIA";
            } else {
                const g = seg.gestion;
                values = {
                    aduana: aduana.aduana_corta,
                    codigosUa: codigoUaActual(aduana),
                    plaza: seg.plaza,
                    nivel: g.nivel_tabular || "—",
                    puesto: g.cd_puesto || "—",
                    nombrePuestoFuncional: g.nombre_puesto_funcional || "—",
                    numEmpleado: g.num_empleado || "—",
                    titular: g.nombre,
                    fechaDesde: fecha(seg.fechaDesde),
                    fechaCapturaDesde: seg.fechaCapturaDesde ? fecha(seg.fechaCapturaDesde) : "—",
                    fechaHasta: seg.fechaHasta ? fecha(seg.fechaHasta) : "Vigente",
                    fechaCapturaHasta: seg.fechaCapturaHasta ? fecha(seg.fechaCapturaHasta) : "—",
                    duracion: duracion(diasEntre(seg.fechaDesde, seg.fechaHasta)),
                    motivoEntrada: seg.entradaMotivo || "—",
                    procedencia: textoOrigen(seg.entradaOrigen),
                    motivoSalida: seg.salidaMotivo || "—",
                    tipoMovimiento: esInsubsistencia(seg)
                        ? "Baja (Insubsistencia)"
                        : (TIPO_SALIDA[seg.tipoSalida] || TIPO_SALIDA.BAJA).etiqueta,
                    destino: textoDestino(seg),
                    ...detalleDestinoPuesto(seg),
                };
                tipoColorKey = esInsubsistencia(seg) ? "INSUBSISTENCIA" : seg.tipoSalida;
            }

            const dataRow = worksheet.getRow(row);
            // Fondo zebra/insubsistencia: destaca la fila COMPLETA, no solo
            // la celda de tipo (anula la alternancia zebra a propósito para
            // insubsistencia, debe saltar a la vista sin importar la
            // paridad de la fila) — pero SIEMPRE por CELDA acotada a
            // `numCols`, nunca `dataRow.fill` directo (mismo motivo que el
            // header: eso "extiende" el color a toda la fila de la hoja).
            const filaFillColor = tipoColorKey === "INSUBSISTENCIA"
                ? EXCEL_FILA_INSUBSISTENCIA_BG
                : (i % 2 === 1 ? "FFF9FAFB" : null);
            columns.forEach((col, ci) => {
                const cell = dataRow.getCell(ci + 1);
                cell.value = values[col.key];
                cell.border = { top: thinGray, left: thinGray, bottom: thinGray, right: thinGray };
                cell.font = { name: "Calibri", size: 9 };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                if (filaFillColor) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: filaFillColor } };
            });

            const colores = EXCEL_TIPO_COLOR[tipoColorKey] || EXCEL_TIPO_COLOR.BAJA;
            const tipoCell = dataRow.getCell(tipoMovimientoCol);
            tipoCell.font = { name: "Calibri", bold: true, size: 9, color: { argb: colores.text } };
            tipoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colores.bg } };
            tipoCell.alignment = { vertical: "middle", horizontal: "center" };

            // Foto del titular — misma imagen se registra UNA vez por
            // titular (workbook.addImage) y se ancla N veces (una por fila
            // donde aparece), igual mecánica que downloadExcelConFoto en
            // HistorialMovimientosTab. Las vacancias no tienen titular, así
            // que no llevan foto.
            if (incluirFotos && !isVacancia) {
                const numEmpleadoFoto = String(seg.gestion?.num_empleado || "");
                const foto = fotosPorEmpleado.get(numEmpleadoFoto);
                if (foto) {
                    let imageId = imageIdPorEmpleado.get(numEmpleadoFoto);
                    if (imageId === undefined) {
                        imageId = workbook.addImage({ buffer: foto.buffer, extension: foto.extension });
                        imageIdPorEmpleado.set(numEmpleadoFoto, imageId);
                    }
                    worksheet.addImage(imageId, {
                        tl: { col: 0.12, row: (row - 1) + 0.1 },
                        ext: { width: 64, height: 64 },
                    });
                }
            }

            // Registra esta fila por clave de segmento y, si es un traslado
            // (a otra plaza dentro de la misma gestión, o a otra aduana),
            // encola el enlace de "Destino" — se resuelve después de escribir
            // todo el reporte (ver enlacesPendientes arriba).
            if (!isVacancia) {
                filaPorClave.set(seg.clave, row);
                let claveDestinoLink = null;
                if (tipoColorKey === "TRASLADO_ADUANA") {
                    claveDestinoLink = destinoSegmentoPorClave?.get(seg.claveGestion) || null;
                    // Registra, a nivel de SEGMENTO, de dónde viene el destino
                    // — esta fila (seg.clave) es justo su origen. Alimenta el
                    // enlace de "Procedencia" de la fila de llegada.
                    if (claveDestinoLink) origenSegmentoPorClave.set(claveDestinoLink, seg.clave);
                } else if (tipoColorKey === "CAMBIO_PLAZA") {
                    claveDestinoLink = seg.claveSiguienteSegmento || null;
                }
                if (claveDestinoLink) enlacesPendientes.push({ filaOrigen: row, claveDestino: claveDestinoLink, columna: "destino" });

                // Mismo mecanismo para "Procedencia": de dónde vino. Plaza ->
                // el segmento anterior de esta misma gestión (se conoce ya).
                // Aduana -> el segmento (en otra aduana) que lo trasladó hacia
                // acá — `origenSegmentoPorClave` recién queda completo al
                // terminar TODO el recorrido (la fila que sale pudo procesarse
                // antes o después de esta), así que aquí solo se deja la
                // clave PROPIA como pista; se resuelve en la segunda pasada.
                // Puesto no enlaza (viene de fuera del universo de aduanas).
                if (seg.entradaOrigen?.tipo === "PLAZA" && seg.claveSegmentoAnterior) {
                    enlacesPendientes.push({ filaOrigen: row, claveDestino: seg.claveSegmentoAnterior, columna: "procedencia" });
                } else if (seg.entradaOrigen?.tipo === "ADUANA") {
                    enlacesPendientes.push({ filaOrigen: row, claveViaOrigen: seg.clave, columna: "procedencia" });
                }
            }

            worksheet.getRow(row).height = incluirFotos ? FOTO_ROW_HEIGHT : 18;
            row += 1;
        });

        row += 1;
    });

    // Resuelve los enlaces encolados: convierte la celda "Destino" o
    // "Procedencia" (según corresponda) de cada fila origen en un
    // hipervínculo interno a la fila ya conocida. Si esa fila no llegó a
    // escribirse (aduana filtrada fuera de la exportación actual, o caché
    // viejo sin la clave esperada), la celda se queda como texto plano — no
    // truena.
    const colIdxPorNombre = {
        destino: columns.findIndex((c) => c.key === "destino") + 1,
        procedencia: columns.findIndex((c) => c.key === "procedencia") + 1,
    };
    const hojaRef = worksheet.name.replace(/'/g, "''");
    // Fórmula HYPERLINK(), no `cell.hyperlink` — ExcelJS escribe los saltos
    // internos como <hyperlink r:id=... location=.../> CON una relación
    // externa apuntando a un target que empieza en "#" (inválido: no es una
    // URL real). Excel abre el archivo sin quejarse pero al dar clic tira
    // "Referencia no válida". La fórmula =HYPERLINK("#'Hoja'!A14","texto")
    // es justo lo que Excel entiende de forma nativa para saltos internos,
    // sin relación de por medio — comprobado con el archivo real que reportó
    // el error (unzip del xlsx: <hyperlink ... r:id="rId1" location="#..."/>
    // con Target="#'Rotación de Aduanas'!A14" TargetMode="External").
    enlacesPendientes.forEach(({ filaOrigen, claveDestino, claveViaOrigen, columna }) => {
        // "Procedencia" por traslado de otra aduana no conoce su clave
        // destino al momento de encolarse (ver más arriba) — se resuelve
        // aquí, ya con `origenSegmentoPorClave` completo.
        const claveFinal = claveViaOrigen ? origenSegmentoPorClave.get(claveViaOrigen) : claveDestino;
        const filaDestino = claveFinal ? filaPorClave.get(claveFinal) : null;
        if (!filaDestino) return;
        const celda = worksheet.getRow(filaOrigen).getCell(colIdxPorNombre[columna]);
        const texto = String(celda.value ?? "").replace(/"/g, '""');
        celda.value = { formula: `HYPERLINK("#'${hojaRef}'!A${filaDestino}","${texto}")` };
        celda.font = { name: "Calibri", size: 9, underline: true, color: { argb: "FF1D4ED8" } };
    });

    worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: row - 1, column: numCols } };
    worksheet.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rotacion_Titulares_Aduanas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function ColumnaAduana({ aduana, entradas, cardRefs, canViewPhoto, scrollRootRef, destinoSegmentoPorClave, onIrADestino }) {
    const lanes = useMemo(() => (aduana.plazas && aduana.plazas.length > 0 ? aduana.plazas : ["—"]), [aduana]);
    const laneIndexByPlaza = useMemo(() => new Map(lanes.map((p, i) => [p, i])), [lanes]);
    const acefala = !aduana.titular_actual;
    const uid = useId();

    // Metadatos de cabecera por carril (plaza): rango de fechas, nivel más
    // reciente y si es la plaza donde está sentado el titular vigente.
    const laneMeta = useMemo(() => {
        const map = new Map(lanes.map((p) => [p, { primeraFecha: null, ultimaFecha: null, nivel: null, esActual: false }]));
        entradas.forEach((e) => {
            if (e.tipo !== "segmento") return;
            const m = map.get(e.dato.plaza);
            if (!m) return;
            if (!m.primeraFecha || e.dato.fechaDesde < m.primeraFecha) m.primeraFecha = e.dato.fechaDesde;
            if (e.dato.esUltimo && e.dato.tipoSalida === "ACTIVO") {
                m.esActual = true;
            } else if (!m.esActual) {
                const candidata = e.dato.fechaHasta || e.dato.fechaDesde;
                if (!m.ultimaFecha || candidata > m.ultimaFecha) m.ultimaFecha = candidata;
            }
            m.nivel = e.dato.gestion.nivel_tabular || m.nivel;
        });
        return map;
    }, [lanes, entradas]);

    const plazaDe = useCallback((entrada) => (entrada.tipo === "segmento" ? entrada.dato.plaza : entrada.dato.plazaAncla), []);

    const canvasRef = useRef(null);
    const laneRefs = useRef(new Map());
    const pathRefs = useRef(new Map());
    const [paths, setPaths] = useState([]);
    const [dividers, setDividers] = useState([]);
    const [laneBands, setLaneBands] = useState([]);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Mismo cálculo analítico que Historial (recomputeLayout): conectores
    // entre tarjetas CONSECUTIVAS de esta aduana (fondo-centro de la anterior
    // a tope-centro de la siguiente), divisores entre carriles a la mitad del
    // gap, y bandas de sombreado alternado.
    const recomputeLayout = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || entradas.length === 0) return;
        const canvasRect = canvas.getBoundingClientRect();
        setCanvasSize({ width: canvas.scrollWidth, height: canvas.scrollHeight });

        const nextPaths = [];
        for (let i = 0; i < entradas.length - 1; i++) {
            const elA = cardRefs.current.get(entradas[i].clave);
            const elB = cardRefs.current.get(entradas[i + 1].clave);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            const xA = rectA.left - canvasRect.left + rectA.width / 2;
            const yA = rectA.bottom - canvasRect.top;
            const xB = rectB.left - canvasRect.left + rectB.width / 2;
            const yB = rectB.top - canvasRect.top;
            const cambio = plazaDe(entradas[i]) !== plazaDe(entradas[i + 1]);
            const d = Math.abs(xA - xB) < 1
                ? `M ${xA} ${yA} L ${xB} ${yB}`
                : `M ${xA} ${yA} V ${(yA + yB) / 2} H ${xB} V ${yB}`;
            nextPaths.push({ id: `${entradas[i].clave}->${entradas[i + 1].clave}`, d, cambio });
        }
        setPaths(nextPaths);

        const dividerXs = [];
        for (let i = 0; i < lanes.length - 1; i++) {
            const elA = laneRefs.current.get(lanes[i]);
            const elB = laneRefs.current.get(lanes[i + 1]);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            dividerXs.push(((rectA.right - canvasRect.left) + (rectB.left - canvasRect.left)) / 2);
        }
        setDividers(dividerXs.map((x, i) => ({ plaza: lanes[i], x })));

        if (dividerXs.length === lanes.length - 1) {
            const boundaries = [0, ...dividerXs, canvas.scrollWidth];
            setLaneBands(
                lanes
                    .map((plaza, i) => ({ plaza, left: boundaries[i], width: boundaries[i + 1] - boundaries[i], shaded: i % 2 === 1 }))
                    .filter((band) => band.shaded)
            );
        }
    }, [entradas, lanes, plazaDe, cardRefs]);

    useLayoutEffect(() => {
        recomputeLayout();
    }, [recomputeLayout]);

    // El acordeón "N mov." de cada tarjeta cambia el alto del canvas al
    // abrir/cerrar — el ResizeObserver sobre el propio canvas (no tiene alto
    // fijo, lo determina el contenido) recalcula los conectores en ese caso.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => recomputeLayout());
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [recomputeLayout]);

    return (
        <section className="flex flex-col">
            <header className="sticky top-0 z-20 rounded-t-2xl border-b-2 border-[#bc955c]/40 bg-white/95 px-4 py-3 backdrop-blur-sm dark:bg-slate-900/95">
                <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-[#bc955c]" />
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-black uppercase leading-tight tracking-tight text-[#621f32] dark:text-[#bc955c]">
                            {aduana.aduana_corta}
                        </h3>
                        <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                            UA {codigoUaActual(aduana)} · {aduana.total_gestiones} gestiones · {lanes.length} {lanes.length === 1 ? "plaza" : "plazas"}
                        </p>
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    {acefala ? (
                        <span className="flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                            <AlertTriangle className="size-2.5" /> Sin titular
                        </span>
                    ) : (
                        <span className="flex min-w-0 items-center gap-1 rounded-md bg-[#621f32]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#621f32] dark:bg-[#621f32]/20 dark:text-[#e3c793]">
                            <UserCheck className="size-2.5 shrink-0" />
                            <span className="truncate">{aduana.titular_actual}</span>
                        </span>
                    )}
                    {aduana.dias_acefalia > 0 && (
                        <span
                            title="Días acumulados sin titular desde 2022"
                            className="ml-auto shrink-0 cursor-help font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400"
                        >
                            {aduana.dias_acefalia}d
                        </span>
                    )}
                </div>
            </header>

            <div className="overflow-x-auto">
                <div ref={canvasRef} className="relative p-3" style={{ minWidth: lanes.length * LANE_W }}>
                    {/* Fondo (sombreado + conectores + divisores), igual que Historial. */}
                    <div className="pointer-events-none absolute inset-0">
                        {laneBands.map((band) => (
                            <div
                                key={band.plaza}
                                className="absolute top-0 bottom-0 bg-slate-100/70 dark:bg-slate-900/40"
                                style={{ left: band.left, width: band.width }}
                            />
                        ))}
                        <svg className="absolute top-0 left-0" width={canvasSize.width} height={canvasSize.height}>
                            <defs>
                                <marker id={`arrow-gold-${uid}`} viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 Z" fill={GOLD} />
                                </marker>
                                <marker id={`arrow-amber-${uid}`} viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
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
                                    markerEnd={`url(#${p.cambio ? `arrow-amber-${uid}` : `arrow-gold-${uid}`})`}
                                />
                            ))}
                        </svg>
                        {dividers.map((d) => (
                            <div
                                key={d.plaza}
                                className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 dark:border-slate-700"
                                style={{ left: d.x }}
                            />
                        ))}
                    </div>

                    {/* Cabeceras de carril (una por plaza) */}
                    <div className="relative z-10 grid gap-2 pb-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_W - 20}px, 1fr))` }}>
                        {lanes.map((plaza) => {
                            const meta = laneMeta.get(plaza) || {};
                            return (
                                <div
                                    key={plaza}
                                    ref={(el) => {
                                        if (el) laneRefs.current.set(plaza, el);
                                        else laneRefs.current.delete(plaza);
                                    }}
                                    className={`rounded-lg border px-2.5 py-2 ${meta.esActual
                                        ? "border-[#621f32] dark:border-[#bc955c] bg-[#621f32]/[0.06] dark:bg-slate-900"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"}`}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="truncate font-mono text-[11px] font-black text-[#621f32] dark:text-[#e3c793]">{plaza}</span>
                                        {meta.esActual && (
                                            <span className="shrink-0 rounded-full bg-[#621f32] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white dark:bg-[#bc955c] dark:text-slate-950">
                                                Vigente
                                            </span>
                                        )}
                                    </div>
                                    {meta.nivel && (
                                        <span className="mt-1 inline-block rounded border border-[#bc955c]/30 bg-[#bc955c]/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-[#7a5a30] dark:text-[#e3c793]">
                                            Nivel {meta.nivel}
                                        </span>
                                    )}
                                    <p className="mt-1 font-mono text-[9px] font-bold text-slate-400 dark:text-slate-600">
                                        {fecha(meta.primeraFecha)} — {meta.esActual ? "actual" : fecha(meta.ultimaFecha)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tarjetas: una por segmento (racha de plaza) o vacancia, en su carril. */}
                    <div className="relative z-10 grid gap-2" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_W - 20}px, 1fr))`, gridAutoRows: "min-content" }}>
                        {entradas.map((entrada, i) => {
                            const col = laneIndexByPlaza.get(plazaDe(entrada)) ?? 0;
                            if (entrada.tipo === "vacancia") {
                                return (
                                    <div
                                        key={entrada.clave}
                                        ref={(el) => {
                                            if (el) cardRefs.current.set(entrada.clave, el);
                                            else cardRefs.current.delete(entrada.clave);
                                        }}
                                        style={{ gridColumn: col + 1, gridRow: i + 1, minWidth: 0 }}
                                    >
                                        <TarjetaVacancia vacancia={entrada.dato} />
                                    </div>
                                );
                            }
                            return (
                                <div key={entrada.clave} style={{ gridColumn: col + 1, gridRow: i + 1, minWidth: 0 }}>
                                    <TarjetaSegmento
                                        segmento={entrada.dato}
                                        clave={entrada.clave}
                                        canViewPhoto={canViewPhoto}
                                        scrollRootRef={scrollRootRef}
                                        claveDestino={entrada.dato.esUltimo ? destinoSegmentoPorClave.get(entrada.dato.claveGestion) || null : null}
                                        onIrADestino={onIrADestino}
                                        cardRef={(el) => {
                                            if (el) cardRefs.current.set(entrada.clave, el);
                                            else cardRefs.current.delete(entrada.clave);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

/** Placeholder de una columna de aduana, con el mismo header y 2-4 tarjetas de alto variable. */
function ColumnaEsqueleto({ alturas }) {
    return (
        <div className="w-full shrink-0 rounded-2xl border border-slate-200/80 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-900/30 md:w-[320px]">
            <div className="rounded-t-2xl border-b-2 border-[#bc955c]/20 bg-white/95 px-4 py-3 dark:bg-slate-900/95">
                <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-slate-200 dark:text-slate-700" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-2 w-36 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                </div>
                <div className="mt-2.5 h-4 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
            </div>

            <div className="flex flex-col gap-2 p-3">
                {alturas.map((h, i) => (
                    <div
                        key={i}
                        style={{ height: h }}
                        className="animate-pulse rounded-2xl border border-slate-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-800/60"
                    />
                ))}
            </div>
        </div>
    );
}

/** Alturas variadas por columna para que el esqueleto no se vea uniforme/artificial. */
const ALTURAS_ESQUELETO = [
    [132, 96, 148],
    [110, 132],
    [96, 148, 110, 96],
    [132, 96],
    [148, 110, 132],
    [96, 132, 96],
];

function EsqueletoRotacion() {
    return (
        <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100vh-var(--stack-h))]">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/70 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/20">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="h-9 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-2.5 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ))}
            </div>

            <div className="custom-scrollbar min-h-[420px] overflow-x-auto md:min-h-0 md:flex-1">
                <div className="flex flex-col gap-4 p-2 md:flex-row md:items-start md:gap-3">
                    {ALTURAS_ESQUELETO.map((alturas, i) => (
                        <ColumnaEsqueleto key={i} alturas={alturas} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function RotacionAduanasSubTab({ canViewPhoto = true }) {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [filtrosTipo, setFiltrosTipo] = useState([]); // varios chips activos a la vez, combinados con "o"
    const [puedeVolver, setPuedeVolver] = useState(false);
    const abortRef = useRef(null);
    const scrollAreaRef = useRef(null);
    const cardRefs = useRef(new Map());
    const pendingAccionRef = useRef(null); // { tipo: "clave", clave } | { tipo: "posicion", left, top }
    const historialRef = useRef([]); // pila de {scrollLeft, scrollTop, busqueda, filtrosTipo} previos a cada salto

    const cargar = useCallback((refrescar = false) => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        historialRef.current = [];
        setPuedeVolver(false);
        setCargando(true);
        setError(null);

        VacantesService.getRotacionTitularesAduanas(refrescar ? { refrescar: 1 } : {}, { signal: ctrl.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json) => {
                setDatos(json);
                setCargando(false);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError("No se pudo cargar la rotación de titulares.");
                setCargando(false);
            });
    }, []);

    useEffect(() => {
        cargar(false);
        return () => abortRef.current?.abort();
    }, [cargar]);

    // Línea de tiempo (segmentos por plaza + vacancias) de cada aduana, y el
    // mapa de destino de cruce entre aduanas resuelto a nivel de SEGMENTO (la
    // primera tarjeta/plaza de la gestión que recibe el traslado). Ambos se
    // calculan sobre el dataset completo (no el filtrado) para que el botón
    // "Pasó a otra aduana" y los chips-filtro sigan funcionando aunque la
    // búsqueda/filtro esté ocultando la columna destino — en ese caso
    // `viajarA` limpia los filtros antes de saltar.
    const { entradasPorAduana, destinoSegmentoPorClave } = useMemo(() => {
        const todasAduanas = datos?.aduanas || [];
        const entradasMap = new Map();
        const primerSegmentoPorGestion = new Map();

        todasAduanas.forEach((a) => {
            const entradas = construirEntradasAduana(a);
            entradasMap.set(a.aduana, entradas);
            entradas.forEach((e) => {
                if (e.tipo === "segmento" && e.dato.esPrimero) {
                    primerSegmentoPorGestion.set(e.dato.claveGestion, e.clave);
                }
            });
        });

        const destinoGestion = construirDestinos(todasAduanas);
        const destinoSegmento = new Map();
        destinoGestion.forEach((gestionKeyDestino, gestionKeyOrigen) => {
            const segClave = primerSegmentoPorGestion.get(gestionKeyDestino);
            if (segClave) destinoSegmento.set(gestionKeyOrigen, segClave);
        });

        return { entradasPorAduana: entradasMap, destinoSegmentoPorClave: destinoSegmento };
    }, [datos]);

    // Filtro por chip, con varios activos a la vez combinados con "o": basta
    // con que la aduana cumpla UNO cualquiera de los seleccionados.
    // ACTIVO/TRASLADO_ADUANA/CAMBIO_PLAZA/SALIDA_PUESTO/BAJA buscan un
    // segmento de ese tipo en la línea de tiempo de la aduana; SIN_TITULAR y
    // VACANCIA son propiedades de la aduana misma.
    const cumpleFiltro = useCallback(
        (a, tipo) => {
            if (tipo === "SIN_TITULAR") return !a.titular_actual;
            if (tipo === "VACANCIA") return (a.total_vacancias || 0) > 0;
            const entradas = entradasPorAduana.get(a.aduana) || [];
            if (tipo === "INSUBSISTENCIA") return entradas.some((e) => e.tipo === "segmento" && esInsubsistencia(e.dato));
            return entradas.some((e) => e.tipo === "segmento" && e.dato.tipoSalida === tipo);
        },
        [entradasPorAduana]
    );

    const aduanas = useMemo(() => {
        const todas = datos?.aduanas || [];
        const termino = normalizeForSearch(busqueda.trim());
        return todas.filter((a) => {
            if (termino) {
                const coincideNombre = normalizeForSearch(a.aduana).includes(termino);
                const coincideTitular = (a.gestiones || []).some((g) => normalizeForSearch(g.nombre).includes(termino));
                if (!coincideNombre && !coincideTitular) return false;
            }
            if (filtrosTipo.length === 0) return true;
            return filtrosTipo.some((tipo) => cumpleFiltro(a, tipo));
        });
    }, [datos, busqueda, filtrosTipo, cumpleFiltro]);

    // Centra `el` en el contenedor con scroll y lo resalta con un pulso —
    // GSAP puede animar scrollLeft/scrollTop de un elemento como cualquier
    // otra propiedad numérica, sin necesitar ScrollToPlugin.
    const animarHacia = useCallback((el) => {
        const container = scrollAreaRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetLeft = container.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width - elRect.width) / 2;
        const targetTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height - elRect.height) / 2;

        const tl = gsap.timeline();
        tl.to(container, {
            scrollLeft: Math.max(0, targetLeft),
            scrollTop: Math.max(0, targetTop),
            duration: 0.9,
            ease: "power2.inOut",
        });
        tl.fromTo(
            el,
            { boxShadow: "0 0 0 5px rgba(245,158,11,0.65)" },
            { boxShadow: "0 0 0 0 rgba(245,158,11,0)", duration: 1, ease: "power2.out" },
            "-=0.35"
        );
    }, []);

    // Vuelta al lugar exacto de donde salió un salto — mismo pulso que
    // animarHacia, pero sobre la tarjeta de origen (a la que se regresa).
    const animarAPosicion = useCallback((left, top, elParaDestacar) => {
        const container = scrollAreaRef.current;
        if (!container) return;
        const tl = gsap.timeline();
        tl.to(container, { scrollLeft: Math.max(0, left), scrollTop: Math.max(0, top), duration: 0.9, ease: "power2.inOut" });
        if (elParaDestacar) {
            tl.fromTo(
                elParaDestacar,
                { boxShadow: "0 0 0 5px rgba(245,158,11,0.65)" },
                { boxShadow: "0 0 0 0 rgba(245,158,11,0)", duration: 1, ease: "power2.out" },
                "-=0.35"
            );
        }
    }, []);

    // Si la tarjeta destino no está montada (filtrada por búsqueda/"solo
    // acéfalas"), se limpian los filtros y se guarda la acción pendiente: el
    // efecto de abajo la resuelve en cuanto la columna vuelva a aparecer.
    // `claveOrigen` es la tarjeta con el botón que se acaba de clicar —se
    // guarda en el historial para poder destacarla de vuelta al regresar.
    const viajarA = useCallback(
        (claveDestino, claveOrigen) => {
            const container = scrollAreaRef.current;
            historialRef.current.push({
                scrollLeft: container?.scrollLeft ?? 0,
                scrollTop: container?.scrollTop ?? 0,
                busqueda,
                filtrosTipo,
                clave: claveOrigen,
            });
            setPuedeVolver(true);

            const el = cardRefs.current.get(claveDestino);
            if (el) {
                animarHacia(el);
                return;
            }
            pendingAccionRef.current = { tipo: "clave", clave: claveDestino };
            setBusqueda("");
            setFiltrosTipo([]);
        },
        [animarHacia, busqueda, filtrosTipo]
    );

    // Deshace el último salto: restaura filtros (si cambiaron), la posición
    // de scroll exacta en la que estaba antes de dar clic en "Pasó a otra
    // aduana" y destaca esa misma tarjeta de origen brevemente.
    const volver = useCallback(() => {
        const anterior = historialRef.current.pop();
        if (!anterior) return;
        setPuedeVolver(historialRef.current.length > 0);

        if (anterior.busqueda !== busqueda || anterior.filtrosTipo !== filtrosTipo) {
            pendingAccionRef.current = { tipo: "posicion", left: anterior.scrollLeft, top: anterior.scrollTop, clave: anterior.clave };
            setBusqueda(anterior.busqueda);
            setFiltrosTipo(anterior.filtrosTipo);
        } else {
            animarAPosicion(anterior.scrollLeft, anterior.scrollTop, cardRefs.current.get(anterior.clave));
        }
    }, [busqueda, filtrosTipo, animarAPosicion]);

    useEffect(() => {
        const accion = pendingAccionRef.current;
        if (!accion) return;
        if (accion.tipo === "clave") {
            const el = cardRefs.current.get(accion.clave);
            if (!el) return;
            pendingAccionRef.current = null;
            requestAnimationFrame(() => animarHacia(el));
        } else if (accion.tipo === "posicion") {
            pendingAccionRef.current = null;
            const el = cardRefs.current.get(accion.clave);
            requestAnimationFrame(() => animarAPosicion(accion.left, accion.top, el));
        }
    }, [aduanas, animarHacia, animarAPosicion]);

    const resumen = useMemo(() => {
        const todas = datos?.aduanas || [];
        return {
            aduanas: todas.length,
            gestiones: datos?.total_gestiones || 0,
            titulares: datos?.total_titulares || 0,
            vacancias: todas.reduce((n, a) => n + a.total_vacancias, 0),
            acefalasHoy: todas.filter((a) => !a.titular_actual).length,
        };
    }, [datos]);

    // Cuenta de segmentos por tipo, para el número de cada chip-filtro —
    // reutiliza la misma clasificación (`tipoSalida`) que ya pinta las
    // tarjetas, así el número del chip nunca se desincroniza del diagrama.
    const conteoPorTipo = useMemo(() => {
        const c = { ACTIVO: 0, TRASLADO_ADUANA: 0, CAMBIO_PLAZA: 0, SALIDA_PUESTO: 0, BAJA: 0, INSUBSISTENCIA: 0 };
        entradasPorAduana.forEach((entradas) => {
            entradas.forEach((e) => {
                if (e.tipo !== "segmento") return;
                if (c[e.dato.tipoSalida] !== undefined) c[e.dato.tipoSalida] += 1;
                if (esInsubsistencia(e.dato)) c.INSUBSISTENCIA += 1;
            });
        });
        return c;
    }, [entradasPorAduana]);

    const toggleFiltro = useCallback((tipoKey) => {
        setFiltrosTipo((prev) => (prev.includes(tipoKey) ? prev.filter((t) => t !== tipoKey) : [...prev, tipoKey]));
    }, []);

    const [exportando, setExportando] = useState(false);
    const handleExportarExcel = useCallback(async () => {
        if (exportando) return;
        setExportando(true);
        try {
            await exportarRotacionAExcel({ aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, filtrosTipo, canViewPhoto });
        } catch (err) {
            console.error("Error exportando rotación de aduanas a Excel:", err);
        } finally {
            setExportando(false);
        }
    }, [aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, filtrosTipo, exportando, canViewPhoto]);

    if (cargando) {
        return <EsqueletoRotacion />;
    }

    if (error) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-slate-400">
                <AlertTriangle className="size-10 text-rose-400" />
                <p className="text-sm font-bold">{error}</p>
                <button
                    type="button"
                    onClick={() => cargar(true)}
                    className="cursor-pointer rounded-xl bg-[#621f32] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100vh-var(--stack-h))]">
            {/* Controles: volver, búsqueda, recargar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/20">
                <button
                    type="button"
                    onClick={volver}
                    disabled={!puedeVolver}
                    aria-label="Regresar a donde estaba antes del salto"
                    title={puedeVolver ? "Regresar a donde estaba antes" : "No hay salto que deshacer"}
                    className="cursor-pointer rounded-xl bg-white p-2 text-slate-400 transition-colors hover:text-[#621f32] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-400 dark:bg-slate-950 dark:hover:text-[#bc955c] dark:disabled:hover:text-slate-400"
                >
                    <ChevronLeft className="size-3.5" />
                </button>

                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Aduana o titular…"
                        aria-label="Buscar aduana o titular"
                        className="w-48 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#bc955c] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                    />
                    {busqueda && (
                        <button
                            type="button"
                            onClick={() => setBusqueda("")}
                            aria-label="Limpiar búsqueda"
                            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleExportarExcel}
                    disabled={exportando || aduanas.length === 0}
                    aria-label="Exportar a Excel"
                    title="Exportar la rotación de titulares a un Excel formal, con membrete y leyenda de Control de Plazas"
                    className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#621f32] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {exportando ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                    Exportar a Excel
                </button>

                <button
                    type="button"
                    onClick={() => cargar(true)}
                    aria-label="Recargar"
                    title="Recargar ignorando el caché"
                    className="cursor-pointer rounded-xl bg-white p-2 text-slate-400 transition-colors hover:text-[#621f32] dark:bg-slate-950 dark:hover:text-[#bc955c]"
                >
                    <RefreshCw className="size-3.5" />
                </button>
            </div>

            {/* Stats + chips-filtro: cada chip es a la vez leyenda y filtro —
                clic reduce `aduanas` a las que tienen ese tipo de movimiento;
                clic de nuevo lo quita. Sin toggle activo se ven todas. */}
            <div className="flex flex-wrap items-stretch gap-x-0.5 gap-y-1 border-b border-slate-200/70 px-2 py-1 dark:border-slate-800/80">
                <StatPlano icon={Building2} value={resumen.aduanas} label="aduanas" />
                <StatPlano icon={Users} value={`${resumen.titulares} · ${resumen.gestiones}`} label="titulares · gestiones" />

                <span className="mx-1 my-1.5 w-px shrink-0 bg-slate-200 dark:bg-slate-800" />

                <ChipFiltro tipoKey="ACTIVO" count={conteoPorTipo.ACTIVO} active={filtrosTipo.includes("ACTIVO")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="TRASLADO_ADUANA" count={conteoPorTipo.TRASLADO_ADUANA} active={filtrosTipo.includes("TRASLADO_ADUANA")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="CAMBIO_PLAZA" count={conteoPorTipo.CAMBIO_PLAZA} active={filtrosTipo.includes("CAMBIO_PLAZA")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="SALIDA_PUESTO" count={conteoPorTipo.SALIDA_PUESTO} active={filtrosTipo.includes("SALIDA_PUESTO")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="BAJA" count={conteoPorTipo.BAJA} active={filtrosTipo.includes("BAJA")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="INSUBSISTENCIA" count={conteoPorTipo.INSUBSISTENCIA} active={filtrosTipo.includes("INSUBSISTENCIA")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="VACANCIA" count={resumen.vacancias} active={filtrosTipo.includes("VACANCIA")} onToggle={toggleFiltro} />
                <ChipFiltro tipoKey="SIN_TITULAR" count={resumen.acefalasHoy} active={filtrosTipo.includes("SIN_TITULAR")} onToggle={toggleFiltro} />

                {filtrosTipo.length > 0 && (
                    <div className="flex items-center gap-2 self-center pl-1">
                        {filtrosTipo.length > 1 && (
                            <span className="text-[9px] font-semibold italic text-slate-400">cumple cualquiera de los {filtrosTipo.length}</span>
                        )}
                        <button
                            type="button"
                            onClick={() => setFiltrosTipo([])}
                            className="flex cursor-pointer items-center gap-1 border-b-2 border-transparent px-2 py-2 text-[10px] font-bold text-slate-400 hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-500"
                        >
                            <X className="size-3" /> Quitar filtros
                        </button>
                    </div>
                )}
            </div>

            {aduanas.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-slate-400 md:flex-1">
                    <Search className="size-10 opacity-40" />
                    <p className="text-sm font-bold">Ninguna aduana coincide con la búsqueda.</p>
                </div>
            ) : (
                /* En móvil las columnas se apilan y la página scrollea; en
                   escritorio se recorren en horizontal. Ninguna columna
                   scrollea por su cuenta a nivel de página: todas comparten
                   el scroll de este contenedor, que es justo lo que
                   `viajarA` anima con GSAP para llegar a la tarjeta destino
                   de un traslado entre aduanas (el scroll horizontal DENTRO
                   de cada columna, entre sus subcolumnas de plaza, es propio
                   de esa columna). */
                <div ref={scrollAreaRef} className="custom-scrollbar min-h-[420px] overflow-auto md:min-h-0 md:flex-1">
                    <div className="flex flex-col gap-4 p-2 md:flex-row md:items-start md:gap-3">
                        {aduanas.map((aduana) => (
                            <div
                                key={aduana.aduana}
                                className="w-full shrink-0 rounded-2xl border border-slate-200/80 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-900/30 md:w-[var(--col-w)]"
                                style={{ "--col-w": `${(aduana.plazas?.length || 1) * LANE_W}px` }}
                            >
                                <ColumnaAduana
                                    aduana={aduana}
                                    entradas={entradasPorAduana.get(aduana.aduana) || []}
                                    cardRefs={cardRefs}
                                    canViewPhoto={canViewPhoto}
                                    scrollRootRef={scrollAreaRef}
                                    destinoSegmentoPorClave={destinoSegmentoPorClave}
                                    onIrADestino={viajarA}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
