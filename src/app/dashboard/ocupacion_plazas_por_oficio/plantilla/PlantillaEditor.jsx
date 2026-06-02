"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PlantillaService } from "@/services/plantilla.service";
import { 
    X, Save, RefreshCw, Search, Filter as FilterIcon, 
    ChevronsUpDown, ArrowDownAZ, ArrowUpAZ, XCircle, Database,
    ChevronDown, Type, Check, Replace, ChevronLeft, ChevronRight,
    FileSpreadsheet, Copy, Trash2, Eraser, Undo2,
    Cloud, CloudOff, AlertCircle, Loader2, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

// --- UTILS DE NORMALIZACIÓN PARA BÚSQUEDA ROBUSTA ---
const normalizeString = (str) => {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .toLowerCase()
        .replace(/\r?\n|\r/g, " ")       // Reemplazar saltos de línea con espacio
        .replace(/\s+/g, " ")            // Colapsar múltiples espacios a uno solo
        .trim();
};

const makeReplaceRegex = (term) => {
    if (!term) return null;
    // Escapar caracteres especiales de regex
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Hacer que cualquier espacio o secuencia de espacios/saltos coincida con cualquier espacio/salto del texto original
    const flexibleWhitespace = escaped.replace(/\s+/g, '[\\s\\r\\n]+');
    return new RegExp(flexibleWhitespace, 'gi');
};

// --- OPERADORES DE FILTRO TEXTUAL ---
const TEXT_OPERATORS = [
    { id: 'contains', label: 'Contiene' },
    { id: 'equals', label: 'Es igual a' },
    { id: 'starts', label: 'Empieza con' },
    { id: 'ends', label: 'Termina con' },
    { id: 'empty', label: 'Está vacío' },
    { id: 'not_empty', label: 'No está vacío' }
];

// --- COMPONENTE SELECT PERSONALIZADO ---
const CustomSelect = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.id === value) || options[0];
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-black text-gray-700 hover:border-[#621f32]/30 transition-all outline-none"
            >
                <span className="uppercase tracking-tight">{selectedOption.label}</span>
                <ChevronDown className={`size-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute left-0 w-full bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 rounded-xl py-1.5 transform-gpu z-[1010]"
                        style={{ top: '100%' }}
                    >
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                                className={`w-full flex items-center justify-between px-4 py-2 text-[10px] font-black uppercase transition-colors ${value === opt.id ? 'bg-[#621f32]/5 text-[#621f32]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                            >
                                {opt.label}
                                {value === opt.id && <Check className="size-3.5" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- COMPONENTE TOOLTIP ---
const Tooltip = ({ children, content }) => {
    const [isVisible, setIsOpen] = useState(false);
    return (
        <div className="relative flex items-center" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 5, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl z-[2000] whitespace-nowrap pointer-events-none"
                    >
                        {content}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 bg-gray-900 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- COMPONENTE MENU CONTEXTO ---
const ContextMenu = ({ x, y, onAction, onClose }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed z-[3000] bg-white shadow-2xl border border-gray-100 rounded-xl py-1.5 w-48 overflow-hidden transform-gpu"
            style={{ left: x, top: y }}
        >
            <ContextItem icon={<Copy size={14} />} label="Copiar Celda" onClick={() => onAction('copy_cell')} />
            <ContextItem icon={<Copy size={14} />} label="Copiar Selección" onClick={() => onAction('copy_selection')} />
            <ContextItem icon={<Copy size={14} />} label="Copiar Fila" onClick={() => onAction('copy_row')} />
            <div className="h-px bg-gray-50 my-1" />
            <ContextItem icon={<Eraser size={14} />} label="Limpiar Celda" onClick={() => onAction('clear_cell')} />
            <div className="h-px bg-gray-50 my-1" />
            <ContextItem icon={<Trash2 size={14} />} label="Eliminar Registro" color="text-red-500" onClick={() => onAction('delete_row')} />
        </motion.div>
    );
};

const ContextItem = ({ icon, label, onClick, color = "text-gray-700" }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors ${color} text-[10px] font-black uppercase tracking-tighter`}>
        {icon}
        {label}
    </button>
);

// --- COMPONENTE DE FILTRO AVANZADO ---
const FilterPopup = ({ column, rowData, filters, setFilters, onClose, position }) => {
    const allValues = useMemo(() => {
        const unique = new Set();
        rowData.forEach(row => {
            const val = row[column];
            unique.add(val !== undefined && val !== null && val !== "" ? String(val) : "(vacío)");
        });
        return Array.from(unique).sort();
    }, [rowData, column]);

    const activeFilter = filters[column] || { type: 'set', values: new Set(allValues), operator: 'contains', text: '' };
    const [filterType, setFilterType] = useState(activeFilter.type || 'set');
    const [selectedValues, setSelectedValues] = useState(new Set(activeFilter.values || allValues));
    const [operator, setOperator] = useState(activeFilter.operator || 'contains');
    const [filterText, setFilterText] = useState(activeFilter.text || '');
    const [searchText, setSearchText] = useState("");

    const applyFilter = () => {
        setFilters(prev => ({
            ...prev,
            [column]: { type: filterType, values: filterType === 'set' ? selectedValues : null, operator: filterType === 'text' ? operator : null, text: filterType === 'text' ? filterText : null }
        }));
        onClose();
    };

    const clearFilter = () => {
        setFilters(prev => { const n = { ...prev }; delete n[column]; return n; });
        onClose();
    };

    const toggleValue = (val) => {
        const next = new Set(selectedValues);
        if (next.has(val)) next.delete(val); else next.add(val);
        setSelectedValues(next);
    };

    const toggleAll = () => setSelectedValues(selectedValues.size === allValues.length ? new Set() : new Set(allValues));
    const filteredOptions = allValues.filter(v => v.toLowerCase().includes(searchText.toLowerCase()));

    return (
        <div
            role="dialog"
            aria-label="Filtro de columna"
            className="fixed z-[999] flex flex-col min-w-[320px] max-h-[80vh] bg-white shadow-2xl border border-gray-100 transform-gpu animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            style={{
                left: Math.min(position.x, window.innerWidth - 340),
                top: Math.min(position.y, window.innerHeight - 450)
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex border-b border-gray-100 bg-gray-50/50 relative z-20 shrink-0">
                <button onClick={() => setFilterType('set')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${filterType === 'set' ? 'bg-white border-b-2 border-[#621f32] text-[#621f32]' : 'text-gray-400 hover:text-gray-600'}`}>Selección</button>
                <button onClick={() => setFilterType('text')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${filterType === 'text' ? 'bg-white border-b-2 border-[#621f32] text-[#621f32]' : 'text-gray-400 hover:text-gray-600'}`}>Filtro de Texto</button>
            </div>
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden relative z-10 min-h-0">
                {filterType === 'set' ? (
                    <>
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 focus-within:border-[#621f32]/30 shrink-0">
                            <Search className="size-4 text-gray-400" />
                            <input type="text" placeholder="Buscar en lista..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-gray-700" />
                        </div>
                        <div className="flex items-center justify-between px-1 shrink-0">
                            <button onClick={toggleAll} className="text-[9px] font-black text-[#621f32] uppercase hover:underline">{selectedValues.size === allValues.length ? 'Desmarcar todo' : 'Marcar todo'}</button>
                            <span className="text-[9px] font-black text-gray-400">{selectedValues.size} / {allValues.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-100 rounded-xl p-1 min-h-[150px] bg-gray-50/30">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((val) => (
                                    <label key={val} className="flex items-center gap-2.5 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all group">
                                        <input type="checkbox" checked={selectedValues.has(val)} onChange={() => toggleValue(val)} className="size-4 rounded border-gray-300 text-[#621f32] focus:ring-0" />
                                        <span className={`text-[10px] font-bold uppercase truncate ${selectedValues.has(val) ? 'text-gray-900' : 'text-gray-400'}`}>{val}</span>
                                    </label>
                                ))
                            ) : (
                                <div className="py-10 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Sin coincidencias</div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-6 py-2 overflow-y-auto custom-scrollbar pr-2">
                        <div className="space-y-2 relative z-[1005]">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Condición</label>
                            <CustomSelect value={operator} options={TEXT_OPERATORS} onChange={setOperator} />
                        </div>
                        {operator !== 'empty' && operator !== 'not_empty' && (
                            <div className="space-y-2 relative z-0">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Valor a buscar</label>
                                <div className="relative">
                                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-300" />
                                    <input type="text" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Escribe el criterio..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 outline-none focus:border-[#621f32]/30" />
                                </div>
                            </div>
                        )}
                        <div className="p-4 bg-[#bc955c]/5 border border-[#bc955c]/20 rounded-xl relative z-0 text-center">
                            <p className="text-[9px] font-bold text-[#bc955c] leading-relaxed uppercase tracking-tighter">Búsqueda inteligente sin distinción de mayúsculas.</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4 relative z-20 shrink-0">
                <button onClick={clearFilter} className="text-[10px] font-black text-gray-400 uppercase hover:text-red-500 transition-colors">Limpiar</button>
                <div className="flex gap-2 flex-1"><button onClick={onClose} className="flex-1 py-2 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button><button onClick={applyFilter} className="flex-1 py-2 bg-[#621f32] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#4a1726] shadow-lg shadow-[#621f32]/20">Aplicar</button></div>
            </div>
        </div>
    );
};

// --- COMPONENTE DE EDICIÓN CON AUTOCOMPLETADO ---
const AutocompleteInput = ({ value, options, onSave, onCancel, initialChar = "" }) => {
    const [text, setText] = useState(initialChar || value || "");
    const [isOpen, setIsOpen] = useState(true);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const filteredOptions = useMemo(() => {
        let baseOptions = options;
        const lowerText = text.toLowerCase();
        let filtered = lowerText ? baseOptions.filter(o => o.toLowerCase().includes(lowerText)) : baseOptions;
        const vacioIndex = filtered.findIndex(o => o === "(vacío)" || o === "");
        if (vacioIndex > -1) { filtered.splice(vacioIndex, 1); filtered.unshift("(vacío)"); }
        else if (!lowerText || "(vacío)".includes(lowerText)) { filtered.unshift("(vacío)"); }
        return Array.from(new Set(filtered)).slice(0, 10);
    }, [text, options]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev + 1) % filteredOptions.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length); }
        else if (e.key === 'Enter' || e.key === 'Tab') {
            if (isOpen && filteredOptions.length > 0) { e.preventDefault(); onSave(filteredOptions[highlightedIndex]); }
            else if (e.key === 'Enter') { e.preventDefault(); onSave(text); }
        } else if (e.key === 'Escape') { onCancel(); }
    };

    return (
        <div className="absolute inset-0 z-[1000]">
            <input autoFocus className="size-full px-3 bg-white border-2 border-[#621f32] outline-none font-bold text-[11px] shadow-2xl" value={text} onChange={(e) => { setText(e.target.value); setIsOpen(true); setHighlightedIndex(0); }} onKeyDown={handleKeyDown} onBlur={() => setTimeout(() => onSave(text), 250)} />
            {isOpen && filteredOptions.length > 0 && (
                <div className="absolute left-0 w-full bg-white shadow-[0_15px_50px_-12px_rgba(0,0,0,0.25)] border-2 border-[#621f32] border-t-0 z-[1001] py-1 transform-gpu overflow-hidden" style={{ top: '100%' }}>
                    {filteredOptions.map((opt, i) => (
                        <div key={opt} role="option" aria-selected={i === highlightedIndex} className={`px-3 py-2 text-[10px] font-bold uppercase cursor-pointer border-b last:border-0 border-gray-50 ${i === highlightedIndex ? 'bg-[#621f32] text-white' : 'hover:bg-gray-100 text-gray-700'}`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSave(opt); }}><span className="truncate block">{opt}</span></div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function PlantillaEditor({ initialData }) {
    // --- 1. ESTADO BASE ---
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const [rowData, setRowData] = useState(initialData || []);
    const [loading, setLoading] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [textFilters, setTextFilters] = useState({});
    const [popupConfig, setPopupConfig] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [focusedCell, setFocusedCell] = useState({ rowIndex: 0, colKey: 'id' });
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [selectionType, setSelectionType] = useState('cell'); 
    const [isSelecting, setIsSelecting] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
    const [findTerm, setFindTerm] = useState("");
    const [replaceTerm, setReplaceTerm] = useState("");
    const [matches, setMatches] = useState([]);
    const [currentMatchIdx, setCurrentMatchIdx] = useState(-1);
    const [history, setHistory] = useState([]);
    const [saveStatus, setSaveStatus] = useState("idle"); // 'idle', 'saving', 'saved', 'error'

    const containerRef = useRef(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const autoScrollRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const rowHeight = 40;
    const viewportHeight = 800;

    // --- UNDO LOGIC ---
    const undo = useCallback(async () => {
        if (history.length === 0) return;
        
        const lastState = history[history.length - 1];
        const currentData = rowData;
        
        setHistory(prev => prev.slice(0, -1));
        setRowData(lastState);

        // Identify which rows changed to sync with backend
        const rowsToSync = lastState.filter(oldRow => {
            const currentRow = currentData.find(r => r.id === oldRow.id);
            return currentRow && Object.keys(oldRow).some(key => oldRow[key] !== currentRow[key]);
        });

        if (rowsToSync.length > 0) {
            setSaveStatus("saving");
            try {
                await PlantillaService.updatePlantilla1800(rowsToSync);
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } catch (e) {
                console.error("Error syncing undo to backend:", e);
                setSaveStatus("error");
            }
        }
    }, [history, rowData]);

    // --- 2. MEMOS ---
    const columns = useMemo(() => rowData.length ? Object.keys(rowData[0]).map(key => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), width: key === 'id' ? 60 : 200 })) : [], [rowData]);
    const editableColumns = useMemo(() => columns.filter(c => c.key !== 'id'), [columns]);

    const processedData = useMemo(() => {
        let result = rowData;
        if (globalSearchTerm) {
            const term = normalizeString(globalSearchTerm);
            result = result.filter(r => Object.values(r).some(v => normalizeString(v).includes(term)));
        }
        Object.entries(textFilters).forEach(([k, t]) => {
            if (!t) return; 
            const lt = normalizeString(t);
            result = result.filter(r => normalizeString(r[k]).includes(lt));
        });
        Object.entries(filters).forEach(([k, f]) => {
            result = result.filter(r => {
                const rawVal = String(r[k] ?? "") || "(vacío)";
                const val = normalizeString(rawVal);
                if (f.type === 'set') return f.values.has(String(r[k] ?? "") || "(vacío)");
                if (f.type === 'text') {
                    const txt = normalizeString(f.text || "");
                    switch (f.operator) {
                        case 'contains': return val.includes(txt);
                        case 'equals': return val === txt;
                        case 'starts': return val.startsWith(txt);
                        case 'ends': return val.endsWith(txt);
                        case 'empty': return rawVal === "" || rawVal === "(vacío)";
                        case 'not_empty': return rawVal !== "" && rawVal !== "(vacío)";
                        default: return true;
                    }
                }
                return true;
            });
        });
        if (sortConfig.key) {
            const { key, direction } = sortConfig;
            result = [...result].sort((a, b) => {
                let vA = a[key], vB = b[key];
                if (vA === vB) return 0; if (vA == null) return 1; if (vB == null) return -1;
                const res = !isNaN(vA) && !isNaN(vB) ? vA - vB : String(vA).localeCompare(String(vB));
                return direction === 'asc' ? res : -res;
            });
        }
        return result;
    }, [rowData, filters, textFilters, sortConfig, globalSearchTerm]);

    const columnOptions = useMemo(() => {
        const options = {};
        columns.forEach(col => {
            const distinct = new Set();
            rowData.forEach(row => { if (row[col.key]) distinct.add(String(row[col.key])); });
            options[col.key] = Array.from(distinct).sort();
        });
        return options;
    }, [rowData, columns]);

    const [columnWidths, setColumnWidths] = useState({});
    useEffect(() => {
        const widths = {}; columns.forEach(c => widths[c.key] = c.width); setColumnWidths(widths);
    }, [columns]);

    // --- 3. LÓGICA DE SELECCIÓN ---
    const getSelectionRange = useCallback(() => {
        if (!focusedCell) return null;
        const colKeys = columns.map(c => c.key);
        const startRow = focusedCell.rowIndex;
        const startColIdx = colKeys.indexOf(focusedCell.colKey);
        if (!selectionEnd) {
            if (selectionType === 'row') return { startRow, endRow: startRow, startColIdx: 0, endColIdx: colKeys.length - 1, colKeys };
            if (selectionType === 'col') return { startRow: 0, endRow: processedData.length - 1, startColIdx, endColIdx: startColIdx, colKeys };
            return { startRow, endRow: startRow, startColIdx, endColIdx: startColIdx, colKeys };
        }
        const endRow = selectionEnd.rowIndex;
        const endColIdx = colKeys.indexOf(selectionEnd.colKey);
        if (selectionType === 'row') return { startRow: Math.min(startRow, endRow), endRow: Math.max(startRow, endRow), startColIdx: 0, endColIdx: colKeys.length - 1, colKeys };
        if (selectionType === 'col') return { startRow: 0, endRow: processedData.length - 1, startColIdx: Math.min(startColIdx, endColIdx), endColIdx: Math.max(startColIdx, endColIdx), colKeys };
        return { startRow: Math.min(startRow, endRow), endRow: Math.max(startRow, endRow), startColIdx: Math.min(startColIdx, endColIdx), endColIdx: Math.max(startColIdx, endColIdx), colKeys };
    }, [focusedCell, selectionEnd, selectionType, columns, processedData.length]);

    const isCellSelected = useCallback((rowIndex, colKey) => {
        const range = getSelectionRange();
        if (!range) return false;
        const colIdx = range.colKeys.indexOf(colKey);
        return rowIndex >= range.startRow && rowIndex <= range.endRow && colIdx >= range.startColIdx && colIdx <= range.endColIdx;
    }, [getSelectionRange]);

    const handleCellMouseDown = (e, rowIndex, colKey, type = 'cell') => { 
        if (editingCell) return; 
        if (e.button === 2 && isCellSelected(rowIndex, colKey)) return;
        setSelectionType(type);
        setFocusedCell({ rowIndex, colKey }); 
        setSelectionEnd({ rowIndex, colKey }); 
        setIsSelecting(true); 
    };
    const handleCellMouseEnter = (rowIndex, colKey) => { if (isSelecting) setSelectionEnd({ rowIndex, colKey }); };
    const handleMouseUpGlobal = useCallback(() => setIsSelecting(false), []);
    useEffect(() => { window.addEventListener('mouseup', handleMouseUpGlobal); return () => window.removeEventListener('mouseup', handleMouseUpGlobal); }, [handleMouseUpGlobal]);

    // --- LÓGICA DE AUTO-SCROLL DURANTE SELECCIÓN ---
    useEffect(() => {
        if (!isSelecting) {
            if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
            return;
        }

        const startAutoScroll = () => {
            if (!containerRef.current) return;
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            const { x, y } = mousePosRef.current;

            const threshold = 60; 
            const speed = 20; 

            let deltaX = 0;
            let deltaY = 0;

            if (y < rect.top + threshold) deltaY = -speed;
            else if (y > rect.bottom - threshold) deltaY = speed;

            if (x < rect.left + threshold + 60) deltaX = -speed; 
            else if (x > rect.right - threshold) deltaX = speed;

            if (deltaX !== 0 || deltaY !== 0) {
                container.scrollBy(deltaX, deltaY);
            }

            autoScrollRef.current = requestAnimationFrame(startAutoScroll);
        };

        autoScrollRef.current = requestAnimationFrame(startAutoScroll);
        return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
    }, [isSelecting]);

    const handleMouseMoveGlobal = useCallback((e) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMoveGlobal);
        return () => window.removeEventListener('mousemove', handleMouseMoveGlobal);
    }, [handleMouseMoveGlobal]);

    // --- 4. ACCIONES ---
    const handleCellSave = async (rowIndex, colKey, newValue) => {
        setEditingCell(null); const targetRow = processedData[rowIndex]; const valueToSave = newValue === "(vacío)" ? "" : newValue;
        if (!targetRow || targetRow[colKey] === valueToSave) return;
        const originalIndex = rowData.findIndex(r => r.id === targetRow.id);
        if (originalIndex === -1) return;
        setHistory(prev => [...prev, rowData].slice(-50));
        const newData = [...rowData]; newData[originalIndex] = { ...newData[originalIndex], [colKey]: valueToSave };
        setRowData(newData); 
        setSaveStatus("saving");
        try { 
            await PlantillaService.updatePlantilla1800(newData[originalIndex]); 
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (e) { 
            console.error(e); 
            setSaveStatus("error");
        }
    };

    const refreshData = async () => {
        setLoading(true); try { const res = await PlantillaService.getPlantilla1800(); setRowData(await res.json()); setHistory([]); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const filename = `Plantilla_1800_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
            const response = await PlantillaService.exportExcel(processedData, filename);
            if (!response.ok) throw new Error("Error en la exportación");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch (e) { console.error(e); alert("No se pudo generar el archivo Excel."); } finally { setLoading(false); }
    };

    // --- 5. NAVEGACIÓN Y TECLADO ---
    const handleTableKeyDown = useCallback((e) => {
        if (editingCell || (isFindReplaceOpen && document.activeElement.tagName === 'INPUT')) return;
        
        // --- UNDO ---
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }

        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault(); const range = getSelectionRange(); if (!range) return;
            let tsv = ""; const selectedColKeys = range.colKeys.slice(range.startColIdx, range.endColIdx + 1);
            for (let r = range.startRow; r <= range.endRow; r++) {
                const row = processedData[r]; if (!row) continue;
                tsv += (r === range.startRow ? "" : "\n") + selectedColKeys.map(k => row[k] || "").join("\t");
            }
            navigator.clipboard.writeText(tsv); return;
        }
        const colKeys = columns.map(c => c.key);
        const curIdx = colKeys.indexOf(focusedCell.colKey);
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedCell(p => ({ ...p, rowIndex: Math.min(processedData.length - 1, p.rowIndex + 1) })); setSelectionEnd(null); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedCell(p => ({ ...p, rowIndex: Math.max(0, p.rowIndex - 1) })); setSelectionEnd(null); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setFocusedCell(p => ({ ...p, colKey: colKeys[Math.min(colKeys.length - 1, curIdx + 1)] })); setSelectionEnd(null); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); setFocusedCell(p => ({ ...p, colKey: colKeys[Math.max(0, curIdx - 1)] })); setSelectionEnd(null); }
        else if (e.key === 'F2') { e.preventDefault(); setEditingCell({ ...focusedCell }); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { if (focusedCell.colKey !== 'id') handleCellSave(focusedCell.rowIndex, focusedCell.colKey, ""); }
        else if (e.key.length === 1 && focusedCell.colKey !== 'id' && !e.ctrlKey && !e.altKey && !e.metaKey) { setEditingCell({ ...focusedCell, initialChar: e.key }); }
    }, [focusedCell, editingCell, columns, processedData, isFindReplaceOpen, getSelectionRange, undo]);

    useEffect(() => {
        if (!focusedCell || !containerRef.current) return;
        const container = containerRef.current;
        const sTop = container.scrollTop, sLeft = container.scrollLeft;
        const vH = container.clientHeight, vW = container.clientWidth;
        const tTop = focusedCell.rowIndex * rowHeight;
        if (tTop < sTop) container.scrollTo({ top: tTop }); else if (tTop + rowHeight > sTop + vH) container.scrollTo({ top: tTop - vH + rowHeight });
        const colKeys = columns.map(c => c.key); const curIdx = colKeys.indexOf(focusedCell.colKey); if (curIdx <= 0) return;
        let lOff = 0; for (let i = 0; i < curIdx; i++) lOff += columnWidths[colKeys[i]] || 0;
        const cW = columnWidths[focusedCell.colKey] || 0, sW = columnWidths[colKeys[0]] || 0;
        if (lOff < sLeft + sW) container.scrollTo({ left: lOff - sW }); else if (lOff + cW > sLeft + vW) container.scrollTo({ left: lOff + cW - vW });
    }, [focusedCell.rowIndex, focusedCell.colKey, columnWidths, columns]);

    useEffect(() => {
        if (!findTerm || findTerm.length < 2) { setMatches([]); setCurrentMatchIdx(-1); return; }
        const newMatches = []; 
        const normalizedFind = normalizeString(findTerm);
        if (!normalizedFind) { setMatches([]); setCurrentMatchIdx(-1); return; }

        processedData.forEach((row, rIdx) => { 
            editableColumns.forEach(col => { 
                if (normalizeString(row[col.key]).includes(normalizedFind)) {
                    newMatches.push({ rowIndex: rIdx, colKey: col.key, rowId: row.id }); 
                }
            }); 
        });
        setMatches(newMatches); 
        if (newMatches.length > 0) { 
            setCurrentMatchIdx(0); 
            const m = newMatches[0]; 
            const tS = m.rowIndex * rowHeight - (viewportHeight / 2); 
            if (containerRef.current) containerRef.current.scrollTo({ top: Math.max(0, tS), behavior: 'smooth' }); 
        } else {
            setCurrentMatchIdx(-1);
        }
    }, [findTerm, processedData, editableColumns]);

    const navigateMatch = (direction) => {
        if (matches.length === 0) return;
        let nIdx = direction === 'next' ? currentMatchIdx + 1 : currentMatchIdx - 1;
        if (nIdx >= matches.length) nIdx = 0; if (nIdx < 0) nIdx = matches.length - 1;
        setCurrentMatchIdx(nIdx); const m = matches[nIdx]; setFocusedCell({ rowIndex: m.rowIndex, colKey: m.colKey });
    };

    const handleReplace = async () => {
        if (currentMatchIdx === -1) return; 
        const m = matches[currentMatchIdx]; 
        const tR = processedData[m.rowIndex]; 
        const oIdx = rowData.findIndex(r => r.id === tR.id);
        const regex = makeReplaceRegex(findTerm);
        if (!regex) return;
        const nV = String(tR[m.colKey]).replace(regex, replaceTerm); 
        setHistory(prev => [...prev, rowData].slice(-50));
        const nD = [...rowData]; 
        nD[oIdx] = { ...nD[oIdx], [m.colKey]: nV }; 
        setRowData(nD);
        setSaveStatus("saving");
        try { 
            await PlantillaService.updatePlantilla1800(nD[oIdx]); 
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (e) { 
            console.error(e); 
            setSaveStatus("error");
        }
    };

    const handleReplaceAll = async () => {
        if (matches.length === 0) return; 
        const regex = makeReplaceRegex(findTerm);
        if (!regex) return;
        setHistory(prev => [...prev, rowData].slice(-50));
        const nD = [...rowData]; 
        const uRows = new Set();
        matches.forEach(m => { 
            const rIdx = nD.findIndex(r => r.id === m.rowId); 
            if (rIdx > -1) { 
                nD[rIdx][m.colKey] = String(nD[rIdx][m.colKey]).replace(regex, replaceTerm); 
                uRows.add(rIdx); 
            } 
        });
        setRowData(nD); 
        setIsFindReplaceOpen(false); 
        setFindTerm(""); 
        setSaveStatus("saving");
        try {
            await Promise.all(Array.from(uRows).map(idx => PlantillaService.updatePlantilla1800(nD[idx])));
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (e) {
            console.error(e);
            setSaveStatus("error");
        }
    };

    const handleContextMenu = (e, rowIndex, colKey) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, rowIndex, colKey }); };
    const handleContextAction = async (action) => {
        if (!contextMenu) return; const { rowIndex, colKey } = contextMenu; const tR = processedData[rowIndex];
        if (action === 'clear_cell') handleCellSave(rowIndex, colKey, "");
        else if (action === 'copy_cell') navigator.clipboard.writeText(String(tR[colKey] || ""));
        else if (action === 'copy_selection') {
            const range = getSelectionRange(); if (!range) return;
            let tsv = ""; const selectedColKeys = range.colKeys.slice(range.startColIdx, range.endColIdx + 1);
            for (let r = range.startRow; r <= range.endRow; r++) {
                const row = processedData[r]; if (!row) continue;
                tsv += (r === range.startRow ? "" : "\n") + selectedColKeys.map(k => row[k] || "").join("\t");
            }
            navigator.clipboard.writeText(tsv);
        }
        else if (action === 'copy_row') navigator.clipboard.writeText(columns.map(c => tR[c.key] || "").join("\t"));
        else if (action === 'delete_row') { if (confirm("¿Eliminar registro?")) { setHistory(prev => [...prev, rowData].slice(-50)); setRowData(rowData.filter(r => r.id !== tR.id)); } }
        setContextMenu(null);
    };

    useEffect(() => {
        window.addEventListener('keydown', handleTableKeyDown);
        return () => window.removeEventListener('keydown', handleTableKeyDown);
    }, [handleTableKeyDown]);

    const handleTablePaste = useCallback(async (e) => {
        if (editingCell || (isFindReplaceOpen && document.activeElement.tagName === 'INPUT')) return;
        e.preventDefault(); const clipboardData = e.clipboardData.getData('text/plain'); if (!clipboardData) return;
        const rows = clipboardData.split(/\r?\n/).filter(line => line.length > 0); if (rows.length === 0) return;
        const colKeys = columns.map(c => c.key); const startColIdx = colKeys.indexOf(focusedCell.colKey); const startRowIdx = focusedCell.rowIndex;
        const newData = [...rowData]; const updates = [];
        rows.forEach((rowText, rOffset) => {
            const targetRowIdx = startRowIdx + rOffset; if (targetRowIdx >= processedData.length) return;
            const targetRow = processedData[targetRowIdx]; const oIdx = rowData.findIndex(r => r.id === targetRow.id); if (oIdx === -1) return;
            const cellValues = rowText.split('\t');
            cellValues.forEach((val, cOffset) => {
                const targetColIdx = startColIdx + cOffset; if (targetColIdx >= colKeys.length) return;
                const colKey = colKeys[targetColIdx]; if (colKey === 'id') return;
                const cleanVal = val.replace(/^"|"$/g, '').trim(); newData[oIdx][colKey] = cleanVal;
                if (!updates.find(u => u.id === targetRow.id)) updates.push(newData[oIdx]);
            });
        });
        setHistory(prev => [...prev, rowData].slice(-50));
        setRowData(newData); 
        if (updates.length > 0) {
            setSaveStatus("saving");
            try { 
                await PlantillaService.updatePlantilla1800(updates); 
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } catch (err) { 
                console.error(err); 
                setSaveStatus("error");
            }
        }
    }, [focusedCell, rowData, processedData, columns, editingCell, isFindReplaceOpen]);

    useEffect(() => { window.addEventListener('paste', handleTablePaste); return () => window.removeEventListener('paste', handleTablePaste); }, [handleTablePaste]);

    const handleScroll = useCallback((e) => { setScrollTop(e.target.scrollTop); if (popupConfig) setPopupConfig(null); if (contextMenu) setContextMenu(null); }, [popupConfig, contextMenu]);
    const visibleRange = useMemo(() => { const s = Math.floor(scrollTop / rowHeight); return { start: Math.max(0, s), end: Math.min(processedData.length, Math.floor((scrollTop + viewportHeight) / rowHeight) + 5) }; }, [scrollTop, processedData.length]);

    const handleResizeStart = (e, colKey) => {
        e.preventDefault(); e.stopPropagation(); const startX = e.pageX; const startWidth = columnWidths[colKey];
        const onMouseMove = (me) => setColumnWidths(p => ({ ...p, [colKey]: Math.max(80, startWidth + (me.pageX - startX)) }));
        const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div role="presentation" className="flex flex-col h-screen w-full bg-white text-gray-900 font-sans overflow-hidden transform-gpu" onClick={() => { setPopupConfig(null); setContextMenu(null); }}>
            <div className="h-24 shrink-0 bg-gray-50 border-b border-gray-100" />
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 bg-white sticky top-0 z-[100]">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/ocupacion_plazas_por_oficio" className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 text-gray-500 rounded-xl transition-all border border-transparent hover:border-gray-200 group">
                        <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" /><span className="text-[10px] font-black uppercase tracking-widest">Volver a dashboard</span>
                    </Link>
                    <div className="w-px h-6 bg-gray-100 mx-2" /><h1 className="text-base font-black uppercase tracking-tight">Plantilla <span className="text-[#621f32]">Excel</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <Tooltip content="Deshacer (Ctrl+Z)"><button onClick={undo} disabled={!isMounted || history.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border border-gray-100 text-gray-500 hover:bg-gray-50 disabled:opacity-30"><Undo2 size={12} /> Deshacer</button></Tooltip>
                    <Tooltip content="Exportar Excel (.xlsx)"><button onClick={exportToExcel} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border border-gray-100 text-green-600 hover:bg-green-50 disabled:opacity-50"><FileSpreadsheet size={12} /> Exportar</button></Tooltip>
                    <Tooltip content="Find & Replace"><button onClick={() => setIsFindReplaceOpen(!isFindReplaceOpen)} className={`flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all ${isFindReplaceOpen ? 'bg-[#621f32] text-white' : 'text-gray-500'}`}><Replace size={12} /> Find</button></Tooltip>
                    {(Object.keys(filters).length > 0 || Object.keys(textFilters).length > 0 || globalSearchTerm) && (<Tooltip content="Limpia filtros"><button onClick={() => { setFilters({}); setTextFilters({}); setGlobalSearchTerm(""); }} className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border border-red-100 text-red-500 bg-red-50 hover:bg-red-100"><XCircle size={12} /> Quitar Filtros</button></Tooltip>)}
                    <div className="relative w-48"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" /><input type="text" placeholder="Filtrar..." value={globalSearchTerm} onChange={(e) => setGlobalSearchTerm(e.target.value)} className="w-full pl-8 pr-8 py-1.5 bg-gray-50 border border-gray-100 text-[10px] font-bold outline-none focus:bg-white" /></div>
                    <button onClick={refreshData} className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border border-gray-100 hover:bg-gray-50"><RefreshCw className={loading ? 'animate-spin' : ''} size={12} /> Sync</button>
                    
                    <div className={`px-3 py-1.5 border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 cursor-default select-none transition-all duration-300 ${
                        saveStatus === 'saving' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        saveStatus === 'saved' ? 'bg-green-50 text-green-600 border-green-200' :
                        saveStatus === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                        'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                        {saveStatus === 'saving' ? (
                            <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                        ) : saveStatus === 'saved' ? (
                            <><CheckCircle2 size={12} /> Guardado</>
                        ) : saveStatus === 'error' ? (
                            <><AlertCircle size={12} /> Error al guardar</>
                        ) : (
                            <><Cloud size={12} /> Auto-Save On</>
                        )}
                    </div>
                </div>
            </div>
            <AnimatePresence>{isFindReplaceOpen && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-gray-900 text-white overflow-hidden shrink-0 border-b border-white/10"><div className="px-6 py-2.5 flex items-center justify-between gap-4"><div className="flex items-center gap-8 flex-1"><div className="flex items-center gap-3"><label className="text-[9px] font-black uppercase text-gray-500">Buscar</label><div className="relative"><input type="text" value={findTerm} onChange={(e) => setFindTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navigateMatch('next'); } }} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-[11px] font-bold w-48 outline-none transition-all pr-20" placeholder="Texto..." />{matches.length > 0 && (<span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-[#bc955c] bg-[#bc955c]/10 px-1.5 py-0.5 rounded border border-[#bc955c]/20">{currentMatchIdx + 1}/{matches.length}</span>)}</div></div><div className="flex items-center gap-3"><label className="text-[9px] font-black uppercase text-gray-500">Por</label><input type="text" value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-[11px] font-bold w-48 outline-none" placeholder="Nuevo..." /></div><div className="flex items-center gap-1.5 ml-4"><button onClick={() => navigateMatch('prev')} className="p-1.5 hover:bg-white/10 rounded"><ChevronLeft size={14}/></button><button onClick={() => navigateMatch('next')} className="p-1.5 hover:bg-white/10 rounded"><ChevronRight size={14}/></button><div className="w-px h-4 bg-white/10 mx-2" /><button onClick={handleReplace} disabled={!findTerm || !replaceTerm} className="px-3 py-1.5 bg-[#bc955c] disabled:opacity-30 disabled:grayscale text-white text-[9px] font-black uppercase rounded">Reemplazar</button><button onClick={handleReplaceAll} disabled={!findTerm || !replaceTerm} className="px-3 py-1.5 bg-[#621f32] disabled:opacity-30 disabled:grayscale text-white text-[9px] font-black uppercase rounded">Todo</button></div></div><button onClick={() => { setIsFindReplaceOpen(false); setFindTerm(""); }} className="p-1.5 text-gray-500 hover:text-white"><X size={16}/></button></div></motion.div>)}</AnimatePresence>
            <div className="flex-1 w-full overflow-hidden relative flex flex-col"><div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white" onScroll={handleScroll}><div style={{ height: processedData.length * rowHeight, width: '100%', position: 'relative' }}><table className="w-full border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-[50] transform-gpu">
                    <tr className="bg-[#621f32] text-white">
                        {columns.map((col, i) => (
                            <th key={col.key} onMouseDown={(e) => handleCellMouseDown(e, 0, col.key, 'col')} onMouseEnter={() => handleCellMouseEnter(0, col.key)} style={{ width: columnWidths[col.key] }} className={`relative p-0 border-r border-white/10 last:border-r-0 select-none group/th h-10 cursor-pointer ${i === 0 ? 'sticky left-0 z-[60] bg-[#4a1726] shadow-[2px_0_10px_rgba(0,0,0,0.2)]' : ''}`}>
                                <div className="flex items-center justify-between p-2"><div className="flex-1 flex items-center gap-1 truncate"><span className="text-[9px] font-black uppercase tracking-widest truncate">{col.label}</span>{sortConfig.key === col.key && (sortConfig.direction === 'asc' ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />)}</div><button onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setPopupConfig({ column: col.key, x: r.left, y: r.bottom }); }} className={`p-1 ${filters[col.key] ? 'text-[#bc955c]' : 'text-white/30'}`}><FilterIcon size={12} /></button></div>
                                <div role="separator" aria-label="Cambiar tamaño de columna" tabIndex={-1} onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col.key); }} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#bc955c] active:bg-[#bc955c] z-40" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="z-10 relative">
                    <tr style={{ height: visibleRange.start * rowHeight }}><td colSpan={columns.length} /></tr>
                    {processedData.slice(visibleRange.start, visibleRange.end).map((row, idx) => {
                        const actualIdx = visibleRange.start + idx;
                        const isEditingRow = editingCell?.rowIndex === actualIdx;
                        return (
                            <tr key={row.id || actualIdx} style={{ height: rowHeight }} className={`hover:bg-gray-50 transition-colors duration-75 group ${isEditingRow ? 'z-[100] relative' : 'z-10'}`}>
                                {columns.map((col, i) => {
                                    const isMatch = matches.some(m => m.rowIndex === actualIdx && m.colKey === col.key);
                                    const isCurrentMatch = currentMatchIdx !== -1 && matches[currentMatchIdx].rowIndex === actualIdx && matches[currentMatchIdx].colKey === col.key;
                                    const isFocused = focusedCell?.rowIndex === actualIdx && focusedCell?.colKey === col.key;
                                    const isEditing = isEditingRow && editingCell?.colKey === col.key;
                                    const isSelected = isCellSelected(actualIdx, col.key);
                                    return (
                                        <td key={col.key} onContextMenu={(e) => handleContextMenu(e, actualIdx, col.key)} onMouseDown={(e) => handleCellMouseDown(e, actualIdx, col.key, i === 0 ? 'row' : 'cell')} onMouseEnter={() => handleCellMouseEnter(actualIdx, col.key)} onDoubleClick={() => setEditingCell({ rowIndex: actualIdx, colKey: col.key })} className={`p-2 text-[10px] font-bold truncate border-r border-gray-50 last:border-r-0 relative cursor-cell select-none ${i === 0 ? 'sticky left-0 z-30 bg-gray-50 group-hover:bg-gray-100 font-black text-[#621f32] text-center shadow-[2px_0_5px_rgba(0,0,0,0.05)]' : 'text-gray-600'} ${isSelected ? 'bg-[#621f32]/10 ring-1 ring-inset ring-[#621f32]/20' : ''} ${isFocused ? 'ring-2 ring-inset ring-[#621f32] z-40' : ''} ${isMatch ? 'bg-yellow-100' : ''} ${isCurrentMatch ? 'bg-yellow-400 z-40' : ''} ${isEditing ? 'overflow-visible z-[101]' : 'overflow-hidden'}`}>
                                            {isEditing ? (<AutocompleteInput value={row[col.key]} options={columnOptions[col.key]} onSave={(val) => handleCellSave(actualIdx, col.key, val)} onCancel={() => setEditingCell(null)} initialChar={editingCell.initialChar} />) : (<span title={row[col.key]}>{row[col.key] || "-"}</span>)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    <tr style={{ height: (processedData.length - visibleRange.end) * rowHeight }}><td colSpan={columns.length} /></tr>
                </tbody>
            </table></div></div></div>
            <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[8px] font-black uppercase text-gray-400 shrink-0">
                <div className="flex gap-4"><span>{processedData.length} REGISTROS</span><div className="flex items-center gap-1.5"><div className="size-1 rounded-full bg-green-500" /> LIVE</div></div>
                <div>FLECHAS NAVEGAR • CLIC & DRAG SELECCIONAR • CTRL+C COPIAR RANGO • DOBLE CLIC EDITAR • CLIC DERECHO ACCIONES</div>
            </div>
            <AnimatePresence>
                {popupConfig && ( <FilterPopup column={popupConfig.column} rowData={rowData} filters={filters} setFilters={setFilters} onClose={() => setPopupConfig(null)} position={{ x: popupConfig.x, y: popupConfig.y }} /> )}
                {contextMenu && ( <ContextMenu x={contextMenu.x} y={contextMenu.y} onAction={handleContextAction} onClose={() => setContextMenu(null)} /> )}
            </AnimatePresence>
        </div>
    );
}
