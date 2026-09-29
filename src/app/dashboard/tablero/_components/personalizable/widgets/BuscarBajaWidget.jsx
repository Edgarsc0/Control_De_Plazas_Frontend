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
import { filasQueCoinciden } from "@/utils/busquedaFlexible";
import { cargarBajas, buildBajaRecord, BAJA_RECORD_COLUMNS } from "@/app/dashboard/plantilla_empleados/_components/shared/bajasExpediente";


const CAMPOS_BUSQUEDA = ["nombre_completo", "no_empleado", "posicion", "rfc", "curp", "motivo_descr", "accion_descr", "unidad_admon", "departamento", "puesto"];
const MAX_RESULTADOS = 100;


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

  // Se normaliza cada baja una sola vez (no por tecla): Map baja → texto normalizado.
  const indice = useMemo(
    () => new Map((bajas || []).map((b) => [b, normalizeForSearch(CAMPOS_BUSQUEDA.map((k) => b[k] ?? "").join(" "))])),
    [bajas]
  );

  // Búsqueda flexible (palabras en cualquier orden, sin acentos, errores de dedo leves solo si
  // no hay coincidencias exactas) — la misma de Plantilla Detalle, ver utils/busquedaFlexible.
  const { resultados, total } = useMemo(() => {
    const coinciden = query.trim() ? filasQueCoinciden(bajas || [], indice, query) : null;
    if (!coinciden) return { resultados: [], total: 0 };
    const hits = (bajas || []).filter((b) => coinciden.has(b));
    return { resultados: hits.slice(0, MAX_RESULTADOS), total: hits.length };
  }, [bajas, indice, query]);

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
