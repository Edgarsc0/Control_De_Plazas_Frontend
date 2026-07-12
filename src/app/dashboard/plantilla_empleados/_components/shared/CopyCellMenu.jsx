"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check, ClipboardPaste, AlertTriangle } from "lucide-react";

/**
 * Menú flotante de click derecho sobre una celda de DataTable.
 * Copia el valor de la celda al portapapeles y, opcionalmente (si se pasa
 * `onPaste`), pega el contenido del portapapeles sobre la celda.
 *
 * @param {{x: number, y: number, value: *, rect: ?DOMRect}|null} contextMenu
 * @param {() => void} onClose
 * @param {(text: string) => Promise<void>} [onPaste] - Si se provee, muestra la opción "Pegar valor". Recibe el texto del portapapeles.
 * @param {boolean} [canPaste=true] - Si `false` con `onPaste` provisto, la opción se muestra deshabilitada (ej. columna de solo lectura).
 */
export default function CopyCellMenu({ contextMenu, onClose, onPaste, canPaste = true }) {
  const [copied, setCopied] = useState(false);
  const [pasteState, setPasteState] = useState("idle"); // idle | pasting | done | error

  if (!contextMenu) return null;

  const copyWithFallback = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopy = async () => {
    const text = contextMenu.value == null ? "" : String(contextMenu.value);
    try {
      // navigator.clipboard requiere secure context (HTTPS o localhost);
      // en el servidor por IP/HTTP plano no existe, cae a execCommand.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        copyWithFallback(text);
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 550);
    } catch {
      try {
        copyWithFallback(text);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          onClose();
        }, 550);
      } catch {
        onClose();
      }
    }
  };

  const handlePaste = async () => {
    if (!onPaste || !canPaste || pasteState === "pasting") return;
    setPasteState("pasting");
    try {
      // navigator.clipboard.readText requiere secure context y permiso de
      // lectura; sin soporte (HTTP plano, permiso denegado) no hay fallback
      // confiable (execCommand("paste") está bloqueado por la mayoría de
      // navegadores por seguridad), así que se reporta error.
      if (!navigator.clipboard?.readText) throw new Error("clipboard-read no soportado");
      const text = await navigator.clipboard.readText();
      await onPaste(text);
      setPasteState("done");
      setTimeout(() => {
        setPasteState("idle");
        onClose();
      }, 550);
    } catch {
      setPasteState("error");
      setTimeout(() => setPasteState("idle"), 1500);
    }
  };

  const menuHeight = onPaste ? 96 : 56;

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      {contextMenu.rect && (
        <div
          className="fixed z-[9998] pointer-events-none border-2 border-dashed border-[#621f32] dark:border-[#bc955c] rounded-[3px]"
          style={{
            top: contextMenu.rect.top,
            left: contextMenu.rect.left,
            width: contextMenu.rect.width,
            height: contextMenu.rect.height,
          }}
        />
      )}
      <AnimatePresence>
        <motion.div
          key="copy-cell-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{
            top: typeof window !== 'undefined' && contextMenu.y + menuHeight > window.innerHeight ? contextMenu.y - menuHeight : contextMenu.y,
            left: typeof window !== 'undefined' && contextMenu.x + 224 > window.innerWidth ? contextMenu.x - 224 : contextMenu.x,
          }}
          className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl py-1.5 w-56"
        >
          <button
            onClick={handleCopy}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#621f32]/10 hover:text-[#621f32] dark:hover:bg-[#bc955c]/20 dark:hover:text-[#bc955c] flex items-center gap-3 transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            {copied ? "¡Copiado!" : "Copiar valor de celda"}
          </button>
          {onPaste && (
            <button
              onClick={handlePaste}
              disabled={!canPaste || pasteState === "pasting"}
              title={!canPaste ? "Columna de solo lectura" : undefined}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-[#621f32]/10 hover:text-[#621f32] dark:hover:bg-[#bc955c]/20 dark:hover:text-[#bc955c] flex items-center gap-3 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent"
            >
              {pasteState === "done" ? <Check className="size-4 text-emerald-500" />
                : pasteState === "error" ? <AlertTriangle className="size-4 text-red-500" />
                : <ClipboardPaste className="size-4" />}
              {pasteState === "done" ? "¡Pegado!" : pasteState === "error" ? "No se pudo pegar" : "Pegar valor en celda"}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
