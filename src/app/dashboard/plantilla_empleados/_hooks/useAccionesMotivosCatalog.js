import { useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";

// Cache a nivel de módulo: cat_acciones (23 filas) y cat_acciones_motivos (102
// filas) son catálogos pequeños compartidos por todos los tabs, así que se
// piden una sola vez a la API sin importar cuántos componentes usen el hook.
let cachedAccionesPromise = null;
let cachedMotivosPromise = null;

function fetchCatAcciones() {
  if (!cachedAccionesPromise) {
    cachedAccionesPromise = VacantesService.getCatAcciones()
      .then((res) => res.json())
      .then((data) => {
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach((a) => {
          const key = String(a.action_description || "").trim();
          if (!key) return;
          map.set(key, {
            action: a.action || "",
            descripcion: a.descripcion || "",
          });
        });
        return map;
      })
      .catch((err) => {
        cachedAccionesPromise = null;
        throw err;
      });
  }
  return cachedAccionesPromise;
}

function fetchCatAccionesMotivos() {
  if (!cachedMotivosPromise) {
    cachedMotivosPromise = VacantesService.getCatAccionesMotivos()
      .then((res) => res.json())
      .then((data) => {
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach((m) => {
          const key = String(m.descripcion || "").trim();
          if (!key) return;
          map.set(key, {
            cd_motivo: m.cd_motivo || "",
            descripcion_larga: m.descripcion_larga || "",
          });
        });
        return map;
      })
      .catch((err) => {
        cachedMotivosPromise = null;
        throw err;
      });
  }
  return cachedMotivosPromise;
}

/**
 * Catálogos action_description -> {action, descripcion} (cat_acciones) y
 * descripcion -> {cd_motivo, descripcion_larga} (cat_acciones_motivos).
 * @returns {{accionesCatalog: Map|null, motivosCatalog: Map|null}} null mientras carga
 */
export function useAccionesMotivosCatalog() {
  const [accionesCatalog, setAccionesCatalog] = useState(null);
  const [motivosCatalog, setMotivosCatalog] = useState(null);

  useEffect(() => {
    let active = true;
    fetchCatAcciones()
      .then((map) => { if (active) setAccionesCatalog(map); })
      .catch((err) => console.error("Error loading cat_acciones catalog:", err));
    fetchCatAccionesMotivos()
      .then((map) => { if (active) setMotivosCatalog(map); })
      .catch((err) => console.error("Error loading cat_acciones_motivos catalog:", err));
    return () => { active = false; };
  }, []);

  return { accionesCatalog, motivosCatalog };
}
