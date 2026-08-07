"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";

/**
 * Modal de confirmación genérico para acciones destructivas/irreversibles
 * (cancelar una suscripción, descartar un registro, etc.). Puramente
 * presentacional: el caller decide qué pasa en `onConfirm` — este
 * componente solo se encarga de pedir la confirmación y mostrar el estado
 * de "procesando" mientras esa promesa resuelve.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => Promise<void>} props.onConfirm - Si lanza, el modal se queda abierto (el caller puede mostrar su propio error).
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {string} [props.confirmLabel="Confirmar"]
 * @param {string} [props.cancelLabel="Cancelar"]
 */
export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar" }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // El caller es responsable de reportar el error (toast, etc.); el
      // modal se queda abierto para que el usuario pueda reintentar.
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      icon={AlertTriangle}
      title={title}
      bodyClassName="p-5 sm:p-6"
      footer={
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-60"
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      }
    >
      {message && (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
      )}
    </ModalShell>
  );
}
