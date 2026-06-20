import { useState, useMemo, useCallback, useDeferredValue, useTransition } from 'react';
import {
  applyColumnFilters,
  getUniqueColumnValues,
  buildDateHierarchy,
  matchesTextCondition,
} from '@/utils/columnFilters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * Estado completo del filtrado estilo Excel por columna usado en los tabs de
 * plantilla: búsqueda global, selección de valores, condiciones de texto y la UI
 * del dropdown por columna (pestañas, selección temporal, árbol de fechas).
 *
 * La evaluación pura vive en `@/utils/columnFilters`. El cálculo de
 * `filteredData` usa valores diferidos (`useDeferredValue`) para no bloquear la
 * UI con tablas grandes.
 *
 * @param {Object} params
 * @param {Object[]} params.data - Filas completas a filtrar.
 * @param {(row: Object, key: string) => string} params.getCellValue - Accesor de valor de celda (mapeos de dominio). **Memoizar** con `useCallback`.
 * @param {(key: string) => boolean} [params.isMonoColumn] - Si la columna usa `starts_with` por defecto. **Memoizar**.
 * @returns {Object} Estado y acciones del filtrado (ver propiedades retornadas).
 */
export function useColumnFilters({ data = [], getCellValue, isMonoColumn = () => false }) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({}); // { [col]: string[] }
  const [textFilters, setTextFilters] = useState({});     // { [col]: { value, condition } }

  // UI del dropdown por columna
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState('todos');
  const [temp, setTemp] = useState([]);
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebouncedValue(searchText, 350);
  const [condition, setCondition] = useState('contains');
  const [expandedDates, setExpandedDates] = useState({});

  const [isPending, startTransition] = useTransition();

  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const deferredTextFilters = useDeferredValue(textFilters);

  const filteredData = useMemo(
    () => applyColumnFilters(data, {
      globalSearch: deferredGlobalSearch,
      columnFilters,
      textFilters: deferredTextFilters,
      getCellValue,
      isMonoColumn,
    }),
    [data, deferredGlobalSearch, columnFilters, deferredTextFilters, getCellValue, isMonoColumn],
  );

  const hasFilter = useCallback(
    (colKey) => (columnFilters[colKey]?.length > 0) || !!(textFilters[colKey] && textFilters[colKey].value),
    [columnFilters, textFilters],
  );

  const activeUniqueValues = useMemo(
    () => (active ? getUniqueColumnValues(data, active, getCellValue) : []),
    [active, data, getCellValue],
  );

  const activeDateHierarchy = useMemo(
    () => (active ? buildDateHierarchy(data, active) : null),
    [active, data],
  );

  const dropdownValues = useMemo(
    () => (active
      ? activeUniqueValues.filter((v) => matchesTextCondition(v.value, condition, debouncedSearchText, { normalize: true }))
      : []),
    [active, activeUniqueValues, condition, debouncedSearchText],
  );

  const openDropdown = useCallback((colKey) => {
    let willOpen = true;
    setActive((prev) => {
      willOpen = prev !== colKey;
      return willOpen ? colKey : null;
    });
    if (!willOpen) return;
    setTab('todos');
    setSearchText('');
    const uniqueVals = getUniqueColumnValues(data, colKey, getCellValue).map((v) => v.value);
    setTemp(columnFilters[colKey] || uniqueVals);
  }, [data, getCellValue, columnFilters]);

  const closeDropdown = useCallback(() => setActive(null), []);

  const toggleTemp = useCallback((value) => {
    setTemp((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const applyDropdown = useCallback((colKey) => {
    const totalUnique = getUniqueColumnValues(data, colKey, getCellValue).length;
    startTransition(() => {
      setColumnFilters((prev) => {
        if (temp.length === totalUnique) {
          const next = { ...prev };
          delete next[colKey];
          return next;
        }
        return { ...prev, [colKey]: temp };
      });
    });
    setActive(null);
  }, [data, getCellValue, temp]);

  const clearColumn = useCallback((colKey) => {
    startTransition(() => {
      setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
      setTextFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    });
    setActive(null);
  }, []);

  const setTextFilter = useCallback((colKey, value, cond) => {
    setTextFilters((prev) => ({ ...prev, [colKey]: { value, condition: cond } }));
  }, []);

  const toggleDate = useCallback((path) => {
    setExpandedDates((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const resetAll = useCallback(() => {
    setGlobalSearch('');
    startTransition(() => { setColumnFilters({}); setTextFilters({}); });
    setActive(null);
  }, []);

  return {
    filteredData,
    isPending,
    globalSearch,
    setGlobalSearch,
    columnFilters,
    setColumnFilters,
    textFilters,
    setTextFilters,
    setTextFilter,
    hasFilter,
    resetAll,
    dropdown: {
      active,
      open: openDropdown,
      close: closeDropdown,
      tab,
      setTab,
      temp,
      setTemp,
      toggleTemp,
      searchText,
      setSearchText,
      debouncedSearchText,
      condition,
      setCondition,
      expandedDates,
      toggleDate,
      uniqueValues: activeUniqueValues,
      values: dropdownValues,
      dateHierarchy: activeDateHierarchy,
      apply: applyDropdown,
      clearColumn,
    },
  };
}
