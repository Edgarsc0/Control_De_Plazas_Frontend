"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ControlGestionService } from "@/services/control_gestion.service";
import { OficiosTurnadosDO } from "@/components/ui/BentoContent";

/**
 * Wrapper delgado: ver VacantesPorNivelWidget.jsx (mismo patrón). Mismos
 * parámetros por defecto que ya usa dashboard/page.jsx (definidos dentro del
 * propio ControlGestionService.getOficiosTurnados) — solo se pide
 * `skipCatalogCross` para evitar el cruce extra de catálogos que ese fetch
 * centralizado sí hacía para otras tarjetas del dashboard normal.
 */
export default function OficiosTurnadosWidget() {
  const [oficiosTurnados, setOficiosTurnados] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    ControlGestionService.getOficiosTurnados({ skipCatalogCross: true })
      .then((data) => { if (active) setOficiosTurnados(data); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar oficios turnados."); })
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
      <OficiosTurnadosDO oficiosTurnados={oficiosTurnados} color="#621f32" pendingColor="#bc955c" />
    </div>
  );
}
