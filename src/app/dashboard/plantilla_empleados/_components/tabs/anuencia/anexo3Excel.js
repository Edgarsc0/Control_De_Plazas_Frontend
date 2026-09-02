// Exportación del ANEXO 3 (Formato Único de Movimientos Presupuestarios de
// Servicios Personales) a .xlsx, replicando el formato oficial de la UDPCSG
// celda por celda: mismos anchos de columna, mismas celdas combinadas, mismo
// membretado SHCP y mismos formatos numéricos que el archivo de referencia
// (`Anexo 3 - FUMP_Even_1 plaza_16 Feb-Dic 2026_DGMEIA(1).xlsx`).
//
// Un libro puede traer VARIAS hojas: el Anexo 3 se calcula por Unidad
// Administrativa y por período, así que cada grupo detectado en el Anexo 2
// (misma UA + misma fecha de alta) se vuelve una pestaña. El agrupamiento y
// la valuación los hace el backend (`AnuenciaAnexo3View`); aquí sólo se
// dibuja.

import { ANEXO3_LOGO_BASE64 } from '@/assets/anexo3-logo';

const FUENTE = 'Soberana Sans Light';

// El marco del formato oficial se dibuja con línea `medium`; las divisiones
// internas del bloque de identificación (dependencia / entidad / tipo de
// personal) con línea `thin`.
const BORDE_MEDIO = { style: 'medium', color: { argb: 'FF000000' } };
const BORDE_FINO = { style: 'thin', color: { argb: 'FF000000' } };

// Formato contable del original (alinea el signo y deja "-" en los ceros).
const FMT_MONEDA = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-';
const FMT_MONEDA_TOTAL = '#,##0.00\\ ;[Red]\\-#,##0.00\\ ;\\ "-"_-;_-@_-';
const FMT_ENTERO_TOTAL = '#,##0\\ ;[Red]\\-#,##0\\ ;\\ "-"_-;_-@_-';

const MESES_ES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// Anchos de las columnas A..V del formato original.
const ANCHOS = [
    3.43, 10.0, 8.43, 7.43, 7.71, 8.14, 7.86, 15.0, 33.86, 12.71, 13.0,
    18.14, 20.57, 21.0, 7.0, 14.43, 16.0, 19.14, 21.0, 10.86, 12.86, 10.86,
];

/** 'YYYY-MM-DD' → "16 DE FEBRERO" (sin desfase por huso horario). */
function fechaLarga(iso) {
    const [, m, d] = String(iso || '').split('-').map(Number);
    if (!m || !d) return '';
    return `${d} DE ${MESES_ES[m - 1]}`;
}

function anioDe(iso) {
    return String(iso || '').slice(0, 4);
}

/** "DEL 16 DE FEBRERO AL 31 DE DICIEMBRE DE 2026" */
function textoVigencia(fechaInicio, fechaFin) {
    const ini = fechaLarga(fechaInicio);
    const fin = fechaLarga(fechaFin);
    const anio = anioDe(fechaFin) || anioDe(fechaInicio);
    if (!ini || !fin) return '';
    return `DEL ${ini} AL ${fin} DE ${anio}`;
}

/**
 * El formato oficial reporta "EVENTUAL" o "PERMANENTE" según la partida de
 * las plazas del grupo. Si el grupo mezcla partidas (raro, pero posible al
 * capturar a mano), se listan todas para no afirmar algo falso.
 */
function tipoDePersonal(plazas) {
    const tipos = new Set(
        (plazas || []).map((p) => (p.partida === '12201' ? 'EVENTUAL' : 'PERMANENTE'))
    );
    return [...tipos].join(' / ') || 'EVENTUAL';
}

/** Aplica la fuente institucional a una celda ya escrita. */
function estilo(celda, { bold = false, size = 12, align, valign, wrap, fmt } = {}) {
    celda.font = { name: FUENTE, size, bold };
    if (align || valign || wrap) {
        // ExcelJS llama 'middle' al centrado vertical ('center' sólo es válido
        // en el horizontal) y descarta en silencio cualquier otro valor, así
        // que se traduce aquí y los llamadores pueden decir 'center' en ambos.
        const vertical = valign === 'center' ? 'middle' : valign;
        celda.alignment = { horizontal: align, vertical, wrapText: wrap };
    }
    if (fmt) celda.numFmt = fmt;
}

// --- Bordes ----------------------------------------------------------------
// `spec` lleva una letra por lado: t=arriba, l=izquierda, b=abajo, r=derecha.
// MAYÚSCULA = línea medium (marco), minúscula = thin (división interna).
// Ej.: 'TLb' = arriba y a la izquierda gruesas, abajo delgada.

const LADOS = { t: 'top', l: 'left', b: 'bottom', r: 'right' };

function bordes(spec) {
    const b = {};
    for (const ch of String(spec)) {
        const lado = LADOS[ch.toLowerCase()];
        if (lado) b[lado] = ch === ch.toUpperCase() ? BORDE_MEDIO : BORDE_FINO;
    }
    return b;
}

/**
 * Pinta el borde de una celda sin tocar el resto de su estilo.
 *
 * Se asigna un objeto `style` nuevo en lugar de usar `celda.border = ...`
 * porque ExcelJS hace que las celdas de un rango combinado COMPARTAN el objeto
 * `style` de la maestra: escribir el borde directamente se lo aplicaría a todo
 * el rango. El formato oficial dibuja el marco celda por celda a lo largo de
 * los rangos combinados (p. ej. B16:N16 lleva la línea izquierda en B y la
 * derecha en N), así que cada celda necesita su propio borde.
 */
function pintar(ws, ref, spec) {
    const celda = ws.getCell(ref);
    celda.style = { ...celda.style, border: bordes(spec) };
}

/** Pinta el mismo `spec` en varias columnas de una misma fila. */
function pintarFila(ws, fila, columnas, spec) {
    columnas.forEach((col) => pintar(ws, `${col}${fila}`, spec));
}

// Columnas que abarca el marco del cuadro de plazas.
const COLS_CUADRO = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

/**
 * Dibuja el marco completo de la hoja, calcado del formato oficial.
 *
 * Se hace al final y en un solo lugar (y no repartido entre las funciones que
 * escriben los valores) porque el marco no es una simple caja: cada renglón
 * lleva su propia combinación de lados y grosores, y varias celdas que lo
 * componen pertenecen a rangos combinados.
 */
function dibujarMarco(ws, { primera, ultima, filaTotal, filaTotalConceptos }) {
    // --- Bloque de identificación (12-14): marco medium, subrayados thin ---
    pintar(ws, 'B12', 'TLb');
    pintarFila(ws, 12, ['C', 'D', 'E', 'F', 'G', 'H', 'I'], 'Tb');
    pintarFila(ws, 12, ['J', 'K', 'L', 'M'], 'T');
    pintar(ws, 'N12', 'TR');

    pintar(ws, 'B13', 'Lb');
    pintar(ws, 'C13', 'b');
    pintarFila(ws, 13, ['D', 'E', 'F', 'G', 'H', 'I'], 'tb');
    pintar(ws, 'L13', 'BR');
    pintar(ws, 'M13', 'B');
    pintar(ws, 'N13', 'BR');

    pintar(ws, 'B14', 'LB');
    pintarFila(ws, 14, ['C', 'D'], 'B');
    pintarFila(ws, 14, ['E', 'F', 'G', 'H', 'I'], 'tB');
    pintarFila(ws, 14, ['J', 'K', 'L', 'M'], 'B');
    pintar(ws, 'N14', 'TBR');

    // --- Banda "SITUACIÓN ACTUAL" (15-17): sólo los costados ---
    pintar(ws, 'B15', 'L');
    pintar(ws, 'N15', 'TR');
    pintar(ws, 'B16', 'LR');
    pintar(ws, 'N16', 'R');
    pintar(ws, 'B17', 'L');
    pintar(ws, 'N17', 'BR');

    // --- Encabezado del cuadro de plazas (18-22) ---
    pintarFila(ws, 18, COLS_CUADRO, 'TLR');
    [19, 20, 21].forEach((r) => pintarFila(ws, r, COLS_CUADRO, 'LR'));
    pintarFila(ws, 22, COLS_CUADRO, 'LBR');

    // --- Renglones de plazas ---
    // M y N cierran por abajo en la última plaza; el resto de las columnas
    // cierra un renglón más abajo (así viene el original).
    for (let r = primera; r <= ultima; r += 1) {
        const esUltima = r === ultima;
        pintar(ws, `B${r}`, 'LR');
        pintarFila(ws, r, ['C', 'D', 'E'], 'R');
        pintar(ws, `F${r}`, 'LR');
        pintarFila(ws, r, ['G', 'H', 'I'], 'R');
        pintarFila(ws, r, ['J', 'K', 'L'], 'LR');
        pintar(ws, `M${r}`, esUltima ? 'LB' : 'L');
        pintar(ws, `N${r}`, esUltima ? 'LBR' : 'LR');
    }

    // --- Renglón en blanco entre las plazas y su TOTAL ---
    const blanco = filaTotal - 1;
    pintar(ws, `B${blanco}`, 'TL');
    pintarFila(ws, blanco, ['C', 'D', 'E', 'F', 'G', 'H'], 'T');
    pintarFila(ws, blanco, ['I', 'J'], 'TR');
    pintarFila(ws, blanco, ['K', 'L'], 'TLR');
    pintarFila(ws, blanco, ['M', 'N'], 'LR');

    // --- Fila TOTAL y cierre del marco ---
    pintar(ws, `B${filaTotal}`, 'LR');
    pintarFila(ws, filaTotal, ['I', 'J', 'K', 'L', 'M', 'N'], 'R');

    const cierre = filaTotal + 1;
    pintar(ws, `B${cierre}`, 'LB');
    pintarFila(ws, cierre, ['C', 'D', 'E', 'F', 'G', 'H'], 'B');
    pintar(ws, `I${cierre}`, 'BR');
    pintar(ws, `J${cierre}`, 'LBR');
    pintarFila(ws, cierre, ['K', 'L', 'M', 'N'], 'BR');

    // --- Cuadro de conceptos (P..S) ---
    pintar(ws, 'P23', 'TLR');
    pintar(ws, 'Q23', 'TR');
    pintar(ws, 'R23', 'TLR');
    pintar(ws, 'S23', 'TLBR');
    pintar(ws, 'P24', 'LBR');
    pintar(ws, 'Q24', 'BR');
    pintar(ws, 'R24', 'LBR');
    pintar(ws, 'S24', 'LBR');
    for (let r = 25; r < filaTotalConceptos; r += 1) {
        pintarFila(ws, r, ['P', 'Q', 'R', 'S'], 'LR');
    }
    pintarFila(ws, filaTotalConceptos, ['P', 'Q', 'R', 'S'], 'TLBR');
}

/**
 * Dibuja una hoja completa del Anexo 3 (un grupo = una UA + un período).
 *
 * @param {import('exceljs').Worksheet} ws
 * @param {Object} grupo - Grupo valuado que devuelve `AnuenciaAnexo3View`.
 * @param {number} logoId - Id de la imagen ya registrada en el workbook.
 */
function escribirHojaAnexo3(ws, grupo, logoId) {
    ANCHOS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // --- Membrete SHCP (B1, mismas dimensiones que el original) ---
    if (logoId !== null && logoId !== undefined) {
        ws.addImage(logoId, { tl: { col: 1, row: 0 }, ext: { width: 572, height: 165 } });
    }

    // --- Título ---
    ws.mergeCells('B6:N6');
    const titulo = ws.getCell('B6');
    titulo.value = 'ANEXO 3. FORMATO UNICO DE MOVIMIENTOS PRESUPUESTARIOS DE SERVICIOS PERSONALES ';
    estilo(titulo, { bold: true, align: 'center' });
    ws.getRow(6).height = 18;

    // --- Unidad Administrativa (alineada a la derecha, combinada I8:N8) ---
    ws.mergeCells('I8:N8');
    const ua = ws.getCell('I8');
    ua.value = `Unidad Administrativa: ${grupo.unidad_administrativa || ''}`;
    estilo(ua, { align: 'right', valign: 'center', wrap: true });

    const hoja = ws.getCell('N10');
    hoja.value = 'HOJA _1___DE__1_';
    estilo(hoja, { bold: true });

    // --- Bloque de identificación ---
    estilo(ws.getCell('B12'), { bold: true });
    ws.getCell('B12').value = 'DEPENDENCIA:   ';
    ws.mergeCells('E12:I12');
    ws.getCell('E12').value = 'AGENCIA NACIONAL DE ADUANAS DE MÉXICO';
    estilo(ws.getCell('E12'), { bold: true, align: 'center' });

    ws.getCell('B13').value = 'ENTIDAD:  ';
    estilo(ws.getCell('B13'), { bold: true });
    ws.mergeCells('D13:I13');
    ws.getCell('D13').value = 'FEDERAL';
    estilo(ws.getCell('D13'), { bold: true, align: 'center' });

    ws.getCell('K13').value = 'VIGENCIA:';
    estilo(ws.getCell('K13'), { bold: true });
    ws.mergeCells('L13:N13');
    ws.getCell('L13').value = textoVigencia(grupo.fecha_inicio, grupo.fecha_fin);
    estilo(ws.getCell('L13'), { bold: true, align: 'center', valign: 'center' });

    ws.getCell('B14').value = 'TIPO DE PERSONAL:   ';
    estilo(ws.getCell('B14'), { bold: true });
    ws.mergeCells('E14:I14');
    ws.getCell('E14').value = tipoDePersonal(grupo.plazas);
    estilo(ws.getCell('E14'), { bold: true, align: 'center' });

    // --- Banda "SITUACIÓN ACTUAL" ---
    ws.mergeCells('B16:N16');
    const situacion = ws.getCell('B16');
    const totalPlazas = grupo.total_plazas || 0;
    situacion.value = `SITUACIÓN ACTUAL (AUTORIZACIÓN DE ${totalPlazas} ${totalPlazas === 1 ? 'PLAZA' : 'PLAZAS'})`;
    estilo(situacion, { bold: true, align: 'center' });

    // --- Encabezado del cuadro de plazas (filas 19-21) ---
    const enc = [
        ['B19', 'U.R.'], ['C19', 'ACT.'], ['D19', 'F.'], ['E19', 'S.F.'],
        ['I19', 'PUESTO O'], ['J19', 'TOTAL'], ['L19', 'SUELDO'],
        ['M19', 'COMPENSACION'], ['N19', 'COMP. GARANT.'],
        ['C20', 'INST.'], ['F20', 'NIVEL'], ['G20', 'ZONA'], ['H20', 'CODIGO'],
        ['I20', 'CATEGORIA'],
        ['J20', 'PLAZAS', { valign: 'center' }], ['K20', 'SUELDO', { valign: 'center' }],
        ['L20', 'COLECTIVO'], ['M20', 'GARANTIZADA'], ['N20', 'COLECTIVA'],
        ['L21', 'POR PERIODO'], ['N21', 'POR PERIODO'],
    ];
    enc.forEach(([ref, val, opts]) => {
        ws.getCell(ref).value = val;
        estilo(ws.getCell(ref), { bold: true, align: 'center', ...opts });
    });
    [19, 20, 21].forEach((r) => { ws.getRow(r).height = 17.1; });

    // --- Filas de plazas (arrancan en la 23, como el original) ---
    const FILA_INI = 23;
    (grupo.plazas || []).forEach((p, i) => {
        const r = FILA_INI + i;
        const val = (ref, v, opts) => {
            ws.getCell(`${ref}${r}`).value = v;
            estilo(ws.getCell(`${ref}${r}`), opts);
        };
        val('B', p.unidad_responsable || '', { align: 'center' });
        val('C', 'E025', { align: 'center' });
        val('D', 1, { align: 'center' });
        val('E', 2, { align: 'center' });
        val('F', p.nivel || '', { align: 'center', valign: 'center' });
        val('G', p.zona ?? '', { align: 'center' });
        val('H', p.codigo_presupuestal || '', { align: 'left' });
        val('I', p.denominacion || '', { valign: 'center', wrap: true });
        val('J', p.cantidad || 0, { align: 'center', valign: 'center' });
        val('K', p.sueldo ?? 0, { fmt: FMT_MONEDA });
        val('L', p.sueldo_periodo ?? 0, { fmt: FMT_MONEDA });
        val('M', p.compensacion ?? 0, { fmt: FMT_MONEDA });
        val('N', p.compensacion_periodo ?? 0, { fmt: FMT_MONEDA });
        ws.getRow(r).height = 17.1;
    });

    // --- Fila TOTAL del cuadro ---
    // Va un renglón DESPUÉS de la última plaza: el formato original deja una
    // línea en blanco entre el cuadro y su total (con 1 plaza: datos en 23,
    // blanco en 24, TOTAL en 25).
    const filaTotal = FILA_INI + Math.max(1, (grupo.plazas || []).length) + 1;
    ws.mergeCells(`B${filaTotal}:I${filaTotal}`);
    ws.getCell(`B${filaTotal}`).value = 'T  O  T  A  L';
    estilo(ws.getCell(`B${filaTotal}`), { bold: true, align: 'center' });

    const ultima = FILA_INI + (grupo.plazas || []).length - 1;
    const sumar = (col, fmt) => {
        const celda = ws.getCell(`${col}${filaTotal}`);
        celda.value = { formula: `SUM(${col}${FILA_INI}:${col}${ultima})` };
        estilo(celda, { bold: true, align: 'center', fmt });
    };
    if ((grupo.plazas || []).length > 0) {
        sumar('J', FMT_ENTERO_TOTAL);
        sumar('L', FMT_MONEDA_TOTAL);
        sumar('N', FMT_MONEDA_TOTAL);
    }
    ws.getRow(filaTotal).height = 17.1;

    // --- Tabla de conceptos (columnas P..S, a la derecha del cuadro) ---
    ws.getCell('P23').value = 'CAPÍTULO ';
    estilo(ws.getCell('P23'), { bold: true, align: 'center' });
    ws.getCell('Q23').value = 'PERIODO';
    estilo(ws.getCell('Q23'), { bold: true, align: 'center' });
    ws.getCell('R23').value = 'COMPLEMENTO';
    estilo(ws.getCell('R23'), { bold: true, align: 'center' });
    ws.mergeCells('S23:S24');
    ws.getCell('S23').value = 'REGULARIZABLE';
    estilo(ws.getCell('S23'), { bold: true, align: 'center', valign: 'center' });
    ws.getCell('P24').value = 'CONCEPTO';
    estilo(ws.getCell('P24'), { bold: true, align: 'center' });
    ws.getCell('Q24').value = 'COLECTIVO';
    estilo(ws.getCell('Q24'), { bold: true, align: 'center' });
    ws.getCell('R24').value = 'COLECTIVO';
    estilo(ws.getCell('R24'), { bold: true, align: 'center' });

    // Orden de partidas EXACTO del formato oficial (difiere del simulador:
    // aquí 15403 va abierto en sus 5 componentes y no aparecen las partidas
    // reservadas que el simulador sí lista).
    const porConcepto = {};
    (grupo.valuacion?.tabla_q322_t348 || []).forEach((r) => { porConcepto[r.concepto] = r; });
    (grupo.valuacion?.desglose_15403 || []).forEach((r) => { porConcepto[r.concepto] = r; });

    const ORDEN = [
        '12201', '13201', '13202', '14101', '14105', '14201', '14301', '14401',
        '14302', '14405', '15402', '15403 D', '15403', '15403 PSM', '15403 AS',
        '15403 T', '15901',
    ];

    let fila = 25;
    ORDEN.forEach((concepto) => {
        const row = porConcepto[concepto] || { periodo: 0, complemento: 0, anual: 0 };
        // El original guarda las claves simples como número y las compuestas
        // ("15403 D") como texto — se respeta para que Excel las ordene igual.
        const claveNumerica = /^\d+$/.test(concepto);
        ws.getCell(`P${fila}`).value = claveNumerica ? Number(concepto) : concepto;
        estilo(ws.getCell(`P${fila}`), { align: 'center', valign: 'center' });
        ws.getCell(`Q${fila}`).value = row.periodo || 0;
        estilo(ws.getCell(`Q${fila}`), { valign: 'center', fmt: FMT_MONEDA });
        ws.getCell(`R${fila}`).value = row.complemento || 0;
        estilo(ws.getCell(`R${fila}`), { valign: 'center', fmt: FMT_MONEDA });
        ws.getCell(`S${fila}`).value = row.anual || 0;
        estilo(ws.getCell(`S${fila}`), { valign: 'center', fmt: FMT_MONEDA });
        ws.getRow(fila).height = 17.1;
        fila += 1;
    });

    // --- TOTAL de conceptos ---
    ws.getCell(`P${fila}`).value = 'TOTAL';
    estilo(ws.getCell(`P${fila}`), { bold: true, align: 'center', valign: 'center' });
    const sumaCol = (col) => {
        const celda = ws.getCell(`${col}${fila}`);
        celda.value = { formula: `SUM(${col}25:${col}${fila - 1})` };
        estilo(celda, { bold: true, valign: 'center', fmt: FMT_MONEDA });
    };
    sumaCol('Q');
    sumaCol('R');
    sumaCol('S');
    ws.getRow(fila).height = 16.5;

    // El marco va al final: `pintar` reemplaza el objeto de estilo de la celda,
    // así que tiene que correr después de que todos los valores y fuentes ya
    // están puestos.
    dibujarMarco(ws, {
        primera: FILA_INI,
        ultima: Math.max(FILA_INI, ultima),
        filaTotal,
        filaTotalConceptos: fila,
    });
}

/**
 * '#rrggbb' (el que entrega tanto la paleta fija como el `<input
 * type="color">` de Anexo3Editor.jsx) → ARGB de ExcelJS ('FFrrggbb'). El
 * canal alfa siempre es opaco (FF); Excel no usa transparencia en el color
 * de pestaña.
 */
function argbDesdeHex(hex) {
    const limpio = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
    return `FF${limpio.toUpperCase()}`;
}

/**
 * Nombre de pestaña válido para Excel: sin caracteres prohibidos, máximo 31
 * caracteres y único dentro del libro.
 */
function nombreHojaUnico(nombre, usados, indice) {
    const base = String(nombre || '').replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31) || `Hoja ${indice + 1}`;
    let candidato = base;
    let n = 2;
    while (usados.has(candidato.toLowerCase())) {
        const sufijo = ` (${n})`;
        candidato = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
        n += 1;
    }
    usados.add(candidato.toLowerCase());
    return candidato;
}

/**
 * Arma el workbook del Anexo 3 (sin descargarlo) — separado para poder
 * verificar la estructura sin depender del DOM.
 *
 * @param {Object[]} grupos - Grupos valuados de `AnuenciaAnexo3View`.
 * @param {*} [ExcelJSModule] - Inyectable en pruebas.
 */
export async function construirWorkbookAnexo3(grupos, ExcelJSModule) {
    const ExcelJS = ExcelJSModule || (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    // El membrete es el mismo PNG del formato oficial (extraído del archivo de
    // referencia, ver `anexo3-logo.js`) — se registra una sola vez y se ancla
    // en cada hoja.
    const logoId = workbook.addImage({ base64: ANEXO3_LOGO_BASE64, extension: 'png' });

    const usados = new Set();
    (grupos || []).forEach((grupo, i) => {
        const ws = workbook.addWorksheet(nombreHojaUnico(grupo.nombre_hoja, usados, i), {
            views: [{ showGridLines: false }],
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        });
        // Mismo color que el usuario le puso a la hoja en Anexo3Editor.jsx
        // (clic derecho sobre su encabezado) — se pinta también la pestaña
        // del Excel para que la identificación visual sobreviva a la
        // descarga.
        const tabColor = argbDesdeHex(grupo.color);
        if (tabColor) ws.properties.tabColor = { argb: tabColor };
        escribirHojaAnexo3(ws, grupo, logoId);
    });

    return workbook;
}

/** Genera y descarga el Anexo 3. */
export async function exportarAnexo3(grupos, nombreArchivo) {
    const workbook = await construirWorkbookAnexo3(grupos);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const base = String(nombreArchivo || '').trim() || 'Anexo 3 - FUMP';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
