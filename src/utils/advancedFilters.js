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

/** Operador lógico entre una condición y la anterior. */
export const ADV_LOGIC_OPTIONS = [
  { key: 'AND', label: 'Y (AND)' },
  { key: 'OR', label: 'O (OR)' },
];

/** Condición avanzada vacía, con el `id` que le toque asignar el caller. */
export const emptyAdvancedCondition = (id = 0) => ({
  id, column: null, condition: 'contains', compareType: 'valor', compareColumn: null, value: '', logic: 'AND',
});

/**
 * Filtra las condiciones de un formulario de filtros avanzados a las que están
 * completas y listas para aplicarse (columna elegida, y valor o compareColumn
 * según corresponda). Despoja el `id` interno de edición.
 * @param {Object[]} conditions - Condiciones crudas del formulario.
 * @returns {Object[]} Condiciones válidas, listas para aplicar/enviar.
 */
export const getValidAdvancedConditions = (conditions) =>
  conditions
    .filter((c) => {
      if (!c.column) return false;
      if (c.compareType === 'campo') return !!c.compareColumn;
      return c.value != null && String(c.value).trim() !== '';
    })
    .map(({ column, condition, compareType, compareColumn, value, logic }) => ({ column, condition, compareType, compareColumn, value, logic }));

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
 * Evalúa una condición avanzada (texto o fecha, valor o campo) sobre una fila.
 * @param {Object} row - Fila de datos.
 * @param {Object} cond - Condición (ver modelo arriba).
 * @param {Object} [opts={}]
 * @param {(row: Object, key: string) => string} [opts.getCellValue] - Accesor de celda.
 * @param {(key: string) => boolean} [opts.isDateColumn] - Si la columna es de fecha.
 * @returns {boolean} `true` si la fila cumple la condición.
 */
export const matchesAdvancedCondition = (row, cond, opts = {}) => {
  const { getCellValue = defaultGetCellValue, isDateColumn = () => false } = opts;
  if (!cond.column) return true;

  const rowValue = getCellValue(row, cond.column);
  const compareValue = cond.compareType === 'campo' ? getCellValue(row, cond.compareColumn) : cond.value;

  if (isDateColumn(cond.column)) return matchesDateCondition(rowValue, cond.condition, compareValue);
  return matchesTextCondition(rowValue, cond.condition, compareValue);
};

/**
 * Evalúa una lista completa de condiciones avanzadas sobre una fila,
 * combinándolas en orden con el `logic` (AND/OR) de cada una respecto a la
 * anterior (sin precedencia de operadores, evaluación estrictamente secuencial
 * de izquierda a derecha — igual que se construyen en el modal).
 * @param {Object} row - Fila de datos.
 * @param {Object[]} conditions - Condiciones válidas (ver {@link getValidAdvancedConditions}).
 * @param {Object} [opts={}] - Ver {@link matchesAdvancedCondition}.
 * @returns {boolean} `true` si la fila pasa el conjunto de condiciones.
 */
export const evaluateAdvancedFilters = (row, conditions, opts = {}) => {
  if (!conditions || conditions.length === 0) return true;
  let result = matchesAdvancedCondition(row, conditions[0], opts);
  for (let i = 1; i < conditions.length; i++) {
    const cur = matchesAdvancedCondition(row, conditions[i], opts);
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
