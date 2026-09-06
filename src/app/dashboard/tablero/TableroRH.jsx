"use client";

import { useState, useEffect } from "react";
import { Search, X, Loader2, UserCheck, UserMinus, UserX, CalendarDays, Activity, ArrowRightLeft } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import MobileCardList from "@/components/ui/MobileCardList";
import { EmployeeRecordModal } from "../plantilla_empleados/_components/shared/EmployeesModal";
import CuadrosVacanciaCard from "./_components/CuadrosVacanciaCard";

// Mismo mapeo de código crudo (A/S/L/P) → etiqueta que usa Plantilla Detalle
// (ver PlantillaDetalleTab.jsx) — duplicado aquí a propósito (patrón ya usado
// en el resto del proyecto, ej. EstatusTab.jsx/excelExport.js) para que este
// tablero no dependa de un tab específico; es deliberadamente el mapeo base,
// sin el desdoble a Solicitada/No Disponible (esos sub-estatus son propios de
// la gestión de vacantes, no de una búsqueda rápida de personas).
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

// Igual que `buildFullName` en MovimientosPersonalTab.jsx: el backend trae
// nombre/ap_pat/ap_mat por separado, no hay campo combinado.
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

// Los dos paneles buscan en el backend (debounce, sin traer el dataset
// completo al cliente) — igual que MovimientosTab.jsx. Antes Personas cargaba
// las ~11 mil filas activas completas al montar y filtraba en cliente; medido:
// eso tardaba ~25s en frío. Convertido a búsqueda server-side (mismo endpoint,
// nuevo param `search`, ver EmpleadosCompletosActivosDetalleView en el
// backend), el tablero queda usable de inmediato y cada búsqueda tarda ~2-3s
// — comparable a lo que ya tarda la búsqueda de Movimientos.
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Tablero ejecutivo de una sola página, sin redirecciones — pensado para
 * perfiles que necesitan una vista muy concisa en vez del sistema completo
 * (ej. la Dirección de Recursos Humanos, ver Whitelist.tablero="rh" en el
 * backend). Se muestra en vez del dashboard normal cuando el usuario tiene
 * este tablero asignado en Roles y Permisos > Usuarios (ver /dashboard/page.jsx).
 *
 * Dos paneles lado a lado (apilados en móvil): a la izquierda, la misma
 * búsqueda global de Plantilla Detalle (nombre, RFC, CURP, unidad
 * administrativa, etc.); a la derecha, la misma búsqueda pero sobre
 * Movimientos de Personal. Ambos, sin tabla completa: solo tarjetas de
 * resultado (mismo componente que la vista móvil, `MobileCardList`) y, al
 * hacer clic, el mismo modal de expediente (`EmployeeRecordModal`). Cada
 * panel hace scroll únicamente en su propia lista de resultados, nunca en la
 * página completa (ver overflow-y-auto en los contenedores de resultados).
 * Habrá más tableros en el futuro junto a este (ver carpeta `tablero/`).
 */
export default function TableroRH() {
  const { hasPermission } = useAuth();
  const canViewFotoPersonas = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);
  const canViewFotoMovimientos = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO);

  // --- Panel Personas (Plantilla Detalle) ---
  const [personaQuery, setPersonaQuery] = useState("");
  const [debouncedPersonaQuery, setDebouncedPersonaQuery] = useState("");
  const [personaResults, setPersonaResults] = useState([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [errorPersonas, setErrorPersonas] = useState(null);
  const [selectedPersonaRow, setSelectedPersonaRow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPersonaQuery(personaQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [personaQuery]);

  useEffect(() => {
    if (!debouncedPersonaQuery) {
      setPersonaResults([]);
      setErrorPersonas(null);
      setIsLoadingPersonas(false);
      return;
    }
    let active = true;
    setIsLoadingPersonas(true);
    VacantesService.getEmpleadosCompletosActivosDetalle({ search: debouncedPersonaQuery })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo buscar en la plantilla."))))
      .then((data) => { if (active) setPersonaResults(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setErrorPersonas(err.message || "Error al buscar en la plantilla."); })
      .finally(() => { if (active) setIsLoadingPersonas(false); });
    return () => { active = false; };
  }, [debouncedPersonaQuery]);

  // --- Panel Movimientos ---
  const [movQuery, setMovQuery] = useState("");
  const [debouncedMovQuery, setDebouncedMovQuery] = useState("");
  const [movResults, setMovResults] = useState([]);
  const [isLoadingMov, setIsLoadingMov] = useState(false);
  const [errorMov, setErrorMov] = useState(null);
  const [selectedMovRow, setSelectedMovRow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMovQuery(movQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [movQuery]);

  useEffect(() => {
    if (!debouncedMovQuery) {
      setMovResults([]);
      setErrorMov(null);
      setIsLoadingMov(false);
      return;
    }
    let active = true;
    setIsLoadingMov(true);
    VacantesService.getMovimientosPersonal({ no_pagination: true, search: debouncedMovQuery })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudieron cargar los movimientos."))))
      .then((data) => { if (active) setMovResults(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setErrorMov(err.message || "Error al buscar movimientos."); })
      .finally(() => { if (active) setIsLoadingMov(false); });
    return () => { active = false; };
  }, [debouncedMovQuery]);

  const handleSelectMovRow = (row) => {
    // Mismo remapeo que MovimientosPersonalTab.jsx: EmployeeRecordModal
    // espera un registro con forma de empleado (nombre combinado, etc.).
    setSelectedMovRow({
      ...row,
      id_empleado: row.num_empleado,
      nombre: buildMovNombreCompleto(row),
      nombres: buildMovNombreCompleto(row),
      nivel: row.nv_jerarquico || row.grado,
    });
  };

  return (
    // Mismo patrón de altura fija (sin scroll de página) que MapaTab.jsx: se
    // descuenta el stack fijo (banner+navbar en desktop, BottomNav en móvil)
    // vía las variables CSS globales. `overflow-hidden` solo en la fila de
    // paneles (no en este contenedor raíz): así el overlay `fixed` de
    // CuadrosVacanciaCard puede flotar por encima de esa fila sin quedar
    // recortado, mientras el tablero como un todo nunca hace scroll de
    // página completo.
    <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex flex-col">
      <CuadrosVacanciaCard />

      {/* Cada panel reparte header (fijo) + resultados (único que hace
          scroll, ver overflow-y-auto en cada uno). */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200/70 dark:divide-slate-800/80">
      {/* Panel izquierdo: Personas */}
      <div className="w-full md:w-1/2 min-h-0 flex flex-col overflow-hidden px-4 sm:px-6 py-6">
        <div className="shrink-0 flex flex-col">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Tablero <span className="text-[#621f32] dark:text-[#bc955c]">RH</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Busca a una persona por nombre, RFC, CURP, unidad administrativa, posición, etc.
          </p>

          <div className="relative flex items-center pr-3 pl-5 py-4 mt-4 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl shadow-md transition-all">
            {isLoadingPersonas ? (
              <Loader2 className="text-slate-400 size-5 mr-3 animate-spin shrink-0" />
            ) : (
              <Search className="text-slate-400 size-5 mr-3 shrink-0" />
            )}
            <input
              type="text"
              autoFocus
              value={personaQuery}
              onChange={(e) => setPersonaQuery(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-slate-800 dark:text-white text-sm font-bold w-full outline-none disabled:opacity-50"
            />
            {personaQuery && (
              <button onClick={() => setPersonaQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1.5 shrink-0">
                <X className="size-4" />
              </button>
            )}
          </div>

          {errorPersonas && (
            <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-3">{errorPersonas}</p>
          )}
        </div>

        {/* Único elemento que hace scroll en este panel: nunca la página completa. */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-2">
          {personaQuery.trim() ? (
            <MobileCardList
              data={personaResults}
              config={PERSONA_CARD_CONFIG}
              onCardClick={(row) => setSelectedPersonaRow(row)}
              isLoading={isLoadingPersonas && personaResults.length === 0}
              pageSize={10}
            />
          ) : !errorPersonas ? (
            <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">
              Empieza a escribir para ver resultados.
            </p>
          ) : null}
        </div>
      </div>

      {/* Panel derecho: Movimientos de Personal */}
      <div className="w-full md:w-1/2 min-h-0 flex flex-col overflow-hidden px-4 sm:px-6 py-6">
        <div className="shrink-0 flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
            Movimientos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Busca un movimiento de personal por nombre, RFC, CURP, posición, motivo, etc.
          </p>

          <div className="relative flex items-center pr-3 pl-5 py-4 mt-4 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl shadow-md transition-all">
            {isLoadingMov ? (
              <Loader2 className="text-slate-400 size-5 mr-3 animate-spin shrink-0" />
            ) : (
              <Search className="text-slate-400 size-5 mr-3 shrink-0" />
            )}
            <input
              type="text"
              value={movQuery}
              onChange={(e) => setMovQuery(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-slate-800 dark:text-white text-sm font-bold w-full outline-none disabled:opacity-50"
            />
            {movQuery && (
              <button onClick={() => setMovQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1.5 shrink-0">
                <X className="size-4" />
              </button>
            )}
          </div>

          {errorMov && (
            <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-3">{errorMov}</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto mt-2">
          {movQuery.trim() ? (
            <MobileCardList
              data={movResults}
              config={MOVIMIENTO_CARD_CONFIG}
              onCardClick={handleSelectMovRow}
              isLoading={isLoadingMov && movResults.length === 0}
              pageSize={10}
            />
          ) : !errorMov ? (
            <p className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">
              Empieza a escribir para ver resultados.
            </p>
          ) : null}
        </div>
      </div>
      </div>

      {selectedPersonaRow && (
        <EmployeeRecordModal
          isOpen={!!selectedPersonaRow}
          onClose={() => setSelectedPersonaRow(null)}
          record={selectedPersonaRow}
          canViewPhoto={canViewFotoPersonas}
        />
      )}

      {selectedMovRow && (
        <EmployeeRecordModal
          isOpen={!!selectedMovRow}
          onClose={() => setSelectedMovRow(null)}
          record={selectedMovRow}
          canViewPhoto={canViewFotoMovimientos}
        />
      )}
    </div>
  );
}
