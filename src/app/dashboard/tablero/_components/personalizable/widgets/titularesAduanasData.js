"use client";

import { useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";

// Los dos widgets de titulares de aduanas leen el MISMO endpoint (la rotación
// completa de las aduanas): caché en memoria con TTL para no pedirlo dos veces
// cuando conviven en el tablero. El servidor ya cachea el cálculo pesado.
const TTL_MS = 5 * 60 * 1000;
let cache = null;

function cargar() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const promise = VacantesService.getRotacionTitularesAduanas()
    .then((res) => (res && res.ok ? res.json() : null))
    .catch(() => null)
    .then((json) => {
      if (json === null) cache = null; // no cachear fallos
      return json;
    });
  cache = { t: Date.now(), promise };
  return promise;
}

/** `{ cargando, error, aduanas }` de la rotación de titulares de aduanas. */
export function useTitularesAduanas() {
  const [estado, setEstado] = useState({ cargando: true, error: false, aduanas: [] });
  useEffect(() => {
    let activo = true;
    cargar().then((json) => {
      if (!activo) return;
      setEstado(json ? { cargando: false, error: false, aduanas: json.aduanas || [] } : { cargando: false, error: true, aduanas: [] });
    });
    return () => { activo = false; };
  }, []);
  return estado;
}
