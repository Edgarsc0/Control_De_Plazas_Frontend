"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { noCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Check, ChevronLeft, ChevronRight, LayoutGrid, Pencil, Plus } from "lucide-react";
import WidgetFrame from "./WidgetFrame";
import { WIDGET_REGISTRY } from "./widgetRegistry";
import {
  GRID_COLS,
  GRID_MARGIN,
  GRID_MAX_ROWS,
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
// Auto-scroll vertical del escritorio mientras se arrastra un módulo: al
// acercar el cursor al borde inferior (o superior) del tablero, el escritorio
// se desplaza sola; la velocidad crece con lo cerca que esté del borde.
const ZONA_AUTOSCROLL_PX = 140;
const VELOCIDAD_MAX_PX = 34; // px por frame (~2000 px/s a 60 fps) pegado al borde
const MAX_NOMBRE_ESCRITORIO = 60; // igual que TableroLayoutView.MAX_NOMBRE en el backend

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
 * ocupa el ancho visible y se navega horizontalmente entre ellos (flechas,
 * puntos o arrastre con scroll-snap). Verticalmente cada escritorio tiene su
 * propio alto fijo (el de la pantalla, sin scroll vertical): tiene un número fijo
 * de filas (GRID_MAX_ROWS) y la altura de fila se ajusta para llenarlo.
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
export default function PersonalizableGrid({
  widgets,
  onWidgetsChange,
  arrastre,
  onArrastreFin,
  // Nombre por índice de cada escritorio ("" = sin nombre propio) y callback
  // para cambiarlos (TableroPersonalizable los persiste junto con `widgets`).
  nombres = [],
  onNombresChange,
  // Nodo que se pinta al inicio de la barra inferior (botón para volver a
  // mostrar el catálogo cuando está contraído).
  accionesIzquierda = null,
}) {
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
  // Autoscroll vertical: `punteroRef` guarda la última posición del cursor
  // mientras hay un arrastre (desde el catálogo o de un widget ya colocado).
  const seccionesRef = useRef([]);
  const punteroRef = useRef(null);
  const alScrollearRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(false);

  // Compactador que hace REVERSIBLE el empuje entre widgets durante un
  // arrastre. Con `noCompactor` a secas, react-grid-layout empuja a los
  // vecinos al acercar el widget arrastrado y ya no los devuelve aunque se
  // aleje. Aquí, al iniciar el arrastre se guarda la posición original de
  // todos y, tras cada movimiento, cada widget desplazado que ya no choque
  // con nada en su posición original vuelve a ella (se repite hasta que no
  // haya más cambios, para devolver también los que empujó en cascada).
  const arrastreBaseRef = useRef(null); // { id, base: Map<i, {x, y}> }
  const compactadorReversible = useMemo(() => ({
    ...noCompactor,
    compact(layout) {
      const copia = layout.map((it) => ({ ...it }));
      const arrastre = arrastreBaseRef.current;
      if (!arrastre || !copia.some((it) => it.i === arrastre.id)) return copia;
      const chocan = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      let cambio = true;
      for (let vuelta = 0; cambio && vuelta < 50; vuelta += 1) {
        cambio = false;
        for (const it of copia) {
          if (it.i === arrastre.id) continue;
          const orig = arrastre.base.get(it.i);
          if (!orig || (orig.x === it.x && orig.y === it.y)) continue;
          const enOrigen = { ...it, x: orig.x, y: orig.y };
          if (!copia.some((otro) => otro !== it && chocan(otro, enOrigen))) {
            it.x = orig.x;
            it.y = orig.y;
            cambio = true;
          }
        }
      }
      return copia;
    },
  }), []);

  const rowHeight = alturaFila(altoEscritorio);
  const listo = anchoEscritorio > 0 && altoEscritorio > 0;

  const totalEscritorios = useMemo(() => {
    const ultimoUsado = widgets.reduce((max, w) => Math.max(max, escritorioDe(w)), -1);
    return Math.max(1, ultimoUsado + 1, escritoriosExtra, nombres.length);
  }, [widgets, escritoriosExtra, nombres.length]);

  const escritorios = useMemo(
    () => Array.from({ length: totalEscritorios }, (_, i) => widgets.filter((w) => escritorioDe(w) === i)),
    [widgets, totalEscritorios]
  );

  // Sin scroll vertical: cada escritorio mide exactamente el área visible.
  const altosEscritorio = useMemo(
    () => escritorios.map(() => altoEscritorio),
    [escritorios, altoEscritorio]
  );

  // --- Nombres de escritorios --------------------------------------------

  const nombreDe = useCallback(
    (indice) => (nombres[indice] || "").trim() || `Escritorio ${indice + 1}`,
    [nombres]
  );
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [borradorNombre, setBorradorNombre] = useState("");

  const empezarRenombrar = () => {
    setBorradorNombre(nombres[escritorioActivo] || "");
    setEditandoNombre(true);
  };
  const cancelarRenombrar = () => setEditandoNombre(false);
  const confirmarRenombrar = () => {
    setEditandoNombre(false);
    const nuevo = borradorNombre.trim().slice(0, MAX_NOMBRE_ESCRITORIO);
    if (nuevo === (nombres[escritorioActivo] || "")) return;
    // Se rellena con "" hasta cubrir todos los escritorios, para que el
    // arreglo guardado conserve también los que no tienen nombre propio.
    const next = Array.from({ length: totalEscritorios }, (_, i) => nombres[i] || "");
    next[escritorioActivo] = nuevo;
    onNombresChange?.(next);
  };
  // Cambiar de escritorio mientras se edita descarta la edición.
  useEffect(() => { setEditandoNombre(false); }, [escritorioActivo]);

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
    () => ({ cols: GRID_COLS, rowHeight, margin: GRID_MARGIN, maxRows: GRID_MAX_ROWS }),
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
      const alto = clamp(l.h, 1, GRID_MAX_ROWS);
      const x = clamp(l.x, 0, GRID_COLS - ancho);
      const y = clamp(l.y, 0, GRID_MAX_ROWS - alto);
      if (w.x === x && w.y === y && w.w === ancho && w.h === alto) return w;
      cambio = true;
      return { ...w, x, y, w: ancho, h: alto };
    });
    // La librería emite `onLayoutChange` también al montar y tras recalcular,
    // con un layout equivalente al que ya tenemos: sin esta guarda, ese eco
    // dispararía un guardado al backend sin que el usuario mueva nada.
    if (cambio) aplicar(next);
  }, [aplicar]);

  // Configuración propia de cada widget (p. ej. la posición del árbol de
  // movimientos): vive en `config` dentro del mismo layout persistido.
  const handleConfig = useCallback((id, parcial) => {
    aplicar(widgetsRef.current.map((w) => (w.i === id ? { ...w, config: { ...w.config, ...parcial } } : w)));
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
    // Cada escritorio tiene su propio scroll vertical: la Y dentro de su
    // contenido es la del cursor más lo ya desplazado.
    const scrollY = seccionesRef.current[apuntado]?.scrollTop ?? 0;
    const w = clamp(def.defaultW, 1, GRID_COLS);
    const h = clamp(def.defaultH, 1, GRID_MAX_ROWS);

    const celda = celdaDesdePuntero(
      anchoEscritorio,
      rowHeight,
      xAbsoluto - apuntado * anchoEscritorio,
      clientY - rect.top + scrollY,
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
      punteroRef.current = null;
      alScrollearRef.current = null;
      setAutoScroll(false);
      setPreview(null);
      setGhost(null);
    };

    const onMove = (e) => {
      if (!activo) {
        if (Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) < UMBRAL_ARRASTRE_PX) return;
        activo = true;
        document.body.style.userSelect = "none";
        // Tras cada avance del autoscroll el cursor queda sobre otra celda
        // aunque no se haya movido: se recalcula el destino.
        alScrollearRef.current = () => {
          const p = punteroRef.current;
          if (p) setPreview(destinoBajoCursor(p.x, p.y, def));
        };
        setAutoScroll(true);
      }
      punteroRef.current = { x: e.clientX, y: e.clientY };
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

  // Bucle de autoscroll (requestAnimationFrame) mientras dura un arrastre.
  useEffect(() => {
    if (!autoScroll) return undefined;
    let raf = 0;
    const paso = () => {
      const cont = viewportRef.current;
      const p = punteroRef.current;
      if (cont && p && anchoEscritorio) {
        const rect = cont.getBoundingClientRect();
        const dentroX = p.x >= rect.left && p.x <= rect.right;
        const indice = clamp(Math.floor((p.x - rect.left + cont.scrollLeft) / anchoEscritorio), 0, totalEscritorios - 1);
        const seccion = seccionesRef.current[indice];
        if (seccion && dentroX) {
          const zona = Math.min(ZONA_AUTOSCROLL_PX, rect.height / 3);
          let velocidad = 0;
          if (p.y > rect.bottom - zona) velocidad = clamp((p.y - (rect.bottom - zona)) / zona, 0, 1);
          else if (p.y < rect.top + zona) velocidad = -clamp(((rect.top + zona) - p.y) / zona, 0, 1);
          if (velocidad !== 0) {
            // Curva cuadrática: suave al entrar a la zona, rápido pegado al borde.
            const delta = Math.sign(velocidad) * velocidad * velocidad * VELOCIDAD_MAX_PX;
            const antes = seccion.scrollTop;
            seccion.scrollTop = antes + delta;
            if (seccion.scrollTop !== antes) alScrollearRef.current?.();
          }
        }
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll, viewportRef, anchoEscritorio, totalEscritorios]);

  // Arrastre de un widget YA colocado (react-grid-layout): mismo autoscroll.
  // `react-draggable` calcula la posición con eventos `mousemove` del
  // documento; si el escritorio se desplaza con el cursor quieto, se emite uno
  // sintético para que el widget siga al cursor.
  const handleDragStartInterno = useCallback((layoutInicial, itemInicial) => {
    if (layoutInicial && itemInicial) {
      arrastreBaseRef.current = {
        id: itemInicial.i,
        base: new Map(layoutInicial.map((it) => [it.i, { x: it.x, y: it.y }])),
      };
    }
    alScrollearRef.current = () => {
      const p = punteroRef.current;
      if (p) document.dispatchEvent(new MouseEvent("mousemove", { clientX: p.x, clientY: p.y, bubbles: true }));
    };
    setAutoScroll(true);
  }, []);
  const handleDragInterno = useCallback((_layout, _old, _new, _placeholder, e) => {
    if (e && typeof e.clientX === "number") punteroRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleDragStopInterno = useCallback(() => {
    arrastreBaseRef.current = null;
    punteroRef.current = null;
    alScrollearRef.current = null;
    setAutoScroll(false);
  }, []);

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
            ref={(el) => { seccionesRef.current[indice] = el; }}
            className="relative shrink-0 h-full snap-start overflow-hidden"
            style={{ width: anchoEscritorio || "100%" }}
          >
            <div className="relative" style={{ height: altosEscritorio[indice] }}>
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
                compactor={compactadorReversible}
                onLayoutChange={(nuevo) => handleLayoutChange(indice, nuevo)}
                onDragStart={handleDragStartInterno}
                onDrag={handleDragInterno}
                onDragStop={handleDragStopInterno}
              >
                {items.map((w) => {
                  const def = WIDGET_REGISTRY[w.type];
                  if (!def) return null;
                  const Component = def.component;
                  return (
                    <div key={w.i}>
                      <WidgetFrame label={def.label} onRemove={() => handleRemove(w.i)}>
                        <Component config={w.config} onConfigChange={(parcial) => handleConfig(w.i, parcial)} />
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
                  {indice === 0 && !nombres[0] ? "Tu tablero está vacío" : `${nombreDe(indice)} vacío`}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  Arrastra un módulo desde el catálogo de la izquierda y suéltalo aquí.
                </p>
              </div>
            )}
            </div>
          </section>
        ))}
      </div>

      {/* Navegación entre escritorios. */}
      <div className="shrink-0 relative flex items-center justify-center gap-3 py-2 border-t border-slate-200/70 dark:border-slate-800/70">
        {accionesIzquierda && <div className="absolute left-0 top-1/2 -translate-y-1/2">{accionesIzquierda}</div>}
        <button
          type="button"
          onClick={() => irAEscritorio(escritorioActivo - 1)}
          disabled={escritorioActivo === 0}
          title="Escritorio anterior"
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Nombre del escritorio activo, editable. */}
        {editandoNombre ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={borradorNombre}
              maxLength={MAX_NOMBRE_ESCRITORIO}
              onChange={(e) => setBorradorNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarRenombrar();
                else if (e.key === "Escape") cancelarRenombrar();
              }}
              onBlur={confirmarRenombrar}
              placeholder={`Escritorio ${escritorioActivo + 1}`}
              aria-label="Nombre del escritorio"
              className="w-40 px-2 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-900 border border-[#621f32]/50 dark:border-[#bc955c]/50 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
            {/* onMouseDown + preventDefault: evita que el blur del input se
                dispare antes del clic y confirme dos veces. */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); confirmarRenombrar(); }}
              title="Guardar nombre"
              className="p-1 rounded-md text-[#621f32] dark:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Check className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={empezarRenombrar}
            onDoubleClick={empezarRenombrar}
            title="Cambiar nombre del escritorio"
            className="group flex items-center gap-1.5 max-w-48 px-2 py-1 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="truncate">{nombreDe(escritorioActivo)}</span>
            <Pencil className="size-3 shrink-0 text-slate-400 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c]" />
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {escritorios.map((_, indice) => (
            <button
              key={indice}
              type="button"
              onClick={() => irAEscritorio(indice)}
              title={nombreDe(indice)}
              aria-label={nombreDe(indice)}
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
            // Persistir el nuevo escritorio (aunque siga vacío) junto con los nombres.
            onNombresChange?.(Array.from({ length: totalEscritorios + 1 }, (_, i) => nombres[i] || ""));
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
