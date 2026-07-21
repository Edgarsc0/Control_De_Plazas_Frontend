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
export function useCeldaUpdatesRealtime(onCellUpdate, onReconnect) {
  const { hasPermission } = useAuth();
  const onCellUpdateRef = useRef(onCellUpdate);
  onCellUpdateRef.current = onCellUpdate;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE)) return;

    // Puerto/origen aparte del resto de la API (ver comentario equivalente en
    // ZafiroUpdatesContext) — evita compartir el límite de 6 conexiones por
    // origen de HTTP/1.1 con los fetches normales de la página.
    const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = Cookies.get("auth_token");
    if (!token) return;

    const sseUrl = `${sseBaseUrl}/api/plantilla/empleados_completos_sig/celda-updates/sse/?token=${encodeURIComponent(token)}`;

    let eventSource;
    let reconnectTimer;
    let retryDelay = 5000;
    const MAX_RETRY_DELAY = 60000;
    let active = true;
    // El backend corta el stream cada pocos minutos (ver SSE_MAX_LIFETIME_SECONDS
    // en ZafiroSSEView/CeldaUpdatesSSEView) para no agotar conexiones MySQL; en
    // el hueco de reconexión (backoff) se pueden perder eventos cell_update de
    // otros usuarios, ya que este canal no tiene fallback por BD como el de
    // ZAFIRO. Por eso, en cada reconexión (no en la primera, que ya parte de
    // datos frescos del server) se pide un refetch completo para resincronizar.
    let hasConnectedBefore = false;

    const connect = () => {
      if (!active) return;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        retryDelay = 5000;
        if (hasConnectedBefore) {
          onReconnectRef.current?.();
        }
        hasConnectedBefore = true;
      };

      eventSource.onmessage = (event) => {
        if (!active) return;
        if (event.data === "init" || event.data === "ping" || !event.data) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "cell_update") {
            onCellUpdateRef.current?.(parsed.posicion, parsed.columna, parsed.valor_nuevo, parsed.usuario);
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
