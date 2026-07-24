import { useState, useCallback, useEffect } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** Lee `{globalSearch, columnFilters, textFilters}` persistidos bajo `storageKey`, si existen. */
const readPersistedFilters = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Contenedor del estado de filtrado estilo Excel por columna compartido por los
 * tabs de plantilla: búsqueda global, selección de valores, condiciones de texto
 * y la UI del dropdown por columna (selección temporal, árbol de fechas,
 * dropdown de condición). Expone el estado y sus setters crudos con los mismos
 * nombres que usaban los tabs, para un cableado directo.
 *
 * La evaluación pura (filtrado, valores únicos, jerarquía de fechas) vive en
 * `@/utils/columnFilters`.
 *
 * @param {Object} [params={}]
 * @param {Object<string, string[]>} [params.initialColumnFilters={}] - Filtros de valores iniciales por columna.
 * @param {?string} [params.storageKey] - 7.3 QA: si se provee, persiste búsqueda global/filtros por usuario en `localStorage` bajo esta clave.
 * @returns {Object} Estado plano + setters + `debouncedFilterSearchText` y `resetFilters`.
 */
export function useColumnFilters({ initialColumnFilters = {}, storageKey } = {}) {
  const [globalSearch, setGlobalSearch] = useState(() => readPersistedFilters(storageKey)?.globalSearch ?? '');
  const [columnFilters, setColumnFilters] = useState(() => readPersistedFilters(storageKey)?.columnFilters ?? initialColumnFilters);
  const [textFilters, setTextFilters] = useState(() => readPersistedFilters(storageKey)?.textFilters ?? {});

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ globalSearch, columnFilters, textFilters }));
    } catch {
      // localStorage lleno/deshabilitado: no es crítico, se ignora.
    }
  }, [storageKey, globalSearch, columnFilters, textFilters]);

  // UI del dropdown por columna
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [activeConditionDropdown, setActiveConditionDropdown] = useState(null);
  const [tempSelectedValues, setTempSelectedValues] = useState([]);
  const [filterSearchText, setFilterSearchText] = useState('');
  const [filterSearchCondition, setFilterSearchCondition] = useState('contains');
  const [isFilterSearchConditionOpen, setIsFilterSearchConditionOpen] = useState(false);
  const [expandedDateNodes, setExpandedDateNodes] = useState({});

  const debouncedFilterSearchText = useDebouncedValue(filterSearchText, 350);

  /** Limpia búsqueda global, selección de valores y condiciones de texto. */
  const resetFilters = useCallback(() => {
    setGlobalSearch('');
    setColumnFilters({});
    setTextFilters({});
  }, []);

  return {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    expandedDateNodes, setExpandedDateNodes,
    debouncedFilterSearchText,
    resetFilters,
  };
}
