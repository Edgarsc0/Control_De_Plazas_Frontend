import { useState, useCallback, useMemo } from 'react';
import { getColumnType, parseFlexibleDate } from '@/utils/columnFilters';

/**
 * Compara dos valores según el tipo inferido de la columna (texto, número o fecha).
 * @param {*} a - Primer valor.
 * @param {*} b - Segundo valor.
 * @param {('TEXT'|'NUMBER'|'DATE')} type - Tipo de columna.
 * @returns {number} Negativo si `a<b`, positivo si `a>b`, 0 si equivalen.
 */
const compareByType = (a, b, type) => {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // vacíos al final
  if (bEmpty) return -1;

  if (type === 'NUMBER') return Number(a) - Number(b);
  if (type === 'DATE') return parseFlexibleDate(a).getTime() - parseFlexibleDate(b).getTime();
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
};

/**
 * Hook de ordenamiento de tablas. Mantiene `{ key, direction }` y expone un
 * `toggleSort` que cicla asc → desc → sin orden, además del arreglo ya ordenado.
 * @template T
 * @param {T[]} data - Filas a ordenar.
 * @param {{ key: string|null, direction: ('asc'|'desc') }} [initial] - Estado inicial.
 * @returns {{
 *   sortConfig: { key: string|null, direction: ('asc'|'desc') },
 *   toggleSort: (key: string) => void,
 *   sortedData: T[]
 * }} Estado y datos ordenados.
 */
export function useSort(data = [], initial = { key: null, direction: 'asc' }) {
  const [sortConfig, setSortConfig] = useState(initial);

  const toggleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: 'asc' }; // tercer click: limpia el orden
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    const type = getColumnType(sortConfig.key);
    const factor = sortConfig.direction === 'asc' ? 1 : -1;
    return [...data].sort((rowA, rowB) => factor * compareByType(rowA[sortConfig.key], rowB[sortConfig.key], type));
  }, [data, sortConfig]);

  return { sortConfig, toggleSort, sortedData };
}
