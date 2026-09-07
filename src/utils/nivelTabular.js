/**
 * Regla de negocio ANAM — jerarquía de niveles tabulares (bajo tabuladores).
 *
 * Hay dos tipos de nivel: numéricos (los más bajos de la escala, ordenados
 * ascendentemente entre sí) y alfanuméricos (una letra + número). Entre las
 * letras la jerarquía asciende P < D < S < A < K < J < H (H es el nivel más
 * alto). Dentro de una misma letra —o entre los numéricos— a mayor número,
 * mayor nivel: P12 > P11, P13 > P12, K109 > K105. Ej. de orden completo
 * ascendente para {J109, K109, K105, A415, P12, 11}:
 *   11 < P12 < A415 < K105 < K109 < J109
 */
export const NIVEL_TABULAR_GRUPOS = ['P', 'D', 'S', 'A', 'K', 'J', 'H'];

/**
 * Claves de columna que representan "nivel tabular" según la fuente de datos:
 * Empleados Completos SIG usa "nivel", MOV_POS/Movimientos usa
 * "nivel_salarial", y cp_tbl_mov_completo / Bajas SIG usan "nivel_tabular".
 */
export const NIVEL_TABULAR_KEYS = ['nivel', 'nivel_tabular', 'nivel_salarial'];

export const isNivelTabularColumn = (key) => NIVEL_TABULAR_KEYS.includes(key);

/**
 * Clasifica un nivel tabular para poder compararlo. `null` = no reconocible
 * (vacío, o letra fuera de {@link NIVEL_TABULAR_GRUPOS}) — esas filas se
 * dejan al final sin importar la dirección del orden.
 * @param {*} nivelCrudo
 * @returns {?{grupo: number, numero: number}}
 */
export const clasificarNivelTabular = (nivelCrudo) => {
  const nivel = String(nivelCrudo ?? '').trim().toUpperCase();
  if (!nivel) return null;

  const soloNumero = /^(\d+)$/.exec(nivel);
  if (soloNumero) return { grupo: -1, numero: Number(soloNumero[1]) };

  const conLetra = /^([A-Z])(\d+)$/.exec(nivel);
  if (conLetra) {
    const indiceGrupo = NIVEL_TABULAR_GRUPOS.indexOf(conLetra[1]);
    if (indiceGrupo === -1) return null;
    return { grupo: indiceGrupo, numero: Number(conLetra[2]) };
  }
  return null;
};

/**
 * Compara dos niveles tabulares en orden ASCENDENTE (del más bajo al más
 * alto). Los valores no reconocibles van al final; en empate da igual el
 * orden relativo.
 * @param {*} a
 * @param {*} b
 * @returns {number}
 */
export const compareNivelTabular = (a, b) => {
  const ca = clasificarNivelTabular(a);
  const cb = clasificarNivelTabular(b);
  if (!ca && !cb) return 0;
  if (!ca) return 1;
  if (!cb) return -1;
  if (ca.grupo !== cb.grupo) return ca.grupo - cb.grupo;
  return ca.numero - cb.numero;
};
