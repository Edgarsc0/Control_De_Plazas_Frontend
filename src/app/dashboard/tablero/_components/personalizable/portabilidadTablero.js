// Exportar / importar escritorios del tablero personalizable como archivo JSON.
//
// El archivo es autocontenido: guarda, por escritorio, su nombre y sus widgets
// (tipo, posición, tamaño y `config`). Los ids de widget (`i`) NO se exportan:
// se regeneran al importar para no chocar con los del tablero destino.

import { WIDGET_REGISTRY } from "./widgetRegistry";
import { buscarHueco, colisiona, normalizarWidgets } from "./gridGeometry";

export const FORMATO_TABLERO = "eje-central-tablero";
export const VERSION_TABLERO = 1;
// Mismos límites que TableroLayoutView en el backend.
export const MAX_ESCRITORIOS = 50;
export const MAX_NOMBRE_ESCRITORIO = 60;

const escritorioDe = (w) => w.page ?? 0;

/** Total de escritorios que tiene el tablero (los vacíos también cuentan). */
export function totalEscritorios(widgets, nombres) {
  const ultimoUsado = widgets.reduce((max, w) => Math.max(max, escritorioDe(w)), -1);
  return Math.max(1, ultimoUsado + 1, nombres.length);
}

/**
 * Arma el objeto a serializar con los escritorios `indices` (ordenados tal cual
 * están en el tablero). Los escritorios se renumeran desde 0.
 */
export function construirExportacion(widgets, nombres, indices) {
  const elegidos = [...indices].sort((a, b) => a - b);
  return {
    formato: FORMATO_TABLERO,
    version: VERSION_TABLERO,
    exportadoEn: new Date().toISOString(),
    escritorios: elegidos.map((indice) => ({
      nombre: (nombres[indice] || "").trim(),
      widgets: widgets
        .filter((w) => escritorioDe(w) === indice)
        .map(({ type, x, y, w, h, config }) => ({
          type, x, y, w, h,
          ...(config && Object.keys(config).length ? { config } : {}),
        })),
    })),
  };
}

/** Nombre de archivo sugerido, p. ej. `tablero-2026-09-25.json`. */
export function nombreArchivoExportacion() {
  return `tablero-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Descarga `datos` como archivo JSON en el navegador. */
export function descargarJson(datos, nombreArchivo) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esNumero = (n) => typeof n === "number" && Number.isFinite(n);
const esObjeto = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

/**
 * Valida el contenido de un archivo de tablero.
 * @returns {{ escritorios: Array<{nombre: string, widgets: Array}>, omitidos: number }}
 *   `omitidos`: widgets descartados por tener un tipo que esta versión no conoce.
 * @throws {Error} con un mensaje para el usuario si el archivo no es válido.
 */
export function interpretarImportacion(datos) {
  if (!esObjeto(datos) || datos.formato !== FORMATO_TABLERO || !Array.isArray(datos.escritorios)) {
    throw new Error("El archivo no es una exportación de tablero válida.");
  }
  if (datos.version > VERSION_TABLERO) {
    throw new Error("El archivo fue creado con una versión más nueva del sistema.");
  }

  let omitidos = 0;
  const escritorios = datos.escritorios.filter(esObjeto).map((esc) => {
    const widgets = (Array.isArray(esc.widgets) ? esc.widgets : []).flatMap((w) => {
      if (!esObjeto(w) || !WIDGET_REGISTRY[w.type]) {
        omitidos += 1;
        return [];
      }
      const def = WIDGET_REGISTRY[w.type];
      return [{
        type: w.type,
        x: esNumero(w.x) ? w.x : 0,
        y: esNumero(w.y) ? w.y : 0,
        w: esNumero(w.w) ? w.w : def.defaultW,
        h: esNumero(w.h) ? w.h : def.defaultH,
        ...(esObjeto(w.config) ? { config: w.config } : {}),
      }];
    });
    return { nombre: String(esc.nombre || "").trim().slice(0, MAX_NOMBRE_ESCRITORIO), widgets };
  });

  if (escritorios.length === 0) throw new Error("El archivo no contiene escritorios.");
  return { escritorios, omitidos };
}

/**
 * Agrega los escritorios importados al tablero actual. Si el tablero actual no
 * tiene ningún módulo, los reemplaza (evita dejar un "Escritorio 1" vacío al
 * frente en una computadora nueva); si tiene, se añaden al final sin tocar lo
 * existente.
 * @returns {{ widgets, nombres, agregados: number, recortados: number }}
 */
export function fusionarImportacion(widgets, nombres, importados) {
  const reemplaza = widgets.length === 0;
  const base = reemplaza ? 0 : totalEscritorios(widgets, nombres);
  const cupo = Math.max(0, MAX_ESCRITORIOS - base);
  const aceptados = importados.slice(0, cupo);
  const stamp = Date.now();

  const nuevos = aceptados.flatMap((esc, e) =>
    esc.widgets.map((w, k) => ({
      ...w,
      i: `w-${stamp}-${e}-${k}-${Math.random().toString(36).slice(2, 6)}`,
      page: base + e,
    }))
  );

  const nombresBase = reemplaza ? [] : Array.from({ length: base }, (_, i) => nombres[i] || "");
  return {
    // `normalizarWidgets` acota tamaños y resuelve traslapes por si el archivo
    // fue editado a mano o viene de otra resolución de cuadrícula.
    widgets: normalizarWidgets([...(reemplaza ? [] : widgets), ...nuevos]),
    nombres: [...nombresBase, ...aceptados.map((esc) => esc.nombre)],
    agregados: aceptados.length,
    recortados: importados.length - aceptados.length,
  };
}

/** Lee y valida un archivo de tablero elegido por el usuario. */
export async function leerArchivoTablero(archivo) {
  if (archivo.size > 5 * 1024 * 1024) throw new Error("El archivo es demasiado grande.");
  let datos;
  try { datos = JSON.parse(await archivo.text()); } catch { throw new Error("El archivo no es un JSON válido."); }
  return interpretarImportacion(datos);
}

export const MODO_IMPORTACION = {
  NUEVO: "nuevo", // cada escritorio del archivo pasa a ser un escritorio nuevo
  ESCRITORIO: "escritorio", // todos los módulos se juntan en un escritorio existente
  REEMPLAZAR: "reemplazar", // se descarta el tablero actual
};

/**
 * Coloca los módulos de `importados` dentro del escritorio `destino`. Cada uno
 * conserva su posición si está libre; si no, toma el primer hueco. Lo que ya no
 * cabe pasa a un escritorio nuevo al final (no se pierde ni se encima).
 */
function fusionarEnEscritorio(widgets, nombres, importados, destino) {
  const total = totalEscritorios(widgets, nombres);
  const items = widgets.filter((w) => escritorioDe(w) === destino);
  const stamp = Date.now();
  const colocados = [];
  const desbordados = [];

  importados
    .flatMap((esc) => esc.widgets)
    .forEach((w, k) => {
      const nuevo = { ...w, i: `w-${stamp}-${k}-${Math.random().toString(36).slice(2, 6)}` };
      const libre = !colisiona(items, w.x, w.y, w.w, w.h) && w.x + w.w <= 12 && w.y + w.h <= 8;
      const pos = libre ? { x: w.x, y: w.y } : buscarHueco(items, w.w, w.h);
      if (pos) {
        const puesto = { ...nuevo, ...pos, page: destino };
        items.push(puesto);
        colocados.push(puesto);
      } else {
        desbordados.push({ ...nuevo, page: total });
      }
    });

  const base = Array.from({ length: total }, (_, i) => nombres[i] || "");
  return {
    widgets: normalizarWidgets([...widgets, ...colocados, ...desbordados]),
    nombres: desbordados.length ? [...base, "Importado"] : base,
    agregados: importados.length,
    recortados: 0,
    desbordados: desbordados.length,
  };
}

/**
 * Aplica `importados` (ya filtrados a los escritorios que el usuario eligió)
 * según el modo. Devuelve `{ widgets, nombres, agregados, recortados, desbordados }`.
 */
export function aplicarImportacion(widgets, nombres, importados, { modo, destino = 0 }) {
  if (modo === MODO_IMPORTACION.REEMPLAZAR) return fusionarImportacion([], [], importados);
  if (modo === MODO_IMPORTACION.ESCRITORIO) {
    return fusionarEnEscritorio(widgets, nombres, importados, destino);
  }
  return { ...fusionarImportacion(widgets, nombres, importados), desbordados: 0 };
}
