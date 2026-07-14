import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, ImageRun, PageNumber, PageBreak,
  Header, Footer, VerticalAlign, BorderStyle, HeadingLevel, PageOrientation,
} from 'docx';

// ── Colores institucionales (mismos que el PDF) ──
const AZUL = '10243E';
const DORADO = 'BC955C';
const GUINDA = '621F32';
const GRIS_CLARO = 'F5F5F8';
const BLANCO = 'FFFFFF';
const TEXTO = '323232';
const GRIS_TOTAL = 'E6EBF2';
const GRIS_TOTAL2 = 'DCE1E8';
const GRIS_TENUE = 'D2D2D7';

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  const monthStr = date.toLocaleDateString('es-MX', { month: 'long' });
  const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
  return `${date.getDate().toString().padStart(2, '0')} ${capitalizedMonth}, ${year}`;
};

const getYear = (dateStr) => (dateStr ? dateStr.split('-')[0] : '');

// ── Helpers de celdas ──
function makeCell(text, { pct, shade, color = TEXTO, bold = false, italic = false, align = AlignmentType.CENTER, size = 16 } = {}) {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: shade ? { fill: shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold, italics: italic, color, size })],
      }),
    ],
  });
}

function headerRow(labels, widths) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => makeCell(l, { pct: widths[i], shade: AZUL, color: BLANCO, bold: true, size: 16 })),
  });
}

function bodyRow(values, widths, { idx = 0, highlightCols = [], boldCols = [] } = {}) {
  const base = idx % 2 === 0 ? BLANCO : GRIS_CLARO;
  return new TableRow({
    children: values.map((v, i) => makeCell(v, {
      pct: widths[i],
      shade: highlightCols.includes(i) ? GRIS_TOTAL : base,
      bold: boldCols.includes(i),
      size: 16,
    })),
  });
}

function totalRow(values, widths, { dashCols = [] } = {}) {
  return new TableRow({
    children: values.map((v, i) => makeCell(v, {
      pct: widths[i],
      shade: AZUL,
      color: v === '—' ? GRIS_TENUE : BLANCO,
      bold: true,
      size: 16,
    })),
  });
}

function sectionTitle(text, color = GUINDA) {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    shading: { fill: color, type: ShadingType.CLEAR, color: 'auto' },
    children: [new TextRun({ text, bold: true, color: BLANCO, size: 24 })],
  });
}

async function dataUrlToUint8Array(dataUrl) {
  const resp = await fetch(dataUrl);
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

const getPrefix = (nivel) => (!nivel ? '' : nivel.trim().charAt(0).toUpperCase());

function buildLevelRows(desgloseJerarquicoData, filterFn) {
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
    evt: a.evt + r.evt, nc: a.nc + r.nc, perm: a.perm + r.perm, total: a.total + r.total,
  }), { evt: 0, nc: 0, perm: 0, total: 0 });
  return { tableRows, totals };
}

function buildShortTable(label, data) {
  const widths = [25, 25, 25, 25];
  const rows = [headerRow(['Nivel', 'Eventuales', 'Permanentes', 'Total'], widths)];
  data.tableRows.forEach((r, idx) => {
    rows.push(bodyRow([
      r.nivel,
      (r.evt + r.nc) > 0 ? formatNumber(r.evt + r.nc) : '—',
      r.perm > 0 ? formatNumber(r.perm) : '—',
      formatNumber(r.total),
    ], widths, { idx, highlightCols: [3] }));
  });
  rows.push(totalRow([
    'TOTAL',
    formatNumber(data.totals.evt + data.totals.nc),
    formatNumber(data.totals.perm),
    formatNumber(data.totals.total),
  ], widths));

  return [
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: label, bold: true, color: GUINDA, size: 20 })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
  ];
}

function buildDetailTable(label, data) {
  const widths = [22, 20, 22, 18, 18];
  const rows = [headerRow(['Nivel', 'Eventuales', 'Evt. Nueva Creación', 'Permanentes', 'Total'], widths)];
  data.tableRows.forEach((r, idx) => {
    rows.push(bodyRow([
      r.nivel,
      r.evt > 0 ? formatNumber(r.evt) : '—',
      r.nc > 0 ? formatNumber(r.nc) : '—',
      r.perm > 0 ? formatNumber(r.perm) : '—',
      formatNumber(r.total),
    ], widths, { idx, highlightCols: [4] }));
  });
  rows.push(totalRow([
    'TOTAL',
    formatNumber(data.totals.evt),
    formatNumber(data.totals.nc),
    formatNumber(data.totals.perm),
    formatNumber(data.totals.total),
  ], widths));

  return [
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: label, bold: true, color: GUINDA, size: 20 })] }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
  ];
}

export async function generateCuadroVacanciaWord({ filteredData = [], desgloseJerarquicoData = [], chartImages = [], lastUpdateText = '' }) {
  const children = [];

  // ═══════════════════ Título ═══════════════════
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'Cuadros de Vacancia — Histórico de Ocupación', bold: true, color: AZUL, size: 32 })],
  }));
  const fechaTexto = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: fechaTexto, color: TEXTO, size: 18, italics: true }),
      ...(lastUpdateText ? [new TextRun({ text: `   •   ${lastUpdateText}`, color: DORADO, size: 16, italics: true })] : []),
    ],
  }));

  // ═══════════════════ Tabla histórica ═══════════════════
  const histWidths = [7, 11, 9, 9, 9, 9, 9, 9, 8, 8, 8];
  const histHeaders = ['Año', 'QNA', 'Ocp. Permanente', 'Ocp. Eventual', 'Total Ocupadas', 'Vac. Permanente', 'Vac. Eventual', 'Total Vacantes', 'Total Permanente', 'Total Eventual', 'Total'];
  const histRows = [headerRow(histHeaders, histWidths)];
  filteredData.forEach((row, idx) => {
    histRows.push(bodyRow([
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
    ], histWidths, { idx, highlightCols: [4, 7, 10] }));
  });
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: histRows }));

  // ═══════════════════ Gráficas ═══════════════════
  for (let i = 0; i < chartImages.length; i++) {
    const chart = chartImages[i];
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: chart.title, bold: true, color: AZUL, size: 26 })],
    }));

    const targetW = 620;
    const aspect = chart.width && chart.height ? chart.width / chart.height : 16 / 9;
    let w = targetW;
    let h = w / aspect;
    const maxH = 380;
    if (h > maxH) { h = maxH; w = h * aspect; }

    const imageData = await dataUrlToUint8Array(chart.dataUrl);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: imageData, type: 'png', transformation: { width: Math.round(w), height: Math.round(h) } })],
    }));
  }

  // ═══════════════════ Detalle de vacantes por nivel ═══════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(sectionTitle('Detalle de Vacantes por Nivel', AZUL));

  const operativosData = buildLevelRows(desgloseJerarquicoData, item => {
    const nivel = (item.Nivel || '').trim();
    return nivel.length > 0 && /^\d/.test(nivel);
  });
  const kData = buildLevelRows(desgloseJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith('K'));

  [
    { label: 'Vacancia de niveles Operativos', data: operativosData },
    { label: 'Vacancia del nivel K', data: kData },
  ].filter(t => t.data.tableRows.length > 0).forEach(t => {
    children.push(...buildShortTable(t.label, t.data));
  });

  const prefixes = [
    { prefix: 'P', label: 'Vacancia de enlaces P' },
    { prefix: 'D', label: 'Vacancia del nivel D' },
    { prefix: 'A', label: 'Vacancia del nivel A' },
    { prefix: 'S', label: 'Vacancia del nivel S' },
  ];
  prefixes.forEach(({ prefix, label }) => {
    const data = buildLevelRows(desgloseJerarquicoData, item => (item.Nivel || '').trim().toUpperCase().startsWith(prefix));
    if (data.tableRows.length > 0) {
      children.push(...buildDetailTable(label, data));
    }
  });

  // ═══════════════════ Observaciones ═══════════════════
  let obsBase = 0, obsOic = 0, obsTitulares = 0;
  const obsTotalSet = new Set();
  (desgloseJerarquicoData || []).forEach((item, idx) => {
    const isBase = (item['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
    const isOic = (item['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
    const isTitular = (item['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');
    if (isBase) obsBase++;
    if (isOic) obsOic++;
    if (isTitular) obsTitulares++;
    if (isBase || isOic || isTitular) obsTotalSet.add(idx);
  });
  const obsTotal = obsTotalSet.size;

  if (obsTotal > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionTitle('Observaciones Vacancia', AZUL));
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: 'Resumen de Casos Especiales y Observaciones de Vacancia', bold: true, color: GUINDA, size: 20 })],
    }));

    const widths = [70, 30];
    const rows = [headerRow(['Observación', 'Total'], widths)];
    rows.push(bodyRow(['Contratación Base', formatNumber(obsBase)], widths, { idx: 0, highlightCols: [1] }));
    rows.push(bodyRow(['Órgano Interno de Control', formatNumber(obsOic)], widths, { idx: 1, highlightCols: [1] }));
    rows.push(bodyRow(['Titulares de Aduanas', formatNumber(obsTitulares)], widths, { idx: 2, highlightCols: [1] }));
    rows.push(totalRow(['TOTAL', formatNumber(obsTotal)], widths));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }

  // ═══════════════════ Documento ═══════════════════
  const doc = new Document({
    creator: 'EjeCentral — ANAM',
    title: 'Reporte de Cuadros de Vacancia',
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, bottom: 720, left: 720, right: 720, header: 360, footer: 360 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              shading: { fill: AZUL, type: ShadingType.CLEAR, color: 'auto' },
              tabStops: [{ type: 'right', position: 14400 }],
              children: [
                new TextRun({ text: 'Reporte de Cuadros de Vacancia', bold: true, color: BLANCO, size: 20 }),
                new TextRun({ text: `\t${fechaTexto}`, color: DORADO, size: 16 }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              shading: { fill: DORADO, type: ShadingType.CLEAR, color: 'auto' },
              children: [
                new TextRun({ text: 'Página ', color: BLANCO, size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], color: BLANCO, size: 16 }),
                new TextRun({ text: ' de ', color: BLANCO, size: 16 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: BLANCO, size: 16 }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_vacancia_${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
