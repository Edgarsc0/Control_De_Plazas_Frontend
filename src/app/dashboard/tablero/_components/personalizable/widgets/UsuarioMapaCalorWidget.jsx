"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Activity, ChevronLeft, ChevronRight, Flame, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DayActivityPanel from "@/components/shared/DayActivityPanel";
import { WhitelistService } from "@/services/whitelist.service";
import { VisitsService } from "@/services/visits.service";

gsap.registerPlugin(useGSAP);

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function currentMonthStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}
function buildMonthGrid(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  return cells;
}
function monthLabel(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function intensityClass(seconds) {
  if (!seconds) return "bg-slate-100 dark:bg-slate-800";
  if (seconds < 15 * 60) return "bg-[#621f32]/25";
  if (seconds < 60 * 60) return "bg-[#621f32]/45";
  if (seconds < 3 * 60 * 60) return "bg-[#621f32]/70";
  return "bg-[#621f32]";
}
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function aLista(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

/**
 * Mapa de calor mensual de actividad de un usuario, elegido de la whitelist.
 * Misma fuente (VisitsService) y misma lógica de pintado que la pestaña
 * "Mapa de calor" de UserActivityDialog.jsx (Roles > Usuarios), reducida a lo
 * esencial para caber en una celda del tablero.
 */
export default function UsuarioMapaCalorWidget() {
  const [usuarios, setUsuarios] = useState(null);
  const [email, setEmail] = useState("");
  const [month, setMonth] = useState(currentMonthStr());
  const [data, setData] = useState(null);
  // Mes al que corresponde `data`: mientras no coincida con `month` (fetch en
  // vuelo tras cambiar de mes), no se pintan los días con los datos del mes
  // anterior ni se vuelve a disparar la animación de entrada — evita el
  // doble "parpadeo" de la cuadrícula al cambiar de mes.
  const [dataMonth, setDataMonth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  useEffect(() => {
    WhitelistService.list()
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => {
        const lista = aLista(d);
        setUsuarios(lista);
        if (lista.length) setEmail((prev) => prev || lista[0].email);
      })
      .catch((err) => {
        console.error("Error cargando usuarios para el mapa de calor:", err);
        setUsuarios([]);
      });
  }, []);

  useEffect(() => {
    setDiaSeleccionado(null);
  }, [email, month]);

  useEffect(() => {
    if (!email) return undefined;
    let activo = true;
    const mesSolicitado = month;
    setLoading(true);
    VisitsService.getUserVisitsHeatmap(email, mesSolicitado)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!activo) return;
        setData(d);
        setDataMonth(mesSolicitado);
      })
      .catch((err) => {
        console.error("Error cargando mapa de calor del usuario:", err);
        if (activo) { setData(null); setDataMonth(mesSolicitado); }
      })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [email, month]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const numRows = Math.ceil(cells.length / 7);
  const datosListos = dataMonth === month;
  const dias = datosListos ? (data?.days || {}) : {};
  const nextDisabled = month >= currentMonthStr();

  const gridRef = useRef(null);
  const mostrandoGrid = !(loading && !data);

  // Reanima la cuadrícula cuando cambia el mes, pero solo una vez que `dias`
  // ya corresponde a ese mes (datosListos) — si se dispara con el fetch
  // todavía en vuelo, anima dos veces: una con los días en blanco/mes previo
  // y otra al llegar los datos correctos.
  useGSAP(() => {
    if (!mostrandoGrid || !datosListos) return;
    gsap.fromTo(
      ".dia-celda",
      { opacity: 0, scale: 0.85, y: 6 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: { each: 0.012, from: "start" } }
    );
  }, { scope: gridRef, dependencies: [month, datosListos, mostrandoGrid], revertOnUpdate: true });

  return (
    <div className="w-full h-full flex flex-col p-3 gap-2">
      <div className="shrink-0 flex items-center gap-2">
        <Flame className="size-3.5 text-[#bc955c] shrink-0" />
        {usuarios === null ? (
          <span className="text-[10px] font-bold text-slate-400">Cargando usuarios...</span>
        ) : (
          <Select value={email} onValueChange={setEmail}>
            <SelectTrigger size="sm" className="h-7 flex-1 min-w-0 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold">
              <SelectValue placeholder="Elige un usuario" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.email} className="text-xs">{u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} title="Mes anterior" className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer">
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{monthLabel(month)}</span>
        <button type="button" disabled={nextDisabled} onClick={() => setMonth((m) => shiftMonth(m, 1))} title="Mes siguiente" className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-30 cursor-pointer">
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-1">
        {!mostrandoGrid ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 text-[#621f32] dark:text-[#bc955c] animate-spin" />
          </div>
        ) : (
          <>
            <div className="shrink-0 grid grid-cols-7">
              {WEEKDAY_LABELS.map((w, i) => (
                <div key={`w-${i}`} className="text-center text-[9px] font-bold text-slate-400">{w}</div>
              ))}
            </div>
            <div
              ref={gridRef}
              className="grid grid-cols-7 gap-1 flex-1 min-h-0"
              style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
            >
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`e-${i}`} />;
                const seconds = dias[dateStr] || 0;
                const isFuture = dateStr > todayStr();
                const dayNum = Number(dateStr.slice(8, 10));
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isFuture}
                    onClick={() => setDiaSeleccionado(dateStr)}
                    title={`${dateStr} · ${formatDuration(seconds)}`}
                    className={`dia-celda min-h-0 min-w-0 rounded text-[9px] font-bold flex items-center justify-center transition
                      ${isFuture ? "opacity-20 cursor-not-allowed" : "cursor-pointer hover:ring-2 hover:ring-[#bc955c]"}
                      ${intensityClass(seconds)}
                      ${seconds >= 60 * 60 ? "text-white" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!diaSeleccionado} onOpenChange={(open) => !open && setDiaSeleccionado(null)}>
        <DialogContent className="lg:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="size-5 text-[#621f32]" /> Actividad de {email}
            </DialogTitle>
            <DialogDescription>
              Visitas y distribución de horas del {diaSeleccionado}.
            </DialogDescription>
          </DialogHeader>
          {diaSeleccionado && <DayActivityPanel email={email} date={diaSeleccionado} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
