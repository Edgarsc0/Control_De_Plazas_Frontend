"use client";

import { useEffect, useState } from "react";
import { Loader2, Globe } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import MapaTab from "@/app/dashboard/plantilla_empleados/_components/tabs/mapa/MapaTab";

// Varios widgets del mismo tablero (o el mismo reagregado) comparten el
// fetch: el ETL corre cada ~30 min, así que 5 minutos de frescura sobran.
const TTL_MS = 5 * 60 * 1000;
let cache = null;

function cargarDistribucion() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const promise = VacantesService.getEmpleadosDistribucionGeografica()
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el mapa."))))
    // Un 403 devuelve un objeto de error, no un arreglo — sin esto el
    // `.map()` de los marcadores rompería el tablero entero.
    .then((data) => (Array.isArray(data) ? data : []))
    .catch((err) => {
      cache = null;
      throw err;
    });
  cache = { t: Date.now(), promise };
  return promise;
}

/**
 * Mapa Nacional como widget del tablero: los mismos marcadores, filtros por
 * tipo de aduana y detalle nominal del punto que el sub-tab de Plantilla de
 * Empleados, en su modo `compacto` (sin el encabezado de página). Al hacer
 * clic en la píldora con el conteo de un punto se abre la tabla de esas
 * personas, con su columna de ojo para el expediente.
 *
 * Los conteos respetan el alcance por Unidad de Negocio del rol: el recorte
 * lo hace EmpleadosDistribucionGeograficaView en el backend.
 */
export default function MapaNacionalWidget() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    cargarDistribucion()
      .then((d) => { if (vivo) setDatos(d); })
      .catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4">
        <Globe className="size-6 text-slate-300 dark:text-slate-700" />
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{error}</p>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#621f32] dark:text-[#bc955c]" />
      </div>
    );
  }

  return <MapaTab distribucionGeografica={datos} compacto />;
}
