"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, LayoutGrid, Search, Sparkles, X } from "lucide-react";
import { gsap } from "gsap";
import { WIDGETS_DE_CATALOGO, GRUPOS_CATALOGO, puedeUsarWidget } from "./widgetRegistry";
import { metaDeWidget } from "./widgetCatalogoMeta";
import WidgetPreview from "./WidgetPreview";
import { useAuth } from "@/hooks/useAuth";

// Sin acentos ni mayúsculas, para que "ocupacion" encuentre "Ocupación".
const normalizar = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Movimiento mínimo (px) para distinguir un clic de un arrastre. Es solo el
// que decide abrir el gesto: el grid aplica luego el suyo (UMBRAL_ARRASTRE_PX).
const UMBRAL_INICIO_PX = 6;
const prefiereMenosMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Dónde se quedó el usuario la última vez (filtro, búsqueda, scroll y último
// widget arrastrado). Vive a nivel de módulo, no en el estado del componente:
// el modal se desmonta al cerrarse (sobre todo al arrastrar una tarjeta) y al
// abrirlo de nuevo debe retomar ahí, con una animación en cascada hasta ese punto.
const recuerdo = { grupo: "todos", busqueda: "", scrollTop: 0, tipo: null };

/**
 * "Tienda" de widgets: modal central con todos los módulos disponibles,
 * cada uno con vista previa animada, título y descripción. Sustituye a la
 * antigua barra lateral (CatalogSidebar).
 *
 * Se agrega un módulo manteniendo presionada su tarjeta y arrastrando: al
 * superar el umbral de movimiento se avisa `onIniciarArrastre` (mismo gesto
 * que ya implementa PersonalizableGrid con eventos de puntero, ver su
 * comentario) y el modal se desvanece para dejar ver el tablero, mientras el
 * botón del ratón sigue presionado. Un clic sin arrastrar no hace nada.
 */
export default function WidgetStoreModal({ usedTypes, onIniciarArrastre, onClose }) {
  const [busqueda, setBusquedaEstado] = useState(recuerdo.busqueda);
  const [grupo, setGrupoEstado] = useState(recuerdo.grupo);
  const setBusqueda = (v) => { recuerdo.busqueda = v; setBusquedaEstado(v); };
  const setGrupo = (v) => { recuerdo.grupo = v; setGrupoEstado(v); };
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const restauradoRef = useRef(false); // el "volver a donde estaba" solo corre al abrir
  const animandoScrollRef = useRef(false);
  const tweenScrollRef = useRef(null);
  const panelRef = useRef(null);
  const gridRef = useRef(null);
  const cerrandoRef = useRef(false);
  const q = normalizar(busqueda);
  const { hasAnyPermission, unScope, isLoading: authCargando } = useAuth();

  // Solo los módulos que este rol puede usar de verdad (ver `puedeUsarWidget`).
  const disponibles = useMemo(
    () => (authCargando ? [] : WIDGETS_DE_CATALOGO.filter((w) => puedeUsarWidget(w, hasAnyPermission, unScope))),
    [authCargando, hasAnyPermission, unScope]
  );

  const filtros = useMemo(() => {
    const sueltos = disponibles.filter((w) => !w.grupo).length;
    return [
      { id: "todos", label: "Todos", total: disponibles.length },
      ...(sueltos ? [{ id: "sueltos", label: "Módulos", total: sueltos }] : []),
      ...GRUPOS_CATALOGO.map((g) => ({ id: g.id, label: g.label, total: disponibles.filter((w) => w.grupo === g.id).length }))
        .filter((g) => g.total > 0),
    ];
  }, [disponibles]);

  const visibles = useMemo(
    () => disponibles.filter((w) => {
      if (grupo === "sueltos" ? w.grupo : grupo !== "todos" && w.grupo !== grupo) return false;
      if (!q) return true;
      return normalizar(w.label).includes(q) || normalizar(metaDeWidget(w.type).descripcion).includes(q);
    }),
    [disponibles, grupo, q]
  );

  const cerrar = useCallback((rapido = false) => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    if (prefiereMenosMovimiento() || !overlayRef.current) { onClose(); return; }
    // Sin `pointer-events` durante la salida: el gesto de arrastre ya sigue
    // por eventos de ventana y no debe toparse con el overlay.
    overlayRef.current.style.pointerEvents = "none";
    gsap.to(overlayRef.current, { opacity: 0, duration: rapido ? 0.16 : 0.2, ease: "power1.out", onComplete: onClose });
    gsap.to(panelRef.current, { scale: rapido ? 0.96 : 0.94, y: 12, duration: rapido ? 0.16 : 0.2, ease: "power2.in" });
  }, [onClose]);

  // Entrada: el panel "salta" y las tarjetas entran escalonadas.
  useLayoutEffect(() => {
    if (prefiereMenosMovimiento()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out" });
      gsap.fromTo(panelRef.current, { scale: 0.92, y: 24, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.5)" });
    });
    return () => ctx.revert();
  }, []);

  // Las tarjetas entran en cascada (también en cada cambio de filtro/búsqueda).
  // Al abrir con un recuerdo guardado, además el scroll baja animado hasta donde
  // se quedó el usuario y el último widget arrastrado se marca con un pulso.
  useLayoutEffect(() => {
    if (prefiereMenosMovimiento() || !gridRef.current) return undefined;
    const tarjetas = gridRef.current.querySelectorAll("[data-tarjeta]");
    if (!tarjetas.length) return undefined;
    const tweens = [
      gsap.fromTo(
        tarjetas,
        { y: 22, opacity: 0, scale: 0.94 },
        { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: "back.out(1.4)", stagger: { each: 0.035, amount: 0.5 }, delay: 0.08, clearProps: "transform,opacity" }
      ),
    ];
    const cont = scrollRef.current;
    if (!restauradoRef.current) {
      const destino = Math.min(recuerdo.scrollTop, cont.scrollHeight - cont.clientHeight);
      if (destino <= 8) restauradoRef.current = true;
      else {
        const prog = { y: 0 };
        const duracion = Math.min(1.7, 0.7 + destino / 1500);
        animandoScrollRef.current = true;
        tweenScrollRef.current = gsap.to(prog, {
          y: destino, duration: duracion, delay: 0.25, ease: "power3.inOut",
          onUpdate: () => { cont.scrollTop = prog.y; },
          onComplete: () => { animandoScrollRef.current = false; restauradoRef.current = true; },
        });
        tweens.push(tweenScrollRef.current);
        const marcada = recuerdo.tipo && gridRef.current.querySelector(`[data-tipo="${recuerdo.tipo}"]`);
        if (marcada) {
          tweens.push(gsap.fromTo(
            marcada,
            { boxShadow: "0 0 0 0 rgba(188,149,92,0.95)" },
            { boxShadow: "0 0 0 10px rgba(188,149,92,0)", duration: 0.9, repeat: 2, ease: "power2.out", delay: 0.25 + duracion, clearProps: "boxShadow" }
          ));
        }
      }
    }
    // "Ya restauré" solo se marca cuando el scroll llega a su destino (onComplete):
    // en desarrollo React monta→desmonta→monta los efectos y la primera pasada se
    // cancela; si la bandera se pusiera al empezar, la segunda no restauraría nada.
    return () => { tweens.forEach((t) => t.kill()); animandoScrollRef.current = false; };
  }, [grupo, q, disponibles]);

  // Si el usuario toma el control del scroll, se cancela el desplazamiento animado.
  const tomarControlScroll = () => {
    tweenScrollRef.current?.kill();
    animandoScrollRef.current = false;
    restauradoRef.current = true; // el usuario ya eligió su posición: no volver a restaurar al filtrar
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cerrar]);

  // Gesto de la tarjeta: mousedown arma, mousemove (> umbral) inicia el
  // arrastre y desvanece el modal; mouseup sin mover cancela.
  const armarArrastre = (e, type) => {
    if (e.button !== 0) return;
    e.preventDefault(); // evita selección de texto mientras se arrastra
    const x0 = e.clientX;
    const y0 = e.clientY;
    recuerdo.tipo = type; // al reabrir, la galería vuelve a este widget
    const quitar = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", quitar);
    };
    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < UMBRAL_INICIO_PX) return;
      quitar();
      onIniciarArrastre(type, x0, y0);
      cerrar(true);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", quitar);
  };

  const enTablero = (type) => usedTypes?.filter((t) => t === type).length || 0;

  // Portal a <body>: el modal vive dentro del contenido del dashboard, cuyo
  // contexto de apilamiento queda por debajo del Banner (`fixed`, z-50). Fuera
  // de ese árbol, z-[100] lo pone por encima de Banner, Navbar y BottomNav.
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-900/55 dark:bg-black/65 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Tienda de widgets"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-6xl h-[min(88vh,820px)] flex flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-2xl"
      >
        {/* Cabecera */}
        <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pt-5 pb-4 border-b border-slate-200/70 dark:border-slate-800/70 bg-gradient-to-r from-[#621f32]/8 via-transparent to-[#bc955c]/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#10243e] flex items-center justify-center shadow-md wp-flota">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">Galería de widgets</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mantén presionado un widget y arrástralo hacia tu tablero para colocarlo donde quieras.
              </p>
            </div>
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape" && busqueda) { e.stopPropagation(); setBusqueda(""); } }}
              placeholder="Buscar widget..."
              aria-label="Buscar widget"
              autoFocus
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X className="size-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => cerrar()}
            aria-label="Cerrar galería"
            title="Cerrar"
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Filtros */}
        {filtros.length > 2 && (
          <div className="shrink-0 flex gap-2 px-6 py-3 overflow-x-auto custom-scrollbar">
            {filtros.map((f) => {
              const activo = grupo === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGrupo(f.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${activo
                    ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#10243e] border-transparent"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40"}`}
                >
                  {f.label} <span className="opacity-60">· {f.total}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tarjetas */}
        <div
          ref={scrollRef}
          onScroll={(e) => { if (!animandoScrollRef.current) recuerdo.scrollTop = e.currentTarget.scrollTop; }}
          onWheel={tomarControlScroll}
          onTouchStart={tomarControlScroll}
          onMouseDown={tomarControlScroll}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-6 pt-2"
        >
          {visibles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-slate-400 dark:text-slate-500">
              <LayoutGrid className="size-8 opacity-50" />
              <p className="text-xs font-bold">
                {q ? `Ningún widget coincide con “${busqueda.trim()}”.` : authCargando ? "Cargando…" : "No hay widgets disponibles para tu perfil."}
              </p>
            </div>
          ) : (
            <div ref={gridRef} className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
              {visibles.map((entry) => {
                const Icon = entry.icon;
                const { descripcion } = metaDeWidget(entry.type);
                const n = enTablero(entry.type);
                return (
                  <div
                    key={entry.type}
                    data-tarjeta
                    data-tipo={entry.type}
                    onMouseDown={(e) => armarArrastre(e, entry.type)}
                    title="Mantén presionado y arrastra hacia el tablero"
                    className="group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden cursor-grab active:cursor-grabbing select-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/50 active:scale-[0.97]"
                  >
                    <div style={{ height: 176 }} className="shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/60 border-b border-slate-100 dark:border-slate-800 p-3">
                      <WidgetPreview entry={entry} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5 p-3.5">
                      <div className="flex items-start gap-2">
                        <div className="shrink-0 size-7 rounded-lg bg-[#621f32]/8 dark:bg-[#621f32]/20 flex items-center justify-center text-[#621f32] dark:text-[#bc955c] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                          <Icon className="size-4" />
                        </div>
                        <h3 className="flex-1 text-xs font-black text-slate-800 dark:text-slate-100 leading-snug pt-1">{entry.label}</h3>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{descripcion}</p>
                      <div className="mt-auto pt-2 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400 dark:text-slate-500">
                          {n > 0 ? `${n} en tu tablero` : `${entry.defaultW}×${entry.defaultH} celdas`}
                        </span>
                        <span className="flex items-center gap-1 text-[#621f32] dark:text-[#bc955c] opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                          <GripVertical className="size-3" /> Arrastra
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
