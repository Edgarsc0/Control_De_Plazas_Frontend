import { useState, useCallback } from 'react';

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
  ]
};

// Helper function to detect column type intuitively
export const getColumnType = (key) => {
  if (!key) return 'TEXT';
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('fecha') || lowerKey.includes('f_efva') || lowerKey.includes('date')) return 'DATE';
  if (lowerKey.includes('total') || lowerKey.includes('presupuesto') || lowerKey.includes('cantidad') || lowerKey.includes('monto')) return 'NUMBER';
  return 'TEXT';
};

export const evaluateCondition = (rowValue, operator, filterValue) => {
  const valStr = rowValue === null || rowValue === undefined ? "" : String(rowValue).toLowerCase();
  const filterStr = filterValue === null || filterValue === undefined ? "" : String(filterValue).toLowerCase();

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
      // Convert DD/MM/YYYY to YYYY-MM-DD if necessary
      const parseDate = (d) => {
        if (typeof d === 'string') {
          let dateStr = d.split(' ')[0]; // Handle potential time part by splitting space
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
      
      const date1 = parseDate(rowValue);
      const date2 = parseDate(filterValue);
      
      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
      
      return operator === 'before' ? date1 < date2 : date1 > date2;
    }
    case 'is_empty': return valStr === "";
    case 'is_not_empty': return valStr !== "";
    default: return true;
  }
};

export function useAdvancedFilter() {
  const [rules, setRules] = useState([]);

  const addRule = () => {
    setRules([...rules, { 
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5), 
      logic: 'AND', 
      field: '', 
      operator: 'equals', 
      valueType: 'VALUE',
      value: '' 
    }]);
  };

  const updateRule = (id, key, value) => {
    setRules(prevRules => prevRules.map(rule => {
      if (rule.id === id) {
        // Auto-adjust operator if field changes and old operator is incompatible
        const newRule = { ...rule, [key]: value };
        if (key === 'field') {
          const type = getColumnType(value);
          const validOperators = OPERATORS[type].map(o => o.value);
          if (!validOperators.includes(newRule.operator)) {
            newRule.operator = validOperators[0];
          }
          newRule.value = ''; // Reset value when field changes
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

  const filterData = useCallback((data) => {
    if (!rules || rules.length === 0) return data;

    // Filter out incomplete rules
    const validRules = rules.filter(r => r.field && r.operator && (['is_empty', 'is_not_empty'].includes(r.operator) || r.value !== ''));
    if (validRules.length === 0) return data;

    return data.filter(row => {
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
        } else {
          if (rule.logic === 'AND') {
            result = result && conditionResult;
          } else if (rule.logic === 'OR') {
            result = result || conditionResult;
          }
        }
      }
      return result;
    });
  }, [rules]);

  return { rules, setRules, addRule, updateRule, removeRule, clearRules, filterData };
}
