'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlantillaService } from '@/services/plantilla.service';
import { setLatestZafiroFecha } from '@/lib/plantillaBrowserCache';

const ZafiroUpdatesContext = createContext(null);

const REFRESH_WAIT_CAP_MS = 20000;

export function ZafiroUpdatesProvider({ children }) {
  const [lastUpdate, setLastUpdate] = useState(null);
  const listenersRef = useRef(new Set());
  // Valor ISO crudo del último "fecha" conocido (a diferencia de `lastUpdate`,
  // ya formateado para mostrar) — permite detectar si el timestamp cambió
  // entre dos llamadas a fetchLastUpdate, ver comentario en 'init' más abajo.
  const lastUpdateRawRef = useRef(null);
  // Cantidad de refetch de suscriptores en vuelo (evento SSE real o aviso
  // local): alimenta el spinner "actualizando" bajo el PageTabBar.
  const [refreshingCount, setRefreshingCount] = useState(0);

  // Llama a todos los suscriptores y mantiene `refreshingCount` > 0 hasta que
  // las promesas que devolvieron terminan (bien o mal). Los que no devuelven
  // promesa (ej. un `tick`) no prenden el spinner. Estable (sólo refs/setState)
  // para poder usarlo dentro del effect del SSE.
  const notifyListeners = useCallback((fecha) => {
    const pending = [];
    listenersRef.current.forEach((callback) => {
      try {
        const result = callback(fecha);
        if (result && typeof result.then === 'function') pending.push(result);
      } catch (err) {
        console.error('Error en suscriptor de ZAFIRO:', err);
      }
    });
    if (!pending.length) return;
    setRefreshingCount((c) => c + 1);
    Promise.allSettled(pending).finally(() => setRefreshingCount((c) => Math.max(0, c - 1)));
  }, []);

  const formatAndSetDate = (isoString) => {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = String(hours).padStart(2, '0');

    setLastUpdate(`${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`);
  };

  useEffect(() => {
    let active = true;

    // `notifyIfChanged`: al reconectar (cada 300s por tope del backend, o
    // antes si se cae la conexión por VPN/red) el servidor manda 'init', que
    // solo dispara este fetch REST — nunca los `listenersRef` (eso solo
    // pasaba con un mensaje real de datos por el pubsub de Redis). Si el
    // import de ZAFIRO publicó su aviso de éxito justo en el hueco entre
    // desconexión y reconexión, ese mensaje se pierde para siempre (el
    // pubsub no tiene replay) y ningún tab vuelve a pedir datos frescos
    // hasta un F5 manual, aunque el letrero de "última actualización" (este
    // fetch) sí quede al día. Comparando contra el último timestamp
    // conocido, un 'init' que trae una fecha distinta se trata igual que un
    // mensaje real y sí dispara `router.refresh()` en los suscriptores.
    const fetchLastUpdate = async ({ notifyIfChanged = false } = {}) => {
      try {
        const response = await PlantillaService.getUltimaActualizacion();
        if (response.ok && active) {
          const res = await response.json();
          if (res && res.fecha) {
            const changed = lastUpdateRawRef.current !== null && lastUpdateRawRef.current !== res.fecha;
            lastUpdateRawRef.current = res.fecha;
            setLatestZafiroFecha(res.fecha);
            formatAndSetDate(res.fecha);
            if (notifyIfChanged && changed) {
              notifyListeners(res.fecha);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching last update:', err);
      }
    };

    fetchLastUpdate();

    // Los streams SSE viven en un puerto/origen aparte del resto de la API
    // (NEXT_PUBLIC_SSE_URL) para no compartir el límite de 6 conexiones por
    // origen de HTTP/1.1 con los fetches normales de la página — sin esto,
    // abrir un par de pestañas satura el cupo y el SSE se queda "colgado"
    // sin error visible (ver plantilla_empleados/_hooks/useCeldaUpdatesRealtime.js).
    const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const sseUrl = `${sseBaseUrl}/api/plantilla/bitacora/sse/`;
    let eventSource;
    let reconnectTimer;
    let retryDelay = 5000;
    const MAX_RETRY_DELAY = 60000;

    const connectSSE = () => {
      if (!active) return;

      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        retryDelay = 5000;
      };

      eventSource.onmessage = (event) => {
        if (!active) return;
        if (event.data === 'init') {
          fetchLastUpdate({ notifyIfChanged: true });
        } else if (event.data !== 'ping' && event.data) {
          lastUpdateRawRef.current = event.data;
          setLatestZafiroFecha(event.data);
          formatAndSetDate(event.data);
          notifyListeners(event.data);
        }
      };

      eventSource.onerror = (err) => {
        if (eventSource) {
          eventSource.close();
        }
        if (!active) return;
        console.warn(`SSE desconectado, reintentando en ${retryDelay / 1000}s...`, err);
        reconnectTimer = setTimeout(connectSSE, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
      };
    };

    connectSSE();

    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [notifyListeners]);

  const subscribe = (callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  };

  // Dispara a mano los mismos suscriptores que un evento real de ZAFIRO, sin
  // esperar al pubsub de Redis. Necesario para acciones administrativas que
  // SÍ cambian EMPLEADOS_COMPLETOS_SIG/MOV_POS (bulk-assign o "aplicar
  // prioridad" de nivel jerárquico, ver NivelesJerarquicosPlazaSubtab) pero
  // corren fuera del ciclo del ETL de Celery — hoy solo invalidan el cache
  // del backend y llaman `router.refresh()`, que ya no alcanza por sí solo
  // para refrescar los datasets que ahora viven cacheados en IndexedDB del
  // navegador (Plantilla Detalle, Mov. Posiciones), ver
  // PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md.
  const notifyLocalUpdate = () => {
    const fecha = new Date().toISOString();
    lastUpdateRawRef.current = fecha;
    formatAndSetDate(fecha);
    notifyListeners(fecha);
  };

  // Igual que `notifyLocalUpdate` pero SIN tocar el letrero de "última
  // actualización": solo pide a los suscriptores que vuelvan a traer sus
  // datos por red. Lo usa el Navbar tras borrar cachés a mano, donde no hay
  // ningún dato nuevo de ZAFIRO que anunciar.
  //
  // Devuelve una promesa que resuelve cuando TODOS los suscriptores que
  // devolvieron una promesa terminaron (bien o mal) — así el Navbar puede
  // avisar "datos recargados" en vez de que el usuario adivine cuándo acabó.
  // Los suscriptores que no devuelven nada (p. ej. los que solo suben un
  // `tick`) cuentan como ya resueltos. Un callback que lanza síncrono o
  // rechaza no rompe a los demás; `failed` cuenta cuántos fallaron.
  const refetchSubscribers = async () => {
    const fecha = lastUpdateRawRef.current || new Date().toISOString();
    const pending = [...listenersRef.current].map((callback) => {
      try {
        return Promise.resolve(callback(fecha));
      } catch (err) {
        return Promise.reject(err);
      }
    });
    const results = await Promise.allSettled(pending);
    const failed = results.filter((r) => r.status === 'rejected').length;
    return { total: results.length, failed };
  };

  return (
    <ZafiroUpdatesContext.Provider value={{ lastUpdate, isRefreshing: refreshingCount > 0, subscribe, notifyLocalUpdate, refetchSubscribers }}>
      {children}
    </ZafiroUpdatesContext.Provider>
  );
}

export function useZafiroUpdates() {
  const ctx = useContext(ZafiroUpdatesContext);
  if (!ctx) {
    throw new Error('useZafiroUpdates debe usarse dentro de ZafiroUpdatesProvider');
  }
  return ctx;
}

// Versión tolerante de `useZafiroUpdates().isRefreshing`: false fuera del
// provider (componentes de UI genéricos como PageTabBar).
export function useZafiroRefreshing() {
  return useContext(ZafiroUpdatesContext)?.isRefreshing ?? false;
}

// Refresca los Server Components de la página actual cuando llega una
// actualización real de ZAFIRO (publicada por Celery al terminar con éxito).
export function useRefreshOnZafiroUpdate() {
  const { subscribe } = useZafiroUpdates();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // `startTransition` no devuelve promesa: los resolvers se guardan y se
  // liberan cuando `isPending` vuelve a false (el refresh ya pintó). El tope
  // evita que `refetchSubscribers` quede colgado si el refresh no llega a
  // marcar la transición como pendiente.
  const resolversRef = useRef([]);
  const sawPendingRef = useRef(false);

  useEffect(() => {
    if (isPending) {
      sawPendingRef.current = true;
    } else if (sawPendingRef.current) {
      sawPendingRef.current = false;
      resolversRef.current.splice(0).forEach((resolve) => resolve());
    }
  }, [isPending]);

  useEffect(() => {
    const unsubscribe = subscribe(
      () =>
        new Promise((resolve) => {
          resolversRef.current.push(resolve);
          setTimeout(resolve, REFRESH_WAIT_CAP_MS);
          startTransition(() => {
            router.refresh();
          });
        })
    );
    return unsubscribe;
  }, [subscribe, router]);

  return isPending;
}
