'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '@/lib/fetch-interceptor';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import {
  Activity, Clock, Database, CheckCircle2, XCircle,
  RefreshCw, Terminal, Cpu, Zap,
  ShieldCheck, BarChart3, GitBranch, Layers,
  Filter, ChevronLeft, ChevronRight, Check,
  LayoutDashboard, Timer, TrendingDown, X, ScrollText,
  Trash2, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

/* ─────────────────────────── helpers ─────────────────────────── */
function StatusBadge({ status, errorMessage }) {
  if (status === 'EXITO') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
      <CheckCircle2 className="size-3" /> OK
    </span>
  );
  if (status === 'RUNNING') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono">
      <span className="size-1.5 rounded-full bg-sky-500 animate-pulse inline-block" />
      LIVE
    </span>
  );
  return (
    <span title={errorMessage} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 font-mono cursor-help">
      <XCircle className="size-3" /> ERR
    </span>
  );
}

function formatDuracion(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const mins = Math.floor(segundos / 60);
  const secs = Math.round(segundos % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function DuracionTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const { duracion_promedio_segundos, total_casos } = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/65 dark:border-slate-800 rounded-2xl p-4 shadow-xl shadow-[#621f32]/10 dark:shadow-black/45 min-w-[170px]">
      <p className="font-extrabold text-xs text-[#621f32] dark:text-[#bc955c] mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 tracking-wider">
        {label}
      </p>
      <div className="flex justify-between items-center gap-4 mb-1.5">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Duración promedio</span>
        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{formatDuracion(duracion_promedio_segundos)}</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Casos exitosos</span>
        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{total_casos}</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-5 py-4 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
    >
      <span className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 pointer-events-none" style={{ background: accent }} />
      <span className="shrink-0 flex items-center justify-center size-10 rounded-xl border border-slate-150 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950" style={{ background: `${accent}18` }}>
        <Icon className="size-5" style={{ color: accent }} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate font-mono">{label}</p>
        <p className="text-xl font-black text-slate-850 dark:text-slate-100 mt-0.5 font-mono">{value ?? '—'}</p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── main ─────────────────────────── */
export default function ClientComponent() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const terminalEndRef = useRef(null);

  // Duración promedio por hora (solo casos exitosos)
  const [duracionPorHora, setDuracionPorHora] = useState([]);
  const [loadingDuracion, setLoadingDuracion] = useState(true);
  
  // Pagination & Filtering state
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const dropdownRef = useRef(null);

  // Manual Synchronization states
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Detalle de logs/errores de una sincronización (modal)
  const [selectedLog, setSelectedLog] = useState(null);

  // Invalidación manual de caché del servidor
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState(null);
  const [cacheResult, setCacheResult] = useState(null);

  useBodyScrollLock(showSyncConfirm || showCacheConfirm || !!selectedLog);

  const getMinutesToNextSync = () => {
    const now = new Date();
    const currentMinute = now.getMinutes();
    let remainingMinutes;
    if (currentMinute < 30) {
      remainingMinutes = 30 - currentMinute;
    } else {
      remainingMinutes = 60 - currentMinute;
    }
    return remainingMinutes;
  };

  const minutesToNextSync = useMemo(() => {
    if (!showSyncConfirm) return 0;
    return getMinutesToNextSync();
  }, [showSyncConfirm]);

  const handleManualSyncClick = () => {
    setSyncError(null);
    setShowSyncConfirm(true);
  };

  const handleConfirmSync = async () => {
    setSyncLoading(true);
    setSyncError(null);
    try {
      const response = await apiFetch('/plantilla/bitacora/iniciar/', {
        method: 'POST',
      });
      if (response.ok) {
        setShowSyncConfirm(false);
        fetchLogs(false);
      } else {
        const errData = await response.json();
        setSyncError(errData.error || 'Error al iniciar la sincronización.');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      setSyncError('Error de red al conectar con el servidor.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleClearCacheClick = () => {
    setCacheError(null);
    setCacheResult(null);
    setShowCacheConfirm(true);
  };

  const handleConfirmClearCache = async () => {
    setCacheLoading(true);
    setCacheError(null);
    try {
      const response = await apiFetch('/plantilla/bitacora/invalidar-cache-manual/', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setCacheResult(data.cache_keys_borradas);
      } else {
        const errData = await response.json();
        setCacheError(errData.error || 'Error al borrar la caché del servidor.');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheError('Error de red al conectar con el servidor.');
    } finally {
      setCacheLoading(false);
    }
  };

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) { setLoading(true); }
    else { setRefreshing(true); }
    try {
      const response = await apiFetch(`/plantilla/bitacora/?limit=500`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDuracionPorHora = async () => {
    setLoadingDuracion(true);
    try {
      const response = await apiFetch('/plantilla/bitacora/duracion-promedio-por-hora/');
      if (response.ok) {
        const data = await response.json();
        setDuracionPorHora(data.map(d => ({
          ...d,
          horaLabel: `${String(d.hora).padStart(2, '0')}:00`,
        })));
      }
    } catch (error) {
      console.error('Error fetching duración por hora:', error);
    } finally {
      setLoadingDuracion(false);
    }
  };

  useEffect(() => { fetchLogs(); fetchDuracionPorHora(); }, []);

  // Refetch la gráfica de duración en cuanto una sincronización termina (RUNNING -> EXITO/ERROR)
  const prevStatusRef = useRef(null);
  useEffect(() => {
    const currentStatus = logs[0]?.status ?? null;
    if (prevStatusRef.current === 'RUNNING' && currentStatus !== 'RUNNING') {
      fetchDuracionPorHora();
    }
    prevStatusRef.current = currentStatus;
  }, [logs]);

  useEffect(() => {
    let interval;
    if (logs.length > 0 && logs[0].status === 'RUNNING') {
      interval = setInterval(() => fetchLogs(false), 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [logs]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const horaMasLenta = useMemo(() => {
    return duracionPorHora.reduce((peak, d) => {
      if (d.duracion_promedio_segundos == null) return peak;
      if (!peak || d.duracion_promedio_segundos > peak.duracion_promedio_segundos) return d;
      return peak;
    }, null);
  }, [duracionPorHora]);

  const horaMasRapida = useMemo(() => {
    return duracionPorHora.reduce((valle, d) => {
      if (d.duracion_promedio_segundos == null) return valle;
      if (!valle || d.duracion_promedio_segundos < valle.duracion_promedio_segundos) return d;
      return valle;
    }, null);
  }, [duracionPorHora]);

  const activeLog = logs.length > 0 && logs[0].status === 'RUNNING' ? logs[0] : null;
  const lastSuccess = logs.find(l => l.status === 'EXITO');
  const totalRecs = lastSuccess
    ? ((lastSuccess.registros_completos || 0) + (lastSuccess.registros_bajas || 0) + (lastSuccess.registros_posiciones || 0) + (lastSuccess.registros_historial || 0))
    : null;

  // Filter Data
  const filteredData = useMemo(() => {
    let result = [...logs];
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter(log => {
          let cellValue;
          if (key === 'fecha') {
            cellValue = format(parseISO(log.fecha_ejecucion), "dd MMM yyyy", { locale: es });
          } else if (key === 'status') {
            cellValue = log.status;
          } else if (key === 'historico') {
            cellValue = log.es_historico ? 'SAVED' : '—';
          }
          return values.includes(cellValue);
        });
      }
    });
    return result;
  }, [logs, columnFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, pageSize]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const uniqueColumnValues = useMemo(() => {
    const uniques = { fecha: new Set(), status: new Set(), historico: new Set() };
    logs.forEach(log => {
      uniques.fecha.add(format(parseISO(log.fecha_ejecucion), "dd MMM yyyy", { locale: es }));
      uniques.status.add(log.status);
      uniques.historico.add(log.es_historico ? 'SAVED' : '—');
    });
    return {
      fecha: Array.from(uniques.fecha),
      status: Array.from(uniques.status).sort(),
      historico: Array.from(uniques.historico).sort()
    };
  }, [logs]);

  const toggleFilter = (colKey, value) => {
    const current = columnFilters[colKey] || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    const newFilters = { ...columnFilters };
    if (next.length === 0) delete newFilters[colKey];
    else newFilters[colKey] = next;
    setColumnFilters(newFilters);
  };

  const clearFilter = (colKey) => {
    const newFilters = { ...columnFilters };
    delete newFilters[colKey];
    setColumnFilters(newFilters);
    setActiveFilterDropdown(null);
  };

  const TableHeader = ({ label, filterKey }) => (
    <th className="relative py-3 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#bc955c] font-mono border-r border-[#621f32]/20 whitespace-nowrap">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {filterKey && (
          <button
            onClick={() => setActiveFilterDropdown(activeFilterDropdown === filterKey ? null : filterKey)}
            className={`p-1 rounded transition-colors ${columnFilters[filterKey] ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
          >
            <Filter className="size-3" />
          </button>
        )}
      </div>
      
      {/* Excel-like Filter Dropdown */}
      {activeFilterDropdown === filterKey && (
        <div ref={dropdownRef} className="absolute left-4 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50 overflow-hidden font-sans normal-case tracking-normal text-slate-700 dark:text-slate-200">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-xs font-bold">Filtrar {label}</span>
            <button onClick={() => clearFilter(filterKey)} className="text-[10px] font-bold text-red-500 hover:text-red-700 dark:hover:text-red-400">Limpiar</button>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            {uniqueColumnValues[filterKey].map(val => {
              const isChecked = (columnFilters[filterKey] || []).includes(val);
              return (
                <label key={val} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    onChange={() => toggleFilter(filterKey, val)}
                  />
                  <div className={`flex items-center justify-center size-4 rounded border ${isChecked ? 'bg-[#621f32] border-[#621f32] dark:bg-[#bc955c] dark:border-[#bc955c]' : 'border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                    {isChecked && <Check className="size-3 text-white dark:text-[#3e131f]" />}
                  </div>
                  <span className="text-xs truncate">{val}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </th>
  );

  return (
    <section className="bg-transparent relative min-h-screen overflow-hidden pb-20">
      {/* Decorative background blurs */}
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      <div className="mx-auto w-full max-w-screen-xl flex flex-col px-4 lg:px-6 pt-4 gap-6">
        
        {/* ── Breadcrumbs ── */}
        <div className="flex items-center">
          <nav className="flex text-sm font-medium" aria-label="Breadcrumb">
            <ol className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md">
              <li className="inline-flex items-center text-gray-400">
                <Link href="/dashboard" className="inline-flex items-center text-xs hover:text-[#621f32] dark:hover:text-[#bc955c] transition-colors duration-200">
                  <LayoutDashboard className="size-3.5 mr-1.5" />
                  Dashboard
                </Link>
              </li>
              <li>
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 text-gray-300 dark:text-gray-650" />
                  <span className="text-[#621f32] dark:text-[#bc955c] font-black uppercase tracking-wider text-[10px]">
                    Monitoreo ZAFIRO
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* ── Header Banner ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/30 dark:shadow-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#621f32]/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#bc955c]/5 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative group flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-[#621f32] to-[#bc955c] rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500" />
                <div className="relative p-3 bg-white dark:bg-gray-900 border border-white dark:border-gray-800 rounded-2xl shadow-sm">
                  <Activity className="size-7 text-[#621f32] dark:text-[#bc955c]" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.15em] text-[#8b6914] font-mono px-2 py-0.5 rounded border border-[#bc955c]/35 bg-[#bc955c]/10">
                    <Cpu className="size-3" /> SYS:MONITOR
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-950 dark:text-white tracking-tight">
                  Monitoreo <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#621f32] to-[#bc955c]">ZAFIRO</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-mono mt-0.5">
                  // Bitácora de sincronización automática &mdash; Plantilla y Estructura
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <button
                onClick={handleManualSyncClick}
                disabled={loading || !!activeLog}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider bg-gradient-to-r from-[#621f32] to-[#bc955c] text-white shadow-md active:scale-95 hover:opacity-95 transition-all duration-300 disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
              >
                <Zap className="size-3.5" />
                ARRANCAR SINCRONIZACIÓN MANUAL
              </button>
              
              <button
                onClick={() => { fetchLogs(true); fetchDuracionPorHora(); }}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-650 dark:text-slate-300 hover:text-[#621f32] dark:hover:text-[#bc955c] shadow-sm hover:shadow active:scale-95 transition-all duration-300 disabled:opacity-40"
              >
                <RefreshCw className={`size-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
                REFRESH
              </button>

              <button
                onClick={handleClearCacheClick}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 shadow-sm hover:shadow active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                BORRAR CACHÉ DEL SERVIDOR
              </button>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="Ejecuciones"
              value={logs.length}
              accent="#bc955c"
            />
            <StatCard
              icon={ShieldCheck}
              label="Último estado"
              value={logs[0]?.status}
              accent={logs[0]?.status === 'EXITO' ? '#10b981' : logs[0]?.status === 'RUNNING' ? '#0ea5e9' : '#f43f5e'}
            />
            <StatCard
              icon={Zap}
              label="Duración (última)"
              value={lastSuccess?.duracion_segundos ? `${lastSuccess.duracion_segundos}s` : '—'}
              accent="#621f32"
            />
            <StatCard
              icon={Layers}
              label="Registros (última)"
              value={totalRecs?.toLocaleString() ?? '—'}
              accent="#10b981"
            />
          </div>
        )}

        {/* ── Duración promedio por hora (solo casos exitosos) ── */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-lg bg-white dark:bg-slate-950 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 dark:border-slate-800 shadow-sm">
                <Timer className="size-4 text-[#bc955c]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Duración Promedio por Hora</h3>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">Solo casos exitosos (EXITO), agrupados por hora de ejecución</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {horaMasRapida && (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                  <span className="flex items-center justify-center size-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <TrendingDown className="size-3.5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">Hora más rápida</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
                      {horaMasRapida.horaLabel} &mdash; {formatDuracion(horaMasRapida.duracion_promedio_segundos)} promedio
                    </p>
                  </div>
                </div>
              )}
              {horaMasLenta && (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-amber-500/25 bg-amber-500/10">
                  <span className="flex items-center justify-center size-6 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <Zap className="size-3.5" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">Hora más lenta</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
                      {horaMasLenta.horaLabel} &mdash; {formatDuracion(horaMasLenta.duracion_promedio_segundos)} promedio
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loadingDuracion ? (
            <div className="h-72 flex items-center justify-center">
              <RefreshCw className="size-8 animate-spin text-[#bc955c]/60" />
            </div>
          ) : duracionPorHora.length === 0 ? (
            <div className="h-72 flex items-center justify-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">Sin datos suficientes para graficar.</p>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={duracionPorHora} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis
                    dataKey="horaLabel"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    stroke="currentColor"
                    className="text-slate-400 dark:text-slate-500"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    stroke="currentColor"
                    className="text-slate-400 dark:text-slate-500"
                    tickFormatter={(v) => formatDuracion(v)}
                    width={70}
                  />
                  <Tooltip content={<DuracionTooltip />} cursor={{ stroke: '#621f32', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Line
                    type="linear"
                    dataKey="duracion_promedio_segundos"
                    stroke="#621f32"
                    strokeWidth={2.5}
                    connectNulls
                    dot={({ cx, cy, payload, index }) => {
                      const isPeak = payload.hora === horaMasLenta?.hora;
                      const isValle = payload.hora === horaMasRapida?.hora;
                      const color = isPeak ? '#d97706' : isValle ? '#059669' : '#bc955c';
                      const r = isPeak || isValle ? 6 : 4;
                      return (
                        <circle key={`dot-${index}`} cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={1.5} />
                      );
                    }}
                    activeDot={{ r: 7, fill: '#621f32', stroke: '#fff', strokeWidth: 2 }}
                  >
                    <LabelList
                      dataKey="duracion_promedio_segundos"
                      position="top"
                      content={({ x, y, value, index }) => {
                        const hora = duracionPorHora[index]?.hora;
                        const isPeak = hora === horaMasLenta?.hora;
                        const isValle = hora === horaMasRapida?.hora;
                        if (!isPeak && !isValle) return null;
                        if (value == null) return null;
                        return (
                          <text
                            x={x}
                            y={y - 12}
                            textAnchor="middle"
                            fontSize={11}
                            className={`font-mono font-black ${isPeak ? 'fill-amber-600 dark:fill-amber-400' : 'fill-emerald-600 dark:fill-emerald-400'}`}
                          >
                            {formatDuracion(value)}
                          </text>
                        );
                      }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Live Terminal ── */}
        <AnimatePresence>
          {activeLog && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/80 shadow-lg"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 hover:scale-110 transition-transform" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400/80 hover:scale-110 transition-transform" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-slate-400 font-mono text-xs select-none ml-2">zafiro@sync:~</span>
                  <span className="text-slate-650 font-mono text-xs select-none">|</span>
                  <Terminal className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-xs tracking-wider select-none font-bold">sincronización en curso</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-[0.2em] font-mono select-none">LIVE</span>
                </div>
              </div>
              <div className="relative overflow-hidden bg-slate-950">
                <div
                  className="pointer-events-none absolute inset-0 z-10 opacity-[0.02]"
                  style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }}
                />
                <div
                  className="p-6 font-mono text-sm text-emerald-400 overflow-y-auto max-h-85 whitespace-pre-wrap leading-relaxed relative z-0"
                  style={{ textShadow: '0 0 6px rgba(52,211,153,0.3)' }}
                >
                  <span className="text-slate-600 select-none">$ </span>
                  {activeLog.logs_en_vivo || 'Iniciando conexión con el Worker de Celery...'}
                  <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 align-middle animate-pulse opacity-80" />
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Data Grid (Execution History) ── */}
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 overflow-visible shadow-lg bg-white dark:bg-slate-950 flex flex-col">
          {/* Grid header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 dark:border-slate-800 shadow-sm">
                <Database className="size-4 text-[#bc955c]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Historial de Ejecuciones</h3>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">Mostrando {filteredData.length} de {logs.length} registros</p>
              </div>
            </div>
            {refreshing && (
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-bold tracking-widest animate-pulse px-3 py-1 bg-sky-50 dark:bg-sky-950/20 rounded-full border border-sky-100 dark:border-sky-900/50">ACTUALIZANDO...</span>
            )}
          </div>

          {/* Pagination Controls (Top) */}
          {!loading && logs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Filas por página:</span>
                <div className="flex gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-sm">
                  {[10, 25, 50, 100].map(size => (
                    <button
                      key={size}
                      onClick={() => setPageSize(size)}
                      className={`px-3 py-1 rounded-md text-xs font-black transition-all ${pageSize === size ? 'bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] shadow' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="px-3 flex items-center">
                  <span className="text-xs font-semibold text-slate-400">Página</span>
                  <span className="mx-2 text-sm font-black text-[#621f32] dark:text-[#bc955c]">{currentPage}</span>
                  <span className="text-xs font-semibold text-slate-400">de {totalPages}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {loading && logs.length === 0 ? (
            <div className="py-32 flex flex-col items-center gap-4">
              <div className="relative size-12">
                <span className="absolute inset-0 rounded-full border-2 border-[#bc955c]/30 animate-ping" />
                <RefreshCw className="size-12 animate-spin text-[#bc955c]/60" />
              </div>
              <span className="text-xs font-mono text-slate-450 dark:text-slate-500 tracking-widest mt-2">OBTENIENDO BITÁCORA...</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#621f32]/20 bg-[#501929] dark:bg-[#3e131f]">
                      <TableHeader label="Timestamp" filterKey="fecha" />
                      <TableHeader label="Status" filterKey="status" />
                      <TableHeader label="Duración" />
                      <TableHeader label="Completos" />
                      <TableHeader label="Bajas" />
                      <TableHeader label="Posiciones" />
                      <TableHeader label="Historial Pos." />
                      <TableHeader label="Histórico" filterKey="historico" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-20 text-center">
                          <div className="inline-flex items-center justify-center size-12 rounded-full bg-slate-50 dark:bg-slate-900 mb-3">
                            <Filter className="size-5 text-slate-350 dark:text-slate-650" />
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Sin coincidencias</p>
                          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Intenta ajustando los filtros de búsqueda</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((log) => (
                        <motion.tr
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors group cursor-pointer"
                        >
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 whitespace-nowrap border-r border-slate-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center justify-center size-7 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 transition-all">
                                <GitBranch className="size-3.5 text-[#bc955c]" />
                              </div>
                              <div>
                                <div className="font-sans text-xs font-bold text-slate-700 dark:text-slate-200">
                                  {format(parseISO(log.fecha_ejecucion), "dd MMM yyyy", { locale: es })}
                                </div>
                                <div className="font-mono text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock className="size-2.5" />
                                  {format(parseISO(log.fecha_ejecucion), "HH:mm:ss")}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50">
                            <StatusBadge status={log.status} errorMessage={log.error_message} />
                          </td>

                          {/* Duration */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50">
                            <span className="font-mono text-xs text-slate-650 dark:text-slate-350 font-semibold">
                              {log.duracion_segundos
                                ? <>{log.duracion_segundos} <span className="text-slate-400 dark:text-slate-600 text-[10px]">s</span></>
                                : <span className="text-slate-300 dark:text-slate-700">—</span>}
                            </span>
                          </td>

                          {/* Completos */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50 font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {(log.registros_completos || 0).toLocaleString()}
                          </td>

                          {/* Bajas */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50 font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {(log.registros_bajas || 0).toLocaleString()}
                          </td>

                          {/* Posiciones */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50 font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {(log.registros_posiciones || 0).toLocaleString()}
                          </td>

                          {/* Historial Posición */}
                          <td className="py-3.5 px-4 border-r border-slate-100 dark:border-slate-800/50 font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {(log.registros_historial || 0).toLocaleString()}
                          </td>

                          {/* Histórico */}
                          <td className="py-3.5 px-4">
                            {log.es_historico ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border border-[#bc955c]/30 bg-[#bc955c]/5 text-[#8b6914] dark:text-[#bc955c] font-mono">
                                <Database className="size-3" /> SAVED
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 font-mono text-xs pl-4">—</span>
                            )}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showSyncConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSyncConfirm(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            
            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl z-10"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center size-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-4 animate-bounce">
                  <Zap className="size-6" />
                </div>
                
                <h3 className="text-base font-black text-slate-850 dark:text-white uppercase tracking-wider font-mono">
                  ¿Arrancar Sincronización Manual?
                </h3>
                
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-2 leading-relaxed w-full">
                  <p>
                    Estás a punto de iniciar una descarga e importación manual de datos de <strong>ZAFIRO</strong>.
                  </p>
                  <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400 font-mono text-[11px] text-left">
                    <span className="font-bold">⚠️ ADVERTENCIA:</span> Por favor considera que la próxima sincronización automática ocurrirá dentro de <span className="font-bold text-base px-1.5 py-0.5 bg-amber-500/10 rounded">{minutesToNextSync}</span> {minutesToNextSync === 1 ? 'minuto' : 'minutos'} (se realizan a los minutos :00 y :30 de cada hora).
                  </div>
                  {syncError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-mono text-[10px] text-left">
                      {syncError}
                    </div>
                  )}
                  <p>
                    ¿Seguro que deseas proceder con la sincronización ahora?
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full mt-6">
                  <button
                    onClick={() => setShowSyncConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-550 dark:text-slate-400 transition-all cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleConfirmSync}
                    disabled={syncLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider bg-[#621f32] text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {syncLoading ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        INICIANDO...
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        SÍ, CONFIRMO
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal — Borrar caché */}
      <AnimatePresence>
        {showCacheConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCacheConfirm(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl z-10"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-4">
                  <AlertTriangle className="size-6" />
                </div>

                <h3 className="text-base font-black text-slate-850 dark:text-white uppercase tracking-wider font-mono">
                  ¿Borrar Caché del Servidor?
                </h3>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-2 leading-relaxed w-full">
                  <p>
                    Estás a punto de borrar <strong>toda la caché</strong> del servidor.
                  </p>
                  <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400 font-mono text-[11px] text-left">
                    <span className="font-bold">⚠️ ADVERTENCIA:</span> Los siguientes requests de cualquier usuario podrían ralentizarse temporalmente, ya que el sistema tendrá que recalcular y regenerar la caché desde cero con datos frescos.
                  </div>
                  {cacheError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-mono text-[10px] text-left">
                      {cacheError}
                    </div>
                  )}
                  {cacheResult !== null && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-mono text-[10px] text-left">
                      Caché borrada: {cacheResult} keys eliminadas.
                    </div>
                  )}
                  <p>
                    ¿Seguro que deseas proceder?
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full mt-6">
                  <button
                    onClick={() => setShowCacheConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold font-mono tracking-wider border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-550 dark:text-slate-400 transition-all cursor-pointer"
                  >
                    {cacheResult !== null ? 'CERRAR' : 'CANCELAR'}
                  </button>
                  {cacheResult === null && (
                    <button
                      onClick={handleConfirmClearCache}
                      disabled={cacheLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider bg-red-600 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {cacheLoading ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          BORRANDO...
                        </>
                      ) : (
                        <>
                          <Trash2 className="size-3.5" />
                          SÍ, BORRAR
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de logs/errores de la sincronización seleccionada */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center size-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 shrink-0">
                    <ScrollText className="size-4 text-[#bc955c]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                      Detalle de sincronización
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      {format(parseISO(selectedLog.fecha_ejecucion), "dd MMM yyyy, HH:mm:ss", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={selectedLog.status} errorMessage={selectedLog.error_message} />
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Resumen rápido */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Duración</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono mt-0.5">{formatDuracion(selectedLog.duracion_segundos)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Completos</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono mt-0.5">{(selectedLog.registros_completos || 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Bajas</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono mt-0.5">{(selectedLog.registros_bajas || 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Posiciones</p>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono mt-0.5">{(selectedLog.registros_posiciones || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Error message */}
                {selectedLog.error_message && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 dark:text-red-400 font-mono mb-1.5 flex items-center gap-1.5">
                      <XCircle className="size-3" /> Error
                    </p>
                    <div className="p-3.5 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 font-mono text-[11px] whitespace-pre-wrap break-words leading-relaxed">
                      {selectedLog.error_message}
                    </div>
                  </div>
                )}

                {/* Logs en vivo / detallados */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mb-1.5 flex items-center gap-1.5">
                    <Terminal className="size-3" /> Logs
                  </p>
                  {selectedLog.logs_en_vivo ? (
                    <div className="p-4 bg-slate-950 rounded-xl font-mono text-[11px] text-emerald-400 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
                      {selectedLog.logs_en_vivo}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 text-xs font-mono">
                      Sin logs registrados para esta ejecución.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
