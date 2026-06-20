/**
 * Lógica pura del filtrado estilo Excel por columna usado en los tabs de
 * `plantilla_empleados` (sin React). Es la fuente canónica que consumirán la
 * `DataTable`, el `ColumnFilterDropdown` y el hook de estado de filtros.
 *
 * Modelo de filtros (los tres modos se combinan con AND entre columnas):
 *  - `globalSearch`: texto libre que debe aparecer en alguna celda de la fila.
 *  - `columnFilters`: `{ [colKey]: string[] }` selección de valores exactos (checkboxes).
 *  - `textFilters`: `{ [colKey]: { value, condition } }` condición de texto por columna.
 *
 * El acceso al valor de celda se inyecta vía `getCellValue(row, key)` para que el
 * componente aporte su propio mapeo de dominio (p. ej. estado de nómina A→Activo).
 */

/**
 * Accesor por defecto: valor de celda como cadena.
 * @param {Object} row - Fila de datos.
 * @param {string} key - Clave de columna.
 * @returns {string} Valor en texto (cadena vacía si es nulo).
 */
export const defaultGetCellValue = (row, key) =>
  row[key] === null || row[key] === undefined ? '' : String(row[key]);

/**
 * Detecta de forma heurística el tipo de una columna a partir de su clave.
 * @param {string} key - Clave/nombre de la columna.
 * @returns {('TEXT'|'NUMBER'|'DATE')} Tipo inferido.
 */
export const getColumnType = (key) => {
  if (!key) return 'TEXT';
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('fecha') || lowerKey.includes('f_efva') || lowerKey.includes('date')) return 'DATE';
  if (lowerKey.includes('total') || lowerKey.includes('presupuesto') || lowerKey.includes('cantidad') || lowerKey.includes('monto')) return 'NUMBER';
  return 'TEXT';
};

/** Nombres de meses en español (índice 0 = Enero). */
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Parsea una fecha admitiendo `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, ISO y la
 * parte de hora separada por espacio.
 * @param {string|number|Date} d - Valor a interpretar como fecha.
 * @returns {Date} Objeto `Date` (puede ser inválido si no es parseable).
 */
export const parseFlexibleDate = (d) => {
  if (typeof d === 'string') {
    const dateStr = d.split(' ')[0];
    const sep = dateStr.includes('/') ? '/' : dateStr.includes('-') ? '-' : null;
    if (sep) {
      const parts = dateStr.split(sep);
      if (parts.length === 3 && parts[0].length <= 2) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      }
    }
  }
  return new Date(d);
};

/**
 * Descompone una fecha en partes (año, mes, día y nombre del mes), soportando
 * tanto `YYYY-MM-DD` como `DD-MM-YYYY` / `DD/MM/YYYY`.
 * @param {string|number|Date} val - Valor de fecha.
 * @returns {{year: string, month: string, day: string, monthName: string}|null} Partes o `null` si no es válida.
 */
export const parseDateParts = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return null;
  let d = new Date(val);
  if (isNaN(d.getTime())) {
    const parts = String(val).split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) d = new Date(parts[0], parts[1] - 1, parts[2]);
      else d = new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear().toString(),
    month: (d.getMonth() + 1).toString().padStart(2, '0'),
    day: d.getDate().toString().padStart(2, '0'),
    monthName: MONTH_NAMES[d.getMonth()],
  };
};

/**
 * Normaliza un texto para búsqueda: quita acentos (NFD) y pasa a minúsculas.
 * @param {*} val - Valor a normalizar.
 * @returns {string} Texto normalizado (cadena vacía si es nulo).
 */
export const normalizeForSearch = (val) =>
  val ? String(val).normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase() : '';

/** Operadores de texto disponibles por columna, con su etiqueta y atajo. */
export const CONDITION_OPTIONS = [
  { key: 'contains', label: 'Contiene (*)' },
  { key: 'not_contains', label: 'No contiene (!*)' },
  { key: 'starts_with', label: 'Comienza con (^)' },
  { key: 'not_starts_with', label: 'No comienza con (!^)' },
  { key: 'ends_with', label: 'Termina con ($)' },
  { key: 'not_ends_with', label: 'No termina con (!$)' },
  { key: 'equals', label: 'Es igual a (=)' },
  { key: 'not_equals', label: 'Diferente de (!=)' },
];

/** Atajos de un carácter por condición. */
export const CONDITION_SHORTHANDS = {
  contains: '*', not_contains: '!*',
  starts_with: '^', not_starts_with: '!^',
  ends_with: '$', not_ends_with: '!$',
  equals: '=', not_equals: '!=',
};

/**
 * Etiqueta legible de una condición de texto.
 * @param {string} cond - Clave de condición.
 * @returns {string} Etiqueta en español.
 */
export const getConditionLabel = (cond) => {
  const found = CONDITION_OPTIONS.find((o) => o.key === cond);
  return found ? found.label.replace(/\s*\(.*\)$/, '') : 'Contiene';
};

/**
 * Evalúa una condición de texto sobre un valor.
 * @param {*} value - Valor de la celda.
 * @param {string} condition - Condición (ver {@link CONDITION_OPTIONS}).
 * @param {string} needle - Texto buscado.
 * @param {{ normalize?: boolean }} [opts={}] - `normalize: true` quita acentos (NFD); por defecto sólo minúsculas+trim.
 * @returns {boolean} `true` si el valor cumple la condición.
 */
export const matchesTextCondition = (value, condition, needle, opts = {}) => {
  if (!needle) return true;
  const norm = opts.normalize
    ? normalizeForSearch
    : (v) => (v === null || v === undefined ? '' : String(v).toLowerCase().trim());
  const v = norm(value);
  const n = norm(needle);
  switch (condition) {
    case 'not_contains': return !v.includes(n);
    case 'starts_with': return v.startsWith(n);
    case 'not_starts_with': return !v.startsWith(n);
    case 'ends_with': return v.endsWith(n);
    case 'not_ends_with': return !v.endsWith(n);
    case 'equals': return v === n;
    case 'not_equals': return v !== n;
    case 'contains':
    default: return v.includes(n);
  }
};

/**
 * Calcula los valores únicos de una columna con su conteo, ordenados.
 * @param {Object[]} data - Filas.
 * @param {string} key - Columna a agregar.
 * @param {(row: Object, key: string) => string} [getCellValue=defaultGetCellValue] - Accesor de valor.
 * @returns {Array<{value: string, count: number}>} Valores únicos con conteo.
 */
export const getUniqueColumnValues = (data, key, getCellValue = defaultGetCellValue) => {
  const counts = {};
  data.forEach((row) => {
    const val = getCellValue(row, key).trim();
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
};

/**
 * Construye la jerarquía año → mes → día de una columna de fecha (para el árbol
 * de selección de fechas del dropdown de filtros).
 * @param {Object[]} data - Filas.
 * @param {string} key - Columna de fecha.
 * @returns {Object<string, {count: number, months: Object}>} Árbol de fechas.
 */
export const buildDateHierarchy = (data, key) => {
  const years = {};
  data.forEach((row) => {
    const parts = parseDateParts(row[key]);
    if (!parts) return;
    const { year, month, day, monthName } = parts;
    if (!years[year]) years[year] = { count: 0, months: {} };
    years[year].count++;
    if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
    years[year].months[month].count++;
    years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + 1;
  });
  return years;
};

/**
 * Aplica los tres modos de filtro (búsqueda global, selección de valores y
 * condiciones de texto) a un arreglo de filas. Réplica fiel de la lógica usada
 * en los tabs, parametrizada para ser genérica.
 *
 * @param {Object[]} data - Filas a filtrar.
 * @param {Object} config
 * @param {string} [config.globalSearch=''] - Texto de búsqueda global.
 * @param {Object<string, string[]>} [config.columnFilters={}] - Valores seleccionados por columna.
 * @param {Object<string, {value: string, condition?: string}>} [config.textFilters={}] - Condiciones de texto por columna.
 * @param {(row: Object, key: string) => string} [config.getCellValue=defaultGetCellValue] - Accesor de valor de celda.
 * @param {(key: string) => boolean} [config.isMonoColumn] - Si la columna es "mono" (default condición `starts_with`).
 * @returns {Object[]} Filas que pasan todos los filtros.
 */
export const applyColumnFilters = (data, config = {}) => {
  const {
    globalSearch = '',
    columnFilters = {},
    textFilters = {},
    getCellValue = defaultGetCellValue,
    isMonoColumn = () => false,
  } = config;

  const search = globalSearch ? globalSearch.toLowerCase() : '';

  return data.filter((row) => {
    // 1. Búsqueda global: alguna celda contiene el texto.
    if (search) {
      const hit = Object.keys(row).some((key) => getCellValue(row, key).toLowerCase().includes(search));
      if (!hit) return false;
    }
    // 2. Selección de valores por columna (checkboxes).
    for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
      if (!selectedVals || selectedVals.length === 0) continue;
      if (!selectedVals.includes(getCellValue(row, colKey).trim())) return false;
    }
    // 3. Condiciones de texto por columna.
    for (const [colKey, filterObj] of Object.entries(textFilters)) {
      if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
      const condition = filterObj.condition || (isMonoColumn(colKey) ? 'starts_with' : 'contains');
      if (!matchesTextCondition(getCellValue(row, colKey), condition, filterObj.value)) return false;
    }
    return true;
  });
};
