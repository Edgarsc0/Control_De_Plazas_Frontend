"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

// Umbral a partir del cual se muestra la advertencia de "esto puede tardar" —
// referencia real: ~13,300 filas (Plantilla Detalle completa sin filtro)
// tomó ~54s en generarse con fotos en el backend (medido, no estimado).
const FILAS_ADVERTENCIA_TARDANZA = 3000;

/**
 * Modal de confirmación de export a Excel. En MovimientosPersonalTab y
 * BajasTab se abre ÚNICAMENTE cuando el usuario tiene el permiso "ver
 * fotografía" del tab (VIEW_PLANTILLA_*_FOTO) — si no lo tiene, exportan
 * directo sin abrir este modal. PlantillaDetalleTab lo abre siempre (usa
 * `canIncluirFotos`/`showDatosPersonalesOption` para decidir qué checkboxes
 * mostrar), porque además ofrece "Incluir datos personales" sin depender de
 * ese permiso.
 *
 * Reutilizado por PlantillaDetalleTab, MovimientosPersonalTab y BajasTab.
 * El armado real del archivo lo hace el llamador vía
 * `onConfirm(incluirFotos, incluirDatosPersonales)`; este componente solo
 * maneja la elección y el estado "generando" con opción de cancelar.
 */
export default function ExportConFotosModal({
  open, onClose, onConfirm, isExporting, onCancelExport, rowCount,
  // Fase 2 (solo Plantilla Detalle, ver PlantillaDetalleTab): cruzar por
  // numempleado con DATOS_PERSONALES y agregar sus columnas al Excel.
  // `canIncluirFotos=false` oculta el checkbox de fotos (el llamador ya no
  // gatea la apertura del modal por permiso, ver handleOpenExportClick) sin
  // afectar a Movimientos/Bajas, que siguen abriendo el modal solo cuando
  // el usuario SÍ tiene el permiso de foto (canIncluirFotos=true implícito).
  canIncluirFotos = true, showDatosPersonalesOption = false,
}) {
  const [incluirFotos, setIncluirFotos] = useState(false);
  const [incluirDatosPersonales, setIncluirDatosPersonales] = useState(false);

  useEffect(() => {
    if (open) {
      setIncluirFotos(false);
      setIncluirDatosPersonales(false);
    }
  }, [open]);

  useBodyScrollLock(open);

  if (!open) return null;

  const showWarning = incluirFotos && rowCount > FILAS_ADVERTENCIA_TARDANZA;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800"
        >
          {isExporting ? (
            <div className="p-8 flex flex-col items-center gap-5 text-center">
              <div className="relative flex items-center justify-center size-16">
                <div className="absolute inset-0 rounded-full bg-[#621f32]/10 dark:bg-[#bc955c]/10 animate-ping" />
                <Loader2 className="size-8 text-[#621f32] dark:text-[#bc955c] relative z-10 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Generando Excel</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1.5">
                  {incluirFotos ? "Incrustando fotografías en el archivo, esto puede tardar unos momentos..." : "Esto puede tardar unos segundos..."}
                </p>
              </div>
              <button
                onClick={onCancelExport}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-xs font-extrabold uppercase tracking-wider text-slate-500 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#621f32] text-white rounded-xl shadow-md">
                    <ImageIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Exportar a Excel</h3>
                    <p className="text-xs font-semibold text-slate-400">
                      {canIncluirFotos && showDatosPersonalesOption
                        ? "Elige qué información adicional incluir en el archivo"
                        : canIncluirFotos
                          ? "Elige si quieres incluir las fotografías de los empleados"
                          : "Elige si quieres incluir los datos personales de los empleados"}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-3">
                {canIncluirFotos && (
                  <label className="flex items-center justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Incluir fotografías de los empleados</span>
                    <input
                      type="checkbox"
                      checked={incluirFotos}
                      onChange={(e) => setIncluirFotos(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 dark:border-slate-700 text-[#621f32] focus:ring-[#621f32]/20 cursor-pointer"
                    />
                  </label>
                )}
                {showDatosPersonalesOption && (
                  <label className="flex items-center justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Incluir datos personales</span>
                    <input
                      type="checkbox"
                      checked={incluirDatosPersonales}
                      onChange={(e) => setIncluirDatosPersonales(e.target.checked)}
                      className="size-4.5 rounded border-gray-300 dark:border-slate-700 text-[#621f32] focus:ring-[#621f32]/20 cursor-pointer"
                    />
                  </label>
                )}
                {showWarning && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                    El archivo tiene {rowCount.toLocaleString("es-MX")} filas — incrustar fotografías en un archivo así de grande puede tardar hasta un minuto.
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onConfirm(incluirFotos, incluirDatosPersonales)}
                  className="px-5 py-2 bg-gradient-to-r from-[#621f32] to-[#8d2c48] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-md shadow-[#621f32]/20 cursor-pointer"
                >
                  Generar Excel
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
