"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useElementSize } from "./useElementSize";
import { cargarFuente } from "./cuadrosFuentes";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import {
  classifyPos,
  classifyOcupada,
  TWO_WAY_FAMILIES,
  familiaDeNivel,
  VACANCIA_CATEGORY_TABS,
} from "@/app/dashboard/plantilla_empleados/_components/tabs/cuadros-vacancia/clasificacionPlazas";

// El listado por nivel es el mismo modal de "Ocupadas vs Vacantes por familia de nivel".
const EmployeesModal = dynamic(() => import("@/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal"), { ssr: false });

/**
 * "Estatus de posiciones por unidad administrativa": el widget "Plazas por unidad administrativa"
 * combinado con "Ocupadas vs Vacantes por familia de nivel".
 *
 * Misma fuente y mismas reglas que la gráfica de familias (Cuadros de Vacancia): las filas de
 * `desglose_jerarquico` (vacantes) y `desglose_jerarquico_ocupados` (ocupadas), clasificadas con
 * clasificacionPlazas.js — así los totales cuadran por construcción con ese widget. Aquí solo se
 * agrupan además por unidad administrativa (`Cd UA` / `nombre_ua` de cada fila).
 *
 * Tres niveles, todos apilados en los mismos 6 estatus:
 *  1. Una barra por UA (mayor a menor).
 *  2. Clic en una UA → sus familias de nivel (P's, D's, Operativos…).
 *  3. Clic en una familia → sus niveles tabulares exactos (P31, P23…).
 *  Clic en un nivel → el listado de esas posiciones de ESA unidad (EmployeesModal con las
 *  pestañas Ocupadas/Vacantes × Permanentes/Eventuales/N.C., recortado por código de UA).
 *
 * La transición entre niveles es la de la gráfica de familias: es UNA sola gráfica a la que se le
 * cambian los datos (no se desmonta), con la animación de Recharts escalonada por serie.
 *
 * Alcance por UN: ambos endpoints recortan sus filas por la UN de cada una, así que un rol
 * restringido solo ve sus unidades.
 */

// Orden de apilado (de abajo hacia arriba) y colores: los mismos de la gráfica de familias.
export const ESTATUS_POSICION = [
  { key: "ocup_permanente", label: "Ocupadas Permanentes", color: "#2f855a" },
  { key: "ocup_eventual", label: "Ocupadas Eventuales", color: "#57b788" },
  { key: "ocup_nc", label: "Ocupadas Eventuales Nueva Creación", color: "#9fd9bb" },
  { key: "vac_permanente", label: "Vacantes Permanentes", color: "#621f32" },
  { key: "vac_eventual", label: "Vacantes Eventuales", color: "#2e5890" },
  { key: "vac_nc", label: "Vacantes Eventuales Nueva Creación", color: "#bc955c" },
];
const CLAVE = {
  ocupada: { permanente: "ocup_permanente", eventual: "ocup_eventual", nuevaCreacion: "ocup_nc" },
  vacante: { permanente: "vac_permanente", eventual: "vac_eventual", nuevaCreacion: "vac_nc" },
};

const MODERN_EASING = "cubic-bezier(0.16, 1, 0.3, 1)"; // el de la gráfica de familias
const DURACION_ANIM = 900;
const MAX_ANCHO_BARRA = 44; // px — igual que Plazas por UA
const ANCHO_POR_BARRA = 34;
const ALTO_SCROLL = 14;
const MAX_CHARS = 8;
const fmt = (n) => Number(n || 0).toLocaleString("es-MX");
const normalizar = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const filaVacia = (extra) => {
  const r = { ...extra, total: 0, ocupadas: 0, vacantes: 0 };
  ESTATUS_POSICION.forEach((e) => { r[e.key] = 0; });
  return r;
};

// En familias de 2 divisiones (Operativos, K's) la nueva creación se suma a eventuales, igual
// que en la gráfica de familias.
const tipoEfectivo = (tipo, familia) => (tipo === "nuevaCreacion" && TWO_WAY_FAMILIES.has(familia) ? "eventual" : tipo);

function sumar(fila, clave, esOcupada) {
  fila[clave] += 1;
  fila.total += 1;
  if (esOcupada) fila.ocupadas += 1;
  else fila.vacantes += 1;
}

// Pie de barra de la vista de unidades: el código; si es largo se inclina y recorta.
function CodigoTick({ x, y, payload }) {
  const v = String(payload?.value ?? "");
  const largo = v.length > MAX_CHARS;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{v}</title>
      <text dy={12} textAnchor={largo ? "end" : "middle"} transform={largo ? "rotate(-45)" : undefined} fontSize={10} fontWeight={700} fill="#64748b">
        {largo ? `${v.slice(0, MAX_CHARS)}…` : v}
      </text>
    </g>
  );
}

function FilasEstatus({ row }) {
  return (
    <>
      {ESTATUS_POSICION.filter((e) => row[e.key] > 0).map((e) => (
        <div key={e.key} className="flex justify-between items-center gap-4">
          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: e.color }} />
            {e.label}
          </span>
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{fmt(row[e.key])}</span>
        </div>
      ))}
      <div className="flex justify-between items-center gap-4 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">Total</span>
        <span className="text-xs font-black text-[#621f32] dark:text-[#bc955c]">{fmt(row.total)}</span>
      </div>
    </>
  );
}

function FamiliaMini({ f }) {
  return (
    <>
      <span className="font-black text-slate-700 dark:text-slate-200">{f.etiqueta}</span>
      <span className="flex h-1.5 self-center rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {ESTATUS_POSICION.map((e) => f[e.key] > 0 && (
          <span key={e.key} style={{ width: `${(f[e.key] / f.total) * 100}%`, background: e.color }} />
        ))}
      </span>
      <span className="text-right font-bold text-emerald-700 dark:text-emerald-400" title="Ocupadas">{fmt(f.ocupadas)}</span>
      <span className="text-right font-bold text-[#621f32] dark:text-[#e6b9c6]" title="Vacantes">{fmt(f.vacantes)}</span>
    </>
  );
}

// Un solo tooltip para los tres niveles: cambia el título, el desglose y la pista de clic.
function TooltipEstatus({ active, payload, vista }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const titulo = vista === "ua" ? `${row.codigo !== row.nombre ? `${row.codigo} · ` : ""}${row.nombre}` : row.etiqueta;
  const pista = vista === "ua" ? "Clic para ver sus familias de nivel" : vista === "familia" ? "Clic para ver sus niveles" : "Clic para ver el listado de posiciones";
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-3 shadow-xl min-w-[230px] max-w-[320px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 break-words">{titulo}</p>
      <div className="space-y-1">
        <FilasEstatus row={row} />
        {vista === "ua" && row.hijos?.length > 0 && (
          <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Por familia de nivel</p>
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-2 gap-y-0.5 text-[10px]">
              {row.hijos.map((f) => <FamiliaMini key={f.etiqueta} f={f} />)}
            </div>
          </div>
        )}
        <p className="pt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">{pista}</p>
      </div>
    </div>
  );
}

export default function EstatusPosicionesUaWidget() {
  const [ref, { width, height }] = useElementSize();
  const { hasPermission } = useAuth();
  const canViewFoto = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO);
  const [datos, setDatos] = useState(null); // { desglose, ocupados }
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [uaSel, setUaSel] = useState(null); // código de UA
  const [familiaSel, setFamiliaSel] = useState(null); // "P's", "D's"…
  const [nivelModal, setNivelModal] = useState(null); // { nivel, cdUa, titulo }

  useEffect(() => {
    let activo = true;
    Promise.all([cargarFuente("desglose"), cargarFuente("ocupados")]).then(([desglose, ocupados]) => {
      if (!activo) return;
      if (!desglose && !ocupados) setError("No se pudo cargar el estatus de posiciones.");
      else setDatos({ desglose: Array.isArray(desglose) ? desglose : [], ocupados: Array.isArray(ocupados) ? ocupados : [] });
    });
    return () => { activo = false; };
  }, []);

  // Árbol UA → familia → nivel exacto, cada nodo con sus 6 conteos.
  const arbol = useMemo(() => {
    const mapa = new Map();
    if (!datos) return mapa;
    const agregar = (item, esOcupada) => {
      const codigo = String(item["Cd UA"] ?? "").trim() || "Sin UA";
      const nombre = String(item.nombre_ua ?? "").trim() || codigo;
      const familia = familiaDeNivel(item.Nivel);
      const nivel = String(item.Nivel ?? "").trim() || "Vacío";
      const tipo = tipoEfectivo(esOcupada ? classifyOcupada(item) : classifyPos(item["Posición"]), familia);
      const clave = CLAVE[esOcupada ? "ocupada" : "vacante"][tipo];

      let ua = mapa.get(codigo);
      if (!ua) { ua = { fila: filaVacia({ codigo, nombre }), familias: new Map() }; mapa.set(codigo, ua); }
      let fam = ua.familias.get(familia);
      if (!fam) { fam = { fila: filaVacia({ etiqueta: familia }), niveles: new Map() }; ua.familias.set(familia, fam); }
      let niv = fam.niveles.get(nivel);
      if (!niv) { niv = filaVacia({ etiqueta: nivel }); fam.niveles.set(nivel, niv); }
      sumar(ua.fila, clave, esOcupada);
      sumar(fam.fila, clave, esOcupada);
      sumar(niv, clave, esOcupada);
    };
    datos.desglose.forEach((it) => agregar(it, false));
    datos.ocupados.forEach((it) => agregar(it, true));
    return mapa;
  }, [datos]);

  const porTotal = (a, b) => b.total - a.total;
  const unidades = useMemo(
    () => [...arbol.values()]
      .map(({ fila, familias }) => ({ ...fila, hijos: [...familias.values()].map((f) => f.fila).sort(porTotal) }))
      .sort(porTotal),
    [arbol]
  );

  const uaNodo = uaSel ? arbol.get(uaSel) : null;
  const famNodo = uaNodo && familiaSel ? uaNodo.familias.get(familiaSel) : null;
  const vista = famNodo ? "nivel" : uaNodo ? "familia" : "ua";

  const unidadesFiltradas = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return unidades;
    const palabras = q.split(/\s+/);
    return unidades.filter((f) => {
      const texto = normalizar(`${f.nombre} ${f.codigo}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [unidades, busqueda]);

  // Datos de la ÚNICA gráfica según el nivel de profundidad. `x` es la categoría del eje.
  const filas = useMemo(() => {
    if (famNodo) return [...famNodo.niveles.values()].sort(porTotal).map((n) => ({ ...n, x: n.etiqueta }));
    if (uaNodo) return [...uaNodo.familias.values()].map((f) => f.fila).sort(porTotal).map((f) => ({ ...f, x: f.etiqueta }));
    return unidadesFiltradas.map((u) => ({ ...u, x: u.codigo }));
  }, [famNodo, uaNodo, unidadesFiltradas]);

  const bajar = (row) => {
    if (!row) return;
    if (vista === "ua") { setUaSel(row.codigo); setFamiliaSel(null); }
    else if (vista === "familia") setFamiliaSel(row.etiqueta);
    else {
      const ua = uaNodo.fila;
      setNivelModal({
        // El backend espera "SIN NIVEL" (no "Vacío", que es solo la etiqueta de interfaz).
        nivel: row.etiqueta === "Vacío" ? "SIN NIVEL" : row.etiqueta,
        cdUa: ua.codigo,
        titulo: `${row.etiqueta} · ${ua.nombre}`,
      });
    }
  };

  const subir = () => { if (familiaSel) setFamiliaSel(null); else setUaSel(null); };

  const mostrarLeyenda = height >= 230;
  const conCodigosLargos = vista === "ua" && filas.some((f) => String(f.x).length > MAX_CHARS);
  const anchoGrafica = vista === "ua" ? Math.max(width - 8, filas.length * ANCHO_POR_BARRA) : width - 8;
  const hayScroll = anchoGrafica > width - 8;
  const resumen = famNodo ? famNodo.fila : uaNodo ? uaNodo.fila : null;

  return (
    <div ref={ref} className="w-full h-full min-h-0 flex flex-col p-2">
      {error ? (
        <p className="m-auto text-center text-red-600 dark:text-red-400 text-xs font-bold">{error}</p>
      ) : !datos ? (
        <div className="m-auto"><Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" /></div>
      ) : (
        <>
          {uaNodo ? (
            <div className="shrink-0 flex items-center gap-2 pb-1.5 min-w-0">
              <button
                type="button"
                onClick={subir}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black text-[#621f32] dark:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" /> {familiaSel ? "Familias" : "Todas las unidades"}
              </button>
              <p className="min-w-0 flex-1 flex items-center gap-1 truncate text-xs font-extrabold text-slate-800 dark:text-slate-100" title={uaNodo.fila.nombre}>
                <button type="button" onClick={() => setFamiliaSel(null)} className="truncate hover:underline cursor-pointer">
                  {uaNodo.fila.codigo !== uaNodo.fila.nombre ? `${uaNodo.fila.codigo} · ` : ""}{uaNodo.fila.nombre}
                </button>
                {familiaSel && (<><ChevronRight className="size-3 shrink-0 text-slate-400" /><span className="shrink-0">{familiaSel}</span></>)}
              </p>
              {resumen && width >= 520 && (
                <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {fmt(resumen.total)} posiciones · <span className="text-emerald-700 dark:text-emerald-400">{fmt(resumen.ocupadas)} ocupadas</span> · <span className="text-[#621f32] dark:text-[#e6b9c6]">{fmt(resumen.vacantes)} vacantes</span>
                </span>
              )}
            </div>
          ) : (
            <div className="relative shrink-0 pb-1.5">
              <Search className="absolute left-2.5 top-[calc(50%-3px)] -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setBusqueda(""); }}
                placeholder="Buscar unidad administrativa…"
                aria-label="Buscar unidad administrativa"
                className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:border-[#621f32]/50 dark:focus:border-[#bc955c]/50"
              />
              {busqueda && (
                <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" className="absolute right-1.5 top-[calc(50%-3px)] -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {mostrarLeyenda && (
            <div className="shrink-0 flex items-center gap-x-3 gap-y-1 flex-wrap px-1 pb-1">
              {ESTATUS_POSICION.map((e) => (
                <span key={e.key} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  {e.label}
                </span>
              ))}
            </div>
          )}

          {filas.length === 0 ? (
            <p className="m-auto text-center text-xs font-bold text-slate-400 dark:text-slate-500">
              {busqueda.trim() ? `Ninguna unidad coincide con “${busqueda.trim()}”.` : "Sin posiciones para mostrar."}
            </p>
          ) : (
            // Siempre la MISMA estructura (contenedor con scroll + una BarChart): así Recharts
            // conserva la gráfica al cambiar de nivel y anima la transición en vez de montar
            // una nueva de golpe.
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
              <div style={{ width: anchoGrafica, height: hayScroll ? `calc(100% - ${ALTO_SCROLL}px)` : "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filas}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    barCategoryGap="15%"
                    maxBarSize={MAX_ANCHO_BARRA}
                    style={{ cursor: "pointer" }}
                    // Recharts 3: el clic del gráfico da el índice activo; cada <Bar> da su fila.
                    onClick={(state) => {
                      const i = Number(state?.activeTooltipIndex ?? state?.activeIndex);
                      if (Number.isInteger(i)) bajar(filas[i]);
                    }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                    <XAxis
                      type="category"
                      dataKey="x"
                      interval={0}
                      tick={vista === "ua" ? <CodigoTick /> : { fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      height={conCodigosLargos ? 56 : 22}
                    />
                    <YAxis type="number" allowDecimals={false} width={36} tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipEstatus vista={vista} />} cursor={{ fill: "rgba(98,31,50,0.04)" }} />
                    {ESTATUS_POSICION.map((e, i) => (
                      <Bar
                        key={e.key}
                        dataKey={e.key}
                        name={e.label}
                        stackId="estatus"
                        fill={e.color}
                        cursor="pointer"
                        isAnimationActive
                        animationBegin={80 + i * 60}
                        animationDuration={DURACION_ANIM}
                        animationEasing={MODERN_EASING}
                        onClick={(barra) => bajar(barra?.payload ?? barra)}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {nivelModal && (
        <EmployeesModal
          open
          onOpenChange={(abierto) => { if (!abierto) setNivelModal(null); }}
          nivel={nivelModal.nivel}
          cdUa={nivelModal.cdUa}
          categoryTabs={VACANCIA_CATEGORY_TABS}
          canViewPhoto={canViewFoto}
          fotoPermissionCodename="view_plantilla_mov_posiciones_foto"
        />
      )}
    </div>
  );
}
