import { useMemo, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from 'recharts';
import { Layers, ChevronLeft, TrendingUp } from 'lucide-react';
import DetalleVacantesModal from './DetalleVacantesModal';

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

const FAMILY_COLORS = {
  "K's":        { main: '#10243e', shades: ['#10243e','#162d4d','#1d3a62','#254879','#2e5890','#3868a7','#4479be','#518bd5'] },
  "A's":        { main: '#bc955c', shades: ['#8a6d3e','#9b7b47','#ac8a50','#bc955c','#c4a06b','#ccab7a','#d4b78a','#dcc29a'] },
  "P's":        { main: '#621f32', shades: ['#4a1726','#5a1d2e','#621f32','#7a2740','#8c2d4a','#9e3454','#b03c5f','#c2446a'] },
  "Operativos":  { main: '#7a2740', shades: ['#5a1d2e','#6e2238','#7a2740','#8c2d4a','#9e3454','#b03c5f','#c2446a','#d44d76'] },
  "Sin Nivel":  { main: '#94a3b8', shades: ['#64748b','#718096','#94a3b8','#a0aec0','#b0bec5','#c0ccd0','#d0d8dc','#e0e4e8'] },
};

/* ── Tooltip premium ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[170px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
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
      {payload.length > 1 && (
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

  if (height <= 0) return null;

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

/* ── Custom bar shape para drill-down ── */
const DrillBar = ({ x, y, width, height, fill }) => {
  const radius = 8;
  if (height <= 0) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={radius} ry={radius} />
      <rect
        x={x + 2} y={y + 1} width={width - 4} height={Math.min(height * 0.35, 20)}
        fill="rgba(255,255,255,0.18)" rx={radius - 1} ry={radius - 1}
      />
    </g>
  );
};

/* ── Componente principal ── */
export default function DesgloseJerarquicoCharts({ data = [] }) {
  const [drillFamily, setDrillFamily] = useState(null);

  const chart1Data = useMemo(() => {
    if (!data || data.length === 0) return [];
    const njCounts = {};
    data.forEach(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      njCounts[nj] = (njCounts[nj] || 0) + 1;
    });
    return Object.keys(njCounts)
      .map(nj => ({ name: `NJ ${nj}`, sortKey: parseInt(nj) || 0, Vacantes: njCounts[nj] }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [data]);

  const getPrefix = useCallback((nivel) => {
    if (!nivel) return "Sin Nivel";
    const c = nivel.trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? `${c}'s` : "Operativos";
  }, []);

  const familyData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const counts = {};
    data.forEach(item => { const p = getPrefix(item.Nivel); counts[p] = (counts[p] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, Vacantes: count }))
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [data, getPrefix]);

  const drillData = useMemo(() => {
    if (!drillFamily || !data || data.length === 0) return [];
    const counts = {};
    data.forEach(item => {
      if (getPrefix(item.Nivel) === drillFamily) {
        const exact = (item.Nivel || "Vacío").trim();
        counts[exact] = (counts[exact] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, Vacantes: count }))
      .sort((a, b) => b.Vacantes - a.Vacantes);
  }, [data, drillFamily, getPrefix]);

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRows, setModalRows] = useState([]);
  const [modalTitle, setModalTitle] = useState('');

  const handleNJBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    const njValue = barData.name.replace('NJ ', '');
    const filtered = data.filter(item => {
      const raw = (item.NJ ?? '').toString().trim();
      const nj = raw === '' ? 'Sin NJ' : raw;
      return nj === njValue;
    });
    setModalTitle(`Vacantes — NJ ${njValue}`);
    setModalRows(filtered);
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
    setModalRows(filtered);
    setModalOpen(true);
  }, [data]);

  const handleFamilyBarClick = useCallback((barData) => {
    if (!barData || !barData.name) return;
    // First set drill-down, then also open modal for that family
    setDrillFamily(barData.name);
  }, []);

  const chart2Data = drillFamily ? drillData : familyData;
  const palette = drillFamily ? (FAMILY_COLORS[drillFamily] || FAMILY_COLORS["Sin Nivel"]) : null;

  return (
    <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">

          {/* ── Gráfica 1: NJ ── */}
          <div data-pdf-chart className="bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
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
                  margin={{ top: 20, right: 15, left: -15, bottom: 10 }} 
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
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  <Bar
                    dataKey="Vacantes"
                    shape={<GradientBar />}
                    background={{ fill: 'transparent', cursor: 'pointer' }}
                    onClick={handleNJBarClick}
                    style={{ cursor: 'pointer' }}
                    animationBegin={200}
                    animationDuration={1400}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="Vacantes"
                      position="top"
                      fill="currentColor"
                      className="text-[#621f32] dark:text-[#bc955c]"
                      style={{ fontSize: '11px', fontWeight: 800 }}
                      offset={10}
                    />
                  </Bar>
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

          {/* ── Gráfica 2: Familia con Drill-Down ── */}
          <div data-pdf-chart className="bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-800/40 backdrop-blur-md border border-[#bc955c]/20 rounded-2xl p-7 shadow-sm hover:shadow-xl hover:shadow-[#621f32]/5 transition-all duration-500 flex flex-col">
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
                  margin={{ top: 20, right: 15, left: -15, bottom: chart2Data.length > 6 ? 50 : 10 }}
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
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(98,31,50,0.04)' }} />
                  {drillFamily ? (
                    <Bar
                      dataKey="Vacantes"
                      shape={<DrillBar />}
                      background={{ fill: 'transparent', cursor: 'pointer' }}
                      onClick={handleDrillBarClick}
                      style={{ cursor: 'pointer' }}
                      animationBegin={100}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      <LabelList
                        dataKey="Vacantes"
                        position="top"
                        fill="currentColor"
                        className="text-[#621f32] dark:text-[#bc955c]"
                        style={{ fontSize: '11px', fontWeight: 800 }}
                        offset={10}
                      />
                      {chart2Data.map((entry, idx) => (
                        <Cell key={idx} fill={palette.shades[idx % palette.shades.length]} />
                      ))}
                    </Bar>
                  ) : (
                    <Bar
                      dataKey="Vacantes"
                      shape={<GradientBar />}
                      background={{ fill: 'transparent', cursor: 'pointer' }}
                      onClick={handleFamilyBarClick}
                      style={{ cursor: 'pointer' }}
                      animationBegin={200}
                      animationDuration={1400}
                      animationEasing="ease-out"
                    >
                      <LabelList
                        dataKey="Vacantes"
                        position="top"
                        fill="currentColor"
                        className="text-[#621f32] dark:text-[#bc955c]"
                        style={{ fontSize: '11px', fontWeight: 800 }}
                        offset={10}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de detalle */}
      <DetalleVacantesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rows={modalRows}
        title={modalTitle}
      />
    </div>
  );
}
