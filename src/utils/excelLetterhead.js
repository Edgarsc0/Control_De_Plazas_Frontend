// Membretado institucional compartido por TODOS los generadores de Excel del
// sistema (cuadroVacanciaExcel, excelExport, BajasTab, SimuladorValuacion,
// MovimientosPersonalTab, AlineacionOrganizacionalTab, PlantillaDetalleTab).
// Diseño apilado (logo → título → leyenda) para no depender de cuántas
// columnas tenga cada hoja — evita colisiones de layout hoja por hoja.
import {
  LETTERHEAD_LOGO_BASE64,
  LETTERHEAD_LOGO_WIDTH,
  LETTERHEAD_LOGO_HEIGHT,
} from '@/assets/letterhead-logo';

const TITLE_LINES = [
  'AGENCIA NACIONAL DE ADUANAS DE MÉXICO',
  'UNIDAD DE ADMINISTRACIÓN Y FINANZAS',
  'DIRECCIÓN DE RECURSOS HUMANOS',
];

const LOGO_DISPLAY_WIDTH = 260;
const LOGO_DISPLAY_HEIGHT = Math.round((LOGO_DISPLAY_WIDTH * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);

// Filas que ocupa el membretado: 1=logo, 2=título (3 líneas envueltas),
// 3=leyenda de generación, 4=separador en blanco. El contenido real de cada
// hoja debe arrancar en la fila LETTERHEAD_ROWS + 1.
export const LETTERHEAD_ROWS = 4;

function fmtFechaHoraGeneracion() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${hora} horas del ${fecha}`;
}

/**
 * Inserta el membretado (logo Hacienda/ANAM + título + leyenda de generación)
 * en las primeras filas de `worksheet`. Debe llamarse ANTES de escribir
 * cualquier otro contenido en la hoja — el contenido real debe empezar en la
 * fila `LETTERHEAD_ROWS + 1` (usar el valor exportado, no un número mágico).
 *
 * @param {import('exceljs').Workbook} workbook
 * @param {import('exceljs').Worksheet} worksheet
 * @param {number} numCols - número de columnas de la hoja, para saber hasta dónde fusionar.
 */
export function addExcelLetterhead(workbook, worksheet, numCols) {
  const cols = Math.max(numCols, 1);

  const imageId = workbook.addImage({ base64: LETTERHEAD_LOGO_BASE64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 0.1, row: 0.1 },
    ext: { width: LOGO_DISPLAY_WIDTH, height: LOGO_DISPLAY_HEIGHT },
  });
  worksheet.getRow(1).height = Math.max(Math.round(LOGO_DISPLAY_HEIGHT * 0.85), 34);

  worksheet.mergeCells(2, 1, 2, cols);
  const titleCell = worksheet.getCell(2, 1);
  titleCell.value = TITLE_LINES.join('\n');
  titleCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF621F32' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.getRow(2).height = 54;

  worksheet.mergeCells(3, 1, 3, cols);
  const legendCell = worksheet.getCell(3, 1);
  legendCell.value = `Reporte generado por el sistema de control de plazas a las ${fmtFechaHoraGeneracion()}.`;
  legendCell.font = { italic: true, size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' };
  legendCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 18;

  worksheet.getRow(4).height = 8;

  return LETTERHEAD_ROWS;
}
