"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserX,
  Search,
  Building2,
  Layers,
  Users,
  Briefcase,
  Network,
  Info,
  Maximize2,
  Minimize2,
  ArrowRight,
  FolderTree,
  ListCollapse,
  BadgeAlert,
  HelpCircle,
  Locate,
  Download,
  Loader2,
  Plus,
  Minus,
  ChevronDown as ChevronDownIcon,
  Building,
  Pencil,
  X,
  Check,
  RotateCcw,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import { PlantillaService } from "@/services/plantilla.service";
import { CatalogoEstructuraService } from "@/services/catalogo_estructura.service";
import RequirePermission from "@/components/auth/RequirePermission";
import { PERMISSIONS } from "@/config/permissions";
import { useAuth } from "@/hooks/useAuth";

// ─── Regla de negocio del determinante (ver eje_central_back plantilla/organigrama_tree.py) ─
// Nivel → posición de segmento (G,C,A,S,D). "Titular" se trata como raíz (mismo rango que General).
// "Enlace" no tiene tramo propio en el código (solo hay 5, y Jefe Depto ya
// ocupa el último) — se codifica aparte en el backend (_crear_enlace), pero
// participa aquí igual para que el filtro de tipos disponibles lo ofrezca
// solo bajo un nivel más superficial (ver usos de LEVEL_SEGPOS más abajo).
const LEVEL_SEGPOS = { Titular: 0, General: 0, Central: 1, Director: 2, "Subdir.": 3, "Jefe Depto": 4, Enlace: 5 };
// Tipos que se pueden crear como hijo (General se crea aparte, como unidad de negocio nueva).
const TIPO_LABELS = {
  Central: "Dirección Central",
  Director: "Dirección de Área",
  "Subdir.": "Subdirección",
  "Jefe Depto": "Jefatura de Departamento",
  Enlace: "Enlace",
};

// ─── Config de carriles del árbol (layout visual, independiente de LEVEL_SEGPOS) ─
const CATCH_ALL_KEY = "__catch_all__";
const LANE_CONFIG = [
  { key: "Titular", match: n => n === "Titular", label: "Titular", Icon: Building2, badgeColor: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-950", iconBg: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  { key: "General", match: n => n === "General", label: "General", Icon: Building2, badgeColor: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-950", iconBg: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  { key: "Central", match: n => n === "Central", label: "Central", Icon: Network, badgeColor: "bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900", iconBg: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-300" },
  { key: "Director", match: n => n === "Director", label: "Director", Icon: Layers, badgeColor: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900", iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300" },
  { key: "Subdir.", match: n => n === "Subdir.", label: "Subdir.", Icon: Users, badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900", iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { key: "Jefe Depto", match: n => n === "Jefe Depto", label: "Jefe Depto", Icon: Briefcase, badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700", iconBg: "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400" },
  // Catch-all: agrupa tanto los nodos reales de nivel "Enlace" como
  // cualquier nivel_direccion no reconocido/vacío ("(en blanco)" u otros).
  { key: CATCH_ALL_KEY, match: () => true, label: "Enlace", Icon: Briefcase, badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700", iconBg: "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400" },
];

function getLaneForLevel(nivelDireccion) {
  return LANE_CONFIG.find(l => l.key !== CATCH_ALL_KEY && l.match(nivelDireccion)) || LANE_CONFIG[LANE_CONFIG.length - 1];
}

// ─── Reordenamiento de hermanos (drag-and-drop) ───────────────────────────
// Pura: no muta `siblingNodes`. Devuelve el nuevo arreglo de nodos (mismo
// padre) con `draggedCode` insertado antes/después de `targetCode`, o null
// si alguno de los dos códigos no está en la lista. La usan tanto la
// previsualización en vivo (onDragOver) como el commit final (onDrop) —
// así lo que se ve durante el arrastre es exactamente lo que se guarda.
function reorderSiblings(siblingNodes, draggedCode, targetCode, insertAfter) {
  const fromIdx = siblingNodes.findIndex(c => c.departamento === draggedCode);
  if (fromIdx === -1) return null;
  const arr = [...siblingNodes];
  const [moved] = arr.splice(fromIdx, 1);
  const targetIdx = arr.findIndex(c => c.departamento === targetCode);
  if (targetIdx === -1) return null;
  arr.splice(insertAfter ? targetIdx + 1 : targetIdx, 0, moved);
  return arr;
}

// ─── Geometría del layout de carriles (debe calzar con las clases Tailwind ─
// w-60 / gap-8 de NodeCard) ────────────────────────────────────────────────
const CARD_WIDTH = 240; // w-60
const CARD_HEIGHT = 192; // h-48
const CARD_GAP = 32; // gap-8
const SLOT_WIDTH = CARD_WIDTH + CARD_GAP;
const LANE_ROW_HEIGHT = 240; // alto de tarjeta (h-48=192) + botón toggle + aire
const LABEL_ROW_HEIGHT = 40; // divisor punteado + etiqueta del carril (h-10)
const LANE_GAP = 40; // separación vertical entre carriles (gap-10)
const BUS_DROP = 24; // qué tan abajo del padre baja el "tronco" antes del bus horizontal

// ─── Layout del árbol como funciones puras (sin hooks) ────────────────────
// Extraídas de los useMemo de OrganigramaContent para poder reutilizarlas
// tal cual desde la exportación a PDF con un `expandedNodes` arbitrario
// (p.ej. "todo desglosado"), sin tener que tocar el estado de React ni
// esperar un re-render — evita el problema de closures obsoletos (la
// función de exportación, si leyera los valores memoizados del componente
// tras un setState, seguiría viendo los de ANTES del cambio hasta el
// siguiente render). Los hooks del componente siguen siendo la única fuente
// para lo que se pinta en pantalla; estas funciones son las mismas cuentas,
// solo que también invocables a demanda con cualquier `expandedNodes`.
function computeVisibleNodes(organigramaData, expandedNodes, previewOrder) {
  const result = []; // { node, lane, parentDepartamento, order }
  if (!organigramaData) return result;
  let order = 0;
  const walk = (node, parentDepartamento) => {
    result.push({ node, lane: getLaneForLevel(node.nivel_direccion), parentDepartamento, order: order++ });
    if (!!expandedNodes[node.departamento]) {
      let children = node.subordinados || [];
      if (previewOrder && previewOrder.parentCode === node.departamento) {
        const byCode = new Map(children.map(c => [c.departamento, c]));
        children = previewOrder.order.map(code => byCode.get(code)).filter(Boolean);
      }
      children.forEach(child => walk(child, node.departamento));
    }
  };
  walk(organigramaData, null);
  return result;
}

function computeLanesToRender(visibleNodes) {
  const byLaneKey = new Map();
  visibleNodes.forEach(entry => {
    if (!byLaneKey.has(entry.lane.key)) byLaneKey.set(entry.lane.key, []);
    byLaneKey.get(entry.lane.key).push(entry);
  });
  return LANE_CONFIG
    .map(lane => ({ lane, entries: (byLaneKey.get(lane.key) || []).sort((a, b) => a.order - b.order) }))
    .filter(({ entries }) => entries.length > 0);
}

function computeTreeLayout(visibleNodes, organigramaData) {
  const childrenByParent = new Map();
  visibleNodes.forEach(({ node, parentDepartamento }) => {
    if (!parentDepartamento) return;
    if (!childrenByParent.has(parentDepartamento)) childrenByParent.set(parentDepartamento, []);
    childrenByParent.get(parentDepartamento).push(node.departamento);
  });

  const centerX = new Map();
  let leafIndex = 0;
  const assign = (code) => {
    const children = childrenByParent.get(code) || [];
    if (children.length === 0) {
      const cx = leafIndex * SLOT_WIDTH + SLOT_WIDTH / 2;
      leafIndex += 1;
      centerX.set(code, cx);
      return cx;
    }
    const childCenters = children.map(assign);
    const cx = (Math.min(...childCenters) + Math.max(...childCenters)) / 2;
    centerX.set(code, cx);
    return cx;
  };
  if (organigramaData) assign(organigramaData.departamento);

  return { centerX, childrenByParent, totalWidth: Math.max(leafIndex * SLOT_WIDTH, SLOT_WIDTH) };
}

function computeLaneTopY(lanesToRender) {
  const map = new Map();
  let cumulative = 0;
  lanesToRender.forEach(({ lane }) => {
    cumulative += LABEL_ROW_HEIGHT;
    map.set(lane.key, cumulative);
    cumulative += LANE_ROW_HEIGHT + LANE_GAP;
  });
  return { map, totalHeight: Math.max(cumulative - LANE_GAP, LANE_ROW_HEIGHT) };
}

// Un conector por PADRE (no por arista): un solo tronco baja del padre, un
// bus horizontal une el rango de sus hijos, y una vertical por hijo baja
// desde el bus hasta su tarjeta. Devuelve segmentos crudos (no un `path` de
// SVG) para que tanto el <svg> en pantalla como el dibujo vectorial del PDF
// puedan consumir la misma geometría sin duplicar la lógica de trazado.
function computeConnectors(treeLayout, laneTopY, allNodes) {
  const next = [];
  treeLayout.childrenByParent.forEach((childCodes, parentCode) => {
    const parentLaneKey = getLaneForLevel(allNodes[parentCode]?.nivel_direccion).key;
    const parentTop = laneTopY.map.get(parentLaneKey);
    const parentCx = treeLayout.centerX.get(parentCode);
    if (parentTop === undefined || parentCx === undefined) return;
    const px = parentCx;
    const py = parentTop + CARD_HEIGHT;

    const childPoints = childCodes
      .map(code => {
        const childLaneKey = getLaneForLevel(allNodes[code]?.nivel_direccion).key;
        const top = laneTopY.map.get(childLaneKey);
        const cx = treeLayout.centerX.get(code);
        if (top === undefined || cx === undefined) return null;
        return { cx, cy: top };
      })
      .filter(Boolean);
    if (childPoints.length === 0) return;

    const busY = py + BUS_DROP;
    const minX = Math.min(...childPoints.map(c => c.cx));
    const maxX = Math.max(...childPoints.map(c => c.cx));

    const segments = [[px, py, px, busY]];
    if (childPoints.length > 1) segments.push([minX, busY, maxX, busY]);
    childPoints.forEach(c => segments.push([c.cx, busY, c.cx, c.cy]));

    next.push({ parentId: parentCode, segments });
  });
  return next;
}

function segmentsToSvgPath(segments) {
  return segments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(" ");
}

// ─── Exportación de organigrama a PDF vectorial ───────────────────────────
// Reemplaza el enfoque anterior (rasterizar el árbol completo a PNG de alta
// resolución con html-to-image y pegarlo en el PDF): por más que se subiera
// la resolución, seguía siendo una imagen de ancho de píxeles finito, así
// que en algún nivel de zoom siempre terminaba pixelándose. Esta versión
// dibuja el organigrama directo con las primitivas vectoriales de jsPDF
// (rect/texto/línea) a partir de las MISMAS coordenadas analíticas que ya
// calcula el layout en pantalla (computeTreeLayout/computeLaneTopY/
// computeConnectors) — nunca captura el DOM ni pasa por una imagen
// intermedia, así que el resultado es 100% vectorial: zoom infinito sin
// perder nitidez, y el archivo pesa una fracción de lo que pesaba la
// versión rasterizada.
const PDF_MAX_DIM_PT = 14000; // techo físico de página (~194in), límite práctico de lectores PDF
const PX_TO_PT = 0.75;        // 96 CSS px/in → 72pt/in
const PDF_MARGIN_PX = 48;

const PDF_LANE_PALETTE = {
  Titular: { badgeBg: [255, 241, 242], badgeText: [136, 19, 55] },     // rose-50 / rose-800
  General: { badgeBg: [255, 241, 242], badgeText: [136, 19, 55] },
  Central: { badgeBg: [255, 241, 242], badgeText: [76, 5, 25] },       // rose-50 / rose-950
  Director: { badgeBg: [255, 251, 235], badgeText: [180, 83, 9] },     // amber-50 / amber-700
  "Subdir.": { badgeBg: [255, 251, 235], badgeText: [180, 83, 9] },
  "Jefe Depto": { badgeBg: [248, 250, 252], badgeText: [51, 65, 85] }, // slate-50 / slate-700
  [CATCH_ALL_KEY]: { badgeBg: [248, 250, 252], badgeText: [51, 65, 85] },
};

function drawOrganigramaCardPdf(pdf, node, leftPx, topPx, X, Y, T, lane) {
  const palette = PDF_LANE_PALETTE[lane.key] || PDF_LANE_PALETTE[CATCH_ALL_KEY];
  const x = X(leftPx), y = Y(topPx);
  const w = T(CARD_WIDTH), h = T(CARD_HEIGHT);
  const pad = T(16);
  const contentW = w - pad * 2;
  const cx = x + w / 2;
  // Sin piso mínimo de tamaño de fuente: el tamaño de letra debe encoger en
  // la MISMA proporción que el interlineado/separaciones (todo pasa por la
  // misma `T`) para que el contenido nunca se amontone dentro de la
  // tarjeta. Un piso (ej. "nunca bajar de 4pt") rompía justo eso: en
  // árboles grandes exportados como "Todo Desglosado", `scale` puede
  // reducirse mucho para que la página quepa en el techo físico de un PDF
  // (~194in) — con un piso, el texto se quedaba fijo en 4pt pero el
  // interlineado seguía encogiendo con `scale`, así que las líneas
  // terminaban superpuestas. Al ser vectorial, un tamaño nominal pequeño no
  // es un problema: el lector de PDF puede acercar el zoom todo lo que
  // haga falta sin perder nitidez — para eso se pidió que fuera vectorial.
  const fs = (px) => T(px);

  // Fondo + borde de la tarjeta (siempre neutro, igual que el estado por
  // defecto en pantalla — el PDF no reproduce estados interactivos como
  // selección/arrastre, solo el contenido).
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240); // slate-200
  pdf.setLineWidth(Math.max(T(1), 0.4));
  pdf.roundedRect(x, y, w, h, T(14), T(14), "FD");

  // Badge de nivel
  const badgeLabel = (node.nivel_direccion || "Depto.").toUpperCase();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fs(7));
  const badgeTextW = pdf.getTextWidth(badgeLabel);
  const badgePadX = T(8);
  const badgeH = T(15);
  const badgeY = y + pad;
  pdf.setFillColor(...palette.badgeBg);
  pdf.roundedRect(x + pad, badgeY, badgeTextW + badgePadX * 2, badgeH, badgeH / 2, badgeH / 2, "F");
  pdf.setTextColor(...palette.badgeText);
  pdf.text(badgeLabel, x + pad + badgePadX, badgeY + badgeH / 2, { baseline: "middle" });

  // Título (descripcion_larga), hasta 2 líneas
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fs(9.5));
  pdf.setTextColor(30, 41, 59); // slate-800
  let titleLines = pdf.splitTextToSize(node.descripcion_larga || "", contentW);
  if (titleLines.length > 2) titleLines = [titleLines[0], `${titleLines[1]}…`];
  const titleStartY = y + T(58);
  titleLines.forEach((line, i) => pdf.text(line, cx, titleStartY + i * T(13), { align: "center" }));

  // Divisor
  const dividerY = titleStartY + (titleLines.length - 1) * T(13) + T(12);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(Math.max(T(1), 0.4));
  pdf.line(cx - T(16), dividerY, cx + T(16), dividerY);

  // Cuerpo: estado de la plaza titular u ocupante
  const bodyY = dividerY + T(16);
  const sinPlaza = !node.num_posicion_gerente || node.num_posicion_gerente === "(en blanco)";
  const plazaInactiva = !sinPlaza && (!node.ocupante || !node.ocupante.activa);
  const vacante = !sinPlaza && !plazaInactiva && node.ocupante?.vacante;

  if (sinPlaza) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(fs(8.5));
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text("Sin plaza titular", cx, bodyY, { align: "center" });
  } else if (plazaInactiva) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fs(8.5));
    pdf.setTextColor(190, 18, 60); // rose-700
    pdf.text("Plaza inactiva", cx, bodyY, { align: "center" });
  } else if (vacante) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fs(8.5));
    pdf.setTextColor(180, 83, 9); // amber-700
    pdf.text("Departamento vacante", cx, bodyY, { align: "center" });
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fs(9.5));
    pdf.setTextColor(51, 65, 85); // slate-700
    let nameLines = pdf.splitTextToSize(node.ocupante?.nombre || "", contentW);
    if (nameLines.length > 2) nameLines = [nameLines[0], `${nameLines[1]}…`];
    nameLines.forEach((line, i) => pdf.text(line, cx, bodyY + i * T(12), { align: "center" }));
    const infoY = bodyY + (nameLines.length - 1) * T(12) + T(15);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(fs(9));
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`Nivel: ${node.ocupante.nivel || "N/A"}`, cx, infoY, { align: "center" });
    pdf.text(`SMB: ${formatSMB(node.ocupante.smb)}`, cx, infoY + T(11), { align: "center" });
  }

  // Footer: código + plaza
  const footerLineY = y + h - T(24);
  const footerTextY = y + h - T(13);
  pdf.setDrawColor(241, 245, 249); // slate-100
  pdf.setLineWidth(Math.max(T(1), 0.4));
  pdf.line(x + pad, footerLineY, x + w - pad, footerLineY);
  pdf.setFont("courier", "normal");
  pdf.setFontSize(fs(7.5));
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text(`#${node.departamento}`, x + pad, footerTextY, { baseline: "middle" });
  if (!sinPlaza) {
    pdf.text(`Plaza: ${node.num_posicion_gerente}`, x + w - pad, footerTextY, { align: "right", baseline: "middle" });
  }
}

// Recibe exactamente los mismos objetos que produce el layout analítico
// (computeTreeLayout/computeLaneTopY/computeConnectors) y devuelve un
// jsPDF ya armado (falta solo `.save(nombre)`). Una sola página del tamaño
// exacto del contenido (escalada uniformemente solo si excede el techo
// físico de un lector PDF) — como es vectorial, reducir la escala física no
// pierde nitidez: el lector siempre puede hacer zoom sobre los mismos
// trazos vectoriales.
function buildOrganigramaPdf({ lanesToRender, treeLayout, laneTopY, connectors, allNodes }) {
  const totalWpx = treeLayout.totalWidth + PDF_MARGIN_PX * 2;
  const totalHpx = laneTopY.totalHeight + PDF_MARGIN_PX * 2;

  let pageWpt = totalWpx * PX_TO_PT;
  let pageHpt = totalHpx * PX_TO_PT;
  const scale = Math.min(1, PDF_MAX_DIM_PT / pageWpt, PDF_MAX_DIM_PT / pageHpt);
  pageWpt *= scale;
  pageHpt *= scale;

  const pdf = new jsPDF({
    orientation: pageWpt >= pageHpt ? "l" : "p",
    unit: "pt",
    format: [pageWpt, pageHpt],
  });

  const T = (px) => px * PX_TO_PT * scale;
  const X = (px) => T(px + PDF_MARGIN_PX);
  const Y = (px) => T(px + PDF_MARGIN_PX);

  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.rect(0, 0, pageWpt, pageHpt, "F");

  // Divisores punteados de carril
  pdf.setDrawColor(203, 213, 225); // slate-300
  pdf.setLineWidth(Math.max(T(1), 0.4));
  pdf.setLineDashPattern([T(4), T(3)], 0);
  lanesToRender.forEach(({ lane }) => {
    const labelY = Y(laneTopY.map.get(lane.key) - LABEL_ROW_HEIGHT / 2);
    pdf.line(X(0), labelY, X(treeLayout.totalWidth), labelY);
  });
  pdf.setLineDashPattern([], 0);

  // Etiquetas de carril (con "hueco" de fondo sobre la línea, como en pantalla)
  // Sin piso de tamaño (ver comentario en drawOrganigramaCardPdf): el
  // "hueco" de fondo se calcula con el mismo tamaño de fuente realmente
  // aplicado, así que deben escalar juntos o el texto no cabría en el hueco.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(T(9));
  lanesToRender.forEach(({ lane }) => {
    const labelY = Y(laneTopY.map.get(lane.key) - LABEL_ROW_HEIGHT / 2);
    const label = lane.label.toUpperCase();
    const labelW = pdf.getTextWidth(label);
    const cx = X(treeLayout.totalWidth / 2);
    pdf.setFillColor(248, 250, 252);
    pdf.rect(cx - labelW / 2 - T(6), labelY - T(7), labelW + T(12), T(14), "F");
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text(label, cx, labelY, { align: "center", baseline: "middle" });
  });

  // Conectores
  pdf.setDrawColor(148, 163, 184); // slate-400
  pdf.setLineWidth(Math.max(T(2), 0.5));
  connectors.forEach(({ segments }) => {
    segments.forEach(([x1, y1, x2, y2]) => pdf.line(X(x1), Y(y1), X(x2), Y(y2)));
  });

  // Tarjetas
  lanesToRender.forEach(({ lane, entries }) => {
    const top = laneTopY.map.get(lane.key);
    entries.forEach(({ node }) => {
      const cx = treeLayout.centerX.get(node.departamento) ?? 0;
      drawOrganigramaCardPdf(pdf, node, cx - CARD_WIDTH / 2, top, X, Y, T, lane);
    });
  });

  return pdf;
}

// ─── Carga del árbol jerárquico desde el backend (ORGANIGRAMA_ANAM) ──────────
async function loadOrganigrama(unidadNegocioId, vista = "institucional") {
  const resp = await PlantillaService.getOrganigramaTree(unidadNegocioId, vista);
  if (!resp.ok) throw new Error(`No se pudo cargar el organigrama de la unidad ${unidadNegocioId}`);
  return resp.json();
}

// ─── Selector dropdown component ─────────────────────────────────────────────
function UnidadSelector({ unidades, selected, onSelect, loading }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => unidades.filter(u =>
      u.label.toLowerCase().includes(filter.toLowerCase()) ||
      u.id.includes(filter)
    ),
    [filter, unidades]
  );

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-rose-700 dark:hover:border-rose-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <Building className="w-3.5 h-3.5 shrink-0 text-rose-800" />
          <span className="truncate">{loading ? "Cargando unidades..." : selected ? selected.label : "Selecciona unidad..."}</span>
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Filtrar..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-700"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
            {filtered.length === 0 && (
              <p className="p-3 text-center text-xs text-slate-400">Sin resultados</p>
            )}
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); setOpen(false); setFilter(""); }}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${selected?.id === u.id ? "bg-rose-50 dark:bg-rose-950/40" : ""}`}
              >
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${selected?.id === u.id ? "bg-rose-800" : "bg-slate-300 dark:bg-slate-700"}`} />
                <div>
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{u.label}</p>
                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">Unidad {u.id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formato moneda para SMB ──────────────────────────────────────────────────
function formatSMB(smb) {
  if (smb === null || smb === undefined || smb === "") return "N/A";
  const num = Number(smb);
  if (Number.isNaN(num)) return smb;
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function OrganigramaContent() {
  const [unidades, setUnidades] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState(true);
  const [selectedUnidad, setSelectedUnidad] = useState(null);
  const [organigramaData, setOrganigramaData] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [loadError, setLoadError] = useState(null);
  // "institucional" (manual/curada, editable) | "sig" (mismo algoritmo que
  // institucional, filtrado a filas isSIGInfo=1, solo lectura — reemplaza a
  // la antigua "alineacion": el backend sigue soportando vista=alineacion
  // por si se retoma, pero ya no tiene botón propio en la UI).
  const [vistaModo, setVistaModo] = useState("institucional");
  const { isLoading: authLoading, hasPermission } = useAuth();
  const canEditOrganigrama = hasPermission(PERMISSIONS.EDIT_ORGANIGRAMA);
  const canViewInstitucional = hasPermission(PERMISSIONS.VIEW_ORGANIGRAMA_INSTITUCIONAL);
  const canViewSig = hasPermission(PERMISSIONS.VIEW_ORGANIGRAMA_SIG);
  // Solo Institucional es editable; SIG es siempre solo lectura.
  const soloLectura = vistaModo !== "institucional" || !canEditOrganigrama;
  const TOOLTIP_SOLO_LECTURA = vistaModo === "sig"
    ? "No editable en Vista SIG — esta vista es de solo lectura."
    : "No tienes permiso para editar el Organigrama.";

  // ── Si el usuario no tiene permiso para la vista activa fuerza la única
  // vista a la que sí tiene acceso, en cuanto los permisos terminan de
  // cargar — mismo patrón que activeTab en plantilla_empleados.
  useEffect(() => {
    if (authLoading) return;
    const permitido = {
      institucional: canViewInstitucional,
      sig: canViewSig,
    };
    if (!permitido[vistaModo]) {
      const fallback = ["institucional", "sig"].find((v) => permitido[v]);
      if (fallback) setVistaModo(fallback);
    }
  }, [authLoading, vistaModo, canViewInstitucional, canViewSig]);

  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalCatalog, setGlobalCatalog] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  // ── Filtro "Departamentos vacantes": destaca todas las plazas titulares
  // vacantes del árbol actual y permite recorrerlas una por una con < >.
  const [vacantesFiltroActivo, setVacantesFiltroActivo] = useState(false);
  const [vacanteFocusIndex, setVacanteFocusIndex] = useState(0);
  // ── Reordenar hermanos por drag-and-drop (mismo padre, ver handleReorderDrop) ─
  const [draggingCode, setDraggingCode] = useState(null);
  const [dragOverCode, setDragOverCode] = useState(null);
  // Previsualización en vivo: { parentCode, order: [departamento,...] } | null.
  // Se calcula en onDragOver y se consume en visibleNodes (sin mutar
  // organigramaData) para reflejar el reacomodo antes de soltar.
  const [previewOrder, setPreviewOrder] = useState(null);
  const dragOverKeyRef = useRef(null); // evita recalcular en cada mousemove
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pendingScrollNode, setPendingScrollNode] = useState(null);
  // Fuerza el re-render del árbol tras mutar un nodo en sitio, sin tocar la
  // referencia de organigramaData (eso reinicia expandedNodes/selectedNode).
  const [renderTick, bumpRender] = useState(0);

  const [posInfo, setPosInfo] = useState({ titular: null, superior: null });
  const [posLoading, setPosLoading] = useState({ titular: false, superior: false });

  // ── Edición de plaza titular/superior desde el modal de detalle ───────────
  const [editingField, setEditingField] = useState(null); // null | "titular" | "superior"
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [empSearchResults, setEmpSearchResults] = useState([]);
  const [empSearching, setEmpSearching] = useState(false);
  const [savingField, setSavingField] = useState(null); // null | "titular" | "superior"
  const [changeToast, setChangeToast] = useState(null); // { message, onUndo }
  const toastTimerRef = useRef(null);
  // Asignación manual de plaza por número (permite dejarla vacante, sin persona)
  const [manualPlazaMode, setManualPlazaMode] = useState(false);
  const [manualPlazaInput, setManualPlazaInput] = useState("");
  const [manualPlazaChecking, setManualPlazaChecking] = useState(false);
  const [manualPlazaError, setManualPlazaError] = useState(null);
  const resetManualPlaza = () => {
    setManualPlazaMode(false);
    setManualPlazaInput("");
    setManualPlazaError(null);
  };

  // ── Creación de nodos (Dirección General nueva / subordinado bajo un nodo) ─
  const emptyGeneralForm = { unidad_negocio: "", departamento: "", descripcion_larga: "", unidad_administrativa: "", doaf: "", num_posicion_gerente: "" };
  const emptyChildForm = { tipo: "", descripcion_larga: "", unidad_administrativa: "", doaf: "", num_posicion_gerente: "" };
  const [showCreateGeneral, setShowCreateGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState(emptyGeneralForm);
  const [creatingGeneral, setCreatingGeneral] = useState(false);
  const [createGeneralError, setCreateGeneralError] = useState(null);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [childForm, setChildForm] = useState(emptyChildForm);
  const [creatingChild, setCreatingChild] = useState(false);
  const [createChildError, setCreateChildError] = useState(null);
  // Búsqueda de empleado/plaza para la plaza titular del nuevo subordinado
  const [childPosQuery, setChildPosQuery] = useState("");
  const [childPosResults, setChildPosResults] = useState([]);
  const [childPosSearching, setChildPosSearching] = useState(false);
  const [childPosSelectedEmp, setChildPosSelectedEmp] = useState(null);
  // Ancla + rect para dibujar la lista de sugerencias como `fixed`, así el
  // overflow-y-auto del modal (que la recortaba en su borde inferior cuando
  // la lista era larga) deja de afectarla.
  const childPosAnchorRef = useRef(null);
  const [childPosMenuRect, setChildPosMenuRect] = useState(null);
  // Asignación manual de plaza por número para el subordinado (permite vacante)
  const [childPosManualMode, setChildPosManualMode] = useState(false);
  const [childPosManualInput, setChildPosManualInput] = useState("");
  const [childPosManualChecking, setChildPosManualChecking] = useState(false);
  const [childPosManualError, setChildPosManualError] = useState(null);
  const resetChildForm = () => {
    setChildForm(emptyChildForm);
    setChildPosQuery("");
    setChildPosResults([]);
    setChildPosSelectedEmp(null);
    setChildPosManualMode(false);
    setChildPosManualInput("");
    setChildPosManualError(null);
  };

  // ── Edición / borrado del nodo seleccionado ────────────────────────────────
  // Nota: departamento (PK), nivel_direccion y unidad_negocio no son editables
  // aquí — el backend los bloquea porque codifican el determinante del árbol
  // (ver OrganigramaAnamViewSet.LOCKED_UPDATE_FIELDS en plantilla/views.py).
  const emptyEditForm = { descripcion_larga: "", unidad_administrativa: "", doaf: "" };
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingNode, setDeletingNode] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // ── Load unidades de negocio (lienzos) desde el backend ────────────────────
  const reloadUnidades = async () => {
    const resp = await PlantillaService.getOrganigramaUnidades();
    if (!resp.ok) throw new Error("No se pudo actualizar la lista de unidades de negocio.");
    const data = await resp.json();
    setUnidades(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    setUnidadesLoading(true);
    PlantillaService.getOrganigramaUnidades()
      .then(async (resp) => {
        if (!resp.ok) throw new Error("No se pudieron cargar las unidades de negocio");
        const data = await resp.json();
        if (cancelled) return;
        setUnidades(data);
        setSelectedUnidad(prev => prev || data.find(u => u.id === "00900") || data[0] || null);
      })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setUnidadesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Load organigrama when unidad or vista cambian ───────────────────────────
  // Guard de cancelación: si el usuario cambia de vista/unidad varias veces
  // rápido, una respuesta lenta de un fetch VIEJO no debe pisar los datos de
  // la vista ACTUAL — sin esto, cambiar Institucional→SIG→Institucional
  // rápido podría dejar en pantalla datos de SIG mientras el toggle ya
  // marca Institucional (mismo patrón ya usado en este archivo para
  // unidades/búsqueda de empleado, ver useEffect de arriba).
  useEffect(() => {
    if (!selectedUnidad) return;
    let cancelled = false;
    setLoadingOrg(true);
    setLoadError(null);
    setOrganigramaData(null);
    setSearchQuery("");
    setSelectedNode(null);
    setExpandedNodes({});
    setVacantesFiltroActivo(false);
    setHighlightedNodeId(null);
    loadOrganigrama(selectedUnidad.id, vistaModo)
      .then(data => {
        if (cancelled) return;
        setOrganigramaData(data);
      })
      .catch(err => { if (!cancelled) setLoadError(err.message); })
      .finally(() => { if (!cancelled) setLoadingOrg(false); });
    return () => { cancelled = true; };
  }, [selectedUnidad, vistaModo]);

  // ── Initialize expanded state when data loads ─────────────────────────────
  useEffect(() => {
    if (!organigramaData) return;
    const initialExpanded = { [organigramaData.departamento]: true };
    if (organigramaData.subordinados) {
      organigramaData.subordinados.forEach(child => {
        initialExpanded[child.departamento] = true;
      });
    }
    setExpandedNodes(initialExpanded);
    setSelectedNode(null);
  }, [organigramaData]);

  // ── Centra el canvas sobre la raíz al cargar el lienzo. Sin esto el árbol
  // arranca con scroll en (0,0) y, con árboles grandes, la tarjeta raíz queda
  // fuera del viewport (canvas se ve en blanco aunque sí haya datos). Se salta
  // cuando hay un pendingScrollNode activo (búsqueda cross-unidad, ver effect
  // de abajo) para no pelearse por el scroll con ese otro nodo destino.
  useEffect(() => {
    if (!organigramaData || pendingScrollNodeRef.current) return;
    const rootId = `node-${organigramaData.departamento}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(rootId)?.scrollIntoView({ block: "start", inline: "center" });
      });
    });
  }, [organigramaData]);

  // ── Resuelve un pendingScrollNode (búsqueda cross-unidad) tras el cambio de
  // lienzo. Separado del effect de arriba: si dependiera de pendingScrollNode
  // en el mismo effect, la propia limpieza (setPendingScrollNode(null)) volvía
  // a disparar el effect y el setSelectedNode(null) inicial borraba el
  // highlight/modal recién aplicado.
  useEffect(() => {
    if (!pendingScrollNode || !organigramaData) return;
    const target = pendingScrollNode;
    const timer = setTimeout(() => {
      const { parentsMap, allNodes } = flatListRef.current || {};
      if (parentsMap && allNodes && allNodes[target]) {
        const toExpand = {};
        let cur = target;
        while (parentsMap[cur]) {
          toExpand[parentsMap[cur]] = true;
          cur = parentsMap[cur];
        }
        setExpandedNodes(prev => ({ ...prev, ...toExpand }));
        setHighlightedNodeId(target);
        setSelectedNode(allNodes[target]);
        setTimeout(() => {
          document.getElementById(`node-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
      setPendingScrollNode(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [pendingScrollNode, organigramaData]);

  // ── Zoom via Ctrl+Wheel ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const step = 0.05;
      setZoom(prev => {
        const next = e.deltaY < 0 ? Math.min(prev + step, 2) : Math.max(prev - step, 0.3);
        return next;
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Drag-to-scroll ────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".cursor-pointer")) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    containerRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5;
    containerRef.current.scrollTop  = scrollTop  - (y - startY) * 1.5;
  };
  const handleMouseUp = () => setIsDragging(false);

  // ── Tree index ────────────────────────────────────────────────────────────
  const { allNodes, parentsMap, flatList } = useMemo(() => {
    const nodes = {}, parents = {}, flat = [];
    if (!organigramaData) return { allNodes: nodes, parentsMap: parents, flatList: flat };
    const traverse = (node, parentId = null) => {
      nodes[node.departamento] = node;
      flat.push({
        departamento: node.departamento,
        descripcion_larga: node.descripcion_larga,
        nivel_direccion: node.nivel_direccion,
        num_posicion_gerente: node.num_posicion_gerente,
        posicion_director: node.posicion_director,
        ocupante: node.ocupante,
      });
      if (parentId) parents[node.departamento] = parentId;
      (node.subordinados || []).forEach(child => traverse(child, node.departamento));
    };
    traverse(organigramaData);
    return { allNodes: nodes, parentsMap: parents, flatList: flat };
    // renderTick fuerza recalcular tras insertar un nodo en sitio (handleCreateChild),
    // ya que organigramaData mantiene su referencia para no reiniciar la vista.
  }, [organigramaData, renderTick]);

  // ── Departamentos con plaza titular vacante (activa pero sin ocupante) en
  // el árbol actualmente cargado, en orden DFS — base del filtro "Vacantes".
  const vacantesList = useMemo(
    () => flatList.filter(n => n.ocupante && n.ocupante.activa && n.ocupante.vacante),
    [flatList]
  );
  const vacantesSet = useMemo(() => new Set(vacantesList.map(v => v.departamento)), [vacantesList]);

  // ── Nodos visibles según expandedNodes (colapsar oculta toda la rama) ──────
  // Separado del memo estructural de arriba porque depende de expandedNodes,
  // que cambia en cada expand/collapse — no queremos recalcular allNodes/
  // parentsMap/flatList (recorrido completo) en cada toggle.
  const visibleNodes = useMemo(
    () => computeVisibleNodes(organigramaData, expandedNodes, previewOrder),
    // renderTick: fuerza recalcular tras mutar organigramaData en sitio
    // (handleDeleteNode/handleReorderDrop/handleCreateChild) sin cambiar la
    // referencia del objeto — igual que allNodes/parentsMap/flatList arriba.
    [organigramaData, expandedNodes, previewOrder, renderTick]
  );

  // ── Agrupado por carril, en el orden fijo de LANE_CONFIG, cada uno ordenado
  // por el índice DFS (mantiene agrupados a los hijos de un mismo padre) ────
  const lanesToRender = useMemo(() => computeLanesToRender(visibleNodes), [visibleNodes]);

  // ── Posicionamiento tipo árbol: cada padre centrado sobre sus hijos ────────
  // (algoritmo clásico simplificado — hojas en posiciones secuenciales,
  // internos = centro del rango de sus hijos), independiente del carril en
  // el que caiga cada nodo, para que el padre siempre quede alineado con el
  // centro horizontal de su propia descendencia visible.
  const treeLayout = useMemo(() => computeTreeLayout(visibleNodes, organigramaData), [visibleNodes, organigramaData]);

  // ── Posición vertical (Y) de cada carril, calculada de forma analítica ─────
  // (misma técnica que treeLayout: coordenadas fijas en JS, NO medidas del
  // DOM). Evita el bug de doble escalado que produce medir con
  // getBoundingClientRect dentro de un contenedor con CSS `zoom`: el propio
  // SVG de conectores vive dentro de ese contenedor, así que si sus
  // coordenadas vinieran de una medición ya afectada por el zoom, el
  // navegador las volvería a escalar una segunda vez al pintarlas.
  const laneTopY = useMemo(() => computeLaneTopY(lanesToRender), [lanesToRender]);

  // Un conector por PADRE (no por arista): un solo tronco baja del padre, un
  // bus horizontal une el rango de sus hijos, y una vertical por hijo baja
  // desde el bus hasta su tarjeta — igual que un organigrama clásico, en vez
  // de una línea independiente por cada par padre-hijo.
  const connectors = useMemo(() => computeConnectors(treeLayout, laneTopY, allNodes), [treeLayout, laneTopY, allNodes]);

  // ── Preload Global Catalog ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await PlantillaService.getOrganigramaSearch();
        if (res.ok) {
          const data = await res.json();
          setGlobalCatalog(data);
        }
      } catch (err) {
        console.error("Error preloading global catalog:", err);
      }
    };
    fetchCatalog();
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();

    // Fast in-memory search over the global catalog, acotado a la vista
    // activa — debe sugerir solo nodos que existan en el árbol que se ve,
    // si no, al hacer clic el nodo no aparecería (espejo exacto de los
    // filtros de organigrama_tree.build_tree):
    //   - SIG: solo isSIGInfo=1.
    //   - Institucional: sin filtro extra (incluye todo, igual que el árbol).
    const results = globalCatalog
      .filter(n => {
        if (vistaModo === "sig") return n.isSIGInfo;
        return true;
      })
      .filter(n =>
        n.departamento.toLowerCase().includes(q) ||
        (n.descripcion_larga && n.descripcion_larga.toLowerCase().includes(q))
      ).slice(0, 8);

    setSearchResults(results);
    setSelectedIndex(-1); // Reset selected index on new search
  }, [searchQuery, globalCatalog, vistaModo]);

  const flatListRef = useRef({ allNodes: {}, parentsMap: {}, flatList: [] });
  flatListRef.current = { allNodes, parentsMap, flatList };

  const pendingScrollNodeRef = useRef(pendingScrollNode);
  pendingScrollNodeRef.current = pendingScrollNode;

  // ── Consulta ocupante de plaza (titular / superior) al seleccionar nodo ────
  useEffect(() => {
    if (!selectedNode) {
      setPosInfo({ titular: null, superior: null });
      return;
    }

    const fetchPosInfo = async (key, posicion) => {
      if (!posicion || posicion === "(en blanco)") {
        setPosInfo(prev => ({ ...prev, [key]: null }));
        return;
      }
      setPosLoading(prev => ({ ...prev, [key]: true }));
      try {
        const res = await PlantillaService.getOrganigramaPosicionInfo(posicion);
        const data = res.ok ? await res.json() : { error: true };
        setPosInfo(prev => ({ ...prev, [key]: data }));
      } catch {
        setPosInfo(prev => ({ ...prev, [key]: { error: true } }));
      } finally {
        setPosLoading(prev => ({ ...prev, [key]: false }));
      }
    };

    fetchPosInfo("titular", selectedNode.num_posicion_gerente);
    fetchPosInfo("superior", selectedNode.posicion_director);
  }, [selectedNode?.departamento]);

  // ── Reset del editor de plaza al cambiar/cerrar el nodo seleccionado ──────
  useEffect(() => {
    setEditingField(null);
    setEmpSearchQuery("");
    setEmpSearchResults([]);
    resetManualPlaza();
    setIsEditingNode(false);
    setEditError(null);
  }, [selectedNode?.departamento]);

  // ── Búsqueda de empleados (EMPLEADOS_COMPLETOS_SIG) al editar una plaza ───
  useEffect(() => {
    if (!editingField || empSearchQuery.trim().length < 3) {
      setEmpSearchResults([]);
      setEmpSearching(false);
      return;
    }
    let cancelled = false;
    setEmpSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await PlantillaService.searchEmpleados(empSearchQuery.trim());
        const data = res.ok ? await res.json() : { results: [] };
        if (!cancelled) setEmpSearchResults(data.results || []);
      } catch {
        if (!cancelled) setEmpSearchResults([]);
      } finally {
        if (!cancelled) setEmpSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [empSearchQuery, editingField]);

  // ── Búsqueda de empleados (EMPLEADOS_COMPLETOS_SIG) para la plaza titular
  // del formulario de "Agregar subordinado" ─────────────────────────────────
  useEffect(() => {
    if (!showCreateChild || childPosQuery.trim().length < 3) {
      setChildPosResults([]);
      setChildPosSearching(false);
      return;
    }
    let cancelled = false;
    setChildPosSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await PlantillaService.searchEmpleados(childPosQuery.trim());
        const data = res.ok ? await res.json() : { results: [] };
        if (!cancelled) setChildPosResults(data.results || []);
      } catch {
        if (!cancelled) setChildPosResults([]);
      } finally {
        if (!cancelled) setChildPosSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [childPosQuery, showCreateChild]);

  // ── Posiciona la lista de sugerencias de plaza titular como `fixed`,
  // recalculando en scroll/resize mientras esté abierta, para que no la
  // recorte el overflow-y-auto del modal de "Agregar subordinado".
  useEffect(() => {
    if (childPosResults.length === 0) {
      setChildPosMenuRect(null);
      return;
    }
    const update = () => {
      const el = childPosAnchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 12;
      setChildPosMenuRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxHeight: Math.max(120, Math.min(280, spaceBelow)),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [childPosResults]);

  // ── Aplica un cambio de plaza (titular/superior) y ofrece revertir ───────
  // newOcupanteInfo === null ⇒ se está quitando la asignación (deja la plaza en blanco).
  const applyPlazaChange = async (fieldKey, field, node, newPosicion, newOcupanteInfo) => {
    if (soloLectura) return;
    const departamento = node.departamento;
    const previousPosicion = node[fieldKey];
    const previousOcupante = node.ocupante;
    const previousPosInfoEntry = posInfo[field];
    const isRemoval = newOcupanteInfo === null;

    setSavingField(field);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, {
        [fieldKey]: newPosicion,
      });
      if (!res.ok) throw new Error(isRemoval ? "No se pudo quitar la plaza." : "No se pudo actualizar la plaza.");

      // ── Actualiza la UI directamente, sin refetch ──────────────────────
      const isVacante = !isRemoval && !!newOcupanteInfo.vacante;
      node[fieldKey] = newPosicion;
      if (field === "titular") {
        node.ocupante = isRemoval ? null : {
          activa: true,
          vacante: isVacante,
          nombre: newOcupanteInfo.nombre,
          nivel: newOcupanteInfo.nivel,
          smb: newOcupanteInfo.smb,
        };
      }
      setPosInfo(prev => ({
        ...prev,
        [field]: isRemoval ? null : {
          posicion: newPosicion,
          activa: true,
          vacante: isVacante,
          nombre: newOcupanteInfo.nombre,
          num_empleado: newOcupanteInfo.num_empleado,
          estado_nomina: isVacante ? undefined : "A",
        },
      }));
      setSelectedNode(prev => (prev && prev.departamento === departamento ? { ...node } : prev));
      bumpRender(t => t + 1);
      setEditingField(null);
      setEmpSearchQuery("");
      setEmpSearchResults([]);
      resetManualPlaza();

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setChangeToast({
        message: isRemoval
          ? `Se ha quitado la plaza (${field === "titular" ? "gerente" : "superior"})`
          : isVacante
          ? `Se ha asignado la plaza ${newPosicion} (vacante)`
          : `Se ha actualizado la plaza (${field === "titular" ? "gerente" : "superior"})`,
        onUndo: () => revertPlazaChange(fieldKey, field, node, previousPosicion, previousOcupante, previousPosInfoEntry, departamento),
      });
      toastTimerRef.current = setTimeout(() => setChangeToast(null), 10000);
    } catch (err) {
      alert(err.message || "Error al actualizar la plaza.");
    } finally {
      setSavingField(null);
    }
  };

  // ── Asigna una plaza por número sin exigir un ocupante (permite vacante) ──
  // Valida contra organigrama-posicion-info/ que la plaza exista y esté activa
  // (esté o no ocupada) antes de guardarla como titular.
  const applyManualPlaza = async (fieldKey, field, node, posicionRaw) => {
    const posicion = posicionRaw.trim();
    if (!posicion) return;
    setManualPlazaChecking(true);
    setManualPlazaError(null);
    try {
      const res = await PlantillaService.getOrganigramaPosicionInfo(posicion);
      const data = res.ok ? await res.json() : null;
      if (!data || data.error || !data.activa) {
        setManualPlazaError(`La plaza ${posicion} no existe o no está activa.`);
        return;
      }
      await applyPlazaChange(fieldKey, field, node, posicion, {
        vacante: !!data.vacante,
        nombre: data.nombre,
        num_empleado: data.num_empleado,
      });
    } catch {
      setManualPlazaError("Error al validar la plaza.");
    } finally {
      setManualPlazaChecking(false);
    }
  };

  // ── Revierte un cambio de plaza previamente confirmado ───────────────────
  const revertPlazaChange = async (fieldKey, field, node, previousPosicion, previousOcupante, previousPosInfoEntry, departamento) => {
    setSavingField(field);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, {
        [fieldKey]: previousPosicion ?? "",
      });
      if (!res.ok) throw new Error("No se pudo revertir la plaza.");

      node[fieldKey] = previousPosicion;
      if (field === "titular") node.ocupante = previousOcupante;
      setPosInfo(prev => ({ ...prev, [field]: previousPosInfoEntry }));
      setSelectedNode(prev => (prev && prev.departamento === departamento ? { ...node } : prev));
      bumpRender(t => t + 1);
      setChangeToast(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    } catch (err) {
      alert(err.message || "Error al revertir la plaza.");
    } finally {
      setSavingField(null);
    }
  };

  // ── Crea una nueva Dirección General (raíz, abre lienzo nuevo) ────────────
  const handleCreateGeneral = async () => {
    if (soloLectura) return;
    const unidad_negocio = generalForm.unidad_negocio.trim();
    const departamento = generalForm.departamento.trim();
    const descripcion_larga = generalForm.descripcion_larga.trim();
    if (!unidad_negocio || !departamento || !descripcion_larga) {
      setCreateGeneralError("unidad_negocio, departamento y descripción son obligatorios.");
      return;
    }
    setCreateGeneralError(null);
    setCreatingGeneral(true);
    try {
      const res = await PlantillaService.crearOrganigramaNodo({
        tipo: "General",
        unidad_negocio,
        departamento,
        descripcion_larga,
        unidad_administrativa: generalForm.unidad_administrativa.trim(),
        doaf: generalForm.doaf.trim(),
        num_posicion_gerente: generalForm.num_posicion_gerente.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo crear la Dirección General.");

      const data = await reloadUnidades();
      const nueva = data.find(u => u.id === unidad_negocio) || { id: unidad_negocio, label: descripcion_larga };
      setSelectedUnidad(nueva);
      setGlobalCatalog(prev => [...prev, {
        departamento,
        descripcion_larga,
        unidad_negocio,
        nivel_direccion: "General",
      }]);
      setZoom(1);
      setShowCreateGeneral(false);
      setGeneralForm(emptyGeneralForm);
    } catch (err) {
      setCreateGeneralError(err.message || "Error al crear la Dirección General.");
    } finally {
      setCreatingGeneral(false);
    }
  };

  // ── Reordena hermanos dentro del MISMO padre por drag-and-drop (fase 1: ─
  // no re-parenta, solo cambia el orden visual entre hermanos — por eso no
  // hay riesgo de romper la jerarquía). Confirma exactamente lo que ya se
  // venía previsualizando en vivo (onDragOver → previewOrder), muta
  // `parent.subordinados` en sitio (mismo patrón que
  // handleCreateChild/handleDeleteNode) y persiste vía el PATCH genérico,
  // que el backend valida como pura permutación (ver
  // OrganigramaAnamViewSet.perform_update).
  const handleReorderDrop = async (draggedCode, targetCode, clientX, targetEl) => {
    const preview = previewOrder;
    setDraggingCode(null);
    setDragOverCode(null);
    setPreviewOrder(null);
    dragOverKeyRef.current = null;
    if (soloLectura || !draggedCode || draggedCode === targetCode) return;

    const parentCode = parentsMap[draggedCode];
    if (!parentCode || parentsMap[targetCode] !== parentCode) return; // solo hermanos del mismo padre
    const parent = allNodes[parentCode];
    if (!parent) return;

    let orderedCodes = preview && preview.parentCode === parentCode ? preview.order : null;
    if (!orderedCodes) {
      // Sin previsualización válida (ej. drop sin haber pasado por
      // dragover) — recalcula con la misma lógica pura.
      const rect = targetEl.getBoundingClientRect();
      const insertAfter = clientX > rect.left + rect.width / 2;
      const reordered = reorderSiblings(parent.subordinados, draggedCode, targetCode, insertAfter);
      if (!reordered) return;
      orderedCodes = reordered.map(c => c.departamento);
    }

    const byCode = new Map(parent.subordinados.map(c => [c.departamento, c]));
    const newSubordinados = orderedCodes.map(code => byCode.get(code)).filter(Boolean);

    const prevOrder = parent.subordinados;
    parent.subordinados = newSubordinados;
    bumpRender(t => t + 1);

    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(parentCode, {
        subordinados: newSubordinados.map(c => c.departamento).join(","),
      });
      if (!res.ok) {
        parent.subordinados = prevOrder;
        bumpRender(t => t + 1);
      }
    } catch {
      parent.subordinados = prevOrder;
      bumpRender(t => t + 1);
    }
  };

  // ── Crea un subordinado bajo selectedNode, aplicando la regla del determinante en el backend ─
  const handleCreateChild = async () => {
    if (soloLectura || !selectedNode) return;
    const tipo = childForm.tipo;
    const descripcion_larga = childForm.descripcion_larga.trim();
    if (!tipo || !descripcion_larga) {
      setCreateChildError("Tipo y descripción son obligatorios.");
      return;
    }
    setCreateChildError(null);
    setCreatingChild(true);
    try {
      const res = await PlantillaService.crearOrganigramaNodo({
        tipo,
        parent_departamento: selectedNode.departamento,
        descripcion_larga,
        unidad_administrativa: childForm.unidad_administrativa.trim(),
        doaf: childForm.doaf.trim(),
        num_posicion_gerente: childForm.num_posicion_gerente.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo crear el subordinado.");

      // ── Inserta el nodo en sitio, sin refetch ni tocar la referencia de
      // organigramaData (eso reiniciaría expandedNodes/selectedNode/scroll).
      // El backend de creación no calcula `ocupante` (eso lo hace el árbol
      // completo en organigrama-tree/), así que si se asignó plaza titular
      // se arma aquí a partir del empleado (o de la validación de la plaza
      // vacante) elegido en el formulario — si no, la tarjeta muestra
      // "Plaza inactiva" hasta recargar la página.
      const ocupanteSeleccionado =
        childPosSelectedEmp && childPosSelectedEmp.posicion === body.num_posicion_gerente
          ? childPosSelectedEmp.vacante
            ? { activa: true, vacante: true }
            : { activa: true, vacante: false, nombre: childPosSelectedEmp.nombre, nivel: childPosSelectedEmp.nivel, smb: childPosSelectedEmp.smb }
          : null;
      const newNode = {
        departamento: body.departamento,
        descripcion_larga: body.descripcion_larga,
        nivel_direccion: body.nivel_direccion,
        num_posicion_gerente: body.num_posicion_gerente,
        posicion_director: body.posicion_director,
        unidad_administrativa: body.unidad_administrativa,
        doaf: body.doaf,
        subordinados: [],
        ocupante: ocupanteSeleccionado,
      };
      const parent = allNodes[selectedNode.departamento];
      if (parent) {
        parent.subordinados = [...(parent.subordinados || []), newNode];
      }
      setGlobalCatalog(prev => [...prev, {
        departamento: newNode.departamento,
        descripcion_larga: newNode.descripcion_larga,
        unidad_negocio: selectedUnidad.id,
        nivel_direccion: newNode.nivel_direccion,
      }]);

      setShowCreateChild(false);
      resetChildForm();
      setCreateChildError(null);
      setExpandedNodes(prev => ({ ...prev, [selectedNode.departamento]: true }));
      setHighlightedNodeId(newNode.departamento);
      setSelectedNode(newNode);
      bumpRender(t => t + 1);
      setTimeout(() => {
        document.getElementById(`node-${newNode.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch (err) {
      setCreateChildError(err.message || "Error al crear el subordinado.");
    } finally {
      setCreatingChild(false);
    }
  };

  // ── Asigna la plaza titular del subordinado por número, sin exigir un
  // ocupante (permite dejarla vacante). Valida contra organigrama-posicion-info/.
  const checkChildManualPlaza = async (posicionRaw) => {
    const posicion = posicionRaw.trim();
    if (!posicion) return;
    setChildPosManualChecking(true);
    setChildPosManualError(null);
    try {
      const res = await PlantillaService.getOrganigramaPosicionInfo(posicion);
      const data = res.ok ? await res.json() : null;
      if (!data || data.error || !data.activa) {
        setChildPosManualError(`La plaza ${posicion} no existe o no está activa.`);
        return;
      }
      setChildForm(f => ({ ...f, num_posicion_gerente: posicion }));
      setChildPosSelectedEmp(
        data.vacante
          ? { posicion, vacante: true }
          : { posicion, vacante: false, nombre: data.nombre, num_empleado: data.num_empleado }
      );
      setChildPosQuery("");
      setChildPosResults([]);
      setChildPosManualMode(false);
      setChildPosManualInput("");
    } catch {
      setChildPosManualError("Error al validar la plaza.");
    } finally {
      setChildPosManualChecking(false);
    }
  };

  // ── Abre el editor con los valores actuales del nodo seleccionado ─────────
  const handleOpenEdit = () => {
    if (soloLectura || !selectedNode) return;
    setEditForm({
      descripcion_larga: selectedNode.descripcion_larga || "",
      unidad_administrativa: selectedNode.unidad_administrativa || "",
      doaf: selectedNode.doaf || "",
    });
    setEditError(null);
    setIsEditingNode(true);
  };

  const handleCancelEdit = () => {
    setIsEditingNode(false);
    setEditError(null);
  };

  // ── Edita nombre/unidad administrativa/DOAF del nodo seleccionado (en sitio) ─
  const handleSaveEdit = async () => {
    if (soloLectura || !selectedNode) return;
    const descripcion_larga = editForm.descripcion_larga.trim();
    if (!descripcion_larga) {
      setEditError("La descripción es obligatoria.");
      return;
    }
    const departamento = selectedNode.departamento;
    const payload = {
      descripcion_larga,
      unidad_administrativa: editForm.unidad_administrativa.trim(),
      doaf: editForm.doaf.trim(),
    };
    setEditError(null);
    setSavingEdit(true);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo actualizar el departamento.");

      const node = allNodes[departamento];
      if (node) {
        node.descripcion_larga = payload.descripcion_larga;
        node.unidad_administrativa = payload.unidad_administrativa;
        node.doaf = payload.doaf;
      }
      setGlobalCatalog(prev => prev.map(n => n.departamento === departamento ? { ...n, descripcion_larga } : n));
      setSelectedNode(prev => (prev && node ? { ...node } : prev));
      bumpRender(t => t + 1);
      setIsEditingNode(false);
    } catch (err) {
      setEditError(err.message || "Error al actualizar el departamento.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Elimina el nodo seleccionado (bloqueado en backend si tiene subordinados) ─
  const handleDeleteNode = async () => {
    if (soloLectura || !selectedNode) return;
    const departamento = selectedNode.departamento;
    setDeleteError(null);
    setDeletingNode(true);
    try {
      const res = await CatalogoEstructuraService.deleteOrganigramaAnam(departamento);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "No se pudo eliminar el departamento.");
      }

      setGlobalCatalog(prev => prev.filter(n => n.departamento !== departamento));
      const parentId = parentsMap[departamento];

      if (!parentId) {
        // Nodo raíz del lienzo: no queda árbol que actualizar en sitio, se
        // recarga el catálogo de unidades y se cambia a otro lienzo.
        setShowDeleteConfirm(false);
        setSelectedNode(null);
        setOrganigramaData(null);
        await reloadUnidades();
        setSelectedUnidad(null);
      } else {
        const parent = allNodes[parentId];
        if (parent) {
          parent.subordinados = (parent.subordinados || []).filter(c => c.departamento !== departamento);
        }
        setShowDeleteConfirm(false);
        setSelectedNode(null);
        setHighlightedNodeId(null);
        bumpRender(t => t + 1);
      }
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar el departamento.");
    } finally {
      setDeletingNode(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const levels = {};
    flatList.forEach(n => { const l = n.nivel_direccion || "Depto."; levels[l] = (levels[l] || 0) + 1; });
    return { total: flatList.length, levels };
  }, [flatList]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleNode = (id) => setExpandedNodes(p => ({ ...p, [id]: !p[id] }));
  const expandAll  = () => { const a = {}; Object.keys(allNodes).forEach(k => a[k] = true); setExpandedNodes(a); };
  const collapseAll = () => {
    if (!organigramaData) return;
    setExpandedNodes({ [organigramaData.departamento]: true });
  };
  const expandToNode = (result) => {
    const deptId = result.departamento;
    if (result.unidad_negocio && selectedUnidad?.id !== result.unidad_negocio) {
      const newUnidad = unidades.find(u => u.id === result.unidad_negocio);
      if (newUnidad) {
        setPendingScrollNode(deptId);
        setSelectedUnidad(newUnidad);
        setSearchQuery("");
        return;
      }
    }

    if (!allNodes[deptId]) return;
    let cur = deptId;
    const toExpand = {};
    while (parentsMap[cur]) { toExpand[parentsMap[cur]] = true; cur = parentsMap[cur]; }
    setExpandedNodes(prev => ({ ...prev, ...toExpand }));
    setHighlightedNodeId(deptId);
    setSelectedNode(allNodes[deptId]);
    setSearchQuery("");
    setTimeout(() => {
      document.getElementById(`node-${deptId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  // ── Filtro "Departamentos vacantes": expande hasta el N-ésimo vacante de
  // vacantesList, lo enfoca (mismo estilo ámbar que usa la búsqueda) y hace
  // scroll — sin abrir el modal de detalle, para no tapar el árbol mientras
  // se recorre con < >.
  const goToVacanteIndex = (idx) => {
    if (!vacantesList.length) return;
    const wrapped = ((idx % vacantesList.length) + vacantesList.length) % vacantesList.length;
    const target = vacantesList[wrapped];
    setVacanteFocusIndex(wrapped);
    if (!allNodes[target.departamento]) return;
    let cur = target.departamento;
    const toExpand = {};
    while (parentsMap[cur]) { toExpand[parentsMap[cur]] = true; cur = parentsMap[cur]; }
    setExpandedNodes(prev => ({ ...prev, ...toExpand }));
    setHighlightedNodeId(target.departamento);
    setTimeout(() => {
      document.getElementById(`node-${target.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const handleToggleVacantesFiltro = () => {
    if (vacantesFiltroActivo) {
      setVacantesFiltroActivo(false);
      setHighlightedNodeId(null);
      return;
    }
    if (vacantesList.length === 0) return;
    setVacantesFiltroActivo(true);
    goToVacanteIndex(0);
  };

  // ── Export a PDF (vectorial, reescrito 2026-07-17) ───────────────────────
  // No captura el DOM en absoluto: recalcula el layout analítico
  // (computeVisibleNodes/computeTreeLayout/computeLaneTopY/computeConnectors
  // — las mismas funciones puras que usan los useMemo de arriba) con el
  // `expandedNodes` que corresponda al alcance elegido, y lo dibuja directo
  // en el PDF con buildOrganigramaPdf. Al ser funciones puras (no hooks) se
  // puede pedir "todo desglosado" sin tocar el estado de React ni esperar un
  // re-render — evita el problema de closures obsoletos que tendría leer
  // `treeLayout`/`connectors` del componente justo después de un
  // `setExpandedNodes` (seguirían siendo los de antes del cambio hasta el
  // siguiente render).
  const handleExportPdf = (type) => {
    if (!organigramaData) return;
    setShowExportModal(false);
    setIsExporting(true);
    // Doble rAF: deja que el modal "Generando PDF..." pinte antes de que el
    // cómputo (síncrono — ya no hay await de por medio) bloquee el hilo
    // principal en árboles grandes.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const expandedForExport = type === "full"
          ? Object.fromEntries(Object.keys(allNodes).map(code => [code, true]))
          : expandedNodes;

        const vn = computeVisibleNodes(organigramaData, expandedForExport, null);
        const lanes = computeLanesToRender(vn);
        const layout = computeTreeLayout(vn, organigramaData);
        const laneY = computeLaneTopY(lanes);
        const conns = computeConnectors(layout, laneY, allNodes);

        const pdf = buildOrganigramaPdf({ lanesToRender: lanes, treeLayout: layout, laneTopY: laneY, connectors: conns, allNodes });
        const suffix = type === "full" ? "_completo" : "";
        pdf.save(`organigrama_${selectedUnidad?.id}${suffix}_${new Date().toISOString().slice(0,10)}.pdf`);
      } catch (err) {
        console.error("Error generando el PDF del organigrama:", err);
      } finally {
        setIsExporting(false);
      }
    }));
  };

  // ── NodeCard component (plano, sin recursión — la posición de carril la ─
  // decide lanesToRender, no el propio nodo) ─────────────────────────────────
  const NodeCard = ({ node }) => {
    const isExpanded   = !!expandedNodes[node.departamento];
    const hasChildren  = node.subordinados?.length > 0;
    const isSelected   = selectedNode?.departamento === node.departamento;
    const isHighlighted = highlightedNodeId === node.departamento;
    // Todos los vacantes se destacan mientras el filtro está activo; el
    // isHighlighted (ámbar más fuerte) marca cuál es el "actual" del recorrido.
    const isVacanteMarked = vacantesFiltroActivo && !isHighlighted && vacantesSet.has(node.departamento);
    const { Icon, badgeColor, iconBg } = getLaneForLevel(node.nivel_direccion);

    const isDragOver = dragOverCode === node.departamento;

    let cardBorder = isDragOver
      ? "border-rose-500 dark:border-rose-500 ring-2 ring-rose-400/40 scale-[1.02]"
      : isHighlighted
      ? "border-amber-400 dark:border-amber-700 ring-2 ring-amber-400/20 shadow-lg shadow-amber-500/5 scale-[1.02]"
      : isVacanteMarked
      ? "border-amber-300 dark:border-amber-800 ring-2 ring-amber-300/30 shadow-sm shadow-amber-500/5"
      : isSelected
      ? "border-rose-800 dark:border-rose-950 shadow-md shadow-rose-800/5 ring-1 ring-rose-800/30"
      : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 shadow-sm hover:translate-y-[-2px]";

    return (
      <div className="flex flex-col items-center">
        {/* Node card */}
        <div
          id={`node-${node.departamento}`}
          onClick={() => { setSelectedNode(node); setHighlightedNodeId(node.departamento); }}
          onDoubleClick={(e) => { if (hasChildren) { e.stopPropagation(); toggleNode(node.departamento); } }}
          draggable={!soloLectura}
          onDragStart={(e) => {
            if (soloLectura) return;
            e.dataTransfer.effectAllowed = "move";
            // Firefox requiere dataTransfer.setData en dragstart para que el
            // drag se considere válido y dispare "drop" de forma confiable
            // (sin esto, dragover funciona pero el drop puede no llegar).
            e.dataTransfer.setData("text/plain", node.departamento);
            setDraggingCode(node.departamento);
          }}
          onDragEnd={() => {
            setDraggingCode(null);
            setDragOverCode(null);
            setPreviewOrder(null);
            dragOverKeyRef.current = null;
          }}
          onDragOver={(e) => {
            if (soloLectura || !draggingCode || draggingCode === node.departamento) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const insertAfter = e.clientX > rect.left + rect.width / 2;
            const key = `${node.departamento}:${insertAfter}`;
            if (dragOverKeyRef.current === key) return; // ya calculado, evita recalcular en cada mousemove
            dragOverKeyRef.current = key;
            setDragOverCode(node.departamento);

            const parentCode = parentsMap[draggingCode];
            if (!parentCode || parentsMap[node.departamento] !== parentCode) {
              setPreviewOrder(null); // no son hermanos: sin previsualización (fase 1 no re-parenta)
              return;
            }
            const parent = allNodes[parentCode];
            const reordered = parent && reorderSiblings(parent.subordinados, draggingCode, node.departamento, insertAfter);
            setPreviewOrder(reordered ? { parentCode, order: reordered.map(c => c.departamento) } : null);
          }}
          onDragLeave={() => setDragOverCode(prev => (prev === node.departamento ? null : prev))}
          onDrop={(e) => { e.preventDefault(); handleReorderDrop(draggingCode, node.departamento, e.clientX, e.currentTarget); }}
          className={`w-60 p-4 bg-white dark:bg-slate-900 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none flex flex-col justify-between h-48 relative ${cardBorder}`}
        >
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${badgeColor}`}>
              {node.nivel_direccion || "Depto."}
            </span>
            <div className={`p-1.5 rounded-lg ${iconBg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center mb-2 px-1 gap-1.5">
            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">
              {node.descripcion_larga}
            </p>
            <div className="w-8 h-px bg-slate-150 dark:bg-slate-800" />
            {!node.num_posicion_gerente || node.num_posicion_gerente === "(en blanco)" ? (
              <p className="text-[9.5px] text-slate-350 dark:text-slate-600 italic">Sin plaza titular</p>
            ) : !node.ocupante || !node.ocupante.activa ? (
              <p className="text-[9.5px] text-rose-700 dark:text-rose-400 font-semibold">Plaza inactiva</p>
            ) : node.ocupante.vacante ? (
              <p className="text-[9.5px] text-amber-700 dark:text-amber-400 font-semibold">Departamento vacante</p>
            ) : (
              <>
                <p className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 leading-tight line-clamp-2">
                  {node.ocupante.nombre}
                </p>
                <div className="flex flex-col items-center gap-0.5 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                  <span>Nivel: {node.ocupante.nivel || "N/A"}</span>
                  <span>SMB: {formatSMB(node.ocupante.smb)}</span>
                </div>
              </>
            )}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-850 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500">
            <span>#{node.departamento}</span>
            {node.num_posicion_gerente && node.num_posicion_gerente !== "(en blanco)" && (
              <span>Plaza: {node.num_posicion_gerente}</span>
            )}
          </div>
        </div>

        {/* Toggle button */}
        {hasChildren && (
          <div className="relative z-10 mt-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); toggleNode(node.departamento); }}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-855 border border-slate-200 dark:border-slate-750 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rotate-90" />}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Skeleton (silueta de organigrama mientras carga) ──────────────────────
  const SkeletonCard = () => (
    <div className="w-60 h-48 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
  );

  const SKELETON_LANE_COUNTS = [1, 2, 3, 2];

  const OrganigramaSkeleton = () => (
    <div className="flex flex-col gap-10">
      {SKELETON_LANE_COUNTS.map((count, i) => (
        <div key={i} className="flex gap-8 justify-center">
          {Array.from({ length: count }).map((_, j) => <SkeletonCard key={j} />)}
        </div>
      ))}
    </div>
  );

  // ── Tarjeta de ocupante de plaza (titular / superior) ─────────────────────
  const PosicionOcupanteCard = ({ label, posicion, info, loading, fieldKey, node }) => {
    const isEditing = editingField === fieldKey;
    const isSaving = savingField === fieldKey;

    return (
      <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-850/80 text-xs">
        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-rose-800" />
            {label}
          </span>
          {!isEditing && (
            <span className="flex items-center gap-1.5 shrink-0">
              {posicion && posicion !== "(en blanco)" && (
                <button
                  onClick={() => applyPlazaChange(
                    fieldKey === "titular" ? "num_posicion_gerente" : "posicion_director",
                    fieldKey,
                    node,
                    "(en blanco)",
                    null
                  )}
                  disabled={savingField !== null || soloLectura}
                  title={soloLectura ? TOOLTIP_SOLO_LECTURA : "Quitar asignación"}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold normal-case tracking-normal text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="w-3 h-3" />
                  Quitar
                </button>
              )}
              <button
                onClick={() => { setEditingField(fieldKey); setEmpSearchQuery(""); setEmpSearchResults([]); }}
                disabled={savingField !== null || soloLectura}
                title={soloLectura ? TOOLTIP_SOLO_LECTURA : "Cambiar plaza"}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold normal-case tracking-normal text-rose-900 dark:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil className="w-3 h-3" />
                Cambiar
              </button>
            </span>
          )}
        </h4>

        {isEditing ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar nombre, plaza o Nº empleado..."
                value={empSearchQuery}
                onChange={e => setEmpSearchQuery(e.target.value)}
                disabled={isSaving}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-800 text-slate-800 dark:text-slate-100 disabled:opacity-50"
              />
            </div>

            {isSaving ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Actualizando plaza...</span>
              </div>
            ) : (
              <>
                {empSearching && (
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 py-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Buscando...</span>
                  </div>
                )}
                {!empSearching && empSearchQuery.trim().length >= 3 && empSearchResults.length === 0 && (
                  <p className="text-slate-400 dark:text-slate-500 py-1">Sin resultados.</p>
                )}
                {!empSearching && empSearchQuery.trim().length > 0 && empSearchQuery.trim().length < 3 && (
                  <p className="text-slate-400 dark:text-slate-500 py-1">Escribe al menos 3 caracteres.</p>
                )}
                {empSearchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-150 dark:border-slate-800">
                    {empSearchResults.map(emp => (
                      <button
                        key={emp.posicion}
                        onClick={() => applyPlazaChange(
                          fieldKey === "titular" ? "num_posicion_gerente" : "posicion_director",
                          fieldKey,
                          node,
                          emp.posicion,
                          emp
                        )}
                        className="w-full text-left p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <div className="font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate">{emp.nombre}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">Plaza {emp.posicion} · Nivel {emp.nivel || "N/A"}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Asignar la plaza sin persona (departamento vacante) ────── */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  {!manualPlazaMode ? (
                    <button
                      onClick={() => { setManualPlazaMode(true); setManualPlazaInput(""); setManualPlazaError(null); }}
                      className="text-[10px] font-semibold text-rose-900 dark:text-rose-700 hover:underline cursor-pointer"
                    >
                      ¿La plaza está vacante? Asignarla por número
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nº de plaza"
                          value={manualPlazaInput}
                          onChange={e => setManualPlazaInput(e.target.value)}
                          disabled={manualPlazaChecking}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-800 text-slate-800 dark:text-slate-100 disabled:opacity-50"
                        />
                        <button
                          onClick={() => applyManualPlaza(
                            fieldKey === "titular" ? "num_posicion_gerente" : "posicion_director",
                            fieldKey,
                            node,
                            manualPlazaInput
                          )}
                          disabled={manualPlazaChecking || !manualPlazaInput.trim()}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-rose-900 hover:bg-rose-950 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          {manualPlazaChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar"}
                        </button>
                      </div>
                      <p className="text-[9.5px] text-slate-400 dark:text-slate-500">
                        Se guarda como {label.toLowerCase()} aunque la plaza esté vacante (sin persona asignada).
                      </p>
                      {manualPlazaError && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400">{manualPlazaError}</p>
                      )}
                      <button
                        onClick={resetManualPlaza}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {!manualPlazaMode && (
                  <button
                    onClick={() => { setEditingField(null); setEmpSearchQuery(""); setEmpSearchResults([]); resetManualPlaza(); }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Cancelar
                  </button>
                )}
              </>
            )}
          </div>
        ) : !posicion || posicion === "(en blanco)" ? (
          <p className="text-slate-400 dark:text-slate-500">Sin plaza asignada.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Consultando plaza {posicion}...</span>
          </div>
        ) : !info || info.error ? (
          <p className="text-slate-400 dark:text-slate-500">No se pudo consultar la plaza {posicion}.</p>
        ) : !info.activa ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 flex items-start gap-2">
            <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
            <div>Plaza <strong className="font-mono">{posicion}</strong> inactiva al día de hoy.</div>
          </div>
        ) : info.vacante ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2.5 rounded-xl text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>Plaza <strong className="font-mono">{posicion}</strong> activa. Departamento vacante (sin persona asignada).</div>
          </div>
        ) : (
          <div className="space-y-1.5 text-slate-650 dark:text-slate-400">
            <p><strong className="text-slate-800 dark:text-slate-200">{info.nombre}</strong></p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-450">
              <span>Plaza: {posicion}</span>
              <span>Nº Empleado: {info.num_empleado}</span>
              <span>Estado Nómina: {info.estado_nomina}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-[calc(100vh-var(--stack-h)-var(--bottomnav-h))] md:h-[calc(100vh-var(--stack-h))] relative overflow-hidden bg-slate-150/40 dark:bg-slate-950/40">

      {/* ── Scrollable canvas ───────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full p-20 overflow-auto absolute inset-0 ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
      >
        <div
          id="tree-capture-container"
          className="inline-block min-w-full p-4 origin-top transition-transform duration-150 ease-out"
          style={{ zoom }}
        >
          {loadingOrg && (
            <div className="py-8">
              <OrganigramaSkeleton />
            </div>
          )}
          {loadError && (
            <div className="flex flex-col items-center justify-center gap-2 py-32 text-red-400">
              <BadgeAlert className="w-10 h-10" />
              <p className="text-sm font-semibold">Error: {loadError}</p>
            </div>
          )}
          {!loadingOrg && !loadError && organigramaData && (
            <div className="relative">
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: treeLayout.totalWidth, height: laneTopY.totalHeight, zIndex: 0 }}
              >
                {connectors.map(c => (
                  <path
                    key={c.parentId}
                    d={segmentsToSvgPath(c.segments)}
                    className="stroke-slate-400 dark:stroke-slate-600"
                    fill="none"
                    strokeWidth={2}
                  />
                ))}
              </svg>
              <div className="flex flex-col gap-10 relative" style={{ zIndex: 1 }}>
                {lanesToRender.map(({ lane, entries }) => (
                  <div key={lane.key}>
                    <div className="h-10 flex items-center gap-3 px-2" style={{ width: treeLayout.totalWidth }}>
                      <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-700" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                        {lane.label}
                      </span>
                      <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-700" />
                    </div>
                    <div className="relative" style={{ width: treeLayout.totalWidth, height: LANE_ROW_HEIGHT }}>
                      {entries.map(({ node }) => {
                        const cx = treeLayout.centerX.get(node.departamento) ?? 0;
                        return (
                          <div
                            key={node.departamento}
                            className="absolute top-0"
                            style={{ left: cx - CARD_WIDTH / 2, width: CARD_WIDTH }}
                          >
                            <NodeCard node={node} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loadingOrg && !loadError && !organigramaData && (
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-slate-400">
              <FolderTree className="w-10 h-10" />
              <p className="text-sm font-semibold">Selecciona una unidad de negocio</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Barra superior: en móvil los 3 bloques se apilan en flujo normal
          (nada se superpone); en md+ vuelven al layout flotante original —
          carriles 1/2 lado a lado y el de vacantes centrado absoluto. ──── */}
      <div className="absolute inset-x-2 top-2 z-20 flex flex-col gap-2 md:inset-x-4 md:top-4 md:flex-row md:items-start md:justify-between md:gap-0">
      {/* ── FLOATING CARD 1: Selector + Búsqueda (Top-Left) ─────────────── */}
      <div className="w-full md:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex flex-col gap-3">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-rose-900 dark:text-rose-700 text-[10px] font-bold uppercase tracking-wider">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Organigrama ANAM</span>
          </div>
          <h1 className="text-sm font-black text-slate-900 dark:text-slate-50 mt-0.5">
            Verificador Jerárquico
          </h1>
        </div>

        {/* Unidad selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
              Unidad de Negocio
            </label>
            <button
              onClick={() => { setCreateGeneralError(null); setShowCreateGeneral(true); }}
              disabled={soloLectura}
              title={soloLectura ? TOOLTIP_SOLO_LECTURA : "Crear nueva Dirección General"}
              className="flex items-center gap-1 text-[9px] font-bold text-rose-900 dark:text-rose-700 hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" />
              Nueva Dirección General
            </button>
          </div>
          <UnidadSelector
            unidades={unidades}
            loading={unidadesLoading}
            selected={selectedUnidad}
            onSelect={(u) => {
              setSelectedUnidad(u);
              setZoom(1);
            }}
          />
        </div>

        {/* Search inside selected organigrama */}
        <div className="relative">
          <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 block">
            Buscar área
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Nombre o código..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (searchResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
                    expandToNode(searchResults[selectedIndex]);
                  } else if (searchResults.length > 0) {
                    expandToNode(searchResults[0]);
                  }
                }
              }}
              disabled={!organigramaData}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-rose-800 focus:bg-white text-slate-800 dark:text-slate-100 transition-all disabled:opacity-40"
            />
          </div>

          {/* Search results */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900 max-h-60 overflow-y-auto">
              {searchResults.map((r, idx) => (
                <div
                  key={r.departamento}
                  onClick={() => expandToNode(r)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 cursor-pointer flex justify-between items-center transition-colors ${
                    selectedIndex === idx
                      ? "bg-rose-50 dark:bg-rose-900/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="min-w-0 pr-2" title={r.descripcion_larga}>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{r.descripcion_larga}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 font-mono">#{r.departamento} · {r.nivel_direccion}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-rose-800 shrink-0" />
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-3 text-xs text-slate-400">
              Sin resultados para «{searchQuery.trim()}»
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING CARD 2: Controles (Top-Right) ──────────────────────── */}
      <div className="w-full md:w-auto z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex items-center gap-1.5 overflow-x-auto md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <button onClick={expandAll} title="Expandir Todo"
          className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all shadow-sm shadow-rose-800/10">
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Expandir Todo</span>
        </button>
        <button onClick={collapseAll} title="Colapsar Todo"
          className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-355 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all">
          <ListCollapse className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Colapsar Todo</span>
        </button>
        {/* Toggle Institucional/SIG: solo tiene sentido mostrarlo si el
            usuario tiene permiso para ver MÁS DE UNA vista — si solo tiene
            una, no hay nada entre lo que elegir (ver VIEW_ORGANIGRAMA_INSTITUCIONAL /
            VIEW_ORGANIGRAMA_SIG en @/config/permissions). El botón de
            "Alineación" se retiró de la UI (el backend sigue soportando
            vista=alineacion por si se retoma más adelante). */}
        {[canViewInstitucional, canViewSig].filter(Boolean).length > 1 && (
          <>
            <div className="shrink-0 w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
            <div className="shrink-0 flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
              {canViewInstitucional && (
                <button
                  onClick={() => setVistaModo("institucional")}
                  title="Árbol curado manualmente (editable)"
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    vistaModo === "institucional"
                      ? "bg-rose-900 text-white shadow-sm shadow-rose-800/10"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
                  }`}
                >
                  Institucional
                </button>
              )}
              {canViewSig && (
                <button
                  onClick={() => setVistaModo("sig")}
                  title="Árbol filtrado a nodos con información SIG (solo lectura)"
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    vistaModo === "sig"
                      ? "bg-rose-900 text-white shadow-sm shadow-rose-800/10"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
                  }`}
                >
                  SIG
                </button>
              )}
            </div>
          </>
        )}
        <div className="shrink-0 w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
        <button
          onClick={handleToggleVacantesFiltro}
          disabled={!vacantesFiltroActivo && vacantesList.length === 0}
          title={vacantesFiltroActivo ? "Cerrar filtro de vacantes" : "Destacar departamentos con plaza titular vacante"}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            vacantesFiltroActivo
              ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
              : "text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-355 dark:bg-slate-800 dark:hover:bg-slate-750"
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Vacantes</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${vacantesFiltroActivo ? "bg-white/25" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"}`}>
            {vacantesList.length}
          </span>
        </button>
        <div className="shrink-0 w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
        <button onClick={() => setShowExportModal(true)} title="Exportar a PDF"
          className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-355 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all border border-slate-200/50 dark:border-slate-750">
          <Download className="w-3.5 h-3.5 text-rose-800" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>

      {/* ── FLOATING BAR: Recorrido de vacantes (Top-Center) ─────────────
          Móvil: tercer bloque en flujo dentro del wrapper (se apila abajo
          de los controles, sin superponerse). md+: sale del flujo y vuelve
          a flotar centrada como antes (posición relativa al wrapper, que ya
          arranca en top-4/inset-x-4, así que top-0/left-1/2 aquí calzan). */}
      {vacantesFiltroActivo && (
        <div className="w-full md:w-auto md:absolute md:top-0 md:left-1/2 md:-translate-x-1/2 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pl-2 pr-1.5 py-1.5 rounded-2xl border border-amber-300/70 dark:border-amber-800/70 shadow-xl flex items-center gap-2">
          <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="min-w-0 max-w-[220px]">
            <div className="text-[9px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
              Vacante {vacanteFocusIndex + 1} de {vacantesList.length}
            </div>
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate" title={vacantesList[vacanteFocusIndex]?.descripcion_larga}>
              {vacantesList[vacanteFocusIndex]?.descripcion_larga || "—"}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => goToVacanteIndex(vacanteFocusIndex - 1)}
              disabled={vacantesList.length < 2}
              title="Vacante anterior"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToVacanteIndex(vacanteFocusIndex + 1)}
              disabled={vacantesList.length < 2}
              title="Vacante siguiente"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-amber-200 dark:bg-amber-900 mx-0.5" />
            <button
              onClick={handleToggleVacantesFiltro}
              title="Cerrar filtro de vacantes"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </div>
      {/* ── fin barra superior apilable ─────────────────────────────────── */}

      {/* ── FLOATING CARD 3: Stats (Bottom-Left) ────────────────────────── */}
      <div className="absolute bottom-[calc(var(--bottomnav-h)+0.5rem)] md:bottom-4 left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg text-[10px] text-slate-550 dark:text-slate-400 font-medium flex items-center gap-3">
        {selectedUnidad && (
          <div className="flex items-center gap-1.5 text-rose-900 dark:text-rose-700 font-bold border-r border-slate-200 dark:border-slate-800 pr-3">
            <Building className="w-3 h-3" />
            <span>{selectedUnidad.id}</span>
          </div>
        )}
        <div>Total áreas: <strong className="text-slate-800 dark:text-slate-200">{stats.total}</strong></div>
        <div className="hidden md:flex gap-3 border-l border-slate-200 dark:border-slate-800 pl-3">
          <div>Generales: <strong>{stats.levels["General"] || stats.levels["Titular"] || 0}</strong></div>
          <div>Centrales: <strong>{stats.levels.Central || 0}</strong></div>
          <div>Direcciones: <strong>{stats.levels.Director || 0}</strong></div>
          <div>Subdirecciones: <strong>{stats.levels["Subdir."] || 0}</strong></div>
          <div>Jefaturas: <strong>{stats.levels["Jefe Depto"] || 0}</strong></div>
        </div>
      </div>

      {/* ── FLOATING CARD 4: Zoom (Bottom-Right) ────────────────────────── */}
      <div className="absolute bottom-[calc(var(--bottomnav-h)+0.5rem)] md:bottom-4 right-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg flex items-center gap-1">
        <button onClick={() => setZoom(p => Math.max(p - 0.1, 0.3))} title="Reducir Zoom"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-355 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono font-bold text-slate-650 dark:text-slate-300 min-w-[36px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(p => Math.min(p + 0.1, 2))} title="Aumentar Zoom"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-355 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-250 dark:bg-slate-800 mx-0.5" />
        <button onClick={() => setZoom(1)} title="Reset zoom"
          className="px-2 py-1 rounded-lg text-[9px] font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 dark:text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 transition-colors cursor-pointer">
          Reset
        </button>
      </div>

      {/* ── MODAL: Detalle de nodo ───────────────────────────────────────── */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[88vh]">
            <div className="h-2 bg-gradient-to-r from-rose-800 via-rose-700 to-amber-500" />
            <button
              onClick={() => (isEditingNode ? handleCancelEdit() : setSelectedNode(null))}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-900 dark:text-rose-700 flex items-center gap-1.5 mb-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Detalle de Estructura</span>
                </span>
                {isEditingNode ? (
                  <input
                    type="text"
                    autoFocus
                    value={editForm.descripcion_larga}
                    onChange={e => setEditForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                    disabled={savingEdit}
                    className="w-full text-xl font-black text-slate-900 dark:text-slate-50 leading-tight bg-transparent border-b-2 border-rose-800 focus:outline-none pb-1 disabled:opacity-50"
                  />
                ) : (
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                    {selectedNode.descripcion_larga}
                  </h2>
                )}
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                  ID: {selectedNode.departamento}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Nivel Jerárquico</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.nivel_direccion || "Depto."}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Unidad de Negocio</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.unidad_negocio}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Unidad Administrativa</span>
                  {isEditingNode ? (
                    <input type="text" value={editForm.unidad_administrativa}
                      onChange={e => setEditForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                      disabled={savingEdit}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50" />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.unidad_administrativa}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">DOAF</span>
                  {isEditingNode ? (
                    <input type="text" value={editForm.doaf}
                      onChange={e => setEditForm(f => ({ ...f, doaf: e.target.value }))}
                      disabled={savingEdit}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50" />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.doaf}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Plaza Titular (Gerente)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.num_posicion_gerente || "N/A"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Plaza Superior (Reporte)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.posicion_director || "N/A"}</span>
                </div>
              </div>
              {isEditingNode && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug -mt-2">
                  Nivel jerárquico y unidad de negocio no son editables aquí: van codificados en el ID del departamento y en la jerarquía del árbol. Para eso, crea el nodo correcto bajo el padre indicado y elimina este.
                </p>
              )}
              {isEditingNode && editError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{editError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PosicionOcupanteCard
                  label="Plaza Titular"
                  posicion={selectedNode.num_posicion_gerente}
                  info={posInfo.titular}
                  loading={posLoading.titular}
                  fieldKey="titular"
                  node={selectedNode}
                />
                <PosicionOcupanteCard
                  label="Plaza Superior (Reporte)"
                  posicion={selectedNode.posicion_director}
                  info={posInfo.superior}
                  loading={posLoading.superior}
                  fieldKey="superior"
                  node={selectedNode}
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setTimeout(() => {
                    document.getElementById(`node-${selectedNode.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
                disabled={isEditingNode}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-900 dark:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Locate className="w-4 h-4" />
                <span>Centrar en Organigrama</span>
              </button>
              <div className="flex items-center gap-2">
                {isEditingNode ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingEdit}
                      className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40 cursor-pointer">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                      {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Guardar cambios</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (soloLectura || (selectedNode.subordinados?.length || 0) > 0) return;
                        setDeleteError(null);
                        setShowDeleteConfirm(true);
                      }}
                      disabled={soloLectura || (selectedNode.subordinados?.length || 0) > 0}
                      title={soloLectura ? TOOLTIP_SOLO_LECTURA : (selectedNode.subordinados?.length || 0) > 0 ? "Elimina primero sus subordinados." : "Eliminar departamento"}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                    <button
                      onClick={handleOpenEdit}
                      disabled={soloLectura}
                      title={soloLectura ? TOOLTIP_SOLO_LECTURA : "Editar departamento"}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      <Pencil className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    {Object.keys(TIPO_LABELS).some(t => LEVEL_SEGPOS[t] > (LEVEL_SEGPOS[selectedNode.nivel_direccion] ?? -1)) && (
                      <button
                        onClick={() => { setCreateChildError(null); resetChildForm(); setShowCreateChild(true); }}
                        disabled={soloLectura}
                        title={soloLectura ? TOOLTIP_SOLO_LECTURA : "Agregar subordinado"}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-800/10 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-4 h-4" />
                        <span>Agregar subordinado</span>
                      </button>
                    )}
                    <button onClick={() => setSelectedNode(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-250 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all cursor-pointer">
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Confirmar borrado ────────────────────────────────────── */}
      {showDeleteConfirm && selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-800" />
              Eliminar departamento
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              ¿Eliminar <strong className="font-mono">{selectedNode.departamento}</strong> — {selectedNode.descripcion_larga}? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2 mb-4">
                <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deletingNode}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleDeleteNode}
                disabled={deletingNode}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {deletingNode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Export ───────────────────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-rose-800" />
              Exportar Organigrama a PDF
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Selecciona el alcance de exportación.</p>
            <div className="space-y-4 mb-6">
              {[
                { type: "current", title: "Vista Actual", desc: "Respeta las ramas contraídas/expandidas en pantalla." },
                { type: "full",    title: "Todo Desglosado", desc: "Expande temporalmente todas las ramas." },
              ].map(({ type, title, desc }) => (
                <button key={type} onClick={() => handleExportPdf(type)}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-800 dark:hover:border-rose-950 hover:bg-rose-50/20 dark:hover:bg-rose-950/15 transition-all group">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-rose-900 dark:group-hover:text-rose-700">{title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear nueva Dirección General (abre lienzo nuevo) ─────── */}
      {showCreateGeneral && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-rose-800" />
              Nueva Dirección General
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Crea una raíz nueva (nivel General) y abre su propio lienzo. unidad_negocio y
              departamento son códigos oficiales asignados externamente: captúralos tal cual.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">unidad_negocio *</label>
                <input type="text" value={generalForm.unidad_negocio}
                  onChange={e => setGeneralForm(f => ({ ...f, unidad_negocio: e.target.value }))}
                  placeholder="Ej. 01000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">departamento (determinante) *</label>
                <input type="text" value={generalForm.departamento}
                  onChange={e => setGeneralForm(f => ({ ...f, departamento: e.target.value }))}
                  placeholder="Ej. 01000000000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Descripción *</label>
                <input type="text" value={generalForm.descripcion_larga}
                  onChange={e => setGeneralForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                  placeholder="Ej. Dirección General de..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Unidad Administrativa</label>
                  <input type="text" value={generalForm.unidad_administrativa}
                    onChange={e => setGeneralForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">DOAF</label>
                  <input type="text" value={generalForm.doaf}
                    onChange={e => setGeneralForm(f => ({ ...f, doaf: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Plaza titular (opcional)</label>
                <input type="text" value={generalForm.num_posicion_gerente}
                  onChange={e => setGeneralForm(f => ({ ...f, num_posicion_gerente: e.target.value }))}
                  placeholder="Se puede asignar después"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              {createGeneralError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{createGeneralError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateGeneral(false); setGeneralForm(emptyGeneralForm); setCreateGeneralError(null); }}
                disabled={creatingGeneral}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleCreateGeneral}
                disabled={creatingGeneral}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {creatingGeneral && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crear y abrir lienzo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear subordinado bajo selectedNode ───────────────────── */}
      {showCreateChild && selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Plus className="w-5 h-5 text-rose-800" />
              Agregar subordinado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bajo <strong className="font-mono">{selectedNode.departamento}</strong> — {selectedNode.descripcion_larga}.
              El determinante se genera automáticamente.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Tipo *</label>
                <select value={childForm.tipo}
                  onChange={e => setChildForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800">
                  <option value="">Selecciona...</option>
                  {Object.entries(TIPO_LABELS)
                    .filter(([tipo]) => LEVEL_SEGPOS[tipo] > (LEVEL_SEGPOS[selectedNode.nivel_direccion] ?? -1))
                    .map(([tipo, label]) => (
                      <option key={tipo} value={tipo}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Descripción *</label>
                <input type="text" value={childForm.descripcion_larga}
                  onChange={e => setChildForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                  placeholder="Ej. Subdirección de..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Unidad Administrativa</label>
                  <input type="text" value={childForm.unidad_administrativa}
                    onChange={e => setChildForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                    placeholder={selectedNode.unidad_administrativa || ""}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">DOAF</label>
                  <input type="text" value={childForm.doaf}
                    onChange={e => setChildForm(f => ({ ...f, doaf: e.target.value }))}
                    placeholder={selectedNode.doaf || ""}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Plaza titular (opcional)</label>
                {childForm.num_posicion_gerente ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 truncate">
                      Plaza {childForm.num_posicion_gerente}
                      {childPosSelectedEmp?.vacante ? (
                        <span className="text-amber-600 dark:text-amber-400 font-normal"> · Vacante (departamento sin persona)</span>
                      ) : childPosSelectedEmp?.nombre ? (
                        <span className="text-slate-400 font-normal"> · {childPosSelectedEmp.nombre}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setChildForm(f => ({ ...f, num_posicion_gerente: "" })); setChildPosQuery(""); setChildPosResults([]); setChildPosSelectedEmp(null); }}
                      title="Quitar plaza"
                      className="text-slate-400 hover:text-rose-800 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div ref={childPosAnchorRef} className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={childPosQuery}
                        onChange={e => setChildPosQuery(e.target.value)}
                        placeholder="Buscar nombre, plaza o Nº empleado..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                    </div>
                    {childPosSearching && (
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 py-1 mt-1 text-[11px]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Buscando...</span>
                      </div>
                    )}
                    {!childPosSearching && childPosQuery.trim().length > 0 && childPosQuery.trim().length < 3 && (
                      <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">Escribe al menos 3 caracteres.</p>
                    )}
                    {!childPosSearching && childPosQuery.trim().length >= 3 && childPosResults.length === 0 && (
                      <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">Sin resultados.</p>
                    )}
                    {childPosResults.length > 0 && childPosMenuRect && (
                      <div
                        style={{
                          position: "fixed",
                          top: childPosMenuRect.top,
                          left: childPosMenuRect.left,
                          width: childPosMenuRect.width,
                          maxHeight: childPosMenuRect.maxHeight,
                        }}
                        className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-[70]">
                        {childPosResults.map(emp => (
                          <button
                            key={emp.posicion}
                            type="button"
                            onClick={() => {
                              setChildForm(f => ({ ...f, num_posicion_gerente: emp.posicion }));
                              setChildPosSelectedEmp(emp);
                              setChildPosQuery("");
                              setChildPosResults([]);
                            }}
                            className="w-full text-left p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <div className="font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate">{emp.nombre}</div>
                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">Plaza {emp.posicion} · Nivel {emp.nivel || "N/A"}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Asignar la plaza sin persona (departamento vacante) ── */}
                    <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      {!childPosManualMode ? (
                        <button
                          type="button"
                          onClick={() => { setChildPosManualMode(true); setChildPosManualInput(""); setChildPosManualError(null); }}
                          className="text-[10px] font-semibold text-rose-900 dark:text-rose-700 hover:underline cursor-pointer"
                        >
                          ¿La plaza está vacante? Asignarla por número
                        </button>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Nº de plaza"
                              value={childPosManualInput}
                              onChange={e => setChildPosManualInput(e.target.value)}
                              disabled={childPosManualChecking}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-800 text-slate-800 dark:text-slate-100 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => checkChildManualPlaza(childPosManualInput)}
                              disabled={childPosManualChecking || !childPosManualInput.trim()}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-rose-900 hover:bg-rose-950 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                            >
                              {childPosManualChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Validar"}
                            </button>
                          </div>
                          <p className="text-[9.5px] text-slate-400 dark:text-slate-500">
                            Se asigna como plaza titular aunque esté vacante (sin persona asignada).
                          </p>
                          {childPosManualError && (
                            <p className="text-[10px] text-rose-600 dark:text-rose-400">{childPosManualError}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => { setChildPosManualMode(false); setChildPosManualInput(""); setChildPosManualError(null); }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {createChildError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{createChildError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateChild(false); resetChildForm(); setCreateChildError(null); }}
                disabled={creatingChild}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleCreateChild}
                disabled={creatingChild}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {creatingChild && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crear subordinado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast: cambio de plaza confirmado, con opción de revertir ────── */}
      {changeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{changeToast.message}</span>
          </div>
          <button
            onClick={changeToast.onUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Revertir...
          </button>
          <button
            onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setChangeToast(null); }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Global export loader ─────────────────────────────────────────── */}
      {isExporting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-5 h-5 text-rose-800 animate-spin" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Generando PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganigramaPage() {
  return (
    <RequirePermission permission={[PERMISSIONS.VIEW_ORGANIGRAMA_INSTITUCIONAL, PERMISSIONS.VIEW_ORGANIGRAMA_ALINEACION, PERMISSIONS.VIEW_ORGANIGRAMA_SIG]}>
      <OrganigramaContent />
    </RequirePermission>
  );
}
