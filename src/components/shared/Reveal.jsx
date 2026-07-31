"use client";

import { Fade as FadeReveal, Slide as SlideReveal, Zoom as ZoomReveal } from "react-awesome-reveal";

// Wrappers finos sobre react-awesome-reveal (IntersectionObserver + CSS
// keyframes) para mantener la misma API que se usaba antes (GSAP +
// ScrollTrigger). Se cambió porque ScrollTrigger recalculaba mal el punto de
// disparo dentro de contenedores con scroll propio (p.ej. la tabla de
// Cuadros de Vacancia), provocando que el contenido volviera a opacity:0 al
// hacer scroll hacia abajo en vez de quedarse visible.
export function Fade({ direction, duration = 800, delay, triggerOnce = false, className, children }) {
  return (
    <FadeReveal direction={direction} duration={duration} delay={delay} triggerOnce={triggerOnce} className={className}>
      {children}
    </FadeReveal>
  );
}

export function Zoom({ direction, duration = 800, delay, triggerOnce = false, className, children }) {
  return (
    <ZoomReveal direction={direction} duration={duration} delay={delay} triggerOnce={triggerOnce} className={className}>
      {children}
    </ZoomReveal>
  );
}

export function Slide({ direction = "down", duration = 800, delay, triggerOnce = false, className, children }) {
  return (
    <SlideReveal direction={direction} duration={duration} delay={delay} triggerOnce={triggerOnce} className={className}>
      {children}
    </SlideReveal>
  );
}
