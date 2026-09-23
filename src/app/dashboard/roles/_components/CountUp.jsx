'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(useGSAP);

/**
 * Número que cuenta desde su valor anterior hasta `value`. Escribe en el DOM
 * directamente (sin hijos de React) para no re-renderizar en cada frame; con
 * el polling de presencia sólo se anima el delta.
 */
export default function CountUp({ value, duration = 1.1, className }) {
    const ref = useRef(null);
    const shown = useRef(0);

    useGSAP(
        () => {
            const el = ref.current;
            if (!el) return;
            const format = (n) => Math.round(n).toLocaleString('es-MX');
            if (prefersReducedMotion() || shown.current === value) {
                shown.current = value;
                el.textContent = format(value);
                return;
            }
            const state = { n: shown.current };
            gsap.to(state, {
                n: value,
                duration,
                ease: 'power2.out',
                onUpdate: () => {
                    shown.current = state.n;
                    el.textContent = format(state.n);
                },
                onComplete: () => {
                    shown.current = value;
                    el.textContent = format(value);
                },
            });
        },
        { dependencies: [value], revertOnUpdate: false }
    );

    return <span ref={ref} className={className} />;
}
