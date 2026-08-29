// Exportación del Anexo 2 a .xlsx reproduciendo el formato oficial de la
// Unidad de Diseño Presupuestario (mismos anchos, mismo orden de columnas,
// mismos textos y mismas celdas combinadas que el archivo de referencia).
//
// El libro lleva UNA PESTAÑA POR HOJA capturada (ver `hojas` en
// AnuenciaTab.jsx): una misma solicitud puede cubrir varias Unidades
// Administrativas, cada una con su propio cuadro de plazas y su propia
// justificación.
//
// A propósito NO lleva el membretado institucional de ANAM
// (`addExcelLetterhead`, que sí usan el resto de los exports del sistema):
// este documento es un formato externo que se entrega tal cual a la UDPCSG,
// así que alterar su encabezado lo invalidaría como formato oficial.

import { ANEXO2_COLUMNAS, ANEXO2_TEXTOS, NOMBRE_HOJA_MAX, sanitizarNombreHoja } from './anexo2Schema';

const BORDE_FINO = { style: 'thin', color: { argb: 'FF000000' } };
const BORDE_COMPLETO = { top: BORDE_FINO, left: BORDE_FINO, bottom: BORDE_FINO, right: BORDE_FINO };

// El cuadro arranca en la columna B (la A es un margen angosto), igual que
// el archivo original.
const COL_INICIO = 2;
const COL_FIN = COL_INICIO + ANEXO2_COLUMNAS.length - 1; // M

/**
 * Las columnas de fecha se capturan como 'YYYY-MM-DD' (`<input type="date">`)
 * pero deben quedar como FECHA real en el .xlsx, no como texto — el archivo
 * original las trae así y la UDPCSG las ordena/filtra.
 *
 * Se construye con `Date.UTC` a propósito: ExcelJS convierte a serial de Excel
 * usando el instante UTC, así que una fecha creada en hora LOCAL se recorrería
 * un día en husos con offset positivo (el capturista vería 31/01 donde escribió
 * 01/02). Con UTC el día queda fijo sin importar dónde se abra el sistema.
 */
function aFechaExcel(valor) {
    const texto = String(valor ?? '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!m) return texto; // vacío o formato libre: se deja tal cual
    const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(fecha.getTime()) ? texto : fecha;
}

/**
 * Excel exige nombres de pestaña únicos (sin distinguir mayúsculas) y de a lo
 * más 31 caracteres. En pantalla nada impide llamar igual a dos hojas, así que
 * aquí se desempata con un sufijo " (2)", " (3)"... recortando lo necesario
 * para no pasarse del límite. Si se dejara pasar un duplicado, ExcelJS lanza
 * y no se generaría ningún archivo.
 *
 * @param {string} nombre - Nombre capturado.
 * @param {Set<string>} usados - Nombres ya asignados (en minúsculas); se muta.
 * @param {number} indice - Posición de la hoja, para el nombre de respaldo.
 */
function nombreHojaUnico(nombre, usados, indice) {
    const base = sanitizarNombreHoja(nombre).trim() || `Hoja ${indice + 1}`;
    let candidato = base;
    let n = 2;
    while (usados.has(candidato.toLowerCase())) {
        const sufijo = ` (${n})`;
        candidato = `${base.slice(0, NOMBRE_HOJA_MAX - sufijo.length)}${sufijo}`;
        n += 1;
    }
    usados.add(candidato.toLowerCase());
    return candidato;
}

/**
 * Escribe una hoja del Anexo 2 en la worksheet dada: encabezado, cuadro de
 * plazas, justificación y firma. Es el formato completo — cada pestaña del
 * libro es un Anexo 2 autocontenido, tal como se entrega.
 */
function escribirHoja(ws, { filas, unidadAdministrativa, justificacion, firmaNombre, firmaPuesto }) {
    // Columna A: margen angosto del formato original.
    ws.getColumn(1).width = 2.57;
    ANEXO2_COLUMNAS.forEach((col, i) => {
        ws.getColumn(COL_INICIO + i).width = col.anchoExcel;
    });

    // --- Encabezado ---
    ws.getCell(1, COL_INICIO).value = ANEXO2_TEXTOS.dependencia;
    ws.getCell(1, COL_INICIO).font = { bold: true, size: 10 };

    ws.getCell(2, COL_INICIO).value = ANEXO2_TEXTOS.titulo;
    ws.getCell(2, COL_INICIO).font = { bold: true, size: 10 };

    ws.getCell(3, COL_INICIO).value = ANEXO2_TEXTOS.instruccion;
    ws.getCell(3, COL_INICIO).font = { size: 10 };

    // "Unidad Administrativa: ..." va alineado a la derecha, en la última
    // columna del cuadro (M en el original).
    const celdaUA = ws.getCell(3, COL_FIN);
    celdaUA.value = `Unidad Administrativa: ${unidadAdministrativa || ''}`.trim();
    celdaUA.font = { bold: true, size: 10 };
    celdaUA.alignment = { horizontal: 'right', vertical: 'top', wrapText: true };
    ws.getRow(3).height = 27.75;

    // --- Fila de encabezados del cuadro (fila 6 en el original) ---
    const FILA_ENCABEZADO = 6;
    const filaEnc = ws.getRow(FILA_ENCABEZADO);
    ANEXO2_COLUMNAS.forEach((col, i) => {
        const celda = filaEnc.getCell(COL_INICIO + i);
        celda.value = col.label;
        celda.font = { bold: true, size: 9 };
        celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        celda.border = BORDE_COMPLETO;
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    });
    filaEnc.height = 54.6;

    // --- Filas de datos ---
    filas.forEach((fila, idx) => {
        const filaXlsx = ws.getRow(FILA_ENCABEZADO + 1 + idx);
        ANEXO2_COLUMNAS.forEach((col, i) => {
            const celda = filaXlsx.getCell(COL_INICIO + i);
            if (col.tipo === 'fecha' || col.tipo === 'fecha_vacancia') {
                celda.value = aFechaExcel(fila[col.key]);
                if (celda.value instanceof Date) celda.numFmt = 'dd/mm/yyyy';
            } else if (col.tipo === 'numero') {
                const n = Number(fila[col.key]);
                celda.value = String(fila[col.key] ?? '').trim() === '' || Number.isNaN(n) ? '' : n;
            } else {
                celda.value = fila[col.key] ?? '';
            }
            celda.font = { size: 10 };
            celda.alignment = {
                horizontal: col.key === 'denominacion_puesto' ? 'left' : 'center',
                vertical: 'middle',
                wrapText: true,
            };
            celda.border = BORDE_COMPLETO;
        });
        filaXlsx.height = 33.75;
    });

    // --- Nota de responsabilidad, justo debajo del cuadro ---
    const filaNota = FILA_ENCABEZADO + 1 + filas.length;
    ws.getCell(filaNota, COL_INICIO).value = ANEXO2_TEXTOS.notaResponsabilidad;
    ws.getCell(filaNota, COL_INICIO).font = { size: 9, italic: true };

    // --- Bloque de justificación (título + cuerpo, ambos combinados B..M) ---
    const filaTituloJust = filaNota + 2;
    ws.mergeCells(filaTituloJust, COL_INICIO, filaTituloJust, COL_FIN);
    const celdaTituloJust = ws.getCell(filaTituloJust, COL_INICIO);
    celdaTituloJust.value = ANEXO2_TEXTOS.tituloJustificacion;
    celdaTituloJust.font = { bold: true, size: 9 };
    celdaTituloJust.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    celdaTituloJust.border = BORDE_COMPLETO;

    // El cuerpo ocupa un bloque alto (7 filas en el original) para que el
    // texto largo quepa sin que Excel lo recorte al abrir el archivo.
    const FILAS_CUERPO_JUST = 7;
    const filaCuerpoIni = filaTituloJust + 1;
    const filaCuerpoFin = filaCuerpoIni + FILAS_CUERPO_JUST - 1;
    ws.mergeCells(filaCuerpoIni, COL_INICIO, filaCuerpoFin, COL_FIN);
    const celdaCuerpoJust = ws.getCell(filaCuerpoIni, COL_INICIO);
    celdaCuerpoJust.value = justificacion || '';
    celdaCuerpoJust.font = { size: 10 };
    celdaCuerpoJust.alignment = { horizontal: 'justify', vertical: 'top', wrapText: true };
    celdaCuerpoJust.border = BORDE_COMPLETO;
    for (let r = filaCuerpoIni; r <= filaCuerpoFin; r++) ws.getRow(r).height = 110;

    // --- Pie ---
    const filaNotaLegible = filaCuerpoFin + 1;
    ws.getCell(filaNotaLegible, COL_INICIO).value = ANEXO2_TEXTOS.notaLegible;
    ws.getCell(filaNotaLegible, COL_INICIO).font = { size: 9, italic: true };

    // --- Firma (celda combinada F23:I24 en el original: nombre + puesto,
    // centrados, sobre las columnas centrales del cuadro) — 2 filas de
    // espacio antes, igual que el original. `border.top` marca la línea de
    // firma, como en un formato impreso. ---
    const filaFirmaIni = filaNotaLegible + 3;
    const filaFirmaFin = filaFirmaIni + 1;
    const colFirmaIni = COL_INICIO + 4;
    const colFirmaFin = COL_INICIO + 7;
    ws.mergeCells(filaFirmaIni, colFirmaIni, filaFirmaFin, colFirmaFin);
    const celdaFirma = ws.getCell(filaFirmaIni, colFirmaIni);
    celdaFirma.value = [firmaNombre, firmaPuesto].filter((v) => String(v || '').trim()).join('\n');
    celdaFirma.font = { bold: true, size: 10 };
    celdaFirma.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    celdaFirma.border = { top: BORDE_FINO };
}

/**
 * Arma el workbook del Anexo 2 (sin descargarlo), con una pestaña por hoja
 * capturada. Separado de `exportarAnexo2` para poder verificar la estructura
 * del archivo generado sin depender del DOM.
 *
 * La firma es del libro completo, no de cada hoja: quien autoriza la solicitud
 * es la misma persona aunque cubra varias unidades — se repite al pie de cada
 * pestaña porque cada una se entrega como un formato autocontenido.
 *
 * @param {Object} params
 * @param {Object[]} params.hojas - Hojas del libro (ver `crearHojaVacia`).
 * @param {string} [params.firmaNombre] - Nombre de quien firma (celda F23:I24 del original).
 * @param {string} [params.firmaPuesto] - Puesto de quien firma.
 * @param {*} [params.ExcelJSModule] - Inyectable en pruebas; por defecto se importa dinámicamente.
 * @returns {Promise<import('exceljs').Workbook>}
 */
export async function construirWorkbookAnexo2({ hojas, firmaNombre, firmaPuesto, ExcelJSModule }) {
    const ExcelJS = ExcelJSModule || (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    // Un libro sin hojas no es un .xlsx válido; si llegara vacío se genera una
    // pestaña en blanco con el formato, que es lo que el usuario vería en
    // pantalla de todos modos.
    const hojasAExportar = Array.isArray(hojas) && hojas.length ? hojas : [{}];
    const nombresUsados = new Set();

    hojasAExportar.forEach((hoja, i) => {
        const ws = workbook.addWorksheet(nombreHojaUnico(hoja.nombre, nombresUsados, i));
        escribirHoja(ws, {
            filas: hoja.filas || [],
            unidadAdministrativa: hoja.unidad_administrativa,
            justificacion: hoja.justificacion,
            firmaNombre,
            firmaPuesto,
        });
    });

    return workbook;
}

/**
 * Genera y descarga el Anexo 2 con los datos capturados.
 *
 * @param {Object} params - Igual que `construirWorkbookAnexo2`, más `nombreArchivo`.
 */
export async function exportarAnexo2({ hojas, firmaNombre, firmaPuesto, nombreArchivo }) {
    const workbook = await construirWorkbookAnexo2({ hojas, firmaNombre, firmaPuesto });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const nombreBase = String(nombreArchivo || '').trim() || 'Anexo 2 solicitud de ocupación de plazas';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreBase}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
