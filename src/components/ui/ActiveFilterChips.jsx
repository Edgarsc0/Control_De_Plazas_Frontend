"use client";

import { Filter, Search, X } from "lucide-react";

/**
 * Chips de filtros activos, reusables en móvil y escritorio.
 *
 * El bloque original vivía inline en `PlantillaDetalleTab` bajo `hidden md:flex`:
 * en móvil, un filtro de columna o avanzado aplicado quedaba invisible y el
 * único indicio era el badge numérico del icono de herramientas. Extraído aquí
 * para renderizarlo en ambos breakpoints (en móvil, como `chips` de
 * `MobileTableToolbar`, que ya es una fila con scroll horizontal).
 *
 * @param {Object} props
 * @param {string} [props.globalSearch]
 * @param {() => void} [props.onClearSearch]
 * @param {Record<string, string[]>} [props.columnFilters]
 * @param {(key: string) => void} [props.onClearColumnFilter]
 * @param {Record<string, {condition: string, value: string}>} [props.textFilters]
 * @param {(key: string) => void} [props.onClearTextFilter]
 * @param {number} [props.advancedCount]
 * @param {() => void} [props.onClearAdvanced]
 * @param {Array<{key: string, label: string}>} [props.columns] - Para resolver etiquetas.
 * @param {(condition: string) => string} [props.getConditionLabel]
 * @param {'row'|'wrap'} [props.layout] - `row` (móvil, scroll horizontal) o `wrap` (escritorio).
 * @returns {JSX.Element|null}
 */
export default function ActiveFilterChips({
  globalSearch = "",
  onClearSearch,
  columnFilters = {},
  onClearColumnFilter,
  textFilters = {},
  onClearTextFilter,
  advancedCount = 0,
  onClearAdvanced,
  columns = [],
  getConditionLabel,
  layout = "row",
}) {
  const textFilterEntries = Object.entries(textFilters).filter(([, f]) => f?.value);
  const columnFilterEntries = Object.entries(columnFilters).filter(([, v]) => v?.length);
  const hasAny =
    !!globalSearch || columnFilterEntries.length > 0 || textFilterEntries.length > 0 || advancedCount > 0;

  if (!hasAny) return null;

  const labelOf = (key) => columns.find((c) => c.key === key)?.label || key;

  const chip =
    "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 min-h-11 rounded-full text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer";

  return (
    <>
      {globalSearch && (
        <button type="button" onClick={onClearSearch} className={chip}>
          <Search className="size-2.5" />
          <span className="max-w-[10rem] truncate">Búsqueda: &quot;{globalSearch}&quot;</span>
          <X className="size-2.5" />
        </button>
      )}

      {columnFilterEntries.map(([colKey, values]) => (
        <button
          key={`cf-${colKey}`}
          type="button"
          onClick={() => onClearColumnFilter?.(colKey)}
          className={chip}
        >
          <span className="max-w-[12rem] truncate">
            {labelOf(colKey)}: {values.length} valor{values.length === 1 ? "" : "es"}
          </span>
          <X className="size-2.5" />
        </button>
      ))}

      {textFilterEntries.map(([colKey, f]) => (
        <button
          key={`tf-${colKey}`}
          type="button"
          onClick={() => onClearTextFilter?.(colKey)}
          className={chip}
        >
          <span className="max-w-[12rem] truncate">
            {labelOf(colKey)} {getConditionLabel ? getConditionLabel(f.condition) : ""}: &quot;{f.value}&quot;
          </span>
          <X className="size-2.5" />
        </button>
      ))}

      {advancedCount > 0 && (
        <button type="button" onClick={onClearAdvanced} className={chip}>
          <Filter className="size-2.5" />
          <span>
            {advancedCount} filtro{advancedCount === 1 ? "" : "s"} avanzado
            {advancedCount === 1 ? "" : "s"}
          </span>
          <X className="size-2.5" />
        </button>
      )}
    </>
  );
}
