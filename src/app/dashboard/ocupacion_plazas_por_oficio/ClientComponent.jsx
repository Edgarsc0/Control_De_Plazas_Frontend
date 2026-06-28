"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Zoom, Fade } from "react-awesome-reveal"
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard, ChevronRight, Table as TableIcon,
    GitBranch, BarChart3, Info,
    Settings2, Search, SlidersHorizontal, XCircle, SquarePen,
    ArrowRight, Loader2
} from "lucide-react"
import Link from "next/link"
import { Counter } from "@/components/ui/BentoMiniComponents";
import RegistrosOficioModal from './_components/RegistrosOficioModal';
import OcupacionSankeyView from './_components/OcupacionSankeyView';
import OcupacionTableView from './_components/OcupacionTableView';
import OcupacionStatsView from './_components/OcupacionStatsView';
import OcupacionFilterDrawer from './_components/OcupacionFilterDrawer';
import { ControlGestionService } from '@/services/control_gestion.service';
import DetailModal from '@/components/shared/OficioDetailModal';
import { useRegisterPageTabs } from '@/context/PageTabsContext';


// Tabs de vista (sin "Plantilla": esa sólo se accede desde la barra de PC).
const OCUPACION_TABS = [
    { id: 'sankey', label: 'Sankey' },
    { id: 'table', label: 'Tabla' },
    { id: 'charts', label: 'Estadísticas' },
];

export default function OcupacionPlazasPorOficio({ resumenOcupacion }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const tabParam = searchParams.get('tab') || 'sankey';
    const [activeView, setActiveView] = useState(tabParam);
    const [excludedOffices, setExcludedOffices] = useState([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");

    // Estado para el modal de drill down
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDrillDown, setSelectedDrillDown] = useState({ oficio: null, nivel: null });

    // Animación para las barras de estadísticas
    const [animateStats, setAnimateStats] = useState(false);

    // Estado y lógica para ver detalles del Oficio de Control de Gestión
    const [oficiosMap, setOficiosMap] = useState({});
    const [loadingOficiosMap, setLoadingOficiosMap] = useState(false);
    const [selectedOficioItem, setSelectedOficioItem] = useState(null);
    const [expedienteData, setExpedienteData] = useState(null);
    const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);

    // Cargar todos los oficios de control de gestión en mount para el mapeo
    useEffect(() => {
        const loadOficios = async () => {
            setLoadingOficiosMap(true);
            try {
                const data = await ControlGestionService.getOficiosTurnados({ skipCatalogCross: true });
                if (data.status === 200 && data.model?.detalleTurnados) {
                    const map = {};
                    data.model.detalleTurnados.forEach(item => {
                        if (item.asuntoNoOficio) {
                            const key = item.asuntoNoOficio.trim().toUpperCase();
                            map[key] = item;
                        }
                    });
                    setOficiosMap(map);
                }
            } catch (error) {
                console.error("Error al cargar mapeo de oficios:", error);
            } finally {
                setLoadingOficiosMap(false);
            }
        };
        loadOficios();
    }, []);

    const handleViewOficioDetails = async (oficioName) => {
        if (!oficioName) return;
        const normalizedKey = oficioName.trim().toUpperCase();
        const turnadoItem = oficiosMap[normalizedKey];
        
        if (!turnadoItem) {
            alert(`No se encontró el expediente del oficio "${oficioName}" en Control de Gestión.`);
            return;
        }

        setSelectedOficioItem(turnadoItem);
        setIsLoadingExpediente(true);
        setExpedienteData(null);
        setCurrentPdfUrl(null);
        try {
            const data = await ControlGestionService.getExpedienteAsunto(turnadoItem.idAsunto);
            if (data.status === 200) {
                setExpedienteData(data);
                const firstDoc =
                    data.model?.documentos?.[0] ||
                    data.model?.respuestas?.[0] ||
                    data.model?.anexos?.[0];
                if (firstDoc) {
                    handlePreviewDocument(firstDoc.ruta || firstDoc.nombre, turnadoItem.idAsunto);
                }
            }
        } catch (error) {
            console.error('Error al cargar expediente:', error);
        } finally {
            setIsLoadingExpediente(false);
        }
    };

    const handlePreviewDocument = async (relativePath, forceId = null) => {
        const idToUse = forceId || selectedOficioItem?.idAsunto;
        if (!idToUse) return;

        setIsPreviewing(true);
        try {
            const blob = await ControlGestionService.getVisualizarDocumento(idToUse, relativePath);
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

    // Sync state with URL param
    useEffect(() => {
        if (tabParam !== activeView) {
            setActiveView(tabParam);
        }
    }, [tabParam]);

    // Ref para leer los params actuales sin volver inestable el callback
    // (así el registro al BottomNav no se re-ejecuta en cada render).
    const searchParamsRef = useRef(searchParams);
    searchParamsRef.current = searchParams;
    const handleTabChange = useCallback((tab) => {
        const params = new URLSearchParams(searchParamsRef.current);
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname]);

    // Publica los tabs al BottomNav (móvil) para abrirlos en un Drawer.
    // "Plantilla" queda fuera: sólo accesible desde la barra de PC.
    useRegisterPageTabs({
        tabs: OCUPACION_TABS,
        activeTab: activeView,
        onSelect: handleTabChange,
        title: "Ocupación de Plazas",
    });

    // Delay to allow Zoom animation to finish before starting bar fill animation (ms)
    const ZOOM_END_DELAY = 500;

    useEffect(() => {
        if (activeView === 'charts') {
            const t = setTimeout(() => setAnimateStats(true), ZOOM_END_DELAY);
            return () => clearTimeout(t);
        } else {
            setAnimateStats(false);
        }
    }, [activeView]);

    const allOffices = useMemo(() => {
        if (!resumenOcupacion?.filas) return [];
        const offices = resumenOcupacion.filas
            .filter(f => f['Of. De Solicitud'] !== 'Total Resultado')
            .map(f => f['Of. De Solicitud']);
        return Array.from(new Set(offices));
    }, [resumenOcupacion]);

    const filteredOffices = useMemo(() => {
        return allOffices.filter(o =>
            (o === '(vacío)' ? 'Sin Oficio' : o).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allOffices, searchTerm]);

    const filteredFilas = useMemo(() => {
        if (!resumenOcupacion?.filas) return [];
        return resumenOcupacion.filas.filter(f => {
            const officeName = f['Of. De Solicitud'] === '(vacío)' ? 'Sin Oficio' : f['Of. De Solicitud'];
            const matchesSearch = (officeName || "").toLowerCase().includes(globalSearchTerm.toLowerCase());
            const isNotExcluded = !excludedOffices.includes(f['Of. De Solicitud']);
            const isNotTotal = f['Of. De Solicitud'] !== 'Total Resultado';
            
            return isNotTotal && isNotExcluded && matchesSearch;
        });
    }, [resumenOcupacion, excludedOffices, globalSearchTerm]);

    const filteredTotal = useMemo(() => {
        return filteredFilas.reduce((acc, f) => acc + (f['Total Resultado'] || 0), 0);
    }, [filteredFilas]);

    const sankeyData = useMemo(() => {
        if (!filteredFilas.length) return null;

        const levels = resumenOcupacion.columnas.filter(c =>
            c !== 'Of. De Solicitud' &&
            c !== 'Total Resultado' &&
            c !== '(vacío)'
        );

        const nodes = [];
        const links = [];
        const targetMap = new Map();

        levels.forEach(lvl => {
            const id = `t-${lvl}`;
            targetMap.set(lvl, id);
            // store rawName for target nodes as well (levels use their literal name)
            nodes.push({ id, name: lvl, rawName: lvl, group: 'target', value: 0 });
        });

        filteredFilas.forEach((fila, i) => {
            const sourceName = fila['Of. De Solicitud'] === '(vacío)' ? 'Sin Oficio' : fila['Of. De Solicitud'];
            const sourceId = `s-${i}`;

            let sourceValue = 0;
            levels.forEach(lvl => {
                const val = fila[lvl] || 0;
                if (val > 0) {
                    sourceValue += val;
                    links.push({
                        source: sourceId,
                        target: targetMap.get(lvl),
                        value: val,
                        color: lvl === 'P33' ? '#621f32' :
                            lvl === 'D312' ? '#bc955c' :
                                lvl === 'P13' ? '#4a1726' :
                                    lvl === 'A212' ? '#111827' : '#9ca3af'
                    });
                    const targetNode = nodes.find(n => n.id === targetMap.get(lvl));
                    if (targetNode) targetNode.value += val;
                }
            });

            if (sourceValue > 0) {
                // Preserve the raw value from the data (could be '(vacío)') so downstream handlers can use the original filter
                nodes.push({ id: sourceId, name: sourceName, rawName: fila['Of. De Solicitud'], group: 'source', value: sourceValue });
            }
        });

        return { nodes, links };
    }, [filteredFilas, resumenOcupacion]);

    const tableHeaders = (resumenOcupacion?.columnas || []).filter(c => c !== '(vacío)');

    // Niveles (usados en Sankey y en estadísticas)
    const levels = (resumenOcupacion?.columnas || []).filter(c =>
        c !== 'Of. De Solicitud' && c !== 'Total Resultado' && c !== '(vacío)'
    );

    // Estadísticas y datos para gráficas
    const stats = useMemo(() => {
        const officeMap = new Map();
        (filteredFilas || []).forEach(f => {
            const name = f['Of. De Solicitud'] === '(vacío)' ? 'Sin Oficio' : f['Of. De Solicitud'];
            const val = f['Total Resultado'] || 0;
            officeMap.set(name, (officeMap.get(name) || 0) + val);
        });
        const officeArr = Array.from(officeMap.entries()).map(([name, value]) => ({ name, value }));
        officeArr.sort((a, b) => b.value - a.value);
        const maxOfficeVal = officeArr.length ? officeArr[0].value : 0;

        const lvlTotals = {};
        levels.forEach(lvl => {
            lvlTotals[lvl] = (filteredFilas || []).reduce((acc, f) => acc + (f[lvl] || 0), 0);
        });
        const lvlValues = Object.values(lvlTotals);
        const maxLvl = lvlValues.length ? Math.max(...lvlValues) : 0;

        const officesCountLocal = officeArr.length;
        const mean = officesCountLocal ? officeArr.reduce((a, b) => a + b.value, 0) / officesCountLocal : 0;
        const sortedValues = officeArr.map(o => o.value).sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        const median = sortedValues.length ? (sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid]) : 0;

        return {
            officesTop: officeArr.slice(0, 10),
            maxOffice: maxOfficeVal,
            levelTotals: lvlTotals,
            maxLevel: maxLvl,
            officesCount: officesCountLocal,
            meanPerOffice: mean,
            medianPerOffice: median,
            topOffice: officeArr[0] || { name: '', value: 0 },
            topLevel: Object.keys(lvlTotals).reduce((a, b) => (lvlTotals[a] > lvlTotals[b] ? a : b), Object.keys(lvlTotals)[0])
        };
    }, [filteredFilas, levels]);

    const toggleOffice = (office) => {
        setExcludedOffices(prev =>
            prev.includes(office)
                ? prev.filter(o => o !== office)
                : [...prev, office]
        );
    };

    const resetFilters = () => setExcludedOffices([]);
    const excludeAll = () => setExcludedOffices(allOffices);

    const handleDrillDown = (office = null, level = null) => {
        setSelectedDrillDown({ oficio: office, nivel: level });
        setIsModalOpen(true);
    };

    return (
        <section className="bg-gray-50/50 min-h-screen pb-20 relative overflow-hidden font-sans">
            <RegistrosOficioModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                oficio={selectedDrillDown.oficio}
                nivel={selectedDrillDown.nivel}
            />

            <div className="py-8 px-4 mx-auto max-w-[1360px] lg:px-8">
                {/* Header & Navigation */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <Fade direction="down" triggerOnce>
                        <div className="space-y-2">
                            <nav className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                <Link href="/dashboard" className="hover:text-[#621f32] transition-colors flex items-center gap-1">
                                    <LayoutDashboard className="size-3" />
                                    Panel
                                </Link>
                                <ChevronRight className="size-3" />
                                <span className="text-[#621f32]">Ocupación de Plazas</span>
                            </nav>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                Gestión por <span className="text-[#621f32]">Oficios</span>
                            </h1>
                        </div>
                    </Fade>

                    <Fade direction="right" triggerOnce className="hidden md:block">
                        <div className="hidden md:flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
                            <TabButton 
                                active={activeView === 'sankey'} 
                                onClick={() => handleTabChange('sankey')}
                                icon={<GitBranch className="size-4" />}
                                label="Sankey"
                            />
                            <TabButton 
                                active={activeView === 'table'} 
                                onClick={() => handleTabChange('table')}
                                icon={<TableIcon className="size-4" />}
                                label="Tabla"
                            />
                            <TabButton 
                                active={activeView === 'charts'} 
                                onClick={() => handleTabChange('charts')}
                                icon={<BarChart3 className="size-4" />}
                                label="Estadísticas"
                            />
                            <div className="w-px h-6 bg-gray-200 self-center mx-1" />
                            <Link
                                href="/dashboard/ocupacion_plazas_por_oficio/plantilla"
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-all"
                            >
                                <SquarePen className="size-4" />
                                Plantilla
                            </Link>
                        </div>
                    </Fade>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl shadow-gray-200/40 overflow-hidden flex flex-col min-h-[700px] transform-gpu">
                    
                    {/* Integrated Control Bar */}
                    <div className="bg-white border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-10">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 w-full md:w-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">Plazas Activas</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-[#621f32] animate-pulse" />
                                    <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                                        <Counter target={filteredTotal} />
                                    </span>
                                </div>
                            </div>
                            
                            <div className="hidden sm:block h-10 w-px bg-gray-100" />

                            {/* Local Database Occupied & Percentage */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">Ocupadas (Local)</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-emerald-600" />
                                    <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                                        <Counter target={resumenOcupacion?.ocupadas_2026 || 0} />
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">% Ocupación</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-[#621f32] tabular-nums leading-none">
                                        {resumenOcupacion?.total_general ? ((resumenOcupacion.ocupadas_2026 || 0) / resumenOcupacion.total_general * 100).toFixed(1) : "0"}%
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block h-10 w-px bg-gray-100" />

                            {/* SIG Database Occupied & Percentage */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">Ocupadas (SIG)</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-amber-500" />
                                    <span className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                                        <Counter target={resumenOcupacion?.ocupadas_sig || 0} />
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">% Ocupación SIG</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-[#bc955c] tabular-nums leading-none">
                                        {resumenOcupacion?.total_general ? ((resumenOcupacion.ocupadas_sig || 0) / resumenOcupacion.total_general * 100).toFixed(1) : "0"}%
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block h-10 w-px bg-gray-100" />

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">Vista Actual</span>
                                <span className="text-xs font-bold text-[#621f32] flex items-center gap-1.5">
                                    {activeView === 'sankey' ? 'Diagrama de Flujo' : activeView === 'table' ? 'Matriz de Datos' : 'Análisis Métrico'}
                                    <ArrowRight className="size-3 opacity-50" />
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar oficio..."
                                    value={globalSearchTerm}
                                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-transparent rounded-xl text-xs font-bold focus:bg-white focus:ring-4 focus:ring-[#621f32]/5 focus:border-[#621f32]/20 transition-all placeholder:text-gray-400"
                                />
                                {globalSearchTerm && (
                                    <button
                                        onClick={() => setGlobalSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                                    >
                                        <XCircle className="size-3.5 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-black text-xs border ${excludedOffices.length > 0 ? 'bg-[#621f32] text-white border-[#621f32] shadow-lg shadow-[#621f32]/20' : 'bg-white text-gray-700 border-gray-200 hover:border-[#621f32] hover:text-[#621f32]'}`}
                            >
                                <SlidersHorizontal className="size-4" />
                                <span className="hidden sm:inline">Filtros</span>
                                {excludedOffices.length > 0 && (
                                    <span className="bg-white/20 px-2 py-0.5 rounded-lg text-[10px]">
                                        {allOffices.length - excludedOffices.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Content Viewport with Motion */}
                    <div className="flex-1 relative bg-gray-50/20">
                        <AnimatePresence mode="wait">
                            {filteredFilas.length === 0 ? (
                                <motion.div 
                                    key="nodata"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8"
                                >
                                    <div className="p-8 bg-white rounded-full shadow-sm border border-gray-100">
                                        <Settings2 className="size-12 text-gray-200" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-gray-900">Sin Datos Coincidentes</h4>
                                        <p className="text-sm font-bold text-gray-400 mt-1">Ajusta los parámetros de búsqueda o filtros.</p>
                                    </div>
                                    <button
                                        onClick={resetFilters}
                                        className="mt-4 px-6 py-2 bg-[#621f32] text-white rounded-xl text-xs font-black hover:bg-[#4a1726] transition-colors shadow-lg shadow-[#621f32]/20"
                                    >
                                        Restablecer todo
                                    </button>
                                </motion.div>
                            ) : activeView === 'sankey' ? (
                                <motion.div 
                                    key="sankey"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="h-full"
                                >
                                    <OcupacionSankeyView
                                        sankeyData={sankeyData}
                                        handleDrillDown={handleDrillDown}
                                    />
                                </motion.div>
                            ) : activeView === 'table' ? (
                                <motion.div 
                                    key="table"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full"
                                >
                                    <OcupacionTableView
                                        tableHeaders={tableHeaders}
                                        filteredFilas={filteredFilas}
                                        handleDrillDown={handleDrillDown}
                                        onViewOficioDetails={handleViewOficioDetails}
                                    />
                                </motion.div>
                            ) : activeView === 'charts' ? (
                                <motion.div 
                                    key="charts"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="h-full"
                                >
                                    <OcupacionStatsView
                                        {...stats}
                                        levels={levels}
                                        filteredTotal={filteredTotal}
                                        animateStats={animateStats}
                                    />
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

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
                {selectedOficioItem && (
                    <DetailModal
                        item={selectedOficioItem}
                        expediente={expedienteData}
                        isLoading={isLoadingExpediente}
                        pdfUrl={currentPdfUrl}
                        isPreviewing={isPreviewing}
                        onPreview={handlePreviewDocument}
                        onClose={() => {
                            setSelectedOficioItem(null);
                            setExpedienteData(null);
                            setCurrentPdfUrl(null);
                        }}
                    />
                )}
            </AnimatePresence>

            <OcupacionFilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                allOffices={allOffices}
                excludedOffices={excludedOffices}
                filteredOffices={filteredOffices}
                toggleOffice={toggleOffice}
                resetFilters={resetFilters}
                excludeAll={excludeAll}
            />
        </section>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`
                relative flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 font-black text-xs
                ${active 
                    ? 'text-[#621f32] bg-white shadow-sm ring-1 ring-gray-100' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }
            `}
        >
            {icon}
            {label}
            {active && (
                <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                />
            )}
        </button>
    );
}
