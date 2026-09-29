"use client";

import { createContext, useContext } from "react";

/**
 * Apilamiento de modales anidados.
 *
 * Todos los modales del sistema se dibujan con `createPortal` en <body>, así
 * que son HERMANOS en el DOM sin importar quién abrió a quién: el orden visual
 * lo decide solo el `z-index`. Con valores fijos eso funciona mientras haya un
 * modal a la vez, pero se rompe en cuanto uno abre a otro — el modal "Plantilla
 * de la unidad" del tablero (ModalShell, z 1000) contiene la pestaña Plantilla
 * Detalle completa, y sus modales de Columnas / Filtros Avanzados estaban
 * fijos en z 100: se abrían DETRÁS del contenedor, visibles pero inalcanzables.
 *
 * En vez de subir esos números a mano (que arregla un caso y rompe el
 * siguiente, ver el `zIndexClass="z-[1100]"` que ya había suelto en
 * PlantillaDetalleTab), cada modal calcula su z RELATIVO al que lo contiene:
 *
 *   const z = useModalLayerZ(1000);   // 1000 = su z de siempre, suelto
 *   ...
 *   <div style={{ zIndex: z }}>       // inline, no clase: Tailwind no puede
 *   <ModalLayerProvider value={z}>    // generar clases con valor dinámico
 *
 * Suelto devuelve su valor de siempre (nada cambia); dentro de otro modal
 * devuelve el del contenedor + PASO, y funciona a cualquier profundidad.
 */
const ModalLayerContext = createContext(0);

/** Separación entre un modal y el que abre encima. Holgada a propósito: dentro
 *  de un mismo modal conviven capas propias (backdrop, panel, dropdowns). */
export const PASO_CAPA_MODAL = 100;

export const ModalLayerProvider = ModalLayerContext.Provider;

/**
 * z-index que le toca a este modal.
 * @param {number} zBase - El z que usa cuando NO está dentro de otro modal.
 *   Suelto se devuelve tal cual, así que nada cambia fuera de un modal.
 * @param {number} [paso] - Cuánto subir sobre el contenedor. El default
 *   (PASO_CAPA_MODAL) es para un modal completo; los elementos flotantes de
 *   DENTRO de un modal (dropdowns, autocompletados) pasan un paso chico para
 *   quedar sobre su propio modal sin saltar por encima del siguiente.
 * @returns {number}
 */
export function useModalLayerZ(zBase, paso = PASO_CAPA_MODAL) {
  const zContenedor = useContext(ModalLayerContext);
  return zContenedor ? zContenedor + paso : zBase;
}
