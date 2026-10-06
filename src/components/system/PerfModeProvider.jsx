'use client';

import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { gsap } from 'gsap';
import { isPerfMode } from '@/lib/perfMode';

/**
 * Parte en JavaScript del Modo Rendimiento (ver lib/perfMode.js): las
 * animaciones de motion/react pasan a duración cero y las de GSAP que no
 * consultan `prefers-reduced-motion` corren 20 veces más rápido — terminan
 * en su estado final casi al instante, sin dejar nada a medio revelar.
 */
/** true si el Modo Rendimiento está activo (se resuelve tras montar, para no desalinear el SSR). */
export function usePerfMode() {
    const [perf, setPerf] = useState(false);
    useEffect(() => { setPerf(isPerfMode()); }, []);
    return perf;
}

export default function PerfModeProvider({ children }) {
    const [perf] = useState(isPerfMode);

    useEffect(() => {
        if (!perf) return;
        gsap.globalTimeline.timeScale(20);
    }, [perf]);

    if (!perf) return children;
    return (
        <MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
            {children}
        </MotionConfig>
    );
}
