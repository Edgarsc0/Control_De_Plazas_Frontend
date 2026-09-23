// Las animaciones GSAP de /roles se omiten con prefers-reduced-motion: el
// contenido queda en su estado final, sin transiciones.
export function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
}
