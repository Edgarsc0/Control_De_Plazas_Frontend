"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Loader2, UserX } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import MobileCardList from "@/components/ui/MobileCardList";
import FotoEmpleadoCell from "@/app/dashboard/plantilla_empleados/_components/shared/FotoEmpleadoCell";
import { EmployeeRecordModal } from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";
import { formatDateEsMx, normalizeForSearch } from "@/utils/columnFilters";

// Las bajas (BAJAS_SIG) llegan completas en un solo GET y no hay búsqueda del
// lado del servidor: se baja una vez (caché corto compartido) y se filtra aquí.
const TTL_MS = 5 * 60 * 1000;
let cache = null;
function cargarBajas() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const promise = VacantesService.getBajasSig()
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudieron cargar las bajas."))))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch((err) => { cache = null; throw err; });
  cache = { t: Date.now(), promise };
  return promise;
}

const CAMPOS_BUSQUEDA = ["nombre_completo", "no_empleado", "posicion", "rfc", "curp", "motivo_descr", "accion_descr", "unidad_admon", "departamento", "puesto"];
const MAX_RESULTADOS = 100;

// Mismo mapeo que `buildBajaRecord` de PlantillaDetalleTab: el expediente se ve
// igual sin importar desde dónde se abrió.
const buildBajaRecord = (b) => ({
  ...b,
  id_empleado: b.no_empleado,
  nombres: b.nombre_completo,
  nivel: b.nivel || b.nivel_tabular,
});

// Mismas claves que `dataColumns` en BajasTab.jsx (misma fuente, BAJAS_SIG):
// EmployeeRecordModal, sin `columns` propias, asume que `record` es una fila
// de Plantilla Detalle y filtra por ese catálogo — con una fila de bajas
// (claves distintas) eso deja casi todo en blanco.
const BAJA_RECORD_COLUMNS = [
  { key: "posicion", label: "Posición" },
  { key: "no_empleado", label: "No. Empleado" },
  { key: "nombre_completo", label: "Nombre Completo" },
  { key: "motivo_descr", label: "Motivo" },
  { key: "fecha_efectiva", label: "Fecha Efectiva" },
  { key: "unidad_admon", label: "Unidad Admon" },
  { key: "departamento", label: "Departamento" },
  { key: "puesto", label: "Puesto" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "accion_descr", label: "Acción" },
  { key: "nomina_status", label: "Estatus Nómina" },
  { key: "humanos_status", label: "Estatus RH" },
  { key: "partida", label: "Partida" },
  { key: "nivel", label: "Nivel" },
  { key: "rfc", label: "RFC" },
  { key: "curp", label: "CURP" },
  { key: "genero", label: "Género" },
  { key: "primer_apellido", label: "Primer Apellido" },
  { key: "segundo_apellido", label: "Segundo Apellido" },
  { key: "accion", label: "Cód. Acción" },
  { key: "motivo", label: "Cód. Motivo" },
  { key: "sequencia_efectiva", label: "Secuencia Efectiva" },
  { key: "fecha_aplicacion", label: "Fecha Aplicación" },
  { key: "unidad_general", label: "Unidad General" },
  { key: "dependencia_directa", label: "Dependencia Directa" },
  { key: "plan_salarial", label: "Plan Salarial" },
  { key: "grado", label: "Grado" },
  { key: "escala", label: "Escala" },
  { key: "puesto_presupuestal", label: "Puesto Presupuestal" },
  { key: "nivel_tabular", label: "Nivel Tabular" },
  { key: "grupo_de_pago", label: "Grupo de Pago" },
  { key: "beneficios", label: "Beneficios" },
  { key: "smb", label: "SMB" },
  { key: "inmueble", label: "Inmueble" },
  { key: "fecha_prevista", label: "Fecha Prevista" },
  { key: "ultima_actualizacion", label: "Última Actualización" },
  { key: "ultimo_operador", label: "Último Operador" },
  { key: "ultima_fecha_ingreso", label: "Última Fecha Ingreso" },
  { key: "fecha_ingreso", label: "Fecha Ingreso" },
  { key: "grupo_trabajo", label: "Grupo Trabajo" },
  { key: "codigo_grupo", label: "Código Grupo" },
  { key: "fecha_asignacion", label: "Fecha Asignación" },
  { key: "id_persona", label: "ID Persona" },
  { key: "nivel1", label: "Nivel 1" },
  { key: "unidad_administrativa", label: "Unidad Administrativa" },
  { key: "fecha_entrada_posicion", label: "Fecha Entrada Posición" },
  { key: "fecha_posicion", label: "Fecha Posición" },
];

const CARD_CONFIG = {
  getRowId: (row, i) => `${row.no_empleado ?? ""}-${row.posicion ?? ""}-${row.fecha_efectiva ?? ""}-${i}`,
  getTitle: (row) => row.nombre_completo || "Sin nombre",
  getSubtitle: (row) => (row.posicion ? `POS ${row.posicion}` : ""),
  renderBadge: (row) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase whitespace-nowrap bg-rose-50/60 dark:bg-rose-950/20 text-rose-600 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40">
      <UserX className="size-3" />{row.fecha_efectiva ? formatDateEsMx(row.fecha_efectiva) : "Baja"}
    </span>
  ),
  fields: [
    { key: "no_empleado", label: "No. Empleado", mono: true },
    { key: "motivo_descr", label: "Motivo" },
    { key: "unidad_admon", label: "Unidad Administrativa" },
    { key: "puesto", label: "Puesto" },
  ],
};

/** Buscador de bajas (empleados dados de baja) por nombre, No. Empleado, RFC, CURP, posición, motivo, UA... */
export default function BuscarBajaWidget() {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);
  const cardConfig = useMemo(() => ({
    ...CARD_CONFIG,
    renderLeading: canViewFoto
      ? (row) => <FotoEmpleadoCell numempleado={row.no_empleado} size={44} caption={row.nombre_completo} />
      : undefined,
  }), [canViewFoto]);
  const [bajas, setBajas] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    cargarBajas()
      .then((d) => { if (active) setBajas(d); })
      .catch((err) => { if (active) setError(err.message || "Error al cargar las bajas."); });
    return () => { active = false; };
  }, []);

  // Se normaliza cada baja una sola vez (no por tecla).
  const indice = useMemo(
    () => (bajas || []).map((b) => ({ b, texto: normalizeForSearch(CAMPOS_BUSQUEDA.map((k) => b[k] ?? "").join(" ")) })),
    [bajas]
  );

  const { resultados, total } = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return { resultados: [], total: 0 };
    const tokens = q.split(/\s+/);
    const hits = indice.filter((r) => tokens.every((t) => r.texto.includes(t)));
    return { resultados: hits.slice(0, MAX_RESULTADOS).map((r) => r.b), total: hits.length };
  }, [indice, query]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-3">
      <div className="shrink-0 relative flex items-center pr-3 pl-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-xl shadow-sm transition-all">
        {!bajas && !error ? <Loader2 className="text-slate-400 size-4 mr-2 animate-spin shrink-0" /> : <Search className="text-slate-400 size-4 mr-2 shrink-0" />}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar baja por nombre, No. Empleado, RFC..."
          className="bg-transparent text-slate-800 dark:text-white text-sm font-bold w-full outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1.5 shrink-0">
            <X className="size-4" />
          </button>
        )}
      </div>
      {error && <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-2">{error}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto mt-2">
        {query.trim() ? (
          <>
            {total > MAX_RESULTADOS && (
              <p className="text-[10px] font-bold text-slate-400 mb-1">Mostrando {MAX_RESULTADOS} de {total}. Afina la búsqueda.</p>
            )}
            <MobileCardList
            compact data={resultados} config={cardConfig} onCardClick={setSelected} isLoading={!bajas && !error} pageSize={10} />
          </>
        ) : !error ? (
          <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">Empieza a escribir para ver resultados.</p>
        ) : null}
      </div>

      {selected && (
        <EmployeeRecordModal
          isOpen
          onClose={() => setSelected(null)}
          record={buildBajaRecord(selected)}
          columns={BAJA_RECORD_COLUMNS}
          canViewPhoto={canViewFoto}
        />
      )}
    </div>
  );
}
