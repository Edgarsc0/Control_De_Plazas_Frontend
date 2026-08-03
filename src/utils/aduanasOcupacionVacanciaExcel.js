import { addExcelLetterhead } from './excelLetterhead';

// Mismo esquema de color institucional que el resto de generadores de Excel
// del sistema (ver cuadroVacanciaExcel.js) — guinda como color fuerte único,
// dorado solo como acento de borde.
const C = {
  GUINDA:      'FF621F32',
  GUINDA_OSC:  'FF3D131F',
  GUINDA_LINK: 'FF8C2F49',
  DORADO:      'FFBC955C',
  BLANCO:      'FFFFFFFF',
  GRIS:        'FFF8FAFC',
  TEXTO:       'FF334155',
};
const FONT = 'Calibri';

// Columnas de la hoja de detalle de Vacancia — mismo esquema crudo que entrega
// VacantesService.getDesgloseJerarquico() (idéntico a DET_COLS en cuadroVacanciaExcel.js).
const VAC_COLS = [
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

// Detalle de Ocupación: identidad de empleado al frente + mismas columnas de
// puesto/ubicación que Vacancia (sin Fecha Vacancia, que no aplica a una plaza ocupada).
const OCUP_COLS = [
  { key: 'Id Empleado', label: 'Número de Empleado', width: 18 },
  { key: 'Nombres',     label: 'Nombre',             width: 34 },
  { key: 'RFC',         label: 'RFC',                width: 16 },
  { key: 'CURP',        label: 'CURP',               width: 20 },
  ...VAC_COLS.filter((c) => c.key !== 'Fecha Vacancia'),
];

const LEFT_ALIGN_KEYS = ['Nombre Puesto Funcional', 'Unidad de Negocio', 'nombre_ua', 'nombreNJ', 'Nombres'];

function leftAlignIndices(cols) {
  return cols
    .map((c, i) => (LEFT_ALIGN_KEYS.includes(c.key) ? i + 1 : null))
    .filter((i) => i !== null);
}

const DATA_START_ROW = 6; // fila1=volver, fila3=título, fila5=encabezados, fila6+=datos

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
  row.eachCell((cell) => {
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
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { size: 10, name: FONT, color: { argb: C.TEXTO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });
}

// ── Hoja de detalle dedicada por celda (Ocup o Vac de una Aduana x NJ x Nivel) ──
function createDetailSheet(wb, ctx, { title, positions, columns, resumenCoordinate }) {
  ctx.counter += 1;
  const sheetName = `Det_${ctx.counter}`;
  const ws = wb.addWorksheet(sheetName);
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: DATA_START_ROW - 1 }];
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  const backCell = ws.getCell(1, 1);
  // HYPERLINK() en vez de cell.value={text,hyperlink}: exceljs escribe enlaces
  // internos con relación r:id -> TargetMode="External" que Excel no resuelve
  // ("Referencia no válida"); la fórmula HYPERLINK() sí funciona para saltos internos.
  backCell.value = { formula: `HYPERLINK("#'Resumen'!${resumenCoordinate}","← Volver al Resumen")`, result: '← Volver al Resumen' };
  backCell.font = { size: 9, name: FONT, color: { argb: C.GUINDA_LINK }, underline: true, italic: true };

  styleTitle(ws, 3, title, columns.length);

  const hRow = ws.getRow(5);
  columns.forEach((c, i) => { hRow.getCell(i + 1).value = c.label; });
  styleHeader(hRow);

  const leftAlign = leftAlignIndices(columns);
  const sorted = [...positions].sort((a, b) =>
    (a['Posición'] || '').localeCompare(b['Posición'] || '', 'es', { numeric: true })
  );

  sorted.forEach((pos, idx) => {
    const rowNum = DATA_START_ROW + idx;
    const row = ws.getRow(rowNum);
    columns.forEach((c, ci) => { row.getCell(ci + 1).value = pos[c.key] ?? ''; });
    styleDataRow(row, idx);
    leftAlign.forEach((ci) => {
      row.getCell(ci).alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  return sheetName;
}

// Escribe el conteo en `cell`; si hay al menos una posición, crea la hoja de
// detalle dedicada y convierte la celda en hipervínculo hacia ella.
function fillLinkedCell(wb, ctx, cell, positions, sheetOpts) {
  const count = positions.length;
  if (count > 0) {
    const resumenCoordinate = cell.address;
    const sheetName = createDetailSheet(wb, ctx, { ...sheetOpts, positions, resumenCoordinate });
    cell.value = { formula: `HYPERLINK("#'${sheetName}'!A1","${count}")`, result: count };
    cell.font = { bold: true, size: 10, name: FONT, color: { argb: C.GUINDA_LINK }, underline: true };
  } else {
    cell.value = 0;
    cell.font = { size: 10, name: FONT, color: { argb: 'FFCBD5E1' } };
  }
}

function filterDetail(source, aduana, nj, nivel) {
  const njNormalizado = nj || '';
  return (source || []).filter((item) => {
    const itemAduana = String(item['Aduana'] || '').trim();
    const itemNj = String(item['NJ'] ?? '').trim();
    const itemNivel = String(item['Nivel'] || '').trim();
    return itemAduana === aduana && itemNj === njNormalizado && itemNivel === nivel;
  });
}

// ── Resumen sheet: replica el header de 3 filas (NJ / Nivel / Ocup-Vac) de
// GroupedCountTable, con cada celda de conteo > 0 convertida en hipervínculo. ──
function fillResumenSheet(wb, ctx, ws, gruposNj, filas, vacantes, ocupados) {
  const pares = gruposNj.flatMap((g) => g.niveles.map((nivel) => ({ nj: g.nj, nivel })));
  const numCols = 1 + pares.length * 2;

  ws.columns = [
    { key: 'aduana', width: 24 },
    ...pares.flatMap((_, i) => ([
      { key: `ocup_${i}`, width: 10 },
      { key: `vac_${i}`,  width: 10 },
    ])),
  ];

  const off = addExcelLetterhead(wb, ws, numCols);
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: off + 3 }];

  styleTitle(ws, off + 1, 'OCUPACIÓN VS VACANCIA POR ADUANA', numCols);

  ws.mergeCells(off + 2, 1, off + 2, numCols);
  const note = ws.getCell(off + 2, 1);
  note.value = '★  Los valores subrayados son hipervínculos: cada uno abre su propia hoja de detalle con las posiciones exactas de esa celda (nunca comparten hoja con otra celda).';
  note.font  = { italic: true, size: 9, color: { argb: 'FF78350F' }, name: FONT };
  note.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  note.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(off + 2).height = 20;

  // ── Fila 1 de header: Aduana (rowspan 3) + grupo NJ (colspan niveles*2) ──
  const hr1 = off + 3, hr2 = off + 4, hr3 = off + 5;
  ws.mergeCells(hr1, 1, hr3, 1);
  const aduanaHeader = ws.getCell(hr1, 1);
  aduanaHeader.value = 'Aduana';
  styleHeader(ws.getRow(hr1));

  let col = 2;
  gruposNj.forEach((g) => {
    const span = g.niveles.length * 2;
    if (span > 1) ws.mergeCells(hr1, col, hr1, col + span - 1);
    ws.getCell(hr1, col).value = g.label;
    col += span;
  });
  styleHeader(ws.getRow(hr1));

  // ── Fila 2: Nivel (colspan 2 por nivel) ──
  col = 2;
  gruposNj.forEach((g) => {
    g.niveles.forEach((nivel) => {
      ws.mergeCells(hr2, col, hr2, col + 1);
      ws.getCell(hr2, col).value = nivel;
      col += 2;
    });
  });
  styleHeader(ws.getRow(hr2));

  // ── Fila 3: Ocup / Vac ──
  col = 2;
  pares.forEach(() => {
    ws.getCell(hr3, col).value = 'Ocup';
    ws.getCell(hr3, col + 1).value = 'Vac';
    col += 2;
  });
  styleHeader(ws.getRow(hr3));

  // ── Filas de datos ──
  const dataStartRow = hr3 + 1;
  filas.forEach((row, idx) => {
    const rowNum = dataStartRow + idx;
    const dr = ws.getRow(rowNum);
    dr.getCell(1).value = row.aduana;
    styleDataRow(dr, idx);
    dr.getCell(1).font = { bold: true, size: 10, name: FONT, color: { argb: C.GUINDA } };
    dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    let c = 2;
    pares.forEach(({ nj, nivel }) => {
      const ocupCount = row.ocupacion?.[`${nj}|${nivel}`] ?? 0;
      const vacCount  = row.vacancia?.[`${nj}|${nivel}`] ?? 0;

      const ocupCell = dr.getCell(c);
      fillLinkedCell(wb, ctx, ocupCell, ocupCount > 0 ? filterDetail(ocupados, row.aduana, nj, nivel) : [], {
        title: `${row.aduana} — ${nivel} — Ocupación`,
        columns: OCUP_COLS,
      });

      const vacCell = dr.getCell(c + 1);
      fillLinkedCell(wb, ctx, vacCell, vacCount > 0 ? filterDetail(vacantes, row.aduana, nj, nivel) : [], {
        title: `${row.aduana} — ${nivel} — Vacancia`,
        columns: VAC_COLS,
      });

      c += 2;
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
// `gruposNj`/`filas`: mismos datos que alimentan GroupedCountTable (data.grupos_nj
// y filasFiltradas) en AduanasOcupacionVacanciaTab.jsx. `vacantes`/`ocupados`:
// datasets crudos de VacantesService.getDesgloseJerarquico()/getDesgloseJerarquicoOcupados()
// (mismos que consume el modal de detalle bajo demanda de ese tab).
export async function generateAduanasOcupacionVacanciaExcel(gruposNj, filas, vacantes, ocupados) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EjeCentral — ANAM';
  wb.created = new Date();

  const wsResumen = wb.addWorksheet('Resumen');
  const ctx = { counter: 0 };

  fillResumenSheet(wb, ctx, wsResumen, gruposNj, filas, vacantes, ocupados);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `Ocupacion_Vacancia_Aduanas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
