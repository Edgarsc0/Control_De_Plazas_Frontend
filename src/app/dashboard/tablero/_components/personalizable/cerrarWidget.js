import { gsap } from "gsap";

/**
 * Salida de un widget al pulsar su ✕: "persiana". La tarjeta se pliega hacia su
 * borde superior hasta quedar como una línea fina y esa línea se encoge y se
 * apaga. Rápida (~0.4 s).
 *
 * `alTerminar` se llama cuando la tarjeta ya es invisible; solo entonces se
 * quita del layout. Con "reducir movimiento" se quita al instante.
 */
export function cerrarWidget(elemento, alTerminar) {
  if (!elemento || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    alTerminar?.();
    return;
  }
  // Sin transiciones CSS ni sombra de más mientras dura la animación, y sin clics.
  elemento.style.pointerEvents = "none";
  gsap.timeline({ onComplete: () => { elemento.style.visibility = "hidden"; alTerminar?.(); } })
    .set(elemento, { transformOrigin: "50% 0%" })
    // 1. Se pliega hacia arriba hasta quedar como una línea.
    .to(elemento, { scaleY: 0.025, duration: 0.26, ease: "power3.in" })
    // 2. La línea se encoge hacia el centro y se apaga.
    .to(elemento, { scaleX: 0, opacity: 0, duration: 0.14, ease: "power2.in" });
}
