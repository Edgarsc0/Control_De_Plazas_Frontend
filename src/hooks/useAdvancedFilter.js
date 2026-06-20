import { useState, useCallback } from 'react';
import { OPERATORS, getColumnType, evaluateCondition, applyRules } from '@/utils/filters';

// Reexport de la lógica pura para compatibilidad con importadores existentes
// (la fuente canónica vive en `@/utils/filters`).
export { OPERATORS, getColumnType, evaluateCondition };

/**
 * Hook de estado para el constructor de filtros avanzados (reglas AND/OR).
 * La evaluación pura se delega en `@/utils/filters`.
 * @returns {{
 *   rules: Array<Object>,
 *   setRules: Function,
 *   addRule: () => void,
 *   updateRule: (id: string, key: string, value: *) => void,
 *   removeRule: (id: string) => void,
 *   clearRules: () => void,
 *   filterData: (data: Array<Object>) => Array<Object>
 * }} API del constructor de filtros.
 */
export function useAdvancedFilter() {
  const [rules, setRules] = useState([]);

  const addRule = () => {
    setRules([...rules, {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      logic: 'AND',
      field: '',
      operator: 'equals',
      valueType: 'VALUE',
      value: '',
    }]);
  };

  const updateRule = (id, key, value) => {
    setRules(prevRules => prevRules.map(rule => {
      if (rule.id === id) {
        // Auto-ajusta el operador si cambia el campo y el operador es incompatible
        const newRule = { ...rule, [key]: value };
        if (key === 'field') {
          const type = getColumnType(value);
          const validOperators = OPERATORS[type].map(o => o.value);
          if (!validOperators.includes(newRule.operator)) {
            newRule.operator = validOperators[0];
          }
          newRule.value = ''; // Reinicia el valor al cambiar de campo
        }
        return newRule;
      }
      return rule;
    }));
  };

  const removeRule = (id) => {
    setRules(prevRules => prevRules.filter(rule => rule.id !== id));
  };

  const clearRules = () => {
    setRules([]);
  };

  const filterData = useCallback((data) => applyRules(data, rules), [rules]);

  return { rules, setRules, addRule, updateRule, removeRule, clearRules, filterData };
}
