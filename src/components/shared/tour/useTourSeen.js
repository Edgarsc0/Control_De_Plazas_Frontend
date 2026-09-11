"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "eje_central_tour_seen_";

/** Lectura síncrona (sin hook) — para filtrar varios `tourId` a la vez, ej. en `TourGroup`. */
export function isTourSeenSync(tourId) {
  if (!tourId || typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + tourId) === "1";
  } catch {
    return true;
  }
}

/** Escritura síncrona (sin hook) — contraparte de `isTourSeenSync`. */
export function markTourSeenSync(tourId) {
  if (!tourId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + tourId, "1");
  } catch {
    // localStorage lleno o deshabilitado (modo privado): no persiste, no rompe la UI.
  }
}

/**
 * Flag "ya visto" por tour, persistido en `localStorage` (una vez por
 * navegador/usuario, para siempre — hasta que se cambie `tourId`). Arranca en
 * `true` (oculto) hasta confirmar en cliente, para no parpadear el overlay
 * durante la hidratación SSR.
 * @param {string} tourId - Id único del tour; cambia si se agrega un paso nuevo y se quiere reaparecer.
 * @returns {[boolean, Function]} `[seen, markSeen]`.
 */
export function useTourSeen(tourId) {
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    setSeen(isTourSeenSync(tourId));
  }, [tourId]);

  const markSeen = () => {
    markTourSeenSync(tourId);
    setSeen(true);
  };

  return [seen, markSeen];
}
