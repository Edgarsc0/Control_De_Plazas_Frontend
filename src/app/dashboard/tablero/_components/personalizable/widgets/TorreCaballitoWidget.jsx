"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { Search, MapPin, X, RotateCcw, Loader2, MousePointerClick, Users, ChevronDown } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import FotoEmpleadoCell from "@/app/dashboard/plantilla_empleados/_components/shared/FotoEmpleadoCell";
import EmployeesModal from "@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal";
import { useAuth } from "@/hooks/useAuth";
import { useElementSize } from "./useElementSize";
import { PERMISSIONS } from "@/config/permissions";
import {
  TorreCaballito,
  CameraRig,
  extractFloorNumber,
  getColor,
  PALETA_ORIGINAL,
} from "@/app/dashboard/plantilla_empleados/_components/tabs/torre-3d/TorreCaballito3DTab";

const DEBOUNCE_MS = 350;
const MIN_CARACTERES = 3;
const ALTO_PISO = 1.8; // debe coincidir con `floorHeight` de TorreCaballito
const VISTA_INICIAL = { position: [70, 45, 70], lookAt: [0, 25, 0] };
// Columnas del listado del piso (las que trae torre-caballito/empleados/).
const COLUMNAS_LISTADO = ["id_empleado", "nombres", "posicion", "unidad_administrativa", "ubicacion", "estado_nomina"];
// EmployeesModal usa las llaves de la Plantilla de Empleados; este endpoint trae otras.
const mapearFilaTorre = (r) => ({
  ...r,
  id_empleado: r.num_empleado,
  numempleado: r.num_empleado,
  nombres: r.nombre,
  unidad_administrativa: r.ua,
});

/**
 * Torre Caballito (Reforma 10) como widget del tablero: la torre 3D con un
 * buscador de empleados que responde EN QUÉ PISO está (el piso se ilumina con un
 * faro y la cámara vuela hasta él). Sin ninguna búsqueda activa, hacer clic en
 * un piso abre el listado completo de los empleados de ese piso; con un
 * empleado buscado el clic no abre nada, para no mezclar los dos usos.
 *
 * Reutiliza `TorreCaballito` y `CameraRig` del tab de Plantilla (misma torre,
 * mismos datos). El listado del piso es el `EmployeesModal` general de la
 * Plantilla de Empleados (el mismo de las demás vistas), que se dibuja por
 * portal en <body>: así no queda atrapado dentro del widget.
 */
export default function TorreCaballitoWidget() {
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA_FOTO);

  const [data, setData] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [targetCamera, setTargetCamera] = useState(null);

  // Búsqueda
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [empleado, setEmpleado] = useState(null); // { nombre, piso, ua }
  const [aviso, setAviso] = useState(null);
  const contenedorRef = useRef(null);
  // Tamaño del widget: con poco espacio se simplifican los rótulos flotantes (ver `compacto`/`muyChico`).
  const [tamRef, { width, height }] = useElementSize();
  const compacto = width > 0 && (width < 340 || height < 300);
  const muyChico = width > 0 && (width < 240 || height < 220);

  // Modal de empleados del piso
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadosData, setEmpleadosData] = useState([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [tituloModal, setTituloModal] = useState("");

  // Pill de activos + ranking de pisos (igual que la pestaña): el pill muestra el total de la
  // torre y al hacer clic despliega/oculta el ranking.
  const [rankingAbierto, setRankingAbierto] = useState(false);
  const pisosOrdenados = useMemo(() => [...data].sort((a, b) => b.count - a.count).filter((d) => d.count > 0), [data]);
  const totalActivos = useMemo(() => data.reduce((acc, p) => acc + (p.count || 0), 0), [data]);
  const maxConteo = useMemo(() => Math.max(0, ...data.map((d) => d.count || 0)), [data]);

  useEffect(() => {
    let active = true;
    VacantesService.getTorreCaballito3D()
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la torre."))))
      // Un 403/500 devuelve un objeto de error, no un arreglo: mejor una torre vacía que romper el render.
      .then((d) => { if (active) setData(Array.isArray(d) ? d : []); })
      .catch((err) => { if (active) setError(err.message || "No se pudo cargar la torre."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, []);

  // Autocompletado con debounce; cada búsqueda cancela la anterior.
  useEffect(() => {
    const termino = consulta.trim();
    if (empleado || termino.length < MIN_CARACTERES) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      VacantesService.searchTorreCaballito(termino, { signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((d) => { setResultados(Array.isArray(d?.results) ? d.results : []); setIndiceActivo(-1); })
        .catch(() => { /* cancelada o sin red */ })
        .finally(() => { if (!ctrl.signal.aborted) setBuscando(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [consulta, empleado]);

  // Cerrar la lista al hacer clic fuera del widget.
  useEffect(() => {
    const fuera = (e) => { if (!contenedorRef.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const abrirListadoPiso = useCallback((pisoLabel) => {
    setModalAbierto(true);
    setEmpleadosData([]);
    setCargandoEmpleados(true);
    setTituloModal(`Empleados en ${pisoLabel}`);
    VacantesService.getTorreCaballitoEmpleados(pisoLabel, "")
      .then((res) => res.json())
      .then((d) => setEmpleadosData(Array.isArray(d) ? d.map(mapearFilaTorre) : []))
      .catch((err) => console.error(err))
      .finally(() => setCargandoEmpleados(false));
  }, []);

  // Clic en un piso de la torre: sin empleado buscado abre el listado del piso.
  const alClicPiso = useCallback((info) => {
    if (empleado) return;
    setSelectedInfo(info);
    if (info?.count > 0) abrirListadoPiso(info.pisoLabel);
  }, [empleado, abrirListadoPiso]);

  const limpiar = useCallback(() => {
    setConsulta("");
    setResultados([]);
    setEmpleado(null);
    setAviso(null);
    setSelectedInfo(null);
    setHoverInfo(null);
    setAbierto(false);
    setRankingAbierto(false);
    setTargetCamera({ ...VISTA_INICIAL });
  }, []);

  const elegirEmpleado = (emp) => {
    setAbierto(false);
    setResultados([]);
    if (!emp.piso_num) {
      setConsulta(emp.Nombres);
      setEmpleado(null);
      setSelectedInfo(null);
      setAviso(`${emp.Nombres} no tiene un piso asignado.`);
      return;
    }
    setAviso(null);
    setConsulta(emp.Nombres);
    const indice = parseInt(emp.piso_num, 10);
    const yPiso = indice * ALTO_PISO + ALTO_PISO / 2;
    const piso = data.find((d) => extractFloorNumber(d.piso) === indice);
    const pisoLabel = piso?.piso ?? (indice === 0 ? "Planta Baja" : `Piso ${indice}`);
    setEmpleado({ nombre: emp.Nombres, piso: pisoLabel, ua: emp["Unidad Administrativa"], numempleado: emp.Numempleado });
    setSelectedInfo({
      pisoLabel,
      count: piso?.count ?? 0,
      uas: piso?.uas,
      dominantUa: piso?.uas?.length ? piso.uas.reduce((p, c) => (p.count > c.count ? p : c)).nombre : null,
      employeeName: emp.Nombres,
    });
    // La cámara vuela al piso, igual que en el tab.
    const angulo = Math.PI / 4;
    const distancia = 42;
    setTargetCamera({
      position: [Math.sin(angulo) * distancia, yPiso + 18, Math.cos(angulo) * distancia],
      lookAt: [0, yPiso, 0],
    });
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && resultados.length) { e.preventDefault(); setIndiceActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp" && resultados.length) { e.preventDefault(); setIndiceActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && resultados.length) { e.preventDefault(); elegirEmpleado(resultados[Math.max(indiceActivo, 0)]); }
    else if (e.key === "Escape") setAbierto(false);
  };

  if (cargando) {
    return <div className="w-full h-full flex items-center justify-center"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>;
  }
  if (error) {
    return <div className="w-full h-full flex items-center justify-center p-4 text-center"><p className="text-red-600 dark:text-red-400 text-xs font-bold">{error}</p></div>;
  }

  const mostrarLista = abierto && !empleado && resultados.length > 0;
  const infoHover = !empleado ? hoverInfo : null;

  return (
    <div ref={(el) => { contenedorRef.current = el; tamRef.current = el; }} className="relative w-full h-full min-h-0 bg-transparent overflow-hidden">
      <Canvas camera={{ position: [20, 5, 20], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 50, 20]} intensity={1.5} castShadow />
        <pointLight position={[-20, 30, -20]} intensity={1} color="#38bdf8" />
        {/* Entorno procedural (sin fetch a CDN): mismo criterio que el tab. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} color="white" position={[0, 5, -9]} rotation={[0, 0, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={2} color="white" position={[-5, 1, -1]} rotation={[0, Math.PI / 2, 0]} scale={[10, 2, 1]} />
          <Lightformer intensity={2} color="white" position={[10, 1, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[20, 2, 1]} />
          <Lightformer intensity={1} color="#bc955c" position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[15, 15, 1]} />
        </Environment>
        <TorreCaballito
          data={data}
          hoverInfo={hoverInfo}
          setHoverInfo={setHoverInfo}
          selectedInfo={selectedInfo}
          setSelectedInfo={alClicPiso}
          mode="heat"
          hoveredUaRemote={null}
          selectedUaRemote={null}
          paleta={PALETA_ORIGINAL}
        />
        <ContactShadows resolution={1024} scale={100} blur={2.5} opacity={0.6} far={20} color="#000000" position={[0, -0.49, 0]} />
        <CameraRig targetCamera={targetCamera} />
      </Canvas>

      {/* Buscador */}
      <div className={`absolute z-10 ${muyChico ? "top-1 left-1 right-1" : "top-2 left-2 right-2"}`}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#621f32] dark:text-[#bc955c] pointer-events-none" />
          <input
            type="text"
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setEmpleado(null); setSelectedInfo(null); setAviso(null); setAbierto(true); }}
            onFocus={() => setAbierto(true)}
            onKeyDown={onKeyDown}
            placeholder={compacto ? "Buscar empleado…" : "Buscar empleado para ver su piso…"}
            aria-label="Buscar empleado en la Torre Caballito"
            role="combobox"
            aria-expanded={mostrarLista}
            aria-autocomplete="list"
            autoComplete="off"
            className={`w-full pl-8 pr-14 ${muyChico ? "py-1" : "py-2"} text-xs font-semibold rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-md focus:outline-none focus:border-[#621f32]/60 dark:focus:border-[#bc955c]/60`}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {buscando && <Loader2 className="size-3.5 text-slate-400 animate-spin" />}
            {(consulta || empleado) && (
              <button type="button" aria-label="Limpiar" onClick={limpiar} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="size-3.5" /></button>
            )}
          </div>
          {mostrarLista && (
            <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
              {resultados.map((emp, i) => (
                <li
                  key={`${emp.Nombres}-${i}`}
                  role="option"
                  aria-selected={i === indiceActivo}
                  // mousedown (no click): se elige antes de que el input pierda el foco.
                  onMouseDown={(e) => { e.preventDefault(); elegirEmpleado(emp); }}
                  onMouseEnter={() => setIndiceActivo(i)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer ${i === indiceActivo ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  {/* Foto (solo con permiso). `pointer-events-none`: un clic sobre la foto
                      elige la sugerencia en vez de ampliar la imagen. */}
                  {canViewFoto && (
                    <span className="pointer-events-none shrink-0 size-9 rounded-full overflow-hidden">
                      <FotoEmpleadoCell numempleado={emp.Numempleado} size={36} fallbackClassName="bg-slate-100 dark:bg-slate-800" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{emp.Nombres}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{emp["Unidad Administrativa"]}</span>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-black ${emp.piso_num ? "text-[#621f32] dark:text-[#f3dcd4]" : "text-slate-400"}`}>
                        <MapPin className="size-3" />{emp.piso_num ? `Piso ${emp.piso_num}` : "Sin piso"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Respuesta: en qué piso está el empleado */}
      {empleado && (
        <div className={`absolute z-10 flex items-center rounded-2xl border border-[#bc955c]/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-xl ${compacto ? "bottom-1 left-1 right-1 gap-2 px-2 py-1" : "bottom-2 left-2 right-2 gap-3 px-3 py-2"}`}>
          {canViewFoto && empleado.numempleado ? (
            <span className={`shrink-0 rounded-xl overflow-hidden ring-2 ring-[#bc955c]/60 ${compacto ? "size-8" : "size-12"}`}>
              <FotoEmpleadoCell numempleado={empleado.numempleado} size={compacto ? 32 : 48} caption={empleado.nombre} />
            </span>
          ) : (
            <div className={`shrink-0 rounded-xl bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#10243e] flex items-center justify-center ${compacto ? "size-8" : "size-10"}`}><MapPin className={compacto ? "size-4" : "size-5"} /></div>
          )}
          <div className="min-w-0 flex-1">
            {!compacto && <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Se encuentra en</p>}
            <p className={`${compacto ? "text-sm" : "text-base"} font-black leading-tight text-[#621f32] dark:text-[#f3dcd4]`}>{empleado.piso}</p>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{empleado.nombre}</p>
            {empleado.ua && !compacto && <p className="text-[10px] text-slate-400 truncate">{empleado.ua}</p>}
          </div>
          <button type="button" onClick={limpiar} title="Quitar búsqueda" aria-label="Quitar búsqueda" className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#621f32] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="size-4" /></button>
        </div>
      )}

      {aviso && !empleado && (
        <div className="absolute bottom-2 left-2 right-2 z-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-300 shadow-lg">{aviso}</div>
      )}

      {/* Sin búsqueda: pista y detalle del piso bajo el cursor */}
      {!empleado && !aviso && !muyChico && (
        <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
          {infoHover && (
            <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 px-3 py-1.5 shadow-lg">
              <p className="text-xs font-black text-[#621f32] dark:text-[#f3dcd4]">{infoHover.pisoLabel}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{infoHover.count} empleados · clic para ver el listado</p>
            </div>
          )}
          {!compacto && <span className="flex items-center gap-1 rounded-lg bg-black/45 px-2 py-1 text-[10px] font-bold text-white/85 backdrop-blur">
            <MousePointerClick className="size-3" />Clic en un piso para ver sus empleados
          </span>}
        </div>
      )}

      {/* Pill de activos (como en la pestaña): total de la torre; clic despliega el ranking de pisos. */}
      {!empleado && !mostrarLista && (
        <div className={`absolute z-10 left-2 right-2 flex flex-col items-center gap-2 pointer-events-none ${muyChico ? "top-9" : "top-12"}`}>
          <button
            type="button"
            onClick={() => setRankingAbierto((o) => !o)}
            aria-expanded={rankingAbierto}
            title={rankingAbierto ? "Ocultar ranking de pisos" : "Ver ranking de pisos"}
            className={`pointer-events-auto flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full border border-slate-200 dark:border-slate-800/80 shadow-lg active:scale-95 transition-transform cursor-pointer ${compacto ? "px-3 py-1.5" : "px-4 py-2"}`}
          >
            <Users className="size-4 text-[#621f32] dark:text-[#bc955c]" />
            <span className="font-black text-sm text-[#621f32] dark:text-[#f3dcd4]">{totalActivos.toLocaleString("es-MX")}</span>
            {!muyChico && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Activos</span>}
            <ChevronDown className={`size-3.5 text-slate-400 transition-transform ${rankingAbierto ? "rotate-180" : ""}`} />
          </button>

          {rankingAbierto && (
            <div className="pointer-events-auto w-full max-w-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                <span className="size-3 rounded-full shrink-0" style={{ background: PALETA_ORIGINAL.calorMin }} />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Menos</span>
                <span className="flex-1 h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${PALETA_ORIGINAL.calorMin}, ${PALETA_ORIGINAL.calorMax})` }} />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">Más empleados</span>
                <span className="size-3 rounded-full shrink-0" style={{ background: PALETA_ORIGINAL.calorMax }} />
              </div>
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-[1.25rem] border border-slate-200 dark:border-slate-800/80 shadow-lg flex flex-col min-h-0">
                <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Ranking de pisos</h4>
                {pisosOrdenados.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin empleados registrados en la torre.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: Math.max(96, height - (compacto ? 170 : 200)) }}>
                    {pisosOrdenados.map((piso) => {
                      const color = getColor(piso.count, maxConteo, PALETA_ORIGINAL).getHexString();
                      const info = {
                        pisoLabel: piso.piso,
                        count: piso.count,
                        uas: piso.uas,
                        dominantUa: piso.uas?.length ? piso.uas.reduce((p, c) => (p.count > c.count ? p : c)).nombre : null,
                      };
                      return (
                        <button
                          type="button"
                          key={piso.piso}
                          onMouseEnter={() => setHoverInfo(info)}
                          onMouseLeave={() => setHoverInfo(null)}
                          onClick={() => alClicPiso(info)}
                          title={`Ver empleados de ${piso.piso}`}
                          className="flex justify-between items-center gap-3 bg-slate-100 dark:bg-slate-800/60 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-left"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: `#${color}` }} />
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate">{piso.piso}</span>
                          </span>
                          <span className="font-extrabold text-[#621f32] dark:text-[#f3dcd4] bg-[#621f32]/5 dark:bg-[#621f32]/15 border border-[#621f32]/10 dark:border-[#bc955c]/25 px-2 py-0.5 rounded-xl text-[11px] shrink-0">{piso.count} emp.</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={limpiar}
        title="Restablecer vista"
        aria-label="Restablecer vista"
        className={`absolute z-10 rounded-xl ${muyChico ? "bottom-1 right-1 p-1" : "bottom-2 right-2 p-2"} bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] shadow cursor-pointer`}
        style={empleado ? { bottom: compacto ? "3.5rem" : "5.25rem" } : undefined}
      >
        <RotateCcw className="size-4" />
      </button>

      {modalAbierto && (
        <EmployeesModal
          open
          onOpenChange={(abrir) => { if (!abrir) { setModalAbierto(false); setEmpleadosData([]); setCargandoEmpleados(false); } }}
          rows={empleadosData}
          rowsLoading={cargandoEmpleados}
          title={tituloModal}
          defaultColumnKeys={COLUMNAS_LISTADO}
          restrictColumnsTo={COLUMNAS_LISTADO}
          canViewPhoto={canViewFoto}
          fotoPermissionCodename="view_plantilla_geografia_foto"
        />
      )}
    </div>
  );
}
