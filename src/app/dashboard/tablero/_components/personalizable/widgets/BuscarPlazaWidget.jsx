"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2, GitBranch, Briefcase } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import PosicionArbolModal from "@/app/dashboard/plantilla_empleados/_components/modals/PosicionArbolModal";
import HistorialMovimientosTab from "@/app/dashboard/plantilla_empleados/_components/shared/HistorialMovimientosTab";

const DEBOUNCE_MS = 250;
const MIN_CARACTERES = 2;

const ESTADOS = { A: "Activo", S: "Suspendido", L: "Permiso", P: "Permiso Retribuido" };
const estadoNomina = (v) => (v && String(v).trim() ? ESTADOS[String(v).trim().toUpperCase()] || "Vacante" : "Vacante");

const Dato = ({ label, valor }) => (
  <div className="min-w-0">
    <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
    <dd className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={valor || ""}>{valor || "—"}</dd>
  </div>
);

/**
 * Ficha rápida de una plaza: escribes una posición (autocompleta con el
 * ocupante y si está activa), ves su estado, ocupante, UA, puesto y nivel, y
 * debajo el mismo diagrama por carriles (adscripción por columna) del tab
 * "Historial de posición" del Expediente de plaza. La plaza queda en
 * `config.posicion`.
 */
export default function BuscarPlazaWidget({ config, onConfigChange }) {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);
  const canViewHistorial = hasPermission(PERMISSIONS.VIEW_EXPEDIENTE_HISTORIAL_POSICION);
  const posicion = config?.posicion || "";
  const [borrador, setBorrador] = useState(posicion);
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [arbolAbierto, setArbolAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [historial, setHistorial] = useState({ status: "idle", data: null });
  const contenedorRef = useRef(null);

  useEffect(() => { setBorrador(posicion); }, [posicion]);

  useEffect(() => {
    const termino = borrador.trim();
    if (!abierto || termino.length < MIN_CARACTERES || termino === posicion) { setSugerencias([]); setBuscando(false); return undefined; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setBuscando(true);
      VacantesService.getPlazaSugerencias(termino, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((d) => { setSugerencias(Array.isArray(d) ? d : []); setIndiceActivo(-1); })
        .catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setBuscando(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [borrador, abierto, posicion]);

  useEffect(() => {
    const fuera = (e) => { if (!contenedorRef.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Ficha de la plaza elegida (misma fuente que "Buscar Persona").
  useEffect(() => {
    if (!posicion) { setFicha(null); return undefined; }
    let active = true;
    setCargandoFicha(true);
    VacantesService.getEmpleadosCompletosActivosDetalle({ search: posicion })
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => {
        if (!active) return;
        const filas = Array.isArray(d) ? d : [];
        setFicha(filas.find((r) => String(r.posicion).trim() === posicion) || null);
      })
      .catch(() => { if (active) setFicha(null); })
      .finally(() => { if (active) setCargandoFicha(false); });
    return () => { active = false; };
  }, [posicion]);

  // Historia de la plaza (MOV_POS). No depende de `ficha`: una plaza que ya no
  // está en la plantilla activa conserva su historia. El backend responde DESC
  // y el diagrama se lee más viejo → vigente, igual que en EmployeesModal.
  useEffect(() => {
    if (!posicion || !canViewHistorial) { setHistorial({ status: "idle", data: null }); return undefined; }
    let active = true;
    setHistorial({ status: "loading", data: null });
    VacantesService.getMovimientosPosicionHistorial([posicion])
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        const asc = [...(await res.json())].reverse();
        if (active) setHistorial(asc.length > 0 ? { status: "success", data: asc } : { status: "empty", data: [] });
      })
      .catch(() => { if (active) setHistorial({ status: "error", data: null }); });
    return () => { active = false; };
  }, [posicion, canViewHistorial]);

  const elegir = (valor) => {
    const limpio = (valor || "").trim();
    setAbierto(false);
    setSugerencias([]);
    if (!limpio) return;
    setBorrador(limpio);
    if (limpio !== posicion) onConfigChange?.({ posicion: limpio });
  };

  const mostrarLista = abierto && sugerencias.length > 0 && borrador.trim() !== posicion;
  const estado = ficha ? estadoNomina(ficha.estado_nomina) : null;

  return (
    <div ref={contenedorRef} className="w-full h-full flex flex-col min-h-0">
      <div className="relative shrink-0 p-2 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={borrador}
            onChange={(e) => { setBorrador(e.target.value); setAbierto(true); }}
            onFocus={() => setAbierto(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && sugerencias.length) { e.preventDefault(); setIndiceActivo((i) => Math.min(i + 1, sugerencias.length - 1)); }
              else if (e.key === "ArrowUp" && sugerencias.length) { e.preventDefault(); setIndiceActivo((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); elegir(sugerencias[Math.max(indiceActivo, 0)]?.posicion ?? borrador); }
              else if (e.key === "Escape") setAbierto(false);
            }}
            placeholder="Buscar plaza / posición (ej. 12345)"
            aria-label="Posición a consultar"
            autoComplete="off"
            className="w-full pl-8 pr-14 py-1.5 text-xs font-mono rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {buscando && <Loader2 className="size-3.5 text-slate-400 animate-spin" />}
            {borrador && (
              <button type="button" aria-label="Limpiar" onClick={() => { setBorrador(""); setSugerencias([]); if (posicion) onConfigChange?.({ posicion: "" }); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {mostrarLista && (
          <ul className="absolute left-2 right-2 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
            {sugerencias.map((s, i) => (
              <li key={s.posicion} onMouseDown={(e) => { e.preventDefault(); elegir(s.posicion); }} onMouseEnter={() => setIndiceActivo(i)} className={`px-3 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${i === indiceActivo ? "bg-slate-100 dark:bg-slate-800" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{s.posicion}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${s.activa ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                    <span className={`size-1.5 rounded-full ${s.activa ? "bg-emerald-500" : "bg-slate-400"}`} />{s.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 truncate">
                  {s.ocupada ? s.ocupante : <span className="italic text-amber-700 dark:text-amber-400">Vacante</span>}
                </div>
                {s.puesto && <div className="text-[10px] leading-tight text-slate-400 truncate">{s.puesto}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {!posicion ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <Briefcase className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-56">Escribe una posición para ver su ficha y la historia de su adscripción.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cargandoFicha ? (
              <div className="flex items-center justify-center py-3"><Loader2 className="size-5 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>
            ) : !ficha ? (
              <p className="text-xs font-bold text-slate-400">La posición {posicion} no está en la plantilla activa{canViewHistorial ? "; abajo su historia." : "."}</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-black text-slate-800 dark:text-white">{ficha.posicion}</span>
                  <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase ${estado === "Vacante" ? "bg-[#bc955c]/10 text-[#a37944] border-[#bc955c]/30" : "bg-[#621f32]/8 text-[#621f32] dark:text-[#f3dcd4] border-[#621f32]/20"}`}>{estado}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Dato label="Ocupante" valor={estado === "Vacante" ? "Vacante" : ficha.nombres} />
                  <Dato label="Nivel" valor={ficha.nivel} />
                  <Dato label="Puesto funcional" valor={ficha.nombre_puesto_funcional} />
                  <Dato label="Unidad administrativa" valor={ficha.unidad_administrativa} />
                </dl>
              </>
            )}
            <button
              type="button"
              onClick={() => setArbolAbierto(true)}
              className="self-start flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[#621f32] dark:text-[#bc955c] font-black text-[10px] uppercase hover:shadow cursor-pointer"
            >
              <GitBranch className="size-3.5" />Ver árbol de la plaza
            </button>
            {canViewHistorial && (
              <div className="min-w-0">
                <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Historia de la posición</h4>
                <HistorialMovimientosTab estado={historial} variant="posicion" posicion={posicion} canViewPhoto={canViewFoto} />
              </div>
            )}
          </div>
        )}
      </div>

      {arbolAbierto && posicion && (
        <PosicionArbolModal open onOpenChange={(o) => { if (!o) setArbolAbierto(false); }} posicion={posicion} canViewPhoto={canViewFoto} />
      )}
    </div>
  );
}
