"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS as P } from "@/config/permissions";
import { cargarFuente } from "./cuadrosFuentes";

// Mismas familias (y misma regla) que LEVELS_ORDER en DetalleVacantesTablas:
// la letra inicial del nivel, y "OPERATIVOS" para los niveles numéricos.
const familiaDe = (nivel) => {
  const n = String(nivel || "").trim().toUpperCase();
  if (!n) return null;
  return /^\d/.test(n) ? "OPERATIVOS" : n[0];
};

const PERMISOS_FUENTE = [
  P.VIEW_PLANTILLA_DETALLE,
  P.VIEW_PLANTILLA_MOV_POSICIONES_CUADROS,
  P.VIEW_PLANTILLA_MOV_POSICIONES_ADUANAS,
];

/**
 * Familias de nivel (J, K, A, S, D, P, OPERATIVOS) que existen en la plantilla
 * que ve el usuario, para no ofrecerle "Vacancia y Ocupación — Nivel J" si en
 * su unidad no hay ninguna plaza J (ver `familiaNivel` en widgetRegistry).
 *
 * Solo se calcula para roles con alcance por unidad: sus datasets son chicos y
 * ya llegan recortados del backend. Para un rol sin restricción devuelve
 * `null` ("no filtrar") sin pedir nada — ve la plantilla completa, que tiene
 * todas las familias. También es `null` mientras carga o si la consulta falla.
 *
 * @returns {Set<string>|null}
 */
export function useFamiliasNivel() {
  const { hasAnyPermission, unScope, isLoading } = useAuth();
  const [familias, setFamilias] = useState(null);
  const aplica = !isLoading && unScope !== null && hasAnyPermission(PERMISOS_FUENTE);

  useEffect(() => {
    if (!aplica) { setFamilias(null); return undefined; }
    let vivo = true;
    Promise.all([cargarFuente("desglose"), cargarFuente("ocupados")]).then(([vac, ocup]) => {
      if (!vivo || !Array.isArray(vac) || !Array.isArray(ocup)) return;
      const set = new Set();
      for (const fila of vac) { const f = familiaDe(fila.Nivel); if (f) set.add(f); }
      for (const fila of ocup) { const f = familiaDe(fila.Nivel); if (f) set.add(f); }
      setFamilias(set);
    });
    return () => { vivo = false; };
  }, [aplica]);

  return familias;
}
