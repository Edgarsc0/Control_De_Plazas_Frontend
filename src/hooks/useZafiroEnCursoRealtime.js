"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

/**
 * Progreso en tiempo real de la corrida de ZAFIRO en curso (status RUNNING),
 * por SSE — reemplaza el polling de 2-2.5s a /plantilla/bitacora/en-curso/
 * que hacían ZafiroCorridaActualWidget.jsx y monitoreo_zafiro/ClientComponent.jsx
 * (duplicado entre ambos, ~74 requests/corrida en vez de ~74 mensajes push).
 * Backend: plantilla.views.ZafiroEnCursoSSEView, publicado desde
 * tasks.importar_zafiro en cada línea de log (ver _publicar_progreso_zafiro).
 *
 * Devuelve el ÚLTIMO snapshot recibido — mismo shape que el endpoint REST
 * que reemplaza (id, fecha_ejecucion, duracion_segundos, registros_*,
 * status, error_message, es_historico, logs_en_vivo). `null` si nunca ha
 * habido una corrida RUNNING desde que se conectó este stream (al conectar,
 * el backend manda de inmediato el estado actual, por si ya hay una corrida
 * en curso). El ÚLTIMO mensaje de una corrida ya trae el registro final
 * completo (EXITO/ERROR), así que no hace falta un refetch aparte al
 * terminar.
 */
export function useZafiroEnCursoRealtime() {
  const { hasPermission } = useAuth();
  const [log, setLog] = useState(null);

  useEffect(() => {
    if (!hasPermission(PERMISSIONS.VIEW_MONITOREO_ZAFIRO)) return;

    // Puerto/origen aparte del resto de la API (ver comentario equivalente en
    // ZafiroUpdatesContext/useCeldaUpdatesRealtime) — evita compartir el
    // límite de 6 conexiones por origen de HTTP/1.1 con los fetches normales.
    const sseBaseUrl = process.env.NEXT_PUBLIC_SSE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = Cookies.get("auth_token");
    if (!token) return;

    const sseUrl = `${sseBaseUrl}/api/plantilla/bitacora/en-curso/sse/?token=${encodeURIComponent(token)}`;

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
        if (!active || !event.data) return;
        try {
          setLog(JSON.parse(event.data));
        } catch {
          // mensaje no-JSON inesperado (no debería pasar: "ping" va como
          // comentario SSE ": ping\n\n", nunca llega aquí): se ignora.
        }
      };

      eventSource.onerror = (err) => {
        eventSource?.close();
        if (!active) return;
        console.warn(`SSE de corrida en curso de ZAFIRO desconectado, reintentando en ${retryDelay / 1000}s...`, err);
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

  return log;
}
