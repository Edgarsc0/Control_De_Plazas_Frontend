import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook genérico para cargar datos de tabla desde un método de servicio.
 *
 * Centraliza el patrón repetido en los tabs (estado `loading`/`error`/datos +
 * guarda de montaje) para que ningún componente haga `fetch` manual. El
 * `fetcher` debe devolver la `Response` cruda de `apiFetch`; el hook se encarga
 * de validar `res.ok` y parsear el JSON.
 *
 * @template T
 * @param {() => Promise<Response>} fetcher - Función que dispara la petición (p. ej. `() => VacantesService.getBajasSig()`).
 * @param {Object} [config={}]
 * @param {Array<*>} [config.deps=[]] - Dependencias que, al cambiar, vuelven a disparar la carga.
 * @param {boolean} [config.enabled=true] - Si es `false`, no carga hasta habilitarse.
 * @param {T} [config.initialData=null] - Valor inicial de `data`.
 * @returns {{ data: T, loading: boolean, error: (Error|null), refetch: () => Promise<void> }}
 */
export function useTableData(fetcher, config = {}) {
  const { deps = [], enabled = true, initialData = null } = config;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (!res.ok) throw new Error(`Error ${res.status} al cargar los datos`);
      const json = await res.json();
      if (mountedRef.current) setData(json);
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // `fetcher` se invoca según `deps`; se omite de la lista a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
