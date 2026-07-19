import { useEffect, useState } from 'react';

/**
 * `useState` respaldado en `localStorage` bajo `storageKey`. 7.3 QA: persistir
 * configuración de tabla por usuario (hoy todo se pierde al recargar). Lee el
 * valor guardado en el init perezoso (una sola vez) y lo re-escribe en cada
 * cambio; si `localStorage` no está disponible (SSR) o falla (cuota, modo
 * privado), degrada a un `useState` normal sin persistir.
 * @param {?string} storageKey - Clave única por vista/tab; `null`/`undefined` desactiva la persistencia.
 * @param {*} defaultValue - Valor inicial si no hay nada guardado (o falla la lectura).
 * @returns {[*, Function]} Igual que `useState`.
 */
export function usePersistedState(storageKey, defaultValue) {
  const [state, setState] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // localStorage lleno, deshabilitado (modo privado) o cuota excedida: se
      // ignora silenciosamente, persistir configuración no es crítico.
    }
  }, [storageKey, state]);

  return [state, setState];
}
