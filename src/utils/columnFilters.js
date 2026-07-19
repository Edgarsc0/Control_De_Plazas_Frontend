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
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
        if (parts[0].length <= 2) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
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
 * Formatea una fecha a `DD/MM/AAAA` — formato único de todo el módulo
 * `plantilla_empleados` (7.9 QA: antes convivían ISO crudo `2026-04-01`,
 * `1 ago 2026` del historial y variantes por tab). Si el valor no es una
 * fecha válida devuelve el string original tal cual (para no mostrar
 * "Invalid Date" sobre una columna que en realidad no es de fecha, o sobre
 * texto de estatus como "Vacante" en un campo de fecha con dato sucio).
 *
 * Deliberadamente NO usa `new Date(...)` en ningún punto: ese constructor
 * interpreta `"YYYY-MM-DD"` como medianoche **UTC**, y leerlo con getters
 * **locales** en un huso horario negativo (México, UTC-6) resta un día a la
 * fecha mostrada — el bug clásico de off-by-one. Día/mes/año/hora se extraen
 * siempre por string, tal como los manda el backend, sin ninguna conversión
 * de zona horaria de por medio.
 * @param {*} val - Valor a formatear.
 * @param {{ withTime?: boolean }} [opts={}] - `withTime: true` agrega `HH:mm` si el valor trae hora.
 * @returns {string} `DD/MM/AAAA` (+ ` HH:mm` opcional), o el valor original si no es fecha.
 */
export const formatDateEsMx = (val, opts = {}) => {
  if (val === null || val === undefined || String(val).trim() === '') return '';
  const str = String(val).trim();

  const dateSection = str.split(/[T ]/)[0];
  const sep = dateSection.includes('/') ? '/' : dateSection.includes('-') ? '-' : null;
  let base = null;
  if (sep) {
    const parts = dateSection.split(sep);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      const [year, month, day] = a.length === 4 ? [a, b, c] : [c, b, a];
      if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(month) && /^\d{1,2}$/.test(day)) {
        base = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  }
  if (!base) return str;
  if (!opts.withTime) return base;

  const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
  return timeMatch ? `${base} ${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : base;
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
  return sortValueCounts(Object.entries(counts).map(([value, count]) => ({ value, count })));
};

/**
 * Ordena una lista `{value, count}` alfanumérica con orden numérico correcto
 * (`"2"` antes que `"10"`). Usado tanto para universos calculados en cliente
 * (`getUniqueColumnValues`) como para listas de valores distintos que llegan
 * ya armadas desde el backend (sin orden garantizado).
 * @param {Array<{value: string, count: number}>} list - Valores a ordenar.
 * @returns {Array<{value: string, count: number}>} Copia ordenada.
 */
export const sortValueCounts = (list) =>
  [...list].sort((a, b) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));

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
/**
 * Cierra el cómputo de `dropdownValues` que consume `ColumnFilterDropdown`, a
 * partir de las piezas que cada tab ya arma a su manera (`baseUniqueValues`,
 * `filtered`). Centraliza lo que antes se repetía 4 veces: universo completo
 * vs. visible (post-búsqueda), estado indeterminado y orden "seleccionados
 * arriba" (congelado al valor ya aplicado, no al de la selección en curso, para
 * que la lista no salte mientras el usuario sigue marcando casillas).
 *
 * @param {Object} params
 * @param {Array<{value: string, count: number}>} params.baseUniqueValues - Universo de valores de la columna (todos o "vista actual").
 * @param {Array<{value: string, count: number}>} params.filtered - Subconjunto de `baseUniqueValues` que matchea el buscador del dropdown.
 * @param {string[]} params.tempSelectedValues - Selección en curso (no aplicada aún).
 * @param {string[]} [params.committedSelectedValues=[]] - Selección ya aplicada (`columnFilters[colKey]`); ancla el orden.
 * @returns {{allVals: string[], isAllSelected: boolean, isPartialSelected: boolean, visibleVals: string[], isVisibleAllSelected: boolean, isVisiblePartialSelected: boolean, sliced: Array<{value: string, count: number}>, filteredCount: number}}
 */
export const finalizeFilterDropdownValues = ({
  baseUniqueValues,
  filtered,
  tempSelectedValues,
  committedSelectedValues = [],
}) => {
  const allVals = baseUniqueValues.map((v) => v.value);
  const tempSet = new Set(tempSelectedValues);
  const isAllSelected = allVals.length > 0 && allVals.every((v) => tempSet.has(v));
  const isPartialSelected = !isAllSelected && allVals.some((v) => tempSet.has(v));

  const committedSet = new Set(committedSelectedValues);
  const ordered = committedSet.size > 0
    ? [...filtered].sort((a, b) => {
        const aSel = committedSet.has(a.value);
        const bSel = committedSet.has(b.value);
        return aSel === bSel ? 0 : aSel ? -1 : 1;
      })
    : filtered;

  const visibleVals = filtered.map((v) => v.value);
  const isVisibleAllSelected = visibleVals.length > 0 && visibleVals.every((v) => tempSet.has(v));
  const isVisiblePartialSelected = !isVisibleAllSelected && visibleVals.some((v) => tempSet.has(v));

  return {
    allVals,
    isAllSelected,
    isPartialSelected,
    visibleVals,
    isVisibleAllSelected,
    isVisiblePartialSelected,
    sliced: ordered,
    filteredCount: filtered.length,
  };
};

export const applyColumnFilters = (data, config = {}) => {
  const {
    globalSearch = '',
    columnFilters = {},
    textFilters = {},
    getCellValue = defaultGetCellValue,
    isMonoColumn = () => false,
  } = config;

  const search = globalSearch ? normalizeForSearch(globalSearch) : '';

  return data.filter((row) => {
    // 1. Búsqueda global: alguna celda contiene el texto.
    if (search) {
      const hit = Object.keys(row).some((key) => normalizeForSearch(getCellValue(row, key)).includes(search));
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
      if (!matchesTextCondition(getCellValue(row, colKey), condition, filterObj.value, { normalize: true })) return false;
    }
    return true;
  });
};
