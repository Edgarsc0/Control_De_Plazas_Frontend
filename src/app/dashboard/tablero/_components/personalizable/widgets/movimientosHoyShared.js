"use client";

import { useEffect, useMemo, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { useZafiroUpdates } from "@/context/ZafiroUpdatesContext";

// Misma paleta que el modal "Movimientos realizados hoy" de Plantilla Detalle.
export const HOY_COLORS = [
  "#621f32", "#bc955c", "#8d2c48", "#d4a96a", "#4a1625",
  "#e8c280", "#3d1020", "#a07040", "#7a2038", "#f0d090",
  "#2d0a18", "#c8a050", "#b06040", "#6a1828", "#dbb870",
];

export const fmtNum = (n) => Number(n || 0).toLocaleString("es-MX");

export const nombreCompleto = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(" ").trim();

const pad = (n) => String(n).padStart(2, "0");
export const fechaDeHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * El resumen agregado de movimientos de hoy (todas las UN) solo se ofrece a
 * quien no tiene alcance por Unidad de Negocio — mismo criterio que
 * `sinRestriccionUN` en PlantillaDetalleTab.
 */
export function useSinRestriccionUN() {
  const { isLoading, unScope } = useAuth();
  return { cargando: isLoading, permitido: !isLoading && unScope === null };
}

/** Convierte [{<nameKey>, total}] en porciones con color y porcentaje. */
export function armarPorciones(lista, nameKey) {
  const total = lista.reduce((s, d) => s + (d.total || 0), 0);
  const items = lista
    .filter((d) => d.total > 0)
    .map((d, i) => ({
      name: d[nameKey] || "Sin dato",
      value: d.total,
      color: HOY_COLORS[i % HOY_COLORS.length],
      pct: total ? Math.round((d.total / total) * 1000) / 10 : 0,
    }));
  return { items, total };
}

/**
 * Stats de movimientos capturados hoy por acción y, si hay `accion`, por
 * motivo de esa acción. Se refresca cuando Celery termina el swap de datos
 * (evento SSE "zafiro_updates"), igual que el badge de Plantilla Detalle.
 */
export function useMovimientosHoyStats(accion, habilitado = true) {
  const fechaHoy = useMemo(fechaDeHoy, []);
  const { subscribe } = useZafiroUpdates();
  const [tick, setTick] = useState(0);
  const [acciones, setAcciones] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [cargandoAcciones, setCargandoAcciones] = useState(true);
  const [cargandoMotivos, setCargandoMotivos] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => subscribe(() => setTick((t) => t + 1)), [subscribe]);

  useEffect(() => {
    if (!habilitado) return undefined;
    let active = true;
    VacantesService.getMovimientosPersonalStats({ fecha_captura__in: fechaHoy })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar los movimientos de hoy."))))
      .then((d) => { if (active) { setAcciones(d?.all || []); setError(null); } })
      .catch((err) => { if (active) setError(err.message || "Error al cargar los movimientos de hoy."); })
      .finally(() => { if (active) setCargandoAcciones(false); });
    return () => { active = false; };
  }, [fechaHoy, tick, habilitado]);

  useEffect(() => {
    if (!habilitado || !accion) { setMotivos([]); return undefined; }
    let active = true;
    setCargandoMotivos(true);
    VacantesService.getMovimientosPersonalStats({ fecha_captura__in: fechaHoy, accion_nombre: accion })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar los motivos."))))
      .then((d) => { if (active) setMotivos(d?.all || []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar los motivos."); })
      .finally(() => { if (active) setCargandoMotivos(false); });
    return () => { active = false; };
  }, [fechaHoy, accion, tick, habilitado]);

  const porAccion = useMemo(() => armarPorciones(acciones, "accion_nombre"), [acciones]);
  const porMotivo = useMemo(() => armarPorciones(motivos, "motivo_nombre"), [motivos]);
  return { fechaHoy, porAccion, porMotivo, cargandoAcciones, cargandoMotivos, error };
}
