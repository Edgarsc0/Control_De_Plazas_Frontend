'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '@/lib/fetch-interceptor';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, Database, CheckCircle2, XCircle,
  RefreshCw, Terminal, Cpu, Zap,
  ShieldCheck, BarChart3, GitBranch, Layers,
  Filter, ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ─────────────────────────── helpers ─────────────────────────── */
function StatusBadge({ status, errorMessage }) {
  if (status === 'EXITO') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase border border-emerald-600/40 bg-emerald-50 text-emerald-700 font-mono">
      <CheckCircle2 className="size-3" /> OK
    </span>
  );
  if (status === 'RUNNING') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase border border-sky-500/40 bg-sky-50 text-sky-700 font-mono">
      <span className="size-1.5 rounded-full bg-sky-500 animate-pulse inline-block" />
      LIVE
    </span>
  );
  return (
    <span title={errorMessage} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-widest uppercase border border-red-400/40 bg-red-50 text-red-700 font-mono cursor-help">
      <XCircle className="size-3" /> ERR
    </span>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 overflow-hidden shadow-sm"
    >
      <span className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 pointer-events-none" style={{ background: accent }} />
      <span className="shrink-0 flex items-center justify-center size-10 rounded-lg border border-slate-100" style={{ background: `${accent}18` }}>
        <Icon className="size-5" style={{ color: accent }} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate font-mono">{label}</p>
        <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">{value ?? '—'}</p>
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
  
  // Pagination & Filtering state
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const dropdownRef = useRef(null);

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

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    let interval;
    if (logs.length > 0 && logs[0].status === 'RUNNING') {
      interval = setInterval(() => fetchLogs(false), 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [logs]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs?.[0]?.logs_en_vivo]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLog = logs.length > 0 && logs[0].status === 'RUNNING' ? logs[0] : null;
  const lastSuccess = logs.find(l => l.status === 'EXITO');
  const totalRecs = lastSuccess
    ? ((lastSuccess.registros_completos || 0) + (lastSuccess.registros_bajas || 0) + (lastSuccess.registros_posiciones || 0))
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
    <th className="relative py-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-mono whitespace-nowrap group">
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {filterKey && (
          <button
            onClick={() => setActiveFilterDropdown(activeFilterDropdown === filterKey ? null : filterKey)}
            className={`p-1 rounded transition-colors ${columnFilters[filterKey] ? 'bg-[#bc955c]/20 text-[#bc955c]' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-200'}`}
          >
            <Filter className="size-3" />
          </button>
        )}
      </div>
      
      {/* Excel-like Filter Dropdown */}
      {activeFilterDropdown === filterKey && (
        <div ref={dropdownRef} className="absolute left-4 top-full mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden font-sans normal-case tracking-normal">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700">Filtrar {label}</span>
            <button onClick={() => clearFilter(filterKey)} className="text-[10px] font-bold text-red-500 hover:text-red-700">Limpiar</button>
          </div>
          <div className="max-h-48 overflow-y-auto p-2">
            {uniqueColumnValues[filterKey].map(val => {
              const isChecked = (columnFilters[filterKey] || []).includes(val);
              return (
                <label key={val} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    onChange={() => toggleFilter(filterKey, val)}
                  />
                  <div className={`flex items-center justify-center size-4 rounded border ${isChecked ? 'bg-[#bc955c] border-[#bc955c]' : 'border-slate-300 bg-white'}`}>
                    {isChecked && <Check className="size-3 text-white" />}
                  </div>
                  <span className="text-xs text-slate-600 truncate">{val}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </th>
  );

  return (
    <div className="min-h-screen px-6 py-4 lg:px-52 lg:py-6 text-slate-800 bg-slate-50/30" style={{ fontFamily: "'Noto Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b6914] font-mono px-2 py-0.5 rounded border border-[#bc955c]/40 bg-[#bc955c]/10">
              <Cpu className="size-3" /> SYS:MONITOR
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Activity className="size-8 text-[#bc955c]" />
            Monitoreo <span className="text-[#9a7a3a]">ZAFIRO</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-mono tracking-wide">
            // Bitácora de sincronización &mdash; Plantilla &amp; Estructura
          </p>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={loading}
          suppressHydrationWarning
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold font-mono tracking-wider border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#bc955c]/50 text-slate-600 hover:text-slate-900 shadow-sm transition-all duration-200 disabled:opacity-40"
        >
          <RefreshCw className={`size-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* ── Stat cards ── */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
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
            accent={logs[0]?.status === 'EXITO' ? '#059669' : logs[0]?.status === 'RUNNING' ? '#0284c7' : '#dc2626'}
          />
          <StatCard
            icon={Zap}
            label="Duración (última)"
            value={lastSuccess?.duracion_segundos ? `${lastSuccess.duracion_segundos}s` : '—'}
            accent="#7c3aed"
          />
          <StatCard
            icon={Layers}
            label="Registros (última)"
            value={totalRecs?.toLocaleString() ?? '—'}
            accent="#059669"
          />
        </div>
      )}

      {/* ── Live Terminal ── */}
      <AnimatePresence>
        {activeLog && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="rounded-xl overflow-hidden border border-slate-200 shadow-md"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700" style={{ background: '#1e2a38' }}>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-slate-400 font-mono text-xs">zafiro@sync:~</span>
                <span className="text-slate-600 font-mono text-xs">|</span>
                <Terminal className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-xs tracking-wider">sincronización en curso</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-[0.2em] font-mono">LIVE</span>
              </div>
            </div>
            <div className="relative overflow-hidden" style={{ background: '#0f1923' }}>
              <div
                className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }}
              />
              <div
                className="p-5 font-mono text-sm text-emerald-300 overflow-y-auto max-h-80 whitespace-pre-wrap leading-relaxed relative z-0"
                style={{ textShadow: '0 0 8px rgba(52,211,153,0.35)' }}
              >
                <span className="text-slate-500 select-none">$ </span>
                {activeLog.logs_en_vivo || 'Iniciando conexión con el Worker de Celery...'}
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 align-middle animate-pulse opacity-80" />
                <div ref={terminalEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Data grid ── */}
      <div className="rounded-2xl border border-slate-200 overflow-visible shadow-lg shadow-slate-200/50 bg-white flex flex-col">
        {/* Grid header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <Database className="size-4 text-[#bc955c]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Historial de Ejecuciones</h3>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">Mostrando {filteredData.length} de {logs.length} registros</p>
            </div>
          </div>
          {refreshing && (
            <span className="text-[10px] text-sky-600 font-mono font-bold tracking-widest animate-pulse px-3 py-1 bg-sky-50 rounded-full border border-sky-100">ACTUALIZANDO...</span>
          )}
        </div>

        {/* Pagination Controls (Top) */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-b border-slate-100 bg-white gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Filas por página:</span>
              <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {[10, 25, 50, 100].map(size => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${pageSize === size ? 'bg-[#621f32] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="px-3 flex items-center">
                <span className="text-xs font-bold text-slate-500">Página</span>
                <span className="mx-2 text-sm font-black text-[#621f32]">{currentPage}</span>
                <span className="text-xs font-bold text-slate-400">de {totalPages}</span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-30 transition-all"
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
            <span className="text-xs font-mono text-slate-400 tracking-widest mt-2">OBTENIENDO BITÁCORA...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50">
                    <TableHeader label="Timestamp" filterKey="fecha" />
                    <TableHeader label="Status" filterKey="status" />
                    <TableHeader label="Duración" />
                    <TableHeader label="Completos" />
                    <TableHeader label="Bajas" />
                    <TableHeader label="Posiciones" />
                    <TableHeader label="Histórico" filterKey="historico" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-20 text-center">
                        <div className="inline-flex items-center justify-center size-12 rounded-full bg-slate-50 mb-3">
                          <Filter className="size-5 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold text-sm">Sin coincidencias</p>
                        <p className="text-slate-400 text-xs mt-1">Intenta ajustando los filtros de búsqueda</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((log, idx) => (
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        key={log.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center size-7 rounded-lg bg-slate-100 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                              <GitBranch className="size-3.5 text-[#bc955c]" />
                            </div>
                            <div>
                              <div className="font-sans text-sm font-bold text-slate-700">
                                {format(parseISO(log.fecha_ejecucion), "dd MMM yyyy", { locale: es })}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="size-2.5" />
                                {format(parseISO(log.fecha_ejecucion), "HH:mm:ss")}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <StatusBadge status={log.status} errorMessage={log.error_message} />
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-slate-600 font-medium">
                            {log.duracion_segundos
                              ? <>{log.duracion_segundos} <span className="text-slate-400">seg</span></>
                              : <span className="text-slate-300">—</span>}
                          </span>
                        </td>

                        {/* Completos */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/50">
                            {(log.registros_completos || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Bajas */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-rose-700 font-bold bg-rose-50 px-2 py-1 rounded-md border border-rose-100/50">
                            {(log.registros_bajas || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Posiciones */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-sky-700 font-bold bg-sky-50 px-2 py-1 rounded-md border border-sky-100/50">
                            {(log.registros_posiciones || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Histórico */}
                        <td className="py-3 px-4">
                          {log.es_historico ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-[#bc955c]/40 bg-[#bc955c]/10 text-[#8b6914] font-mono">
                              <Database className="size-3" /> SAVED
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs pl-4">—</span>
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
  );
}
