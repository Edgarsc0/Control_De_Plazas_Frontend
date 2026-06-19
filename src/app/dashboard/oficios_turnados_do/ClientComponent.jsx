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
import { customSelectStyles, headerSelectStyles } from '@/components/OficioSelectStyles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const getColumnLetter = (colIdx) => {
  let letter = "";
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

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
      // Calculamos el ancho disponible equitativo inicial restando los 95px de las columnas fijas (# y VER)
      const totalWidth = tableRef.current.offsetWidth || 1200;
      const cols = 6;
      const equalWidth = Math.floor((totalWidth - 95) / cols);

      setColumnWidths({
        folio: equalWidth,
        tema: equalWidth,
        origen: equalWidth,
        unidadArea: equalWidth,
        clasificacion: equalWidth,
        estado: equalWidth
      });
    }
  }, []);

  const handleResize = (column, deltaX) => {
    setColumnWidths(prev => {
      const currentWidth = prev[column];
      if (typeof currentWidth !== 'number') return prev; // Proteccion si aun no está montado
      return {
        ...prev,
        [column]: Math.max(currentWidth + deltaX, 85)
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
      '#802842', // Guinda Claro
      '#d0ab75', // Oro Claro
      '#967440', // Oro Oscuro / Bronce
      '#1f4e37', // Jade Oscuro (para Concluido/Éxito)
      '#475569', // Slate
      '#ebd1ac', // Crema
      '#a37944', // Café dorado
    ];

    // First pass: assign explicit known statuses to distinct colors
    statuses.forEach((status) => {
      const s = status.toLowerCase();
      if (s === 'concluido') {
        map[status] = '#1f4e37'; // Jade Oscuro (Concluido)
      } else if (s === 'atendido') {
        map[status] = '#621f32'; // Guinda (Atendido)
      } else if (s === 'recibido') {
        map[status] = '#bc955c'; // Oro (Recibido)
      } else if (s === 'en proceso' || s === 'proceso') {
        map[status] = '#d0ab75'; // Oro Claro (En proceso)
      } else if (s === 'en trámite' || s === 'en tramite' || s === 'trámite' || s === 'tramite') {
        map[status] = '#967440'; // Oro Oscuro / Bronce (En trámite)
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
      <div className="space-y-10 pb-0 font-sans">
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

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 w-full pt-8">
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
        </div>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 w-full">
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

        <div className="w-full space-y-6">
          {/* Card Container styled like /plantilla_empleados */}
          <div className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-y border-x-0 border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-none overflow-hidden flex flex-col w-full">
            
            {/* Top Header inside the table card */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-stretch sm:items-center">
                {/* Unified Search Input */}
                <div className="relative w-full sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input 
                    type="text" 
                    placeholder="Buscar en la tabla..." 
                    value={globalSearch} 
                    onChange={(e) => setGlobalSearch(e.target.value)} 
                    className="bg-transparent text-slate-800 dark:text-white text-xs font-bold w-full outline-none placeholder:text-slate-400" 
                  />
                  {globalSearch && (
                    <button onClick={() => setGlobalSearch('')} className="text-slate-400 hover:text-slate-650 ml-1.5">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Total Records Counter */}
                <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none tabular-nums">{filteredData.length}</span>
                </div>
              </div>

              {/* Reset Filters Option */}
              <div className="flex items-center gap-3">
                {Object.values(filters).some(f => f !== null && f !== '' && (!Array.isArray(f) || f.length > 0)) && (
                  <button
                    onClick={() => setFilters({ folio: [], descripcion: '', remitente: [], unidad: [], status: [], tema: [], unidadResponsable: [], instruccion: [], prioridad: [], oficioSearch: '', clasificacion: [] })}
                    className="flex items-center gap-2 px-5 py-3 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 bg-white/80 dark:bg-slate-900/85 hover:bg-red-50/50 dark:hover:bg-red-950/10 text-slate-650 dark:text-slate-300 hover:text-red-750 font-black rounded-xl text-[10px] uppercase transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <X className="size-3.5" />
                    <span>Limpiar Filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Table Container */}
            <div className="overflow-auto relative flex-1 min-h-0 select-none custom-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <table ref={tableRef} className="min-w-full w-full text-left border-collapse table-fixed select-none text-xs text-slate-700 dark:text-slate-350" style={{ width: '100%', minWidth: 95 + Object.values(columnWidths).reduce((sum, w) => sum + w, 0) }}>
                <colgroup>
                  <col style={{ width: 50 }} />
                  <col style={{ width: 45 }} />
                  <col style={{ width: columnWidths.folio || 180 }} />
                  <col style={{ width: columnWidths.tema || 180 }} />
                  <col style={{ width: columnWidths.origen || 220 }} />
                  <col style={{ width: columnWidths.unidadArea || 160 }} />
                  <col style={{ width: columnWidths.clasificacion || 200 }} />
                  <col style={{ width: columnWidths.estado || 160 }} />
                </colgroup>
                
                {/* Header Section */}
                <thead className="bg-[#501929] dark:bg-[#3e131f] text-white sticky top-0 z-30 shadow-md border-b border-[#bc955c]/35">
                  {/* Row 1: Columns Letters and Labels */}
                  <tr>
                    {/* Index Column (#) */}
                    <th className="sticky left-0 top-0 z-40 bg-[#40121e] border-r border-[#621f32]/35 text-center align-middle py-2.5 px-3">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-mono text-[#bc955c]/70">A</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">#</span>
                      </div>
                    </th>
                    {/* Action Column (VER) */}
                    <th className="sticky left-[50px] top-0 z-40 bg-[#40121e] border-r border-[#621f32]/35 text-center align-middle py-2.5 px-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-mono text-[#bc955c]/70">B</span>
                        <span className="text-[10px] font-black text-slate-200 uppercase tracking-wider">VER</span>
                      </div>
                    </th>
                    {/* Dynamic Columns */}
                    {[
                      { key: "folio", label: "Folio / Oficio" },
                      { key: "tema", label: "Tema Principal" },
                      { key: "origen", label: "Origen / Unidad" },
                      { key: "unidadArea", label: "Unidad Área" },
                      { key: "clasificacion", label: "Clasificación / Prioridad" },
                      { key: "estado", label: "Estado" },
                    ].map((col, idx) => {
                      const letter = getColumnLetter(idx + 2); // C, D, E, ...
                      return (
                        <th key={col.key} className="py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#bc955c]/25 relative align-middle">
                          <ColumnResizer onResize={(delta) => handleResize(col.key, delta)} />
                          <div className="flex flex-col items-center gap-0.5 w-full">
                            <span className="text-[8px] font-mono text-[#bc955c]">{letter}</span>
                            <span className="text-[10px] font-black text-slate-200 tracking-wider text-center">{col.label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Row 2: integrated filters per column */}
                  <tr className="bg-[#40121e] dark:bg-[#2b0d15] border-b border-[#bc955c]/25">
                    {/* Clear all filters button cell */}
                    <th className="sticky left-0 z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35 py-2 px-2 text-center align-middle">
                      <button 
                        onClick={() => setFilters({ folio: [], descripcion: '', remitente: [], unidad: [], status: [], tema: [], unidadResponsable: [], instruccion: [], prioridad: [], oficioSearch: '', clasificacion: [] })}
                        disabled={Object.values(filters).every(f => !f || (Array.isArray(f) ? f.length === 0 : f === ''))}
                        title="Limpiar filtros de columna"
                        className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer p-1 rounded-md"
                      >
                        <X className="size-3.5" />
                      </button>
                    </th>
                    
                    {/* VER action spacer cell */}
                    <th className="sticky left-[50px] z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35 py-2 px-2 text-center shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]"></th>
                    
                    {/* Folio / Oficio Column Filters */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <div className="flex flex-col gap-1.5 w-full min-w-0">
                        <div className="relative group w-full">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/45 w-3 h-3 group-focus-within:text-[#bc955c] transition-colors" />
                          <input 
                            type="text" 
                            placeholder="Oficio/Folio..." 
                            value={filters.oficioSearch || ''} 
                            onChange={(e) => handleFilterChange('oficioSearch', e.target.value)} 
                            className="w-full pl-7 pr-3 py-1 bg-white/5 dark:bg-white/5 border border-[#bc955c]/35 rounded-lg text-[9px] font-semibold text-white placeholder:text-white/45 focus:outline-none focus:border-[#bc955c] h-[28px] transition-all font-sans" 
                          />
                        </div>
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-folio" isClearable isSearchable placeholder="Folios..." options={distinctOptions.folio} value={filters.folio} onChange={(v) => handleFilterChange('folio', v)} styles={headerSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-clasificacion" isClearable isSearchable placeholder="Tipo..." options={distinctOptions.clasificacion} value={filters.clasificacion} onChange={(v) => handleFilterChange('clasificacion', v)} styles={headerSelectStyles} />
                      </div>
                    </th>

                    {/* Tema Principal Column Filter */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-tema" isClearable isSearchable placeholder="Temas..." options={distinctOptions.tema} value={filters.tema} onChange={(v) => handleFilterChange('tema', v)} styles={headerSelectStyles} />
                    </th>

                    {/* Origen / Unidad Column Filters */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <div className="flex flex-col gap-1.5 w-full min-w-0">
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-remitente" isClearable isSearchable placeholder="Remitente..." options={distinctOptions.remitente} value={filters.remitente} onChange={(v) => handleFilterChange('remitente', v)} styles={headerSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-unidad" isClearable isSearchable placeholder="Unidad..." options={distinctOptions.unidad} value={filters.unidad} onChange={(v) => handleFilterChange('unidad', v)} styles={headerSelectStyles} />
                      </div>
                    </th>

                    {/* Unidad Área Column Filter */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-ur" isClearable isSearchable placeholder="Unidad área..." options={distinctOptions.unidadResponsable} value={filters.unidadResponsable} onChange={(v) => handleFilterChange('unidadResponsable', v)} styles={headerSelectStyles} />
                    </th>

                    {/* Clasificación / Prioridad Column Filters */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <div className="flex flex-col gap-1.5 w-full min-w-0">
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-instruccion" isClearable isSearchable placeholder="Instrucción..." options={distinctOptions.instruccion} value={filters.instruccion} onChange={(v) => handleFilterChange('instruccion', v)} styles={headerSelectStyles} />
                        <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-prioridad" isClearable isSearchable placeholder="Prioridad..." options={distinctOptions.prioridad} value={filters.prioridad} onChange={(v) => handleFilterChange('prioridad', v)} styles={headerSelectStyles} />
                      </div>
                    </th>

                    {/* Estado Column Filter */}
                    <th className="py-2 px-2 border-r border-[#bc955c]/25 align-middle">
                      <Select menuPortalTarget={typeof document !== 'undefined' ? document.body : null} menuPlacement="auto" isMulti closeMenuOnSelect={false} instanceId="select-status" isClearable isSearchable placeholder="Estatus..." options={distinctOptions.status} value={filters.status} onChange={(v) => handleFilterChange('status', v)} styles={headerSelectStyles} />
                    </th>
                  </tr>
                </thead>

                {/* Body Section */}
                <tbody className="divide-y divide-[#bc955c]/15">
                  <AnimatePresence mode="popLayout">
                    {paginatedData.map((item, index) => {
                      const config = getStatusConfig(item.statusTurnado);
                      const priorityConfig = { 
                        Alta: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/10 border-red-150', 
                        Media: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/10 border-amber-150', 
                        Baja: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/10 border-emerald-150' 
                      };
                      const pStyle = priorityConfig[item.asuntoPrioridad] || 'text-gray-500 bg-gray-50 dark:bg-slate-800 border-gray-150';
                      const isZebra = index % 2 === 0;
                      const rowBg = isZebra ? 'bg-white/40 dark:bg-slate-900/40' : 'bg-transparent';
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;

                      return (
                        <motion.tr 
                          key={item.idTurnado} 
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }} 
                          transition={{ duration: 0.15 }} 
                          className={`group hover:bg-[#621f32]/[0.03] dark:hover:bg-[#bc955c]/[0.03] transition-colors cursor-default border-b border-[#bc955c]/20 ${rowBg}`}
                        >
                          {/* Index cell (sticky) */}
                          <td className="sticky left-0 z-20 bg-white/95 dark:bg-slate-900 border-r border-[#bc955c]/25 text-center font-mono font-bold text-slate-500 py-3 px-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                            {globalIndex}
                          </td>
                          
                          {/* VER cell (sticky) */}
                          <td className="sticky left-[50px] z-20 bg-white/95 dark:bg-slate-900 border-r border-[#bc955c]/25 text-center py-3 px-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                            <button 
                              onClick={() => handleSelectItem(item)} 
                              className="p-1.5 rounded-lg text-[#621f32] dark:text-[#bc955c] hover:bg-[#621f32]/10 dark:hover:bg-[#bc955c]/10 transition-colors cursor-pointer" 
                              title="Ver detalles"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </td>

                          {/* Folio / Oficio */}
                          <td className="py-3 px-4 border-r border-[#bc955c]/20 align-top max-w-xs overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col gap-1.5 cursor-help">
                                  {item.clasificacion && (
                                    <div className="flex items-center gap-1.5">
                                      <Tag className="size-2.5 text-[#bc955c]" />
                                      <span className="text-[8px] font-black text-[#bc955c] uppercase tracking-wider">{item.clasificacion}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#bc955c] shrink-0" />
                                    <span className="text-xs font-black text-[#621f32] dark:text-white tracking-tight truncate">{item.asuntoNoOficio}</span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 w-fit">{item.asuntoFolio}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center" sideOffset={10} className="z-[9999999] bg-transparent border-none p-0 shadow-none max-w-none">
                                <div className="bg-white/95 dark:bg-slate-900 text-gray-800 dark:text-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 backdrop-blur-2xl max-w-md ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="p-1.5 bg-[#621f32]/5 rounded-lg"><ClipboardList className="size-3.5 text-[#621f32]" /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">Descripción del Asunto</span>
                                  </div>
                                  <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-350 italic">"{item.asuntoDescripcion}"</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>

                          {/* Tema Principal */}
                          <td className="py-3 px-4 border-r border-[#bc955c]/20 align-top max-w-xs overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate w-full block text-center">
                              {item.asuntoTema}
                            </span>
                          </td>

                          {/* Origen / Unidad */}
                          <td className="py-3 px-4 border-r border-[#bc955c]/20 align-top max-w-xs overflow-hidden">
                            <div className="flex flex-col gap-2 w-full min-w-0">
                              <div className="space-y-1 w-full min-w-0">
                                <div className="flex items-center gap-2">
                                  <User className="size-3 text-[#bc955c] shrink-0" />
                                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate flex-1 min-w-0">{item.asuntoRemitente}</span>
                                </div>
                                <p className="text-[9px] font-bold text-slate-450 dark:text-slate-500 pl-5 truncate w-full">{item.asuntoRemitenteDependencia}</p>
                              </div>
                              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                <Building2 className="size-3 text-slate-400 shrink-0" />
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate">{item.unidadArea}</span>
                              </div>
                            </div>
                          </td>

                          {/* Unidad Área */}
                          <td className="py-3 px-4 border-r border-[#bc955c]/20 align-top max-w-xs overflow-hidden">
                            <div className="flex items-center gap-2 pt-1">
                              <div className="p-1 bg-[#bc955c]/10 rounded text-[#bc955c] shrink-0">
                                <Building2 className="size-3" />
                              </div>
                              <span className="text-[10px] font-black text-[#bc955c] uppercase tracking-tight truncate">{item.unidadArea || 'No asignada'}</span>
                            </div>
                          </td>

                          {/* Clasificación / Prioridad */}
                          <td className="py-3 px-4 border-r border-[#bc955c]/20 align-top max-w-xs overflow-hidden">
                            <div className="flex flex-col gap-2.5 w-full min-w-0">
                              <div className="space-y-1 w-full min-w-0">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Instrucción</span>
                                <p className="text-[10px] font-black text-[#621f32] dark:text-slate-350 leading-tight truncate w-full">{item.nombreInstruccionCruzada || item.nombreInstruccion}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Prioridad</span>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${item.asuntoPrioridad === 'Alta' ? 'bg-red-500' : item.asuntoPrioridad === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  <span className="text-[9px] font-bold text-slate-650 dark:text-slate-300 uppercase tracking-tight">{item.asuntoPrioridad}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-4 align-top">
                            <div className="flex flex-col gap-1.5 items-center">
                              <div className="flex items-center gap-1.5 py-0.5">
                                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="size-2 rounded-full shrink-0 shadow-sm" style={config.styleDot} />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{item.statusTurnado}</span>
                              </div>
                              <span className="text-[8px] font-bold text-slate-400">{item.fechaRegistro ? new Date(item.fechaRegistro).toLocaleDateString() : ''}</span>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {filteredData.length === 0 && (
              <div className="p-24 flex flex-col items-center justify-center text-slate-300 gap-6">
                <div className="p-8 bg-white/20 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Filter className="size-16 opacity-10" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Sin resultados para los filtros</p>
                  <button onClick={() => setFilters({ folio: [], descripcion: '', remitente: [], unidad: [], status: [], tema: [], unidadResponsable: [], instruccion: [], prioridad: [], oficioSearch: '', clasificacion: [] })} className="mt-4 text-[10px] font-black text-[#621f32] dark:text-[#bc955c] uppercase underline underline-offset-4 cursor-pointer">Limpiar todos los filtros</button>
                </div>
              </div>
            )}

            {/* Sticky bottom pagination & footer */}
            <div className="px-8 py-5 border-t border-slate-200/50 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Mostrando <span className="text-[#621f32] dark:text-[#bc955c]">{paginatedData.length}</span> de <span className="text-[#621f32] dark:text-[#bc955c]">{filteredData.length}</span> resultados (Pág. {currentPage} de {totalPages || 1})
                </p>
                {Object.values(filters).some((f) => f !== null && f !== '' && (!Array.isArray(f) || f.length > 0)) && (
                  <button onClick={() => setFilters({ folio: [], descripcion: '', remitente: [], unidad: [], status: [], tema: [], unidadResponsable: [], instruccion: [], prioridad: [], oficioSearch: '', clasificacion: [] })} className="flex items-center gap-2 text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/20 transition-colors cursor-pointer"><X className="size-3" />Limpiar Filtros</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:border-[#621f32]/25 dark:hover:border-[#bc955c]/25 transition-all disabled:opacity-30 disabled:hover:text-slate-350 disabled:hover:border-slate-200 cursor-pointer"
                >
                  <ChevronRight className="size-4 rotate-180" />
                </button>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:border-[#621f32]/25 dark:hover:border-[#bc955c]/25 transition-all disabled:opacity-30 disabled:hover:text-slate-350 disabled:hover:border-slate-200 cursor-pointer"
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
