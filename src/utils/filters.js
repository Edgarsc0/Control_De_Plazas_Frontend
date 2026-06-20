/**
 * Lógica pura de filtrado avanzado de tablas (sin React).
 *
 * Fuente canónica compartida por el hook `useAdvancedFilter` y, en la
 * modularización de los tabs de plantilla, por el `FilterModal` y la `DataTable`
 * genéricos. No debe contener estado ni efectos: sólo funciones puras.
 */

/**
 * Catálogo de operadores disponibles por tipo de columna.
 * @type {{TEXT: Array<{value: string, label: string}>, NUMBER: Array<{value: string, label: string}>, DATE: Array<{value: string, label: string}>}}
 */
export const OPERATORS = {
  TEXT: [
    { value: 'equals', label: 'Es igual a' },
    { value: 'not_equals', label: 'No es igual a' },
    { value: 'contains', label: 'Contiene' },
    { value: 'not_contains', label: 'No contiene' },
    { value: 'starts_with', label: 'Empieza con' },
    { value: 'ends_with', label: 'Termina con' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  NUMBER: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '!=' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'greater_or_equal', label: '>=' },
    { value: 'less_or_equal', label: '<=' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
  DATE: [
    { value: 'equals', label: 'Es exactamente el' },
    { value: 'before', label: 'Es antes de' },
    { value: 'after', label: 'Es después de' },
    { value: 'is_empty', label: 'Está vacío' },
    { value: 'is_not_empty', label: 'No está vacío' },
  ],
};

/**
 * Detecta de forma heurística el tipo de una columna a partir de su clave.
 * @param {string} key - Clave/nombre de la columna.
 * @returns {('TEXT'|'NUMBER'|'DATE')} Tipo inferido de la columna.
 */
export const getColumnType = (key) => {
  if (!key) return 'TEXT';
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('fecha') || lowerKey.includes('f_efva') || lowerKey.includes('date')) return 'DATE';
  if (lowerKey.includes('total') || lowerKey.includes('presupuesto') || lowerKey.includes('cantidad') || lowerKey.includes('monto')) return 'NUMBER';
  return 'TEXT';
};

/**
 * Parsea una fecha admitiendo formatos `DD/MM/YYYY`, `DD-MM-YYYY`, ISO y la parte
 * de hora separada por espacio.
 * @param {string|number|Date} d - Valor a interpretar como fecha.
 * @returns {Date} Objeto `Date` (puede ser inválido si el valor no es parseable).
 */
export const parseFlexibleDate = (d) => {
  if (typeof d === 'string') {
    const dateStr = d.split(' ')[0]; // descartar parte de hora si existe
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3 && parts[0].length <= 2) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      }
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length <= 2) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      }
    }
  }
  return new Date(d);
};

/**
 * Evalúa una condición individual de filtro sobre el valor de una celda.
 * @param {*} rowValue - Valor de la celda en la fila.
 * @param {string} operator - Operador a aplicar (ver {@link OPERATORS}).
 * @param {*} filterValue - Valor de comparación del filtro.
 * @returns {boolean} `true` si la fila cumple la condición.
 */
export const evaluateCondition = (rowValue, operator, filterValue) => {
  const valStr = rowValue === null || rowValue === undefined ? '' : String(rowValue).toLowerCase();
  const filterStr = filterValue === null || filterValue === undefined ? '' : String(filterValue).toLowerCase();

  switch (operator) {
    case 'equals': return valStr === filterStr;
    case 'not_equals': return valStr !== filterStr;
    case 'contains': return valStr.includes(filterStr);
    case 'not_contains': return !valStr.includes(filterStr);
    case 'starts_with': return valStr.startsWith(filterStr);
    case 'ends_with': return valStr.endsWith(filterStr);
    case 'greater_than': return Number(rowValue) > Number(filterValue);
    case 'less_than': return Number(rowValue) < Number(filterValue);
    case 'greater_or_equal': return Number(rowValue) >= Number(filterValue);
    case 'less_or_equal': return Number(rowValue) <= Number(filterValue);
    case 'before':
    case 'after': {
      if (!rowValue || !filterValue) return false;
      const date1 = parseFlexibleDate(rowValue);
      const date2 = parseFlexibleDate(filterValue);
      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
      return operator === 'before' ? date1 < date2 : date1 > date2;
    }
    case 'is_empty': return valStr === '';
    case 'is_not_empty': return valStr !== '';
    default: return true;
  }
};

/**
 * Descarta reglas incompletas (sin campo, sin operador, o sin valor cuando el
 * operador lo requiere).
 * @param {Array<Object>} rules - Reglas candidatas.
 * @returns {Array<Object>} Sólo las reglas aplicables.
 */
export const getValidRules = (rules = []) =>
  rules.filter(
    (r) => r.field && r.operator && (['is_empty', 'is_not_empty'].includes(r.operator) || r.value !== ''),
  );

/**
 * Aplica un conjunto de reglas de filtro a un arreglo de filas, encadenándolas
 * con su lógica `AND`/`OR` en orden. Soporta comparar contra un valor fijo
 * (`valueType: 'VALUE'`) o contra otra columna (`valueType: 'FIELD'`).
 * @param {Array<Object>} data - Filas a filtrar.
 * @param {Array<{field: string, operator: string, value: *, valueType?: ('VALUE'|'FIELD'), logic?: ('AND'|'OR')}>} rules - Reglas de filtro.
 * @returns {Array<Object>} Filas que cumplen las reglas (o `data` intacto si no hay reglas válidas).
 */
export const applyRules = (data, rules) => {
  if (!rules || rules.length === 0) return data;
  const validRules = getValidRules(rules);
  if (validRules.length === 0) return data;

  return data.filter((row) => {
    let result = true;
    for (let i = 0; i < validRules.length; i++) {
      const rule = validRules[i];
      let compareValue = rule.value;
      if (rule.valueType === 'FIELD') {
        compareValue = row[rule.value];
      }
      const conditionResult = evaluateCondition(row[rule.field], rule.operator, compareValue);
      if (i === 0) {
        result = conditionResult;
      } else if (rule.logic === 'AND') {
        result = result && conditionResult;
      } else if (rule.logic === 'OR') {
        result = result || conditionResult;
      }
    }
    return result;
  });
};
