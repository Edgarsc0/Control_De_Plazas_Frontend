import { VacantesService } from "@/services/vacantes.service";

const FUENTES = {
  cuadros: () => VacantesService.getCuadroVacancia(),
  desglose: () => VacantesService.getDesgloseJerarquico(),
  ocupados: () => VacantesService.getDesgloseJerarquicoOcupados(),
  serie: () => VacantesService.getConteoPlazasHistoricoSerie(),
};

// Varios widgets de este módulo pueden convivir en el mismo tablero: el
// caché por dataset (con TTL corto) evita repetir el mismo fetch por cada
// uno. El ETL corre cada ~30 min, así que 5 min de frescura es suficiente.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export function cargarFuente(nombre) {
  const hit = cache.get(nombre);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.promise;
  const promise = FUENTES[nombre]()
    .then((res) => (res && res.ok ? res.json() : null))
    .catch(() => null)
    .then((data) => {
      if (data === null) cache.delete(nombre); // no cachear fallos
      return data;
    });
  cache.set(nombre, { t: Date.now(), promise });
  return promise;
}

