import { useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";

// Cache a nivel de módulo: el catálogo de departamentos es el mismo para
// todos los tabs, así que se pide una sola vez a la API sin importar
// cuántos componentes usen el hook.
let cachedCatalogPromise = null;

function fetchOrganigramaCatalog() {
  if (!cachedCatalogPromise) {
    cachedCatalogPromise = VacantesService.getOrganigramaDeptos()
      .then((res) => res.json())
      .then((data) => {
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach((d) => {
          const code = String(d.departamento || "").trim();
          if (!code) return;
          map.set(code, {
            nombre: d.descripcion_larga || "",
            nivel: d.nivel_direccion || "",
          });
        });
        return map;
      })
      .catch((err) => {
        cachedCatalogPromise = null; // permite reintentar en el próximo mount
        throw err;
      });
  }
  return cachedCatalogPromise;
}

/**
 * Catálogo departamento (código) -> { nombre, nivel } desde ORGANIGRAMA_ANAM.
 * @returns {Map<string, {nombre: string, nivel: string}> | null} null mientras carga
 */
export function useOrganigramaCatalog() {
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    let active = true;
    fetchOrganigramaCatalog()
      .then((map) => { if (active) setCatalog(map); })
      .catch((err) => console.error("Error loading organigrama catalog:", err));
    return () => { active = false; };
  }, []);

  return catalog;
}
