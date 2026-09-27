"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import { TableroLayoutService } from "@/services/tableroLayout.service";
import WidgetStoreModal from "./_components/personalizable/WidgetStoreModal";
import PersonalizableGrid from "./_components/personalizable/PersonalizableGrid";
import PortabilidadTablero from "./_components/personalizable/PortabilidadTablero";
import WidgetFrame from "./_components/personalizable/WidgetFrame";
import { WIDGET_REGISTRY } from "./_components/personalizable/widgetRegistry";
import { normalizarWidgets } from "./_components/personalizable/gridGeometry";

// Sin hook de viewport ya existente en el proyecto (el resto del código usa
// solo breakpoints CSS de Tailwind) — aquí sí hace falta uno en JS: en móvil
// se monta un árbol totalmente distinto (lista apilada, sin cuadrícula ni
// catálogo) en vez de solo ocultar con CSS, para no montar react-grid-layout
// ni disparar el fetch de cada widget dos veces (uno oculto, uno visible).
const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Botón de la barra inferior que abre la galería de widgets. */
function BotonAbrirGaleria({ onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    const tween = gsap.fromTo(
      ref.current,
      { x: -16, opacity: 0, scale: 0.9 },
      { x: 0, opacity: 1, scale: 1, duration: prefiereMenosMovimiento() ? 0 : 0.3, ease: "back.out(1.6)" }
    );
    return () => tween.kill();
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title="Abrir galería de widgets"
      aria-label="Abrir galería de widgets"
      className="flex items-center gap-1.5 ml-2 px-2.5 py-1.5 rounded-lg bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#10243e] text-[10px] font-black uppercase tracking-wider shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
    >
      <Sparkles className="size-3.5" />
      <span>Widgets</span>
    </button>
  );
}

const DESKTOP_QUERY = "(min-width: 768px)";
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(null); // null = aún no se sabe (evita parpadeo SSR)
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

/**
 * Tablero personalizable (ver Whitelist.tablero == 'personalizable'):
 * cuadrícula de widgets que cada usuario arma arrastrando módulos desde una
 * galería modal ("tienda de widgets"), con posición/tamaño guardados por usuario
 * (TableroLayoutService). Autofetch al montar, igual que TableroRH.jsx (no
 * recibe props de dashboard/page.jsx).
 *
 * En móvil (`< md`) se renderiza de solo lectura: lista apilada en el orden
 * guardado, sin catálogo ni edición — arrastrar/redimensionar en una pantalla
 * táctil pequeña no es una interacción confiable, y esta app ya trata otras
 * vistas complejas (Torre Caballito) de forma más simple en móvil. Si se
 * prefiere edición táctil completa más adelante, este es el único punto que
 * habría que cambiar.
 */
export default function TableroPersonalizable() {
  const [widgets, setWidgets] = useState([]);
  // Nombre de cada escritorio por índice ("" = sin nombre propio); su longitud
  // también conserva los escritorios vacíos. Se persiste con `widgets`.
  const [nombres, setNombres] = useState([]);
  const widgetsRef = useRef([]);
  const nombresRef = useRef([]);
  // Galería de widgets (modal central): `null` = cerrada; el número es una
  // clave única por apertura. Arrastrar una tarjeta la cierra y NO se reabre
  // sola; al abrirla de nuevo la galería recuerda dónde se quedó el usuario
  // (ver `recuerdo` en WidgetStoreModal.jsx). La clave evita que la animación
  // de salida de una instancia anterior cierre la nueva — ver `cerrarGaleria`.
  const [galeriaKey, setGaleriaKey] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Arrastre en curso desde el catálogo: `{ type, x0, y0 }` (coordenadas del
  // `mousedown`, para que el grid pueda aplicar su umbral de movimiento) o
  // `null`. Todo el resto del gesto lo maneja PersonalizableGrid.
  const [arrastre, setArrastre] = useState(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    let active = true;
    TableroLayoutService.getLayout()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar tu tablero."))))
      // `normalizarWidgets` reacomoda lo guardado al modelo de escritorios
      // (reparte por `page`, acota al alto de un escritorio y resuelve
      // traslapes): los layouts creados antes de que el tablero se dividiera
      // en escritorios no traen `page` y pueden tener widgets más altos que la
      // pantalla — que es justo lo que provocaba scroll vertical.
      .then((data) => {
        if (!active) return;
        const cargados = normalizarWidgets(Array.isArray(data.widgets) ? data.widgets : []);
        const nombresCargados = Array.isArray(data.escritorios) ? data.escritorios.map((n) => String(n || "")) : [];
        widgetsRef.current = cargados;
        nombresRef.current = nombresCargados;
        setWidgets(cargados);
        setNombres(nombresCargados);
      })
      .catch((err) => { if (active) setError(err.message || "Error al cargar tu tablero."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  // Estable a propósito: es dependencia del efecto que suscribe los listeners
  // del arrastre en PersonalizableGrid — si cambiara de identidad en cada
  // render, ese efecto se resuscribiría a media gesto.
  const handleArrastreFin = useCallback(() => setArrastre(null), []);

  const guardar = useCallback((nextWidgets, nextNombres) => {
    TableroLayoutService.saveLayout(nextWidgets, nextNombres).catch((err) => {
      console.error("No se pudo guardar el tablero:", err);
    });
  }, []);

  const handleWidgetsChange = useCallback((next, { persist = false } = {}) => {
    widgetsRef.current = next;
    setWidgets(next);
    if (persist) guardar(next, nombresRef.current);
  }, [guardar]);

  const handleNombresChange = useCallback((next) => {
    nombresRef.current = next;
    setNombres(next);
    guardar(widgetsRef.current, next);
  }, [guardar]);

  // Importación: reemplaza widgets y nombres de una sola vez y persiste ambos.
  const handleImportar = useCallback((nextWidgets, nextNombres) => {
    widgetsRef.current = nextWidgets;
    nombresRef.current = nextNombres;
    setWidgets(nextWidgets);
    setNombres(nextNombres);
    guardar(nextWidgets, nextNombres);
  }, [guardar]);

  const cerrarGaleria = useCallback((key) => setGaleriaKey((actual) => (actual === key ? null : actual)), []);
  const iniciarArrastre = useCallback((type, x0, y0) => setArrastre({ type, x0, y0 }), []);

  if (isLoading) {
    return (
      <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex items-center justify-center">
        <Loader2 className="size-8 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex items-center justify-center p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm font-bold">{error}</p>
      </div>
    );
  }

  // Aún no se determina el viewport (primer render en cliente): evita un
  // salto visual mostrando el mismo loader que el estado de carga inicial.
  if (isDesktop === null) {
    return (
      <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex items-center justify-center">
        <Loader2 className="size-8 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  if (!isDesktop) {
    // Mismo orden de lectura que en escritorio: escritorio por escritorio, y
    // dentro de cada uno de arriba a abajo y de izquierda a derecha.
    const sorted = [...widgets].sort(
      (a, b) => (a.page ?? 0) - (b.page ?? 0) || a.y - b.y || a.x - b.x
    );
    return (
      <div className="w-full h-stack-nav-dvh overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">
            Tu tablero está vacío. Personalízalo desde una computadora.
          </p>
        ) : (
          sorted.map((w) => {
            const def = WIDGET_REGISTRY[w.type];
            if (!def) return null;
            const Component = def.component;
            return (
              <div key={w.i} className="h-[70dvh] shrink-0">
                <WidgetFrame label={def.label} editable={false}>
                  <Component config={w.config} />
                </WidgetFrame>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-stack-dvh flex overflow-hidden">
      <div className="flex-1 min-w-0 p-3">
        <PersonalizableGrid
          widgets={widgets}
          onWidgetsChange={handleWidgetsChange}
          arrastre={arrastre}
          onArrastreFin={handleArrastreFin}
          nombres={nombres}
          onNombresChange={handleNombresChange}
          accionesDerecha={(escritorioActivo) => (
            <PortabilidadTablero widgets={widgets} nombres={nombres} escritorioActivo={escritorioActivo} onImportar={handleImportar} />
          )}
          accionesIzquierda={<BotonAbrirGaleria onClick={() => setGaleriaKey(Date.now())} />}
        />
      </div>
      {galeriaKey !== null && (
        <WidgetStoreModal
          key={galeriaKey}
          usedTypes={widgets.map((w) => w.type)}
          onIniciarArrastre={iniciarArrastre}
          onClose={() => cerrarGaleria(galeriaKey)}
        />
      )}
    </div>
  );
}
