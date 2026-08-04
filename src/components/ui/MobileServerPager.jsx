"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Paginador de servidor para móvil (`< md`).
 *
 * Los tabs que paginan contra el backend (Movimientos de Personal, Comprobar
 * Alineación, Mov. Posiciones en modo histórico) tenían su paginador dentro de
 * la toolbar densa `hidden md:flex`: en móvil desaparecía y `MobileCardList`
 * sólo podía recorrer la PÁGINA ACTUAL del servidor — 50 filas de 152 526 en el
 * peor caso. Este componente expone esa navegación en móvil.
 *
 * Nota: la lista de tarjetas debe recibir `pageSize` igual al del servidor para
 * que no vuelva a paginar por dentro; si no, el usuario vería dos paginadores
 * encadenados.
 *
 * @param {Object} props
 * @param {number} props.page - Página actual (1-indexada, como el backend).
 * @param {number} props.totalPages
 * @param {number} props.count - Total de registros del servidor (no de la página).
 * @param {(page: number) => void} props.onPage
 * @param {number} [props.pageSize]
 * @param {(size: number) => void} [props.onPageSize] - Si se omite, no se muestra el selector.
 * @param {number[]} [props.pageSizeOptions]
 * @param {boolean} [props.loading]
 * @returns {JSX.Element|null}
 */
export default function MobileServerPager({
  page = 1,
  totalPages = 1,
  count = 0,
  onPage,
  pageSize,
  onPageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  loading = false,
}) {
  // Sin nada que paginar no se ocupa espacio (p.ej. Mov. Posiciones en modo
  // `is_latest`, donde el dataset llega completo en una sola página).
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * (pageSize || 0) + 1;
  const to = Math.min(safePage * (pageSize || 0), count);

  const navBtn =
    "size-11 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[#621f32] dark:text-[#bc955c] active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none";

  return (
    <div className="md:hidden flex flex-col gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage?.(1)}
            disabled={safePage === 1 || loading}
            aria-label="Primera página"
            className={navBtn}
          >
            <ChevronsLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPage?.(Math.max(1, safePage - 1))}
            disabled={safePage === 1 || loading}
            aria-label="Página anterior"
            className={navBtn}
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="flex flex-col items-center leading-tight min-w-0">
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap">
            Página {new Intl.NumberFormat("es-MX").format(safePage)} de{" "}
            {new Intl.NumberFormat("es-MX").format(totalPages)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
            {count > 0
              ? `${new Intl.NumberFormat("es-MX").format(from)}–${new Intl.NumberFormat("es-MX").format(to)} de ${new Intl.NumberFormat("es-MX").format(count)}`
              : "Sin registros"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage?.(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages || loading}
            aria-label="Página siguiente"
            className={navBtn}
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onPage?.(totalPages)}
            disabled={safePage === totalPages || loading}
            aria-label="Última página"
            className={navBtn}
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Salto directo + tamaño de página: con 3 051 páginas los botones de
          ‹ › no bastan para llegar a ningún sitio. */}
      <div className="flex items-center justify-center gap-3">
        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
          Ir a
          <input
            type="number"
            min={1}
            max={totalPages}
            value={safePage}
            disabled={loading}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= totalPages) onPage?.(n);
            }}
            className="w-16 h-9 px-2 text-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-black text-[12px] text-[#621f32] dark:text-[#bc955c] outline-none"
          />
        </label>

        {onPageSize && (
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
            Por pág.
            <select
              value={pageSize}
              disabled={loading}
              onChange={(e) => {
                onPageSize(Number(e.target.value));
                onPage?.(1);
              }}
              className="h-9 px-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-black text-[12px] text-[#621f32] dark:text-[#bc955c] outline-none"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
