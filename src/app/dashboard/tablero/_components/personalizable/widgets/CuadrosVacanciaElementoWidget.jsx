"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import CuadrosVacanciaTab from "@/app/dashboard/plantilla_empleados/_components/tabs/cuadros-vacancia/CuadrosVacanciaTab";
import DesgloseJerarquicoCharts from "@/app/dashboard/plantilla_empleados/_components/tabs/cuadros-vacancia/DesgloseJerarquicoCharts";
import DetalleVacantesTablas from "@/app/dashboard/plantilla_empleados/_components/tabs/cuadros-vacancia/DetalleVacantesTablas";
import { ELEMENTOS_CUADROS_VACANCIA } from "./cuadrosVacanciaElementos";

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

function cargarFuente(nombre) {
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

function useFuentes(needs) {
  const [datos, setDatos] = useState(null);
  const clave = needs.join(",");
  useEffect(() => {
    let active = true;
    Promise.all(needs.map(cargarFuente)).then((res) => {
      if (!active) return;
      setDatos(Object.fromEntries(needs.map((n, i) => [n, res[i] || []])));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return datos;
}

/**
 * Renderiza UN solo elemento de "Cuadros de Vacancia" (una gráfica o una
 * tabla) reutilizando los mismos componentes de plantilla_empleados vía su
 * prop `only`. Ver cuadrosVacanciaElementos.js para el catálogo.
 */
export default function CuadrosVacanciaElementoWidget({ elementoId }) {
  const elemento = ELEMENTOS_CUADROS_VACANCIA.find((e) => e.id === elementoId);
  const datos = useFuentes(elemento?.needs || []);

  if (!elemento) return null;
  if (!datos) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  return (
    <div className={`w-full h-full p-2 ${elemento.origen === "tab" || elemento.id.startsWith("nivel_") ? "overflow-hidden" : "overflow-auto custom-scrollbar"}`}>
      {elemento.origen === "tab" && (
        <CuadrosVacanciaTab
          only={elemento.id}
          cuadrosData={datos.cuadros || []}
          conteoPlazasSerieData={datos.serie || []}
        />
      )}
      {elemento.origen === "desglose" && (
        <DesgloseJerarquicoCharts only={elemento.id} data={datos.desglose} ocupadosData={datos.ocupados} />
      )}
      {elemento.origen === "detalle" && (
        <DetalleVacantesTablas only={elemento.id} data={datos.desglose} ocupadosData={datos.ocupados} />
      )}
    </div>
  );
}

// Un componente sin props por elemento (el registro los espera así).
export const componentesPorElemento = Object.fromEntries(
  ELEMENTOS_CUADROS_VACANCIA.map((e) => [e.id, function ElementoCuadrosVacancia() {
    return <CuadrosVacanciaElementoWidget elementoId={e.id} />;
  }])
);
