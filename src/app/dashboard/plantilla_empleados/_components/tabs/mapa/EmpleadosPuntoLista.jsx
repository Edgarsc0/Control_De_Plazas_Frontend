"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Loader2, MapPin, Search, X } from "lucide-react";
import { EmployeeRecordModal } from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { crearIndicePersonas, buscarPersonas } from "@/utils/busquedaRanking";

const EXPEDIENTE_COLUMNS = [
  { key: "id_empleado", label: "No. Empleado" },
  { key: "nombres", label: "Nombre Completo" },
  { key: "posicion", label: "Posición" },
  { key: "ua", label: "UA Adscrito" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "estado_nomina", label: "Estatus" },
];

const ESTATUS_ESTILO = {
  Activo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Vacante: "bg-rose-50 text-rose-700 border-rose-200",
  Suspendido: "bg-blue-50 text-blue-700 border-blue-200",
  Licencia: "bg-purple-50 text-purple-700 border-purple-200",
  "Licencia Médica": "bg-amber-50 text-amber-700 border-amber-200",
};

const PASO = 60;

const tieneNombre = (e) => !!(e.nombre && String(e.nombre).trim());

/**
 * Personas adscritas a un punto del mapa, como lista de tarjetas con
 * buscador. Va en un portal a <body>: dentro del tablero personalizable cada
 * widget vive en una celda con `transform` (react-grid-layout), que atrapa a
 * cualquier `fixed`/`absolute` y lo recorta al tamaño del widget — por eso la
 * tabla anterior salía cortada y sin forma de cerrarla.
 *
 * z-[900]: por debajo del expediente (EmployeeRecordModal, z-[1000]).
 */
export default function EmpleadosPuntoLista({ data, loading, title, onClose, canViewPhoto = true }) {
  const [consulta, setConsulta] = useState("");
  const [visibles, setVisibles] = useState(PASO);
  const [expediente, setExpediente] = useState(null);
  useBodyScrollLock(true);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === "Escape" && !expediente) onClose();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onClose, expediente]);

  const filas = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const indice = useMemo(
    () =>
      crearIndicePersonas(
        filas,
        (e) => e.nombre || "",
        (e) => [e.num_empleado, e.posicion, e.ua, e.ubicacion, e.estado_nomina]
      ),
    [filas]
  );

  const resultado = useMemo(() => {
    if (!consulta.trim()) return filas;
    return buscarPersonas(indice, consulta);
  }, [filas, indice, consulta]);

  useEffect(() => { setVisibles(PASO); }, [consulta]);

  const ocupadas = useMemo(() => filas.filter(tieneNombre).length, [filas]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-3 md:p-6 bg-slate-900/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl h-[min(86dvh,820px)] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[#621f32] text-white rounded-xl shadow-md shrink-0">
              <MapPin className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-white leading-tight">{title}</h2>
              {!loading && (
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {filas.length} {filas.length === 1 ? "registro" : "registros"}
                  {filas.length !== ocupadas && ` · ${ocupadas} con persona · ${filas.length - ocupadas} vacantes`}
                  {consulta.trim() && ` · ${resultado.length} coinciden`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              className="shrink-0 p-2 rounded-full text-slate-500 hover:text-[#621f32] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#621f32] dark:text-[#bc955c]" />
            <input
              type="text"
              autoFocus
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar por nombre, No. de empleado, posición o área…"
              className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#621f32] focus:ring-2 focus:ring-[#621f32]/15"
            />
            {consulta && (
              <button
                type="button"
                onClick={() => setConsulta("")}
                title="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#621f32] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-950/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 animate-spin text-[#621f32] dark:text-[#bc955c]" />
              <p className="text-sm font-semibold text-slate-500">Consultando personal de la ubicación…</p>
            </div>
          ) : resultado.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400 text-center px-4">
              {filas.length === 0 ? "No se encontraron empleados en esta ubicación." : "Ningún registro coincide con la búsqueda."}
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {resultado.slice(0, visibles).map((emp, i) => {
                  const conPersona = tieneNombre(emp);
                  return (
                    <li
                      key={`${emp.num_empleado || "s-n"}-${emp.posicion || ""}-${i}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black leading-tight break-words ${conPersona ? "text-[#621f32] dark:text-[#f3dcd4]" : "text-slate-400 italic"}`}>
                            {conPersona ? emp.nombre : "Vacante"}
                          </p>
                          {conPersona && emp.num_empleado && (
                            <p className="text-[11px] font-mono text-slate-500 mt-0.5">No. {emp.num_empleado}</p>
                          )}
                        </div>
                        {conPersona && (
                          <button
                            type="button"
                            onClick={() => setExpediente(emp)}
                            title="Ver expediente"
                            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#621f32] hover:bg-[#621f32]/10 transition-colors cursor-pointer"
                          >
                            <Eye className="size-4" />
                          </button>
                        )}
                      </div>
                      <dl className="text-[11px] leading-snug space-y-1">
                        {[
                          ["Posición", emp.posicion],
                          ["UA", emp.ua],
                          ["Ubicación", emp.ubicacion],
                        ].map(([etiqueta, valor]) => valor ? (
                          <div key={etiqueta} className="flex gap-1.5">
                            <dt className="shrink-0 w-16 font-black uppercase tracking-wide text-[9px] text-slate-400 pt-px">{etiqueta}</dt>
                            <dd className="min-w-0 font-semibold text-slate-700 dark:text-slate-300 break-words">{valor}</dd>
                          </div>
                        ) : null)}
                      </dl>
                      {emp.estado_nomina && (
                        <span className={`self-start mt-auto inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${ESTATUS_ESTILO[emp.estado_nomina] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          {emp.estado_nomina}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {resultado.length > visibles && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => setVisibles((v) => v + PASO)}
                    className="px-4 py-2 rounded-xl border border-[#621f32]/30 text-[#621f32] dark:text-[#f3dcd4] text-xs font-black uppercase tracking-wide hover:bg-[#621f32]/10 cursor-pointer"
                  >
                    Mostrar más ({resultado.length - visibles} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <EmployeeRecordModal
        isOpen={!!expediente}
        onClose={() => setExpediente(null)}
        // EmployeeRecordModal espera `numempleado`/`nombres`; esta fuente usa
        // `num_empleado`/`nombre` (mismo mapeo que EmpleadosTableModal).
        record={expediente && {
          ...expediente,
          id_empleado: expediente.num_empleado,
          numempleado: expediente.num_empleado,
          nombres: expediente.nombre,
        }}
        columns={EXPEDIENTE_COLUMNS}
        canViewPhoto={canViewPhoto}
      />
    </div>,
    document.body
  );
}
