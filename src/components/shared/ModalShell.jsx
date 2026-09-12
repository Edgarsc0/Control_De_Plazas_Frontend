"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

gsap.registerPlugin(useGSAP);

const SIZE_CLASSES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
};

// Ancho base en px por tamaño (equivalente a los max-w-* de Tailwind) — punto de
// partida cuando el modal es resizable, ya que ahí el ancho se controla inline.
const SIZE_PX = { sm: 448, md: 672, lg: 896, xl: 1152 };

/**
 * Shell único para todos los modals de detalle del sistema (ver
 * eje_central_front/AUDITORIA_MODALS_DETALLE.md). Un solo componente = un solo
 * lugar donde ajustar radio, backdrop, z-index, animación y el patrón mobile
 * (bottom sheet), en vez de implementaciones divergentes por tab.
 */
export default function ModalShell({
  open,
  onClose,
  size = "md",
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  bodyClassName = "p-5 sm:p-7",
  resizable = false,
  minWidth = 520,
  maxWidth = 1600,
  // Por defecto el panel sólo tiene un TECHO de altura (max-h): sin una
  // altura propia, su tamaño real lo determina el contenido, así que un
  // acordeón que agrega/quita secciones (o una tabla que aparece al elegir
  // un filtro) hace que el modal entero crezca y se encoja en cada
  // interacción. `fixedHeight` lo fija siempre a ese mismo techo — el
  // contenido que no quepa hace scroll DENTRO del cuerpo (que ya es
  // `overflow-y-auto`), en vez de estirar el panel.
  fixedHeight = false,
  // "right" pega el panel al borde derecho de OTRO modal centrado ya abierto
  // (no al del viewport) — flota a su lado, mismo centrado vertical, sin el
  // backdrop-click habitual. Pensado para PosicionArbolModal `dock` junto a
  // VacanciaDetalleModal/OcupacionDetalleModal (ambos max-w-lg = 512px,
  // centrados, z-[9999] — por eso este modo usa z-[10000], si no el backdrop
  // blur de ésos lo tapa).
  // "right-edge" es un sidebar de verdad: pegado al borde derecho DEL
  // VIEWPORT, alto completo, con su propio backdrop y animación de entrada/
  // salida deslizando en X (xPercent, no depende de conocer el ancho).
  anchor = "center",
  // Ancho fijo en px, relevante con anchor="right" o "right-edge" (ahí no
  // aplica SIZE_CLASSES/resizable).
  width,
  // Distancia en px desde el CENTRO del viewport hasta el borde izquierdo de
  // este panel, sólo con anchor="right". Default asume que el modal de
  // referencia (max-w-lg = 512px) también se corrió `shiftLeftPx` a la
  // izquierda para centrar el PAR como conjunto (ver VacanciaDetalleModal
  // `shiftLeftPx`): (512 + gap12 - width)/2, con width=440 → 42.
  dockOffset = 42,
  // false = sin overlay propio ni cierre por clic afuera — para el caso
  // "modal acompañante" (anchor="right") que convive sobre otro modal ya
  // con su propio backdrop; evita oscurecer doble y bloquear clics fuera
  // del panel.
  showBackdrop = true,
  // Cuando cambia (con el modal ya abierto) repite la animación de salida +
  // entrada del panel en vez de dejarlo estático — pensado para
  // PosicionArbolModal `sidebar`: clic en OTRA plaza de la tabla mientras el
  // sidebar ya está abierto se siente como "se contrae y vuelve a abrir" en
  // vez de que el contenido cambie de golpe debajo.
  contentKey,
}) {
  const isRight = anchor === "right";
  const isEdge = anchor === "right-edge";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Controla el desmontaje: sigue "rendered" mientras corre la animación de
  // salida; el timeline de exit lo apaga en su onComplete.
  const [rendered, setRendered] = useState(open);
  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  const rootRef = useRef(null);
  const backdropRef = useRef(null);
  const panelRef = useRef(null);

  const getAnimShapes = () => ({
    inFrom: isEdge
      ? { opacity: 0, xPercent: 100 }
      : isRight
      ? { opacity: 0, x: 40 }
      : { opacity: 0, y: 24, scale: 0.98 },
    inTo: isEdge
      ? { opacity: 1, xPercent: 0, duration: 0.32, ease: "power3.out" }
      : isRight
      ? { opacity: 1, x: 0, duration: 0.22, ease: "expo.out" }
      : { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "expo.out" },
    outTo: isEdge
      ? { opacity: 0, xPercent: 100, duration: 0.26, ease: "power2.in" }
      : isRight
      ? { opacity: 0, x: 40, duration: 0.16, ease: "power2.in" }
      : { opacity: 0, y: 24, scale: 0.98, duration: 0.16, ease: "power2.in" },
  });

  useGSAP(
    () => {
      if (!rendered) return;
      const { inFrom, inTo, outTo } = getAnimShapes();
      if (open) {
        const tl = gsap.timeline().set(panelRef.current, inFrom);
        if (backdropRef.current) tl.set(backdropRef.current, { opacity: 0 }).to(backdropRef.current, { opacity: 1, duration: 0.18 }, 0);
        tl.to(panelRef.current, inTo, 0);
      } else {
        const tl = gsap.timeline({ onComplete: () => setRendered(false) }).to(panelRef.current, outTo, 0);
        if (backdropRef.current) tl.to(backdropRef.current, { opacity: 0, duration: 0.16 }, 0);
      }
    },
    { scope: rootRef, dependencies: [open, rendered, isRight, isEdge], revertOnUpdate: true }
  );

  // Repetir la entrada al cambiar de contenido con el panel ya abierto (ver
  // `contentKey` arriba): sale y vuelve a entrar, sin tocar `open`/`rendered`
  // (el padre nunca se entera, no hay onClose de por medio).
  const prevContentKeyRef = useRef(contentKey);
  useEffect(() => {
    const prev = prevContentKeyRef.current;
    prevContentKeyRef.current = contentKey;
    if (contentKey === undefined || prev === undefined || prev === contentKey) return;
    if (!open || !rendered || !panelRef.current) return;
    const { inFrom, inTo, outTo } = getAnimShapes();
    gsap
      .timeline()
      .to(panelRef.current, outTo)
      .set(panelRef.current, inFrom)
      .to(panelRef.current, inTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // isEdge no tiene backdrop propio (para dejar ver la tabla de fondo): el
  // cierre por "clic afuera" se resuelve a mano contra el propio panel.
  useEffect(() => {
    if (!open || !isEdge || showBackdrop) return;
    const onDocPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open, isEdge, showBackdrop, onClose]);

  // Ancho custom solo aplica si resizable; se reinicia al tamaño base cada vez
  // que el modal se abre.
  const [customWidth, setCustomWidth] = useState(null);
  useEffect(() => {
    if (open) setCustomWidth(null);
  }, [open]);

  const handleResizeStart = (e, side) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = customWidth ?? maxWidth ?? SIZE_PX[size] ?? 672;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // El panel está centrado (flex justify-center): mover un solo borde en
      // `deltaX` px requiere crecer el ancho el doble, si no el borde arrastrado
      // sigue al cursor a mitad de velocidad.
      const factor = side === "right" ? 1 : -1;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + factor * 2 * deltaX));
      setCustomWidth(newWidth);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!mounted || !rendered) return null;

  return createPortal(
    <div
      ref={rootRef}
      className={
        isRight
          ? `fixed inset-0 z-[10000] ${showBackdrop ? "" : "pointer-events-none"}`
          : isEdge
          ? // top-16/md:top-36 + overflow-hidden: recorta TODO lo del sidebar
            // (panel + su boxShadow) por debajo del Navbar, para que la sombra
            // no sangre hacia arriba encima de la barra (mismo z-40).
            `fixed inset-x-0 top-16 md:top-36 bottom-0 z-40 overflow-hidden ${showBackdrop ? "" : "pointer-events-none"}`
          : "fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-6"
      }
    >
      {showBackdrop && (
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={
          isRight
            ? `absolute flex flex-col bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden pointer-events-auto`
            : isEdge
            ? // absolute dentro del root ya recortado (top-16/md:top-36):
              // ocupa todo ese alto, pegado al borde derecho. Sin bordes
              // redondeados — es un panel a ras del viewport, no una tarjeta.
              `absolute inset-y-0 right-0 flex flex-col bg-white dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-800 overflow-hidden pointer-events-auto`
            : `relative w-full ${!resizable ? SIZE_CLASSES[size] : ""} ${fixedHeight ? "h-[92vh] sm:h-[85vh]" : "max-h-[92vh] sm:max-h-[85vh]"} flex flex-col bg-white dark:bg-slate-950 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden`
        }
        style={
          isRight
            ? {
                top: "50%",
                left: `calc(50% + ${dockOffset}px)`,
                marginTop: "-42.5vh",
                width: width ?? 420,
                maxWidth: "92vw",
                height: "85vh",
                maxHeight: "85vh",
              }
            : isEdge
            ? {
                width: width ?? 480,
                maxWidth: "100vw",
                // Sombra concentrada en el borde izquierdo (no ambient shadow-2xl
                // simétrica) — refuerza que el panel flota "sobre" la tabla.
                boxShadow: "-24px 0 48px -12px rgba(15,23,42,0.45), -8px 0 16px -4px rgba(15,23,42,0.3)",
              }
            : resizable
            ? { width: customWidth ?? maxWidth ?? SIZE_PX[size] ?? 672, maxWidth: "95vw" }
            : undefined
        }
      >
        {resizable && !isRight && (
          <>
            <div
              onMouseDown={(e) => handleResizeStart(e, "left")}
              className="hidden sm:block absolute inset-y-0 left-0 w-2 cursor-col-resize z-20 hover:bg-[#bc955c]/40 transition-colors"
            />
            <div
              onMouseDown={(e) => handleResizeStart(e, "right")}
              className="hidden sm:block absolute inset-y-0 right-0 w-2 cursor-col-resize z-20 hover:bg-[#bc955c]/40 transition-colors"
            />
          </>
        )}
        {/* Franja "folio" — firma visual única y constante de todo modal del sistema */}
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#bc955c] via-[#621f32] to-[#bc955c]" />

        <div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            {Icon && (
              <div className="shrink-0 size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-[#621f32] flex items-center justify-center shadow-sm">
                <Icon className="size-5 text-[#bc955c]" />
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <span className="block text-[10px] font-black text-[#bc955c] uppercase tracking-[0.15em] mb-0.5">
                  {eyebrow}
                </span>
              )}
              <h2 className="text-base sm:text-lg font-black text-[#621f32] dark:text-[#f0d9b8] tracking-tight truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 shrink-0">
            {headerExtra}
            <button
              onClick={onClose}
              className="shrink-0 p-2 sm:p-2.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <X className="size-4.5 sm:size-5" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 sm:px-7 py-4 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, value, mono = false, highlight = false, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
        {label}
      </span>
      <span
        className={`text-[13px] font-semibold truncate ${mono ? "font-mono" : ""} ${
          highlight ? "text-[#621f32] dark:text-[#e8c793]" : "text-slate-800 dark:text-slate-200"
        }`}
      >
        {value || <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>}
      </span>
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5 block mb-3">
      {children}
    </span>
  );
}

export function Pill({ children, tone = "guinda", className = "" }) {
  const tones = {
    guinda: "bg-[#621f32]/8 text-[#621f32] border-[#621f32]/15 dark:bg-[#621f32]/20 dark:text-[#f0d9b8] dark:border-[#621f32]/40",
    dorado: "bg-[#bc955c]/15 text-[#7a5a30] border-[#bc955c]/30 dark:bg-[#bc955c]/15 dark:text-[#e3c793] dark:border-[#bc955c]/30",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
