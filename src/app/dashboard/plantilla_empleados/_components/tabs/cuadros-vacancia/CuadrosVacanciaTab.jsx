import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Zoom } from "@/components/shared/Reveal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, useXAxisScale, useYAxisScale, usePlotArea } from "recharts";
import { LayoutDashboard, Filter, Check, ChevronRight, ChevronDown, Minus, Download, FilterX, FileText, FileEdit, Users, Briefcase, AlertCircle, Percent, Activity, ChevronsUpDown, ChevronsDownUp, TrendingUp } from "lucide-react";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { PlantillaService } from '@/services/plantilla.service';
import { VacantesService } from '@/services/vacantes.service';
import DesgloseJerarquicoCharts from "./DesgloseJerarquicoCharts";
import DetalleVacantesTablas from "./DetalleVacantesTablas";
import EmployeesModal from "../../shared/EmployeesModal";

gsap.registerPlugin(useGSAP);

// ReferenceArea con x1===x2 (mes de un solo registro) renderiza ancho 0 en
// el eje categórico (point scale, sin bandwidth), así que las franjas se
// dibujan a mano con el scale real del eje X (hooks de recharts v3) para
// poder darle un ancho mínimo visible a esos meses de un solo punto.
// Definida a nivel de módulo (no dentro de CuadrosVacanciaTab) para que su
// identidad de componente sea estable entre renders: si se redefiniera en
// cada render del padre, React la desmontaría/montaría de nuevo en cada
// re-render (p.ej. al pasar el mouse sobre un punto).
function MonthBandsLayer({ bands, chartData }) {
  const scale = useXAxisScale();
  const plotArea = usePlotArea();
  if (!scale || !plotArea || bands.length === 0) return null;

  const step = chartData.length > 1
    ? Math.abs(scale(chartData[1].label) - scale(chartData[0].label))
    : plotArea.width;
  const minWidth = Math.max(6, step * 0.4);
  const halfStep = step / 2;

  return (
    <g>
      {bands.map((b, i) => {
        const x1px = scale(b.x1);
        const x2px = scale(b.x2);
        const isSingle = b.x1 === b.x2;
        // Puntos son categóricos (point scale): cada uno se ancla en su centro,
        // así que hay que extender medio paso a cada lado para cubrir todo su ancho,
        // no solo el tramo centro-a-centro entre el primer y el último punto del mes.
        const width = isSingle ? minWidth : Math.abs(x2px - x1px) + step;
        const left = isSingle ? x1px - width / 2 : Math.min(x1px, x2px) - halfStep;
        if (!Number.isFinite(left) || !Number.isFinite(width)) return null;

        // Etiqueta "Mes Año" centrada en la franja, solo si el ancho la
        // acomoda completa (estimación de ancho por caracter a fontSize 10).
        const [yearStr, monthStr] = b.monthKey.split('-');
        const monthLabel = new Date(Number(yearStr), Number(monthStr) - 1, 1)
          .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        const labelText = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
        const estimatedTextWidth = labelText.length * 5.6 + 10;
        const showLabel = width >= estimatedTextWidth;

        return (
          <g key={b.monthKey}>
            <rect
              x={left}
              y={plotArea.y}
              width={width}
              height={plotArea.height}
              fill={b.color}
              fillOpacity={0.22}
            />
            {/* Frontera entre meses: línea vertical en el borde izquierdo de cada
                franja (salvo la primera, que coincide con el borde del área). */}
            {i > 0 && (
              <line
                x1={left}
                x2={left}
                y1={plotArea.y}
                y2={plotArea.y + plotArea.height}
                stroke={b.color}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
            {showLabel && (
              <text
                x={left + width / 2}
                y={plotArea.y + plotArea.height / 2 - 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={900}
                fill={b.color}
                fillOpacity={0.85}
                className="select-none pointer-events-none"
              >
                {labelText}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// Franjas de fondo por año (en vez de por mes, como MonthBandsLayer) para la
// gráfica de Plazas Totales/Activas/Inactivas, que cubre toda la historia de
// la ANAM (2022-hoy) con un punto por mes: agrupar por mes ahí no aportaría
// nada (ya es la unidad del dato), agrupar por año sí ayuda a ubicar "en qué
// año" cae cada máximo/mínimo. Misma técnica de posicionamiento con el scale
// real del eje X que MonthBandsLayer, a nivel de módulo por la misma razón
// (identidad de componente estable entre renders).
function YearBandsLayer({ bands, chartData }) {
  const scale = useXAxisScale();
  const plotArea = usePlotArea();
  if (!scale || !plotArea || bands.length === 0) return null;

  const step = chartData.length > 1
    ? Math.abs(scale(chartData[1].label) - scale(chartData[0].label))
    : plotArea.width;
  const halfStep = step / 2;

  return (
    <g>
      {bands.map((b, i) => {
        const x1px = scale(b.x1);
        const x2px = scale(b.x2);
        const width = Math.abs(x2px - x1px) + step;
        const left = Math.min(x1px, x2px) - halfStep;
        if (!Number.isFinite(left) || !Number.isFinite(width)) return null;
        const estimatedTextWidth = b.year.length * 8 + 10;
        const showLabel = width >= estimatedTextWidth;

        return (
          <g key={b.year}>
            <rect x={left} y={plotArea.y} width={width} height={plotArea.height} fill={b.color} fillOpacity={0.14} />
            {i > 0 && (
              <line
                x1={left} x2={left} y1={plotArea.y} y2={plotArea.y + plotArea.height}
                stroke={b.color} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 3"
              />
            )}
            {showLabel && (
              <text
                x={left + width / 2}
                y={plotArea.y + 16}
                textAnchor="middle"
                fontSize={13}
                fontWeight={900}
                fill={b.color}
                fillOpacity={0.85}
                className="select-none pointer-events-none"
              >
                {b.year}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// Marca meses en los que, según el corte mensual del histórico de plazas, se
// detecta creación (cualquier incremento de plazas activas) o desactivación
// (cualquier incremento de plazas inactivas) — ver cálculo en `plazasEventos`
// más abajo. Ambas se evalúan por separado, así que un mismo mes puede tener
// las dos a la vez (activas e inactivas suben juntas): se dibujan lado a lado
// (offset horizontal), no encimadas. Banda vertical delgada (mismo mecanismo
// que YearBandsLayer) para que no se amontonen varios meses seguidos.
// Triángulo (creación ▲ verde / desactivación ▼ guinda) + número de plazas
// afectadas en una píldora encima — todas las píldoras viven a la misma
// altura fija (arriba del área de trazo), así que con muchos meses seguidos
// se amontonan entre sí. Al pasar el mouse sobre la franja (o la píldora),
// esa píldora se alza con GSAP (traslada + escala + sombra) para sacarla del
// montón. Ojo: NO se reordena el DOM para "traerla al frente" — moverla de
// posición mientras el mouse está encima le rompe el mouseleave (el cursor
// deja de estar sobre el nodo original) y se queda pegada arriba.
function PlazasEventsLayer({ events, chartData, onEventClick }) {
  const scale = useXAxisScale();
  const plotArea = usePlotArea();
  const badgeRefs = useRef({});
  const [hoveredKey, setHoveredKey] = useState(null);
  if (!scale || !plotArea || events.length === 0) return null;

  const step = chartData.length > 1
    ? Math.abs(scale(chartData[1].label) - scale(chartData[0].label))
    : plotArea.width;
  const bandWidth = Math.max(4, step * 0.28);
  const halfBand = bandWidth / 2;

  const byIndex = {};
  events.forEach(ev => {
    (byIndex[ev.index] ||= []).push(ev);
  });

  const items = [];
  Object.values(byIndex).forEach(evs => {
    const baseX = scale(chartData[evs[0].index]?.label);
    if (!Number.isFinite(baseX)) return;
    const slot = bandWidth + 3;
    evs.forEach((ev, ei) => {
      const x = baseX + (ei - (evs.length - 1) / 2) * slot;
      items.push({ ev, x, key: `evt-${ev.type}-${ev.index}` });
    });
  });
  const lowerEl = (elKey) => {
    const el = badgeRefs.current[elKey];
    if (!el) return;
    gsap.to(el, { y: 0, scale: 1, filter: 'none', duration: 0.18, ease: 'power2.out', overwrite: true });
  };

  const raise = (key) => {
    // Seguro: si quedó otra píldora alzada (p.ej. su mouseleave no llegó a
    // disparar por movimiento rápido del mouse), se baja antes de alzar esta.
    setHoveredKey(prev => {
      if (prev && prev !== key) lowerEl(prev);
      return key;
    });
    const el = badgeRefs.current[key];
    if (!el) return;
    gsap.to(el, {
      y: -14,
      scale: 1.25,
      filter: 'drop-shadow(0 4px 7px rgba(0,0,0,.45))',
      transformOrigin: '50% 100%',
      duration: 0.28,
      ease: 'back.out(2.4)',
      overwrite: true,
    });
  };
  const lower = (key) => {
    setHoveredKey(prev => (prev === key ? null : prev));
    const el = badgeRefs.current[key];
    if (!el) return;
    gsap.to(el, {
      y: 0,
      scale: 1,
      filter: 'none',
      duration: 0.22,
      ease: 'power2.out',
      overwrite: true,
    });
  };

  return (
    <g>
      {items.map(({ ev, x, key }) => {
        const isCreacion = ev.type === 'creacion';
        const color = isCreacion ? '#2f9e5c' : '#c23b5a';
        const topY = plotArea.y - 8;
        const apexY = topY - 14;
        const count = isCreacion ? ev.dActivas : ev.dInactivas;
        const labelText = `${isCreacion ? '+' : '-'}${count}`;
        const pillW = Math.max(26, labelText.length * 7.5 + 10);
        const pillY = apexY - 20;

        return (
          <g key={key}>
            <rect
              x={x - halfBand}
              y={plotArea.y}
              width={bandWidth}
              height={plotArea.height}
              fill={color}
              fillOpacity={key === hoveredKey ? 0.4 : 0.22}
              onMouseEnter={() => raise(key)}
              onMouseLeave={() => lower(key)}
              onClick={() => onEventClick?.(ev)}
              style={{ cursor: 'pointer' }}
            />
            <g
              ref={el => { if (el) badgeRefs.current[key] = el; }}
              onMouseEnter={() => raise(key)}
              onMouseLeave={() => lower(key)}
              onClick={() => onEventClick?.(ev)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={isCreacion
                  ? `M ${x - 8} ${topY} L ${x + 8} ${topY} L ${x} ${apexY} Z`
                  : `M ${x - 8} ${apexY} L ${x + 8} ${apexY} L ${x} ${topY} Z`}
                fill={color}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <rect
                x={x - pillW / 2}
                y={pillY}
                width={pillW}
                height={16}
                rx={8}
                fill={color}
                stroke="#fff"
                strokeWidth={1}
              />
              <text
                x={x}
                y={pillY + 11.5}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={800}
                fill="#fff"
                className="select-none pointer-events-none"
              >
                {labelText}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Offset vertical "preferido" por serie para sus etiquetas de máximo/mínimo:
// punto de partida del empaquetado anticolisión de PlazasExtremeLabelsLayer,
// y también usado por renderPlazasDot para separar el nombre de serie (en el
// primer/último punto) de esa misma etiqueta. Compartido a nivel de módulo
// porque ambos (capa y dot) lo necesitan.
const PLAZAS_LABEL_BASE_OFFSET = { totales: 26, activas: 50, inactivas: 74 };

// Ancho estimado (por caracter) del texto de las etiquetas de extremos, y
// según el textAnchor calcula el rango [xStart, xEnd] que esa etiqueta ocupa
// realmente en el eje X (no solo su centro), para poder detectar colisiones
// horizontales entre etiquetas ancladas a la izquierda/derecha/centro.
function estimateExtremeLabelBox(dateText, valueText, anchor, px) {
  const CHAR_W = 6.3;
  const PAD = 8;
  const width = Math.max(dateText.length, valueText.length) * CHAR_W + PAD;
  if (anchor === 'start') return { xStart: px, xEnd: px + width, width };
  if (anchor === 'end') return { xStart: px - width, xEnd: px, width };
  return { xStart: px - width / 2, xEnd: px + width / 2, width };
}

// Empaqueta etiquetas de un mismo sentido (todas "max", que suben, o todas
// "min", que bajan): cada etiqueta arranca en el carril preferido de su serie
// (`baseOffset`) y, si su caja [xStart,xEnd,yTop,yBottom] choca con la de
// cualquier otra etiqueta YA colocada —de la misma serie o de otra—, se aleja
// más del punto (mismo sentido) hasta encontrar hueco libre. La comparación es
// contra TODAS las etiquetas ya puestas (no solo las de su propio carril):
// con series de valores parecidos (p.ej. Totales y Activas cuando Inactivas
// ronda cero) sus carriles preferidos quedan a solo 24px uno de otro, menos
// que el alto real de una etiqueta de 2 líneas (~28px), así que sin este
// chequeo cruzado dos carriles "distintos" se siguen encimando en pantalla.
// Determinista y O(n²) sobre el puñado de extremos por año que maneja esta
// gráfica. `direction` es -1 (max, hacia arriba) o +1 (min, hacia abajo).
function packExtremeLabels(items, direction) {
  const GAP_X = 4;
  const LABEL_HEIGHT = 28; // 2 líneas (fecha + valor) + aire
  const STEP = LABEL_HEIGHT + 4;
  const placedBoxes = [];
  const sorted = [...items].sort((a, b) => a.baseOffset - b.baseOffset || a.px - b.px);

  return sorted.map(item => {
    const baseDy = direction * item.baseOffset;
    let dy = baseDy;
    const xStart = item.box.xStart - GAP_X;
    const xEnd = item.box.xEnd + GAP_X;

    for (let guard = 0; guard < 20; guard++) {
      const labelY = item.py + dy;
      const yTop = labelY - 10;
      const yBottom = labelY + 18;
      const collides = placedBoxes.some(b =>
        xStart < b.xEnd && xEnd > b.xStart && yTop < b.yBottom && yBottom > b.yTop
      );
      if (!collides) {
        placedBoxes.push({ xStart, xEnd, yTop, yBottom });
        return { ...item, dy, pushed: dy !== baseDy };
      }
      dy += direction * STEP;
    }
    return { ...item, dy, pushed: true };
  });
}

// Etiquetas de máximo/mínimo POR AÑO de la gráfica de Plazas Totales/Activas/
// Inactivas. Vive fuera de renderPlazasDot (que solo conoce su propio punto)
// porque evitar que se encimen requiere ver TODOS los extremos a la vez: usa
// las escalas reales del eje (mismos hooks que MonthBandsLayer/PlazasEventsLayer)
// para calcular la posición en píxeles de cada extremo, los reparte con
// packExtremeLabels, y cuando una etiqueta termina lejos de su punto (se movió
// de carril para no chocar) dibuja una flecha conectora hacia el punto que
// representa.
function PlazasExtremeLabelsLayer({ minMaxByYear, chartData, series, formatDateShort, formatNumber }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();
  if (!xScale || !yScale || !plotArea) return null;

  const rawItems = [];
  series.forEach(s => {
    const byYear = minMaxByYear[s.key] || {};
    Object.entries(byYear).forEach(([year, g]) => {
      ['max', 'min'].forEach(kind => {
        const point = g[kind];
        if (!point) return;
        const d = chartData[point.index];
        if (!d) return;
        const px = xScale(d.label);
        const py = yScale(point.value);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return;

        const isFirstPoint = point.index === 0;
        const isLastPoint = point.index === chartData.length - 1;
        const anchor = isFirstPoint ? 'start' : isLastPoint ? 'end' : 'middle';
        const dateText = `${kind === 'max' ? '▲' : '▼'} ${formatDateShort(d.fecha)}`;
        const valueText = formatNumber(point.value);
        const box = estimateExtremeLabelBox(dateText, valueText, anchor, px);

        rawItems.push({
          key: `${s.key}-${kind}-${point.index}-${year}`,
          color: s.color, kind, px, py, anchor, dateText, valueText, box,
          baseOffset: PLAZAS_LABEL_BASE_OFFSET[s.key],
        });
      });
    });
  });

  const placed = [
    ...packExtremeLabels(rawItems.filter(it => it.kind === 'max'), -1),
    ...packExtremeLabels(rawItems.filter(it => it.kind === 'min'), 1),
  ];

  return (
    <g>
      {placed.map(it => {
        const dir = it.kind === 'max' ? -1 : 1;
        const labelY = it.py + it.dy;
        const textX = it.anchor === 'start' ? it.px + 6 : it.anchor === 'end' ? it.px - 6 : it.px;

        // Flecha conectora: solo cuando el empaquetado tuvo que alejar esta
        // etiqueta de su carril preferido (chocaba con otra), que es
        // justamente cuando ya no queda obvio a simple vista a qué punto
        // pertenece.
        const dotEdgeY = it.py + dir * 9;
        const labelEdgeY = dir === -1 ? labelY + 16 : labelY - 11;
        const arrowBaseY = dotEdgeY + dir * 5;

        return (
          <g key={it.key}>
            {it.pushed && (
              <g pointerEvents="none">
                <line
                  x1={it.px}
                  y1={labelEdgeY}
                  x2={it.px}
                  y2={dotEdgeY}
                  stroke={it.color}
                  strokeWidth={1.25}
                  strokeOpacity={0.6}
                />
                <path
                  d={`M ${it.px - 3} ${arrowBaseY} L ${it.px + 3} ${arrowBaseY} L ${it.px} ${dotEdgeY} Z`}
                  fill={it.color}
                  fillOpacity={0.75}
                />
              </g>
            )}
            <text x={textX} y={labelY} textAnchor={it.anchor} className="select-none pointer-events-none">
              <tspan x={textX} fontSize={11} fontWeight={700} fill={it.color}>{it.dateText}</tspan>
              <tspan x={textX} dy={13} fontSize={12} fontWeight={800} fill={it.color}>{it.valueText}</tspan>
            </text>
          </g>
        );
      })}
    </g>
  );
}

function HistoricoTooltip({ active, payload, label, hoveredPointKey, formatNumber }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[190px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((p, i) => {
          const isHovered = p.dataKey === hoveredPointKey;
          return (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className={`text-[11px] ${isHovered ? 'font-black text-slate-800 dark:text-white' : 'font-bold text-slate-500 dark:text-slate-400'}`}>
                  {p.name}
                </span>
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(p.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tarjeta reutilizable de gráfica histórica (Ocupación o Vacancia). Definida
// a nivel de módulo por la misma razón que MonthBandsLayer: recibe todo por
// props para no depender de closures del padre y así mantener su identidad
// estable entre renders (evita que un simple hover remonte el <LineChart>
// completo y con él, la animación de dibujado de línea).
//
// La animación de "dibujado" (stroke-dashoffset) solo se dispara por
// visibilidad: un IntersectionObserver sobre la tarjeta completa la relanza
// cada vez que vuelve a entrar al viewport (se perdió de vista y se ve de
// nuevo), no en cada render ni en cada cambio de datos.
function HistoricoChartCard({
  title, subtitle, icon: Icon, series, chartData, ticks, isCompactChart,
  formatNumber, monthBands, renderDot, hoveredPointKey, onDotHover, onDotLeave,
  // Opcionales: solo los usa la tarjeta de Plazas Totales/Activas/Inactivas.
  // `bandsLayer`, si se pasa, sustituye a <MonthBandsLayer> (p.ej. franjas por
  // año en vez de por mes); `extraLayer` se dibuja encima (marcadores de
  // creación/desactivación de plazas, que necesitan más margen superior para
  // su píldora de conteo — de ahí `topMargin`); `footnote` va debajo de la
  // gráfica; `toolbar` va en el header, junto al título (p.ej. botones de
  // filtro creación/desactivación).
  bandsLayer, extraLayer, footnote, topMargin, toolbar,
}) {
  const cardRef = useRef(null);

  // Dominio real de esta tarjeta (min/max de sus propias series, no del
  // dataset completo) con margen del 10%, en vez del default de recharts
  // que arranca en 0 y desperdicia la mayor parte de la escala cuando los
  // valores se mueven en una banda angosta lejos de cero.
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 'auto'];
    let min = Infinity, max = -Infinity;
    chartData.forEach(d => {
      series.forEach(s => {
        const v = d[s.key];
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 'auto'];
    const padding = Math.max(1, Math.round((max - min) * 0.1));
    return [Math.max(0, min - padding), max + padding];
  }, [chartData, series]);

  useGSAP(() => {
    if (chartData.length === 0) return;
    const el = cardRef.current;
    if (!el) return;

    const playDrawAnimation = () => {
      const paths = gsap.utils.toArray('.recharts-line-curve', el);
      paths.forEach((path, i) => {
        const length = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', delay: i * 0.15, overwrite: true }
        );
      });

      const dotLayers = gsap.utils.toArray('.recharts-line-dots', el);
      gsap.fromTo(dotLayers, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 1, stagger: 0.12, overwrite: true });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          playDrawAnimation();
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(el);
    return () => observer.disconnect();
  }, { scope: cardRef, dependencies: [chartData] });

  return (
    <div ref={cardRef} data-historico-card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/60 flex-wrap">
        <div className="p-3.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-2xl shadow-lg shadow-[#10243e]/30 text-white">
          <Icon className="size-6" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
        </div>
        {toolbar && <div className="flex items-center gap-2 flex-wrap">{toolbar}</div>}
      </div>

      {chartData.length === 0 ? (
        <div className="py-16 text-center text-slate-450 dark:text-slate-500 font-bold">
          No hay datos históricos disponibles
        </div>
      ) : (
        <div data-pdf-chart className="w-full relative h-[560px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: topMargin ?? (isCompactChart ? 36 : 54), right: isCompactChart ? 4 : 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.4} className="text-slate-350 dark:text-slate-600" />
              {bandsLayer ?? <MonthBandsLayer bands={monthBands} chartData={chartData} />}
              {extraLayer}
              <XAxis
                dataKey="label"
                type="category"
                ticks={ticks}
                tick={{ fontSize: isCompactChart ? 8 : 10, fontWeight: 700 }}
                stroke="currentColor"
                className="text-slate-400 dark:text-slate-500"
              />
              <YAxis
                domain={yDomain}
                allowDecimals={false}
                tick={{ fontSize: isCompactChart ? 9 : 10, fontWeight: 700 }}
                stroke="currentColor"
                className="text-slate-400 dark:text-slate-500"
                tickFormatter={formatNumber}
                width={isCompactChart ? 36 : 55}
              />
              <Tooltip
                content={<HistoricoTooltip hoveredPointKey={hoveredPointKey} formatNumber={formatNumber} />}
                cursor={{ stroke: '#bc955c', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Legend
                wrapperStyle={{ fontSize: isCompactChart ? 9 : 11, fontWeight: 700 }}
                formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>}
              />
              {series.map(s => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={1.75}
                  isAnimationActive={false}
                  dot={renderDot(s.key, s.color, s.name)}
                  activeDot={(dotProps) => {
                    const { cx, cy, key } = dotProps;
                    return (
                      <g key={key}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill="transparent"
                          onMouseEnter={() => onDotHover(s.key)} onPointerDown={() => onDotHover(s.key)}
                          onMouseLeave={onDotLeave}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={s.color}
                          stroke="#fff"
                          strokeWidth={2}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {footnote && chartData.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          {footnote}
        </div>
      )}
    </div>
  );
}

export default function CuadrosVacanciaTab({ cuadrosData = [], desgloseJerarquicoData = [], ocupadosJerarquicoData = [], conteoPlazasSerieData = [], onSwitchToTablaPrincipal }) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQnas, setSelectedQnas] = useState([]);
  const [yearFilterOpen, setYearFilterOpen] = useState(false);
  const [qnaFilterOpen, setQnaFilterOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  const yearFilterRef = useRef(null);
  const qnaFilterRef = useRef(null);
  const yearBtnRef = useRef(null);
  const qnaBtnRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const qnaDropdownRef = useRef(null);
  const [yearDropdownPos, setYearDropdownPos] = useState({ top: 0, left: 0 });
  const [qnaDropdownPos, setQnaDropdownPos] = useState({ top: 0, left: 0 });
  const tableRef = useRef(null);
  const pdfRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Modal de detalle al hacer click en una franja verde/guinda de la gráfica
  // de Plazas: qué posiciones concretas se crearon/desactivaron ese mes.
  // Reutiliza EmployeesModal en modo local (prop `rows`, ver su doc) en vez
  // de un modal propio — mismo patrón que DetalleVacantesTablas.jsx.
  const [plazasDetalleOpen, setPlazasDetalleOpen] = useState(false);
  const [plazasDetalleRows, setPlazasDetalleRows] = useState([]);
  const [plazasDetalleTitle, setPlazasDetalleTitle] = useState('');

  // Alto real del thead (sticky top-0, 2 filas), medido en vivo porque varía
  // por breakpoint (padding/tamaño de texto sm: cambia). Sirve para que la
  // celda de Año (con rowSpan sobre todo el bloque del año) pueda pegar su
  // contenido justo debajo del thead en vez de quedar centrada a la mitad de
  // una celda de decenas de filas de alto, invisible mientras se hace scroll.
  const theadRef = useRef(null);
  const [theadHeight, setTheadHeight] = useState(0);
  useEffect(() => {
    const el = theadRef.current;
    if (!el) return;
    const measure = () => setTheadHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!yearFilterRef.current?.contains(event.target) && !yearDropdownRef.current?.contains(event.target)) {
        setYearFilterOpen(false);
      }
      if (!qnaFilterRef.current?.contains(event.target) && !qnaDropdownRef.current?.contains(event.target)) {
        setQnaFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // El dropdown de filtro se posiciona con `fixed` calculado una sola vez
  // (getBoundingClientRect) al abrirse. Ese valor queda obsoleto en cuanto hay
  // scroll (de la página o del contenedor interno de la tabla), dejándolo
  // flotando lejos de su botón. Como no se reposiciona en vivo, la solución
  // más simple y predecible es cerrarlo apenas se detecta scroll — mismo
  // criterio que el cierre por click-outside de arriba. `capture: true` para
  // enterarse también del scroll del div interno `overflow-auto` de la tabla,
  // que no hace bubble hasta `window`.
  useEffect(() => {
    if (!yearFilterOpen && !qnaFilterOpen) return;
    const handleScroll = () => {
      setYearFilterOpen(false);
      setQnaFilterOpen(false);
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [yearFilterOpen, qnaFilterOpen]);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString('en-US');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);

    const monthStr = date.toLocaleDateString('es-MX', { month: 'long' });
    const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

    return `${date.getDate().toString().padStart(2, '0')} ${capitalizedMonth}, ${year}`;
  };

  const getYear = (dateStr) => {
    if (!dateStr) return "";
    return dateStr.split('-')[0];
  };

  // Fecha corta ("10 Ene 26") para las anotaciones de máximo/mínimo del
  // histórico — la fecha larga (formatDate) es demasiado ancha para caber
  // junto al valor sin encimarse con puntos vecinos.
  const formatDateShort = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    const monthStr = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    return `${date.getDate().toString().padStart(2, '0')} ${capitalizedMonth} ${year.slice(2)}`;
  };

  // "Ene 2022" para el eje X de la gráfica de Plazas Totales/Activas/Inactivas
  // (corte mensual, sin día que mostrar).
  const formatMonthYear = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day || 1);
    const monthStr = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    return `${capitalizedMonth} ${year}`;
  };

  const sortedDescData = useMemo(() => {
    return [...cuadrosData].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [cuadrosData]);

  const actualRow = useMemo(() => {
    return sortedDescData[0] || null;
  }, [sortedDescData]);

  const kpis = useMemo(() => {
    if (!actualRow) return null;
    const total = actualRow.total || 0;
    const ocupadas = actualRow.ocupadas_total || 0;
    const vacantes = actualRow.vacantes_total || 0;

    return {
      total,
      totalPerm: actualRow.total_permanente || 0,
      totalEvt: actualRow.total_eventual || 0,
      ocupadas,
      ocupadasPerm: actualRow.ocupadas_permanente || 0,
      ocupadasEvt: actualRow.ocupadas_eventual || 0,
      ocupadasPct: total > 0 ? ((ocupadas / total) * 100).toFixed(1) : "0.0",
      vacantes,
      vacantesPerm: actualRow.vacantes_permanente || 0,
      vacantesEvt: actualRow.vacantes_eventual || 0,
      vacantesPct: total > 0 ? ((vacantes / total) * 100).toFixed(1) : "0.0",
      fechaActual: formatDate(actualRow.fecha)
    };
  }, [actualRow]);

  // Datos filtrados por año/quincena seleccionados (Año + Qna.). Se calcula
  // aquí arriba porque tanto la tabla como la gráfica histórica dependen de
  // él y así responden juntas a la misma selección de periodo.
  const filteredData = useMemo(() => {
    return sortedDescData.filter(row => {
      const rowYear = getYear(row.fecha);
      const rowQna = formatDate(row.fecha);
      const passYear = selectedYears.length === 0 || selectedYears.includes(rowYear);
      const passQna = selectedQnas.length === 0 || selectedQnas.includes(rowQna);
      return passYear && passQna;
    });
  }, [sortedDescData, selectedYears, selectedQnas]);

  const historicoChartData = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map(row => ({
        fecha: row.fecha,
        // Eje X categórico: cada dato (quincena) ocupa el mismo ancho sin
        // importar cuánto tiempo real haya entre una fecha y la siguiente.
        label: formatDate(row.fecha),
        ocupadas_permanente: row.ocupadas_permanente || 0,
        ocupadas_eventual: row.ocupadas_eventual || 0,
        vacantes_permanente: row.vacantes_permanente || 0,
        vacantes_eventual: row.vacantes_eventual || 0,
      }));
  }, [filteredData]);

  // Franjas de fondo: agrupa puntos consecutivos que caen en el mismo mes
  // calendario y les asigna un color distinto (ciclando la paleta) para que
  // cada mes se distinga visualmente en la gráfica histórica.
  const MONTH_BAND_COLORS = ['#10243e', '#bc955c', '#621f32', '#2e5890', '#3b6ba8', '#8c2d4a', '#4a7c59', '#7c4a8c'];

  const historicoMonthBands = useMemo(() => {
    const bands = [];
    historicoChartData.forEach(d => {
      const monthKey = d.fecha.slice(0, 7); // YYYY-MM
      const last = bands[bands.length - 1];
      if (last && last.monthKey === monthKey) {
        last.x2 = d.label;
      } else {
        bands.push({ monthKey, x1: d.label, x2: d.label });
      }
    });
    return bands.map((b, i) => ({ ...b, color: MONTH_BAND_COLORS[i % MONTH_BAND_COLORS.length] }));
  }, [historicoChartData]);

  const HISTORICO_SERIES = [
    { key: 'ocupadas_permanente', name: 'Permanentes Ocupadas', color: '#10243e' },
    { key: 'ocupadas_eventual', name: 'Eventuales Ocupadas', color: '#bc955c' },
    { key: 'vacantes_permanente', name: 'Vacantes Permanentes', color: '#621f32' },
    { key: 'vacantes_eventual', name: 'Vacantes Eventuales', color: '#2e5890' },
  ];

  // Grafica combinada partida en dos (Ocupación / Vacancia): cada tarjeta
  // usa el subconjunto de series que le corresponde por prefijo de key.
  const OCUPACION_SERIES = HISTORICO_SERIES.filter(s => s.key.startsWith('ocupadas'));
  const VACANCIA_SERIES = HISTORICO_SERIES.filter(s => s.key.startsWith('vacantes'));

  const historicoMinMax = useMemo(() => {
    const result = {};
    HISTORICO_SERIES.forEach(s => {
      let maxPoint = null, minPoint = null;
      historicoChartData.forEach((d, i) => {
        const v = d[s.key];
        if (maxPoint === null || v > maxPoint.value) maxPoint = { index: i, value: v };
        if (minPoint === null || v < minPoint.value) minPoint = { index: i, value: v };
      });
      result[s.key] = { max: maxPoint, min: minPoint };
    });
    return result;
  }, [historicoChartData]);

  // Cada serie del grupo (Ocupadas: permanente+eventual / Vacantes: permanente+eventual)
  // comparte rango de valores, así que sus etiquetas de máximo/mínimo pueden caer
  // muy cerca en x/y y encimarse. Se les asigna un "carril" vertical distinto por
  // serie dentro del grupo para separarlas incluso cuando el punto extremo coincide
  // en el mismo índice de fecha.
  const HISTORICO_LABEL_LANE = {
    ocupadas_permanente: { max: -24, min: 22 },
    ocupadas_eventual: { max: -48, min: 46 },
    vacantes_permanente: { max: -24, min: 22 },
    vacantes_eventual: { max: -48, min: 46 },
  };

  const renderHistoricoDot = (key, color, seriesName) => (dotProps) => {
    const { cx, cy, index, value } = dotProps;
    const minMax = historicoMinMax[key];
    const isMax = minMax?.max && index === minMax.max.index;
    const isMin = minMax?.min && index === minMax.min.index && minMax.min.index !== minMax.max.index;

    // Cerca del borde izquierdo/derecho el texto centrado se recorta contra el
    // área del gráfico: se ancla hacia adentro en vez de centrarlo sobre el punto.
    const isFirstPoint = index === 0;
    const isLastPoint = index === historicoChartData.length - 1;
    const textAnchor = isFirstPoint ? "start" : isLastPoint ? "end" : "middle";
    const textX = isFirstPoint ? cx + 6 : isLastPoint ? cx - 6 : cx;

    // Nombre de la serie (mismo texto que la leyenda) sobre el extremo de la
    // línea, para identificarla directamente en la gráfica sin depender solo
    // de la leyenda al pie. Si el extremo coincide con el punto máximo (cuya
    // anotación de fecha/valor también va arriba), se sube más para no
    // encimarse con ella.
    const lane = HISTORICO_LABEL_LANE[key];
    const nameLabelY = isMax ? cy + lane.max - 20 : cy - 12;
    const nameLabel = (isFirstPoint || isLastPoint) && (
      <text
        key={`name-${key}-${index}`}
        x={textX}
        y={nameLabelY}
        textAnchor={textAnchor}
        fontSize={11}
        fontWeight={800}
        fill={color}
        className="select-none pointer-events-none"
      >
        {seriesName}
      </text>
    );

    if (!isMax && !isMin) {
      // Marcador pequeño y discreto (estilo matplotlib) para los puntos normales.
      return (
        <g key={`dot-${key}-${index}`}>
          <circle cx={cx} cy={cy} r={2.2} fill={color} strokeWidth={0} />
          {nameLabel}
        </g>
      );
    }

    const dateText = formatDateShort(historicoChartData[index]?.fecha);
    const labelY = cy + (isMax ? lane.max : lane.min);

    return (
      <g key={`dot-${key}-${index}`}>
        {/* Punto sólido más grande con borde blanco (sin halo difuso) para que
            destaque frente a los puntos normales, y texto plano estilo
            matplotlib: fecha arriba, valor abajo. */}
        <circle cx={cx} cy={cy} r={5.5} fill={color} stroke="#fff" strokeWidth={2} />
        <text x={textX} y={labelY} textAnchor={textAnchor} className="select-none">
          <tspan x={textX} fontSize={12} fontWeight={600} fill={color}>
            {dateText}
          </tspan>
          <tspan x={textX} dy={14} fontSize={12} fontWeight={600} fill={color}>
            {formatNumber(value)}
          </tspan>
        </text>
        {nameLabel}
      </g>
    );
  };

  const [hoveredPointKey, setHoveredPointKey] = useState(null);

  const [isCompactChart, setIsCompactChart] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsCompactChart(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Ticks explícitos: con muchas quincenas mostrar todas las etiquetas las
  // encimaría, así que se eligen N repartidas por índice (siempre incluyendo
  // la primera y la última).
  const historicoTicks = useMemo(() => {
    const n = historicoChartData.length;
    if (n === 0) return [];
    const desiredCount = Math.min(n, isCompactChart ? 4 : 7);
    if (desiredCount <= 1) return [historicoChartData[0].label];
    const idxs = new Set();
    for (let i = 0; i < desiredCount; i++) {
      idxs.add(Math.round((i * (n - 1)) / (desiredCount - 1)));
    }
    return [...idxs].sort((a, b) => a - b).map(i => historicoChartData[i].label);
  }, [historicoChartData, isCompactChart]);

  // ── Plazas Totales vs Activas vs Inactivas (histórico completo, corte a
  // fin de cada mes desde 2022-01, vía sp_conteo_plazas_historico_serie) ──
  // Serie independiente de los filtros Año/Qna de arriba: el objetivo es ver
  // TODA la historia de la ANAM en una sola gráfica, no un periodo acotado.
  const plazasChartData = useMemo(() => {
    return [...(conteoPlazasSerieData || [])]
      .map(row => ({
        fecha: row['Fecha'],
        label: formatMonthYear(row['Fecha']),
        totales: row['Plazas totales'] || 0,
        activas: row['Plazas activas'] || 0,
        inactivas: row['Plazas inactivas'] || 0,
      }))
      .filter(d => d.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [conteoPlazasSerieData]);

  const PLAZAS_SERIES = [
    { key: 'totales', name: 'Plazas Totales', color: '#10243e' },
    { key: 'activas', name: 'Plazas Activas', color: '#2e5890' },
    { key: 'inactivas', name: 'Plazas Inactivas', color: '#621f32' },
  ];

  // Franjas de fondo por año.
  const plazasYearBands = useMemo(() => {
    const bands = [];
    plazasChartData.forEach(d => {
      const year = d.fecha.slice(0, 4);
      const last = bands[bands.length - 1];
      if (last && last.year === year) {
        last.x2 = d.label;
      } else {
        bands.push({ year, x1: d.label, x2: d.label });
      }
    });
    return bands.map((b, i) => ({ ...b, color: MONTH_BAND_COLORS[i % MONTH_BAND_COLORS.length] }));
  }, [plazasChartData]);

  // Un tick por año (primer punto disponible de cada año) en vez de repartir
  // N ticks por índice: con ~4-5 años de historia, marcar el arranque de cada
  // año es más legible que ticks genéricos y refuerza la lectura "por año"
  // que piden las anotaciones de máximo/mínimo.
  const plazasTicks = useMemo(() => {
    const seen = new Set();
    const ticks = [];
    plazasChartData.forEach(d => {
      const year = d.fecha.slice(0, 4);
      if (!seen.has(year)) {
        seen.add(year);
        ticks.push(d.label);
      }
    });
    return ticks;
  }, [plazasChartData]);

  // Máximo y mínimo de cada serie (Totales/Activas/Inactivas) POR AÑO, a
  // diferencia de historicoMinMax que es un único máximo/mínimo global —
  // aquí se pide destacar el extremo de cada año por separado.
  const plazasMinMaxByYear = useMemo(() => {
    const result = {};
    PLAZAS_SERIES.forEach(s => {
      result[s.key] = {};
      plazasChartData.forEach((d, i) => {
        const year = d.fecha.slice(0, 4);
        const v = d[s.key];
        if (!result[s.key][year]) result[s.key][year] = { max: null, min: null };
        const g = result[s.key][year];
        if (g.max === null || v > g.max.value) g.max = { index: i, value: v };
        if (g.min === null || v < g.min.value) g.min = { index: i, value: v };
      });
    });
    return result;
  }, [plazasChartData]);

  // Índice → 'max' | 'min' | 'both', por serie, para que el dot sepa si le
  // toca anotación al dibujarse (evita recorrer todos los años en cada dot).
  const plazasExtremeAtIndex = useMemo(() => {
    const map = {};
    PLAZAS_SERIES.forEach(s => {
      Object.values(plazasMinMaxByYear[s.key] || {}).forEach(g => {
        if (g.max) {
          const k = `${s.key}-${g.max.index}`;
          map[k] = map[k] === 'min' ? 'both' : 'max';
        }
        if (g.min) {
          const k = `${s.key}-${g.min.index}`;
          map[k] = map[k] === 'max' ? 'both' : 'min';
        }
      });
    });
    return map;
  }, [plazasMinMaxByYear]);

  // Las etiquetas de fecha/valor de máximo y mínimo ya no se dibujan aquí:
  // requieren ver TODOS los extremos a la vez para no encimarse entre sí, así
  // que las dibuja PlazasExtremeLabelsLayer (capa aparte, con las escalas
  // reales del eje). Este dot solo pone el punto (grande si es extremo,
  // pequeño si no) y, en el primer/último punto, el nombre de la serie.
  const renderPlazasDot = (key, color, seriesName) => (dotProps) => {
    const { cx, cy, index } = dotProps;
    const extreme = plazasExtremeAtIndex[`${key}-${index}`];
    const isFirstPoint = index === 0;
    const isLastPoint = index === plazasChartData.length - 1;
    const textAnchor = isFirstPoint ? "start" : isLastPoint ? "end" : "middle";
    const textX = isFirstPoint ? cx + 6 : isLastPoint ? cx - 6 : cx;

    const isMaxish = extreme === 'max' || extreme === 'both';
    const nameLabelY = isMaxish ? cy - PLAZAS_LABEL_BASE_OFFSET[key] - 14 : cy - 10;
    const nameLabel = (isFirstPoint || isLastPoint) && (
      <text
        key={`name-${key}-${index}`}
        x={textX}
        y={nameLabelY}
        textAnchor={textAnchor}
        fontSize={11}
        fontWeight={800}
        fill={color}
        className="select-none pointer-events-none"
      >
        {seriesName}
      </text>
    );

    if (!extreme) {
      return (
        <g key={`dot-${key}-${index}`}>
          <circle cx={cx} cy={cy} r={2} fill={color} strokeWidth={0} />
          {nameLabel}
        </g>
      );
    }

    return (
      <g key={`dot-${key}-${index}`}>
        <circle cx={cx} cy={cy} r={5.5} fill={color} stroke="#fff" strokeWidth={2} />
        {nameLabel}
      </g>
    );
  };

  // Detección de creación/desactivación de plazas entre un corte mensual y el
  // siguiente: creación = CUALQUIER incremento de plazas activas; desactivación
  // = CUALQUIER incremento de plazas inactivas. Se evalúan por separado (no
  // if/else-if) — a pedido del usuario, para no perderse ningún incremento de
  // ninguna de las dos, aunque ambas suban el mismo mes. Ver aclaración sobre
  // el punto ciego restante en la respuesta al usuario (baja real de plazas,
  // sin pasar por inactivación, no queda marcada).
  const plazasEventos = useMemo(() => {
    const events = [];
    for (let i = 1; i < plazasChartData.length; i++) {
      const prev = plazasChartData[i - 1];
      const curr = plazasChartData[i];
      const dActivas = curr.activas - prev.activas;
      const dInactivas = curr.inactivas - prev.inactivas;
      if (dActivas > 0) {
        events.push({ index: i, type: 'creacion', dActivas, dInactivas });
      }
      if (dInactivas > 0) {
        events.push({ index: i, type: 'desactivacion', dActivas, dInactivas });
      }
    }
    return events;
  }, [plazasChartData]);

  // Botones "Solo ver creación" / "Solo ver desactivación" del header de la
  // tarjeta de Plazas: filtran qué franjas/píldoras dibuja PlazasEventsLayer,
  // sin tocar el cálculo de plazasEventos (ambos tipos se siguen detectando
  // igual, solo se oculta uno al renderizar).
  const [plazasEventFilter, setPlazasEventFilter] = useState('todos');
  const plazasEventosVisibles = useMemo(() => {
    if (plazasEventFilter === 'todos') return plazasEventos;
    return plazasEventos.filter(ev => ev.type === plazasEventFilter);
  }, [plazasEventos, plazasEventFilter]);

  const plazasEventToolbar = (
    <>
      <button
        type="button"
        onClick={() => setPlazasEventFilter('todos')}
        className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors cursor-pointer ${
          plazasEventFilter === 'todos'
            ? 'bg-[#10243e] text-white dark:bg-[#bc955c] dark:text-[#10243e]'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        }`}
      >
        Todos
      </button>
      <button
        type="button"
        onClick={() => setPlazasEventFilter(prev => (prev === 'creacion' ? 'todos' : 'creacion'))}
        className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors cursor-pointer ${
          plazasEventFilter === 'creacion'
            ? 'bg-[#2f9e5c] text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        }`}
      >
        Solo ver creación de plazas
      </button>
      <button
        type="button"
        onClick={() => setPlazasEventFilter(prev => (prev === 'desactivacion' ? 'todos' : 'desactivacion'))}
        className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-colors cursor-pointer ${
          plazasEventFilter === 'desactivacion'
            ? 'bg-[#c23b5a] text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        }`}
      >
        Solo ver desactivación de plazas
      </button>
    </>
  );

  // Whitelist de columnas del detalle de creación/desactivación de plazas —
  // ver PlazasMovimientoMesView (backend) y los 2 keys nuevos que agrega a
  // ALL_AVAILABLE_COLUMNS en EmployeesModal.jsx.
  const PLAZAS_DETALLE_COLUMN_KEYS = [
    'posicion', 'nivel', 'nombre_puesto_funcional', 'unidad_administrativa',
    'aduana', 'tipo_de_aduana', 'fecha_efectiva_mov_pos', 'fecha_de_captura', 'capturado_por',
  ];

  // Click en una franja verde/guinda: pide a MOV_POS (vía backend) el detalle
  // de qué posiciones concretas cambiaron de estado ese mes, comparando el
  // corte de fin de mes anterior contra el corte de fin de mes del evento, y
  // lo muestra en EmployeesModal (modo local — mismo patrón que
  // DetalleVacantesTablas.jsx).
  const handlePlazasEventClick = async (ev) => {
    const fechaActual = plazasChartData[ev.index]?.fecha;
    const fechaAnterior = plazasChartData[ev.index - 1]?.fecha;
    if (!fechaActual || !fechaAnterior) return;

    const tipoLabel = ev.type === 'creacion' ? 'Plazas creadas' : 'Plazas desactivadas';
    try {
      const resp = await VacantesService.getPlazasMovimientoMes({ tipo: ev.type, fechaActual, fechaAnterior });
      if (!resp.ok) throw new Error('Error al consultar el detalle');
      const data = await resp.json();
      setPlazasDetalleRows(data);
      setPlazasDetalleTitle(`${tipoLabel} · ${formatDate(fechaAnterior)} → ${formatDate(fechaActual)} (${data.length})`);
      setPlazasDetalleOpen(true);
    } catch (err) {
      alert('Hubo un error al consultar el detalle de plazas.');
    }
  };

  const plazasEventFootnote = (
    <>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="9" viewBox="0 0 12 11"><path d="M0 11 L12 11 L6 0 Z" fill="#2f7d4f" /></svg>
        Incremento de plazas activas vs. el mes anterior
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="9" viewBox="0 0 12 11"><path d="M0 0 L12 0 L6 11 Z" fill="#8c2d4a" /></svg>
        Incremento de plazas inactivas vs. el mes anterior
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-[#10243e] dark:text-[#bc955c]">▲/▼</span>
        Máximo / mínimo del año junto al punto
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-slate-400 text-white text-[9px] font-black">i</span>
        Click en una franja para ver el detalle de posiciones
      </span>
    </>
  );

  // Unique lists for the filters (based on all available data)
  const uniqueYears = useMemo(() => {
    return [...new Set(sortedDescData.map(d => getYear(d.fecha)))];
  }, [sortedDescData]);

  const uniqueQnas = useMemo(() => {
    return [...new Set(sortedDescData.map(d => formatDate(d.fecha)))];
  }, [sortedDescData]);

  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleYear = (year) => {
    let current = selectedYears.length === 0 ? uniqueYears : selectedYears.filter(x => x !== '__NONE__');
    let next;
    if (current.includes(year)) {
      next = current.filter(y => y !== year);
    } else {
      next = [...current, year];
    }
    if (next.length === uniqueYears.length) next = [];
    if (next.length === 0 && current.length > 0) next = ['__NONE__'];
    setSelectedYears(next);
  };

  const toggleDay = (qna) => {
    let current = selectedQnas.length === 0 ? uniqueQnas : selectedQnas.filter(x => x !== '__NONE__');
    let next;
    if (current.includes(qna)) {
      next = current.filter(d => d !== qna);
    } else {
      next = [...current, qna];
    }
    if (next.length === uniqueQnas.length) next = [];
    if (next.length === 0 && current.length > 0) next = ['__NONE__'];
    setSelectedQnas(next);
  };

  const toggleMonth = (year, month) => {
    const daysInMonth = qnaTree[year][month];
    let current = selectedQnas.length === 0 ? uniqueQnas : selectedQnas.filter(x => x !== '__NONE__');
    const allChecked = daysInMonth.every(d => current.includes(d));
    let next;
    if (allChecked) {
      next = current.filter(d => !daysInMonth.includes(d));
    } else {
      const toAdd = daysInMonth.filter(d => !current.includes(d));
      next = [...current, ...toAdd];
    }
    if (next.length === uniqueQnas.length) next = [];
    if (next.length === 0 && current.length > 0) next = ['__NONE__'];
    setSelectedQnas(next);
  };

  const toggleYearGroup = (year) => {
    const daysInYear = Object.values(qnaTree[year]).flat();
    let current = selectedQnas.length === 0 ? uniqueQnas : selectedQnas.filter(x => x !== '__NONE__');
    const allChecked = daysInYear.every(d => current.includes(d));
    let next;
    if (allChecked) {
      next = current.filter(d => !daysInYear.includes(d));
    } else {
      const toAdd = daysInYear.filter(d => !current.includes(d));
      next = [...current, ...toAdd];
    }
    if (next.length === uniqueQnas.length) next = [];
    if (next.length === 0 && current.length > 0) next = ['__NONE__'];
    setSelectedQnas(next);
  };

  // Botones explícitos "Marcar Todas"/"Limpiar" por nodo (año o mes) del
  // árbol de quincenas, a diferencia de los toggle* de arriba que alternan
  // según si el nodo ya está completo o no.
  const markQnaGroup = (qnas) => {
    const current = selectedQnas.length === 0 ? uniqueQnas : selectedQnas.filter(x => x !== '__NONE__');
    let next = [...new Set([...current, ...qnas])];
    if (next.length === uniqueQnas.length) next = [];
    setSelectedQnas(next);
  };

  const clearQnaGroup = (qnas) => {
    const current = selectedQnas.length === 0 ? uniqueQnas : selectedQnas.filter(x => x !== '__NONE__');
    let next = current.filter(d => !qnas.includes(d));
    if (next.length === uniqueQnas.length) next = [];
    if (next.length === 0 && current.length > 0) next = ['__NONE__'];
    setSelectedQnas(next);
  };

  const selectAllYears = () => setSelectedYears([]);
  const unselectAllYears = () => setSelectedYears(['__NONE__']);
  const selectAllQnas = () => setSelectedQnas([]);
  const unselectAllQnas = () => setSelectedQnas(['__NONE__']);

  // Aliases for the "Limpiar" buttons
  const clearYearFilter = selectAllYears;
  const clearQnaFilter = selectAllQnas;
  const clearAllFilters = () => {
    clearYearFilter();
    clearQnaFilter();
  };

  const hasActiveFilters = selectedYears.length > 0 || selectedQnas.length > 0;

  const qnaTree = useMemo(() => {
    const tree = {};
    // Iterate from newest to oldest since sortedDescData is already sorted
    sortedDescData.forEach(row => {
      const d = new Date(row.fecha + 'T12:00:00'); // avoid timezone shifts
      const y = getYear(row.fecha);
      const m = d.toLocaleDateString('es-MX', { month: 'long' });
      const capitalizedM = m.charAt(0).toUpperCase() + m.slice(1);
      const dateStr = formatDate(row.fecha);

      if (!tree[y]) tree[y] = {};
      if (!tree[y][capitalizedM]) tree[y][capitalizedM] = [];
      if (!tree[y][capitalizedM].includes(dateStr)) {
        tree[y][capitalizedM].push(dateStr);
      }
    });
    return tree;
  }, [sortedDescData]);

  // Calculate rowspans for Año using the FILTERED data
  const yearSpans = useMemo(() => {
    const spans = {};
    let currentYear = null;
    let count = 0;

    for (let i = 0; i < filteredData.length; i++) {
      const year = getYear(filteredData[i].fecha);
      if (year !== currentYear) {
        if (currentYear !== null) {
          spans[i - count] = count;
        }
        currentYear = year;
        count = 1;
      } else {
        count++;
      }
    }
    if (currentYear !== null && filteredData.length > 0) {
      spans[filteredData.length - count] = count;
    }
    return spans;
  }, [filteredData]);

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    try {
      setIsExporting(true);
      // Wait a tiny bit for UI updates if needed
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(tableRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2 // High resolution
      });

      const link = document.createElement('a');
      link.download = `cuadro_vacancia_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Hubo un error al exportar la imagen.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const { generateCuadroVacanciaExcel } = await import('@/utils/cuadroVacanciaExcel');
      await generateCuadroVacanciaExcel(cuadrosData, desgloseJerarquicoData, ocupadosJerarquicoData);
    } catch (err) {
      console.error('Error generando Excel de Cuadro de Vacancia:', err);
      alert('Error al generar Excel: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      const { default: autoTable } = await import('jspdf-autotable');

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const usableW = pageW - margin * 2;

      // ── Colores institucionales ──
      const azulMarino = [16, 36, 62];
      const dorado = [188, 149, 92];
      const guinda = [98, 31, 50];
      const grisClaro = [245, 245, 248];
      const blanco = [255, 255, 255];

      // ── Obtener última actualización ──
      let lastUpdateText = '';
      try {
        const resp = await PlantillaService.getUltimaActualizacion();
        if (resp.ok) {
          const res = await resp.json();
          if (res && res.fecha) {
            const d = new Date(res.fecha);
            const day = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const yr = d.getFullYear();
            let hrs = d.getHours();
            const mins = String(d.getMinutes()).padStart(2, '0');
            const ampm = hrs >= 12 ? 'PM' : 'AM';
            hrs = hrs % 12 || 12;
            lastUpdateText = `Última actualización: ${day}/${mo}/${yr} ${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
          }
        }
      } catch (e) { /* silenciar */ }

      // ── Helper: dibujar encabezado de página ──
      const drawPageHeader = (title) => {
        // Barra superior azul marino
        pdf.setFillColor(...azulMarino);
        pdf.rect(0, 0, pageW, 18, 'F');
        // Línea dorada
        pdf.setFillColor(...dorado);
        pdf.rect(0, 18, pageW, 1.5, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.text(title, margin, 12);

        // Fecha + última actualización
        const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(fecha, pageW - margin, 9, { align: 'right' });

        if (lastUpdateText) {
          pdf.setTextColor(...dorado);
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'italic');
          pdf.text(lastUpdateText, pageW - margin, 15, { align: 'right' });
        }
      };

      // ── Helper: pie de página ──
      const drawPageFooter = (pageNum, totalPages) => {
        pdf.setFillColor(...dorado);
        pdf.rect(0, pageH - 8, pageW, 8, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Página ${pageNum} de ${totalPages}`, pageW / 2, pageH - 3, { align: 'center' });
        pdf.text('Reporte de Cuadros de Vacancia', margin, pageH - 3);
      };

      // ── Estilo de tabla reutilizable ──
      const tableStyles = {
        headStyles: {
          fillColor: azulMarino,
          textColor: blanco,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 8,
          halign: 'center',
          cellPadding: 2.5,
          textColor: [50, 50, 50],
        },
        alternateRowStyles: {
          fillColor: grisClaro,
        },
        styles: {
          lineColor: dorado,
          lineWidth: 0.3,
        },
        tableLineColor: dorado,
        tableLineWidth: 0.3,
      };

      // ════════════════════════════════════════════════
      // PÁGINA 1: Cuadros de Vacancia
      // ════════════════════════════════════════════════
      drawPageHeader('Cuadros de Vacancia — Histórico de Ocupación');

      const cuadrosHeaders = [['Año', 'QNA', 'Ocp. Permanente', 'Ocp. Eventual', 'Total Ocupadas', 'Vac. Permanente', 'Vac. Eventual', 'Total Vacantes', 'Total Permanente', 'Total Eventual', 'Total']];
      const cuadrosBody = filteredData.map(row => [
        getYear(row.fecha),
        formatDate(row.fecha),
        formatNumber(row.ocupadas_permanente),
        formatNumber(row.ocupadas_eventual),
        formatNumber(row.ocupadas_total),
        formatNumber(row.vacantes_permanente),
        formatNumber(row.vacantes_eventual),
        formatNumber(row.vacantes_total),
        formatNumber(row.total_permanente),
        formatNumber(row.total_eventual),
        formatNumber(row.total),
      ]);

      autoTable(pdf, {
        startY: 24,
        head: cuadrosHeaders,
        body: cuadrosBody,
        ...tableStyles,
        columnStyles: {
          4: { fontStyle: 'bold', fillColor: [230, 235, 242] },
          7: { fontStyle: 'bold', fillColor: [230, 235, 242] },
          10: { fontStyle: 'bold', fillColor: [220, 225, 232] },
        },
        margin: { left: margin, right: margin },
      });

      // ════════════════════════════════════════════════
      // PÁGINAS 2+: Gráficas (una por página, grandes)
      // ════════════════════════════════════════════════
      const chartEls = pdfRef.current?.querySelectorAll('[data-pdf-chart]');
      const chartTitles = ['Ocupación Histórica', 'Vacancia Histórica', 'Plazas Totales vs Activas vs Inactivas', 'Vacantes por Nivel Jerárquico', 'Ocupación por Nivel Jerárquico', 'Vacantes por Nivel Tabular', 'Ocupación por Nivel Tabular', 'Posiciones Totales'];
      if (chartEls && chartEls.length > 0) {
        for (let i = 0; i < chartEls.length; i++) {
          pdf.addPage();
          drawPageHeader(chartTitles[i] || 'Gráfica');

          const dataUrl = await toPng(chartEls[i], { backgroundColor: '#ffffff', pixelRatio: 3 });
          const img = new Image();
          img.src = dataUrl;
          await new Promise(resolve => { img.onload = resolve; });

          const ratio = img.width / img.height;
          const startY = 24;
          const footerSpace = 12;
          const availableH = pageH - startY - footerSpace;

          // Priorizar ancho completo
          let imgW = usableW;
          let imgH = imgW / ratio;

          // Si sobrepasa la altura, ajustar
          if (imgH > availableH) {
            imgH = availableH;
            imgW = imgH * ratio;
          }

          const x = (pageW - imgW) / 2;
          const y = startY + (availableH - imgH) / 2; // centrar verticalmente
          pdf.addImage(dataUrl, 'PNG', x, y, imgW, imgH);
        }
      }


      const getPrefix = (nivel) => {
        if (!nivel) return '';
        const c = nivel.trim().charAt(0).toUpperCase();
        return c;
      };

      // ── Helper: build table rows for a prefix, sobre cualquier dataset
      // (desgloseJerarquicoData para Vacancia, ocupadosJerarquicoData para
      // Ocupación) ──
      const buildPdfRows = (sourceData, filterFn) => {
        const rows = (sourceData || []).filter(filterFn);
        const byNivel = {};
        rows.forEach(item => {
          const nivel = (item.Nivel || '').trim();
          const pos = (item['Posición'] || '').trim();
          if (!byNivel[nivel]) byNivel[nivel] = { nivel, evt: 0, nc: 0, perm: 0 };
          if (pos.startsWith('103')) byNivel[nivel].perm += 1;
          else if (pos.startsWith('2026')) byNivel[nivel].nc += 1;
          else byNivel[nivel].evt += 1;
        });
        const tableRows = Object.values(byNivel)
          .map(r => ({ ...r, total: r.evt + r.nc + r.perm }))
          .sort((a, b) => a.nivel.localeCompare(b.nivel, undefined, { numeric: true }));
        const totals = tableRows.reduce((a, r) => ({
          evt: a.evt + r.evt, nc: a.nc + r.nc, perm: a.perm + r.perm, total: a.total + r.total
        }), { evt: 0, nc: 0, perm: 0, total: 0 });
        return { tableRows, totals };
      };

      // ── Helper: renderiza una página de "shortTables" (4 columnas, Operativos/K,
      // sin Nueva Creación) — reutilizado para Vacancia y Ocupación ──
      const renderShortTablesPage = (pageTitlePrefix, tables) => {
        if (tables.length === 0) return;
        pdf.addPage();
        drawPageHeader(`${pageTitlePrefix} — ` + tables.map(t => t.label).join('  |  '));
        let startY = 24;

        tables.forEach(t => {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(...guinda);
          pdf.text(t.label, margin, startY + 5);
          startY += 8;

          const head = [['Nivel', 'Eventuales', 'Permanentes', 'Total']];
          const body = t.tableRows.map(r => [
            r.nivel,
            (r.evt + r.nc) > 0 ? formatNumber(r.evt + r.nc) : '—',
            r.perm > 0 ? formatNumber(r.perm) : '—',
            formatNumber(r.total),
          ]);
          body.push([
            'TOTAL',
            formatNumber(t.totals.evt + t.totals.nc),
            formatNumber(t.totals.perm),
            formatNumber(t.totals.total),
          ]);

          autoTable(pdf, {
            startY,
            head,
            body,
            ...tableStyles,
            columnStyles: {
              3: { fontStyle: 'bold', fillColor: [230, 235, 242] },
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
              if (data.row.index === body.length - 1 && data.section === 'body') {
                data.cell.styles.fillColor = azulMarino;
                data.cell.styles.textColor = blanco;
                data.cell.styles.fontStyle = 'bold';
              }
              if (data.section === 'body' && data.cell.raw === '—') {
                data.cell.styles.textColor = [210, 210, 215];
              }
            },
          });

          startY = pdf.lastAutoTable.finalY + 12;
        });
      };

      // ── Helper: renderiza N páginas de "detailTables" (5 columnas, incluye
      // Evt. Nueva Creación, 2 tablas por página) — reutilizado para Vacancia
      // y Ocupación ──
      const renderDetailTablesPages = (pageTitlePrefix, tables) => {
        for (let i = 0; i < tables.length; i += 2) {
          pdf.addPage();
          const tablesOnPage = tables.slice(i, i + 2);
          const pageTitle = tablesOnPage.map(t => t.label).join('  |  ');
          drawPageHeader(`${pageTitlePrefix} — ${pageTitle}`);

          let startY = 24;

          tablesOnPage.forEach((t) => {
            // Subtítulo de tabla
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(...guinda);
            pdf.text(t.label, margin, startY + 5);
            startY += 8;

            const head = [['Nivel', 'Eventuales', 'Evt. Nueva Creación', 'Permanentes', 'Total']];
            const body = t.tableRows.map(r => [
              r.nivel,
              r.evt > 0 ? formatNumber(r.evt) : '—',
              r.nc > 0 ? formatNumber(r.nc) : '—',
              r.perm > 0 ? formatNumber(r.perm) : '—',
              formatNumber(r.total),
            ]);
            // Total row
            body.push([
              'TOTAL',
              formatNumber(t.totals.evt),
              formatNumber(t.totals.nc),
              formatNumber(t.totals.perm),
              formatNumber(t.totals.total),
            ]);

            autoTable(pdf, {
              startY,
              head,
              body,
              ...tableStyles,
              columnStyles: {
                4: { fontStyle: 'bold', fillColor: [230, 235, 242] },
              },
              margin: { left: margin, right: margin },
              didParseCell: (data) => {
                // Style the total row
                if (data.row.index === body.length - 1 && data.section === 'body') {
                  data.cell.styles.fillColor = azulMarino;
                  data.cell.styles.textColor = blanco;
                  data.cell.styles.fontStyle = 'bold';
                }
                // Dashes in very light gray
                if (data.section === 'body' && data.cell.raw === '—') {
                  data.cell.styles.textColor = [210, 210, 215];
                }
              },
            });

            startY = pdf.lastAutoTable.finalY + 12;
          });
        }
      };

      // ════════════════════════════════════════════════
      // Detalle de Vacantes: Operativos + K (4 col.), luego J/A/S/D/P (5 col.)
      // ════════════════════════════════════════════════
      const shortTablesVac = [
        { label: 'Vacancia del nivel K', ...buildPdfRows(desgloseJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith('K')) },
        { label: 'Vacancia de niveles Operativos', ...buildPdfRows(desgloseJerarquicoData, item => { const nivel = (item.Nivel || '').trim(); return nivel.length > 0 && /^\d/.test(nivel); }) },
      ].filter(t => t.tableRows.length > 0);
      renderShortTablesPage('Detalle de Vacantes', shortTablesVac);

      const prefixesVac = [
        { prefix: 'J', label: 'Vacancia del nivel J' },
        { prefix: 'A', label: 'Vacancia del nivel A' },
        { prefix: 'S', label: 'Vacancia del nivel S' },
        { prefix: 'D', label: 'Vacancia del nivel D' },
        { prefix: 'P', label: 'Vacancia de enlaces P' },
      ];
      const detailTablesVac = prefixesVac
        .map(({ prefix, label }) => ({ label, ...buildPdfRows(desgloseJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith(prefix)) }))
        .filter(t => t.tableRows.length > 0);
      renderDetailTablesPages('Detalle de Vacantes', detailTablesVac);

      // ════════════════════════════════════════════════
      // Detalle de Ocupación: mismo patrón, sobre ocupadosJerarquicoData
      // ════════════════════════════════════════════════
      const shortTablesOcup = [
        { label: 'Ocupación del nivel K', ...buildPdfRows(ocupadosJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith('K')) },
        { label: 'Ocupación de niveles Operativos', ...buildPdfRows(ocupadosJerarquicoData, item => { const nivel = (item.Nivel || '').trim(); return nivel.length > 0 && /^\d/.test(nivel); }) },
      ].filter(t => t.tableRows.length > 0);
      renderShortTablesPage('Detalle de Ocupación', shortTablesOcup);

      const prefixesOcup = [
        { prefix: 'J', label: 'Ocupación del nivel J' },
        { prefix: 'A', label: 'Ocupación del nivel A' },
        { prefix: 'S', label: 'Ocupación del nivel S' },
        { prefix: 'D', label: 'Ocupación del nivel D' },
        { prefix: 'P', label: 'Ocupación de enlaces P' },
      ];
      const detailTablesOcup = prefixesOcup
        .map(({ prefix, label }) => ({ label, ...buildPdfRows(ocupadosJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith(prefix)) }))
        .filter(t => t.tableRows.length > 0);
      renderDetailTablesPages('Detalle de Ocupación', detailTablesOcup);

      // ── Calcular Observaciones Vacancia ──
      let obsBase = 0, obsOic = 0, obsTitulares = 0;
      const obsTotalSet = new Set();
      (desgloseJerarquicoData || []).forEach((item, idx) => {
        const isBase = (item['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
        const isOic = (item['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
        const isTitular = (item['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');

        if (isBase) obsBase++;
        if (isOic) obsOic++;
        if (isTitular) obsTitulares++;

        if (isBase || isOic || isTitular) {
          obsTotalSet.add(idx);
        }
      });
      const obsTotal = obsTotalSet.size;

      if (obsTotal > 0) {
        pdf.addPage();
        drawPageHeader('Detalle de Vacantes — Observaciones Vacancia');
        let startY = 24;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...guinda);
        pdf.text('Resumen de Casos Especiales y Observaciones de Vacancia', margin, startY + 5);
        startY += 8;

        const head = [['Observación', 'Total']];
        const body = [
          ['Contratación Base', formatNumber(obsBase)],
          ['Órgano Interno de Control', formatNumber(obsOic)],
          ['Titulares de Aduanas', formatNumber(obsTitulares)],
          ['TOTAL', formatNumber(obsTotal)]
        ];

        autoTable(pdf, {
          startY,
          head,
          body,
          ...tableStyles,
          columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'center', fontStyle: 'bold', fillColor: [230, 235, 242] }
          },
          margin: { left: margin, right: margin },
          didParseCell: (data) => {
            if (data.row.index === body.length - 1 && data.section === 'body') {
              data.cell.styles.fillColor = azulMarino;
              data.cell.styles.textColor = blanco;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });
      }

      // ── Agregar números de página ──
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        drawPageFooter(p, totalPages);
      }

      pdf.save(`reporte_vacancia_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateWord = async () => {
    try {
      setIsGeneratingWord(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      let lastUpdateText = '';
      try {
        const resp = await PlantillaService.getUltimaActualizacion();
        if (resp.ok) {
          const res = await resp.json();
          if (res && res.fecha) {
            const d = new Date(res.fecha);
            const day = String(d.getDate()).padStart(2, '0');
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const yr = d.getFullYear();
            let hrs = d.getHours();
            const mins = String(d.getMinutes()).padStart(2, '0');
            const ampm = hrs >= 12 ? 'PM' : 'AM';
            hrs = hrs % 12 || 12;
            lastUpdateText = `Última actualización: ${day}/${mo}/${yr} ${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
          }
        }
      } catch (e) { /* silenciar */ }

      // Esperar a que las gráficas se rendericen en tamaño de exportación
      await new Promise(resolve => setTimeout(resolve, 100));

      const chartEls = pdfRef.current?.querySelectorAll('[data-pdf-chart]');
      const chartTitles = ['Ocupación Histórica', 'Vacancia Histórica', 'Plazas Totales vs Activas vs Inactivas', 'Vacantes por Nivel Jerárquico', 'Ocupación por Nivel Jerárquico', 'Vacantes por Nivel Tabular', 'Ocupación por Nivel Tabular', 'Posiciones Totales'];
      const chartImages = [];
      if (chartEls && chartEls.length > 0) {
        for (let i = 0; i < chartEls.length; i++) {
          const dataUrl = await toPng(chartEls[i], { backgroundColor: '#ffffff', pixelRatio: 3 });
          const img = new Image();
          img.src = dataUrl;
          await new Promise(resolve => { img.onload = resolve; });
          chartImages.push({ title: chartTitles[i] || 'Gráfica', dataUrl, width: img.width, height: img.height });
        }
      }

      const { generateCuadroVacanciaWord } = await import('@/utils/cuadroVacanciaWord');
      await generateCuadroVacanciaWord({
        filteredData,
        desgloseJerarquicoData,
        ocupadosJerarquicoData,
        chartImages,
        lastUpdateText,
      });
    } catch (err) {
      console.error('Error generating Word:', err);
      alert('Hubo un error al generar el Word.');
    } finally {
      setIsGeneratingWord(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Cards de KPIs de la quincena actual */}
      {kpis && (
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 px-0 sm:px-4 lg:px-6">

            {/* KPI 1: Plazas Totales */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-t-4 border-t-[#10243e] dark:border-t-[#10243e] border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plazas Totales</p>
                  <h4 className="text-3xl font-black text-[#10243e] dark:text-[#bc955c] mt-1 tracking-tight">
                    {formatNumber(kpis.total)}
                  </h4>
                </div>
                <div className="p-3 bg-[#10243e]/10 dark:bg-[#bc955c]/10 text-[#10243e] dark:text-[#bc955c] rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="size-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Perm: {formatNumber(kpis.totalPerm)}</span>
                <span className="font-semibold">Evt: {formatNumber(kpis.totalEvt)}</span>
              </div>
            </div>

            {/* KPI 2: Plazas Ocupadas */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-t-4 border-t-emerald-500 border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plazas Ocupadas</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                      {formatNumber(kpis.ocupadas)}
                    </h4>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                      {kpis.ocupadasPct}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Users className="size-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Perm: {formatNumber(kpis.ocupadasPerm)}</span>
                <span className="font-semibold">Evt: {formatNumber(kpis.ocupadasEvt)}</span>
              </div>
            </div>

            {/* KPI 3: Plazas Vacantes */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-t-4 border-t-[#621f32] border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plazas Vacantes</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h4 className="text-3xl font-black text-[#621f32] dark:text-[#c2446a] tracking-tight">
                      {formatNumber(kpis.vacantes)}
                    </h4>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                      {kpis.vacantesPct}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-[#c2446a] rounded-xl group-hover:scale-110 transition-transform duration-300 relative">
                  <AlertCircle className="size-5" />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Perm: {formatNumber(kpis.vacantesPerm)}</span>
                <span className="font-semibold">Evt: {formatNumber(kpis.vacantesEvt)}</span>
              </div>
            </div>

            {/* KPI 4: Relación Ocupación */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-t-4 border-t-[#bc955c] border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quincena de Reporte</p>
                  <h4 className="text-xl font-black text-slate-700 dark:text-slate-200 mt-1 tracking-tight line-clamp-1">
                    {kpis.fechaActual}
                  </h4>
                </div>
                <div className="p-3 bg-[#bc955c]/10 dark:bg-[#bc955c]/15 text-[#8a6739] dark:text-[#bc955c] rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Activity className="size-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <div className="w-full bg-rose-100 dark:bg-rose-950/40 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpis.ocupadasPct}%` }} />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{kpis.ocupadasPct}% Ocupadas</span>
                  <span>{kpis.vacantesPct}% Vacantes</span>
                </div>
              </div>
            </div>

          </div>
        </Zoom>
      )}

      <div ref={pdfRef} className="space-y-6">
        <div className="w-full px-0 sm:px-4 lg:px-6" data-pdf-section>
          <Zoom triggerOnce>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#bc955c]/10 to-[#621f32]/10 blur-3xl -z-10 rounded-full mix-blend-multiply dark:mix-blend-screen" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#621f32]/10 to-[#bc955c]/10 blur-3xl -z-10 rounded-full mix-blend-multiply dark:mix-blend-screen" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-2xl shadow-lg shadow-[#10243e]/30 text-white">
                    <LayoutDashboard className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      Cuadros de Vacancia
                    </h3>
                    <div className="flex flex-col gap-2 mt-1">
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                        Histórico de ocupación de las plazas objetivo (11,432 plazas de plantilla)
                      </p>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-200/50 dark:border-amber-500/20 inline-block">
                        Este cuadro de vacancia ignora las posiciones Laudos, las posiciones 1039 y las plazas con partida presupuestal 11401 PASEM. Si desea consultar el detalle de las plazas COMPLETO consultesé{" "}
                        <button onClick={onSwitchToTablaPrincipal} className="underline font-bold hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer">
                          Tabla Principal
                        </button>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2.5">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 shadow-sm border border-slate-200/30 dark:border-slate-700/30 cursor-pointer self-start sm:self-end"
                    >
                      <FilterX className="size-3.5" />
                      <span>Borrar filtros</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-1.5 shadow-sm shadow-slate-200/40 dark:shadow-black/20">
                    <button
                      onClick={handleExportExcel}
                      disabled={isExportingExcel}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] text-white px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isExportingExcel
                        ? <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        : <Download className="size-3.5" />}
                      <span>{isExportingExcel ? 'Generando...' : 'Excel'}</span>
                    </button>

                    <button
                      onClick={handleExportImage}
                      disabled={isExporting}
                      className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Download className={`size-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                      <span>{isExporting ? 'Exportando...' : 'Imagen'}</span>
                    </button>

                    <button
                      onClick={handleGeneratePdf}
                      disabled={isGeneratingPdf}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#621f32] to-[#8c2d4a] hover:from-[#7a2740] hover:to-[#a33658] text-white px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FileText className={`size-3.5 ${isGeneratingPdf ? 'animate-pulse' : ''}`} />
                      <span>{isGeneratingPdf ? 'Generando...' : 'PDF'}</span>
                    </button>

                    <button
                      onClick={handleGenerateWord}
                      disabled={isGeneratingWord}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#2e5890] to-[#3b6ba8] hover:from-[#254a79] hover:to-[#2e5890] text-white px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FileEdit className={`size-3.5 ${isGeneratingWord ? 'animate-pulse' : ''}`} />
                      <span>{isGeneratingWord ? 'Generando...' : 'Word'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div
                // Exportar a imagen captura este nodo tal cual, con scrollbar
                // nativo incluido si queda recortado por max-h + overflow-auto.
                // Durante la exportación (ver handleExportImage) se quita el
                // recorte para que la captura sea la tabla completa, sin
                // barras de scroll quemadas en el PNG.
                className={`${isExporting ? 'overflow-visible max-h-none' : 'overflow-auto max-h-[65vh]'} pb-4 custom-scrollbar rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-lg relative bg-white dark:bg-slate-900`}
                ref={tableRef}
              >
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead ref={theadRef} className="text-white sticky top-0 z-20">
                      <tr>
                        <th colSpan={isCompactChart ? 1 : 2} className="bg-[#501929] border border-[#621f32]/35 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Periodo
                        </th>
                        <th colSpan="3" className="bg-[#501929] border border-[#621f32]/35 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Ocupadas
                        </th>
                        <th colSpan="3" className="bg-[#501929] border border-[#621f32]/35 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Vacantes
                        </th>
                        <th colSpan="3" className="bg-[#40121e] border border-[#621f32]/35 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-[#2b0d15] border-t border-[#621f32]/35">
                        {!isCompactChart && (
                          <th className="sticky left-0 z-30 w-16 sm:w-20 bg-[#2b0d15] border border-[#621f32]/35 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-[10px] uppercase tracking-wider">
                            <div className="flex items-center justify-center gap-2">
                              Año
                              <div className="relative" ref={yearFilterRef}>
                                <button
                                  ref={yearBtnRef}
                                  onClick={() => {
                                    if (!yearFilterOpen && yearBtnRef.current) {
                                      const rect = yearBtnRef.current.getBoundingClientRect();
                                      setYearDropdownPos({ top: rect.bottom + 8, left: rect.left });
                                    }
                                    setYearFilterOpen(!yearFilterOpen);
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedYears.length > 0 ? 'bg-[#bc955c] text-[#621f32] font-bold' : 'hover:bg-white/20'}`}
                                >
                                  <Filter className="size-3" />
                                </button>
                              </div>
                            </div>
                          </th>
                        )}
                        <th className="sticky left-0 sm:left-20 z-30 bg-[#2b0d15] border border-[#621f32]/35 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-[10px] uppercase tracking-wider">
                          <div className="flex items-center justify-center gap-2">
                            Qna.
                            <div className="relative" ref={qnaFilterRef}>
                              <button
                                ref={qnaBtnRef}
                                onClick={() => {
                                  if (!qnaFilterOpen && qnaBtnRef.current) {
                                    const rect = qnaBtnRef.current.getBoundingClientRect();
                                    setQnaDropdownPos({ top: rect.bottom + 8, left: rect.left });
                                  }
                                  setQnaFilterOpen(!qnaFilterOpen);
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedQnas.length > 0 ? 'bg-[#bc955c] text-[#621f32] font-bold' : 'hover:bg-white/20'}`}
                              >
                                <Filter className="size-3" />
                              </button>
                            </div>
                          </div>
                        </th>
                        {/* Ocupadas */}
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-[#40121e]/20">
                          Total
                        </th>
                        {/* Vacantes */}
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-[#40121e]/20">
                          Total
                        </th>
                        {/* Total */}
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-[#621f32]/35 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-[#40121e]/20">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 animate-fade-in">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan={isCompactChart ? 10 : 11} className="px-6 py-12 text-center text-slate-450 dark:text-slate-500 font-bold border border-slate-200 dark:border-slate-800">
                            No hay datos que coincidan con los filtros
                          </td>
                        </tr>
                      ) : (
                        (isTableExpanded ? filteredData : filteredData.slice(0, 1)).map((row, index) => {
                          const rowSpan = yearSpans[index];
                          const isNewYear = rowSpan !== undefined;
                          const isMostRecent = row.id === sortedDescData[0]?.id;

                          return (
                            <tr
                              key={row.id || index}
                              className={`transition-colors ${isMostRecent
                                ? "bg-[#bc955c]/10 dark:bg-[#bc955c]/15 hover:bg-[#bc955c]/15 dark:hover:bg-[#bc955c]/20 relative z-10"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                            >
                              {!isCompactChart && isNewYear && (
                                <td
                                  rowSpan={isTableExpanded ? rowSpan : 1}
                                  className={`sticky left-0 z-10 w-16 sm:w-20 p-0 align-top border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-slate-100 font-extrabold ${isMostRecent ? "bg-[#f5efe7] dark:bg-[#3a3737]" : "bg-white dark:bg-slate-900"
                                    }`}
                                >
                                  {/* rowSpan cubre todo el bloque del año (hasta 40+ filas
                                      con el histórico expandido); centrar el texto en esa
                                      celda lo deja fuera del área visible salvo que el
                                      usuario haga scroll justo hasta la mitad del bloque.
                                      Se ancla "sticky" debajo del thead para que el año
                                      siga visible mientras cualquiera de sus filas lo esté. */}
                                  <div
                                    className="sticky flex items-center justify-center px-2 py-2.5 sm:px-4 sm:py-3"
                                    style={{ top: theadHeight }}
                                  >
                                    {getYear(row.fecha)}
                                  </div>
                                </td>
                              )}
                              <td className={`sticky left-0 sm:left-20 z-10 px-2 py-2.5 sm:px-4 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 whitespace-nowrap font-extrabold ${isMostRecent ? 'bg-[#f5efe7] dark:bg-[#3a3737] text-[#621f32] dark:text-[#bc955c]' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'}`}>
                                <div className="flex items-center justify-center gap-2">
                                  {formatDate(row.fecha)}
                                  {isMostRecent && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-[#10243e] text-white dark:bg-[#bc955c] dark:text-[#10243e] shadow-sm animate-pulse">
                                      ACTUAL
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Ocupadas */}
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.ocupadas_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.ocupadas_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-slate-50 dark:bg-slate-800/80"
                                }`}>
                                {formatNumber(row.ocupadas_total)}
                              </td>

                              {/* Vacantes */}
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.vacantes_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.vacantes_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-slate-50 dark:bg-slate-800/80"
                                }`}>
                                {formatNumber(row.vacantes_total)}
                              </td>

                              {/* Total */}
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.total_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.total_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-900 dark:text-white font-black ${isMostRecent ? "bg-[#bc955c]/30 dark:bg-[#bc955c]/45 text-md" : "bg-slate-100 dark:bg-slate-850"
                                }`}>
                                {formatNumber(row.total)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {filteredData.length > 1 && (
                    <button
                      onClick={() => setIsTableExpanded(prev => !prev)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 min-h-11 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-[#10243e] dark:hover:text-[#bc955c] hover:bg-slate-50 dark:hover:bg-slate-800/60 border-t border-slate-200/60 dark:border-slate-800/60 transition-all duration-200 cursor-pointer group"
                    >
                      {isTableExpanded ? (
                        <>
                          <ChevronsDownUp className="size-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                          <span>Contraer histórico</span>
                        </>
                      ) : (
                        <>
                          <ChevronsUpDown className="size-3.5 group-hover:translate-y-0.5 transition-transform duration-200" />
                          <span>Ver histórico completo ({filteredData.length - 1} registros más)</span>
                        </>
                      )}
                    </button>
                  )}
              </div>
            </div>
          </Zoom>
        </div>

        <div className="w-full px-0 sm:px-4 lg:px-6 flex flex-col gap-6" data-pdf-section>
          <Zoom triggerOnce>
            <HistoricoChartCard
              title="Ocupación Histórica"
              subtitle="Permanentes / Eventuales Ocupadas por quincena"
              icon={Users}
              series={OCUPACION_SERIES}
              chartData={historicoChartData}
              ticks={historicoTicks}
              isCompactChart={isCompactChart}
              formatNumber={formatNumber}
              monthBands={historicoMonthBands}
              renderDot={renderHistoricoDot}
              hoveredPointKey={hoveredPointKey}
              onDotHover={setHoveredPointKey}
              onDotLeave={() => setHoveredPointKey(null)}
            />
          </Zoom>
          <Zoom triggerOnce delay={100}>
            <HistoricoChartCard
              title="Vacancia Histórica"
              subtitle="Permanentes / Eventuales Vacantes por quincena"
              icon={AlertCircle}
              series={VACANCIA_SERIES}
              chartData={historicoChartData}
              ticks={historicoTicks}
              isCompactChart={isCompactChart}
              formatNumber={formatNumber}
              monthBands={historicoMonthBands}
              renderDot={renderHistoricoDot}
              hoveredPointKey={hoveredPointKey}
              onDotHover={setHoveredPointKey}
              onDotLeave={() => setHoveredPointKey(null)}
            />
          </Zoom>
          <Zoom triggerOnce delay={200}>
            <HistoricoChartCard
              title="Plazas Totales vs Activas vs Inactivas"
              subtitle="Histórico completo de la ANAM · corte a fin de cada mes desde enero 2022"
              icon={TrendingUp}
              series={PLAZAS_SERIES}
              chartData={plazasChartData}
              ticks={plazasTicks}
              isCompactChart={isCompactChart}
              formatNumber={formatNumber}
              bandsLayer={<YearBandsLayer bands={plazasYearBands} chartData={plazasChartData} />}
              extraLayer={
                <>
                  <PlazasEventsLayer events={plazasEventosVisibles} chartData={plazasChartData} onEventClick={handlePlazasEventClick} />
                  <PlazasExtremeLabelsLayer
                    minMaxByYear={plazasMinMaxByYear}
                    chartData={plazasChartData}
                    series={PLAZAS_SERIES}
                    formatDateShort={formatDateShort}
                    formatNumber={formatNumber}
                  />
                </>
              }
              renderDot={renderPlazasDot}
              hoveredPointKey={hoveredPointKey}
              onDotHover={setHoveredPointKey}
              onDotLeave={() => setHoveredPointKey(null)}
              footnote={plazasEventFootnote}
              toolbar={plazasEventToolbar}
              topMargin={isCompactChart ? 66 : 84}
            />
          </Zoom>
        </div>

        <div className="w-full px-0 sm:px-4 lg:px-6" data-pdf-section data-pdf-charts>
          <Zoom triggerOnce>
            <DesgloseJerarquicoCharts data={desgloseJerarquicoData} ocupadosData={ocupadosJerarquicoData} forExport={isGeneratingPdf || isGeneratingWord} />
          </Zoom>
        </div>

        <div data-pdf-section>
          <DetalleVacantesTablas data={desgloseJerarquicoData} ocupadosData={ocupadosJerarquicoData} />
        </div>
      </div>

      {/* Portal: filtro Año */}
      {yearFilterOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={yearDropdownRef}
          style={{ position: 'fixed', top: yearDropdownPos.top, left: yearDropdownPos.left, zIndex: 9999 }}
          className="w-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-800/80 py-2 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="font-bold text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">Filtrar Año</span>
            {selectedYears.length > 0 && (
              <button onClick={clearYearFilter} className="text-[9px] text-[#621f32] dark:text-[#bc955c] font-black hover:underline uppercase tracking-wider cursor-pointer">Limpiar</button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <div className="flex gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-850">
              <button onClick={selectAllYears} className="flex-1 text-[9px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Marcar Todas</button>
              <button onClick={unselectAllYears} className="flex-1 text-[9px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Limpiar</button>
            </div>
            {uniqueYears.map(year => {
              // selectedYears === [] significa "sin filtro" (pasan todas las
              // filas, ver filteredData/toggleYear), no "ninguna seleccionada".
              // El checkbox debe reflejar ese mismo criterio — si no, se
              // dibuja vacío mientras el año en realidad cuenta como incluido,
              // y el primer clic hace lo contrario de lo que el usuario ve
              // (Qna. ya usa este mismo criterio más abajo).
              const isYearItemChecked = selectedYears.length === 0 || selectedYears.includes(year);
              return (
              <div key={year} onClick={() => toggleYear(year)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isYearItemChecked ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                  {isYearItemChecked && <Check className="size-3" />}
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{year}</span>
              </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Portal: filtro Qna */}
      {qnaFilterOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={qnaDropdownRef}
          style={{ position: 'fixed', top: qnaDropdownPos.top, left: qnaDropdownPos.left, zIndex: 9999 }}
          className="w-52 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-800/80 py-2 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
            <span className="font-bold text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">Filtrar Qna.</span>
            {selectedQnas.length > 0 && (
              <button onClick={clearQnaFilter} className="text-[9px] text-[#621f32] dark:text-[#bc955c] font-black hover:underline uppercase tracking-wider cursor-pointer">Limpiar</button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <div className="flex gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-855">
              <button onClick={selectAllQnas} className="flex-1 text-[9px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Marcar Todas</button>
              <button onClick={unselectAllQnas} className="flex-1 text-[9px] font-black uppercase py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Limpiar</button>
            </div>
            {Object.entries(qnaTree).map(([treeYear, months]) => {
              const yearDays = Object.values(months).flat();
              const isYearChecked = selectedQnas.length === 0 || yearDays.every(d => selectedQnas.includes(d));
              const isYearIndeterminate = !isYearChecked && yearDays.some(d => selectedQnas.includes(d));
              const isYearExpanded = expandedNodes[treeYear];

              return (
                <div key={treeYear} className="mb-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 sticky top-0 z-10 border-y border-slate-100 dark:border-slate-800/60 group">
                    <button onClick={() => toggleExpand(treeYear)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 cursor-pointer">
                      {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                    </button>
                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleYearGroup(treeYear)}>
                      <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isYearChecked || isYearIndeterminate ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                        {isYearChecked ? <Check className="size-3" /> : isYearIndeterminate ? <Minus className="size-3" /> : null}
                      </div>
                      <span className="font-black text-xs text-slate-700 dark:text-slate-200">{treeYear}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); markQnaGroup(yearDays); }} title="Marcar todo el año" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Todas</button>
                      <button onClick={(e) => { e.stopPropagation(); clearQnaGroup(yearDays); }} title="Limpiar todo el año" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Limpiar</button>
                    </div>
                  </div>

                  {isYearExpanded && Object.entries(months).map(([month, days]) => {
                    const monthKey = `${treeYear}-${month}`;
                    const isMonthChecked = selectedQnas.length === 0 || days.every(d => selectedQnas.includes(d));
                    const isMonthIndeterminate = !isMonthChecked && days.some(d => selectedQnas.includes(d));
                    const isMonthExpanded = expandedNodes[monthKey];

                    return (
                      <div key={monthKey} className="ml-3 border-l border-slate-150 dark:border-slate-800">
                        <div className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-855/50 group">
                          <button onClick={() => toggleExpand(monthKey)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 cursor-pointer">
                            {isMonthExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          </button>
                          <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleMonth(treeYear, month)}>
                            <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isMonthChecked || isMonthIndeterminate ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                              {isMonthChecked ? <Check className="size-3" /> : isMonthIndeterminate ? <Minus className="size-3" /> : null}
                            </div>
                            <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{month}</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); markQnaGroup(days); }} title="Marcar todo el mes" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Todas</button>
                            <button onClick={(e) => { e.stopPropagation(); clearQnaGroup(days); }} title="Limpiar todo el mes" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Limpiar</button>
                          </div>
                        </div>

                        {isMonthExpanded && days.map(qna => {
                          const isDayChecked = selectedQnas.length === 0 || selectedQnas.includes(qna);
                          return (
                            <div key={qna} onClick={() => toggleDay(qna)} className="flex items-center gap-2 pl-8 pr-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-855/50 cursor-pointer">
                              <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isDayChecked ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                                {isDayChecked && <Check className="size-3" />}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-355 leading-tight">{qna}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Detalle de creación/desactivación de plazas (click en franja) —
          EmployeesModal en modo local, mismo patrón que DetalleVacantesTablas.jsx */}
      <EmployeesModal
        open={plazasDetalleOpen}
        onOpenChange={setPlazasDetalleOpen}
        rows={plazasDetalleRows}
        title={plazasDetalleTitle}
        restrictColumnsTo={PLAZAS_DETALLE_COLUMN_KEYS}
        defaultColumnKeys={PLAZAS_DETALLE_COLUMN_KEYS}
        canViewPhoto={false}
      />
    </div>
  );
}
