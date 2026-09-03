"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

// SSE dedicado a cambios de AnuenciaAnexo (sub-tab "Anuencia" de Mov.
// Posiciones) — el Anexo 2 es colaborativo: alguien puede agregarle plazas
// desde el menú contextual de la tabla de Mov. Posiciones (ver
// AgregarAAnexo2Modal.jsx) mientras otra persona lo tiene abierto en
// AnuenciaTab.jsx en otra pestaña/sesión. Sin este aviso, esa segunda
// pestaña nunca se entera hasta recargar la página a mano (ver backend
// plantilla.views.AnuenciaAnexoUpdatesSSEView /
// _notificar_actualizacion_anuencia_anexo). Mismo patrón exacto que
// useCeldaUpdatesRealtime.js — independiente de ese y del de ZAFIRO.
export function useAnuenciaAnexoUpdatesRealtime(onAnexoUpdate) {
  const { hasPermission } = useAuth();
  const onAnexoUpdateRef = useRef(onAnexoUpdate);
  onAnexoUpdateRef.current = onAnexoUpdate;

  useEffect(() => {
    if (!hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES)) return;

    const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = Cookies.get("auth_token");
    if (!token) return;

    const sseUrl = `${sseBaseUrl}/api/plantilla/anuencia/anexos/updates/sse/?token=${encodeURIComponent(token)}`;

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
          if (parsed?.type === "anexo_update" && parsed.anexo_id != null) {
            onAnexoUpdateRef.current?.(parsed.anexo_id, parsed.usuario_nombre);
          }
        } catch {
          // mensaje no-JSON inesperado: se ignora, no es de este canal
        }
      };

      eventSource.onerror = (err) => {
        eventSource?.close();
        if (!active) return;
        console.warn(`SSE de anuencia-anexo-updates desconectado, reintentando en ${retryDelay / 1000}s...`, err);
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
