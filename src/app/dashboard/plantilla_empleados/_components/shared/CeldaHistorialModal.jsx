"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  History, X, Search, ArrowRightLeft, User, Hash, Clock,
  CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2, Inbox
} from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEscapeToClose } from "../../_hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatDateEsMx } from "@/utils/columnFilters";

const PAGE_SIZE = 60;

const ESTADO_TABS = [
  { key: "todos", label: "Todos" },
  { key: "true", label: "Vigentes" },
  { key: "false", label: "Sobrescritos" },
];

// 7.9 QA: DD/MM/AAAA HH:mm — antes "18 jul, 2026" (formato distinto al resto del módulo).
const formatFecha = (iso) => {
  if (!iso) return "-";
  return formatDateEsMx(iso, { withTime: true });
};

/**
 * Modal de auditoría: historial completo de ediciones manuales (CeldaOverride)
 * de una tabla. Solo lectura. Por default consume el historial de
 * EMPLEADOS_COMPLETOS_SIG (`VacantesService.getEmpleadoCompletoOverrideHistorial`);
 * el tab Mov. Posiciones le pasa `fetchHistorial` para el historial de MOV_POS.
 *
 * @param {Object} props
 * @param {boolean} props.open - Si el modal está visible.
 * @param {() => void} props.onClose - Cierra el modal.
 * @param {Array<{key: string, label: string}>} [props.columns=[]] - Catálogo de columnas (para mostrar labels legibles y el filtro por columna). Con 1 sola columna el selector se oculta.
 * @param {(colKey: string, value: any) => string} [props.formatValue] - Formatea un valor crudo (p.ej. mapea `estado_nomina` de código a etiqueta).
 * @param {(params: Object) => Promise<Response>} [props.fetchHistorial] - Endpoint del historial; debe ser una referencia estable.
 * @param {string} [props.subtitle] - Línea bajo el título (tabla auditada).
 * @param {string} [props.posicionPlaceholder] - Placeholder del filtro por clave de negocio.
 * @returns {JSX.Element|null}
 */
export default function CeldaHistorialModal({
  open,
  onClose,
  columns = [],
  formatValue,
  fetchHistorial: fetchHistorialEndpoint = VacantesService.getEmpleadoCompletoOverrideHistorial,
  subtitle = "EMPLEADOS_COMPLETOS_SIG · Auditoría de ediciones manuales",
  posicionPlaceholder = "Posición exacta...",
}) {
  const [search, setSearch] = useState("");
  const [columnaFiltro, setColumnaFiltro] = useState("");
  const [posicionFiltro, setPosicionFiltro] = useState("");
  const [estadoTab, setEstadoTab] = useState("todos");

  const [resultados, setResultados] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEscapeToClose(open, onClose);
  useBodyScrollLock(open);

  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedPosicion = useDebouncedValue(posicionFiltro, 350);
  const requestSeq = useRef(0);

  const columnLabelMap = useMemo(() => {
    const map = new Map();
    columns.forEach((c) => map.set(c.key, c.label));
    return map;
  }, [columns]);

  const getColumnLabel = useCallback((key) => columnLabelMap.get(key) || key, [columnLabelMap]);

  const displayValue = useCallback((colKey, val) => {
    if (val === null || val === undefined || String(val).trim() === "") return null;
    if (formatValue) return formatValue(colKey, val);
    return String(val);
  }, [formatValue]);

  const fetchHistorial = useCallback(async (nextOffset, { append } = {}) => {
    const seq = ++requestSeq.current;
    if (append) setIsLoadingMore(true); else setIsLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: nextOffset };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (columnaFiltro) params.columna = columnaFiltro;
      if (debouncedPosicion.trim()) params.posicion = debouncedPosicion.trim();
      if (estadoTab !== "todos") params.activo = estadoTab;

      const res = await fetchHistorialEndpoint(params);
      const data = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) throw new Error(data?.detail || "No se pudo cargar el historial de cambios.");

      setResultados((prev) => (append ? [...prev, ...(data.resultados || [])] : (data.resultados || [])));
      setCount(data.count || 0);
      setEstadisticas(data.estadisticas || null);
      setOffset(nextOffset);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message || "Error al cargar el historial de cambios.");
      if (!append) setResultados([]);
    } finally {
      if (seq !== requestSeq.current) return;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, columnaFiltro, debouncedPosicion, estadoTab, fetchHistorialEndpoint]);

  useEffect(() => {
    if (!open) return;
    fetchHistorial(0, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedSearch, columnaFiltro, debouncedPosicion, estadoTab]);

  useEffect(() => {
    if (!open) {
      setSearch(""); setColumnaFiltro(""); setPosicionFiltro(""); setEstadoTab("todos");
      setResultados([]); setEstadisticas(null); setCount(0); setOffset(0); setError(null);
    }
  }, [open]);

  const hasFilters = !!search || !!columnaFiltro || !!posicionFiltro || estadoTab !== "todos";
  const resetFilters = () => { setSearch(""); setColumnaFiltro(""); setPosicionFiltro(""); setEstadoTab("todos"); };

  if (typeof document === "undefined") return null;

  const statCards = estadisticas ? [
    { label: "Total de cambios", value: estadisticas.total_cambios, icon: History, color: "#621f32" },
    { label: "Vigentes", value: estadisticas.total_activos, icon: CheckCircle2, color: "#0f9d58" },
    { label: "Sobrescritos", value: estadisticas.total_sobrescritos, icon: XCircle, color: "#94a3b8" },
    { label: "Posiciones afectadas", value: estadisticas.total_posiciones_afectadas, icon: Hash, color: "#bc955c" },
    { label: "Usuarios involucrados", value: estadisticas.total_usuarios, icon: User, color: "#621f32" },
  ] : [];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="celda-historial-modal" className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col z-[110] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-30 sticky top-0">
              <div className="flex items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] rounded-2xl shadow-lg shadow-[#621f32]/20 dark:shadow-[#bc955c]/20">
                    <History className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Historial de Cambios</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{subtitle}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"><X className="size-5" /></button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {estadisticas ? statCards.map((s) => (
                  <div key={s.label} className="rounded-xl px-3 py-3 border-2 border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}15`, color: s.color }}><s.icon className="size-3.5" /></div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500 truncate">{s.label}</span>
                    </div>
                    <span className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{new Intl.NumberFormat("es-MX").format(s.value || 0)}</span>
                  </div>
                )) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl px-3 py-3 border-2 border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-900 h-[62px] animate-pulse" />
                  ))
                )}
              </div>

              {/* Filtros */}
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5 flex-shrink-0" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuario o valor..." className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold w-full outline-none" />
                  {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>

                <div className="relative flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm lg:w-56 flex-shrink-0">
                  <Hash className="text-slate-400 size-4 mr-2.5 flex-shrink-0" />
                  <input type="text" value={posicionFiltro} onChange={(e) => setPosicionFiltro(e.target.value)} placeholder={posicionPlaceholder} className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold w-full outline-none" />
                  {posicionFiltro && <button onClick={() => setPosicionFiltro("")} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>

                {/* Con una sola columna auditable (MOV_POS: fecha_anuencia) el
                    selector no filtra nada — se oculta. */}
                {columns.length > 1 && (
                  <select
                    value={columnaFiltro}
                    onChange={(e) => setColumnaFiltro(e.target.value)}
                    className="px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm text-xs font-bold text-slate-700 dark:text-slate-200 outline-none lg:w-56 flex-shrink-0"
                  >
                    <option value="">Todas las columnas</option>
                    {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                )}

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl flex-shrink-0">
                  {ESTADO_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setEstadoTab(t.key)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${estadoTab === t.key ? "bg-white dark:bg-slate-800 text-[#621f32] dark:text-[#bc955c] shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {hasFilters && (
                  <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-3 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white dark:bg-slate-950 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-500 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 flex-shrink-0">
                    <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="size-12 border-4 border-[#621f32]/20 border-t-[#621f32] dark:border-[#bc955c]/20 dark:border-t-[#bc955c] rounded-full animate-spin mb-4" />
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest animate-pulse">Cargando historial...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="size-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="size-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white">No se pudo cargar el historial</h4>
                  <p className="text-sm font-medium text-slate-500 mt-2 max-w-md">{error}</p>
                </div>
              ) : resultados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-60">
                  <div className="size-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
                    <Inbox className="size-9 text-slate-400 dark:text-slate-600" />
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">{hasFilters ? "Sin resultados para estos filtros" : "Aún no hay ediciones registradas"}</h4>
                  <p className="text-sm font-medium text-slate-500 mt-2 max-w-sm">{hasFilters ? "Ajusta la búsqueda, la columna o el estado para ver más cambios." : "Cuando se edite una celda de la tabla, el cambio quedará registrado aquí."}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {resultados.map((ov) => {
                    const original = displayValue(ov.columna, ov.valor_original);
                    const nuevo = displayValue(ov.columna, ov.valor_nuevo);
                    return (
                      <motion.div
                        key={ov.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border p-4 sm:p-5 bg-white dark:bg-slate-900 shadow-sm transition-colors ${ov.activo ? "border-slate-200 dark:border-slate-800" : "border-slate-100 dark:border-slate-800/50 opacity-70"}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-[#621f32]/8 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c] border border-[#621f32]/15 dark:border-[#bc955c]/20">
                              {getColumnLabel(ov.columna)}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <Hash className="size-2.5" />{ov.posicion}
                            </span>
                            {ov.activo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900/40"><CheckCircle2 className="size-3" />Vigente</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-700"><XCircle className="size-3" />Sobrescrito</span>
                            )}
                          </div>

                          <div className="flex-1 flex items-center gap-2.5 min-w-0 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800/60">
                            <span className={`text-xs font-semibold truncate ${original ? "text-slate-400 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-700" : "text-slate-300 dark:text-slate-700 italic"}`}>{original || "(vacío)"}</span>
                            <ArrowRightLeft className="size-3.5 text-[#bc955c] flex-shrink-0" />
                            <span className={`text-xs font-black truncate ${nuevo ? "text-[#621f32] dark:text-[#e8c9a8]" : "text-slate-300 dark:text-slate-700 italic font-medium"}`}>{nuevo || "(vacío)"}</span>
                          </div>

                          <div className="flex items-center gap-4 flex-shrink-0 text-right">
                            <div className="flex flex-col items-end">
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 dark:text-slate-200"><User className="size-3 text-slate-400" />{ov.usuario_nombre}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5"><Clock className="size-3" />{formatFecha(ov.fecha_modificacion)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {resultados.length < count && (
                    <button
                      onClick={() => fetchHistorial(offset + PAGE_SIZE, { append: true })}
                      disabled={isLoadingMore}
                      className="mt-3 mx-auto flex items-center gap-2 px-6 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 disabled:opacity-60"
                    >
                      {isLoadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      {isLoadingMore ? "Cargando..." : `Cargar más (${resultados.length} de ${count})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
