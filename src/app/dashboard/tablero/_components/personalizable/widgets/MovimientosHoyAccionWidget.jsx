"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useElementSize } from "./useElementSize";
import { fmtNum, useMovimientosHoyStats, useSinRestriccionUN } from "./movimientosHoyShared";

/**
 * Dona de los movimientos capturados hoy por acción. Clic en una porción (o en
 * su renglón de la leyenda) → dona con el desglose de motivos de esa acción;
 * la flecha regresa a las acciones. La acción elegida se guarda en
 * `config.accion` (por widget y por usuario, con el resto del layout).
 */
export default function MovimientosHoyAccionWidget({ config, onConfigChange }) {
  const [ref, { width, height }] = useElementSize();
  const { cargando: cargandoAuth, permitido } = useSinRestriccionUN();
  const [accion, setAccion] = useState(config?.accion || null);
  const { porAccion, porMotivo, cargandoAcciones, cargandoMotivos, error } = useMovimientosHoyStats(accion, permitido);

  useEffect(() => { setAccion(config?.accion || null); }, [config?.accion]);
  const elegir = (a) => { setAccion(a); onConfigChange?.({ accion: a }); };

  const enMotivos = !!accion;
  const { items, total } = enMotivos ? porMotivo : porAccion;
  const cargando = cargandoAuth || cargandoAcciones || (enMotivos && cargandoMotivos);

  const mostrarLeyenda = width >= 300 && height >= 150;
  const diametro = Math.min(mostrarLeyenda ? width - 190 : width, height);
  const mostrarCentro = diametro >= 110;

  let contenido;
  if (!cargandoAuth && !permitido) {
    contenido = (
      <div className="m-auto flex flex-col items-center gap-1 text-center p-3">
        <Lock className="size-5 text-slate-400" />
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Resumen disponible solo sin restricción de Unidad de Negocio.</p>
      </div>
    );
  } else if (error) {
    contenido = <p className="m-auto text-center text-red-600 dark:text-red-400 text-xs font-bold p-3">{error}</p>;
  } else if (cargando) {
    contenido = <div className="m-auto"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>;
  } else if (!items.length) {
    contenido = <p className="m-auto text-center text-xs font-bold text-slate-400 p-3">Sin movimientos capturados hoy.</p>;
  } else {
    contenido = (
      <>
        <div className="relative flex-1 h-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
                onClick={(d) => { if (!enMotivos) elegir(d?.name ?? d?.payload?.name); }}
                style={{ cursor: enMotivos ? "default" : "pointer" }}
              >
                {items.map((i) => <Cell key={i.name} fill={i.color} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [`${fmtNum(v)} (${total ? Math.round((v / total) * 100) : 0}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          {mostrarCentro && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
              <span className="text-lg font-black tabular-nums text-gray-900 dark:text-white leading-none">{fmtNum(total)}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 line-clamp-2">
                {enMotivos ? accion : "Hoy"}
              </span>
            </div>
          )}
        </div>
        {mostrarLeyenda && (
          <ul className="flex flex-col gap-0.5 shrink-0 w-44 overflow-y-auto max-h-full">
            {items.map((i) => (
              <li key={i.name}>
                <button
                  type="button"
                  disabled={enMotivos}
                  onClick={() => elegir(i.name)}
                  className={`w-full flex items-center justify-between gap-2 text-xs px-1.5 py-1 rounded-md text-left ${enMotivos ? "cursor-default" : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60"}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: i.color }} />
                    <span className="font-bold text-gray-600 dark:text-gray-300 truncate" title={i.name}>{i.name}</span>
                  </span>
                  <span className="font-black tabular-nums text-gray-900 dark:text-white shrink-0">{fmtNum(i.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div ref={ref} className="relative w-full h-full min-h-0 flex items-center gap-2 p-2">
      {enMotivos && permitido && (
        <button
          type="button"
          onClick={() => elegir(null)}
          title="Volver a las acciones"
          aria-label="Volver a las acciones"
          className="absolute top-1.5 left-1.5 z-10 p-1 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
        </button>
      )}
      {contenido}
    </div>
  );
}
