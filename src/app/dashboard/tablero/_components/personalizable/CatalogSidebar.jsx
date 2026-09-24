"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, ChevronRight, Search, X, PanelLeftClose } from "lucide-react";
import { WIDGETS_DE_CATALOGO, GRUPOS_CATALOGO, puedeUsarWidget } from "./widgetRegistry";
import { useAuth } from "@/hooks/useAuth";

/**
 * Barra lateral con el catálogo de módulos disponibles para agregar al tablero.
 *
 * Las tarjetas NO usan drag nativo HTML5 (`draggable`): se arrastran con
 * eventos de puntero (mousedown → mousemove → mouseup), que es un mecanismo
 * determinista. El drag HTML5 resultó no ser confiable aquí — ver el
 * comentario extenso en PersonalizableGrid.jsx, que es quien implementa el
 * resto del gesto. Aquí solo se avisa "empezó un arrastre de este tipo, desde
 * estas coordenadas"; el umbral mínimo de movimiento para distinguir un clic
 * de un arrastre también lo decide el grid.
 *
 * Solo se listan los módulos con `enCatalogo: true` (ver widgetRegistry.js):
 * se habilitan de uno en uno conforme se valida cada módulo dentro de la
 * cuadrícula, para no ofrecer módulos cuyo comportamiento ahí no se ha
 * verificado.
 */
// Sin acentos ni mayúsculas, para que "ocupacion" encuentre "Ocupación".
const normalizar = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function CatalogSidebar({ usedTypes, onIniciarArrastre, onContraer }) {
  const [gruposAbiertos, setGruposAbiertos] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda);
  const { hasAnyPermission, unScope, isLoading: authCargando } = useAuth();

  // Solo los módulos que este rol puede usar de verdad: los que no tenga
  // permitidos —o que todavía no respeten su alcance por Unidad de Negocio—
  // ni siquiera se listan, en vez de ofrecerlos y que al soltarlos respondan
  // 403. Ver `puedeUsarWidget`.
  const disponibles = useMemo(
    () => (authCargando ? [] : WIDGETS_DE_CATALOGO.filter((w) => puedeUsarWidget(w, hasAnyPermission, unScope))),
    [authCargando, hasAnyPermission, unScope]
  );

  // Con búsqueda activa: solo lo que coincide (por nombre del módulo o, en
  // un grupo, por el nombre del grupo — que trae todos sus elementos) y los
  // grupos con coincidencias se muestran abiertos.
  const { sueltos, grupos } = useMemo(() => {
    const coincide = (w) => !q || normalizar(w.label).includes(q);
    return {
      sueltos: disponibles.filter((w) => !w.grupo && coincide(w)),
      grupos: GRUPOS_CATALOGO.map((g) => {
        const todos = disponibles.filter((w) => w.grupo === g.id);
        const items = !q || normalizar(g.label).includes(q) ? todos : todos.filter(coincide);
        return { ...g, items };
      }).filter((g) => g.items.length > 0),
    };
  }, [q, disponibles]);

  const renderTarjeta = (entry, compacta = false) => {
    const Icon = entry.icon;
    const count = usedTypes?.filter((t) => t === entry.type).length || 0;
    return (
      <div
        key={entry.type}
        onMouseDown={(e) => {
          // Solo botón primario; `preventDefault` evita que el navegador
          // inicie una selección de texto mientras se arrastra.
          if (e.button !== 0) return;
          e.preventDefault();
          onIniciarArrastre?.(entry.type, e.clientX, e.clientY);
        }}
        className={`group flex items-center gap-3 ${compacta ? "px-2.5 py-2" : "px-3 py-3"} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 transition-colors select-none`}
        title="Arrastra hacia el tablero"
      >
        <div className={`shrink-0 ${compacta ? "size-7" : "size-8"} rounded-lg bg-[#621f32]/8 dark:bg-[#621f32]/15 flex items-center justify-center text-[#621f32] dark:text-[#bc955c]`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">{entry.label}</p>
          {count > 0 && (
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {count} en el tablero
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70">
        <LayoutGrid className="size-4 text-[#621f32] dark:text-[#bc955c]" />
        <h3 className="flex-1 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Módulos del sistema
        </h3>
        {onContraer && (
          <button
            type="button"
            onClick={onContraer}
            title="Ocultar módulos"
            aria-label="Ocultar módulos"
            className="shrink-0 p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <div className="shrink-0 px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setBusqueda(""); }}
            placeholder="Buscar módulo..."
            aria-label="Buscar módulo"
            className="w-full pl-8 pr-7 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>
      <p className="shrink-0 px-4 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
        Arrastra un módulo hacia el tablero para agregarlo. Puedes repetir el mismo módulo varias veces.
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
        {sueltos.map((entry) => renderTarjeta(entry))}
        {q && sueltos.length === 0 && grupos.length === 0 && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6">
            Ningún módulo coincide con “{busqueda.trim()}”.
          </p>
        )}
        {!q && !authCargando && disponibles.length === 0 && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-6 px-2">
            No hay módulos disponibles para tu perfil.
          </p>
        )}
        {grupos.map((grupo) => {
          const items = grupo.items;
          const abierto = !!q || !!gruposAbiertos[grupo.id];
          const GIcon = grupo.icon;
          const enTablero = items.reduce((n, it) => n + (usedTypes?.filter((t) => t === it.type).length || 0), 0);
          return (
            <div key={grupo.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { if (!q) setGruposAbiertos((prev) => ({ ...prev, [grupo.id]: !prev[grupo.id] })); }}
                aria-expanded={abierto}
                className="flex items-center gap-3 px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-sm hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 transition-colors cursor-pointer text-left"
              >
                <div className="shrink-0 size-8 rounded-lg bg-[#621f32]/8 dark:bg-[#621f32]/15 flex items-center justify-center text-[#621f32] dark:text-[#bc955c]">
                  <GIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{grupo.label}</p>
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {items.length} {items.length === 1 ? "elemento" : "elementos"}{enTablero > 0 ? ` · ${enTablero} en el tablero` : ""}
                  </p>
                </div>
                <ChevronRight className={`size-4 shrink-0 text-slate-400 transition-transform ${abierto ? "rotate-90" : ""}`} />
              </button>
              {abierto && (
                <div className="flex flex-col gap-2 pl-3 ml-4 border-l-2 border-[#bc955c]/40">
                  {items.map((entry) => renderTarjeta(entry, true))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
