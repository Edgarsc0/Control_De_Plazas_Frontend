"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import DataCard from "./DataCard";

const PAGE_SIZE = 10;

/**
 * Lista de tarjetas paginada para móvil (`< md`). Renderiza el dataset filtrado
 * como tarjetas (`DataCard`) en vez de la tabla densa, con paginación clásica
 * (controles arriba) para no montar miles de nodos. Reusable por los tabs vía
 * `config`.
 *
 * @param {Object} props
 * @param {Object[]} props.data - Dataset ya filtrado/ordenado (completo).
 * @param {Object} props.config - Config de presentación de la tarjeta (ver `DataCard`) + `getRowId`.
 * @param {(row: Object, index: number) => void} [props.onCardClick] - Tap en tarjeta.
 * @param {boolean} [props.isLoading] - Carga inicial → skeletons.
 * @param {boolean} [props.isPending] - Refiltrado en transición → overlay sutil.
 * @param {number} [props.pageSize] - Tarjetas por página.
 * @returns {JSX.Element}
 */
export default function MobileCardList({
  data = [],
  config = {},
  onCardClick,
  isLoading = false,
  isPending = false,
  pageSize = PAGE_SIZE,
}) {
  const [page, setPage] = useState(0);
  const topRef = useRef(null);
  const isFirst = useRef(true);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const slice = useMemo(() => data.slice(start, start + pageSize), [data, start, pageSize]);

  // Reinicia a la página 1 cuando cambia el dataset (nuevo filtro/orden).
  useEffect(() => {
    setPage(0);
  }, [data, pageSize]);

  // Al cambiar de página, sube al inicio de la lista (no en el primer render).
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="skeleton-box h-3.5 w-2/3 rounded" />
                <div className="skeleton-box h-2.5 w-1/3 rounded" />
              </div>
              <div className="skeleton-box h-5 w-16 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="skeleton-box h-2 w-12 rounded" />
                  <div className="skeleton-box h-2.5 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="size-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
          <Search className="size-6 text-slate-400" />
        </div>
        <h4 className="text-base font-black text-slate-700 dark:text-slate-200">Sin coincidencias</h4>
        <p className="text-xs text-slate-500 mt-1">Ajusta los filtros de búsqueda</p>
      </div>
    );
  }

  const goto = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));
  const fmt = (n) => new Intl.NumberFormat("es-MX").format(n);
  const atStart = safePage === 0;
  const atEnd = safePage >= totalPages - 1;

  const navBtn =
    "size-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[#621f32] dark:text-[#bc955c] shadow-sm active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="relative flex flex-col gap-3 p-4">
      <span ref={topRef} className="absolute -top-20" aria-hidden />

      {isPending && (
        <div className="absolute inset-0 z-20 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex items-start justify-center pt-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 px-4 py-2 rounded-full shadow-lg border border-slate-200/50 dark:border-slate-800/50">
            <Loader2 className="size-4 animate-spin text-[#621f32] dark:text-[#bc955c]" />
            <span className="text-[10px] font-black uppercase text-[#621f32] dark:text-[#bc955c]">Procesando</span>
          </div>
        </div>
      )}

      {/* Controles de paginación — arriba */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => goto(0)} disabled={atStart} aria-label="Primera página" className={navBtn}>
            <ChevronsLeft className="size-4" />
          </button>
          <button onClick={() => goto(safePage - 1)} disabled={atStart} aria-label="Página anterior" className={navBtn}>
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="text-center leading-tight min-w-0">
          <span className="block text-[11px] font-black text-slate-700 dark:text-slate-200">
            Página {safePage + 1} de {fmt(totalPages)}
          </span>
          <span className="block text-[9px] font-bold text-slate-400">
            {fmt(start + 1)}–{fmt(Math.min(start + pageSize, data.length))} de {fmt(data.length)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => goto(safePage + 1)} disabled={atEnd} aria-label="Página siguiente" className={navBtn}>
            <ChevronRight className="size-4" />
          </button>
          <button onClick={() => goto(totalPages - 1)} disabled={atEnd} aria-label="Última página" className={navBtn}>
            <ChevronsRight className="size-4" />
          </button>
        </div>
      </div>

      {slice.map((row, i) => (
        <DataCard
          key={config.getRowId ? config.getRowId(row, start + i) : start + i}
          row={row}
          index={i}
          config={config}
          onClick={onCardClick}
        />
      ))}
    </div>
  );
}
