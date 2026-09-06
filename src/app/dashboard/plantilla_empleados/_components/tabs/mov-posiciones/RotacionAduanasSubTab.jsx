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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    Check,
    ChevronLeft,
    FileSpreadsheet,
    Filter,
    Loader2,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import { gsap } from "gsap";
import ExcelJS from "exceljs";

import { VacantesService } from "@/services/vacantes.service";
import {
    formatDateEsMx,
    normalizeForSearch,
    getUniqueColumnValues,
    finalizeFilterDropdownValues,
    resolveColumnFilterCommit,
    applyColumnFilters,
    CONDITION_OPTIONS,
    CONDITION_SHORTHANDS,
    getConditionLabel,
} from "@/utils/columnFilters";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import {
    LETTERHEAD_LOGO_BASE64,
    LETTERHEAD_LOGO_WIDTH,
    LETTERHEAD_LOGO_HEIGHT,
} from "@/assets/letterhead-logo";
import FotoEmpleadoCell from "../../shared/FotoEmpleadoCell";

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

const fecha = (valor) => (valor ? formatDateEsMx(valor) : "—");

/** Desglose años/meses/días (no "1,8 años") — años y meses con longitud
 * promedio (365.25 / 30.44 días), suficiente para mostrar, no para calcular
 * fechas exactas. */
const duracion = (dias) => {
    if (dias === null || dias === undefined) return "";
    if (dias < 365) return `${dias} ${dias === 1 ? "día" : "días"}`;
    const anios = Math.floor(dias / 365.25);
    const restoTrasAnios = dias - Math.floor(anios * 365.25);
    const meses = Math.floor(restoTrasAnios / 30.44);
    const diasRestantes = Math.floor(restoTrasAnios - meses * 30.44);

    const partes = [];
    if (anios > 0) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
    if (diasRestantes > 0) partes.push(`${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`);
    return partes.join(", ");
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

/** Mismo criterio que `esInsubsistencia`, pero contra la GESTIÓN completa
 * (no un segmento) — usado por el "Consecutivo" del export a Excel, que debe
 * decidir esto ANTES de recorrer los segmentos de la gestión. */
const esInsubsistenciaGestion = (gestion) =>
    gestion.tipo_salida === "BAJA" && normalizeForSearch(gestion.salida_motivo_nombre || "").includes("insubsistencia");

/** Llave única de una gestión: aduana + titular + fecha en que entró a ella. */
const claveGestion = (aduanaNombre, gestion) => `${aduanaNombre}|${gestion.num_empleado}|${gestion.fecha_entrada}`;

/**
 * Anota cada entrada (segmento o vacancia) de la línea de tiempo de una
 * aduana con su "Consecutivo" — cuántos titulares REALES ha tenido la
 * aduana hasta esa fila (mismo criterio que la columna "Consecutivo" del
 * Excel y que "Titulares" del resumen: cuenta gestiones distintas, todos los
 * segmentos de una misma gestión —cambios de plaza dentro de la aduana—
 * comparten un solo número, y una gestión insubsistente nunca llegó a
 * ejercer así que no avanza el contador). Centralizado aquí porque tanto el
 * export a Excel como la tabla en pantalla necesitan exactamente el mismo
 * número en la misma fila.
 */
function anotarConsecutivos(entradas) {
    let consecutivoActual = 0;
    let claveGestionVista = null;
    let gestionVistaEsInsubsistencia = false;
    return entradas.map((entrada) => {
        if (entrada.tipo === "vacancia") return { entrada, consecutivo: "—" };
        const seg = entrada.dato;
        if (seg.claveGestion !== claveGestionVista) {
            claveGestionVista = seg.claveGestion;
            gestionVistaEsInsubsistencia = esInsubsistenciaGestion(seg.gestion);
            if (!gestionVistaEsInsubsistencia) consecutivoActual += 1;
        }
        return { entrada, consecutivo: gestionVistaEsInsubsistencia ? "—" : consecutivoActual };
    });
}

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
        // Último ítem que TODAVÍA pertenece a este segmento (misma plaza) —
        // el nivel/salario "al salir" de la plaza es el de ESTA fila, no el
        // de la primera fila del segmento siguiente: esa ya es la fila de
        // LLEGADA a la nueva plaza (posicion Y nivel_tabular/sal_base ya
        // cambiados ahí mismo), así que leerla como "salida" de la plaza
        // anterior mostraba el nivel/salario NUEVO en vez del que realmente
        // tuvo mientras ocupó esta plaza. Bug real reportado: plaza 10300874
        // (num_empleado 00020220323) se ejerció completa en A106 pero
        // "Nivel Tabular al Salir" mostraba A110 — el nivel de la SIGUIENTE
        // plaza (10300562), no el que tuvo aquí.
        const idxFin = seg.idxs[seg.idxs.length - 1];
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
            // Salario al ENTRAR a este segmento (fila del movimiento de
            // entrada, `items[idxInicio]`) — mismo campo que ya se muestra en
            // el acordeón "N mov." de la tarjeta en pantalla.
            salarioEntrada: items[idxInicio].sal_base ?? null,
            // Salario al DEJAR ESTA PLAZA: la última fila que todavía está en
            // ella (`idxFin`) — si es el último segmento de la gestión y de
            // verdad hubo salida (BAJA/TRASLADO/OTRO_PUESTO), coincide con el
            // último ítem de `items` (vigente → sin salida, queda null).
            salarioSalida: (esUltimo && !gestion.fecha_salida) ? null : (items[idxFin].sal_base ?? null),
            // Mismo criterio que salarioEntrada/salarioSalida: nivel tabular
            // al ENTRAR y al SALIR de ESTA PLAZA (no siempre es el mismo en
            // toda la gestión — un cambio de plaza dentro de la aduana puede
            // traer cambio de nivel).
            nivelEntrada: items[idxInicio].nivel_tabular ?? null,
            nivelSalida: (esUltimo && !gestion.fecha_salida) ? null : (items[idxFin].nivel_tabular ?? null),
            fechaCapturaDesde: items[idxInicio].fecha_captura,
            fechaCapturaHasta: esUltimo ? gestion.salida_fecha_captura : items[siguiente.idxs[0]].fecha_captura,
            entradaMotivo: esPrimero ? gestion.entrada_motivo_nombre : items[idxInicio].motivo_nombre,
            // `completo`: fila cruda del movimiento previo (mismo `idxInicio - 1`
            // que ya resuelve `valor`) — permite que `detalleProcedenciaPuesto`
            // muestre plaza/puesto/UA/depto de origen también para un cambio de
            // plaza DENTRO de la misma aduana, no solo para origen tipo PUESTO.
            entradaOrigen: esPrimero ? gestion.origen : { tipo: "PLAZA", valor: items[idxInicio - 1].posicion, completo: items[idxInicio - 1] },
            salidaMotivo: esUltimo ? gestion.salida_motivo_nombre : items[siguiente.idxs[0]].motivo_nombre,
            tipoSalida: esUltimo ? gestion.tipo_salida : "CAMBIO_PLAZA",
            salidaDestinoUnidad: esUltimo ? gestion.salida_destino_unidad : null,
            salidaDestinoPuesto: esUltimo ? gestion.salida_destino_puesto : null,
            salidaDestinoPlaza: esUltimo ? null : siguiente.plaza,
            // Fila cruda de ENTRADA al siguiente segmento (misma `idxs[0]` que
            // ya resuelve `salidaDestinoPlaza`) — para que `detalleDestinoPuesto`
            // muestre plaza/puesto/UA/depto también en un cambio de plaza
            // interno, no solo cuando la salida es a un puesto fuera de aduana.
            salidaDestinoCompleto: esUltimo ? null : items[siguiente.idxs[0]],
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
// Reporte formal (membrete compacto propio — ver addMembreteCompactoRotacion
// más abajo, distinto del membrete apilado que usa el resto del sistema en
// excelLetterhead.js) y una fila-banda por aduana para conservar, en formato
// tabular, la misma agrupación "una columna por aduana" que se ve en
// pantalla. La leyenda de colores por tipo de movimiento ya no es una fila
// aparte — la columna "Tipo de Movimiento" de la tabla trae el color/etiqueta
// de cada fila directamente (ver EXCEL_TIPO_COLOR).

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

// `uiWidth` (px) es SOLO para la tabla en pantalla — `width` (caracteres)
// es lo que ya consumía el export a Excel, escalas distintas a propósito.
// `detalle: true` marca las columnas satélite de Procedencia/Destino
// (plaza/puesto/UA/departamento/dependencia directa de origen y destino) —
// se llenan para CUALQUIER tipo de movimiento (traslado a otra aduana,
// cambio de plaza dentro de la misma aduana, o salida a un puesto fuera de
// titularidad), no solo puesto externo — ver `detalleProcedenciaPuesto`/
// `detalleDestinoPuesto`. "—" solo si de verdad no hay fila de origen/
// destino que mostrar (p. ej. alta nueva, o baja sin movimiento posterior).
const EXPORT_COLUMNS_ROTACION = [
    { key: "aduana", header: "Aduana", width: 30, uiWidth: 190 },
    { key: "codigosUa", header: "Código UA", width: 15, uiWidth: 90 },
    { key: "plaza", header: "Plaza", width: 13, uiWidth: 90 },
    { key: "nivelEntrada", header: "Nivel Tabular al Ingresar", width: 20, uiWidth: 130 },
    { key: "nivelSalida", header: "Nivel Tabular al Salir", width: 20, uiWidth: 130 },
    { key: "puesto", header: "Código de Puesto", width: 15, uiWidth: 110 },
    { key: "salarioEntrada", header: "Salario al Entrar", width: 21, uiWidth: 130 },
    { key: "salarioSalida", header: "Salario al Dejar", width: 20, uiWidth: 130 },
    { key: "nombrePuestoFuncional", header: "Nombre Puesto Funcional", width: 34, uiWidth: 220 },
    { key: "numEmpleado", header: "No. Empleado", width: 12, uiWidth: 100 },
    { key: "titular", header: "Titular", width: 32, uiWidth: 200 },
    { key: "fechaDesde", header: "Fecha Efectiva Desde", width: 14, uiWidth: 115 },
    { key: "fechaCapturaDesde", header: "Fecha Captura Desde", width: 14, uiWidth: 115 },
    { key: "fechaHasta", header: "Fecha Efectiva Hasta", width: 14, uiWidth: 115 },
    { key: "fechaCapturaHasta", header: "Fecha Captura Hasta", width: 14, uiWidth: 115 },
    { key: "duracion", header: "Duración", width: 14, uiWidth: 140 },
    { key: "motivoEntrada", header: "Motivo de Entrada", width: 30, uiWidth: 190 },
    { key: "procedencia", header: "Procedencia", width: 26, uiWidth: 230 },
    // Detalle de procedencia (ver detalleProcedenciaPuesto) — "Procedencia"
    // sola solo decía "Aduana X"/"Plaza X"/"Puesto X" sin más contexto.
    { key: "posicionOrigen", header: "Plaza Origen", width: 14, uiWidth: 100, detalle: true },
    { key: "nombrePuestoFuncionalOrigen", header: "Nombre Puesto Funcional Origen", width: 34, uiWidth: 220, detalle: true },
    { key: "uaOrigen", header: "UA Origen", width: 26, uiWidth: 170, detalle: true },
    { key: "deptoOrigen", header: "Departamento Origen", width: 18, uiWidth: 130, detalle: true },
    { key: "depDirectaOrigen", header: "Dependencia Directa Origen", width: 20, uiWidth: 150, detalle: true },
    { key: "motivoSalida", header: "Motivo de Salida", width: 30, uiWidth: 190 },
    { key: "tipoMovimiento", header: "Tipo de Movimiento", width: 22, uiWidth: 170 },
    { key: "destino", header: "Destino", width: 26, uiWidth: 170 },
    // Detalle de destino (ver detalleDestinoPuesto) — en columnas propias en
    // vez de todo apachurrado en "Destino".
    { key: "posicionDestino", header: "Posición", width: 14, uiWidth: 100, detalle: true },
    { key: "puestoDestino", header: "Código Puesto Destino", width: 18, uiWidth: 140, detalle: true },
    { key: "nombrePuestoFuncionalDestino", header: "Nombre Puesto Funcional Destino", width: 34, uiWidth: 220, detalle: true },
    { key: "uaDestino", header: "UA Destino", width: 26, uiWidth: 170, detalle: true },
    { key: "deptoDestino", header: "Departamento Destino", width: 18, uiWidth: 130, detalle: true },
    { key: "depDirectaDestino", header: "Dependencia Directa Destino", width: 20, uiWidth: 150, detalle: true },
];

// Tamaño de la foto y celda que la contiene, calibrados para que la foto
// quede CENTRADA en la celda (no pegada a una esquina) con un margen parejo
// de sobra en cada lado.
//
// El offset se calcula en EMU directo (`nativeColOff`/`nativeRowOff`), NO
// con la fracción decimal `tl: {col, row}` — esa fracción la convierte
// ExcelJS con su PROPIA escala interna (1 unidad de ancho de columna = 10000
// unidades internas, sin relación con los píxeles reales de Excel), así que
// una fracción calculada contra el ancho REAL en píxeles queda pegada a la
// esquina en vez de centrada. Verificado abriendo el .xlsx generado: con la
// fracción, el offset horizontal real salía en ~6px en vez de los ~40px
// esperados. `nativeColOff`/`nativeRowOff` sí se escriben tal cual en el XML
// (unidades EMU: 914400 EMU = 1 pulgada = 96px a 96dpi), sin pasar por esa
// conversión — por eso el cálculo aquí usa la fórmula REAL de Excel (ancho
// de columna en unidades -> px = unidades*7 + 5; alto de fila en puntos ->
// px = puntos * 4/3) y convierte el margen resultante a EMU a mano.
const FOTO_IMG_SIZE = 64; // px, ancho y alto de la foto insertada
const FOTO_COL_WIDTH = 20; // unidades de columna Excel
const FOTO_ROW_HEIGHT = 60; // puntos — ajustado al tamaño de la foto, no arbitrario
const EMU_POR_PX = 9525; // 914400 EMU/pulgada ÷ 96 px/pulgada
const FOTO_COL_WIDTH_PX = FOTO_COL_WIDTH * 7 + 5;
const FOTO_ROW_HEIGHT_PX = FOTO_ROW_HEIGHT * (4 / 3);
const FOTO_COL_OFFSET_EMU = Math.round(((FOTO_COL_WIDTH_PX - FOTO_IMG_SIZE) / 2) * EMU_POR_PX);
const FOTO_ROW_OFFSET_EMU = Math.round(((FOTO_ROW_HEIGHT_PX - FOTO_IMG_SIZE) / 2) * EMU_POR_PX);
// Esquina inferior-derecha del ancla — MISMA celda que el `tl` (col0,
// row-1), solo con el offset avanzado el tamaño de la foto. Con esto la
// foto queda anclada como "twoCellAnchor" (tl+br), no "oneCellAnchor"
// (tl+ext) — equivalente a `object_position=1` (xlMoveAndSize) del backend
// (ver excel_fotos.py): así la foto se MUEVE y se OCULTA junto con su fila
// al filtrar en Excel. Con tl+ext (lo que había antes) la foto quedaba fija
// en su lugar aunque la fila se ocultara por un filtro — bug real
// reportado ("las fotos de personas aparecen por ahí volando").
const FOTO_IMG_SIZE_EMU = FOTO_IMG_SIZE * EMU_POR_PX;
const FOTO_COL_OFFSET_BR_EMU = FOTO_COL_OFFSET_EMU + FOTO_IMG_SIZE_EMU;
const FOTO_ROW_OFFSET_BR_EMU = FOTO_ROW_OFFSET_EMU + FOTO_IMG_SIZE_EMU;

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
 * Detalle del puesto destino, en columnas propias — para CUALQUIER tipo de
 * salida (TRASLADO_ADUANA, CAMBIO_PLAZA, SALIDA_PUESTO), no solo cuando el
 * destino es un puesto fuera de titularidad de aduana: un cambio de plaza
 * interno usa la fila cruda de entrada al siguiente segmento
 * (`salidaDestinoCompleto`, ver `construirSegmentos`); cualquier salida de
 * la GESTIÓN (última fila) usa `gestion.salida_completo` — la misma fila
 * que la entrada a la nueva plaza/puesto/aduana (ver rotacion_aduanas.py).
 * "—" si no hay dato (p. ej. una BAJA sin fila de destino, o caché viejo de
 * antes de que el backend mandara estos campos).
 */
function detalleDestinoPuesto(seg) {
    // Una BAJA no tiene "destino" — `gestion.salida_completo` en ese caso es
    // la fila cruda del propio movimiento de baja (misma plaza, no una
    // nueva), así que mostrarla como "destino" es incorrecto (bug real
    // reportado: bajas con las columnas de destino llenas). Solo
    // TRASLADO_ADUANA y SALIDA_PUESTO son salidas reales a OTRA posición.
    const s = !seg.esUltimo
        ? seg.salidaDestinoCompleto
        : seg.tipoSalida === "TRASLADO_ADUANA" || seg.tipoSalida === "SALIDA_PUESTO"
          ? seg.gestion?.salida_completo
          : null;
    if (!s) {
        return {
            posicionDestino: "—",
            puestoDestino: "—",
            nombrePuestoFuncionalDestino: "—",
            uaDestino: "—",
            deptoDestino: "—",
            depDirectaDestino: "—",
        };
    }
    return {
        posicionDestino: s.posicion || "—",
        puestoDestino: s.cd_puesto || "—",
        nombrePuestoFuncionalDestino: s.nombre_puesto_funcional || "—",
        uaDestino: s.un_admin ? `${s.un_admin}${s.desc_larga_un ? ` — ${nombreCorto(s.desc_larga_un)}` : ""}` : "—",
        deptoDestino: s.id_depto || "—",
        depDirectaDestino: s.depen_direc || "—",
    };
}

/**
 * Detalle del puesto de PROCEDENCIA, en columnas propias — para CUALQUIER
 * tipo de origen (ADUANA, PLAZA, PUESTO), no solo cuando viene de un puesto
 * fuera de titularidad de aduana: un cambio de plaza interno usa la fila
 * cruda del movimiento anterior (`entradaOrigen.completo`, ver
 * `construirSegmentos`); el PRIMER segmento de la gestión (venga de un
 * traslado de otra aduana o de un puesto externo) usa
 * `gestion.origen_completo` — la misma fila que la salida de la posición
 * anterior (ver rotacion_aduanas.py). "—" si no hay dato (p. ej. alta nueva
 * sin origen previo, o caché viejo de antes de que el backend mandara estos
 * campos).
 */
function detalleProcedenciaPuesto(seg) {
    const o = seg.entradaOrigen?.tipo === "PLAZA" ? seg.entradaOrigen.completo : seg.esPrimero ? seg.gestion?.origen_completo : null;
    if (!o) {
        return {
            posicionOrigen: "—",
            nombrePuestoFuncionalOrigen: "—",
            uaOrigen: "—",
            deptoOrigen: "—",
            depDirectaOrigen: "—",
        };
    }
    return {
        posicionOrigen: o.posicion || "—",
        nombrePuestoFuncionalOrigen: o.nombre_puesto_funcional || "—",
        uaOrigen: o.un_admin ? `${o.un_admin}${o.desc_larga_un ? ` — ${nombreCorto(o.desc_larga_un)}` : ""}` : "—",
        deptoOrigen: o.id_depto || "—",
        depDirectaOrigen: o.depen_direc || "—",
    };
}

/**
 * Valores de UNA fila (segmento o vacancia) en el layout tabular — mismas
 * columnas y mismo texto que escribe el export a Excel (`EXPORT_COLUMNS_ROTACION`
 * + Foto/Consecutivo), compartido a propósito entre el Excel y la tabla en
 * pantalla (`TablaRotacion`) para que nunca diverjan. `consecutivo` viene de
 * `anotarConsecutivos`.
 */
function filaValoresRotacion(aduana, entrada, consecutivo) {
    const isVacancia = entrada.tipo === "vacancia";
    const seg = entrada.dato;

    if (isVacancia) {
        return {
            isVacancia: true,
            tipoColorKey: "VACANCIA",
            values: {
                aduana: aduana.aduana_corta,
                codigosUa: codigoUaActual(aduana),
                plaza: seg.plazaAncla || "—",
                nivelEntrada: "—",
                nivelSalida: "—",
                puesto: "—",
                salarioEntrada: "—",
                salarioSalida: "—",
                nombrePuestoFuncional: "—",
                numEmpleado: "—",
                titular: seg.abierta ? "— Sin titular hoy —" : "— Vacante —",
                fechaDesde: fecha(seg.desde),
                fechaCapturaDesde: "—",
                fechaHasta: seg.hasta ? fecha(seg.hasta) : "—",
                fechaCapturaHasta: "—",
                duracion: duracion(seg.dias),
                motivoEntrada: "—",
                procedencia: "—",
                posicionOrigen: "—",
                nombrePuestoFuncionalOrigen: "—",
                uaOrigen: "—",
                deptoOrigen: "—",
                depDirectaOrigen: "—",
                motivoSalida: "—",
                tipoMovimiento: seg.abierta ? "Sin titular hoy" : "Vacante",
                destino: "—",
                posicionDestino: "—",
                puestoDestino: "—",
                nombrePuestoFuncionalDestino: "—",
                uaDestino: "—",
                deptoDestino: "—",
                depDirectaDestino: "—",
                __consecutivo: "—",
            },
        };
    }

    const g = seg.gestion;
    const tipoColorKey = esInsubsistencia(seg) ? "INSUBSISTENCIA" : seg.tipoSalida;
    return {
        isVacancia: false,
        tipoColorKey,
        values: {
            aduana: aduana.aduana_corta,
            codigosUa: codigoUaActual(aduana),
            plaza: seg.plaza,
            nivelEntrada: seg.nivelEntrada || "—",
            nivelSalida: seg.nivelSalida || "—",
            puesto: g.cd_puesto || "—",
            salarioEntrada: typeof seg.salarioEntrada === "number" ? seg.salarioEntrada : "—",
            salarioSalida: typeof seg.salarioSalida === "number" ? seg.salarioSalida : "—",
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
            ...detalleProcedenciaPuesto(seg),
            motivoSalida: seg.salidaMotivo || "—",
            tipoMovimiento: esInsubsistencia(seg) ? "Baja (Insubsistencia)" : (TIPO_SALIDA[seg.tipoSalida] || TIPO_SALIDA.BAJA).etiqueta,
            destino: textoDestino(seg),
            ...detalleDestinoPuesto(seg),
            __consecutivo: consecutivo,
        },
    };
}

const LETTERHEAD_TITLE_LINES = [
    "AGENCIA NACIONAL DE ADUANAS DE MÉXICO",
    "UNIDAD DE ADMINISTRACIÓN Y FINANZAS",
    "DIRECCIÓN DE RECURSOS HUMANOS",
];

function fmtFechaHoraGeneracionRotacion() {
    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const hora = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${hora} horas del ${fecha}`;
}

/**
 * Membrete compacto (logo + título institucional + título del reporte, los
 * tres en la MISMA fila, uno al lado del otro) — layout ajustado a mano por
 * el usuario sobre el membrete apilado original (logo / título / leyenda en
 * 3 filas separadas de `addExcelLetterhead`, compartido por el resto del
 * sistema): aquí se reproduce ese ajuste tal cual, local a este export para
 * no tocar el membrete de los demás.
 *
 * Devuelve el número de filas que ocupó (2: logo+títulos, "reporte
 * generado") — el caller sigue escribiendo desde la siguiente fila.
 */
function addMembreteCompactoRotacion(workbook, worksheet, numCols, colOffset, logoWidth = 674) {
    const logoHeight = Math.round((logoWidth * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);
    const imageId = workbook.addImage({ base64: LETTERHEAD_LOGO_BASE64, extension: "png" });
    // nativeColOff/nativeRowOff en EMU directo, no la fracción `tl:{col,row}`
    // — esa fracción la convierte ExcelJS con su propia escala interna, sin
    // relación con píxeles reales (mismo motivo que el centrado de fotos).
    worksheet.addImage(imageId, {
        tl: { nativeCol: 0, nativeColOff: 124773, nativeRow: 0, nativeRowOff: 113249 },
        ext: { width: logoWidth, height: logoHeight },
    });
    worksheet.getRow(1).height = 101;

    // Título institucional: a la derecha del logo, en la misma fila.
    const tituloIniCol = 5 + colOffset;
    const tituloFinCol = 8 + colOffset;
    worksheet.mergeCells(1, tituloIniCol, 1, tituloFinCol);
    const tituloInstCell = worksheet.getCell(1, tituloIniCol);
    tituloInstCell.value = LETTERHEAD_TITLE_LINES.join("\n");
    tituloInstCell.font = { name: "Noto Sans", bold: true, size: 16, color: { argb: "FF621F32" } };
    tituloInstCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    // Título del reporte: extremo derecho, ocupa esta fila Y la siguiente
    // (misma altura visual que el bloque logo+título institucional).
    const reporteIniCol = numCols - 3;
    worksheet.mergeCells(1, reporteIniCol, 2, numCols);
    const tituloReporteCell = worksheet.getCell(1, reporteIniCol);
    tituloReporteCell.value = "ROTACIÓN DE TITULARES DE ADUANAS";
    tituloReporteCell.font = { name: "Noto Sans", bold: true, size: 22, color: { argb: "FF621F32" } };
    tituloReporteCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };

    // "Reporte generado..." — angosto, a la izquierda, debajo del logo.
    worksheet.mergeCells(2, 1, 2, 10);
    const generadoCell = worksheet.getCell(2, 1);
    generadoCell.value = `Reporte generado por el sistema de control de plazas a las ${fmtFechaHoraGeneracionRotacion()}.`;
    generadoCell.font = { name: "Noto Sans", italic: true, size: 9, color: { argb: "FF64748B" } };
    generadoCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(2).height = 15;

    return 2;
}

/**
 * Resumen por aduana (hoja "Resumen", primera pestaña del export): cuántos
 * titulares REALES ha tenido cada aduana y cuánto tiempo ha estado ocupada.
 *
 * "Titulares" usa el mismo criterio que la columna "Consecutivo" de la hoja
 * de detalle: cuenta gestiones distintas (un titular que cambió de plaza
 * DENTRO de la misma aduana sigue siendo el mismo titular), y una gestión
 * declarada insubsistente (ver esInsubsistenciaGestion) no cuenta — nunca
 * llegó a ejercer.
 *
 * "Tiempo ocupado" suma la duración de cada segmento que NO sea una vacancia
 * ni una insubsistencia (mismo criterio). "Días de Vacancia" suma la
 * duración de cada vacancia registrada. El "% de ocupación" compara días
 * ocupados contra la suma de días ocupados + días de vacancia (el periodo
 * con dato real para esa aduana).
 */
function construirResumenPorAduana(aduanas, entradasPorAduana) {
    return aduanas.map((aduana) => {
        const entradas = entradasPorAduana.get(aduana.aduana) || [];

        let titulares = 0;
        let diasOcupados = 0;
        let diasVacancia = 0;
        let claveGestionVista = null;
        let gestionVistaEsInsubsistencia = false;

        entradas.forEach((entrada) => {
            if (entrada.tipo === "vacancia") {
                const dias = diasEntre(entrada.dato.desde, entrada.dato.hasta);
                if (dias) diasVacancia += dias;
                return;
            }
            const seg = entrada.dato;
            if (seg.claveGestion !== claveGestionVista) {
                claveGestionVista = seg.claveGestion;
                gestionVistaEsInsubsistencia = esInsubsistenciaGestion(seg.gestion);
                if (!gestionVistaEsInsubsistencia) titulares += 1;
            }
            if (gestionVistaEsInsubsistencia || esInsubsistencia(seg)) return;
            const dias = diasEntre(seg.fechaDesde, seg.fechaHasta);
            if (dias) diasOcupados += dias;
        });

        const diasConDato = diasOcupados + diasVacancia;

        return {
            aduana: aduana.aduana,
            codigosUa: codigoUaActual(aduana),
            titulares,
            diasOcupados,
            diasVacancia,
            fraccionOcupada: diasConDato > 0 ? Math.min(diasOcupados / diasConDato, 1) : 0,
            sinTitularHoy: !aduana.titular_actual,
        };
    });
}

const RESUMEN_COLUMNS = [
    { key: "aduana", header: "Aduana", width: 36 },
    { key: "codigosUa", header: "Código UA", width: 13 },
    { key: "titulares", header: "Titulares", width: 12 },
    { key: "diasOcupados", header: "Días Ocupada", width: 14 },
    { key: "tiempoOcupado", header: "Tiempo Ocupado", width: 26 },
    { key: "diasVacancia", header: "Días de Vacancia", width: 16 },
    { key: "porcentajeOcupado", header: "% Periodo de Ocupación", width: 20 },
];

/**
 * Membrete propio de la hoja "Resumen" — no reusa addMembreteCompactoRotacion
 * porque ese layout coloca el título del reporte a partir de `numCols - 3`,
 * pensado para las ~32 columnas de la hoja de detalle; con las 7 columnas de
 * esta hoja esa cuenta encima al título institucional (rangos de mergeCells
 * superpuestos, que ExcelJS rechaza). Aquí todo va apilado en 3 filas, ancho
 * completo de la tabla real.
 */
function addMembreteResumen(workbook, worksheet, numCols) {
    const logoWidth = 260;
    const logoHeight = Math.round((logoWidth * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);
    const imageId = workbook.addImage({ base64: LETTERHEAD_LOGO_BASE64, extension: "png" });
    worksheet.addImage(imageId, {
        tl: { nativeCol: 0, nativeColOff: 60000, nativeRow: 0, nativeRowOff: 60000 },
        ext: { width: logoWidth, height: logoHeight },
    });
    worksheet.getRow(1).height = 60;

    worksheet.mergeCells(1, 3, 1, numCols);
    const tituloInstCell = worksheet.getCell(1, 3);
    tituloInstCell.value = LETTERHEAD_TITLE_LINES.join("\n");
    tituloInstCell.font = { name: "Noto Sans", bold: true, size: 11, color: { argb: "FF621F32" } };
    tituloInstCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

    worksheet.mergeCells(2, 1, 2, numCols);
    const tituloReporteCell = worksheet.getCell(2, 1);
    tituloReporteCell.value = "RESUMEN DE ROTACIÓN DE TITULARES DE ADUANAS";
    tituloReporteCell.font = { name: "Noto Sans", bold: true, size: 16, color: { argb: "FF621F32" } };
    tituloReporteCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(2).height = 26;

    worksheet.mergeCells(3, 1, 3, numCols);
    const generadoCell = worksheet.getCell(3, 1);
    generadoCell.value = `Reporte generado por el sistema de control de plazas a las ${fmtFechaHoraGeneracionRotacion()}.`;
    generadoCell.font = { name: "Noto Sans", italic: true, size: 9, color: { argb: "FF64748B" } };
    generadoCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(3).height = 15;

    return 3;
}

/** Arma la hoja "Resumen" completa (membrete + tabla + fila de totales). */
function addHojaResumenAduanas(workbook, resumenPorAduana) {
    const worksheet = workbook.addWorksheet("Resumen");
    const numCols = RESUMEN_COLUMNS.length;
    worksheet.columns = RESUMEN_COLUMNS.map(({ key, width }) => ({ key, width }));

    let row = addMembreteResumen(workbook, worksheet, numCols) + 1;
    const lastCol = worksheet.getColumn(numCols).letter;

    worksheet.mergeCells(`A${row}:${lastCol}${row}`);
    const subtitleCell = worksheet.getCell(`A${row}`);
    subtitleCell.value = "Titulares y tiempo de ocupación por aduana (excluye vacancias e insubsistencias).";
    subtitleCell.font = { name: "Noto Sans", italic: true, size: 9, color: { argb: "FF64748B" } };
    subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(row).height = 16;
    row += 1;

    const headerRowNum = row;
    const headerRow = worksheet.getRow(headerRowNum);
    const goldBorder = { style: "thin", color: { argb: "FFBC955C" } };
    RESUMEN_COLUMNS.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.border = { top: goldBorder, left: goldBorder, bottom: goldBorder, right: goldBorder };
        cell.font = { name: "Noto Sans", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    headerRow.height = 30;
    row += 1;

    const thinGray = { style: "thin", color: { argb: "FF94A3B8" } };
    const porcentajeColIdx = RESUMEN_COLUMNS.findIndex((c) => c.key === "porcentajeOcupado") + 1;
    let totalTitulares = 0;
    let totalDiasOcupados = 0;
    let totalDiasVacancia = 0;

    resumenPorAduana.forEach((r, i) => {
        totalTitulares += r.titulares;
        totalDiasOcupados += r.diasOcupados;
        totalDiasVacancia += r.diasVacancia;

        const dataRow = worksheet.getRow(row);
        const values = {
            aduana: r.aduana,
            codigosUa: r.codigosUa,
            titulares: r.titulares,
            diasOcupados: r.diasOcupados,
            tiempoOcupado: duracion(r.diasOcupados) || "0 días",
            diasVacancia: r.diasVacancia,
            porcentajeOcupado: r.fraccionOcupada,
        };
        // Aduana sin titular HOY: fondo rosita claro en la fila completa
        // (mismo tono que usa la hoja de detalle para insubsistencias,
        // EXCEL_FILA_INSUBSISTENCIA_BG) — anula el zebra a propósito, debe
        // saltar a la vista sin importar la paridad de la fila.
        const filaFillColor = r.sinTitularHoy ? EXCEL_FILA_INSUBSISTENCIA_BG : (i % 2 === 1 ? "FFF9FAFB" : null);
        RESUMEN_COLUMNS.forEach((col, ci) => {
            const cell = dataRow.getCell(ci + 1);
            cell.value = values[col.key];
            cell.border = { top: thinGray, left: thinGray, bottom: thinGray, right: thinGray };
            cell.font = { name: "Noto Sans", size: 9 };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            if (filaFillColor) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: filaFillColor } };
        });
        const pctCell = dataRow.getCell(porcentajeColIdx);
        pctCell.numFmt = "0.0%";
        pctCell.font = { name: "Noto Sans", bold: true, size: 9, color: { argb: "FF621F32" } };
        if (r.sinTitularHoy) {
            dataRow.getCell(1).font = { name: "Noto Sans", size: 9, italic: true, color: { argb: "FFBE123C" } };
        }
        worksheet.getRow(row).height = 18;
        row += 1;
    });

    // Fila de totales: titulares, días ocupados y días de vacancia sumados
    // directo; el % es ponderado (días ocupados / (ocupados + vacancia)
    // totales), no un promedio simple de porcentajes por aduana.
    const totalRow = worksheet.getRow(row);
    const totalDiasConDato = totalDiasOcupados + totalDiasVacancia;
    const totalValues = {
        aduana: "TOTAL",
        codigosUa: "",
        titulares: totalTitulares,
        diasOcupados: totalDiasOcupados,
        tiempoOcupado: duracion(totalDiasOcupados) || "0 días",
        diasVacancia: totalDiasVacancia,
        porcentajeOcupado: totalDiasConDato > 0 ? totalDiasOcupados / totalDiasConDato : 0,
    };
    RESUMEN_COLUMNS.forEach((col, ci) => {
        const cell = totalRow.getCell(ci + 1);
        cell.value = totalValues[col.key];
        cell.border = { top: { style: "double", color: { argb: "FFBC955C" } }, left: thinGray, bottom: thinGray, right: thinGray };
        cell.font = { name: "Noto Sans", bold: true, size: 9.5, color: { argb: "FF3E131F" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5EBEF" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    totalRow.getCell(porcentajeColIdx).numFmt = "0.0%";
    worksheet.getRow(row).height = 20;
    const totalRowNum = row;
    row += 1;

    worksheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: totalRowNum - 1, column: numCols } };
    worksheet.views = [{ state: "frozen", ySplit: headerRowNum, showGridLines: false }];
}

/**
 * Arma y descarga el Excel formal de rotación de titulares de aduanas:
 * hoja "Resumen" (titulares y tiempo de ocupación por aduana) + membrete
 * institucional y una fila por segmento/vacancia (mismas `entradasPorAduana`
 * que ya alimentan el diagrama en pantalla) agrupadas por aduana con una
 * banda separadora. Exporta exactamente las aduanas visibles (`aduanas`, ya
 * filtradas por búsqueda/chips) para que el archivo coincida con lo que el
 * usuario ve.
 */
async function exportarRotacionAExcel({ aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, canViewPhoto }) {
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

    // "Consecutivo": cuántos titulares REALES tuvo la aduana hasta esta fila
    // (una insubsistencia nunca llegó a ejercer, así que no cuenta; una
    // vacancia no es un titular). Va junto a "Foto" siempre, la tenga la
    // exportación o no.
    const CONSECUTIVO_COL = { key: "__consecutivo", header: "Consecutivo", width: 12 };
    const columns = incluirFotos
        ? [{ key: "__foto", header: "Foto", width: FOTO_COL_WIDTH }, CONSECUTIVO_COL, ...EXPORT_COLUMNS_ROTACION]
        : [CONSECUTIVO_COL, ...EXPORT_COLUMNS_ROTACION];
    const tipoMovimientoCol = columns.findIndex((c) => c.key === "tipoMovimiento") + 1;
    const consecutivoCol = columns.findIndex((c) => c.key === "__consecutivo") + 1;
    const fechaDesdeCol = columns.findIndex((c) => c.key === "fechaDesde") + 1;
    const fechaHastaCol = columns.findIndex((c) => c.key === "fechaHasta") + 1;
    const salarioEntradaCol = columns.findIndex((c) => c.key === "salarioEntrada") + 1;
    const salarioSalidaCol = columns.findIndex((c) => c.key === "salarioSalida") + 1;

    const workbook = new ExcelJS.Workbook();

    // Hoja "Resumen": PRIMERA pestaña del workbook — el orden de
    // `addWorksheet` es el orden de las pestañas en Excel.
    addHojaResumenAduanas(workbook, construirResumenPorAduana(aduanas, entradasPorAduana));

    const worksheet = workbook.addWorksheet("Rotación de Aduanas");
    const numCols = columns.length;
    worksheet.columns = columns.map(({ key, width }) => ({ key, width }));

    // Logo + título institucional + título del reporte, los tres en la misma
    // fila (más "reporte generado" en la fila siguiente) — layout compacto
    // pedido explícito, ver addMembreteCompactoRotacion.
    // +1 por "Consecutivo" (siempre presente) y +1 más por "Foto" si aplica.
    const colOffset = (incluirFotos ? 1 : 0) + 1;
    let row = addMembreteCompactoRotacion(workbook, worksheet, numCols, colOffset, 674) + 1;
    const lastCol = worksheet.getColumn(numCols).letter;

    worksheet.mergeCells(row, 1, row, 10);
    const statsCell = worksheet.getCell(row, 1);
    statsCell.value = `${resumen.aduanas} aduanas · ${resumen.titulares} titulares · ${resumen.gestiones} gestiones · ${resumen.vacancias} vacancias · ${resumen.acefalasHoy} sin titular hoy`;
    statsCell.font = { name: "Noto Sans", italic: true, size: 10, color: { argb: "FF621F32" } };
    statsCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(row).height = 18;
    row += 1;

    const notasFiltro = [];
    if (busqueda?.trim()) notasFiltro.push(`búsqueda "${busqueda.trim()}"`);
    if (notasFiltro.length > 0) {
        worksheet.mergeCells(`A${row}:${lastCol}${row}`);
        const filtroCell = worksheet.getCell(`A${row}`);
        filtroCell.value = `Vista exportada con ${notasFiltro.join(" · ")}.`;
        filtroCell.font = { name: "Noto Sans", italic: true, size: 9, color: { argb: "FFB45309" } };
        filtroCell.alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getRow(row).height = 16;
        row += 1;
    }

    // Fila agrupadora: "Procedencia" sobre sus 4 columnas de detalle de
    // origen, "Destino" sobre sus 6 columnas de detalle de destino — antes
    // esta fila iba en blanco, ahora deja claro que esas columnas satélite
    // pertenecen al mismo grupo que su columna resumen.
    const grupoBorder = { style: "thin", color: { argb: "FFBC955C" } };
    const grupoFont = { name: "Noto Sans", bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const grupoFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
    const grupoAlign = { vertical: "middle", horizontal: "center" };
    const procIni = columns.findIndex((c) => c.key === "procedencia") + 1;
    const procFin = columns.findIndex((c) => c.key === "depDirectaOrigen") + 1;
    worksheet.mergeCells(row, procIni, row, procFin);
    const procGrupoCell = worksheet.getCell(row, procIni);
    procGrupoCell.value = "Procedencia";
    procGrupoCell.font = grupoFont;
    procGrupoCell.fill = grupoFill;
    procGrupoCell.alignment = grupoAlign;
    procGrupoCell.border = { bottom: grupoBorder };
    const destIni = columns.findIndex((c) => c.key === "destino") + 1;
    const destFin = columns.findIndex((c) => c.key === "depDirectaDestino") + 1;
    worksheet.mergeCells(row, destIni, row, destFin);
    const destGrupoCell = worksheet.getCell(row, destIni);
    destGrupoCell.value = "Destino";
    destGrupoCell.font = grupoFont;
    destGrupoCell.fill = grupoFill;
    destGrupoCell.alignment = grupoAlign;
    destGrupoCell.border = { bottom: grupoBorder };
    worksheet.getRow(row).height = 18;
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
        cell.font = { name: "Noto Sans", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    headerRow.height = 40;
    row += 1;

    // Gris más oscuro que el gris casi invisible de antes (FFE2E8F0) — a
    // pedido explícito, para que la cuadrícula se note al abrir el archivo.
    const thinGray = { style: "thin", color: { argb: "FF94A3B8" } };

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

        // Banda por aduana: DOS celdas, no una — la primera (hasta "Código
        // UA") con el nombre COMPLETO de la aduana ("Aduana de X con sede en
        // Y", no el corto que ya usa la columna "Aduana" de cada fila), la
        // segunda (el resto de las columnas) con el titular actual (o "Sin
        // titular actualmente").
        const tieneTitular = !!aduana.titular_actual;
        const bandaRow = worksheet.getRow(row);
        const bandaSplitCol = columns.findIndex((c) => c.key === "codigosUa") + 1;
        const bandaSplitColLetter = worksheet.getColumn(bandaSplitCol).letter;

        worksheet.mergeCells(`A${row}:${bandaSplitColLetter}${row}`);
        const nombreCell = worksheet.getCell(`A${row}`);
        nombreCell.value = aduana.aduana;
        nombreCell.font = { name: "Noto Sans", bold: true, size: 9.5, color: { argb: "FF3E131F" } };
        nombreCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5EBEF" } };
        nombreCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

        const estadoIniLetter = worksheet.getColumn(bandaSplitCol + 1).letter;
        worksheet.mergeCells(`${estadoIniLetter}${row}:${lastCol}${row}`);
        const estadoCell = worksheet.getCell(`${estadoIniLetter}${row}`);
        estadoCell.value = tieneTitular ? `Titular actual: ${aduana.titular_actual}` : "Sin titular actualmente";
        estadoCell.font = { name: "Noto Sans", bold: !tieneTitular, italic: !tieneTitular, size: 9.5, color: { argb: tieneTitular ? "FF3E131F" : "FFBE123C" } };
        estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: tieneTitular ? "FFF5EBEF" : "FFFFF1F2" } };
        estadoCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

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
            vacCell.font = { name: "Noto Sans", italic: true, size: 9, color: { argb: "FF94A3B8" } };
            vacCell.alignment = { vertical: "middle", horizontal: "center" };
            row += 1;
            return;
        }

        // "Consecutivo" + valores de cada fila: misma lógica que la tabla en
        // pantalla (ver anotarConsecutivos/filaValoresRotacion), para que
        // ambas vistas nunca diverjan.
        anotarConsecutivos(entradas).forEach(({ entrada, consecutivo }, i) => {
            const isVacancia = entrada.tipo === "vacancia";
            const seg = entrada.dato;
            const { values, tipoColorKey } = filaValoresRotacion(aduana, entrada, consecutivo);

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
                cell.font = { name: "Noto Sans", size: 9 };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                if (filaFillColor) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: filaFillColor } };
            });

            const colores = EXCEL_TIPO_COLOR[tipoColorKey] || EXCEL_TIPO_COLOR.BAJA;
            const tipoCell = dataRow.getCell(tipoMovimientoCol);
            tipoCell.font = { name: "Noto Sans", bold: true, size: 9, color: { argb: colores.text } };
            tipoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colores.bg } };
            tipoCell.alignment = { vertical: "middle", horizontal: "center" };

            // Destaca "Fecha Efectiva Desde"/"Fecha Efectiva Hasta" — tinte
            // dorado + negrita, para que salten a la vista frente al resto
            // de columnas (pedido explícito).
            // Mismo rosita/guinda que la banda "Titular actual: ..." de cada
            // aduana (ver estadoCell más abajo) — pedido explícito.
            const fechaDestacadaFont = { name: "Noto Sans", bold: true, size: 9, color: { argb: "FF3E131F" } };
            const fechaDestacadaFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5EBEF" } };
            const fechaDesdeCell = dataRow.getCell(fechaDesdeCol);
            fechaDesdeCell.font = fechaDestacadaFont;
            fechaDesdeCell.fill = fechaDestacadaFill;
            const fechaHastaCell = dataRow.getCell(fechaHastaCol);
            fechaHastaCell.font = fechaDestacadaFont;
            fechaHastaCell.fill = fechaDestacadaFill;

            // Salario al entrar / al dejar: celdas NUMÉRICAS en formato
            // CONTABILIDAD (no texto) cuando hay dato — así Excel las trata
            // como número real (suma, ordena, filtra por rango), no como una
            // cadena con signo de pesos pegado a mano. Negritas a propósito.
            const ACCOUNTING_FMT = '_-$* #,##0.00_-;-$* #,##0.00_-;_-$* "-"??_-;_-@_-';
            if (typeof values.salarioEntrada === "number") {
                const salarioEntradaCell = dataRow.getCell(salarioEntradaCol);
                salarioEntradaCell.numFmt = ACCOUNTING_FMT;
                salarioEntradaCell.font = { name: "Noto Sans", size: 9 };
                salarioEntradaCell.alignment = { vertical: "middle", horizontal: "right" };
            }
            if (typeof values.salarioSalida === "number") {
                const salarioSalidaCell = dataRow.getCell(salarioSalidaCol);
                salarioSalidaCell.numFmt = ACCOUNTING_FMT;
                salarioSalidaCell.font = { name: "Noto Sans", size: 9 };
                salarioSalidaCell.alignment = { vertical: "middle", horizontal: "right" };
            }

            // Foto del titular — se REGISTRA de nuevo (workbook.addImage) en
            // CADA fila donde aparece, aunque sea el mismo titular repetido
            // por un cambio de plaza interno. NO reusar un mismo imageId en
            // dos filas no-adyacentes: ExcelJS 4.4.0 tiene un bug real en
            // worksheet-xform.js (el caché `drawingRelsHash` mezcla el índice
            // "imageId" con el índice "cuántas relaciones lleva creadas el
            // drawing" — dos contadores con significado distinto que
            // divergen apenas hay suficientes fotos) que hace que la SEGUNDA
            // ancla de un imageId reusado termine apuntando a la foto de OTRO
            // empleado sin relación (verificado con un archivo real: la
            // segunda fila de un titular con 2 segmentos mostraba la foto de
            // alguien de otra aduana). Registrar de nuevo por fila pesa un
            // poco más el archivo pero evita el bug por completo — el fetch
            // de red sigue cacheado en `fotosPorEmpleado`, solo cambia que se
            // vuelve a insertar en el workbook.
            if (incluirFotos && !isVacancia) {
                const numEmpleadoFoto = String(seg.gestion?.num_empleado || "");
                const foto = fotosPorEmpleado.get(numEmpleadoFoto);
                if (foto) {
                    const imageId = workbook.addImage({ buffer: foto.buffer, extension: foto.extension });
                    worksheet.addImage(imageId, {
                        tl: {
                            nativeCol: 0,
                            nativeColOff: FOTO_COL_OFFSET_EMU,
                            nativeRow: row - 1,
                            nativeRowOff: FOTO_ROW_OFFSET_EMU,
                        },
                        br: {
                            nativeCol: 0,
                            nativeColOff: FOTO_COL_OFFSET_BR_EMU,
                            nativeRow: row - 1,
                            nativeRowOff: FOTO_ROW_OFFSET_BR_EMU,
                        },
                        editAs: "twoCell",
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
        celda.font = { name: "Noto Sans", size: 9, underline: true, color: { argb: "FF1D4ED8" } };
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

// ─── Tabla en pantalla ──────────────────────────────────────────────────────
// Mismas columnas y mismos textos que `exportarRotacionAExcel` (comparten
// `EXPORT_COLUMNS_ROTACION`, `anotarConsecutivos` y `filaValoresRotacion`) —
// esta tabla es justo lo que el usuario ve ANTES de exportar, no una vista
// aparte que pueda desincronizarse del archivo.

/** Mismo criterio de color que `EXCEL_TIPO_COLOR`, en clases Tailwind — pero
 * a diferencia del badge/pastilla, aquí PINTAN LA CELDA COMPLETA de "Tipo de
 * Movimiento" (a pedido explícito), así que llevan más saturación que un
 * badge normal para seguir siendo legibles a ese tamaño. */
const BADGE_TIPO_MOVIMIENTO = {
    ACTIVO: "bg-[#621f32] text-white dark:bg-[#7a2740]",
    TRASLADO_ADUANA: "bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300",
    CAMBIO_PLAZA: "bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    SALIDA_PUESTO: "bg-[#bc955c]/35 text-[#5c4322] dark:bg-[#bc955c]/25 dark:text-[#e3c793]",
    BAJA: "bg-slate-200/70 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
    INSUBSISTENCIA: "bg-rose-200/80 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300",
    VACANCIA: "bg-slate-200/50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
};

/** Letra estilo hoja de cálculo (A, B, ... Z, AA, AB, ...) — misma función
 * que ya usa `DataTable`/`HistoryDataTable`, para que el encabezado de esta
 * tabla se lea igual que el resto de tablas de plantilla. */
function getColumnLetterRotacion(index) {
    let letter = "";
    let n = index;
    while (n >= 0) {
        letter = String.fromCharCode((n % 26) + 65) + letter;
        n = Math.floor(n / 26) - 1;
    }
    return letter;
}

/** Foto + Consecutivo van SIEMPRE al frente, antes de las columnas del Excel
 * — mismo orden que `columns` en `exportarRotacionAExcel`. Siempre las 32
 * columnas completas (Procedencia/Destino con su detalle incluido) — mismo
 * layout que exporta el Excel, sin nada oculto por defecto. */
function useColumnasTabla(canViewPhoto) {
    return useMemo(
        () => [
            ...(canViewPhoto ? [{ key: "__foto", header: "Foto", uiWidth: 56 }] : []),
            { key: "__consecutivo", header: "No.", uiWidth: 52 },
            ...EXPORT_COLUMNS_ROTACION,
        ],
        [canViewPhoto]
    );
}

/** Celda de texto genérica: truncada con tooltip — la mayoría de las 30
 * columnas son texto/fecha/código sin tratamiento especial. */
function CeldaTexto({ value, className = "" }) {
    const texto = value === null || value === undefined || value === "" ? "—" : String(value);
    return (
        <td className={`truncate border-r border-slate-300 px-3 align-middle text-[12.5px] text-slate-800 dark:border-slate-600 dark:text-slate-200 ${className}`} title={texto}>
            {texto}
        </td>
    );
}

function FilaTabla({ fila, i, canViewPhoto, scrollRootRef, ctx, rowRef }) {
    const { entrada, values, tipoColorKey, isVacancia } = fila;
    const seg = entrada.dato;
    const badge = BADGE_TIPO_MOVIMIENTO[tipoColorKey] || BADGE_TIPO_MOVIMIENTO.BAJA;

    // Mismo criterio que el Excel: el ÚLTIMO segmento de una gestión que
    // salió por TRASLADO_ADUANA sabe a qué fila salta (destino resuelto vía
    // `destinoSegmentoPorClave`); un CAMBIO_PLAZA (cambio de plaza DENTRO de
    // la misma aduana) enlaza directo a `claveSiguienteSegmento`, ya
    // resuelto por `construirSegmentos`.
    let claveDestino = null;
    if (!isVacancia) {
        if (seg.esUltimo) claveDestino = ctx.destinoSegmentoPorClave.get(seg.claveGestion) || null;
        else if (seg.tipoSalida === "CAMBIO_PLAZA") claveDestino = seg.claveSiguienteSegmento || null;
    }

    // "Procedencia" dinámica — mismo criterio que el Excel: si esta plaza se
    // ocupó tras un cambio de plaza DENTRO de la misma aduana, el origen es
    // el segmento anterior de la misma gestión (`claveSegmentoAnterior`, ya
    // resuelto); si vino de OTRA aduana (TRASLADO_ADUANA), el origen se
    // resuelve vía `origenSegmentoPorClave` (mapa inverso de destino).
    let claveProcedencia = null;
    if (!isVacancia) {
        if (seg.entradaOrigen?.tipo === "PLAZA" && seg.claveSegmentoAnterior) {
            claveProcedencia = seg.claveSegmentoAnterior;
        } else if (seg.entradaOrigen?.tipo === "ADUANA") {
            claveProcedencia = ctx.origenSegmentoPorClave.get(entrada.clave) || null;
        }
    }

    const filaFillClass = tipoColorKey === "INSUBSISTENCIA"
        ? "bg-rose-50/70 dark:bg-rose-950/20"
        : i % 2 === 1 ? "bg-slate-50/70 dark:bg-slate-900/30" : "bg-white dark:bg-slate-950";

    return (
        <tr
            ref={rowRef}
            className={`h-[44px] transition-colors hover:bg-[#621f32]/[0.03] dark:hover:bg-[#bc955c]/[0.05] ${filaFillClass}`}
        >
            {canViewPhoto && (
                <td className="border-r border-slate-300 px-1.5 text-center align-middle dark:border-slate-600">
                    {!isVacancia && (
                        <FotoEmpleadoCell
                            numempleado={seg.gestion.num_empleado}
                            rootRef={scrollRootRef}
                            enabled={canViewPhoto}
                            size={26}
                            caption={seg.gestion.cd_puesto ? `${seg.gestion.nombre} · ${seg.gestion.cd_puesto}` : seg.gestion.nombre}
                        />
                    )}
                </td>
            )}
            <td className="border-r border-slate-300 px-1 text-center align-middle font-mono text-[12px] font-black text-[#621f32] dark:border-slate-600 dark:text-[#e3c793]">
                {values.__consecutivo}
            </td>
            {ctx.columnas.map((col) => {
                if (col.key === "tipoMovimiento") {
                    return (
                        <td key={col.key} className={`truncate border-r border-slate-300 px-2 text-center align-middle text-[10.5px] font-black uppercase tracking-wide dark:border-slate-600 ${badge}`}>
                            {values.tipoMovimiento}
                        </td>
                    );
                }
                if (col.key === "procedencia" && claveProcedencia) {
                    return (
                        <td key={col.key} className="border-r border-slate-300 px-2 align-middle dark:border-slate-600">
                            <button
                                type="button"
                                onClick={() => ctx.viajarA(claveProcedencia, entrada.clave)}
                                title="Ir a la fila de donde viene"
                                className="group flex w-full min-w-0 cursor-pointer items-center gap-1 text-[12.5px] font-bold text-amber-700 hover:text-amber-900 dark:text-amber-500 dark:hover:text-amber-400"
                            >
                                <ArrowRight className="size-2.5 shrink-0 -scale-x-100 transition-transform group-hover:-translate-x-1" />
                                <span className="min-w-0 flex-1 truncate underline decoration-dotted">{values.procedencia}</span>
                            </button>
                        </td>
                    );
                }
                if (col.key === "destino" && claveDestino) {
                    return (
                        <td key={col.key} className="border-r border-slate-300 px-2 align-middle dark:border-slate-600">
                            <button
                                type="button"
                                onClick={() => ctx.viajarA(claveDestino, entrada.clave)}
                                title="Ir a la fila destino"
                                className="group flex w-full min-w-0 cursor-pointer items-center gap-1 text-[12.5px] font-bold text-amber-700 hover:text-amber-900 dark:text-amber-500 dark:hover:text-amber-400"
                            >
                                <span className="min-w-0 flex-1 truncate underline decoration-dotted">{values.destino}</span>
                                <ArrowRight className="size-2.5 shrink-0 transition-transform group-hover:translate-x-1" />
                            </button>
                        </td>
                    );
                }
                if (col.key === "fechaDesde" || col.key === "fechaHasta") {
                    return (
                        <td key={col.key} className="truncate border-r border-slate-300 bg-[#621f32]/[0.035] px-2 align-middle font-mono text-[12.5px] font-bold text-[#3e131f] dark:border-slate-600 dark:bg-[#bc955c]/[0.06] dark:text-[#e3c793]" title={String(values[col.key])}>
                            {values[col.key]}
                        </td>
                    );
                }
                if (col.key === "salarioEntrada" || col.key === "salarioSalida") {
                    const num = values[col.key];
                    return (
                        <td key={col.key} className="truncate border-r border-slate-300 px-2 text-right align-middle font-mono text-[12.5px] text-slate-800 dark:border-slate-600 dark:text-slate-200">
                            {typeof num === "number" ? `$${Math.round(num).toLocaleString("es-MX")}` : "—"}
                        </td>
                    );
                }
                if (col.key === "aduana") {
                    return <CeldaTexto key={col.key} value={values.aduana} className="font-bold text-[#621f32] dark:text-[#e3c793]" />;
                }
                if (col.key === "titular") {
                    return <CeldaTexto key={col.key} value={values.titular} className="font-bold" />;
                }
                return <CeldaTexto key={col.key} value={values[col.key]} />;
            })}
        </tr>
    );
}

function TablaRotacion({ aduanas, entradasPorAduana, cardRefs, canViewPhoto, scrollAreaRef, destinoSegmentoPorClave, onIrADestino }) {
    const columnas = useColumnasTabla(canViewPhoto);
    const numCols = columnas.length;
    // Columnas "reales" (sin Foto/Consecutivo, que tienen su propia celda
    // fija) — la lista que se recorre para pintar encabezado, buscador y
    // celdas de cada fila.
    const columnasVisibles = useMemo(() => columnas.filter((c) => c.key !== "__foto" && c.key !== "__consecutivo"), [columnas]);

    // Anchos de columna redimensionados a mano (override sobre `uiWidth`) —
    // por clave de columna, solo las que el usuario haya arrastrado. El
    // control vive en la esquina inferior derecha de cada encabezado (grip
    // diagonal, como el de un `<textarea>`) y solo permite arrastre
    // HORIZONTAL: el ancho de fila (alto) no cambia.
    const [colWidths, setColWidths] = useState({});
    const anchoDe = useCallback((col) => colWidths[col.key] ?? col.uiWidth, [colWidths]);
    const handleResizeStart = useCallback(
        (e, colKey) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startWidth = colWidths[colKey] ?? columnasVisibles.find((c) => c.key === colKey)?.uiWidth ?? 120;
            const onMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                setColWidths((prev) => ({ ...prev, [colKey]: Math.max(60, startWidth + deltaX) }));
            };
            const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        },
        [colWidths, columnasVisibles]
    );

    // Inverso de `destinoSegmentoPorClave` a nivel de SEGMENTO — mismo
    // mecanismo que `origenSegmentoPorClave` en `exportarRotacionAExcel`:
    // se llena recorriendo el segmento que SALE por TRASLADO_ADUANA (ahí se
    // conoce a la vez su propia clave y la del segmento al que llega), y
    // alimenta el link de "Procedencia" en la fila de llegada. Se calcula
    // sobre TODAS las aduanas (`entradasPorAduana`, no el `aduanas` ya
    // filtrado) para que el link funcione aunque la aduana de origen esté
    // oculta por el buscador/chips — igual criterio que `destinoSegmentoPorClave`.
    const origenSegmentoPorClave = useMemo(() => {
        const map = new Map();
        entradasPorAduana.forEach((entradas) => {
            entradas.forEach((e) => {
                if (e.tipo !== "segmento" || !e.dato.esUltimo || e.dato.tipoSalida !== "TRASLADO_ADUANA") return;
                const claveDestino = destinoSegmentoPorClave.get(e.dato.claveGestion);
                if (claveDestino) map.set(claveDestino, e.clave);
            });
        });
        return map;
    }, [entradasPorAduana, destinoSegmentoPorClave]);

    const ctx = useMemo(
        () => ({ viajarA: onIrADestino, destinoSegmentoPorClave, origenSegmentoPorClave, columnas: columnasVisibles }),
        [onIrADestino, destinoSegmentoPorClave, origenSegmentoPorClave, columnasVisibles]
    );

    // Filas SIN filtro de columna (solo con el consecutivo/valores ya
    // resueltos) — base para dos cosas: (1) el universo de valores únicos que
    // ofrece `ColumnFilterDropdown` (para que la lista de opciones no se
    // encoja al ir marcando filtros de OTRAS columnas), y (2) la lista real
    // que se pinta, ya con `filters.columnFilters` aplicado.
    const filasBasePorAduana = useMemo(() => {
        return aduanas.map((aduana) => {
            const entradas = entradasPorAduana.get(aduana.aduana) || [];
            const filas = anotarConsecutivos(entradas).map(({ entrada, consecutivo }) => ({
                entrada,
                ...filaValoresRotacion(aduana, entrada, consecutivo),
            }));
            return { aduana, entradasOriginal: entradas, filas };
        });
    }, [aduanas, entradasPorAduana]);

    // Filtro de columna estilo Excel — mismo mecanismo que el resto de tablas
    // de plantilla (`useColumnFilters` + `ColumnFilterDropdown` + el
    // buscador rápido con condición, estilo `DataTable`), combinados con AND
    // vía `applyColumnFilters` (la misma lógica canónica que ya usan las
    // demás tablas). `values` ya es un objeto plano con una clave por
    // columna, así que basta con envolver cada fila en un arreglo de 1.
    const filters = useColumnFilters();

    // Dropdown de condición del buscador rápido (contiene/empieza con/es
    // igual a…, ver `CONDITION_OPTIONS`) — se porta a `document.body` vía
    // `createPortal` (posicionado por el rect del botón) para no quedar
    // recortado por el `overflow-auto` de la tabla, igual que `DataTable`.
    const [conditionDropdownRect, setConditionDropdownRect] = useState(null);
    const closeConditionDropdown = useCallback(() => {
        filters.setActiveConditionDropdown(null);
        setConditionDropdownRect(null);
    }, [filters]);
    useEffect(() => {
        if (!filters.activeConditionDropdown) return;
        const scrollEl = scrollAreaRef.current;
        if (!scrollEl) return;
        const handleScroll = () => closeConditionDropdown();
        scrollEl.addEventListener("scroll", handleScroll);
        return () => scrollEl.removeEventListener("scroll", handleScroll);
    }, [filters.activeConditionDropdown, scrollAreaRef, closeConditionDropdown]);

    const columnasFiltradas = filters.columnFilters;
    const hayFiltroActivo =
        Object.keys(columnasFiltradas).some((k) => columnasFiltradas[k]?.length > 0) ||
        Object.values(filters.textFilters).some((f) => f?.value?.trim());

    const cumpleFiltros = useCallback(
        (values) => applyColumnFilters([values], { columnFilters: columnasFiltradas, textFilters: filters.textFilters }).length > 0,
        [columnasFiltradas, filters.textFilters]
    );

    const filasPorAduana = useMemo(
        () =>
            filasBasePorAduana.map(({ aduana, entradasOriginal, filas }) => ({
                aduana,
                entradasOriginal,
                filas: hayFiltroActivo ? filas.filter((f) => cumpleFiltros(f.values)) : filas,
            })),
        [filasBasePorAduana, hayFiltroActivo, cumpleFiltros]
    );

    // Universo de valores de la columna con el dropdown abierto — se calcula
    // solo bajo demanda (no las 32 columnas en cada render) sobre
    // `filasBasePorAduana` (sin el propio filtro de columna, para no
    // "comerse a sí mismo" al reabrir un filtro ya aplicado).
    const columnaActiva = filters.activeFilterDropdown;
    const todasLasFilasBase = useMemo(() => filasBasePorAduana.flatMap((g) => g.filas.map((f) => f.values)), [filasBasePorAduana]);
    const baseUniqueValues = useMemo(
        () => (columnaActiva ? getUniqueColumnValues(todasLasFilasBase, columnaActiva) : []),
        [todasLasFilasBase, columnaActiva]
    );
    const filteredValues = useMemo(() => {
        const q = normalizeForSearch(filters.filterSearchText);
        return q ? baseUniqueValues.filter((v) => normalizeForSearch(v.value).includes(q)) : baseUniqueValues;
    }, [baseUniqueValues, filters.filterSearchText]);
    const dropdownValues = useMemo(
        () =>
            finalizeFilterDropdownValues({
                baseUniqueValues,
                filtered: filteredValues,
                tempSelectedValues: filters.tempSelectedValues,
                committedSelectedValues: columnaActiva ? columnasFiltradas[columnaActiva] || [] : [],
            }),
        [baseUniqueValues, filteredValues, filters.tempSelectedValues, columnasFiltradas, columnaActiva]
    );

    const handleOpenFilter = useCallback(
        (colKey) => {
            const committed = columnasFiltradas[colKey] || [];
            const valores = getUniqueColumnValues(todasLasFilasBase, colKey);
            filters.setTempSelectedValues(committed.length > 0 ? committed : valores.map((v) => v.value));
            filters.setActiveFilterDropdown(colKey);
        },
        [columnasFiltradas, todasLasFilasBase, filters]
    );
    const handleApplyFilter = useCallback(() => {
        const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(filters.tempSelectedValues, dropdownValues.allVals);
        filters.setColumnFilters((prev) => {
            const next = { ...prev };
            if (shouldClear) delete next[columnaActiva];
            else next[columnaActiva] = valuesToCommit;
            return next;
        });
        filters.setActiveFilterDropdown(null);
    }, [filters, dropdownValues, columnaActiva]);
    const handleClearFilter = useCallback(() => {
        filters.setColumnFilters((prev) => {
            const next = { ...prev };
            delete next[columnaActiva];
            return next;
        });
        filters.setActiveFilterDropdown(null);
    }, [filters, columnaActiva]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {hayFiltroActivo && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white px-3 py-1.5 dark:border-slate-800/80 dark:bg-slate-950">
                    <button
                        type="button"
                        onClick={() => { filters.setColumnFilters({}); filters.setTextFilters({}); }}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-500"
                    >
                        <X className="size-3" /> Quitar filtros de columna
                    </button>
                </div>
            )}

            <div ref={scrollAreaRef} className="custom-scrollbar min-h-[420px] overflow-auto md:min-h-0 md:flex-1">
                <table className="w-full border-collapse text-left" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                        {canViewPhoto && <col style={{ width: 56 }} />}
                        <col style={{ width: 52 }} />
                        {columnasVisibles.map((c) => (
                            <col key={c.key} style={{ width: anchoDe(c) }} />
                        ))}
                    </colgroup>
                    <thead className="sticky top-0 z-30 bg-[#501929] text-white shadow-md dark:bg-[#3e131f]">
                        <tr>
                            {canViewPhoto && <th className="border-r border-[#621f32]/35 bg-[#40121e] px-1 py-2.5 text-center align-middle text-[10px] font-bold text-slate-400">Foto</th>}
                            <th className="border-r border-[#621f32]/35 bg-[#40121e] px-1 py-2.5 text-center align-middle text-[10px] font-bold text-slate-400">No.</th>
                            {columnasVisibles.map((col, index) => {
                                const hasFilter = (columnasFiltradas[col.key]?.length || 0) > 0 || !!(filters.textFilters[col.key] && filters.textFilters[col.key].value);
                                return (
                                    <th
                                        key={col.key}
                                        className={`relative border-r border-[#621f32]/30 px-3 py-2.5 font-black uppercase transition-colors ${
                                            hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : "bg-[#501929] text-slate-200"
                                        }`}
                                    >
                                        {hasFilter && <div className="absolute top-1 right-1 size-2 animate-pulse rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />}
                                        <div className="flex w-full flex-col items-center gap-1">
                                            <span className={`font-mono text-[9.5px] ${hasFilter ? "text-[#3e131f]/70" : "text-[#bc955c]"}`}>{getColumnLetterRotacion(index)}</span>
                                            <div className="flex w-full items-center justify-center gap-1.5">
                                                <span className="truncate text-[11px]" title={col.header}>{col.header}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenFilter(col.key)}
                                                    title={columnasFiltradas[col.key]?.length ? `${columnasFiltradas[col.key].length} valor(es) filtrado(s)` : "Filtrar columna"}
                                                    className="shrink-0 cursor-pointer rounded p-0.5 transition-colors hover:bg-black/10"
                                                >
                                                    <Filter className={`size-2.5 fill-current ${hasFilter ? "text-[#3e131f]" : "text-white/50"}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                        <tr className="bg-[#40121e] dark:bg-[#2b0d15]">
                            {canViewPhoto && <th className="border-r border-[#621f32]/35" />}
                            <th className="border-r border-[#621f32]/35" />
                            {columnasVisibles.map((col) => {
                                const filterObj = filters.textFilters[col.key] || { value: "", condition: "contains" };
                                const condition = filterObj.condition || "contains";
                                const symbol = CONDITION_SHORTHANDS[condition] || "*";
                                return (
                                    <th key={`f-${col.key}`} className="relative border-r border-[#621f32]/30 p-1.5">
                                        <div className="relative flex w-full items-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (filters.activeConditionDropdown === col.key) {
                                                        closeConditionDropdown();
                                                    } else {
                                                        setConditionDropdownRect(e.currentTarget.getBoundingClientRect());
                                                        filters.setActiveConditionDropdown(col.key);
                                                    }
                                                }}
                                                title={`Condición: ${getConditionLabel(condition)}`}
                                                className="absolute left-1.5 z-10 flex size-4 cursor-pointer select-none items-center justify-center rounded border border-white/15 bg-white/10 text-[8px] font-black text-white transition-colors hover:bg-white/20"
                                            >
                                                {symbol}
                                            </button>
                                            <input
                                                type="text"
                                                value={filterObj.value || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    filters.setTextFilters((prev) => {
                                                        const next = { ...prev };
                                                        if (val === "") delete next[col.key];
                                                        else next[col.key] = { value: val, condition };
                                                        return next;
                                                    });
                                                }}
                                                placeholder="Filtrar…"
                                                className="w-full rounded-md border border-white/5 bg-white/10 py-1.5 pl-7 pr-2 text-[10.5px] font-bold text-white outline-none placeholder-white/30 transition-all hover:bg-white/20 focus:border-[#bc955c]/50 focus:bg-white/30"
                                            />
                                        </div>

                                        {/* Grip de redimensionado — esquina inferior derecha, SOLO
                                            arrastre horizontal (igual que un `<textarea>`, pero
                                            restringido a ancho: el alto de la fila no cambia). */}
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, col.key)}
                                            title="Arrastra para cambiar el ancho de la columna"
                                            className="absolute bottom-0 right-0 z-20 flex size-3.5 cursor-ew-resize items-end justify-end p-0.5 text-white/40 transition-colors hover:text-white"
                                        >
                                            <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
                                                <circle cx="8" cy="2" r="1" />
                                                <circle cx="8" cy="5" r="1" />
                                                <circle cx="8" cy="8" r="1" />
                                                <circle cx="5" cy="5" r="1" />
                                                <circle cx="5" cy="8" r="1" />
                                                <circle cx="2" cy="8" r="1" />
                                            </svg>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                        {filasPorAduana.map(({ aduana, entradasOriginal, filas }) => {
                            if (entradasOriginal.length === 0 || (hayFiltroActivo && filas.length === 0)) {
                                if (entradasOriginal.length === 0) {
                                    return (
                                        <React.Fragment key={aduana.aduana}>
                                            <tr className="bg-[#f5ebef] dark:bg-[#2a1620]">
                                                <td colSpan={numCols} className="px-3 py-2 text-[10.5px] font-black uppercase tracking-wide text-[#3e131f] dark:text-[#e3c793]">
                                                    {aduana.aduana}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colSpan={numCols} className="px-3 py-2 text-center text-[10px] italic text-slate-400">
                                                    Sin gestiones registradas.
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                }
                                return null;
                            }
                            const tieneTitular = !!aduana.titular_actual;
                            return (
                                <React.Fragment key={aduana.aduana}>
                                    <tr className="bg-[#f5ebef] dark:bg-[#2a1620]">
                                        <td colSpan={numCols} className="px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                                <span className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wide text-[#3e131f] dark:text-[#e3c793]">
                                                    <Building2 className="size-3 shrink-0 text-[#bc955c]" />
                                                    {aduana.aduana}
                                                </span>
                                                <span className={`text-[10px] font-bold ${tieneTitular ? "text-[#621f32]/80 dark:text-[#e3c793]/80" : "italic text-rose-600 dark:text-rose-400"}`}>
                                                    {tieneTitular ? `Titular actual: ${aduana.titular_actual}` : "Sin titular actualmente"}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {filas.map((fila, i) => (
                                        <FilaTabla
                                            key={fila.entrada.clave}
                                            fila={fila}
                                            i={i}
                                            canViewPhoto={canViewPhoto}
                                            scrollRootRef={scrollAreaRef}
                                            ctx={ctx}
                                            rowRef={(el) => {
                                                if (el) cardRefs.current.set(fila.entrada.clave, el);
                                                else cardRefs.current.delete(fila.entrada.clave);
                                            }}
                                        />
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filters.activeConditionDropdown && conditionDropdownRect && typeof document !== "undefined" && createPortal(
                <>
                    <div className="fixed inset-0 z-[110] bg-transparent" onClick={(e) => { e.stopPropagation(); closeConditionDropdown(); }} />
                    <div
                        className="fixed z-[120] flex w-36 flex-col gap-0.5 rounded-xl border border-slate-700/80 bg-slate-900 p-1 text-left text-slate-200 shadow-xl"
                        style={{ top: conditionDropdownRect.bottom + 4, left: conditionDropdownRect.left }}
                    >
                        {CONDITION_OPTIONS.map((item) => {
                            const colKey = filters.activeConditionDropdown;
                            const current = filters.textFilters[colKey]?.condition || "contains";
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        filters.setTextFilters((prev) => ({ ...prev, [colKey]: { value: prev[colKey]?.value || "", condition: item.key } }));
                                        closeConditionDropdown();
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[9px] font-bold transition-colors ${current === item.key ? "bg-[#bc955c] text-slate-950" : "hover:bg-white/10"}`}
                                >
                                    <span>{item.label}</span>
                                    {current === item.key && <Check className="size-2.5" />}
                                </button>
                            );
                        })}
                    </div>
                </>,
                document.body
            )}

            <ColumnFilterDropdown
                open={!!columnaActiva}
                columnKey={columnaActiva}
                columnLabel={columnasVisibles.find((c) => c.key === columnaActiva)?.header || columnaActiva}
                isDate={false}
                data={todasLasFilasBase}
                filters={filters}
                dropdownValues={dropdownValues}
                onApply={handleApplyFilter}
                onClear={handleClearFilter}
                onClose={() => filters.setActiveFilterDropdown(null)}
            />
        </div>
    );
}

/** Esqueleto de carga: barra de toolbar + filas de tabla con pulso, mismo
 * ritmo visual que el resto de tabs de plantilla mientras llega el primer
 * fetch. */
function EsqueletoRotacion() {
    return (
        <div className="flex min-h-0 flex-1 flex-col md:h-stack-vh">
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
            <div className="flex-1 p-3">
                <div className="mb-2 h-8 w-full animate-pulse rounded-lg bg-[#621f32]/10 dark:bg-[#621f32]/20" />
                <div className="flex flex-col gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-[38px] w-full animate-pulse rounded bg-slate-100 dark:bg-slate-900/40" />
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
    const [puedeVolver, setPuedeVolver] = useState(false);
    const abortRef = useRef(null);
    const scrollAreaRef = useRef(null);
    const cardRefs = useRef(new Map());
    const pendingAccionRef = useRef(null); // { tipo: "clave", clave } | { tipo: "posicion", left, top }
    const historialRef = useRef([]); // pila de {scrollLeft, scrollTop, busqueda} previos a cada salto

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

    // Búsqueda global: sobre TODO el dataset, no solo aduana/titular — cada
    // aduana entra si el término aparece en CUALQUIER valor de CUALQUIER
    // columna de CUALQUIERA de sus filas (mismos `values` que ya pinta la
    // tabla, vía `filaValoresRotacion`), o en el nombre completo/titular
    // actual que solo aparece en la banda de encabezado de la aduana.
    const aduanas = useMemo(() => {
        const todas = datos?.aduanas || [];
        const termino = normalizeForSearch(busqueda.trim());
        if (!termino) return todas;
        return todas.filter((a) => {
            if (normalizeForSearch(a.aduana).includes(termino)) return true;
            if (a.titular_actual && normalizeForSearch(a.titular_actual).includes(termino)) return true;
            const entradas = entradasPorAduana.get(a.aduana) || [];
            return entradas.some((entrada) => {
                const { values } = filaValoresRotacion(a, entrada, "—");
                return Object.values(values).some(
                    (v) => v !== null && v !== undefined && v !== "" && normalizeForSearch(String(v)).includes(termino)
                );
            });
        });
    }, [datos, busqueda, entradasPorAduana]);

    // Destaca una FILA completa (ahora la tabla, no tarjetas): anima el
    // fondo de TODAS sus `<td>` a la vez, no un box-shadow sobre el `<tr>`
    // — un box-shadow en una fila de tabla se aplasta contra las filas
    // vecinas (border-collapse + fondos de celda encima) y termina
    // viéndose como una simple línea, ambigua sobre si pertenece a la fila
    // de arriba o la de abajo (bug real reportado). El fondo de celda SÍ
    // es inequívoco: toda la fila se tiñe pareja. `clearProps` al final
    // quita el inline style para que la fila recupere su cebra/tinte
    // normal (insubsistencia, etc.) en vez de quedar transparente.
    const destacarFila = useCallback((el, tl, position) => {
        const celdas = el.querySelectorAll("td");
        if (!celdas.length) return;
        tl.fromTo(
            celdas,
            { backgroundColor: "rgba(245,158,11,0.25)" },
            { backgroundColor: "rgba(245,158,11,0)", duration: 1.1, ease: "power2.out", clearProps: "backgroundColor" },
            position
        );
    }, []);

    // Centra `el` en el contenedor con scroll y lo resalta — GSAP puede
    // animar scrollLeft/scrollTop de un elemento como cualquier otra
    // propiedad numérica, sin necesitar ScrollToPlugin.
    const animarHacia = useCallback(
        (el) => {
            const container = scrollAreaRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Horizontal SIEMPRE al inicio de la tabla (Foto/Consecutivo/
            // Aduana…), nunca centrado: `el` es la fila completa, tan ancha
            // como TODA la tabla (~30 columnas), así que centrar por su
            // ancho terminaba desplazando el scroll horizontal a la mitad
            // de la tabla en vez de mostrar el registro desde sus primeras
            // columnas (bug real reportado).
            const targetTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height - elRect.height) / 2;

            const tl = gsap.timeline();
            tl.to(container, {
                scrollLeft: 0,
                scrollTop: Math.max(0, targetTop),
                duration: 0.9,
                ease: "power2.inOut",
            });
            destacarFila(el, tl, "+=1.2");
        },
        [destacarFila]
    );

    // Vuelta al lugar exacto de donde salió un salto — mismo resalte que
    // animarHacia, pero sobre la fila de origen (a la que se regresa).
    const animarAPosicion = useCallback(
        (left, top, elParaDestacar) => {
            const container = scrollAreaRef.current;
            if (!container) return;
            const tl = gsap.timeline();
            tl.to(container, { scrollLeft: Math.max(0, left), scrollTop: Math.max(0, top), duration: 0.9, ease: "power2.inOut" });
            if (elParaDestacar) destacarFila(elParaDestacar, tl, "+=1.2");
        },
        [destacarFila]
    );

    // Si la tarjeta destino no está montada (filtrada por búsqueda), se
    // limpia la búsqueda y se guarda la acción pendiente: el efecto de abajo
    // la resuelve en cuanto la columna vuelva a aparecer. `claveOrigen` es la
    // tarjeta con el botón que se acaba de clicar — se guarda en el
    // historial para poder destacarla de vuelta al regresar.
    const viajarA = useCallback(
        (claveDestino, claveOrigen) => {
            const container = scrollAreaRef.current;
            historialRef.current.push({
                scrollLeft: container?.scrollLeft ?? 0,
                scrollTop: container?.scrollTop ?? 0,
                busqueda,
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
        },
        [animarHacia, busqueda]
    );

    // Deshace el último salto: restaura la búsqueda (si cambió), la posición
    // de scroll exacta en la que estaba antes de dar clic en "Pasó a otra
    // aduana" y destaca esa misma tarjeta de origen brevemente.
    const volver = useCallback(() => {
        const anterior = historialRef.current.pop();
        if (!anterior) return;
        setPuedeVolver(historialRef.current.length > 0);

        if (anterior.busqueda !== busqueda) {
            pendingAccionRef.current = { tipo: "posicion", left: anterior.scrollLeft, top: anterior.scrollTop, clave: anterior.clave };
            setBusqueda(anterior.busqueda);
        } else {
            animarAPosicion(anterior.scrollLeft, anterior.scrollTop, cardRefs.current.get(anterior.clave));
        }
    }, [busqueda, animarAPosicion]);

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

    const [exportando, setExportando] = useState(false);
    const handleExportarExcel = useCallback(async () => {
        if (exportando) return;
        setExportando(true);
        try {
            await exportarRotacionAExcel({ aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, canViewPhoto });
        } catch (err) {
            console.error("Error exportando rotación de aduanas a Excel:", err);
        } finally {
            setExportando(false);
        }
    }, [aduanas, entradasPorAduana, destinoSegmentoPorClave, resumen, busqueda, exportando, canViewPhoto]);

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
        <div className="flex min-h-0 flex-1 flex-col md:h-stack-vh">
            {/* Controles: volver, búsqueda, stats+filtros, exportar, recargar
                — TODOS en una sola fila SIN scroll (todo compacto para que
                quepa: chips/stats más chicos, input más angosto, menos
                padding); el botón "<" destaca con borde/fondo dorado-guinda
                permanentes, no solo al pasar el mouse, para que no se pierda
                entre el resto de controles. */}
            <div className="flex flex-nowrap items-center gap-1.5 border-b border-slate-200/70 bg-slate-50/50 px-3 py-3 dark:border-slate-800/80 dark:bg-slate-900/20">
                <button
                    type="button"
                    onClick={volver}
                    disabled={!puedeVolver}
                    aria-label="Regresar a donde estaba antes del salto"
                    title={puedeVolver ? "Regresar a donde estaba antes" : "No hay salto que deshacer"}
                    className="shrink-0 cursor-pointer rounded-xl border-2 border-[#bc955c] bg-[#621f32]/10 p-2.5 text-[#621f32] transition-colors hover:bg-[#621f32]/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300 dark:border-[#bc955c]/70 dark:bg-[#621f32]/25 dark:text-[#e3c793] dark:hover:bg-[#621f32]/40 dark:disabled:border-slate-700 dark:disabled:bg-slate-950 dark:disabled:text-slate-600"
                >
                    <ChevronLeft className="size-3.5" />
                </button>

                <div className="relative w-72 shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar en toda la tabla…"
                        aria-label="Buscar en toda la tabla"
                        className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#bc955c] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
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
                    className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#621f32] px-6 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {exportando ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                    Excel
                </button>

                <button
                    type="button"
                    onClick={() => cargar(true)}
                    aria-label="Recargar"
                    title="Recargar ignorando el caché"
                    className="shrink-0 cursor-pointer rounded-xl bg-white p-2.5 text-slate-400 transition-colors hover:text-[#621f32] dark:bg-slate-950 dark:hover:text-[#bc955c]"
                >
                    <RefreshCw className="size-3.5" />
                </button>
            </div>

            {aduanas.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-slate-400 md:flex-1">
                    <Search className="size-10 opacity-40" />
                    <p className="text-sm font-bold">Ninguna aduana coincide con la búsqueda.</p>
                </div>
            ) : (
                <TablaRotacion
                    aduanas={aduanas}
                    entradasPorAduana={entradasPorAduana}
                    cardRefs={cardRefs}
                    canViewPhoto={canViewPhoto}
                    scrollAreaRef={scrollAreaRef}
                    destinoSegmentoPorClave={destinoSegmentoPorClave}
                    onIrADestino={viajarA}
                />
            )}
        </div>
    );
}
