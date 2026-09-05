"use client";

/**
 * ArbolMovimientosSubTab
 * ======================
 * Subtab "Árbol de movimientos" de MovimientosPersonalTab.
 *
 * El usuario escribe una plaza y ve su historia como un GRAFO DE NODOS en un
 * canvas pannable/zoomable (arrastrar para mover, rueda para zoom) — no una
 * lista vertical. El tronco es una cadena de nodos circulares, uno por
 * periodo, de arriba (creación) hacia abajo (hoy).
 *
 * EXPANSIÓN RECURSIVA: cualquier nodo puede tener un botón ">" según su tipo
 * de dato:
 *   - Nodo de PLAZA (tronco o rama) con empleado y tipo ocupación/insubsis-
 *     tencia -> ">" trae la trayectoria COMPLETA de ese empleado (todas sus
 *     plazas, sp_historia_empleado) como nueva rama.
 *   - Nodo de EMPLEADO (dentro de una rama) con una plaza -> ">" trae la
 *     historia de ESA plaza (sp_historia_plaza) como una nueva sub-rama, con
 *     sus propios ocupantes, cada uno a su vez expandible. Así se puede
 *     seguir la cadena persona→plaza→persona→plaza indefinidamente.
 * Cada expansión abre su propia rama, en su propio carril (lane) y color,
 * colgando del nodo exacto donde se pidió — nunca del tronco a secas.
 *
 * CARGA BAJO DEMANDA (requisito explícito): el árbol NO se carga completo.
 * Se pide el tronco al buscar, y cada rama sólo al expandir su nodo padre.
 * `cacheRef` evita repetir la petición al colapsar y reabrir (compartida
 * entre cualquier nodo que apunte al mismo empleado o a la misma plaza).
 *
 * Los datos vienen de dos SPs (sp_historia_plaza / sp_historia_empleado), que
 * ya entregan los periodos clasificados y la pila continua; aquí no se
 * re-deriva nada, sólo se calcula la POSICIÓN de cada nodo y se pinta.
 * Ver PLAN_ARBOL_MOVIMIENTOS_2026-09-03.md.
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Draggable } from "gsap/Draggable";
import {
    AlertTriangle,
    ArrowRight,
    Ban,
    Building2,
    ChevronRight,
    Clock,
    Loader2,
    Minus,
    Plus,
    Scan,
    Search,
    Sparkles,
    User,
    X,
} from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import FotoEmpleadoCell from "../../shared/FotoEmpleadoCell";
import { useAuth } from "@/hooks/useAuth";

gsap.registerPlugin(useGSAP, Draggable);

/* ------------------------------------------------------------------ */
/* Estilo por tipo de periodo — círculo sólido, ícono, tamaño.         */
/* ------------------------------------------------------------------ */
const ESTILO_NODO = {
    creacion: { label: "Creación de la plaza", icon: Sparkles, bg: "#94a3b8", size: 48 },
    vacancia: { label: "Vacante", icon: Clock, bg: "#d97706", size: 34 },
    ocupacion: { label: "Ocupación", icon: User, bg: "#621f32", size: 58 },
    insubsistencia: { label: "Insubsistencia", icon: Ban, bg: "#e11d48", size: 42 },
    transito: { label: "Movimiento de paso", icon: ArrowRight, bg: "#7c3aed", size: 32 },
};

// Un solo color para todo el árbol — las líneas (tronco y ramas) sólo se
// distinguen entre sí por trazo (sólida vs. punteada), nunca por color.
const LINEA_GRIS = "#94a3b8";

// El "formato" del nodo (no si es tronco o rama) define cómo leer su tipo:
// datos de PLAZA (sp_historia_plaza) usan tipo_periodo; datos de EMPLEADO
// (sp_historia_empleado) usan es_insubsistencia/es_transito.
const tipoDe = (periodo, formato) => {
    if (formato === "empleado") {
        return periodo.es_insubsistencia ? "insubsistencia" : periodo.es_transito ? "transito" : "ocupacion";
    }
    return periodo.tipo_periodo || "ocupacion";
};

// Qué expande este nodo (y con qué id) según su formato — el par contrario
// al de sus propios datos: un nodo de PLAZA expande un EMPLEADO y viceversa.
function expansionDe(node, plazaRaiz) {
    const { periodo, formato } = node;
    if (formato === "plaza") {
        const tipo = tipoDe(periodo, formato);
        if (!periodo.num_empleado || (tipo !== "ocupacion" && tipo !== "insubsistencia")) return null;
        return { kind: "empleado", id: periodo.num_empleado };
    }
    // formato "empleado": expande la plaza de este tramo — incluida la plaza
    // raíz actual (un tramo puede "volver" a ella): antes se excluía por
    // considerarlo trivial, pero eso dejaba el nodo SIN botón y sin forma de
    // consultar la historia de esa plaza desde ahí.
    if (!periodo.posicion) return null;
    return { kind: "plaza", id: periodo.posicion };
}

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
/* Layout: calcula la posición (x,y) de cada nodo en coordenadas de     */
/* "mundo". Estructura de GRAFO, no de árbol: la identidad de un nodo    */
/* es el movimiento real que representa (id_registro_inicio) — si el     */
/* mismo movimiento ya existe (llegó por el tronco o por otra rama), se  */
/* REUTILIZA en vez de duplicarlo, y simplemente gana una arista más.    */
/*                                                                       */
/* Y es UN SOLO LIENZO CRONOLÓGICO: el rank por fecha_inicio entre TODOS   */
/* los nodos visibles ahora mismo (cualquier tronco, cualquier rama, sin   */
/* importar carril) define la fila (Y = rank * ROW_HEIGHT) — así dos      */
/* nodos de columnas distintas que ocurrieron por las mismas fechas caen   */
/* a la misma altura, y se puede leer el árbol entero como una sola        */
/* línea de tiempo. Se usa un rango FIJO (no proporcional a los días) para */
/* que un hueco de 3 años y uno de 1 día ocupen el mismo alto de fila — de */
/* otro modo la mayoría de los nodos quedarían amontonados junto a huecos  */
/* gigantes.                                                                */
/*                                                                       */
/* X sí es LOCAL: cada tronco tiene su propia columna base, y cada rama   */
/* un carril fijo desplazado UNA sola vez desde el nodo que la abrió (no  */
/* se vuelve a sumar por cada paso, para que la columna no derive).       */
/*   - Historia de una PLAZA (kind='plaza'): cadena continua en su carril.*/
/*   - Historia de un EMPLEADO (kind='empleado'): abanico en su carril.   */
/* Ambas se dibujan CURVAS y punteadas — nunca horizontales — para que el */
/* eje Y (la cronología) nunca se pierda de vista.                        */
/* ------------------------------------------------------------------ */
// Espaciado holgado: la etiqueta es una tarjeta multilínea (fecha con año,
// tipo de periodo, entrada→salida, nombre), no una sola línea corta — y los
// nodos grandes (ocupación) necesitan leerse sueltos, no amontonados.
const ROW_HEIGHT = 170;
const BRANCH_BASE_X = 230;
const BRANCH_LANE_GAP = 140;
// Separación entre TRONCOS independientes en el mismo lienzo (el botón
// "ir a la plaza destino" agrega un tronco nuevo al lado, nunca reemplaza
// el que ya está) — ancho de sobra para que sus propias ramas no invadan
// el carril del tronco vecino.
const TRUNK_GAP = 1450;
// Medio ancho aproximado de un nodo+etiqueta (150px de tarjeta / 2 + margen)
// — usado para decidir si dos ramas independientes quedarían demasiado cerca
// en X durante el mismo rango de fechas (su proxy de Y, ver más abajo).
const NODE_HALF_W = 100;

// Punto y tangente sobre la curva cúbica "M p0 C p1 p2 p3" en t∈[0,1] — sirve
// para sembrar flechitas ">" a lo largo de una arista de rama: con tantas
// ramas cruzándose, la línea sola no basta para saber hacia dónde corre cada
// una (ver ARROW_STOPS más abajo).
const puntoCubica = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    };
};
const tangenteCubica = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    return {
        x: 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
        y: 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
    };
};
// Tres flechitas por arista de rama, repartidas a lo largo (nunca en las
// puntas, donde ya está el nodo) — suficiente para leer la dirección aunque
// el trazo se cruce con otro.
const ARROW_STOPS = [0.28, 0.52, 0.76];

// Identidad canónica de un periodo/tramo: el movimiento real que lo abre. La
// MISMA gestión, vista desde la plaza (sp_historia_plaza) o desde el
// empleado (sp_historia_empleado), comparte este id — por eso alcanza para
// deduplicar entre ambos formatos sin comparar fechas/nombres.
// Excluye 'vacancia': su id_registro_inicio NO es el id de un movimiento propio
// sino el del movimiento que cerró al ocupante anterior — y ese mismo id suele
// ser TAMBIÉN el id de entrada del siguiente movimiento de ESE empleado en otra
// plaza (un traslado es un solo renglón que cierra una plaza y abre otra). Sin
// esta exclusión, expandir la trayectoria del empleado fusiona por error su
// nuevo tramo con la vacante del tronco (misma id_registro_inicio, tramos
// distintos) y le pisa la posición.
const claveNodo = (periodo) =>
    periodo.id_registro_inicio != null && periodo.tipo_periodo !== "vacancia" ? `mov:${periodo.id_registro_inicio}` : null;

// Respaldo de identidad: sp_historia_plaza y sp_historia_empleado calculan
// id_registro_inicio con ventanas (LAG/LEAD) sobre subconjuntos distintos
// (uno filtrado por plaza, otro por empleado) — si alguna vez ese id no
// coincide para el MISMO tramo real, (posicion + fecha_inicio) sigue
// identificándolo sin ambigüedad y evita duplicar el nodo que se reutiliza.
const mismoTramo = (a, b) => {
    if (!a || !b) return false;
    const ca = claveNodo(a);
    const cb = claveNodo(b);
    if (ca != null && cb != null) return ca === cb;
    return Boolean(a.posicion) && a.posicion === b.posicion && Boolean(a.fecha_inicio) && a.fecha_inicio === b.fecha_inicio;
};

// `raices`: un tronco por PLAZA abierta en el lienzo — la búsqueda inicial
// pone una, y "ir a la plaza destino" (badge del edificio) AGREGA otra al
// lado en vez de reemplazar; cada una es independiente (su propia columna,
// su propia Y local) y ninguna comparte línea de tiempo con las demás.
function calcularLayout(raices, expandidos, laneMap) {
    // 1. Registro de nodos por CLAVE CANÓNICA (no por ruta): cada tronco se
    //    registra primero, con su posición definitiva de una vez (columna
    //    X fija por tronco, Y = su propio orden — ya viene cronológico del
    //    backend).
    const nodosPorClave = new Map(); // clave -> nodo
    // Respaldo de nodosPorClave cuando id_registro_inicio difiere entre SPs
    // para el mismo tramo real (ver mismoTramo). Sólo posicion+fecha_inicio.
    const nodosPorComp = new Map();
    const compKey = (p) => (p.posicion && p.fecha_inicio ? `pf:${p.posicion}|${p.fecha_inicio}` : null);
    const registrar = (clave, n) => {
        nodosPorClave.set(clave, n);
        const ck = compKey(n.periodo);
        if (ck && !nodosPorComp.has(ck)) nodosPorComp.set(ck, n);
    };
    const buscar = (clave, periodo) => nodosPorClave.get(clave) ?? (compKey(periodo) ? nodosPorComp.get(compKey(periodo)) : undefined);
    const nodos = []; // orden de creación
    const columnas = raices.map(() => []); // nodos de tronco por raíz, en orden — para las aristas del tronco

    raices.forEach((raiz, rootIdx) => {
        const baseX = rootIdx * TRUNK_GAP;
        raiz.periodos.forEach((periodo, i) => {
            const clave = claveNodo(periodo) ?? `trunk:${rootIdx}:${i}`;
            // Y se resuelve más abajo, en el rank global — aquí sólo la X.
            const n = { id: clave, kind: "trunk", formato: "plaza", periodo, indice: i, lane: -1, direccion: null, x: baseX, root: rootIdx };
            registrar(clave, n);
            nodos.push(n);
            columnas[rootIdx].push(n);
        });
    });

    const entradas = Object.entries(expandidos)
        .filter(([, exp]) => exp)
        .sort((a, b) => (laneMap.get(a[0]) ?? 0) - (laneMap.get(b[0]) ?? 0));

    // Ramas ya colocadas (rectángulo X + rango de fechas) — cada rama nueva se
    // revisa contra esta lista y, si se traslapa con alguna anterior EN EL
    // MISMO rango de fechas (su Y real todavía no existe: el rank cronológico
    // global se calcula después de esta pasada, así que la fecha_inicio sirve
    // de proxy — es monótona respecto al rank), se empuja en X hasta despejar.
    // Se compara sólo entre ramas (nunca contra el tronco): el punto de
    // anclaje de una rama SIEMPRE toca al nodo del que cuelga, así que
    // cualquier rectángulo que lo incluyera daría un falso choque contra su
    // propio padre.
    const ramasOcupadas = [];
    const seTraslapanFechas = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
    const empujarSiChoca = (miembros, lane) => {
        if (miembros.length === 0) return;
        let minX = Math.min(...miembros.map((n) => n.x));
        let maxX = Math.max(...miembros.map((n) => n.x));
        const fechas = miembros.map((n) => n.periodo.fecha_inicio).filter(Boolean).sort();
        const fMin = fechas[0] ?? "0000-00-00";
        const fMax = fechas[fechas.length - 1] ?? "9999-99-99";
        let intentos = 0;
        let choque;
        do {
            choque = ramasOcupadas.find(
                (o) =>
                    seTraslapanFechas(fMin, fMax, o.fMin, o.fMax) &&
                    minX - NODE_HALF_W < o.maxX + NODE_HALF_W &&
                    maxX + NODE_HALF_W > o.minX - NODE_HALF_W
            );
            if (choque) {
                // Empuja en la dirección contraria al centro de la rama con la
                // que chocó — "se hace a un lado" en vez de superponerse.
                const centro = (minX + maxX) / 2;
                const centroChoque = (choque.minX + choque.maxX) / 2;
                const empuje = centro >= centroChoque ? BRANCH_LANE_GAP : -BRANCH_LANE_GAP;
                miembros.forEach((n) => { n.x += empuje; });
                minX += empuje;
                maxX += empuje;
            }
            intentos += 1;
        } while (choque && intentos < 12);
        ramasOcupadas.push({ minX, maxX, fMin, fMax, lane });
    };
    // Variante para historias de PLAZA: sólo anota su rectángulo (para que
    // una rama de EMPLEADO no se le encime), nunca la desplaza — ver nota en
    // el punto de uso.
    const registrarOcupacion = (miembros, lane) => {
        if (miembros.length === 0) return;
        const minX = Math.min(...miembros.map((n) => n.x));
        const maxX = Math.max(...miembros.map((n) => n.x));
        const fechas = miembros.map((n) => n.periodo.fecha_inicio).filter(Boolean).sort();
        const fMin = fechas[0] ?? "0000-00-00";
        const fMax = fechas[fechas.length - 1] ?? "9999-99-99";
        ramasOcupadas.push({ minX, maxX, fMin, fMax, lane });
    };

    // aristas provisionales (padre por clave -> hijo por clave); el hijo
    // puede ser un nodo YA EXISTENTE (reutilizado) o uno recién creado. Se
    // procesan en orden de carril: el ancla de cada entrada (parent) ya está
    // posicionada — es del tronco, o de una entrada anterior en este mismo
    // orden — así la posición se resuelve en una sola pasada, sin necesitar
    // un segundo recorrido global.
    const aristasCrudas = []; // { origenId, destinoId }
    entradas.forEach(([nodeId, exp]) => {
        const parent = nodosPorClave.get(nodeId);
        if (!parent) return; // el padre pudo dejar de existir si se reordenó algo
        const lane = laneMap.get(nodeId) ?? 0;
        let lista = exp.kind === "empleado" ? exp.datos.tramos : exp.datos.periodos;
        // Al expandir un EMPLEADO, su historia (sp_historia_empleado) incluye
        // TODOS sus tramos — incluida la gestión exacta que ya se ve en el
        // nodo padre (el mismo movimiento que disparó la expansión). Sin este
        // filtro, esa gestión aparece duplicada como primer nodo de la rama.
        if (exp.kind === "empleado") {
            lista = lista
                .filter((t) => !mismoTramo(t, parent.periodo))
                // sp_historia_empleado no trae nombre por tramo (es el mismo
                // empleado en todos) — se completa aquí con el de la
                // cabecera de la respuesta para poder pintarlo en el nodo.
                .map((t) => (t.nombre_completo ? t : { ...t, nombre_completo: exp.datos.nombre_completo }));
        }
        const grupo = Math.floor(lane / 2);

        if (exp.kind === "plaza") {
            // Historia de PLAZA: el ancla SIEMPRE es un nodo de la historia
            // de un EMPLEADO (esa plaza es la suya en ese tramo) — se
            // renderiza en la MISMA columna que el ancla, no a un lado:
            // cadena continua colgando de ese punto exacto, y el rank
            // cronológico global ya la reparte arriba (más vieja) y abajo
            // (más reciente) de ese nodo.
            const laneX = parent.x;
            let origenId = parent.id;
            lista.forEach((item, j) => {
                const clave = claveNodo(item) ?? `${nodeId}>plaza:${j}`;
                let hijo = buscar(clave, item);
                const esNuevo = !hijo;
                if (!hijo) hijo = { id: clave, kind: "branch", formato: "plaza", periodo: item, lane, esPrimero: false, j };
                if (j === 0) hijo.esPrimero = true;
                // kind !== "trunk": su posición es autoridad (columna fija del
                // tronco) — una colisión de id con un nodo de rama nunca debe
                // desplazarlo, sólo ganar una arista más hacia él.
                if (hijo.parentId === undefined && hijo.kind !== "trunk") {
                    hijo.parentId = origenId;
                    hijo.direccion = "plaza";
                    hijo.x = laneX;
                }
                if (esNuevo) {
                    registrar(clave, hijo);
                    nodos.push(hijo);
                }
                aristasCrudas.push({ origenId, destinoId: clave });
                origenId = clave; // cadena: el siguiente cuelga de éste, no del ancla
            });
        } else {
            // Historia de EMPLEADO: UNA SOLA LÍNEA continua que atraviesa el
            // ancla — a la izquierda sus movimientos ANTERIORES (más viejo
            // más lejos), a la derecha los POSTERIORES — cada tramo cuelga
            // del tramo vecino, nunca los dos directo del ancla (eso se veía
            // como ramas sueltas en vez de una sola trayectoria).
            const ancla = parent.periodo.fecha_inicio || "";
            const antes = [...lista.filter((t) => (t.fecha_inicio || "") < ancla)].reverse();
            const despues = lista.filter((t) => (t.fecha_inicio || "") >= ancla);
            const construirCadena = (items, signo) => {
                let origenId = parent.id;
                let xCadena = parent.x;
                items.forEach((item, k) => {
                    const clave = claveNodo(item) ?? `${nodeId}>empleado:${signo}:${k}`;
                    let hijo = buscar(clave, item);
                    const esNuevo = !hijo;
                    if (!hijo) hijo = { id: clave, kind: "branch", formato: "empleado", periodo: item, lane, esPrimero: false, j: k };
                    if (k === 0) hijo.esPrimero = true;
                    // Ver nota equivalente arriba (rama de plaza): un nodo del
                    // tronco nunca se reposiciona por una colisión de id.
                    if (hijo.parentId === undefined && hijo.kind !== "trunk") {
                        hijo.parentId = origenId;
                        hijo.direccion = "empleado";
                        hijo.x = xCadena + signo * (k === 0 ? BRANCH_BASE_X + grupo * BRANCH_LANE_GAP : BRANCH_BASE_X);
                    }
                    xCadena = hijo.x; // avanza aunque el nodo sea reutilizado
                    if (esNuevo) {
                        registrar(clave, hijo);
                        nodos.push(hijo);
                    }
                    aristasCrudas.push({ origenId, destinoId: clave });
                    origenId = clave;
                });
            };
            construirCadena(antes, -1);
            construirCadena(despues, 1);
        }

        // Sólo las ramas de EMPLEADO (el abanico a los lados) se empujan: su
        // x ya es una posición "elástica" (BRANCH_BASE_X + carril), correrla
        // un poco más no rompe nada. Una historia de PLAZA, en cambio, debe
        // quedar SIEMPRE en la misma columna exacta de su ancla (cadena
        // continua colgando de ese punto, ver comentario arriba) — moverla de
        // lado convierte esa línea recta en una curva lateral que se cruza
        // con la del propio ancla, el "doble lazo" que se veía. Sólo se
        // registra su rectángulo (para que LAS DEMÁS ramas la esquiven), sin
        // desplazarla nunca.
        const propios = nodos.filter((n) => n.lane === lane && n.kind !== "trunk");
        if (exp.kind === "empleado") {
            empujarSiChoca(propios, lane);
        } else {
            registrarOcupacion(propios, lane);
        }
    });

    // Rank cronológico GLOBAL (ver comentario de cabecera): un solo lienzo,
    // todos los nodos ordenados por su fecha real, sin importar tronco/rama.
    const ordenados = [...nodos].sort((a, b) => {
        const fa = a.periodo.fecha_inicio || "0000-00-00";
        const fb = b.periodo.fecha_inicio || "0000-00-00";
        if (fa !== fb) return fa < fb ? -1 : 1;
        const puntualA = a.periodo.fecha_fin && a.periodo.fecha_fin === a.periodo.fecha_inicio ? 0 : 1;
        const puntualB = b.periodo.fecha_fin && b.periodo.fecha_fin === b.periodo.fecha_inicio ? 0 : 1;
        if (puntualA !== puntualB) return puntualA - puntualB;
        return (a.periodo.id_registro_inicio || 0) - (b.periodo.id_registro_inicio || 0);
    });
    ordenados.forEach((n, i) => {
        n.y = i * ROW_HEIGHT;
    });

    const nodeById = new Map(nodos.map((n) => [n.id, n]));

    // Aristas: las del tronco van sólidas y rectas (una cadena por CADA
    // raíz, nunca entre raíces distintas); TODAS las de rama van punteadas
    // y CURVAS (ver render) — nunca se confunden con el tronco.
    const edges = [];
    columnas.forEach((col, rootIdx) => {
        for (let i = 1; i < col.length; i++) {
            const a = col[i - 1];
            const b = col[i];
            edges.push({ id: `e:trunk:${rootIdx}:${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: LINEA_GRIS, dashed: false, curva: false });
        }
    });
    aristasCrudas.forEach(({ origenId, destinoId }, i) => {
        const a = nodeById.get(origenId);
        const b = nodeById.get(destinoId);
        if (!a || !b) return;
        // La flechita debe leerse SIEMPRE viejo → nuevo, sin importar el
        // sentido en que se construyó la cadena (la mitad "antes" de una
        // historia de empleado cuelga del ancla hacia atrás en el tiempo, así
        // que ahí origen es más reciente que destino) — se orienta por y
        // (rank cronológico ya resuelto) en vez de por origen/destino.
        const [p0, p1] = a.y <= b.y ? [a, b] : [b, a];
        edges.push({ id: `e:${origenId}>${destinoId}:${i}`, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, color: LINEA_GRIS, dashed: true, curva: true });
    });

    // originDX/DY: desplazamiento hacia el nodo que lo creó, en unidades de
    // mundo — permite animar "la rama nace del padre" con un simple
    // gsap.fromTo({x:originDX,y:originDY},{x:0,y:0}) sin medir el DOM.
    nodos.forEach((n) => {
        if (n.parentId === undefined) return;
        const parent = nodeById.get(n.parentId);
        if (!parent) return;
        n.originDX = parent.x - n.x;
        n.originDY = parent.y - n.y;
    });

    return { nodes: nodos, edges };
}

/* ------------------------------------------------------------------ */
/* Un nodo del árbol: círculo + etiqueta completa debajo (fecha con año, */
/* tipo de periodo, entrada→salida, nombre) + botón ">" para expandir.  */
/* ------------------------------------------------------------------ */
function Nodo({ node, origin, plazaRaiz, seleccionado, cargando, expandido, onSelect, onToggle }) {
    const { periodo, formato } = node;
    const tipo = tipoDe(periodo, formato);
    const estilo = ESTILO_NODO[tipo] || ESTILO_NODO.ocupacion;
    const Icono = estilo.icon;
    const halo = "#621f32"; // un solo color para todo el árbol, tronco o rama
    const abierto = periodo.fecha_fin == null;
    const expansion = expansionDe(node, plazaRaiz);
    // En un nodo de EMPLEADO (su tramo en OTRA plaza) van los dos: el nombre
    // arriba, "Plaza X" debajo — nunca uno en lugar del otro.
    const nombre = periodo.nombre_completo || "";
    const plazaTexto = formato === "empleado" && periodo.posicion ? `Plaza ${periodo.posicion}` : "";

    return (
        // El div externo SOLO centra (translate -50%/-50%) y posiciona; GSAP
        // nunca lo toca, así que su transform de centrado nunca se pisa con
        // el del div interno (el que sí anima opacity/scale/x/y).
        <div
            data-node
            data-node-id={node.id}
            data-parent={node.parentId}
            data-origin-dx={node.originDX ?? 0}
            data-origin-dy={node.originDY ?? 0}
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
                        {cargando ? (
                            <Loader2 className="size-4 animate-spin text-white" />
                        ) : tipo === "ocupacion" && periodo.num_empleado ? (
                            // Nodo de ocupación (tronco o rama, plaza o empleado): la
                            // foto del empleado rellena el avatar; sin foto (404) cae
                            // al mismo guinda que el resto del árbol, no al gris
                            // genérico de las tablas.
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

                    {/* Botón de expandir: ícono y tooltip cambian según qué trae —
                        ">" para la trayectoria del empleado, edificio para la
                        historia de la plaza — así se distingue de un vistazo
                        cuál de las dos se está por abrir. */}
                    {expansion && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(node);
                            }}
                            title={
                                expandido
                                    ? "Ocultar"
                                    : expansion.kind === "empleado"
                                      ? "Desplegar historia del empleado"
                                      : "Desplegar historia de la plaza"
                            }
                            aria-label={
                                expandido
                                    ? "Ocultar"
                                    : expansion.kind === "empleado"
                                      ? "Desplegar historia del empleado"
                                      : "Desplegar historia de la plaza"
                            }
                            className={`absolute left-full top-1/2 ml-2.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 ${
                                expandido ? `${expansion.kind === "empleado" ? "rotate-90 " : ""}bg-[#621f32]` : "bg-white"
                            }`}
                        >
                            {cargando ? (
                                <Loader2 className="size-3 animate-spin" style={{ color: expandido ? "white" : "#621f32" }} />
                            ) : expansion.kind === "empleado" ? (
                                <ChevronRight className="size-3.5" style={{ color: expandido ? "white" : "#621f32" }} />
                            ) : (
                                <Building2 className="size-3.5" style={{ color: expandido ? "white" : "#621f32" }} />
                            )}
                        </button>
                    )}

                    {/* Sin badge de traslado: reclutamiento interno/traslado a otra
                        plaza es el MISMO caso de uso que conocer la trayectoria del
                        empleado — ya cubierto por el botón ">" (arriba), que expande
                        esa historia colgando de este nodo. No hace falta un segundo
                        control a la izquierda para lo mismo. */}
                </div>

                {/* Etiqueta: fecha completa (con año) → fin/vigente, tipo de
                    periodo, entrada→salida, nombre — en ese orden. */}
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
                    {plazaTexto && (
                        <span className="w-full truncate text-[9px] font-semibold text-slate-400">{plazaTexto}</span>
                    )}
                </div>

                {node.kind === "branch" && node.esPrimero && node.direccion !== "plaza" && (
                    <span
                        className="mt-0.5 max-w-[110px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow"
                        style={{ background: halo }}
                    >
                        rama
                    </span>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Panel de detalle del nodo seleccionado (fijo, no se mueve con el    */
/* canvas: evita medir posiciones DOM bajo pan/zoom).                  */
/* ------------------------------------------------------------------ */
// Solo información — TODOS los controles (expandir, ir a plaza destino) viven
// en el propio ícono del nodo, ninguno aquí.
function PanelDetalle({ node, onCerrar }) {
    if (!node) return null;
    const { periodo, formato } = node;
    const tipo = tipoDe(periodo, formato);
    const estilo = ESTILO_NODO[tipo] || ESTILO_NODO.ocupacion;
    const Icono = estilo.icon;

    return (
        <div className="absolute bottom-3 left-3 right-3 z-20 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-2xl backdrop-blur md:left-4 md:right-auto">
            <button
                onClick={onCerrar}
                className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                    {periodo.nombre_completo ? (
                        <p className="truncate text-sm font-bold text-slate-800">{periodo.nombre_completo}</p>
                    ) : formato === "empleado" && periodo.posicion ? (
                        <p className="truncate text-sm font-bold text-slate-800">Plaza {periodo.posicion}</p>
                    ) : null}
                </div>
            </div>

            {Boolean(periodo.inconsistente) && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <AlertTriangle className="size-3" />
                    El dato de origen se contradice en este periodo.
                </p>
            )}

            <p className="mt-2 text-xs text-slate-500">
                {fmtFecha(periodo.fecha_inicio)} {" → "}
                {periodo.fecha_fin == null ? (
                    <span className="font-semibold text-emerald-600">vigente</span>
                ) : (
                    fmtFecha(periodo.fecha_fin)
                )}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-medium">{fmtDias(periodo.dias)}</span>
            </p>

            {(periodo.accion_entrada || periodo.accion_salida) && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    {periodo.accion_entrada && (
                        <span>{periodo.accion_entrada}{periodo.motivo_entrada ? ` · ${periodo.motivo_entrada}` : ""}</span>
                    )}
                    {periodo.accion_salida && (
                        <>
                            <ArrowRight className="size-3 text-slate-300" />
                            <span>{periodo.accion_salida}{periodo.motivo_salida ? ` · ${periodo.motivo_salida}` : ""}</span>
                        </>
                    )}
                </p>
            )}

            {(periodo.nivel_entrada || periodo.nivel_salida) && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-400">Nivel:</span>
                    <span>{periodo.nivel_entrada || "—"}</span>
                    {periodo.nivel_salida && periodo.nivel_salida !== periodo.nivel_entrada && (
                        <>
                            <ArrowRight className="size-3 text-slate-300" />
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
export default function ArbolMovimientosSubTab() {
    // Vista exclusiva de SuperAdmin — cruza datos de plaza y empleado en un
    // mismo árbol; el resto de la app se gatea por permiso, pero ésta es
    // solo por rol, así que se revisa aquí y no vía RequirePermission.
    const { isLoading: authLoading, isSuperuser } = useAuth();

    const [consulta, setConsulta] = useState("");
    const [plaza, setPlaza] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    // expandidos: { [nodeId]: { kind: 'empleado'|'plaza', id, datos } }
    const [expandidos, setExpandidos] = useState({});
    const [cargandoRama, setCargandoRama] = useState(null); // nodeId en carga
    const [historial, setHistorial] = useState([]);
    const [seleccionado, setSeleccionado] = useState(null);
    const [zoom, setZoom] = useState(1);

    // Autocompletado del input de plaza: sugerencias del backend mientras se
    // escribe (mín. 2 caracteres), navegables con teclado.
    const [sugerencias, setSugerencias] = useState([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
    const [indiceActivo, setIndiceActivo] = useState(-1);

    // cache compartida: cualquier nodo que apunte al mismo empleado/plaza
    // reusa la misma respuesta, sin importar en qué parte del árbol esté.
    const cacheRef = useRef(new Map());
    const laneMapRef = useRef(new Map());
    // Id del nodo ancla cuya historia de PLAZA se acaba de pedir — la
    // "Entrada animada" lo lee una sola vez para centrar la cámara en él
    // (ver más abajo) y lo limpia; así el usuario no pierde de vista el
    // punto donde abrió la rama aunque el árbol ya sea grande.
    const centrarEnRef = useRef(null);
    const branchSeqRef = useRef(0);
    const abortRef = useRef(null);
    const abortSugRef = useRef(null);
    const debounceSugRef = useRef(null);

    const contenedorRef = useRef(null);
    const viewportRef = useRef(null);
    const worldRef = useRef(null);
    const inputRef = useRef(null);
    const draggableRef = useRef(null);
    const capturaRef = useRef(null);

    /* ---------------- Datos: buscar plaza / expandir nodo ----------- */
    const buscarPlaza = useCallback(async (num, { desdeHistorial = false } = {}) => {
        const limpia = String(num || "").trim();
        if (!limpia) return;

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setCargando(true);
        setError(null);

        try {
            let datos = cacheRef.current.get(`plaza:${limpia}`);
            if (!datos) {
                const res = await VacantesService.getHistoriaPlaza(limpia, { signal: ctrl.signal });
                if (!res.ok) {
                    const cuerpo = await res.json().catch(() => ({}));
                    throw new Error(cuerpo.detail || `No se encontró la plaza ${limpia}.`);
                }
                datos = await res.json();
                cacheRef.current.set(`plaza:${limpia}`, datos);
            }
            if (ctrl.signal.aborted) return;

            laneMapRef.current = new Map();
            branchSeqRef.current = 0;
            setExpandidos({});
            setSeleccionado(null);
            setPlaza(datos);
            setConsulta(limpia);
            if (!desdeHistorial) {
                setHistorial((prev) => (prev[prev.length - 1] === limpia ? prev : [...prev, limpia]));
            }
        } catch (e) {
            if (e.name === "AbortError") return;
            setError(e.message);
            if (inputRef.current) {
                gsap.fromTo(inputRef.current, { x: -6 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" });
            }
        } finally {
            if (!ctrl.signal.aborted) setCargando(false);
        }
    }, []);

    // Autocompletado: pide sugerencias con 200ms de debounce (una por
    // pausa de tecleo, no una por tecla) y aborta la anterior si sigue en
    // vuelo — sólo la última respuesta puede ser relevante.
    const pedirSugerencias = useCallback((texto) => {
        if (debounceSugRef.current) clearTimeout(debounceSugRef.current);
        const termino = texto.trim();
        if (termino.length < 2) {
            abortSugRef.current?.abort();
            setSugerencias([]);
            setIndiceActivo(-1);
            return;
        }
        debounceSugRef.current = setTimeout(async () => {
            abortSugRef.current?.abort();
            const ctrl = new AbortController();
            abortSugRef.current = ctrl;
            try {
                const res = await VacantesService.getPlazaSugerencias(termino, { signal: ctrl.signal });
                if (!res.ok || ctrl.signal.aborted) return;
                const datos = await res.json();
                if (ctrl.signal.aborted) return;
                setSugerencias(Array.isArray(datos) ? datos : []);
                setIndiceActivo(-1);
            } catch (e) {
                if (e.name !== "AbortError") setSugerencias([]);
            }
        }, 200);
    }, []);

    useEffect(
        () => () => {
            if (debounceSugRef.current) clearTimeout(debounceSugRef.current);
            abortSugRef.current?.abort();
        },
        []
    );

    // Cierra el desplegable al hacer clic fuera del buscador.
    useEffect(() => {
        if (!mostrarSugerencias) return;
        const onClickFuera = (e) => {
            if (!capturaRef.current?.contains(e.target)) setMostrarSugerencias(false);
        };
        document.addEventListener("mousedown", onClickFuera);
        return () => document.removeEventListener("mousedown", onClickFuera);
    }, [mostrarSugerencias]);

    const seleccionarSugerencia = useCallback(
        (sug) => {
            setMostrarSugerencias(false);
            setSugerencias([]);
            buscarPlaza(sug.posicion);
        },
        [buscarPlaza]
    );

    // Expande/colapsa el nodo recibido. El tipo de expansión (empleado o
    // plaza) sale de su propio formato — un nodo de plaza abre un empleado,
    // uno de empleado abre una plaza — permitiendo encadenar indefinidamente.
    const alternarRama = useCallback(
        async (node) => {
            const expansion = expansionDe(node, plazaRefActual.current);
            if (!expansion) return;
            const nodeId = node.id;

            if (expandidos[nodeId]) {
                setExpandidos((prev) => {
                    const copia = { ...prev };
                    delete copia[nodeId];
                    return copia;
                });
                return;
            }

            if (expansion.kind === "plaza") centrarEnRef.current = nodeId;

            const cacheKey = `${expansion.kind === "empleado" ? "emp" : "plaza"}:${expansion.id}`;
            const enCache = cacheRef.current.get(cacheKey);
            if (enCache) {
                if (!laneMapRef.current.has(nodeId)) laneMapRef.current.set(nodeId, branchSeqRef.current++);
                setExpandidos((prev) => ({ ...prev, [nodeId]: { kind: expansion.kind, id: expansion.id, datos: enCache } }));
                return;
            }

            setCargandoRama(nodeId);
            try {
                const res = expansion.kind === "empleado"
                    ? await VacantesService.getHistoriaEmpleado(expansion.id)
                    : await VacantesService.getHistoriaPlaza(expansion.id);
                if (!res.ok) {
                    throw new Error(expansion.kind === "empleado" ? "No se pudo cargar la trayectoria." : "No se pudo cargar la plaza.");
                }
                const datos = await res.json();
                cacheRef.current.set(cacheKey, datos);
                if (!laneMapRef.current.has(nodeId)) laneMapRef.current.set(nodeId, branchSeqRef.current++);
                setExpandidos((prev) => ({ ...prev, [nodeId]: { kind: expansion.kind, id: expansion.id, datos } }));
            } catch {
                centrarEnRef.current = null; // falló la carga: no queda rama que centrar
                setError(
                    expansion.kind === "empleado"
                        ? "No se pudo cargar la trayectoria del empleado."
                        : "No se pudo cargar la historia de esa plaza."
                );
            } finally {
                setCargandoRama(null);
            }
        },
        [expandidos]
    );

    // plazaRefActual: alternarRama necesita la plaza raíz VIGENTE dentro de un
    // callback memoizado por `expandidos` (que cambia más seguido que la
    // plaza); un ref evita recrear alternarRama en cada búsqueda de plaza.
    const plazaRefActual = useRef(null);
    useEffect(() => {
        plazaRefActual.current = plaza?.posicion ?? null;
    }, [plaza]);

    useEffect(() => () => abortRef.current?.abort(), []);

    /* ---------------- Layout ---------------------------------------- */
    const raices = useMemo(() => (plaza ? [plaza] : []), [plaza]);
    const { nodes, edges } = useMemo(() => {
        if (raices.length === 0) return { nodes: [], edges: [] };
        return calcularLayout(raices, expandidos, laneMapRef.current);
    }, [raices, expandidos]);

    const bbox = useMemo(() => {
        if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        const PAD = 110; // etiqueta multilínea de hasta 150px de ancho
        const xs = nodes.map((n) => n.x);
        const ys = nodes.map((n) => n.y);
        return {
            minX: Math.min(...xs) - PAD,
            maxX: Math.max(...xs) + PAD,
            minY: Math.min(...ys) - PAD,
            maxY: Math.max(...ys) + PAD + 40,
        };
    }, [nodes]);

    const origin = { x: -bbox.minX, y: -bbox.minY };
    const worldW = bbox.maxX - bbox.minX;
    const worldH = bbox.maxY - bbox.minY;

    // El nodo seleccionado puede haber cambiado de estado "expandido" tras un
    // toggle; se resuelve contra `nodes` en cada render para que el botón del
    // panel refleje siempre el estado real.
    const nodoSeleccionado = useMemo(() => {
        if (!seleccionado) return null;
        const vivo = nodes.find((n) => n.id === seleccionado);
        if (!vivo) return null;
        return { ...vivo, expandido: Boolean(expandidos[vivo.id]) };
    }, [seleccionado, nodes, expandidos]);

    /* ---------------- Pan (Draggable) + zoom (rueda) ------------------ */
    useGSAP(
        () => {
            if (!plaza || !viewportRef.current || !worldRef.current) return;

            const vp = viewportRef.current.getBoundingClientRect();
            const startX = vp.width / 2 - origin.x;
            const startY = 36;
            gsap.set(worldRef.current, { x: startX, y: startY, scale: 1 });
            setZoom(1);

            draggableRef.current?.[0]?.kill();
            // dragClickables:true — Draggable arma el pan desde CUALQUIER punto
            // del viewport, nodos incluidos, pero deja pasar el click nativo si
            // el puntero no se movió más allá de su umbral: seleccionar un nodo
            // con un click normal sigue funcionando sin lógica extra aquí.
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
        { scope: contenedorRef, dependencies: [plaza] }
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

    /* ---------------- Entrada animada: tronco, luego cada rama nueva -- */
    const prevRamasRef = useRef(new Set());
    // Última posición (x,y de mundo) conocida de cada nodo por id — permite
    // detectar, tras recalcular el layout, a quién movió `empujarSiChoca`
    // (colisión con una rama nueva) para animar ESE desplazamiento en vez de
    // que el nodo "salte" de golpe a su nueva posición.
    const prevLayoutRef = useRef(new Map());
    useGSAP(
        () => {
            if (!plaza || !worldRef.current) return;
            const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            const ramasActuales = new Set(Object.keys(expandidos));
            const ramasNuevas = [...ramasActuales].filter((e) => !prevRamasRef.current.has(e));
            // Reset genuino a "sin ramas" (nueva plaza) vs. colapsar la última
            // rama abierta se distinguen por el tamaño ANTERIOR: si ya había
            // ramas antes, es un colapso y no debe re-disparar la entrada del
            // tronco completo.
            const esCargaInicial = prevRamasRef.current.size === 0 && ramasActuales.size === 0;
            prevRamasRef.current = ramasActuales;

            const posicionAnterior = prevLayoutRef.current;
            const guardarPosiciones = () => {
                prevLayoutRef.current = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
            };

            if (reducido) {
                gsap.set("[data-node-inner]", { opacity: 1, scale: 1, x: 0, y: 0 });
                guardarPosiciones();
                return;
            }

            if (esCargaInicial) {
                // Primera carga del tronco: entra de arriba hacia abajo,
                // comunicando visualmente "qué pasó primero". Se anima el DIV
                // INTERNO de cada nodo (nunca el externo, que sólo centra) para
                // que el transform de GSAP no compita con el translate(-50%)
                // de Tailwind.
                const troncoNodos = gsap.utils.toArray("[data-node-inner]")
                    .filter((el) => !el.closest("[data-node]").dataset.parent);
                gsap.fromTo(
                    troncoNodos,
                    { opacity: 0, scale: 0, y: -14 },
                    {
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        duration: 0.45,
                        ease: "back.out(1.6)",
                        stagger: { each: 0.055, amount: 1.1 },
                    }
                );
                guardarPosiciones();
                return;
            }

            // Rama nueva: nace y crece DESDE su nodo padre hacia afuera (el
            // padre puede ser del tronco o de otra rama). El desplazamiento de
            // origen (data-origin-dx/dy) viene calculado en el layout — no
            // requiere medir el DOM ni pelear con el zoom.
            ramasNuevas.forEach((nodeId) => {
                const outers = gsap.utils.toArray("[data-node][data-parent]")
                    .filter((el) => el.dataset.parent === nodeId);
                const nodosRama = outers.map((el) => el.querySelector("[data-node-inner]")).filter(Boolean);
                nodosRama.forEach((el, i) => {
                    const outer = el.closest("[data-node]");
                    const dx = parseFloat(outer.dataset.originDx || 0);
                    const dy = parseFloat(outer.dataset.originDy || 0);
                    gsap.fromTo(
                        el,
                        { opacity: 0, scale: 0, x: dx, y: dy },
                        { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.5, delay: i * 0.09, ease: "power3.out" }
                    );
                });
            });

            // Reacomodo: un nodo YA dibujado (tenía posición previa) cuya x/y
            // cambió — típicamente porque `empujarSiChoca` lo corrió para
            // hacerle lugar a la rama nueva — se desliza a su lugar en vez de
            // saltar de golpe. Los nodos recién creados no tienen entrada en
            // `posicionAnterior` y ya los anima el bloque de arriba, así que
            // se ignoran aquí solos.
            nodes.forEach((n) => {
                const prev = posicionAnterior.get(n.id);
                if (!prev) return;
                const dx = prev.x - n.x;
                const dy = prev.y - n.y;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
                const outer = contenedorRef.current?.querySelector(`[data-node-id="${n.id}"]`);
                const el = outer?.querySelector("[data-node-inner]");
                if (!el) return;
                gsap.fromTo(el, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.5, ease: "power2.inOut" });
            });

            // Al abrir la historia de una PLAZA el árbol puede crecer mucho de
            // golpe (toda su cadena de ocupantes) — sin esto la rama nueva
            // nace fuera de vista y el usuario pierde el punto donde estaba.
            // Se centra la cámara en el punto medio del ancla + su rama nueva
            // (misma columna X siempre, ver `registrarOcupacion`), no sólo en
            // el ancla, para que la rama completa quede a la vista.
            if (centrarEnRef.current && viewportRef.current && worldRef.current) {
                const anchorId = centrarEnRef.current;
                centrarEnRef.current = null;
                const anchor = nodes.find((n) => n.id === anchorId);
                const laneNum = laneMapRef.current.get(anchorId);
                if (anchor && laneNum !== undefined) {
                    const miembros = nodes.filter((n) => n.lane === laneNum);
                    const ys = [anchor.y, ...miembros.map((n) => n.y)];
                    const targetX = origin.x + anchor.x;
                    const targetY = origin.y + (Math.min(...ys) + Math.max(...ys)) / 2;
                    const vp = viewportRef.current.getBoundingClientRect();
                    const cur = gsap.getProperty(worldRef.current, "scale");
                    gsap.to(worldRef.current, {
                        x: vp.width / 2 - targetX * cur,
                        y: vp.height / 2 - targetY * cur,
                        duration: 0.7,
                        ease: "power2.inOut",
                    });
                }
            }

            guardarPosiciones();
        },
        { scope: contenedorRef, dependencies: [plaza, expandidos] }
    );

    const resumen = useMemo(() => {
        if (!plaza) return null;
        return [
            { label: "Gestiones", valor: plaza.num_gestiones },
            { label: "Insubsistencias", valor: plaza.num_insubsistencias },
            { label: "Periodos", valor: plaza.periodos.length },
        ];
    }, [plaza]);

    /* -------------------------------------------------------------- */
    /* Acceso: solo SuperAdmin — después de todos los hooks (no se     */
    /* puede cortar antes sin romper el orden de hooks de React).      */
    /* -------------------------------------------------------------- */
    if (authLoading) return null;
    if (!isSuperuser) {
        return (
            <div className="flex w-full flex-col items-center justify-center px-6 text-center" style={{ height: "100%" }}>
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#621f32]/10">
                    <Building2 className="size-6 text-[#621f32]" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Acceso restringido</h2>
                <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                    Esta vista solo está disponible para usuarios con rol SuperAdmin.
                </p>
            </div>
        );
    }

    /* -------------------------------------------------------------- */
    /* Estado A: captura                                              */
    /* -------------------------------------------------------------- */
    if (!plaza) {
        return (
            <div ref={contenedorRef} className="flex w-full flex-col items-center justify-center px-6" style={{ height: "100%" }}>
                <div className="w-full max-w-md text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#621f32]/10">
                        <Building2 className="size-6 text-[#621f32]" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Árbol de movimientos</h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Escribe una plaza para ver su historia como un árbol: quién la ocupó, cuánto
                        tiempo estuvo vacante y hacia dónde se movió cada persona.
                    </p>

                    <div ref={inputRef} className="mt-6 flex items-center gap-2">
                        <div ref={capturaRef} className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                value={consulta}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setConsulta(val);
                                    setError(null);
                                    setMostrarSugerencias(true);
                                    pedirSugerencias(val);
                                }}
                                onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowDown" && mostrarSugerencias && sugerencias.length > 0) {
                                        e.preventDefault();
                                        setIndiceActivo((i) => Math.min(i + 1, sugerencias.length - 1));
                                    } else if (e.key === "ArrowUp" && mostrarSugerencias && sugerencias.length > 0) {
                                        e.preventDefault();
                                        setIndiceActivo((i) => Math.max(i - 1, -1));
                                    } else if (e.key === "Enter") {
                                        if (mostrarSugerencias && indiceActivo >= 0 && sugerencias[indiceActivo]) {
                                            seleccionarSugerencia(sugerencias[indiceActivo]);
                                        } else {
                                            setMostrarSugerencias(false);
                                            buscarPlaza(consulta);
                                        }
                                    } else if (e.key === "Escape") {
                                        setMostrarSugerencias(false);
                                    }
                                }}
                                placeholder="Ej. 20237084"
                                autoComplete="off"
                                role="combobox"
                                aria-expanded={mostrarSugerencias && sugerencias.length > 0}
                                aria-autocomplete="list"
                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#621f32] focus:ring-2 focus:ring-[#621f32]/15"
                            />

                            {mostrarSugerencias && sugerencias.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
                                    {sugerencias.map((sug, i) => (
                                        <button
                                            key={sug.posicion}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => seleccionarSugerencia(sug)}
                                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                                                i === indiceActivo ? "bg-[#621f32]/10" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block font-mono text-[13px] font-bold text-slate-800">{sug.posicion}</span>
                                                {sug.ocupada && sug.ocupante ? (
                                                    <span className="block truncate text-[11px] font-semibold text-[#621f32]">{sug.ocupante}</span>
                                                ) : sug.puesto ? (
                                                    <span className="block truncate text-[11px] text-slate-500">{sug.puesto}</span>
                                                ) : null}
                                            </span>
                                            <span
                                                className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                                    sug.ocupada ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                }`}
                                            >
                                                {sug.ocupada ? "Ocupada" : "Vacante"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setMostrarSugerencias(false);
                                buscarPlaza(consulta);
                            }}
                            disabled={cargando || !consulta.trim()}
                            className="flex items-center gap-2 rounded-xl bg-[#621f32] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4d1827] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {cargando ? <Loader2 className="size-4 animate-spin" /> : null}
                            Analizar
                        </button>
                    </div>

                    {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
                        <span>Ejemplos:</span>
                        {["20237084", "20235597", "10333721"].map((p) => (
                            <button
                                key={p}
                                onClick={() => buscarPlaza(p)}
                                className="rounded-md border border-slate-200 px-2 py-0.5 font-mono transition-colors hover:border-[#621f32] hover:text-[#621f32]"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* -------------------------------------------------------------- */
    /* Estado B: árbol (canvas)                                        */
    /* -------------------------------------------------------------- */
    return (
        <div ref={contenedorRef} className="flex h-full w-full flex-col overflow-hidden">
            {/* Cabecera fija */}
            <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white/80 px-5 py-3 backdrop-blur">
                <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-[#621f32]" />
                    <span className="font-mono text-sm font-bold text-slate-800">{plaza.posicion}</span>
                    <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            plaza.ocupada ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                    >
                        {plaza.ocupada ? "Ocupada" : "Vacante"}
                    </span>
                </div>

                {resumen.map((r) => (
                    <span key={r.label} className="text-[11px] text-slate-500">
                        <span className="font-bold text-slate-700">{r.valor}</span> {r.label}
                    </span>
                ))}

                {plaza.tiene_inconsistencias && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                        <AlertTriangle className="size-3" />
                        contiene datos inconsistentes
                    </span>
                )}

                {historial.length > 1 && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        {historial.slice(-4).map((p, i, arr) => (
                            <React.Fragment key={`${p}-${i}`}>
                                <button
                                    onClick={() => buscarPlaza(p, { desdeHistorial: true })}
                                    className={`font-mono transition-colors hover:text-[#621f32] ${
                                        p === plaza.posicion ? "font-bold text-[#621f32]" : ""
                                    }`}
                                >
                                    {p}
                                </button>
                                {i < arr.length - 1 && <ChevronRight className="size-3" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => {
                        setPlaza(null);
                        setConsulta("");
                        setExpandidos({});
                        setHistorial([]);
                        setSeleccionado(null);
                        setSugerencias([]);
                        setMostrarSugerencias(false);
                    }}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#621f32] hover:text-[#621f32]"
                >
                    <X className="size-3" />
                    Otra plaza
                </button>
            </div>

            {/* Canvas */}
            <div
                ref={viewportRef}
                className="relative min-h-0 flex-1 overflow-hidden bg-slate-50"
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
                        {edges.map((e) => {
                            const x1 = origin.x + e.x1;
                            const y1 = origin.y + e.y1;
                            const x2 = origin.x + e.x2;
                            const y2 = origin.y + e.y2;
                            if (!e.curva) {
                                return (
                                    <line
                                        key={e.id}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke={e.color}
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                    />
                                );
                            }
                            // Curva en S vertical: sube/baja de rama SIN
                            // volverse horizontal — el eje Y sigue marcando la
                            // cronología en todo el trazo.
                            const my = (y1 + y2) / 2;
                            const p0 = { x: x1, y: y1 };
                            const p1 = { x: x1, y: my };
                            const p2 = { x: x2, y: my };
                            const p3 = { x: x2, y: y2 };
                            return (
                                <React.Fragment key={e.id}>
                                    <path
                                        d={`M ${x1},${y1} C ${x1},${my} ${x2},${my} ${x2},${y2}`}
                                        fill="none"
                                        stroke={e.color}
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                        strokeDasharray="6 5"
                                    />
                                    {/* Dirección del trazo: sin esto, dos ramas
                                        cruzándose son indistinguibles de cuál
                                        corre hacia dónde. */}
                                    {ARROW_STOPS.map((t) => {
                                        const pt = puntoCubica(p0, p1, p2, p3, t);
                                        const tan = tangenteCubica(p0, p1, p2, p3, t);
                                        const angulo = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
                                        return (
                                            <path
                                                key={`${e.id}-flecha-${t}`}
                                                d="M -4,-5 L 3,0 L -4,5"
                                                fill="none"
                                                stroke={e.color}
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                opacity={0.9}
                                                transform={`translate(${pt.x},${pt.y}) rotate(${angulo})`}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </svg>

                    {nodes.map((n) => (
                        <Nodo
                            key={n.id}
                            node={n}
                            origin={origin}
                            plazaRaiz={plaza.posicion}
                            seleccionado={seleccionado === n.id}
                            cargando={cargandoRama === n.id}
                            expandido={Boolean(expandidos[n.id])}
                            onSelect={(node) => setSeleccionado(node.id)}
                            onToggle={alternarRama}
                        />
                    ))}
                </div>
            </div>

            {/* Controles de zoom */}
            <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1">
                <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <button onClick={() => zoomBoton(1.25)} className="flex size-9 items-center justify-center text-slate-600 hover:bg-slate-50">
                        <Plus className="size-4" />
                    </button>
                    <div className="border-t border-slate-100 px-1 py-1 text-center text-[10px] font-bold text-slate-400">
                        {Math.round(zoom * 100)}%
                    </div>
                    <button onClick={() => zoomBoton(0.8)} className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600 hover:bg-slate-50">
                        <Minus className="size-4" />
                    </button>
                    <button onClick={centrar} className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600 hover:bg-slate-50">
                        <Scan className="size-4" />
                    </button>
                </div>
                <span className="pointer-events-none mt-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                    arrastra · rueda
                </span>
            </div>

            <PanelDetalle node={nodoSeleccionado} onCerrar={() => setSeleccionado(null)} />
        </div>
    );
}
