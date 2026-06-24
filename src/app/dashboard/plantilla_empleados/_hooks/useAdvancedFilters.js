import { useRef, useState, useCallback } from 'react';
import { emptyAdvancedCondition, getValidAdvancedConditions } from '@/utils/advancedFilters';
import { useToast } from '@/hooks/useToast';

/**
 * Estado y acciones del modal de "Filtros avanzados", compartido por los tabs
 * de plantilla. La evaluación pura vive en `@/utils/advancedFilters`.
 *
 * Dos modos:
 *  - `mode: 'server'` (Movimientos): `onApply` recibe las condiciones válidas
 *    para que el caller las mande al backend (`appliedAdvancedFilters` queda
 *    aquí solo para pintar el badge y decidir el reset).
 *  - `mode: 'client'` (Plantilla Detalle, Bajas): igual, pero el caller filtra
 *    el arreglo en memoria con `applyAdvancedFiltersToData`/`evaluateAdvancedFilters`
 *    usando `appliedAdvancedFilters` directo (no hay red de por medio).
 *
 * @param {Object} [params={}]
 * @param {'server'|'client'} [params.mode='client']
 * @param {(validConditions: Object[]) => void} [params.onApply] - Side-effect extra al aplicar (p. ej. `setLoading(true)`/`setPage(1)` en Movimientos).
 * @param {(key: string) => boolean} [params.isDateColumn=() => false] - Determina si una columna es de fecha (cambia las opciones de condición y resetea `condition` al cambiar de columna).
 */
export function useAdvancedFilters({ mode = 'client', onApply, isDateColumn = () => false } = {}) {
  const { toast } = useToast();
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const advConditionIdRef = useRef(1);
  const [advancedConditions, setAdvancedConditions] = useState(() => [emptyAdvancedCondition(0)]);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState([]);

  const addAdvancedCondition = useCallback(() => {
    setAdvancedConditions((prev) => [...prev, emptyAdvancedCondition(advConditionIdRef.current++)]);
  }, []);

  const removeAdvancedCondition = useCallback((id) => {
    setAdvancedConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateAdvancedCondition = useCallback((id, patch) => {
    setAdvancedConditions((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if (patch.column !== undefined && patch.column !== c.column) {
        next.condition = isDateColumn(patch.column) ? 'before' : 'contains';
      }
      return next;
    }));
  }, [isDateColumn]);

  const applyAdvancedFilters = useCallback(() => {
    const valid = getValidAdvancedConditions(advancedConditions);
    setAppliedAdvancedFilters(valid);
    setIsAdvancedFiltersOpen(false);
    onApply?.(valid);
    toast.success('Filtro aplicado!');
  }, [advancedConditions, onApply, toast]);

  const resetAdvancedFilters = useCallback(() => {
    setAdvancedConditions([emptyAdvancedCondition(0)]);
    advConditionIdRef.current = 1;
    setAppliedAdvancedFilters([]);
  }, []);

  return {
    mode,
    isAdvancedFiltersOpen, setIsAdvancedFiltersOpen,
    advancedConditions, setAdvancedConditions,
    appliedAdvancedFilters, setAppliedAdvancedFilters,
    addAdvancedCondition, removeAdvancedCondition, updateAdvancedCondition,
    applyAdvancedFilters, resetAdvancedFilters,
  };
}
