"use client";

import { useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { useZafiroUpdates } from "@/context/ZafiroUpdatesContext";
import { getDataset, setDataset } from "@/lib/plantillaBrowserCache";

// Misma clave que usa el tab Plantilla Detalle (DETALLE_CACHE_BASE_KEY en
// plantilla_empleados/ClientComponent.jsx): los buscadores del tablero
// comparten ESE dataset en IndexedDB en vez de bajar uno propio.
const DETALLE_CACHE_BASE_KEY = "plantilla_detalle";
// El servidor renueva su caché cada 30 minutos: se vuelve a pedir con esa cadencia.
const REFRESCO_MS = 30 * 60 * 1000;

// Una sola descarga compartida aunque haya varios widgets montados a la vez.
const enCurso = new Map();
const ultimaDescarga = new Map();

function descargar(clave) {
  if (enCurso.has(clave)) return enCurso.get(clave);
  const promesa = VacantesService.getEmpleadosCompletosActivosDetalle()
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la plantilla."))))
    .then(async (datos) => {
      const filas = Array.isArray(datos) ? datos : [];
      ultimaDescarga.set(clave, Date.now());
      await setDataset(clave, filas);
      return filas;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, promesa);
  return promesa;
}

/**
 * Plantilla Detalle completa (lo que el rol puede ver) para buscar en ella
 * dentro del navegador, sin ir al servidor en cada tecla.
 *
 * Primero entrega la copia de IndexedDB (inmediata, si existe) y en segundo
 * plano trae la versión fresca cuando esa copia tiene más de 30 minutos, cada
 * 30 minutos mientras el widget siga abierto, y cuando ZAFIRO avisa que
 * terminó una importación.
 *
 * @returns {{ filas: object[]|null, cargando: boolean, error: string|null }}
 */
export function usePlantillaDetalleDataset() {
  const { email, unScopeFingerprint, isLoading: authLoading } = useAuth();
  const { subscribe } = useZafiroUpdates();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const clave = email ? `${DETALLE_CACHE_BASE_KEY}::${email}::${unScopeFingerprint ?? "all"}` : null;

  useEffect(() => {
    if (authLoading || !clave) return undefined;
    let activo = true;
    const refrescar = () =>
      descargar(clave)
        .then((d) => { if (activo) { setFilas(d); setError(null); } })
        .catch((err) => { if (activo) setError(err.message || "Error al cargar la plantilla."); });

    (async () => {
      const enCache = await getDataset(clave, { track: false });
      if (!activo) return;
      if (enCache) setFilas(enCache);
      const reciente = Date.now() - (ultimaDescarga.get(clave) || 0) < REFRESCO_MS;
      if (!enCache || !reciente) refrescar();
    })();

    const intervalo = setInterval(refrescar, REFRESCO_MS);
    const desuscribir = subscribe(refrescar);
    return () => { activo = false; clearInterval(intervalo); desuscribir(); };
  }, [authLoading, clave, subscribe]);

  return { filas, cargando: filas === null && !error, error };
}
