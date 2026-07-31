"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Desplazamiento de origen por dirección: representa DE DÓNDE entra el
// elemento (p.ej. direction="down" entra desde arriba, bajando hasta su
// posición final), igual que la semántica de react-awesome-reveal.
const DIRECTION_FROM = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: 24 },
  right: { x: -24 },
};

function useReveal({ direction, duration = 800, delay = 0, triggerOnce = false, scaleFrom }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const offset = direction ? DIRECTION_FROM[direction] : {};
      gsap.fromTo(
        ref.current,
        { opacity: 0, ...(scaleFrom ? { scale: scaleFrom } : {}), ...offset },
        {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          duration: duration / 1000,
          delay: delay / 1000,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            once: triggerOnce,
            toggleActions: triggerOnce ? "play none none none" : "play reverse play reverse",
          },
        }
      );
    },
    { scope: ref, dependencies: [direction, duration, delay, triggerOnce, scaleFrom] }
  );

  return ref;
}

// Reemplazos drop-in de react-awesome-reveal (mismas props usadas en el
// proyecto: triggerOnce, direction, duration, delay, className) respaldados
// por GSAP + ScrollTrigger en vez de una dependencia externa.
export function Fade({ direction, duration, delay, triggerOnce = false, className, children }) {
  const ref = useReveal({ direction, duration, delay, triggerOnce });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Zoom({ direction, duration, delay, triggerOnce = false, className, children }) {
  const ref = useReveal({ direction, duration, delay, triggerOnce, scaleFrom: 0.9 });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Slide({ direction = "down", duration, delay, triggerOnce = false, className, children }) {
  const ref = useReveal({ direction, duration, delay, triggerOnce });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
