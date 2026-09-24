import { VacantesService } from "@/services/vacantes.service";

// Mismos colores/orden que EstatusTab (plantilla_empleados/.../estatus).
export const ESTADOS = [
  { key: "Activo", color: "#621f32" },
  { key: "Vacante", color: "#bc955c" },
  { key: "Suspendido", color: "#3b82f6" },
  { key: "Permiso Retribuido", color: "#10b981" },
  { key: "Permiso", color: "#8b5cf6" },
];

// Códigos crudos A/S/L/P de EmpleadosCompletosSig; vacío u otro = Vacante.
export const mapEstadoNomina = (val) => {
  switch ((val || "").trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Permiso";
    case "P": return "Permiso Retribuido";
    default: return "Vacante";
  }
};

// Los widgets de estatus de nómina comparten el mismo fetch (el ETL corre cada ~30 min).
const TTL_MS = 5 * 60 * 1000;
let cache = null;

export function cargarEstatusNomina() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const promise = VacantesService.getEmpleadosEstatusPorNivelUa()
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el resumen."))))
    .catch((err) => {
      cache = null; // no cachear fallos
      throw err;
    });
  cache = { t: Date.now(), promise };
  return promise;
}
