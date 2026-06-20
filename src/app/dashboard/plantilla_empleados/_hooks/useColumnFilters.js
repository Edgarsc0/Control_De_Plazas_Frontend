import { useState, useCallback } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * Contenedor del estado de filtrado estilo Excel por columna compartido por los
 * tabs de plantilla: búsqueda global, selección de valores, condiciones de texto
 * y la UI del dropdown por columna (pestaña, selección temporal, árbol de fechas,
 * dropdown de condición). Expone el estado y sus setters crudos con los mismos
 * nombres que usaban los tabs, para un cableado directo.
 *
 * La evaluación pura (filtrado, valores únicos, jerarquía de fechas) vive en
 * `@/utils/columnFilters`.
 *
 * @param {Object} [params={}]
 * @param {Object<string, string[]>} [params.initialColumnFilters={}] - Filtros de valores iniciales por columna.
 * @returns {Object} Estado plano + setters + `debouncedFilterSearchText` y `resetFilters`.
 */
export function useColumnFilters({ initialColumnFilters = {} } = {}) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [textFilters, setTextFilters] = useState({});

  // UI del dropdown por columna
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [filterDropdownTab, setFilterDropdownTab] = useState('todos');
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
    filterDropdownTab, setFilterDropdownTab,
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
