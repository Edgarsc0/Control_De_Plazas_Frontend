import { addExcelLetterhead } from './excelLetterhead';

// ARGB color constants — un solo color fuerte (guinda, el mismo del membrete
// institucional) para toda jerarquía visual; dorado queda solo como acento
// fino (bordes, resaltados tenues), nunca como fill de bloque.
const C = {
  GUINDA:      'FF621F32',  // color institucional fuerte — headers, títulos, totales
  GUINDA_OSC:  'FF3D131F',  // guinda oscurecido — jerarquía de títulos de sección (I./II./III.)
  GUINDA_LINK: 'FF8C2F49',  // guinda medio — hipervínculos (misma familia, no azul)
  DORADO:      'FFBC955C',  // acento — solo bordes y resaltados sutiles
  BLANCO:      'FFFFFFFF',
  GRIS:        'FFF8FAFC',  // slate-50 — fila alterna
  DORADO_BG:   'FFFBEEDC',  // tinte dorado tenue — resalta la fila "Actual"
  TEXTO:       'FF334155',  // slate-700 — texto de celda
};

const TIPO = { E: 'Eventual', NC: 'Nueva Creación', P: 'Permanente' };
const FONT = 'Calibri';

// Layout de cada hoja de detalle: fila1 = volver al Resumen, fila3 = título,
// fila5 = encabezados, fila6+ = datos.
const DATA_START_ROW = 6;

const DET_COLS = [
  { key: '_tipo',                   label: 'Tipo Vacante',           width: 14 },
  { key: 'Nivel',                   label: 'Nivel',                  width: 10 },
  { key: 'Posición',                label: 'Número de Posición',     width: 18 },
  { key: 'Fecha Vacancia',          label: 'Fecha de Vacancia',      width: 16 },
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
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GUINDA } };
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.GUINDA } };
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

// ── Hoja de detalle dedicada ──────────────────────────────────────────────────
// Cada "detalle" (una celda del Resumen) recibe su propia hoja completa con solo
// las posiciones que le corresponden — nunca comparte hoja ni rango con otra
// celda — para que el hipervínculo siempre aterrice exactamente en su contenido
// (a diferencia del esquema anterior de COUNTIFS+HYPERLINK sobre una hoja
// compartida, donde todas las celdas de un grupo apuntaban al mismo primer
// renglón sin importar el filtro real).
function createDetailSheet(wb, ctx, { title, positions, columns, leftAlignCols = [], resumenCoordinate }) {
  ctx.counter += 1;
  const sheetName = `Det_${ctx.counter}`;
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: DATA_START_ROW - 1 }];
  ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

  const backCell = ws.getCell(1, 1);
  // HYPERLINK() en vez de cell.value={text,hyperlink}: exceljs escribe los enlaces
  // internos con una relación r:id apuntando a TargetMode="External" cuyo Target
  // es el propio texto "#'Hoja'!A1" (no una URL) — Excel no puede resolverlo y
  // marca "Referencia no válida" en TODOS los enlaces. La fórmula HYPERLINK()
  // no depende de relaciones externas, así que el salto interno funciona bien.
  backCell.value = { formula: `HYPERLINK("#'Resumen'!${resumenCoordinate}","← Volver al Resumen")`, result: '← Volver al Resumen' };
  backCell.font = { size: 9, name: FONT, color: { argb: C.GUINDA_LINK }, underline: true, italic: true };

  styleTitle(ws, 3, title, columns.length);

  const hRow = ws.getRow(5);
  columns.forEach((c, i) => { hRow.getCell(i + 1).value = c.label; });
  styleHeader(hRow);

  const sorted = [...positions].sort((a, b) => {
    const na = (a.Nivel || '').trim();
    const nb = (b.Nivel || '').trim();
    const nc = na.localeCompare(nb, 'es', { numeric: true });
    if (nc !== 0) return nc;
    return (a['Posición'] || '').localeCompare(b['Posición'] || '', 'es', { numeric: true });
  });

  sorted.forEach((pos, idx) => {
    const rowNum = DATA_START_ROW + idx;
    const row = ws.getRow(rowNum);
    columns.forEach((c, ci) => { row.getCell(ci + 1).value = pos[c.key] ?? ''; });
    styleDataRow(row, idx);

    row.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.GUINDA } };

    leftAlignCols.forEach(ci => {
      row.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  return sheetName;
}

// Escribe el conteo en `cell`; si hay al menos una posición, crea la hoja de
// detalle dedicada y convierte la celda en hipervínculo hacia ella.
function fillLinkedCell(wb, ctx, cell, positions, sheetOpts, fontWhenLinked) {
  const count = positions.length;
  if (count > 0) {
    const resumenCoordinate = cell.address;
    const sheetName = createDetailSheet(wb, ctx, { ...sheetOpts, positions, resumenCoordinate });
    cell.value = { formula: `HYPERLINK("#'${sheetName}'!A1","${count}")`, result: count };
    cell.font = { ...cell.font, ...(fontWhenLinked || { color: { argb: C.GUINDA_LINK }, underline: true }) };
  } else {
    cell.value = 0;
  }
  return count;
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

  const off = addExcelLetterhead(wb, ws, numDet);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: off + 4 }];

  styleTitle(ws, off + 1, 'OBSERVACIONES VACANCIA', numDet, C.GUINDA_OSC);

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

// Divide un conjunto de posiciones (ya con `_tipo` calculado) en los sub-conteos
// que muestra cada tabla por nivel — colapsando Eventual+Nueva Creación en una
// sola columna cuando el grupo no distingue Nueva Creación (hasNvaCr=false).
function tipoSubsets(positions, hasNvaCr) {
  if (hasNvaCr) {
    return {
      cols: ['Eventuales', 'Eventuales Nueva Creación', 'Permanentes', 'Total'],
      subsets: [
        positions.filter(p => p._tipo === TIPO.E),
        positions.filter(p => p._tipo === TIPO.NC),
        positions.filter(p => p._tipo === TIPO.P),
        positions,
      ],
    };
  }
  return {
    cols: ['Eventuales (incluye Nueva Creación)', 'Permanentes', 'Total'],
    subsets: [
      positions.filter(p => p._tipo === TIPO.E || p._tipo === TIPO.NC),
      positions.filter(p => p._tipo === TIPO.P),
      positions,
    ],
  };
}

// ── Resumen sheet ─────────────────────────────────────────────────────────────
function fillResumenSheet(wb, ctx, ws, cuadrosData, desgloseData, ocupadosData) {
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

  const off = addExcelLetterhead(wb, ws, 11);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: off + 3 }];

  const enrichedVac = desgloseData.map(pos => ({ ...pos, _tipo: classifyTipo(pos['Posición'] || '') }));
  const enrichedOcu = ocupadosData.map(pos => ({ ...pos, _tipo: classifyTipo(pos['Posición'] || '') }));

  // ── Sección I: Cuadro histórico ───────────────────────────────────────────
  styleTitle(ws, off + 1, 'I. CUADRO DE VACANCIA — HISTÓRICO DE OCUPACIÓN', 11);

  ws.mergeCells(off + 2, 1, off + 2, 11);
  const note = ws.getCell(off + 2, 1);
  note.value = '★  Los valores subrayados son hipervínculos: cada uno abre su propia hoja de detalle con las posiciones exactas de esa categoría (nunca comparten hoja con otra celda). La fila "Actual" refleja el momento de generación de este reporte.';
  note.font  = { italic: true, size: 9, color: { argb: 'FF78350F' }, name: FONT };
  note.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  note.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(off + 2).height = 20;

  const hRow = ws.addRow([
    'Año', 'Fecha',
    'Ocupadas Permanente', 'Ocupadas Eventual', 'Total Ocupadas',
    'Vacantes Permanente', 'Vacantes Eventual', 'Total Vacantes',
    'Total Permanente', 'Total Eventual', 'Total',
  ]);
  styleHeader(hRow);

  const sorted = [...cuadrosData].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const combinedGlobal = [
    ...enrichedOcu.map(p => ({ ...p, _estatus: 'Ocupada' })),
    ...enrichedVac.map(p => ({ ...p, _estatus: 'Vacante' })),
  ];

  const live = ws.addRow(['Actual', 'Actual (al momento de generar el reporte)', 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  live.getCell(1).value = new Date().getFullYear();
  live.height = 24;
  live.eachCell((cell, ci) => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.DORADO_BG } };
    cell.font  = { bold: true, size: 10, name: FONT, color: { argb: C.GUINDA } };
    cell.alignment = { vertical: 'middle', horizontal: ci === 2 ? 'left' : 'center' };
    cell.border = {
      top:    { style: 'medium', color: { argb: C.DORADO } },
      bottom: { style: 'medium', color: { argb: C.DORADO } },
      left:   { style: 'thin',   color: { argb: C.DORADO } },
      right:  { style: 'thin',   color: { argb: C.DORADO } },
    };
  });

  const globalCellDefs = [
    { col: 3,  label: 'Ocupadas Permanente',                                   subset: combinedGlobal.filter(p => p._estatus === 'Ocupada' && p._tipo === TIPO.P) },
    { col: 4,  label: 'Ocupadas Eventual (incluye Nueva Creación)',             subset: combinedGlobal.filter(p => p._estatus === 'Ocupada' && (p._tipo === TIPO.E || p._tipo === TIPO.NC)) },
    { col: 5,  label: 'Total Ocupadas',                                        subset: combinedGlobal.filter(p => p._estatus === 'Ocupada') },
    { col: 6,  label: 'Vacantes Permanente',                                   subset: combinedGlobal.filter(p => p._estatus === 'Vacante' && p._tipo === TIPO.P) },
    { col: 7,  label: 'Vacantes Eventual (incluye Nueva Creación)',            subset: combinedGlobal.filter(p => p._estatus === 'Vacante' && (p._tipo === TIPO.E || p._tipo === TIPO.NC)) },
    { col: 8,  label: 'Total Vacantes',                                        subset: combinedGlobal.filter(p => p._estatus === 'Vacante') },
    { col: 9,  label: 'Total Permanente (Ocupadas + Vacantes)',                subset: combinedGlobal.filter(p => p._tipo === TIPO.P) },
    { col: 10, label: 'Total Eventual (Ocupadas + Vacantes, incl. Nva. Cr.)',  subset: combinedGlobal.filter(p => p._tipo === TIPO.E || p._tipo === TIPO.NC) },
    { col: 11, label: 'Total General (Ocupadas + Vacantes)',                   subset: combinedGlobal },
  ];

  globalCellDefs.forEach(({ col, label, subset }) => {
    fillLinkedCell(wb, ctx, live.getCell(col), subset, {
      title: `Detalle — ${label}`,
      columns: GLOBAL_COLS,
      leftAlignCols: [6, 7, 8, 11, 20],
    });
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

  // ── Sección II: Tablas por nivel, cada celda con su propia hoja de detalle ──
  ws.addRow([]);
  const sec2Row = ws.addRow(['II. CUADROS DE VACANCIA POR NIVEL']);
  styleTitle(ws, sec2Row.number, 'II. CUADROS DE VACANCIA POR NIVEL', 11, C.GUINDA_OSC);

  const groups = [
    { title: 'Posiciones Vacantes — Niveles Operativos', filter: i => /^\d/.test((i.Nivel || '').trim()), hasNvaCr: false },
    { title: 'Posiciones Vacantes — Nivel K',            filter: i => /^K/i.test((i.Nivel || '').trim()), hasNvaCr: false },
    { title: 'Posiciones Vacantes — Niveles P',          filter: i => /^P/i.test((i.Nivel || '').trim()), hasNvaCr: true  },
    { title: 'Posiciones Vacantes — Nivel S',            filter: i => /^S/i.test((i.Nivel || '').trim()), hasNvaCr: true  },
    { title: 'Posiciones Vacantes — Nivel A',            filter: i => /^A/i.test((i.Nivel || '').trim()), hasNvaCr: true  },
    { title: 'Posiciones Vacantes — Nivel D',            filter: i => /^D/i.test((i.Nivel || '').trim()), hasNvaCr: true  },
  ];

  groups.forEach(({ title, filter, hasNvaCr }) => {
    const positions = enrichedVac.filter(filter);
    if (positions.length === 0) return;

    const levels = [...new Set(positions.map(p => (p.Nivel || '').trim()))]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

    ws.addRow([]);
    const subTRow = ws.addRow([title]);
    const numCols = hasNvaCr ? 5 : 4;
    styleTitle(ws, subTRow.number, title, numCols, C.GUINDA);

    const headers = hasNvaCr
      ? ['Nivel', 'Eventuales', 'Eventuales Nueva Creación', 'Permanentes', 'Total']
      : ['Nivel', 'Eventuales (incluye Nueva Creación)', 'Permanentes', 'Total'];
    const hRowN = ws.addRow(headers);
    styleHeader(hRowN);

    levels.forEach((nivel, idx) => {
      const levelPositions = positions.filter(p => (p.Nivel || '').trim() === nivel);
      const { cols: tipoLabels, subsets } = tipoSubsets(levelPositions, hasNvaCr);

      const dr = ws.addRow([nivel, ...subsets.map(() => 0)]);
      styleDataRow(dr, idx);
      dr.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.GUINDA } };
      dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      subsets.forEach((subset, si) => {
        fillLinkedCell(wb, ctx, dr.getCell(si + 2), subset, {
          title: `${title} — Nivel ${nivel} — ${tipoLabels[si]}`,
          columns: DET_COLS,
          leftAlignCols: [5, 6, 7, 10],
        });
      });
    });

    const { cols: totLabels, subsets: totSubsets } = tipoSubsets(positions, hasNvaCr);
    const totRow = ws.addRow(['Total', ...totSubsets.map(() => 0)]);
    styleTotalRow(totRow);
    totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    totSubsets.forEach((subset, si) => {
      fillLinkedCell(wb, ctx, totRow.getCell(si + 2), subset, {
        title: `${title} — TOTAL — ${totLabels[si]}`,
        columns: DET_COLS,
        leftAlignCols: [5, 6, 7, 10],
      }, { underline: true });
    });
  });

  // ── Sección III: Observaciones Vacancia ───────────────────────────────────
  ws.addRow([]);
  const sec3Row = ws.addRow(['III. OBSERVACIONES VACANCIA']);
  styleTitle(ws, sec3Row.number, 'III. OBSERVACIONES VACANCIA', 11, C.GUINDA_OSC);

  const obsGroups = [
    { label: 'Contratación Base (SAT_BSE)', subset: enrichedVac.filter(p => (p['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE') },
    { label: 'Órgano Interno de Control',   subset: enrichedVac.filter(p => (p['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control') },
    { label: 'Titulares de Aduanas',        subset: enrichedVac.filter(p => (p['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA')) },
  ];
  const obsTotalIdx = new Set();
  enrichedVac.forEach((p, idx) => {
    const isBase    = (p['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
    const isOic     = (p['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
    const isTitular = (p['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');
    if (isBase || isOic || isTitular) obsTotalIdx.add(idx);
  });
  const obsTotalSubset = enrichedVac.filter((_, idx) => obsTotalIdx.has(idx));

  const obsHRow = ws.addRow(['Categoría', 'Total']);
  styleHeader(obsHRow);

  obsGroups.forEach(({ label, subset }, idx) => {
    const dr = ws.addRow([label, 0]);
    styleDataRow(dr, idx);
    dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    fillLinkedCell(wb, ctx, dr.getCell(2), subset, {
      title: `Observaciones Vacancia — ${label}`,
      columns: DET_COLS,
      leftAlignCols: [5, 6, 7, 10],
    });
  });

  const obsTotRow = ws.addRow(['Total (unión de las tres categorías)', 0]);
  styleTotalRow(obsTotRow);
  obsTotRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  fillLinkedCell(wb, ctx, obsTotRow.getCell(2), obsTotalSubset, {
    title: 'Observaciones Vacancia — TOTAL',
    columns: DET_COLS,
    leftAlignCols: [5, 6, 7, 10],
  }, { underline: true });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateCuadroVacanciaExcel(cuadrosData, desgloseData, ocupadosData = []) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EjeCentral — ANAM';
  wb.created = new Date();

  // Resumen debe quedar como hoja #1 — se agrega vacía y se llena después,
  // aunque ahora las hojas de detalle se crean "al vuelo" mientras se llena
  // (cada celda con conteo > 0 agrega su propia hoja justo en ese momento).
  const wsResumen = wb.addWorksheet('Resumen');
  const ctx = { counter: 0 };

  fillResumenSheet(wb, ctx, wsResumen, cuadrosData, desgloseData, ocupadosData);

  const obs = buildObservaciones(desgloseData);
  addObservacionesSheet(wb, obs);

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
