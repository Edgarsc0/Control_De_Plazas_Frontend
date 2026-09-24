"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ESTADOS, mapEstadoNomina, cargarEstatusNomina } from "./estatusNominaData";
import { useElementSize } from "./useElementSize";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX");
const ANCHO_POR_BARRA = 34;
const ALTO_SCROLL = 14; // franja reservada para la barra de desplazamiento

// Pie de barra: código de la UA (nombre completo solo en el tooltip). Si el
// backend aún no manda el código, se recorta el nombre en vez de encimarlo.
const MAX_CHARS = 8;
function CodigoTick({ x, y, payload }) {
  const v = String(payload?.value ?? "");
  const largo = v.length > MAX_CHARS;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{v}</title>
      <text
        dy={12}
        textAnchor={largo ? "end" : "middle"}
        transform={largo ? "rotate(-45)" : undefined}
        fontSize={10}
        fontWeight={700}
        fill="#64748b"
      >
        {largo ? `${v.slice(0, MAX_CHARS)}…` : v}
      </text>
    </g>
  );
}

function UaTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-3 shadow-xl min-w-[180px] max-w-[300px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 break-words">
        {row.codigo !== row.nombre ? `${row.codigo} · ` : ""}{row.nombre}
      </p>
      <div className="space-y-1">
        {ESTADOS.filter((e) => row[e.key] > 0).map((e) => (
          <div key={e.key} className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: e.color }} />
              {e.key}
            </span>
            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{fmt(row[e.key])}</span>
          </div>
        ))}
        <div className="flex justify-between items-center gap-4 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">Total</span>
          <span className="text-xs font-black text-[#621f32] dark:text-[#bc955c]">{fmt(row.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PlazasPorUaWidget() {
  const [ref, { width, height }] = useElementSize();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    cargarEstatusNomina()
      .then((d) => { if (active) setData(d); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar el resumen."); });
    return () => { active = false; };
  }, []);

  // Una barra por UA (mayor a menor), dividida por estado de nómina.
  const filas = useMemo(() => {
    const codigos = data?.ua_codigos || {};
    return Object.entries(data?.por_ua || {})
      .map(([nombre, niveles]) => {
        const row = { nombre, codigo: codigos[nombre] || nombre, total: 0 };
        ESTADOS.forEach((e) => { row[e.key] = 0; });
        Object.values(niveles).forEach((conteos) => {
          Object.entries(conteos || {}).forEach(([codigo, n]) => {
            const v = Number(n) || 0;
            row[mapEstadoNomina(codigo)] += v;
            row.total += v;
          });
        });
        return row;
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const mostrarLeyenda = height >= 220;
  const anchoGrafica = Math.max(width - 8, filas.length * ANCHO_POR_BARRA);
  const hayScroll = anchoGrafica > width - 8;
  const hayCodigos = filas.every((f) => f.codigo.length <= MAX_CHARS);
  const altoEje = hayCodigos ? 22 : 56;

  return (
    <div ref={ref} className="w-full h-full min-h-0 flex flex-col p-2">
      {error ? (
        <p className="m-auto text-center text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
      ) : !data ? (
        <div className="m-auto"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>
      ) : (
        <>
          {mostrarLeyenda && (
            <div className="shrink-0 flex items-center gap-x-3 gap-y-1 flex-wrap px-1 pb-1">
              {ESTADOS.map((e) => (
                <span key={e.key} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  {e.key}
                </span>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <div style={{ width: anchoGrafica, height: hayScroll ? `calc(100% - ${ALTO_SCROLL}px)` : "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis type="category" dataKey="codigo" interval={0} tick={<CodigoTick />} axisLine={false} tickLine={false} height={altoEje} />
                  <YAxis type="number" allowDecimals={false} width={36} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<UaTooltip />} cursor={{ fill: "rgba(98,31,50,0.04)" }} />
                  {ESTADOS.map((e) => (
                    <Bar key={e.key} dataKey={e.key} stackId="estatus" fill={e.color} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
