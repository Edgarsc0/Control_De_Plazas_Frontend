"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  construirEntradasAduana,
  construirResumenPorAduana,
  codigoUaActual,
  diasEntre,
  duracion,
} from "@/app/dashboard/plantilla_empleados/_components/tabs/mov-posiciones/RotacionAduanasSubTab";
import FotoEmpleadoCell from "@/app/dashboard/plantilla_empleados/_components/shared/FotoEmpleadoCell";
import { useExpedienteEmpleado } from "@/app/dashboard/plantilla_empleados/_components/shared/useExpedienteEmpleado";

// Foto clicable que abre el expediente (activo o baja) en vez de ampliar la imagen:
// `pointer-events-none` en la foto para que el clic lo reciba el botón, y stopPropagation para
// no expandir/colapsar la fila de la aduana.
function FotoExpediente({ numEmpleado, nombre, size, caption, onAbrir }) {
  if (!numEmpleado) return <FotoEmpleadoCell numempleado={numEmpleado} size={size} caption={caption} />;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAbrir(numEmpleado, nombre); }}
      title={nombre ? `Ver expediente de ${nombre}` : "Ver expediente"}
      aria-label={nombre ? `Ver expediente de ${nombre}` : "Ver expediente"}
      className="inline-flex rounded-full cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#621f32]/50"
    >
      <span className="pointer-events-none inline-flex">
        <FotoEmpleadoCell numempleado={numEmpleado} size={size} caption={caption} />
      </span>
    </button>
  );
}
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

/** Etiqueta corta del tipo de salida de una gestión, para el histórico del
 * widget — subconjunto de TIPO_SALIDA de RotacionAduanasSubTab.jsx (no
 * exportado ahí), suficiente para el histórico compacto de este widget. */
const ETIQUETA_TIPO_SALIDA = {
  TRASLADO_ADUANA: "Pasó a otra aduana",
  BAJA: "Baja",
  SALIDA_PUESTO: "Pasó a otro puesto",
  CAMBIO_PLAZA: "Cambió de plaza",
};

/** Histórico de titulares de UNA aduana (todas sus gestiones, más reciente
 * primero) — contenido de la fila expandida bajo el titular actual. Cada
 * fila entra animada con gsap (fade + deslizamiento leve, stagger), tanto la
 * fila completa como la foto (escala) por separado para que la foto "salte"
 * un poco más — mismo `ref` en el <tbody>, un solo useEffect al montar (esta
 * fila se desmonta/monta entera al colapsar/expandir, así que "montar" y
 * "abrir" son el mismo evento, no hace falta trackear el estado aparte). */
function HistorialTitulares({ aduana, colSpan, puedeVerFoto, onAbrirExpediente }) {
  const tbodyRef = useRef(null);
  const gestiones = useMemo(
    () => [...(aduana.gestiones || [])].sort((a, b) => String(b.fecha_entrada).localeCompare(String(a.fecha_entrada))),
    [aduana]
  );

  useEffect(() => {
    const tbody = tbodyRef.current;
    if (!tbody) return;
    const filas = tbody.querySelectorAll("tr");
    const fotos = tbody.querySelectorAll("[data-foto-historial]");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        filas,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.035, ease: "power2.out" }
      );
      if (fotos.length) {
        gsap.fromTo(
          fotos,
          { opacity: 0, scale: 0.6 },
          { opacity: 1, scale: 1, duration: 0.32, stagger: 0.035, ease: "back.out(1.7)", delay: 0.05 }
        );
      }
    }, tbody);
    return () => ctx.revert();
  }, [gestiones]);

  if (gestiones.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
          Sin histórico registrado.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm border-collapse">
          <thead className="text-slate-600 dark:text-slate-400">
            <tr>
              {puedeVerFoto && <th className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold">Foto</th>}
              <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide font-semibold">Titular</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold">Desde</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold">Hasta</th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold">Duración</th>
              <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide font-semibold">Salida</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {gestiones.map((g) => (
              <tr key={`${g.num_empleado}|${g.fecha_entrada}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                {puedeVerFoto && (
                  <td className="px-3 py-1.5">
                    <div data-foto-historial className="flex justify-center">
                      <FotoExpediente numEmpleado={g.num_empleado} nombre={g.nombre} size={32} caption={g.nombre ? `${g.nombre}` : undefined} onAbrir={onAbrirExpediente} />
                    </div>
                  </td>
                )}
                <td className="px-3 py-1.5 text-left font-medium text-slate-800 dark:text-slate-100">{g.nombre || "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{g.fecha_entrada ? formatDateEsMx(g.fecha_entrada) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{g.fecha_salida ? formatDateEsMx(g.fecha_salida) : "Vigente"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{duracion(diasEntre(g.fecha_entrada, g.fecha_salida)) || "—"}</td>
                <td className="px-3 py-1.5 text-left text-slate-700 dark:text-slate-300">{g.fecha_salida ? (ETIQUETA_TIPO_SALIDA[g.tipo_salida] || "Baja") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

/** Quién es el titular de cada aduana hoy, desde cuándo, y las que están sin titular.
 * Cada fila puede desplegarse (flecha) para ver el histórico completo de titulares. */
export function TitularesAduanasActualesWidget() {
  const { cargando, error, aduanas } = useTitularesAduanas();
  const { hasPermission } = useAuth();
  const puedeVerFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO) || hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);
  const [abiertas, setAbiertas] = useState(() => new Set());
  const { abrirExpediente, expedienteUI } = useExpedienteEmpleado({ canViewPhoto: puedeVerFoto });

  const filas = useMemo(
    () => aduanas.map((a) => ({
      aduana: a.aduana,
      corta: a.aduana_corta || a.aduana,
      codigo: codigoUaActual(a),
      titular: a.titular_actual,
      numEmpleado: a.gestiones?.find((g) => g.tipo_salida === "ACTIVO")?.num_empleado ?? null,
      desde: a.titular_desde,
      dias: a.titular_desde ? diasEntre(a.titular_desde, null) : null,
      raw: a,
    })),
    [aduanas]
  );

  if (cargando || error || filas.length === 0) return <Estado cargando={cargando} error={error} />;
  const conTitular = filas.filter((f) => f.titular).length;
  const colSpan = 5 + (puedeVerFoto ? 1 : 0);

  const toggle = (aduana) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(aduana)) next.delete(aduana);
      else next.add(aduana);
      return next;
    });

  return (
    <>
    <Marco>
      <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <tr>
          <th className={`${TH} w-8`} />
          <th className={STICKY_TH}>Aduana</th>
          <th className={TH}>Código UA</th>
          {puedeVerFoto && <th className={`${TH} text-center`}>Foto</th>}
          <th className={`${TH} text-left`}>Titular actual</th>
          <th className={TH}>Desde</th>
          <th className={TH}>Antigüedad</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const abierta = abiertas.has(f.aduana);
          return (
            <React.Fragment key={f.aduana}>
              <tr
                className={`border-b border-slate-100 dark:border-slate-800/70 transition-colors ${f.titular ? "hover:bg-slate-50 dark:hover:bg-slate-900/60" : "bg-rose-50 dark:bg-rose-950/30"}`}
              >
                <td className="px-1 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(f.aduana)}
                    aria-expanded={abierta}
                    aria-label={abierta ? `Ocultar histórico de ${f.corta}` : `Ver histórico de ${f.corta}`}
                    className="inline-flex items-center justify-center size-6 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  >
                    {abierta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                </td>
                <td title={f.aduana} className={`${f.titular ? "text-slate-800 dark:text-slate-100" : "text-rose-700 dark:text-rose-400 italic"} px-3 py-2.5 text-left font-semibold min-w-[8rem] leading-tight`}>
                  {f.corta}
                </td>
                <td className={TD}>{f.codigo}</td>
                {puedeVerFoto && (
                  <td className="px-3 py-1.5">
                    <FotoExpediente numEmpleado={f.numEmpleado} nombre={f.titular} size={40} caption={f.titular ? `${f.titular} — ${f.corta}` : undefined} onAbrir={abrirExpediente} />
                  </td>
                )}
                <td className={`${TD} text-left font-medium whitespace-nowrap ${f.titular ? "" : "italic text-rose-700 dark:text-rose-400"}`}>
                  {f.titular || "Sin titular"}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{f.desde ? formatDateEsMx(f.desde) : "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>{f.dias !== null ? duracion(f.dias) : "—"}</td>
              </tr>
              {abierta && <HistorialTitulares aduana={f.raw} colSpan={colSpan + 1} puedeVerFoto={puedeVerFoto} onAbrirExpediente={abrirExpediente} />}
            </React.Fragment>
          );
        })}
      </tbody>
      <tfoot className="sticky bottom-0 z-20">
        <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
          <td className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide" colSpan={puedeVerFoto ? 4 : 3}>Con titular</td>
          <td className={`${TD} text-left`} colSpan={3}>{conTitular} de {filas.length}</td>
        </tr>
      </tfoot>
    </Marco>
    {expedienteUI}
    </>
  );
}
