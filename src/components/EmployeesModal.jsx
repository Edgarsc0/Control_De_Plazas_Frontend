"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { VacantesService } from "@/services/vacantes.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, X, Filter, ChevronLeft, ChevronRight, Search, ChevronsUpDown, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { Zoom } from "react-awesome-reveal";



// --- COMPONENTE DE FILTRO EXCEL-LIKE ---
const FilterPopup = ({ column, rowData, filters, setFilters, onClose, position }) => {
    const allValues = useMemo(() => {
        const unique = new Set();
        rowData.forEach(row => {
            const val = row[column.key];
            if (val !== undefined && val !== null && val !== "") {
                unique.add(String(val));
            }
        });
        return Array.from(unique).sort();
    }, [rowData, column.key]);

    const activeFilter = filters[column.key];
    const [selectedValues, setSelectedValues] = useState(
        activeFilter ? new Set(activeFilter.values) : new Set(allValues)
    );
    const [searchText, setSearchText] = useState("");

    const updateFilters = (newSelected) => {
        setFilters(prev => {
            const next = { ...prev };
            if (newSelected.size === allValues.length) {
                delete next[column.key];
            } else {
                next[column.key] = { values: newSelected };
            }
            return next;
        });
    };

    const toggleValue = (val) => {
        const next = new Set(selectedValues);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setSelectedValues(next);
        updateFilters(next);
    };

    const toggleAll = () => {
        const next = selectedValues.size === allValues.length ? new Set() : new Set(allValues);
        setSelectedValues(next);
        updateFilters(next);
    };

    const clearFilter = () => {
        setSelectedValues(new Set(allValues));
        setFilters(prev => {
            const next = { ...prev };
            delete next[column.key];
            return next;
        });
        onClose();
    };

    const filteredOptions = allValues.filter(v =>
        v.toLowerCase().includes(searchText.toLowerCase())
    );

    const popLeft = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 300 : position.x);
    const popTop = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 450 : position.y);

    return (
        <div
            role="presentation"
            className="fixed z-[101] flex flex-col gap-3 min-w-[280px] max-w-[320px] max-h-[450px] bg-white rounded-xl shadow-2xl border border-gray-200 outline-none animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            style={{ left: popLeft, top: popTop }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 pb-0 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-[#621f32]/30 transition-all">
                    <Search className="size-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar opciones..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-xs font-semibold w-full p-0 text-gray-700 placeholder-gray-400"
                    />
                </div>

                <div className="flex items-center justify-between px-1">
                    <button onClick={toggleAll} className="text-[10px] font-bold text-[#621f32] uppercase hover:underline">
                        {selectedValues.size === allValues.length ? 'Desmarcar todo' : 'Seleccionar todo'}
                    </button>
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                        {selectedValues.size} / {allValues.length}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar border-y border-gray-100 p-2 min-h-[150px]">
                {filteredOptions.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic text-center py-6">Sin coincidencias</p>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {filteredOptions.map((val) => (
                            <label key={val} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.has(val)}
                                    onChange={() => toggleValue(val)}
                                    className="size-4 rounded border-gray-300 text-[#621f32] focus:ring-[#621f32]/20 cursor-pointer"
                                />
                                <span className={`text-[11px] font-bold uppercase truncate ${selectedValues.has(val) ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                    {val}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-gray-50 flex items-center justify-between">
                <button onClick={clearFilter} className="text-[10px] font-bold text-gray-500 uppercase hover:text-red-600 transition-colors">
                    Limpiar
                </button>
                <button onClick={onClose} className="px-5 py-2 bg-[#621f32] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#4a1726] transition-all shadow-md shadow-[#621f32]/20">
                    Aplicar
                </button>
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
export default function EmployeesModal({ open, onOpenChange, nivel, estatus, ua }) {
    const [dynamicColumns, setDynamicColumns] = useState([]);
    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Estados de la Tabla Custom
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [textFilters, setTextFilters] = useState({});
    const [columnWidths, setColumnWidths] = useState(() => {
        setDynamicColumns([]);
    });
    const [popupConfig, setPopupConfig] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isClosing, setIsClosing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!nivel || !estatus) return;
        setLoading(true);
        setError(null);
        try {
            const response = await VacantesService.getEmpleadosPorNivelYEstatus(nivel, estatus);
            const data = await response.json();
            if (response.ok) {
                let results = data.resultados || [];
                if (ua) {
                    const searchUa = String(ua).trim().toLowerCase();
                    const filtered = results.filter(r => {
                        const val1 = String(r.unidad_administrativa || '').trim().toLowerCase();
                        const val2 = String(r.desc_unidad_administrativa || '').trim().toLowerCase();
                        return val1 === searchUa || val2 === searchUa;
                    });
                    
                    if (filtered.length === 0 && results.length > 0) {
                        setError(`DEBUG: Buscando UA "${ua}". Las disponibles en los datos son: ${Array.from(new Set(results.map(r => r.unidad_administrativa || r.desc_unidad_administrativa || 'NULO'))).join(' | ')}`);
                        setLoading(false);
                        return;
                    }
                    results = filtered;
                }
                if (results.length > 0) {
                    const firstRow = results[0];
                    const generatedColumns = Object.keys(firstRow).filter(k => k !== 'id').map(key => ({
                        key: key,
                        label: key.replace(/_/g, ' ').toUpperCase(),
                        width: 160
                    }));
                    setDynamicColumns(generatedColumns);
                    const initialWidths = {};
                    generatedColumns.forEach(c => initialWidths[c.key] = c.width);
                    setColumnWidths(initialWidths);
                }
                setRowData(results);
            } else {
                setError(data.mensaje || data.error || "Error al cargar los datos.");
            }
        } catch (err) {
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    }, [nivel, estatus, ua]);

    useEffect(() => {
        if (open) {
            setIsClosing(false);
            fetchData();
            setFilters({});
            setTextFilters({});
            setSortConfig({ key: null, direction: 'asc' });
            setCurrentPage(1);
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setRowData([]);
                setPopupConfig(null);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [open, fetchData]);

    const handleResizeStart = (e, colKey) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startWidth = columnWidths[colKey];
        const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(80, startWidth + (moveEvent.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return { key: null, direction: 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const processedData = useMemo(() => {
        let result = [...rowData];
        Object.entries(filters).forEach(([key, filter]) => {
            result = result.filter(row => {
                const val = String(row[key] ?? "");
                return filter.values.has(val);
            });
        });
        Object.entries(textFilters).forEach(([key, term]) => {
            if (!term) return;
            const lowerTerm = term.toLowerCase();
            result = result.filter(row => String(row[key] ?? "").toLowerCase().includes(lowerTerm));
        });
        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (valA === valB) return 0;
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [rowData, filters, textFilters, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, textFilters, pageSize, sortConfig.key, sortConfig.direction]);

    const openFilter = (e, column) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setPopupConfig({ column, x: rect.left, y: rect.bottom + 8 });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-fit max-w-[96vw] lg:max-w-[95vw] max-h-[94vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
                onClick={() => setPopupConfig(null)}
            >
                <Zoom 
                    triggerOnce 
                    duration={500} 
                    className={`w-full max-h-[94vh] min-h-0 flex flex-col ${isClosing ? 'animate-out fade-out-0 zoom-out-90 duration-300' : ''}`}
                >
                    <div className="w-full max-h-[94vh] min-h-0 bg-white flex flex-col p-6 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <DialogHeader className="mb-6 shrink-0 flex flex-row justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-[#621f32] rounded-xl shadow-xl shadow-[#621f32]/20 text-white">
                                    <Filter className="size-7 text-[#bc955c]" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-bold text-[#621f32] tracking-tight">
                                        Listado de Empleados <span className="text-[#bc955c] ml-2 px-4 py-1.5 bg-[#bc955c]/10 rounded-full text-base font-bold border border-[#bc955c]/20">
                                            Nivel: <span className="text-[#621f32]">{nivel}</span> <span className="mx-2 text-gray-300">|</span> Estatus: <span className="text-[#621f32]">{estatus}</span>
                                        </span>
                                    </DialogTitle>
                                    <DialogDescription className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider">
                                        Exploración y Filtrado Avanzado de Capital Humano
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className={`flex flex-col flex-1 min-h-0 w-full relative overflow-hidden transition-all duration-300 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-50 rounded-xl">
                                    <Loader2 className="size-12 text-[#621f32] animate-spin mb-4" />
                                    <p className="text-[#621f32] font-bold text-sm uppercase tracking-widest animate-pulse">Analizando registros...</p>
                                </div>
                            ) : error ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-red-50/10 rounded-xl border-2 border-dashed border-red-100/30">
                                    <div className="size-20 bg-red-100/20 rounded-2xl flex items-center justify-center mb-6 text-red-600 shadow-xl shadow-red-100/10">
                                        <X className="size-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Error de carga</h3>
                                    <p className="text-gray-500 max-w-md font-medium">{error}</p>
                                    <button onClick={fetchData} className="mt-8 px-10 py-3 bg-[#621f32] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-xl shadow-[#621f32]/30 active:scale-95">
                                        Reintentar ahora
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar" onScroll={() => setPopupConfig(null)}>
                                        <table className="w-max min-w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
                                            <thead className="sticky top-0 z-20 shadow-md">
                                                <tr className="bg-[#501929]/90 text-white shadow-md">
                                                    {dynamicColumns.map(col => {
                                                        const isFiltered = !!filters[col.key];
                                                        const isSorted = sortConfig.key === col.key;
                                                        return (
                                                            <th key={col.key} style={{ width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key] }} className="relative py-2.5 px-4 border-r border-[#621f32]/30 select-none group/th align-middle bg-[#501929]">
                                                                <div className="flex items-center justify-between gap-2 h-8 bg-transparent">
                                                                    <div role="button" tabIndex={0} className="flex-1 flex items-center gap-1.5 cursor-pointer overflow-hidden hover:opacity-80 transition-opacity py-0.5" onClick={() => handleSort(col.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(col.key); }}>
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest truncate ${isSorted ? 'text-[#bc955c]' : 'text-slate-200'}`}>
                                                                            {col.label}
                                                                        </span>
                                                                        {isSorted ? (
                                                                            sortConfig.direction === 'asc' ? <ArrowUpAZ className="size-3.5 shrink-0 text-[#bc955c]" /> : <ArrowDownAZ className="size-3.5 shrink-0 text-[#bc955c]" />
                                                                        ) : (
                                                                            <ChevronsUpDown className="size-3 shrink-0 text-white/30 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                                                        )}
                                                                    </div>
                                                                    <button onClick={(e) => openFilter(e, col)} className={`p-1 rounded-md transition-all duration-200 shrink-0 ${isFiltered ? 'text-amber-300 scale-105' : 'text-white/60 hover:bg-white/10'}`}>
                                                                        <Filter className="size-3" />
                                                                    </button>
                                                                </div>
                                                                <div role="separator" aria-label="Cambiar tamaño de columna" tabIndex={-1} onMouseDown={(e) => handleResizeStart(e, col.key)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#bc955c] active:bg-[#bc955c] transition-colors z-30" />
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                                <tr className="bg-[#40121e]/80">
                                                    {dynamicColumns.map(col => (
                                                        <th key={`search-${col.key}`} className="p-1.5 border-r border-b border-[#621f32]/30 last:border-r-0">
                                                            <div className="relative group/search flex items-center">
                                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-2.5 text-white/40" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Filtrar..."
                                                                    value={textFilters[col.key] || ""}
                                                                    onChange={(e) => setTextFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                                                    className="w-full pl-6 pr-2 py-1.5 bg-white/10 hover:bg-white/20 focus:bg-white/30 border border-white/5 focus:border-[#bc955c]/50 rounded-md text-[9px] font-bold text-white placeholder-white/30 transition-all outline-none"
                                                                />
                                                                {textFilters[col.key] && (
                                                                    <button onClick={() => setTextFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#621f32] transition-colors">
                                                                        <X className="size-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {paginatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={dynamicColumns.length || 1} className="py-32 text-center bg-slate-50">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                                    <Search className="size-8 text-slate-300" />
                                                                </div>
                                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No se encontraron registros</p>
                                                                {(Object.keys(filters).length > 0 || Object.keys(textFilters).length > 0) && (
                                                                    <button onClick={() => { setFilters({}); setTextFilters({}); }} className="mt-6 px-6 py-2.5 bg-[#621f32] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-lg shadow-[#621f32]/20">
                                                                        Restablecer Filtros
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedData.map((row, index) => (
                                                        <tr key={row.num_empleado ? String(row.num_empleado) : `fallback-row-${index}`} className="hover:bg-[#621f32]/[0.015] h-[37px] transition-colors border-b border-slate-100 last:border-0 bg-transparent">
                                                            {dynamicColumns.map(col => (
                                                                <td key={col.key} className="px-4 text-xs font-semibold text-slate-700 truncate border-r border-slate-100 last:border-r-0 align-middle" title={row[col.key]}>
                                                                    {row[col.key] || <span className="text-slate-300 italic font-normal">-</span>}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 shrink-0">
                                        <div className="flex items-center gap-6">
                                            <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Registros</span>
                                                <span className="text-[#621f32] text-base font-bold">{processedData.length.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mostrar</span>
                                                <div className="flex gap-1">
                                                    {[20, 50, 100, 500].map((size) => (
                                                        <button key={size} onClick={() => setPageSize(size)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-300 ${pageSize === size ? 'bg-[#621f32] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-[#621f32]'}`}>
                                                            {size}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {(Object.keys(filters).length > 0 || Object.keys(textFilters).length > 0) && (
                                                <button onClick={() => { setFilters({}); setTextFilters({}); setSortConfig({ key: null, direction: 'asc' }); }} className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-widest px-2 border-l border-slate-200 ml-2">
                                                    Limpiar Filtros
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-20 transition-all">
                                                <ChevronLeft className="size-5" />
                                            </button>
                                            <div className="flex items-center px-4">
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Página</span>
                                                <span className="mx-2 text-[13px] font-bold text-[#621f32]">{currentPage}</span>
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mx-1">de</span>
                                                <span className="text-[13px] font-bold text-slate-500 ml-1">{totalPages}</span>
                                            </div>
                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-20 transition-all">
                                                <ChevronRight className="size-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Zoom>

                {popupConfig && (
                    <FilterPopup column={popupConfig.column} rowData={rowData} filters={filters} setFilters={setFilters} onClose={() => setPopupConfig(null)} position={{ x: popupConfig.x, y: popupConfig.y }} />
                )}
            </DialogContent>
        </Dialog>
    );
}
