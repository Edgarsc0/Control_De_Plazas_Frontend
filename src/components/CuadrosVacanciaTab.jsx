import { useMemo, useState, useRef, useEffect } from "react";
import { Zoom } from "react-awesome-reveal";
import { LayoutDashboard, Filter, Check, ChevronRight, ChevronDown, Minus, Download, FilterX, FileText, Users, Briefcase, AlertCircle, Percent, Activity } from "lucide-react";
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { PlantillaService } from '@/services/plantilla.service';
import DesgloseJerarquicoCharts from "./DesgloseJerarquicoCharts";
import DetalleVacantesTablas from "./DetalleVacantesTablas";

export default function CuadrosVacanciaTab({ cuadrosData = [], desgloseJerarquicoData = [], onSwitchToTablaPrincipal }) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQnas, setSelectedQnas] = useState([]);
  const [yearFilterOpen, setYearFilterOpen] = useState(false);
  const [qnaFilterOpen, setQnaFilterOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  const yearFilterRef = useRef(null);
  const qnaFilterRef = useRef(null);
  const tableRef = useRef(null);
  const pdfRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (yearFilterRef.current && !yearFilterRef.current.contains(event.target)) {
        setYearFilterOpen(false);
      }
      if (qnaFilterRef.current && !qnaFilterRef.current.contains(event.target)) {
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

  // Filtered data based on selected filters
  const filteredData = useMemo(() => {
    return sortedDescData.filter(row => {
      const rowYear = getYear(row.fecha);
      const rowQna = formatDate(row.fecha);
      const passYear = selectedYears.length === 0 || selectedYears.includes(rowYear);
      const passQna = selectedQnas.length === 0 || selectedQnas.includes(rowQna);
      return passYear && passQna;
    });
  }, [sortedDescData, selectedYears, selectedQnas]);

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
      const chartTitles = ['Vacantes por Nivel Jerárquico', 'Vacantes por Nivel Tabular'];
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

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Cards de KPIs de la quincena actual */}
      {kpis && (
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 px-4 lg:px-6">

            {/* KPI 1: Plazas Totales */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#10243e]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#bc955c]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-[#621f32]/30 transition-all duration-300 group">
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
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 shadow-lg shadow-slate-100/30 dark:shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 group">
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
                <div className="flex justify-between items-center mt-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <span>{kpis.ocupadasPct}% Ocupadas</span>
                  <span>{kpis.vacantesPct}% Vacantes</span>
                </div>
              </div>
            </div>

          </div>
        </Zoom>
      )}

      <div ref={pdfRef} className="space-y-6">
        <div className="w-full px-4 lg:px-6" data-pdf-section>
          <Zoom triggerOnce>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
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
                </div>
              </div>

              <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-lg overflow-hidden relative bg-white dark:bg-slate-900" ref={tableRef}>
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="text-white">
                      <tr>
                        <th colSpan="2" className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Periodo
                        </th>
                        <th colSpan="3" className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Ocupadas
                        </th>
                        <th colSpan="3" className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Vacantes
                        </th>
                        <th colSpan="3" className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[10px] uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                      <tr className="bg-[#163052] border-t border-slate-200/10">
                        <th className="border border-slate-200/10 px-3 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider relative">
                          <div className="flex items-center justify-center gap-2">
                            Año
                            <div className="relative" ref={yearFilterRef}>
                              <button
                                onClick={() => setYearFilterOpen(!yearFilterOpen)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedYears.length > 0 ? 'bg-[#bc955c] text-[#10243e] font-bold' : 'hover:bg-white/20'}`}
                              >
                                <Filter className="size-3" />
                              </button>
                              {yearFilterOpen && (
                                <div className="absolute top-full mt-2 left-0 w-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-800/80 py-2 z-50 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <span className="font-bold text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">Filtrar Año</span>
                                    {selectedYears.length > 0 && (
                                      <button onClick={clearYearFilter} className="text-[9px] text-[#621f32] dark:text-[#bc955c] font-black hover:underline uppercase tracking-wider cursor-pointer">Limpiar</button>
                                    )}
                                  </div>
                                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => selectedYears.length === 0 ? unselectAllYears() : selectAllYears()}>
                                      <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${selectedYears.length === 0 ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : selectedYears.length > 0 && selectedYears[0] !== '__NONE__' ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                                        {selectedYears.length === 0 ? <Check className="size-3" /> : selectedYears.length > 0 && selectedYears[0] !== '__NONE__' ? <Minus className="size-3" /> : null}
                                      </div>
                                      <span className="font-extrabold text-[11px] text-[#10243e] dark:text-[#bc955c] uppercase tracking-wider">(Seleccionar todo)</span>
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
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider relative">
                          <div className="flex items-center justify-center gap-2">
                            Qna.
                            <div className="relative" ref={qnaFilterRef}>
                              <button
                                onClick={() => setQnaFilterOpen(!qnaFilterOpen)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${selectedQnas.length > 0 ? 'bg-[#bc955c] text-[#10243e] font-bold' : 'hover:bg-white/20'}`}
                              >
                                <Filter className="size-3" />
                              </button>
                              {qnaFilterOpen && (
                                <div className="absolute top-full mt-2 left-0 w-52 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-800/80 py-2 z-50 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
                                    <span className="font-bold text-[10px] text-slate-450 dark:text-slate-500 uppercase tracking-wider">Filtrar Qna.</span>
                                    {selectedQnas.length > 0 && (
                                      <button onClick={clearQnaFilter} className="text-[9px] text-[#621f32] dark:text-[#bc955c] font-black hover:underline uppercase tracking-wider cursor-pointer">Limpiar</button>
                                    )}
                                  </div>
                                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-855 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => selectedQnas.length === 0 ? unselectAllQnas() : selectAllQnas()}>
                                      <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${selectedQnas.length === 0 ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : selectedQnas.length > 0 && selectedQnas[0] !== '__NONE__' ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                                        {selectedQnas.length === 0 ? <Check className="size-3" /> : selectedQnas.length > 0 && selectedQnas[0] !== '__NONE__' ? <Minus className="size-3" /> : null}
                                      </div>
                                      <span className="font-extrabold text-[11px] text-[#10243e] dark:text-[#bc955c] uppercase tracking-wider">(Seleccionar todo)</span>
                                    </div>
                                    {Object.entries(qnaTree).map(([treeYear, months]) => {
                                      const yearDays = Object.values(months).flat();
                                      const isYearChecked = selectedQnas.length === 0 || yearDays.every(d => selectedQnas.includes(d));
                                      const isYearIndeterminate = !isYearChecked && yearDays.some(d => selectedQnas.includes(d));
                                      const isYearExpanded = expandedNodes[treeYear];

                                      return (
                                        <div key={treeYear} className="mb-1">
                                          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 sticky top-0 z-10 border-y border-slate-100 dark:border-slate-800/60">
                                            <button onClick={() => toggleExpand(treeYear)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 cursor-pointer">
                                              {isYearExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                            </button>
                                            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleYearGroup(treeYear)}>
                                              <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isYearChecked || isYearIndeterminate ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                                                {isYearChecked ? <Check className="size-3" /> : isYearIndeterminate ? <Minus className="size-3" /> : null}
                                              </div>
                                              <span className="font-black text-xs text-slate-700 dark:text-slate-200">{treeYear}</span>
                                            </div>
                                          </div>

                                          {isYearExpanded && Object.entries(months).map(([month, days]) => {
                                            const monthKey = `${treeYear}-${month}`;
                                            const isMonthChecked = selectedQnas.length === 0 || days.every(d => selectedQnas.includes(d));
                                            const isMonthIndeterminate = !isMonthChecked && days.some(d => selectedQnas.includes(d));
                                            const isMonthExpanded = expandedNodes[monthKey];

                                            return (
                                              <div key={monthKey} className="ml-3 border-l border-slate-150 dark:border-slate-800">
                                                <div className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-855/50">
                                                  <button onClick={() => toggleExpand(monthKey)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 cursor-pointer">
                                                    {isMonthExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                                  </button>
                                                  <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleMonth(treeYear, month)}>
                                                    <div className={`size-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${isMonthChecked || isMonthIndeterminate ? 'bg-[#621f32] dark:bg-[#bc955c] border-[#621f32] dark:border-[#bc955c] text-white dark:text-[#10243e]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'}`}>
                                                      {isMonthChecked ? <Check className="size-3" /> : isMonthIndeterminate ? <Minus className="size-3" /> : null}
                                                    </div>
                                                    <span className="font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{month}</span>
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
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
                        {/* Ocupadas */}
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-bold text-[10px] uppercase bg-slate-200/10">
                          Total
                        </th>
                        {/* Vacantes */}
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-bold text-[10px] uppercase bg-slate-200/10">
                          Total
                        </th>
                        {/* Total */}
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Permanente
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-medium text-[10px] uppercase">
                          Eventual
                        </th>
                        <th className="border border-slate-200/10 px-3 py-2 text-center font-bold text-[10px] uppercase bg-slate-200/10">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 animate-fade-in">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="px-6 py-12 text-center text-slate-450 dark:text-slate-500 font-bold border border-slate-200 dark:border-slate-800">
                            No hay datos que coincidan con los filtros
                          </td>
                        </tr>
                      ) : (
                        filteredData.map((row, index) => {
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
                              {isNewYear && (
                                <td
                                  rowSpan={rowSpan}
                                  className={`px-4 py-3 text-center align-middle border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-slate-100 font-extrabold ${isMostRecent ? "bg-[#bc955c]/15 dark:bg-[#bc955c]/25" : "bg-white dark:bg-slate-900"
                                    }`}
                                >
                                  {getYear(row.fecha)}
                                </td>
                              )}
                              <td className={`px-4 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 whitespace-nowrap font-extrabold ${isMostRecent ? 'text-[#621f32] dark:text-[#bc955c]' : 'text-slate-800 dark:text-slate-100'}`}>
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
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.ocupadas_permanente)}
                              </td>
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.ocupadas_eventual)}
                              </td>
                              <td className={`px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-slate-50 dark:bg-slate-800/80"
                                }`}>
                                {formatNumber(row.ocupadas_total)}
                              </td>

                              {/* Vacantes */}
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.vacantes_permanente)}
                              </td>
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.vacantes_eventual)}
                              </td>
                              <td className={`px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-800 dark:text-white font-extrabold ${isMostRecent ? "bg-[#bc955c]/20 dark:bg-[#bc955c]/30" : "bg-slate-50 dark:bg-slate-800/80"
                                }`}>
                                {formatNumber(row.vacantes_total)}
                              </td>

                              {/* Total */}
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.total_permanente)}
                              </td>
                              <td className="px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-600 dark:text-slate-350 font-medium">
                                {formatNumber(row.total_eventual)}
                              </td>
                              <td className={`px-3 py-3 text-center border border-slate-200/50 dark:border-slate-800/60 text-slate-900 dark:text-white font-black ${isMostRecent ? "bg-[#bc955c]/30 dark:bg-[#bc955c]/45 text-md" : "bg-slate-100 dark:bg-slate-850"
                                }`}>
                                {formatNumber(row.total)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Zoom>
        </div>

        <div className="w-full px-4 lg:px-6" data-pdf-section data-pdf-charts>
          <Zoom triggerOnce>
            <DesgloseJerarquicoCharts data={desgloseJerarquicoData} />
          </Zoom>
        </div>

        <div data-pdf-section>
          <DetalleVacantesTablas data={desgloseJerarquicoData} />
        </div>
      </div>
    </div>
  );
}
