"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Entrada/salida GSAP compartida por VacanciaDetalleModal y
 * OcupacionDetalleModal — reemplaza framer-motion (backdrop + panel + hasta
 * 6 <motion.div> con física de resorte independiente cada uno para las
 * tarjetas de contenido) por dos timelines livianas (opacity/transform).
 * Con varios resortes corriendo a la vez —más el árbol de movimientos
 * (PosicionArbolModal `dock`) abriéndose junto— se sentía trabado al abrir.
 *
 * @param {boolean} open
 * @param {number} [shiftLeftPx] - Ver prop del mismo nombre en los modales.
 * @param {boolean} [contentReady] - true cuando ya hay contenido (no
 *   loading) que animar con stagger; false mientras se ve el spinner.
 */
export function useDetalleModalAnim({ open, shiftLeftPx = 0, contentReady = false }) {
    const [rendered, setRendered] = useState(open);
    const backdropRef = useRef(null);
    const panelRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (open) setRendered(true);
    }, [open]);

    useGSAP(
        () => {
            if (!rendered) return;
            if (open) {
                gsap
                    .timeline()
                    .set(panelRef.current, { opacity: 0, y: 24, scale: 0.96, x: -shiftLeftPx })
                    .set(backdropRef.current, { opacity: 0 })
                    .to(backdropRef.current, { opacity: 1, duration: 0.18 }, 0)
                    .to(panelRef.current, { opacity: 1, y: 0, scale: 1, x: -shiftLeftPx, duration: 0.24, ease: "expo.out" }, 0);
            } else {
                gsap
                    .timeline({ onComplete: () => setRendered(false) })
                    .to(panelRef.current, { opacity: 0, y: 24, scale: 0.96, duration: 0.15, ease: "power2.in" }, 0)
                    .to(backdropRef.current, { opacity: 0, duration: 0.15 }, 0);
            }
        },
        { dependencies: [open, rendered, shiftLeftPx] }
    );

    // Tarjetas de contenido: un solo stagger cuando dejan de estar en loading.
    useGSAP(
        () => {
            if (!open || !contentReady || !contentRef.current) return;
            gsap.fromTo(
                contentRef.current.children,
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: 0.22, ease: "power2.out", stagger: 0.035, clearProps: "opacity,transform" }
            );
        },
        { dependencies: [open, contentReady] }
    );

    return { rendered, backdropRef, panelRef, contentRef };
}
