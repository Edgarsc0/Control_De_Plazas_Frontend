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
 * @param {number} [logoWidth] - ancho del logo en px; por defecto 260 (el tamaño estándar del resto del sistema).
 */
export function addExcelLetterhead(workbook, worksheet, numCols, logoWidth = LOGO_DISPLAY_WIDTH) {
  const cols = Math.max(numCols, 1);
  const logoHeight = Math.round((logoWidth * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);

  const imageId = workbook.addImage({ base64: LETTERHEAD_LOGO_BASE64, extension: 'png' });
  worksheet.addImage(imageId, {
    tl: { col: 0.1, row: 0.1 },
    ext: { width: logoWidth, height: logoHeight },
  });
  // Margen generoso (bastante por encima de la conversión exacta px->pt de
  // Excel, ~0.75) para que la fila 1 SIEMPRE contenga el logo completo sin
  // invadir la fila 2 (título) — con logos grandes un margen ajustado se
  // nota y "recorta" visualmente el encabezado.
  worksheet.getRow(1).height = Math.max(Math.round(logoHeight * 1.05), 34);

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
