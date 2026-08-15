'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { RumService } from '@/services/rum.service';

/**
 * Reporta Web Vitals reales (TTFB/FCP/LCP/INP/CLS) de cada carga de página —
 * Fase 3 del plan de medición de performance (ver también PresenceHeartbeat,
 * mismo patrón de telemetría fire-and-forget). Montado en el layout raíz para
 * cubrir /login también, no solo el dashboard autenticado.
 */
export default function WebVitalsReporter() {
    const pathname = usePathname();
    // Ref actualizado en cada render (no en un efecto): las métricas de
    // Web Vitals (sobre todo INP, que dispara con interacciones tardías)
    // pueden llegar después de que el usuario ya navegó — el ref evita
    // reportar la ruta vieja capturada por closure en el registro inicial.
    const pathRef = useRef(pathname);
    pathRef.current = pathname;

    useReportWebVitals((metric) => {
        RumService.report({
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            path: pathRef.current,
        }).catch(() => {});
    });

    return null;
}
