"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useModoOscuro } from "./HistoricoLineChart";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const RADIO = 9;
// Abreviaturas del eje X cuando el espacio es angosto.
const ABREVIADO = { "Dir. Central": "DC", "Jefe Depto.": "Jefe", Subdirector: "Sub", "Tit. ANAM": "Tit.", "Op. Cfza.": "OC", "Op. Bse.": "OB" };

const abreviarMiles = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Math.abs(n) >= 1000) { const k = n / 1000; return `${Number.isInteger(k) ? k : k.toFixed(1)}k`; }
  return String(n);
};

/**
 * Barras por Nivel Jerárquico (ECharts): mismas cifras y mismo clic que la versión anterior en
 * Recharts, con un diseño que da todo el protagonismo a las barras.
 *  - Barras con degradado y esquinas redondeadas; el total encima de cada una.
 *  - La barra del NJ 3 (`isSplit`) va partida: Titulares de aduana (dorado, arriba) y
 *    Directores (granate, abajo).
 *  - En espacio chico (`chico`) desaparecen el eje Y y la rejilla: solo barras y sus cifras.
 *  - Tooltip por barra; clic en una barra = `onBarClick(fila)` (abre el detalle de empleados).
 *
 * Props: data [{ name, nj, isSplit, titular, director, <valueKey> }]; valueKey ("Vacantes" |
 * "Ocupadas"); valueLabel (nombre de la métrica en el tooltip); pares (paleta de degradados);
 * gradienteTitular / gradienteDirector; mini / chico (tamaño del widget); angosto (abrevia
 * etiquetas); formatNumber; animar (false al exportar a PDF).
 */
export default function NivelBarChart({
  data, valueKey, valueLabel, pares, gradienteTitular, gradienteDirector,
  formatNumber, onBarClick, mini = false, chico = false, angosto = false, animar = true,
}) {
  const contenedorRef = useRef(null);
  const chartRef = useRef(null);
  const oscuro = useModoOscuro();
  const fmtRef = useRef(formatNumber);
  const clicRef = useRef(onBarClick);
  const datosRef = useRef(data);
  fmtRef.current = formatNumber;
  clicRef.current = onBarClick;
  datosRef.current = data;

  const opcion = useMemo(() => {
    const fmt = (v) => (fmtRef.current ? fmtRef.current(v) : String(v));
    const texto = oscuro ? "#94a3b8" : "#64748b";
    const fuerte = oscuro ? "#e2e8f0" : "#0f172a";
    const linea = oscuro ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.18)";
    const acento = oscuro ? "#bc955c" : "#621f32";
    const fs = mini ? 8 : 10;
    const degradado = (par) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: par[1] }, { offset: 1, color: par[0] }]);
    const total = (r) => (r.isSplit ? (r.titular || 0) + (r.director || 0) : r[valueKey] || 0);

    const etiquetaTotal = (r) => ({
      show: total(r) > 0,
      position: "top",
      distance: 4,
      formatter: () => fmt(total(r)),
      color: acento,
      fontSize: mini ? 9 : 12,
      fontWeight: 800,
    });

    // Tres series apiladas: barra normal, y las dos mitades de la barra partida del NJ 3.
    const base = data.map((r, i) => ({
      value: r.isSplit ? 0 : r[valueKey] || 0,
      itemStyle: { color: degradado(pares[i % pares.length]), borderRadius: [RADIO, RADIO, 0, 0] },
      label: r.isSplit ? { show: false } : etiquetaTotal(r),
    }));
    const directores = data.map((r) => ({
      value: r.isSplit ? r.director || 0 : 0,
      itemStyle: { color: degradado(gradienteDirector), borderRadius: (r.titular || 0) > 0 ? [0, 0, RADIO, RADIO] : [RADIO, RADIO, RADIO, RADIO] },
      label: r.isSplit && !(r.titular > 0) ? etiquetaTotal(r) : { show: false },
    }));
    const titulares = data.map((r) => ({
      value: r.isSplit ? r.titular || 0 : 0,
      itemStyle: { color: degradado(gradienteTitular), borderRadius: (r.director || 0) > 0 ? [RADIO, RADIO, 0, 0] : [RADIO, RADIO, RADIO, RADIO] },
      label: r.isSplit && r.titular > 0 ? etiquetaTotal(r) : { show: false },
    }));
    const serie = (name, datos, delay) => ({
      name, type: "bar", stack: "total", data: datos, barMaxWidth: 52, barCategoryGap: "22%",
      animationDelay: (i) => i * 45 + delay, cursor: "pointer",
      emphasis: { focus: "none", itemStyle: { shadowBlur: 10, shadowColor: "rgba(98,31,50,0.35)" } },
    });

    return {
      animation: animar,
      animationDuration: 850,
      animationEasing: "cubicOut",
      textStyle: { fontFamily: "inherit" },
      grid: { left: chico ? 4 : 6, right: 6, top: mini ? 20 : 26, bottom: 2, containLabel: true },
      tooltip: {
        trigger: "axis",
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: "transparent",
        extraCssText: "box-shadow:none;",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(98,31,50,0.05)" } },
        formatter: (params) => {
          const r = data[params?.[0]?.dataIndex];
          if (!r) return "";
          const fila = (color, nombre, valor) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:18px">
              <span style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:${texto}">
                <span style="width:9px;height:9px;border-radius:3px;background:${color}"></span>${nombre}
              </span>
              <span style="font-size:12px;font-weight:900;color:${fuerte}">${fmt(valor)}</span>
            </div>`;
          const cuerpo = r.isSplit
            ? `${fila(gradienteTitular[0], "Titulares de aduanas", r.titular || 0)}${fila(gradienteDirector[0], "Directores", r.director || 0)}
               <div style="margin-top:2px;padding-top:6px;border-top:1px solid ${linea};display:flex;justify-content:space-between;font-weight:900">
                 <span style="font-size:11px;color:${texto}">Total</span><span style="font-size:12px;color:${acento}">${fmt(total(r))}</span></div>`
            : fila(pares[data.indexOf(r) % pares.length][0], valueLabel || valueKey, r[valueKey] || 0);
          return `<div style="min-width:180px;padding:12px 14px;border-radius:16px;border:1px solid ${linea};background:${oscuro ? "#0f172a" : "#ffffff"};box-shadow:0 12px 32px rgba(98,31,50,0.16)">
            <div style="margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid ${linea};font-size:11px;font-weight:900;letter-spacing:.06em;color:#bc955c">${r.name}</div>
            <div style="display:flex;flex-direction:column;gap:6px">${cuerpo}</div></div>`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((r) => r.name),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          interval: 0, hideOverlap: true, color: texto, fontSize: fs, fontWeight: 700, margin: 8,
          formatter: (v) => (angosto ? ABREVIADO[v] || v : v),
        },
      },
      yAxis: {
        type: "value",
        show: !chico,
        boundaryGap: [0, "10%"],
        splitNumber: 3,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: texto, fontSize: fs, fontWeight: 700, formatter: (v) => abreviarMiles(v) },
        splitLine: { show: !chico, lineStyle: { color: linea, type: [4, 4] } },
      },
      series: [serie("Base", base, 0), serie("Directores", directores, 0), serie("Titulares", titulares, 0)],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, valueKey, valueLabel, pares, gradienteTitular, gradienteDirector, mini, chico, angosto, animar, oscuro]);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;
    chart.on("click", (p) => { const fila = datosRef.current[p.dataIndex]; if (fila) clicRef.current?.(fila); });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => { chartRef.current?.setOption(opcion, { notMerge: true }); }, [opcion]);

  return <div ref={contenedorRef} className="size-full" />;
}
