import { useRef, useState, useCallback } from 'react';
import { emptyAdvancedCondition, emptyAdvancedGroup, getValidAdvancedConditions } from '@/utils/advancedFilters';
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
 * @param {(key: string) => boolean} [params.isNumericColumn=() => false] - Determina si una columna es numérica (mismo efecto que `isDateColumn`, con sus propias condiciones).
 */
export function useAdvancedFilters({ mode = 'client', onApply, isDateColumn = () => false, isNumericColumn = () => false } = {}) {
  const { toast } = useToast();
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const advConditionIdRef = useRef(1);
  const [advancedConditions, setAdvancedConditions] = useState(() => [emptyAdvancedCondition(0)]);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState([]);

  /** Sin `groupId`, agrega al top-level; con `groupId`, agrega dentro de ese grupo. */
  const addAdvancedCondition = useCallback((groupId = null) => {
    setAdvancedConditions((prev) => {
      const newCondition = emptyAdvancedCondition(advConditionIdRef.current++);
      if (groupId == null) return [...prev, newCondition];
      return prev.map((n) => (n.type === 'group' && n.id === groupId ? { ...n, children: [...n.children, newCondition] } : n));
    });
  }, []);

  /** Agrega un grupo (paréntesis explícito) al top-level, con una condición vacía dentro. */
  const addAdvancedGroup = useCallback(() => {
    setAdvancedConditions((prev) => {
      const group = emptyAdvancedGroup(advConditionIdRef.current++);
      group.children = [emptyAdvancedCondition(advConditionIdRef.current++)];
      return [...prev, group];
    });
  }, []);

  /** Busca `id` en el top-level y dentro de los `children` de cada grupo. */
  const removeAdvancedCondition = useCallback((id) => {
    setAdvancedConditions((prev) => prev
      .filter((n) => n.id !== id)
      .map((n) => (n.type === 'group' ? { ...n, children: n.children.filter((c) => c.id !== id) } : n)));
  }, []);

  const removeAdvancedGroup = useCallback((groupId) => {
    setAdvancedConditions((prev) => prev.filter((n) => n.id !== groupId));
  }, []);

  /** Busca `id` en el top-level y dentro de los `children` de cada grupo (condiciones Y grupos, para su `logic`). */
  const updateAdvancedCondition = useCallback((id, patch) => {
    const applyPatch = (c) => {
      const next = { ...c, ...patch };
      if (patch.column !== undefined && patch.column !== c.column) {
        next.condition = isDateColumn(patch.column) ? 'before' : isNumericColumn(patch.column) ? 'equals' : 'contains';
        next.value = '';
        next.compareColumn = null;
      }
      if (patch.condition !== undefined && (patch.condition === 'empty' || patch.condition === 'not_empty')) {
        next.compareType = 'valor';
        next.value = '';
        next.compareColumn = null;
      }
      return next;
    };
    setAdvancedConditions((prev) => prev.map((n) => {
      if (n.id === id) return applyPatch(n);
      if (n.type === 'group') return { ...n, children: n.children.map((c) => (c.id === id ? applyPatch(c) : c)) };
      return n;
    }));
  }, [isDateColumn, isNumericColumn]);

  /**
   * Carga condiciones/grupos de un filtro guardado en el formulario,
   * hidratando ids frescos vía `advConditionIdRef` (recursivo, incluye los
   * `children` de cada grupo). Usa `emptyAdvancedCondition`/`emptyAdvancedGroup`
   * como base según `type` — filtros guardados viejos (sin `type`) hidratan
   * como condición por default.
   */
  const loadSavedFilter = useCallback((conditions) => {
    const hydrate = (nodes) => nodes.map((n) => {
      const id = advConditionIdRef.current++;
      if (n.type === 'group') return { ...emptyAdvancedGroup(id), ...n, id, children: hydrate(n.children || []) };
      return { ...emptyAdvancedCondition(id), ...n, id };
    });
    setAdvancedConditions(hydrate(conditions));
  }, []);

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
    addAdvancedGroup, removeAdvancedGroup, loadSavedFilter,
    applyAdvancedFilters, resetAdvancedFilters,
  };
}
