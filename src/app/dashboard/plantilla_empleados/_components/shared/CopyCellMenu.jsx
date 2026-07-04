"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check } from "lucide-react";

/**
 * Menú flotante de click derecho sobre una celda de DataTable.
 * Copia el valor de la celda al portapapeles.
 *
 * @param {{x: number, y: number, value: *}|null} contextMenu
 * @param {() => void} onClose
 */
export default function CopyCellMenu({ contextMenu, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!contextMenu) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contextMenu.value == null ? "" : String(contextMenu.value));
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 550);
    } catch {
      onClose();
    }
  };

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
            top: typeof window !== 'undefined' && contextMenu.y + 56 > window.innerHeight ? contextMenu.y - 56 : contextMenu.y,
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
        </motion.div>
      </AnimatePresence>
    </>
  );
}
