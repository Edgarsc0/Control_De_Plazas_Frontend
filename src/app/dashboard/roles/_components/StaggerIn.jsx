'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(useGSAP);

/**
 * Contenedor cuyos hijos directos entran en cascada al montarse (p. ej. el
 * cuerpo de un Dialog al abrirse). Sólo anima opacity/translate de los hijos,
 * nunca del contenedor, para no romper el posicionamiento del Dialog.
 */
export default function StaggerIn({ className, children, y = 14, stagger = 0.06 }) {
    const ref = useRef(null);

    useGSAP(
        () => {
            if (prefersReducedMotion() || !ref.current) return;
            gsap.from(ref.current.children, {
                opacity: 0,
                y,
                duration: 0.45,
                stagger,
                delay: 0.08,
                ease: 'power2.out',
                clearProps: 'opacity,transform',
            });
        },
        { scope: ref }
    );

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}
