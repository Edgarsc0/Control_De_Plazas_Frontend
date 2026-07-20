import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Zoom } from "react-awesome-reveal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, useXAxisScale, usePlotArea } from "recharts";
import { LayoutDashboard, Filter, Check, ChevronRight, ChevronDown, Minus, Download, FilterX, FileText, FileEdit, Users, Briefcase, AlertCircle, Percent, Activity, ChevronsUpDown, ChevronsDownUp, TrendingUp } from "lucide-react";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { PlantillaService } from '@/services/plantilla.service';
import DesgloseJerarquicoCharts from "./DesgloseJerarquicoCharts";
import DetalleVacantesTablas from "./DetalleVacantesTablas";

export default function CuadrosVacanciaTab({ cuadrosData = [], desgloseJerarquicoData = [], ocupadosJerarquicoData = [], onSwitchToTablaPrincipal }) {
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

  // ReferenceArea con x1===x2 (mes de un solo registro) renderiza ancho 0 en
  // el eje categórico (point scale, sin bandwidth), así que las franjas se
  // dibujan a mano con el scale real del eje X (hooks de recharts v3) para
  // poder darle un ancho mínimo visible a esos meses de un solo punto.
  const MonthBandsLayer = () => {
    const scale = useXAxisScale();
    const plotArea = usePlotArea();
    if (!scale || !plotArea || historicoMonthBands.length === 0) return null;

    const step = historicoChartData.length > 1
      ? Math.abs(scale(historicoChartData[1].label) - scale(historicoChartData[0].label))
      : plotArea.width;
    const minWidth = Math.max(6, step * 0.4);
    const halfStep = step / 2;

    return (
      <g>
        {historicoMonthBands.map((b, i) => {
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
  };

  const HISTORICO_SERIES = [
    { key: 'ocupadas_permanente', name: 'Permanentes Ocupadas', color: '#10243e' },
    { key: 'ocupadas_eventual', name: 'Eventuales Ocupadas', color: '#bc955c' },
    { key: 'vacantes_permanente', name: 'Vacantes Permanentes', color: '#621f32' },
    { key: 'vacantes_eventual', name: 'Vacantes Eventuales', color: '#2e5890' },
  ];

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
    ocupadas_permanente: { max: -16, min: 24 },
    ocupadas_eventual: { max: -31, min: 39 },
    vacantes_permanente: { max: -16, min: 24 },
    vacantes_eventual: { max: -31, min: 39 },
  };

  const renderHistoricoDot = (key, color) => (dotProps) => {
    const { cx, cy, index, value } = dotProps;
    const minMax = historicoMinMax[key];
    const isMax = minMax?.max && index === minMax.max.index;
    const isMin = minMax?.min && index === minMax.min.index && minMax.min.index !== minMax.max.index;

    if (!isMax && !isMin) {
      return <circle key={`dot-${key}-${index}`} cx={cx} cy={cy} r={3.5} fill={color} strokeWidth={0} />;
    }

    const lane = HISTORICO_LABEL_LANE[key];
    // Cerca del borde izquierdo/derecho el texto centrado se recorta contra el
    // área del gráfico: se ancla hacia adentro en vez de centrarlo sobre el punto.
    const isFirstPoint = index === 0;
    const isLastPoint = index === historicoChartData.length - 1;
    const textAnchor = isFirstPoint ? "start" : isLastPoint ? "end" : "middle";
    const textX = isFirstPoint ? cx + 6 : isLastPoint ? cx - 6 : cx;

    return (
      <g key={`dot-${key}-${index}`}>
        {/* Halo estático (sin animación: la gráfica se exporta a PNG/PDF y una
            animación CSS quedaría congelada a medio ciclo en la captura). */}
        <circle cx={cx} cy={cy} r={11} fill={color} fillOpacity={0.16} />
        <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2.5} />
        <text
          x={textX}
          y={cy + (isMax ? lane.max : lane.min)}
          textAnchor={textAnchor}
          fontSize={11}
          fontWeight={900}
          fill={color}
          stroke="#fff"
          strokeWidth={3.5}
          paintOrder="stroke"
          className="select-none"
        >
          {isMax ? '▲ ' : '▼ '}{formatNumber(value)}
        </text>
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

  const HistoricoTooltip = ({ active, payload, label }) => {
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
  };

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
      const chartTitles = ['Histórico de Ocupación y Vacancia', 'Vacantes por Nivel Jerárquico', 'Vacantes por Nivel Tabular'];
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

      // ── Helper: build table rows for a prefix ──
      const buildPdfRows = (filterFn) => {
        const rows = (desgloseJerarquicoData || []).filter(filterFn);
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

      // ════════════════════════════════════════════════
      // PÁGINA 3: Operativos + K (4 columnas, sin Nueva Creación)
      // ════════════════════════════════════════════════
      const operativosData = buildPdfRows(item => {
        const nivel = (item.Nivel || '').trim();
        return nivel.length > 0 && /^\d/.test(nivel);
      });
      const kData = buildPdfRows(item => {
        const nivel = (item.Nivel || '').trim();
        return nivel.toUpperCase().startsWith('K');
      });

      const shortTables = [
        { label: 'Vacancia de niveles Operativos', ...operativosData },
        { label: 'Vacancia del nivel K', ...kData },
      ].filter(t => t.tableRows.length > 0);

      if (shortTables.length > 0) {
        pdf.addPage();
        drawPageHeader('Detalle de Vacantes — ' + shortTables.map(t => t.label).join('  |  '));
        let startY = 24;

        shortTables.forEach(t => {
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
      }

      // ════════════════════════════════════════════════
      // PÁGINAS 4+: Tablas de detalle P, D, A, S (5 columnas)
      // ════════════════════════════════════════════════
      const prefixes = [
        { prefix: 'P', label: 'Vacancia de enlaces P' },
        { prefix: 'D', label: 'Vacancia del nivel D' },
        { prefix: 'A', label: 'Vacancia del nivel A' },
        { prefix: 'S', label: 'Vacancia del nivel S' },
      ];

      // Build all detail tables data
      const detailTables = prefixes.map(({ prefix, label }) => {
        const result = buildPdfRows(item => {
          const nivel = (item.Nivel || '').trim();
          return nivel.toUpperCase().startsWith(prefix);
        });
        return { label, ...result };
      }).filter(t => t.tableRows.length > 0);

      // Render 2 tables per page
      for (let i = 0; i < detailTables.length; i += 2) {
        pdf.addPage();
        const tablesOnPage = detailTables.slice(i, i + 2);
        const pageTitle = tablesOnPage.map(t => t.label).join('  |  ');
        drawPageHeader(`Detalle de Vacantes — ${pageTitle}`);

        let startY = 24;

        tablesOnPage.forEach((t, idx) => {
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
      const chartTitles = ['Histórico de Ocupación y Vacancia', 'Vacantes por Nivel Jerárquico', 'Vacantes por Nivel Tabular'];
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#10243e]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#bc955c]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#621f32]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quincena de Reporte</p>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mt-2.5 tracking-tight line-clamp-1">
                    {kpis.fechaActual}
                  </h4>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Activity className="size-5" />
                </div>
              </div>
              <div className="mt-5">
                <div className="w-full bg-rose-100 dark:bg-rose-950/40 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpis.ocupadasPct}%` }} />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[9px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider">
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

                <div className="flex flex-wrap items-center gap-2.5">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 shadow-sm border border-slate-200/30 dark:border-slate-700/30 cursor-pointer"
                    >
                      <FilterX className="size-3.5" />
                      <span>Borrar filtros</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportExcel}
                    disabled={isExportingExcel}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isExportingExcel
                      ? <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      : <Download className="size-3.5" />}
                    <span>{isExportingExcel ? 'Generando...' : 'Descargar Excel'}</span>
                  </button>

                  <button
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Download className={`size-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                    <span>{isExporting ? 'Exportando...' : 'Exportar Imagen'}</span>
                  </button>

                  <button
                    onClick={handleGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#621f32] to-[#8c2d4a] hover:from-[#7a2740] hover:to-[#a33658] text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-md shadow-[#621f32]/25 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <FileText className={`size-3.5 ${isGeneratingPdf ? 'animate-pulse' : ''}`} />
                    <span>{isGeneratingPdf ? 'Generando PDF...' : 'Reporte PDF'}</span>
                  </button>

                  <button
                    onClick={handleGenerateWord}
                    disabled={isGeneratingWord}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#2e5890] to-[#3b6ba8] hover:from-[#254a79] hover:to-[#2e5890] text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-md shadow-[#2e5890]/25 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <FileEdit className={`size-3.5 ${isGeneratingWord ? 'animate-pulse' : ''}`} />
                    <span>{isGeneratingWord ? 'Generando Word...' : 'Reporte Word'}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-auto max-h-[65vh] pb-4 custom-scrollbar rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-lg relative bg-white dark:bg-slate-900" ref={tableRef}>
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="text-white sticky top-0 z-20">
                      <tr>
                        <th colSpan={isCompactChart ? 1 : 2} className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Periodo
                        </th>
                        <th colSpan="3" className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Ocupadas
                        </th>
                        <th colSpan="3" className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Vacantes
                        </th>
                        <th colSpan="3" className="bg-[#10243e] border border-slate-200/10 p-2 sm:p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-[#163052] border-t border-slate-200/10">
                        {!isCompactChart && (
                          <th className="sticky left-0 z-30 w-16 sm:w-20 bg-[#163052] border border-slate-200/10 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-[10px] uppercase tracking-wider">
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
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedYears.length > 0 ? 'bg-[#bc955c] text-[#10243e] font-bold' : 'hover:bg-white/20'}`}
                                >
                                  <Filter className="size-3" />
                                </button>
                              </div>
                            </div>
                          </th>
                        )}
                        <th className="sticky left-0 sm:left-20 z-30 bg-[#163052] border border-slate-200/10 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-bold text-[10px] uppercase tracking-wider">
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
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedQnas.length > 0 ? 'bg-[#bc955c] text-[#10243e] font-bold' : 'hover:bg-white/20'}`}
                              >
                                <Filter className="size-3" />
                              </button>
                            </div>
                          </div>
                        </th>
                        {/* Ocupadas */}
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-slate-200/10">
                          Total
                        </th>
                        {/* Vacantes */}
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-slate-200/10">
                          Total
                        </th>
                        {/* Total */}
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-1.5 py-2 sm:px-3 text-center font-bold text-[10px] uppercase bg-slate-200/10">
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
                                  className={`sticky left-0 z-10 w-16 sm:w-20 px-2 py-2.5 sm:px-4 sm:py-3 text-center align-middle border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-slate-100 font-extrabold ${isMostRecent ? "bg-[#f5efe7] dark:bg-[#3a3737]" : "bg-white dark:bg-slate-900"
                                    }`}
                                >
                                  {getYear(row.fecha)}
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
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-[#10243e] dark:hover:text-[#bc955c] hover:bg-slate-50 dark:hover:bg-slate-800/60 border-t border-slate-200/60 dark:border-slate-800/60 transition-all duration-200 cursor-pointer group"
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

        <div className="w-full px-0 sm:px-4 lg:px-6" data-pdf-section>
          <Zoom triggerOnce>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
                <div className="p-3.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-2xl shadow-lg shadow-[#10243e]/30 text-white">
                  <TrendingUp className="size-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                    Histórico de Ocupación y Vacancia
                  </h3>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    Permanentes / Eventuales Ocupadas vs. Vacantes por quincena
                  </p>
                </div>
              </div>

              {historicoChartData.length === 0 ? (
                <div className="py-16 text-center text-slate-450 dark:text-slate-500 font-bold">
                  No hay datos históricos disponibles
                </div>
              ) : (
                <div data-pdf-chart className={`w-full relative pl-4 sm:pl-5 ${(isGeneratingPdf || isGeneratingWord) ? 'h-[650px]' : 'h-[320px] sm:h-[380px]'}`}>
                  <span className="absolute left-0 top-[26%] -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-500 select-none">
                    OCUPADAS
                  </span>
                  <span className="absolute left-0 top-[78%] -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-500 select-none">
                    VACANTES
                  </span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicoChartData} margin={{ top: isCompactChart ? 28 : 40, right: isCompactChart ? 4 : 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.6} className="text-slate-350 dark:text-slate-600" />
                      <MonthBandsLayer />
                      <XAxis
                        dataKey="label"
                        type="category"
                        ticks={historicoTicks}
                        tick={{ fontSize: isCompactChart ? 8 : 10, fontWeight: 700 }}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                      />
                      <YAxis
                        tick={{ fontSize: isCompactChart ? 9 : 10, fontWeight: 700 }}
                        stroke="currentColor"
                        className="text-slate-400 dark:text-slate-500"
                        tickFormatter={formatNumber}
                        width={isCompactChart ? 36 : 55}
                      />
                      <Tooltip
                        content={<HistoricoTooltip />}
                        cursor={{ stroke: '#bc955c', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: isCompactChart ? 9 : 11, fontWeight: 700 }}
                        formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>}
                      />
                      {HISTORICO_SERIES.map(s => (
                        <Line
                          key={s.key}
                          type="linear"
                          dataKey={s.key}
                          name={s.name}
                          stroke={s.color}
                          strokeWidth={2.5}
                          dot={renderHistoricoDot(s.key, s.color)}
                          activeDot={(dotProps) => {
                            const { cx, cy, key } = dotProps;
                            return (
                              <g key={key}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={18}
                                  fill="transparent"
                                  onMouseEnter={() => setHoveredPointKey(s.key)}
                                  onMouseLeave={() => setHoveredPointKey(null)}
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
            </div>
          </Zoom>
        </div>

        <div className="w-full px-0 sm:px-4 lg:px-6" data-pdf-section data-pdf-charts>
          <Zoom triggerOnce>
            <DesgloseJerarquicoCharts data={desgloseJerarquicoData} forExport={isGeneratingPdf || isGeneratingWord} />
          </Zoom>
        </div>

        <div data-pdf-section>
          <DetalleVacantesTablas data={desgloseJerarquicoData} />
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
            {uniqueYears.map(year => (
              <div key={year} onClick={() => toggleYear(year)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${selectedYears.includes(year) ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                  {selectedYears.includes(year) && <Check className="size-3" />}
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{year}</span>
              </div>
            ))}
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
    </div>
  );
}
