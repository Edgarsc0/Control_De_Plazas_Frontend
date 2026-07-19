import { useEffect } from 'react';

/**
 * Cierra un modal con la tecla Escape. Estandariza el comportamiento entre los
 * modales "a mano" del módulo (createPortal + backdrop propio) — los que usan
 * `ModalShell` o el primitivo Radix `Dialog` ya traen Escape de fábrica y no
 * necesitan este hook (BUG-07 del QA: era inconsistente entre modales).
 * @param {boolean} open
 * @param {() => void} onClose
 */
export function useEscapeToClose(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
}
