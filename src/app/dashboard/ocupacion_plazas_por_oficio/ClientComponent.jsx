"use client";

import { useState, useMemo, useEffect } from 'react';
import { Zoom } from "@/components/shared/Reveal";
import { motion, AnimatePresence } from 'motion/react';
import {
    Briefcase, Table as TableIcon,
    GitBranch,
    Settings2, Search, SlidersHorizontal, XCircle, SquarePen,
    Loader2
} from "lucide-react"
import Link from "next/link"
import { Counter } from "@/components/ui/BentoMiniComponents";
import RegistrosOficioModal from './_components/RegistrosOficioModal';
import OcupacionSankeyView from './_components/OcupacionSankeyView';
import OcupacionTableView from './_components/OcupacionTableView';
import OcupacionFilterDrawer from './_components/OcupacionFilterDrawer';
import { ControlGestionService } from '@/services/control_gestion.service';
import DetailModal from '@/components/shared/OficioDetailModal';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/config/permissions';

export default function OcupacionPlazasPorOficio({ resumenOcupacion }) {
    const { isLoading: authLoading, hasPermission } = useAuth();
    const canViewSankey = authLoading || hasPermission(PERMISSIONS.VIEW_OCUPACION_SANKEY);
    const canViewTabla = authLoading || hasPermission(PERMISSIONS.VIEW_OCUPACION_TABLA);
    const canEditOcupacion = authLoading || hasPermission(PERMISSIONS.EDIT_OCUPACION_PLAZAS);

    const [excludedOffices, setExcludedOffices] = useState([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");

    // Estado para el modal de drill down
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDrillDown, setSelectedDrillDown] = useState({ oficio: null, nivel: null });

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
        <section className="bg-transparent relative transition-all duration-300 overflow-hidden pb-20">
            <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
            <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

            <RegistrosOficioModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                oficio={selectedDrillDown.oficio}
                nivel={selectedDrillDown.nivel}
            />

            <div className="mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 pt-3 md:pt-14 pb-12">
                <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 gap-6">

                    <Zoom triggerOnce>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-4">
                            <div className="flex items-start sm:items-center gap-6">
                                <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <Briefcase className="size-8 sm:size-10 text-white" />
                                </div>
                                <div className="max-w-screen-md">
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
                                        Ocupación de <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">Plazas por Oficio</span>
                                    </h2>
                                    <p className="hidden md:block mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                                        Distribución de plazas activas por oficio de solicitud y nivel jerárquico, con diagrama de flujo y tabla de detalle.
                                    </p>
                                </div>
                            </div>

                            {canEditOcupacion && (
                                <Link
                                    href="/dashboard/ocupacion_plazas_por_oficio/plantilla"
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-[#621f32] hover:text-[#621f32] dark:hover:border-[#bc955c] dark:hover:text-[#bc955c] transition-all shadow-sm flex-shrink-0"
                                >
                                    <SquarePen className="size-4" />
                                    Editar Plantilla
                                </Link>
                            )}
                        </div>
                    </Zoom>

                    {/* Barra de métricas + búsqueda + filtros */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-slate-200/20 dark:shadow-black/40 p-4 sm:p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 w-full md:w-auto">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">Plazas Activas</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-[#621f32] animate-pulse" />
                                    <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                                        <Counter target={filteredTotal} />
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block h-10 w-px bg-gray-100 dark:bg-slate-800" />

                            {/* Local Database Occupied & Percentage */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">Ocupadas (Local)</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-emerald-600" />
                                    <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                                        <Counter target={resumenOcupacion?.ocupadas_2026 || 0} />
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">% Ocupación</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-[#621f32] dark:text-[#e78a9e] tabular-nums leading-none">
                                        {resumenOcupacion?.total_general ? ((resumenOcupacion.ocupadas_2026 || 0) / resumenOcupacion.total_general * 100).toFixed(1) : "0"}%
                                    </span>
                                </div>
                            </div>

                            <div className="hidden sm:block h-10 w-px bg-gray-100 dark:bg-slate-800" />

                            {/* SIG Database Occupied & Percentage */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">Ocupadas (SIG)</span>
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-amber-500" />
                                    <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                                        <Counter target={resumenOcupacion?.ocupadas_sig || 0} />
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">% Ocupación SIG</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-[#bc955c] tabular-nums leading-none">
                                        {resumenOcupacion?.total_general ? ((resumenOcupacion.ocupadas_sig || 0) / resumenOcupacion.total_general * 100).toFixed(1) : "0"}%
                                    </span>
                                </div>
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
                                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-[#621f32]/5 focus:border-[#621f32]/20 transition-all placeholder:text-gray-400"
                                />
                                {globalSearchTerm && (
                                    <button
                                        onClick={() => setGlobalSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                                    >
                                        <XCircle className="size-3.5 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 font-black text-xs border ${excludedOffices.length > 0 ? 'bg-[#621f32] text-white border-[#621f32] shadow-lg shadow-[#621f32]/20' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-[#621f32] hover:text-[#621f32]'}`}
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

                    {filteredFilas.length === 0 ? (
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-slate-200/20 dark:shadow-black/40 min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
                            <div className="p-8 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-gray-100 dark:border-slate-700">
                                <Settings2 className="size-12 text-gray-200 dark:text-slate-600" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-gray-900 dark:text-white">Sin Datos Coincidentes</h4>
                                <p className="text-sm font-bold text-gray-400 mt-1">Ajusta los parámetros de búsqueda o filtros.</p>
                            </div>
                            <button
                                onClick={resetFilters}
                                className="mt-4 px-6 py-2 bg-[#621f32] text-white rounded-xl text-xs font-black hover:bg-[#4a1726] transition-colors shadow-lg shadow-[#621f32]/20"
                            >
                                Restablecer todo
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Sankey y Tabla conviven en el mismo tab: mismo lenguaje visual
                                que las tarjetas de contenido de Plantilla de Empleados. */}
                            {!authLoading && canViewSankey && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden flex flex-col"
                                >
                                    <div className="px-6 sm:px-8 pt-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#e78a9e]">
                                        <GitBranch className="size-4" />
                                        Diagrama de Flujo
                                    </div>
                                    <OcupacionSankeyView
                                        sankeyData={sankeyData}
                                        handleDrillDown={handleDrillDown}
                                    />
                                </motion.div>
                            )}

                            {!authLoading && canViewTabla && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: 0.05 }}
                                    className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden min-h-[600px] flex flex-col"
                                >
                                    <div className="px-6 sm:px-8 pt-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#621f32] dark:text-[#e78a9e]">
                                        <TableIcon className="size-4" />
                                        Matriz de Datos
                                    </div>
                                    <div className="flex-1 min-h-[520px]">
                                        <OcupacionTableView
                                            tableHeaders={tableHeaders}
                                            filteredFilas={filteredFilas}
                                            handleDrillDown={handleDrillDown}
                                            onViewOficioDetails={handleViewOficioDetails}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
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
