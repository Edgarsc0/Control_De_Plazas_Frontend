"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Search, ChevronRight, TrendingUp, Network, GitCompareArrows, Briefcase, GitBranch, Building2, MapPin, Sparkles, Clock, User, Ban, Layers, Plus, Minus, Scan, Loader2 } from "lucide-react";
import WidgetFrame from "./WidgetFrame";
import { tamanoEnPx } from "./gridGeometry";
import { useElementSize } from "./widgets/useElementSize";
import { prefijoTipoCuadrosVacancia } from "./widgets/cuadrosVacanciaElementos";
import { prefijoTipoAccesoRapido } from "./widgetRegistry";
import { metaDeWidget } from "./widgetCatalogoMeta";

/**
 * Vista previa de un widget en la tienda (WidgetStoreModal). NO monta el
 * widget real (haría un fetch por tarjeta): dibuja una maqueta con el MISMO
 * marco (`WidgetFrame`), las mismas proporciones (`defaultW × defaultH` celdas
 * de un escritorio típico) y la misma estructura interna de cada módulo, con
 * datos de ejemplo. Se pinta a tamaño "real" en un lienzo virtual y se escala
 * para caber en la tarjeta.
 *
 * Está estática y solo se anima con el cursor sobre la tarjeta (`.group:hover
 * .wp-*` en globals.css).
 */
const G = "#621f32";
const D = "#bc955c";
const ESTADOS = [
  ["Activo", G, 62], ["Vacante", D, 18], ["Suspendido", "#3b82f6", 8], ["Permiso Retribuido", "#10b981", 7], ["Permiso", "#8b5cf6", 5],
];
const dl = (i, paso = 0.12) => ({ animationDelay: `${i * paso}s` });

// Escritorio de referencia (1500 px de ancho, fila de 84 px) para dar a cada
// maqueta el tamaño en px que tendría de verdad en el tablero.
const ESCRITORIO_REF = 1500;
const FILA_REF = 84;

/* ───────────────────────── Primitivas ───────────────────────── */

/** Input de búsqueda con refs al placeholder y al texto escrito (los anima BuscadorConSugerencias). */
function Buscador({ texto, phRef, escritoRef, className = "" }) {
  return (
    <div className={`flex items-center pr-3 pl-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-sm ${className}`}>
      <Search className="text-slate-400 size-4 mr-2 shrink-0" />
      <span ref={phRef} className="text-sm font-bold text-slate-400 whitespace-nowrap">{texto}</span>
      <span ref={escritoRef} className="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap" />
      <span className="wp-cursor ml-0.5 w-px h-4 bg-slate-500 shrink-0" />
    </div>
  );
}

/**
 * Buscador con su "video" de demostración, que corre mientras la tarjeta de la
 * galería (`[data-tarjeta]`) tiene el cursor encima. En reposo muestra el widget
 * VACÍO (como al abrirlo: placeholder + "Empieza a escribir…"). Guion:
 * zoom in al input → se borra el placeholder → se escribe `escrito` letra por
 * letra → zoom out → las sugerencias entran una a una → pausa → reinicia.
 */
function BuscadorConSugerencias({ texto, escrito, children }) {
  const raiz = useRef(null);
  const zoom = useRef(null);
  const ph = useRef(null);
  const typed = useRef(null);
  const vacio = useRef(null);
  const lista = useRef(null);

  useEffect(() => {
    const tarjeta = raiz.current?.closest("[data-tarjeta]");
    if (!tarjeta || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let tl = null;
    const reposo = () => {
      gsap.set(zoom.current, { scale: 1, opacity: 1 });
      gsap.set(ph.current, { display: "inline", opacity: 1 });
      gsap.set(vacio.current, { opacity: 1 });
      gsap.set(lista.current.children, { opacity: 0, y: -14, scale: 0.96 });
      typed.current.textContent = "";
    };
    const arrancar = () => {
      tl?.kill();
      reposo();
      const letras = { n: 0 };
      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
      tl.to(zoom.current, { scale: 2.2, duration: 1, ease: "power2.inOut" }, 0.7)
        .to(ph.current, { opacity: 0, duration: 0.25 }, 1.9)
        .set(ph.current, { display: "none" }, 2.15)
        .to(letras, {
          n: escrito.length, duration: escrito.length * 0.09, ease: "none",
          onUpdate: () => { typed.current.textContent = escrito.slice(0, Math.round(letras.n)); },
        }, 2.3)
        .to(zoom.current, { scale: 1, duration: 1, ease: "power2.inOut" }, "+=0.5")
        .to(vacio.current, { opacity: 0, duration: 0.2 }, "<0.5")
        .to(lista.current.children, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.3 }, "<0.1")
        .to(zoom.current, { opacity: 0, duration: 0.4 }, "+=2.6")
        .call(reposo);
    };
    const detener = () => { tl?.kill(); tl = null; reposo(); };
    reposo();
    tarjeta.addEventListener("mouseenter", arrancar);
    tarjeta.addEventListener("mouseleave", detener);
    return () => {
      tarjeta.removeEventListener("mouseenter", arrancar);
      tarjeta.removeEventListener("mouseleave", detener);
      tl?.kill();
    };
  }, [escrito]);

  return (
    <div ref={raiz} className="w-full h-full overflow-hidden p-3">
      <div ref={zoom} className="h-full flex flex-col gap-2" style={{ transformOrigin: "20% 5%" }}>
        <Buscador texto={texto} phRef={ph} escritoRef={typed} />
        <div className="relative flex-1 min-h-0">
          <p ref={vacio} className="text-center text-xs font-bold text-slate-400 dark:text-slate-600 mt-10">Empieza a escribir para ver resultados.</p>
          <div ref={lista} className="absolute inset-x-0 top-0 flex flex-col gap-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BuscadorCompacto({ texto, mono }) {
  return (
    <div className="shrink-0 p-2 border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="relative flex items-center pl-8 pr-2 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <Search className="absolute left-2.5 size-3.5 text-slate-400" />
        <span className={`text-xs text-slate-400 truncate ${mono ? "font-mono" : ""}`}>{texto}</span>
        <span className="wp-cursor ml-0.5 w-px h-3.5 bg-slate-500" />
      </div>
    </div>
  );
}

/** Tarjeta de resultado (MobileCardList): título, subtítulo, badge y campos. */
function TarjetaResultado({ titulo, sub, badge, badgeColor, campos, foto, i }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-sm">
      {foto && <div className="size-11 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{titulo}</p>
            <p className="text-[11px] font-bold text-slate-400">{sub}</p>
          </div>
          {badge && (
            <span className="shrink-0 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase" style={{ color: badgeColor, borderColor: `${badgeColor}55`, background: `${badgeColor}14` }}>
              {badge}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {campos.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[8px] font-black uppercase text-slate-400">{k}</p>
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dona({ items, className = "size-full" }) {
  const R = 36.5;
  const len = 2 * Math.PI * R;
  const total = items.reduce((s, x) => s + x[2], 0);
  let acum = 0;
  return (
    <svg viewBox="0 0 100 100" className={`wp-dona ${className}`}>
      <g transform="rotate(-90 50 50)">
        {items.map(([n, color, v]) => {
          const frac = v / total;
          const seg = (
            <circle key={n} cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="17"
              strokeDasharray={`${len * frac} ${len}`} strokeDashoffset={-len * acum} />
          );
          acum += frac;
          return seg;
        })}
      </g>
    </svg>
  );
}

function Leyenda({ items }) {
  return (
    <ul className="flex flex-col gap-1.5 shrink-0">
      {items.map(([n, color, v], i) => (
        <li key={n} className="wp-fila flex items-center justify-between gap-3 text-xs" style={dl(i, 0.1)}>
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: color }} /><span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{n}</span></span>
          <span className="font-black tabular-nums text-slate-900 dark:text-white">{v * 24}<span className="ml-1.5 text-[10px] font-bold text-slate-400">{v}%</span></span>
        </li>
      ))}
    </ul>
  );
}

/** Ejes + rejilla de una gráfica (estilo recharts del proyecto). */
function Ejes({ children, etiquetas, yTicks = 4 }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="size-full">
      {Array.from({ length: yTicks }, (_, i) => {
        const y = 10 + (i * 150) / (yTicks - 1);
        return <line key={i} x1="34" x2="396" y1={y} y2={y} stroke="#cbd5e1" strokeOpacity="0.5" strokeDasharray="4 4" />;
      })}
      {Array.from({ length: yTicks }, (_, i) => (
        <text key={i} x="28" y={14 + (i * 150) / (yTicks - 1)} textAnchor="end" fontSize="10" fontWeight="700" fill="#64748b">{(yTicks - 1 - i) * 250}</text>
      ))}
      {etiquetas.map((t, i) => (
        <text key={t} x={34 + ((i + 0.5) * 362) / etiquetas.length} y="180" textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">{t}</text>
      ))}
      {children}
    </svg>
  );
}

function BarrasApiladas({ n = 8, series }) {
  const ancho = 362 / n;
  const alto = 150;
  return (
    <Ejes etiquetas={Array.from({ length: n }, (_, i) => `UA${i + 1}`)}>
      {Array.from({ length: n }, (_, i) => {
        let y = 160;
        const total = 0.95 - i * (0.5 / n);
        // Una columna = un grupo: crece completa desde la base (no cada
        // segmento por su cuenta, que desarmaría la pila).
        return (
          <g key={i} className="wp-barra" style={dl(i, 0.09)}>
            {series.map(([color, frac], j) => {
              const h = alto * total * frac;
              y -= h;
              return <rect key={j} x={34 + i * ancho + ancho * 0.18} y={y} width={ancho * 0.64} height={h} fill={color} />;
            })}
          </g>
        );
      })}
    </Ejes>
  );
}

function Lineas({ series, etiquetas, area }) {
  return (
    <Ejes etiquetas={etiquetas}>
      {series.map(([color, pts], k) => {
        const puntos = pts.map((v, i) => [34 + 10 + (i * 342) / (pts.length - 1), 160 - v * 150]);
        const d = puntos.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
        return (
          <g key={color}>
            {area && k === 0 && <path d={`${d} L${puntos.at(-1)[0]} 160 L${puntos[0][0]} 160 Z`} fill={color} opacity="0.12" />}
            <path className="wp-linea" pathLength="1" style={dl(k, 0.25)} d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {puntos.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />)}
          </g>
        );
      })}
    </Ejes>
  );
}

function Tabla({ cols, filas, pie, rojo, className = "" }) {
  return (
    <div className={`size-full overflow-hidden ${className}`}>
      <table className="w-full border-collapse text-[11px]">
        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-black whitespace-nowrap border-b border-slate-200 dark:border-slate-800">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={`wp-fila border-b border-slate-100 dark:border-slate-800/70 ${rojo === i ? "bg-rose-50 dark:bg-rose-950/30" : ""}`} style={dl(i, 0.1)}>
              {f.map((c, j) => (
                <td key={j} className={`px-3 py-2 whitespace-nowrap ${j === 0 ? `font-semibold text-left ${rojo === i ? "text-rose-700 italic" : "text-slate-800 dark:text-slate-100"}` : "text-slate-600 dark:text-slate-300 tabular-nums"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie && (
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold">
              {pie.map((c, j) => <td key={j} className="px-3 py-2 text-left text-slate-900 dark:text-slate-100">{c}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Kpi({ label, valor, i }) {
  return (
    <div className="wp-fila rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2" style={dl(i)}>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-black tabular-nums text-[#621f32] dark:text-[#bc955c] leading-tight">{valor}</p>
    </div>
  );
}

/* ───────────────────────── Maquetas por widget ───────────────────────── */

const Estados = () => (
  <div className="w-full h-full flex items-center gap-3 p-3">
    <div className="relative flex-1 h-full min-w-0 flex items-center justify-center">
      <div className="relative h-full aspect-square">
        <Dona items={ESTADOS} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black tabular-nums text-gray-900 dark:text-white leading-none">1,240</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Plazas</span>
        </div>
      </div>
    </div>
    <Leyenda items={ESTADOS} />
  </div>
);

const PlazasUa = () => (
  <div className="w-full h-full flex flex-col p-2">
    <div className="shrink-0 flex items-center gap-x-3 flex-wrap px-1 pb-1">
      {ESTADOS.map(([n, c]) => (
        <span key={n} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="size-2 rounded-full" style={{ background: c }} />{n}</span>
      ))}
    </div>
    <div className="flex-1 min-h-0"><BarrasApiladas series={[[G, 0.62], [D, 0.18], ["#3b82f6", 0.08], ["#10b981", 0.07], ["#8b5cf6", 0.05]]} /></div>
  </div>
);

const Alineacion = () => (
  <div className="w-full h-full flex flex-col justify-center gap-1 p-3 bg-gradient-to-br from-[#621f32] to-[#8d2c48] text-white">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-white/15"><GitCompareArrows className="size-3.5" /></div>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Alineación General</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-4xl font-black leading-none tabular-nums">87.4%</span>
      <span className="flex items-center gap-1 text-[11px] font-black text-white/85"><TrendingUp className="size-3.5" />+1.2 pts</span>
    </div>
    <div className="flex-1 min-h-[32px] -mx-1">
      <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="size-full">
        <path d="M0 40 L30 34 L60 36 L90 26 L120 28 L150 16 L200 8 L200 50 L0 50Z" fill="#fff" opacity="0.25" />
        <path className="wp-linea" pathLength="1" d="M0 40 L30 34 L60 36 L90 26 L120 28 L150 16 L200 8" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
    </div>
  </div>
);

const ACCIONES = [["Alta", "#16a34a", 34], ["Baja", "#dc2626", 22], ["Cambio", D, 26], ["Promoción", G, 12], ["Otros", "#8b5cf6", 6]];
const MovAccion = () => (
  <div className="w-full h-full flex items-center gap-3 p-2">
    <div className="flex-1 h-full min-w-0 flex items-center justify-center"><div className="relative h-full aspect-square"><Dona items={ACCIONES} /></div></div>
    <Leyenda items={ACCIONES} />
  </div>
);

/** Paleta de porciones del widget real (HOY_COLORS en movimientosHoyShared.js). */
const HOY_COLORS = ["#621f32", "#bc955c", "#8d2c48", "#d4a96a", "#4a1625", "#e8c280", "#3d1020", "#a07040", "#7a2038", "#f0d090", "#2d0a18", "#c8a050"];
const ACCIONES_HOY = [
  ["Alta", 34], ["Baja", 22], ["Cambio de datos", 19], ["Transferencia", 14], ["Promoción", 11], ["Reingreso", 9],
  ["Licencia", 7], ["Suspensión", 5], ["Cambio de adscripción", 4], ["Interinato", 2], ["Terminación", 1],
];
/** Movimientos de hoy (detalle): primer nivel del recorrido acciones → motivos → listado, con migas de pan y un renglón por acción. Se dibuja en un lienzo angosto (ver ANCHO_VIRTUAL). */
const MovDetalle = () => {
  const total = ACCIONES_HOY.reduce((t, [, v]) => t + v, 0);
  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center px-2.5 py-1.5 border-b border-slate-200/70 dark:border-slate-800/70 text-[9px] font-black uppercase tracking-wider">
        <span className="text-[#621f32] dark:text-[#bc955c]">Hoy · {total} mov.</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
        {ACCIONES_HOY.slice(0, 7).map(([n, v], i) => (
          <div key={n} className="wp-fila w-full flex items-center gap-2 px-2.5 py-[5px]" style={dl(i, 0.08)}>
            <span className="shrink-0 size-2 rounded-full" style={{ background: HOY_COLORS[i % HOY_COLORS.length] }} />
            <span className="flex-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{n}</span>
            <span className="text-[10px] font-black text-slate-500 shrink-0">{v}<span className="text-slate-400 font-normal ml-1 text-[9px]">({Math.round((v / total) * 100)}%)</span></span>
            <ChevronRight className="size-3 shrink-0 text-slate-300" />
          </div>
        ))}
      </div>
    </div>
  );
};

const BuscarBaja = () => (
  <BuscadorConSugerencias texto="Buscar baja por nombre, No. Empleado, RFC..." escrito="MARTÍNEZ LÓPEZ">
    <TarjetaResultado i={0} titulo="MARTÍNEZ LÓPEZ ANA" sub="Emp. 104522" badge="Baja" badgeColor="#dc2626" campos={[["RFC", "MALA800101XX1"], ["Fecha baja", "12/03/2026"], ["Motivo", "Renuncia"], ["Unidad", "Aduana AICM"]]} />
    <TarjetaResultado i={1} titulo="MARTÍNEZ LÓPEZ JUAN" sub="Emp. 087311" badge="Baja" badgeColor="#dc2626" campos={[["RFC", "RASJ750412XX3"], ["Fecha baja", "28/02/2026"]]} />
  </BuscadorConSugerencias>
);

const BuscarPersona = () => (
  <BuscadorConSugerencias texto="Buscar persona por nombre, RFC, CURP..." escrito="HERNÁNDEZ RUIZ">
    <TarjetaResultado i={0} foto titulo="HERNÁNDEZ RUIZ LAURA" sub="POS 40218" badge="Activo" badgeColor="#16a34a" campos={[["RFC", "HERL850623XX4"], ["CURP", "HERL850623MDF"], ["Unidad Administrativa", "Aduana Veracruz"], ["Puesto Funcional", "Jefe de Departamento"]]} />
    <TarjetaResultado i={1} titulo="HERNÁNDEZ RUIZ CARLOS" sub="POS 40219" badge="Activo" badgeColor="#16a34a" campos={[["Unidad Administrativa", "Aduana Veracruz"], ["Puesto Funcional", "Enlace"]]} />
  </BuscadorConSugerencias>
);

const BuscarMovimiento = () => (
  <BuscadorConSugerencias texto="Buscar movimiento por nombre, RFC, motivo..." escrito="GARCÍA PÉREZ">
    <TarjetaResultado i={0} titulo="GARCÍA PÉREZ MIGUEL" sub="POS 31877 · 05/09/2026" badge="Alta" badgeColor="#16a34a" campos={[["Acción", "Alta"], ["Motivo", "Nuevo ingreso"], ["Puesto", "Analista"], ["Unidad", "Aduana Tijuana"]]} />
    <TarjetaResultado i={1} titulo="GARCÍA PÉREZ SOFÍA" sub="POS 22045 · 04/09/2026" badge="Cambio" badgeColor={D} campos={[["Acción", "Cambio"], ["Motivo", "Reasignación"]]} />
  </BuscadorConSugerencias>
);

const SUGERENCIAS_PLAZA = [
  { pos: "40218", activa: true, ocupante: "HERNÁNDEZ RUIZ LAURA", puesto: "Jefe de Departamento" },
  { pos: "40219", activa: true, ocupante: null, puesto: "Enlace" },
  { pos: "40210", activa: false, ocupante: "RUIZ GÓMEZ PEDRO", puesto: "Analista" },
];
const Dato = ({ label, valor }) => (
  <div className="min-w-0">
    <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
    <dd className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{valor}</dd>
  </div>
);

/** Historia de la posición (HistorialMovimientosTab, variante "posicion"): carriles = columnas por unidad administrativa, tarjetas por movimiento y conectores entre ellas. */
const CARRILES = [
  { clave: "0301", nombre: "ADUANA DE VERACRUZ", rango: "01/03/2012 — 30/06/2019" },
  { clave: "0302", nombre: "SUBADMINISTRACIÓN DE OPERACIÓN", rango: "01/07/2019 — 09/02/2020" },
  { clave: "0303", nombre: "ADMINISTRACIÓN DE APOYO", rango: "10/02/2020 — actual", actual: true },
];
const MOVS_HISTORIAL = [
  [0, "Creación de la plaza", "Activa", "01/03/2012", "28/02/2012", "CRE", "ADMIN"],
  [0, "Nuevo ingreso", "Activa", "15/08/2013", "10/08/2013", "HIR", "RRHH"],
  [1, "Cambio de adscripción", "Activa", "01/07/2019", "25/06/2019", "TFR", "RRHH"],
  [2, "Reasignación", "Activa", "10/02/2020", "03/02/2020", "REA", "RRHH"],
];
const FILA_H = 112;
const TARJETA_H = 98;
const HistorialCarriles = () => {
  const centro = (c) => c * 100 + 50;
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950/40 overflow-hidden">
      <div className="grid grid-cols-3">
        {CARRILES.map((l, i) => (
          <div key={l.clave} className={`px-3 py-2 border-b border-slate-200 dark:border-slate-800 ${l.actual ? "bg-[#621f32]/8" : i % 2 ? "bg-slate-50 dark:bg-slate-900/50" : ""}`}>
            <p className="font-mono text-xs font-black text-slate-800 dark:text-white">{l.clave}{l.actual && <span className="ml-1.5 text-[8px] font-black uppercase text-[#621f32]">Actual</span>}</p>
            <p className="text-[9px] font-bold text-slate-500 truncate">{l.nombre}</p>
            <p className="text-[9px] text-slate-400">{l.rango}</p>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: FILA_H * MOVS_HISTORIAL.length }}>
        <div className="absolute inset-0 grid grid-cols-3">
          {CARRILES.map((l, i) => <div key={l.clave} className={i % 2 ? "bg-slate-50 dark:bg-slate-900/50" : ""} />)}
        </div>
        <svg className="absolute inset-0 size-full" viewBox={`0 0 300 ${FILA_H * MOVS_HISTORIAL.length}`} preserveAspectRatio="none">
          {[100, 200].map((x) => <line key={x} x1={x} x2={x} y1="0" y2={FILA_H * MOVS_HISTORIAL.length} stroke="#cbd5e1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />)}
          {MOVS_HISTORIAL.slice(1).map((m, i) => {
            const ant = MOVS_HISTORIAL[i];
            const x1 = centro(ant[0]); const y1 = i * FILA_H + 6 + TARJETA_H;
            const x2 = centro(m[0]); const y2 = (i + 1) * FILA_H + 6;
            const ym = (y1 + y2) / 2;
            return <path key={i} d={`M${x1} ${y1} V${ym} H${x2} V${y2}`} fill="none" stroke="#94a3b8" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {MOVS_HISTORIAL.map(([c, titulo, chip, fe, fc, cod, por], i) => (
          <div key={i} className="absolute rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm" style={{ left: `${c * 33.333 + 2}%`, width: "29.3%", top: i * FILA_H + 6, height: TARJETA_H }}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">{titulo}</span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[8px] font-black text-emerald-700">{chip}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
              {[["F. Efectiva", fe], ["F. Captura", fc], ["Cód. Motivo", cod], ["Por", por]].map(([k, v]) => (
                <div key={k}><p className="text-[7px] font-black uppercase text-slate-400">{k}</p><p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{v}</p></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Buscador de posición con su "video" (corre en hover). Dos variantes con el
 * mismo arranque —widget vacío → zoom al input → se borra el placeholder → se
 * escriben dígitos → zoom out con las sugerencias → un cursor viaja a la
 * primera y la pulsa— y distinto final:
 *  - "plaza" (Buscar Plaza / Posición): aparece la ficha y la historia en
 *    carriles (columnas por unidad administrativa); zoom in a la ficha y baja
 *    despacio por las columnas.
 *  - "arbol" (Árbol de movimientos): "carga", se dibuja el tronco vertical;
 *    zoom in al árbol y el lienzo se desplaza despacio hacia abajo.
 * La "cámara" es translate+scale sobre el lienzo completo (origen 0 0), acotada
 * para no enseñar fuera de él.
 */
function PlazaFlow({ variante }) {
  const esArbol = variante === "arbol";
  const zoom = useRef(null);
  const ph = useRef(null);
  const typed = useRef(null);
  const drop = useRef(null);
  const sug = useRef(null);
  const cursor = useRef(null);
  const ripple = useRef(null);
  const vacio = useRef(null);
  const contenido = useRef(null);
  const inputEl = useRef(null);
  const arbol = useRef(null);
  const cargando = useRef(null);

  useEffect(() => {
    const tarjeta = zoom.current?.closest("[data-tarjeta]");
    if (!tarjeta || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let tl = null;
    const DIGITOS = "4021";
    const nodosArbol = () => arbol.current?.querySelectorAll("[data-nodo]");
    const reposo = () => {
      gsap.set(zoom.current, { x: 0, y: 0, scale: 1, opacity: 1, transformOrigin: "0 0" });
      gsap.set(ph.current, { display: "inline", opacity: 1 });
      gsap.set(vacio.current, { opacity: 1 });
      gsap.set(drop.current, { opacity: 0, y: -6 });
      gsap.set(drop.current.children, { opacity: 0, x: -10 });
      gsap.set(sug.current, { backgroundColor: "rgba(0,0,0,0)", scale: 1 });
      gsap.set(cursor.current, { opacity: 0, scale: 1 });
      gsap.set(ripple.current, { opacity: 0, scale: 0 });
      if (esArbol) {
        gsap.set(cargando.current, { opacity: 0 });
        gsap.set(arbol.current, { opacity: 0 });
        gsap.set(nodosArbol(), { opacity: 0, y: 24 });
        gsap.set(arbol.current.querySelector("[data-linea]"), { strokeDashoffset: 1 });
        gsap.set(arbol.current.querySelector("[data-mundo]"), { y: 0 });
      } else {
        gsap.set(contenido.current.children, { opacity: 0, y: 14 });
      }
      typed.current.textContent = "";
    };
    const arrancar = () => {
      tl?.kill();
      reposo();
      const z = zoom.current;
      const W = z.offsetWidth;
      const H = z.offsetHeight;
      const k = z.getBoundingClientRect().width / W;
      const rel = (el) => {
        const a = z.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k };
      };
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      // Cámara: centra (px, py) del lienzo con zoom `sc`, sin salirse de él.
      const camara = (px, py, sc) => ({
        x: clamp(W / 2 - px * sc, W - W * sc, 0),
        y: clamp(H / 2 - py * sc, H - H * sc, 0),
        scale: sc,
      });
      const inp = rel(inputEl.current);
      const li = rel(sug.current);
      li.y += 6; // el desplegable se mide desplazado -6 px (reposo); termina en 0
      // El lienzo virtual es grande y la tarjeta chica: hace falta ~5-6× para leer.
      const alInput = camara(inp.x + 95, inp.y + inp.h / 2, esArbol ? 4.2 : 6);
      const alItem = camara(li.x + 105, li.y + li.h / 2, esArbol ? 3.6 : 5);
      const punta = { x: li.x + 70, y: li.y + li.h / 2 - 4 }; // dónde "clica" el cursor
      const letras = { n: 0 };
      gsap.set(cursor.current, { x: W * 0.72, y: H * 0.62 });
      gsap.set(ripple.current, { x: punta.x + 3, y: punta.y + 2 }); // punta de la flecha

      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
      // 1. zoom in al input
      tl.to(z, { ...alInput, duration: 1, ease: "power2.inOut" }, 0.6)
        // 2. se borra el placeholder
        .to(ph.current, { opacity: 0, duration: 0.25 }, 1.8)
        .set(ph.current, { display: "none" }, 2.05)
        // 3. se escriben unos números
        .to(letras, {
          n: DIGITOS.length, duration: DIGITOS.length * 0.28, ease: "none",
          onUpdate: () => { typed.current.textContent = DIGITOS.slice(0, Math.round(letras.n)); },
        }, 2.3)
        // 4. zoom out y aparecen las sugerencias bajo el input
        .to(z, { x: 0, y: 0, scale: 1, duration: 1, ease: "power2.inOut" }, "+=0.4")
        .to(vacio.current, { opacity: 0.35, duration: 0.3 }, "<0.4")
        .to(drop.current, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, "<0.1")
        .to(drop.current.children, { opacity: 1, x: 0, duration: 0.35, ease: "power2.out", stagger: 0.18 }, "<0.1")
        // 5. el cursor entra y viaja a la sugerencia; la cámara lo sigue con zoom in
        .to(cursor.current, { opacity: 1, duration: 0.3 }, "+=0.5")
        .to(cursor.current, { x: punta.x, y: punta.y, duration: 1.3, ease: "power2.inOut" }, "<")
        .to(z, { ...alItem, duration: 1.3, ease: "power2.inOut" }, "<")
        .to(sug.current, { backgroundColor: "rgba(148,163,184,0.25)", duration: 0.2 }, "-=0.2")
        // 6. pulsado
        .to(cursor.current, { scale: 0.78, duration: 0.12, ease: "power1.in" }, "+=0.35")
        .fromTo(ripple.current, { scale: 0, opacity: 0.55 }, { scale: 1, opacity: 0, duration: 0.55, ease: "power2.out" }, "<")
        .to(sug.current, { scale: 0.985, duration: 0.12, yoyo: true, repeat: 1 }, "<")
        .to(cursor.current, { scale: 1, duration: 0.15 }, "<0.12")
        .call(() => { typed.current.textContent = "40218"; })
        .to(drop.current, { opacity: 0, y: -6, duration: 0.25 }, "+=0.15")
        .to(cursor.current, { opacity: 0, duration: 0.25 }, "<");

      if (!esArbol) {
        // 7. zoom out: aparece la ficha y la historia en carriles
        const [cabecera, , , historia] = contenido.current.children;
        const cab = rel(cabecera); cab.y -= 14; // el contenido se mide desplazado +14 px (reposo)
        const his = rel(historia); his.y -= 14;
        tl.to(z, { x: 0, y: 0, scale: 1, duration: 1, ease: "power2.inOut" }, "+=0.2")
          .to(vacio.current, { opacity: 0, duration: 0.25 }, "<0.3")
          .to(contenido.current.children, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.25 }, "<0.2")
          // 8. zoom in a la ficha y bajada lenta por las columnas de la historia
          .to(z, { ...camara(cab.x + 230, cab.y + 80, 3.4), duration: 1.4, ease: "power2.inOut" }, "+=0.6")
          .to(z, { ...camara(his.x + 300, his.y + 150, 2.9), duration: 2.6, ease: "power1.inOut" }, "+=0.7")
          .to(z, { ...camara(his.x + 640, his.y + 400, 2.9), duration: 3.4, ease: "power1.inOut" }, "+=0.3")
          .to(z, { x: 0, y: 0, scale: 1, duration: 1.1, ease: "power2.inOut" }, "+=0.5");
      } else {
        // 7. "carga" y se dibuja el tronco vertical de la plaza
        const canvas = rel(arbol.current.querySelector("[data-canvas]"));
        const ultimoY = 36 + ROW_ARBOL * (NODOS_ARBOL.length - 1);
        tl.to(vacio.current, { opacity: 0, duration: 0.25 }, "+=0.1")
          .to(cargando.current, { opacity: 1, duration: 0.2 }, "<")
          .to(cargando.current, { opacity: 0, duration: 0.2 }, "+=0.8")
          .to(arbol.current, { opacity: 1, duration: 0.4 }, "<")
          .to(arbol.current.querySelector("[data-linea]"), { strokeDashoffset: 0, duration: 1.6, ease: "power1.inOut" }, "<0.1")
          .to(nodosArbol(), { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.5)", stagger: 0.32 }, "<")
          // 8. zoom in al árbol y el lienzo baja despacio (como al arrastrarlo)
          .to(z, { ...camara(canvas.x + canvas.w / 2, canvas.y + 170, 2.5), duration: 1.4, ease: "power2.inOut" }, "+=0.5")
          .to(arbol.current.querySelector("[data-mundo]"), { y: -(ultimoY - 190), duration: 7, ease: "power1.inOut" }, "+=0.3")
          .to(z, { x: 0, y: 0, scale: 1, duration: 1.1, ease: "power2.inOut" }, "+=0.6");
      }
      tl.to(z, { opacity: 0, duration: 0.4 }, "+=1.2").call(reposo);
    };
    const detener = () => { tl?.kill(); tl = null; reposo(); };
    reposo();
    tarjeta.addEventListener("mouseenter", arrancar);
    tarjeta.addEventListener("mouseleave", detener);
    return () => {
      tarjeta.removeEventListener("mouseenter", arrancar);
      tarjeta.removeEventListener("mouseleave", detener);
      tl?.kill();
    };
  }, [esArbol]);

  return (
    <div className="w-full h-full overflow-hidden">
      <div ref={zoom} className="relative w-full h-full flex flex-col min-h-0" style={{ transformOrigin: "0 0" }}>
        <div className="relative shrink-0 p-2 border-b border-slate-200/70 dark:border-slate-800/70">
          <div ref={inputEl} className="relative flex items-center pl-8 pr-14 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Search className="absolute left-2.5 size-3.5 text-slate-400" />
            <span ref={ph} className="text-xs text-slate-400 whitespace-nowrap">{esArbol ? "Buscar posición (ej. 12345)" : "Buscar plaza / posición (ej. 12345)"}</span>
            <span ref={typed} className="text-xs font-mono text-slate-800 dark:text-slate-100" />
            <span className="wp-cursor ml-px w-px h-3.5 bg-slate-500" />
          </div>
          <ul ref={drop} className="absolute left-2 right-2 top-full z-30 mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
            {SUGERENCIAS_PLAZA.map((sg, i) => (
              <li key={sg.pos} ref={i === 0 ? sug : undefined} className="px-3 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{sg.pos}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${sg.activa ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
                    <span className={`size-1.5 rounded-full ${sg.activa ? "bg-emerald-500" : "bg-slate-400"}`} />{sg.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 truncate">
                  {sg.ocupante || <span className="italic text-amber-700 dark:text-amber-400">Vacante</span>}
                </div>
                <div className="text-[10px] leading-tight text-slate-400 truncate">{sg.puesto}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex-1 min-h-0">
          <div ref={vacio} className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            {esArbol ? <GitBranch className="size-8 text-slate-300 dark:text-slate-700" /> : <Briefcase className="size-8 text-slate-300 dark:text-slate-700" />}
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-56">
              {esArbol
                ? "Escribe una posición para ver el tronco de la plaza: creación, ocupaciones, vacancias e insubsistencias."
                : "Escribe una posición para ver su ficha y la historia de su adscripción."}
            </p>
          </div>
          {esArbol ? (
            <>
              <div ref={cargando} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#621f32]">
                <Loader2 className="size-8 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Cargando historia de la plaza...</p>
              </div>
              <div ref={arbol} className="absolute inset-0 flex flex-col min-h-0 bg-white dark:bg-slate-900">
                <ArbolContenido css={false} />
              </div>
            </>
          ) : (
            <div ref={contenido} className="absolute inset-0 overflow-hidden p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-black text-slate-800 dark:text-white">40218</span>
                <span className="px-2 py-0.5 rounded-md border text-[9px] font-black uppercase bg-[#621f32]/8 text-[#621f32] dark:text-[#f3dcd4] border-[#621f32]/20">Activo</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Dato label="Ocupante" valor="HERNÁNDEZ RUIZ LAURA" />
                <Dato label="Nivel" valor="K" />
                <Dato label="Puesto funcional" valor="Jefe de Departamento" />
                <Dato label="Unidad administrativa" valor="Aduana de Veracruz" />
              </dl>
              <div className="self-start flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[#621f32] dark:text-[#bc955c] font-black text-[10px] uppercase">
                <GitBranch className="size-3.5" />Ver árbol de la plaza
              </div>
              <div className="min-w-0">
                <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Historia de la posición</h4>
                <HistorialCarriles />
              </div>
            </div>
          )}
        </div>

        {/* Cursor falso (mismo lienzo: se mueve y se amplía con la cámara). */}
        <span ref={ripple} className="absolute z-40 top-0 left-0 size-10 -ml-5 -mt-5 rounded-full bg-[#621f32]/40 pointer-events-none" />
        <svg ref={cursor} viewBox="0 0 24 24" className="absolute z-40 top-0 left-0 size-6 pointer-events-none drop-shadow" style={{ transformOrigin: "3px 2px" }}>
          <path d="M3 2 L3 19 L8 14.5 L11.5 21.5 L14.5 20 L11 13 L18 13 Z" fill="#fff" stroke="#0f172a" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Cadena de mando con su "video" (corre en hover): widget vacío → zoom al input
 * → se borra el placeholder → se escribe un nombre → Enter y zoom out (cargando)
 * → aparece la respuesta (KPIs y niveles) → zoom in a la respuesta y recorre
 * despacio de izquierda a derecha → zoom out y reinicia. En reposo, vacío.
 */
function CadenaMando() {
  const zoom = useRef(null);
  const ph = useRef(null);
  const typed = useRef(null);
  const vacio = useRef(null);
  const cargando = useRef(null);
  const res = useRef(null);
  const drop = useRef(null);
  const sug = useRef(null);

  useEffect(() => {
    const tarjeta = zoom.current?.closest("[data-tarjeta]");
    if (!tarjeta || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let tl = null;
    const NOMBRE = "HERNÁNDEZ RUIZ";
    const reposo = () => {
      gsap.set(zoom.current, { x: 0, y: 0, scale: 1, opacity: 1, transformOrigin: "0 0" });
      gsap.set(ph.current, { display: "inline", opacity: 1 });
      gsap.set(vacio.current, { opacity: 1 });
      gsap.set(cargando.current, { opacity: 0 });
      gsap.set(res.current.children, { opacity: 0, y: 14 });
      gsap.set(drop.current, { opacity: 0, y: -6 });
      gsap.set(drop.current.children, { opacity: 0, x: -10 });
      gsap.set(sug.current, { backgroundColor: "rgba(0,0,0,0)" });
      typed.current.textContent = "";
    };
    const arrancar = () => {
      tl?.kill();
      reposo();
      const z = zoom.current;
      const W = z.offsetWidth;
      const H = z.offsetHeight;
      const k = z.getBoundingClientRect().width / W;
      const rel = (el) => {
        const a = z.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k };
      };
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      const camara = (px, py, sc) => ({
        x: clamp(W / 2 - px * sc, W - W * sc, 0),
        y: clamp(H / 2 - py * sc, H - H * sc, 0),
        scale: sc,
      });
      const inp = rel(ph.current.parentElement);
      const r = rel(res.current);
      r.y -= 14; // la respuesta se mide desplazada +14 px (reposo); termina en 0
      const letras = { n: 0 };

      tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
      tl.to(z, { ...camara(inp.x + 110, inp.y + inp.h / 2 + 45, 3.6), duration: 1, ease: "power2.inOut" }, 0.6)
        .to(ph.current, { opacity: 0, duration: 0.25 }, 1.8)
        .set(ph.current, { display: "none" }, 2.05)
        .to(letras, {
          n: NOMBRE.length, duration: NOMBRE.length * 0.1, ease: "none",
          onUpdate: () => { typed.current.textContent = NOMBRE.slice(0, Math.round(letras.n)); },
        }, 2.3)
        // autocompletado: aparecen las sugerencias y se elige la primera
        .to(drop.current, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, "+=0.15")
        .to(drop.current.children, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out", stagger: 0.15 }, "<0.1")
        .to(sug.current, { backgroundColor: "rgba(148,163,184,0.25)", duration: 0.2 }, "+=0.7")
        .call(() => { typed.current.textContent = "10021"; }, null, "+=0.35")
        .to(drop.current, { opacity: 0, y: -6, duration: 0.25 }, "<")
        // Enter: zoom out y "carga"
        .to(z, { x: 0, y: 0, scale: 1, duration: 1, ease: "power2.inOut" }, "+=0.3")
        .to(vacio.current, { opacity: 0, duration: 0.25 }, "<0.3")
        .to(cargando.current, { opacity: 1, duration: 0.2 }, "<")
        .to(cargando.current, { opacity: 0, duration: 0.2 }, "+=0.7")
        // aparece la respuesta y se hace zoom in sobre ella
        .to(res.current.children, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.25 }, "<")
        .to(z, { ...camara(r.x + 170, r.y + 95, 2.4), duration: 1.4, ease: "power2.inOut" }, "+=0.5")
        .to(z, { ...camara(r.x + r.w - 170, r.y + 130, 2.4), duration: 3.2, ease: "power1.inOut" }, "+=0.4")
        .to(z, { x: 0, y: 0, scale: 1, duration: 1.1, ease: "power2.inOut" }, "+=0.5")
        .to(z, { opacity: 0, duration: 0.4 }, "+=1.2")
        .call(reposo);
    };
    const detener = () => { tl?.kill(); tl = null; reposo(); };
    reposo();
    tarjeta.addEventListener("mouseenter", arrancar);
    tarjeta.addEventListener("mouseleave", detener);
    return () => {
      tarjeta.removeEventListener("mouseenter", arrancar);
      tarjeta.removeEventListener("mouseleave", detener);
      tl?.kill();
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden">
      <div ref={zoom} className="w-full h-full flex flex-col min-h-0" style={{ transformOrigin: "0 0" }}>
        <div className="shrink-0 p-2 flex flex-col gap-2 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="relative flex items-center pl-8 pr-14 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Search className="absolute left-2.5 size-3.5 text-slate-400" />
            <span ref={ph} className="text-xs text-slate-400 whitespace-nowrap">Posición, nombre o No. Empleado</span>
            <span ref={typed} className="text-xs text-slate-800 dark:text-slate-100 whitespace-nowrap" />
            <span className="wp-cursor ml-px w-px h-3.5 bg-slate-500" />
            <ul ref={drop} className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
              {[["10021", "HERNÁNDEZ RUIZ LAURA", "Director General Adjunto"], ["10388", "HERNÁNDEZ RUIZ CARLOS", "Jefe de Departamento"], ["20417", "RUIZ HERNÁNDEZ MARÍA", "Subadministrador"]].map(([pos, nom, pto], i) => (
                <li key={pos} ref={i === 0 ? sug : undefined} className="px-3 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{pos}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-400">Emp. {104500 + i * 37}</span>
                  </div>
                  <div className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 truncate">{nom}</div>
                  <div className="text-[10px] leading-tight text-slate-400 truncate">{pto}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 rounded-lg p-0.5 gap-0.5 self-start">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-white dark:bg-slate-700 text-[#621f32] dark:text-[#bc955c] shadow-sm">Subordinados</span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Jefes</span>
          </div>
        </div>
        <div className="relative flex-1 min-h-0">
          <div ref={vacio} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <Network className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-56">Escribe una posición y presiona Enter para ver su cadena de mando.</p>
          </div>
          <div ref={cargando} className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
          </div>
          <div ref={res} className="absolute inset-0 overflow-hidden p-2 flex flex-col gap-2">
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate"><span className="font-mono">10021</span> · HERNÁNDEZ RUIZ LAURA</p>
            <div className="grid grid-cols-3 gap-2">
              {[["Subordinados", 128], ["Directos", 6], ["Indirectos", 122], ["Ocupadas", 104], ["Vacantes", 24], ["Profundidad", 5]].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{l}</p>
                  <p className="text-xl font-black tabular-nums text-[#621f32] dark:text-[#bc955c] leading-tight">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[["J", 4], ["K", 12], ["A", 30], ["S", 48], ["P", 34]].map(([n, v]) => (
                <span key={n} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300">{n} <span className="text-[#621f32] dark:text-[#bc955c]">{v}</span></span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Árbol de movimientos (PosicionArbolModal embedded): buscador, barra de tiempo
 * vacante/ocupada, resumen, y un lienzo de puntos con el TRONCO de la plaza — una
 * línea vertical con un círculo por periodo (más viejo arriba) y su tarjeta de
 * fechas debajo. En hover los nodos suben en cascada y la línea se dibuja.
 */
const NODOS_ARBOL = [
  { tipo: "creacion", bg: "#94a3b8", size: 48, Icono: Sparkles, fechas: "01/03/2012 – 01/03/2012", sub: "Creación de la plaza" },
  { tipo: "vacancia", bg: "#d97706", size: 34, Icono: Clock, fechas: "01/03/2012 – 14/08/2013", sub: "Vacante" },
  { tipo: "ocupacion", bg: "#621f32", size: 58, Icono: User, fechas: "15/08/2013 – 30/06/2019", sub: "Gestión 1", nombre: "RUIZ GÓMEZ PEDRO", acc: "Nuevo ingreso → Renuncia" },
  { tipo: "vacancia", bg: "#d97706", size: 34, Icono: Clock, fechas: "01/07/2019 – 09/02/2020", sub: "Vacante" },
  { tipo: "ocupacion", bg: "#621f32", size: 58, Icono: User, fechas: "10/02/2020 – vigente", sub: "Gestión 2", nombre: "HERNÁNDEZ RUIZ LAURA", acc: "Reingreso", vigente: true },
];
const ROW_ARBOL = 170;
function ArbolContenido({ css = true }) {
  return (
    <>
    <div className="shrink-0 border-b border-slate-100 dark:border-slate-800/60 px-5 py-3">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
        <span className="flex items-center gap-1.5" style={{ color: "#d97706" }}><Clock className="size-3.5" />Vacante: 2 años 3 meses</span>
        <span className="flex items-center gap-1.5" style={{ color: G }}><User className="size-3.5" />Ocupada: 11 años 8 meses</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full" style={{ width: "16%", background: "#d97706" }} />
        <div className="h-full" style={{ width: "84%", background: G }} />
      </div>
    </div>
    <div className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/30 px-5 py-3">
      {[["Gestiones", 2, Briefcase], ["Vacancias", 2, Clock], ["Insubsistencias", 0, Ban], ["Periodos", 5, Layers]].map(([l, v, Ic]) => (
        <div key={l} className="flex items-center gap-2">
          <div className="rounded-lg bg-[#621f32]/8 p-1.5 text-[#621f32]"><Ic className="size-3.5" /></div>
          <span className="text-lg font-black leading-none text-slate-800 dark:text-white">{v}</span>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{l}</span>
        </div>
      ))}
    </div>
    {/* Lienzo: fondo de puntos + tronco vertical */}
    <div data-canvas className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950/40" style={{ backgroundImage: "radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)", backgroundSize: "22px 22px" }}>
      <div data-mundo className="absolute inset-0">
      <svg className="absolute left-0 top-0 size-full" style={{ overflow: "visible" }}>
        <line data-linea className={css ? "wp-linea" : ""} pathLength="1" style={css ? undefined : { strokeDasharray: 1 }} x1="50%" x2="50%" y1={36} y2={36 + ROW_ARBOL * (NODOS_ARBOL.length - 1)} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {NODOS_ARBOL.map((n, i) => (
        <div key={i} data-nodo className={`${css ? "wp-barra " : ""}absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center`} style={{ left: "50%", top: 36 + i * ROW_ARBOL, ...dl(i, 0.3) }}>
          <div
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{ width: n.size, height: n.size, background: n.bg, boxShadow: n.vigente ? "0 0 0 3px white, 0 0 0 5px #10b981" : "0 2px 8px rgba(0,0,0,0.25)" }}
          >
            <n.Icono className="text-white" style={{ width: n.size * 0.42, height: n.size * 0.42 }} />
          </div>
          <div className="mt-1.5 flex max-w-[150px] flex-col items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-1 text-center shadow-sm">
            <span className="whitespace-nowrap text-[10px] font-bold text-slate-700">{n.fechas}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{n.sub}</span>
            {n.acc && <span className="text-[9px] text-slate-400">{n.acc}</span>}
            {n.nombre && <span className="w-full truncate text-[10px] font-bold text-[#621f32]">{n.nombre}</span>}
          </div>
        </div>
      ))}
      </div>
      {/* Controles de zoom */}
      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1">
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <span className="flex size-9 items-center justify-center text-slate-600"><Plus className="size-4" /></span>
          <span className="border-t border-slate-100 px-1 py-1 text-center text-[10px] font-bold text-slate-400">100%</span>
          <span className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600"><Minus className="size-4" /></span>
          <span className="flex size-9 items-center justify-center border-t border-slate-100 text-slate-600"><Scan className="size-4" /></span>
        </div>
        <span className="mt-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">arrastra · rueda</span>
      </div>
    </div>
    </>
  );
}


const ADUANAS = [["VERACRUZ", "3001"], ["TIJUANA", "3002"], ["AICM", "3003"], ["MANZANILLO", "3004"], ["NUEVO LAREDO", "3005"], ["ENSENADA", "3006"], ["ALTAMIRA", "3007"], ["PROGRESO", "3008"]];
/** Tabla de Titulares de Aduanas a tamaño legible (lienzo angosto): encabezado con títulos que se parten en dos líneas, fila roja de "sin titular" y fila de total. */
const TitTabla = ({ cols, filas, pie, rojo, ambar }) => (
  <div className="size-full overflow-hidden bg-white dark:bg-slate-950">
    <table className="w-full border-collapse text-[9px]">
      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <tr>{cols.map((c, j) => <th key={c} className={`px-1 py-1 align-bottom font-semibold leading-[1.1] text-[7.5px] ${j ? "text-center" : "text-left"} ${j === ambar ? "text-amber-700" : ""}`}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className={`wp-fila border-b border-slate-100 dark:border-slate-800/70 ${rojo === i ? "bg-rose-50 dark:bg-rose-950/30" : ""}`} style={dl(i, 0.08)}>
            {f.map((c, j) => (
              <td key={j} className={`px-1 py-[3px] whitespace-nowrap ${j ? "text-center tabular-nums" : "text-left font-semibold"} ${rojo === i ? "text-rose-700 italic" : j === ambar ? "text-amber-700" : "text-slate-700 dark:text-slate-200"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {pie && (
        <tfoot>
          <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
            {pie.map((c, j) => <td key={j} className={`px-1 py-1 ${j ? "text-center tabular-nums" : "text-left uppercase text-[8px]"} ${j === ambar ? "text-amber-700" : ""}`}>{c}</td>)}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
const TitularesResumen = () => (
  <TitTabla
    cols={["Aduana", "Código UA", "Titulares históricos", "Días ocupada", "Tiempo ocupado", "Días de vacancia", "% ocupación"]}
    ambar={5}
    filas={ADUANAS.slice(0, 7).map(([a, c], i) => [a, c, 3 + (i % 4), (2100 + i * 137).toLocaleString("en-US"), `${5 + i} años`, 40 + i * 23, `${96 - i * 2}%`])}
    pie={["Total", "", 26, "16,430", "45 años", 610, "94%"]}
  />
);
const TitularesActuales = () => (
  <TitTabla
    cols={["Aduana", "Código UA", "Titular actual", "Desde", "Antigüedad"]}
    rojo={3}
    filas={ADUANAS.slice(0, 8).map(([a, c], i) => [a, c, i === 3 ? "Sin titular" : ["LÓPEZ RUIZ C.", "GÓMEZ DÍAZ M.", "PÉREZ SOTO A.", "", "RAMOS VEGA J.", "CRUZ MORA L.", "DÍAZ LUNA P.", "SOTO REYES E."][i], i === 3 ? "—" : `0${i + 1}/0${(i % 8) + 2}/2024`, i === 3 ? "—" : `${2 + i} años`])}
  />
);

/* Cuadros de Vacancia (cv_*)
   Estas maquetas se dibujan en un lienzo angosto (CV_ANCHO_VIRTUAL px) en vez del
   tamaño real de la celda: así el texto queda legible en la tarjeta de la galería
   y se entiende de inmediato qué muestra cada gráfica o tabla. Conservan el título,
   ejes, colores y columnas de las reales. */
const CV_ANCHO_VIRTUAL = 230;
/** Ancho (px) del lienzo virtual de otros widgets con tablas/listas densas. */
const ANCHO_VIRTUAL = { titulares_aduanas_resumen: 330, titulares_aduanas_actuales: 300, movimientos_hoy_detalle: 250, torre_caballito: 300 };

const CvCuerpo = ({ titulo, sub, children }) => (
  <div className="w-full h-full min-h-0 flex flex-col p-2">
    <h4 className="shrink-0 text-[11px] font-bold leading-tight text-slate-800 dark:text-slate-200">{titulo}</h4>
    {sub && <p className="shrink-0 text-[8px] font-medium uppercase tracking-wider text-slate-400">{sub}</p>}
    <div className="flex-1 min-h-0 mt-1.5">{children}</div>
  </div>
);

/** Barras con rejilla, eje Y, valor sobre cada barra y etiqueta abajo. `datos`: [{ etiqueta, v | segmentos:[[valor,color]], color }]. */
const CvBarras = ({ datos, max: maxFijo }) => {
  const total = (d) => (d.segmentos ? d.segmentos.reduce((t, [v]) => t + v, 0) : d.v);
  const max = maxFijo ?? Math.max(...datos.map(total));
  return (
    <div className="relative size-full pl-6 pb-5 pt-2">
      <div className="absolute inset-0 pl-6 pb-5 pt-2 flex flex-col justify-between pointer-events-none">
        {[3, 2, 1, 0].map((i) => (
          <div key={i} className="flex items-center">
            <span className="w-6 -ml-6 pr-1 text-right text-[7px] font-bold text-slate-400">{Math.round((max * i) / 3)}</span>
            <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800" />
          </div>
        ))}
      </div>
      <div className="relative size-full flex items-end gap-1.5">
        {datos.map((d, i) => (
          <div key={d.etiqueta} className="relative flex-1 h-full flex items-end justify-center">
            <div className="wp-barra relative w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${(total(d) / max) * 92}%`, ...dl(i, 0.08) }}>
              {d.segmentos
                ? d.segmentos.map(([v, c], j) => <div key={j} style={{ height: `${(v / total(d)) * 100}%`, background: c }} />)
                : <div className="size-full" style={{ background: `linear-gradient(to top, ${d.color[0]}, ${d.color[1]})` }} />}
            </div>
            <span className="absolute inset-x-0 text-center text-[8px] font-black text-slate-600 dark:text-slate-300" style={{ bottom: `calc(${(total(d) / max) * 92}% + 1px)` }}>{total(d)}</span>
            <span className="absolute -bottom-4 inset-x-0 text-center text-[7px] font-bold text-slate-500 dark:text-slate-400 truncate">{d.etiqueta}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CvLeyenda = ({ items }) => (
  <div className="shrink-0 flex items-center gap-2 pb-1">
    {items.map(([c, n]) => <span key={n} className="flex items-center gap-1 text-[8px] font-bold text-slate-500"><span className="size-1.5 rounded-full" style={{ background: c }} />{n}</span>)}
  </div>
);

/** Serie temporal con rejilla y ejes a tamaño nativo (sin estirar el texto). `series`: [[color, valores 0-1]]. */
const CvLineas = ({ series, etiquetas, area, leyenda }) => {
  const W = 216, H = 110, L = 22, B = 14, T = 6, R = 6;
  const x = (i, n) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (1 - v) * (H - T - B);
  return (
    <div className="size-full flex flex-col">
      {leyenda && <CvLeyenda items={leyenda} />}
      <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 min-h-0 w-full">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(i / 3)} y2={y(i / 3)} stroke="#cbd5e1" strokeOpacity="0.6" strokeDasharray="3 3" />
            <text x={L - 3} y={y(i / 3) + 2.5} textAnchor="end" fontSize="7" fontWeight="700" fill="#64748b">{i * 250}</text>
          </g>
        ))}
        {etiquetas.map((t, i) => <text key={t} x={x(i, etiquetas.length)} y={H - 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b">{t}</text>)}
        {series.map(([color, pts], k) => {
          const P = pts.map((v, i) => [x(i, pts.length), y(v)]);
          const d = P.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
          return (
            <g key={color}>
              {area && k === 0 && <path d={`${d} L${P.at(-1)[0]} ${y(0)} L${P[0][0]} ${y(0)} Z`} fill={color} opacity="0.12" />}
              <path className="wp-linea" pathLength="1" style={dl(k, 0.25)} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {P.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="2.2" fill="#fff" stroke={color} strokeWidth="1.5" />)}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** Tabla de nivel: Nivel × (Eventuales | Evt. Nueva Creación | Permanentes | Total) con Ocup / Vac, y fila Total. */
const CvNivelTabla = ({ letra, filasN = 4 }) => {
  const filas = Array.from({ length: filasN }, (_, i) => {
    const ev = [12 + i * 3, 2 + i], nc = [4 + i, 1], pe = [30 + i * 5, 3 + i];
    return { nivel: `${letra}-${i + 1}`, g: [ev, nc, pe, [ev[0] + nc[0] + pe[0], ev[1] + nc[1] + pe[1]]] };
  });
  const tot = [0, 1, 2, 3].map((k) => [filas.reduce((t, f) => t + f.g[k][0], 0), filas.reduce((t, f) => t + f.g[k][1], 0)]);
  const sep = (k) => (k > 0 ? "border-l border-slate-300 dark:border-slate-700" : "");
  const G_LABELS = ["Eventuales", "Evt. Nueva Creación", "Permanentes", "Total"];
  return (
    <div className="size-full overflow-hidden rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <table className="w-full border-collapse text-[9px]">
        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
          <tr>
            <th rowSpan={2} className="px-1 text-left align-middle font-semibold uppercase text-[8px] border-b border-slate-300">Nivel</th>
            {G_LABELS.map((g, k) => <th key={g} colSpan={2} className={`px-0.5 py-0.5 text-center font-semibold uppercase text-[7px] leading-[1.1] border-b border-slate-200 ${sep(k)}`}>{g}</th>)}
          </tr>
          <tr className="text-[7px] font-semibold uppercase text-slate-500">
            {G_LABELS.flatMap((g, k) => [
              <th key={`${g}o`} className={`px-0.5 text-right border-b border-slate-300 ${sep(k)}`}>Ocup</th>,
              <th key={`${g}v`} className="px-0.5 text-right border-b border-slate-300 text-amber-700">Vac</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.nivel} className="wp-fila border-b border-slate-100 dark:border-slate-800/70" style={dl(i, 0.1)}>
              <td className="px-1 py-[3px] text-left font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{f.nivel}</td>
              {f.g.flatMap((c, k) => [
                <td key={`${k}o`} className={`px-0.5 text-right tabular-nums text-slate-700 dark:text-slate-300 ${sep(k)} ${k === 3 ? "bg-slate-50 dark:bg-slate-900/50" : ""}`}>{c[0]}</td>,
                <td key={`${k}v`} className={`px-0.5 text-right tabular-nums text-amber-700 ${k === 3 ? "bg-slate-50 dark:bg-slate-900/50" : ""}`}>{c[1]}</td>,
              ])}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-bold">
            <td className="px-1 py-[3px] text-left uppercase text-[8px]">Total</td>
            {tot.flatMap((c, k) => [
              <td key={`${k}o`} className={`px-0.5 text-right tabular-nums ${sep(k)}`}>{c[0]}</td>,
              <td key={`${k}v`} className="px-0.5 text-right tabular-nums text-amber-700">{c[1]}</td>,
            ])}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const CvTablaSimple = ({ cols, filas, pie }) => (
  <div className="size-full overflow-hidden rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
    <table className="w-full border-collapse text-[10px]">
      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <tr>{cols.map((c, j) => <th key={c} className={`px-1.5 py-1 font-semibold uppercase text-[8px] whitespace-nowrap ${j ? "text-right" : "text-left"}`}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className="wp-fila border-b border-slate-100 dark:border-slate-800/70" style={dl(i, 0.1)}>
            {f.map((c, j) => <td key={j} className={`px-1.5 py-[3px] whitespace-nowrap ${j ? "text-right tabular-nums text-slate-600 dark:text-slate-300" : "text-left font-semibold text-slate-800 dark:text-slate-100"}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
      {pie && <tfoot><tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 font-bold">{pie.map((c, j) => <td key={j} className={`px-1.5 py-1 ${j ? "text-right tabular-nums" : "text-left uppercase text-[8px]"}`}>{c}</td>)}</tr></tfoot>}
    </table>
  </div>
);

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"];
const NAVY = ["#10243e", "#254879"];
const MAROON = ["#621f32", "#8c2d4a"];
const FAMILIAS = [["K's", "#10243e"], ["A's", "#bc955c"], ["P's", "#621f32"], ["Oper.", "#7a2740"]];
const NJ = ["DG", "Dir. Central", "Director", "Subdirector", "Jefe Depto."];
const cvNJ = (titulo, valores, color) => () => (
  <CvCuerpo titulo={titulo} sub="Distribución por NJ"><CvBarras datos={NJ.map((e, i) => ({ etiqueta: e, v: valores[i], color }))} /></CvCuerpo>
);
const cvTab = (titulo, valores) => () => (
  <CvCuerpo titulo={titulo} sub="Distribución por familia"><CvBarras datos={FAMILIAS.map(([e, c], i) => ({ etiqueta: e, v: valores[i], color: [c, c] }))} /></CvCuerpo>
);
const cvLinea = (titulo, series, opts = {}) => () => (
  <CvCuerpo titulo={titulo}><CvLineas etiquetas={MESES} series={series} {...opts} /></CvCuerpo>
);
const cvNivel = (letra, titulo) => () => <CvCuerpo titulo={titulo}><CvNivelTabla letra={letra} /></CvCuerpo>;
const cvObs = (titulo) => () => (
  <CvCuerpo titulo={titulo}>
    <CvTablaSimple cols={["Observación", "Plazas"]} filas={[["En proceso de contratación", 42], ["Sin presupuesto", 18], ["Congelada", 11], ["Otras", 6]]} pie={["Total", 77]} />
  </CvCuerpo>
);

const CV_MAQUETAS = {
  plazas: cvLinea("Plazas Totales, Activas e Inactivas", [[G, [0.85, 0.86, 0.87, 0.87, 0.88, 0.89, 0.9]], [D, [0.7, 0.72, 0.74, 0.75, 0.77, 0.79, 0.8]], ["#94a3b8", [0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14]]], { leyenda: [[G, "Totales"], [D, "Activas"], ["#94a3b8", "Inactivas"]] }),
  ocup_mensual: cvLinea("Ocupación Histórica (Mensual)", [[G, [0.55, 0.6, 0.62, 0.7, 0.72, 0.78, 0.84]]], { area: true }),
  ocup_quincenal: cvLinea("Ocupación Histórica (Quincenal)", [[G, [0.6, 0.63, 0.61, 0.7, 0.74, 0.8, 0.83]]], { area: true }),
  vac_mensual: cvLinea("Vacancia Histórica (Mensual)", [[D, [0.8, 0.72, 0.66, 0.6, 0.5, 0.42, 0.35]]], { area: true }),
  vac_quincenal: cvLinea("Vacancia Histórica (Quincenal)", [[D, [0.78, 0.74, 0.7, 0.58, 0.52, 0.44, 0.38]]], { area: true }),
  cuadro_general: () => (
    <CvCuerpo titulo="Cuadro de Vacancia General">
      <CvTablaSimple cols={["Fecha", "Plazas", "Ocupadas", "Vacantes", "% Ocup."]} filas={[["15/09/2026", "9,412", "8,530", 882, "90.6%"], ["31/08/2026", "9,410", "8,498", 912, "90.3%"], ["15/08/2026", "9,405", "8,471", 934, "90.1%"], ["31/07/2026", "9,398", "8,455", 943, "90.0%"]]} />
    </CvCuerpo>
  ),
  vac_nj: cvNJ("Vacantes por Nivel Jerárquico", [4, 18, 46, 92, 140], MAROON),
  ocup_nj: cvNJ("Ocupación por Nivel Jerárquico", [12, 41, 118, 260, 410], NAVY),
  vac_tabular: cvTab("Vacantes por Nivel Tabular", [38, 64, 120, 210]),
  ocup_tabular: cvTab("Ocupación por Nivel Tabular", [180, 240, 520, 760]),
  familia: () => (
    <CvCuerpo titulo="Ocupadas vs Vacantes por familia de nivel">
      <div className="size-full flex flex-col">
        <CvLeyenda items={[[G, "Ocupadas"], [D, "Vacantes"]]} />
        <div className="flex-1 min-h-0"><CvBarras datos={FAMILIAS.map(([e], i) => ({ etiqueta: e, segmentos: [[[180, 240, 520, 760][i], G], [[38, 64, 120, 210][i], D]] }))} /></div>
      </div>
    </CvCuerpo>
  ),
  nivel_J: cvNivel("J", "Vacancia y Ocupación — Nivel J"),
  nivel_K: cvNivel("K", "Vacancia y Ocupación — Nivel K"),
  nivel_A: cvNivel("A", "Vacancia y Ocupación — Nivel A"),
  nivel_S: cvNivel("S", "Vacancia y Ocupación — Nivel S"),
  nivel_D: cvNivel("D", "Vacancia y Ocupación — Nivel D"),
  nivel_P: cvNivel("P", "Vacancia y Ocupación — Enlaces P"),
  nivel_OPERATIVOS: cvNivel("OP", "Vacancia y Ocupación — Operativos"),
  obs_vacancia: cvObs("Observaciones Vacancia"),
  obs_ocupacion: cvObs("Observaciones Ocupación"),
};

/**
 * Torre Caballito: la torre por pisos (mapa de calor amarillo → rojo) sobre fondo oscuro,
 * con el buscador arriba. En reposo muestra la pista; con el cursor encima (`group-hover`
 * de la tarjeta) se "teclea" un nombre, un piso se ilumina con un faro y aparece la
 * respuesta "Se encuentra en Piso N".
 */
const PISOS_TORRE = 18;
const PISO_RESALTADO = 11;
const colorCalor = (t) => {
  const a = [252, 211, 77], b = [225, 29, 72];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
};
const TorreCaballitoPrev = () => (
  <div className="relative w-full h-full overflow-hidden bg-white dark:bg-slate-900">
    <div className="absolute inset-x-0 bottom-2 flex justify-center">
      <div className="relative flex flex-col-reverse w-24 gap-[2px]" style={{ height: "88%" }}>
        {Array.from({ length: PISOS_TORRE }, (_, i) => {
          const resaltado = i === PISO_RESALTADO;
          return (
            <div
              key={i}
              className={`flex-1 rounded-[2px] ${resaltado ? "wp-pulso z-10" : ""}`}
              style={{
                background: colorCalor(((i * 7) % 11) / 10),
                opacity: 0.85,
                boxShadow: resaltado ? "0 0 0 2px #bc955c, 0 0 14px 4px rgba(188,149,92,0.85)" : undefined,
              }}
            />
          );
        })}
        {/* Faro sobre el piso resaltado + etiqueta (solo en hover) */}
        <div className="absolute left-1/2 -translate-x-1/2 w-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ bottom: `${((PISO_RESALTADO + 1) / PISOS_TORRE) * 100}%`, height: "60%", background: "linear-gradient(to top, rgba(188,149,92,0.55), transparent)" }} />
        <div className="absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border-2 border-[#bc955c] bg-white px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ bottom: `${((PISO_RESALTADO + 0.5) / PISOS_TORRE) * 100}%`, transform: "translateY(50%)" }}>
          <p className="text-[9px] font-black uppercase tracking-wider text-[#621f32]">📍 Piso {PISO_RESALTADO + 1}</p>
          <p className="text-[10px] font-bold text-slate-800">HERNÁNDEZ RUIZ LAURA</p>
        </div>
      </div>
    </div>
    <div className="absolute inset-x-8 bottom-1 h-3 rounded-[50%] bg-slate-300/70 dark:bg-slate-800/80 blur-[1px]" />

    {/* Buscador */}
    <div className="absolute top-2 left-2 right-2">
      <div className="relative flex items-center pl-8 pr-3 py-2 rounded-xl bg-white/95 border border-slate-200 shadow-md">
        <Search className="absolute left-2.5 size-3.5 text-[#621f32]" />
        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap group-hover:hidden">Buscar empleado para ver su piso…</span>
        <span className="hidden group-hover:inline text-xs font-semibold text-slate-800 whitespace-nowrap">HERNÁNDEZ RUIZ LAURA</span>
        <span className="wp-cursor ml-px w-px h-3.5 bg-slate-500" />
      </div>
    </div>

    {/* Pista (reposo) ↔ respuesta (hover) */}
    <div className="absolute bottom-2 left-2 right-2">
      <span className="group-hover:hidden inline-flex items-center gap-1 rounded-lg bg-black/45 px-2 py-1 text-[10px] font-bold text-white/85">Clic en un piso para ver sus empleados</span>
      <div className="hidden group-hover:flex items-center gap-3 rounded-2xl border border-[#bc955c]/60 bg-white/95 px-3 py-2 shadow-xl">
        <div className="shrink-0 size-10 rounded-xl bg-[#621f32] text-white flex items-center justify-center"><MapPin className="size-5" /></div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Se encuentra en</p>
          <p className="text-base font-black leading-tight text-[#621f32]">Piso {PISO_RESALTADO + 1}</p>
          <p className="text-[11px] font-bold text-slate-600 truncate">HERNÁNDEZ RUIZ LAURA</p>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Vista previa de un widget de "acceso rápido" (una página del sistema, ver
 * widgetRegistry.js). A diferencia del resto del catálogo no es una maqueta
 * con datos de ejemplo animados: es el mismo contenido real del widget
 * (ícono, color y descripción de la página), estático salvo el hover normal
 * de la tarjeta.
 */
function AccesoRapidoPrev({ entry, descripcion }) {
  const Icon = entry.icon;
  return (
    <div className="group relative flex flex-col justify-between w-full h-full p-3 overflow-hidden text-white" style={{ backgroundColor: entry.color }}>
      <Icon className="absolute -right-6 -bottom-6 size-40 opacity-[0.28] pointer-events-none" />
      <div className="p-1.5 rounded-lg shrink-0 bg-white/15 relative z-10 w-fit">
        <Icon className="size-4" />
      </div>
      <div className="relative z-10 min-w-0">
        <p className="text-[11px] text-white/75 mb-1 line-clamp-2">{descripcion}</p>
        <span className="inline-flex items-center gap-1 flex-wrap text-[11px] font-black leading-snug">
          Ir a {entry.label} <ChevronRight className="size-3.5 shrink-0" />
        </span>
      </div>
    </div>
  );
}

const MAQUETAS = {
  estados_nomina: Estados,
  plazas_por_ua: PlazasUa,
  alineacion_organizacional: Alineacion,
  movimientos_hoy_accion: MovAccion,
  movimientos_hoy_detalle: MovDetalle,
  buscar_baja: BuscarBaja,
  buscar_plaza: () => <PlazaFlow variante="plaza" />,
  cadena_mando: CadenaMando,
  buscar_persona: BuscarPersona,
  arbol_movimientos: () => <PlazaFlow variante="arbol" />,
  titulares_aduanas_resumen: TitularesResumen,
  titulares_aduanas_actuales: TitularesActuales,
  buscar_movimiento: BuscarMovimiento,
  torre_caballito: TorreCaballitoPrev,
};

function maquetaDe(type) {
  if (MAQUETAS[type]) return MAQUETAS[type];
  const id = type.startsWith(prefijoTipoCuadrosVacancia) ? type.slice(prefijoTipoCuadrosVacancia.length) : null;
  return CV_MAQUETAS[id] || Estados;
}

export default function WidgetPreview({ entry }) {
  // `ref` se pasa siempre (reglas de hooks); solo se usa para medir el lienzo
  // virtual de las maquetas de datos, más abajo.
  const [ref, { width, height }] = useElementSize();

  // Acceso rápido: layout simple y responsivo, sin el lienzo virtual a escala
  // fija que usan las maquetas de datos (no tiene proporciones que cuidar).
  if (entry.type.startsWith(prefijoTipoAccesoRapido)) {
    const { descripcion } = metaDeWidget(entry.type);
    return (
      <div aria-hidden style={{ width: "100%", height: "100%" }} className="relative overflow-hidden pointer-events-none rounded-2xl shadow-md">
        <WidgetFrame label={entry.label} editable>
          <AccesoRapidoPrev entry={entry} descripcion={descripcion} />
        </WidgetFrame>
      </div>
    );
  }
  const real = tamanoEnPx(ESCRITORIO_REF, FILA_REF, entry.defaultW, entry.defaultH);
  // Lienzo angosto (mismas proporciones) en los widgets cuyo contenido, a tamaño real, no se leería en la tarjeta.
  const anchoVirtual = entry.type.startsWith(prefijoTipoCuadrosVacancia) ? CV_ANCHO_VIRTUAL : ANCHO_VIRTUAL[entry.type];
  const factor = anchoVirtual ? anchoVirtual / real.width : 1;
  const vw = Math.round(real.width * factor);
  const vh = Math.round(real.height * factor);
  const escala = width && height ? Math.min(width / vw, height / vh) : 0;
  const Maqueta = maquetaDe(entry.type);
  return (
    <div ref={ref} aria-hidden style={{ width: "100%", height: "100%" }} className="relative flex items-center justify-center overflow-hidden pointer-events-none">
      {escala > 0 && (
        <div className="relative shrink-0 rounded-2xl shadow-md" style={{ width: vw * escala, height: vh * escala }}>
          <div style={{ width: vw, height: vh, transform: `scale(${escala})`, transformOrigin: "top left" }}>
            <WidgetFrame label={entry.label} editable>
              <Maqueta />
            </WidgetFrame>
          </div>
          {/* Brillo que barre la maqueta mientras la tarjeta está en hover. */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="wp-brillo absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 dark:via-white/15 to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
