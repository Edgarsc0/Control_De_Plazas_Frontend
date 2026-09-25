"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  construirEntradasAduana,
  construirResumenPorAduana,
  codigoUaActual,
  diasEntre,
  duracion,
} from "@/app/dashboard/plantilla_empleados/_components/tabs/mov-posiciones/RotacionAduanasSubTab";
import FotoEmpleadoCell from "@/app/dashboard/plantilla_empleados/_components/shared/FotoEmpleadoCell";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { formatDateEsMx } from "@/utils/columnFilters";
import { useTitularesAduanas } from "./titularesAduanasData";

const fmt = (n) => Number(n || 0).toLocaleString("es-MX");
const pct = (f) => `${(f * 100).toFixed(1)}%`;

const TH = "px-3 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide whitespace-nowrap border-b border-slate-300 dark:border-slate-700";
const TD = "px-3 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-100";
const STICKY_TH = "px-3 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide border-b border-slate-300 dark:border-slate-700";

function Estado({ cargando, error }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 text-center text-sm text-slate-500 dark:text-slate-400">
      {cargando ? <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /> : error ? "No se pudo cargar la información de titulares de aduanas." : "Sin datos."}
    </div>
  );
}

/** Marco de tabla igual al de las tablas de nivel de Cuadros de Vacancia. */
function Marco({ children }) {
  return (
    <div className="w-full h-full p-2">
      <div className="h-full overflow-auto custom-scrollbar rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    </div>
  );
}

/** Primera hoja ("Resumen") del Excel de rotación de titulares de aduanas. */
export function TitularesAduanasResumenWidget() {
  const { cargando, error, aduanas } = useTitularesAduanas();

  const { filas, total } = useMemo(() => {
    const entradas = new Map(aduanas.map((a) => [a.aduana, construirEntradasAduana(a)]));
    const cortas = new Map(aduanas.map((a) => [a.aduana, a.aduana_corta || a.aduana]));
    const filas = construirResumenPorAduana(aduanas, entradas).map((r) => ({ ...r, corta: cortas.get(r.aduana) }));
    const total = filas.reduce(
      (t, r) => ({ titulares: t.titulares + r.titulares, ocupados: t.ocupados + r.diasOcupados, vacancia: t.vacancia + r.diasVacancia }),
      { titulares: 0, ocupados: 0, vacancia: 0 }
    );
    return { filas, total };
  }, [aduanas]);

  if (cargando || error || filas.length === 0) return <Estado cargando={cargando} error={error} />;
  const conDato = total.ocupados + total.vacancia;

  return (
    <Marco>
      <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <tr>
          <th className={`${STICKY_TH} min-w-[8rem]`}>Aduana</th>
          <th className={TH}>Código UA</th>
          <th className={TH}>Titulares históricos</th>
          <th className={TH}>Días ocupada</th>
          <th className={TH}>Tiempo ocupado</th>
          <th className={`${TH} text-amber-700 dark:text-amber-400`}>Días de vacancia</th>
          <th className={TH}>% ocupación</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((r) => (
          <tr
            key={r.aduana}
            className={`border-b border-slate-100 dark:border-slate-800/70 transition-colors ${r.sinTitularHoy ? "bg-rose-50 dark:bg-rose-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}
          >
            <td title={r.aduana} className={`${r.sinTitularHoy ? "text-rose-700 dark:text-rose-400 italic" : "text-slate-800 dark:text-slate-100"} px-3 py-2.5 text-left font-semibold min-w-[8rem] leading-tight`}>
              {r.corta}
            </td>
            <td className={TD}>{r.codigosUa}</td>
            <td className={`${TD} font-medium`}>{fmt(r.titulares)}</td>
            <td className={TD}>{fmt(r.diasOcupados)}</td>
            <td className={`${TD} whitespace-nowrap`}>{duracion(r.diasOcupados) || "0 días"}</td>
            <td className={`${TD} text-amber-700 dark:text-amber-400`}>{fmt(r.diasVacancia)}</td>
            <td className={`${TD} font-bold`}>{pct(r.fraccionOcupada)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-20">
        <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
          <td className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide min-w-[8rem]">Total</td>
          <td className={TD} />
          <td className={TD}>{fmt(total.titulares)}</td>
          <td className={TD}>{fmt(total.ocupados)}</td>
          <td className={`${TD} whitespace-nowrap`}>{duracion(total.ocupados) || "0 días"}</td>
          <td className={`${TD} text-amber-700 dark:text-amber-400`}>{fmt(total.vacancia)}</td>
          <td className={TD}>{pct(conDato > 0 ? total.ocupados / conDato : 0)}</td>
        </tr>
      </tfoot>
    </Marco>
  );
}

/** Quién es el titular de cada aduana hoy, desde cuándo, y las que están sin titular. */
export function TitularesAduanasActualesWidget() {
  const { cargando, error, aduanas } = useTitularesAduanas();
  const { hasPermission } = useAuth();
  const puedeVerFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO) || hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);

  const filas = useMemo(
    () => aduanas.map((a) => ({
      aduana: a.aduana,
      corta: a.aduana_corta || a.aduana,
      codigo: codigoUaActual(a),
      titular: a.titular_actual,
      numEmpleado: a.gestiones?.find((g) => g.tipo_salida === "ACTIVO")?.num_empleado ?? null,
      desde: a.titular_desde,
      dias: a.titular_desde ? diasEntre(a.titular_desde, null) : null,
    })),
    [aduanas]
  );

  if (cargando || error || filas.length === 0) return <Estado cargando={cargando} error={error} />;
  const conTitular = filas.filter((f) => f.titular).length;

  return (
    <Marco>
      <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <tr>
          <th className={STICKY_TH}>Aduana</th>
          <th className={TH}>Código UA</th>
          {puedeVerFoto && <th className={`${TH} text-center`}>Foto</th>}
          <th className={`${TH} text-left`}>Titular actual</th>
          <th className={TH}>Desde</th>
          <th className={TH}>Antigüedad</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr
            key={f.aduana}
            className={`border-b border-slate-100 dark:border-slate-800/70 transition-colors ${f.titular ? "hover:bg-slate-50 dark:hover:bg-slate-900/60" : "bg-rose-50 dark:bg-rose-950/30"}`}
          >
            <td title={f.aduana} className={`${f.titular ? "text-slate-800 dark:text-slate-100" : "text-rose-700 dark:text-rose-400 italic"} px-3 py-2.5 text-left font-semibold min-w-[8rem] leading-tight`}>
              {f.corta}
            </td>
            <td className={TD}>{f.codigo}</td>
            {puedeVerFoto && (
              <td className="px-3 py-1.5">
                <FotoEmpleadoCell numempleado={f.numEmpleado} size={40} caption={f.titular ? `${f.titular} — ${f.corta}` : undefined} />
              </td>
            )}
            <td className={`${TD} text-left font-medium whitespace-nowrap ${f.titular ? "" : "italic text-rose-700 dark:text-rose-400"}`}>
              {f.titular || "Sin titular"}
            </td>
            <td className={`${TD} whitespace-nowrap`}>{f.desde ? formatDateEsMx(f.desde) : "—"}</td>
            <td className={`${TD} whitespace-nowrap`}>{f.dias !== null ? duracion(f.dias) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-20">
        <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
          <td className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide" colSpan={puedeVerFoto ? 3 : 2}>Con titular</td>
          <td className={`${TD} text-left`} colSpan={3}>{conTitular} de {filas.length}</td>
        </tr>
      </tfoot>
    </Marco>
  );
}
