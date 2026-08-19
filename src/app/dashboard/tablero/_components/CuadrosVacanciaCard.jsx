"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, ChevronsDownUp, ChevronsUpDown, Loader2 } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";

// Mismas columnas y mismo criterio de "año actual"/"fila más reciente" que la
// sección "Cuadros de Vacancia" de CuadrosVacanciaTab.jsx (plantilla_empleados)
// — versión sin filtros Año/Qna. ni exportación (no aplica a un tablero
// ejecutivo conciso), con una diferencia de layout deliberada: aquí expandir
// NO empuja el contenido de abajo (las barras de búsqueda) — el histórico
// completo flota por encima en un overlay con su propio scroll (ver más
// abajo), para que el tablero nunca cambie de tamaño ni haga scroll de
// página completa.

const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString("en-US");
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  const date = new Date(year, month - 1, day);
  const monthStr = date.toLocaleDateString("es-MX", { month: "long" });
  const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
  return `${date.getDate().toString().padStart(2, "0")} ${capitalizedMonth}, ${year}`;
};

const getYear = (dateStr) => (dateStr ? dateStr.split("-")[0] : "");

function HeaderRows() {
  return (
    <>
      <tr>
        <th colSpan={2} className="bg-gradient-to-br from-[#10243e] to-[#1a3b63] px-2 py-1.5 text-center font-black text-[9px] uppercase tracking-widest border-b border-white/10">
          Periodo
        </th>
        <th colSpan={3} className="bg-gradient-to-br from-emerald-700 to-emerald-800 px-2 py-1.5 text-center font-black text-[9px] uppercase tracking-widest border-b border-l border-white/10">
          Ocupadas
        </th>
        <th colSpan={3} className="bg-gradient-to-br from-[#621f32] to-[#7a2740] px-2 py-1.5 text-center font-black text-[9px] uppercase tracking-widest border-b border-l border-white/10">
          Vacantes
        </th>
        <th colSpan={3} className="bg-gradient-to-br from-[#8a6739] to-[#bc955c] text-[#10243e] px-2 py-1.5 text-center font-black text-[9px] uppercase tracking-widest border-b border-l border-[#10243e]/15">
          Total
        </th>
      </tr>
      <tr className="bg-[#10243e]">
        <th className="sticky left-0 z-30 w-14 bg-[#10243e] border-b border-r border-white/10 px-2 py-1.5 text-center font-bold text-[9px] uppercase tracking-wider">Año</th>
        <th className="sticky left-14 z-30 bg-[#10243e] border-b border-r-2 border-white/15 px-2 py-1.5 text-center font-bold text-[9px] uppercase tracking-wider">Qna.</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Permanente</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Eventual</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-black text-[9px] uppercase bg-white/10">Total</th>
        <th className="border-b border-l border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Permanente</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Eventual</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-black text-[9px] uppercase bg-white/10">Total</th>
        <th className="border-b border-l border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Permanente</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-semibold text-[9px] uppercase text-white/75">Eventual</th>
        <th className="border-b border-white/10 px-1.5 py-1.5 text-center font-black text-[9px] uppercase bg-white/10">Total</th>
      </tr>
    </>
  );
}

function VacanciaRow({ row, isMostRecent, isEvenRow, isNewYear, rowSpan, theadHeight }) {
  return (
    <tr
      className={`transition-colors ${
        isMostRecent ? "bg-[#bc955c]/10 dark:bg-[#bc955c]/15" : isEvenRow ? "bg-slate-50/60 dark:bg-slate-800/25" : ""
      }`}
    >
      {isNewYear && (
        <td
          rowSpan={rowSpan}
          className={`sticky left-0 z-10 w-14 p-0 align-top border-b border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-extrabold ${
            isMostRecent ? "bg-[#f5efe7] dark:bg-[#3a3737]" : "bg-white dark:bg-slate-900"
          }`}
        >
          <div className="sticky flex items-center justify-center px-2 py-2" style={{ top: theadHeight }}>
            {getYear(row.fecha)}
          </div>
        </td>
      )}
      <td
        className={`sticky left-14 z-10 px-2 py-2 text-center border-b border-r-2 border-slate-200 dark:border-slate-800 whitespace-nowrap font-extrabold text-[11px] ${
          isMostRecent
            ? "bg-[#f5efe7] dark:bg-[#3a3737] text-[#621f32] dark:text-[#bc955c]"
            : isEvenRow
              ? "bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        }`}
      >
        <div className="flex items-center justify-center gap-1.5">
          {formatDate(row.fecha)}
          {isMostRecent && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-black bg-[#10243e] text-white dark:bg-[#bc955c] dark:text-[#10243e]">
              ACTUAL
            </span>
          )}
        </div>
      </td>

      <td className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.ocupadas_permanente)}
      </td>
      <td className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.ocupadas_eventual)}
      </td>
      <td className={`px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold tabular-nums text-[11px] ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-emerald-50/40 dark:bg-emerald-500/[0.06]"}`}>
        {formatNumber(row.ocupadas_total)}
      </td>

      <td className="px-2 py-2 text-center border-b border-l border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.vacantes_permanente)}
      </td>
      <td className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.vacantes_eventual)}
      </td>
      <td className={`px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold tabular-nums text-[11px] ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-[#621f32]/[0.04] dark:bg-[#621f32]/10"}`}>
        {formatNumber(row.vacantes_total)}
      </td>

      <td className="px-2 py-2 text-center border-b border-l border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.total_permanente)}
      </td>
      <td className="px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums text-[11px]">
        {formatNumber(row.total_eventual)}
      </td>
      <td className={`px-2 py-2 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-900 dark:text-white font-black tabular-nums text-[11px] ${isMostRecent ? "bg-[#bc955c]/30 dark:bg-[#bc955c]/45" : "bg-[#bc955c]/[0.08]"}`}>
        {formatNumber(row.total)}
      </td>
    </tr>
  );
}

export default function CuadrosVacanciaCard() {
  const [cuadrosData, setCuadrosData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [theadHeight, setTheadHeight] = useState(0);
  const [overlayRect, setOverlayRect] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 });

  const wrapperRef = useRef(null);
  const cardRef = useRef(null);
  const overlayTheadRef = useRef(null);

  // El overlay se posiciona `fixed` (no `absolute`) a partir del rect real de
  // la tarjeta colapsada — mismo criterio que los dropdowns de filtro Año/Qna.
  // en CuadrosVacanciaTab.jsx (getBoundingClientRect + fixed). Así escapa por
  // completo del `overflow-hidden` del layout del tablero (necesario para que
  // ESE nunca haga scroll de página) en vez de quedar recortado por él.
  useEffect(() => {
    if (!isExpanded) return;
    const updateRect = () => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 16;
      setOverlayRect({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(160, window.innerHeight - rect.bottom - margin),
      });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [isExpanded]);

  useEffect(() => {
    let active = true;
    VacantesService.getCuadroVacancia()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el cuadro de vacancia."))))
      .then((data) => { if (active) setCuadrosData(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el cuadro de vacancia."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  // Alto real del thead del overlay (sticky), para anclar debajo de él la
  // celda "Año" de cada bloque — mismo criterio que CuadrosVacanciaTab.jsx.
  useEffect(() => {
    if (!isExpanded) return;
    const el = overlayTheadRef.current;
    if (!el) return;
    const measure = () => setTheadHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded]);

  // Cierra el overlay al hacer clic fuera — mismo criterio que los dropdowns
  // de filtro en CuadrosVacanciaTab.jsx.
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setIsExpanded(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const sortedDescData = useMemo(
    () => [...cuadrosData].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [cuadrosData]
  );

  const yearSpans = useMemo(() => {
    const spans = {};
    let currentYear = null;
    let count = 0;
    for (let i = 0; i < sortedDescData.length; i++) {
      const year = getYear(sortedDescData[i].fecha);
      if (year !== currentYear) {
        if (currentYear !== null) spans[i - count] = count;
        currentYear = year;
        count = 1;
      } else {
        count++;
      }
    }
    if (currentYear !== null && sortedDescData.length > 0) spans[sortedDescData.length - count] = count;
    return spans;
  }, [sortedDescData]);

  const mostRecentRow = sortedDescData[0];

  return (
    <div ref={wrapperRef} className="relative w-full px-4 sm:px-6 pt-4 shrink-0">
      <div ref={cardRef} className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-md overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="p-2 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-xl text-white shrink-0">
            <LayoutDashboard className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-800 dark:text-white tracking-tight truncate">
              Cuadros de Vacancia
            </h2>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
              Histórico de ocupación de las plazas objetivo
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-white sticky top-0 z-20">
              <HeaderRows />
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">
                    <Loader2 className="size-4 animate-spin inline-block mr-2" />
                    Cargando...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-red-600 dark:text-red-400 font-bold text-xs">
                    {error}
                  </td>
                </tr>
              ) : !mostRecentRow ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-450 dark:text-slate-500 font-bold">
                    Sin datos
                  </td>
                </tr>
              ) : (
                <VacanciaRow row={mostRecentRow} isMostRecent isEvenRow={false} isNewYear rowSpan={1} theadHeight={0} />
              )}
            </tbody>
          </table>
        </div>

        {sortedDescData.length > 1 && (
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-[#10243e] dark:hover:text-[#bc955c] hover:bg-slate-50 dark:hover:bg-slate-800/60 border-t border-slate-200/60 dark:border-slate-800/60 transition-all cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronsDownUp className="size-3" />
                <span>Contraer histórico</span>
              </>
            ) : (
              <>
                <ChevronsUpDown className="size-3" />
                <span>Ver histórico completo ({sortedDescData.length - 1} registros más)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Overlay del histórico completo: `fixed` (ver cálculo de overlayRect
          arriba) para escapar del `overflow-hidden` del layout del tablero,
          con su propio scroll vertical acotado al espacio real de viewport
          que queda debajo de la tarjeta — nunca desplaza las barras de
          búsqueda ni hace scroll la página completa. */}
      {isExpanded && (
        <div
          style={{ top: overlayRect.top, left: overlayRect.left, width: overlayRect.width, maxHeight: overlayRect.maxHeight }}
          className="fixed z-40 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 border border-t-0 border-slate-200/80 dark:border-slate-800/80 rounded-b-2xl shadow-2xl"
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead ref={overlayTheadRef} className="text-white sticky top-0 z-20">
              <HeaderRows />
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              {sortedDescData.map((row, index) => (
                <VacanciaRow
                  key={row.id || index}
                  row={row}
                  isMostRecent={row.id === mostRecentRow?.id}
                  isEvenRow={index % 2 === 1}
                  isNewYear={yearSpans[index] !== undefined}
                  rowSpan={yearSpans[index]}
                  theadHeight={theadHeight}
                />
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-[#10243e] dark:hover:text-[#bc955c] hover:bg-slate-50 dark:hover:bg-slate-800/60 border-t border-slate-200/60 dark:border-slate-800/60 transition-all cursor-pointer sticky bottom-0 bg-white dark:bg-slate-900"
          >
            <ChevronsDownUp className="size-3" />
            <span>Contraer histórico</span>
          </button>
        </div>
      )}
    </div>
  );
}
