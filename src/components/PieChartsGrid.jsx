import { useState, useEffect, useMemo } from "react"
import { PieChart } from "./ui/BentoMiniComponents"
import { Users, CheckCircle, Briefcase, AlertCircle, Clock, ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from "@/components/ui/tooltip"
import EmployeesModal from "./EmployeesModal"

const STATUS_CONFIG = [
    { key: 'Activo', label: 'Activo', color: '#621f32', icon: CheckCircle },
    { key: 'Vacante', label: 'Vacante', color: '#bc955c', icon: Briefcase },
    { key: 'Suspendido', label: 'Suspendido', color: '#4a1726', icon: AlertCircle },
    { key: 'Permiso_Retribuido', label: 'P. Retribuido', color: '#8b1c3c', icon: Clock },
    { key: 'Permiso', label: 'Permiso', color: '#a67c52', icon: Clock },
    // Colores adicionales para mayor distinción
    { key: 'Licencia', label: 'Licencia', color: '#2b5a64', icon: CheckCircle },
    { key: 'Comision', label: 'Comisión', color: '#5a3d5c', icon: CheckCircle },
    { key: 'Jubilacion', label: 'Jubilación', color: '#7a3b2e', icon: CheckCircle },
    { key: 'Baja', label: 'Baja', color: '#1f2937', icon: CheckCircle },
    { key: 'Otro', label: 'Otro', color: '#6b7280', icon: CheckCircle },
];

const ITEMS_PER_PAGE = 9;

function LevelCard({ data, onStatusClick }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const total = (data.Activo || 0) + (data.Vacante || 0) + (data.Suspendido || 0) + (data.Permiso_Retribuido || 0) + (data.Permiso || 0) || 1;

    const chartData = STATUS_CONFIG.map(status => ({
        label: status.label,
        count: data[status.key] || 0,
        percent: (data[status.key] || 0) / total,
        color: status.color
    })).filter(s => s.count > 0 || s.percent > 0);

    // Formatear números de forma segura para hidratación
    const formatNumber = (num) => {
        if (!mounted) return num.toString();
        return num.toLocaleString();
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] border border-gray-100 hover:shadow-[0_20px_60px_-10px_rgba(98,31,50,0.1)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full group">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-0.5 bg-[#bc955c]/30 rounded-full" />
                        <span className="text-[10px] font-black text-[#bc955c] uppercase tracking-[0.2em]">Nivel Operativo</span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 leading-none group-hover:text-[#621f32] transition-colors">{data.nivel}</h3>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-[#621f32]/5 transition-colors">
                    <Users className="size-5 text-gray-400 group-hover:text-[#621f32] transition-colors" />
                </div>
            </div>

            <div className="flex items-center gap-6 mb-8">
                <div className="flex-shrink-0 relative">
                    <PieChart data={chartData} size={115} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="size-10 bg-white rounded-full shadow-inner flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-gray-100" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {chartData.map((item) => (
                            <Tooltip key={item.label}>
                                <TooltipTrigger asChild>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 group/row transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-100"
                                        onClick={() => onStatusClick(data.nivel, item.label)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStatusClick(data.nivel, item.label); }}
                                    >
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div className="size-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                                            <span className="text-[10px] font-black text-gray-500 uppercase truncate group-hover/row:text-gray-900 transition-colors tracking-tight">
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <span className="text-[10px] font-black text-gray-300 tabular-nums">
                                                {Math.round(item.percent * 100)}%
                                            </span>
                                            <span className="text-xs font-black text-gray-900 min-w-[30px] text-right tabular-nums">
                                                {formatNumber(item.count)}
                                            </span>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p className="font-black text-[10px] uppercase tracking-widest">Ver detalle: {item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Capacidad Total</span>
                    <span className="text-xl font-black text-gray-900 tabular-nums leading-none">{formatNumber(total)}</span>
                </div>
                <div className="flex flex-col items-end text-right">
                    <span className="text-[9px] font-black text-[#bc955c] uppercase tracking-widest mb-1">Activos</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-[#621f32] tabular-nums leading-none">{formatNumber(data.Activo || 0)}</span>
                        <div className="size-1 rounded-full bg-[#621f32] animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PieChartsGrid({ data }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalConfig, setModalConfig] = useState({ open: false, nivel: "", estatus: "" });

    const filteredData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        if (!searchTerm) return data;
        return data.filter(item =>
            item.nivel.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const currentItems = useMemo(() => {
        const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
        const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
        return filteredData.slice(indexOfFirstItem, indexOfLastItem);
    }, [filteredData, currentPage]);

    const levelsText = useMemo(() => {
        if (currentItems.length === 0) return searchTerm ? "No se encontraron niveles" : "";
        const levels = currentItems.map(item => item.nivel);
        return `Visualizando Niveles: ${levels.join(', ')}`;
    }, [currentItems, searchTerm]);

    if (!data || !Array.isArray(data)) return null;

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleStatusClick = (nivel, estatus) => {
        setModalConfig({ open: true, nivel, estatus });
    };

    return (
        <TooltipProvider delayDuration={300}>
            <div className="w-full max-w-screen-xl mx-auto px-4 flex flex-col gap-10">
                {/* Search & Navigation Hub */}
                <div className="w-full flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-3 pl-6 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-gray-100">

                        {/* Search Section */}
                        <div className="flex items-center gap-4 flex-1 w-full lg:w-auto">
                            <div className="p-2.5 bg-[#621f32]/5 rounded-2xl">
                                <Search className="size-5 text-[#621f32]" />
                            </div>
                            <div className="flex-1 relative group/input">
                                <input
                                    type="text"
                                    placeholder="Buscar nivel..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-5 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-bold text-gray-800 placeholder-gray-300 focus:bg-white focus:border-[#621f32]/30 focus:ring-4 focus:ring-[#621f32]/5 transition-all duration-300 outline-none"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Controls & Stats Section */}
                        <div className="flex items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6">
                            {/* Results Count */}
                            <div className="flex flex-col items-end pr-4 border-r border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Encontrados</span>
                                <span className="text-base font-black text-gray-900">{filteredData.length} Niveles</span>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Página</span>
                                    <span className="text-sm font-black text-gray-900 leading-none">{currentPage} / {totalPages || 1}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:bg-[#621f32] hover:text-white disabled:opacity-20 transition-all duration-300"
                                    >
                                        <ChevronLeft className="size-5" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:bg-[#621f32] hover:text-white disabled:opacity-20 transition-all duration-300"
                                    >
                                        <ChevronRight className="size-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Bar (Softer version with dominant color text) */}
                    {levelsText && filteredData.length > 0 && (
                        <div className="flex items-center gap-3 px-6 py-2 bg-gray-50/50 rounded-2xl border border-gray-100/80 backdrop-blur-sm transition-all duration-500">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="size-1.5 rounded-full bg-[#621f32] animate-pulse" />
                                <span className="text-[9px] font-bold text-[#621f32]/60 uppercase tracking-[0.2em]">Visualizando</span>
                            </div>
                            <div className="h-3 w-px bg-[#621f32]/10" />
                            <span className="text-xs font-bold text-[#621f32] tracking-wide truncate">
                                {levelsText.replace('Visualizando Niveles: ', '')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Grid de gráficas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentItems.map((item, index) => (
                        <LevelCard
                            key={item.nivel || index}
                            data={item}
                            onStatusClick={handleStatusClick}
                        />
                    ))}
                </div>

                {currentItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/30 rounded-3xl border-2 border-dashed border-gray-200">
                        <Search className="size-12 text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-500">No se encontraron resultados</h3>
                        <p className="text-gray-400 mt-2">Intenta buscar con otro código de nivel.</p>
                        <button
                            onClick={() => setSearchTerm("")}
                            className="mt-6 text-[#621f32] font-bold hover:underline"
                        >
                            Limpiar búsqueda
                        </button>
                    </div>
                )}

                {/* Modal de Detalle de Empleados */}
                <EmployeesModal
                    open={modalConfig.open}
                    onOpenChange={(open) => setModalConfig(prev => ({ ...prev, open }))}
                    nivel={modalConfig.nivel}
                    estatus={modalConfig.estatus}
                />
            </div>
        </TooltipProvider>
    );
}
