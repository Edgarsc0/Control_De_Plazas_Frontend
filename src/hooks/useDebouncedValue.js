import { useState, useEffect } from 'react';

/**
 * Devuelve una versión retardada (debounced) de un valor: sólo se actualiza
 * cuando `value` deja de cambiar durante `delay` milisegundos. Útil para
 * búsquedas en tablas sin disparar trabajo en cada pulsación.
 * @template T
 * @param {T} value - Valor a retardar.
 * @param {number} [delay=300] - Retardo en milisegundos.
 * @returns {T} El valor retardado.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
