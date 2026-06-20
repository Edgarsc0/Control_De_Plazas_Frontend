import { useState, useMemo, useRef, useEffect, startTransition } from "react";
import { Filter, ArrowUpDown, Eye } from "lucide-react";

export default function OcupacionTableView({ tableHeaders, filteredFilas, handleDrillDown, onViewOficioDetails }) {
    const initialColumns = useMemo(() => {
        return tableHeaders.map(h => ({
            key: h,
            label: h === "Of. De Solicitud" ? "Oficio de Solicitud" : h,
            width: h === "Of. De Solicitud" ? 360 : 120
        }));
    }, [tableHeaders]);

    const [columns, setColumns] = useState(initialColumns);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
    const [dropdownSearch, setDropdownSearch] = useState("");
    const dropdownRef = useRef(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setColumns(initialColumns);
        setSortConfig({ key: null, direction: null });
        setColumnFilters({});
        setActiveFilterDropdown(null);
        setDropdownSearch("");
    }, [initialColumns]);

    useEffect(() => {
        setIsMounted(true);
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveFilterDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSort = (key) => {
        startTransition(() => {
            let direction = "asc";
            if (sortConfig.key === key) {
                if (sortConfig.direction === "asc") direction = "desc";
                else { key = null; direction = null; }
            }
            setSortConfig({ key, direction });
        });
    };

    const openFilterDropdown = (key) => {
        setDropdownSearch("");
        if (activeFilterDropdown === key) setActiveFilterDropdown(null);
        else setActiveFilterDropdown(key);
    };

    const toggleFilter = (colKey, value) => {
        startTransition(() => {
            const current = columnFilters[colKey] || [];
            const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
            const newFilters = { ...columnFilters };
            if (next.length === 0) delete newFilters[colKey];
            else newFilters[colKey] = next;
            setColumnFilters(newFilters);
        });
    };

    const clearFilter = (colKey) => {
        startTransition(() => {
            const newFilters = { ...columnFilters };
            delete newFilters[colKey];
            setColumnFilters(newFilters);
        });
        setActiveFilterDropdown(null);
    };

    const handleMouseDown = (e, index) => {
        e.preventDefault();
        const startX = e.clientX, startWidth = columns[index].width;
        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            setColumns(prevCols => {
                const newCols = [...prevCols];
                newCols[index] = { ...newCols[index], width: Math.max(60, startWidth + deltaX) };
                return newCols;
            });
        };
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const uniqueColumnValues = useMemo(() => {
        const uniques = {};
        columns.forEach(col => {
            const vals = new Set();
            filteredFilas.forEach(row => {
                let v = row[col.key];
                if (v === null || v === undefined || v === "" || v === "(vacío)") v = "(Vacío)";
                vals.add(String(v));
            });
            uniques[col.key] = Array.from(vals).sort();
        });
        return uniques;
    }, [filteredFilas, columns]);

    const filteredSortedData = useMemo(() => {
        let result = [...filteredFilas];

        // Array Filters (Embudo) - Solo se aplica si la columna es 'Of. De Solicitud'
        Object.entries(columnFilters).forEach(([key, values]) => {
            if (key === "Of. De Solicitud" && values !== undefined) {
                result = result.filter(row => {
                    let cellValue = row[key];
                    if (cellValue === null || cellValue === undefined || cellValue === "" || cellValue === "(vacío)") {
                        cellValue = "(Vacío)";
                    }
                    return values.includes(String(cellValue));
                });
            }
        });

        // Sort
        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                const isNumA = typeof valA === "number";
                const isNumB = typeof valB === "number";
                
                if (isNumA && isNumB) {
                    return sortConfig.direction === "asc" ? valA - valB : valB - valA;
                }
                
                if (valA === null || valA === undefined) valA = "";
                if (valB === null || valB === undefined) valB = "";
                if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
                if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [filteredFilas, columnFilters, sortConfig]);

    const filteredUniqueValues = useMemo(() => {
        if (!activeFilterDropdown) return [];
        const vals = uniqueColumnValues[activeFilterDropdown] || [];
        if (!dropdownSearch) return vals;
        return vals.filter(v => v.toLowerCase().includes(dropdownSearch.toLowerCase()));
    }, [uniqueColumnValues, activeFilterDropdown, dropdownSearch]);

    const isAllChecked = useMemo(() => {
        if (!activeFilterDropdown) return true;
        const allVals = uniqueColumnValues[activeFilterDropdown] || [];
        const checkedVals = columnFilters[activeFilterDropdown];
        return !checkedVals || checkedVals.length === 0 || checkedVals.length === allVals.length;
    }, [uniqueColumnValues, columnFilters, activeFilterDropdown]);

    const handleSelectAll = () => {
        if (!activeFilterDropdown) return;
        if (isAllChecked) {
            // Deselect all
            setColumnFilters(prev => ({ ...prev, [activeFilterDropdown]: [] }));
        } else {
            // Select all (clear filter)
            setColumnFilters(prev => {
                const next = { ...prev };
                delete next[activeFilterDropdown];
                return next;
            });
        }
    };

    const handleCheckboxChange = (val) => {
        if (!activeFilterDropdown) return;
        const currentFilters = columnFilters[activeFilterDropdown];
        const allVals = uniqueColumnValues[activeFilterDropdown] || [];
        
        let nextFilters;
        if (!currentFilters || currentFilters.length === 0) {
            nextFilters = allVals.filter(v => v !== val);
        } else {
            if (currentFilters.includes(val)) {
                nextFilters = currentFilters.filter(v => v !== val);
            } else {
                nextFilters = [...currentFilters, val];
            }
        }

        if (nextFilters.length === allVals.length) {
            setColumnFilters(prev => {
                const next = { ...prev };
                delete next[activeFilterDropdown];
                return next;
            });
        } else {
            setColumnFilters(prev => ({ ...prev, [activeFilterDropdown]: nextFilters }));
        }
    };

    const isValChecked = (val) => {
        if (!activeFilterDropdown) return true;
        const currentFilters = columnFilters[activeFilterDropdown];
        if (!currentFilters || currentFilters.length === 0) return true;
        return currentFilters.includes(val);
    };

    return (
        <div className="size-full bg-white overflow-hidden flex flex-col p-6 relative">
            <div className="overflow-auto relative flex-1 min-h-0 border border-slate-200 rounded-xl custom-scrollbar shadow-sm">
                <table className="text-left text-gray-500 border-collapse w-full animate-fade-in" style={{ tableLayout: "fixed", minWidth: columns.reduce((sum, col) => sum + col.width, 0) }}>
                    <colgroup>
                        {columns.map(col => <col key={col.key} style={{ width: col.width }} />)}
                    </colgroup>
                    
                    {/* STYLE: Format as Table from Excel (Solid Header, Elegant borders) */}
                    <thead className="bg-[#621f32] text-white sticky top-0 z-40 shadow-sm border-b border-slate-300">
                        <tr>
                            {columns.map((col, index) => {
                                const isOfficeCol = col.key === "Of. De Solicitud";
                                return (
                                    <th key={col.key} className={`relative py-3.5 px-4 font-extrabold text-[10px] uppercase border-r border-[#802842] bg-[#621f32] text-slate-100 select-none ${isOfficeCol ? "text-left" : "text-center"}`}>
                                        <div className={`flex items-center w-full gap-2 ${isOfficeCol ? "justify-between" : "justify-center"}`}>
                                            <div onClick={() => handleSort(col.key)} className={`flex items-center gap-1.5 cursor-pointer py-0.5 truncate ${isOfficeCol ? "flex-1 text-left" : "justify-center"}`}>
                                                <span>{col.label}</span>
                                                <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />
                                            </div>
                                        </div>
                                        <div 
                                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-20 hover:bg-[#621f32]/30 active:bg-[#621f32]/60 transition-colors" 
                                            onMouseDown={(e) => handleMouseDown(e, index)} 
                                        />
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredSortedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-20 text-center bg-white border border-slate-100">
                                    <div className="flex flex-col items-center justify-center">
                                        <h4 className="text-sm font-black text-gray-700">Sin coincidencias</h4>
                                        <p className="text-xs text-gray-400 mt-1">Intente ajustar los filtros de búsqueda</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredSortedData.map((row, rowIdx) => (
                                /* Alternate row styling (Zebra stripes: format as table style with wine tint) */
                                <tr key={rowIdx} className={`h-[36px] transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-[#f9eff1]/30"} hover:bg-[#621f32]/5 border-b border-slate-200`}>
                                    {columns.map((col) => {
                                        const val = row[col.key];
                                        const isOfficeCol = col.key === "Of. De Solicitud";
                                        const isTotalCol = col.key === "Total Resultado";
                                        const isLevelCol = !isOfficeCol && !isTotalCol;

                                        let displayVal = val;
                                        if (isOfficeCol && (val === "(vacío)" || val === null || val === undefined || val === "")) {
                                            displayVal = <span className="text-gray-400/80 italic font-semibold uppercase tracking-wider text-[9px]">Sin registro</span>;
                                        } else if (typeof val === "number") {
                                            displayVal = isMounted ? val.toLocaleString() : String(val);
                                        }

                                        const canDrillDown = isOfficeCol || (isLevelCol && val > 0);

                                        return (
                                            <td 
                                                key={col.key} 
                                                onClick={() => {
                                                    if (!canDrillDown) return;
                                                    if (isOfficeCol) handleDrillDown(row["Of. De Solicitud"], null);
                                                    if (isLevelCol) handleDrillDown(row["Of. De Solicitud"], col.key);
                                                }}
                                                className={`
                                                    px-4 text-[11px] border-r border-slate-200 align-middle h-[36px] whitespace-nowrap truncate overflow-hidden
                                                    ${isOfficeCol ? "font-bold text-slate-855 text-left flex items-center justify-between gap-2" : "text-center text-slate-655 font-semibold"}
                                                    ${isTotalCol ? "font-extrabold text-[#621f32] bg-[#621f32]/[0.01]" : ""}
                                                    ${canDrillDown ? "cursor-pointer hover:bg-[#621f32]/10 hover:text-[#621f32] transition-colors" : ""}
                                                `}
                                                title={isOfficeCol ? String(val) : ""}
                                            >
                                                {isOfficeCol ? (
                                                    <>
                                                        <div className="flex-1 truncate">
                                                            {displayVal !== null && displayVal !== undefined ? displayVal : "-"}
                                                        </div>
                                                        {val !== "(vacío)" && val !== null && val !== undefined && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onViewOficioDetails(row["Of. De Solicitud"]);
                                                                }}
                                                                className="p-1 rounded text-slate-400 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-colors shrink-0 flex items-center justify-center"
                                                                title="Ver expediente en Control de Gestión"
                                                            >
                                                                <Eye className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    displayVal !== null && displayVal !== undefined ? displayVal : "-"
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-30">
                        {/* Fila: Total ocupadas con oficio */}
                        <tr className="bg-slate-50 font-black text-[11px] h-[36px] border-t border-slate-200 border-b border-slate-200">
                            {columns.map((col) => {
                                const isOfficeCol = col.key === "Of. De Solicitud";
                                const isTotalCol = col.key === "Total Resultado";
                                
                                if (isOfficeCol) {
                                    return (
                                        <td key={col.key} className="px-4 border-r border-slate-200 align-middle text-slate-600 text-left font-bold uppercase tracking-wider">
                                            Total ocupadas con oficio
                                        </td>
                                    );
                                }

                                const sumOcupadas = filteredSortedData.reduce((acc, f) => acc + (f[`ocupadas_${col.key}`] || 0), 0);

                                return (
                                    <td key={col.key} className={`px-4 text-center border-r border-slate-200 align-middle font-bold tabular-nums ${isTotalCol ? "text-emerald-700 bg-emerald-50/10" : "text-emerald-650"}`}>
                                        {isMounted ? sumOcupadas.toLocaleString() : String(sumOcupadas)}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Accounting total borders (Double border at the bottom, solid top) */}
                        <tr className="bg-slate-55 bg-slate-50 font-black text-[11px] h-[38px] border-t border-slate-300 border-b-4 border-double border-slate-400">
                            {columns.map((col) => {
                                const isOfficeCol = col.key === "Of. De Solicitud";
                                const isTotalCol = col.key === "Total Resultado";
                                
                                if (isOfficeCol) {
                                    return (
                                        <td key={col.key} className="px-4 border-r border-slate-200 align-middle text-slate-700 text-left font-black uppercase tracking-wider">
                                            Total General
                                        </td>
                                    );
                                }

                                const sum = filteredSortedData.reduce((acc, f) => acc + (f[col.key] || 0), 0);

                                return (
                                    <td key={col.key} className={`px-4 text-center border-r border-slate-200 align-middle font-black tabular-nums ${isTotalCol ? "text-[#621f32] bg-[#621f32]/[0.01]" : "text-slate-800"}`}>
                                        {isMounted ? sum.toLocaleString() : String(sum)}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
