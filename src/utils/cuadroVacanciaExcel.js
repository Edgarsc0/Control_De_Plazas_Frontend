// ARGB color constants
const C = {
  GUINDA:   'FF621F32',
  AZUL:     'FF10243E',
  DORADO:   'FFBC955C',
  BLANCO:   'FFFFFFFF',
  GRIS:     'FFF5F5F8',
  AMARILLO: 'FFFFF3CD',
  BLUE_LNK: 'FF1D4ED8',
};

const TIPO = { E: 'Eventual', NC: 'NvaCr', P: 'Permanente' };
const DDS  = 3;     // Det_ Data Start row (row1=title, row2=headers, row3+=data)
const DMAX = 9999;  // upper bound for COUNTIFS range

const DET_COLS = [
  { key: '_tipo',                   label: 'Tipo Vacante',           width: 14 },
  { key: 'Nivel',                   label: 'Nivel',                  width: 10 },
  { key: 'Posición',                label: 'No. Posición',           width: 16 },
  { key: 'Nombre Puesto Funcional', label: 'Puesto Funcional',       width: 42 },
  { key: 'Unidad de Negocio',       label: 'Unidad de Negocio',      width: 36 },
  { key: 'nombre_ua',               label: 'Unidad Administrativa',  width: 30 },
  { key: 'Cd UA',                   label: 'Cód. UA',                width: 10 },
  { key: 'NJ',                      label: 'NJ',                     width:  8 },
  { key: 'nombreNJ',                label: 'Nombre NJ',              width: 30 },
  { key: 'Cd UN',                   label: 'Cód. UN',                width: 10 },
  { key: 'Código Presupuestal',     label: 'Cód. Presupuestal',      width: 18 },
  { key: 'Escala',                  label: 'Escala',                 width: 10 },
  { key: 'Partida',                 label: 'Partida',                width: 10 },
  { key: 'TIPO DE CONTRATACIÓN',    label: 'Tipo Contratación',      width: 18 },
  { key: 'Sindicato',               label: 'Sindicato',              width: 14 },
  { key: 'Entidad Federativa',      label: 'Entidad Federativa',     width: 22 },
];

const fmt = (n) => (n == null ? 0 : Number(n));

function classifyTipo(posicion) {
  const p = (posicion || '').trim();
  if (p.startsWith('103'))  return TIPO.P;
  if (p.startsWith('2026')) return TIPO.NC;
  return TIPO.E;
}

// ── COUNTIFS helpers ──────────────────────────────────────────────────────────
function tipoRng(sn)  { return `'${sn}'!$A$${DDS}:$A$${DMAX}`; }
function nivelRng(sn) { return `'${sn}'!$B$${DDS}:$B$${DMAX}`; }

function cntNT(sn, nivel, tipo) {
  return `COUNTIFS(${nivelRng(sn)},"${nivel}",${tipoRng(sn)},"${tipo}")`;
}
function cntNEvt(sn, nivel) {
  return `${cntNT(sn, nivel, TIPO.E)}+${cntNT(sn, nivel, TIPO.NC)}`;
}
function cntNAll(sn, nivel) {
  return `COUNTIFS(${nivelRng(sn)},"${nivel}")`;
}
function cntAllTipo(sheetNames, tipo) {
  return sheetNames.map(sn => `COUNTIFS(${tipoRng(sn)},"${tipo}")`).join('+');
}
function cntAllEvt(sheetNames) {
  return sheetNames.map(sn =>
    `COUNTIFS(${tipoRng(sn)},"${TIPO.E}")+COUNTIFS(${tipoRng(sn)},"${TIPO.NC}")`
  ).join('+');
}

// Dynamic cell: shows count; if > 0 is also a hyperlink to the Det_ sheet row
function hCell(cntExpr, sn, targetRow) {
  return { formula: `=IF(${cntExpr}=0,0,HYPERLINK("#'${sn}'!A${targetRow}",${cntExpr}))` };
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function thinBorder(color = 'FFCBD5E1') {
  const s = { style: 'thin', color: { argb: color } };
  return { top: s, bottom: s, left: s, right: s };
}

function styleTitle(ws, rowNum, text, numCols, bg = C.GUINDA) {
  if (numCols > 1) ws.mergeCells(rowNum, 1, rowNum, numCols);
  const cell = ws.getCell(rowNum, 1);
  cell.value = text;
  cell.font  = { bold: true, color: { argb: C.BLANCO }, size: 11, name: 'Arial' };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(rowNum).height = 26;
}

function styleHeader(row) {
  row.height = 28;
  row.eachCell(cell => {
    cell.font  = { bold: true, color: { argb: C.BLANCO }, size: 9, name: 'Arial' };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: C.DORADO } },
      bottom: { style: 'thin', color: { argb: C.DORADO } },
      left:   { style: 'thin', color: { argb: C.DORADO } },
      right:  { style: 'thin', color: { argb: C.DORADO } },
    };
  });
}

function styleDataRow(row, idx) {
  row.height = 19;
  const bg = idx % 2 === 0 ? C.BLANCO : C.GRIS;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { size: 9, name: 'Arial', color: { argb: '504040' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}

function styleTotalRow(row) {
  row.height = 22;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AZUL } };
    cell.font = { bold: true, color: { argb: C.BLANCO }, size: 9, name: 'Arial' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top:    { style: 'medium', color: { argb: C.DORADO } },
      bottom: { style: 'thin',   color: { argb: C.DORADO } },
      left:   { style: 'thin',   color: { argb: C.DORADO } },
      right:  { style: 'thin',   color: { argb: C.DORADO } },
    };
  });
}

function sumF(col, startRow, len) {
  if (len === 0) return 0;
  return { formula: `=SUM(${col}${startRow}:${col}${startRow + len - 1})` };
}

// ── Det_ sheet builder ────────────────────────────────────────────────────────
// Returns { sheetName, rowMap, levels, dataLen }
// rowMap[nivel][tipo] = first 1-based row for that nivel+tipo in the sheet
// rowMap[nivel].total = first 1-based row for any row of that nivel
function buildDetSheet(wb, sheetName, title, positions) {
  const enriched = positions.map(pos => ({
    ...pos,
    _tipo: classifyTipo(pos['Posición'] || ''),
  }));

  enriched.sort((a, b) => {
    const na = (a.Nivel || '').trim();
    const nb = (b.Nivel || '').trim();
    const nc = na.localeCompare(nb, 'es', { numeric: true });
    if (nc !== 0) return nc;
    return a._tipo.localeCompare(b._tipo);
  });

  const rowMap = {};
  enriched.forEach((pos, idx) => {
    const nivel = (pos.Nivel || '').trim();
    const tipo  = pos._tipo;
    const r = DDS + idx;
    if (!rowMap[nivel]) rowMap[nivel] = {};
    if (rowMap[nivel].total === undefined) rowMap[nivel].total = r;
    if (rowMap[nivel][tipo] === undefined) rowMap[nivel][tipo] = r;
  });

  const levels = Object.keys(rowMap).sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true })
  );

  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
  ws.columns = DET_COLS.map(c => ({ key: c.key, width: c.width }));

  styleTitle(ws, 1, title, DET_COLS.length);
  const hRow = ws.addRow(DET_COLS.map(c => c.label));
  styleHeader(hRow);

  const TYPE_BG = {
    [TIPO.P]:  'FFE8F5E9',
    [TIPO.NC]: 'FFFCE4EC',
    [TIPO.E]:  'FFF3E5F5',
  };

  enriched.forEach((pos, idx) => {
    const vals = DET_COLS.map(c => pos[c.key] ?? '');
    const dr = ws.addRow(vals);
    styleDataRow(dr, idx);
    dr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TYPE_BG[pos._tipo] || C.GRIS } };
    dr.getCell(1).font = { bold: true, size: 9, name: 'Arial', color: { argb: C.AZUL } };
    [4, 5, 6, 9].forEach(ci => {
      dr.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  return { sheetName, rowMap, levels, dataLen: enriched.length };
}

// ── Observaciones ─────────────────────────────────────────────────────────────
function buildObservaciones(desgloseData) {
  const baseRows = [], oicRows = [], titularRows = [];
  const totalSet = new Set();
  desgloseData.forEach((item, idx) => {
    const isBase    = (item['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
    const isOic     = (item['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
    const isTitular = (item['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');
    if (isBase)    baseRows.push(item);
    if (isOic)     oicRows.push(item);
    if (isTitular) titularRows.push(item);
    if (isBase || isOic || isTitular) totalSet.add(idx);
  });
  return { base: baseRows.length, oic: oicRows.length, titulares: titularRows.length,
           total: totalSet.size, baseRows, oicRows, titularRows };
}

function addObservacionesSheet(wb, obs) {
  const ws = wb.addWorksheet('Observaciones');
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  const detailCols = [
    { key: 'Posición',                label: 'No. Posición',           width: 16 },
    { key: 'Nivel',                   label: 'Nivel',                  width: 12 },
    { key: 'Nombre Puesto Funcional', label: 'Nombre Puesto Funcional',width: 38 },
    { key: 'nombre_ua',               label: 'Unidad Administrativa',  width: 30 },
    { key: 'Unidad de Negocio',       label: 'Unidad de Negocio',      width: 36 },
    { key: 'Cd UN',                   label: 'Cd. UN',                 width: 10 },
    { key: 'TIPO DE CONTRATACIÓN',    label: 'Tipo Contratación',      width: 20 },
    { key: 'Código Presupuestal',     label: 'Cód. Presupuestal',      width: 20 },
    { key: 'Escala',                  label: 'Escala',                 width: 10 },
    { key: 'Partida',                 label: 'Partida',                width: 12 },
    { key: 'Entidad Federativa',      label: 'Entidad Federativa',     width: 24 },
  ];
  const numDet = detailCols.length;

  ws.columns = detailCols.map(c => ({ key: c.key, width: c.width }));

  styleTitle(ws, 1, 'OBSERVACIONES VACANCIA', numDet, C.AZUL);

  const shRow = ws.addRow(['Categoría', 'Total']);
  styleHeader(shRow);

  [
    ['Contratación Base (SAT_BSE)', obs.base],
    ['Órgano Interno de Control',   obs.oic],
    ['Titulares de Aduanas',        obs.titulares],
  ].forEach(([label, val], idx) => {
    const cr = ws.addRow([label, val]);
    styleDataRow(cr, idx);
    cr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const totRow = ws.addRow(['Total (unión de las tres categorías)', obs.total]);
  styleTotalRow(totRow);
  totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.addRow([]);

  const addSection = (sectionTitle, rows) => {
    if (!rows.length) return;
    const stRow = ws.addRow([sectionTitle]);
    styleTitle(ws, stRow.number, sectionTitle, numDet, C.GUINDA);
    const dhRow = ws.addRow(detailCols.map(c => c.label));
    styleHeader(dhRow);
    rows.forEach((item, idx) => {
      const dr = ws.addRow(detailCols.map(c => item[c.key] ?? ''));
      styleDataRow(dr, idx);
      [3, 4, 5].forEach(ci => {
        dr.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
      });
    });
    ws.addRow([]);
  };

  addSection('Contratación Base (SAT_BSE)',                     obs.baseRows);
  addSection('Órgano Interno de Control',                        obs.oicRows);
  addSection('Titulares de Aduanas (Administradores de Aduana)', obs.titularRows);
}

// ── Resumen sheet ─────────────────────────────────────────────────────────────
// detSheets: array of { sheetName, rowMap, levels, hasNvaCr, title, dataLen }
function fillResumenSheet(ws, cuadrosData, detSheets) {
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
  ws.columns = [
    { key: 'a', width: 14 },
    { key: 'b', width: 28 },
    { key: 'c', width: 18 },
    { key: 'd', width: 18 },
    { key: 'e', width: 15 },
    { key: 'f', width: 17 },
    { key: 'g', width: 17 },
    { key: 'h', width: 15 },
    { key: 'i', width: 15 },
    { key: 'j', width: 15 },
    { key: 'k', width: 12 },
  ];

  // ── Sección I: Cuadro histórico ───────────────────────────────────────────
  styleTitle(ws, 1, 'I. CUADRO DE VACANCIA — HISTÓRICO DE OCUPACIÓN', 11);

  ws.mergeCells(2, 1, 2, 11);
  const note = ws.getCell(2, 1);
  note.value = '★  Fila "Actual" calcula vacantes en tiempo real desde hojas Det_*. Las celdas de la fila Actual son dinámicas. Resto de filas = datos históricos estáticos.';
  note.font  = { italic: true, size: 8, color: { argb: 'FF78350F' }, name: 'Arial' };
  note.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  note.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 17;

  const hRow = ws.addRow([
    'Año', 'Fecha',
    'Ocp. Permanente', 'Ocp. Eventual', 'Total Ocupadas',
    'Vac. Permanente', 'Vac. Eventual', 'Total Vacantes',
    'Total Permanente', 'Total Eventual', 'Total',
  ]);
  styleHeader(hRow);

  const allSN     = detSheets.map(d => d.sheetName);
  const permExpr  = cntAllTipo(allSN, TIPO.P);
  const evtExpr   = cntAllEvt(allSN);
  const sorted    = [...cuadrosData].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const latest    = sorted[0] || {};
  const ocpPerm   = fmt(latest.ocupadas_permanente);
  const ocpEvt    = fmt(latest.ocupadas_eventual);
  const liveR     = 4;

  const live = ws.addRow([
    new Date().getFullYear(),
    'Actual (tiempo real)',
    ocpPerm,
    ocpEvt,
    { formula: `=C${liveR}+D${liveR}` },
    { formula: `=${permExpr}` },
    { formula: `=${evtExpr}` },
    { formula: `=F${liveR}+G${liveR}` },
    { formula: `=C${liveR}+F${liveR}` },
    { formula: `=D${liveR}+G${liveR}` },
    { formula: `=I${liveR}+J${liveR}` },
  ]);
  live.height = 22;
  live.eachCell((cell, ci) => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AMARILLO } };
    cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: C.AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: ci === 2 ? 'left' : 'center' };
    cell.border = {
      top:    { style: 'medium', color: { argb: C.DORADO } },
      bottom: { style: 'medium', color: { argb: C.DORADO } },
      left:   { style: 'thin',   color: { argb: C.DORADO } },
      right:  { style: 'thin',   color: { argb: C.DORADO } },
    };
  });

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      const [y, m, day] = d.split('-');
      return new Date(+y, +m - 1, +day).toLocaleDateString('es-MX',
        { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return d; }
  };

  sorted.forEach((row, idx) => {
    const year = (row.fecha || '').split('-')[0] || '';
    const dr = ws.addRow([
      year, fmtDate(row.fecha),
      fmt(row.ocupadas_permanente), fmt(row.ocupadas_eventual), fmt(row.ocupadas_total),
      fmt(row.vacantes_permanente), fmt(row.vacantes_eventual), fmt(row.vacantes_total),
      fmt(row.total_permanente), fmt(row.total_eventual), fmt(row.total),
    ]);
    styleDataRow(dr, idx);
    dr.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    [6, 7, 8, 11].forEach(c => {
      dr.getCell(c).font = { bold: true, size: 9, name: 'Arial', color: { argb: '504040' } };
    });
  });

  // ── Sección II: Tablas por nivel con COUNTIFS + HYPERLINK ─────────────────
  ws.addRow([]);
  const sec2Row = ws.addRow(['II. CUADROS DE VACANCIA POR NIVEL']);
  styleTitle(ws, sec2Row.number, 'II. CUADROS DE VACANCIA POR NIVEL', 11, C.AZUL);

  detSheets.forEach(({ sheetName: sn, rowMap, levels, hasNvaCr, title, dataLen }) => {
    ws.addRow([]);

    const subTRow = ws.addRow([title]);
    const numCols = hasNvaCr ? 5 : 4;
    styleTitle(ws, subTRow.number, title, numCols, C.GUINDA);

    const headers = hasNvaCr
      ? ['Nivel', 'Eventuales', 'Evt. Nueva Creación', 'Permanentes', 'Total']
      : ['Nivel', 'Eventuales (incl. Nva.Cr.)', 'Permanentes', 'Total'];
    const hRowN = ws.addRow(headers);
    styleHeader(hRowN);

    const dataStart = ws.rowCount + 1;

    levels.forEach((nivel, idx) => {
      const rm  = rowMap[nivel] || {};
      const fb  = rm.total || DDS;

      const vals = hasNvaCr
        ? [
            nivel,
            hCell(cntNT(sn, nivel, TIPO.E),  sn, rm[TIPO.E]  ?? fb),
            hCell(cntNT(sn, nivel, TIPO.NC), sn, rm[TIPO.NC] ?? fb),
            hCell(cntNT(sn, nivel, TIPO.P),  sn, rm[TIPO.P]  ?? fb),
            hCell(cntNAll(sn, nivel),         sn, rm.total    ?? fb),
          ]
        : [
            nivel,
            hCell(cntNEvt(sn, nivel),        sn, rm[TIPO.E]  ?? fb),
            hCell(cntNT(sn, nivel, TIPO.P),  sn, rm[TIPO.P]  ?? fb),
            hCell(cntNAll(sn, nivel),         sn, rm.total    ?? fb),
          ];

      const dr = ws.addRow(vals);
      styleDataRow(dr, idx);
      dr.getCell(1).font = { bold: true, size: 9, name: 'Arial', color: { argb: C.AZUL } };
      dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      for (let ci = 2; ci <= numCols; ci++) {
        dr.getCell(ci).font = { size: 9, name: 'Arial', color: { argb: C.BLUE_LNK }, underline: true };
      }
    });

    const colLetters = hasNvaCr ? ['B', 'C', 'D', 'E'] : ['B', 'C', 'D'];
    const totVals = ['Total', ...colLetters.map(col => sumF(col, dataStart, levels.length))];
    const totRow = ws.addRow(totVals);
    styleTotalRow(totRow);
    totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateCuadroVacanciaExcel(cuadrosData, desgloseData) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EjeCentral — ANAM';
  wb.created = new Date();

  // Resumen must be tab #1 — add empty, fill after Det_ sheets are built
  const wsResumen = wb.addWorksheet('Resumen');

  const groups = [
    { sn: 'Det_Operativos', title: 'Posiciones Vacantes — Niveles Operativos', filter: i => /^\d/.test((i.Nivel || '').trim()),  hasNvaCr: false },
    { sn: 'Det_K',          title: 'Posiciones Vacantes — Nivel K',            filter: i => /^K/i.test((i.Nivel || '').trim()),  hasNvaCr: false },
    { sn: 'Det_P',          title: 'Posiciones Vacantes — Niveles P',          filter: i => /^P/i.test((i.Nivel || '').trim()),  hasNvaCr: true  },
    { sn: 'Det_S',          title: 'Posiciones Vacantes — Nivel S',            filter: i => /^S/i.test((i.Nivel || '').trim()),  hasNvaCr: true  },
    { sn: 'Det_A',          title: 'Posiciones Vacantes — Nivel A',            filter: i => /^A/i.test((i.Nivel || '').trim()),  hasNvaCr: true  },
    { sn: 'Det_D',          title: 'Posiciones Vacantes — Nivel D',            filter: i => /^D/i.test((i.Nivel || '').trim()),  hasNvaCr: true  },
  ];

  const detSheets = groups.map(({ sn, title, filter, hasNvaCr }) => {
    const positions = desgloseData.filter(filter);
    const result    = buildDetSheet(wb, sn, title, positions);
    return { ...result, hasNvaCr, title };
  });

  const obs = buildObservaciones(desgloseData);
  addObservacionesSheet(wb, obs);

  fillResumenSheet(wsResumen, cuadrosData, detSheets);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `Cuadro_Vacancia_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
