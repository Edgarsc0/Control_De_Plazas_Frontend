"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, CustomChart } from "echarts/charts";
import { GridComponent, TooltipComponent, MarkPointComponent, MarkAreaComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

// Solo lo que se usa (tree-shaking): la build de ECharts completa pesa mucho más.
echarts.use([LineChart, CustomChart, GridComponent, TooltipComponent, MarkPointComponent, MarkAreaComponent, LabelLayout, CanvasRenderer]);

// Valor por defecto ESTABLE: un `[]` nuevo en cada render reconstruiría la opción y reiniciaría la animación.
const SIN_EVENTOS = [];
const VERDE = "#2f7d4f"; // incremento de plazas activas
const GUINDA = "#8c2d4a"; // incremento de plazas inactivas
// Líneas de evento: verticales, continuas y de color pastel (verde = alta, rosa = inactivación).
const FRANJA = {
  creacion: { linea: "#86efac" },
  desactivacion: { linea: "#fda4af" },
};

/**
 * Lado que ocupa la franja de un evento dentro de su columna mensual: 0 = ancho completo;
 * -1 / 1 = mitad izquierda / derecha, cuando el mismo mes tiene alta (izq.) e inactivación (der.).
 */
function ladoFranja(ev, events) {
  const compartido = events.some((o) => o !== ev && o.index === ev.index);
  if (!compartido) return 0;
  return ev.type === "creacion" ? -1 : 1;
}

/** ¿La app está en modo oscuro? (clase `dark` en <html>, observada para re-tematizar la gráfica). */
export function useModoOscuro() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const leer = () => setOscuro(el.classList.contains("dark"));
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return oscuro;
}

/**
 * Gráfica de líneas del histórico de plazas / ocupación / vacancia (ECharts).
 *
 * Diseño (menos saturado que la versión anterior en Recharts):
 *  - Líneas limpias, SIN un punto por mes; el punto solo aparece al pasar el cursor.
 *  - Etiqueta al final de cada línea (nombre + valor actual) en vez de leyenda + rótulos por año.
 *  - Área con degradado suave en la serie principal.
 *  - Años alternados con un fondo casi imperceptible (en lugar de franjas de colores por mes).
 *  - Rejilla solo horizontal y punteada, ejes discretos.
 *  - Máximo/mínimo de cada año: puntos huecos pequeños; su valor se ve al pasar el cursor.
 *  - Eventos (creación/desactivación de plazas): líneas verticales continuas pastel de arriba a
 *    abajo de toda la gráfica —verde (altas), rosa (inactivaciones)—; un clic sobre una abre el
 *    detalle. Se pueden ocultar desde el padre (basta pasar `events` vacío).
 *  - Las etiquetas del final de cada línea van DENTRO de la gráfica (sobre el último punto), para
 *    que la gráfica use todo el ancho: no hay columna lateral reservada.
 *  - Tooltip por eje con todas las series y, si aplica, el evento de ese mes.
 *
 * Props:
 *  - series: [{ key, name, color }]; chartData: [{ label, fecha, ...valores }]
 *  - ticks: etiquetas del eje X a mostrar; yDomain: [min, max|'auto']
 *  - events: [{ index, type: 'creacion'|'desactivacion', dActivas, dInactivas }] y onEventClick(ev)
 *  - extremes: marca máx/mín anual de cada serie; extremeLabels: además deja SIEMPRE visible su
 *    texto (fecha y valor) — para gráficas de una sola serie, donde no se encima; area: degradado bajo la primera serie
 *  - compact / angosto: widget del tablero (márgenes y fuentes reducidos)
 */
export default function HistoricoLineChart({
  series, chartData, ticks, yDomain, formatNumber, events = SIN_EVENTOS, onEventClick,
  extremes = false, extremeLabels = false, area = true, compact = false, angosto = false,
}) {
  const contenedorRef = useRef(null);
  const chartRef = useRef(null);
  const oscuro = useModoOscuro();
  // Callbacks por ref: si no, cada render del padre (funciones nuevas) reconstruiría la
  // opción y volvería a lanzar la animación de dibujado.
  const fmtRef = useRef(formatNumber);
  const clicRef = useRef(onEventClick);
  fmtRef.current = formatNumber;
  clicRef.current = onEventClick;
  // El padre recrea `series` en cada render: su contenido, no su identidad, decide.
  const firmaSeries = series.map((s) => `${s.key}|${s.name}|${s.color}`).join(",");

  const opcion = useMemo(() => {
    const fmt = (v) => (fmtRef.current ? fmtRef.current(v) : String(v));
    const texto = oscuro ? "#94a3b8" : "#64748b";
    const fuerte = oscuro ? "#e2e8f0" : "#0f172a";
    const linea = oscuro ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.18)";
    const fs = angosto ? 9 : 11;
    const etiquetas = chartData.map((d) => d.label);
    const tickSet = new Set(ticks || []);

    // Años alternados (fondo casi imperceptible) + rótulo del año arriba.
    const porAnio = [];
    chartData.forEach((d) => {
      const anio = (d.fecha || "").slice(0, 4);
      if (!anio) return;
      const ult = porAnio[porAnio.length - 1];
      if (ult && ult.anio === anio) ult.fin = d.label;
      else porAnio.push({ anio, ini: d.label, fin: d.label });
    });
    const bandas = porAnio.length > 1 && !compact
      ? porAnio.map((y, i) => [
          {
            xAxis: y.ini,
            name: y.anio,
            itemStyle: { color: i % 2 ? (oscuro ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.06)") : "rgba(0,0,0,0)" },
            label: { show: !angosto, position: "insideTop", color: texto, fontSize: 10, fontWeight: 800, opacity: 0.7 },
          },
          { xAxis: y.fin },
        ])
      : [];

    // Máx/mín de cada año por serie: {[anio]: {max:{v,label}, min:{v,label}|null}}.
    // Una sola pasada, reutilizada tanto por los puntos huecos del markPoint
    // como por el tooltip por eje (ver `tooltip.formatter` más abajo) — así el
    // texto "Máx/Mín" es el mismo se vea al pasar por el punto o por cualquier
    // otro mes de ese año.
    const maxMinDe = (s) => {
      const porAnioS = {};
      porAnio.forEach((y) => {
        let max = null, min = null;
        chartData.forEach((d) => {
          if ((d.fecha || "").slice(0, 4) !== y.anio) return;
          const v = d[s.key];
          if (v == null) return;
          if (max === null || v > max.v) max = { v, label: d.label };
          if (min === null || v < min.v) min = { v, label: d.label };
        });
        if (max) porAnioS[y.anio] = { max, min: min && min.v !== max.v ? min : null };
      });
      return porAnioS;
    };
    const extremosPorSerie = extremes ? Object.fromEntries(series.map((s) => [s.key, maxMinDe(s)])) : {};
    const keyByName = Object.fromEntries(series.map((s) => [s.name, s.key]));

    // Máx/mín anual por serie (puntos huecos; el valor sale al pasar el cursor).
    const extremosDe = (s) => {
      if (!extremes) return [];
      const pts = [];
      Object.entries(extremosPorSerie[s.key]).forEach(([, { max, min }]) => {
        [[max, "Máx.", -1], [min, "Mín.", 1]].forEach(([e, rot, signo]) => {
          if (!e) return;
          const etiqueta = {
            position: signo < 0 ? "top" : "bottom",
            distance: 6,
            color: fuerte,
            backgroundColor: oscuro ? "#1e293b" : "#ffffff",
            borderColor: s.color,
            borderWidth: 1,
            borderRadius: 6,
            padding: [3, 6],
            formatter: () => `{t|${signo < 0 ? "▲" : "▼"} ${rot} ${e.label}}\n{v|${fmt(e.v)}}`,
            rich: {
              t: { color: texto, fontSize: angosto ? 8 : 10, fontWeight: 700, lineHeight: angosto ? 11 : 13 },
              v: { color: s.color, fontSize: angosto ? 10 : 13, fontWeight: 900, lineHeight: angosto ? 13 : 16 },
            },
          };
          pts.push({
            coord: [e.label, e.v],
            symbol: "circle",
            symbolSize: 8,
            itemStyle: { color: oscuro ? "#0f172a" : "#ffffff", borderColor: s.color, borderWidth: 2 },
            // Con `extremeLabels` el texto queda siempre visible; si no, solo al pasar el cursor.
            label: { show: extremeLabels, ...etiqueta },
            emphasis: { label: { show: true, ...etiqueta } },
          });
        });
      });
      return pts;
    };

    // Líneas de los eventos: serie `custom` con una línea vertical continua por evento, de arriba a
    // abajo del área de la gráfica, más una zona de clic más ancha que el trazo. Al ser una serie,
    // recibe el clic y el cursor de mano de ECharts.
    const datosEventos = events
      .filter((ev) => chartData[ev.index] !== undefined)
      .map((ev) => ({ value: [ev.index], ev, lado: ladoFranja(ev, events) }));
    const serieEventos = datosEventos.length ? [{
      name: "__eventos",
      type: "custom",
      z: 1,
      animation: false,
      tooltip: { show: false },
      data: datosEventos,
      encode: { x: 0 },
      renderItem: (params, api) => {
        const { ev, lado } = datosEventos[params.dataIndex];
        const cx = api.coord([api.value(0), 0])[0];
        // Si el mismo mes tiene alta e inactivación, las dos líneas quedan lado a lado.
        const x = cx + lado * 3;
        const cs = params.coordSys;
        const c = FRANJA[ev.type] || FRANJA.creacion;
        return {
          type: "group",
          children: [
            // Zona de clic más ancha que el trazo (casi invisible, pero sí "golpeable").
            { type: "rect", shape: { x: x - 7, y: cs.y, width: 14, height: cs.height }, style: { fill: "rgba(0,0,0,0.001)" } },
            {
              type: "line",
              shape: { x1: x, y1: cs.y, x2: x, y2: cs.y + cs.height },
              style: { stroke: c.linea, lineWidth: 3 },
              emphasis: { style: { stroke: c.linea, lineWidth: 5 } },
            },
          ],
        };
      },
    }] : [];

    return {
      animationDuration: 1100,
      animationEasing: "cubicOut",
      textStyle: { fontFamily: "inherit" },
      grid: { left: 8, right: 14, top: 26, bottom: 6, containLabel: true },
      tooltip: {
        trigger: "axis",
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: "transparent",
        extraCssText: "box-shadow:none;",
        axisPointer: { type: "line", lineStyle: { color: "#bc955c", width: 1, type: "dashed" } },
        formatter: (params) => {
          params = (params || []).filter((p) => p.seriesType === "line");
          if (!params.length) return "";
          const i = params[0].dataIndex;
          const evs = events.filter((e) => e.index === i);
          const anio = (chartData[i]?.fecha || "").slice(0, 4);
          const filas = params.map((p) => {
            // Máx/mín del año en curso de esta serie: el mismo dato que ya se ve
            // al pasar el cursor justo por el punto hueco (ver `extremosDe`),
            // pero ahora también junto al valor de cualquier otro mes del año.
            const key = keyByName[p.seriesName];
            const ext = extremes ? extremosPorSerie[key]?.[anio] : null;
            const subfila = ext ? `
              <div style="margin-top:2px;padding-left:16px;font-size:9.5px;font-weight:700;color:${texto}">
                ▲ Máx ${ext.max.label} <span style="color:${p.color};font-weight:900">${fmt(ext.max.v)}</span>
                ${ext.min ? `&nbsp;&nbsp;▼ Mín ${ext.min.label} <span style="color:${p.color};font-weight:900">${fmt(ext.min.v)}</span>` : ""}
              </div>` : "";
            return `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:18px">
                <span style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:${texto}">
                  <span style="width:9px;height:9px;border-radius:50%;background:${p.color}"></span>${p.seriesName}
                </span>
                <span style="font-size:12px;font-weight:900;color:${fuerte}">${fmt(p.value)}</span>
              </div>${subfila}
            </div>`;
          }).join("");
          const extra = evs.map((e) => `
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid ${linea};font-size:11px;font-weight:800;color:${e.type === "creacion" ? VERDE : GUINDA}">
              ${e.type === "creacion" ? `▲ +${e.dActivas} plazas activas` : `▼ +${e.dInactivas} plazas inactivas`}
              <span style="font-weight:600;color:${texto}"> · clic en la franja para el detalle</span>
            </div>`).join("");
          return `<div style="min-width:190px;padding:12px 14px;border-radius:16px;border:1px solid ${linea};background:${oscuro ? "#0f172a" : "#ffffff"};box-shadow:0 12px 32px rgba(98,31,50,0.16)">
            <div style="margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid ${linea};font-size:11px;font-weight:900;letter-spacing:.06em;color:#bc955c">${params[0].axisValueLabel}</div>
            <div style="display:flex;flex-direction:column;gap:6px">${filas}</div>${extra}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: etiquetas,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: linea } },
        axisLabel: { color: texto, fontSize: fs, fontWeight: 700, margin: 10, hideOverlap: true, interval: (_, v) => tickSet.has(v) },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: Array.isArray(yDomain) && typeof yDomain[0] === "number" ? yDomain[0] : undefined,
        max: Array.isArray(yDomain) && typeof yDomain[1] === "number" ? yDomain[1] : undefined,
        splitNumber: angosto ? 3 : 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: texto, fontSize: fs, fontWeight: 700, formatter: (v) => fmt(v) },
        splitLine: { lineStyle: { color: linea, type: [4, 4] } },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "line",
        // Silenciosa: el área bajo la línea cubre las franjas de evento (que están debajo) y se
        // quedaba con el clic. El tooltip por eje y los puntos de máx/mín (markPoint, con su
        // propio `silent`) no dependen de esto.
        silent: true,
        data: chartData.map((d) => d[s.key]),
        showSymbol: false,
        symbol: "circle",
        symbolSize: 9,
        lineStyle: { width: compact ? 2 : 2.75, color: s.color, cap: "round", join: "round" },
        itemStyle: { color: s.color, borderColor: oscuro ? "#0f172a" : "#ffffff", borderWidth: 2 },
        emphasis: { focus: "none", lineStyle: { width: compact ? 2.5 : 3.5 } },
        areaStyle: area && i === 0
          ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${s.color}33` }, { offset: 1, color: `${s.color}00` }]) }
          : undefined,
        animationDelay: i * 160,
        endLabel: {
          show: true,
          distance: 0,
          formatter: (p) => (angosto ? `{v|${fmt(p.value)}}` : `{n|${s.name}}\n{v|${fmt(p.value)}}`),
          rich: {
            n: { color: texto, fontSize: 10, fontWeight: 700, lineHeight: 14 },
            v: { color: s.color, fontSize: angosto ? 10 : 13, fontWeight: 900, lineHeight: 16 },
          },
        },
        // Dentro de la gráfica: alineada a la derecha, justo encima del último punto.
        labelLayout: { align: "right", verticalAlign: "bottom", dx: -6, dy: -6, moveOverlap: "shiftY" },
        markArea: i === 0 && bandas.length ? { silent: true, animation: false, data: bandas } : undefined,
        markPoint: { silent: false, data: extremosDe(s), animation: false },
      })).concat(serieEventos),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaSeries, chartData, ticks, yDomain, events, extremes, extremeLabels, area, compact, angosto, oscuro]);

  // Crear / destruir la instancia y mantenerla del tamaño del contenedor.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;
    // Cada franja es un elemento de la serie `custom`: el clic (y el cursor de mano) los maneja ECharts.
    chart.on("click", (p) => {
      if (p.seriesType === "custom" && p.data?.ev) clicRef.current?.(p.data.ev);
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  // `notMerge`: al cambiar de filtro no deben quedar restos de series anteriores.
  useEffect(() => {
    chartRef.current?.setOption(opcion, { notMerge: true });
  }, [opcion]);

  return <div ref={contenedorRef} className="size-full" />;
}
