"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useModoOscuro } from "@/app/dashboard/plantilla_empleados/_components/tabs/cuadros-vacancia/HistoricoLineChart";

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

/**
 * Dona (ECharts) que se ajusta sola al contenedor: el diámetro sale del lado menor del
 * elemento, así que no depende de medir el widget ni de ResponsiveContainer (que colapsaba a
 * 0 al cambiar el tamaño del widget). El contenedor DEBE tener alto y ancho propios.
 *
 * Props: items [{ name, value, color }] (solo los > 0), total (para el % del tooltip),
 * onSliceClick(item) opcional.
 */
export default function DonaEChart({ items, total, onSliceClick }) {
  const contenedorRef = useRef(null);
  const chartRef = useRef(null);
  const oscuro = useModoOscuro();
  const clicRef = useRef(onSliceClick);
  const itemsRef = useRef(items);
  clicRef.current = onSliceClick;
  itemsRef.current = items;

  // El padre recrea `items` (un filter nuevo) en CADA render, y `useElementSize` lo re-renderiza
  // cada vez que cambia el tamaño: si la opción dependiera de la identidad del arreglo, se
  // volvería a llamar a setOption y la animación de entrada arrancaría de nuevo una y otra vez
  // (se veía la dona a medio dibujar, con dos aros desfasados). Solo el CONTENIDO decide.
  const firma = items.map((i) => `${i.name}|${i.value}|${i.color}`).join(",");

  const opcion = useMemo(() => {
    const linea = oscuro ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.18)";
    const texto = oscuro ? "#94a3b8" : "#64748b";
    const fuerte = oscuro ? "#e2e8f0" : "#0f172a";
    return {
      animationDuration: 800,
      animationEasing: "cubicOut",
      textStyle: { fontFamily: "inherit" },
      tooltip: {
        trigger: "item",
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: "transparent",
        extraCssText: "box-shadow:none;",
        formatter: (p) => `<div style="padding:8px 12px;border-radius:12px;border:1px solid ${linea};background:${oscuro ? "#0f172a" : "#ffffff"};box-shadow:0 10px 28px rgba(98,31,50,0.16)">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:${texto}">
            <span style="width:9px;height:9px;border-radius:50%;background:${p.color}"></span>${p.name}</div>
          <div style="margin-top:3px;font-size:13px;font-weight:900;color:${fuerte}">${p.value.toLocaleString("es-MX")}
            <span style="font-size:11px;font-weight:700;color:${texto}"> · ${total ? Math.round((p.value / total) * 100) : 0}%</span></div></div>`,
      },
      series: [{
        type: "pie",
        radius: ["62%", "96%"],
        center: ["50%", "50%"],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: oscuro ? "#0f172a" : "#ffffff", borderWidth: 2 },
        emphasis: { scaleSize: 4, itemStyle: { shadowBlur: 10, shadowColor: "rgba(98,31,50,0.3)" } },
        cursor: onSliceClick ? "pointer" : "default",
        data: itemsRef.current.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, total, oscuro, Boolean(onSliceClick)]);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;
    chart.on("click", (p) => { const it = itemsRef.current[p.dataIndex]; if (it) clicRef.current?.(it); });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);

  useEffect(() => { chartRef.current?.setOption(opcion); }, [opcion]);

  return <div ref={contenedorRef} className="absolute inset-0" />;
}
