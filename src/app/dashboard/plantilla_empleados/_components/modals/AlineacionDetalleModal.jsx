"use client";

import { CheckCircle2, XCircle, GitCompareArrows, Briefcase, User, AlertTriangle } from "lucide-react";
import ModalShell, { Pill } from "@/components/shared/ModalShell";

/**
 * Modal de detalle de alineación de una plaza: muestra, campo a campo, el
 * valor en MOV_POS vs. el valor en EMPLEADOS_COMPLETOS_SIG y si coinciden.
 * Recibe la fila ya cargada (sin fetch adicional: `alineacion_detalle` viene
 * calculado por el backend en `/plantilla/mov_pos_alineacion/`).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.row - Fila del dataset de alineación.
 * @param {() => void} props.onClose
 */
export default function AlineacionDetalleModal({ open, row, onClose }) {
  if (!row) return null;

  const detalle = row.alineacion_detalle || {};
  const campos = Object.values(detalle);
  const esAlineada = row.estado_alineacion === "Alineada";
  const camposDivergentes = campos.filter((c) => !c.coincide).length;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="md"
      icon={GitCompareArrows}
      eyebrow="Comparación"
      title={`Alineación de la Plaza #${row.no_pos_actual}`}
      subtitle={row.nombre_puesto || "Sin nombre de puesto"}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={esAlineada ? "emerald" : "rose"}>
            <span className="inline-flex items-center gap-1.5">
              {esAlineada ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
              {row.estado_alineacion} · {row.campos_coincidentes}/{row.campos_totales} campos
            </span>
          </Pill>
          <Pill tone="guinda">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {row.ocupacion}{row.ocupante_nombre ? `: ${row.ocupante_nombre}` : ""}
            </span>
          </Pill>
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-black uppercase text-[10px]">Campo</th>
                <th className="px-4 py-2.5 font-black uppercase text-[10px]">
                  <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3" />MOV_POS</span>
                </th>
                <th className="px-4 py-2.5 font-black uppercase text-[10px]">
                  <span className="inline-flex items-center gap-1.5"><User className="size-3" />EMPLEADOS_COMPLETOS_SIG</span>
                </th>
                <th className="px-4 py-2.5 font-black uppercase text-[10px] text-center">Coincide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {campos.map((campo, idx) => (
                <tr
                  key={idx}
                  className={!campo.coincide ? "bg-rose-100 dark:bg-rose-950/50 border-l-[5px] border-rose-600" : ""}
                >
                  <td className={`px-4 py-3 font-bold align-top ${!campo.coincide ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}`}>{campo.label}</td>
                  <td className={`px-4 py-3 font-mono align-top break-all ${!campo.coincide ? "text-rose-600 dark:text-rose-400 font-black" : "text-slate-700 dark:text-slate-200"}`}>{campo.mov_pos_valor}</td>
                  <td className={`px-4 py-3 font-mono align-top break-all ${!campo.coincide ? "text-rose-600 dark:text-rose-400 font-black" : "text-slate-700 dark:text-slate-200"}`}>{campo.empleados_sig_valor}</td>
                  <td className="px-4 py-3 text-center align-top">
                    {campo.coincide ? (
                      <CheckCircle2 className={`size-4 inline-block ${campo.ambos_vacios ? "text-slate-300 dark:text-slate-600" : "text-emerald-500"}`} title={campo.ambos_vacios ? "Ambos vacíos" : "Coincide"} />
                    ) : (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-sm shadow-rose-600/30" title="Difiere">✕</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {camposDivergentes > 0 && (
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            {camposDivergentes} de {campos.length} campos no coinciden entre MOV_POS y EMPLEADOS_COMPLETOS_SIG.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
