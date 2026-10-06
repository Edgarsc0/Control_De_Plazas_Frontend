import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Auditoría de descargas de Excel (bitácora DescargaExcelLog del backend).
 *
 * Dos piezas, usadas por ExcelAuditHost (montado una vez en app/layout.js):
 *
 *  1. Interceptor: toda descarga que el navegador dispara con un
 *     `<a download="algo.xlsx">.click()` — así bajan TODOS los Excel del
 *     sistema, los arme ExcelJS o el backend — se registra en ese momento con
 *     la pantalla donde ocurrió. Un export nuevo queda cubierto sin tocar nada.
 *
 *  2. `confirmarDescargaExcel(meta)`: lo llama cada botón de Excel ANTES de
 *     generar. Muestra el aviso de confidencialidad y, si el usuario acepta,
 *     guarda `meta` (filas, columnas, filtros) para que el interceptor lo
 *     adjunte al registro de esa descarga.
 *
 * Plantilla Detalle se registra por su cuenta en el backend (con copia de
 * las filas, para poder regenerar): antes de su `.click()` llama a
 * `omitirRegistroDescarga()` para no duplicar el renglón.
 */

const EXTENSION_EXCEL = /\.(xlsx|xlsm|xls)$/i;
const VIGENCIA_META_MS = 10 * 60 * 1000;
const VIGENCIA_OMITIR_MS = 15 * 1000;

let obtenerContexto = () => '';
let metaPendiente = null;
let omitirHasta = 0;
let solicitud = null;
const suscriptores = new Set();

const avisar = () => suscriptores.forEach((fn) => fn(solicitud));

export function suscribirSolicitudes(fn) {
    suscriptores.add(fn);
    return () => suscriptores.delete(fn);
}

/**
 * Aviso de confidencialidad previo a generar un Excel.
 * @param {{filas?: number, columnas?: (string|{key:string,label:string})[], filtros?: object, detalle?: string, fotos?: boolean}} [meta]
 * @returns {Promise<boolean>} true si el usuario confirmó.
 */
export function confirmarDescargaExcel(meta = {}) {
    // Sin host montado (no debería pasar) no se bloquea la descarga.
    if (suscriptores.size === 0) {
        anotarDescargaExcel(meta);
        return Promise.resolve(true);
    }
    if (solicitud) solicitud.resolver(false);
    return new Promise((resolve) => {
        solicitud = {
            resolver: (aceptada) => {
                solicitud = null;
                avisar();
                if (aceptada) anotarDescargaExcel(meta);
                resolve(aceptada);
            },
        };
        avisar();
    });
}

/** Adjunta `meta` al registro de la próxima descarga hecha desde esta pantalla. */
export function anotarDescargaExcel(meta = {}) {
    metaPendiente = { meta, contexto: obtenerContexto(), creada: Date.now() };
}

/** La próxima descarga ya la registró el backend: el interceptor la deja pasar. */
export function omitirRegistroDescarga() {
    omitirHasta = Date.now() + VIGENCIA_OMITIR_MS;
}

function registrar(nombreArchivo) {
    const contexto = obtenerContexto();
    const vigente =
        metaPendiente &&
        metaPendiente.contexto === contexto &&
        Date.now() - metaPendiente.creada < VIGENCIA_META_MS;
    const meta = vigente ? metaPendiente.meta : {};
    metaPendiente = null;
    const filtros = { ...(meta.filtros || {}) };
    if (meta.detalle) filtros.detalle = String(meta.detalle);
    apiFetch('/auth/descargas-excel/registrar/', {
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({
            modulo: contexto || window.location.pathname,
            nombre_archivo: nombreArchivo,
            total_filas: Number(meta.filas) || 0,
            columnas: meta.columnas || [],
            filtros,
            incluyo_fotos: !!meta.fotos || /confotos/i.test(nombreArchivo),
        }),
    }).catch(() => {});
}

let instalado = false;

/** Instala (una sola vez) el interceptor de descargas. `fn` devuelve "Página › Tab". */
export function instalarAuditoriaExcel(fn) {
    obtenerContexto = fn;
    if (instalado || typeof window === 'undefined') return;
    instalado = true;
    const clickOriginal = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function clickAuditado(...args) {
        try {
            const nombre = this.download;
            if (nombre && EXTENSION_EXCEL.test(nombre)) {
                if (Date.now() < omitirHasta) omitirHasta = 0;
                else registrar(nombre);
            }
        } catch {
            // La auditoría nunca debe impedir la descarga.
        }
        return clickOriginal.apply(this, args);
    };
}
