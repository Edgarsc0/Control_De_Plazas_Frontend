'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Select from 'react-select';
import {
  FileText,
  CheckCircle2,
  Info,
  User,
  Building2,
  ClipboardList,
  Search,
  ChevronRight,
  TrendingUp,
  Filter,
  X,
  Eye,
  Loader2,
  Tag,
  Check,
} from 'lucide-react';
import { PieChart, Counter } from '@/components/ui/BentoMiniComponents';
import { ControlGestionService } from '@/services/control_gestion.service';
import DetailModal from '@/components/OficioDetailModal';
import { customSelectStyles } from '@/components/OficioSelectStyles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ColumnResizer = ({ onResize }) => {
  const [isResizing, setIsResizing] = useState(false);

  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    let startX = e.pageX;

    const onMouseMove = (moveEvent) => {
      const currentX = moveEvent.pageX;
      const delta = currentX - startX;
      onResize(delta);
      startX = currentX;
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-50 flex justify-center group/resizer transform translate-x-1/2`}
    >
      <div className={`h-full w-[3px] transition-colors ${isResizing ? 'bg-[#621f32]' : 'bg-transparent group-hover/resizer:bg-[#621f32]/40'}`} />
    </div>
  );
};

export default function OficiosTurnadosDO({ oficiosTurnados }) {
  const [localOficiosData, setLocalOficiosData] = useState({
    distribucionPorStatus: oficiosTurnados?.distribucionPorStatus || [],
    detalleTurnados: oficiosTurnados?.detalleTurnados || []
  });

  const { distribucionPorStatus, detalleTurnados } = localOficiosData;

  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [expedienteData, setExpedienteData] = useState(null);
  const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(null);

  const tableRef = React.useRef(null);
  const [columnWidths, setColumnWidths] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    if (tableRef.current) {
      // Calculamos el ancho disponible equitativo inicial
      const totalWidth = tableRef.current.offsetWidth || 1200;
      const cols = 7;
      const equalWidth = Math.floor(totalWidth / cols);

      setColumnWidths({
        folio: equalWidth,
        tema: equalWidth,
        origen: equalWidth,
        unidadArea: equalWidth,
        clasificacion: equalWidth,
        estado: equalWidth,
        accion: equalWidth
      });
    }
  }, []);

  const handleResize = (column, deltaX) => {
    setColumnWidths(prev => {
      const currentWidth = prev[column];
      if (typeof currentWidth !== 'number') return prev; // Proteccion si aun no está montado
      return {
        ...prev,
        [column]: Math.max(currentWidth + deltaX, 80)
      };
    });
  };

  const handleUpdateClasificacion = (idTurnado, nuevaClasificacion) => {
    setLocalOficiosData(prev => ({
      ...prev,
      detalleTurnados: prev.detalleTurnados.map(item => 
        item.idTurnado === idTurnado 
          ? { ...item, clasificacion: nuevaClasificacion }
          : item
      )
    }));
    
    // Si el item seleccionado es el que se actualizó, refrescamos su estado local también
    if (selectedItem && selectedItem.idTurnado === idTurnado) {
      setSelectedItem(prev => ({ ...prev, clasificacion: nuevaClasificacion }));
    }
  };

  const handleStatusBadgeClick = (statusTurnado) => {
    setFilters(prev => {
      const currentStatusFilters = prev.status || [];
      const exists = currentStatusFilters.some(f => f.value === statusTurnado);
      let newStatusFilters;
      if (exists) {
        newStatusFilters = currentStatusFilters.filter(f => f.value !== statusTurnado);
      } else {
        newStatusFilters = [...currentStatusFilters, { value: statusTurnado, label: statusTurnado }];
      }
      return {
        ...prev,
        status: newStatusFilters
      };
    });
  };

  const [filters, setFilters] = useState({
    folio: [],
    descripcion: '',
    remitente: [],
    unidad: [],
    status: [],
    tema: [],
    unidadResponsable: [],
    instruccion: [],
    prioridad: [],
    oficioSearch: '',
    clasificacion: [],
  });

  const statusColorMap = useMemo(() => {
    const map = {};
    const statuses = distribucionPorStatus.map(s => s.statusTurnado).filter(Boolean);
    const palette = [
      '#621f32', // Guinda
      '#bc955c', // Oro
      '#3b82f6', // Azul
      '#10b981', // Verde
      '#8b5cf6', // Morado
      '#ec4899', // Rosa
      '#f59e0b', // Naranja
      '#14b8a6', // Teal
      '#f43f5e', // Rose
    ];

    // First pass: assign explicit known statuses to distinct colors
    statuses.forEach((status) => {
      const s = status.toLowerCase();
      if (s === 'concluido') {
        map[status] = '#10b981'; // Verde (Concluido)
      } else if (s === 'atendido') {
        map[status] = '#621f32'; // Guinda (Atendido)
      } else if (s === 'recibido') {
        map[status] = '#bc955c'; // Oro (Recibido)
      } else if (s === 'en proceso' || s === 'proceso') {
        map[status] = '#3b82f6'; // Azul (En proceso)
      } else if (s === 'en trámite' || s === 'en tramite' || s === 'trámite' || s === 'tramite') {
        map[status] = '#8b5cf6'; // Morado (En trámite)
      }
    });

    // Second pass: assign unique remaining colors to other statuses
    let paletteIndex = 0;
    statuses.forEach((status) => {
      if (!map[status]) {
        const usedColors = Object.values(map);
        const availableColors = palette.filter(c => !usedColors.includes(c));
        if (availableColors.length > 0) {
          map[status] = availableColors[0];
        } else {
          map[status] = palette[paletteIndex % palette.length];
          paletteIndex++;
        }
      }
    });
    return map;
  }, [distribucionPorStatus]);

  const getStatusConfig = (status) => {
    const s = status?.toLowerCase();
    const color = statusColorMap[status] || '#94a3b8';

    return {
      label: status,
      color: color,
      icon: s === 'recibido' ? Info : (s === 'atendido' || s === 'concluido' ? CheckCircle2 : FileText),
      styleBadge: {
        backgroundColor: `${color}1A`,
        color: color,
        borderColor: `${color}33`,
      },
      styleDot: {
        backgroundColor: color,
      }
    };
  };

  const distinctOptions = useMemo(() => {
    const getOpts = (key, fallbackKey) => {
      const values = detalleTurnados.map(
        (i) => i[key] || (fallbackKey ? i[fallbackKey] : null),
      );
      return [...new Set(values)]
        .filter(Boolean)
        .sort()
        .map((val) => ({ value: val, label: val }));
    };

    return {
      folio: (() => {
        const folios = detalleTurnados.map((i) => i.asuntoFolio);
        const oficios = detalleTurnados.map((i) => i.asuntoNoOficio);
        return [...new Set([...folios, ...oficios])]
          .filter(Boolean)
          .sort()
          .map((val) => ({ value: val, label: val }));
      })(),
      remitente: getOpts('asuntoRemitente'),
      unidad: getOpts('unidadArea'),
      status: getOpts('statusTurnado'),
      tema: getOpts('asuntoTema'),
      unidadResponsable: getOpts('unidadArea'),
      instruccion: getOpts('nombreInstruccionCruzada', 'nombreInstruccion'),
      prioridad: getOpts('asuntoPrioridad'),
      clasificacion: getOpts('clasificacion'),
    };
  }, [detalleTurnados]);

  const filteredData = useMemo(() => {
    return detalleTurnados.filter((item) => {
      const matchGlobal =
        !globalSearch ||
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(globalSearch.toLowerCase()),
        );
      const matchFolio =
        !filters.folio?.length ||
        filters.folio.some((f) => f.value === item.asuntoFolio || f.value === item.asuntoNoOficio);
      const matchOficioSearch =
        !filters.oficioSearch ||
        item.asuntoNoOficio?.toLowerCase().includes(filters.oficioSearch.toLowerCase()) ||
        item.asuntoFolio?.toLowerCase().includes(filters.oficioSearch.toLowerCase());
      const matchDesc =
        !filters.descripcion ||
        item.asuntoDescripcion
          ?.toLowerCase()
          .includes(filters.descripcion.toLowerCase());
      const matchRemitente =
        !filters.remitente?.length ||
        filters.remitente.some((f) => f.value === item.asuntoRemitente);
      const matchUnidad =
        !filters.unidad?.length ||
        filters.unidad.some((f) => f.value === item.unidadArea);
      const matchStatus =
        !filters.status?.length ||
        filters.status.some((f) => f.value === item.statusTurnado);
      const matchTema =
        !filters.tema?.length ||
        filters.tema.some((f) => f.value === item.asuntoTema);
      const matchUR =
        !filters.unidadResponsable?.length ||
        filters.unidadResponsable.some(
          (f) => f.value === item.unidadArea,
        );
      const matchInstruccion =
        !filters.instruccion?.length ||
        filters.instruccion.some(
          (f) =>
            f.value ===
            (item.nombreInstruccionCruzada || item.nombreInstruccion),
        );
      const matchPrioridad =
        !filters.prioridad?.length ||
        filters.prioridad.some((f) => f.value === item.asuntoPrioridad);
      const matchClasificacion =
        !filters.clasificacion?.length ||
        filters.clasificacion.some((f) => f.value === item.clasificacion);

      return (
        matchGlobal &&
        matchFolio &&
        matchOficioSearch &&
        matchDesc &&
        matchRemitente &&
        matchUnidad &&
        matchStatus &&
        matchTema &&
        matchUR &&
        matchInstruccion &&
        matchPrioridad &&
        matchClasificacion
      );
    });
  }, [detalleTurnados, globalSearch, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [globalSearch, filters]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const handleFilterChange = (column, value) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
  };

  const currentIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return filteredData.findIndex((item) => item.idTurnado === selectedItem.idTurnado);
  }, [filteredData, selectedItem]);

  const handleNextItem = () => {
    if (currentIndex < filteredData.length - 1) {
      handleSelectItem(filteredData[currentIndex + 1]);
    }
  };

  const handlePreviousItem = () => {
    if (currentIndex > 0) {
      handleSelectItem(filteredData[currentIndex - 1]);
    }
  };

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setIsLoadingExpediente(true);
    setExpedienteData(null);
    setCurrentPdfUrl(null);
    try {
      const data = await ControlGestionService.getExpedienteAsunto(
        item.idAsunto,
      );
      if (data.status === 200) {
        setExpedienteData(data);
        const firstDoc =
          data.model?.documentos?.[0] ||
          data.model?.respuestas?.[0] ||
          data.model?.anexos?.[0];
        if (firstDoc) {
          handlePreviewDocument(
            firstDoc.ruta || firstDoc.nombre,
            item.idAsunto,
          );
        }
      }
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    } finally {
      setIsLoadingExpediente(false);
    }
  };

  const handlePreviewDocument = async (relativePath, forceId = null) => {
    const idToUse = forceId || selectedItem?.idAsunto;
    if (!idToUse) return;

    setIsPreviewing(true);
    try {
      const blob = await ControlGestionService.getVisualizarDocumento(
        idToUse,
        relativePath,
      );
      const url = window.URL.createObjectURL(blob);
      setCurrentPdfUrl(url);
    } catch (error) {
      console.error('Error al previsualizar documento:', error);
    } finally {
      setIsPreviewing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (currentPdfUrl) window.URL.revokeObjectURL(currentPdfUrl);
    };
  }, [currentPdfUrl]);

  const chartData = distribucionPorStatus.map((s) => {
    const config = getStatusConfig(s.statusTurnado);
    return {
      label: s.statusTurnado,
      count: s.cantidad,
      percent: s.porcentaje / 100,
      color: config.color,
    };
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-10 pb-20 font-sans">
        {isPreviewing && (
          <div className="fixed inset-0 z-[100000] bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[#621f32] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">
                Generando Vista Previa...
              </span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedItem && (
            <DetailModal
              item={selectedItem}
              expediente={expedienteData}
              isLoading={isLoadingExpediente}
              pdfUrl={currentPdfUrl}
              isPreviewing={isPreviewing}
              onPreview={handlePreviewDocument}
              onUpdate={handleUpdateClasificacion}
              onNext={handleNextItem}
              onPrevious={handlePreviousItem}
              hasNext={currentIndex < filteredData.length - 1}
              hasPrevious={currentIndex > 0}
              onClose={() => {
                setSelectedItem(null);
                setExpedienteData(null);
                setCurrentPdfUrl(null);
              }}
            />
          )}
        </AnimatePresence>

        <div className="relative overflow-hidden rounded-2xl shadow-lg border border-[#621f32]/10"
             style={{ background: 'linear-gradient(135deg, #621f32 0%, #4e1828 60%, #3a1120 100%)' }}>
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
          <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 p-7 md:p-10">
            <div className="flex items-center gap-5">
              <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                <ClipboardList className="w-9 h-9 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400/80 text-[9px] font-bold uppercase tracking-[0.3em] mb-1">
                  Control de Gestión
                </p>
                <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight leading-none">
                  Oficios Turnados a DO
                </h1>
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                  <span className="w-4 h-px bg-white/20" />Dirección de Organización
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="px-6 py-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 flex flex-col items-end text-right">
                <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Total de Oficios</p>
                <p className="text-3xl font-black text-white tabular-nums"><Counter target={detalleTurnados.length} /></p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] py-8 px-10 border border-white/40 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="relative shrink-0">
                <PieChart data={chartData} size={150} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Total</span>
                  <span className="text-2xl font-black text-[#621f32] tracking-tighter tabular-nums leading-none">{detalleTurnados.length}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <div className="w-6 h-0.5 bg-[#bc955c]/30 rounded-full" />
                  <h3 className="text-[10px] font-black text-[#bc955c] uppercase tracking-[0.3em]">Distribución Institucional</h3>
                </div>
                <p className="text-2xl font-black text-gray-900 leading-none tracking-tight">Panorama General de Turnados</p>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 pt-1"><TrendingUp className="size-3 text-emerald-500" />Resumen ejecutivo de estatus</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 flex-1">
              {distribucionPorStatus.map((status, idx) => {
                const config = getStatusConfig(status.statusTurnado);
                const isSelected = filters.status?.some(f => f.value === status.statusTurnado);
                return (
                  <motion.div
                    key={status.statusTurnado}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isSelected ? 1.05 : 1,
                    }}
                    whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    onClick={() => handleStatusBadgeClick(status.statusTurnado)}
                    className={`flex items-center gap-4 py-4 px-6 rounded-3xl cursor-pointer transition-all duration-300 group min-w-[180px] ${
                      isSelected 
                        ? 'shadow-lg border-2 font-semibold' 
                        : 'bg-white border border-gray-100 hover:shadow-md hover:border-[#621f32]/10'
                    }`}
                    style={{ 
                      borderColor: isSelected ? config.color : undefined,
                      backgroundColor: isSelected ? `${config.color}10` : undefined 
                    }}
                  >
                    {isSelected ? (
                      <Check className="size-4 shrink-0" style={{ color: config.color }} />
                    ) : (
                      <div className="size-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: config.color }} />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 truncate">{status.statusTurnado}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-gray-900 tabular-nums leading-none"><Counter target={status.cantidad} /></span>
                        <span className="text-[10px] font-black" style={{ color: config.color }}>{status.porcentaje}%</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-[#621f32] flex items-center justify-center shadow-md"><FileText className="w-4 h-4 text-[#bc955c]" /></div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.25em]">Base de Datos de Turnados</h3>
            </div>
            <div className="relative w-96 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4 group-focus-within:text-[#621f32] transition-colors" />
              <input type="text" placeholder="Búsqueda global..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="w-full pl-11 pr-10 py-3 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-[#621f32]/5 focus:border-[#621f32]/40 transition-all" />
              {globalSearch && <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 transition-colors"><X className="size-3.5" /></button>}
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/80 shadow-2xl overflow-hidden ring-1 ring-black/[0.05]">
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-150px)] relative">
              <table ref={tableRef} className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                <thead className="sticky top-0 z-[100]">
                  <tr className="bg-gradient-to-b from-gray-50/95 to-gray-100/95 backdrop-blur-md border-b-2 border-[#621f32]/10 shadow-sm">
                    <th style={{ width: columnWidths.folio || "14.28%", minWidth: columnWidths.folio ? Math.max(columnWidths.folio, 80) : "14.28%", maxWidth: columnWidths.folio || "14.28%" }} className="px-6 py-6 align-top sticky top-0 relative group">
                      <ColumnResizer onResize={(delta) => handleResize('folio', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Folio / Oficio</span>
                        </div>
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-3 h-3 group-focus-within:text-[#621f32] transition-colors" />
                          <input type="text" placeholder="Buscar por oficio..." value={filters.oficioSearch || ''} onChange={(e) => handleFilterChange('oficioSearch', e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#621f32]/40 focus:ring-2 focus:ring-[#621f32]/10 transition-all" />
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-folio" isClearable isSearchable placeholder="Filtrar..." options={distinctOptions.folio} value={filters.folio} onChange={(v) => handleFilterChange('folio', v)} styles={customSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-clasificacion" isClearable isSearchable placeholder="Tipo Asunto..." options={distinctOptions.clasificacion} value={filters.clasificacion} onChange={(v) => handleFilterChange('clasificacion', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.tema || "14.28%", minWidth: columnWidths.tema ? Math.max(columnWidths.tema, 80) : "14.28%", maxWidth: columnWidths.tema || "14.28%" }} className="px-6 py-6 align-top relative group">
                      <ColumnResizer onResize={(delta) => handleResize('tema', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Tema Principal</span>
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-tema" isClearable isSearchable placeholder="Filtrar tema..." options={distinctOptions.tema} value={filters.tema} onChange={(v) => handleFilterChange('tema', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.origen || "14.28%", minWidth: columnWidths.origen ? Math.max(columnWidths.origen, 80) : "14.28%", maxWidth: columnWidths.origen || "14.28%" }} className="px-6 py-6 align-top relative group">
                      <ColumnResizer onResize={(delta) => handleResize('origen', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#bc955c] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Origen / Unidad</span>
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-remitente" isClearable isSearchable placeholder="Remitente..." options={distinctOptions.remitente} value={filters.remitente} onChange={(v) => handleFilterChange('remitente', v)} styles={customSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-unidad" isClearable isSearchable placeholder="Unidad..." options={distinctOptions.unidad} value={filters.unidad} onChange={(v) => handleFilterChange('unidad', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.unidadArea || "14.28%", minWidth: columnWidths.unidadArea ? Math.max(columnWidths.unidadArea, 80) : "14.28%", maxWidth: columnWidths.unidadArea || "14.28%" }} className="px-6 py-6 align-top relative group">
                      <ColumnResizer onResize={(delta) => handleResize('unidadArea', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Unidad Área</span>
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-ur" isClearable isSearchable placeholder="Filtrar Unidad..." options={distinctOptions.unidadResponsable} value={filters.unidadResponsable} onChange={(v) => handleFilterChange('unidadResponsable', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.clasificacion || "14.28%", minWidth: columnWidths.clasificacion ? Math.max(columnWidths.clasificacion, 80) : "14.28%", maxWidth: columnWidths.clasificacion || "14.28%" }} className="px-6 py-6 align-top relative group">
                      <ColumnResizer onResize={(delta) => handleResize('clasificacion', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#bc955c] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Clasificación</span>
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-instruccion" isClearable isSearchable placeholder="Instrucción..." options={distinctOptions.instruccion} value={filters.instruccion} onChange={(v) => handleFilterChange('instruccion', v)} styles={customSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-prioridad" isClearable isSearchable placeholder="Prioridad..." options={distinctOptions.prioridad} value={filters.prioridad} onChange={(v) => handleFilterChange('prioridad', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.estado || "14.28%", minWidth: columnWidths.estado ? Math.max(columnWidths.estado, 80) : "14.28%", maxWidth: columnWidths.estado || "14.28%" }} className="px-6 py-6 align-top relative group">
                      <ColumnResizer onResize={(delta) => handleResize('estado', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Estado</span>
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-status" isClearable isSearchable placeholder="Estado..." options={distinctOptions.status} value={filters.status} onChange={(v) => handleFilterChange('status', v)} styles={customSelectStyles} />
                      </div>
                    </th>
                    <th style={{ width: columnWidths.accion || "14.28%", minWidth: columnWidths.accion ? Math.max(columnWidths.accion, 80) : "14.28%", maxWidth: columnWidths.accion || "14.28%" }} className="px-6 py-6 align-top relative group text-center">
                      <ColumnResizer onResize={(delta) => handleResize('accion', delta)} />
                      <div className="space-y-3 w-full min-w-0 overflow-hidden">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className="w-1.5 h-4 bg-[#bc955c] rounded-full" />
                          <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Acción</span>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#621f32]/5">
                  <AnimatePresence mode="popLayout">
                    {paginatedData.map((item, index) => {
                      const config = getStatusConfig(item.statusTurnado);
                      const priorityConfig = { Alta: 'text-red-600 bg-red-50 border-red-100', Media: 'text-amber-600 bg-amber-50 border-amber-100', Baja: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
                      const pStyle = priorityConfig[item.asuntoPrioridad] || 'text-gray-500 bg-gray-50 border-gray-100';
                      return (
                        <motion.tr key={item.idTurnado} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className={`group hover:bg-[#621f32]/[0.04] transition-colors cursor-default ${index % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`}>
                          <td className="px-6 py-7 align-top relative">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col gap-1.5 pt-1 cursor-help">
                                  {item.clasificacion && (
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <Tag className="size-2.5 text-[#bc955c]" />
                                      <span className="text-[8px] font-black text-[#bc955c] uppercase tracking-wider">{item.clasificacion}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#bc955c]" />
                                    <span className="text-[12px] font-black text-[#621f32] tracking-tight">{item.asuntoNoOficio}</span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold text-gray-400 bg-white/50 px-2 py-0.5 rounded-md border border-gray-100 w-fit">{item.asuntoFolio}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center" sideOffset={10} className="z-[9999999] bg-transparent border-none p-0 shadow-none max-w-none">
                                <div className="bg-white/95 text-gray-800 p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 backdrop-blur-2xl max-w-md ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="p-1.5 bg-[#621f32]/5 rounded-lg"><ClipboardList className="size-3.5 text-[#621f32]" /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#621f32]">Descripción del Asunto</span>
                                  </div>
                                  <p className="text-[11px] font-bold leading-relaxed text-gray-600 italic">"{item.asuntoDescripcion}"</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-6 py-7 align-top">
                            <div className="pt-1.5 flex flex-col gap-2 w-full min-w-0 overflow-hidden"><span className="text-[9px] font-black text-[#621f32] bg-[#621f32]/5 px-3 py-1.5 rounded-xl border border-[#621f32]/10 uppercase tracking-tight leading-tight truncate w-full block">{item.asuntoTema}</span></div>
                          </td>
                          <td className="px-6 py-7 align-top">
                            <div className="flex flex-col gap-3 pt-1 w-full min-w-0">
                              <div className="space-y-1 w-full min-w-0">
                                <div className="flex items-center gap-2"><User className="size-3 text-[#bc955c]" /><span className="text-[10px] font-black text-gray-700 uppercase truncate flex-1 min-w-0">{item.asuntoRemitente}</span></div>
                                <p className="text-[9px] font-bold text-gray-400 pl-5 truncate flex-1 min-w-0">{item.asuntoRemitenteDependencia}</p>
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100/50"><Building2 className="size-3 text-gray-300" /><span className="text-[9px] font-bold text-gray-500 uppercase truncate">{item.unidadArea}</span></div>
                            </div>
                          </td>
                          <td className="px-6 py-7 align-top">
                            <div className="flex items-center gap-2.5 pt-1.5"><div className="p-1.5 bg-[#bc955c]/10 rounded-lg text-[#bc955c]"><Building2 className="size-3.5" /></div><span className="text-[10px] font-black text-[#bc955c] uppercase tracking-tight">{item.unidadArea || 'No asignada'}</span></div>
                          </td>
                          <td className="px-6 py-7 align-top">
                            <div className="flex flex-col gap-3 pt-1 w-full min-w-0">
                              <div className="space-y-1 w-full min-w-0"><span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Instrucción</span><p className="text-[10px] font-black text-[#621f32] leading-tight truncate w-full">{item.nombreInstruccionCruzada || item.nombreInstruccion}</p></div>
                              <div className="flex items-center gap-2"><span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Prioridad</span><div className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-tighter ${pStyle}`}>{item.asuntoPrioridad}</div></div>
                            </div>
                          </td>
                          <td className="px-6 py-7">
                            <div className="flex flex-col gap-2 items-center pt-1">
                              <div className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border flex items-center gap-2 shadow-sm" style={config.styleBadge}><motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="size-1.5 rounded-full" style={config.styleDot} />{item.statusTurnado}</div>
                              <span className="text-[8px] font-bold text-gray-400">{item.fechaRegistro ? new Date(item.fechaRegistro).toLocaleDateString() : ''}</span>
                            </div>
                          </td>
                          <td className="px-6 py-7 align-top">
                            <div className="flex justify-center pt-1"><button onClick={() => handleSelectItem(item)} className="p-3 bg-white hover:bg-[#621f32] border border-gray-100 shadow-sm rounded-2xl text-[#621f32] hover:text-white transition-all duration-300 group/btn" title="Ver detalles"><Eye className="size-4 group-hover/btn:scale-110 transition-transform" /></button></div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filteredData.length === 0 && (
              <div className="p-24 flex flex-col items-center justify-center text-gray-300 gap-6">
                <div className="p-8 bg-white/20 rounded-[2rem] border-2 border-dashed border-gray-100"><Filter className="size-16 opacity-10" /></div>
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-[0.3em]">Sin resultados para los filtros</p>
                  <button onClick={() => setFilters({ folio: null, descripcion: '', remitente: null, unidad: null, status: null, tema: null, unidadResponsable: null, instruccion: null, prioridad: null, oficioSearch: '', clasificacion: null })} className="mt-4 text-[10px] font-black text-[#621f32] uppercase underline underline-offset-4">Limpiar todos los filtros</button>
                </div>
              </div>
            )}

            <div className="px-8 py-5 bg-white/60 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Mostrando <span className="text-[#621f32]">{paginatedData.length}</span> de <span className="text-[#621f32]">{filteredData.length}</span> resultados (Pág. {currentPage} de {totalPages || 1})
                </p>
                {Object.values(filters).some((f) => f !== null && f !== '' && (!Array.isArray(f) || f.length > 0)) && (
                  <button onClick={() => setFilters({ folio: null, descripcion: '', remitente: null, unidad: null, status: null, tema: null, unidadResponsable: null, instruccion: null, prioridad: null, oficioSearch: '', clasificacion: null })} className="flex items-center gap-2 text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"><X className="size-3" />Limpiar Filtros</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-[#621f32] hover:border-[#621f32]/25 transition-all disabled:opacity-30 disabled:hover:text-gray-300 disabled:hover:border-gray-200 cursor-pointer"
                >
                  <ChevronRight className="size-4 rotate-180" />
                </button>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-[#621f32] hover:border-[#621f32]/25 transition-all disabled:opacity-30 disabled:hover:text-gray-300 disabled:hover:border-gray-200 cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
