"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { PlantillaEmpleados } from "@/components/ui/BentoContent";

/**
 * Wrapper delgado: ver VacantesPorNivelWidget.jsx (mismo patrón). Este
 * widget usa el mismo endpoint que ya llama dashboard/page.jsx para la
 * tarjeta "Plantilla de Empleados" del dashboard normal.
 */
export default function PlantillaEmpleadosWidget() {
  const [resumenEmpleados, setResumenEmpleados] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    VacantesService.getEmpleadosCompletosEstatusResumen()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el resumen de plantilla."))))
      .then((data) => { if (active) setResumenEmpleados(data); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el resumen de plantilla."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 text-center">
        <p className="text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-3">
      <PlantillaEmpleados resumenEmpleados={resumenEmpleados} />
    </div>
  );
}
