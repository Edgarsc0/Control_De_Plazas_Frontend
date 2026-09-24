"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, GitBranch, Loader2 } from "lucide-react";
import PosicionArbolModal from "@/app/dashboard/plantilla_empleados/_components/modals/PosicionArbolModal";
import { VacantesService } from "@/services/vacantes.service";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

const DEBOUNCE_MS = 250;
const MIN_CARACTERES = 2;

/**
 * Árbol de movimientos de una plaza (el mismo que se abre al hacer clic en la
 * columna "Posición" de Plantilla Detalle), como widget del tablero. La
 * posición elegida se guarda en `config.posicion` del widget, así que se
 * conserva por widget y por usuario junto con el resto del layout. El input
 * autocompleta con las plazas que empiezan con lo escrito, mostrando el
 * ocupante (si está ocupada) y si la plaza está activa o inactiva.
 */
export default function ArbolMovimientosWidget({ config, onConfigChange }) {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);
  const posicion = config?.posicion || "";
  const [borrador, setBorrador] = useState(posicion);
  const [sugerencias, setSugerencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const contenedorRef = useRef(null);

  useEffect(() => { setBorrador(posicion); }, [posicion]);

  // Sugerencias con debounce; cada búsqueda cancela la anterior.
  useEffect(() => {
    const termino = borrador.trim();
    if (!abierto || termino.length < MIN_CARACTERES || termino === posicion) {
      setSugerencias([]);
      setCargando(false);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setCargando(true);
      VacantesService.getPlazaSugerencias(termino, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setSugerencias(Array.isArray(data) ? data : []);
          setIndiceActivo(-1);
        })
        .catch(() => { /* cancelada o sin red: se deja la lista vacía */ })
        .finally(() => { if (!ctrl.signal.aborted) setCargando(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [borrador, abierto, posicion]);

  // Cerrar la lista al hacer clic fuera del widget.
  useEffect(() => {
    const fuera = (e) => { if (!contenedorRef.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const elegir = (valor) => {
    const limpio = (valor || "").trim();
    setAbierto(false);
    setSugerencias([]);
    if (!limpio) return;
    setBorrador(limpio);
    if (limpio !== posicion) onConfigChange?.({ posicion: limpio });
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setIndiceActivo((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(indiceActivo >= 0 && sugerencias[indiceActivo] ? sugerencias[indiceActivo].posicion : borrador);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrarLista = abierto && borrador.trim().length >= MIN_CARACTERES && borrador.trim() !== posicion;

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
            onKeyDown={onKeyDown}
            placeholder="Buscar posición (ej. 12345)"
            aria-label="Posición a consultar"
            role="combobox"
            aria-expanded={mostrarLista}
            aria-autocomplete="list"
            autoComplete="off"
            className="w-full pl-8 pr-14 py-1.5 text-xs font-mono rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {cargando && <Loader2 className="size-3.5 text-slate-400 animate-spin" />}
            {posicion && (
              <button
                type="button"
                onClick={() => { setBorrador(""); setSugerencias([]); onConfigChange?.({ posicion: "" }); }}
                aria-label="Quitar posición"
                title="Quitar posición"
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {mostrarLista && (
          <ul
            role="listbox"
            className="absolute left-2 right-2 top-full mt-0.5 z-50 max-h-72 overflow-y-auto custom-scrollbar rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
          >
            {sugerencias.length === 0 && !cargando && (
              <li className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">Sin coincidencias.</li>
            )}
            {sugerencias.map((s, i) => (
              <li
                key={s.posicion}
                role="option"
                aria-selected={i === indiceActivo}
                // mousedown (no click): se elige antes de que el input pierda el foco.
                onMouseDown={(e) => { e.preventDefault(); elegir(s.posicion); }}
                onMouseEnter={() => setIndiceActivo(i)}
                className={`px-3 py-1.5 cursor-pointer ${i === indiceActivo ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{s.posicion}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${s.activa ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                    <span className={`size-1.5 rounded-full ${s.activa ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {s.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 truncate">
                  {s.ocupada ? s.ocupante : <span className="italic text-amber-700 dark:text-amber-400">Vacante</span>}
                </div>
                {s.puesto && <div className="text-[10px] leading-tight text-slate-400 dark:text-slate-500 truncate">{s.puesto}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {posicion ? (
          <PosicionArbolModal embedded open onOpenChange={() => {}} posicion={posicion} canViewPhoto={canViewFoto} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <GitBranch className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-56">
              Escribe una posición para ver el tronco de la plaza: creación, ocupaciones, vacancias e insubsistencias.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
