'use client';

import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlantillaService } from '@/services/plantilla.service';

const ZafiroUpdatesContext = createContext(null);

export function ZafiroUpdatesProvider({ children }) {
  const [lastUpdate, setLastUpdate] = useState(null);
  const listenersRef = useRef(new Set());

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

    const fetchLastUpdate = async () => {
      try {
        const response = await PlantillaService.getUltimaActualizacion();
        if (response.ok && active) {
          const res = await response.json();
          if (res && res.fecha) {
            formatAndSetDate(res.fecha);
          }
        }
      } catch (err) {
        console.error('Error fetching last update:', err);
      }
    };

    fetchLastUpdate();

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const sseUrl = `${apiBaseUrl}/api/plantilla/bitacora/sse/`;
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
          fetchLastUpdate();
        } else if (event.data !== 'ping' && event.data) {
          formatAndSetDate(event.data);
          listenersRef.current.forEach((callback) => callback(event.data));
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
  }, []);

  const subscribe = (callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  };

  return (
    <ZafiroUpdatesContext.Provider value={{ lastUpdate, subscribe }}>
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

// Refresca los Server Components de la página actual cuando llega una
// actualización real de ZAFIRO (publicada por Celery al terminar con éxito).
export function useRefreshOnZafiroUpdate() {
  const { subscribe } = useZafiroUpdates();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      startTransition(() => {
        router.refresh();
      });
    });
    return unsubscribe;
  }, [subscribe, router]);

  return isPending;
}
