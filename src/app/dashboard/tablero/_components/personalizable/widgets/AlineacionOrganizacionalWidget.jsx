"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, GitCompareArrows, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { VacantesService } from "@/services/vacantes.service";
import { useElementSize } from "./useElementSize";

const TTL_MS = 5 * 60 * 1000;
let cache = null;

// % actual (stats del listado, con page_size=1 para no traer filas) + histórico
// diario de los últimos 90 días (mismos endpoints que "Comprobar alineación").
function cargarAlineacion() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const json = (res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la alineación.")));
  const promise = Promise.all([
    VacantesService.getMovPosAlineacion({ page: 1, page_size: 1 }).then(json),
    VacantesService.getMovPosAlineacionHistorico({ dias: 90 }).then(json),
  ])
    .then(([actual, historico]) => ({ stats: actual.stats || null, historico: historico.results || [] }))
    .catch((err) => {
      cache = null;
      throw err;
    });
  cache = { t: Date.now(), promise };
  return promise;
}

const formatNumber = (n) => Number(n || 0).toLocaleString("es-MX");
const formatFecha = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} / ${m} / ${y}`;
};

const HistoricoTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[9px] font-black uppercase text-slate-500">{formatFecha(p.fecha)}</p>
      <p className="text-sm font-black text-[#621f32] dark:text-[#bc955c]">{p.porcentaje_alineacion_general}%</p>
    </div>
  );
};

export default function AlineacionOrganizacionalWidget() {
  const [ref, { width, height }] = useElementSize();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    cargarAlineacion()
      .then((d) => { if (active) setData(d); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar la alineación."); });
    return () => { active = false; };
  }, []);

  const historico = useMemo(
    () => (data?.historico || []).filter((h) => h.porcentaje_alineacion_general != null),
    [data]
  );

  // Dominio ajustado a la variación real (los cambios diarios son pequeños).
  const dominio = useMemo(() => {
    if (!historico.length) return [0, 100];
    const v = historico.map((h) => h.porcentaje_alineacion_general);
    const min = Math.min(...v);
    const max = Math.max(...v);
    const pad = max > min ? (max - min) * 0.15 : 0.5;
    return [Math.max(0, min - pad), Math.min(100, max + pad)];
  }, [historico]);

  const stats = data?.stats;
  const actual = stats?.porcentaje_alineacion_general;
  // Variación contra el primer punto del histórico (inicio del periodo de 90 días).
  const delta = historico.length > 1 && actual != null
    ? Math.round((actual - historico[0].porcentaje_alineacion_general) * 10) / 10
    : null;
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  const compacto = height < 130 || width < 170;
  const mostrarGrafica = historico.length > 1 && !compacto;
  const mostrarDetalle = height >= 200 && width >= 200;

  return (
    <div ref={ref} className={`w-full h-full min-h-0 flex flex-col justify-center gap-1 ${compacto ? "p-2" : "p-3"} bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white`}>
      {error ? (
        <p className="text-center text-xs font-bold text-white">{error}</p>
      ) : !data ? (
        <div className="flex items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>
      ) : (
        <>
          {!compacto && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/15"><GitCompareArrows className="size-3.5" /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80 truncate">Alineación General</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className={`${compacto ? "text-2xl" : "text-4xl"} font-black leading-none tabular-nums`}>
              {actual != null ? `${actual}%` : "—"}
            </span>
            {delta !== null && !compacto && (
              <span className="flex items-center gap-1 text-[11px] font-black text-white/85" title="Variación en los últimos 90 días">
                <DeltaIcon className="size-3.5" />
                {delta > 0 ? "+" : ""}{delta} pts
              </span>
            )}
          </div>
          {mostrarDetalle && stats && (
            <p className="text-[11px] font-bold text-white/70">
              {formatNumber(stats.total_alineadas)} de {formatNumber(stats.total_activas)} plazas 100% alineadas
            </p>
          )}
          {mostrarGrafica && (
            <div className="flex-1 min-h-[32px] -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historico} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="alineacionWidgetFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={dominio} />
                  <Tooltip content={<HistoricoTooltip />} cursor={{ stroke: "#ffffff", strokeOpacity: 0.35 }} />
                  <Area type="monotone" dataKey="porcentaje_alineacion_general" stroke="#ffffff" strokeWidth={2} fill="url(#alineacionWidgetFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
