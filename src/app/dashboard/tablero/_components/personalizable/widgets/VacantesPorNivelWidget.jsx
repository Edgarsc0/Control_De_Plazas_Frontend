"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { VacantesPorNivelResumen } from "@/components/ui/BentoContent";

/**
 * Wrapper delgado para el tablero personalizable: `VacantesPorNivelResumen`
 * (BentoContent.jsx) recibía su prop `resumenVacantes` de un fetch
 * centralizado en dashboard/page.jsx — aquí se le da su propio fetch
 * independiente (mismo endpoint) para poder vivir sola en la cuadrícula.
 */
export default function VacantesPorNivelWidget() {
  const [resumenVacantes, setResumenVacantes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    VacantesService.getVacantesPorNivelResumen()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el resumen de vacantes."))))
      .then((data) => { if (active) setResumenVacantes(data); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el resumen de vacantes."); })
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
      <VacantesPorNivelResumen resumenVacantes={resumenVacantes} />
    </div>
  );
}
