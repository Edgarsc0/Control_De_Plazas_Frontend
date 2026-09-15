"use client";

import { useCallback, useRef } from "react";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { LayoutGrid } from "lucide-react";
import WidgetFrame from "./WidgetFrame";
import { WIDGET_REGISTRY } from "./widgetRegistry";

// Id fijo del placeholder que RGL usa mientras se arrastra un módulo nuevo
// desde el catálogo (ver dropConfig/onDrop más abajo) — no es el id de
// ningún widget real.
const DROPPING_ITEM_ID = "__dropping-widget__";
const SAVE_DEBOUNCE_MS = 800;

/**
 * Cuadrícula editable del tablero personalizable (solo escritorio — ver
 * TableroPersonalizable.jsx para la variante de solo lectura en móvil).
 * Envuelve `react-grid-layout` v2 (API nativa, no el wrapper `/legacy`):
 * arrastrar+soltar desde `CatalogSidebar` usa su mecanismo de drop externo
 * (`dropConfig`/`onDrop`/`onDropDragOver`, documentado, no hecho a mano),
 * el arrastre para reposicionar solo puede iniciarse desde la barra de
 * título de `WidgetFrame` (`dragConfig.handle`) para no interferir con los
 * buscadores/tablas internos de cada widget.
 *
 * `widgets` es la única fuente de verdad (viene de TableroPersonalizable,
 * que ya la sincroniza con el backend) — este componente no guarda estado
 * propio de layout, solo lo traduce al formato que espera RGL.
 *
 * `draggedTypeRef` viene del padre común (TableroPersonalizable) y lo
 * comparte también con `CatalogSidebar`: como es un simple `useRef`, no
 * necesita re-renderizar nada en cada `dragover` (que dispara muy seguido) —
 * solo se lee aquí para saber qué módulo se está arrastrando en ese momento.
 */
export default function PersonalizableGrid({ widgets, onWidgetsChange, draggedTypeRef }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const saveTimerRef = useRef(null);

  const scheduleSave = useCallback((nextWidgets) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onWidgetsChange(nextWidgets, { persist: true });
    }, SAVE_DEBOUNCE_MS);
  }, [onWidgetsChange]);

  const layout = widgets.map((w) => {
    const def = WIDGET_REGISTRY[w.type];
    return {
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: def?.minW ?? 2,
      minH: def?.minH ?? 2,
    };
  });

  const handleLayoutChange = useCallback((newLayout) => {
    const byId = Object.fromEntries(widgets.map((w) => [w.i, w]));
    const next = newLayout
      .filter((l) => l.i !== DROPPING_ITEM_ID && byId[l.i])
      .map((l) => ({ ...byId[l.i], x: l.x, y: l.y, w: l.w, h: l.h }));
    onWidgetsChange(next, { persist: false });
    scheduleSave(next);
  }, [widgets, onWidgetsChange, scheduleSave]);

  // Tamaño del placeholder mientras se arrastra desde el catálogo, según el
  // tipo que se está arrastrando (ver CatalogSidebar `onDragStartType`).
  const handleDropDragOver = useCallback(() => {
    const def = WIDGET_REGISTRY[draggedTypeRef.current];
    if (!def) return false; // no es un drag que reconozcamos: rechazar
    return { w: def.defaultW, h: def.defaultH };
  }, []);

  const handleDrop = useCallback((newLayout, item) => {
    const type = draggedTypeRef.current;
    const def = WIDGET_REGISTRY[type];
    if (!item || !def) return;
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [...widgets, { i: id, type, x: item.x, y: item.y, w: def.defaultW, h: def.defaultH }];
    onWidgetsChange(next, { persist: false });
    scheduleSave(next);
  }, [widgets, onWidgetsChange, scheduleSave]);

  const handleRemove = useCallback((id) => {
    const next = widgets.filter((w) => w.i !== id);
    onWidgetsChange(next, { persist: false });
    scheduleSave(next);
  }, [widgets, onWidgetsChange, scheduleSave]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
      onDragEnter={(e) => e.preventDefault()}
    >
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{ cols: 12, rowHeight: 60, margin: [12, 12] }}
          dragConfig={{ handle: ".widget-drag-handle" }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          dropConfig={{ enabled: true }}
          droppingItem={{ i: DROPPING_ITEM_ID, w: 4, h: 4 }}
          onDropDragOver={handleDropDragOver}
          onDrop={handleDrop}
          onLayoutChange={handleLayoutChange}
          className="min-h-full"
        >
          {widgets.map((w) => {
            const def = WIDGET_REGISTRY[w.type];
            if (!def) return null;
            const Component = def.component;
            return (
              <div key={w.i}>
                <WidgetFrame label={def.label} onRemove={() => handleRemove(w.i)}>
                  <Component />
                </WidgetFrame>
              </div>
            );
          })}
        </ReactGridLayout>
      )}

      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="size-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
            <LayoutGrid className="size-6 text-slate-400" />
          </div>
          <h4 className="text-base font-black text-slate-700 dark:text-slate-200">Tu tablero está vacío</h4>
          <p className="text-xs text-slate-500 max-w-xs">
            Arrastra un módulo desde el catálogo de la izquierda y suéltalo aquí para empezar a personalizarlo.
          </p>
        </div>
      )}
    </div>
  );
}
