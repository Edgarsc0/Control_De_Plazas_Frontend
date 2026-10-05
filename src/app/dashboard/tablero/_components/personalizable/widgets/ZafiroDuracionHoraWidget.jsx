"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-interceptor";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Dot, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatDuracion(segundos) {
  if (segundos === null || segundos === undefined) return "—";
  const mins = Math.floor(segundos / 60);
  const secs = Math.round(segundos % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function getExtremos(data) {
  let minIdx = -1;
  let maxIdx = -1;
  let minVal = Infinity;
  let maxVal = -Infinity;
  data.forEach((d, i) => {
    const v = d.duracion_promedio_segundos;
    if (v === null || v === undefined) return;
    if (v < minVal) { minVal = v; minIdx = i; }
    if (v > maxVal) { maxVal = v; maxIdx = i; }
  });
  return { minIdx, maxIdx };
}

function makeExtremoDot({ minIdx, maxIdx }) {
  return function ExtremoDot(props) {
    const { cx, cy, index, value } = props;
    if (value === null || value === undefined) return null;
    if (index === minIdx) {
      return <Dot cx={cx} cy={cy} r={5} fill="#16a34a" stroke="#fff" strokeWidth={1.5} />;
    }
    if (index === maxIdx) {
      return <Dot cx={cx} cy={cy} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />;
    }
    return <Dot cx={cx} cy={cy} r={2.5} fill="#bc955c" />;
  };
}

function DuracionTooltip({ active, payload, label, extremos }) {
  if (!active || !payload?.length) return null;
  const { duracion_promedio_segundos, total_casos } = payload[0].payload;
  const idx = payload[0].payload.__idx;
  const esMin = idx === extremos.minIdx;
  const esMax = idx === extremos.maxIdx;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-lg text-[11px]">
      <p className="font-black text-[#621f32] dark:text-[#bc955c] mb-1">{label}</p>
      <p className="text-slate-600 dark:text-slate-300">{formatDuracion(duracion_promedio_segundos)} · {total_casos} casos</p>
      {esMin && <p className="text-emerald-600 font-bold mt-0.5">Duración más baja</p>}
      {esMax && <p className="text-red-600 font-bold mt-0.5">Duración más alta</p>}
    </div>
  );
}

/** Gráfica compacta de duracion-promedio-por-hora/ (solo casos EXITO), mismos datos que monitoreo_zafiro/ClientComponent.jsx. */
export default function ZafiroDuracionHoraWidget() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let activo = true;
    apiFetch("/plantilla/bitacora/duracion-promedio-por-hora/")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => {
        if (activo) setData(d.map((x, i) => ({ ...x, horaLabel: `${String(x.hora).padStart(2, "0")}h`, __idx: i })));
      })
      .catch((err) => {
        console.error("Error cargando duración promedio por hora de ZAFIRO:", err);
        if (activo) setData([]);
      });
    return () => { activo = false; };
  }, []);

  const extremos = data ? getExtremos(data) : { minIdx: -1, maxIdx: -1 };

  return (
    <div className="w-full h-full p-2.5">
      {!data ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 text-center px-4">
          Sin datos suficientes para graficar.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
            <XAxis dataKey="horaLabel" tick={{ fontSize: 9, fontFamily: "monospace" }} interval={2} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
            <YAxis tick={{ fontSize: 9, fontFamily: "monospace" }} tickFormatter={formatDuracion} width={44} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
            <Tooltip content={<DuracionTooltip extremos={extremos} />} cursor={{ stroke: "#621f32", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="linear" dataKey="duracion_promedio_segundos" stroke="#621f32" strokeWidth={2} dot={makeExtremoDot(extremos)} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
