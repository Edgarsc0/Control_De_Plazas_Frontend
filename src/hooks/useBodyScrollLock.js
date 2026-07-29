"use client";

import { useEffect } from "react";

// Contador global: si hay varios modals apilados, el body solo se
// desbloquea cuando se cierra el último.
let lockCount = 0;
let saved = null;

function lockBody() {
  if (lockCount === 0) {
    const html = document.documentElement;
    const body = document.body;
    // El scroll real de la página ocurre en <html> (layout.js le pone
    // `h-full`, así que `body` con `min-h-full` nunca es el scrolling
    // element) — bloquear solo `body.overflow` no detiene la rueda del
    // mouse ni el touch fuera del modal. Hay que lockear ambos.
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    saved = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPaddingRight = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
  }
  lockCount += 1;
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && saved) {
    document.documentElement.style.overflow = saved.htmlOverflow;
    document.body.style.overflow = saved.bodyOverflow;
    document.body.style.paddingRight = saved.bodyPaddingRight;
    saved = null;
  }
}

/**
 * Bloquea el scroll de la página (html + body) mientras `open` sea true, para
 * que el scroll (wheel/touch/teclado) quede confinado al modal en vez de
 * propagarse al fondo. Soporta modals anidados vía contador compartido.
 */
export function useBodyScrollLock(open) {
  useEffect(() => {
    if (!open) return;
    lockBody();
    return () => unlockBody();
  }, [open]);
}
