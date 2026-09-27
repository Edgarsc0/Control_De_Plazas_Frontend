"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Loader2, Network } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";

const ESTADOS = { A: "Activo", S: "Suspendido", L: "Permiso", P: "Permiso Retribuido" };
// Igual que getNodoEstado de PlantillaDetalleTab: `Estado_Nomina` vacío = vacante.
const estadoNodo = (n) => {
  if (n?.Estado_Nomina !== undefined && n?.Estado_Nomina !== null) {
    const v = String(n.Estado_Nomina).trim().toUpperCase();
    return v ? ESTADOS[v] || "Vacante" : "Vacante";
  }
  return !n?.Empleado || String(n.Empleado).trim() === "" ? "Vacante" : "Activo";
};

const DEBOUNCE_MS = 250;
const MIN_CARACTERES = 2;

const Kpi = ({ label, valor, sub }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 min-w-0">
    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">{label}</p>
    <p className="text-xl font-black tabular-nums text-slate-800 dark:text-white leading-tight">{valor}</p>
    {sub && <p className="text-[10px] font-bold text-slate-400 truncate">{sub}</p>}
  </div>
);

/**
 * Cadena de mando rápida: escribe una posición, nombre o No. Empleado. "Abajo"
 * resume los subordinados (directos/indirectos, ocupadas/vacantes,
 * profundidad y niveles); "Arriba" lista la línea de jefes hasta la cima.
 * Consulta y dirección se guardan en `config`. El input autocompleta mientras se
 * escribe (posición o No. Empleado que empiezan con lo escrito, o nombre que
 * contiene todas las palabras): al elegir una sugerencia se consulta con su
 * posición exacta, sin la ambigüedad de un nombre parcial.
 */
export default function CadenaMandoWidget({ config, onConfigChange }) {
  const q = config?.q || "";
  const direction = config?.direction === "arriba" ? "arriba" : "abajo";
  const [borrador, setBorrador] = useState(q);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [buscandoSug, setBuscandoSug] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const contenedorRef = useRef(null);

  useEffect(() => { setBorrador(q); }, [q]);

  // Sugerencias con debounce; cada búsqueda cancela la anterior.
  useEffect(() => {
    const termino = borrador.trim();
    if (!abierto || termino.length < MIN_CARACTERES || termino === q) {
      setSugerencias([]);
      setBuscandoSug(false);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setBuscandoSug(true);
      VacantesService.getCadenaMandoSugerencias(termino, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((d) => {
          setSugerencias(Array.isArray(d) ? d : []);
          setIndiceActivo(-1);
        })
        .catch(() => { /* cancelada o sin red: se deja la lista vacía */ })
        .finally(() => { if (!ctrl.signal.aborted) setBuscandoSug(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [borrador, abierto, q]);

  // Cerrar la lista al hacer clic fuera del widget.
  useEffect(() => {
    const fuera = (e) => { if (!contenedorRef.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  useEffect(() => {
    if (!q) { setData(null); setError(null); return undefined; }
    let active = true;
    setCargando(true);
    setError(null);
    VacantesService.getCadenaMando(q, { direction })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || d.detail || "Error al buscar la cadena de mando");
        return d;
      })
      .then((d) => { if (active) setData(d); })
      .catch((err) => { if (active) { setData(null); setError(err.message || "Error al buscar la cadena de mando"); } })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [q, direction]);

  const cadena = data?.cadena;

  // Subordinados: Nivel_Hacia_Abajo 1 = directos, >1 = indirectos; 0 = la raíz.
  const stats = useMemo(() => {
    if (direction !== "abajo" || !cadena?.length) return null;
    const s = { directos: 0, indirectos: 0, ocupadas: 0, vacantes: 0, profundidad: 0, niveles: new Map() };
    let raiz = null;
    cadena.forEach((n) => {
      if (n.Nivel_Hacia_Abajo === 0) { raiz = n; return; }
      n.Nivel_Hacia_Abajo === 1 ? s.directos++ : s.indirectos++;
      estadoNodo(n) === "Vacante" ? s.vacantes++ : s.ocupadas++;
      s.profundidad = Math.max(s.profundidad, n.Nivel_Hacia_Abajo);
      const nv = String(n.Nivel || "").trim() || "Sin nivel";
      s.niveles.set(nv, (s.niveles.get(nv) || 0) + 1);
    });
    s.raiz = raiz;
    s.niveles = [...s.niveles.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
    return s;
  }, [cadena, direction]);

  const consultar = (valor) => {
    const limpio = (valor || "").trim();
    setAbierto(false);
    setSugerencias([]);
    setBorrador(limpio);
    if (limpio !== q) onConfigChange?.({ q: limpio });
  };

  // Enter con una sugerencia resaltada (flechas) elige esa; si no, consulta lo escrito.
  const buscar = (e) => {
    e?.preventDefault();
    consultar(sugerencias[indiceActivo]?.posicion ?? borrador);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && sugerencias.length) { e.preventDefault(); setIndiceActivo((i) => Math.min(i + 1, sugerencias.length - 1)); }
    else if (e.key === "ArrowUp" && sugerencias.length) { e.preventDefault(); setIndiceActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") setAbierto(false);
  };

  const mostrarLista = abierto && sugerencias.length > 0 && borrador.trim() !== q;

  return (
    <div ref={contenedorRef} className="w-full h-full flex flex-col min-h-0">
      <form onSubmit={buscar} className="shrink-0 p-2 flex flex-col gap-2 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={borrador}
            onChange={(e) => { setBorrador(e.target.value); setAbierto(true); }}
            onFocus={() => setAbierto(true)}
            onKeyDown={onKeyDown}
            placeholder="Posición, nombre o No. Empleado"
            aria-label="Consultar cadena de mando"
            role="combobox"
            aria-expanded={mostrarLista}
            aria-autocomplete="list"
            autoComplete="off"
            className="w-full pl-8 pr-14 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {(cargando || buscandoSug) && <Loader2 className="size-3.5 text-slate-400 animate-spin" />}
            {borrador && (
              <button type="button" aria-label="Limpiar" onClick={() => { setBorrador(""); if (q) onConfigChange?.({ q: "" }); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {mostrarLista && (
            <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
              {sugerencias.map((sg, i) => (
                <li
                  key={sg.posicion}
                  role="option"
                  aria-selected={i === indiceActivo}
                  // mousedown (no click): se elige antes de que el input pierda el foco.
                  onMouseDown={(e) => { e.preventDefault(); consultar(sg.posicion); }}
                  onMouseEnter={() => setIndiceActivo(i)}
                  className={`px-3 py-1.5 cursor-pointer ${i === indiceActivo ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{sg.posicion}</span>
                    {sg.id_empleado && <span className="font-mono text-[10px] font-bold text-slate-400">Emp. {sg.id_empleado}</span>}
                  </div>
                  <div className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 truncate">
                    {sg.ocupante || <span className="italic text-amber-700 dark:text-amber-400">Vacante</span>}
                  </div>
                  {sg.puesto && <div className="text-[10px] leading-tight text-slate-400 dark:text-slate-500 truncate">{sg.puesto}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 rounded-lg p-0.5 gap-0.5 self-start">
          {[["abajo", "Subordinados"], ["arriba", "Jefes"]].map(([val, txt]) => (
            <button
              key={val}
              type="button"
              onClick={() => direction !== val && onConfigChange?.({ direction: val })}
              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase cursor-pointer transition-all ${direction === val ? "bg-white dark:bg-slate-700 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
            >
              {txt}
            </button>
          ))}
        </div>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {!q ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <Network className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-56">Escribe una posición y presiona Enter para ver su cadena de mando.</p>
          </div>
        ) : error ? (
          <p className="text-center text-red-600 dark:text-red-400 text-xs font-bold mt-6">{error}</p>
        ) : cargando && !data ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>
        ) : stats ? (
          <div className="flex flex-col gap-2">
            {stats.raiz && (
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate" title={stats.raiz.Puesto_Funcional}>
                <span className="font-mono">{stats.raiz.Posicion}</span> · {stats.raiz.Empleado?.trim() || "Vacante"}
              </p>
            )}
            {stats.directos + stats.indirectos === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 mt-4">Esta posición no tiene subordinados.</p>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                  <Kpi label="Subordinados" valor={stats.directos + stats.indirectos} />
                  <Kpi label="Directos" valor={stats.directos} />
                  <Kpi label="Indirectos" valor={stats.indirectos} />
                  <Kpi label="Ocupadas" valor={stats.ocupadas} />
                  <Kpi label="Vacantes" valor={stats.vacantes} />
                  <Kpi label="Profundidad" valor={stats.profundidad} sub={stats.profundidad === 1 ? "nivel" : "niveles"} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.niveles.map(([nv, n]) => (
                    <span key={nv} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300">
                      {nv} <span className="text-[#621f32] dark:text-[#bc955c]">{n}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : direction === "arriba" && cadena?.length ? (
          <ol className="flex flex-col gap-1">
            {cadena.map((n) => (
              <li key={`${n.Posicion}-${n.Nivel_Hacia_Arriba}`} className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">{n.Posicion}</span>
                  <span className="text-[10px] font-black text-slate-400">{n.Nivel}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{n.Empleado?.trim() || <span className="italic text-amber-700 dark:text-amber-400">Vacante</span>}</p>
                <p className="text-[10px] text-slate-400 truncate">{n.Puesto_Funcional}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
