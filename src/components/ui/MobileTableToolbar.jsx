"use client";

import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * Toolbar compacta para móvil (`< md`). Reemplaza la barra densa de las tablas:
 * deja a la vista la búsqueda + 1 acción primaria (p.ej. Excel) y mete el resto
 * de acciones en un Drawer inferior ("Herramientas"). Reusable por los tabs.
 *
 * @param {Object} props
 * @param {string} props.searchValue
 * @param {(value: string) => void} props.onSearch
 * @param {string} [props.searchPlaceholder]
 * @param {number} [props.count] - Contador de registros (chip).
 * @param {string} [props.countLabel]
 * @param {{icon: Function, label: string, onClick: Function, loading?: boolean, disabled?: boolean}} [props.primaryAction]
 * @param {Array<{icon: Function, label: string, onClick: Function, disabled?: boolean, badge?: number}>} [props.actions]
 * @param {JSX.Element} [props.chips] - Chips de filtros activos (scroll horizontal).
 * @returns {JSX.Element}
 */
export default function MobileTableToolbar({
  searchValue = "",
  onSearch,
  searchPlaceholder = "Buscar...",
  count,
  countLabel = "Registros",
  primaryAction,
  actions = [],
  chips = null,
}) {
  const [open, setOpen] = useState(false);
  const PrimaryIcon = primaryAction?.icon;
  const activeActions = actions.filter(Boolean);
  const totalBadge = activeActions.reduce((n, a) => n + (a.badge || 0), 0);

  return (
    <div className="md:hidden flex flex-col gap-2.5 p-4 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center pl-3.5 pr-2 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[#621f32]/10 transition-all">
          <Search className="text-slate-400 size-4 mr-2 shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-transparent text-slate-800 dark:text-slate-100 text-sm font-bold w-full outline-none placeholder-slate-400"
          />
          {searchValue && (
            <button
              onClick={() => onSearch?.("")}
              aria-label="Limpiar búsqueda"
              className="text-slate-400 hover:text-slate-600 ml-1 shrink-0"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            aria-label={primaryAction.label}
            className="shrink-0 size-11 flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] shadow-md active:scale-95 transition-transform disabled:opacity-60"
          >
            {primaryAction.loading ? (
              <span className="size-4 border-2 border-white/30 border-t-white dark:border-[#3e131f]/30 dark:border-t-[#3e131f] rounded-full animate-spin" />
            ) : (
              PrimaryIcon && <PrimaryIcon className="size-4" />
            )}
          </button>
        )}

        {activeActions.length > 0 && (
          <Drawer open={open} onOpenChange={setOpen} direction="bottom">
            <DrawerTrigger
              aria-label="Herramientas y filtros"
              className="relative shrink-0 size-11 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[#621f32] dark:text-[#bc955c] shadow-sm active:scale-95 transition-transform"
            >
              <SlidersHorizontal className="size-4" />
              {totalBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-black text-white bg-[#621f32] dark:bg-[#bc955c] dark:text-[#3e131f] rounded-full">
                  {totalBadge}
                </span>
              )}
            </DrawerTrigger>
            <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <DrawerTitle className="sr-only">Herramientas</DrawerTitle>
              <DrawerDescription className="sr-only">Acciones y filtros de la tabla</DrawerDescription>
              <div className="mx-auto w-full max-w-md">
                <div className="flex items-center justify-between pt-2 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">
                    Herramientas
                  </h3>
                  <DrawerClose className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                    <X className="size-4" />
                  </DrawerClose>
                </div>
                <div className="flex flex-col gap-2">
                  {activeActions.map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.label || i}
                        onClick={() => {
                          a.onClick?.();
                          setOpen(false);
                        }}
                        disabled={a.disabled}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 active:bg-white dark:active:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
                      >
                        {Icon && (
                          <span className="p-2 rounded-xl bg-[#621f32]/8 dark:bg-[#bc955c]/12 text-[#621f32] dark:text-[#bc955c] shrink-0">
                            <Icon className="size-5" />
                          </span>
                        )}
                        <span className="flex-1 text-sm font-black text-slate-800 dark:text-slate-100">
                          {a.label}
                        </span>
                        {a.badge > 0 && (
                          <span className="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-black text-white bg-[#621f32] dark:bg-[#bc955c] dark:text-[#3e131f] rounded-full">
                            {a.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {(typeof count === "number" || chips) && (
        <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {typeof count === "number" && (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20">
              <span className="text-[9px] font-black uppercase text-slate-400">{countLabel}</span>
              <span className="text-xs font-black text-[#621f32] dark:text-[#bc955c]">
                {new Intl.NumberFormat("es-MX").format(count)}
              </span>
            </span>
          )}
          {chips}
        </div>
      )}
    </div>
  );
}
