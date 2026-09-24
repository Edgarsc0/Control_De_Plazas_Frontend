"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ESTADOS, mapEstadoNomina, cargarEstatusNomina } from "./estatusNominaData";
import { useElementSize } from "./useElementSize";

const fmt = (n) => n.toLocaleString("es-MX");

export default function EstadosNominaWidget() {
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

  const { items, total } = useMemo(() => {
    const acc = Object.fromEntries(ESTADOS.map((e) => [e.key, 0]));
    Object.values(data?.por_nivel || {}).forEach((counts) => {
      Object.entries(counts || {}).forEach(([codigo, n]) => {
        acc[mapEstadoNomina(codigo)] += Number(n) || 0;
      });
    });
    const items = ESTADOS.map((e) => ({ name: e.key, value: acc[e.key], color: e.color }));
    return { items, total: items.reduce((s, i) => s + i.value, 0) };
  }, [data]);

  const visibles = items.filter((i) => i.value > 0);
  // Adaptación al espacio: la gráfica siempre; leyenda solo si cabe al lado
  // (ancho) y total en el centro solo si el aro es lo bastante grande.
  const mostrarLeyenda = width >= 300 && height >= 150;
  const diametro = Math.min(mostrarLeyenda ? width - 170 : width, height);
  const mostrarTotal = diametro >= 110;
  const pad = diametro < 110 ? "p-1" : "p-3";

  return (
    <div ref={ref} className={`w-full h-full flex items-center gap-3 min-h-0 ${pad}`}>
      {error ? (
        <p className="w-full text-center text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
      ) : !data ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
        </div>
      ) : (
        <>
          <div className="relative flex-1 h-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibles}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {visibles.map((i) => (
                    <Cell key={i.name} fill={i.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [`${fmt(v)} (${total ? Math.round((v / total) * 100) : 0}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            {mostrarTotal && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black tabular-nums text-gray-900 dark:text-white leading-none">{fmt(total)}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Plazas</span>
              </div>
            )}
          </div>

          {mostrarLeyenda && (
            <ul className="flex flex-col gap-1.5 shrink-0 overflow-y-auto max-h-full">
              {items.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: i.color }} />
                    <span className="font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">{i.name}</span>
                  </span>
                  <span className="font-black tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                    {fmt(i.value)}
                    <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                      {total ? Math.round((i.value / total) * 100) : 0}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
