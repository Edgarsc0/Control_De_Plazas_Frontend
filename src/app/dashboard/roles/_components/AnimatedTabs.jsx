'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(useGSAP);

/**
 * Tabs tipo segmented control con "píldora" deslizante (GSAP) que se mueve y
 * ajusta su ancho hacia la pestaña activa.
 */
export default function AnimatedTabs({ tabs, active, onChange }) {
    const rootRef = useRef(null);
    const indicatorRef = useRef(null);
    const firstRun = useRef(true);
    const countsKey = tabs.map((t) => t.count).join('-');

    const measure = () => {
        const btn = rootRef.current?.querySelector(`[data-tab="${active}"]`);
        return btn ? { x: btn.offsetLeft, width: btn.offsetWidth } : null;
    };

    useGSAP(
        () => {
            const vars = measure();
            if (!vars || !indicatorRef.current) return;
            if (firstRun.current || prefersReducedMotion()) {
                gsap.set(indicatorRef.current, vars);
                firstRun.current = false;
                return;
            }
            gsap.to(indicatorRef.current, { ...vars, duration: 0.5, ease: 'power3.out' });
            const icon = rootRef.current.querySelector(`[data-tab="${active}"] svg`);
            if (icon) {
                gsap.fromTo(
                    icon,
                    { rotate: -25, scale: 0.6 },
                    { rotate: 0, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }
                );
            }
        },
        { scope: rootRef, dependencies: [active, countsKey], revertOnUpdate: false }
    );

    // Reposiciona la píldora si el layout cambia (resize, fuente, badges).
    useEffect(() => {
        const root = rootRef.current;
        if (!root || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => {
            const vars = measure();
            if (vars && indicatorRef.current) gsap.set(indicatorRef.current, vars);
        });
        observer.observe(root);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return (
        <div
            ref={rootRef}
            role="tablist"
            className="relative inline-flex items-center gap-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 p-1 ring-1 ring-slate-200/70 dark:ring-slate-700/50"
        >
            <span
                ref={indicatorRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-1 bottom-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm shadow-slate-900/10 ring-1 ring-slate-200/80 dark:ring-slate-700"
            />
            {tabs.map(({ id, label, icon: Icon, count }) => {
                const isActive = active === id;
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        data-tab={id}
                        onClick={() => onChange(id)}
                        className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                            isActive
                                ? 'text-[#621f32] dark:text-[#bc955c]'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Icon className="size-4" /> {label}
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                                isActive
                                    ? 'bg-[#621f32]/10 text-[#621f32] dark:bg-[#bc955c]/15 dark:text-[#bc955c]'
                                    : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-400'
                            }`}
                        >
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
