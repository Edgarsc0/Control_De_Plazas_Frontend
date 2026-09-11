"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductTour from "./ProductTour";
import { isTourSeenSync } from "./useTourSeen";

/**
 * Agrupa varios `ProductTour` dentro de un mismo tab: monta solo UNO a la vez
 * (el de `activeIndex` entre los que aún no se han visto) y agrega un
 * navegador flotante centrado abajo ("< 2/3 >") para saltar libremente entre
 * los tours pendientes de ese tab, sin tener que terminarlos/omitirlos en
 * orden. Terminar o hacer "Omitir" en un tour lo marca visto para siempre
 * (via `localStorage`, ver `useTourSeen`) y el siguiente pendiente ocupa su
 * lugar automáticamente.
 *
 * Para agregar un tour nuevo a un tab: agregar una entrada más al arreglo
 * `tours` que se le pasa — nada más cambia.
 *
 * @param {Array<{tourId:string, steps:Array, enabled?:boolean}>} tours
 */
export default function TourGroup({ tours }) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => setMounted(true), []);

  const pendingTours = useMemo(() => {
    if (!mounted) return [];
    return tours.filter((t) => t.enabled !== false && !isTourSeenSync(t.tourId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tours, revision]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(pendingTours.length - 1, 0)));
  }, [pendingTours.length]);

  if (pendingTours.length === 0) return null;

  const activeTour = pendingTours[Math.min(activeIndex, pendingTours.length - 1)];
  const advanceAfterDismiss = () => setRevision((r) => r + 1);

  return (
    <>
      <ProductTour
        key={activeTour.tourId}
        tourId={activeTour.tourId}
        steps={activeTour.steps}
        enabled={activeTour.enabled}
        onFinish={advanceAfterDismiss}
        onSkip={advanceAfterDismiss}
      />
      {pendingTours.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          // Portal a `document.body`: si este control viviera en el árbol normal de
          // PlantillaDetalleTab, cualquier ancestro con `transform`/`filter` (motion,
          // backdrop-blur, etc.) lo atrapa como "fixed" relativo a ESE ancestro en vez
          // del viewport, y queda por detrás del overlay del tour (que sí es portal).
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 shadow-[0_8px_30px_rgba(15,23,42,0.35)] ring-2 ring-[#bc955c]/70 px-2.5 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.max(i - 1, 0))}
              disabled={activeIndex === 0}
              title="Tour anterior"
              className="flex items-center justify-center size-8 rounded-full text-[#621f32] dark:text-[#bc955c] hover:bg-[#621f32]/10 dark:hover:bg-[#bc955c]/15 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <span className="px-2.5 py-1 rounded-full bg-[#621f32]/8 dark:bg-[#bc955c]/15 text-[12px] font-black tabular-nums text-[#621f32] dark:text-[#f0d9b8] uppercase tracking-wide">
              Tour {activeIndex + 1}/{pendingTours.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.min(i + 1, pendingTours.length - 1))}
              disabled={activeIndex === pendingTours.length - 1}
              title="Tour siguiente"
              className="flex items-center justify-center size-8 rounded-full text-[#621f32] dark:text-[#bc955c] hover:bg-[#621f32]/10 dark:hover:bg-[#bc955c]/15 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
