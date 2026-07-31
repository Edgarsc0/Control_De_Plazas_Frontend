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
}) {
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

  useGSAP(
    () => {
      if (!rendered) return;
      if (open) {
        gsap
          .timeline()
          .set(panelRef.current, { opacity: 0, y: 24, scale: 0.98 })
          .set(backdropRef.current, { opacity: 0 })
          .to(backdropRef.current, { opacity: 1, duration: 0.18 }, 0)
          .to(panelRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "expo.out" }, 0);
      } else {
        gsap
          .timeline({ onComplete: () => setRendered(false) })
          .to(panelRef.current, { opacity: 0, y: 24, scale: 0.98, duration: 0.16, ease: "power2.in" }, 0)
          .to(backdropRef.current, { opacity: 0, duration: 0.16 }, 0);
      }
    },
    { scope: rootRef, dependencies: [open, rendered], revertOnUpdate: true }
  );

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-6"
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative w-full ${!resizable ? SIZE_CLASSES[size] : ""} max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-slate-950 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden`}
        style={resizable ? { width: customWidth ?? maxWidth ?? SIZE_PX[size] ?? 672, maxWidth: "95vw" } : undefined}
      >
        {resizable && (
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
