"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Building2,
  Layers,
  Users,
  Briefcase,
  Network,
  Info,
  Maximize2,
  Minimize2,
  ArrowRight,
  GitFork,
  FolderTree,
  ListCollapse,
  BadgeAlert,
  Sparkles,
  HelpCircle,
  Locate,
  Download,
  Loader2,
  Plus,
  Minus,
  ChevronDown as ChevronDownIcon,
  Building,
} from "lucide-react";
import { toPng } from "html-to-image";
import { PlantillaService } from "@/services/plantilla.service";

// ─── Catálogo de unidades de negocio ─────────────────────────────────────────
// Cada entrada: { id, label (descripcion_larga de la raíz), file }
const UNIDADES = [
  { id: "00001", label: "Jefatura del Servicio de Administración Tributaria",               file: "/organigramas/organigrama_00001.json" },
  { id: "00002", label: "Órgano Interno de Control del SAT",                                file: "/organigramas/organigrama_00002.json" },
  { id: "00003", label: "Administración General de Recursos y Servicios",                   file: "/organigramas/organigrama_00003.json" },
  { id: "00004", label: "Dirección General de Procesamiento Electrónico de Datos",          file: "/organigramas/organigrama_00004.json" },
  { id: "00100", label: "Dirección General de Operación Aduanera",                          file: "/organigramas/organigrama_00100.json" },
  { id: "00200", label: "Dirección General de Investigación Aduanera",                      file: "/organigramas/organigrama_00200.json" },
  { id: "00300", label: "Dirección General de Atención Aduanera y Asuntos Internos",        file: "/organigramas/organigrama_00300.json" },
  { id: "00400", label: "Dirección General de Modernización, Equipamiento e Infraestructura", file: "/organigramas/organigrama_00400.json" },
  { id: "00500", label: "Dirección General Jurídica de Aduanas",                            file: "/organigramas/organigrama_00500.json" },
  { id: "00600", label: "Dirección General de Recaudación",                                 file: "/organigramas/organigrama_00600.json" },
  { id: "00700", label: "Dirección General de Tecnologías de la Información",               file: "/organigramas/organigrama_00700.json" },
  { id: "00800", label: "Dirección General de Planeación Aduanera",                        file: "/organigramas/organigrama_00800.json" },
  { id: "00900", label: "Unidad de Administración y Finanzas",                              file: "/organigramas/organigrama_00900.json" },
];

// ─── Dynamic import helper ────────────────────────────────────────────────────
async function loadOrganigrama(fileUrl) {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`No se pudo cargar ${fileUrl}`);
  return resp.json();
}

// ─── Selector dropdown component ─────────────────────────────────────────────
function UnidadSelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => UNIDADES.filter(u =>
      u.label.toLowerCase().includes(filter.toLowerCase()) ||
      u.id.includes(filter)
    ),
    [filter]
  );

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-rose-700 dark:hover:border-rose-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-800"
      >
        <span className="flex items-center gap-2 truncate">
          <Building className="w-3.5 h-3.5 shrink-0 text-rose-800" />
          <span className="truncate">{selected ? selected.label : "Selecciona unidad..."}</span>
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Filtrar..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-700"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
            {filtered.length === 0 && (
              <p className="p-3 text-center text-xs text-slate-400">Sin resultados</p>
            )}
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); setOpen(false); setFilter(""); }}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${selected?.id === u.id ? "bg-rose-50 dark:bg-rose-950/40" : ""}`}
              >
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${selected?.id === u.id ? "bg-rose-800" : "bg-slate-300 dark:bg-slate-700"}`} />
                <div>
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{u.label}</p>
                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">Unidad {u.id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PruebaPage() {
  const [selectedUnidad, setSelectedUnidad] = useState(UNIDADES[12]); // 00900 por defecto
  const [organigramaData, setOrganigramaData] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalCatalog, setGlobalCatalog] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pendingScrollNode, setPendingScrollNode] = useState(null);

  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // ── Load organigrama when unidad changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedUnidad) return;
    setLoadingOrg(true);
    setLoadError(null);
    setOrganigramaData(null);
    setSearchQuery("");
    setSelectedNode(null);
    setExpandedNodes({});
    loadOrganigrama(selectedUnidad.file)
      .then(data => {
        setOrganigramaData(data);
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoadingOrg(false));
  }, [selectedUnidad]);

  // ── Initialize expanded state when data loads ─────────────────────────────
  useEffect(() => {
    if (!organigramaData) return;
    const initialExpanded = { [organigramaData.departamento]: true };
    if (organigramaData.subordinados) {
      organigramaData.subordinados.forEach(child => {
        initialExpanded[child.departamento] = true;
      });
    }
    setExpandedNodes(initialExpanded);
    setSelectedNode(null);

    if (pendingScrollNode) {
      setTimeout(() => {
        // Find path to pending node and expand
        const { parentsMap, allNodes } = flatListRef.current || {};
        if (parentsMap && allNodes && allNodes[pendingScrollNode]) {
          const toExpand = {};
          let cur = pendingScrollNode;
          while (parentsMap[cur]) {
            toExpand[parentsMap[cur]] = true;
            cur = parentsMap[cur];
          }
          setExpandedNodes(prev => ({ ...prev, ...toExpand }));
          setHighlightedNodeId(pendingScrollNode);
          setSelectedNode(allNodes[pendingScrollNode]);
          setTimeout(() => {
            document.getElementById(`node-${pendingScrollNode}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            setPendingScrollNode(null);
          }, 150);
        } else {
            setPendingScrollNode(null);
        }
      }, 100);
    }
  }, [organigramaData, pendingScrollNode]);

  // ── Zoom via Ctrl+Wheel ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const step = 0.05;
      setZoom(prev => {
        const next = e.deltaY < 0 ? Math.min(prev + step, 2) : Math.max(prev - step, 0.3);
        return next;
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Drag-to-scroll ────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".cursor-pointer")) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    containerRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5;
    containerRef.current.scrollTop  = scrollTop  - (y - startY) * 1.5;
  };
  const handleMouseUp = () => setIsDragging(false);

  // ── Tree index ────────────────────────────────────────────────────────────
  const { allNodes, parentsMap, flatList } = useMemo(() => {
    const nodes = {}, parents = {}, flat = [];
    if (!organigramaData) return { allNodes: nodes, parentsMap: parents, flatList: flat };
    const traverse = (node, parentId = null) => {
      nodes[node.departamento] = node;
      flat.push({
        departamento: node.departamento,
        descripcion_larga: node.descripcion_larga,
        nivel_direccion: node.nivel_direccion,
        num_posicion_gerente: node.num_posicion_gerente,
        posicion_director: node.posicion_director,
      });
      if (parentId) parents[node.departamento] = parentId;
      (node.subordinados || []).forEach(child => traverse(child, node.departamento));
    };
    traverse(organigramaData);
    return { allNodes: nodes, parentsMap: parents, flatList: flat };
  }, [organigramaData]);

  // ── Preload Global Catalog ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await PlantillaService.getOrganigramaSearch();
        if (res.ok) {
          const data = await res.json();
          setGlobalCatalog(data);
        }
      } catch (err) {
        console.error("Error preloading global catalog:", err);
      }
    };
    fetchCatalog();
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    
    // Fast in-memory search over the global catalog
    const results = globalCatalog.filter(n =>
      n.departamento.toLowerCase().includes(q) ||
      (n.descripcion_larga && n.descripcion_larga.toLowerCase().includes(q))
    ).slice(0, 8);
    
    setSearchResults(results);
    setSelectedIndex(-1); // Reset selected index on new search
  }, [searchQuery, globalCatalog]);

  const flatListRef = useRef({ allNodes: {}, parentsMap: {}, flatList: [] });
  flatListRef.current = { allNodes, parentsMap, flatList };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const levels = {};
    flatList.forEach(n => { const l = n.nivel_direccion || "Depto."; levels[l] = (levels[l] || 0) + 1; });
    return { total: flatList.length, levels };
  }, [flatList]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleNode = (id) => setExpandedNodes(p => ({ ...p, [id]: !p[id] }));
  const expandAll  = () => { const a = {}; Object.keys(allNodes).forEach(k => a[k] = true); setExpandedNodes(a); };
  const collapseAll = () => {
    if (!organigramaData) return;
    setExpandedNodes({ [organigramaData.departamento]: true });
  };
  const expandToNode = (result) => {
    const deptId = result.departamento;
    if (result.unidad_negocio && selectedUnidad?.id !== result.unidad_negocio) {
      const newUnidad = UNIDADES.find(u => u.id === result.unidad_negocio);
      if (newUnidad) {
        setPendingScrollNode(deptId);
        setSelectedUnidad(newUnidad);
        setSearchQuery("");
        return;
      }
    }

    if (!allNodes[deptId]) return;
    let cur = deptId;
    const toExpand = {};
    while (parentsMap[cur]) { toExpand[parentsMap[cur]] = true; cur = parentsMap[cur]; }
    setExpandedNodes(prev => ({ ...prev, ...toExpand }));
    setHighlightedNodeId(deptId);
    setSelectedNode(allNodes[deptId]);
    setSearchQuery("");
    setTimeout(() => {
      document.getElementById(`node-${deptId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportPng = async (type) => {
    const treeEl = document.getElementById("tree-capture-container");
    if (!treeEl) return;
    setShowExportModal(false);
    setIsExporting(true);
    const isDark = document.documentElement.classList.contains("dark");
    const opts = {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      style: { zoom: 1, maxHeight: "none", overflow: "visible", padding: "32px", borderRadius: "16px" },
    };
    if (type === "current") {
      try {
        const url = await toPng(treeEl, opts);
        const a = document.createElement("a");
        a.download = `organigrama_${selectedUnidad?.id}_${new Date().toISOString().slice(0,10)}.png`;
        a.href = url; a.click();
      } finally { setIsExporting(false); }
    } else {
      const prev = { ...expandedNodes };
      const all = {}; Object.keys(allNodes).forEach(k => all[k] = true);
      setExpandedNodes(all);
      setTimeout(async () => {
        try {
          const url = await toPng(treeEl, opts);
          const a = document.createElement("a");
          a.download = `organigrama_${selectedUnidad?.id}_completo_${new Date().toISOString().slice(0,10)}.png`;
          a.href = url; a.click();
        } finally { setExpandedNodes(prev); setIsExporting(false); }
      }, 400);
    }
  };

  // ── TreeNode component ────────────────────────────────────────────────────
  const TreeNode = ({ node }) => {
    const isExpanded   = !!expandedNodes[node.departamento];
    const hasChildren  = node.subordinados?.length > 0;
    const isSelected   = selectedNode?.departamento === node.departamento;
    const isHighlighted = highlightedNodeId === node.departamento;

    let Icon = Briefcase;
    let iconBg    = "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400";
    let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700";
    let cardBorder = isHighlighted
      ? "border-amber-400 dark:border-amber-700 ring-2 ring-amber-400/20 shadow-lg shadow-amber-500/5 scale-[1.02]"
      : isSelected
      ? "border-rose-800 dark:border-rose-950 shadow-md shadow-rose-800/5 ring-1 ring-rose-800/30"
      : "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 shadow-sm hover:translate-y-[-2px]";

    if (node.nivel_direccion === "Titular" || node.nivel_direccion === "General") {
      Icon = Building2;
      badgeColor = "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-950";
      iconBg     = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    } else if (node.nivel_direccion === "Central") {
      Icon = Network;
      badgeColor = "bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900";
      iconBg     = "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-300";
    } else if (node.nivel_direccion === "Director") {
      Icon = Layers;
      badgeColor = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900";
      iconBg     = "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300";
    } else if (node.nivel_direccion === "Subdir.") {
      Icon = Users;
      badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900";
      iconBg     = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    }

    return (
      <div className="flex flex-col items-center">
        {/* Node card */}
        <div
          id={`node-${node.departamento}`}
          onClick={() => { setSelectedNode(node); setHighlightedNodeId(node.departamento); }}
          onDoubleClick={(e) => { if (hasChildren) { e.stopPropagation(); toggleNode(node.departamento); } }}
          className={`w-60 p-4 bg-white dark:bg-slate-900 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none flex flex-col justify-between h-40 relative ${cardBorder}`}
        >
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${badgeColor}`}>
              {node.nivel_direccion || "Depto."}
            </span>
            <div className={`p-1.5 rounded-lg ${iconBg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center mb-2 px-1">
            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-tight line-clamp-3">
              {node.descripcion_larga}
            </p>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-850 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500">
            <span>#{node.departamento}</span>
            {node.num_posicion_gerente && node.num_posicion_gerente !== "(en blanco)" && (
              <span>Plaza: {node.num_posicion_gerente}</span>
            )}
          </div>
        </div>

        {/* Toggle button */}
        {hasChildren && (
          <div className="relative z-10 -mt-3.5">
            <button
              onClick={(e) => { e.stopPropagation(); toggleNode(node.departamento); }}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-855 border border-slate-200 dark:border-slate-750 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-350 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rotate-90" />}
            </button>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <>
            <div className="w-[3px] h-[32px] bg-slate-400 dark:bg-slate-600 -mt-2 -mb-1 relative z-0" />
            <div className="flex gap-8 items-start relative px-4">
              {node.subordinados.map((child, idx) => {
                let cellClass = "flex flex-col items-center relative pt-6 after:content-[''] after:absolute after:top-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-[3px] after:h-[28px] after:bg-slate-400 dark:after:bg-slate-600";
                let hLine = null;
                if (node.subordinados.length > 1) {
                  if (idx === 0)
                    hLine = <div className="absolute top-0 left-1/2 right-[-17px] h-0 border-t-[3px] border-slate-400 dark:border-slate-600" />;
                  else if (idx === node.subordinados.length - 1)
                    hLine = <div className="absolute top-0 left-[-17px] right-1/2 h-0 border-t-[3px] border-slate-400 dark:border-slate-600" />;
                  else
                    hLine = <div className="absolute top-0 left-[-17px] right-[-17px] h-0 border-t-[3px] border-slate-400 dark:border-slate-600" />;
                }
                return (
                  <div key={child.departamento} className={cellClass}>
                    {hLine}
                    <TreeNode node={child} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-[calc(100vh-9rem)] relative overflow-hidden bg-slate-150/40 dark:bg-slate-950/40">

      {/* ── Scrollable canvas ───────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full p-20 overflow-auto absolute inset-0 ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
      >
        <div
          id="tree-capture-container"
          className="inline-block min-w-full p-4 origin-top transition-transform duration-150 ease-out"
          style={{ zoom }}
        >
          {loadingOrg && (
            <div className="flex flex-col items-center justify-center gap-4 py-32 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-rose-800" />
              <p className="text-sm font-semibold">Cargando organigrama...</p>
            </div>
          )}
          {loadError && (
            <div className="flex flex-col items-center justify-center gap-2 py-32 text-red-400">
              <BadgeAlert className="w-10 h-10" />
              <p className="text-sm font-semibold">Error: {loadError}</p>
            </div>
          )}
          {!loadingOrg && !loadError && organigramaData && (
            <TreeNode node={organigramaData} />
          )}
          {!loadingOrg && !loadError && !organigramaData && (
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-slate-400">
              <FolderTree className="w-10 h-10" />
              <p className="text-sm font-semibold">Selecciona una unidad de negocio</p>
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING CARD 1: Selector + Búsqueda (Top-Left) ─────────────── */}
      <div className="absolute top-4 left-4 z-20 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex flex-col gap-3">
        {/* Header */}
        <div>
          <div className="flex items-center gap-1.5 text-rose-900 dark:text-rose-700 text-[10px] font-bold uppercase tracking-wider">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Organigrama ANAM</span>
          </div>
          <h1 className="text-sm font-black text-slate-900 dark:text-slate-50 mt-0.5">
            Verificador Jerárquico
          </h1>
        </div>

        {/* Unidad selector */}
        <div>
          <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 block">
            Unidad de Negocio
          </label>
          <UnidadSelector
            selected={selectedUnidad}
            onSelect={(u) => {
              setSelectedUnidad(u);
              setZoom(1);
            }}
          />
        </div>

        {/* Search inside selected organigrama */}
        <div className="relative">
          <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1 block">
            Buscar área
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Nombre o código..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (searchResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
                    expandToNode(searchResults[selectedIndex]);
                  } else if (searchResults.length > 0) {
                    expandToNode(searchResults[0]);
                  }
                }
              }}
              disabled={!organigramaData}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-rose-800 focus:bg-white text-slate-800 dark:text-slate-100 transition-all disabled:opacity-40"
            />
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900 max-h-60 overflow-y-auto">
              {searchResults.map((r, idx) => (
                <div
                  key={r.departamento}
                  onClick={() => expandToNode(r)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 cursor-pointer flex justify-between items-center transition-colors ${
                    selectedIndex === idx
                      ? "bg-rose-50 dark:bg-rose-900/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{r.descripcion_larga}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 font-mono">#{r.departamento} · {r.nivel_direccion}</div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-rose-800 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING CARD 2: Controles (Top-Right) ──────────────────────── */}
      <div className="absolute top-4 right-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl flex items-center gap-1.5">
        <button onClick={expandAll} title="Expandir Todo"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all shadow-sm shadow-rose-800/10">
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Expandir Todo</span>
        </button>
        <button onClick={collapseAll} title="Colapsar Todo"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-355 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all">
          <ListCollapse className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Colapsar Todo</span>
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
        <button onClick={() => setShowExportModal(true)} title="Exportar a PNG"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-355 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all border border-slate-200/50 dark:border-slate-750">
          <Download className="w-3.5 h-3.5 text-rose-800" />
          <span>Exportar PNG</span>
        </button>
      </div>

      {/* ── FLOATING CARD 3: Stats (Bottom-Left) ────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg text-[10px] text-slate-550 dark:text-slate-400 font-medium flex items-center gap-3">
        {selectedUnidad && (
          <div className="flex items-center gap-1.5 text-rose-900 dark:text-rose-700 font-bold border-r border-slate-200 dark:border-slate-800 pr-3">
            <Building className="w-3 h-3" />
            <span>{selectedUnidad.id}</span>
          </div>
        )}
        <div>Total áreas: <strong className="text-slate-800 dark:text-slate-200">{stats.total}</strong></div>
        <div className="hidden md:flex gap-3 border-l border-slate-200 dark:border-slate-800 pl-3">
          <div>Generales: <strong>{stats.levels["General"] || stats.levels["Titular"] || 0}</strong></div>
          <div>Centrales: <strong>{stats.levels.Central || 0}</strong></div>
          <div>Direcciones: <strong>{stats.levels.Director || 0}</strong></div>
          <div>Subdirecciones: <strong>{stats.levels["Subdir."] || 0}</strong></div>
          <div>Jefaturas: <strong>{stats.levels["Jefe Depto"] || 0}</strong></div>
        </div>
      </div>

      {/* ── FLOATING CARD 4: Zoom (Bottom-Right) ────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg flex items-center gap-1">
        <button onClick={() => setZoom(p => Math.max(p - 0.1, 0.3))} title="Reducir Zoom"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-355 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono font-bold text-slate-650 dark:text-slate-300 min-w-[36px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(p => Math.min(p + 0.1, 2))} title="Aumentar Zoom"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-355 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-250 dark:bg-slate-800 mx-0.5" />
        <button onClick={() => setZoom(1)} title="Reset zoom"
          className="px-2 py-1 rounded-lg text-[9px] font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 dark:text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 transition-colors cursor-pointer">
          Reset
        </button>
      </div>

      {/* ── MODAL: Detalle de nodo ───────────────────────────────────────── */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            <div className="h-2 bg-gradient-to-r from-rose-800 via-rose-700 to-amber-500" />
            <button onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-900 dark:text-rose-700 flex items-center gap-1.5 mb-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Detalle de Estructura</span>
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                  {selectedNode.descripcion_larga}
                </h2>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                  ID: {selectedNode.departamento}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-sm">
                {[
                  ["Nivel Jerárquico", selectedNode.nivel_direccion || "Depto."],
                  ["Unidad de Negocio", selectedNode.unidad_negocio],
                  ["Unidad Administrativa", selectedNode.unidad_administrativa],
                  ["DOAF", selectedNode.doaf],
                  ["Plaza Titular (Gerente)", selectedNode.num_posicion_gerente || "N/A"],
                  ["Plaza Superior (Reporte)", selectedNode.posicion_director || "N/A"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-150 dark:border-slate-850/80 text-xs">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-rose-800" />
                  Análisis de Enlace de Reporte
                </h4>
                {parentsMap[selectedNode.departamento] ? (() => {
                  const parentId = parentsMap[selectedNode.departamento];
                  const parentNode = allNodes[parentId];
                  const directMatch = selectedNode.posicion_director === parentNode?.num_posicion_gerente;
                  return (
                    <div className="space-y-3 leading-relaxed text-slate-650 dark:text-slate-400">
                      <p>Subordinado a: <strong className="text-slate-800 dark:text-slate-200">{parentNode?.descripcion_larga} ({parentId})</strong></p>
                      {directMatch ? (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-2.5 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                          <div><strong className="block">Vínculo Directo por Plaza:</strong>
                            Plaza de reporte ({selectedNode.posicion_director}) coincide con la plaza del padre ({parentNode?.num_posicion_gerente}).
                          </div>
                        </div>
                      ) : (
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                          <div><strong className="block">Vínculo por Prefijo del Determinante:</strong>
                            Enlazado usando la estructura de prefijos del código organizacional.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="leading-relaxed text-slate-500 dark:text-slate-450">
                    <p className="font-semibold text-rose-800 dark:text-rose-400">👑 Nodo Raíz</p>
                    <p className="mt-1">Este departamento es la cabeza de la estructura en la unidad <strong>{selectedUnidad?.id}</strong>.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <button onClick={() => {
                setSelectedNode(null);
                setTimeout(() => {
                  document.getElementById(`node-${selectedNode.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-900 dark:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer">
                <Locate className="w-4 h-4" />
                <span>Centrar en Organigrama</span>
              </button>
              <button onClick={() => setSelectedNode(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-250 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Export ───────────────────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-rose-800" />
              Exportar Organigrama a PNG
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Selecciona el alcance de exportación.</p>
            <div className="space-y-4 mb-6">
              {[
                { type: "current", title: "Vista Actual", desc: "Respeta las ramas contraídas/expandidas en pantalla." },
                { type: "full",    title: "Todo Desglosado", desc: "Expande temporalmente todas las ramas." },
              ].map(({ type, title, desc }) => (
                <button key={type} onClick={() => handleExportPng(type)}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-800 dark:hover:border-rose-950 hover:bg-rose-50/20 dark:hover:bg-rose-950/15 transition-all group">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-rose-900 dark:group-hover:text-rose-700">{title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global export loader ─────────────────────────────────────────── */}
      {isExporting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-5 h-5 text-rose-800 animate-spin" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Generando PNG...</span>
          </div>
        </div>
      )}
    </div>
  );
}
