"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useTourSeen } from "./useTourSeen";

gsap.registerPlugin(useGSAP);

const SPOTLIGHT_PADDING = 10;
const LOCATE_RETRY_MS = 80;
const LOCATE_TIMEOUT_MS = 4000;
const TOOLTIP_WIDTH = 320;

/**
 * Tour guiado genérico y reutilizable: oscurece toda la pantalla y recorta un
 * "reflector" sobre el elemento del paso actual (`data-tour="<selector>"`),
 * con un borde dorado continuo y un brillo pulsante (loop infinito con GSAP,
 * para que el elemento resalte sin importar el color de fondo detrás) y un tooltip
 * (título + texto + Siguiente/Omitir) al lado. Se muestra una sola vez por
 * navegador (via `useTourSeen`, bajo `tourId`) y nunca reaparece tras
 * "Omitir" ni tras completarlo. Para una funcionalidad nueva, se sube el
 * sufijo de versión en `tourId` (ej. "-v2") — no se reutiliza el mismo id.
 *
 * Cada `step` puede traer `onEnter()` para disparar el efecto necesario para
 * que su elemento exista (ej. abrir el modal que se va a señalar); si el
 * elemento no aparece en `LOCATE_TIMEOUT_MS`, el paso se muestra igual con un
 * tooltip centrado y overlay completo (sin reflector), en vez de trabarse.
 *
 * @param {string} tourId - Id único y estable del tour.
 * @param {Array<{id:string, selector:string, title:string, body:string, onEnter?:Function}>} steps
 * @param {boolean} [enabled=true] - Compuerta externa: permisos Y "es éste el tab
 *   activo ahora mismo" (ej. `canViewX && activeTab === "detalle"`). Al pasar a
 *   `false` el tour se oculta y reinicia su paso sin marcarse como visto —
 *   solo "Omitir"/"Entendido" lo marcan visto para siempre.
 * @param {Function} [onFinish] - Se llama al completar el último paso.
 * @param {Function} [onSkip] - Se llama al presionar "Omitir".
 */
export default function ProductTour({ tourId, steps, enabled = true, onFinish, onSkip }) {
  const [seen, markSeen] = useTourSeen(tourId);
  const [mounted, setMounted] = useState(false);
  // `visible` se queda en true durante la animación de salida, aunque `seen`
  // ya haya cambiado — así "Omitir"/"Entendido" alcanzan a hacer fade-out en
  // vez de desaparecer de golpe.
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const locateTimerRef = useRef(null);
  const rootRef = useRef(null);
  const overlayRef = useRef(null);
  const spotlightRef = useRef(null);
  const glowRef = useRef(null);
  const tooltipRef = useRef(null);
  const prevStepIdRef = useRef(null);
  // true mientras corre el fade-out propio de "Omitir"/"Entendido" (`dismiss`);
  // evita que el efecto de abajo lo interrumpa apagando `visible` de golpe.
  const dismissingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const eligible = mounted && enabled && !seen && steps.length > 0;
  // `enabled` normalmente incluye "¿es éste el tab activo?" (ver caller): al
  // cambiar de tab el tour debe ocultarse de inmediato (el portal vive en
  // document.body, fuera del wrapper `hidden` del tab, así que no basta con
  // CSS) y reiniciar su progreso — no se marca "visto", solo se pausa.
  useEffect(() => {
    if (eligible) {
      setVisible(true);
    } else if (!dismissingRef.current) {
      setVisible(false);
      setStepIndex(0);
      setRect(null);
    }
  }, [eligible]);

  const step = visible ? steps[stepIndex] : null;
  const stepId = step?.id;

  // Localiza el elemento del paso (con reintentos: a veces lo abre `onEnter`, ej. un modal).
  useEffect(() => {
    if (!stepId) return undefined;
    setRect(null);
    const current = steps.find((s) => s.id === stepId);
    current?.onEnter?.();

    const start = Date.now();
    clearInterval(locateTimerRef.current);
    locateTimerRef.current = setInterval(() => {
      const el = document.querySelector(current.selector);
      if (el) {
        clearInterval(locateTimerRef.current);
        setRect(el.getBoundingClientRect());
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (Date.now() - start > LOCATE_TIMEOUT_MS) {
        clearInterval(locateTimerRef.current);
      }
    }, LOCATE_RETRY_MS);
    return () => clearInterval(locateTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  // Recalcula la posición si la ventana cambia de tamaño o hace scroll.
  useEffect(() => {
    if (!visible || !rect || !stepId) return undefined;
    const recalc = () => {
      const current = steps.find((s) => s.id === stepId);
      const el = current && document.querySelector(current.selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, !!rect, stepId]);

  const padded = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Entrada del tour (primera aparición): scrim + tooltip con fade/scale.
  useGSAP(() => {
    if (!visible || !tooltipRef.current) return;
    if (overlayRef.current) gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" });
    gsap.fromTo(tooltipRef.current, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.6)" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { dependencies: [visible], scope: rootRef });

  // Cambio de paso: crossfade suave del tooltip hacia su nuevo contenido/posición.
  useGSAP(() => {
    if (!visible || !tooltipRef.current) return;
    if (prevStepIdRef.current !== null && prevStepIdRef.current !== stepId) {
      gsap.fromTo(tooltipRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    }
    prevStepIdRef.current = stepId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { dependencies: [stepId], scope: rootRef });

  // Aparición/reposicionamiento del reflector. IMPORTANTE: `spotlightRef` es el
  // que lleva el box-shadow de 9999px que oscurece toda la pantalla — nunca se
  // le anima `transform`/`scale` (Chrome recorta ese spread gigante cuando el
  // elemento tiene un transform activo, y el oscurecido se rompe). El pop-in
  // va solo en `opacity`; el tween de posición es top/left/width/height (layout,
  // no transform), así que es seguro.
  useGSAP(() => {
    if (!padded || !spotlightRef.current) return;
    gsap.fromTo(spotlightRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
    gsap.to(spotlightRef.current, {
      top: padded.top, left: padded.left, width: padded.width, height: padded.height,
      duration: 0.5, ease: "power3.out",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { dependencies: [stepId, padded?.top, padded?.left, padded?.width, padded?.height], scope: rootRef });

  // Borde dorado continuo con brillo pulsante (glow "respirando"), en un div
  // hijo aparte del reflector — libre de animar sin afectar el oscurecido.
  useGSAP(() => {
    if (!padded || !glowRef.current) return undefined;
    const state = { blur: 3, alpha: 0.35 };
    const tween = gsap.to(state, {
      blur: 14,
      alpha: 0.95,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      onUpdate: () => {
        if (glowRef.current) {
          glowRef.current.style.boxShadow = `0 0 ${state.blur}px ${state.blur / 2.5}px rgba(188,149,92,${state.alpha}), inset 0 0 ${state.blur / 2}px rgba(245,223,184,${state.alpha * 0.6})`;
        }
      },
    });
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { dependencies: [!!padded, stepId], scope: rootRef });

  if (!visible || typeof document === "undefined") return null;

  const isLast = stepIndex === steps.length - 1;

  const dismiss = (after) => {
    dismissingRef.current = true;
    const targets = [tooltipRef.current, overlayRef.current, spotlightRef.current].filter(Boolean);
    if (targets.length === 0) {
      setVisible(false);
      after();
      return;
    }
    gsap.to(targets, {
      opacity: 0,
      duration: 0.22,
      ease: "power2.in",
      onComplete: () => {
        setVisible(false);
        after();
      },
    });
  };

  const handleNext = () => {
    if (isLast) {
      dismiss(() => {
        markSeen();
        onFinish?.();
      });
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    dismiss(() => {
      markSeen();
      onSkip?.();
    });
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipTop = padded
    ? Math.min(Math.max(padded.top + padded.height + 14, 16), vh - 220)
    : vh / 2 - 90;
  const tooltipLeft = padded
    ? Math.min(Math.max(padded.left, 16), vw - TOOLTIP_WIDTH - 16)
    : vw / 2 - TOOLTIP_WIDTH / 2;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true" aria-label={step?.title}>
      {padded ? (
        <div
          ref={spotlightRef}
          className="fixed rounded-2xl pointer-events-none"
          style={{
            top: padded.top,
            left: padded.left,
            width: padded.width,
            height: padded.height,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.72)",
          }}
        >
          {/* Borde dorado continuo (no depende del fondo del elemento señalado); el
              glow (box-shadow) lo anima el useGSAP de arriba frame a frame. */}
          <div
            ref={glowRef}
            className="absolute inset-0 rounded-[inherit] border-2 border-[#bc955c] pointer-events-none"
          />
        </div>
      ) : (
        <div ref={overlayRef} className="fixed inset-0 bg-slate-900/72" />
      )}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH, maxWidth: "calc(100vw - 32px)" }}
      >
        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1.5">{step.title}</h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{step.body}</p>
        <div className="flex items-center justify-between gap-3">
          <button onClick={handleSkip} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            Omitir
          </button>
          <div className="flex items-center gap-3">
            {steps.length > 1 && (
              <span className="text-[10px] text-slate-400 font-bold tabular-nums">{stepIndex + 1}/{steps.length}</span>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {isLast ? "Entendido" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
