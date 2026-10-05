"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-interceptor";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const LIMITE = 30;
const POLL_MS = 20000;

function Badge({ status }) {
  if (status === "EXITO") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-2.5" /> OK
    </span>
  );
  if (status === "RUNNING") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400">
      <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" /> LIVE
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400">
      <XCircle className="size-2.5" /> ERR
    </span>
  );
}

/** Historial de ejecuciones de ZAFIRO, versión compacta de la grilla de monitoreo_zafiro/ClientComponent.jsx. */
export default function ZafiroBitacoraWidget() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (showLoading) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch("/plantilla/bitacora/");
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Error cargando bitácora de ZAFIRO:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
    const interval = setInterval(() => fetchLogs(false), POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const visibles = logs.slice(0, LIMITE);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
          Últimas {Math.min(LIMITE, logs.length)} de {logs.length}
        </span>
        <RefreshCw className={`size-3 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-5 text-[#621f32] dark:text-[#bc955c] animate-spin" />
          </div>
        ) : visibles.length === 0 ? (
          <p className="h-full flex items-center justify-center text-xs font-bold text-slate-400">Sin ejecuciones.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {visibles.map((log) => (
                <tr key={log.id} className="text-xs hover:bg-slate-50/70 dark:hover:bg-slate-900/30" title={log.error_message || undefined}>
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{format(parseISO(log.fecha_ejecucion), "dd MMM", { locale: es })}</div>
                    <div className="text-[9px] font-mono text-slate-400">{format(parseISO(log.fecha_ejecucion), "HH:mm")}</div>
                  </td>
                  <td className="py-1.5 px-3"><Badge status={log.status} /></td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {log.duracion_segundos ? `${log.duracion_segundos}s` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
