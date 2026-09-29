"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import DonaEChart from "./DonaEChart";
import { ESTADOS, mapEstadoNomina, cargarEstatusNomina } from "./estatusNominaData";
import { useElementSize } from "./useElementSize";

// Mismo modal que abre una barra de "Plazas por unidad administrativa", aquí sin unidad (toda la
// plantilla) y filtrado por el estatus elegido.
const PlantillaUaModal = dynamic(() => import("./PlantillaUaModal"), { ssr: false });

const fmt = (n) => n.toLocaleString("es-MX");

export default function EstadosNominaWidget() {
  const [ref, { width, height }] = useElementSize();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [estatusSeleccionado, setEstatusSeleccionado] = useState(null);

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
  // Adaptación al espacio: la dona SIEMPRE a la izquierda y la leyenda a la derecha en cuanto
  // haya ancho (aunque el widget sea bajo: entonces la leyenda va compacta); solo en un widget
  // muy angosto queda la dona sola. El total en el centro, solo si el aro es lo bastante grande.
  const mostrarLeyenda = width >= 230;
  const leyendaCompacta = height < 170 || width < 320;
  const anchoLeyenda = leyendaCompacta ? 136 : 170;
  const diametro = Math.min(mostrarLeyenda ? width - anchoLeyenda : width, height);
  const mostrarTotal = diametro >= 110;
  const pad = diametro < 110 ? "p-1" : "p-3";
  // OJO: `ref` va en un contenedor SIN padding y el padding en su hijo. `useElementSize` mide el
  // área de contenido (sin padding): si el padding vive en el mismo elemento que se mide y
  // depende de la medida, alternar p-1/p-3 cambia la medida, que vuelve a cambiar el padding…
  // y el widget (dona incluida) se redibuja sin parar.

  return (
    <div ref={ref} className="w-full h-full min-h-0">
    <div className={`w-full h-full flex items-center gap-3 min-h-0 ${pad}`}>
      {error ? (
        <p className="w-full text-center text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
      ) : !data ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
        </div>
      ) : (
        <>
          {/* Dona a la izquierda: el contenedor tiene tamaño propio (flex-1 + alto completo) y
              ECharts toma de él su diámetro, así que no colapsa al redimensionar el widget. */}
          <div className="relative flex-1 h-full min-w-0 min-h-0">
            <DonaEChart items={visibles} total={total} onSliceClick={(it) => setEstatusSeleccionado(it.name)} />
            {mostrarTotal && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black tabular-nums text-gray-900 dark:text-white leading-none">{fmt(total)}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Plazas</span>
              </div>
            )}
          </div>

          {mostrarLeyenda && (
            <ul
              className={`flex flex-col shrink-0 overflow-y-auto overflow-x-hidden max-h-full ${leyendaCompacta ? "gap-0.5" : "gap-1.5"}`}
              style={{ width: anchoLeyenda }}
            >
              {items.map((i) => (
                <li
                  key={i.name}
                  role="button"
                  tabIndex={0}
                  title={`Ver la plantilla con estatus ${i.name}`}
                  onClick={() => setEstatusSeleccionado(i.name)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEstatusSeleccionado(i.name); } }}
                  className={`flex items-center justify-between gap-2 rounded-md px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${leyendaCompacta ? "text-[10px]" : "text-xs"}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`${leyendaCompacta ? "size-2" : "size-2.5"} rounded-full shrink-0`} style={{ backgroundColor: i.color }} />
                    <span className="font-bold text-gray-600 dark:text-gray-300 truncate" title={i.name}>{i.name}</span>
                  </span>
                  <span className="font-black tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                    {fmt(i.value)}
                    {!leyendaCompacta && (
                      <span className="ml-1.5 text-[10px] font-bold text-gray-400">
                        {total ? Math.round((i.value / total) * 100) : 0}%
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
    {estatusSeleccionado && (
      <PlantillaUaModal estatus={estatusSeleccionado} onClose={() => setEstatusSeleccionado(null)} />
    )}
    </div>
  );
}
