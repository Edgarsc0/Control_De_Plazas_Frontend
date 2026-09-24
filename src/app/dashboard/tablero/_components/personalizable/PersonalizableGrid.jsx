"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { noCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { ChevronLeft, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import WidgetFrame from "./WidgetFrame";
import { WIDGET_REGISTRY } from "./widgetRegistry";
import {
  GRID_COLS,
  GRID_MARGIN,
  GRID_ROWS,
  alturaFila,
  buscarHueco,
  celdaDesdePuntero,
  colisiona,
  posicionEnPx,
  tamanoEnPx,
} from "./gridGeometry";

const SAVE_DEBOUNCE_MS = 800;
// Píxeles que hay que mover el cursor desde el `mousedown` en el catálogo para
// considerarlo un arrastre y no un clic accidental.
const UMBRAL_ARRASTRE_PX = 4;

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
const escritorioDe = (w) => w.page ?? 0;

/** Ancho y alto interiores del elemento (sin barras de scroll), reactivos. */
function useTamanoContenedor() {
  const ref = useRef(null);
  const [tamano, setTamano] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // `clientWidth/Height` y no `contentRect`: excluyen siempre las barras de
    // scroll, de las que depende el alto útil del escritorio.
    const medir = () => setTamano((prev) => (
      prev.width === el.clientWidth && prev.height === el.clientHeight
        ? prev
        : { width: el.clientWidth, height: el.clientHeight }
    ));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  return [ref, tamano];
}

/**
 * Tablero personalizable de escritorio, organizado en "escritorios": cada uno
 * ocupa exactamente el área visible y se navega horizontalmente entre ellos
 * (flechas, puntos o arrastre con scroll-snap). No hay scroll vertical en
 * ningún punto: la cuadrícula tiene un número fijo de filas (GRID_ROWS) cuya
 * altura en píxeles se deriva del alto disponible, así que el contenido
 * siempre cabe completo a cualquier zoom o tamaño de ventana. Un widget guarda
 * su alto en filas, que es una medida relativa; cambiar el zoom recalcula los
 * píxeles, no las filas. Si un escritorio se llena, el siguiente widget pasa
 * al escritorio de al lado.
 *
 * `widgets` es la única fuente de verdad (viene de TableroPersonalizable, que
 * ya la sincroniza con el backend) — este componente no guarda estado propio
 * de layout. Cada widget lleva un campo `page` con el escritorio al que
 * pertenece; el backend guarda la lista tal cual, sin esquema fijo.
 *
 * Reposicionar y redimensionar los widgets YA COLOCADOS usa el mecanismo
 * nativo de `react-grid-layout` (react-draggable / react-resizable, basados en
 * eventos de mouse), con `noCompactor` para que cada widget se quede donde se
 * suelta —como en un escritorio— en vez de apilarse hacia arriba. El arrastre
 * solo puede iniciarse desde la barra de título de `WidgetFrame`
 * (`dragConfig.handle`) para no interferir con los buscadores/tablas internos.
 *
 * AGREGAR un módulo desde el catálogo, en cambio, NO usa el mecanismo de drop
 * externo de la librería (`dropConfig`/`onDrop`/`droppingItem` + drag nativo
 * HTML5). Se probó y resultó no ser confiable: el módulo se colocaba solo
 * ocasionalmente, en Firefox y en Chrome. Dos defectos concretos, verificados
 * leyendo el código de react-grid-layout v2.2.4:
 *
 *  1. En Firefox, su `handleDragOver` descarta todo evento cuyo `target` no
 *     sea exactamente el contenedor de la cuadrícula. Pero la propia librería
 *     inserta el nodo del placeholder bajo el cursor en cuanto empieza el
 *     arrastre, así que a partir de ese momento el `target` pasa a ser ese
 *     placeholder → descarta el evento → destruye el placeholder → el
 *     siguiente evento vuelve a apuntar a la cuadrícula → lo recrea... Un
 *     ciclo en el que el estado al soltar es una carrera.
 *  2. En ambos navegadores, cada `dragover` muta el layout interno y dispara
 *     `onLayoutChange` (su bandera `activeDrag` solo cubre arrastres internos,
 *     no los externos). Eso propaga estado al padre y vuelve a renderizar la
 *     cuadrícula entera decenas de veces por segundo durante el arrastre; el
 *     reemplazo de nodos del DOM bajo el cursor genera pares
 *     `dragenter`/`dragleave` espurios que descuadran el contador interno con
 *     el que la librería decide si el drop es válido.
 *
 * En su lugar, el gesto completo se maneja aquí con eventos de puntero
 * (mousedown en el catálogo → mousemove → mouseup), que son deterministas: no
 * dependen de que el navegador "acepte" una zona de drop ni de contadores
 * internos. Nosotros calculamos escritorio y celda destino (gridGeometry.js) y
 * agregamos el widget a `widgets`.
 */
export default function PersonalizableGrid({ widgets, onWidgetsChange, arrastre, onArrastreFin }) {
  const [viewportRef, { width: anchoEscritorio, height: altoEscritorio }] = useTamanoContenedor();
  const saveTimerRef = useRef(null);

  // Espejo de `widgets` para que el efecto del arrastre lea siempre el valor
  // más reciente sin tener que resuscribir sus listeners en cada cambio.
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  const [escritorioActivo, setEscritorioActivo] = useState(0);
  // Escritorios vacíos creados a mano con el botón "+": no se deducen de
  // `widgets` porque justamente todavía no tienen ninguno.
  const [escritoriosExtra, setEscritoriosExtra] = useState(0);
  const [preview, setPreview] = useState(null); // { escritorio, x, y, w, h }
  const [ghost, setGhost] = useState(null); // { x, y } en coordenadas de viewport

  const rowHeight = useMemo(() => alturaFila(altoEscritorio), [altoEscritorio]);
  const listo = anchoEscritorio > 0 && altoEscritorio > 0;

  const totalEscritorios = useMemo(() => {
    const ultimoUsado = widgets.reduce((max, w) => Math.max(max, escritorioDe(w)), -1);
    return Math.max(1, ultimoUsado + 1, escritoriosExtra);
  }, [widgets, escritoriosExtra]);

  const escritorios = useMemo(
    () => Array.from({ length: totalEscritorios }, (_, i) => widgets.filter((w) => escritorioDe(w) === i)),
    [widgets, totalEscritorios]
  );

  const scheduleSave = useCallback((next) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => onWidgetsChange(next, { persist: true }), SAVE_DEBOUNCE_MS);
  }, [onWidgetsChange]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const aplicar = useCallback((next) => {
    onWidgetsChange(next, { persist: false });
    scheduleSave(next);
  }, [onWidgetsChange, scheduleSave]);

  // Memoizados: la librería los usa como dependencia de sus propios
  // `useMemo`/`useCallback`, así que pasarlos como literales en línea la
  // obliga a recalcular todo su estado interno en cada render.
  const gridConfig = useMemo(
    () => ({ cols: GRID_COLS, rowHeight, margin: GRID_MARGIN, maxRows: GRID_ROWS }),
    [rowHeight]
  );
  const dragConfig = useMemo(() => ({ handle: ".widget-drag-handle" }), []);
  const resizeConfig = useMemo(() => ({ enabled: true, handles: ["se"] }), []);

  const irAEscritorio = useCallback((indice) => {
    const cont = viewportRef.current;
    if (!cont || !anchoEscritorio) return;
    const destino = clamp(indice, 0, totalEscritorios - 1);
    cont.scrollTo({ left: destino * anchoEscritorio, behavior: "smooth" });
    setEscritorioActivo(destino);
  }, [viewportRef, anchoEscritorio, totalEscritorios]);

  // --- Cambios de layout dentro de un escritorio -------------------------

  const handleLayoutChange = useCallback((escritorio, nuevoLayout) => {
    const actuales = widgetsRef.current;
    let cambio = false;
    const next = actuales.map((w) => {
      if (escritorioDe(w) !== escritorio) return w;
      const l = nuevoLayout.find((it) => it.i === w.i);
      if (!l) return w;
      // Red de seguridad del invariante "nada sobresale del escritorio":
      // aunque `maxRows` ya acota arrastre y redimensión, al empujarse entre
      // sí los widgets pueden quedar fuera de rango.
      const ancho = clamp(l.w, 1, GRID_COLS);
      const alto = clamp(l.h, 1, GRID_ROWS);
      const x = clamp(l.x, 0, GRID_COLS - ancho);
      const y = clamp(l.y, 0, GRID_ROWS - alto);
      if (w.x === x && w.y === y && w.w === ancho && w.h === alto) return w;
      cambio = true;
      return { ...w, x, y, w: ancho, h: alto };
    });
    // La librería emite `onLayoutChange` también al montar y tras recalcular,
    // con un layout equivalente al que ya tenemos: sin esta guarda, ese eco
    // dispararía un guardado al backend sin que el usuario mueva nada.
    if (cambio) aplicar(next);
  }, [aplicar]);

  const handleRemove = useCallback((id) => {
    aplicar(widgetsRef.current.filter((w) => w.i !== id));
  }, [aplicar]);

  // --- Arrastre desde el catálogo ----------------------------------------

  /**
   * Escritorio + celda donde caería el módulo, ya resuelto contra lo que hay
   * colocado: si el punto exacto está ocupado busca el primer hueco de ese
   * escritorio, y si está lleno pasa al siguiente (creando uno nuevo al final
   * si hace falta). `null` = el cursor está fuera del área del tablero.
   */
  const destinoBajoCursor = useCallback((clientX, clientY, def) => {
    const cont = viewportRef.current;
    if (!cont || !listo) return null;

    const rect = cont.getBoundingClientRect();
    const dentro =
      clientX >= rect.left && clientX <= rect.right &&
      clientY >= rect.top && clientY <= rect.bottom;
    if (!dentro) return null;

    const xAbsoluto = clientX - rect.left + cont.scrollLeft;
    const apuntado = clamp(Math.floor(xAbsoluto / anchoEscritorio), 0, totalEscritorios - 1);
    const w = clamp(def.defaultW, 1, GRID_COLS);
    const h = clamp(def.defaultH, 1, GRID_ROWS);

    const celda = celdaDesdePuntero(
      anchoEscritorio,
      rowHeight,
      xAbsoluto - apuntado * anchoEscritorio,
      clientY - rect.top,
      w,
      h
    );

    // Desde el escritorio apuntado hacia adelante; el índice `totalEscritorios`
    // representa uno nuevo al final, que por estar vacío siempre admite el
    // widget.
    for (let e = apuntado; e <= totalEscritorios; e += 1) {
      const items = widgetsRef.current.filter((it) => escritorioDe(it) === e);
      if (e === apuntado && !colisiona(items, celda.x, celda.y, w, h)) {
        return { escritorio: e, x: celda.x, y: celda.y, w, h };
      }
      const hueco = buscarHueco(items, w, h);
      if (hueco) return { escritorio: e, x: hueco.x, y: hueco.y, w, h };
    }
    return null;
  }, [viewportRef, listo, anchoEscritorio, rowHeight, totalEscritorios]);

  useEffect(() => {
    if (!arrastre) return undefined;
    const def = WIDGET_REGISTRY[arrastre.type];
    if (!def) { onArrastreFin(); return undefined; }

    let activo = false;
    const limpiar = () => {
      document.body.style.userSelect = "";
      setPreview(null);
      setGhost(null);
    };

    const onMove = (e) => {
      if (!activo) {
        if (Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) < UMBRAL_ARRASTRE_PX) return;
        activo = true;
        document.body.style.userSelect = "none";
      }
      setGhost({ x: e.clientX, y: e.clientY });
      setPreview(destinoBajoCursor(e.clientX, e.clientY, def));
    };

    const onUp = (e) => {
      const destino = activo ? destinoBajoCursor(e.clientX, e.clientY, def) : null;
      limpiar();
      if (destino) {
        const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        aplicar([...widgetsRef.current, {
          i: id,
          type: arrastre.type,
          page: destino.escritorio,
          x: destino.x,
          y: destino.y,
          w: destino.w,
          h: destino.h,
        }]);
        // Si se desbordó al escritorio de al lado, llevar al usuario ahí para
        // que vea dónde quedó en vez de que parezca que no se agregó.
        if (destino.escritorio !== escritorioActivo) irAEscritorio(destino.escritorio);
      }
      onArrastreFin();
    };

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      limpiar();
      onArrastreFin();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      limpiar();
    };
  }, [arrastre, onArrastreFin, destinoBajoCursor, aplicar, escritorioActivo, irAEscritorio]);

  const previewBox = useMemo(() => {
    if (!preview || !listo) return null;
    return {
      ...posicionEnPx(anchoEscritorio, rowHeight, preview.x, preview.y),
      ...tamanoEnPx(anchoEscritorio, rowHeight, preview.w, preview.h),
    };
  }, [preview, listo, anchoEscritorio, rowHeight]);

  const defArrastrado = arrastre ? WIDGET_REGISTRY[arrastre.type] : null;
  const ultimoVacio = (escritorios[totalEscritorios - 1]?.length ?? 0) === 0;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div
        ref={viewportRef}
        onScroll={(e) => {
          if (!anchoEscritorio) return;
          setEscritorioActivo(Math.round(e.currentTarget.scrollLeft / anchoEscritorio));
        }}
        className="escritorios-scroll flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
      >
        {escritorios.map((items, indice) => (
          <section
            key={indice}
            className="relative shrink-0 h-full snap-start overflow-hidden"
            style={{ width: anchoEscritorio || "100%" }}
          >
            {listo && (
              <ReactGridLayout
                layout={items.map((w) => {
                  const def = WIDGET_REGISTRY[w.type];
                  return {
                    i: w.i, x: w.x, y: w.y, w: w.w, h: w.h,
                    minW: def?.minW ?? 2,
                    minH: def?.minH ?? 2,
                  };
                })}
                width={anchoEscritorio}
                gridConfig={gridConfig}
                dragConfig={dragConfig}
                resizeConfig={resizeConfig}
                compactor={noCompactor}
                onLayoutChange={(nuevo) => handleLayoutChange(indice, nuevo)}
              >
                {items.map((w) => {
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

            {/* Celda destino mientras se arrastra desde el catálogo. */}
            {previewBox && preview.escritorio === indice && (
              <div
                aria-hidden
                className="absolute pointer-events-none rounded-2xl border-2 border-dashed border-[#621f32]/50 dark:border-[#bc955c]/50 bg-[#621f32]/8 dark:bg-[#bc955c]/10 transition-[left,top,width,height] duration-75"
                style={previewBox}
              />
            )}

            {items.length === 0 && !(preview?.escritorio === indice) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
                <div className="size-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <LayoutGrid className="size-6 text-slate-400" />
                </div>
                <h4 className="text-base font-black text-slate-700 dark:text-slate-200">
                  {indice === 0 ? "Tu tablero está vacío" : `Escritorio ${indice + 1} vacío`}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  Arrastra un módulo desde el catálogo de la izquierda y suéltalo aquí.
                </p>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Navegación entre escritorios. */}
      <div className="shrink-0 flex items-center justify-center gap-3 py-2 border-t border-slate-200/70 dark:border-slate-800/70">
        <button
          type="button"
          onClick={() => irAEscritorio(escritorioActivo - 1)}
          disabled={escritorioActivo === 0}
          title="Escritorio anterior"
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {escritorios.map((_, indice) => (
            <button
              key={indice}
              type="button"
              onClick={() => irAEscritorio(indice)}
              title={`Escritorio ${indice + 1}`}
              aria-label={`Escritorio ${indice + 1}`}
              aria-current={indice === escritorioActivo}
              className={`h-2 rounded-full transition-all cursor-pointer ${indice === escritorioActivo
                ? "w-6 bg-[#621f32] dark:bg-[#bc955c]"
                : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => irAEscritorio(escritorioActivo + 1)}
          disabled={escritorioActivo >= totalEscritorios - 1}
          title="Escritorio siguiente"
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setEscritoriosExtra(totalEscritorios + 1);
            // El escritorio aún no existe en este render: se navega tras
            // pintarlo.
            requestAnimationFrame(() => irAEscritorio(totalEscritorios));
          }}
          disabled={ultimoVacio}
          title={ultimoVacio ? "El último escritorio todavía está vacío" : "Agregar escritorio"}
          className="ml-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Escritorio</span>
        </button>
      </div>

      {/* "Fantasma" que sigue al cursor: `fixed`, así que su posición en el
          árbol no importa y no afecta el layout ni el scroll. */}
      {ghost && defArrastrado && (
        <div
          aria-hidden
          className="fixed z-[70] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#621f32]/40 dark:border-[#bc955c]/40 shadow-lg opacity-90"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <defArrastrado.icon className="size-4 text-[#621f32] dark:text-[#bc955c]" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
            {defArrastrado.label}
          </span>
        </div>
      )}
    </div>
  );
}
