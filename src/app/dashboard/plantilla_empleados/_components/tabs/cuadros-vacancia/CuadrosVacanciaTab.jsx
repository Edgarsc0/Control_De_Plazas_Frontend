import { confirmarDescargaExcel } from '@/lib/excelAudit';
import { useMemo, useState, useRef, useEffect } from "react";
import { Zoom } from "@/components/shared/Reveal";
import { LayoutDashboard, Filter, Check, ChevronLeft, ChevronRight, ChevronDown, Minus, Download, FilterX, FileText, FileEdit, Users, AlertCircle, ChevronsUpDown, ChevronsDownUp, TrendingUp, Layers, CirclePlus, CircleMinus, EyeOff, Loader2, Lock } from "lucide-react";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { PlantillaService } from '@/services/plantilla.service';
import { VacantesService } from '@/services/vacantes.service';
import HistoricoLineChart from "./HistoricoLineChart";
import DesgloseJerarquicoCharts from "./DesgloseJerarquicoCharts";
import DetalleVacantesTablas from "./DetalleVacantesTablas";
import EmployeesModal from "../../shared/EmployeesModal";
import WidgetFrame from "@/app/dashboard/tablero/_components/personalizable/WidgetFrame";
import EstatusPosicionesUaWidget from "@/app/dashboard/tablero/_components/personalizable/widgets/EstatusPosicionesUaWidget";
import { ELEMENTOS_CUADROS_VACANCIA, prefijoTipoCuadrosVacancia } from "@/app/dashboard/tablero/_components/personalizable/widgets/cuadrosVacanciaElementos";
import { alturaFila, posicionEnPx, tamanoEnPx } from "@/app/dashboard/tablero/_components/personalizable/gridGeometry";

// Modo widget (`only`): sin animación de entrada ni div envolvente, para que la
// cadena de alturas (h-full) llegue intacta hasta la gráfica.
const SinAnimacion = ({ children }) => children;

// Tarjeta reutilizable de gráfica histórica (Ocupación o Vacancia). Definida
// a nivel de módulo: recibe todo por props para no depender de closures del
// padre y así mantener su identidad estable entre renders. La gráfica en sí
// (ECharts: etiquetas al final de línea, máx/mín anual, eventos) vive en
// HistoricoLineChart.jsx; aquí solo el marco, encabezado y notas.
function HistoricoChartCard({
  title, subtitle, icon: Icon, series, chartData, ticks, isCompactChart: isCompactChartProp,
  formatNumber,
  // Opcionales: solo los usa la tarjeta de Plazas Totales/Activas/Inactivas.
  // `events`/`onEventClick`: marcadores de creación/desactivación de plazas
  // (clic = detalle); `footnote` va debajo de la gráfica; `toolbar` va en el
  // header, junto al título (p.ej. botones de filtro creación/desactivación).
  events, onEventClick, footnote, toolbar,
  // `etiquetasExtremos`: deja siempre visible el texto de máx/mín de cada año (gráficas de una sola serie).
  etiquetasExtremos = false,
  // Modo widget del tablero (`only`): sin marco/sombra, encabezado y gráfica
  // más bajos para que la tarjeta quepa en un widget de pocas filas.
  compact = false,
  // Solo en `compact`: mostrar `footnote` en línea, en la esquina del
  // encabezado (si no, va en un popover ⓘ).
  footnoteInline = false,
}) {
  const cardRef = useRef(null);
  // Textos de máx/mín visibles u ocultos (botón del encabezado; solo en tarjetas con `etiquetasExtremos`).
  // En modo widget (`compact`) arranca oculto (sin textos), pero los puntos huecos de máx/mín se
  // muestran siempre: su valor sale al pasar el cursor.
  const [verExtremos, setVerExtremos] = useState(!compact);

  // Modo widget: el layout se adapta al espacio asignado al widget (no al de
  // la ventana). Se mide la propia tarjeta; con poco ancho se usan las mismas
  // fuentes/anchos reducidos que en móvil y se ocultan icono y subtítulo.
  const [dim, setDim] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!compact) return undefined;
    const el = cardRef.current;
    if (!el) return undefined;
    const medir = () => setDim((prev) => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  const angosto = compact && dim.w > 0 && dim.w < 560;
  const bajo = compact && dim.h > 0 && dim.h < 300;
  const isCompactChart = compact ? angosto : isCompactChartProp;

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

  return (
    <div ref={cardRef} data-historico-card className={compact ? "relative overflow-hidden h-full flex flex-col" : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden"}>
      <div className={`flex items-center border-b border-slate-100 dark:border-slate-800/60 ${compact ? "shrink-0 gap-2 pb-1 flex-wrap" : "gap-4 mb-6 pb-6 flex-wrap"}`}>
        {!(compact && (angosto || bajo)) && (
          <div className={`bg-gradient-to-br from-[#10243e] to-[#1a3b63] shadow-lg shadow-[#10243e]/30 text-white ${compact ? "p-1.5 rounded-lg" : "p-3.5 rounded-2xl"}`}>
            <Icon className={compact ? "size-4" : "size-6"} />
          </div>
        )}
        <div className={`flex-1 ${compact ? "min-w-[120px]" : "min-w-[160px]"}`}>
          <h3 className={`font-black text-slate-800 dark:text-white tracking-tight ${compact ? "text-sm leading-tight" : "text-2xl"}`}>
            {title}
          </h3>
          {!(compact && (angosto || bajo)) && (
            <p className={`font-medium text-slate-400 dark:text-slate-500 ${compact ? "text-[11px] leading-tight" : "text-sm"}`}>
              {subtitle}
            </p>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2 flex-wrap">{toolbar}</div>}
        {etiquetasExtremos && (
          <button
            type="button"
            onClick={() => setVerExtremos((v) => !v)}
            aria-pressed={verExtremos}
            title={verExtremos ? "Ocultar los textos de máximo y mínimo" : "Mostrar los textos de máximo y mínimo"}
            className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wide transition-colors cursor-pointer ${compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[11px]"} ${
              verExtremos
                ? 'bg-[#10243e] text-white dark:bg-[#bc955c] dark:text-[#10243e]'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <span className="inline-block size-2 rounded-full border-2 border-current bg-transparent" />
            Máx / Mín
          </button>
        )}
        {compact && (
          // Esquina derecha: leyenda de series y nota, en vez de debajo de la gráfica.
          <div className="ml-auto flex items-center gap-x-3 gap-y-0.5 flex-wrap justify-end text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {series.map((sr) => (
              <span key={sr.key} className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <span className="size-2 rounded-full shrink-0" style={{ background: sr.color }} />
                {sr.name}
              </span>
            ))}
            {footnote && footnoteInline && !angosto && (
              <span className="inline-flex flex-wrap items-center gap-x-3">{footnote}</span>
            )}
            {footnote && (!footnoteInline || angosto) && (
              <span className="relative group">
                <span tabIndex={0} className="inline-flex size-4 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-700 text-white text-[9px] font-black cursor-help">i</span>
                <span className="hidden group-hover:flex group-focus-within:flex flex-col gap-1 absolute right-0 top-full mt-1 z-30 w-64 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg text-[10px] font-bold normal-case tracking-normal">
                  {footnote}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="py-16 text-center text-slate-450 dark:text-slate-500 font-bold">
          No hay datos históricos disponibles
        </div>
      ) : (
        <div data-pdf-chart className={`w-full relative ${compact ? "flex-1 min-h-[120px]" : "h-[520px]"}`}>
          <HistoricoLineChart
            series={series}
            chartData={chartData}
            ticks={ticks}
            yDomain={yDomain}
            formatNumber={formatNumber}
            events={events}
            onEventClick={onEventClick}
            extremes
            extremeLabels={etiquetasExtremos && verExtremos}
            compact={compact}
            angosto={isCompactChart}
          />
        </div>
      )}

      {footnote && !compact && chartData.length > 0 && (
        <div className={`${compact ? "mt-1" : "mt-4"} flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400`}>
          {footnote}
        </div>
      )}
    </div>
  );
}

// Skeleton de carga: usado como fallback de <Suspense> (ver
// CuadrosVacanciaSection en ClientComponent.jsx) mientras resuelve la promesa
// de datos secundarios. La vista completa ahora es el tablero fijo de 3
// escritorios (ver CuadrosVacanciaEscritorios, al final de este archivo),
// pantalla completa sin scroll de documento — el fallback reproduce ese mismo
// alto (h-stack-nav-dvh/h-stack-dvh + pt-9) para que no haya salto al llegar
// los datos.
export function CuadrosVacanciaSkeleton() {
  return (
    <div className="w-full h-stack-nav-dvh md:h-stack-dvh md:pt-9 flex items-center justify-center">
      <Loader2 className="size-8 text-[#621f32] dark:text-[#bc955c] animate-spin" />
    </div>
  );
}

// 'tendencia' (líneas), 'barras' o 'cuadros'. `activeSectionTab`/
// `setActiveSectionTab` llegan por props (levantados a ClientComponent.jsx):
// la barra que los controla se renderiza a nivel de página, pegada debajo de
// PageTabBar, no dentro de este componente — ver ClientComponent.jsx.
export default function CuadrosVacanciaTab({ cuadrosData = [], desgloseJerarquicoData = [], ocupadosJerarquicoData = [], conteoPlazasSerieData = [], onSwitchToTablaPrincipal, activeSectionTab, setActiveSectionTab, only = null, sinRestriccionUN = true }) {
  // `only`: id de un solo elemento a renderizar (modo widget del tablero
  // personalizable: plazas | ocup_quincenal | vac_quincenal | ocup_mensual |
  // vac_mensual | cuadro_general). Sin `only`, el comportamiento es el de
  // siempre, controlado por `activeSectionTab`.
  //
  // `sinRestriccionUN=false` (rol con alcance por Unidad de Negocio): se
  // ocultan las dos piezas que salen de agregados globales sin dimensión de
  // unidad — la tabla "Cuadros de Vacancia" (`cuadro_vacancia`) y las
  // gráficas de tendencia (`sp_conteo_plazas_historico_serie`). El backend
  // les responde 403, así que `cuadrosData`/`conteoPlazasSerieData` llegan
  // vacíos: pintarlas igual mostraría ceros, que se leen como "tu unidad no
  // tiene plazas" en vez de "este dato no existe por unidad". Lo que sí está
  // recortado (desglose jerárquico y detalle de vacantes) se sigue viendo.
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
  const [isTableExpanded, setIsTableExpanded] = useState(!!only);

  const isTend = only ? false : (sinRestriccionUN && (activeSectionTab === 'tendencia' || isGeneratingPdf || isGeneratingWord));
  const showT = (id) => (only ? only === id : isTend);
  const ZoomW = only ? SinAnimacion : Zoom;
  const padX = only ? 'w-full h-full' : 'w-full px-0 sm:px-4 lg:px-6';
  const gridPair = `${padX} grid grid-cols-1 ${only ? '' : 'lg:grid-cols-2'} gap-6`;

  // Modal de detalle al hacer click en una franja verde/guinda de la gráfica
  // de Plazas: qué posiciones concretas se crearon/desactivaron ese mes.
  // Reutiliza EmployeesModal en modo local (prop `rows`, ver su doc) en vez
  // de un modal propio — mismo patrón que DetalleVacantesTablas.jsx.
  const [plazasDetalleOpen, setPlazasDetalleOpen] = useState(false);
  const [plazasDetalleRows, setPlazasDetalleRows] = useState([]);
  const [plazasDetalleTitle, setPlazasDetalleTitle] = useState('');
  const [plazasDetalleLoading, setPlazasDetalleLoading] = useState(false);

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
        ocupadas: row['Ocupadas'] || 0,
        vacantes: row['Vacantes'] || 0,
      }))
      .filter(d => d.fecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [conteoPlazasSerieData]);

  const PLAZAS_SERIES = [
    { key: 'totales', name: 'Plazas Totales', color: '#10243e' },
    { key: 'activas', name: 'Plazas Activas', color: '#2e5890' },
    { key: 'inactivas', name: 'Plazas Inactivas', color: '#621f32' },
  ];

  // Ocupación/Vacancia mensual (mismas columnas Ocupadas/Vacantes del SP
  // sp_conteo_plazas_historico_serie, ya incluidas en plazasChartData) —
  // a diferencia de OCUPACION_SERIES/VACANCIA_SERIES (quincenal, filtrable
  // por Año/Qna, con desglose Permanente/Eventual), esta es la serie
  // agregada de TODA la historia mes a mes, sin desglose (el SP no separa
  // Permanente/Eventual). Comparten chartData/bandas/ticks con PLAZAS_SERIES.
  const OCUPACION_MENSUAL_SERIES = [
    { key: 'ocupadas', name: 'Posiciones Ocupadas', color: '#10243e' },
  ];
  const VACANCIA_MENSUAL_SERIES = [
    { key: 'vacantes', name: 'Posiciones Vacantes', color: '#621f32' },
  ];

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
  // tarjeta de Plazas: filtran qué franjas de evento dibuja HistoricoLineChart,
  // sin tocar el cálculo de plazasEventos (ambos tipos se siguen detectando
  // igual, solo se oculta uno al renderizar).
  // En modo widget (`only`) parte sin franjas (lo más limpio posible); en la pestaña, con todas.
  const [plazasEventFilter, setPlazasEventFilter] = useState(only ? 'ninguno' : 'todos');
  const plazasEventosVisibles = useMemo(() => {
    if (plazasEventFilter === 'todos') return plazasEventos;
    if (plazasEventFilter === 'ninguno') return [];
    return plazasEventos.filter(ev => ev.type === plazasEventFilter);
  }, [plazasEventos, plazasEventFilter]);

  // Filtro de franjas de la gráfica de Plazas: botones de solo ícono (Lucide) con su nombre
  // como `title`/`aria-label`. Pulsar de nuevo el filtro activo vuelve a "todos".
  const plazasEventToolbar = (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800/70" role="group" aria-label="Franjas de altas e inactivaciones">
      {[
        { id: 'todos', Icon: Layers, label: 'Ver todas las franjas (altas e inactivaciones)', activo: 'bg-[#10243e] text-white dark:bg-[#bc955c] dark:text-[#10243e]', alPulsar: () => setPlazasEventFilter('todos') },
        { id: 'creacion', Icon: CirclePlus, label: 'Solo ver creación de plazas (altas)', activo: 'bg-[#2f9e5c] text-white', alPulsar: () => setPlazasEventFilter(prev => (prev === 'creacion' ? 'todos' : 'creacion')) },
        { id: 'desactivacion', Icon: CircleMinus, label: 'Solo ver desactivación de plazas (inactivaciones)', activo: 'bg-[#c23b5a] text-white', alPulsar: () => setPlazasEventFilter(prev => (prev === 'desactivacion' ? 'todos' : 'desactivacion')) },
        { id: 'ninguno', Icon: EyeOff, label: 'Ocultar las franjas de altas e inactivaciones', activo: 'bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-900', alPulsar: () => setPlazasEventFilter(prev => (prev === 'ninguno' ? 'todos' : 'ninguno')) },
      ].map(({ id, Icon, label, activo, alPulsar }) => (
        <button
          key={id}
          type="button"
          onClick={alPulsar}
          title={label}
          aria-label={label}
          aria-pressed={plazasEventFilter === id}
          className={`flex size-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
            plazasEventFilter === id
              ? activo
              : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );

  // Universo completo de columnas del detalle de creación/desactivación de
  // plazas — el registro MOV_POS entero de la posición, sin nada sacado de
  // EMPLEADOS_COMPLETOS_SIG (a pedido del usuario, 2026-08-12: esa tabla
  // tenía huecos, p.ej. `Nivel` en null para posiciones desactivadas). Ver
  // PlazasMovimientoMesView._RAW_COLUMN_MAP (backend) para el mapeo columna
  // cruda de MOV_POS -> key, y la categoría "Movimiento de Posición" en
  // ALL_AVAILABLE_COLUMNS de EmployeesModal.jsx para las ~39 columnas.
  const PLAZAS_DETALLE_COLUMN_KEYS = [
    'posicion', 'nombre_puesto_funcional', 'unidad_administrativa',
    'estado_posicion', 'motivo', 'cd_motivo', 'unidad_adva', 'cd_departamento', 'cd_puesto',
    'estado_ptal', 'fecha_establecimiento', 'maximo', 'dependencia_directa', 'dependencia_indirecta',
    'ubicacion', 'nivel_direccion', 'plan_salarial', 'grado', 'escala', 'puesto_presupuestal',
    'partida_presupuestal', 'grupo_pago', 'programa_beneficios', 'fecha_ultima_actualizacion',
    'capturado_por', 'horas_estandar_semana', 'descripcion', 'grupo_trabajo', 'codigo_organizacional',
    'grupo_codigo_salarial', 'descripcion_formal', 'puesto_compartido', 'posicion_clave', 'presupuesto',
    'fecha_efectiva_mov_pos', 'fecha_de_captura', 'fecha_vacancia_mov_pos', 'categoria_vacancia',
    'id_registro_decisivo', 'tuvo_insubsistencia', 'id_insubsistencia_detectada', 'fecha_ocupacion',
    'id_registro_des_fecha_ocupacion', 'cd_un',
  ];

  // Subset visible por default al abrir el modal — el resto queda
  // disponible vía el botón "Columnas" (ColumnsSelectorModal), mismo patrón
  // que el resto de la app.
  const PLAZAS_DETALLE_DEFAULT_COLUMN_KEYS = [
    'posicion', 'grado', 'escala', 'nombre_puesto_funcional', 'unidad_administrativa',
    'motivo', 'fecha_efectiva_mov_pos', 'fecha_de_captura', 'capturado_por',
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
    // Abre el modal de inmediato con skeleton (rowsLoading=true en
    // EmployeesModal) en vez de esperar la respuesta del backend — el
    // endpoint puede tardar varios segundos (join/orden sobre MOV_POS sin
    // índice compuesto para el patrón de acceso de este query).
    setPlazasDetalleRows([]);
    setPlazasDetalleTitle(`${tipoLabel} · ${formatDate(fechaAnterior)} → ${formatDate(fechaActual)}`);
    setPlazasDetalleLoading(true);
    setPlazasDetalleOpen(true);

    const t0 = performance.now();
    try {
      const resp = await VacantesService.getPlazasMovimientoMes({ tipo: ev.type, fechaActual, fechaAnterior });
      const elapsedMs = Math.round(performance.now() - t0);
      console.log(`[plazas_movimiento_mes] tipo=${ev.type} ${fechaAnterior}→${fechaActual}: ${elapsedMs}ms (status ${resp.status})`);
      if (!resp.ok) throw new Error('Error al consultar el detalle');
      const data = await resp.json();
      setPlazasDetalleRows(data);
      setPlazasDetalleTitle(`${tipoLabel} · ${formatDate(fechaAnterior)} → ${formatDate(fechaActual)} (${data.length})`);
    } catch (err) {
      alert('Hubo un error al consultar el detalle de plazas.');
    } finally {
      setPlazasDetalleLoading(false);
    }
  };

  const plazasEventFootnote = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-[3px] rounded-full bg-[#86efac]" />
        Alta de plazas (incremento de activas vs. el mes anterior) — clic en la línea: detalle
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-[3px] rounded-full bg-[#fda4af]" />
        Inactivación de plazas (incremento de inactivas vs. el mes anterior)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full border-2 border-[#10243e] bg-white dark:border-[#bc955c] dark:bg-slate-900" />
        Máximo / mínimo de cada año
      </span>
    </>
  );

  // Footnote de las tarjetas Ocupación/Vacancia Histórica (Mensual): solo la
  // leyenda de máximo/mínimo (sin franjas de eventos ni click, a diferencia
  // de plazasEventFootnote).
  const ocupVacMensualFootnote = (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2 rounded-full border-2 border-[#10243e] bg-white dark:border-[#bc955c] dark:bg-slate-900" />
      Máximo / mínimo de cada año
    </span>
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
    if (!(await confirmarDescargaExcel())) return;
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
    // Los 10 charts con data-pdf-chart (5 de "Tendencia Histórica" + 5 de
    // "Comparativo por Barras") se mantienen montados mientras isGeneratingPdf
    // es true sin importar el tab activo (ver sus condiciones más abajo en el
    // return), así toPng los encuentra todos sin necesidad de cambiar de tab.
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
      const chartTitles = ['Ocupación Histórica', 'Vacancia Histórica', 'Plazas Totales vs Activas vs Inactivas', 'Ocupación Histórica (Mensual)', 'Vacancia Histórica (Mensual)', 'Vacantes por Nivel Jerárquico', 'Ocupación por Nivel Jerárquico', 'Vacantes por Nivel Tabular', 'Ocupación por Nivel Tabular', 'Posiciones Totales'];
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
    // Ver comentario equivalente en handleGeneratePdf.
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
      const chartTitles = ['Ocupación Histórica', 'Vacancia Histórica', 'Plazas Totales vs Activas vs Inactivas', 'Ocupación Histórica (Mensual)', 'Vacancia Histórica (Mensual)', 'Vacantes por Nivel Jerárquico', 'Ocupación por Nivel Jerárquico', 'Vacantes por Nivel Tabular', 'Ocupación por Nivel Tabular', 'Posiciones Totales'];
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

  // Vista completa (sin `only`): tablero fijo de 3 escritorios, mismo layout
  // que TableroPersonalizable pero sin edición — ver CuadrosVacanciaEscritorios
  // más abajo en este archivo. Después de este punto no quedan más hooks: el
  // resto de la función (el `return` de abajo) sólo corre en modo widget
  // (`only` truthy, invocado por CuadrosVacanciaElementoWidget.jsx).
  if (!only) {
    return (
      <CuadrosVacanciaEscritorios
        cuadrosData={cuadrosData}
        desgloseJerarquicoData={desgloseJerarquicoData}
        ocupadosJerarquicoData={ocupadosJerarquicoData}
        conteoPlazasSerieData={conteoPlazasSerieData}
        sinRestriccionUN={sinRestriccionUN}
      />
    );
  }

  return (
    <div className={only ? "w-full h-full flex flex-col" : "w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700"}>

      <div ref={pdfRef} className={only ? "h-full" : "space-y-6"}>
        {/* La barra que controla activeSectionTab (Tendencia Histórica /
            Comparativo por Barras / Cuadros y Detalle de Vacantes) se
            renderiza en ClientComponent.jsx, pegada debajo de PageTabBar —
            aquí solo se leen sus props. Las tarjetas del tab "Tendencia
            Histórica" llevan data-pdf-chart y su orden en el DOM debe
            coincidir con chartTitles en handleGeneratePdf/handleGenerateWord,
            por eso se ocultan/muestran solo con la condición del tab (sin
            mover su posición en el árbol) y esos handlers también las
            mantienen montadas mientras exportan sin importar el tab activo. */}
        {(only ? only === 'cuadro_general' : (sinRestriccionUN && activeSectionTab === 'cuadros')) && (
        <div className={padX} data-pdf-section>
          <ZoomW triggerOnce>
            <div className={only ? "relative overflow-hidden h-full flex flex-col" : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden"}>
              {!only && (<>
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#bc955c]/10 to-[#621f32]/10 blur-3xl -z-10 rounded-full mix-blend-multiply dark:mix-blend-screen" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#621f32]/10 to-[#bc955c]/10 blur-3xl -z-10 rounded-full mix-blend-multiply dark:mix-blend-screen" />
              </>)}

              {!only && (
              <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 ${only ? "shrink-0 mb-1 pb-1" : "mb-6 pb-6"}`}>
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
                        {onSwitchToTablaPrincipal ? (
                          <button onClick={onSwitchToTablaPrincipal} className="underline font-bold hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer">
                            Tabla Principal
                          </button>
                        ) : (
                          <span className="font-bold">Tabla Principal</span>
                        )}
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
              )}

              {only && (
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar rounded-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <table className="w-full text-[14px] border-collapse">
                    <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      <tr>
                        <th rowSpan={2} className="sticky left-0 top-0 z-40 bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide">
                          Periodo
                        </th>
                        {[["Ocupadas", ""], ["Vacantes", "text-amber-700 dark:text-amber-400"], ["Total", ""]].map(([label, color], i) => (
                          <th key={label} colSpan={3} className={`px-3 py-2 text-center font-semibold text-xs uppercase tracking-wide whitespace-nowrap border-b border-slate-200 dark:border-slate-800 ${i > 0 ? "border-l border-l-slate-300 dark:border-l-slate-700" : ""} ${color}`}>
                            {label}
                          </th>
                        ))}
                      </tr>
                      <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {[0, 1, 2].flatMap((g) => ["Perm.", "Event.", "Total"].map((c, j) => (
                          <th key={`${g}|${c}`} className={`px-3 py-1.5 text-right border-b border-slate-300 dark:border-slate-700 ${j === 0 && g > 0 ? "border-l border-l-slate-300 dark:border-l-slate-700" : ""}`}>
                            {c}
                          </th>
                        )))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                            No hay datos que coincidan con los filtros
                          </td>
                        </tr>
                      ) : (
                        (isTableExpanded ? filteredData : filteredData.slice(0, 1)).map((row, index) => {
                          const isMostRecent = row.id === sortedDescData[0]?.id;
                          const celdas = [
                            [row.ocupadas_permanente, row.ocupadas_eventual, row.ocupadas_total, ""],
                            [row.vacantes_permanente, row.vacantes_eventual, row.vacantes_total, "text-amber-700 dark:text-amber-400"],
                            [row.total_permanente, row.total_eventual, row.total, ""],
                          ];
                          return (
                            <tr key={row.id || index} className={`border-b border-slate-100 dark:border-slate-800/70 transition-colors ${isMostRecent ? "bg-slate-200 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}>
                              <td className={`sticky left-0 z-10 ${isMostRecent ? "bg-slate-200 dark:bg-slate-800" : "bg-white dark:bg-slate-950"} px-3 py-2.5 text-left font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap`}>
                                {formatDate(row.fecha)}
                              </td>
                              {celdas.flatMap(([perm, ev, tot, color], g) => [
                                <td key={`${g}p`} className={`px-3 py-2.5 text-right tabular-nums font-medium ${color || "text-slate-900 dark:text-slate-100"} ${g > 0 ? "border-l border-slate-300 dark:border-slate-700" : ""}`}>{formatNumber(perm)}</td>,
                                <td key={`${g}e`} className={`px-3 py-2.5 text-right tabular-nums font-medium ${color || "text-slate-900 dark:text-slate-100"}`}>{formatNumber(ev)}</td>,
                                <td key={`${g}t`} className={`px-3 py-2.5 text-right tabular-nums font-bold ${isMostRecent ? "" : "bg-slate-50 dark:bg-slate-900/50"} ${color || "text-slate-900 dark:text-slate-100"}`}>{formatNumber(tot)}</td>,
                              ])}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {filteredData.length > 1 && (
                    <button
                      onClick={() => setIsTableExpanded(prev => !prev)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      {isTableExpanded ? <ChevronsDownUp className="size-3" /> : <ChevronsUpDown className="size-3" />}
                      <span>{isTableExpanded ? "Contraer histórico" : `Ver histórico completo (${filteredData.length - 1} más)`}</span>
                    </button>
                  )}
                </div>
              )}
              {only && (
                <p className="shrink-0 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Este cuadro de vacancia ignora las posiciones Laudos, las posiciones 1039 y las plazas con partida presupuestal 11401 PASEM.
                </p>
              )}

              {!only && (
              <div
                // Exportar a imagen captura este nodo tal cual, con scrollbar
                // nativo incluido si queda recortado por max-h + overflow-auto.
                // Durante la exportación (ver handleExportImage) se quita el
                // recorte para que la captura sea la tabla completa, sin
                // barras de scroll quemadas en el PNG.
                className={`${isExporting ? 'overflow-visible max-h-none' : only ? 'overflow-auto flex-1 min-h-0' : 'overflow-auto max-h-[65vh]'} ${only ? '' : 'pb-4'} custom-scrollbar rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-lg relative bg-white dark:bg-slate-900`}
                ref={tableRef}
              >
                  <table className="w-full text-sm sm:text-base text-left border-collapse">
                    <thead ref={theadRef} className="text-white sticky top-0 z-20">
                      <tr>
                        <th colSpan={isCompactChart ? 1 : 2} className="bg-gradient-to-br from-[#10243e] to-[#1a3b63] px-2 py-2.5 sm:px-3 sm:py-3 text-center font-black text-xs uppercase tracking-widest border-b border-white/10">
                          Periodo
                        </th>
                        <th colSpan="3" className="bg-gradient-to-br from-emerald-700 to-emerald-800 px-2 py-2.5 sm:px-3 sm:py-3 text-center font-black text-xs uppercase tracking-widest border-b border-l border-white/10">
                          Ocupadas
                        </th>
                        <th colSpan="3" className="bg-gradient-to-br from-[#621f32] to-[#7a2740] px-2 py-2.5 sm:px-3 sm:py-3 text-center font-black text-xs uppercase tracking-widest border-b border-l border-white/10">
                          Vacantes
                        </th>
                        <th colSpan="3" className="bg-gradient-to-br from-[#8a6739] to-[#bc955c] text-[#10243e] px-2 py-2.5 sm:px-3 sm:py-3 text-center font-black text-xs uppercase tracking-widest border-b border-l border-[#10243e]/15">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-[#10243e]">
                        {!isCompactChart && (
                          <th className="sticky left-0 z-30 w-16 sm:w-20 bg-[#10243e] border-b border-r border-white/10 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-xs uppercase tracking-wider">
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
                        <th className="sticky left-0 sm:left-20 z-30 bg-[#10243e] border-b border-r-2 border-white/15 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-xs uppercase tracking-wider">
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
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Permanente
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Eventual
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-black text-xs uppercase bg-white/10">
                          Total
                        </th>
                        {/* Vacantes */}
                        <th className="border-b border-l border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Permanente
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Eventual
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-black text-xs uppercase bg-white/10">
                          Total
                        </th>
                        {/* Total */}
                        <th className="border-b border-l border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Permanente
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-semibold text-xs uppercase text-white/75">
                          Eventual
                        </th>
                        <th className="border-b border-white/10 px-1.5 py-2 sm:px-3 text-center font-black text-xs uppercase bg-white/10">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 animate-fade-in">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan={isCompactChart ? 10 : 11} className="px-6 py-12 text-center text-slate-450 dark:text-slate-500 font-bold">
                            No hay datos que coincidan con los filtros
                          </td>
                        </tr>
                      ) : (
                        (isTableExpanded ? filteredData : filteredData.slice(0, 1)).map((row, index) => {
                          const rowSpan = yearSpans[index];
                          const isNewYear = rowSpan !== undefined;
                          const isMostRecent = row.id === sortedDescData[0]?.id;
                          const isEvenRow = index % 2 === 1;

                          return (
                            <tr
                              key={row.id || index}
                              className={`transition-colors ${isMostRecent
                                ? "bg-[#bc955c]/10 dark:bg-[#bc955c]/15 hover:bg-[#bc955c]/15 dark:hover:bg-[#bc955c]/20 relative z-10"
                                : isEvenRow
                                  ? "bg-slate-50/60 dark:bg-slate-800/25 hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`}
                            >
                              {!isCompactChart && isNewYear && (
                                <td
                                  rowSpan={isTableExpanded ? rowSpan : 1}
                                  className={`sticky left-0 z-10 w-16 sm:w-20 p-0 align-top border-b border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-extrabold ${isMostRecent ? "bg-[#f5efe7] dark:bg-[#3a3737]" : "bg-white dark:bg-slate-900"
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
                              <td className={`sticky left-0 sm:left-20 z-10 px-2 py-2.5 sm:px-4 sm:py-3 text-center border-b border-r-2 border-slate-200 dark:border-slate-800 whitespace-nowrap font-extrabold ${isMostRecent ? 'bg-[#f5efe7] dark:bg-[#3a3737] text-[#621f32] dark:text-[#bc955c]' : isEvenRow ? 'bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'}`}>
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
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.ocupadas_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.ocupadas_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold tabular-nums ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-emerald-50/40 dark:bg-emerald-500/[0.06]"
                                }`}>
                                {formatNumber(row.ocupadas_total)}
                              </td>

                              {/* Vacantes */}
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-l border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.vacantes_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.vacantes_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold tabular-nums ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-[#621f32]/[0.04] dark:bg-[#621f32]/10"
                                }`}>
                                {formatNumber(row.vacantes_total)}
                              </td>

                              {/* Total */}
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-l border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.total_permanente)}
                              </td>
                              <td className="px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium tabular-nums">
                                {formatNumber(row.total_eventual)}
                              </td>
                              <td className={`px-2 py-2.5 sm:px-3 sm:py-3 text-center border-b border-slate-100 dark:border-slate-800/60 text-slate-900 dark:text-white font-black tabular-nums ${isMostRecent ? "bg-[#bc955c]/30 dark:bg-[#bc955c]/45 text-md" : "bg-[#bc955c]/[0.08] dark:bg-[#bc955c]/[0.08]"
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
              )}
            </div>
          </ZoomW>
        </div>
        )}

        {showT('plazas') && (
        <div className={padX} data-pdf-section>
          <ZoomW triggerOnce>
            <HistoricoChartCard
              compact={!!only}
              title="Plazas Totales vs Activas vs Inactivas"
              subtitle="Histórico completo de la ANAM · corte a fin de cada mes desde enero 2022"
              icon={TrendingUp}
              series={PLAZAS_SERIES}
              chartData={plazasChartData}
              ticks={plazasTicks}
              isCompactChart={isCompactChart}
              formatNumber={formatNumber}
              events={plazasEventosVisibles}
              onEventClick={handlePlazasEventClick}
              footnote={plazasEventFootnote}
              toolbar={plazasEventToolbar}
            />
          </ZoomW>
        </div>
        )}

        {/* Ocupación / Vacancia Histórica — antes ocupado por los KPIs de la
            quincena actual; esa información ya vive en la última fila del
            cuadro de abajo, así que aquí arriba se prioriza la tendencia. */}
        {(showT('ocup_quincenal') || showT('vac_quincenal')) && historicoChartData.length > 0 && (
          <div className={gridPair} data-pdf-section>
            {showT('ocup_quincenal') && (
            <ZoomW triggerOnce>
              <HistoricoChartCard
              compact={!!only}
                title="Ocupación Histórica"
                subtitle="Permanentes / Eventuales Ocupadas por quincena"
                icon={Users}
                series={OCUPACION_SERIES}
                chartData={historicoChartData}
                ticks={historicoTicks}
                isCompactChart={isCompactChart}
                formatNumber={formatNumber}
              />
            </ZoomW>
            )}
            {showT('vac_quincenal') && (
            <ZoomW triggerOnce delay={100}>
              <HistoricoChartCard
              compact={!!only}
                title="Vacancia Histórica"
                subtitle="Permanentes / Eventuales Vacantes por quincena"
                icon={AlertCircle}
                series={VACANCIA_SERIES}
                chartData={historicoChartData}
                ticks={historicoTicks}
                isCompactChart={isCompactChart}
                formatNumber={formatNumber}
              />
            </ZoomW>
            )}
          </div>
        )}

        {/* Ocupación / Vacancia Histórica (Mensual) — mismo SP y mismo corte
            mensual completo (2022-hoy) que la tarjeta de Plazas de arriba,
            pero graficando Ocupadas/Vacantes en vez de Totales/Activas/Inactivas.
            A diferencia de las tarjetas "Ocupación/Vacancia Histórica" de más
            arriba (quincenal, filtrable por Año/Qna, con desglose Permanente/
            Eventual), estas son la serie agregada de toda la historia, sin
            desglose ni filtro. */}
        {(showT('ocup_mensual') || showT('vac_mensual')) && plazasChartData.length > 0 && (
          <div className={gridPair} data-pdf-section>
            {showT('ocup_mensual') && (
            <ZoomW triggerOnce>
              <HistoricoChartCard
              compact={!!only}
                title="Ocupación Histórica (Mensual)"
                subtitle="Posiciones ocupadas · corte a fin de cada mes desde enero 2022"
                icon={Users}
                series={OCUPACION_MENSUAL_SERIES}
                etiquetasExtremos
                chartData={plazasChartData}
                ticks={plazasTicks}
                isCompactChart={isCompactChart}
                formatNumber={formatNumber}
                footnote={ocupVacMensualFootnote}
                footnoteInline
              />
            </ZoomW>
            )}
            {showT('vac_mensual') && (
            <ZoomW triggerOnce delay={100}>
              <HistoricoChartCard
              compact={!!only}
                title="Vacancia Histórica (Mensual)"
                subtitle="Posiciones vacantes · corte a fin de cada mes desde enero 2022"
                icon={AlertCircle}
                series={VACANCIA_MENSUAL_SERIES}
                etiquetasExtremos
                chartData={plazasChartData}
                ticks={plazasTicks}
                isCompactChart={isCompactChart}
                formatNumber={formatNumber}
                footnote={ocupVacMensualFootnote}
                footnoteInline
              />
            </ZoomW>
            )}
          </div>
        )}

        {/* Comparativo por Barras — Desglose de Vacantes Activas (gráficas de
            barras por Nivel Jerárquico/Tabular + Posiciones Totales). Sus 5
            nodos data-pdf-chart también se mantienen montados mientras se
            exporta PDF/Word aunque el tab activo sea otro, para que
            querySelectorAll('[data-pdf-chart]') siga encontrando los 10 (5
            de aquí + 5 del tab "Tendencia Histórica") en el orden que espera
            chartTitles en handleGeneratePdf/handleGenerateWord. */}
        {!only && (activeSectionTab === 'barras' || isGeneratingPdf || isGeneratingWord) && (
          <div className="w-full px-0 sm:px-4 lg:px-6" data-pdf-section data-pdf-charts>
            <ZoomW triggerOnce>
              <DesgloseJerarquicoCharts data={desgloseJerarquicoData} ocupadosData={ocupadosJerarquicoData} forExport={isGeneratingPdf || isGeneratingWord} />
            </ZoomW>
          </div>
        )}

        {!only && activeSectionTab === 'cuadros' && (
        <div data-pdf-section>
          <DetalleVacantesTablas data={desgloseJerarquicoData} ocupadosData={ocupadosJerarquicoData} />
        </div>
        )}
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
        rowsLoading={plazasDetalleLoading}
        title={plazasDetalleTitle}
        restrictColumnsTo={PLAZAS_DETALLE_COLUMN_KEYS}
        defaultColumnKeys={PLAZAS_DETALLE_DEFAULT_COLUMN_KEYS}
        canViewPhoto={false}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Vista completa de "Cuadros de Vacancia": tablero FIJO de 3 escritorios,
// mismo layout/geometría que TableroPersonalizable (dashboard/tablero) pero
// sin edición — no hay arrastre, redimensión, catálogo, importar/exportar ni
// agregar/eliminar escritorio. El layout (qué widget va en cada escritorio y
// en qué celda) está fijo en ESCRITORIOS_FIJOS, calcado de un tablero
// personalizable exportado (tablero-2026-10-06.json) a pedido del usuario.
//
// Reutiliza los MISMOS componentes que ya renderiza
// CuadrosVacanciaElementoWidget.jsx (el widget `cv_<id>` del tablero
// personalizable): para los elementos "tab" (plazas, ocup/vac mensual,
// cuadro_general) se vuelve a invocar este mismo componente con `only`; para
// "desglose"/"detalle" se usan DesgloseJerarquicoCharts/DetalleVacantesTablas,
// ya importados arriba. `estatus_posiciones_ua` es el único widget que no es
// `cv_*`: mismo componente que en el tablero personalizable.
// ════════════════════════════════════════════════════════════════════════

const ESCRITORIOS_FIJOS = [
  {
    nombre: "Cuadros de Vacancia",
    widgets: [
      { type: "cv_nivel_P", x: 0, y: 0, w: 4, h: 4 },
      { type: "cv_nivel_S", x: 4, y: 0, w: 4, h: 4 },
      { type: "cv_nivel_K", x: 8, y: 0, w: 4, h: 4 },
      { type: "cv_nivel_D", x: 0, y: 4, w: 4, h: 4 },
      { type: "cv_nivel_A", x: 4, y: 4, w: 4, h: 4 },
      { type: "cv_nivel_OPERATIVOS", x: 8, y: 4, w: 4, h: 4 },
    ],
  },
  {
    nombre: "Ocupación/Vacancia Histórica",
    widgets: [
      { type: "cv_ocup_mensual", x: 0, y: 0, w: 5, h: 4 },
      { type: "cv_vac_mensual", x: 0, y: 4, w: 5, h: 4 },
      { type: "cv_plazas", x: 5, y: 0, w: 7, h: 4 },
      { type: "cv_cuadro_general", x: 5, y: 4, w: 7, h: 4 },
    ],
  },
  {
    nombre: "Gráficas de barras",
    widgets: [
      { type: "cv_vac_nj", x: 0, y: 0, w: 3, h: 4 },
      { type: "cv_ocup_nj", x: 3, y: 0, w: 3, h: 4 },
      { type: "cv_familia", x: 6, y: 0, w: 6, h: 4 },
      { type: "cv_vac_tabular", x: 0, y: 4, w: 3, h: 4 },
      { type: "cv_ocup_tabular", x: 3, y: 4, w: 3, h: 4 },
      { type: "estatus_posiciones_ua", x: 6, y: 4, w: 6, h: 4 },
    ],
  },
];

// Resuelve un `type` del layout fijo contra ELEMENTOS_CUADROS_VACANCIA (para
// los `cv_<id>`) o el caso especial `estatus_posiciones_ua`. `bloqueablePorUN`
// espeja `alcanceUnSoportado` de WIDGET_REGISTRY (dashboard/tablero): los
// elementos que salen de `cuadro_vacancia`/`sp_conteo_plazas_historico_serie`
// (agregados globales sin columna de unidad) no tienen nada que mostrarle a
// un rol con alcance por Unidad de Negocio — el backend además les responde
// 403, así que `cuadrosData`/`conteoPlazasSerieData` llegan vacíos.
function infoWidgetFijoCV(type) {
  if (type === "estatus_posiciones_ua") {
    return { label: "Estatus de posiciones por unidad administrativa", bloqueablePorUN: false };
  }
  const elId = type.startsWith(prefijoTipoCuadrosVacancia) ? type.slice(prefijoTipoCuadrosVacancia.length) : null;
  const el = elId ? ELEMENTOS_CUADROS_VACANCIA.find((e) => e.id === elId) : null;
  if (!el) return { label: type, bloqueablePorUN: false };
  return {
    label: el.label,
    elId: el.id,
    origen: el.origen,
    bloqueablePorUN: el.needs.some((n) => n === "cuadros" || n === "serie"),
  };
}

function ContenidoWidgetFijoCV({ type, info, datos }) {
  if (type === "estatus_posiciones_ua") return <EstatusPosicionesUaWidget />;
  if (!info.elId) return null;
  if (info.bloqueablePorUN && !datos.sinRestriccionUN) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
        <Lock className="size-5 text-slate-400" />
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Sin datos para tu unidad</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[16rem]">
          Esta gráfica sale de totales globales sin desglose por unidad administrativa.
        </p>
      </div>
    );
  }
  if (info.origen === "tab") {
    return <CuadrosVacanciaTab only={info.elId} cuadrosData={datos.cuadrosData} conteoPlazasSerieData={datos.conteoPlazasSerieData} />;
  }
  if (info.origen === "desglose") {
    return <DesgloseJerarquicoCharts only={info.elId} data={datos.desgloseJerarquicoData} ocupadosData={datos.ocupadosJerarquicoData} />;
  }
  return <DetalleVacantesTablas only={info.elId} data={datos.desgloseJerarquicoData} ocupadosData={datos.ocupadosJerarquicoData} />;
}

// Marco + contenido de un widget, mismo criterio de overflow que
// CuadrosVacanciaElementoWidget.jsx (el widget equivalente dentro del
// tablero personalizable): las gráficas ("tab"/"nivel_*") recortan su propio
// alto; las tablas largas (desglose/detalle sin "nivel_") llevan scroll.
function WidgetFijoCV({ type, datos }) {
  const info = infoWidgetFijoCV(type);
  const compacto = info.origen === "tab" || (info.elId || "").startsWith("nivel_");
  return (
    <WidgetFrame label={info.label} editable={false}>
      <div className={`w-full h-full p-2 ${compacto ? "overflow-hidden" : "overflow-auto custom-scrollbar"}`}>
        <ContenidoWidgetFijoCV type={type} info={info} datos={datos} />
      </div>
    </WidgetFrame>
  );
}

const CV_DESKTOP_QUERY = "(min-width: 768px)";
function useEsEscritorioCV() {
  const [esEscritorio, setEsEscritorio] = useState(null); // null = aún no se sabe (evita salto SSR)
  useEffect(() => {
    const mql = window.matchMedia(CV_DESKTOP_QUERY);
    setEsEscritorio(mql.matches);
    const handler = (e) => setEsEscritorio(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return esEscritorio;
}

/** Ancho/alto interiores del viewport de escritorios, reactivos (sin barras de scroll). */
function useTamanoViewportCV() {
  const ref = useRef(null);
  const [tamano, setTamano] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setTamano((prev) => (
      prev.width === el.clientWidth && prev.height === el.clientHeight
        ? prev
        : { width: el.clientWidth, height: el.clientHeight }
    ));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);
  return [ref, tamano];
}

/**
 * Tablero fijo de "Cuadros de Vacancia": mismo layout por escritorios que
 * TableroPersonalizable.jsx/PersonalizableGrid.jsx (navegación horizontal,
 * cuadrícula de 12 columnas, sin scroll vertical), pero de solo lectura — no
 * hay arrastre, redimensión, catálogo, renombrar ni agregar/eliminar
 * escritorio. La barra inferior solo navega entre los 3 escritorios fijos,
 * con su nombre bien visible al centro.
 *
 * Vista de pantalla completa (igual que MapaTab.jsx): ocupa el alto
 * disponible bajo PageTabBar (`h-stack-dvh md:pt-9` / `h-stack-nav-dvh` en
 * móvil), sin scroll de documento — ver ClientComponent.jsx
 * (isCuadrosVacanciaSubtab tratado igual que `activeTab === "mapa"`).
 */
function CuadrosVacanciaEscritorios({ cuadrosData, desgloseJerarquicoData, ocupadosJerarquicoData, conteoPlazasSerieData, sinRestriccionUN }) {
  const datos = { cuadrosData, desgloseJerarquicoData, ocupadosJerarquicoData, conteoPlazasSerieData, sinRestriccionUN };
  const esEscritorio = useEsEscritorioCV();

  if (esEscritorio === null) {
    return (
      <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex items-center justify-center">
        <Loader2 className="size-8 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  // Móvil: lista apilada de solo lectura, agrupada por escritorio — mismo
  // criterio que TableroPersonalizable.jsx (arrastrar/redimensionar en una
  // pantalla táctil chica no es confiable), con el nombre del escritorio como
  // encabezado de grupo para no perder la referencia al no poder navegar por
  // la barra inferior.
  if (!esEscritorio) {
    return (
      <div className="w-full h-stack-nav-dvh overflow-y-auto custom-scrollbar p-3 flex flex-col gap-5">
        {ESCRITORIOS_FIJOS.map((esc, i) => (
          <div key={i} className="flex flex-col gap-3">
            <h3 className="px-1 text-sm font-black uppercase tracking-wider text-[#621f32] dark:text-[#bc955c]">
              {esc.nombre}
            </h3>
            {esc.widgets.map((w, j) => (
              <div key={j} className="h-[70dvh] shrink-0">
                <WidgetFijoCV type={w.type} datos={datos} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Componente propio (no una rama más de CuadrosVacanciaEscritorios): el
  // hook de medición (useTamanoViewportCV) engancha su ResizeObserver en un
  // useEffect de montaje (`[]`), así que necesita montarse YA con el div a
  // medir en su propio árbol. Si viviera aquí mismo, su primer montaje real
  // ocurre en la rama "esEscritorio === null" (el spinner, sin ese div) y el
  // efecto nunca vuelve a correr al cambiar de rama — el tablero quedaba con
  // ancho/alto en 0 para siempre (bug verificado con playwright-cli: las
  // secciones medían bien por `h-full`/el fallback `"100%"` del ancho, pero
  // sin un solo widget hijo porque `listo` seguía en `false`). Mismo patrón
  // que TableroPersonalizable.jsx/PersonalizableGrid.jsx, que por eso nunca
  // lo sufrió: el grid vive en su propio componente desde el principio.
  return <CuadrosVacanciaEscritoriosDesktop datos={datos} />;
}

function CuadrosVacanciaEscritoriosDesktop({ datos }) {
  const [viewportRef, { width: anchoEscritorio, height: altoEscritorio }] = useTamanoViewportCV();
  const [escritorioActivo, setEscritorioActivo] = useState(0);
  const total = ESCRITORIOS_FIJOS.length;
  const rowHeight = alturaFila(altoEscritorio);
  const listo = anchoEscritorio > 0 && altoEscritorio > 0;

  const irA = (indice) => {
    const destino = Math.max(0, Math.min(indice, total - 1));
    const cont = viewportRef.current;
    if (cont && anchoEscritorio) cont.scrollTo({ left: destino * anchoEscritorio, behavior: "smooth" });
    setEscritorioActivo(destino);
  };

  const nombreDe = (i) => ESCRITORIOS_FIJOS[i]?.nombre || `Escritorio ${i + 1}`;

  return (
    <div className="w-full h-stack-dvh pt-9 flex flex-col overflow-hidden">
      <div className="relative flex-1 min-h-0">
        <div
          ref={viewportRef}
          onScroll={(e) => {
            if (!anchoEscritorio) return;
            setEscritorioActivo(Math.round(e.currentTarget.scrollLeft / anchoEscritorio));
          }}
          className="escritorios-scroll h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        >
          {ESCRITORIOS_FIJOS.map((esc, indice) => (
            <section
              key={indice}
              className="relative shrink-0 h-full snap-start overflow-hidden"
              style={{ width: anchoEscritorio || "100%" }}
            >
              {listo && esc.widgets.map((w, j) => {
                const pos = posicionEnPx(anchoEscritorio, rowHeight, w.x, w.y);
                const size = tamanoEnPx(anchoEscritorio, rowHeight, w.w, w.h);
                return (
                  <div key={j} className="absolute" style={{ ...pos, ...size }}>
                    <WidgetFijoCV type={w.type} datos={datos} />
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      {/* Barra inferior: solo navegación entre escritorios (sin editar,
          exportar/importar ni agregar/eliminar) — el nombre del escritorio
          activo es el elemento más notorio, al centro. */}
      <div className="shrink-0 flex items-center justify-center gap-3 py-2.5 border-t border-slate-200/70 dark:border-slate-800/70">
        <button
          type="button"
          onClick={() => irA(escritorioActivo - 1)}
          disabled={escritorioActivo === 0}
          title="Escritorio anterior"
          aria-label="Escritorio anterior"
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-5" />
        </button>

        <span className="px-3 py-1 text-base sm:text-lg font-black tracking-tight text-[#10243e] dark:text-white">
          {nombreDe(escritorioActivo)}
        </span>

        <div className="flex items-center gap-1.5">
          {ESCRITORIOS_FIJOS.map((esc, indice) => (
            <button
              key={indice}
              type="button"
              onClick={() => irA(indice)}
              title={esc.nombre}
              aria-label={esc.nombre}
              aria-current={indice === escritorioActivo}
              className={`h-2 rounded-full transition-all cursor-pointer ${indice === escritorioActivo
                ? "w-7 bg-[#621f32] dark:bg-[#bc955c]"
                : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => irA(escritorioActivo + 1)}
          disabled={escritorioActivo >= total - 1}
          title="Escritorio siguiente"
          aria-label="Escritorio siguiente"
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
