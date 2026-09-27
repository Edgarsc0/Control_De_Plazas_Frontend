"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, X, Loader2, ArrowRightLeft, UserCheck, UserX, CircleHelp } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import MobileCardList from "@/components/ui/MobileCardList";
import FotoEmpleadoCell from "@/app/dashboard/plantilla_empleados/_components/shared/FotoEmpleadoCell";
import { formatDateEsMx } from "@/utils/columnFilters";
import { EmployeeRecordModal } from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";

// Igual que `buildFullName` en MovimientosPersonalTab.jsx/TableroRH.jsx: el
// backend trae nombre/ap_pat/ap_mat por separado, no hay campo combinado.
const buildMovNombreCompleto = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(" ").trim();

// Mismas claves que `dataColumns` en MovimientosPersonalTab.jsx (misma fuente,
// VacantesService.getMovimientosPersonal): EmployeeRecordModal, sin `columns`
// propias, asume que `record` es una fila de Plantilla Detalle y filtra por
// ese catálogo — con una fila de Movimientos de Personal (claves distintas)
// eso deja casi todo en blanco. Pasando estas columnas el expediente describe
// el registro real en vez de caer al catálogo equivocado.
const MOVIMIENTO_RECORD_COLUMNS = [
  { key: "posicion", label: "Posición" },
  { key: "num_empleado", label: "No. Empleado" },
  { key: "nombre", label: "Nombre Completo" },
  { key: "accion_nombre", label: "Nombre Acción" },
  { key: "motivo_nombre", label: "Nombre Motivo" },
  { key: "fecha_efectiva", label: "Fecha Efectiva" },
  { key: "sec", label: "Sec" },
  { key: "fecha_captura", label: "Fecha Captura" },
  { key: "est_hr", label: "Est. Hr" },
  { key: "estado_pago", label: "Estado Pago" },
  { key: "partida_presup", label: "Partida Presup." },
  { key: "un", label: "UN" },
  { key: "un_admin", label: "UN Admin." },
  { key: "id_depto", label: "Id Depto" },
  { key: "depen_direc", label: "Depen. Direc." },
  { key: "plan_sal", label: "Plan Sal." },
  { key: "grado", label: "Grado" },
  { key: "escala", label: "Escala" },
  { key: "puesto_ptal", label: "Puesto Ptal." },
  { key: "nivel_tabular", label: "Nivel Tabular" },
  { key: "gp_pago", label: "Gp Pago" },
  { key: "prog_benef", label: "Prog. Benef." },
  { key: "sal_base", label: "Sal. Base" },
  { key: "cd_puesto", label: "Cd Puesto" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "id_estbl", label: "Id Estbl" },
  { key: "salida_prevista", label: "Salida Prevista" },
  { key: "fecha_ult_actz", label: "Fecha Últ. Actz." },
  { key: "por", label: "Por" },
  { key: "ult_inicio", label: "Últ. Inicio" },
  { key: "fecha_inicial", label: "Fecha Inicial" },
  { key: "gp_trabajo", label: "Gp Trabajo" },
  { key: "grupo_cd_sal", label: "Grupo Cd Sal" },
  { key: "antiguo_empr", label: "Antiguo Empr." },
  { key: "rfc", label: "RFC" },
  { key: "curp", label: "CURP" },
  { key: "id_persona", label: "Id Persona" },
  { key: "desc_larga_p", label: "Desc. Larga P" },
  { key: "nv_jerarquico", label: "Nv. Jerárquico" },
  { key: "desc_larga_un", label: "Desc. Larga UN" },
  { key: "sexo", label: "Sexo" },
  { key: "fecha_entrada", label: "Fecha Entrada" },
  { key: "fecha_posicion", label: "Fecha Posición" },
];

const renderAccionBadge = (row) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase whitespace-nowrap bg-[#621f32]/8 dark:bg-[#621f32]/15 text-[#621f32] dark:text-[#f3dcd4] border-[#621f32]/20 dark:border-[#621f32]/30">
    <ArrowRightLeft className="size-3" />{row.accion_nombre || "Movimiento"}
  </span>
);

const MOVIMIENTO_CARD_CONFIG = {
  getRowId: (row, i) => `${row.num_empleado ?? ""}-${row.posicion ?? ""}-${row.fecha_efectiva ?? ""}-${row.sec ?? i}`,
  getTitle: (row) => buildMovNombreCompleto(row) || "Sin nombre",
  getSubtitle: (row) => (row.posicion ? `POS ${row.posicion}` : ""),
  renderBadge: renderAccionBadge,
  fields: [
    { key: "rfc", label: "RFC", mono: true },
    { key: "curp", label: "CURP", mono: true },
    { key: "un_admin", label: "Unidad Administrativa" },
    { key: "motivo_nombre", label: "Motivo" },
    { key: "fecha_efectiva", label: "Fecha Efectiva" },
  ],
};

const SEARCH_DEBOUNCE_MS = 400;
const LOTE_ESTATUS = 300; // máximo de No. Empleado por consulta (ver EmpleadosEstatusPlantillaView)

const claveEmpleado = (row) => String(row.num_empleado ?? "").trim();

/**
 * Leyenda de estatus al pie de cada tarjeta: ¿sigue en la plantilla o ya causó baja?
 * Criterio (ver EmpleadosEstatusPlantillaView): baja = aparece en BAJAS_SIG y ya no está en la
 * plantilla vigente; quien causó baja y reingresó cuenta como activo. `estatus` es el mapa
 * { id: { baja, fecha_baja, en_plantilla } }; `undefined` = aún no llega (o no hay permiso).
 */
function LeyendaEstatus({ estatus, cargando }) {
  if (!estatus) {
    return cargando ? (
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/70 text-[10px] font-bold text-slate-400">
        <Loader2 className="size-3 animate-spin" />Consultando si sigue en plantilla…
      </div>
    ) : null;
  }
  let Icono = CircleHelp;
  let titulo = "Sin registro en la plantilla vigente";
  let detalle = "Tampoco aparece en bajas";
  let tono = "text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700";
  if (estatus.en_plantilla) {
    Icono = UserCheck;
    titulo = "Vigente en la plantilla";
    detalle = "Activo al día de hoy";
    tono = "text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900";
  } else if (estatus.baja) {
    Icono = UserX;
    titulo = "Ya causó baja";
    detalle = estatus.fecha_baja ? `Baja efectiva ${formatDateEsMx(estatus.fecha_baja)}` : "Consta en el registro de bajas";
    tono = "text-rose-700 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900";
  }
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${tono}`}>
      <Icono className="size-4 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-black">{titulo}</p>
        <p className="text-[10px] font-semibold opacity-80 truncate">{detalle}</p>
      </div>
    </div>
  );
}

/**
 * Widget del tablero personalizable: búsqueda de movimientos de personal por
 * nombre, RFC, CURP, posición, motivo, etc. — mismo panel que ya existía
 * inline en TableroRH.jsx, extraído para poder colocarse independientemente
 * en la cuadrícula (ver widgetRegistry.js). Búsqueda server-side.
 */
export default function BuscarMovimientoWidget() {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);

  // Estatus (plantilla / baja) de los empleados de los resultados: { id: { baja, fecha_baja, en_plantilla } }.
  const [estatus, setEstatus] = useState({});
  const [cargandoEstatus, setCargandoEstatus] = useState(false);

  const cardConfig = useMemo(() => ({
    ...MOVIMIENTO_CARD_CONFIG,
    renderLeading: canViewFoto
      ? (row) => <FotoEmpleadoCell numempleado={row.num_empleado} size={44} caption={buildMovNombreCompleto(row)} />
      : undefined,
    renderFooter: (row) => <LeyendaEstatus estatus={estatus[claveEmpleado(row)]} cargando={cargandoEstatus} />,
  }), [canViewFoto, estatus, cargandoEstatus]);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    VacantesService.getMovimientosPersonal({ no_pagination: true, search: debouncedQuery })
      .then((res) => {
        // 403 = el backend no autoriza esta búsqueda a este rol (por permiso de
        // módulo o por alcance de Unidad de Negocio). Para quien busca no es un
        // fallo: sencillamente no hay nada que pueda ver con ese criterio, así
        // que se trata como "sin coincidencias" en vez de un error rojo —
        // además de no delatar que el registro existe en otra unidad.
        if (res.status === 403) return [];
        if (!res.ok) throw new Error("No se pudieron cargar los movimientos.");
        return res.json();
      })
      .then((data) => { if (active) setResults(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al buscar movimientos."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery]);

  // Tras cada búsqueda, un solo viaje (por lotes) para saber quién sigue en plantilla y quién causó baja.
  useEffect(() => {
    const ids = [...new Set(results.map(claveEmpleado).filter((i) => i && i.toUpperCase() !== "VACANTE"))];
    if (ids.length === 0) { setEstatus({}); setCargandoEstatus(false); return undefined; }
    const ctrl = new AbortController();
    setCargandoEstatus(true);
    const lotes = [];
    for (let i = 0; i < ids.length; i += LOTE_ESTATUS) lotes.push(ids.slice(i, i + LOTE_ESTATUS));
    Promise.all(lotes.map((lote) =>
      VacantesService.getEmpleadosEstatusPlantilla(lote, { signal: ctrl.signal })
        // Sin permiso o error: no se muestra leyenda (nunca una equivocada).
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}))
    ))
      .then((mapas) => { if (!ctrl.signal.aborted) setEstatus(Object.assign({}, ...mapas)); })
      .finally(() => { if (!ctrl.signal.aborted) setCargandoEstatus(false); });
    return () => ctrl.abort();
  }, [results]);

  const handleSelectRow = (row) => {
    // Mismo remapeo que TableroRH.jsx/MovimientosPersonalTab.jsx:
    // EmployeeRecordModal espera un registro con forma de empleado.
    setSelectedRow({
      ...row,
      id_empleado: row.num_empleado,
      nombre: buildMovNombreCompleto(row),
      nombres: buildMovNombreCompleto(row),
      nivel: row.nv_jerarquico || row.grado,
    });
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-3">
      <div className="shrink-0 flex flex-col">
        <div className="relative flex items-center pr-3 pl-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-xl shadow-sm transition-all">
          {isLoading ? (
            <Loader2 className="text-slate-400 size-4 mr-2 animate-spin shrink-0" />
          ) : (
            <Search className="text-slate-400 size-4 mr-2 shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar movimiento por nombre, RFC, motivo..."
            className="bg-transparent text-slate-800 dark:text-white text-sm font-bold w-full outline-none disabled:opacity-50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1.5 shrink-0">
              <X className="size-4" />
            </button>
          )}
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-2">{error}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-2">
        {query.trim() ? (
          <MobileCardList
            compact
            data={results}
            config={cardConfig}
            onCardClick={handleSelectRow}
            isLoading={isLoading && results.length === 0}
            pageSize={10}
          />
        ) : !error ? (
          <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">
            Empieza a escribir para ver resultados.
          </p>
        ) : null}
      </div>

      {selectedRow && (
        <EmployeeRecordModal
          isOpen={!!selectedRow}
          onClose={() => setSelectedRow(null)}
          record={selectedRow}
          columns={MOVIMIENTO_RECORD_COLUMNS}
          canViewPhoto={canViewFoto}
        />
      )}
    </div>
  );
}
