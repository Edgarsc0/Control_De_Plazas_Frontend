import { normalizeForSearch } from "@/utils/columnFilters";

/**
 * Búsqueda global flexible sobre filas ya indexadas (un blob normalizado por fila).
 *
 * Reglas, de la más estricta a la más laxa:
 *  1. Sin acentos ni mayúsculas (normalizeForSearch en ambos lados).
 *  2. Por PALABRAS y en cualquier orden: "cuevas eduardo" encuentra "Eduardo Cuevas Tello".
 *     Todas las palabras deben aparecer (AND); cada una puede ser parte de una palabra ("edu").
 *  3. Errores de dedo leves, SOLO si el nivel 2 no encontró nada: si hay coincidencias exactas
 *     nunca se mezclan con aproximadas, para no mostrar resultados erróneos. Las palabras
 *     numéricas o de menos de 4 letras (posición, núm. de empleado, RFC parcial…) siempre
 *     exigen coincidencia exacta: ahí un "casi igual" es otra persona.
 */

const SEPARADORES = /[\s,;/|]+/;

export const tokenizarBusqueda = (texto) =>
  normalizeForSearch(texto).split(SEPARADORES).map((t) => t.trim()).filter(Boolean);

// Tolerancia por longitud de la palabra buscada.
const toleranciaPara = (token) => {
  if (token.length < 4 || /\d/.test(token)) return 0;
  return token.length >= 8 ? 2 : 1;
};

// Damerau-Levenshtein (transposición adyacente incluida: "cuveas" ~ "cuevas") con corte temprano.
function distanciaAcotada(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + costo);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < minFila) minFila = v;
    }
    if (minFila > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// ¿La palabra buscada se parece a alguna palabra de la fila? Se compara contra la palabra
// completa y contra su prefijo del mismo largo (permite escribir incompleto y con error: "eduadro").
function coincideAproximado(token, palabras, max) {
  for (const p of palabras) {
    if (Math.abs(p.length - token.length) <= max && distanciaAcotada(token, p, max) <= max) return true;
    // Prefijo con error solo en palabras de 6+ letras: con menos, "marin" ~ "marti(nez)".
    if (token.length >= 6 && p.length > token.length + max && distanciaAcotada(token, p.slice(0, token.length), max) <= max) return true;
  }
  return false;
}

/**
 * Devuelve el Set de filas que coinciden con `consulta`, o null si no hay consulta.
 * `indice` es un Map fila → blob normalizado.
 */
export function filasQueCoinciden(filas, indice, consulta) {
  const tokens = tokenizarBusqueda(consulta);
  if (!tokens.length) return null;

  const exactas = new Set();
  for (const fila of filas) {
    const blob = indice.get(fila) || "";
    if (tokens.every((t) => blob.includes(t))) exactas.add(fila);
  }
  if (exactas.size > 0) return exactas;

  // Nivel 3: solo si hay al menos una palabra que admita tolerancia.
  const tolerancias = tokens.map(toleranciaPara);
  if (tolerancias.every((m) => m === 0)) return exactas;

  const aproximadas = new Set();
  for (const fila of filas) {
    const blob = indice.get(fila) || "";
    let palabras = null;
    const ok = tokens.every((t, i) => {
      if (blob.includes(t)) return true;
      if (!tolerancias[i]) return false;
      palabras ??= [...new Set(blob.split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3))];
      return coincideAproximado(t, palabras, tolerancias[i]);
    });
    if (ok) aproximadas.add(fila);
  }
  return aproximadas;
}
