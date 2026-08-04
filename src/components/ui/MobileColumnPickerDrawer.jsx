"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * Selector de columna para filtrar, en móvil (`< md`).
 *
 * `ColumnFilterDropdown` ya es un modal centrado a pantalla completa y funciona
 * bien en móvil — el problema era llegar a él: se abría desde el icono de
 * embudo del encabezado de `DataTable`, que vive en `hidden md:flex`. Este
 * drawer es el paso previo: elegir la columna y delegar en el mismo
 * `openFilterDropdown(colKey)` que usa el encabezado en escritorio.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{key: string, label: string, visible?: boolean}>} props.columns
 * @param {Record<string, string[]>} [props.columnFilters] - Para marcar las columnas ya filtradas.
 * @param {Record<string, {value?: string}>} [props.textFilters]
 * @param {(columnKey: string) => void} props.onPick
 * @returns {JSX.Element}
 */
export default function MobileColumnPickerDrawer({
  open,
  onOpenChange,
  columns = [],
  columnFilters = {},
  textFilters = {},
  onPick,
}) {
  const [query, setQuery] = useState("");

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible !== false && c.key),
    [columns]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleColumns;
    return visibleColumns.filter((c) => (c.label || c.key).toLowerCase().includes(q));
  }, [visibleColumns, query]);

  const isFiltered = (key) =>
    (columnFilters?.[key]?.length ?? 0) > 0 || !!textFilters?.[key]?.value;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DrawerTitle className="sr-only">Filtrar por columna</DrawerTitle>
        <DrawerDescription className="sr-only">Elegir la columna a filtrar</DrawerDescription>
        <div className="mx-auto w-full max-w-md">
          <div className="sticky top-0 z-10 bg-popover pt-2 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">
                Filtrar por columna
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
            {filtered.map((col) => {
              const active = isFiltered(col.key);
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => {
                    onOpenChange?.(false);
                    // El drawer se cierra antes de abrir el dropdown: son dos
                    // capas distintas y solaparlas deja el fondo bloqueado.
                    setTimeout(() => onPick?.(col.key), 180);
                  }}
                  className={`flex items-center justify-between gap-3 p-3.5 min-h-[44px] rounded-2xl border text-left transition-colors ${
                    active
                      ? "border-[#621f32]/30 bg-[#621f32]/5"
                      : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 active:bg-white"
                  }`}
                >
                  <span
                    className={`text-sm font-black truncate ${
                      active ? "text-[#621f32] dark:text-[#bc955c]" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {col.label || col.key}
                  </span>
                  {active && <Check className="size-4 text-[#621f32] dark:text-[#bc955c] shrink-0" />}
                </button>
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
