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
  FolderTree,
  ListCollapse,
  BadgeAlert,
  HelpCircle,
  Locate,
  Download,
  Loader2,
  Plus,
  Minus,
  ChevronDown as ChevronDownIcon,
  Building,
  Pencil,
  X,
  Check,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { PlantillaService } from "@/services/plantilla.service";
import { CatalogoEstructuraService } from "@/services/catalogo_estructura.service";
import RequirePermission from "@/components/auth/RequirePermission";
import { PERMISSIONS } from "@/config/permissions";

// ─── Regla de negocio del determinante (ver eje_central_back plantilla/organigrama_tree.py) ─
// Nivel → posición de segmento (G,C,A,S,D). "Titular" se trata como raíz (mismo rango que General).
const LEVEL_SEGPOS = { Titular: 0, General: 0, Central: 1, Director: 2, "Subdir.": 3, "Jefe Depto": 4 };
// Tipos que se pueden crear como hijo (General se crea aparte, como unidad de negocio nueva).
const TIPO_LABELS = {
  Central: "Dirección Central",
  Director: "Dirección de Área",
  "Subdir.": "Subdirección",
  "Jefe Depto": "Jefatura de Departamento",
};

// ─── Carga del árbol jerárquico desde el backend (ORGANIGRAMA_ANAM) ──────────
async function loadOrganigrama(unidadNegocioId) {
  const resp = await PlantillaService.getOrganigramaTree(unidadNegocioId);
  if (!resp.ok) throw new Error(`No se pudo cargar el organigrama de la unidad ${unidadNegocioId}`);
  return resp.json();
}

// ─── Selector dropdown component ─────────────────────────────────────────────
function UnidadSelector({ unidades, selected, onSelect, loading }) {
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
    () => unidades.filter(u =>
      u.label.toLowerCase().includes(filter.toLowerCase()) ||
      u.id.includes(filter)
    ),
    [filter, unidades]
  );

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-rose-700 dark:hover:border-rose-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <Building className="w-3.5 h-3.5 shrink-0 text-rose-800" />
          <span className="truncate">{loading ? "Cargando unidades..." : selected ? selected.label : "Selecciona unidad..."}</span>
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

// ─── Formato moneda para SMB ──────────────────────────────────────────────────
function formatSMB(smb) {
  if (smb === null || smb === undefined || smb === "") return "N/A";
  const num = Number(smb);
  if (Number.isNaN(num)) return smb;
  return num.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function OrganigramaContent() {
  const [unidades, setUnidades] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState(true);
  const [selectedUnidad, setSelectedUnidad] = useState(null);
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
  // Fuerza el re-render del árbol tras mutar un nodo en sitio, sin tocar la
  // referencia de organigramaData (eso reinicia expandedNodes/selectedNode).
  const [renderTick, bumpRender] = useState(0);

  const [posInfo, setPosInfo] = useState({ titular: null, superior: null });
  const [posLoading, setPosLoading] = useState({ titular: false, superior: false });

  // ── Edición de plaza titular/superior desde el modal de detalle ───────────
  const [editingField, setEditingField] = useState(null); // null | "titular" | "superior"
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [empSearchResults, setEmpSearchResults] = useState([]);
  const [empSearching, setEmpSearching] = useState(false);
  const [savingField, setSavingField] = useState(null); // null | "titular" | "superior"
  const [changeToast, setChangeToast] = useState(null); // { message, onUndo }
  const toastTimerRef = useRef(null);

  // ── Creación de nodos (Dirección General nueva / subordinado bajo un nodo) ─
  const emptyGeneralForm = { unidad_negocio: "", departamento: "", descripcion_larga: "", unidad_administrativa: "", doaf: "", num_posicion_gerente: "" };
  const emptyChildForm = { tipo: "", descripcion_larga: "", unidad_administrativa: "", doaf: "", num_posicion_gerente: "" };
  const [showCreateGeneral, setShowCreateGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState(emptyGeneralForm);
  const [creatingGeneral, setCreatingGeneral] = useState(false);
  const [createGeneralError, setCreateGeneralError] = useState(null);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [childForm, setChildForm] = useState(emptyChildForm);
  const [creatingChild, setCreatingChild] = useState(false);
  const [createChildError, setCreateChildError] = useState(null);

  // ── Edición / borrado del nodo seleccionado ────────────────────────────────
  // Nota: departamento (PK), nivel_direccion y unidad_negocio no son editables
  // aquí — el backend los bloquea porque codifican el determinante del árbol
  // (ver OrganigramaAnamViewSet.LOCKED_UPDATE_FIELDS en plantilla/views.py).
  const emptyEditForm = { descripcion_larga: "", unidad_administrativa: "", doaf: "" };
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingNode, setDeletingNode] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // ── Load unidades de negocio (lienzos) desde el backend ────────────────────
  const reloadUnidades = async () => {
    const resp = await PlantillaService.getOrganigramaUnidades();
    if (!resp.ok) throw new Error("No se pudo actualizar la lista de unidades de negocio.");
    const data = await resp.json();
    setUnidades(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    setUnidadesLoading(true);
    PlantillaService.getOrganigramaUnidades()
      .then(async (resp) => {
        if (!resp.ok) throw new Error("No se pudieron cargar las unidades de negocio");
        const data = await resp.json();
        if (cancelled) return;
        setUnidades(data);
        setSelectedUnidad(prev => prev || data.find(u => u.id === "00900") || data[0] || null);
      })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setUnidadesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Load organigrama when unidad changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedUnidad) return;
    setLoadingOrg(true);
    setLoadError(null);
    setOrganigramaData(null);
    setSearchQuery("");
    setSelectedNode(null);
    setExpandedNodes({});
    loadOrganigrama(selectedUnidad.id)
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
    // renderTick fuerza recalcular tras insertar un nodo en sitio (handleCreateChild),
    // ya que organigramaData mantiene su referencia para no reiniciar la vista.
  }, [organigramaData, renderTick]);

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

  // ── Consulta ocupante de plaza (titular / superior) al seleccionar nodo ────
  useEffect(() => {
    if (!selectedNode) {
      setPosInfo({ titular: null, superior: null });
      return;
    }

    const fetchPosInfo = async (key, posicion) => {
      if (!posicion || posicion === "(en blanco)") {
        setPosInfo(prev => ({ ...prev, [key]: null }));
        return;
      }
      setPosLoading(prev => ({ ...prev, [key]: true }));
      try {
        const res = await PlantillaService.getOrganigramaPosicionInfo(posicion);
        const data = res.ok ? await res.json() : { error: true };
        setPosInfo(prev => ({ ...prev, [key]: data }));
      } catch {
        setPosInfo(prev => ({ ...prev, [key]: { error: true } }));
      } finally {
        setPosLoading(prev => ({ ...prev, [key]: false }));
      }
    };

    fetchPosInfo("titular", selectedNode.num_posicion_gerente);
    fetchPosInfo("superior", selectedNode.posicion_director);
  }, [selectedNode?.departamento]);

  // ── Reset del editor de plaza al cambiar/cerrar el nodo seleccionado ──────
  useEffect(() => {
    setEditingField(null);
    setEmpSearchQuery("");
    setEmpSearchResults([]);
    setIsEditingNode(false);
    setEditError(null);
  }, [selectedNode?.departamento]);

  // ── Búsqueda de empleados (EMPLEADOS_COMPLETOS_SIG) al editar una plaza ───
  useEffect(() => {
    if (!editingField || empSearchQuery.trim().length < 3) {
      setEmpSearchResults([]);
      setEmpSearching(false);
      return;
    }
    let cancelled = false;
    setEmpSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await PlantillaService.searchEmpleados(empSearchQuery.trim());
        const data = res.ok ? await res.json() : { results: [] };
        if (!cancelled) setEmpSearchResults(data.results || []);
      } catch {
        if (!cancelled) setEmpSearchResults([]);
      } finally {
        if (!cancelled) setEmpSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [empSearchQuery, editingField]);

  // ── Aplica un cambio de plaza (titular/superior) y ofrece revertir ───────
  // newOcupanteInfo === null ⇒ se está quitando la asignación (deja la plaza en blanco).
  const applyPlazaChange = async (fieldKey, field, node, newPosicion, newOcupanteInfo) => {
    const departamento = node.departamento;
    const previousPosicion = node[fieldKey];
    const previousOcupante = node.ocupante;
    const previousPosInfoEntry = posInfo[field];
    const isRemoval = newOcupanteInfo === null;

    setSavingField(field);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, {
        [fieldKey]: newPosicion,
      });
      if (!res.ok) throw new Error(isRemoval ? "No se pudo quitar la plaza." : "No se pudo actualizar la plaza.");

      // ── Actualiza la UI directamente, sin refetch ──────────────────────
      node[fieldKey] = newPosicion;
      if (field === "titular") {
        node.ocupante = isRemoval ? null : {
          activa: true,
          vacante: false,
          nombre: newOcupanteInfo.nombre,
          nivel: newOcupanteInfo.nivel,
          smb: newOcupanteInfo.smb,
        };
      }
      setPosInfo(prev => ({
        ...prev,
        [field]: isRemoval ? null : {
          posicion: newPosicion,
          activa: true,
          vacante: false,
          nombre: newOcupanteInfo.nombre,
          num_empleado: newOcupanteInfo.num_empleado,
          estado_nomina: "A",
        },
      }));
      setSelectedNode(prev => (prev && prev.departamento === departamento ? { ...node } : prev));
      bumpRender(t => t + 1);
      setEditingField(null);
      setEmpSearchQuery("");
      setEmpSearchResults([]);

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setChangeToast({
        message: isRemoval
          ? `Se ha quitado la plaza (${field === "titular" ? "gerente" : "superior"})`
          : `Se ha actualizado la plaza (${field === "titular" ? "gerente" : "superior"})`,
        onUndo: () => revertPlazaChange(fieldKey, field, node, previousPosicion, previousOcupante, previousPosInfoEntry, departamento),
      });
      toastTimerRef.current = setTimeout(() => setChangeToast(null), 10000);
    } catch (err) {
      alert(err.message || "Error al actualizar la plaza.");
    } finally {
      setSavingField(null);
    }
  };

  // ── Revierte un cambio de plaza previamente confirmado ───────────────────
  const revertPlazaChange = async (fieldKey, field, node, previousPosicion, previousOcupante, previousPosInfoEntry, departamento) => {
    setSavingField(field);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, {
        [fieldKey]: previousPosicion ?? "",
      });
      if (!res.ok) throw new Error("No se pudo revertir la plaza.");

      node[fieldKey] = previousPosicion;
      if (field === "titular") node.ocupante = previousOcupante;
      setPosInfo(prev => ({ ...prev, [field]: previousPosInfoEntry }));
      setSelectedNode(prev => (prev && prev.departamento === departamento ? { ...node } : prev));
      bumpRender(t => t + 1);
      setChangeToast(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    } catch (err) {
      alert(err.message || "Error al revertir la plaza.");
    } finally {
      setSavingField(null);
    }
  };

  // ── Crea una nueva Dirección General (raíz, abre lienzo nuevo) ────────────
  const handleCreateGeneral = async () => {
    const unidad_negocio = generalForm.unidad_negocio.trim();
    const departamento = generalForm.departamento.trim();
    const descripcion_larga = generalForm.descripcion_larga.trim();
    if (!unidad_negocio || !departamento || !descripcion_larga) {
      setCreateGeneralError("unidad_negocio, departamento y descripción son obligatorios.");
      return;
    }
    setCreateGeneralError(null);
    setCreatingGeneral(true);
    try {
      const res = await PlantillaService.crearOrganigramaNodo({
        tipo: "General",
        unidad_negocio,
        departamento,
        descripcion_larga,
        unidad_administrativa: generalForm.unidad_administrativa.trim(),
        doaf: generalForm.doaf.trim(),
        num_posicion_gerente: generalForm.num_posicion_gerente.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo crear la Dirección General.");

      const data = await reloadUnidades();
      const nueva = data.find(u => u.id === unidad_negocio) || { id: unidad_negocio, label: descripcion_larga };
      setSelectedUnidad(nueva);
      setZoom(1);
      setShowCreateGeneral(false);
      setGeneralForm(emptyGeneralForm);
    } catch (err) {
      setCreateGeneralError(err.message || "Error al crear la Dirección General.");
    } finally {
      setCreatingGeneral(false);
    }
  };

  // ── Crea un subordinado bajo selectedNode, aplicando la regla del determinante en el backend ─
  const handleCreateChild = async () => {
    if (!selectedNode) return;
    const tipo = childForm.tipo;
    const descripcion_larga = childForm.descripcion_larga.trim();
    if (!tipo || !descripcion_larga) {
      setCreateChildError("Tipo y descripción son obligatorios.");
      return;
    }
    setCreateChildError(null);
    setCreatingChild(true);
    try {
      const res = await PlantillaService.crearOrganigramaNodo({
        tipo,
        parent_departamento: selectedNode.departamento,
        descripcion_larga,
        unidad_administrativa: childForm.unidad_administrativa.trim(),
        doaf: childForm.doaf.trim(),
        num_posicion_gerente: childForm.num_posicion_gerente.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo crear el subordinado.");

      // ── Inserta el nodo en sitio, sin refetch ni tocar la referencia de
      // organigramaData (eso reiniciaría expandedNodes/selectedNode/scroll).
      const newNode = {
        departamento: body.departamento,
        descripcion_larga: body.descripcion_larga,
        nivel_direccion: body.nivel_direccion,
        num_posicion_gerente: body.num_posicion_gerente,
        posicion_director: body.posicion_director,
        unidad_administrativa: body.unidad_administrativa,
        doaf: body.doaf,
        subordinados: [],
        ocupante: null,
      };
      const parent = allNodes[selectedNode.departamento];
      if (parent) {
        parent.subordinados = [...(parent.subordinados || []), newNode];
      }
      setGlobalCatalog(prev => [...prev, {
        departamento: newNode.departamento,
        descripcion_larga: newNode.descripcion_larga,
        unidad_negocio: selectedUnidad.id,
        nivel_direccion: newNode.nivel_direccion,
      }]);

      setShowCreateChild(false);
      setChildForm(emptyChildForm);
      setCreateChildError(null);
      setExpandedNodes(prev => ({ ...prev, [selectedNode.departamento]: true }));
      setHighlightedNodeId(newNode.departamento);
      setSelectedNode(newNode);
      bumpRender(t => t + 1);
      setTimeout(() => {
        document.getElementById(`node-${newNode.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch (err) {
      setCreateChildError(err.message || "Error al crear el subordinado.");
    } finally {
      setCreatingChild(false);
    }
  };

  // ── Abre el editor con los valores actuales del nodo seleccionado ─────────
  const handleOpenEdit = () => {
    if (!selectedNode) return;
    setEditForm({
      descripcion_larga: selectedNode.descripcion_larga || "",
      unidad_administrativa: selectedNode.unidad_administrativa || "",
      doaf: selectedNode.doaf || "",
    });
    setEditError(null);
    setIsEditingNode(true);
  };

  const handleCancelEdit = () => {
    setIsEditingNode(false);
    setEditError(null);
  };

  // ── Edita nombre/unidad administrativa/DOAF del nodo seleccionado (en sitio) ─
  const handleSaveEdit = async () => {
    if (!selectedNode) return;
    const descripcion_larga = editForm.descripcion_larga.trim();
    if (!descripcion_larga) {
      setEditError("La descripción es obligatoria.");
      return;
    }
    const departamento = selectedNode.departamento;
    const payload = {
      descripcion_larga,
      unidad_administrativa: editForm.unidad_administrativa.trim(),
      doaf: editForm.doaf.trim(),
    };
    setEditError(null);
    setSavingEdit(true);
    try {
      const res = await CatalogoEstructuraService.patchOrganigramaAnam(departamento, payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "No se pudo actualizar el departamento.");

      const node = allNodes[departamento];
      if (node) {
        node.descripcion_larga = payload.descripcion_larga;
        node.unidad_administrativa = payload.unidad_administrativa;
        node.doaf = payload.doaf;
      }
      setGlobalCatalog(prev => prev.map(n => n.departamento === departamento ? { ...n, descripcion_larga } : n));
      setSelectedNode(prev => (prev && node ? { ...node } : prev));
      bumpRender(t => t + 1);
      setIsEditingNode(false);
    } catch (err) {
      setEditError(err.message || "Error al actualizar el departamento.");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Elimina el nodo seleccionado (bloqueado en backend si tiene subordinados) ─
  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    const departamento = selectedNode.departamento;
    setDeleteError(null);
    setDeletingNode(true);
    try {
      const res = await CatalogoEstructuraService.deleteOrganigramaAnam(departamento);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "No se pudo eliminar el departamento.");
      }

      setGlobalCatalog(prev => prev.filter(n => n.departamento !== departamento));
      const parentId = parentsMap[departamento];

      if (!parentId) {
        // Nodo raíz del lienzo: no queda árbol que actualizar en sitio, se
        // recarga el catálogo de unidades y se cambia a otro lienzo.
        setShowDeleteConfirm(false);
        setSelectedNode(null);
        setOrganigramaData(null);
        const data = await reloadUnidades();
        setSelectedUnidad(data.find(u => u.id !== selectedUnidad.id) || null);
      } else {
        const parent = allNodes[parentId];
        if (parent) {
          parent.subordinados = (parent.subordinados || []).filter(c => c.departamento !== departamento);
        }
        setShowDeleteConfirm(false);
        setSelectedNode(null);
        setHighlightedNodeId(null);
        bumpRender(t => t + 1);
      }
    } catch (err) {
      setDeleteError(err.message || "Error al eliminar el departamento.");
    } finally {
      setDeletingNode(false);
    }
  };

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
      const newUnidad = unidades.find(u => u.id === result.unidad_negocio);
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
          className={`w-60 p-4 bg-white dark:bg-slate-900 rounded-2xl border text-center transition-all duration-200 cursor-pointer select-none flex flex-col justify-between h-48 relative ${cardBorder}`}
        >
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${badgeColor}`}>
              {node.nivel_direccion || "Depto."}
            </span>
            <div className={`p-1.5 rounded-lg ${iconBg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center mb-2 px-1 gap-1.5">
            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">
              {node.descripcion_larga}
            </p>
            <div className="w-8 h-px bg-slate-150 dark:bg-slate-800" />
            {!node.num_posicion_gerente || node.num_posicion_gerente === "(en blanco)" ? (
              <p className="text-[9.5px] text-slate-350 dark:text-slate-600 italic">Sin plaza titular</p>
            ) : !node.ocupante || !node.ocupante.activa ? (
              <p className="text-[9.5px] text-rose-700 dark:text-rose-400 font-semibold">Plaza inactiva</p>
            ) : node.ocupante.vacante ? (
              <p className="text-[9.5px] text-amber-700 dark:text-amber-400 font-semibold">Vacante</p>
            ) : (
              <>
                <p className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 leading-tight line-clamp-2">
                  {node.ocupante.nombre}
                </p>
                <div className="flex flex-col items-center gap-0.5 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                  <span>Nivel: {node.ocupante.nivel || "N/A"}</span>
                  <span>SMB: {formatSMB(node.ocupante.smb)}</span>
                </div>
              </>
            )}
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

  // ── Skeleton (silueta de organigrama mientras carga) ──────────────────────
  const SKELETON_SHAPE = [
    { children: [{ children: [] }, { children: [] }] },
    { children: [{ children: [] }, { children: [] }, { children: [] }] },
    { children: [{ children: [] }] },
  ];

  const SkeletonCard = () => (
    <div className="w-60 h-48 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
  );

  const SkeletonNode = ({ node }) => {
    const hasChildren = node.children?.length > 0;
    return (
      <div className="flex flex-col items-center">
        <SkeletonCard />
        {hasChildren && (
          <>
            <div className="w-[3px] h-[32px] bg-slate-300 dark:bg-slate-700 -mt-2 -mb-1 relative z-0" />
            <div className="flex gap-8 items-start relative px-4">
              {node.children.map((child, idx) => {
                let cellClass = "flex flex-col items-center relative pt-6 after:content-[''] after:absolute after:top-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-[3px] after:h-[28px] after:bg-slate-300 dark:after:bg-slate-700";
                let hLine = null;
                if (node.children.length > 1) {
                  if (idx === 0)
                    hLine = <div className="absolute top-0 left-1/2 right-[-17px] h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />;
                  else if (idx === node.children.length - 1)
                    hLine = <div className="absolute top-0 left-[-17px] right-1/2 h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />;
                  else
                    hLine = <div className="absolute top-0 left-[-17px] right-[-17px] h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />;
                }
                return (
                  <div key={idx} className={cellClass}>
                    {hLine}
                    <SkeletonNode node={child} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const OrganigramaSkeleton = () => (
    <div className="flex flex-col items-center">
      <SkeletonCard />
      <div className="w-[3px] h-[32px] bg-slate-300 dark:bg-slate-700 -mt-2 -mb-1 relative z-0" />
      <div className="flex gap-8 items-start relative px-4">
        {SKELETON_SHAPE.map((child, idx) => {
          let cellClass = "flex flex-col items-center relative pt-6 after:content-[''] after:absolute after:top-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-[3px] after:h-[28px] after:bg-slate-300 dark:after:bg-slate-700";
          let hLine =
            idx === 0 ? (
              <div className="absolute top-0 left-1/2 right-[-17px] h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />
            ) : idx === SKELETON_SHAPE.length - 1 ? (
              <div className="absolute top-0 left-[-17px] right-1/2 h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />
            ) : (
              <div className="absolute top-0 left-[-17px] right-[-17px] h-0 border-t-[3px] border-slate-300 dark:border-slate-700" />
            );
          return (
            <div key={idx} className={cellClass}>
              {hLine}
              <SkeletonNode node={child} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Tarjeta de ocupante de plaza (titular / superior) ─────────────────────
  const PosicionOcupanteCard = ({ label, posicion, info, loading, fieldKey, node }) => {
    const isEditing = editingField === fieldKey;
    const isSaving = savingField === fieldKey;

    return (
      <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-850/80 text-xs">
        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-rose-800" />
            {label}
          </span>
          {!isEditing && (
            <span className="flex items-center gap-1.5 shrink-0">
              {posicion && posicion !== "(en blanco)" && (
                <button
                  onClick={() => applyPlazaChange(
                    fieldKey === "titular" ? "num_posicion_gerente" : "posicion_director",
                    fieldKey,
                    node,
                    "(en blanco)",
                    null
                  )}
                  disabled={savingField !== null}
                  title="Quitar asignación"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold normal-case tracking-normal text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <X className="w-3 h-3" />
                  Quitar
                </button>
              )}
              <button
                onClick={() => { setEditingField(fieldKey); setEmpSearchQuery(""); setEmpSearchResults([]); }}
                disabled={savingField !== null}
                title="Cambiar plaza"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold normal-case tracking-normal text-rose-900 dark:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Pencil className="w-3 h-3" />
                Cambiar
              </button>
            </span>
          )}
        </h4>

        {isEditing ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Buscar nombre, plaza o Nº empleado..."
                value={empSearchQuery}
                onChange={e => setEmpSearchQuery(e.target.value)}
                disabled={isSaving}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-800 text-slate-800 dark:text-slate-100 disabled:opacity-50"
              />
            </div>

            {isSaving ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Actualizando plaza...</span>
              </div>
            ) : (
              <>
                {empSearching && (
                  <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 py-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Buscando...</span>
                  </div>
                )}
                {!empSearching && empSearchQuery.trim().length >= 3 && empSearchResults.length === 0 && (
                  <p className="text-slate-400 dark:text-slate-500 py-1">Sin resultados.</p>
                )}
                {!empSearching && empSearchQuery.trim().length > 0 && empSearchQuery.trim().length < 3 && (
                  <p className="text-slate-400 dark:text-slate-500 py-1">Escribe al menos 3 caracteres.</p>
                )}
                {empSearchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-150 dark:border-slate-800">
                    {empSearchResults.map(emp => (
                      <button
                        key={emp.posicion}
                        onClick={() => applyPlazaChange(
                          fieldKey === "titular" ? "num_posicion_gerente" : "posicion_director",
                          fieldKey,
                          node,
                          emp.posicion,
                          emp
                        )}
                        className="w-full text-left p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <div className="font-semibold text-[11px] text-slate-800 dark:text-slate-200 truncate">{emp.nombre}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">Plaza {emp.posicion} · Nivel {emp.nivel || "N/A"}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setEditingField(null); setEmpSearchQuery(""); setEmpSearchResults([]); }}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Cancelar
                </button>
              </>
            )}
          </div>
        ) : !posicion || posicion === "(en blanco)" ? (
          <p className="text-slate-400 dark:text-slate-500">Sin plaza asignada.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Consultando plaza {posicion}...</span>
          </div>
        ) : !info || info.error ? (
          <p className="text-slate-400 dark:text-slate-500">No se pudo consultar la plaza {posicion}.</p>
        ) : !info.activa ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 flex items-start gap-2">
            <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
            <div>Plaza <strong className="font-mono">{posicion}</strong> inactiva al día de hoy.</div>
          </div>
        ) : info.vacante ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2.5 rounded-xl text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>Plaza <strong className="font-mono">{posicion}</strong> activa, vacante.</div>
          </div>
        ) : (
          <div className="space-y-1.5 text-slate-650 dark:text-slate-400">
            <p><strong className="text-slate-800 dark:text-slate-200">{info.nombre}</strong></p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-450">
              <span>Plaza: {posicion}</span>
              <span>Nº Empleado: {info.num_empleado}</span>
              <span>Estado Nómina: {info.estado_nomina}</span>
            </div>
          </div>
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
            <div className="py-8">
              <OrganigramaSkeleton />
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
              Unidad de Negocio
            </label>
            <button
              onClick={() => { setCreateGeneralError(null); setShowCreateGeneral(true); }}
              title="Crear nueva Dirección General"
              className="flex items-center gap-1 text-[9px] font-bold text-rose-900 dark:text-rose-700 hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Nueva Dirección General
            </button>
          </div>
          <UnidadSelector
            unidades={unidades}
            loading={unidadesLoading}
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[88vh]">
            <div className="h-2 bg-gradient-to-r from-rose-800 via-rose-700 to-amber-500" />
            <button
              onClick={() => (isEditingNode ? handleCancelEdit() : setSelectedNode(null))}
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
                {isEditingNode ? (
                  <input
                    type="text"
                    autoFocus
                    value={editForm.descripcion_larga}
                    onChange={e => setEditForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                    disabled={savingEdit}
                    className="w-full text-xl font-black text-slate-900 dark:text-slate-50 leading-tight bg-transparent border-b-2 border-rose-800 focus:outline-none pb-1 disabled:opacity-50"
                  />
                ) : (
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                    {selectedNode.descripcion_larga}
                  </h2>
                )}
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                  ID: {selectedNode.departamento}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Nivel Jerárquico</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.nivel_direccion || "Depto."}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Unidad de Negocio</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.unidad_negocio}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Unidad Administrativa</span>
                  {isEditingNode ? (
                    <input type="text" value={editForm.unidad_administrativa}
                      onChange={e => setEditForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                      disabled={savingEdit}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50" />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.unidad_administrativa}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">DOAF</span>
                  {isEditingNode ? (
                    <input type="text" value={editForm.doaf}
                      onChange={e => setEditForm(f => ({ ...f, doaf: e.target.value }))}
                      disabled={savingEdit}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800 disabled:opacity-50" />
                  ) : (
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.doaf}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Plaza Titular (Gerente)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.num_posicion_gerente || "N/A"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Plaza Superior (Reporte)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedNode.posicion_director || "N/A"}</span>
                </div>
              </div>
              {isEditingNode && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug -mt-2">
                  Nivel jerárquico y unidad de negocio no son editables aquí: van codificados en el ID del departamento y en la jerarquía del árbol. Para eso, crea el nodo correcto bajo el padre indicado y elimina este.
                </p>
              )}
              {isEditingNode && editError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{editError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PosicionOcupanteCard
                  label="Plaza Titular"
                  posicion={selectedNode.num_posicion_gerente}
                  info={posInfo.titular}
                  loading={posLoading.titular}
                  fieldKey="titular"
                  node={selectedNode}
                />
                <PosicionOcupanteCard
                  label="Plaza Superior (Reporte)"
                  posicion={selectedNode.posicion_director}
                  info={posInfo.superior}
                  loading={posLoading.superior}
                  fieldKey="superior"
                  node={selectedNode}
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setTimeout(() => {
                    document.getElementById(`node-${selectedNode.departamento}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
                disabled={isEditingNode}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-900 dark:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                <Locate className="w-4 h-4" />
                <span>Centrar en Organigrama</span>
              </button>
              <div className="flex items-center gap-2">
                {isEditingNode ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingEdit}
                      className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40 cursor-pointer">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                      {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Guardar cambios</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if ((selectedNode.subordinados?.length || 0) > 0) return;
                        setDeleteError(null);
                        setShowDeleteConfirm(true);
                      }}
                      disabled={(selectedNode.subordinados?.length || 0) > 0}
                      title={(selectedNode.subordinados?.length || 0) > 0 ? "Elimina primero sus subordinados." : "Eliminar departamento"}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-800 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                    <button
                      onClick={handleOpenEdit}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all cursor-pointer">
                      <Pencil className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    {Object.keys(TIPO_LABELS).some(t => LEVEL_SEGPOS[t] > (LEVEL_SEGPOS[selectedNode.nivel_direccion] ?? -1)) && (
                      <button
                        onClick={() => { setCreateChildError(null); setChildForm(emptyChildForm); setShowCreateChild(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-800/10">
                        <Plus className="w-4 h-4" />
                        <span>Agregar subordinado</span>
                      </button>
                    )}
                    <button onClick={() => setSelectedNode(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-250 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all cursor-pointer">
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Confirmar borrado ────────────────────────────────────── */}
      {showDeleteConfirm && selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-800" />
              Eliminar departamento
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              ¿Eliminar <strong className="font-mono">{selectedNode.departamento}</strong> — {selectedNode.descripcion_larga}? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2 mb-4">
                <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deletingNode}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleDeleteNode}
                disabled={deletingNode}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {deletingNode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sí, eliminar
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

      {/* ── MODAL: Crear nueva Dirección General (abre lienzo nuevo) ─────── */}
      {showCreateGeneral && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-rose-800" />
              Nueva Dirección General
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Crea una raíz nueva (nivel General) y abre su propio lienzo. unidad_negocio y
              departamento son códigos oficiales asignados externamente: captúralos tal cual.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">unidad_negocio *</label>
                <input type="text" value={generalForm.unidad_negocio}
                  onChange={e => setGeneralForm(f => ({ ...f, unidad_negocio: e.target.value }))}
                  placeholder="Ej. 01000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">departamento (determinante) *</label>
                <input type="text" value={generalForm.departamento}
                  onChange={e => setGeneralForm(f => ({ ...f, departamento: e.target.value }))}
                  placeholder="Ej. 01000000000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Descripción *</label>
                <input type="text" value={generalForm.descripcion_larga}
                  onChange={e => setGeneralForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                  placeholder="Ej. Dirección General de..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Unidad Administrativa</label>
                  <input type="text" value={generalForm.unidad_administrativa}
                    onChange={e => setGeneralForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">DOAF</label>
                  <input type="text" value={generalForm.doaf}
                    onChange={e => setGeneralForm(f => ({ ...f, doaf: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Plaza titular (opcional)</label>
                <input type="text" value={generalForm.num_posicion_gerente}
                  onChange={e => setGeneralForm(f => ({ ...f, num_posicion_gerente: e.target.value }))}
                  placeholder="Se puede asignar después"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              {createGeneralError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{createGeneralError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateGeneral(false); setGeneralForm(emptyGeneralForm); setCreateGeneralError(null); }}
                disabled={creatingGeneral}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleCreateGeneral}
                disabled={creatingGeneral}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {creatingGeneral && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crear y abrir lienzo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear subordinado bajo selectedNode ───────────────────── */}
      {showCreateChild && selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Plus className="w-5 h-5 text-rose-800" />
              Agregar subordinado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bajo <strong className="font-mono">{selectedNode.departamento}</strong> — {selectedNode.descripcion_larga}.
              El determinante se genera automáticamente.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Tipo *</label>
                <select value={childForm.tipo}
                  onChange={e => setChildForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800">
                  <option value="">Selecciona...</option>
                  {Object.entries(TIPO_LABELS)
                    .filter(([tipo]) => LEVEL_SEGPOS[tipo] > (LEVEL_SEGPOS[selectedNode.nivel_direccion] ?? -1))
                    .map(([tipo, label]) => (
                      <option key={tipo} value={tipo}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Descripción *</label>
                <input type="text" value={childForm.descripcion_larga}
                  onChange={e => setChildForm(f => ({ ...f, descripcion_larga: e.target.value }))}
                  placeholder="Ej. Subdirección de..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Unidad Administrativa</label>
                  <input type="text" value={childForm.unidad_administrativa}
                    onChange={e => setChildForm(f => ({ ...f, unidad_administrativa: e.target.value }))}
                    placeholder={selectedNode.unidad_administrativa || ""}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">DOAF</label>
                  <input type="text" value={childForm.doaf}
                    onChange={e => setChildForm(f => ({ ...f, doaf: e.target.value }))}
                    placeholder={selectedNode.doaf || ""}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1 block">Plaza titular (opcional)</label>
                <input type="text" value={childForm.num_posicion_gerente}
                  onChange={e => setChildForm(f => ({ ...f, num_posicion_gerente: e.target.value }))}
                  placeholder="Se puede asignar después"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-800" />
              </div>
              {createChildError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-2.5 rounded-xl text-rose-950 dark:text-rose-300 text-xs flex items-start gap-2">
                  <BadgeAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-800" />
                  <span>{createChildError}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateChild(false); setChildForm(emptyChildForm); setCreateChildError(null); }}
                disabled={creatingChild}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={handleCreateChild}
                disabled={creatingChild}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-900 hover:bg-rose-950 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
                {creatingChild && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Crear subordinado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast: cambio de plaza confirmado, con opción de revertir ────── */}
      {changeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{changeToast.message}</span>
          </div>
          <button
            onClick={changeToast.onUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Revertir...
          </button>
          <button
            onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setChangeToast(null); }}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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

export default function OrganigramaPage() {
  return (
    <RequirePermission permission={PERMISSIONS.VIEW_ORGANIGRAMA}>
      <OrganigramaContent />
    </RequirePermission>
  );
}
