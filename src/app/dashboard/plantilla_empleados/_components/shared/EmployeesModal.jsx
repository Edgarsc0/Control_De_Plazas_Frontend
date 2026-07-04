"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { VacantesService } from "@/services/vacantes.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogPortal,
} from "@/components/ui/dialog";
import { X, Filter, ChevronLeft, ChevronRight, Search, ChevronsUpDown, ArrowDownAZ, ArrowUpAZ, Users, Columns3, Eye, Stamp, LayoutGrid } from "lucide-react";
import { Zoom } from "react-awesome-reveal";

// --- CONSTANTS ---
const ALL_AVAILABLE_COLUMNS = [
  // Básicos
  { key: "id_empleado", label: "NO. EMPLEADO", category: "Básicos" },
  { key: "nombres", label: "NOMBRE", category: "Básicos" },
  { key: "rfc", label: "RFC", category: "Básicos" },
  { key: "curp", label: "CURP", category: "Básicos" },
  { key: "posicion", label: "POSICIÓN", category: "Básicos" },
  { key: "nivel", label: "NIVEL", category: "Básicos" },
  { key: "fecha_de_ingreso", label: "FECHA INGRESO", category: "Básicos" },
  { key: "estado_nomina", label: "ESTATUS NÓMINA", category: "Básicos" },

  // Adscripción / Estructura
  { key: "unidad_administrativa", label: "UNIDAD ADMINISTRATIVA", category: "Estructura" },
  { key: "nombre_puesto_funcional", label: "PUESTO", category: "Estructura" },
  { key: "departamento", label: "DEPARTAMENTO", category: "Estructura" },
  { key: "unidad_de_negocio", label: "UNIDAD DE NEGOCIO", category: "Estructura" },
  { key: "aduana", label: "ADUANA", category: "Estructura" },
  { key: "tipo_de_aduana", label: "TIPO DE ADUANA", category: "Estructura" },
  { key: "entidad_federativa", label: "ESTADO / ENTIDAD", category: "Estructura" },
  { key: "municipio", label: "MUNICIPIO", category: "Estructura" },
  { key: "ubicacion", label: "UBICACIÓN", category: "Estructura" },
  { key: "descripcion_ubicacion", label: "DESCRIPCIÓN UBICACIÓN", category: "Estructura" },

  // Detalle de Plaza / Presupuesto
  { key: "codigo_presupuestal", label: "CÓDIGO PRESUPUESTAL", category: "Plaza" },
  { key: "partida", label: "PARTIDA", category: "Plaza" },
  { key: "tipo_de_contratacion", label: "TIPO CONTRATACIÓN", category: "Plaza" },
  { key: "tipo", label: "TIPO PLAZA", category: "Plaza" },
  { key: "escala", label: "ESCALA", category: "Plaza" },
  { key: "smb", label: "SMB", category: "Plaza" },
  { key: "smn", label: "SMN", category: "Plaza" },
  { key: "val_estat", label: "VAL ESTAT", category: "Plaza" },

  // Estatus y Validación
  { key: "estado_en_nomina", label: "ESTADO EN NÓMINA", category: "Validación" },
  { key: "ua_validacion", label: "UA VALIDACIÓN", category: "Validación" },
  { key: "validando_posicion_por_documento", label: "VALIDANDO POSICIÓN POR DOCTO", category: "Validación" },
  { key: "status_jefe_inm_posicion", label: "STATUS JEFE INMEDIATO", category: "Validación" },

  // Datos Internos y Otros
  { key: "numeral", label: "NUMERAL", category: "Otros" },
  { key: "observaciones", label: "OBSERVACIONES", category: "Otros" },
  { key: "sindicato", label: "SINDICATO", category: "Otros" },
  { key: "personal_militar_o_civil", label: "TIPO PERSONAL (CIVIL/MILITAR)", category: "Otros" },
  { key: "rango", label: "RANGO MILITAR", category: "Otros" },
  { key: "posicion_civil_sedena_semar", label: "POSICIÓN CIVIL/MILITAR", category: "Otros" },
  { key: "tipo_de_personal_sedena_semar", label: "TIPO PERSONAL SEDENA/SEMAR", category: "Otros" },
  { key: "dg_o_aduana_compactada", label: "DG O ADUANA COMPACTADA", category: "Otros" },
  { key: "proyecto_2024_reduccion_plazas_eventuales", label: "PROYECTO REDUCCIÓN 2024", category: "Otros" },
  { key: "fecha_efectiva_personal", label: "FECHA EFECTIVA PERSONAL", category: "Otros" },
  { key: "fecha_de_captura", label: "FECHA DE CAPTURA", category: "Otros" },
  { key: "qna", label: "QUINCENA", category: "Otros" },
  { key: "fecha_prevista_de_salida", label: "FECHA SALIDA PREVISTA", category: "Otros" },
  { key: "nj", label: "NJ", category: "Otros" },
  { key: "dependencia_directa", label: "DEPENDENCIA DIRECTA", category: "Otros" },
  { key: "numempleado", label: "NÚMERO EMPLEADO (ALT)", category: "Otros" },
  { key: "id_field", label: "ID CAMPO", category: "Otros" },
  { key: "cent", label: "CENT", category: "Otros" },
  { key: "dir", label: "DIR", category: "Otros" },
  { key: "subd", label: "SUBD", category: "Otros" },
  { key: "jd", label: "JD", category: "Otros" },
  { key: "depto", label: "DEPTO", category: "Otros" },
  { key: "id_tipo", label: "ID TIPO", category: "Otros" },
  { key: "ua2", label: "UA2", category: "Otros" },
  { key: "latitud", label: "LATITUD", category: "Otros" },
  { key: "longitud", label: "LONGITUD", category: "Otros" },
  { key: "cd_un", label: "CD UN", category: "Otros" },
  { key: "cd_ua", label: "CD UA", category: "Otros" },
  { key: "cd_pto_funcional", label: "CD PTO FUNCIONAL", category: "Otros" },
  { key: "id_departamento", label: "ID DEPARTAMENTO", category: "Otros" },
];

const DEFAULT_COLUMN_KEYS = [
  "id_empleado",
  "nombres",
  "rfc",
  "curp",
  "posicion",
  "nivel",
  "unidad_administrativa",
  "nombre_puesto_funcional",
  "fecha_de_ingreso"
];

const isMonoColumn = (key) => {
    return ["id_empleado", "posicion", "rfc", "curp", "nivel", "fecha_de_ingreso"].includes(key);
};

const COLUMN_LABEL_BY_KEY = ALL_AVAILABLE_COLUMNS.reduce((acc, col) => {
    acc[col.key] = col.label;
    return acc;
}, {});
const HighlightText = ({ text, highlight }) => {
    if (!highlight || !highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) => 
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 dark:text-white px-0.5 rounded font-black">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

// Franja ornamental de "membrete" — firma visual del expediente
const LetterheadBar = () => (
    <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#bc955c] via-[#621f32] to-[#bc955c]" />
);

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

    const valueCounts = useMemo(() => {
        const counts = {};
        rowData.forEach(row => {
            const val = row[column.key];
            if (val !== undefined && val !== null && val !== "") {
                const sVal = String(val);
                counts[sVal] = (counts[sVal] || 0) + 1;
            }
        });
        return counts;
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

    const popLeft = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 340 : position.x);
    const popTop = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 470 : position.y);

    return (
        <div
            role="presentation"
            className="fixed z-[250] flex flex-col gap-3 min-w-[300px] max-w-[340px] max-h-[470px] bg-white/97 dark:bg-slate-950/97 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-[#621f32]/15 dark:border-slate-800 outline-none animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            style={{ left: popLeft, top: popTop }}
            onClick={(e) => e.stopPropagation()}
        >
            <LetterheadBar />
            <div className="px-4 pt-1 pb-0 flex flex-col gap-3">
                <span className="text-[11px] font-black text-[#bc955c] uppercase tracking-widest font-serif italic">Filtrar · {column.label}</span>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#621f32]/50 dark:focus-within:border-[#bc955c]/40 transition-all">
                    <Search className="size-4 text-[#621f32]/50 dark:text-slate-500 shrink-0" />
                    <input
                        type="text"
                        placeholder="Buscar opciones..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    />
                </div>

                <div className="flex items-center justify-between px-1">
                    <button onClick={toggleAll} className="text-xs font-black text-[#621f32] dark:text-[#bc955c] uppercase hover:underline cursor-pointer">
                        {selectedValues.size === allValues.length ? 'Desmarcar todo' : 'Seleccionar todo'}
                    </button>
                    <span className="text-xs font-black text-[#621f32]/70 dark:text-slate-400 bg-[#621f32]/8 dark:bg-slate-900 px-2.5 py-1 rounded-md">
                        {selectedValues.size} / {allValues.length}
                    </span>
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto custom-scrollbar border-y-2 border-dashed border-[#621f32]/10 dark:border-slate-900 p-2 min-h-[160px]"
                style={{ overscrollBehaviorY: "contain" }}
            >
                {filteredOptions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6 font-serif">Sin coincidencias</p>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {filteredOptions.map((val) => (
                            <label key={val} className="flex items-center gap-3 p-2.5 hover:bg-[#621f32]/6 dark:hover:bg-slate-900/40 rounded-lg cursor-pointer transition-colors group">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.has(val)}
                                    onChange={() => toggleValue(val)}
                                    className="size-4 rounded border-gray-300 dark:border-slate-750 text-[#621f32] dark:text-[#bc955c] focus:ring-[#621f32]/20 cursor-pointer"
                                />
                                <span className={`text-[13px] font-semibold uppercase truncate flex-1 ${selectedValues.has(val) ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                    {val}
                                </span>
                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded ml-2">
                                    {valueCounts[val] || 0}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3.5 bg-[#621f32]/5 dark:bg-slate-900/50 flex items-center justify-between">
                <button onClick={clearFilter} className="text-xs font-black text-slate-500 hover:text-red-600 transition-colors cursor-pointer uppercase">
                    Limpiar
                </button>
                <button onClick={onClose} className="px-6 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#4a1726] dark:hover:opacity-90 transition-all shadow-md shadow-[#621f32]/20 cursor-pointer">
                    Aplicar
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTE SELECTOR DE COLUMNAS (MODAL CENTRADO) ---
const ColumnsSelectorModal = ({ isOpen, onClose, visibleKeys, setVisibleKeys }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [tempVisibleKeys, setTempVisibleKeys] = useState(visibleKeys);

    useEffect(() => {
        if (isOpen) {
            setTempVisibleKeys(visibleKeys);
            setSearchQuery("");
        }
    }, [isOpen, visibleKeys]);

    const groupedColumns = useMemo(() => {
        const groups = {};
        ALL_AVAILABLE_COLUMNS.forEach(col => {
            if (searchQuery && !col.label.toLowerCase().includes(searchQuery.toLowerCase()) && !col.key.toLowerCase().includes(searchQuery.toLowerCase())) {
                return;
            }
            if (!groups[col.category]) groups[col.category] = [];
            groups[col.category].push(col);
        });
        return groups;
    }, [searchQuery]);

    const toggleColumn = (key) => {
        setTempVisibleKeys(prev => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev;
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handleSelectDefault = () => setTempVisibleKeys(DEFAULT_COLUMN_KEYS);
    const handleClearAll = () => setTempVisibleKeys(["id_empleado"]);
    const handleSelectAll = () => setTempVisibleKeys(ALL_AVAILABLE_COLUMNS.map(col => col.key));
    const handleConfirm = () => {
        setVisibleKeys(tempVisibleKeys);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideClose
                className="w-full max-w-xl max-h-[80vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
            >
                <div className="w-full max-h-[80vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col rounded-[28px] shadow-2xl border border-[#621f32]/10 dark:border-slate-800/80 overflow-hidden">
                    <LetterheadBar />
                    <div className="flex flex-col flex-1 min-h-0 p-7">
                        <DialogHeader className="mb-5 shrink-0 flex flex-row justify-between items-center border-b-2 border-dashed border-[#621f32]/15 dark:border-slate-800/60 pb-5">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-full shadow-md text-white border-2 border-double border-[#bc955c]/60">
                                    <Columns3 className="size-6 text-[#bc955c]" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-black text-[#621f32] dark:text-[#bc955c] tracking-tight font-serif">
                                        Configurar columnas
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                                        Campos visibles en el registro
                                    </DialogDescription>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full bg-white dark:bg-slate-900 border border-[#621f32]/15 dark:border-slate-800 text-slate-450 dark:text-slate-550 hover:text-red-500 transition-all cursor-pointer"
                            >
                                <X className="size-5" />
                            </button>
                        </DialogHeader>

                        <div className="mb-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#bc955c]/60 transition-all">
                                <Search className="size-4 text-[#621f32]/50 dark:text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar columna..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <button onClick={handleSelectDefault} className="text-xs font-black text-[#bc955c] uppercase hover:underline cursor-pointer">
                                    Por defecto
                                </button>
                                <div className="flex gap-3.5 items-center">
                                    <button onClick={handleSelectAll} className="text-xs font-black text-slate-500 hover:text-[#621f32] dark:hover:text-white uppercase cursor-pointer">
                                        Todas
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-750">|</span>
                                    <button onClick={handleClearAll} className="text-xs font-black text-slate-550 hover:text-red-500 uppercase cursor-pointer">
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5 border-y-2 border-dashed border-[#621f32]/10 dark:border-slate-900 py-4">
                            {Object.keys(groupedColumns).length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-12 font-serif">Sin resultados</p>
                            ) : (
                                Object.entries(groupedColumns).map(([category, cols]) => (
                                    <div key={category} className="flex flex-col gap-2.5">
                                        <span className="text-xs font-black text-[#bc955c] uppercase tracking-widest font-serif italic border-b border-[#621f32]/10 dark:border-slate-900/50 pb-1.5 mb-1">
                                            {category}
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {cols.map(col => {
                                                const isChecked = tempVisibleKeys.includes(col.key);
                                                return (
                                                    <label key={col.key} className="flex items-center gap-3 py-2 hover:bg-[#621f32]/6 dark:hover:bg-slate-900/40 rounded-lg px-2.5 cursor-pointer transition-colors group">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleColumn(col.key)}
                                                            className="size-4 rounded border-gray-300 dark:border-slate-750 text-[#621f32] dark:text-[#bc955c] focus:ring-[#621f32]/20 cursor-pointer"
                                                        />
                                                        <span className={`text-sm font-semibold uppercase truncate ${isChecked ? 'text-slate-800 dark:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                                            {col.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-5 flex justify-between items-center shrink-0 mt-2">
                            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                                {tempVisibleKeys.length} / {ALL_AVAILABLE_COLUMNS.length} Columnas
                            </span>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#621f32]/10 transition-all cursor-pointer">
                                    Cancelar
                                </button>
                                <button onClick={handleConfirm} className="px-7 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 rounded-full text-xs font-black uppercase tracking-wider hover:bg-[#4a1726] dark:hover:opacity-90 transition-all shadow-md shadow-[#621f32]/10 cursor-pointer">
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- COMPONENTE DE FICHERO DETALLADO (EXPEDIENTE) ---
export const EmployeeRecordModal = ({ isOpen, onClose, record, columns }) => {
    const [fieldSearch, setFieldSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            setFieldSearch("");
        }
    }, [isOpen]);

    if (!record) return null;

    const filteredGroupedFields = useMemo(() => {
        const groups = {};
        const fieldsSource = columns || ALL_AVAILABLE_COLUMNS;
        const query = fieldSearch.trim().toLowerCase();

        fieldsSource.forEach(field => {
            const category = field.category || 'General';
            const label = (field.label || '').toLowerCase();
            const valStr = String(record[field.key] ?? '').toLowerCase();
            const catLower = category.toLowerCase();

            if (query && !label.includes(query) && !valStr.includes(query) && !catLower.includes(query)) {
                return;
            }

            if (!groups[category]) groups[category] = [];
            groups[category].push({
                label: field.label,
                key: field.key,
                value: record[field.key]
            });
        });
        return groups;
    }, [record, columns, fieldSearch]);

    const hasVisibleFields = useMemo(() => {
        return Object.values(filteredGroupedFields).some(group => group.length > 0);
    }, [filteredGroupedFields]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideClose
                className="w-full max-w-4xl max-h-[85vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-bottom-[2%] data-[state=closed]:animate-out data-[state=closed]:zoom-out-[0.98] data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[2%] duration-500 ease-out"
            >
                <div className="w-full max-h-[85vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col rounded-[28px] shadow-2xl border border-[#621f32]/10 dark:border-slate-800/80 overflow-hidden">
                    <LetterheadBar />
                    <div className="flex flex-col flex-1 min-h-0 p-7">
                        <DialogHeader className="mb-4 shrink-0 flex flex-row justify-between items-center border-b-2 border-dashed border-[#621f32]/15 dark:border-slate-800/60 pb-5">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0 size-16 rounded-full border-[3px] border-double border-[#bc955c] flex flex-col items-center justify-center bg-[#621f32]/5 dark:bg-slate-900 rotate-[-4deg] shadow-inner select-none">
                                    <Stamp className="size-6 text-[#621f32] dark:text-[#bc955c]" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-2xl font-black text-[#621f32] dark:text-[#bc955c] tracking-tight font-serif">
                                        Expediente de plaza
                                    </DialogTitle>
                                    <DialogDescription className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase tracking-wide">
                                        {record.nombres || "SIN NOMBRE ASIGNADO"}
                                    </DialogDescription>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full bg-white dark:bg-slate-900 border border-[#621f32]/15 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <X className="size-5" />
                            </button>
                        </DialogHeader>

                        {/* Buscador de Campos */}
                        <div className="mb-5 shrink-0 flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3.5 rounded-2xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#bc955c]/60 focus-within:ring-2 focus-within:ring-[#bc955c]/10 transition-all shadow-sm">
                            <Search className="size-5 text-[#bc955c] shrink-0" />
                            <input
                                type="text"
                                placeholder="Buscar campos en el expediente (ej. RFC, aduana, nivel, sueldo, etc.)..."
                                value={fieldSearch}
                                onChange={(e) => setFieldSearch(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                            />
                            {fieldSearch && (
                                <button
                                    onClick={() => setFieldSearch("")}
                                    className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                                >
                                    <X className="size-4.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-7 custom-scrollbar">
                            {/* Tarjetas principales */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-[#621f32]/[0.03] dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                                {[
                                    { label: "No. Empleado", value: record.id_empleado, isMono: true },
                                    { label: "Posición", value: record.posicion, isMono: true },
                                    { label: "RFC", value: record.rfc, isMono: true },
                                    { label: "Nivel Salarial", value: record.nivel, isMono: true }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5 p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.label}</span>
                                        <span className={`text-base font-bold truncate ${item.isMono ? 'font-mono text-slate-700 dark:text-[#bc955c]' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {item.value !== undefined && item.value !== null && String(item.value).trim() !== "" ? String(item.value) : "—"}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Detalle Categorizado */}
                            <div className="flex flex-col gap-7 mb-2">
                                {!hasVisibleFields ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="size-16 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                                            <Search className="size-7 text-[#621f32]/40 dark:text-slate-500 animate-pulse" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest font-serif">No se encontraron campos coincidentes</p>
                                        <p className="text-xs text-slate-400 mt-1">Prueba con otra palabra clave o limpia el buscador</p>
                                    </div>
                                ) : (
                                    Object.entries(filteredGroupedFields).map(([category, fields]) => {
                                        if (fields.length === 0) return null;
                                        return (
                                            <div key={category} className="flex flex-col gap-3.5">
                                                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2">
                                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                        {category}
                                                    </span>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                                        {fields.length} {fields.length === 1 ? 'campo' : 'campos'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                                    {fields.map((field, idx) => (
                                                        <div key={idx} className="flex flex-col gap-1.5 p-4 bg-white dark:bg-slate-900/10 rounded-xl border border-slate-100 dark:border-slate-900 hover:border-slate-200 dark:hover:border-slate-800 transition-all">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-wider truncate" title={field.label}>
                                                                <HighlightText text={field.label} highlight={fieldSearch} />
                                                            </span>
                                                            <span className={`text-sm font-semibold break-all ${isMonoColumn(field.key) ? 'font-mono text-slate-700 dark:text-slate-355 font-bold' : 'text-slate-850 dark:text-slate-200'}`}>
                                                                {field.value !== undefined && field.value !== null && String(field.value).trim() !== "" ? (
                                                                    <HighlightText text={String(field.value)} highlight={fieldSearch} />
                                                                ) : (
                                                                    <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};


// --- COMPONENTE PRINCIPAL ---
export default function EmployeesModal({ open, onOpenChange, nivel, estatus, ua }) {
    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [textFilters, setTextFilters] = useState({});
    const [popupConfig, setPopupConfig] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isClosing, setIsClosing] = useState(false);

    const [visibleKeys, setVisibleKeys] = useState(DEFAULT_COLUMN_KEYS);
    const [showColumnsModal, setShowColumnsModal] = useState(false);
    const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState(null);

    const activeColumns = useMemo(() => {
        return ALL_AVAILABLE_COLUMNS.filter(col => visibleKeys.includes(col.key));
    }, [visibleKeys]);

    const [columnWidths, setColumnWidths] = useState(() => {
        const widths = {};
        ALL_AVAILABLE_COLUMNS.forEach(col => { widths[col.key] = 175; });
        widths["id_empleado"] = 130;
        widths["nombres"] = 280;
        widths["rfc"] = 145;
        widths["curp"] = 185;
        widths["posicion"] = 120;
        widths["nivel"] = 100;
        widths["unidad_administrativa"] = 280;
        widths["nombre_puesto_funcional"] = 280;
        widths["fecha_de_ingreso"] = 145;
        return widths;
    });

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
                setShowColumnsModal(false);
                setSelectedEmployeeRecord(null);
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

    const handleCloseAllPopups = () => {
        setPopupConfig(null);
        setShowColumnsModal(false);
    };

    // Chips de filtros activos (columna + texto libre) para retirarlos con un clic
    const activeFilterChips = useMemo(() => {
        const chips = [];
        Object.keys(filters).forEach((key) => {
            chips.push({ id: `col-${key}`, label: COLUMN_LABEL_BY_KEY[key] || key, remove: () => setFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        Object.entries(textFilters).forEach(([key, term]) => {
            if (!term) return;
            chips.push({ id: `text-${key}`, label: `${COLUMN_LABEL_BY_KEY[key] || key}: "${term}"`, remove: () => setTextFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        return chips;
    }, [filters, textFilters]);

    const hasActiveFilters = activeFilterChips.length > 0;
    const clearAllFilters = () => { setFilters({}); setTextFilters({}); setSortConfig({ key: null, direction: 'asc' }); };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideClose
                className="w-fit max-w-[96vw] lg:max-w-[95vw] max-h-[94vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
                onClick={handleCloseAllPopups}
                onPointerDownOutside={(e) => {
                    const target = e.target;
                    if (target && (target.closest('[role="presentation"]') || target.closest('.z-\\[250\\]') || target.closest('.fixed.z-\\[250\\]'))) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target;
                    if (target && (target.closest('[role="presentation"]') || target.closest('.z-\\[250\\]') || target.closest('.fixed.z-\\[250\\]'))) {
                        e.preventDefault();
                    }
                }}
            >
                <Zoom
                    triggerOnce
                    duration={500}
                    className={`w-full max-h-[94vh] min-h-0 flex flex-col ${isClosing ? 'animate-out fade-out-0 zoom-out-90 duration-300' : ''}`}
                >
                    <div className="w-full max-h-[94vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col rounded-[28px] shadow-2xl ring-1 ring-black/5 border border-[#621f32]/10 dark:border-slate-800/80 overflow-hidden">
                        <LetterheadBar />

                        {/* Encabezado tipo membrete */}
                        <div className="shrink-0 flex flex-row justify-between items-center border-b-2 border-dashed border-[#621f32]/15 dark:border-slate-800/60 px-7 py-5">
                            <div className="flex items-center gap-3">
                                <LayoutGrid className="size-5 text-[#bc955c]" />
                                <div>
                                    <DialogTitle className="text-[26px] font-black text-[#621f32] dark:text-[#bc955c] tracking-tight font-serif leading-none">
                                        Listado de Empleados
                                    </DialogTitle>
                                    <DialogDescription className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-widest">
                                        Exploración y filtrado de capital humano
                                    </DialogDescription>
                                </div>
                            </div>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="p-3 rounded-full bg-white dark:bg-slate-900 border border-[#621f32]/15 dark:border-slate-800 text-slate-450 dark:text-slate-550 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Cuerpo: sidebar tipo "carpeta" + tabla estilo libro de registro */}
                        <div className={`flex flex-col lg:flex-row flex-1 min-h-0 w-full relative overflow-hidden transition-all duration-300 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>

                            {/* ---- SIDEBAR ---- */}
                            <div className="lg:w-72 w-full shrink-0 flex flex-col gap-5 bg-[#621f32]/[0.035] dark:bg-slate-900/30 border-b-2 lg:border-b-0 lg:border-r-2 border-dashed border-[#621f32]/15 dark:border-slate-800 p-6 overflow-y-auto custom-scrollbar">

                                {/* Sello circular con el nivel */}
                                <div className="flex flex-col items-center gap-3 py-2">
                                    <div className="relative size-24 rounded-full border-[3px] border-double border-[#bc955c] flex flex-col items-center justify-center bg-[#621f32]/5 dark:bg-slate-900 rotate-[-4deg] shadow-inner select-none">
                                        <span className="text-[9px] font-black text-[#621f32]/70 dark:text-slate-400 uppercase tracking-widest">Nivel</span>
                                        <span className="text-2xl font-black text-[#621f32] dark:text-[#bc955c] font-serif -mt-0.5">{nivel ?? "—"}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estatus</span>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center">{estatus ?? "—"}</span>
                                    </div>
                                    {ua && (
                                        <div className="flex flex-col items-center gap-1 max-w-full">
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unidad administrativa</span>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 text-center truncate max-w-full" title={ua}>{ua}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t-2 border-dashed border-[#621f32]/15 dark:border-slate-800" />

                                {/* KPI total */}
                                <div className="flex flex-col gap-1 bg-white dark:bg-slate-950 rounded-2xl border border-[#621f32]/10 dark:border-slate-800 p-4 shadow-sm">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total registros</span>
                                    <span className="text-3xl font-black text-[#621f32] dark:text-[#bc955c] font-serif">{loading ? "···" : processedData.length.toLocaleString()}</span>
                                </div>

                                {/* Mostrar (page size) */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Registros por página</span>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[20, 50, 100, 500].map((size) => (
                                            <button key={size} onClick={() => setPageSize(size)} className={`py-2 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${pageSize === size ? 'bg-[#621f32] text-white shadow-md dark:bg-[#bc955c] dark:text-slate-950' : 'bg-white dark:bg-slate-900 text-slate-500 border border-[#621f32]/10 dark:border-slate-800 hover:border-[#bc955c]/50 hover:text-[#621f32] dark:hover:text-[#bc955c]'}`}>
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Columnas */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowColumnsModal(true); }}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-[#621f32]/15 dark:border-slate-855 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:border-[#bc955c]/50 hover:bg-[#621f32]/[0.03] transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer"
                                    title="Agregar/Ocultar columnas de la tabla"
                                >
                                    <Columns3 className="size-4.5 text-[#bc955c]" />
                                    <span>Configurar columnas</span>
                                </button>

                                {hasActiveFilters && (
                                    <button onClick={clearAllFilters} className="w-full text-xs font-black text-red-650 hover:text-red-700 dark:text-red-400 dark:hover:text-red-350 uppercase tracking-widest px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 transition-colors cursor-pointer">
                                        Limpiar todos los filtros
                                    </button>
                                )}

                                {/* Empuja la paginación al fondo */}
                                <div className="flex-1 hidden lg:block" />

                                <div className="border-t-2 border-dashed border-[#621f32]/15 dark:border-slate-800 pt-4 flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Paginación</span>
                                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-[#621f32]/10 dark:border-slate-800 shadow-sm">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                            <ChevronLeft className="size-5" />
                                        </button>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c]">{currentPage}</span>
                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase">de</span>
                                            <span className="text-sm font-black text-slate-500 dark:text-slate-400">{totalPages}</span>
                                        </div>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                            <ChevronRight className="size-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ---- CONTENIDO PRINCIPAL ---- */}
                            <div className="flex-1 min-h-0 flex flex-col p-6 gap-4 overflow-hidden">

                                {/* Barra de chips de filtros activos */}
                                {hasActiveFilters && (
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Filtros activos:</span>
                                        {activeFilterChips.map(chip => (
                                            <span key={chip.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-[#621f32]/8 dark:bg-[#bc955c]/10 border border-[#621f32]/15 dark:border-[#bc955c]/20 text-[#621f32] dark:text-[#bc955c] rounded-full text-[11px] font-bold">
                                                {chip.label}
                                                <button onClick={chip.remove} className="p-0.5 rounded-full hover:bg-[#621f32]/15 dark:hover:bg-[#bc955c]/20 cursor-pointer">
                                                    <X className="size-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {loading ? (
                                    <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar border-2 border-[#621f32]/10 dark:border-slate-855 rounded-2xl">
                                        <table className="w-max min-w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
                                            <thead className="sticky top-0 z-20 shadow-md">
                                                <tr className="bg-gradient-to-r from-[#621f32] to-[#712339] text-white">
                                                    <th style={{ width: 56, minWidth: 56, maxWidth: 56 }} className="py-3.5 px-2 text-center align-middle" />
                                                    {activeColumns.map((col, idx) => (
                                                        <th key={idx} style={{ width: columnWidths[col.key] || 175, minWidth: columnWidths[col.key] || 175, maxWidth: columnWidths[col.key] || 175 }} className="py-3.5 px-4 align-middle">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-serif">{col.label}</span>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-dashed divide-[#621f32]/10 dark:divide-slate-900 bg-white dark:bg-slate-950">
                                                {[...Array(10)].map((_, rIdx) => (
                                                    <tr key={rIdx} className="h-12">
                                                        <td className="px-2 align-middle">
                                                            <div className="size-4 bg-slate-200/60 dark:bg-slate-800/60 rounded-full animate-pulse mx-auto" />
                                                        </td>
                                                        {activeColumns.map((col, cIdx) => (
                                                            <td key={cIdx} className="px-4 py-2.5 align-middle">
                                                                <div className="h-3.5 bg-slate-200/60 dark:bg-slate-800/60 rounded animate-pulse" style={{ width: `${Math.floor(Math.random() * (90 - 55 + 1) + 55)}%` }} />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : error ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-red-50/40 dark:bg-red-950/10 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900/30">
                                        <div className="size-20 bg-red-100/40 rounded-full flex items-center justify-center mb-6 text-red-650 shadow-xl shadow-red-100/10 border-2 border-double border-red-300">
                                            <X className="size-10" />
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-800 dark:text-slate-200 mb-2 font-serif">Error de carga</h3>
                                        <p className="text-base text-gray-500 dark:text-slate-400 max-w-md font-medium">{error}</p>
                                        <button onClick={fetchData} className="mt-8 px-10 py-3.5 bg-[#621f32] text-white rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-xl shadow-[#621f32]/30 active:scale-95 cursor-pointer">
                                            Reintentar ahora
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar border-2 border-[#621f32]/10 dark:border-slate-855 rounded-2xl" onScroll={() => setPopupConfig(null)}>
                                        <table className="w-max min-w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
                                            <thead className="sticky top-0 z-20 shadow-md">
                                                <tr className="bg-gradient-to-r from-[#621f32] to-[#712339] text-white border-b-2 border-[#bc955c]/50">
                                                    <th style={{ width: 56, minWidth: 56, maxWidth: 56 }} className="py-3 px-2 text-center align-middle border-r border-white/10">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-serif">Ver</span>
                                                    </th>
                                                    {activeColumns.map(col => {
                                                        const isFiltered = !!filters[col.key];
                                                        const isSorted = sortConfig.key === col.key;
                                                        return (
                                                            <th key={col.key} style={{ width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key] }} className={`relative py-2.5 px-4 border-r border-white/10 select-none group/th align-top ${isFiltered ? 'bg-[#501929]/95' : ''}`}>
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div role="button" tabIndex={0} className="flex-1 flex items-center gap-1.5 cursor-pointer overflow-hidden hover:opacity-85 transition-opacity" onClick={() => handleSort(col.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(col.key); }}>
                                                                            <span className={`text-xs font-bold uppercase tracking-wider truncate font-serif ${isSorted ? 'text-[#bc955c]' : 'text-slate-100'}`}>
                                                                                {col.label}
                                                                            </span>
                                                                            {isSorted ? (
                                                                                sortConfig.direction === 'asc' ? <ArrowUpAZ className="size-4 shrink-0 text-[#bc955c]" /> : <ArrowDownAZ className="size-4 shrink-0 text-[#bc955c]" />
                                                                            ) : (
                                                                                <ChevronsUpDown className="size-3.5 shrink-0 text-white/30 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </div>
                                                                        <button onClick={(e) => openFilter(e, col)} className={`p-1.5 rounded-full transition-all duration-200 shrink-0 cursor-pointer ${isFiltered ? 'text-[#bc955c] bg-white/10' : 'text-white/60 hover:bg-white/10'}`}>
                                                                            <Filter className="size-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="relative flex items-center">
                                                                        <Search className="absolute left-0.5 top-1/2 -translate-y-1/2 size-3 text-white/35" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Buscar..."
                                                                            value={textFilters[col.key] || ""}
                                                                            onChange={(e) => setTextFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                                                            className="w-full pl-5 pr-1 py-1 bg-transparent border-b border-white/20 focus:border-[#bc955c] text-[11px] font-semibold text-white placeholder-white/30 transition-all outline-none"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div role="separator" aria-label="Cambiar tamaño de columna" tabIndex={-1} onMouseDown={(e) => handleResizeStart(e, col.key)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#bc955c] active:bg-[#bc955c] transition-colors z-30" />
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-dashed divide-[#621f32]/10 dark:divide-slate-900 bg-white dark:bg-slate-950">
                                                {paginatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={activeColumns.length + 1} className="py-32 text-center bg-[#621f32]/[0.02] dark:bg-slate-900/10">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="size-20 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                                                                    <Search className="size-8 text-[#621f32]/40 dark:text-slate-655" />
                                                                </div>
                                                                <p className="text-base font-bold text-slate-500 uppercase tracking-widest font-serif">No se encontraron registros</p>
                                                                {hasActiveFilters && (
                                                                    <button onClick={clearAllFilters} className="mt-6 px-6 py-3 bg-[#621f32] text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-lg shadow-[#621f32]/20 cursor-pointer">
                                                                        Restablecer filtros
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedData.map((row, index) => (
                                                        <tr key={row.id !== undefined && row.id !== null ? String(row.id) : `row-${index}`} className="hover:bg-[#bc955c]/[0.10] dark:hover:bg-slate-900/40 even:bg-[#621f32]/[0.02] dark:even:bg-slate-900/10 h-12 transition-colors">
                                                            <td className="px-2 text-center align-middle border-r border-[#621f32]/8 dark:border-slate-900">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedEmployeeRecord(row); }}
                                                                    className="p-1.5 rounded-full text-slate-400 dark:text-slate-555 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-[#621f32]/10 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                                                                    title="Ver expediente detallado de la plaza"
                                                                >
                                                                    <Eye className="size-4.5" />
                                                                </button>
                                                            </td>
                                                            {activeColumns.map(col => (
                                                                <td key={col.key} className={`px-4 text-sm truncate align-middle ${isMonoColumn(col.key) ? 'font-mono text-[13px] font-semibold text-slate-600 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-300'}`} title={row[col.key]}>
                                                                    {row[col.key] !== undefined && row[col.key] !== null && String(row[col.key]).trim() !== "" ? (
                                                                        String(row[col.key])
                                                                    ) : (
                                                                        <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Zoom>

                {popupConfig && (
                    <DialogPortal>
                        <FilterPopup column={popupConfig.column} rowData={rowData} filters={filters} setFilters={setFilters} onClose={() => setPopupConfig(null)} position={{ x: popupConfig.x, y: popupConfig.y }} />
                    </DialogPortal>
                )}
            </DialogContent>
        </Dialog>

        <ColumnsSelectorModal
            isOpen={showColumnsModal}
            onClose={() => setShowColumnsModal(false)}
            visibleKeys={visibleKeys}
            setVisibleKeys={setVisibleKeys}
        />

        <EmployeeRecordModal isOpen={!!selectedEmployeeRecord} onClose={() => setSelectedEmployeeRecord(null)} record={selectedEmployeeRecord} />
        </>
    );
}
