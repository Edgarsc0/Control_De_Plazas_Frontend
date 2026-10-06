import { normalizeForSearch } from "@/utils/columnFilters";
import { tokenizarBusqueda, distanciaAcotada } from "@/utils/busquedaFlexible";

/**
 * Búsqueda de PERSONAS con resultados ordenados por relevancia (el más
 * parecido a lo escrito va primero). Pensada para los buscadores del tablero,
 * que trabajan sobre un dataset ya cargado en el navegador.
 *
 * Qué tolera, sin dejar de ser precisa:
 *  - Mayúsculas y acentos; palabras en cualquier orden (apellido primero o
 *    nombre primero) y nombres incompletos (sin un apellido, a medio escribir).
 *  - Errores de ortografía que suenan igual: b/v, s/z/c, h muda, letras
 *    dobles, y/i, g/j, c/k/qu ("banesa" = "Vanessa", "gimenes" = "Jiménez").
 *  - Errores de dedo (una letra de más, de menos o cambiada), SOLO cuando hay
 *    pocas coincidencias de las anteriores, para no meter ruido.
 * Números y palabras de menos de 4 letras (posición, No. de empleado, RFC
 * parcial) siempre exigen coincidencia exacta: ahí "casi igual" es otra persona.
 *
 * Todas las palabras escritas deben encontrarse en la fila (AND).
 */

const SEPARADOR_PALABRAS = /[^a-z0-9ñ]+/;

/** Forma "como suena" de una palabra ya normalizada (sin acentos, minúsculas). */
export const foneticaEs = (w) =>
  w
    .replace(/h/g, "")
    .replace(/v/g, "b")
    .replace(/z/g, "s")
    .replace(/c(?=[ei])/g, "s")
    .replace(/g(?=[ei])/g, "j")
    .replace(/qu/g, "k")
    .replace(/c/g, "k")
    .replace(/ll/g, "y")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");

const toleranciaPara = (token) => {
  if (token.length < 4 || /\d/.test(token)) return 0;
  return token.length >= 8 ? 2 : 1;
};

/**
 * Prepara el dataset una sola vez (no por tecla).
 * @param {object[]} filas
 * @param {(fila: object) => string} getNombre  Nombre completo de la persona.
 * @param {(fila: object) => any[]} getOtros    Demás datos buscables (RFC, posición, UA...).
 */
export function crearIndicePersonas(filas, getNombre, getOtros) {
  return (filas || []).map((fila) => {
    const palabras = normalizeForSearch(getNombre(fila)).split(SEPARADOR_PALABRAS).filter(Boolean);
    return {
      fila,
      palabras,
      fon: palabras.map(foneticaEs),
      resto: normalizeForSearch((getOtros(fila) || []).map((v) => v ?? "").join(" ")),
    };
  });
}

// Puntos de una palabra buscada contra una palabra del nombre.
function puntosPalabra(t, tf, w, wf, tol) {
  if (w === t) return 100;
  if (w.startsWith(t)) return 86;
  if (wf === tf) return 82;
  if (tf.length >= 3 && wf.startsWith(tf)) return 68;
  if (t.length >= 3 && w.includes(t)) return 52;
  if (tol > 0) {
    if (Math.abs(w.length - t.length) <= tol) {
      const d = distanciaAcotada(t, w, tol);
      if (d <= tol) return 46 - (d - 1) * 8;
    }
    // Prefijo con error solo en palabras de 6+ letras (con menos, "marin" ~ "marti(nez)").
    if (t.length >= 6 && w.length > t.length + tol && distanciaAcotada(t, w.slice(0, t.length), tol) <= tol) return 34;
  }
  return 0;
}

const ES_APROXIMADO = 50; // por debajo de esto, la palabra entró por error de dedo

function puntuar(entrada, tokens, conErroresDeDedo) {
  const { palabras, fon, resto } = entrada;
  let suma = 0;
  let aproximado = false;
  const posiciones = [];
  for (const { t, tf, tol } of tokens) {
    let mejor = 0;
    let dondeMejor = -1;
    for (let i = 0; i < palabras.length; i++) {
      const p = puntosPalabra(t, tf, palabras[i], fon[i], conErroresDeDedo ? tol : 0);
      // A igual puntaje, se prefiere una palabra que otro token no haya usado ya.
      if (p > mejor || (p === mejor && p > 0 && posiciones.includes(dondeMejor) && !posiciones.includes(i))) {
        mejor = p;
        dondeMejor = i;
      }
    }
    if (mejor < 60 && resto.includes(t)) {
      // Coincide en otro dato (RFC, posición, No. de empleado, unidad...).
      const enOtro = /\d/.test(t) ? 90 : 58;
      if (enOtro > mejor) { mejor = enOtro; dondeMejor = -1; }
    }
    if (mejor === 0) return null;
    if (mejor < ES_APROXIMADO) aproximado = true;
    suma += mejor;
    posiciones.push(dondeMejor);
  }

  let puntos = suma / tokens.length;
  const enNombre = posiciones.filter((i) => i >= 0);
  if (enNombre.length && palabras.length) {
    // Cuánto del nombre quedó cubierto: "omar ramirez" prefiere a "Omar Ramírez
    // Albarrán" (2 de 3) sobre "José Omar Ramírez Milanez" (2 de 4).
    puntos += (new Set(enNombre).size / palabras.length) * 18;
    // Palabras seguidas y en el mismo orden en que se escribieron.
    let seguidas = enNombre.length > 1;
    for (let k = 1; k < enNombre.length; k++) if (enNombre[k] !== enNombre[k - 1] + 1) seguidas = false;
    if (seguidas) puntos += 10;
    if (enNombre[0] === 0) puntos += 4;
  }
  return { puntos, aproximado };
}

const MIN_SIN_APROXIMADAS = 5;

/**
 * Filas que coinciden con `consulta`, de la más a la menos parecida.
 * @returns {object[]} filas originales (vacío si no hay consulta).
 */
export function buscarPersonas(indice, consulta) {
  const tokens = tokenizarBusqueda(consulta).map((t) => ({ t, tf: foneticaEs(t), tol: toleranciaPara(t) }));
  if (!tokens.length) return [];

  const pasada = (conErroresDeDedo) => {
    const hits = [];
    for (let i = 0; i < indice.length; i++) {
      const r = puntuar(indice[i], tokens, conErroresDeDedo);
      if (r) hits.push({ fila: indice[i].fila, puntos: r.puntos, orden: i });
    }
    return hits;
  };

  let hits = pasada(false);
  // Los errores de dedo solo entran si lo demás encontró poco y hay palabras que los admitan.
  if (hits.length < MIN_SIN_APROXIMADAS && tokens.some((x) => x.tol > 0)) hits = pasada(true);

  hits.sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);
  return hits.map((h) => h.fila);
}
