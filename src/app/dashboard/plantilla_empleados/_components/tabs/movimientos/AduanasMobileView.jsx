"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Filter, Search, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * Vista móvil (`< md`) de "Aduanas: Ocupación vs Vacantes".
 *
 * La matriz de escritorio mide ~8 000px de ancho (50 aduanas × ~25 niveles × 2
 * columnas): en móvil sólo se veía la columna sticky de nombres y el resto
 * exigía recorrer 8 000px en horizontal sin encabezado de contexto. Aquí cada
 * aduana es una tarjeta con sus totales, y al tocarla se abre el desglose por
 * Nivel Jerárquico / Nivel en vertical — con los mismos taps a detalle que las
 * celdas de la tabla.
 *
 * @param {Object} props
 * @param {Array<{nj: string, label: string, niveles: string[]}>} props.gruposNj
 * @param {Array<{aduana: string, ocupacion: Object, vacancia: Object}>} props.filas
 * @param {Map<string, {ocup: number, vac: number}>} props.filaTotales
 * @param {boolean} [props.loading]
 * @param {boolean} [props.aduanaFilterActive]
 * @param {() => void} props.onOpenAduanaFilter
 * @param {(aduana: string, nj: string, nivel: string, tipo: 'ocupacion'|'vacancia') => void} props.onCellClick
 * @param {(aduana: string, tipo: 'ocupacion'|'vacancia') => void} props.onRowTotalClick
 * @param {React.ReactNode} [props.headerRight] - Acción primaria (Excel).
 * @returns {JSX.Element}
 */
export default function AduanasMobileView({
  gruposNj = [],
  filas = [],
  filaTotales,
  loading = false,
  aduanaFilterActive = false,
  onOpenAduanaFilter,
  onCellClick,
  onRowTotalClick,
  headerRight,
}) {
  const [query, setQuery] = useState("");
  const [detalleAduana, setDetalleAduana] = useState(null);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.aduana.toLowerCase().includes(q));
  }, [filas, query]);

  const detalleGrupos = useMemo(() => {
    if (!detalleAduana) return [];
    const row = filas.find((f) => f.aduana === detalleAduana);
    if (!row) return [];
    return gruposNj
      .map((g) => {
        const niveles = g.niveles
          .map((nivel) => {
            const key = `${g.nj}|${nivel}`;
            return { nivel, ocup: row.ocupacion?.[key] ?? 0, vac: row.vacancia?.[key] ?? 0 };
          })
          // Sin dato en ningún sentido no aporta: en móvil, ocultar los ceros
          // deja el desglose en unas pocas filas legibles.
          .filter((n) => n.ocup > 0 || n.vac > 0);
        return { ...g, nivelesConDato: niveles };
      })
      .filter((g) => g.nivelesConDato.length > 0);
  }, [detalleAduana, filas, gruposNj]);

  const totales = (aduana) => filaTotales?.get?.(aduana) ?? { ocup: 0, vac: 0 };

  return (
    <div className="md:hidden">
      <div className="flex flex-col gap-2.5 p-4 border-b border-slate-200/60 bg-slate-50/40">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center pl-3.5 pr-2 py-2.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <Search className="text-slate-400 size-4 mr-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar aduana..."
              className="bg-transparent text-slate-800 text-sm font-bold w-full outline-none placeholder-slate-400"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="text-slate-400 shrink-0">
                <X className="size-4" />
              </button>
            )}
          </div>
          {headerRight}
          <button
            type="button"
            onClick={onOpenAduanaFilter}
            aria-label="Filtrar aduanas"
            className={`shrink-0 size-11 flex items-center justify-center rounded-2xl border shadow-sm active:scale-95 transition-transform ${
              aduanaFilterActive
                ? "bg-[#621f32] text-white border-[#621f32]"
                : "bg-white text-[#621f32] border-slate-200"
            }`}
          >
            <Filter className="size-4" />
          </button>
        </div>
        <span className="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#621f32]/5 border border-[#621f32]/10">
          <span className="text-[9px] font-black uppercase text-slate-400">Aduanas</span>
          <span className="text-xs font-black text-[#621f32]">{filtradas.length}</span>
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-slate-200/70 bg-white skeleton-box" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-16 text-center text-xs font-bold text-slate-400">Sin coincidencias</p>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {filtradas.map((row) => {
            const t = totales(row.aduana);
            const total = t.ocup + t.vac;
            const pct = total > 0 ? Math.round((t.ocup / total) * 100) : 0;
            return (
              <button
                key={row.aduana}
                type="button"
                onClick={() => setDetalleAduana(row.aduana)}
                className="w-full text-left rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-sm font-black text-slate-800 leading-tight">{row.aduana}</h3>
                  <ChevronRight className="size-4 text-slate-300 shrink-0 mt-0.5" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="rounded-xl bg-[#621f32]/[0.06] px-3 py-2">
                    <span className="block text-[9px] font-black uppercase text-slate-400">Ocupadas</span>
                    <span className="block text-lg font-black text-[#621f32] leading-none mt-0.5">{t.ocup}</span>
                  </div>
                  <div className="rounded-xl bg-[#bc955c]/[0.12] px-3 py-2">
                    <span className="block text-[9px] font-black uppercase text-slate-400">Vacantes</span>
                    <span className="block text-lg font-black text-[#8a6739] leading-none mt-0.5">{t.vac}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#bc955c]/25 overflow-hidden">
                  <div className="h-full rounded-full bg-[#621f32]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                  {pct}% ocupación · {total} plaza{total === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Desglose por Nivel Jerárquico / Nivel de la aduana tocada. */}
      <Drawer open={!!detalleAduana} onOpenChange={(o) => !o && setDetalleAduana(null)} direction="bottom">
        <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{detalleAduana || "Aduana"}</DrawerTitle>
          <DrawerDescription className="sr-only">Desglose por nivel jerárquico</DrawerDescription>
          <div className="mx-auto w-full max-w-md">
            <div className="sticky top-0 z-10 bg-popover pt-2 pb-3 flex items-start justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#621f32] leading-tight">
                {detalleAduana}
              </h3>
              <DrawerClose className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 shrink-0">
                <X className="size-4" />
              </DrawerClose>
            </div>

            {detalleAduana && (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { onRowTotalClick?.(detalleAduana, "ocupacion"); setDetalleAduana(null); }}
                  disabled={totales(detalleAduana).ocup === 0}
                  className="flex-1 min-h-11 rounded-2xl bg-[#621f32]/[0.06] px-3 py-2 text-left disabled:opacity-50"
                >
                  <span className="block text-[9px] font-black uppercase text-slate-400">Total ocupadas</span>
                  <span className="block text-base font-black text-[#621f32] leading-none mt-0.5">
                    {totales(detalleAduana).ocup}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { onRowTotalClick?.(detalleAduana, "vacancia"); setDetalleAduana(null); }}
                  disabled={totales(detalleAduana).vac === 0}
                  className="flex-1 min-h-11 rounded-2xl bg-[#bc955c]/[0.12] px-3 py-2 text-left disabled:opacity-50"
                >
                  <span className="block text-[9px] font-black uppercase text-slate-400">Total vacantes</span>
                  <span className="block text-base font-black text-[#8a6739] leading-none mt-0.5">
                    {totales(detalleAduana).vac}
                  </span>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 pb-2">
              {detalleGrupos.map((g) => (
                <div key={g.nj} className="rounded-2xl border border-slate-200/70 overflow-hidden">
                  <div className="px-3 py-2 bg-[#40121e] text-white text-[10px] font-black uppercase tracking-wider">
                    {g.label}
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 bg-slate-50">
                      <span className="text-[9px] font-black uppercase text-slate-400">Nivel</span>
                      <span className="w-14 text-center text-[9px] font-black uppercase text-[#621f32]">Ocup.</span>
                      <span className="w-14 text-center text-[9px] font-black uppercase text-[#8a6739]">Vac.</span>
                    </div>
                    {g.nivelesConDato.map((n) => (
                      <div key={n.nivel} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 items-center">
                        <span className="text-xs font-bold text-slate-700 truncate">{n.nivel}</span>
                        <button
                          type="button"
                          disabled={n.ocup === 0}
                          onClick={() => { onCellClick?.(detalleAduana, g.nj, n.nivel, "ocupacion"); setDetalleAduana(null); }}
                          className="w-14 h-11 rounded-lg text-sm font-black text-[#621f32] bg-[#621f32]/[0.06] disabled:opacity-30 disabled:bg-transparent disabled:text-slate-300 active:scale-95 transition-transform"
                        >
                          {n.ocup}
                        </button>
                        <button
                          type="button"
                          disabled={n.vac === 0}
                          onClick={() => { onCellClick?.(detalleAduana, g.nj, n.nivel, "vacancia"); setDetalleAduana(null); }}
                          className="w-14 h-11 rounded-lg text-sm font-black text-[#8a6739] bg-[#bc955c]/[0.12] disabled:opacity-30 disabled:bg-transparent disabled:text-slate-300 active:scale-95 transition-transform"
                        >
                          {n.vac}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {detalleGrupos.length === 0 && (
                <p className="py-8 text-center text-xs font-bold text-slate-400">
                  Esta aduana no tiene plazas registradas
                </p>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
