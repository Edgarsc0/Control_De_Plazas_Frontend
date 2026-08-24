/**
 * Lógica pura de "Filtros avanzados" (condiciones combinables AND/OR sobre
 * cualquier columna, valor-vs-valor o valor-vs-campo) usada en los tabs de
 * `plantilla_empleados`. Sin React — consumida por `useAdvancedFilters` y por
 * el `AdvancedFiltersModal` compartido.
 *
 * Modelo de una condición:
 *  `{ column, condition, compareType: 'valor'|'campo', compareColumn, value, logic }`
 *  - `condition`: ver {@link CONDITION_OPTIONS} (texto) o {@link ADV_DATE_CONDITIONS} (fecha).
 *  - `compareType: 'campo'` compara `row[column]` contra `row[compareColumn]` en vez de `value`.
 *  - `logic`: operador con la condición ANTERIOR de la lista (`AND`/`OR`), ignorado en la primera.
 *
 * Movimientos aplica estas condiciones server-side (manda `appliedAdvancedFilters`
 * tal cual al backend); Plantilla Detalle y Bajas no tienen backend de filtros,
 * así que evalúan client-side con `evaluateAdvancedFilters`.
 */
import { matchesTextCondition, parseFlexibleDate, defaultGetCellValue } from './columnFilters';

/** Condiciones para columnas de fecha (distintas a las de texto). */
export const ADV_DATE_CONDITIONS = [
  { key: 'before', label: 'Es antes de' },
  { key: 'after', label: 'Es después de' },
  { key: 'before_or_equal', label: 'Es antes o igual a' },
  { key: 'after_or_equal', label: 'Es después o igual a' },
  { key: 'equals', label: 'Es igual a' },
  { key: 'not_equals', label: 'No es igual a' },
];

/** Contra qué se compara el valor de la columna. */
export const ADV_COMPARE_TYPE_OPTIONS = [
  { key: 'valor', label: 'Valor' },
  { key: 'campo', label: 'Campo' },
];

/** Condiciones para columnas numéricas (distintas a las de texto/fecha). */
export const ADV_NUMBER_CONDITIONS = [
  { key: 'greater_than', label: 'Es mayor que (>)' },
  { key: 'less_than', label: 'Es menor que (<)' },
  { key: 'greater_or_equal', label: 'Es mayor o igual que (>=)' },
  { key: 'less_or_equal', label: 'Es menor o igual que (<=)' },
  { key: 'equals', label: 'Es igual a (=)' },
  { key: 'not_equals', label: 'Diferente de (!=)' },
];

/** Operador lógico entre una condición y la anterior. */
export const ADV_LOGIC_OPTIONS = [
  { key: 'AND', label: 'Y (AND)' },
  { key: 'OR', label: 'O (OR)' },
];

/**
 * Condiciones de "vacío", agregadas a las de texto/fecha/número (aplican a
 * cualquier tipo de columna). "Vacío" = celda nula o cuyo texto, sin espacios
 * al inicio/final, queda en cadena vacía (incluye `" "`). No usan `value` ni
 * `compareType`/`compareColumn` — el modal los oculta al elegir una de estas.
 */
export const ADV_EMPTY_CONDITIONS = [
  { key: 'empty', label: 'Está vacío' },
  { key: 'not_empty', label: 'No está vacío' },
];

/**
 * Detección de "columna numérica" por datos (no por nombre): toma hasta
 * `sampleSize` valores no vacíos de la columna en `data`; si TODOS parsean
 * como número, se considera numérica. Sin lista hardcodeada de columnas —
 * funciona igual con columnas nuevas y no requiere tocarla si se agrega una.
 * @param {Object[]} data - Filas sobre las que muestrear.
 * @param {string} key - Columna a evaluar.
 * @param {(row: Object, key: string) => string} [getCellValue=defaultGetCellValue] - Accesor de celda.
 * @param {number} [sampleSize=30] - Tope de valores no vacíos a revisar.
 * @returns {boolean} `true` si la columna parece numérica.
 */
export const isColumnNumericByData = (data, key, getCellValue = defaultGetCellValue, sampleSize = 30) => {
  if (!key || !data) return false;
  let sampled = 0, numeric = 0;
  for (let i = 0; i < data.length && sampled < sampleSize; i++) {
    const v = getCellValue(data[i], key);
    if (v === null || v === undefined || String(v).trim() === '') continue;
    sampled++;
    if (!isNaN(Number(String(v).trim()))) numeric++;
  }
  return sampled > 0 && numeric === sampled;
};

/** Condición avanzada vacía, con el `id` que le toque asignar el caller. */
export const emptyAdvancedCondition = (id = 0) => ({
  id, type: 'condition', column: null, condition: 'contains', compareType: 'valor', compareColumn: null, value: '', logic: 'AND',
});

/**
 * Grupo vacío (paréntesis explícito): agrupa condiciones hijas que se
 * evalúan entre sí ANTES de combinarse con el resto de la lista donde vive
 * el grupo — un solo nivel de anidamiento (un grupo no contiene otros
 * grupos). `logic` combina el grupo completo con el nodo anterior de esa
 * misma lista, igual que en una condición suelta.
 * @param {number} [id=0]
 * @returns {Object}
 */
export const emptyAdvancedGroup = (id = 0) => ({
  id, type: 'group', logic: 'AND', children: [],
});

/**
 * Filtra un nodo (condición o grupo) de un formulario de filtros avanzados a
 * su forma válida lista para aplicarse, o `null` si debe descartarse:
 *  - Condición: columna elegida, y valor o compareColumn según corresponda.
 *  - Grupo: le queda al menos un hijo válido tras filtrar (si no, se
 *    descarta el grupo entero — un grupo vacío no aporta nada al fold).
 * Despoja el `id` interno de edición (recursivamente en los hijos).
 * @param {Object} node
 * @returns {Object|null}
 */
const toValidAdvancedNode = (node) => {
  if (node.type === 'group') {
    const children = getValidAdvancedConditions(node.children || []);
    if (children.length === 0) return null;
    return { type: 'group', logic: node.logic, children };
  }
  const { column, condition, compareType, compareColumn, value, logic } = node;
  if (!column) return null;
  if (condition === 'empty' || condition === 'not_empty') return { type: 'condition', column, condition, compareType, compareColumn, value, logic };
  if (compareType === 'campo') return compareColumn ? { type: 'condition', column, condition, compareType, compareColumn, value, logic } : null;
  if (value == null || String(value).trim() === '') return null;
  return { type: 'condition', column, condition, compareType, compareColumn, value, logic };
};

/**
 * Filtra las condiciones/grupos de un formulario de filtros avanzados a los
 * que están completos y listos para aplicarse. Recursiva (ver
 * {@link toValidAdvancedNode}).
 * @param {Object[]} conditions - Condiciones/grupos crudos del formulario.
 * @returns {Object[]} Nodos válidos, listos para aplicar/enviar.
 */
export const getValidAdvancedConditions = (conditions) =>
  conditions.map(toValidAdvancedNode).filter(Boolean);

/**
 * Aplana recursivamente condiciones/grupos a la lista de condiciones hoja
 * (sin los nodos `group`), para el código que necesita inspeccionar todas
 * las condiciones sin importar si quedaron dentro de un grupo (ver
 * `filtroIncluyeVacantes` en `PlantillaDetalleTab`).
 * @param {Object[]} nodes
 * @returns {Object[]}
 */
export const flattenAdvancedConditions = (nodes) =>
  (nodes || []).flatMap((n) => (n.type === 'group' ? flattenAdvancedConditions(n.children || []) : [n]));

/**
 * Evalúa una única condición de fecha.
 * @param {*} rowValue - Valor de la celda (columna de fecha).
 * @param {string} condition - Una de {@link ADV_DATE_CONDITIONS}.
 * @param {*} compareValue - Valor contra el que se compara (string de fecha).
 * @returns {boolean} `true` si la condición se cumple.
 */
const matchesDateCondition = (rowValue, condition, compareValue) => {
  if (compareValue === null || compareValue === undefined || String(compareValue).trim() === '') return true;
  const a = parseFlexibleDate(rowValue);
  const b = parseFlexibleDate(compareValue);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  switch (condition) {
    case 'before': return a.getTime() < b.getTime();
    case 'after': return a.getTime() > b.getTime();
    case 'before_or_equal': return a.getTime() <= b.getTime();
    case 'after_or_equal': return a.getTime() >= b.getTime();
    case 'not_equals': return a.toDateString() !== b.toDateString();
    case 'equals':
    default: return a.toDateString() === b.toDateString();
  }
};

/**
 * Evalúa una única condición numérica.
 * @param {*} rowValue - Valor de la celda (columna numérica).
 * @param {string} condition - Una de {@link ADV_NUMBER_CONDITIONS}.
 * @param {*} compareValue - Valor contra el que se compara.
 * @returns {boolean} `true` si la condición se cumple.
 */
const matchesNumberCondition = (rowValue, condition, compareValue) => {
  if (compareValue === null || compareValue === undefined || String(compareValue).trim() === '') return true;
  const a = Number(rowValue);
  const b = Number(compareValue);
  if (isNaN(a) || isNaN(b)) return false;
  switch (condition) {
    case 'greater_than': return a > b;
    case 'less_than': return a < b;
    case 'greater_or_equal': return a >= b;
    case 'less_or_equal': return a <= b;
    case 'not_equals': return a !== b;
    case 'equals':
    default: return a === b;
  }
};

/**
 * Evalúa una condición avanzada (texto, fecha o número, valor o campo) sobre
 * una fila.
 * @param {Object} row - Fila de datos.
 * @param {Object} cond - Condición (ver modelo arriba).
 * @param {Object} [opts={}]
 * @param {(row: Object, key: string) => string} [opts.getCellValue] - Accesor de celda.
 * @param {(key: string) => boolean} [opts.isDateColumn] - Si la columna es de fecha.
 * @param {(key: string) => boolean} [opts.isNumericColumn] - Si la columna es numérica.
 * @returns {boolean} `true` si la fila cumple la condición.
 */
export const matchesAdvancedCondition = (row, cond, opts = {}) => {
  const { getCellValue = defaultGetCellValue, isDateColumn = () => false, isNumericColumn = () => false } = opts;
  if (!cond.column) return true;

  const rowValue = getCellValue(row, cond.column);

  // "Vacío"/"No vacío" ignoran compareType/value/compareColumn por completo
  // (el modal ya los oculta en la UI): nulo o texto vacío tras trim (incluye
  // `" "`), usando el MISMO getCellValue de las demás condiciones — si la
  // columna ya mapea el crudo a una etiqueta (p. ej. `estado_nomina` " " ->
  // "Vacante"), "vacío" respeta esa etiqueta igual que el resto de esta
  // función, sin ver el dato crudo por debajo.
  if (cond.condition === 'empty' || cond.condition === 'not_empty') {
    const isEmpty = rowValue === null || rowValue === undefined || String(rowValue).trim() === '';
    return cond.condition === 'empty' ? isEmpty : !isEmpty;
  }

  // compareType==='campo': el "needle" es row[compareColumn], que puede venir
  // vacío legítimamente (fecha de baja/salida sin capturar, nivel opcional,
  // etc.). No reutilizamos el guard "sin valor de búsqueda → true" de
  // matchesTextCondition/matchesDateCondition (pensado para compareType
  // 'valor'): si la columna destino está vacía en esta fila, la condición
  // debe evaluar como false, no como coincidencia automática.
  if (cond.compareType === 'campo') {
    const compareValue = getCellValue(row, cond.compareColumn);
    if (compareValue === null || compareValue === undefined || String(compareValue).trim() === '') return false;
    if (isDateColumn(cond.column)) return matchesDateCondition(rowValue, cond.condition, compareValue);
    if (isNumericColumn(cond.column)) return matchesNumberCondition(rowValue, cond.condition, compareValue);
    return matchesTextCondition(rowValue, cond.condition, compareValue, { normalize: true });
  }

  if (isDateColumn(cond.column)) return matchesDateCondition(rowValue, cond.condition, cond.value);
  if (isNumericColumn(cond.column)) return matchesNumberCondition(rowValue, cond.condition, cond.value);
  return matchesTextCondition(rowValue, cond.condition, cond.value, { normalize: true });
};

/**
 * Evalúa un nodo (condición u grupo) sobre una fila. Un grupo evalúa a su
 * vez la lista de `children` con el mismo fold de {@link evaluateAdvancedFilters}
 * — el "paréntesis" se resuelve antes de combinarse con el resto de la
 * lista donde vive el grupo.
 * @param {Object} row - Fila de datos.
 * @param {Object} node - Condición o grupo.
 * @param {Object} [opts={}] - Ver {@link matchesAdvancedCondition}.
 * @returns {boolean}
 */
export const evaluateAdvancedNode = (row, node, opts = {}) =>
  node.type === 'group' ? evaluateAdvancedFilters(row, node.children || [], opts) : matchesAdvancedCondition(row, node, opts);

/**
 * Evalúa una lista completa de condiciones/grupos avanzados sobre una fila,
 * combinándolos en orden con el `logic` (AND/OR) de cada uno respecto al
 * anterior (evaluación secuencial de izquierda a derecha dentro de la
 * lista — igual que se construyen en el modal; un grupo actúa como
 * paréntesis explícito para forzar precedencia, ver {@link evaluateAdvancedNode}).
 * @param {Object} row - Fila de datos.
 * @param {Object[]} conditions - Condiciones/grupos válidos (ver {@link getValidAdvancedConditions}).
 * @param {Object} [opts={}] - Ver {@link matchesAdvancedCondition}.
 * @returns {boolean} `true` si la fila pasa el conjunto de condiciones.
 */
export const evaluateAdvancedFilters = (row, conditions, opts = {}) => {
  if (!conditions || conditions.length === 0) return true;
  let result = evaluateAdvancedNode(row, conditions[0], opts);
  for (let i = 1; i < conditions.length; i++) {
    const cur = evaluateAdvancedNode(row, conditions[i], opts);
    result = conditions[i].logic === 'OR' ? (result || cur) : (result && cur);
  }
  return result;
};

/**
 * Filtra un arreglo de filas con `evaluateAdvancedFilters`.
 * @param {Object[]} data - Filas.
 * @param {Object[]} conditions - Condiciones válidas.
 * @param {Object} [opts={}] - Ver {@link matchesAdvancedCondition}.
 * @returns {Object[]} Filas que cumplen el conjunto de condiciones.
 */
export const applyAdvancedFiltersToData = (data, conditions, opts = {}) => {
  if (!conditions || conditions.length === 0) return data;
  return data.filter((row) => evaluateAdvancedFilters(row, conditions, opts));
};
