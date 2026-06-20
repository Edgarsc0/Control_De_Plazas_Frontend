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
import { Loader2, X, Filter, ChevronLeft, ChevronRight, Search, ChevronsUpDown, ArrowDownAZ, ArrowUpAZ, Users, Columns3, Eye } from "lucide-react";
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

    const popLeft = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 320 : position.x);
    const popTop = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 450 : position.y);

    return (
        <div
            role="presentation"
            className="fixed z-[250] flex flex-col gap-3 min-w-[280px] max-w-[320px] max-h-[450px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 outline-none animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            style={{ left: popLeft, top: popTop }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 pb-0 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 focus-within:border-[#621f32]/30 dark:focus-within:border-[#bc955c]/30 transition-all">
                    <Search className="size-4 text-slate-400 dark:text-slate-550" />
                    <input
                        type="text"
                        placeholder="Buscar opciones..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    />
                </div>

                <div className="flex items-center justify-between px-1">
                    <button onClick={toggleAll} className="text-[10px] font-black text-[#621f32] dark:text-[#bc955c] uppercase hover:underline cursor-pointer">
                        {selectedValues.size === allValues.length ? 'Desmarcar todo' : 'Seleccionar todo'}
                    </button>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                        {selectedValues.size} / {allValues.length}
                    </span>
                </div>
            </div>

            <div 
                className="flex-1 overflow-y-auto custom-scrollbar border-y border-slate-100 dark:border-slate-900 p-2 min-h-[150px]"
                style={{ overscrollBehaviorY: "contain" }}
            >
                {filteredOptions.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-6">Sin coincidencias</p>
                ) : (
                    <div className="flex flex-col gap-0.5">
                        {filteredOptions.map((val) => (
                            <label key={val} className="flex items-center gap-3 p-2 hover:bg-[#621f32]/5 dark:hover:bg-slate-900/40 rounded-lg cursor-pointer transition-colors group">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.has(val)}
                                    onChange={() => toggleValue(val)}
                                    className="size-4 rounded border-gray-300 dark:border-slate-750 text-[#621f32] dark:text-[#bc955c] focus:ring-[#621f32]/20 cursor-pointer"
                                />
                                <span className={`text-[11px] font-semibold uppercase truncate flex-1 ${selectedValues.has(val) ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-slate-650'}`}>
                                    {val}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded ml-2">
                                    {valueCounts[val] || 0}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                <button onClick={clearFilter} className="text-[10px] font-black text-slate-500 hover:text-red-650 transition-colors cursor-pointer uppercase">
                    Limpiar
                </button>
                <button onClick={onClose} className="px-5 py-2 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[#4a1726] dark:hover:opacity-90 transition-all shadow-md shadow-[#621f32]/20 cursor-pointer">
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

    // Sync temp keys when modal opens
    useEffect(() => {
        if (isOpen) {
            setTempVisibleKeys(visibleKeys);
            setSearchQuery("");
        }
    }, [isOpen, visibleKeys]);

    // Group columns by category and apply search query
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
                if (prev.length <= 1) return prev; // Mantener al menos una columna
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handleSelectDefault = () => {
        setTempVisibleKeys(DEFAULT_COLUMN_KEYS);
    };

    const handleClearAll = () => {
        setTempVisibleKeys(["id_empleado"]);
    };

    const handleSelectAll = () => {
        setTempVisibleKeys(ALL_AVAILABLE_COLUMNS.map(col => col.key));
    };

    const handleConfirm = () => {
        setVisibleKeys(tempVisibleKeys);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideClose
                className="w-full max-w-lg max-h-[80vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
            >
                <div className="w-full max-h-[80vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden">
                    {/* Header */}
                    <DialogHeader className="mb-4 shrink-0 flex flex-row justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] dark:from-[#3e131f] dark:to-[#621f32] rounded-xl shadow-md text-white border border-[#bc955c]/25">
                                <Columns3 className="size-5 text-[#bc955c]" />
                            </div>
                            <div className="text-left">
                                <DialogTitle className="text-lg font-extrabold text-[#621f32] dark:text-[#bc955c] tracking-tight">
                                    Configurar Columnas
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                                    Selecciona qué campos visualizar en la tabla
                                </DialogDescription>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-450 dark:text-slate-550 hover:text-red-500 transition-all cursor-pointer"
                        >
                            <X className="size-4" />
                        </button>
                    </DialogHeader>

                    {/* Search and Action Buttons */}
                    <div className="mb-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-55 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 focus-within:border-[#bc955c]/50 transition-all">
                            <Search className="size-4 text-slate-450 dark:text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar columna..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-650">
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <button onClick={handleSelectDefault} className="text-[10px] font-black text-[#bc955c] uppercase hover:underline cursor-pointer">
                                Por defecto
                            </button>
                            <div className="flex gap-3">
                                <button onClick={handleSelectAll} className="text-[10px] font-black text-slate-500 hover:text-[#621f32] dark:hover:text-white uppercase cursor-pointer">
                                    Todas
                                </button>
                                <span className="text-slate-300 dark:text-slate-750">|</span>
                                <button onClick={handleClearAll} className="text-[10px] font-black text-slate-550 hover:text-red-500 uppercase cursor-pointer">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 border-y border-slate-100 dark:border-slate-900 py-3">
                        {Object.keys(groupedColumns).length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic text-center py-12">Sin resultados</p>
                        ) : (
                            Object.entries(groupedColumns).map(([category, cols]) => (
                                <div key={category} className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-[#bc955c] dark:text-[#bc955c]/85 uppercase tracking-widest border-b border-slate-100 dark:border-slate-900/50 pb-1 mb-1">
                                        {category}
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {cols.map(col => {
                                            const isChecked = tempVisibleKeys.includes(col.key);
                                            return (
                                                <label key={col.key} className="flex items-center gap-3 py-1.5 hover:bg-[#621f32]/5 dark:hover:bg-slate-900/40 rounded-lg px-2 cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleColumn(col.key)}
                                                        className="size-4 rounded border-gray-300 dark:border-slate-750 text-[#621f32] dark:text-[#bc955c] focus:ring-[#621f32]/20 cursor-pointer"
                                                    />
                                                    <span className={`text-xs font-semibold uppercase truncate ${isChecked ? 'text-slate-800 dark:text-white' : 'text-slate-400 group-hover:text-slate-650'}`}>
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

                    {/* Footer */}
                    <div className="pt-4 bg-transparent flex justify-between items-center shrink-0 mt-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                            {tempVisibleKeys.length} / {ALL_AVAILABLE_COLUMNS.length} Columnas
                        </span>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-5 py-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer">
                                Cancelar
                            </button>
                            <button onClick={handleConfirm} className="px-6 py-2 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-[#4a1726] dark:hover:opacity-90 transition-all shadow-md shadow-[#621f32]/10 cursor-pointer">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- COMPONENTE DE FICHERO DETALLADO (EXPEDIENTE) ---
export const EmployeeRecordModal = ({ isOpen, onClose, record, columns }) => {
    if (!record) return null;

    const groupedFields = useMemo(() => {
        const groups = {};
        const fieldsSource = columns || ALL_AVAILABLE_COLUMNS;
        
        fieldsSource.forEach(field => {
            const category = field.category || 'General';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push({
                label: field.label,
                key: field.key,
                value: record[field.key]
            });
        });
        return groups;
    }, [record, columns]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideClose
                className="w-full max-w-4xl max-h-[85vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-bottom-[2%] data-[state=closed]:animate-out data-[state=closed]:zoom-out-[0.98] data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[2%] duration-500 ease-out"
            >
                <div className="w-full max-h-[85vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden">
                    <DialogHeader className="mb-6 shrink-0 flex flex-row justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] dark:from-[#3e131f] dark:to-[#621f32] rounded-xl shadow-xl shadow-[#621f32]/10 text-white border border-[#bc955c]/25">
                                <Users className="size-6 text-[#bc955c]" />
                            </div>
                            <div className="text-left">
                                <DialogTitle className="text-xl font-extrabold text-[#621f32] dark:text-[#bc955c] tracking-tight">
                                    Expediente Completo de Plaza
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase tracking-wide">
                                    {record.nombres || "SIN NOMBRE ASIGNADO"}
                                </DialogDescription>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <X className="size-5" />
                        </button>
                    </DialogHeader>

                    {/* Fichero - Area de Contenido */}
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 custom-scrollbar">
                        
                        {/* Tarjeta de Resumen */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 dark:border-slate-850">
                            {[
                                { label: "No. Empleado", value: record.id_empleado, isMono: true },
                                { label: "Posición", value: record.posicion, isMono: true },
                                { label: "RFC", value: record.rfc, isMono: true },
                                { label: "Nivel Salarial", value: record.nivel, isMono: true }
                            ].map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-1 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800/80 shadow-sm">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.label}</span>
                                    <span className={`text-xs font-bold truncate ${item.isMono ? 'font-mono text-slate-700 dark:text-[#bc955c]' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {item.value !== undefined && item.value !== null && String(item.value).trim() !== "" ? String(item.value) : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Listado Completo categorizado */}
                        <div className="flex flex-col gap-6 mb-2">
                            {Object.entries(groupedFields).map(([category, fields]) => (
                                <div key={category} className="flex flex-col gap-3">
                                    <span className="text-[10px] font-black text-[#bc955c] dark:text-[#bc955c]/95 uppercase tracking-widest border-b border-slate-100 dark:border-slate-900 pb-2">
                                        {category}
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {fields.map((field, idx) => (
                                            <div key={idx} className="flex flex-col gap-1 p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100/40 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate" title={field.label}>
                                                    {field.label}
                                                </span>
                                                <span className={`text-[11px] font-semibold break-all ${isMonoColumn(field.key) ? 'font-mono text-slate-700 dark:text-slate-355 font-bold' : 'text-slate-850 dark:text-slate-200'}`}>
                                                    {field.value !== undefined && field.value !== null && String(field.value).trim() !== "" ? (
                                                        String(field.value)
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
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

    // Estados de la Tabla
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [textFilters, setTextFilters] = useState({});
    const [popupConfig, setPopupConfig] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isClosing, setIsClosing] = useState(false);

    // Configuración de columnas visibles
    const [visibleKeys, setVisibleKeys] = useState(DEFAULT_COLUMN_KEYS);
    const [showColumnsModal, setShowColumnsModal] = useState(false);
    const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState(null);

    const activeColumns = useMemo(() => {
        return ALL_AVAILABLE_COLUMNS.filter(col => visibleKeys.includes(col.key));
    }, [visibleKeys]);

    const [columnWidths, setColumnWidths] = useState(() => {
        const widths = {};
        ALL_AVAILABLE_COLUMNS.forEach(col => {
            const defCol = DEFAULT_COLUMN_KEYS.includes(col.key);
            widths[col.key] = defCol ? 160 : 160;
        });
        // Ajustes finos de anchos por defecto
        widths["id_empleado"] = 120;
        widths["nombres"] = 260;
        widths["rfc"] = 130;
        widths["curp"] = 170;
        widths["posicion"] = 110;
        widths["nivel"] = 90;
        widths["unidad_administrativa"] = 260;
        widths["nombre_puesto_funcional"] = 260;
        widths["fecha_de_ingreso"] = 130;
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

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideClose
                className="w-fit max-w-[96vw] lg:max-w-[95vw] max-h-[94vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
                onClick={handleCloseAllPopups}
                onPointerDownOutside={(e) => {
                    const target = e.target;
                    if (
                        target &&
                        (target.closest('[role="presentation"]') ||
                         target.closest('.z-\\[250\\]') ||
                         target.closest('.fixed.z-\\[250\\]'))
                    ) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target;
                    if (
                        target &&
                        (target.closest('[role="presentation"]') ||
                         target.closest('.z-\\[250\\]') ||
                         target.closest('.fixed.z-\\[250\\]'))
                    ) {
                        e.preventDefault();
                    }
                }}
            >
                <Zoom 
                    triggerOnce 
                    duration={500} 
                    className={`w-full max-h-[94vh] min-h-0 flex flex-col ${isClosing ? 'animate-out fade-out-0 zoom-out-90 duration-300' : ''}`}
                >
                    <div className="w-full max-h-[94vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden">
                        
                        {/* Header del Modal */}
                        <DialogHeader className="mb-6 shrink-0 flex flex-row justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] dark:from-[#3e131f] dark:to-[#621f32] rounded-xl shadow-xl shadow-[#621f32]/10 text-white border border-[#bc955c]/25">
                                    <Users className="size-6 text-[#bc955c]" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-extrabold text-[#621f32] dark:text-[#bc955c] tracking-tight flex items-center flex-wrap gap-2.5">
                                        <span>Listado de Empleados</span>
                                        <span className="text-[10px] px-2.5 py-0.5 bg-[#bc955c]/10 dark:bg-[#bc955c]/5 text-[#bc955c] font-black uppercase tracking-wider rounded-lg border border-[#bc955c]/20 flex items-center gap-2">
                                            Nivel: <span className="text-slate-800 dark:text-slate-200">{nivel}</span>
                                            <span className="text-slate-300 dark:text-slate-700 font-normal">|</span>
                                            Estatus: <span className="text-slate-800 dark:text-slate-200">{estatus}</span>
                                            {ua && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-700 font-normal">|</span>
                                                    UA: <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={ua}>{ua}</span>
                                                </>
                                            )}
                                        </span>
                                    </DialogTitle>
                                    <DialogDescription className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                                        Exploración y Filtrado de Capital Humano · Estatus Administrativo
                                    </DialogDescription>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Botón Configurar Columnas */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowColumnsModal(true);
                                    }}
                                    className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-55 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                                    title="Agregar/Ocultar columnas de la tabla"
                                >
                                    <Columns3 className="size-4 text-[#bc955c]" />
                                    <span>Columnas</span>
                                </button>

                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="p-2.5 rounded-xl bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-450 dark:text-slate-550 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                        </DialogHeader>

                        {/* Content Body - Tabla Integrada */}
                        <div className={`flex flex-col flex-1 min-h-0 w-full relative overflow-hidden transition-all duration-300 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                            {loading ? (
                                <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-955 overflow-hidden">
                                    <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar border border-slate-200 dark:border-slate-855 rounded-xl">
                                        <table className="w-max min-w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
                                            <thead className="sticky top-0 z-20 shadow-md">
                                                <tr className="bg-[#621f32] text-white border-b border-[#bc955c]/25">
                                                    <th style={{ width: 50, minWidth: 50, maxWidth: 50 }} className="py-2.5 px-2 text-center align-middle bg-[#621f32] border-r border-[#8a2f4a]/30">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                                                            VER
                                                        </span>
                                                    </th>
                                                    {activeColumns.map((col, idx) => (
                                                        <th key={idx} style={{ width: columnWidths[col.key] || 160, minWidth: columnWidths[col.key] || 160, maxWidth: columnWidths[col.key] || 160 }} className="py-3 px-4 border-r border-[#8a2f4a]/30 align-middle bg-[#621f32]">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                                                                {col.label}
                                                            </span>
                                                        </th>
                                                    ))}
                                                </tr>
                                                <tr className="bg-[#501929]">
                                                    <th className="p-1.5 border-r border-b border-[#621f32]/20 text-center">
                                                        <div className="size-5" />
                                                    </th>
                                                    {activeColumns.map((col, idx) => (
                                                        <th key={`search-sk-${idx}`} className="p-1.5 border-r border-b border-[#621f32]/20 last:border-r-0">
                                                            <div className="h-7 w-full bg-white/5 rounded-md animate-pulse" />
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-950">
                                                {[...Array(10)].map((_, rIdx) => (
                                                    <tr key={rIdx} className="h-[37px] border-b border-slate-100 dark:border-slate-900 bg-transparent">
                                                        <td className="px-2 border-r border-slate-100 dark:border-slate-900 text-center align-middle">
                                                            <div className="size-4 bg-slate-200/60 dark:bg-slate-800/60 rounded animate-pulse mx-auto" />
                                                        </td>
                                                        {activeColumns.map((col, cIdx) => (
                                                            <td key={cIdx} className="px-4 py-2 border-r border-slate-100 dark:border-slate-900 last:border-r-0 align-middle">
                                                                <div className="h-3 bg-slate-200/60 dark:bg-slate-800/60 rounded animate-pulse" style={{ width: `${Math.floor(Math.random() * (90 - 55 + 1) + 55)}%` }} />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {/* Footer Loading Skeleton */}
                                    <div className="flex items-center justify-between pt-4 bg-transparent border-t border-slate-100 dark:border-slate-900 shrink-0 mt-4 animate-pulse">
                                        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-900 rounded-lg" />
                                        <div className="h-8 w-36 bg-slate-100 dark:bg-slate-900 rounded-lg" />
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-red-50/10 rounded-xl border border-red-100/30">
                                    <div className="size-20 bg-red-100/20 rounded-2xl flex items-center justify-center mb-6 text-red-650 shadow-xl shadow-red-100/10">
                                        <X className="size-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-2">Error de carga</h3>
                                    <p className="text-gray-500 dark:text-slate-400 max-w-md font-medium">{error}</p>
                                    <button onClick={fetchData} className="mt-8 px-10 py-3 bg-[#621f32] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-xl shadow-[#621f32]/30 active:scale-95 cursor-pointer">
                                        Reintentar ahora
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-950 overflow-hidden">
                                    
                                    {/* Contenedor Scrollable de la Tabla */}
                                    <div className="flex-1 min-h-0 overflow-auto relative custom-scrollbar border border-slate-200 dark:border-slate-855 rounded-xl" onScroll={() => setPopupConfig(null)}>
                                        <table className="w-max min-w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
                                            <thead className="sticky top-0 z-20 shadow-md">
                                                <tr className="bg-[#621f32] text-white border-b border-[#bc955c]/25">
                                                    {/* Columna Fija de Ojito */}
                                                    <th style={{ width: 50, minWidth: 50, maxWidth: 50 }} className="py-2.5 px-2 text-center align-middle bg-[#621f32] border-r border-[#8a2f4a]/30">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                                                            VER
                                                        </span>
                                                    </th>
                                                    
                                                    {activeColumns.map(col => {
                                                        const isFiltered = !!filters[col.key];
                                                        const isSorted = sortConfig.key === col.key;
                                                        return (
                                                            <th key={col.key} style={{ width: columnWidths[col.key], minWidth: columnWidths[col.key], maxWidth: columnWidths[col.key] }} className={`relative py-2.5 px-4 border-r border-[#8a2f4a]/30 select-none group/th align-middle bg-[#621f32] ${isFiltered ? 'bg-[#501929]/95' : ''}`}>
                                                                <div className="flex items-center justify-between gap-2 h-8 bg-transparent">
                                                                    <div role="button" tabIndex={0} className="flex-1 flex items-center gap-1.5 cursor-pointer overflow-hidden hover:opacity-85 transition-opacity py-0.5" onClick={() => handleSort(col.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(col.key); }}>
                                                                        <span className={`text-[10px] font-semibold uppercase tracking-wider truncate ${isSorted ? 'text-[#bc955c]' : 'text-slate-100'}`}>
                                                                            {col.label}
                                                                        </span>
                                                                        {isSorted ? (
                                                                            sortConfig.direction === 'asc' ? <ArrowUpAZ className="size-3.5 shrink-0 text-[#bc955c]" /> : <ArrowDownAZ className="size-3.5 shrink-0 text-[#bc955c]" />
                                                                        ) : (
                                                                            <ChevronsUpDown className="size-3 shrink-0 text-white/30 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                                                        )}
                                                                    </div>
                                                                    <button onClick={(e) => openFilter(e, col)} className={`p-1 rounded-md transition-all duration-200 shrink-0 cursor-pointer ${isFiltered ? 'text-[#bc955c]' : 'text-white/60 hover:bg-white/10'}`}>
                                                                        <Filter className="size-3" />
                                                                    </button>
                                                                </div>
                                                                <div role="separator" aria-label="Cambiar tamaño de columna" tabIndex={-1} onMouseDown={(e) => handleResizeStart(e, col.key)} className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#bc955c] active:bg-[#bc955c] transition-colors z-30" />
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                                
                                                <tr className="bg-[#501929]">
                                                    <th className="p-1.5 border-r border-b border-[#621f32]/20 text-center">
                                                        <div className="size-5" />
                                                    </th>
                                                    {activeColumns.map(col => (
                                                        <th key={`search-${col.key}`} className="p-1.5 border-r border-b border-[#621f32]/20 last:border-r-0">
                                                            <div className="relative group/search flex items-center">
                                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-2.5 text-white/40" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Filtrar..."
                                                                    value={textFilters[col.key] || ""}
                                                                    onChange={(e) => setTextFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                                                    className="w-full pl-6 pr-2 py-1.5 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-[#bc955c]/40 rounded-md text-[10px] font-semibold text-white placeholder-white/25 transition-all outline-none"
                                                                />
                                                                {textFilters[col.key] && (
                                                                    <button onClick={() => setTextFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#bc955c] transition-colors cursor-pointer">
                                                                        <X className="size-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 bg-white dark:bg-slate-950">
                                                {paginatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={activeColumns.length + 1} className="py-32 text-center bg-slate-55 dark:bg-slate-900/10">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="size-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                                                    <Search className="size-8 text-slate-355 dark:text-slate-655" />
                                                                </div>
                                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No se encontraron registros</p>
                                                                {(Object.keys(filters).length > 0 || Object.keys(textFilters).length > 0) && (
                                                                    <button onClick={() => { setFilters({}); setTextFilters({}); }} className="mt-6 px-6 py-2.5 bg-[#621f32] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-lg shadow-[#621f32]/20 cursor-pointer">
                                                                        Restablecer Filtros
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedData.map((row, index) => (
                                                        <tr key={row.id !== undefined && row.id !== null ? String(row.id) : `row-${index}`} className="hover:bg-[#621f32]/[0.015] dark:hover:bg-slate-900/30 h-[37px] transition-colors border-b border-slate-100 dark:border-slate-900 last:border-0 bg-transparent">
                                                            
                                                            {/* Botón de Ojito de Expediente */}
                                                            <td className="px-2 text-center border-r border-slate-100 dark:border-slate-900 align-middle">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedEmployeeRecord(row); }}
                                                                    className="p-1 rounded-md text-slate-400 dark:text-slate-555 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                                                                    title="Ver expediente detallado de la plaza"
                                                                >
                                                                    <Eye className="size-4" />
                                                                </button>
                                                            </td>
                                                            
                                                            {activeColumns.map(col => (
                                                                <td key={col.key} className={`px-4 text-xs truncate border-r border-slate-100 dark:border-slate-900 last:border-r-0 align-middle ${isMonoColumn(col.key) ? 'font-mono text-[10.5px] font-semibold text-slate-600 dark:text-slate-400' : 'font-medium text-slate-700 dark:text-slate-300'}`} title={row[col.key]}>
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

                                    {/* Footer de la Tabla (Sin doble borde de tarjeta nested) */}
                                    <div className="flex items-center justify-between pt-4 bg-transparent border-t border-slate-100 dark:border-slate-900 shrink-0 mt-4">
                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="px-4 py-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-805 shadow-sm flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest">Total Registros</span>
                                                <span className="text-[#621f32] dark:text-[#bc955c] text-base font-black">{processedData.length.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white dark:bg-slate-955 px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest">Mostrar</span>
                                                <div className="flex gap-1">
                                                    {[20, 50, 100, 500].map((size) => (
                                                        <button key={size} onClick={() => setPageSize(size)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-300 cursor-pointer ${pageSize === size ? 'bg-[#621f32] text-white shadow-md dark:bg-[#bc955c] dark:text-slate-950' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c]'}`}>
                                                            {size}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {(Object.keys(filters).length > 0 || Object.keys(textFilters).length > 0) && (
                                                <button onClick={() => { setFilters({}); setTextFilters({}); setSortConfig({ key: null, direction: 'asc' }); }} className="text-[10px] font-black text-red-650 hover:text-red-700 dark:text-red-400 dark:hover:text-red-350 uppercase tracking-widest px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 transition-colors cursor-pointer">
                                                    Limpiar Filtros
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-955 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                                <ChevronLeft className="size-5" />
                                            </button>
                                            <div className="flex items-center px-4">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest">Página</span>
                                                <span className="mx-2 text-xs font-black text-[#621f32] dark:text-[#bc955c]">{currentPage}</span>
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest mx-1">de</span>
                                                <span className="text-xs font-black text-slate-500 dark:text-slate-400 ml-1">{totalPages}</span>
                                            </div>
                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                                <ChevronRight className="size-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Zoom>

                {/* Popups renderizados mediante DialogPortal para evitar que Radix bloquee el scroll y la interacción */}
                {popupConfig && (
                    <DialogPortal>
                        <FilterPopup column={popupConfig.column} rowData={rowData} filters={filters} setFilters={setFilters} onClose={() => setPopupConfig(null)} position={{ x: popupConfig.x, y: popupConfig.y }} />
                    </DialogPortal>
                )}
            </DialogContent>
        </Dialog>

        {/* Modal de Configurar Columnas Centrado */}
        <ColumnsSelectorModal 
            isOpen={showColumnsModal} 
            onClose={() => setShowColumnsModal(false)} 
            visibleKeys={visibleKeys} 
            setVisibleKeys={setVisibleKeys} 
        />

        {/* Modal de Expediente Detallado (Fichero de todos los datos) */}
        <EmployeeRecordModal isOpen={!!selectedEmployeeRecord} onClose={() => setSelectedEmployeeRecord(null)} record={selectedEmployeeRecord} />
        </>
    );
}
