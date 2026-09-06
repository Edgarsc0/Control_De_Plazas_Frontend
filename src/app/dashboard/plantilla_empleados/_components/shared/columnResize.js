import { gsap } from "gsap";

/**
 * Anima con GSAP el ancho del <col> real de una columna (localizado por
 * `data-col-key` dentro del contenedor con scroll de `DataTable`) mientras se
 * arrastra el grip de resize. Se llama en cada `mousemove`: en vez de que
 * cada pixel arrastrado dispare un `setState` de React (y por lo tanto un
 * re-render de toda la tabla, costoso con miles de filas), GSAP escribe el
 * ancho directo en el DOM con un tween corto — el traslado de la columna (y
 * de las que le siguen, por el reflow nativo de `table-layout: fixed`) se ve
 * animado/suave en vez de saltar 1:1 con el mouse. El estado de React sólo
 * se sincroniza una vez al soltar el mouse (`onResizeEnd`).
 *
 * @param {Object} containerRef - Ref del contenedor con scroll pasado como `containerRef` a `DataTable`.
 * @param {string} colKey - Clave de la columna (`col.key`).
 * @param {number} width - Ancho destino en px.
 * @returns {boolean} true si encontró el <col> y animó; false si debe hacerse fallback a `setState` en cada evento (containerRef aún no montado).
 */
export function animateColumnWidth(containerRef, colKey, width) {
  const colEl = containerRef?.current?.querySelector(`col[data-col-key="${colKey}"]`);
  if (!colEl) return false;
  gsap.to(colEl, { width, duration: 0.12, ease: "power3.out", overwrite: true });
  return true;
}

/** Corta cualquier tween de resize pendiente sobre el <col> (llamar en mouseup, antes de fijar el ancho final exacto en el estado). */
export function killColumnWidthAnimation(containerRef, colKey) {
  const colEl = containerRef?.current?.querySelector(`col[data-col-key="${colKey}"]`);
  if (colEl) gsap.killTweensOf(colEl);
}
