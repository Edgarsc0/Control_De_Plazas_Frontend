import React, { useState, useEffect } from 'react';
import { 
  Book, 
  Eye, 
  Calculator, 
  User, 
  ClipboardList, 
  Paperclip, 
  Loader2, 
  Search, 
  X,
  Filter
} from 'lucide-react';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import { ControlGestionService } from '@/services/control_gestion.service';
import DetailModal from '@/components/OficioDetailModal';
import { motion, AnimatePresence } from 'motion/react';
import { Counter } from '@/components/ui/BentoMiniComponents';

export default function AsuntosValuacion({ onNavigateToSimulador }) {
    const [asuntos, setAsuntos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [selectedItem, setSelectedItem] = useState(null);
    const [expedienteData, setExpedienteData] = useState(null);
    const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);

    const loadAsuntosData = async () => {
        setLoading(true);
        try {
            const asuntosValData = await CatTipoOficioService.getAsuntosValuacion();
            const asuntosValList = Array.isArray(asuntosValData) ? asuntosValData : asuntosValData.results || [];
            
            if (asuntosValList.length === 0) {
                setAsuntos([]);
                return;
            }
            
            const oficiosData = await ControlGestionService.getOficiosTurnados({
                idUnidadResponsable: 11,
                fechaInicio: null,
                fechaFin: null,
                folio: null,
                ordenamiento: 'fecha',
                direccion: 'DESC',
                limite: 10000,
                offset: 0,
                idUnidadResponsableUsuario: '1',
                idUsuario: 9999,
                idUsuarioRol: 1,
            });
            const oficiosList = oficiosData?.model?.detalleTurnados || [];

            const enriched = asuntosValList.map(av => {
                const matchedOficio = oficiosList.find(o => o.idAsunto === av.idAsuntoSCG);
                return {
                    ...av,
                    oficioInfo: matchedOficio || null
                };
            }).filter(av => av.oficioInfo !== null); // Filter out orphans if they don't have matching oficios
            
            setAsuntos(enriched);
        } catch (e) {
            console.error("Error loading asuntos valuacion:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAsuntosData();
    }, []);

    const handleSelectItem = async (item) => {
        setSelectedItem(item);
        setIsLoadingExpediente(true);
        setExpedienteData(null);
        setCurrentPdfUrl(null);
        try {
            const data = await ControlGestionService.getExpedienteAsunto(item.idAsunto);
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

    // Navigation in modal
    const currentIndex = asuntos.findIndex(a => a.oficioInfo?.idTurnado === selectedItem?.idTurnado);
    
    const handleNextItem = () => {
        if (currentIndex < asuntos.length - 1) {
            handleSelectItem(asuntos[currentIndex + 1].oficioInfo);
        }
    };

    const handlePreviousItem = () => {
        if (currentIndex > 0) {
            handleSelectItem(asuntos[currentIndex - 1].oficioInfo);
        }
    };

    const handleUpdateClasificacion = () => {
        // Reload data to reflect if an affair gets deleted because its classification changed from Valuación Presupuestaria (id=1)
        loadAsuntosData();
    };

    // Filter local list
    const filteredAsuntos = asuntos.filter(item => {
        const query = searchTerm.toLowerCase();
        return (
            item.oficioInfo?.asuntoFolio?.toLowerCase().includes(query) ||
            item.oficioInfo?.asuntoNoOficio?.toLowerCase().includes(query) ||
            item.oficioInfo?.asuntoRemitente?.toLowerCase().includes(query) ||
            item.oficioInfo?.asuntoDescripcion?.toLowerCase().includes(query) ||
            item.status?.toLowerCase().includes(query)
        );
    });

    const getStatusValuacionBadge = (status) => {
        const s = status?.toLowerCase() || 'pendiente';
        if (s === 'procedente') {
            return {
                label: 'Procedente',
                badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                dot: 'bg-emerald-500'
            };
        } else if (s === 'improcedente') {
            return {
                label: 'Improcedente',
                badge: 'text-red-700 bg-red-50 border-red-200',
                dot: 'bg-red-500'
            };
        } else {
            return {
                label: 'Pendiente',
                badge: 'text-amber-700 bg-amber-50 border-amber-200',
                dot: 'bg-amber-500'
            };
        }
    };

    return (
        <div className="space-y-7 animate-in fade-in duration-400">
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
                        hasNext={currentIndex < asuntos.length - 1}
                        hasPrevious={currentIndex > 0}
                        onClose={() => {
                            setSelectedItem(null);
                            setExpedienteData(null);
                            if (currentPdfUrl) window.URL.revokeObjectURL(currentPdfUrl);
                            setCurrentPdfUrl(null);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── HERO HEADER ─────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl shadow-lg border border-[#621f32]/10"
                style={{ background: 'linear-gradient(135deg, #621f32 0%, #4e1828 60%, #3a1120 100%)' }}>
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
                <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-5"
                    style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

                <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 p-7 md:p-10">
                    <div className="flex items-center gap-5">
                        <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                            <Book className="w-9 h-9 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight leading-none">
                                Asuntos de Solicitud de Ocupación de Plazas
                            </h1>
                            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                <span className="w-4 h-px bg-white/20" /> Dirección de Organización - Valuación Presupuestaria
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="px-6 py-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 flex flex-col items-end text-right">
                            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Total de Solicitudes</p>
                            {loading ? (
                                <div className="w-16 h-8 bg-white/20 animate-pulse rounded-lg mt-1" />
                            ) : (
                                <p className="text-3xl font-black text-white tabular-nums"><Counter target={asuntos.length} /></p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[#621f32] flex items-center justify-center shadow-md">
                            <ClipboardList className="w-4 h-4 text-[#bc955c]" />
                        </div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.25em]">Solicitudes Clasificadas</h3>
                    </div>
                    <div className="relative w-96 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4 group-focus-within:text-[#621f32] transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Buscar por folio, oficio o remitente..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            disabled={loading}
                            className="w-full pl-11 pr-10 py-3 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-[#621f32]/5 focus:border-[#621f32]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed" 
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 transition-colors">
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/80 shadow-2xl overflow-hidden ring-1 ring-black/[0.05]">
                    <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[calc(100vh-150px)] relative">
                        <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                            <thead className="sticky top-0 z-[100]">
                                <tr className="bg-gradient-to-b from-gray-50/95 to-gray-100/95 backdrop-blur-md border-b-2 border-[#621f32]/10 shadow-sm">
                                    <th style={{ width: "20%" }} className="px-6 py-6 align-top relative group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                                            <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Folio / Oficio</span>
                                        </div>
                                    </th>
                                    <th style={{ width: "20%" }} className="px-6 py-6 align-top relative group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-4 bg-[#bc955c] rounded-full" />
                                            <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Remitente / Dependencia</span>
                                        </div>
                                    </th>
                                    <th style={{ width: "30%" }} className="px-6 py-6 align-top relative group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                                            <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Descripción Asunto</span>
                                        </div>
                                    </th>
                                    <th style={{ width: "15%" }} className="px-6 py-6 align-top relative group text-center">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <div className="w-1.5 h-4 bg-[#bc955c] rounded-full" />
                                            <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Valuación</span>
                                        </div>
                                    </th>
                                    <th style={{ width: "15%" }} className="px-6 py-6 align-top relative group text-center">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                            <div className="w-1.5 h-4 bg-[#621f32] rounded-full" />
                                            <span className="text-[11px] font-black text-[#621f32] uppercase tracking-[0.2em]">Acciones</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#621f32]/5">
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, idx) => (
                                        <tr key={idx} className="animate-pulse">
                                            {/* Column 1: Folio / Oficio */}
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col gap-2.5 pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-gray-200/80" />
                                                        <div className="w-36 h-4 bg-gray-200/80 rounded-md" />
                                                    </div>
                                                    <div className="w-24 h-3 bg-gray-150 rounded-md ml-4" />
                                                </div>
                                            </td>
                                            {/* Column 2: Remitente / Dependencia */}
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col gap-2 pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3.5 h-3.5 bg-gray-200/80 rounded-full" />
                                                        <div className="w-28 h-3.5 bg-gray-200/80 rounded-md" />
                                                    </div>
                                                    <div className="w-40 h-3 bg-gray-150 rounded-md ml-5.5" />
                                                </div>
                                            </td>
                                            {/* Column 3: Descripción */}
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col gap-2 pt-1">
                                                    <div className="w-full h-3.5 bg-gray-200/70 rounded-md" />
                                                    <div className="w-[90%] h-3.5 bg-gray-200/70 rounded-md" />
                                                    <div className="w-[60%] h-3 bg-gray-150 rounded-md" />
                                                </div>
                                            </td>
                                            {/* Column 4: Valuación */}
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex justify-center pt-1">
                                                    <div className="w-24 h-6 bg-gray-200/80 rounded-full" />
                                                </div>
                                            </td>
                                            {/* Column 5: Acciones */}
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex justify-center gap-3 pt-1">
                                                    <div className="w-10 h-10 bg-gray-200/80 rounded-2xl" />
                                                    <div className="w-10 h-10 bg-gray-200/80 rounded-2xl" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    filteredAsuntos.map((item, idx) => {
                                        const statusConf = getStatusValuacionBadge(item.status);
                                        const oInfo = item.oficioInfo || {};
                                        return (
                                        <tr key={item.id} className={`group hover:bg-[#621f32]/[0.04] transition-colors cursor-default ${idx % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`}>
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col gap-1.5 pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#bc955c]" />
                                                        <span className="text-[12px] font-black text-[#621f32] tracking-tight">{oInfo.asuntoNoOficio || 'Sin Oficio'}</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono font-bold text-gray-400 bg-white/50 px-2 py-0.5 rounded-md border border-gray-100 w-fit">{oInfo.asuntoFolio || 'Sin Folio'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col gap-1 pt-1 w-full min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <User className="size-3 text-[#bc955c] shrink-0" />
                                                        <span className="text-[10px] font-black text-gray-700 uppercase truncate">{oInfo.asuntoRemitente || 'No especificado'}</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-gray-400 pl-5 truncate">{oInfo.asuntoRemitenteDependencia || 'No especificado'}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-7 align-top">
                                                <p className="text-[11px] font-semibold text-gray-600 line-clamp-3 leading-relaxed pt-1" title={oInfo.asuntoDescripcion}>
                                                    {oInfo.asuntoDescripcion || 'Sin descripción'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex flex-col items-center gap-2 pt-1">
                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border flex items-center gap-2 shadow-sm ${statusConf.badge}`}>
                                                        <span className={`size-1.5 rounded-full ${statusConf.dot}`} />
                                                        {statusConf.label}
                                                    </div>
                                                    {item.oficio_resolucion && (
                                                        <a 
                                                            href={item.oficio_resolucion} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="flex items-center gap-1 text-[9px] font-black text-[#bc955c] uppercase hover:underline mt-1"
                                                        >
                                                            <Paperclip className="size-3" /> Ver Resolución
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-7 align-top">
                                                <div className="flex justify-center items-center gap-3 pt-1">
                                                    <button 
                                                        onClick={() => handleSelectItem(oInfo)} 
                                                        className="p-3 bg-white hover:bg-[#621f32] border border-gray-100 shadow-sm rounded-2xl text-[#621f32] hover:text-white transition-all duration-300 group/btn" 
                                                        title="Ver detalles"
                                                    >
                                                        <Eye className="size-4 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onNavigateToSimulador(item)} 
                                                        className="p-3 bg-white hover:bg-[#621f32] border border-gray-100 shadow-sm rounded-2xl text-[#bc955c] hover:text-white transition-all duration-300 group/btn" 
                                                        title="Ir al simulador"
                                                    >
                                                        <Calculator className="size-4 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }))}
                            </tbody>
                        </table>
                    </div>

                    {!loading && filteredAsuntos.length === 0 && (
                        <div className="p-24 flex flex-col items-center justify-center text-gray-300 gap-6">
                            <div className="p-8 bg-white/20 rounded-[2rem] border-2 border-dashed border-gray-100">
                                <Filter className="size-16 opacity-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black uppercase tracking-[0.3em]">Sin resultados de solicitudes</p>
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="mt-4 text-[10px] font-black text-[#621f32] uppercase underline underline-offset-4">Limpiar filtro</button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="px-8 py-5 bg-white/60 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {loading ? (
                                <span className="animate-pulse">Cargando solicitudes de plazas...</span>
                            ) : (
                                <>Mostrando <span className="text-[#621f32]">{filteredAsuntos.length}</span> solicitudes</>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}