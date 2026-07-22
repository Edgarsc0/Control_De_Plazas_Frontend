import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from 'recharts';
import { Layers, ChevronLeft, TrendingUp } from 'lucide-react';
import EmployeesModal from '../../shared/EmployeesModal';
import { mapVacanteRowToEmployeeRow } from '../../shared/mapVacanteRow';

// Pestañas del modal de detalle al hacer clic en un nivel dentro de una familia
// en "Ocupadas vs Vacantes por familia de nivel" (gráfica 3, segundo nivel de
// profundidad). Mismas reglas de partida presupuestal que usa el backend en
// EmpleadosPorNivelYEstatusView: Ocupadas Permanentes = estado_nomina != ' ' +
// posición 103% + partida 11301; Ocupadas Eventuales = estado_nomina != ' ' +
// partida 12201 sin posición 2026%; Ocupadas Eventuales Nueva Creación =
// estado_nomina != ' ' + partida 12201 + posición 2026%. Vacantes: mismas
// reglas de partida/posición pero con estado_nomina = ' '.
const VACANCIA_CATEGORY_TABS = [
  { key: 'ocup_permanente', label: 'Ocup. Permanentes', estatus: 'Ocupadas Permanentes' },
  { key: 'ocup_eventual', label: 'Ocup. Eventuales', estatus: 'Ocupadas Eventuales' },
  { key: 'ocup_eventual_nc', label: 'Ocup. Event. N.C.', estatus: 'Ocupadas Eventuales Nueva Creación' },
  { key: 'vac_eventual', label: 'Vac. Eventuales', estatus: 'Vacantes Eventuales' },
  { key: 'vac_permanente', label: 'Vac. Permanentes', estatus: 'Vacantes Permanentes' },
  { key: 'vac_eventual_nc', label: 'Vac. Event. N.C.', estatus: 'Vacantes Eventuales Nueva Creación' },
];

const formatNumber = (num) => {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString('en-US');
};

/* ── Paleta institucional ── */
const GRADIENT_PAIRS = [
  ['#621f32', '#8c2d4a'],
  ['#7a2740', '#a33658'],
  ['#932f50', '#b8406a'],
  ['#4a1726', '#6e2238'],
  ['#bc955c', '#d4ad74'],
  ['#a07840', '#c49a5c'],
  ['#886030', '#ab7a4a'],
  ['#10243e', '#1a3b63'],
  ['#1d3a62', '#2a5494'],
  ['#2e5890', '#4479be'],
];

// Curva "expo-out": arranque rápido y desaceleración suave y larga al final,
// sin rebote. Se ve más fluida/premium que el 'ease-out' por defecto de Recharts.
const MODERN_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/* ── Abreviaciones para el eje X de "Vacantes por Nivel Jerárquico" ── */
const NJ_ABBR = {
  '0': 'Tit. ANAM',
  '1': 'DG',
  '2': 'Dir. Central',
  '3': 'Director',
  '4': 'Subdirector',
  '5': 'Jefe Depto.',
  '6': 'Enlace',
  '7': 'Op. Cfza.',
  '8': 'Op. Bse.',
};

const FAMILY_COLORS = {
  "K's": { main: '#10243e', shades: ['#10243e', '#162d4d', '#1d3a62', '#254879', '#2e5890', '#3868a7', '#4479be', '#518bd5'] },
  "A's": { main: '#bc955c', shades: ['#8a6d3e', '#9b7b47', '#ac8a50', '#bc955c', '#c4a06b', '#ccab7a', '#d4b78a', '#dcc29a'] },
  "P's": { main: '#621f32', shades: ['#4a1726', '#5a1d2e', '#621f32', '#7a2740', '#8c2d4a', '#9e3454', '#b03c5f', '#c2446a'] },
  "Operativos": { main: '#7a2740', shades: ['#5a1d2e', '#6e2238', '#7a2740', '#8c2d4a', '#9e3454', '#b03c5f', '#c2446a', '#d44d76'] },
  "Sin Nivel": { main: '#94a3b8', shades: ['#64748b', '#718096', '#94a3b8', '#a0aec0', '#b0bec5', '#c0ccd0', '#d0d8dc', '#e0e4e8'] },
};

/* ── Desglose por tipo de plaza (Eventuales / Evt. Nueva Creación / Permanentes),
   igual clasificación que "Detalle de Vacantes" (DetalleVacantesTablas.jsx) ── */
const classifyPos = (pos) => {
  const p = (pos || '').trim();
  if (p.startsWith('103')) return 'permanente';
  if (p.startsWith('2026')) return 'nuevaCreacion';
  return 'eventual';
};

// Desglose de OCUPADAS por tipo de plaza: mismas reglas de partida que usa el
// backend en EmpleadosPorNivelYEstatusView, pero para estado_nomina != ' '.
// Permanentes = posición 103% + partida 11301; Eventuales Nueva Creación =
// posición 2026% + partida 12201; Eventuales = partida 12201 sin 2026%.
// Todo registro ocupado cae en 11301 o 12201 (verificado contra la BD), así
// que no hace falta categoría "otras".
const classifyOcupada = (item) => {
  const pos = (item['Posición'] || '').trim();
  const partida = (item['Partida'] || '').trim();
  if (pos.startsWith('103') && partida === '11301') return 'permanente';
  if (partida === '12201' && pos.startsWith('2026')) return 'nuevaCreacion';
  return 'eventual';
};

const SEGMENT_META = {
  permanente: { label: 'Vacantes Permanentes', color: '#621f32' },
  eventual: { label: 'Vacantes Eventuales', color: '#2e5890' },
  nuevaCreacion: { label: 'Vacantes Eventuales Nueva Creación', color: '#bc955c' },
};

// Colores de las Ocupadas (variantes de verde), separados de los de Vacantes
// para que las 3 divisiones se distingan a simple vista dentro de la barra.
const OCUPADA_SEGMENT_META = {
  permanente: { label: 'Ocupadas Permanentes', color: '#2f855a' },
  eventual: { label: 'Ocupadas Eventuales', color: '#57b788' },
  nuevaCreacion: { label: 'Ocupadas Eventuales Nueva Creación', color: '#9fd9bb' },
};

// P's, D's, S's, A's, J's: 3 divisiones. Operativos y K's: 2 (nueva creación
// se suma a eventuales). J's se trata igual que P/D/S/A (supuesto — no hay
// forma de confirmarlo desde el query de referencia de niveles).
const THREE_WAY_FAMILIES = new Set(["P's", "D's", "S's", "A's", "J's"]);
const TWO_WAY_FAMILIES = new Set(["Operativos", "K's"]);

// Construye los segmentos (mayor a menor) de un conteo {eventual, nuevaCreacion,
// permanente} según la familia sea de 3 o 2 divisiones. `null` si la familia
// no aplica (p.ej. "Sin Nivel"), igual que el criterio ya usado para vacantes.
const buildTypeSegments = (counts, familyName, metaMap) => {
  const isThreeWay = THREE_WAY_FAMILIES.has(familyName);
  const isTwoWay = TWO_WAY_FAMILIES.has(familyName);
  let rawSegments = null;
  if (isThreeWay) {
    rawSegments = [
      { type: 'eventual', value: counts.eventual },
      { type: 'nuevaCreacion', value: counts.nuevaCreacion },
      { type: 'permanente', value: counts.permanente },
    ];
  } else if (isTwoWay) {
    rawSegments = [
      { type: 'eventual', value: counts.eventual + counts.nuevaCreacion },
      { type: 'permanente', value: counts.permanente },
    ];
  }
  if (!rawSegments) return null;
  return [...rawSegments]
    .sort((a, b) => b.value - a.value)
    .map(s => ({ ...metaMap[s.type], type: s.type, value: s.value }));
};

// Igual que buildTypeSegments pero para Ocupadas: siempre devuelve al menos un
// segmento (fallback a un único bloque "Ocupadas" en familias sin desglose de
// 2/3 vías), para que el Cell/tooltip no tengan que distinguir el caso null.
const buildOcupadaSegments = (counts, familyName) => {
  const segments = buildTypeSegments(counts, familyName, OCUPADA_SEGMENT_META);
  if (segments) return segments;
  const total = counts.eventual + counts.nuevaCreacion + counts.permanente;
  return [{ label: 'Ocupadas', color: OCUPADAS_COLOR, type: 'total', value: total }];
};

/* ── Tooltip premium ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  // Excluye el <Line> invisible que sostiene la etiqueta de total (dataKey es
  // una función, nunca un string real de serie) para que no aparezca como
  // fila fantasma en el tooltip genérico.
  const visiblePayload = payload.filter(p => typeof p.dataKey !== 'function');
  if (!visiblePayload.length) return null;
  const total = visiblePayload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[170px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
        {label}
      </p>
      <div className="space-y-1.5">
        {visiblePayload.map((p, i) => (
          <div key={i} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${p.color || p.fill}, ${p.color || p.fill}dd)`,
                  boxShadow: `0 2px 4px ${(p.color || p.fill)}30`,
                }}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{p.name || p.dataKey}</span>
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(p.value)}</span>
          </div>
        ))}
      </div>
      {visiblePayload.length > 1 && (
        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 font-black">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Total</span>
          <span className="text-xs text-[#621f32] dark:text-[#bc955c]">{formatNumber(total)}</span>
        </div>
      )}
    </div>
  );
};

/* ── Custom bar shape con gradiente ── */
const GradientBar = (props) => {
  const { x, y, width, height, index } = props;
  const pair = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
  const id = `barGrad-${index}`;
  const radius = 8;

  if (!Number.isFinite(x) || !Number.isFinite(height) || height <= 0) return null;

  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pair[1]} stopOpacity={1} />
          <stop offset="100%" stopColor={pair[0]} stopOpacity={1} />
        </linearGradient>
      </defs>
      <rect
        x={x} y={y} width={width} height={height}
        fill={`url(#${id})`}
        rx={radius} ry={radius}
      />
      {/* Brillo superior */}
      <rect
        x={x + 2} y={y + 1} width={width - 4} height={Math.min(height * 0.35, 20)}
        fill="rgba(255,255,255,0.15)"
        rx={radius - 1} ry={radius - 1}
      />
    </g>
  );
};

/* ── Componente principal ── */
const OCUPADAS_COLOR = '#2f855a';

export default function DesgloseJerarquicoCharts({ data = [], ocupadosData = [], forExport = false }) {
  const [drillFamily, setDrillFamily] = useState(null);
  const [drillFamily3, setDrillFamily3] = useState(null);
  const [drillFamilyOcup, setDrillFamilyOcup] = useState(null);

  // Ancho del contenedor de la gráfica 1: con 9 categorías en poco espacio
  // "Subdirector" se corta/encima con su vecino, así que por debajo de un
  // ancho por barra mínimo se usa la abreviación corta "Sub".
  const chart1ContainerRef = useRef(null);
  const [chart1Width, setChart1Width] = useState(0);
  useEffect(() => {
    const el = chart1ContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setChart1Width(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chart1Data = useMemo(() => {
    if (!data || data.length === 0) return [];
    const njCounts = {};
    data.forEach(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      njCounts[nj] = (njCounts[nj] || 0) + 1;
    });
    const isNarrow = chart1Width > 0 && (chart1Width / 9) < 70;
    const abbr = { ...NJ_ABBR, '4': isNarrow ? 'Sub' : 'Subdirector' };
    return Object.keys(njCounts)
      .map(nj => ({ name: abbr[nj] || `NJ ${nj}`, nj, sortKey: parseInt(nj) || 0, Vacantes: njCounts[nj] }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [data, chart1Width]);

  // ── Gráfica "Ocupación por Nivel Jerárquico" — espejo de chart1Data pero
  // sobre ocupadosData. Barra plana (sin desglose de tipo de plaza), igual
  // que su contraparte de vacantes. Ref/ancho propios para el mismo truco de
  // abreviar "Subdirector" en espacios angostos.
  const chart1bContainerRef = useRef(null);
  const [chart1bWidth, setChart1bWidth] = useState(0);
  useEffect(() => {
    const el = chart1bContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setChart1bWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chart1bData = useMemo(() => {
    if (!ocupadosData || ocupadosData.length === 0) return [];
    const njCounts = {};
    ocupadosData.forEach(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      njCounts[nj] = (njCounts[nj] || 0) + 1;
    });
    const isNarrow = chart1bWidth > 0 && (chart1bWidth / 9) < 70;
    const abbr = { ...NJ_ABBR, '4': isNarrow ? 'Sub' : 'Subdirector' };
    return Object.keys(njCounts)
      .map(nj => ({ name: abbr[nj] || `NJ ${nj}`, nj, sortKey: parseInt(nj) || 0, Ocupadas: njCounts[nj] }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [ocupadosData, chart1bWidth]);

  const getPrefix = useCallback((nivel) => {
    if (!nivel) return "Sin Nivel";
    const c = nivel.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? `${c}'s` : "Operativos";
  }, []);

  // Conteo de posiciones ocupadas por familia, desglosado por tipo de plaza
  // (mismo criterio getPrefix que familyData), para la gráfica "Posiciones
  // Totales". classifyOcupada ya asume ocupadosData filtrado a estado_nomina
  // != ' ' (así viene desde el backend).
  const ocupadaCountsPorFamilia = useMemo(() => {
    const counts = {};
    (ocupadosData || []).forEach(item => {
      const p = getPrefix(item.Nivel);
      if (!counts[p]) counts[p] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
      counts[p][classifyOcupada(item)] += 1;
    });
    return counts;
  }, [ocupadosData, getPrefix]);

  const familyData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const counts = {};
    data.forEach(item => {
      const p = getPrefix(item.Nivel);
      if (!counts[p]) counts[p] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
      counts[p][classifyPos(item['Posición'])] += 1;
    });

    return Object.entries(counts)
      .map(([name, c]) => {
        const total = c.eventual + c.nuevaCreacion + c.permanente;
        const ocupCounts = ocupadaCountsPorFamilia[name] || { eventual: 0, nuevaCreacion: 0, permanente: 0 };
        const ocupadas = ocupCounts.eventual + ocupCounts.nuevaCreacion + ocupCounts.permanente;

        let rawSegments = null;
        if (THREE_WAY_FAMILIES.has(name)) {
          rawSegments = [
            { type: 'eventual', value: c.eventual },
            { type: 'nuevaCreacion', value: c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        } else if (TWO_WAY_FAMILIES.has(name)) {
          rawSegments = [
            { type: 'eventual', value: c.eventual + c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        }

        // Mayor cantidad hasta abajo (primero en el stack), menor hasta arriba.
        const segments = rawSegments
          ? [...rawSegments]
            .sort((a, b) => b.value - a.value)
            .map(s => ({ ...SEGMENT_META[s.type], type: s.type, value: s.value }))
          : null;

        const ocupSegments = buildOcupadaSegments(ocupCounts, name);

        const row = { name, Vacantes: total, seg0: total, seg1: 0, seg2: 0, ocupadas, total: total + ocupadas, ocupSeg0: 0, ocupSeg1: 0, ocupSeg2: 0, ocupSegments };
        ocupSegments.forEach((s, i) => { row[`ocupSeg${i}`] = s.value; });
        if (segments) {
          segments.forEach((s, i) => { row[`seg${i}`] = s.value; });
          row.segments = segments;
        }
        return row;
      })
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [data, getPrefix, ocupadaCountsPorFamilia]);

  // Proyección de familyData para la gráfica "Ocupación por Nivel Tabular"
  // (nivel familia): reutiliza ocupSeg0/1/2 y ocupSegments ya calculados ahí
  // (mismo criterio de 2/3 vías que la gráfica 3), renombrados a las keys
  // Vacantes/seg0../segments para poder reusar el mismo bloque de <Bar> que
  // la gráfica 2 sin duplicar el render.
  const ocupFamilyChartData = useMemo(() => {
    return [...familyData]
      .map(row => ({
        name: row.name,
        Vacantes: row.ocupadas,
        seg0: row.ocupSeg0,
        seg1: row.ocupSeg1,
        seg2: row.ocupSeg2,
        segments: row.ocupSegments,
      }))
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [familyData]);

  const drillData = useMemo(() => {
    if (!drillFamily || !data || data.length === 0) return [];
    const counts = {};
    data.forEach(item => {
      if (getPrefix(item.Nivel) === drillFamily) {
        const exact = (item.Nivel || "Vacío").trim();
        if (!counts[exact]) counts[exact] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
        counts[exact][classifyPos(item['Posición'])] += 1;
      }
    });

    // Mismo criterio de división por nivel que el cuadro de vacancia
    // (DetalleVacantesTablas.jsx): P's/D's/S's/A's → 3 divisiones,
    // Operativos/K's → 2 (nueva creación se suma a eventuales).
    const isThreeWay = THREE_WAY_FAMILIES.has(drillFamily);
    const isTwoWay = TWO_WAY_FAMILIES.has(drillFamily);

    return Object.entries(counts)
      .map(([name, c]) => {
        const total = c.eventual + c.nuevaCreacion + c.permanente;

        let rawSegments = null;
        if (isThreeWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual },
            { type: 'nuevaCreacion', value: c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        } else if (isTwoWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual + c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        }

        const segments = rawSegments
          ? [...rawSegments]
            .sort((a, b) => b.value - a.value)
            .map(s => ({ ...SEGMENT_META[s.type], type: s.type, value: s.value }))
          : null;

        const row = { name, Vacantes: total, seg0: total, seg1: 0, seg2: 0 };
        if (segments) {
          segments.forEach((s, i) => { row[`seg${i}`] = s.value; });
          row.segments = segments;
        }
        return row;
      })
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [data, drillFamily, getPrefix]);

  // Drill-down de "Ocupación por Nivel Tabular": calcado de drillData pero
  // sobre ocupadosData, clasificando con classifyOcupada (no classifyPos) y
  // coloreando con OCUPADA_SEGMENT_META (no SEGMENT_META).
  const drillDataOcupTabular = useMemo(() => {
    if (!drillFamilyOcup || !ocupadosData || ocupadosData.length === 0) return [];
    const counts = {};
    ocupadosData.forEach(item => {
      if (getPrefix(item.Nivel) === drillFamilyOcup) {
        const exact = (item.Nivel || "Vacío").trim();
        if (!counts[exact]) counts[exact] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
        counts[exact][classifyOcupada(item)] += 1;
      }
    });

    const isThreeWay = THREE_WAY_FAMILIES.has(drillFamilyOcup);
    const isTwoWay = TWO_WAY_FAMILIES.has(drillFamilyOcup);

    return Object.entries(counts)
      .map(([name, c]) => {
        const total = c.eventual + c.nuevaCreacion + c.permanente;

        let rawSegments = null;
        if (isThreeWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual },
            { type: 'nuevaCreacion', value: c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        } else if (isTwoWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual + c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        }

        const segments = rawSegments
          ? [...rawSegments]
            .sort((a, b) => b.value - a.value)
            .map(s => ({ ...OCUPADA_SEGMENT_META[s.type], type: s.type, value: s.value }))
          : null;

        const row = { name, Vacantes: total, seg0: total, seg1: 0, seg2: 0 };
        if (segments) {
          segments.forEach((s, i) => { row[`seg${i}`] = s.value; });
          row.segments = segments;
        }
        return row;
      })
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [ocupadosData, drillFamilyOcup, getPrefix]);

  // Ocupadas por nivel exacto (P11, P12, ...), desglosado por tipo de plaza,
  // para el drill-down de "Posiciones Totales" — mismo criterio que
  // ocupadaCountsPorFamilia pero sin agrupar por familia.
  const ocupadaCountsPorNivelExacto = useMemo(() => {
    const counts = {};
    (ocupadosData || []).forEach(item => {
      const exact = (item.Nivel || 'Vacío').trim();
      if (!counts[exact]) counts[exact] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
      counts[exact][classifyOcupada(item)] += 1;
    });
    return counts;
  }, [ocupadosData]);

  // Drill-down de "Posiciones Totales": misma familia que el usuario eligió,
  // pero desglosada por nivel exacto y con Ocupadas vs Vacantes (mismo
  // criterio de división que "Vacantes por Nivel Tabular" / DetalleVacantesTablas.jsx).
  // A diferencia de drillData, aquí también se incluyen niveles con 0 vacantes
  // (100% ocupados) tomándolos de ocupadosData, porque "Vacantes por Nivel
  // Tabular" no los muestra al no tener filas en `data`.
  const drillData3 = useMemo(() => {
    if (!drillFamily3) return [];
    const counts = {};
    const ensure = (nivel) => {
      if (!counts[nivel]) counts[nivel] = { eventual: 0, nuevaCreacion: 0, permanente: 0 };
      return counts[nivel];
    };
    (data || []).forEach(item => {
      if (getPrefix(item.Nivel) === drillFamily3) {
        const exact = (item.Nivel || 'Vacío').trim();
        ensure(exact)[classifyPos(item['Posición'])] += 1;
      }
    });
    (ocupadosData || []).forEach(item => {
      if (getPrefix(item.Nivel) === drillFamily3) {
        ensure((item.Nivel || 'Vacío').trim());
      }
    });

    const isThreeWay = THREE_WAY_FAMILIES.has(drillFamily3);
    const isTwoWay = TWO_WAY_FAMILIES.has(drillFamily3);

    return Object.entries(counts)
      .map(([name, c]) => {
        const vacantesTotal = c.eventual + c.nuevaCreacion + c.permanente;
        const ocupCounts = ocupadaCountsPorNivelExacto[name] || { eventual: 0, nuevaCreacion: 0, permanente: 0 };
        const ocupadas = ocupCounts.eventual + ocupCounts.nuevaCreacion + ocupCounts.permanente;

        let rawSegments = null;
        if (isThreeWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual },
            { type: 'nuevaCreacion', value: c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        } else if (isTwoWay) {
          rawSegments = [
            { type: 'eventual', value: c.eventual + c.nuevaCreacion },
            { type: 'permanente', value: c.permanente },
          ];
        }

        const segments = rawSegments
          ? [...rawSegments]
            .sort((a, b) => b.value - a.value)
            .map(s => ({ ...SEGMENT_META[s.type], type: s.type, value: s.value }))
          : null;

        // drillFamily3 (no `name`, que es el nivel exacto) decide si aplican
        // 3 o 2 divisiones — mismo criterio de familia que el resto del bloque.
        const ocupSegments = buildOcupadaSegments(ocupCounts, drillFamily3);

        const row = { name, Vacantes: vacantesTotal, seg0: vacantesTotal, seg1: 0, seg2: 0, ocupadas, total: vacantesTotal + ocupadas, ocupSeg0: 0, ocupSeg1: 0, ocupSeg2: 0, ocupSegments };
        ocupSegments.forEach((s, i) => { row[`ocupSeg${i}`] = s.value; });
        if (segments) {
          segments.forEach((s, i) => { row[`seg${i}`] = s.value; });
          row.segments = segments;
        }
        return row;
      })
      .sort((a, b) => b.total - a.total);
  }, [data, ocupadosData, drillFamily3, getPrefix, ocupadaCountsPorNivelExacto]);

  const totalVacantes = data ? data.length : 0;

  if (!data || data.length === 0) {
    return (
      <div className="w-full flex justify-center py-16">
        <div className="animate-pulse flex items-center gap-3 text-[#bc955c] font-semibold text-sm">
          <div className="w-5 h-5 border-2 border-[#bc955c] border-t-transparent rounded-full animate-spin" />
          Cargando desglose...
        </div>
      </div>
    );
  }

  const handleBarClick = (barData) => {
    if (barData && barData.name) setDrillFamily(barData.name);
  };

  // ── Modal de detalle ──
  // `modalDefaultCols`: las gráficas de Ocupación filtran ocupadosData, que sí
  // trae identidad de empleado (Id Empleado/Nombres/RFC/CURP) — ese caso pasa
  // esas columnas por delante; las de vacantes se quedan con el default de
  // EmployeesModal (null).
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRows, setModalRows] = useState([]);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDefaultCols, setModalDefaultCols] = useState(null);

  const OCUP_DEFAULT_COLUMN_KEYS = ['id_empleado', 'nombres', 'rfc', 'curp', 'posicion', 'nivel'];

  const handleNJBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    const njValue = barData.nj ?? barData.name.replace('NJ ', '');
    const filtered = data.filter(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      return nj === njValue;
    });
    setModalTitle(`Vacantes — NJ ${njValue}`);
    setModalRows(filtered.map(mapVacanteRowToEmployeeRow));
    setModalDefaultCols(null);
    setModalOpen(true);
  }, [data]);

  const handleDrillBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    const nivelName = barData.name;
    const filtered = data.filter(item => {
      const nivel = (item.Nivel || '').trim();
      return nivel === nivelName;
    });
    setModalTitle(`Vacantes — Nivel ${nivelName}`);
    setModalRows(filtered.map(mapVacanteRowToEmployeeRow));
    setModalDefaultCols(null);
    setModalOpen(true);
  }, [data]);

  const handleFamilyBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    // First set drill-down, then also open modal for that family
    setDrillFamily(barData.name);
  }, []);

  const chart2Data = drillFamily ? drillData : familyData;
  const palette = drillFamily ? (FAMILY_COLORS[drillFamily] || FAMILY_COLORS["Sin Nivel"]) : null;

  // ── Handlers de "Ocupación por Nivel Jerárquico" y "Ocupación por Nivel
  // Tabular" — mismo patrón que sus contrapartes de vacantes, pero filtrando
  // ocupadosData en vez de data.
  const handleNJOcupBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    const njValue = barData.nj ?? barData.name.replace('NJ ', '');
    const filtered = (ocupadosData || []).filter(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      return nj === njValue;
    });
    setModalTitle(`Ocupadas — NJ ${njValue}`);
    setModalRows(filtered.map(mapVacanteRowToEmployeeRow));
    setModalDefaultCols(OCUP_DEFAULT_COLUMN_KEYS);
    setModalOpen(true);
  }, [ocupadosData]);

  const handleFamilyOcupBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    setDrillFamilyOcup(barData.name);
  }, []);

  const handleDrillOcupBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    const nivelName = barData.name;
    const filtered = (ocupadosData || []).filter(item => (item.Nivel || '').trim() === nivelName);
    setModalTitle(`Ocupadas — Nivel ${nivelName}`);
    setModalRows(filtered.map(mapVacanteRowToEmployeeRow));
    setModalDefaultCols(OCUP_DEFAULT_COLUMN_KEYS);
    setModalOpen(true);
  }, [ocupadosData]);

  const chart2bData = drillFamilyOcup ? drillDataOcupTabular : ocupFamilyChartData;
  const paletteOcup = drillFamilyOcup ? (FAMILY_COLORS[drillFamilyOcup] || FAMILY_COLORS["Sin Nivel"]) : null;

  const handleFamily3BarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    setDrillFamily3(barData.name);
  }, []);

  // Nivel dentro de "Ocupadas vs Vacantes por familia de nivel": a diferencia
  // de handleDrillBarClick (gráfica 2, solo vacantes), aquí se abre el
  // EmployeesModal con las 4 pestañas de categoría (Ocupadas + 3 tipos de
  // vacante) para ese nivel exacto.
  const [employeesModalOpen, setEmployeesModalOpen] = useState(false);
  const [employeesModalNivel, setEmployeesModalNivel] = useState(null);

  const handleDrill3BarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    // El backend espera "SIN NIVEL" (no "Vacío", que es solo la etiqueta de UI)
    // para el grupo de posiciones sin nivel asignado.
    const nivelParam = barData.name === 'Vacío' ? 'SIN NIVEL' : barData.name;
    setEmployeesModalNivel(nivelParam);
    setEmployeesModalOpen(true);
  }, []);

  // Posiciones Totales ordena por total de posiciones (vacantes + ocupadas),
  // no solo por vacantes como familyData — la familia con más posiciones va
  // primero. Si hay drill activo, muestra el desglose por nivel exacto.
  const chart3Data = useMemo(() => {
    if (drillFamily3) return drillData3;
    return [...familyData].sort((a, b) => b.total - a.total);
  }, [familyData, drillFamily3, drillData3]);

  // Tooltip de la gráfica 2: si la barra está segmentada (Eventuales / Evt. Nueva
  // Creación / Permanentes), muestra el desglose; si no, cae al tooltip genérico.
  const Chart2Tooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    if (!row.segments) return <CustomTooltip active={active} payload={payload} label={label} />;

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[190px]">
        <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
          {label}
        </p>
        <div className="space-y-1.5">
          {row.segments.map((s, i) => (
            <div key={i} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}dd)`, boxShadow: `0 2px 4px ${s.color}30` }}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{s.label}</span>
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(s.value)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 font-black">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Total</span>
          <span className="text-xs text-[#621f32] dark:text-[#bc955c]">{formatNumber(row.Vacantes)}</span>
        </div>
      </div>
    );
  };

  // Tooltip de la gráfica 3 (Posiciones Totales): igual que Chart2Tooltip pero
  // siempre incluye el desglose de Ocupadas (Eventuales / Permanentes / Evt.
  // Nueva Creación) y el gran total (vacantes + ocupadas). ocupSegments
  // siempre viene poblado en chart3Data, así que nunca cae al tooltip genérico.
  const Chart3Tooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    if (!row.ocupSegments) return <CustomTooltip active={active} payload={payload} label={label} />;

    const vacanteRows = row.segments || (row.Vacantes ? [{ label: 'Vacantes', color: '#621f32', value: row.Vacantes }] : []);

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[190px]">
        <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
          {label}
        </p>
        <div className="space-y-1.5">
          {row.ocupSegments.map((s, i) => (
            <div key={`o-${i}`} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}dd)`, boxShadow: `0 2px 4px ${s.color}30` }}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{s.label}</span>
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(s.value)}</span>
            </div>
          ))}
          {vacanteRows.map((s, i) => (
            <div key={`v-${i}`} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}dd)`, boxShadow: `0 2px 4px ${s.color}30` }}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{s.label}</span>
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(s.value)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 font-black">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Total Plazas</span>
          <span className="text-xs text-[#621f32] dark:text-[#bc955c]">{formatNumber(row.total)}</span>
        </div>
      </div>
    );
  };

  // Etiqueta del total sobre el stack completo. NO se ancla en ningún Bar
  // individual (seg0, ocupSeg0, ...): Recharts elimina del array interno de
  // CADA Bar cualquier segmento con height === 0 (ver Bar.js
  // `computeBarRectangles`), lo que desalinea el `index` que le llega a
  // LabelList en cuanto una fila anterior tiene ese dataKey en 0 (el total
  // terminaba dibujado sobre la barra vecina) — y `payload` tampoco sirve de
  // respaldo porque se filtra en el camino (svgPropertiesAndEvents solo deja
  // pasar atributos SVG válidos). Se evita todo eso con un <Line> invisible
  // superpuesto cuyo valor es el total exacto: Recharts solo descarta puntos
  // de Line cuando el valor es null/undefined, nunca por ser 0, así que el
  // índice nunca se desalinea y no hace falta reconstruir el tope del stack.
  const renderTotalLabel = (props) => {
    const { x, y, value } = props;
    if (!value || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return (
      <text
        x={x}
        y={y - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={800}
        fill="currentColor"
        className="text-[#621f32] dark:text-[#bc955c] select-none pointer-events-none"
      >
        {formatNumber(value)}
      </text>
    );
  };

  return (
    <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
        {/* Blobs decorativos */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#bc955c]/15 to-[#621f32]/15 blur-3xl -z-10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-[#621f32]/15 to-[#bc955c]/15 blur-3xl -z-10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-[#10243e]/5 to-[#621f32]/5 blur-3xl -z-10 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-[#621f32] to-[#8c2d4a] rounded-2xl shadow-lg shadow-[#621f32]/30 text-white">
              <Layers className="size-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                Desglose de Vacantes Activas
              </h3>
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                <TrendingUp className="size-3.5" />
                {totalVacantes} vacantes · Nivel Jerárquico y Nivel Tabular
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-6 sm:gap-8 relative z-10">

          {/* ── Gráfica 1: Vacantes por Nivel Jerárquico (fila 1, col 1) ── */}
          <div ref={chart1ContainerRef} data-pdf-chart className="lg:col-start-1 lg:row-start-1 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-4 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
            <div className="mb-6">
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Vacantes por Nivel Jerárquico
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                Distribución por NJ
              </p>
            </div>
            <div className="w-full flex-1" style={{ minHeight: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart1Data}
                  margin={{ top: 34, right: 15, left: -15, bottom: 10 }}
                  barCategoryGap="20%"
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      handleNJBarClick(state.activePayload[0].payload);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.15) || 1]}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  <Bar
                    dataKey="Vacantes"
                    shape={<GradientBar />}
                    background={{ fill: 'transparent', cursor: 'pointer' }}
                    onClick={handleNJBarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={80}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  />
                  {/* Line invisible: sostiene el label de valor fuera del <Bar> para que
                      no se oculte durante su animación de entrada (ver renderTotalLabel).
                      dataKey como función (no "Vacantes") para que CustomTooltip la excluya
                      del payload visible, igual que en las gráficas 2 y 3. */}
                  <Line
                    dataKey={row => row.Vacantes}
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList dataKey={row => row.Vacantes} content={renderTotalLabel} />
                  </Line>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Guía de Niveles Jerárquicos */}
            <div className="mt-6 pt-5 border-t border-[#bc955c]/10">
              <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Guía de Niveles Jerárquicos
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: '0', name: 'Titular ANAM' },
                  { id: '1', name: 'Director General' },
                  { id: '2', name: 'Director Central' },
                  { id: '3', name: 'Director' },
                  { id: '4', name: 'Subdirector' },
                  { id: '5', name: 'Jefe de departamento' },
                  { id: '6', name: 'Enlace' },
                  { id: '7', name: 'Operativo de Confianza' },
                  { id: '8', name: 'Operativo de Base' },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNJBarClick({ name: `NJ ${item.id}` })}
                    className="flex items-center gap-2.5 text-[11px] text-slate-700 dark:text-slate-350 bg-slate-50/80 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/80 hover:bg-[#bc955c]/10 dark:hover:bg-[#bc955c]/10 hover:border-[#bc955c]/30 dark:hover:border-[#bc955c]/30 hover:scale-[1.02] active:scale-95 duration-200 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-lg bg-[#10243e] dark:bg-[#bc955c]/10 text-white dark:text-[#bc955c] text-[10px] font-extrabold flex-shrink-0 shadow-sm">
                      {item.id}
                    </span>
                    <span className="font-semibold truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Gráfica NJ-Ocupación: Ocupación por Nivel Jerárquico (fila 1, col 2) ── */}
          <div ref={chart1bContainerRef} data-pdf-chart className="lg:col-start-2 lg:row-start-1 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-4 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
            <div className="mb-6">
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Ocupación por Nivel Jerárquico
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                Distribución por NJ
              </p>
            </div>
            <div className="w-full flex-1" style={{ minHeight: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart1bData}
                  margin={{ top: 34, right: 15, left: -15, bottom: 10 }}
                  barCategoryGap="20%"
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      handleNJOcupBarClick(state.activePayload[0].payload);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.15) || 1]}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  <Bar
                    dataKey="Ocupadas"
                    shape={<GradientBar />}
                    background={{ fill: 'transparent', cursor: 'pointer' }}
                    onClick={handleNJOcupBarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={80}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  />
                  <Line
                    dataKey={row => row.Ocupadas}
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList dataKey={row => row.Ocupadas} content={renderTotalLabel} />
                  </Line>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Guía de Niveles Jerárquicos */}
            <div className="mt-6 pt-5 border-t border-[#bc955c]/10">
              <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Guía de Niveles Jerárquicos
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: '0', name: 'Titular ANAM' },
                  { id: '1', name: 'Director General' },
                  { id: '2', name: 'Director Central' },
                  { id: '3', name: 'Director' },
                  { id: '4', name: 'Subdirector' },
                  { id: '5', name: 'Jefe de departamento' },
                  { id: '6', name: 'Enlace' },
                  { id: '7', name: 'Operativo de Confianza' },
                  { id: '8', name: 'Operativo de Base' },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNJOcupBarClick({ name: `NJ ${item.id}` })}
                    className="flex items-center gap-2.5 text-[11px] text-slate-700 dark:text-slate-350 bg-slate-50/80 dark:bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/80 hover:bg-[#bc955c]/10 dark:hover:bg-[#bc955c]/10 hover:border-[#bc955c]/30 dark:hover:border-[#bc955c]/30 hover:scale-[1.02] active:scale-95 duration-200 transition-all cursor-pointer shadow-sm"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-lg bg-[#10243e] dark:bg-[#bc955c]/10 text-white dark:text-[#bc955c] text-[10px] font-extrabold flex-shrink-0 shadow-sm">
                      {item.id}
                    </span>
                    <span className="font-semibold truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Gráfica 2: Familia con Drill-Down ── */}
          <div data-pdf-chart className="lg:col-start-1 lg:row-start-2 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-4 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
            <div className="mb-6 flex items-start justify-between">
              <div>
                {drillFamily ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDrillFamily(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#621f32]/10 text-[#621f32] hover:bg-[#621f32]/20 transition-all font-semibold text-xs group"
                    >
                      <ChevronLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
                      Regresar
                    </button>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                      Niveles {drillFamily}
                    </span>
                  </div>
                ) : (
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Vacantes por Nivel Tabular
                  </h4>
                )}
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                  {drillFamily
                    ? `${drillData.length} niveles en ${drillFamily}`
                    : 'Clic en una barra para explorar'}
                </p>
              </div>
            </div>
            <div className="w-full flex-1" style={{ minHeight: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart2Data}
                  margin={{ top: 34, right: 15, left: -15, bottom: chart2Data.length > 6 ? 50 : 10 }}
                  barCategoryGap="20%"
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      if (drillFamily) {
                        handleDrillBarClick(state.activePayload[0].payload);
                      } else {
                        handleFamilyBarClick(state.activePayload[0].payload);
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={chart2Data.length > 6 ? -40 : 0}
                    textAnchor={chart2Data.length > 6 ? 'end' : 'middle'}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.15) || 1]}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<Chart2Tooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  {drillFamily ? (
                    <>
                      {/* Misma división por tipo de plaza que el nivel de familia:
                          Eventuales / Evt. Nueva Creación / Permanentes según el
                          cuadro de vacancia del nivel (fallback a color plano si
                          el nivel no tiene desglose, p.ej. "Sin Nivel"). */}
                      <Bar
                        dataKey="seg0"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={80}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.segments ? entry.segments[0].color : palette.shades[idx % palette.shades.length]}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg1"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={140}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[1] ? entry.segments[1].color : 'transparent'} />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg2"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={200}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[2] ? entry.segments[2].color : 'transparent'} />
                        ))}
                      </Bar>
                    </>
                  ) : (
                    <>
                      {/* Barra dividida por tipo de plaza. Cada categoría acomoda sus
                          propios segmentos de mayor (abajo) a menor (arriba); las
                          familias sin desglose (p.ej. "Sin Nivel") caen todas en seg0. */}
                      <Bar
                        dataKey="seg0"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={80}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.segments ? entry.segments[0].color : GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length][0]}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg1"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={140}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[1] ? entry.segments[1].color : 'transparent'} />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg2"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={200}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2Data.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[2] ? entry.segments[2].color : 'transparent'} />
                        ))}
                      </Bar>
                    </>
                  )}
                  {/* Line invisible: solo sostiene la etiqueta de total sobre el
                      tope real del stack (ver comentario de renderTotalLabel). */}
                  <Line
                    dataKey={row => row.Vacantes}
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList dataKey={row => row.Vacantes} content={renderTotalLabel} />
                  </Line>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Leyenda del desglose por tipo de plaza (nivel superficial y drill-down) */}
            {chart2Data.some(row => row.segments) && (
              <div className="mt-6 pt-5 border-t border-[#bc955c]/10 flex flex-wrap items-center gap-4">
                {Object.values(SEGMENT_META).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  (P's, D's, S's, A's: 3 divisiones · Operativos y K's: Eventuales + Permanentes)
                </span>
              </div>
            )}
          </div>

          {/* ── Gráfica Tabular-Ocupación: Ocupación por Nivel Tabular (fila 2, col 2) ── */}
          <div data-pdf-chart className="lg:col-start-2 lg:row-start-2 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-4 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
            <div className="mb-6 flex items-start justify-between">
              <div>
                {drillFamilyOcup ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDrillFamilyOcup(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#621f32]/10 text-[#621f32] hover:bg-[#621f32]/20 transition-all font-semibold text-xs group"
                    >
                      <ChevronLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
                      Regresar
                    </button>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                      Niveles {drillFamilyOcup}
                    </span>
                  </div>
                ) : (
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Ocupación por Nivel Tabular
                  </h4>
                )}
                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                  {drillFamilyOcup
                    ? `${drillDataOcupTabular.length} niveles en ${drillFamilyOcup}`
                    : 'Clic en una barra para explorar'}
                </p>
              </div>
            </div>
            <div className="w-full flex-1" style={{ minHeight: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart2bData}
                  margin={{ top: 34, right: 15, left: -15, bottom: chart2bData.length > 6 ? 50 : 10 }}
                  barCategoryGap="20%"
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      if (drillFamilyOcup) {
                        handleDrillOcupBarClick(state.activePayload[0].payload);
                      } else {
                        handleFamilyOcupBarClick(state.activePayload[0].payload);
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={chart2bData.length > 6 ? -40 : 0}
                    textAnchor={chart2bData.length > 6 ? 'end' : 'middle'}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.15) || 1]}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<Chart2Tooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  {drillFamilyOcup ? (
                    <>
                      <Bar
                        dataKey="seg0"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={80}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.segments ? entry.segments[0].color : paletteOcup.shades[idx % paletteOcup.shades.length]}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg1"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={140}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[1] ? entry.segments[1].color : 'transparent'} />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg2"
                        stackId="nivel"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleDrillOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={200}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[2] ? entry.segments[2].color : 'transparent'} />
                        ))}
                      </Bar>
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="seg0"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={80}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.segments ? entry.segments[0].color : GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length][0]}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg1"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={140}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[1] ? entry.segments[1].color : 'transparent'} />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="seg2"
                        stackId="familia"
                        background={{ fill: 'transparent', cursor: 'pointer' }}
                        onClick={handleFamilyOcupBarClick}
                        style={{ cursor: 'pointer' }}
                        isAnimationActive={!forExport}
                        animationBegin={200}
                        animationDuration={900}
                        animationEasing={MODERN_EASING}
                      >
                        {chart2bData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.segments?.[2] ? entry.segments[2].color : 'transparent'} />
                        ))}
                      </Bar>
                    </>
                  )}
                  <Line
                    dataKey={row => row.Vacantes}
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList dataKey={row => row.Vacantes} content={renderTotalLabel} />
                  </Line>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Leyenda del desglose por tipo de plaza (Ocupadas) */}
            {chart2bData.some(row => row.segments) && (
              <div className="mt-6 pt-5 border-t border-[#bc955c]/10 flex flex-wrap items-center gap-4">
                {Object.values(OCUPADA_SEGMENT_META).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  (P's, D's, S's, A's, J's: 3 divisiones · Operativos y K's: Eventuales + Permanentes)
                </span>
              </div>
            )}
          </div>

          {/* ── Gráfica 3: Posiciones Totales (fila 1-2, col 3) ── */}
          <div data-pdf-chart className="lg:col-start-3 lg:row-start-1 lg:row-span-2 bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-4 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
            <div className="mb-6">
              {drillFamily3 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDrillFamily3(null)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#621f32]/10 text-[#621f32] hover:bg-[#621f32]/20 transition-all font-semibold text-xs group"
                  >
                    <ChevronLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    Regresar
                  </button>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Niveles {drillFamily3}
                  </span>
                </div>
              ) : (
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Ocupadas vs Vacantes por familia de nivel
                </h4>
              )}
              <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                {drillFamily3
                  ? `${drillData3.length} niveles en ${drillFamily3} · Ocupadas vs Vacantes`
                  : 'Posiciones totales por familia de nivel (vacantes + ocupadas) · Clic para explorar'}
              </p>
            </div>
            <div className="w-full flex-1" style={{ minHeight: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart3Data}
                  margin={{ top: 34, right: 15, left: -15, bottom: chart3Data.length > 6 ? 50 : 10 }}
                  barCategoryGap="20%"
                  onClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      if (drillFamily3) {
                        handleDrill3BarClick(state.activePayload[0].payload);
                      } else {
                        handleFamily3BarClick(state.activePayload[0].payload);
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={chart3Data.length > 6 ? -40 : 0}
                    textAnchor={chart3Data.length > 6 ? 'end' : 'middle'}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.15) || 1]}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<Chart3Tooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  {/* Ocupadas dividida en Eventuales / Permanentes / Evt. Nueva Creación
                      (mayor cantidad hasta abajo, igual criterio que las vacantes). */}
                  <Bar
                    dataKey="ocupSeg0"
                    stackId="familia"
                    background={{ fill: 'transparent', cursor: 'pointer' }}
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={80}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.ocupSegments[0].color} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="ocupSeg1"
                    stackId="familia"
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={140}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.ocupSegments[1] ? entry.ocupSegments[1].color : 'transparent'} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="ocupSeg2"
                    stackId="familia"
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={200}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.ocupSegments[2] ? entry.ocupSegments[2].color : 'transparent'} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="seg0"
                    stackId="familia"
                    background={{ fill: 'transparent', cursor: 'pointer' }}
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={260}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.segments ? entry.segments[0].color : GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length][0]}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="seg1"
                    stackId="familia"
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={320}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.segments?.[1] ? entry.segments[1].color : 'transparent'} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="seg2"
                    stackId="familia"
                    onClick={drillFamily3 ? handleDrill3BarClick : handleFamily3BarClick}
                    style={{ cursor: 'pointer' }}
                    isAnimationActive={!forExport}
                    animationBegin={380}
                    animationDuration={900}
                    animationEasing={MODERN_EASING}
                  >
                    {chart3Data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.segments?.[2] ? entry.segments[2].color : 'transparent'} />
                    ))}
                  </Bar>
                  {/* Line invisible: solo sostiene la etiqueta de total sobre el
                      tope real del stack (ver comentario de renderTotalLabel). */}
                  <Line
                    dataKey={row => row.total}
                    stroke="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList dataKey={row => row.total} content={renderTotalLabel} />
                  </Line>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 pt-5 border-t border-[#bc955c]/10 flex flex-wrap items-center gap-4">
              {Object.values(OCUPADA_SEGMENT_META).map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
              {Object.values(SEGMENT_META).map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </div>
              ))}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                (P's, D's, S's, A's: 3 divisiones · Operativos y K's: Eventuales + Permanentes)
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de detalle (NJ y drill-down por nivel exacto de "Vacantes"/
          "Ocupación" por Nivel Jerárquico y Nivel Tabular) — modo local de
          EmployeesModal: filas ya filtradas en cliente desde `data`/
          `ocupadosData`, no vienen de un fetch nivel+estatus. */}
      <EmployeesModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rows={modalRows}
        title={modalTitle}
        defaultColumnKeys={modalDefaultCols}
      />

      {/* Modal de detalle por nivel (Ocupadas vs Vacantes por familia de nivel) */}
      <EmployeesModal
        open={employeesModalOpen}
        onOpenChange={setEmployeesModalOpen}
        nivel={employeesModalNivel}
        categoryTabs={VACANCIA_CATEGORY_TABS}
      />
    </div>
  );
}
