"use client";

import { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from "react";
import { Loader2, AlertTriangle, FileQuestion, ChevronDown, ArrowRightLeft, GitCommitHorizontal, Download, ImageDown } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { formatDateEsMx } from "@/utils/columnFilters";
import { getMovimientoDiff } from "../../_utils/movimientosDiff";
import { PlantillaService } from "@/services/plantilla.service";
import { VacantesService } from "@/services/vacantes.service";
import { addExcelLetterhead } from "@/utils/excelLetterhead";
import { useToast } from "@/hooks/useToast";
import ExportConFotosModal from "./ExportConFotosModal";
import {
    LETTERHEAD_LOGO_BASE64,
    LETTERHEAD_LOGO_WIDTH,
    LETTERHEAD_LOGO_HEIGHT,
} from "@/assets/letterhead-logo";

gsap.registerPlugin(useGSAP);

const GOLD = "#bc955c";
const AMBER = "#f59e0b";
const LANE_MIN_WIDTH = 260;

const formatDate = (value) => (value ? formatDateEsMx(value) : "-");

// Encabezados "profesionales" para la descarga a Excel — mismo orden y
// campos que el SELECT de MovimientosPersonalHistorialView (backend), sin
// `id` (llave técnica interna, sin valor para el usuario) y con nombres
// legibles en vez de los códigos crudos de cp_tbl_mov_completo_29_05_26.
const EXPORT_COLUMNS = [
    ["posicion", "Posición"],
    ["num_empleado", "No. Empleado"],
    ["nombre", "Nombre"],
    ["ap_pat", "Apellido Paterno"],
    ["ap_mat", "Apellido Materno"],
    ["accion", "Código de Acción"],
    ["accion_nombre", "Acción"],
    ["motivo", "Código de Motivo"],
    ["motivo_nombre", "Motivo"],
    ["fecha_efectiva", "Fecha Efectiva", true],
    ["sec", "Secuencia"],
    ["fecha_captura", "Fecha de Captura", true],
    ["est_hr", "Estado RH"],
    ["estado_pago", "Estado de Pago"],
    ["partida_presup", "Partida Presupuestal"],
    ["un", "Unidad de Negocio"],
    ["un_admin", "Unidad Administrativa"],
    ["id_depto", "ID Departamento"],
    ["depen_direc", "Dependencia Directa"],
    ["plan_sal", "Plan Salarial"],
    ["grado", "Grado"],
    ["escala", "Escala"],
    ["puesto_ptal", "Puesto Presupuestal"],
    ["nivel_tabular", "Nivel Tabular"],
    ["gp_pago", "Grupo de Pago"],
    ["prog_benef", "Programa de Beneficios"],
    ["sal_base", "Salario Base"],
    ["cd_puesto", "Código de Puesto"],
    ["ubicacion", "Ubicación"],
    ["id_estbl", "ID Establecimiento"],
    ["salida_prevista", "Salida Prevista", true],
    ["fecha_ult_actz", "Última Actualización", true],
    ["por", "Capturado Por"],
    ["ult_inicio", "Último Inicio", true],
    ["fecha_inicial", "Fecha Inicial", true],
    ["gp_trabajo", "Grupo de Trabajo"],
    ["grupo_cd_sal", "Grupo Código Salarial"],
    ["antiguo_empr", "Antigüedad Empresa"],
    ["rfc", "RFC"],
    ["curp", "CURP"],
    ["id_persona", "ID Persona"],
    ["desc_larga_p", "Descripción Puesto"],
    ["nv_jerarquico", "Nivel Jerárquico"],
    ["desc_larga_un", "Descripción Unidad"],
    ["sexo", "Sexo"],
    ["fecha_entrada", "Fecha de Entrada", true],
    ["fecha_posicion", "Fecha de Posición", true],
];

// Fecha efectiva descendente (más reciente primero); empate -> secuencia
// ascendente, a pedido del usuario (2026-08-14).
const buildExportRows = (movimientos) => {
    const ordenados = [...movimientos].sort((a, b) => {
        const fechaCmp = String(b.fecha_efectiva ?? "").localeCompare(String(a.fecha_efectiva ?? ""));
        if (fechaCmp !== 0) return fechaCmp;
        return (Number(a.sec) || 0) - (Number(b.sec) || 0);
    });
    return ordenados.map((mov) => {
        const row = {};
        EXPORT_COLUMNS.forEach(([key, label, isDate]) => {
            const raw = mov[key];
            row[label] = isDate ? formatDate(raw) : (raw ?? "");
        });
        return row;
    });
};

const downloadBlobAsFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

// Excel con foto: arma el workbook 100% client-side con exceljs (mismo
// patrón que src/utils/excelExport.js) en vez del generador genérico del
// backend (ExportExcelView, que solo sabe de tablas planas) — así se puede
// incrustar la fotografía sin tocar ese endpoint compartido por otros
// exports. La foto se pide al MISMO endpoint (EmpleadoFotoView) que ya usa
// el tab "Fotografía" del expediente, así que ya viene permission-gated por
// `canViewPhoto` sin necesidad de checar nada nuevo aquí.
const downloadExcelConFoto = async (rows, filename, numEmpleado, signal) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Historial");
    const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    worksheet.columns = columnKeys.map((key) => ({ key, width: 22 }));
    let nextRow = addExcelLetterhead(workbook, worksheet, columnKeys.length) + 1;

    let fotoEncontrada = false;
    try {
        const fotoRes = await VacantesService.getEmpleadoFoto(numEmpleado, { signal });
        if (fotoRes.ok) {
            const blob = await fotoRes.blob();
            const buffer = await blob.arrayBuffer();
            const extension = blob.type.includes("png") ? "png" : "jpeg";
            const imageId = workbook.addImage({ buffer, extension });
            worksheet.getRow(nextRow).height = 92;
            worksheet.addImage(imageId, {
                tl: { col: 0.15, row: nextRow - 1 + 0.08 },
                ext: { width: 90, height: 108 },
            });
            nextRow += 1;
            fotoEncontrada = true;
        }
    } catch (err) {
        if (err.name === "AbortError") throw err;
        // Sin foto: se continúa con el resto del Excel de todas formas.
    }

    const headerRow = worksheet.getRow(nextRow);
    columnKeys.forEach((key, i) => { headerRow.getCell(i + 1).value = key; });
    headerRow.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 26;
    nextRow += 1;

    rows.forEach((row, i) => {
        const r = worksheet.addRow(row);
        r.font = { name: "Calibri", size: 9 };
        r.alignment = { vertical: "middle" };
        if (i % 2 === 1) r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
    });

    worksheet.views = [{ state: "frozen", ySplit: nextRow - 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlobAsFile(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        filename,
    );
    return fotoEncontrada;
};

// ─── Descarga del diagrama a PDF vectorial ─────────────────────────────────
// Primer intento (descartado): capturar el DOM con html-to-image (toSvg) y
// envolver el HTML en un <foreignObject>. El .svg resultante se ve bien
// abierto directo en el navegador, pero deja de ser "una imagen" para
// cualquier otro consumidor (vista previa del explorador, insertarlo en
// Word/PowerPoint, un visor de imágenes) porque esos NO renderizan
// <foreignObject> — sale en blanco. Mismo problema que ya se había resuelto
// en organigrama/page.jsx (ver comentario ahí, "Exportación de organigrama a
// PDF vectorial"): la solución real es dibujar con las primitivas
// vectoriales de jsPDF (rect/texto/línea) a partir de coordenadas
// analíticas — nunca pasar por el DOM ni por una imagen intermedia. Esta
// función replica ese mismo enfoque para el diagrama de carriles, con el
// detalle de "Cambios detectados" de cada movimiento siempre desplegado
// (a diferencia de la pantalla, aquí no hay interacción posible).
const PDF_PX_TO_PT = 0.75;         // 96 CSS px/in → 72pt/in, igual que organigrama
const PDF_MAX_DIM_PT = 14000;      // techo físico de página (~194in) de la mayoría de lectores PDF
const PDF_MARGIN = 28;
const PDF_TITLE_GAP = 16;
const PDF_LANE_HEADER_H = 58;
const PDF_LANE_HEADER_GAP = 20;
const PDF_LANE_GAP_X = 14;
const PDF_ROW_GAP_Y = 16;
const PDF_CARD_W = 260;

// ─── Membretado institucional (mismo patrón que excelLetterhead.js: logo →
// título apilado → leyenda de generación) + línea de encabezado propia del
// reporte (empleado). Todo en "px" CSS, igual que el resto del layout.
const PDF_HEADER_TITLE_LINES = [
    "AGENCIA NACIONAL DE ADUANAS DE MÉXICO",
    "UNIDAD DE ADMINISTRACIÓN Y FINANZAS",
    "DIRECCIÓN DE RECURSOS HUMANOS",
];
const PDF_LOGO_W = 260;
const PDF_LOGO_H = Math.round((PDF_LOGO_W * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH);
const PDF_HEADER_TOP_PAD = 12;
const PDF_HEADER_LOGO_GAP = 12;
const PDF_HEADER_TITLE_LINE_H = 16;
const PDF_HEADER_TITLE_GAP = 12;
const PDF_HEADER_LEGEND_H = 14;
const PDF_HEADER_LEGEND_GAP = 10;
const PDF_HEADER_RULE_GAP = 12;
const PDF_HEADER_SUBTITLE_H = 26;
// Alto total del membretado — suma de cada bloque de arriba, en el mismo
// orden en que se dibujan (ver buildHistorialPdf); mover cualquiera de esas
// piezas sin actualizar esta suma desalinea el resto del diagrama.
const PDF_TITLE_H = PDF_HEADER_TOP_PAD + PDF_LOGO_H + PDF_HEADER_LOGO_GAP
    + PDF_HEADER_TITLE_LINES.length * PDF_HEADER_TITLE_LINE_H + PDF_HEADER_TITLE_GAP
    + PDF_HEADER_LEGEND_H + PDF_HEADER_LEGEND_GAP
    + PDF_HEADER_RULE_GAP
    + PDF_HEADER_SUBTITLE_H;

const fmtFechaHoraGeneracionPdf = () => {
    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const hora = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${hora} horas del ${fecha}`;
};

const PDF_MAROON = [98, 31, 50];
const PDF_GOLD = [188, 149, 92];
const PDF_AMBER = [245, 158, 11];
const PDF_AMBER_BG = [255, 251, 235];
const PDF_AMBER_TEXT = [180, 83, 9];
const PDF_AMBER_BORDER = [253, 230, 138];
const PDF_SLATE_700 = [51, 65, 85];
const PDF_SLATE_500 = [100, 116, 139];
const PDF_SLATE_400 = [148, 163, 184];
const PDF_SLATE_300 = [203, 213, 225];
const PDF_SLATE_200 = [226, 232, 240];
const PDF_SLATE_100 = [241, 245, 249];
const PDF_SLATE_50 = [248, 250, 252];
const PDF_MAROON_TINT = [246, 237, 239];
// Badge "NIVEL N" de la cabecera de carril — mismo tono dorado institucional
// que en pantalla (bg-[#bc955c]/15, border-[#bc955c]/30, text-[#7a5a30]),
// pre-mezclado sobre blanco porque jsPDF no soporta opacidad en fills.
const PDF_GOLD_BG = [245, 239, 231];
const PDF_GOLD_BORDER = [235, 223, 206];
const PDF_GOLD_TEXT = [122, 90, 48];

// Trunca a una línea con "…" hasta que quepa en `maxWidth` — requiere fuente
// y tamaño ya seteados en `pdf` (jsPDF.getTextWidth depende de eso).
const fitPdfText = (pdf, text, maxWidth) => {
    const str = String(text ?? "");
    if (!str) return "";
    if (pdf.getTextWidth(str) <= maxWidth) return str;
    let t = str;
    while (t.length > 1 && pdf.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
};

// Corte simple por cantidad de caracteres (no por ancho real) — usado para
// los valores de "Cambios detectados", donde el largo real depende del
// resto de la línea (etiqueta + flecha) y no vale la pena medir pt a pt.
const capStr = (value, max = 60) => {
    const str = String(value ?? "");
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

// Altura (en "px" CSS, antes de convertir a pt) que ocupa la tarjeta de un
// movimiento: cabecera fija (título/motivo/grid 2x2) + detalle de cambios,
// cuyo largo sí varía según cuántos campos cambiaron respecto al anterior.
const computeHistorialCardHeight = (isFirst, diff, cambioDePosicion) => {
    let h = 14; // padding superior
    if (cambioDePosicion) h += 16; // badge "Cambio de posición"
    h += 16; // título (accion_nombre)
    h += 18; // chip motivo_nombre
    h += 10; // gap antes del grid
    h += 24 * 2; // grid 2x2: F.Efectiva/F.Captura, Sec/Por
    h += 16; // padding inferior de la cabecera + separador

    h += 10; // margen superior del bloque de detalle
    if (isFirst) {
        h += 16 + 12; // línea "Movimiento inicial..." + padding inferior
    } else {
        h += 14 + 6; // encabezado "Cambios detectados (N)"
        if (diff.differences.length === 0) {
            h += 14 + 12;
        } else {
            // Sin tope: el usuario pidió el desglose completo, nunca "+N más".
            h += diff.differences.length * 20;
            h += 12;
        }
    }
    return h;
};

// Layout analítico completo: X de cada carril, Y acumulada de cada fila
// (una fila = un movimiento, mismo orden cronológico que en pantalla) y
// dimensiones totales del lienzo — todo en "px" CSS, sin tocar el DOM.
const computeHistorialLayout = (movimientos, lanes) => {
    const laneX = lanes.map((_, i) => i * (PDF_CARD_W + PDF_LANE_GAP_X));
    const contentWidth = lanes.length * PDF_CARD_W + (lanes.length - 1) * PDF_LANE_GAP_X;
    const laneIndexByPosicion = new Map(lanes.map((l) => [l.posicion, l.index]));

    const rowsTop = PDF_TITLE_H + PDF_TITLE_GAP + PDF_LANE_HEADER_H + PDF_LANE_HEADER_GAP;
    const rowHeights = [];
    const rowY = [];
    let cursor = rowsTop;
    movimientos.forEach((mov, i) => {
        const isFirst = i === 0;
        const diff = isFirst ? { differences: [], unchanged: [] } : getMovimientoDiff(mov, movimientos[i - 1]);
        const cambioDePosicion = !isFirst && mov.posicion !== movimientos[i - 1].posicion;
        const h = computeHistorialCardHeight(isFirst, diff, cambioDePosicion);
        rowHeights.push(h);
        rowY.push(cursor);
        cursor += h + PDF_ROW_GAP_Y;
    });
    const contentHeight = movimientos.length > 0 ? cursor - PDF_ROW_GAP_Y : rowsTop;

    return { laneX, laneIndexByPosicion, rowsTop, rowHeights, rowY, contentWidth, contentHeight };
};

// Padding horizontal interno de la tarjeta — antes el texto arrancaba
// pegado al borde izquierdo (X(x) directo); todo el contenido se ancla ahora
// a `xIn` (x + padX) y se mide contra `innerW` (w - padX*2).
const PDF_CARD_PAD_X = 10;

const drawHistorialCardPdf = (pdf, mov, x, yTop, w, h, isFirst, diff, cambioDePosicion, X, Y, T) => {
    const padX = PDF_CARD_PAD_X;
    const xIn = x + padX;
    const innerW = w - padX * 2;
    let cursorY = yTop + 14;

    // Tarjeta: fondo blanco + borde visible (antes solo se seteaban los
    // colores sin llegar a dibujar el rectángulo — la tarjeta quedaba sin
    // contorno). Borde más marcado si es el movimiento con cambio de
    // posición, igual criterio de color que en pantalla.
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...(cambioDePosicion ? PDF_AMBER : PDF_SLATE_300));
    pdf.setLineWidth(Math.max(T(cambioDePosicion ? 1.5 : 1), 0.5));
    pdf.roundedRect(X(x), Y(yTop), T(w), T(h), T(10), T(10), "FD");

    pdf.setDrawColor(...PDF_SLATE_200);
    pdf.setLineWidth(Math.max(T(1), 0.4));

    if (cambioDePosicion) {
        pdf.setFillColor(...PDF_AMBER_BG);
        pdf.setDrawColor(...PDF_AMBER_BORDER);
        const label = "CAMBIO DE POSICIÓN";
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(7));
        const labelW = pdf.getTextWidth(label); // ya en pt (fuente/tamaño seteados arriba)
        pdf.roundedRect(X(xIn), Y(cursorY), labelW + T(14), T(14), T(7), T(7), "FD");
        pdf.setTextColor(...PDF_AMBER_TEXT);
        pdf.text(label, X(xIn) + T(7), Y(cursorY + 7), { baseline: "middle" });
        cursorY += 16;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(T(9.5));
    pdf.setTextColor(...PDF_MAROON);
    pdf.text(fitPdfText(pdf, (mov.accion_nombre || "—").toUpperCase(), T(innerW)), X(xIn), Y(cursorY + 9), { baseline: "middle" });
    cursorY += 16;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(T(7.5));
    const motivo = fitPdfText(pdf, mov.motivo_nombre || "—", T(innerW - 8));
    const motivoW = pdf.getTextWidth(motivo); // pt
    pdf.setFillColor(...PDF_SLATE_100);
    pdf.roundedRect(X(xIn), Y(cursorY), Math.min(T(innerW), motivoW + T(8)), T(14), T(3), T(3), "F");
    pdf.setTextColor(...PDF_SLATE_500);
    pdf.text(motivo, X(xIn + 4), Y(cursorY + 7), { baseline: "middle" });
    cursorY += 10 + 18;

    const gridColW = innerW / 2;
    const gridCell = (label, value, col, row) => {
        const gx = xIn + col * gridColW;
        const gy = cursorY + row * 24;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(6.5));
        pdf.setTextColor(...PDF_SLATE_400);
        pdf.text(label, X(gx), Y(gy), { baseline: "middle" });
        pdf.setFont("courier", "bold");
        pdf.setFontSize(T(8));
        pdf.setTextColor(...PDF_SLATE_700);
        pdf.text(fitPdfText(pdf, value, T(gridColW - 4)), X(gx), Y(gy + 11), { baseline: "middle" });
    };
    gridCell("F. EFECTIVA", formatDate(mov.fecha_efectiva), 0, 0);
    gridCell("F. CAPTURA", formatDate(mov.fecha_captura), 1, 0);
    gridCell("SEC", mov.sec ?? "-", 0, 1);
    gridCell("POR", mov.por || "-", 1, 1);
    cursorY += 24 * 2 + 8;

    // Divisor + bloque de detalle ("Cambios detectados"), siempre desplegado.
    pdf.setDrawColor(...PDF_SLATE_200);
    pdf.setLineWidth(Math.max(T(0.75), 0.3));
    pdf.setLineDashPattern([T(3), T(2)], 0);
    pdf.line(X(xIn), Y(cursorY), X(xIn + innerW), Y(cursorY));
    pdf.setLineDashPattern([], 0);
    cursorY += 10;

    if (isFirst) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(T(7.5));
        pdf.setTextColor(...PDF_SLATE_500);
        pdf.text(fitPdfText(pdf, "Movimiento inicial de este historial.", T(innerW)), X(xIn), Y(cursorY + 8), { baseline: "middle" });
        return;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(T(7));
    pdf.setTextColor(...PDF_MAROON);
    const diffTitle = diff.differences.length > 0 ? `CAMBIOS DETECTADOS (${diff.differences.length})` : "CAMBIOS DETECTADOS";
    pdf.text(diffTitle, X(xIn), Y(cursorY + 7), { baseline: "middle" });
    cursorY += 20;

    if (diff.differences.length === 0) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(T(7.5));
        pdf.setTextColor(...PDF_SLATE_400);
        pdf.text("Sin cambios respecto al anterior.", X(xIn), Y(cursorY + 7), { baseline: "middle" });
        return;
    }

    // Sin tope de filas: se dibuja el desglose completo, nunca "+N más" (el
    // alto de la tarjeta ya lo reserva por completo, ver computeHistorialCardHeight).
    diff.differences.forEach((d) => {
        pdf.setFillColor(...PDF_SLATE_50);
        pdf.setDrawColor(...PDF_SLATE_200);
        pdf.setLineWidth(Math.max(T(0.5), 0.3));
        pdf.roundedRect(X(xIn), Y(cursorY), T(innerW), T(17), T(3), T(3), "FD");

        // Una sola línea fluida "Label: viejo → nuevo" — el largo real de
        // cada tramo depende de lo que vino antes, así que se posiciona con
        // el ancho medido del tramo anterior en vez de columnas fijas.
        let tx = X(xIn + 4);
        const ty = Y(cursorY + 8.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(7));
        pdf.setTextColor(...PDF_SLATE_700);
        const labelText = `${d.label}: `;
        pdf.text(labelText, tx, ty, { baseline: "middle" });
        tx += pdf.getTextWidth(labelText);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(T(6.5));
        pdf.setTextColor(...PDF_SLATE_400);
        const oldText = `${capStr(d.oldValue)} `;
        pdf.text(oldText, tx, ty, { baseline: "middle" });
        tx += pdf.getTextWidth(oldText);

        // Los fuentes estándar de jsPDF (helvetica/times/courier) usan
        // WinAnsiEncoding y no traen glifo para "→" (U+2192) — sale como
        // "!" o un cuadro roto. "->" en ASCII es compatible con cualquier
        // lector.
        pdf.text("-> ", tx, ty, { baseline: "middle" });
        tx += pdf.getTextWidth("-> ");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(7));
        pdf.setTextColor(...PDF_MAROON);
        pdf.text(capStr(d.newValue), tx, ty, { baseline: "middle" });

        cursorY += 20;
    });
};

// Construye el jsPDF listo para `.save(nombre)` — orientación y escala
// elegidas para que TODO el diagrama quepa en una sola página; al ser
// vectorial, reducir la escala física no pierde nitidez (el lector siempre
// puede hacer zoom sobre los mismos trazos).
// Ancho mínimo del contenido — sin esto, un empleado de un solo carril
// (diagrama de 260px) deja el membretado (título institucional + leyenda de
// generación, más largos que eso) desbordándose fuera de la página.
const PDF_MIN_CONTENT_WIDTH = 480;

const buildHistorialPdf = (movimientos, lanes, numEmpleado) => {
    const layout = computeHistorialLayout(movimientos, lanes);
    // Diagrama angosto -> se centra dentro de PDF_MIN_CONTENT_WIDTH en vez de
    // dejar la página al ancho justo de las columnas.
    const contentWidth = Math.max(layout.contentWidth, PDF_MIN_CONTENT_WIDTH);
    const diagramOffsetX = (contentWidth - layout.contentWidth) / 2;
    if (diagramOffsetX > 0) layout.laneX = layout.laneX.map((x) => x + diagramOffsetX);

    const totalWpx = contentWidth + PDF_MARGIN * 2;
    const totalHpx = layout.contentHeight + PDF_MARGIN * 2;

    let pageWpt = totalWpx * PDF_PX_TO_PT;
    let pageHpt = totalHpx * PDF_PX_TO_PT;
    const scale = Math.min(1, PDF_MAX_DIM_PT / pageWpt, PDF_MAX_DIM_PT / pageHpt);
    pageWpt *= scale;
    pageHpt *= scale;

    const pdf = new jsPDF({
        orientation: pageWpt >= pageHpt ? "l" : "p",
        unit: "pt",
        format: [pageWpt, pageHpt],
    });

    const T = (px) => px * PDF_PX_TO_PT * scale;
    const X = (px) => T(px + PDF_MARGIN);
    const Y = (px) => T(px + PDF_MARGIN);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWpt, pageHpt, "F");

    // ─── Membretado (logo → título institucional → leyenda de generación) +
    // línea de encabezado propia del reporte — mismo patrón apilado que
    // excelLetterhead.js, ver PDF_TITLE_H arriba para el porqué de cada alto.
    const pageCenterX = X(contentWidth / 2);
    let hy = PDF_HEADER_TOP_PAD;

    pdf.addImage(`data:image/png;base64,${LETTERHEAD_LOGO_BASE64}`, "PNG", X(0), Y(hy), T(PDF_LOGO_W), T(PDF_LOGO_H));
    hy += PDF_LOGO_H + PDF_HEADER_LOGO_GAP;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(T(12));
    pdf.setTextColor(...PDF_MAROON);
    PDF_HEADER_TITLE_LINES.forEach((line, i) => {
        pdf.text(line, pageCenterX, Y(hy + i * PDF_HEADER_TITLE_LINE_H + PDF_HEADER_TITLE_LINE_H / 2), { align: "center", baseline: "middle" });
    });
    hy += PDF_HEADER_TITLE_LINES.length * PDF_HEADER_TITLE_LINE_H + PDF_HEADER_TITLE_GAP;

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(T(9));
    pdf.setTextColor(...PDF_SLATE_500);
    pdf.text(
        `Reporte generado por el sistema de Control de Plazas a las ${fmtFechaHoraGeneracionPdf()}.`,
        pageCenterX, Y(hy + PDF_HEADER_LEGEND_H / 2), { align: "center", baseline: "middle" },
    );
    hy += PDF_HEADER_LEGEND_H + PDF_HEADER_LEGEND_GAP;

    pdf.setDrawColor(...PDF_SLATE_200);
    pdf.setLineWidth(Math.max(T(0.75), 0.3));
    pdf.line(X(0), Y(hy), X(contentWidth), Y(hy));
    hy += PDF_HEADER_RULE_GAP;

    const nombreCompleto = [movimientos[0]?.nombre, movimientos[0]?.ap_pat, movimientos[0]?.ap_mat]
        .map((s) => (s || "").trim()).filter(Boolean).join(" ") || "—";
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(T(15));
    pdf.setTextColor(...PDF_MAROON);
    pdf.text(
        fitPdfText(pdf, `Historial de Movimientos — ${nombreCompleto} (No. Empleado ${numEmpleado})`, T(contentWidth)),
        X(0), Y(hy + PDF_HEADER_SUBTITLE_H / 2), { baseline: "middle" },
    );

    // Sombreado alternado de columnas de carril (igual que `laneBands` en
    // pantalla) — carriles impares (índice 1, 3, 5...) llevan fondo tenue,
    // de arriba de la cabecera de carril hasta abajo de la última tarjeta.
    lanes.forEach((lane) => {
        if (lane.index % 2 !== 1) return;
        const x = layout.laneX[lane.index];
        pdf.setFillColor(...PDF_SLATE_100);
        pdf.rect(X(x), Y(PDF_TITLE_H), T(PDF_CARD_W), T(layout.contentHeight - PDF_TITLE_H), "F");
    });

    // Cabeceras de carril
    lanes.forEach((lane) => {
        const x = layout.laneX[lane.index];
        const yTop = PDF_TITLE_H + PDF_TITLE_GAP;
        const w = PDF_CARD_W;
        pdf.setFillColor(...(lane.esActual ? PDF_MAROON_TINT : PDF_SLATE_50));
        pdf.setDrawColor(...(lane.esActual ? PDF_MAROON : PDF_SLATE_200));
        pdf.setLineWidth(Math.max(T(1), 0.4));
        pdf.roundedRect(X(x), Y(yTop), T(w), T(PDF_LANE_HEADER_H), T(10), T(10), "FD");

        pdf.setFont("courier", "bold");
        pdf.setFontSize(T(10));
        pdf.setTextColor(...PDF_MAROON);
        pdf.text(fitPdfText(pdf, lane.posicion || "—", T(w - 60)), X(x + 10), Y(yTop + 16), { baseline: "middle" });

        if (lane.esActual) {
            const label = "ACTUAL";
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(T(6.5));
            const labelW = pdf.getTextWidth(label); // pt
            const badgeW = labelW + T(10);
            const badgeX = X(x + w - 10) - badgeW;
            pdf.setFillColor(...PDF_MAROON);
            pdf.roundedRect(badgeX, Y(yTop + 10), badgeW, T(13), T(6.5), T(6.5), "F");
            pdf.setTextColor(255, 255, 255);
            pdf.text(label, badgeX + badgeW / 2, Y(yTop + 16.5), { align: "center", baseline: "middle" });
        }

        // Badge "NIVEL N" — dato que el usuario pidió destacar en la cabecera
        // de carril (antes solo vivía en pantalla, ausente del PDF). Empuja
        // el texto de puesto a su derecha, igual que el layout inline en
        // pantalla (span badge + <p> puesto).
        let puestoTextX = X(x + 10);
        const puestoRightEdge = X(x + w - 10);
        if (lane.nivel) {
            const nivelLabel = `NIVEL ${lane.nivel}`;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(T(6.5));
            const nivelW = pdf.getTextWidth(nivelLabel); // pt
            const badgeW = nivelW + T(8);
            const badgeX = X(x + 10);
            pdf.setFillColor(...PDF_GOLD_BG);
            pdf.setDrawColor(...PDF_GOLD_BORDER);
            pdf.setLineWidth(Math.max(T(0.75), 0.3));
            pdf.roundedRect(badgeX, Y(yTop + 25), badgeW, T(13), T(6.5), T(6.5), "FD");
            pdf.setTextColor(...PDF_GOLD_TEXT);
            pdf.text(nivelLabel, badgeX + badgeW / 2, Y(yTop + 31.5), { align: "center", baseline: "middle" });
            puestoTextX = badgeX + badgeW + T(6);
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(7.5));
        pdf.setTextColor(...PDF_SLATE_500);
        pdf.text(fitPdfText(pdf, lane.puestoPtal || "Sin puesto", Math.max(puestoRightEdge - puestoTextX, T(20))), puestoTextX, Y(yTop + 32), { baseline: "middle" });

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(T(6.5));
        pdf.setTextColor(...PDF_SLATE_400);
        const rango = `${formatDate(lane.primeraFecha)} — ${lane.esActual ? "actual" : formatDate(lane.ultimaFecha)}`;
        pdf.text(fitPdfText(pdf, rango, T(w - 20)), X(x + 10), Y(yTop + 46), { baseline: "middle" });
    });

    // Divisores punteados entre carriles — a la mitad del gap entre columnas,
    // igual que en pantalla (ver `dividers` en recomputeLayout).
    pdf.setDrawColor(...PDF_SLATE_300);
    pdf.setLineWidth(Math.max(T(1), 0.4));
    pdf.setLineDashPattern([T(4), T(3)], 0);
    for (let i = 0; i < lanes.length - 1; i++) {
        const dividerX = layout.laneX[i] + PDF_CARD_W + PDF_LANE_GAP_X / 2;
        pdf.line(X(dividerX), Y(PDF_TITLE_H), X(dividerX), Y(layout.contentHeight));
    }
    pdf.setLineDashPattern([], 0);

    // Conectores entre movimientos consecutivos (misma forma en L que en pantalla)
    for (let i = 0; i < movimientos.length - 1; i++) {
        const laneA = layout.laneIndexByPosicion.get(movimientos[i].posicion) ?? 0;
        const laneB = layout.laneIndexByPosicion.get(movimientos[i + 1].posicion) ?? 0;
        const xA = layout.laneX[laneA] + PDF_CARD_W / 2;
        const yA = layout.rowY[i] + layout.rowHeights[i];
        const xB = layout.laneX[laneB] + PDF_CARD_W / 2;
        const yB = layout.rowY[i + 1];
        const cambio = movimientos[i].posicion !== movimientos[i + 1].posicion;

        pdf.setDrawColor(...(cambio ? PDF_AMBER : PDF_GOLD));
        pdf.setLineWidth(Math.max(T(cambio ? 1.75 : 1.4), 0.5));
        if (cambio) pdf.setLineDashPattern([T(4), T(3)], 0); else pdf.setLineDashPattern([], 0);

        if (Math.abs(xA - xB) < 1) {
            pdf.line(X(xA), Y(yA), X(xB), Y(yB));
        } else {
            const midY = (yA + yB) / 2;
            pdf.line(X(xA), Y(yA), X(xA), Y(midY));
            pdf.line(X(xA), Y(midY), X(xB), Y(midY));
            pdf.line(X(xB), Y(midY), X(xB), Y(yB));
        }
        pdf.setLineDashPattern([], 0);
    }

    // Tarjetas de movimiento
    movimientos.forEach((mov, i) => {
        const laneIdx = layout.laneIndexByPosicion.get(mov.posicion) ?? 0;
        const isFirst = i === 0;
        const diff = isFirst ? { differences: [], unchanged: [] } : getMovimientoDiff(mov, movimientos[i - 1]);
        const cambioDePosicion = !isFirst && mov.posicion !== movimientos[i - 1].posicion;
        drawHistorialCardPdf(pdf, mov, layout.laneX[laneIdx], layout.rowY[i], PDF_CARD_W, layout.rowHeights[i], isFirst, diff, cambioDePosicion, X, Y, T);
    });

    return pdf;
};

// Carriles = posiciones distintas que tuvo el empleado, en orden de PRIMERA
// aparición cronológica (movimientos ya vienen ASC por fecha_efectiva/sec
// desde el backend, ver MovimientosPersonalHistorialView) — la posición más
// antigua queda a la izquierda, la vigente al final (derecha).
const useLanes = (movimientos) => {
    return useMemo(() => {
        const byPosicion = new Map();
        movimientos.forEach((mov) => {
            const existente = byPosicion.get(mov.posicion);
            if (!existente) {
                byPosicion.set(mov.posicion, {
                    posicion: mov.posicion,
                    puestoPtal: mov.puesto_ptal,
                    nivel: mov.nivel_tabular,
                    primeraFecha: mov.fecha_efectiva,
                    ultimaFecha: mov.fecha_efectiva,
                });
            } else {
                existente.puestoPtal = mov.puesto_ptal || existente.puestoPtal;
                existente.nivel = mov.nivel_tabular || existente.nivel;
                existente.ultimaFecha = mov.fecha_efectiva;
            }
        });
        const ultimaPosicion = movimientos[movimientos.length - 1]?.posicion;
        return [...byPosicion.values()].map((lane, index) => ({
            ...lane,
            index,
            esActual: lane.posicion === ultimaPosicion,
        }));
    }, [movimientos]);
};

// Un movimiento por tarjeta, colapsada por defecto. Al expandir muestra el
// diff contra su inmediato anterior cronológico (cualquiera sea su carril).
const MovementCard = ({ mov, laneIndex, rowIndex, diff, cambioDePosicion, esPrimero, expanded, onToggle, cardRef }) => {
    // Colapsado por defecto: al abrir el detalle del movimiento solo se ve
    // "Cambios detectados" — "Sin cambios" es secundario y se despliega aparte.
    const [showUnchanged, setShowUnchanged] = useState(false);
    const detailRef = useRef(null);

    // Se dispara solo al ABRIR el detalle (el bloque se desmonta al cerrar,
    // así que cada apertura es un montaje nuevo): el panel entra con un
    // acordeón (height 0 -> auto) y las filas de "Cambios detectados" se
    // suman con stagger, en vez del aparecer/desaparecer seco de antes.
    useGSAP(() => {
        if (!expanded || !detailRef.current) return;
        const el = detailRef.current;
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from(el, { autoAlpha: 0, height: 0, y: -6, duration: 0.28 });
        const rows = el.querySelectorAll(".hist-diff-row");
        if (rows.length) tl.from(rows, { autoAlpha: 0, x: -8, stagger: 0.04, duration: 0.22, ease: "power1.out" }, "-=0.12");
    }, { dependencies: [expanded] });

    // "Sin cambios" es un despliegue aparte (ver toggle abajo) — se anima
    // independiente para no repetir la entrada de todo el panel cada vez.
    useGSAP(() => {
        if (!showUnchanged || !detailRef.current) return;
        const chips = detailRef.current.querySelectorAll(".hist-unchanged-chip");
        if (chips.length) gsap.from(chips, { autoAlpha: 0, y: 4, stagger: 0.02, duration: 0.2, ease: "power1.out" });
    }, { dependencies: [showUnchanged] });

    return (
        <div
            ref={cardRef}
            style={{ gridColumn: laneIndex + 1, gridRow: rowIndex + 1 }}
            className="relative"
        >
            <button
                type="button"
                onClick={onToggle}
                className={`group w-full text-left rounded-xl border bg-white dark:bg-slate-900 shadow-sm px-3.5 py-3 transition-all cursor-pointer ${expanded
                    ? "border-[#bc955c] ring-2 ring-[#bc955c]/15"
                    : "border-slate-200 dark:border-slate-800 hover:border-[#bc955c]/50 hover:shadow-md"}`}
            >
                {cambioDePosicion && (
                    <span className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500">
                        <ArrowRightLeft className="size-2.5" />
                        Cambio de posición
                    </span>
                )}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h5 className="text-[12px] font-black uppercase text-[#621f32] dark:text-[#e3c793] leading-tight truncate" title={mov.accion_nombre}>
                            {mov.accion_nombre || "—"}
                        </h5>
                        <span className="mt-1 inline-block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-full">
                            {mov.motivo_nombre || "—"}
                        </span>
                    </div>
                    <ChevronDown className={`size-4 shrink-0 mt-0.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">F. Efectiva</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatDate(mov.fecha_efectiva)}</span>
                    </div>
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">F. Captura</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{formatDate(mov.fecha_captura)}</span>
                    </div>
                    <div>
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Sec</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{mov.sec ?? "-"}</span>
                    </div>
                    <div className="min-w-0">
                        <span className="block text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide">Por</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400 truncate block" title={mov.por || undefined}>{mov.por || "-"}</span>
                    </div>
                </div>
            </button>

            {expanded && (
                <div ref={detailRef} className="mt-1.5 overflow-hidden rounded-xl border border-dashed border-[#621f32]/20 dark:border-slate-800 bg-[#621f32]/[0.03] dark:bg-slate-900/40 px-3.5 py-3">
                    {esPrimero ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            Movimiento inicial de este historial — no hay un registro anterior con el cual comparar.
                        </p>
                    ) : (
                        <>
                            <div className="mb-2.5">
                                <h6 className="text-[9px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c] mb-1.5">
                                    Cambios detectados{diff.differences.length > 0 ? ` (${diff.differences.length})` : ""}
                                </h6>
                                {diff.differences.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Sin cambios de datos respecto al movimiento anterior.</p>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {diff.differences.map((d) => (
                                            <div key={d.key} className="hist-diff-row flex flex-wrap items-center gap-1.5 text-[10px] bg-white dark:bg-slate-950 rounded-lg px-2 py-1.5 border border-slate-100 dark:border-slate-800">
                                                <span className="font-black text-slate-600 dark:text-slate-300 mr-0.5">{d.label}:</span>
                                                <span className="line-through italic text-slate-400 dark:text-slate-600 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{d.oldValue}</span>
                                                <span className="text-slate-400">→</span>
                                                <span className="font-black text-[#621f32] dark:text-[#e3c793] px-1 py-0.5 bg-[#621f32]/10 dark:bg-[#bc955c]/10 rounded">{d.newValue}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {diff.unchanged.length > 0 && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setShowUnchanged((v) => !v); }}
                                        className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 mb-1.5 cursor-pointer"
                                    >
                                        <ChevronDown className={`size-3 transition-transform ${showUnchanged ? "rotate-180" : ""}`} />
                                        Sin cambios ({diff.unchanged.length})
                                    </button>
                                    {showUnchanged && (
                                        <div className="flex flex-wrap gap-1">
                                            {diff.unchanged.map((u) => (
                                                <span key={u.key} title={u.value} className="hist-unchanged-chip text-[9px] font-semibold text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-md truncate max-w-[160px]">
                                                    {u.label}: {u.value}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default function HistorialMovimientosTab({ estado, numEmpleado, canViewPhoto = true }) {
    const { toast } = useToast();
    const [downloading, setDownloading] = useState(false);
    const [showExportExcelModal, setShowExportExcelModal] = useState(false);
    const exportExcelAbortRef = useRef(null);
    const [exportingImage, setExportingImage] = useState(false);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const canvasRef = useRef(null);
    const bgLayerRef = useRef(null);
    const cardRefs = useRef(new Map());
    const laneRefs = useRef(new Map());
    const pathRefs = useRef(new Map());
    const introKeyRef = useRef(null);
    const [paths, setPaths] = useState([]);
    const [dividers, setDividers] = useState([]);
    const [laneBands, setLaneBands] = useState([]);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const movimientos = estado.data || [];
    const lanes = useLanes(movimientos);
    const laneIndexByPosicion = useMemo(() => new Map(lanes.map((l) => [l.posicion, l.index])), [lanes]);

    // Descarga el mismo dataset ya cargado en este tab (SELECT * FROM
    // cp_tbl_mov_completo_29_05_26 WHERE num_empleado = numEmpleado, ver
    // MovimientosPersonalHistorialView) hacia un .xlsx real. Sin foto: pasa
    // por el generador genérico del backend (ExportExcelView), sin volver a
    // pedir los datos. Con foto: se arma client-side (ver downloadExcelConFoto)
    // porque ese endpoint compartido no soporta imágenes.
    const runExportExcel = useCallback(async (incluirFoto) => {
        if (movimientos.length === 0 || downloading) return;
        setDownloading(true);
        const controller = new AbortController();
        exportExcelAbortRef.current = controller;
        try {
            const filename = `Historial_Movimientos_${numEmpleado}.xlsx`;
            const rows = buildExportRows(movimientos);
            if (incluirFoto) {
                const fotoEncontrada = await downloadExcelConFoto(rows, filename, numEmpleado, controller.signal);
                if (!fotoEncontrada) toast.info("El empleado no tiene fotografía registrada — se generó el Excel sin ella.");
            } else {
                const response = await PlantillaService.exportExcel(rows, filename, { stickyColumn: false });
                if (!response.ok) throw new Error("request failed");
                downloadBlobAsFile(await response.blob(), filename);
            }
            setShowExportExcelModal(false);
        } catch (err) {
            if (err.name !== "AbortError") toast.error("No se pudo generar el archivo Excel.");
        } finally {
            setDownloading(false);
            exportExcelAbortRef.current = null;
        }
    }, [movimientos, numEmpleado, downloading, toast]);

    // Botón "Descargar excel": si el usuario puede ver fotografías en este
    // expediente, se le pregunta antes (mismo patrón que MovimientosPersonalTab
    // y BajasTab, ver ExportConFotosModal); si no tiene ese permiso, descarga
    // directo sin preguntar — nunca ofrecer una opción que de todos modos
    // fallaría al pedir la foto.
    const handleDownloadExcel = useCallback(() => {
        if (movimientos.length === 0 || downloading) return;
        if (canViewPhoto) setShowExportExcelModal(true);
        else void runExportExcel(false);
    }, [movimientos, downloading, canViewPhoto, runExportExcel]);

    const toggleExpanded = useCallback((id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const recomputeLayout = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || movimientos.length === 0) return;
        const canvasRect = canvas.getBoundingClientRect();
        setCanvasSize({ width: canvas.scrollWidth, height: canvas.scrollHeight });

        const next = [];
        for (let i = 0; i < movimientos.length - 1; i++) {
            const elA = cardRefs.current.get(movimientos[i].id);
            const elB = cardRefs.current.get(movimientos[i + 1].id);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            const xA = rectA.left - canvasRect.left + rectA.width / 2;
            const yA = rectA.bottom - canvasRect.top;
            const xB = rectB.left - canvasRect.left + rectB.width / 2;
            const yB = rectB.top - canvasRect.top;
            const cambio = movimientos[i].posicion !== movimientos[i + 1].posicion;
            const d = Math.abs(xA - xB) < 1
                ? `M ${xA} ${yA} L ${xB} ${yB}`
                : `M ${xA} ${yA} V ${(yA + yB) / 2} H ${xB} V ${yB}`;
            next.push({ id: `${movimientos[i].id}-${movimientos[i + 1].id}`, d, cambio });
        }
        setPaths(next);

        // Líneas punteadas divisorias entre carriles — a la mitad del gap
        // entre la cabecera de un carril y el siguiente (mismas columnas que
        // ambos grids, ver comentario de alineación arriba). Mismos cortes
        // se reutilizan como límites de las bandas de sombreado intercalado.
        const dividerXs = [];
        for (let i = 0; i < lanes.length - 1; i++) {
            const elA = laneRefs.current.get(lanes[i].posicion);
            const elB = laneRefs.current.get(lanes[i + 1].posicion);
            if (!elA || !elB) continue;
            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();
            dividerXs.push(((rectA.right - canvasRect.left) + (rectB.left - canvasRect.left)) / 2);
        }
        setDividers(dividerXs.map((x, i) => ({ posicion: lanes[i].posicion, x })));

        if (dividerXs.length === lanes.length - 1) {
            const boundaries = [0, ...dividerXs, canvas.scrollWidth];
            setLaneBands(
                lanes
                    .map((lane, i) => ({ posicion: lane.posicion, left: boundaries[i], width: boundaries[i + 1] - boundaries[i], shaded: i % 2 === 1 }))
                    .filter((band) => band.shaded)
            );
        }
    }, [movimientos, lanes]);

    useLayoutEffect(() => {
        recomputeLayout();
    }, [recomputeLayout, expandedIds]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ro = new ResizeObserver(() => recomputeLayout());
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [recomputeLayout]);

    // Descarga el diagrama completo (carriles + conectores + detalle de CADA
    // movimiento, siempre desplegado) como PDF vectorial — ver
    // buildHistorialPdf arriba para el porqué del enfoque (nada de captura de
    // DOM). No depende del estado de expansión en pantalla ni del layout por
    // getBoundingClientRect: se recalcula todo desde `movimientos`/`lanes`.
    const handleDownloadImage = useCallback(() => {
        if (movimientos.length === 0 || exportingImage) return;
        setExportingImage(true);
        try {
            const pdf = buildHistorialPdf(movimientos, lanes, numEmpleado);
            pdf.save(`Historial_Movimientos_${numEmpleado}.pdf`);
        } catch (err) {
            toast.error("No se pudo generar la imagen.");
        } finally {
            setExportingImage(false);
        }
    }, [movimientos, lanes, exportingImage, numEmpleado, toast]);

    // "Construcción" animada del diagrama — una sola vez por dataset cargado
    // (identificado por `estado.data`, referencia estable mientras solo se
    // expanden/colapsan tarjetas): fondo + carriles entran, las tarjetas
    // aparecen en orden cronológico y los conectores se "dibujan" en cascada.
    // Recomputes posteriores (expand/collapse, resize) NO repiten la intro.
    useGSAP(() => {
        if (!canvasRef.current || movimientos.length === 0) return;
        const expectedConnectors = Math.max(movimientos.length - 1, 0);
        if (paths.length !== expectedConnectors) return; // layout aún no calculado
        if (introKeyRef.current === estado.data) return; // este dataset ya se animó
        introKeyRef.current = estado.data;

        const laneEls = lanes.map((l) => laneRefs.current.get(l.posicion)).filter(Boolean);
        const cardEls = movimientos.map((m) => cardRefs.current.get(m.id)).filter(Boolean);
        const pathEls = paths.map((p) => pathRefs.current.get(p.id)).filter(Boolean);

        const reduceMotion = typeof window !== "undefined"
            && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) {
            paths.forEach((p) => {
                const el = pathRefs.current.get(p.id);
                if (el) gsap.set(el, { strokeDasharray: p.cambio ? "6 4" : "none" });
            });
            return;
        }

        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        if (bgLayerRef.current) tl.from(bgLayerRef.current, { autoAlpha: 0, duration: 0.5 }, 0);
        if (laneEls.length) tl.from(laneEls, { autoAlpha: 0, y: -10, duration: 0.35, stagger: 0.05 }, 0.05);
        if (cardEls.length) {
            tl.from(cardEls, { autoAlpha: 0, y: 14, scale: 0.97, duration: 0.32, stagger: 0.045, ease: "back.out(1.5)" }, "-=0.15");
        }
        pathEls.forEach((el, i) => {
            const length = el.getTotalLength();
            const cambio = paths[i]?.cambio;
            gsap.set(el, { strokeDasharray: length, strokeDashoffset: length });
            tl.to(el, {
                strokeDashoffset: 0,
                duration: 0.4,
                ease: "power2.inOut",
                onComplete: () => gsap.set(el, { strokeDasharray: cambio ? "6 4" : "none" }),
            }, i === 0 ? "-=0.1" : "<0.08");
        });
    }, { scope: canvasRef, dependencies: [movimientos, lanes, paths] });

    if (estado.status === "loading" || estado.status === "idle") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <Loader2 className="size-7 text-[#621f32]/40 dark:text-slate-600 animate-spin mb-3" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cargando historial de movimientos...</p>
            </div>
        );
    }

    if (estado.status === "error") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-4 border-2 border-double border-red-200 dark:border-red-900/50">
                    <AlertTriangle className="size-6 text-red-400 dark:text-red-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">No se pudo cargar el historial de movimientos</p>
                <p className="text-xs text-slate-400 mt-1">Intenta cerrar y volver a abrir el expediente</p>
            </div>
        );
    }

    if (estado.status === "empty" || movimientos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                    <FileQuestion className="size-6 text-[#621f32]/40 dark:text-slate-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">Sin movimientos registrados</p>
                <p className="text-xs text-slate-400 mt-1">No hay historial en cp_tbl_mov_completo_29_05_26 para el número de empleado {numEmpleado}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <GitCommitHorizontal className="size-3.5 text-[#bc955c]" />
                    {movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"} · {lanes.length} {lanes.length === 1 ? "posición" : "posiciones"}
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700">— desplaza horizontalmente para ver todos los carriles</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleDownloadImage}
                        disabled={exportingImage}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 text-[#621f32] dark:text-[#bc955c] border border-[#621f32]/20 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-[#621f32]/6 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {exportingImage ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />}
                        Descargar Imagen
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={downloading}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-[#4a1726] dark:hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                        Descargar excel
                    </button>
                </div>
            </div>

            {/* max-h + overflow-auto (x e y) propios: así el scrollbar horizontal
                queda siempre visible al fondo de este panel, sin tener que
                bajar todo el modal para encontrarlo. */}
            <div className="overflow-auto custom-scrollbar rounded-xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/40 p-4 max-h-[55vh]">
                <div ref={canvasRef} className="relative" style={{ minWidth: lanes.length * LANE_MIN_WIDTH }}>
                    {/* Fondo (sombreado + conectores + divisores) agrupado en una sola
                        capa para poder hacerle un fundido de entrada conjunto con GSAP. */}
                    <div ref={bgLayerRef} className="absolute inset-0 pointer-events-none">
                        {/* Sombreado intercalado por carril — misma columna que la
                            cabecera y las tarjetas de ese carril, ver laneBands arriba. */}
                        {laneBands.map((band) => (
                            <div
                                key={band.posicion}
                                className="absolute top-0 bottom-0 bg-slate-100/70 dark:bg-slate-900/50"
                                style={{ left: band.left, width: band.width }}
                            />
                        ))}
                        <svg
                            className="absolute top-0 left-0"
                            width={canvasSize.width}
                            height={canvasSize.height}
                        >
                            <defs>
                                <marker id="hist-arrow-gold" viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 Z" fill={GOLD} />
                                </marker>
                                <marker id="hist-arrow-amber" viewBox="0 0 10 10" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 Z" fill={AMBER} />
                                </marker>
                            </defs>
                            {paths.map((p) => (
                                <path
                                    key={p.id}
                                    ref={(el) => {
                                        if (el) pathRefs.current.set(p.id, el);
                                        else pathRefs.current.delete(p.id);
                                    }}
                                    d={p.d}
                                    fill="none"
                                    stroke={p.cambio ? AMBER : GOLD}
                                    strokeWidth={p.cambio ? 2.5 : 2}
                                    strokeDasharray={p.cambio ? "6 4" : undefined}
                                    strokeLinecap="round"
                                    opacity={p.cambio ? 0.85 : 0.55}
                                    markerEnd={`url(#${p.cambio ? "hist-arrow-amber" : "hist-arrow-gold"})`}
                                />
                            ))}
                        </svg>

                        {/* Líneas punteadas divisorias entre carriles — separación visual
                            de cada columna de posición a lo largo de todo el diagrama */}
                        {dividers.map((d) => (
                            <div
                                key={d.posicion}
                                className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 dark:border-slate-700"
                                style={{ left: d.x }}
                            />
                        ))}
                    </div>

                    {/* Cabeceras de carril */}
                    <div className="relative z-10 pb-4">
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH - 20}px, 1fr))` }}>
                            {lanes.map((lane) => (
                                <div
                                    key={lane.posicion}
                                    ref={(el) => {
                                        if (el) laneRefs.current.set(lane.posicion, el);
                                        else laneRefs.current.delete(lane.posicion);
                                    }}
                                    className={`rounded-xl border px-3 py-2.5 ${lane.esActual
                                        ? "border-[#621f32] dark:border-[#bc955c] bg-[#621f32]/[0.06] dark:bg-slate-900"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"}`}
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-mono text-[13px] font-black text-[#621f32] dark:text-[#e3c793] truncate">{lane.posicion || "—"}</span>
                                        {lane.esActual && (
                                            <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-white bg-[#621f32] dark:bg-[#bc955c] dark:text-slate-950 px-1.5 py-0.5 rounded-full">Actual</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {lane.nivel && (
                                            <span className="shrink-0 font-mono text-[9px] font-black uppercase text-[#7a5a30] dark:text-[#e3c793] bg-[#bc955c]/15 dark:bg-[#bc955c]/15 border border-[#bc955c]/30 px-1.5 py-0.5 rounded">
                                                Nivel {lane.nivel}
                                            </span>
                                        )}
                                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate" title={lane.puestoPtal || undefined}>
                                            {lane.puestoPtal || "Sin puesto"}
                                        </p>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 mt-1">
                                        {formatDate(lane.primeraFecha)} — {lane.esActual ? "actual" : formatDate(lane.ultimaFecha)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tarjetas de movimiento, una por fila cronológica global */}
                    <div className="relative z-10 grid gap-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${LANE_MIN_WIDTH - 20}px, 1fr))`, gridAutoRows: "min-content" }}>
                        {movimientos.map((mov, i) => {
                            const laneIndex = laneIndexByPosicion.get(mov.posicion) ?? 0;
                            const esPrimero = i === 0;
                            const diff = esPrimero ? { differences: [], unchanged: [] } : getMovimientoDiff(mov, movimientos[i - 1]);
                            const cambioDePosicion = !esPrimero && mov.posicion !== movimientos[i - 1].posicion;
                            return (
                                <MovementCard
                                    key={mov.id}
                                    mov={mov}
                                    laneIndex={laneIndex}
                                    rowIndex={i}
                                    diff={diff}
                                    cambioDePosicion={cambioDePosicion}
                                    esPrimero={esPrimero}
                                    expanded={expandedIds.has(mov.id)}
                                    onToggle={() => toggleExpanded(mov.id)}
                                    cardRef={(el) => {
                                        if (el) cardRefs.current.set(mov.id, el);
                                        else cardRefs.current.delete(mov.id);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <ExportConFotosModal
                open={showExportExcelModal}
                onClose={() => setShowExportExcelModal(false)}
                onConfirm={(incluirFotos) => runExportExcel(incluirFotos)}
                isExporting={downloading}
                onCancelExport={() => exportExcelAbortRef.current?.abort()}
                rowCount={movimientos.length}
                canIncluirFotos
                showDatosPersonalesOption={false}
            />
        </div>
    );
}
