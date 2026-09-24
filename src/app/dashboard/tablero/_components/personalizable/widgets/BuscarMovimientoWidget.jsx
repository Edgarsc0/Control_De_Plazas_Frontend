"use client";

import { useState, useEffect } from "react";
import { Search, X, Loader2, ArrowRightLeft } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import MobileCardList from "@/components/ui/MobileCardList";
import { EmployeeRecordModal } from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";

// Igual que `buildFullName` en MovimientosPersonalTab.jsx/TableroRH.jsx: el
// backend trae nombre/ap_pat/ap_mat por separado, no hay campo combinado.
const buildMovNombreCompleto = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(" ").trim();

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

/**
 * Widget del tablero personalizable: búsqueda de movimientos de personal por
 * nombre, RFC, CURP, posición, motivo, etc. — mismo panel que ya existía
 * inline en TableroRH.jsx, extraído para poder colocarse independientemente
 * en la cuadrícula (ver widgetRegistry.js). Búsqueda server-side.
 */
export default function BuscarMovimientoWidget() {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);

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
            data={results}
            config={MOVIMIENTO_CARD_CONFIG}
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
          canViewPhoto={canViewFoto}
        />
      )}
    </div>
  );
}
