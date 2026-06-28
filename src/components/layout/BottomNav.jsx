'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTabs } from '@/context/PageTabsContext';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  FileText,
  LayoutGrid,
  Calculator,
  GitFork,
  Database,
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

// 4 accesos principales + "Más". El resto de módulos vive en el Drawer.
const PRIMARY = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/ocupacion_plazas_por_oficio', label: 'Ocupación', icon: BarChart3 },
  { href: '/dashboard/plantilla_empleados', label: 'Plantilla', icon: Users },
  { href: '/dashboard/oficios_turnados_do', label: 'Oficios', icon: FileText },
];

const MORE = [
  {
    href: '/dashboard/valuacion_presupuestaria',
    label: 'Valuación Presupuestaria',
    desc: 'Simulador de costos',
    icon: Calculator,
    color: '#9333ea',
  },
  {
    href: '/dashboard/organigrama',
    label: 'Organigrama ANAM',
    desc: '13 unidades · 1,365 áreas',
    icon: GitFork,
    color: '#7c3aed',
  },
  {
    href: '/dashboard/monitoreo_zafiro',
    label: 'Monitoreo ZAFIRO',
    desc: 'Bitácora de actualizaciones',
    icon: Database,
    color: '#0ea5e9',
  },
];

export default function BottomNav() {
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pageTabsOpen, setPageTabsOpen] = useState(false);
  const { activeConfig } = usePageTabs();

  // Sólo navegación de dashboard: si no hay sesión, no se muestra.
  if (!isAuthenticated) return null;

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
      <div className="grid grid-cols-5 h-16">
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
                onClick={() => setPageTabsOpen(true)}
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

        <Drawer open={moreOpen} onOpenChange={setMoreOpen} direction="bottom">
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

              <div className="flex flex-col gap-2">
                {MORE.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                        active
                          ? 'border-[#621f32]/30 bg-[#621f32]/5'
                          : 'border-slate-100 bg-slate-50/70 active:bg-white'
                      }`}
                    >
                      <span
                        className="p-2 rounded-xl shrink-0"
                        style={{ backgroundColor: `${item.color}1a` }}
                      >
                        <item.icon className="size-5" style={{ color: item.color }} />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-black text-slate-800">{item.label}</span>
                        <span className="text-[11px] text-slate-400">{item.desc}</span>
                      </span>
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
            <div className="flex items-center justify-between pt-2 pb-3">
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
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPageTabsOpen(false);
                      activeConfig.onSelect(tab.id);
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
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  );
}
