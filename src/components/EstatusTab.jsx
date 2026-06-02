"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  Users,
  Search,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import EmployeesModal from "./EmployeesModal";
import { VacantesService } from "@/services/vacantes.service";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Activo: "#621f32",
  Vacante: "#bc955c",
  Suspendido: "#3b82f6",
  Licencia: "#8b5cf6",
  "Licencia Médica": "#10b981",
};

const mapEstadoNomina = (val) => {
  if (!val || val.trim() === "") return "Vacante";
  switch (val.trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Licencia";
    case "P": return "Licencia Médica";
    default: return "Vacante";
  }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getMappedEstatusData = (rawCounts) => {
  const mapped = {
    Activo: 0,
    Vacante: 0,
    Suspendido: 0,
    Licencia: 0,
    "Licencia Médica": 0,
  };
  Object.entries(rawCounts || {}).forEach(([key, count]) => {
    const label = mapEstadoNomina(key);
    mapped[label] = (mapped[label] || 0) + count;
  });
  return Object.entries(mapped)
    .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] || "#94a3b8" }))
    .filter((item) => item.value > 0);
};

// ─── DonutChart (shared shape for Level and UA) ───────────────────────────────

function DonutChart({ data, maskId, onSliceClick }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (total === 0) return null;

  let cumulativePercent = 0;
  const slices = data.map((item) => {
    const percent = item.value / total;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    const endPercent = cumulativePercent;

    const getCoords = (p) => {
      const angle = 2 * Math.PI * p - Math.PI / 2;
      return [Math.cos(angle), Math.sin(angle)];
    };

    const [startX, startY] = getCoords(startPercent);
    const [endX, endY] = getCoords(endPercent);
    const largeArc = percent > 0.5 ? 1 : 0;

    let pathData;
    if (percent >= 0.999) {
      pathData = "M 0 -1 A 1 1 0 1 1 -0.0001 -1 Z";
    } else {
      pathData = [
        `M ${startX} ${startY}`,
        `A 1 1 0 ${largeArc} 1 ${endX} ${endY}`,
        `L 0 0`,
        `Z`,
      ].join(" ");
    }

    return { ...item, percent, pathData };
  });

  const activeHoverData = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <>
      {/* SVG Donut */}
      <div className="relative size-32 flex items-center justify-center mb-4">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90 select-none">
          <defs>
            <mask id={maskId}>
              <circle cx="0" cy="0" r="1" fill="white" />
              <circle cx="0" cy="0" r="0.6" fill="black" />
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            {slices.map((slice, i) => (
              <path
                key={slice.label}
                d={slice.pathData}
                fill={slice.color}
                className="cursor-pointer transition-all duration-300 origin-center hover:opacity-90"
                style={{ transform: hoveredIndex === i ? "scale(1.05)" : "scale(1.0)" }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSliceClick && onSliceClick(slice.label)}
              />
            ))}
          </g>
        </svg>

        {/* Center Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          {activeHoverData ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeHoverData.label}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.12 }}
                className="flex flex-col items-center justify-center p-1"
              >
                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate max-w-[65px]">
                  {activeHoverData.label}
                </span>
                <span className="text-base font-black text-slate-800 dark:text-white leading-none mt-0.5">
                  {activeHoverData.value}
                </span>
                <span className="text-[8px] font-extrabold text-slate-400 mt-0.5">
                  {(activeHoverData.percent * 100).toFixed(0)}%
                </span>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center p-1">
              <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Total
              </span>
              <span className="text-lg font-black text-slate-800 dark:text-white leading-none mt-0.5">
                {total}
              </span>
              <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full">
                Plazas
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="w-full border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-auto flex flex-col gap-1.5">
        {slices.map((slice, i) => (
          <div
            key={slice.label}
            className={`flex items-center justify-between text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              hoveredIndex === i
                ? "bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onSliceClick && onSliceClick(slice.label)}
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-800 dark:text-slate-200 font-extrabold">{slice.value}</span>
              <span className="text-[8px] text-slate-400">({(slice.percent * 100).toFixed(0)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── LevelDonutChart ──────────────────────────────────────────────────────────

function LevelDonutChart({ levelName, data, onSliceClick }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-lg flex flex-col items-center justify-between group min-h-[300px]"
    >
      <div className="w-full border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-4 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#bc955c]">NIVEL</span>
        <span className="text-sm font-black text-[#621f32] dark:text-[#f3dcd4] bg-[#621f32]/5 dark:bg-[#621f32]/15 px-3 py-1 rounded-xl border border-[#621f32]/10">
          {levelName}
        </span>
      </div>
      <DonutChart data={data} maskId={`donut-mask-${levelName}`} onSliceClick={onSliceClick} />
    </motion.div>
  );
}

// ─── UaDonutChart ─────────────────────────────────────────────────────────────

function UaDonutChart({ uaName, data, onClick }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  const maskId = `donut-mask-ua-${uaName.replace(/[^a-zA-Z0-9]/g, "_")}`;
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-5 border border-slate-200/50 dark:border-slate-800/80 shadow-lg flex flex-col items-center justify-between group min-h-[320px] relative ${onClick ? "cursor-pointer hover:shadow-xl hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30" : ""}`}
    >
      <div className="w-full border-b border-slate-100 dark:border-slate-800/50 pb-3 mb-4 flex justify-between items-start gap-2 text-left self-start">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#bc955c]">UNIDAD ADMINISTRATIVA</span>
          <span
            className="text-xs font-black text-[#621f32] dark:text-[#f3dcd4] bg-[#621f32]/5 dark:bg-[#621f32]/15 px-2.5 py-1 rounded-xl border border-[#621f32]/10 truncate block w-full"
            title={uaName}
          >
            {uaName}
          </span>
        </div>
      </div>
      <DonutChart data={data} maskId={maskId} />
    </motion.div>
  );
}

// ─── Pagination Controls ──────────────────────────────────────────────────────

function PaginationControls({ page, totalPages, onPageChange, itemLabel }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="p-2 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm active:scale-95 cursor-pointer"
      >
        <ChevronsLeft className="size-4" />
      </button>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-2 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm active:scale-95 cursor-pointer"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2.5 select-none bg-slate-100/50 dark:bg-slate-800/40 py-1.5 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
        Página <span className="text-slate-900 dark:text-white font-extrabold">{page}</span> de{" "}
        <span className="text-slate-900 dark:text-white font-extrabold">{totalPages}</span>
      </div>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="p-2 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm active:scale-95 cursor-pointer"
      >
        <ChevronRightIcon className="size-4" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="p-2 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm active:scale-95 cursor-pointer"
      >
        <ChevronsRight className="size-4" />
      </button>
    </div>
  );
}

// ─── EstatusTab ───────────────────────────────────────────────────────────────

export default function EstatusTab({ estatusPorNivelUa = { por_nivel: {}, por_ua: {} }, activeSubTab, detalle = [] }) {
  const [levelsPage, setLevelsPage] = useState(1);
  const [levelsPageSize, setLevelsPageSize] = useState(8);
  const [uasPage, setUasPage] = useState(1);
  const [uasPageSize, setUasPageSize] = useState(8);
  const [uaSearchQuery, setUaSearchQuery] = useState("");
  const [levelSearchQuery, setLevelSearchQuery] = useState("");
  const [selectedUaForModal, setSelectedUaForModal] = useState(null);
  const [selectedLevelEstatus, setSelectedLevelEstatus] = useState(null);

  // States for interactive Excel exports
  const [selectedUas, setSelectedUas] = useState(new Set());
  const [selectedLevelsForDownload, setSelectedLevelsForDownload] = useState(new Set());
  const [isGlobalDownloadModalOpen, setIsGlobalDownloadModalOpen] = useState(false);
  const [isGlobalLevelDownloadModalOpen, setIsGlobalLevelDownloadModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Ref for aborting Excel exports
  const abortControllerRef = useRef(null);

  const handleExportExcel = async (exportFn, defaultFilename) => {
    // Cancel any ongoing export first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsExporting(true);

    try {
      const response = await exportFn({ signal: controller.signal });
      if (!response.ok) throw new Error("Error en la descarga del Excel desde el servidor.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      if (e.name === 'AbortError' || e.message === 'The user aborted a request.') {
        console.log('Exportación de Excel cancelada por el usuario.');
      } else {
        console.error(e);
        alert("Error al exportar Excel: " + e.message);
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  const uasList = useMemo(() => {
    return Object.keys(estatusPorNivelUa?.por_ua || {}).sort();
  }, [estatusPorNivelUa]);

  // Group status counts by level
  const porNivelGrouped = useMemo(() => {
    const raw = estatusPorNivelUa?.por_nivel || {};
    const grouped = {};
    Object.entries(raw).forEach(([levelName, rawCounts]) => {
      grouped[levelName] = getMappedEstatusData(rawCounts);
    });
    return grouped;
  }, [estatusPorNivelUa]);

  const allLevels = useMemo(() => {
    return Object.keys(porNivelGrouped).sort();
  }, [porNivelGrouped]);

  const handleOpenUaDownloadModal = () => {
    setSelectedUas(new Set(uasList));
    setIsGlobalDownloadModalOpen(true);
  };

  const handleOpenLevelDownloadModal = () => {
    setSelectedLevelsForDownload(new Set(allLevels));
    setIsGlobalLevelDownloadModalOpen(true);
  };

  const filteredLevelsList = useMemo(() => {
    let list = Object.keys(porNivelGrouped).sort();
    if (levelSearchQuery.trim()) {
      const q = levelSearchQuery.toLowerCase();
      list = list.filter(l => l.toLowerCase().includes(q));
    }
    return list;
  }, [porNivelGrouped, levelSearchQuery]);

  const totalLevelsPages = Math.ceil(filteredLevelsList.length / levelsPageSize) || 1;
  const paginatedLevelsList = useMemo(() => {
    const start = (levelsPage - 1) * levelsPageSize;
    return filteredLevelsList.slice(start, start + levelsPageSize);
  }, [filteredLevelsList, levelsPage, levelsPageSize]);

  useEffect(() => {
    if (levelsPage > totalLevelsPages) setLevelsPage(totalLevelsPages);
  }, [filteredLevelsList.length, levelsPageSize, totalLevelsPages, levelsPage]);

  useEffect(() => { setLevelsPage(1); }, [levelSearchQuery]);

  // Filtered UAs
  const filteredUas = useMemo(() => {
    const uas = Object.keys(estatusPorNivelUa?.por_ua || {}).sort();
    if (!uaSearchQuery.trim()) return uas;
    const query = uaSearchQuery.toLowerCase();
    return uas.filter((ua) => ua.toLowerCase().includes(query));
  }, [estatusPorNivelUa, uaSearchQuery]);

  const totalUasPages = Math.ceil(filteredUas.length / uasPageSize) || 1;
  const paginatedUasList = useMemo(() => {
    const start = (uasPage - 1) * uasPageSize;
    return filteredUas.slice(start, start + uasPageSize);
  }, [filteredUas, uasPage, uasPageSize]);

  useEffect(() => {
    if (uasPage > totalUasPages) setUasPage(totalUasPages);
  }, [filteredUas.length, uasPageSize, totalUasPages, uasPage]);

  useEffect(() => { setUasPage(1); }, [uaSearchQuery]);

  return (
    <div className="w-full max-w-screen-xl mx-auto mt-2 flex flex-col gap-8 px-4">
      {activeSubTab === "nivel" ? (
        // ── Niveles ──
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/80 shadow-xl p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-200/50 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] text-white rounded-2xl shadow-md">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  Estatus de Nómina por Nivel
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  Gráficos donut interactivos que representan la distribución del estatus de la nómina por cada nivel salarial/organizacional.
                </p>
              </div>
            </div>

            {/* Search and Excel Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto">
              <button
                onClick={handleOpenLevelDownloadModal}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#621f32] to-[#8d2c48] text-white font-extrabold uppercase tracking-wider text-[10px] rounded-2xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 w-full sm:w-auto cursor-pointer"
              >
                Descargar Excel
              </button>

              <div className="relative w-full sm:w-72 flex items-center pr-3 pl-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] focus-within:ring-2 focus-within:ring-[#621f32]/10 dark:focus-within:ring-[#bc955c]/10 rounded-2xl transition-all duration-300 shadow-sm">
                <Search className="text-slate-400 dark:text-slate-500 size-4 mr-2.5 flex-shrink-0" />
                <input
                  type="text"
                  value={levelSearchQuery}
                  onChange={(e) => setLevelSearchQuery(e.target.value)}
                  placeholder="Buscar nivel..."
                  className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold placeholder-slate-400 dark:placeholder-slate-500 w-full outline-none"
                />
                {levelSearchQuery && (
                  <button onClick={() => setLevelSearchQuery("")} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-200 cursor-pointer flex-shrink-0 ml-1.5">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pagination - Niveles */}
          {filteredLevelsList.length > 0 && (
            <div className="mb-6 pb-6 border-b border-slate-200/30 dark:border-slate-800/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Mostrando del{" "}
                <span className="text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {formatNumber((levelsPage - 1) * levelsPageSize + 1)}
                </span>{" "}
                al{" "}
                <span className="text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {formatNumber(Math.min(levelsPage * levelsPageSize, filteredLevelsList.length))}
                </span>{" "}
                de{" "}
                <span className="text-[#621f32] dark:text-[#bc955c] font-extrabold bg-[#621f32]/5 dark:bg-[#bc955c]/10 px-2.5 py-1 rounded-xl border border-[#621f32]/10 dark:border-[#bc955c]/25">
                  {formatNumber(filteredLevelsList.length)}
                </span>{" "}
                niveles
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Niveles por página:</span>
                  <select
                    value={levelsPageSize}
                    onChange={(e) => { setLevelsPageSize(Number(e.target.value)); setLevelsPage(1); }}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-[#621f32]/20 dark:focus:ring-[#bc955c]/20 outline-none cursor-pointer transition-all shadow-sm"
                  >
                    {[4, 8, 12, 16, 24].map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <PaginationControls page={levelsPage} totalPages={totalLevelsPages} onPageChange={setLevelsPage} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedLevelsList.map((level) => (
              <LevelDonutChart 
                key={level} 
                levelName={level} 
                data={porNivelGrouped[level]} 
                onSliceClick={(estatus) => setSelectedLevelEstatus({ nivel: level, estatus })}
              />
            ))}
            {filteredLevelsList.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-bold">
                No se encontraron niveles que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>
      ) : (
        // ── UAs ──
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/80 shadow-xl p-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-200/50 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] text-white rounded-2xl shadow-md">
                <Users className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  Desglose por Unidad Administrativa (UA)
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  Visualización interactiva del estatus de nómina agrupado por cada Unidad Administrativa (UA).
                </p>
              </div>
            </div>

            {/* Search and Excel Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full md:w-auto">
              <button
                onClick={handleOpenUaDownloadModal}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#621f32] to-[#8d2c48] text-white font-extrabold uppercase tracking-wider text-[10px] rounded-2xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 w-full sm:w-auto cursor-pointer"
              >
                Descargar Excel
              </button>

              <div className="relative w-full sm:w-72 flex items-center pr-3 pl-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] focus-within:ring-2 focus-within:ring-[#621f32]/10 dark:focus-within:ring-[#bc955c]/10 rounded-2xl transition-all duration-300 shadow-sm">
                <Search className="text-slate-400 dark:text-slate-500 size-4 mr-2.5 flex-shrink-0" />
                <input
                  type="text"
                  value={uaSearchQuery}
                  onChange={(e) => setUaSearchQuery(e.target.value)}
                  placeholder="Buscar Unidad Administrativa..."
                  className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold placeholder-slate-400 dark:placeholder-slate-500 w-full outline-none"
                />
                {uaSearchQuery && (
                  <button onClick={() => setUaSearchQuery("")} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-200 cursor-pointer flex-shrink-0 ml-1.5">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pagination - UAs */}
          {filteredUas.length > 0 && (
            <div className="mb-6 pb-6 border-b border-slate-200/30 dark:border-slate-800/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Mostrando del{" "}
                <span className="text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {formatNumber((uasPage - 1) * uasPageSize + 1)}
                </span>{" "}
                al{" "}
                <span className="text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                  {formatNumber(Math.min(uasPage * uasPageSize, filteredUas.length))}
                </span>{" "}
                de{" "}
                <span className="text-[#621f32] dark:text-[#bc955c] font-extrabold bg-[#621f32]/5 dark:bg-[#bc955c]/10 px-2.5 py-1 rounded-xl border border-[#621f32]/10 dark:border-[#bc955c]/25">
                  {formatNumber(filteredUas.length)}
                </span>{" "}
                unidades
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">UAs por página:</span>
                  <select
                    value={uasPageSize}
                    onChange={(e) => { setUasPageSize(Number(e.target.value)); setUasPage(1); }}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-[#621f32]/20 dark:focus:ring-[#bc955c]/20 outline-none cursor-pointer transition-all shadow-sm"
                  >
                    {[4, 8, 12, 24, 48].map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <PaginationControls page={uasPage} totalPages={totalUasPages} onPageChange={setUasPage} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedUasList.map((ua) => {
              const levelsData = estatusPorNivelUa.por_ua[ua] || {};
              const uaStatusCounts = {};
              Object.values(levelsData).forEach((statusCounts) => {
                Object.entries(statusCounts || {}).forEach(([status, val]) => {
                  uaStatusCounts[status] = (uaStatusCounts[status] || 0) + val;
                });
              });
              const mappedData = getMappedEstatusData(uaStatusCounts);
              return (
                <UaDonutChart
                  key={ua}
                  uaName={ua}
                  data={mappedData}
                  onClick={() => setSelectedUaForModal(ua)}
                />
              );
            })}
            {filteredUas.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-bold">
                No se encontraron unidades administrativas que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedUaForModal && (
          <UaDetailsModal
            uaName={selectedUaForModal}
            levelsData={estatusPorNivelUa.por_ua[selectedUaForModal] || {}}
            detalle={detalle}
            onClose={() => setSelectedUaForModal(null)}
            onSliceClick={(nivel, estatus) => setSelectedLevelEstatus({ nivel, estatus, ua: selectedUaForModal })}
            handleExportExcel={handleExportExcel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGlobalDownloadModalOpen && (
          <GlobalDownloadModal
            uasList={uasList}
            selectedUas={selectedUas}
            setSelectedUas={setSelectedUas}
            onClose={() => setIsGlobalDownloadModalOpen(false)}
            onConfirm={() => {
              const uasStr = Array.from(selectedUas).join(",");
              handleExportExcel(
                (opts) => VacantesService.exportarEstatusExcel(uasStr, "", "ua", opts),
                `Reporte_Plantilla_Estatus_${new Date().toISOString().slice(0, 10)}.xlsx`
              );
              setIsGlobalDownloadModalOpen(false);
            }}
            isExporting={isExporting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGlobalLevelDownloadModalOpen && (
          <LevelDownloadModal
            levelsList={allLevels}
            selectedLevels={selectedLevelsForDownload}
            setSelectedLevels={setSelectedLevelsForDownload}
            onClose={() => setIsGlobalLevelDownloadModalOpen(false)}
            onConfirm={() => {
              const levelsStr = Array.from(selectedLevelsForDownload).join(",");
              handleExportExcel(
                (opts) => VacantesService.exportarEstatusExcel("", levelsStr, "level", opts),
                `Reporte_Plantilla_Estatus_Nivel_${new Date().toISOString().slice(0, 10)}.xlsx`
              );
              setIsGlobalLevelDownloadModalOpen(false);
            }}
            isExporting={isExporting}
            title="Exportar Niveles"
            subtitle="Selecciona los niveles que deseas incluir en el reporte interactivo"
          />
        )}
      </AnimatePresence>

      <EmployeesModal
        open={!!selectedLevelEstatus}
        onOpenChange={(isOpen) => !isOpen && setSelectedLevelEstatus(null)}
        nivel={selectedLevelEstatus?.nivel}
        estatus={selectedLevelEstatus?.estatus}
        ua={selectedLevelEstatus?.ua}
      />

      <AnimatePresence>
        {isExporting && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200/50 dark:border-slate-800 p-8 flex flex-col items-center gap-6 text-center"
            >
              <div className="relative flex items-center justify-center size-20">
                <div className="absolute inset-0 rounded-full bg-[#621f32]/10 dark:bg-[#bc955c]/10 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#621f32] dark:border-[#bc955c] animate-spin [animation-duration:3s]" />
                <FileSpreadsheet className="size-8 text-[#621f32] dark:text-[#bc955c] relative z-10 animate-pulse" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Generando Reporte
                </h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-2">
                  Esto puede tardar unos segundos. Por favor, espera...
                </p>
              </div>

              <div className="w-full bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 py-2.5 px-4 rounded-2xl flex items-center gap-3">
                <div className="size-2 rounded-full bg-[#bc955c] animate-bounce" />
                <span className="text-[11px] font-bold text-slate-500 text-left leading-normal">
                  Procesando base de datos y formateando hojas...
                </span>
              </div>

              <button
                onClick={handleCancelExport}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-xs font-extrabold uppercase tracking-wider text-slate-550 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UaDetailsModal ──────────────────────────────────────────────────────────

function UaDetailsModal({ uaName, levelsData, detalle, onClose, onSliceClick, handleExportExcel }) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const allLevels = useMemo(() => Object.keys(levelsData).sort(), [levelsData]);
  const [selectedLevels, setSelectedLevels] = useState(new Set());

  // Initialize selectedLevels when component mounts/receives data
  useEffect(() => {
    setSelectedLevels(new Set(allLevels));
  }, [allLevels]);

  useEffect(() => { setMounted(true); }, []);

  const levels = allLevels.filter((level) => level.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const totalPositions = Object.values(levelsData).reduce((total, statusCounts) => {
    return total + Object.values(statusCounts || {}).reduce((sum, count) => sum + count, 0);
  }, 0);

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800"
      >
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 gap-4">
          <div className="flex flex-1 items-center gap-4 min-w-0">
            <div className="p-3 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] text-white rounded-2xl shadow-md flex-shrink-0">
              <Briefcase className="size-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight truncate">Desglose por Nivel</h2>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1 truncate">{uaName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsLevelModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f] rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer flex-shrink-0"
            >
              Exportar Excel
            </button>

            <div className="relative hidden sm:flex items-center pr-3 pl-4 py-2 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] focus-within:ring-2 focus-within:ring-[#621f32]/10 dark:focus-within:ring-[#bc955c]/10 rounded-xl transition-all duration-300 shadow-sm w-64">
              <Search className="text-slate-400 dark:text-slate-500 size-4 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nivel..."
                className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold placeholder-slate-400 dark:placeholder-slate-500 w-full outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-200 cursor-pointer flex-shrink-0 ml-1.5">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
 
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Posiciones</span>
              <span className="text-xl font-black text-[#621f32] dark:text-[#bc955c] bg-[#621f32]/10 dark:bg-[#bc955c]/10 px-3 py-1 rounded-xl border border-[#621f32]/20 dark:border-[#bc955c]/20">
                {formatNumber(totalPositions)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shadow-sm active:scale-95 flex-shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>
        
        {/* Mobile Search Bar (visible only on small screens) */}
        <div className="p-4 sm:hidden border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative flex items-center pr-3 pl-4 py-2 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#621f32] focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-xl transition-all w-full">
            <Search className="text-slate-400 size-4 mr-2.5 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nivel..."
              className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold placeholder-slate-400 w-full outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-500 cursor-pointer ml-1.5">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
 
        <div className="p-6 md:p-8 overflow-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level) => {
              const mappedData = getMappedEstatusData(levelsData[level]);
              return <LevelDonutChart key={level} levelName={level} data={mappedData} onSliceClick={(estatus) => onSliceClick(level, estatus)} />;
            })}
            {levels.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 font-bold">No hay niveles registrados para esta UA.</div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isLevelModalOpen && (
          <LevelDownloadModal
            levelsList={allLevels}
            selectedLevels={selectedLevels}
            setSelectedLevels={setSelectedLevels}
            onClose={() => setIsLevelModalOpen(false)}
            onConfirm={() => {
              const uasStr = uaName;
              const levelsStr = Array.from(selectedLevels).join(",");
              handleExportExcel(
                (opts) => VacantesService.exportarEstatusExcel(uasStr, levelsStr, "ua", opts),
                `Reporte_Plantilla_${uaName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
              );
              setIsLevelModalOpen(false);
            }}
            isExporting={isExporting}
          />
        )}
      </AnimatePresence>
    </div>
  );
 
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

// ─── GlobalDownloadModal ──────────────────────────────────────────────────────
function GlobalDownloadModal({ uasList, selectedUas, setSelectedUas, onClose, onConfirm, isExporting }) {
  const [search, setSearch] = useState("");
  const filtered = uasList.filter(ua => ua.toLowerCase().includes(search.toLowerCase()));

  const handleToggleAll = () => {
    if (selectedUas.size === uasList.length) {
      setSelectedUas(new Set());
    } else {
      setSelectedUas(new Set(uasList));
    }
  };

  const handleToggle = (ua) => {
    setSelectedUas(prev => {
      const next = new Set(prev);
      if (next.has(ua)) next.delete(ua);
      else next.add(ua);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#621f32] text-white rounded-xl shadow-md">
              <Users className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Exportar Unidades Administrativas</h3>
              <p className="text-xs font-semibold text-slate-400">Selecciona las unidades que deseas incluir en el reporte interactivo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 flex items-center pr-3 pl-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#621f32] rounded-xl transition-all w-full">
              <Search className="text-slate-400 size-4 mr-2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar unidad..."
                className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-semibold w-full outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Select/Deselect All */}
            <button
              onClick={handleToggleAll}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all w-full sm:w-auto cursor-pointer"
            >
              {selectedUas.size === uasList.length ? "Desmarcar todas" : "Seleccionar todas"}
            </button>
          </div>

          {/* List of UAs */}
          <div className="max-h-[300px] overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-2xl p-2 flex flex-col gap-1">
            {filtered.map(ua => (
              <label key={ua} className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors group">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase truncate pr-4">{ua}</span>
                <input
                  type="checkbox"
                  checked={selectedUas.has(ua)}
                  onChange={() => handleToggle(ua)}
                  className="size-4.5 rounded border-gray-300 dark:border-slate-700 text-[#621f32] focus:ring-[#621f32]/20 cursor-pointer"
                />
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-xs font-bold text-slate-400">No se encontraron unidades administrativas.</div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">
            {selectedUas.size} de {uasList.length} seleccionadas
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={selectedUas.size === 0 || isExporting}
              className="px-5 py-2 bg-gradient-to-r from-[#621f32] to-[#8d2c48] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-[#621f32]/20 flex items-center gap-2 cursor-pointer"
            >
              {isExporting ? "Generando..." : "Descargar Excel"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── LevelDownloadModal ──────────────────────────────────────────────────────
function LevelDownloadModal({ 
  levelsList, 
  selectedLevels, 
  setSelectedLevels, 
  onClose, 
  onConfirm, 
  isExporting,
  title = "Exportar Niveles de la UA",
  subtitle = "Selecciona los niveles que deseas incluir en el reporte"
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLevels = useMemo(() => {
    return levelsList.filter(lvl => lvl.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [levelsList, searchQuery]);

  const handleToggleAll = () => {
    if (selectedLevels.size === levelsList.length) {
      setSelectedLevels(new Set());
    } else {
      setSelectedLevels(new Set(levelsList));
    }
  };

  const handleToggle = (lvl) => {
    setSelectedLevels(prev => {
      const next = new Set(prev);
      if (next.has(lvl)) next.delete(lvl);
      else next.add(lvl);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-800"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#bc955c] text-[#3e131f] rounded-xl shadow-md">
              <Briefcase className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{title}</h3>
              <p className="text-xs font-semibold text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 flex items-center pr-3 pl-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-[#bc955c] rounded-xl transition-all w-full">
              <Search className="text-slate-400 size-4 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar nivel..."
                className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-semibold w-full outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Select/Deselect All */}
            <button
              onClick={handleToggleAll}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all w-full sm:w-auto cursor-pointer"
            >
              {selectedLevels.size === levelsList.length ? "Desmarcar todos" : "Seleccionar todos"}
            </button>
          </div>

          <div className="max-h-[250px] overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-2xl p-2 flex flex-col gap-1">
            {filteredLevels.map(lvl => (
              <label key={lvl} className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors group">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">{lvl}</span>
                <input
                  type="checkbox"
                  checked={selectedLevels.has(lvl)}
                  onChange={() => handleToggle(lvl)}
                  className="size-4.5 rounded border-gray-300 dark:border-slate-700 text-[#bc955c] focus:ring-[#bc955c]/20 cursor-pointer"
                />
              </label>
            ))}
            {filteredLevels.length === 0 && (
              <div className="text-center py-8 text-xs font-bold text-slate-400">No se encontraron niveles.</div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">
            {selectedLevels.size} de {levelsList.length} seleccionados
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={selectedLevels.size === 0 || isExporting}
              className="px-5 py-2 bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f] rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-[#bc955c]/20 flex items-center gap-2 cursor-pointer"
            >
              {isExporting ? "Generando..." : "Descargar Excel"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}


