"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

// SSE dedicado a cambios de celdas de EMPLEADOS_COMPLETOS_SIG (tab Detalle),
// para reflejar en vivo las ediciones de otros usuarios (ver backend
// plantilla.views.CeldaUpdatesSSEView / plantilla.celda_override.notificar_cambio_celda).
// Independiente del EventSource de ZafiroUpdatesContext (última actualización
// de ZAFIRO) — no lo toca ni depende de él.
export function useCeldaUpdatesRealtime(onCellUpdate) {
  const { hasPermission } = useAuth();
  const onCellUpdateRef = useRef(onCellUpdate);
  onCellUpdateRef.current = onCellUpdate;

  useEffect(() => {
    if (!hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE)) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = Cookies.get("auth_token");
    if (!token) return;

    const sseUrl = `${apiBaseUrl}/api/plantilla/empleados_completos_sig/celda-updates/sse/?token=${encodeURIComponent(token)}`;

    let eventSource;
    let reconnectTimer;
    let retryDelay = 5000;
    const MAX_RETRY_DELAY = 60000;
    let active = true;

    const connect = () => {
      if (!active) return;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        retryDelay = 5000;
      };

      eventSource.onmessage = (event) => {
        if (!active) return;
        if (event.data === "init" || event.data === "ping" || !event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "cell_update") {
            onCellUpdateRef.current?.(parsed.posicion, parsed.columna, parsed.valor_nuevo);
          }
        } catch {
          // mensaje no-JSON inesperado: se ignora, no es de este canal
        }
      };

      eventSource.onerror = (err) => {
        eventSource?.close();
        if (!active) return;
        console.warn(`SSE de celda-updates desconectado, reintentando en ${retryDelay / 1000}s...`, err);
        reconnectTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
      };
    };

    connect();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [hasPermission]);
}
