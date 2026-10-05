"use client";

import { useEffect, useState } from "react";
import { PresenceService } from "@/services/presence.service";

const POLL_MS = 15000;

/**
 * Singleton a nivel módulo (no Context/Provider): un solo poll de 15s a
 * /auth/presence/active/ compartido sin importar cuántos componentes lo
 * usen a la vez. Antes, UsuariosActivosWidget.jsx (tablero) y
 * roles/page.jsx (Roles > Usuarios) cada uno tenía su propio setInterval
 * independiente al mismo endpoint — si ambas pantallas estaban montadas
 * simultáneamente (esta app mantiene varias "tabs" vivas en el DOM, ver
 * PageTabsContext), el backend recibía 2 requests idénticos cada 15s en
 * vez de 1.
 */
let activos = null;
const listeners = new Set();
let intervalId = null;
let refCount = 0;

async function poll() {
  try {
    const res = await PresenceService.listActive();
    if (!res.ok) return;
    activos = await res.json();
    listeners.forEach((fn) => fn(activos));
  } catch (err) {
    console.error("Error cargando usuarios activos:", err);
  }
}

function start() {
  if (intervalId) return;
  poll();
  intervalId = setInterval(poll, POLL_MS);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Lista de usuarios activos ahora (mismo shape que GET /auth/presence/active/), o `null` mientras no ha llegado el primer poll. */
export function useUsuariosActivos() {
  const [state, setState] = useState(activos);

  useEffect(() => {
    listeners.add(setState);
    refCount += 1;
    if (activos !== null) setState(activos); // ya hay un valor conocido: no esperar al próximo tick
    start();
    return () => {
      listeners.delete(setState);
      refCount -= 1;
      if (refCount === 0) stop();
    };
  }, []);

  return state;
}
