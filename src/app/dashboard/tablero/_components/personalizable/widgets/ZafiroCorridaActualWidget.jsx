"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-interceptor";
import { CheckCircle2, Loader2, Radio, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useElementSize } from "./useElementSize";
import { useZafiroEnCursoRealtime } from "@/hooks/useZafiroEnCursoRealtime";

function formatDuracion(segundos) {
  if (segundos === null || segundos === undefined) return "—";
  const mins = Math.floor(segundos / 60);
  const secs = Math.round(segundos % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// Cada línea de logs_en_vivo trae "YYYY-MM-DD HH:mm:ss [NIVEL] mensaje" — en
// el espacio de un widget esa fecha completa solo le roba lugar al mensaje
// (lo único que de verdad dice "en qué paso va"), así que se descarta.
const PATRON_LINEA_LOG = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\[(\w+)\]\s*(.*)$/;
const MAX_LINEAS_MOSTRADAS = 5;

/** Últimas `n` líneas no vacías de logs_en_vivo, de la más vieja a la más reciente (orden "de lectura"). */
function parsearUltimasLineas(logsEnVivo, n = MAX_LINEAS_MOSTRADAS) {
  return (logsEnVivo || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-n)
    .map((linea) => {
      const m = linea.match(PATRON_LINEA_LOG);
      return m ? (m[2] || linea) : linea;
    });
}

/**
 * "¿Hay una corrida de ZAFIRO en este momento?" — espejo reducido del bloque
 * "Live Terminal" de monitoreo_zafiro/ClientComponent.jsx: mismo hook de
 * tiempo real (useZafiroEnCursoRealtime, SSE) y la misma lógica de
 * actualización, sin polling.
 */
export default function ZafiroCorridaActualWidget() {
  const [ref, { height }] = useElementSize();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const liveLog = useZafiroEnCursoRealtime();

  const fetchUltimo = async () => {
    try {
      const res = await apiFetch("/plantilla/bitacora/");
      if (res.ok) {
        const data = await res.json();
        setLog(data[0] || null);
      }
    } catch (err) {
      console.error("Error consultando bitácora de ZAFIRO:", err);
    } finally {
      setLoading(false);
    }
  };

  // Única llamada de red por montaje: trae la "última corrida" para mostrar
  // algo mientras no haya nada RUNNING. Las actualizaciones en vivo (inicio,
  // progreso, fin de una corrida) llegan por el SSE de abajo, no por poll.
  useEffect(() => { fetchUltimo(); }, []);

  useEffect(() => {
    if (!liveLog) return;
    setLog((prev) => (prev?.id === liveLog.id ? { ...prev, ...liveLog } : liveLog));
  }, [liveLog]);

  // Cronómetro local (1s) del tiempo transcurrido, para no depender del polling para la sensación "en vivo".
  useEffect(() => {
    if (log?.status !== "RUNNING") return undefined;
    const inicio = parseISO(log.fecha_ejecucion).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - inicio) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [log?.status, log?.fecha_ejecucion]);

  const compacto = height > 0 && height < 140;
  const running = log?.status === "RUNNING";
  // logs_en_vivo es el mismo texto que pinta la "Live Terminal" de
  // monitoreo_zafiro/ClientComponent.jsx (se va concatenando línea por línea
  // conforme corre la tarea de Celery) — mostramos varias, no solo la última,
  // para llenar el espacio del widget con contexto real de lo que ha pasado.
  const lineas = running ? parsearUltimasLineas(log.logs_en_vivo) : [];
  const inicioLabel = running ? format(parseISO(log.fecha_ejecucion), "HH:mm:ss", { locale: es }) : null;

  return (
    <div ref={ref} className="w-full h-full flex flex-col p-3">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
        </div>
      ) : !log ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs font-bold text-slate-400">
          Sin ejecuciones registradas.
        </div>
      ) : running ? (
        <div
          title={[`Inició ${inicioLabel}`, ...lineas].join("\n")}
          className={`flex-1 flex flex-col gap-1.5 rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white p-3.5 overflow-hidden ${compacto ? "justify-center" : ""}`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-white" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono truncate">Sincronización en curso</span>
          </div>
          <div className="flex items-end justify-between gap-2 shrink-0">
            <span className="text-2xl font-black font-mono tabular-nums">{formatDuracion(elapsed)}</span>
            <Radio className="size-5 opacity-70 shrink-0" />
          </div>
          {/* Mini bitácora en vivo: las últimas líneas (no solo la actual) se
              pegan al fondo como una terminal real, con la más reciente
              resaltada y las anteriores cada vez más tenues. Así el espacio
              del widget se llena con contexto real (qué hizo antes) en vez de
              quedar en blanco bajo un único mensaje centrado. */}
          {!compacto && (
            <div className="flex-1 min-h-0 flex flex-col justify-end gap-1 overflow-hidden">
              {lineas.length === 0 ? (
                <p className="text-[10px] font-mono text-white/85">Inició {inicioLabel}</p>
              ) : (
                lineas.map((mensaje, i) => (
                  <p
                    key={i}
                    style={{ opacity: lineas.length === 1 ? 1 : 0.3 + (0.7 * i) / (lineas.length - 1) }}
                    className={`text-[10px] font-mono leading-snug break-words ${i === lineas.length - 1 ? "font-bold line-clamp-3" : "line-clamp-1"}`}
                  >
                    » {mensaje}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={`flex-1 flex flex-col ${compacto ? "justify-center gap-1.5" : "justify-between"} rounded-xl border p-3.5 ${log.status === "EXITO" ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/25 bg-red-500/5"}`}>
          <div className="flex items-center gap-2">
            {log.status === "EXITO" ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest font-mono text-slate-500 dark:text-slate-400 truncate">
              Sin corrida en curso
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Última: {log.status === "EXITO" ? "Éxito" : "Error"} · {formatDuracion(log.duracion_segundos)}
            </p>
            {!compacto && (
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {format(parseISO(log.fecha_ejecucion), "dd MMM yyyy, HH:mm", { locale: es })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
