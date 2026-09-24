"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Lock, Search, X } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { formatDateEsMx, normalizeForSearch } from "@/utils/columnFilters";
import { fmtNum, nombreCompleto, useMovimientosHoyStats, useSinRestriccionUN } from "./movimientosHoyShared";

const COLUMNAS = [
  { key: "posicion", label: "Posición", mono: true },
  { key: "num_empleado", label: "No. Empleado", mono: true },
  { key: "nombre", label: "Nombre" },
  { key: "accion_nombre", label: "Acción" },
  { key: "motivo_nombre", label: "Motivo" },
  { key: "fecha_efectiva", label: "Fecha Efectiva", fecha: true },
  { key: "fecha_captura", label: "Fecha Captura", fecha: true },
  { key: "por", label: "Por", mono: true },
];

const valorCelda = (row, col) => {
  const v = col.key === "nombre" ? nombreCompleto(row) : row[col.key];
  if (v === null || v === undefined || String(v).trim() === "") return "";
  return col.fecha ? formatDateEsMx(v) : String(v);
};

// Renglón clicable de la lista de acciones/motivos.
function Renglon({ item, activo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${activo ? "bg-[#621f32]/8 dark:bg-[#bc955c]/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/40"}`}
    >
      <span className="shrink-0 size-2.5 rounded-full" style={{ background: item.color }} />
      <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
      <span className="text-xs font-black text-slate-500 shrink-0">
        {fmtNum(item.value)}<span className="text-slate-400 font-normal ml-1">({item.pct}%)</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
    </button>
  );
}

/**
 * "Movimientos realizados hoy" (el modal de Plantilla Detalle) como widget:
 * acciones → motivos → listado completo de los movimientos de ese cruce
 * (acción + motivo + hoy). El recorrido se conserva en `config`.
 */
export default function MovimientosHoyDetalleWidget({ config, onConfigChange }) {
  const { cargando: cargandoAuth, permitido } = useSinRestriccionUN();
  const [accion, setAccion] = useState(config?.accion || null);
  const [motivo, setMotivo] = useState(config?.motivo || null);
  const { fechaHoy, porAccion, porMotivo, cargandoAcciones, cargandoMotivos, error } = useMovimientosHoyStats(accion, permitido);
  const [filas, setFilas] = useState([]);
  const [cargandoFilas, setCargandoFilas] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setAccion(config?.accion || null);
    setMotivo(config?.motivo || null);
  }, [config?.accion, config?.motivo]);

  const ir = (a, m) => {
    setAccion(a); setMotivo(m); setBusqueda("");
    onConfigChange?.({ accion: a, motivo: m });
  };

  useEffect(() => {
    if (!permitido || !accion || !motivo) { setFilas([]); return undefined; }
    let active = true;
    setCargandoFilas(true);
    VacantesService.getMovimientosPersonal({
      fecha_captura: fechaHoy,
      accion_nombre: accion,
      motivo_nombre: motivo,
      no_pagination: "true",
      sort_by: "fecha_efectiva,fecha_captura",
      sort_order: "desc",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => { if (active) setFilas(Array.isArray(d) ? d : []); })
      .catch(() => { if (active) setFilas([]); })
      .finally(() => { if (active) setCargandoFilas(false); });
    return () => { active = false; };
  }, [permitido, fechaHoy, accion, motivo]);

  const filasVisibles = useMemo(() => {
    const q = normalizeForSearch(busqueda.trim());
    if (!q) return filas;
    return filas.filter((r) => COLUMNAS.some((c) => normalizeForSearch(valorCelda(r, c)).includes(q)));
  }, [filas, busqueda]);

  if (!cargandoAuth && !permitido) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center p-3">
        <Lock className="size-5 text-slate-400" />
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Resumen disponible solo sin restricción de Unidad de Negocio.</p>
      </div>
    );
  }

  const Cargando = () => <div className="flex justify-center py-8"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>;

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      {/* Migas de pan: Hoy › Acción › Motivo */}
      <div className="shrink-0 flex items-center flex-wrap gap-1 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 text-[10px] font-black uppercase tracking-wider">
        <button type="button" onClick={() => ir(null, null)} className={`cursor-pointer ${accion ? "text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c]" : "text-[#621f32] dark:text-[#bc955c]"}`}>
          Hoy · {fmtNum(porAccion.total)} mov.
        </button>
        {accion && (
          <>
            <ChevronRight className="size-3 text-slate-300" />
            <button type="button" onClick={() => ir(accion, null)} className={`cursor-pointer truncate max-w-[40%] ${motivo ? "text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c]" : "text-[#621f32] dark:text-[#bc955c]"}`}>
              {accion}
            </button>
          </>
        )}
        {motivo && (
          <>
            <ChevronRight className="size-3 text-slate-300" />
            <span className="text-[#621f32] dark:text-[#bc955c] truncate max-w-[40%]">{motivo}</span>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {error ? (
          <p className="text-center text-red-600 dark:text-red-400 text-xs font-bold p-4">{error}</p>
        ) : !accion ? (
          cargandoAuth || cargandoAcciones ? <Cargando /> : porAccion.items.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {porAccion.items.map((it) => <Renglon key={it.name} item={it} onClick={() => ir(it.name, null)} />)}
            </div>
          ) : <p className="text-center text-xs font-bold text-slate-400 p-6">Sin movimientos capturados hoy.</p>
        ) : !motivo ? (
          cargandoMotivos ? <Cargando /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {porMotivo.items.map((it) => <Renglon key={it.name} item={it} onClick={() => ir(accion, it.name)} />)}
            </div>
          )
        ) : cargandoFilas ? <Cargando /> : (
          <div className="flex flex-col min-h-0">
            <div className="sticky left-0 shrink-0 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={`Filtrar ${fmtNum(filas.length)} movimientos…`}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
                />
                {busqueda && (
                  <button type="button" onClick={() => setBusqueda("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <table className="w-max min-w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                <tr>
                  {COLUMNAS.map((c) => (
                    <th key={c.key} className="px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((row, i) => (
                  <tr key={`${row.num_empleado ?? ""}-${row.posicion ?? ""}-${row.sec ?? i}`} className="border-t border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    {COLUMNAS.map((c) => (
                      <td key={c.key} className={`px-3 py-1.5 whitespace-nowrap text-slate-700 dark:text-slate-300 ${c.mono ? "font-mono" : ""}`}>{valorCelda(row, c)}</td>
                    ))}
                  </tr>
                ))}
                {!filasVisibles.length && (
                  <tr><td colSpan={COLUMNAS.length} className="text-center text-xs font-bold text-slate-400 py-6">Sin resultados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
