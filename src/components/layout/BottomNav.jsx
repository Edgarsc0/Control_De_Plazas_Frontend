'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTabs } from '@/context/PageTabsContext';
import { getVisibleModules } from '@/config/modules';
import {
  LayoutGrid,
  LogOut,
  X,
  Check,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';

export default function BottomNav() {
  const auth = useAuth();
  const { isAuthenticated, email, role, logout } = auth;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pageTabsOpen, setPageTabsOpen] = useState(false);
  const { activeConfig, openSignal } = usePageTabs();
  const activeTabRef = useRef(null);

  // Al abrir el drawer de secciones, deja a la vista el tab activo. La lista
  // puede pasar del alto del drawer (7 tabs + los 7 subtabs de Catálogos) y sin
  // esto el usuario aterriza siempre arriba del todo. El timeout espera a que
  // termine la animación de entrada de vaul (si no, mide posiciones en pleno
  // translateY y el scroll queda mal).
  useEffect(() => {
    if (!pageTabsOpen) return;
    const t = setTimeout(() => {
      activeTabRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 260);
    return () => clearTimeout(t);
  }, [pageTabsOpen]);

  // Abre el drawer de secciones y cierra "Más" si estaba abierto. vaul
  // guarda la posición de scroll a restaurar en una variable a nivel de
  // módulo COMPARTIDA por todas las instancias de Drawer.Root de la página
  // (ver usePositionFixed en vaul, gateado a Safari/iOS): si este drawer y el
  // de "Más" llegan a tener transiciones de apertura/cierre solapadas, ese
  // estado se corrompe y el resultado es el overlay con blur abriendo pero
  // el contenido del sheet sin desplegarse hasta un segundo toque. Forzar
  // que nunca haya más de un Drawer abierto a la vez evita la carrera.
  const openPageTabsDrawer = useCallback(() => {
    setMoreOpen(false);
    setPageTabsOpen(true);
  }, []);

  // La página puede pedir abrir el drawer de secciones (breadcrumb del header).
  useEffect(() => {
    if (openSignal > 0) openPageTabsDrawer();
  }, [openSignal, openPageTabsDrawer]);

  // Sólo navegación de dashboard: si no hay sesión, no se muestra.
  if (!isAuthenticated) return null;

  // 4 accesos principales (los que caben en la barra) + "Más" con el resto,
  // filtrados por permiso — ver src/config/modules.js.
  const visibleModules = getVisibleModules(auth);
  const PRIMARY = visibleModules.filter((m) => m.primary);
  const MORE = visibleModules.filter((m) => !m.primary);

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const moreActive = MORE.some((i) => pathname.startsWith(i.href));

  const itemClass =
    'relative flex flex-col items-center justify-center gap-1 outline-none group';
  const labelClass = (active) =>
    `text-[10px] font-bold tracking-tight ${active ? 'text-[#621f32]' : 'text-slate-400'}`;
  const iconClass = (active) =>
    `size-[22px] transition-colors ${active ? 'text-[#621f32]' : 'text-slate-400 group-hover:text-slate-600'}`;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {/* Cols dinámicas: PRIMARY puede tener menos de 4 ítems según permisos */}
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${PRIMARY.length + 1}, minmax(0, 1fr))` }}
      >
        {PRIMARY.map((item) => {
          const active = isActive(item);
          const asTabs = active && activeConfig?.tabs?.length > 0;
          const inner = (
            <>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-[#621f32] to-[#bc955c]" />
              )}
              <item.icon className={iconClass(active)} strokeWidth={active ? 2.4 : 2} />
              <span className={labelClass(active)}>{item.label}</span>
            </>
          );
          // En la página activa con tabs registrados, el ítem abre un Drawer con
          // sus secciones en vez de re-navegar a la misma ruta.
          if (asTabs) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={openPageTabsDrawer}
                className={itemClass}
                aria-haspopup="dialog"
                aria-label={`Secciones de ${item.label}`}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link key={item.href} href={item.href} className={itemClass}>
              {inner}
            </Link>
          );
        })}

        <Drawer
          open={moreOpen}
          onOpenChange={(open) => {
            setMoreOpen(open);
            if (open) setPageTabsOpen(false);
          }}
          direction="bottom"
        >
          <DrawerTrigger className={itemClass} aria-label="Más módulos">
            {moreActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-[#621f32] to-[#bc955c]" />
            )}
            <LayoutGrid className={iconClass(moreActive)} strokeWidth={moreActive ? 2.4 : 2} />
            <span className={labelClass(moreActive)}>Más</span>
          </DrawerTrigger>

          <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only">Más módulos</DrawerTitle>
            <DrawerDescription className="sr-only">Navegación a módulos adicionales</DrawerDescription>
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-center justify-between pt-2 pb-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#621f32]">
                  Más módulos
                </h3>
                <DrawerClose className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                  <X className="size-4" />
                </DrawerClose>
              </div>

              {email && (
                <div className="flex flex-col gap-0.5 p-3 mb-3 rounded-2xl border border-[#621f32]/15 bg-[#621f32]/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sesión iniciada</span>
                  <span className="text-sm font-black text-[#621f32] truncate">{email}</span>
                  {role && <span className="text-[11px] font-bold text-[#621f32]/70">{role}</span>}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {MORE.map((item) => {
                  const active = pathname.startsWith(item.href);
                  // Si ya estamos en la página del módulo y ésta registró tabs,
                  // el ítem abre el Drawer de secciones en vez de re-navegar:
                  // los módulos "Más" no tienen ícono propio en la barra, así
                  // que sin esto sus tabs/subtabs quedaban inalcanzables en móvil.
                  const asTabs = active && activeConfig?.tabs?.length > 0;
                  const cardClass = `flex items-center gap-3 p-3 rounded-2xl border transition-colors w-full text-left ${
                    active
                      ? 'border-[#621f32]/30 bg-[#621f32]/5'
                      : 'border-slate-100 bg-slate-50/70 active:bg-white'
                  }`;
                  const inner = (
                    <>
                      <span
                        className="p-2 rounded-xl shrink-0"
                        style={{ backgroundColor: `${item.color}1a` }}
                      >
                        <item.icon className="size-5" style={{ color: item.color }} />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{item.title}</span>
                        <span className="text-[11px] text-slate-400">
                          {asTabs ? 'Ver secciones' : item.description}
                        </span>
                      </span>
                    </>
                  );
                  if (asTabs) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={openPageTabsDrawer}
                        className={cardClass}
                      >
                        {inner}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cardClass}
                    >
                      {inner}
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#621f32] text-white font-black text-sm active:scale-95 transition-transform"
              >
                <LogOut className="size-4" /> Cerrar Sesión
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Drawer de secciones de la página activa (abre desde su ítem del BottomNav) */}
      <Drawer open={pageTabsOpen} onOpenChange={setPageTabsOpen} direction="bottom">
        <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{activeConfig?.title || 'Secciones'}</DrawerTitle>
          <DrawerDescription className="sr-only">Cambiar de sección</DrawerDescription>
          <div className="mx-auto w-full max-w-md">
            {/* Sticky: la lista puede ser larga (7 tabs + 7 subtabs en Catálogos)
                y al desplazarla se perdían el título y la ✕ de cerrar. */}
            <div className="sticky top-0 z-10 flex items-center justify-between pt-2 pb-3 bg-popover">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#621f32]">
                {activeConfig?.title || 'Secciones'}
              </h3>
              <DrawerClose className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="size-4" />
              </DrawerClose>
            </div>

            <div className="flex flex-col gap-2">
              {activeConfig?.tabs?.map((tab) => {
                const active = tab.id === activeConfig.activeTab;
                const subtabConfig = activeConfig.subtabConfigs?.[tab.id];
                return (
                  <div
                    key={tab.id}
                    // Al abrir el drawer se centra el tab activo: con la lista
                    // larga el usuario aterrizaba arriba del todo sin ver dónde
                    // estaba parado.
                    ref={active ? activeTabRef : undefined}
                    className="flex flex-col gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!active) activeConfig.onSelect(tab.id);
                        // Si el tab tiene subtabs, se dejan ver en vez de cerrar
                        // el drawer de inmediato (el usuario aún debe elegir uno).
                        if (!subtabConfig) setPageTabsOpen(false);
                      }}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left transition-colors ${
                        active
                          ? 'border-[#621f32]/30 bg-[#621f32]/5'
                          : 'border-slate-100 bg-slate-50/70 active:bg-white'
                      }`}
                    >
                      <span className={`text-sm font-black ${active ? 'text-[#621f32]' : 'text-slate-800'}`}>
                        {tab.label}
                      </span>
                      {active && <Check className="size-4 text-[#621f32] flex-shrink-0" />}
                    </button>

                    {active && subtabConfig && (
                      <div className="ml-3 flex flex-col gap-1 pl-3 border-l-2 border-[#621f32]/15">
                        {subtabConfig.options.map((sub) => {
                          const isSubActive = subtabConfig.active === sub.id;
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                subtabConfig.setActive(sub.id);
                                setPageTabsOpen(false);
                              }}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl border text-left transition-colors ${
                                isSubActive
                                  ? 'border-[#621f32]/20 bg-[#621f32]/5'
                                  : 'border-transparent bg-slate-50/50 active:bg-white'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {SubIcon && (
                                  <SubIcon className={`size-3.5 shrink-0 ${isSubActive ? 'text-[#621f32]' : 'text-slate-400'}`} />
                                )}
                                <span className={`text-[13px] font-bold ${isSubActive ? 'text-[#621f32]' : 'text-slate-600'}`}>
                                  {sub.label}
                                </span>
                              </span>
                              {isSubActive && <Check className="size-3.5 text-[#621f32] flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  );
}
