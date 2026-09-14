"use client";

import { useState, useEffect } from "react";
import { Search, X, Loader2, UserCheck, UserMinus, UserX, CalendarDays, Activity } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import MobileCardList from "@/components/ui/MobileCardList";
import { EmployeeRecordModal } from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";

// Mismo mapeo que TableroRH.jsx — duplicado a propósito (convención ya usada
// en este proyecto, ver comentario en TableroRH.jsx) para que este widget no
// dependa de otro tab/componente.
const mapEstadoNomina = (val) => {
  if (!val || String(val).trim() === "") return "Vacante";
  switch (String(val).trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Permiso";
    case "P": return "Permiso Retribuido";
    default: return "Vacante";
  }
};

const STATUS_ICONS = { "Activo": UserCheck, "Vacante": UserMinus, "Suspendido": UserX, "Permiso": CalendarDays, "Permiso Retribuido": Activity };
const STATUS_BADGE_STYLES = {
  "Activo": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30" },
  "Vacante": { bg: "bg-[#bc955c]/8 dark:bg-[#bc955c]/15", text: "text-[#a37944] dark:text-[#ebd1ac]", border: "border-[#bc955c]/20 dark:border-[#bc955c]/30" },
  "Suspendido": { bg: "bg-blue-50/50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-300", border: "border-blue-200/50 dark:border-blue-900/40" },
  "Permiso": { bg: "bg-purple-50/50 dark:bg-purple-950/20", text: "text-purple-600 dark:text-purple-300", border: "border-purple-200/50 dark:border-purple-900/40" },
  "Permiso Retribuido": { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/50 dark:border-emerald-900/40" },
};

const renderEstadoBadge = (row) => {
  const est = mapEstadoNomina(row.estado_nomina);
  const Icon = STATUS_ICONS[est] || UserCheck;
  const badge = STATUS_BADGE_STYLES[est] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
      <Icon className="size-3" />{est}
    </span>
  );
};

const PERSONA_CARD_CONFIG = {
  getRowId: (row, i) => row.posicion ?? i,
  getTitle: (row) => (row.nombres && String(row.nombres).trim()) ? row.nombres : "Vacante",
  getSubtitle: (row) => (row.posicion ? `POS ${row.posicion}` : ""),
  renderBadge: renderEstadoBadge,
  fields: [
    { key: "rfc", label: "RFC", mono: true },
    { key: "curp", label: "CURP", mono: true },
    { key: "unidad_administrativa", label: "Unidad Administrativa" },
    { key: "nombre_puesto_funcional", label: "Puesto Funcional" },
  ],
};

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Widget del tablero personalizable: búsqueda de personas (Plantilla Detalle)
 * por nombre, RFC, CURP, unidad administrativa, etc. — mismo panel que ya
 * existía inline en TableroRH.jsx, extraído para poder colocarse
 * independientemente en la cuadrícula (ver widgetRegistry.js). Búsqueda
 * server-side (no trae el dataset completo), igual que TableroRH.
 */
export default function BuscarPersonaWidget() {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);

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
    VacantesService.getEmpleadosCompletosActivosDetalle({ search: debouncedQuery })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo buscar en la plantilla."))))
      .then((data) => { if (active) setResults(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message || "Error al buscar en la plantilla."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [debouncedQuery]);

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
            placeholder="Buscar persona por nombre, RFC, CURP..."
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
            config={PERSONA_CARD_CONFIG}
            onCardClick={(row) => setSelectedRow(row)}
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
