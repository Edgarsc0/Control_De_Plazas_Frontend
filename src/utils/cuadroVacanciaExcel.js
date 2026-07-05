// ARGB color constants — guinda/azul/dorado son los colores institucionales de
// ANAM (mismos que usa la app en pantalla); el resto son tonos slate a juego.
const C = {
  GUINDA:    'FF621F32',
  AZUL:      'FF10243E',
  DORADO:    'FFBC955C',
  BLANCO:    'FFFFFFFF',
  GRIS:      'FFF8FAFC',  // slate-50 — fila alterna
  DORADO_BG: 'FFFBEEDC',  // tinte dorado tenue — resalta la fila "Actual"
  TEXTO:     'FF334155',  // slate-700 — texto de celda
  BLUE_LNK:  'FF1D4ED8',
};

const TIPO = { E: 'Eventual', NC: 'Nueva Creación', P: 'Permanente' };
const FONT = 'Calibri';
const DDS  = 3;      // Det_ Data Start row (row1=title, row2=headers, row3+=data)
const DMAX = 30000;  // upper bound for COUNTIFS range — must exceed max rows in any Det_/Detalle Global sheet

const DET_COLS = [
  { key: '_tipo',                   label: 'Tipo Vacante',           width: 14 },
  { key: 'Nivel',                   label: 'Nivel',                  width: 10 },
  { key: 'Posición',                label: 'Número de Posición',     width: 18 },
  { key: 'Nombre Puesto Funcional', label: 'Puesto Funcional',       width: 42 },
  { key: 'Unidad de Negocio',       label: 'Unidad de Negocio',      width: 36 },
  { key: 'nombre_ua',               label: 'Unidad Administrativa',  width: 30 },
  { key: 'Cd UA',                   label: 'Código UA',              width: 12 },
  { key: 'NJ',                      label: 'NJ',                     width:  8 },
  { key: 'nombreNJ',                label: 'Nombre NJ',              width: 30 },
  { key: 'Cd UN',                   label: 'Código UN',              width: 12 },
  { key: 'Código Presupuestal',     label: 'Código Presupuestal',    width: 18 },
  { key: 'Escala',                  label: 'Escala',                 width: 10 },
  { key: 'Partida',                 label: 'Partida',                width: 10 },
  { key: 'TIPO DE CONTRATACIÓN',    label: 'Tipo Contratación',      width: 18 },
  { key: 'Sindicato',               label: 'Sindicato',              width: 14 },
  { key: 'Entidad Federativa',      label: 'Entidad Federativa',     width: 22 },
];

// Detalle Global: mismas columnas que Det_ + Estatus (Ocupada/Vacante) al frente
// + datos del empleado al final (solo aplican a filas Ocupada; Vacante queda en blanco)
const GLOBAL_COLS = [
  { key: '_estatus', label: 'Estatus', width: 12 },
  ...DET_COLS,
  { key: 'Id Empleado', label: 'Número de Empleado', width: 18 },
  { key: 'Nombres',     label: 'Nombre',       width: 34 },
  { key: 'RFC',         label: 'RFC',           width: 16 },
  { key: 'CURP',        label: 'CURP',          width: 20 },
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
// ── COUNTIFS helpers for the combined "Detalle Global" sheet (col A=Estatus, B=Tipo) ──
function estatusRng(sn) { return `'${sn}'!$A$${DDS}:$A$${DMAX}`; }
function tipoRngG(sn)   { return `'${sn}'!$B$${DDS}:$B$${DMAX}`; }

function cntGEstatusTipo(sn, estatus, tipo) {
  return `COUNTIFS(${estatusRng(sn)},"${estatus}",${tipoRngG(sn)},"${tipo}")`;
}
function cntGEstatusEvt(sn, estatus) {
  return `${cntGEstatusTipo(sn, estatus, TIPO.E)}+${cntGEstatusTipo(sn, estatus, TIPO.NC)}`;
}
function cntGEstatus(sn, estatus) {
  return `COUNTIFS(${estatusRng(sn)},"${estatus}")`;
}
function cntGTipo(sn, tipo) {
  return `COUNTIFS(${tipoRngG(sn)},"${tipo}")`;
}
function cntGEvtTotal(sn) {
  return `${cntGTipo(sn, TIPO.E)}+${cntGTipo(sn, TIPO.NC)}`;
}
function cntGAll(sn) {
  return `${cntGEstatus(sn, 'Ocupada')}+${cntGEstatus(sn, 'Vacante')}`;
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
  cell.font  = { bold: true, color: { argb: C.BLANCO }, size: 13, name: FONT };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(rowNum).height = 30;
}

function styleHeader(row) {
  row.height = 30;
  row.eachCell(cell => {
    cell.font  = { bold: true, color: { argb: C.BLANCO }, size: 10, name: FONT };
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
  row.height = 21;
  const bg = idx % 2 === 0 ? C.BLANCO : C.GRIS;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { size: 10, name: FONT, color: { argb: C.TEXTO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}

function styleTotalRow(row) {
  row.height = 24;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AZUL } };
    cell.font = { bold: true, color: { argb: C.BLANCO }, size: 10, name: FONT };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top:    { style: 'medium', color: { argb: C.DORADO } },
      bottom: { style: 'thin',   color: { argb: C.DORADO } },
      left:   { style: 'thin',   color: { argb: C.DORADO } },
      right:  { style: 'thin',   color: { argb: C.DORADO } },
    };
  });
}

// Dynamic total cell: SUM of the level rows, wrapped as a HYPERLINK to the first
// data row of the Det_ sheet so clicking the total jumps to that level's detail.
function sumHCell(sn, col, startRow, len) {
  if (len === 0) return 0;
  const range = `${col}${startRow}:${col}${startRow + len - 1}`;
  return { formula: `=IF(SUM(${range})=0,0,HYPERLINK("#'${sn}'!A${DDS}",SUM(${range})))` };
}

// Auto-ajusta el ancho de cada columna al contenido real (texto plano; las celdas
// con fórmula/hyperlink no se miden — conservan su ancho base fijado en columns[]).
function autoFitColumns(ws, colCount, minW = 10, maxW = 55) {
  for (let ci = 1; ci <= colCount; ci++) {
    const col = ws.getColumn(ci);
    let maxLen = 0;
    col.eachCell({ includeEmpty: false }, cell => {
      const v = cell.value;
      if (v == null || typeof v === 'object') return;
      const len = String(v).length;
      if (len > maxLen) maxLen = len;
    });
    if (maxLen > 0) col.width = Math.min(Math.max(maxLen + 3, minW), maxW);
  }
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
    dr.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.AZUL } };
    [4, 5, 6, 9].forEach(ci => {
      dr.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  autoFitColumns(ws, DET_COLS.length);
  return { sheetName, rowMap, levels, dataLen: enriched.length };
}

// ── Detalle Global builder (Ocupadas + Vacantes combinadas) ────────────────────
// Returns { sheetName, dataLen }
function buildGlobalDetSheet(wb, sheetName, title, vacantesPositions, ocupadasPositions) {
  const enriched = [
    ...ocupadasPositions.map(pos => ({
      ...pos,
      _estatus: 'Ocupada',
      _tipo: classifyTipo(pos['Posición'] || ''),
    })),
    ...vacantesPositions.map(pos => ({
      ...pos,
      _estatus: 'Vacante',
      _tipo: classifyTipo(pos['Posición'] || ''),
    })),
  ];

  enriched.sort((a, b) => {
    if (a._estatus !== b._estatus) return a._estatus.localeCompare(b._estatus);
    const na = (a.Nivel || '').trim();
    const nb = (b.Nivel || '').trim();
    const nc = na.localeCompare(nb, 'es', { numeric: true });
    if (nc !== 0) return nc;
    return a._tipo.localeCompare(b._tipo);
  });

  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
  ws.columns = GLOBAL_COLS.map(c => ({ key: c.key, width: c.width }));

  styleTitle(ws, 1, title, GLOBAL_COLS.length, C.AZUL);
  const hRow = ws.addRow(GLOBAL_COLS.map(c => c.label));
  styleHeader(hRow);

  const ESTATUS_BG = { Ocupada: 'FFE8F5E9', Vacante: 'FFFCE4EC' };

  enriched.forEach((pos, idx) => {
    const vals = GLOBAL_COLS.map(c => pos[c.key] ?? '');
    const dr = ws.addRow(vals);
    styleDataRow(dr, idx);
    dr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ESTATUS_BG[pos._estatus] || C.GRIS } };
    dr.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.AZUL } };
    [5, 6, 7, 10, 19].forEach(ci => {
      dr.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  autoFitColumns(ws, GLOBAL_COLS.length);
  return { sheetName, dataLen: enriched.length };
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
    { key: 'Posición',                label: 'Número de Posición',     width: 18 },
    { key: 'Nivel',                   label: 'Nivel',                  width: 12 },
    { key: 'Nombre Puesto Funcional', label: 'Nombre Puesto Funcional',width: 38 },
    { key: 'nombre_ua',               label: 'Unidad Administrativa',  width: 30 },
    { key: 'Unidad de Negocio',       label: 'Unidad de Negocio',      width: 36 },
    { key: 'Cd UN',                   label: 'Código UN',              width: 12 },
    { key: 'TIPO DE CONTRATACIÓN',    label: 'Tipo Contratación',      width: 20 },
    { key: 'Código Presupuestal',     label: 'Código Presupuestal',    width: 20 },
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

  autoFitColumns(ws, numDet);
}

// ── Resumen sheet ─────────────────────────────────────────────────────────────
// detSheets: array of { sheetName, rowMap, levels, hasNvaCr, title, dataLen }
function fillResumenSheet(ws, cuadrosData, detSheets, globalSheetName) {
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
  note.value = '★  Fila "Actual" calcula en tiempo real desde la hoja Detalle Global. Todas sus celdas son dinámicas y clicables (saltan al detalle). Resto de filas = datos históricos estáticos.';
  note.font  = { italic: true, size: 9, color: { argb: 'FF78350F' }, name: FONT };
  note.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  note.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 20;

  const hRow = ws.addRow([
    'Año', 'Fecha',
    'Ocupadas Permanente', 'Ocupadas Eventual', 'Total Ocupadas',
    'Vacantes Permanente', 'Vacantes Eventual', 'Total Vacantes',
    'Total Permanente', 'Total Eventual', 'Total',
  ]);
  styleHeader(hRow);

  const sorted    = [...cuadrosData].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const liveR     = 4;
  const gsn       = globalSheetName;

  const live = ws.addRow([
    new Date().getFullYear(),
    'Actual (tiempo real)',
    hCell(cntGEstatusTipo(gsn, 'Ocupada', TIPO.P), gsn, DDS),
    hCell(cntGEstatusEvt(gsn, 'Ocupada'),          gsn, DDS),
    hCell(cntGEstatus(gsn, 'Ocupada'),              gsn, DDS),
    hCell(cntGEstatusTipo(gsn, 'Vacante', TIPO.P), gsn, DDS),
    hCell(cntGEstatusEvt(gsn, 'Vacante'),           gsn, DDS),
    hCell(cntGEstatus(gsn, 'Vacante'),               gsn, DDS),
    hCell(cntGTipo(gsn, TIPO.P),                     gsn, DDS),
    hCell(cntGEvtTotal(gsn),                         gsn, DDS),
    hCell(cntGAll(gsn),                              gsn, DDS),
  ]);
  live.height = 24;
  live.eachCell((cell, ci) => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.DORADO_BG } };
    cell.font  = { bold: true, size: 10, name: FONT, color: { argb: C.AZUL }, underline: ci >= 3 };
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
      dr.getCell(c).font = { bold: true, size: 10, name: FONT, color: { argb: C.TEXTO } };
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
      ? ['Nivel', 'Eventuales', 'Eventuales Nueva Creación', 'Permanentes', 'Total']
      : ['Nivel', 'Eventuales (incluye Nueva Creación)', 'Permanentes', 'Total'];
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
      dr.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.AZUL } };
      dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      for (let ci = 2; ci <= numCols; ci++) {
        dr.getCell(ci).font = { size: 10, name: FONT, color: { argb: C.BLUE_LNK }, underline: true };
      }
    });

    const colLetters = hasNvaCr ? ['B', 'C', 'D', 'E'] : ['B', 'C', 'D'];
    const totVals = ['Total', ...colLetters.map(col => sumHCell(sn, col, dataStart, levels.length))];
    const totRow = ws.addRow(totVals);
    styleTotalRow(totRow);
    totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    for (let ci = 2; ci <= numCols; ci++) {
      totRow.getCell(ci).font = { ...totRow.getCell(ci).font, underline: true };
    }
  });

  autoFitColumns(ws, 11, 12, 45);
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateCuadroVacanciaExcel(cuadrosData, desgloseData, ocupadosData = []) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EjeCentral — ANAM';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

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

  const globalSheet = buildGlobalDetSheet(
    wb, 'Detalle Global', 'Detalle Global — Ocupadas y Vacantes', desgloseData, ocupadosData
  );

  const obs = buildObservaciones(desgloseData);
  addObservacionesSheet(wb, obs);

  fillResumenSheet(wsResumen, cuadrosData, detSheets, globalSheet.sheetName);

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
