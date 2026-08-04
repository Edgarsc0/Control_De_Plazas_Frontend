"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check, Search, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * Selector de ordenamiento para móvil (`< md`).
 *
 * En escritorio se ordena tocando el encabezado de la columna en `DataTable`,
 * pero esa tabla vive en `hidden md:flex`: en móvil no había NINGUNA forma de
 * ordenar. Este drawer expone las mismas columnas con ascendente/descendente.
 *
 * Se abre desde una acción de `MobileTableToolbar` (el drawer de herramientas
 * se cierra solo al pulsarla, así que no quedan dos drawers anidados).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{key: string, label: string, visible?: boolean, sortable?: boolean}>} props.columns
 * @param {{key: string|null, direction: 'asc'|'desc'|null}} props.sortConfig
 * @param {(next: {key: string|null, direction: 'asc'|'desc'|null}) => void} props.onSort
 * @returns {JSX.Element}
 */
export default function MobileSortDrawer({
  open,
  onOpenChange,
  columns = [],
  sortConfig = { key: null, direction: null },
  onSort,
}) {
  const [query, setQuery] = useState("");

  const sortableColumns = useMemo(
    () => columns.filter((c) => c.visible !== false && c.sortable !== false && c.key),
    [columns]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortableColumns;
    return sortableColumns.filter((c) => (c.label || c.key).toLowerCase().includes(q));
  }, [sortableColumns, query]);

  const apply = (key, direction) => {
    onSort?.({ key, direction });
    onOpenChange?.(false);
  };

  const dirBtn = (active) =>
    `size-11 flex items-center justify-center rounded-xl border transition-colors ${
      active
        ? "border-[#621f32]/30 bg-[#621f32]/8 text-[#621f32] dark:border-[#bc955c]/30 dark:bg-[#bc955c]/12 dark:text-[#bc955c]"
        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 active:scale-95"
    }`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DrawerTitle className="sr-only">Ordenar</DrawerTitle>
        <DrawerDescription className="sr-only">Elegir columna y sentido de ordenamiento</DrawerDescription>
        <div className="mx-auto w-full max-w-md">
          <div className="sticky top-0 z-10 bg-popover pt-2 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">
                Ordenar
              </h3>
              <DrawerClose className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="size-4" />
              </DrawerClose>
            </div>

            <div className="flex items-center gap-2 pl-3.5 pr-2 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm">
              <Search className="text-slate-400 size-4 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar columna..."
                className="bg-transparent text-slate-800 dark:text-slate-100 text-sm font-bold w-full outline-none placeholder-slate-400"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpiar" className="text-slate-400 shrink-0">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pb-2">
            <button
              type="button"
              onClick={() => apply(null, null)}
              className={`flex items-center justify-between gap-3 p-3.5 min-h-[44px] rounded-2xl border text-left transition-colors ${
                !sortConfig?.key
                  ? "border-[#621f32]/30 bg-[#621f32]/5"
                  : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 active:bg-white"
              }`}
            >
              <span className="text-sm font-black text-slate-800 dark:text-slate-100">Sin orden</span>
              {!sortConfig?.key && <Check className="size-4 text-[#621f32] dark:text-[#bc955c] shrink-0" />}
            </button>

            {filtered.map((col) => {
              const isActive = sortConfig?.key === col.key;
              return (
                <div
                  key={col.key}
                  className={`flex items-center gap-2 p-2 rounded-2xl border ${
                    isActive
                      ? "border-[#621f32]/30 bg-[#621f32]/5"
                      : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50"
                  }`}
                >
                  <span className="flex-1 min-w-0 px-1.5 text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                    {col.label || col.key}
                  </span>
                  <button
                    type="button"
                    onClick={() => apply(col.key, "asc")}
                    aria-label={`Ordenar ${col.label || col.key} ascendente`}
                    className={dirBtn(isActive && sortConfig?.direction === "asc")}
                  >
                    <ArrowUpAZ className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => apply(col.key, "desc")}
                    aria-label={`Ordenar ${col.label || col.key} descendente`}
                    className={dirBtn(isActive && sortConfig?.direction === "desc")}
                  >
                    <ArrowDownAZ className="size-4" />
                  </button>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <p className="py-8 text-center text-xs font-bold text-slate-400">Ninguna columna coincide</p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
