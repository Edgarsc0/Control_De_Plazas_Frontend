"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { VacantesService } from "@/services/vacantes.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight, Search, Columns3, Stamp, LayoutGrid } from "lucide-react";
import ModalShell, { Pill } from "@/components/shared/ModalShell";
import DataTable from "./DataTable";
import ColumnFilterDropdown from "./ColumnFilterDropdown";
import { useColumnFilters } from "../../_hooks/useColumnFilters";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../_hooks/useCellSelection";
import {
    applyColumnFilters,
    getUniqueColumnValues,
    matchesTextCondition,
    finalizeFilterDropdownValues,
    defaultGetCellValue,
    normalizeForSearch,
} from "@/utils/columnFilters";

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
        const normalizedQuery = normalizeForSearch(searchQuery);
        ALL_AVAILABLE_COLUMNS.forEach(col => {
            if (normalizedQuery && !normalizeForSearch(col.label).includes(normalizedQuery) && !normalizeForSearch(col.key).includes(normalizedQuery)) {
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
                overlayClassName="z-[1100]"
                className="z-[1100] w-full max-w-xl max-h-[80vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
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
export const EmployeeRecordModal = ({ isOpen, onClose, record, columns, fieldClickHandlers = {} }) => {
    const [fieldSearch, setFieldSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            setFieldSearch("");
        }
    }, [isOpen]);

    const filteredGroupedFields = useMemo(() => {
        const groups = {};
        if (!record) return groups;
        const fieldsSource = columns || ALL_AVAILABLE_COLUMNS;
        const query = normalizeForSearch(fieldSearch.trim());

        fieldsSource.forEach(field => {
            const category = field.category || 'General';
            const label = normalizeForSearch(field.label || '');
            const valStr = normalizeForSearch(record[field.key] ?? '');
            const catLower = normalizeForSearch(category);

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

    if (!record) return null;

    return (
        <ModalShell
            open={isOpen}
            onClose={onClose}
            size="lg"
            icon={Stamp}
            eyebrow="Expediente"
            title="Expediente de Plaza"
            subtitle="Consulta detallada de la plaza"
        >
            <div className="flex flex-col gap-5 sm:gap-7">
                {/* Buscador de Campos */}
                <div className="shrink-0 flex items-center gap-2.5 sm:gap-3 bg-white dark:bg-slate-900 px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#bc955c]/60 focus-within:ring-2 focus-within:ring-[#bc955c]/10 transition-all shadow-sm">
                    <Search className="size-4.5 sm:size-5 text-[#bc955c] shrink-0" />
                    <input
                        type="text"
                        placeholder="Buscar campos (RFC, aduana, nivel, sueldo...)"
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-[13px] sm:text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    />
                    {fieldSearch && (
                        <button
                            onClick={() => setFieldSearch("")}
                            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-all cursor-pointer shrink-0"
                        >
                            <X className="size-4.5" />
                        </button>
                    )}
                </div>

                {/* Tarjetas principales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 p-3.5 sm:p-5 bg-[#621f32]/[0.03] dark:bg-slate-900/30 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800">
                    {[
                        { label: "No. Empleado", value: record.id_empleado, isMono: true },
                        { label: "Posición", value: record.posicion, isMono: true },
                        { label: "RFC", value: record.rfc, isMono: true },
                        { label: "Nivel Salarial", value: record.nivel, isMono: true }
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-1 sm:gap-1.5 p-3 sm:p-4 bg-white dark:bg-slate-950 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all sm:hover:scale-[1.02] min-w-0">
                            <span className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{item.label}</span>
                            <span className={`text-[13px] sm:text-base font-bold truncate ${item.isMono ? 'font-mono text-slate-700 dark:text-[#bc955c]' : 'text-slate-800 dark:text-slate-200'}`}>
                                {item.value !== undefined && item.value !== null && String(item.value).trim() !== "" ? String(item.value) : "—"}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Detalle Categorizado */}
                <div className="flex flex-col gap-5 sm:gap-7 mb-2">
                    {!hasVisibleFields ? (
                        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                            <div className="size-14 sm:size-16 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                                <Search className="size-6 sm:size-7 text-[#621f32]/40 dark:text-slate-500 animate-pulse" />
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">No se encontraron campos coincidentes</p>
                            <p className="text-xs text-slate-400 mt-1">Prueba con otra palabra clave o limpia el buscador</p>
                        </div>
                    ) : (
                        Object.entries(filteredGroupedFields).map(([category, fields]) => {
                            if (fields.length === 0) return null;
                            return (
                                <div key={category} className="flex flex-col gap-2.5 sm:gap-3.5">
                                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-900 pb-2">
                                        <span className="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                            {category}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                                            {fields.length} {fields.length === 1 ? 'campo' : 'campos'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                                        {fields.map((field, idx) => {
                                            const hasValue = field.value !== undefined && field.value !== null && String(field.value).trim() !== "";
                                            const clickHandler = fieldClickHandlers[field.key];
                                            const isClickable = hasValue && typeof clickHandler === "function";
                                            return (
                                                <div key={idx} className="flex flex-col gap-1 sm:gap-1.5 p-3 sm:p-4 bg-white dark:bg-slate-900/10 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-900 hover:border-slate-200 dark:hover:border-slate-800 transition-all min-w-0">
                                                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-wider truncate" title={field.label}>
                                                        <HighlightText text={field.label} highlight={fieldSearch} />
                                                    </span>
                                                    <span
                                                        onClick={isClickable ? () => clickHandler(record) : undefined}
                                                        className={`text-[13px] sm:text-sm font-semibold break-all ${isMonoColumn(field.key) ? 'font-mono text-slate-700 dark:text-slate-355 font-bold' : 'text-slate-850 dark:text-slate-200'} ${isClickable ? 'cursor-pointer text-[#621f32] dark:text-[#bc955c] underline decoration-dotted underline-offset-2 hover:decoration-solid' : ''}`}
                                                    >
                                                        {hasValue ? (
                                                            <HighlightText text={String(field.value)} highlight={fieldSearch} />
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </ModalShell>
    );
};


// --- COMPONENTE PRINCIPAL ---
export default function EmployeesModal({ open, onOpenChange, nivel, estatus, ua }) {
    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const [visibleKeys, setVisibleKeys] = useState(DEFAULT_COLUMN_KEYS);
    const [showColumnsModal, setShowColumnsModal] = useState(false);
    const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState(null);

    const { selectedCell, setSelectedCell } = useCellSelection();
    const filters = useColumnFilters();
    const {
        columnFilters, setColumnFilters,
        textFilters, setTextFilters,
        activeFilterDropdown, setActiveFilterDropdown,
        filterDropdownTab, setFilterDropdownTab,
        activeConditionDropdown, setActiveConditionDropdown,
        setTempSelectedValues,
        tempSelectedValues,
        setFilterSearchText,
        filterSearchCondition,
        debouncedFilterSearchText,
        resetFilters,
    } = filters;

    // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
    useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, sortConfig.key, sortConfig.direction]);

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

    const columns = useMemo(() => ALL_AVAILABLE_COLUMNS.map(col => ({
        key: col.key,
        label: col.label,
        width: columnWidths[col.key] || 175,
        visible: visibleKeys.includes(col.key),
    })), [visibleKeys, columnWidths]);

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
            fetchData();
            resetFilters();
            setSortConfig({ key: null, direction: 'asc' });
            setCurrentPage(1);
        } else {
            setRowData([]);
            setActiveFilterDropdown(null);
            setShowColumnsModal(false);
            setSelectedEmployeeRecord(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, fetchData]);

    const handleResizeStart = (e, index, direction = 'right') => {
        e.preventDefault();
        const colKey = columns[index]?.key;
        if (!colKey) return;
        const startX = e.clientX;
        const startWidth = columnWidths[colKey] || 175;
        const onMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = direction === 'left' ? startWidth - deltaX : startWidth + deltaX;
            setColumnWidths(prev => ({ ...prev, [colKey]: Math.max(80, newWidth) }));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
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
        const result = applyColumnFilters(rowData, {
            columnFilters, textFilters, getCellValue: defaultGetCellValue, isMonoColumn,
        });
        if (!sortConfig.key) return result;
        const { key, direction } = sortConfig;
        return [...result].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return direction === 'asc' ? -1 : 1;
            if (strA > strB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [rowData, columnFilters, textFilters, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [columnFilters, textFilters, pageSize, sortConfig.key, sortConfig.direction]);

    const getColumnLetter = useCallback((index) => {
        let temp = index, letter = "";
        while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
        return letter;
    }, []);

    const openFilterDropdown = (colKey) => {
        if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
        setActiveFilterDropdown(colKey);
        setFilterDropdownTab("todos");
        setFilterSearchText("");
        const allValues = [...new Set(rowData.map((row) => defaultGetCellValue(row, colKey)))];
        setTempSelectedValues(columnFilters[colKey] || allValues);
    };

    const applyColumnFilter = (colKey) => {
        const totalUnique = getUniqueColumnValues(rowData, colKey, defaultGetCellValue).map((v) => v.value);
        if (tempSelectedValues.length === totalUnique.length || tempSelectedValues.length === 0) {
            setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
        } else {
            setColumnFilters((prev) => ({ ...prev, [colKey]: tempSelectedValues }));
        }
        setActiveFilterDropdown(null);
    };

    const clearColumnFilter = (colKey) => {
        setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
        setActiveFilterDropdown(null);
    };

    const dropdownUniqueValues = useMemo(() => {
        if (!activeFilterDropdown) return [];
        return getUniqueColumnValues(rowData, activeFilterDropdown, defaultGetCellValue);
    }, [activeFilterDropdown, rowData]);

    const filterDropdownValues = useMemo(() => {
        if (!activeFilterDropdown) {
            return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
        }
        let baseUniqueValues = dropdownUniqueValues;
        if (filterDropdownTab === "actuales") {
            baseUniqueValues = getUniqueColumnValues(processedData, activeFilterDropdown, defaultGetCellValue);
        }
        const filteredVals = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
        return finalizeFilterDropdownValues({
            baseUniqueValues,
            filtered: filteredVals,
            tempSelectedValues,
            committedSelectedValues: columnFilters[activeFilterDropdown] || [],
        });
    }, [activeFilterDropdown, dropdownUniqueValues, filterDropdownTab, processedData, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

    // Chips de filtros activos (columna + texto libre) para retirarlos con un clic
    const activeFilterChips = useMemo(() => {
        const chips = [];
        Object.keys(columnFilters).forEach((key) => {
            chips.push({ id: `col-${key}`, label: COLUMN_LABEL_BY_KEY[key] || key, remove: () => setColumnFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        Object.entries(textFilters).forEach(([key, f]) => {
            if (!f?.value) return;
            chips.push({ id: `text-${key}`, label: `${COLUMN_LABEL_BY_KEY[key] || key}: "${f.value}"`, remove: () => setTextFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        return chips;
    }, [columnFilters, textFilters]);

    const hasActiveFilters = activeFilterChips.length > 0;
    const clearAllFilters = () => { setColumnFilters({}); setTextFilters({}); setSortConfig({ key: null, direction: 'asc' }); };

    const renderCell = ({ col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
        const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
        return (
            <td
                key={col.key}
                onClick={onClick}
                onContextMenu={onContextMenu}
                style={stickyStyle}
                className={`px-4 text-sm border-r truncate h-[37px] align-middle ${
                    isSelected
                        ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                } ${isMonoColumn(col.key) ? "font-mono text-[13px] font-semibold" : "font-medium"}`}
                title={value}
            >
                {value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : (
                    <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                )}
            </td>
        );
    };

    return (
        <>
            <ModalShell
                open={open}
                onClose={() => onOpenChange(false)}
                size="xl"
                icon={LayoutGrid}
                eyebrow="Listado"
                title="Listado de Empleados"
                subtitle="Exploración y filtrado de capital humano"
            >
                <div className="flex flex-col gap-4">
                    {/* Barra de contexto + acciones */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Pill tone="guinda">Nivel {nivel ?? "—"}</Pill>
                            <Pill tone="dorado">{estatus ?? "—"}</Pill>
                            {ua && <Pill tone="slate">{ua}</Pill>}
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {loading ? "···" : processedData.length.toLocaleString()} registros
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                {[20, 50, 100, 500].map((size) => (
                                    <button key={size} onClick={() => setPageSize(size)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${pageSize === size ? 'bg-[#621f32] text-white shadow-sm dark:bg-[#bc955c] dark:text-slate-950' : 'text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c]'}`}>
                                        {size}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowColumnsModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold hover:border-[#bc955c]/50 hover:text-[#621f32] dark:hover:text-[#bc955c] transition-all cursor-pointer"
                            >
                                <Columns3 className="size-3.5" /> Columnas
                            </button>
                            {hasActiveFilters && (
                                <button onClick={clearAllFilters} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-black uppercase cursor-pointer">
                                    <X className="size-3.5" /> Limpiar filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chips de filtros activos */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
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

                    {error ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-red-50/40 dark:bg-red-950/10 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900/30">
                            <div className="size-16 bg-red-100/40 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <X className="size-8" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">Error de carga</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md font-medium">{error}</p>
                            <button onClick={fetchData} className="mt-6 px-8 py-3 bg-[#621f32] text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-lg shadow-[#621f32]/30 active:scale-95 cursor-pointer">
                                Reintentar ahora
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col h-[55vh] rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                                <DataTable
                                    fillHeight
                                    fillWidth
                                    onScroll={() => {}}
                                    columns={columns}
                                    columnFilters={columnFilters}
                                    textFilters={textFilters}
                                    setTextFilters={setTextFilters}
                                    activeConditionDropdown={activeConditionDropdown}
                                    setActiveConditionDropdown={setActiveConditionDropdown}
                                    selectedCell={selectedCell}
                                    onSelectCell={setSelectedCell}
                                    onCellContextMenu={() => {}}
                                    onShowRecord={(row) => setSelectedEmployeeRecord(row)}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    onOpenFilter={openFilterDropdown}
                                    onResizeStart={handleResizeStart}
                                    getColumnLetter={getColumnLetter}
                                    isMonoColumn={isMonoColumn}
                                    isPending={false}
                                    isLoading={loading}
                                    loadingVariant="skeleton"
                                    loadingMessage="Consultando base de datos..."
                                    data={paginatedData}
                                    startIndex={0}
                                    endIndex={paginatedData.length}
                                    totalCount={paginatedData.length}
                                    rowHeight={37}
                                    getRowId={(row, i) => row.id_empleado ?? i}
                                    renderCell={renderCell}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 shrink-0">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Página</span>
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    <div className="flex items-baseline gap-1 px-1">
                                        <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c]">{currentPage}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase">de</span>
                                        <span className="text-sm font-black text-slate-500 dark:text-slate-400">{totalPages}</span>
                                    </div>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#621f32] dark:hover:text-[#bc955c] disabled:opacity-20 transition-all cursor-pointer">
                                        <ChevronRight className="size-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </ModalShell>

            <AnimatePresence>
                {activeFilterDropdown && (
                    <ColumnFilterDropdown
                        open={!!activeFilterDropdown}
                        columnKey={activeFilterDropdown}
                        columnLabel={COLUMN_LABEL_BY_KEY[activeFilterDropdown]}
                        isDate={false}
                        data={rowData}
                        getCellValue={defaultGetCellValue}
                        filters={filters}
                        dropdownValues={filterDropdownValues}
                        onApply={() => applyColumnFilter(activeFilterDropdown)}
                        onClear={() => clearColumnFilter(activeFilterDropdown)}
                        onClose={() => setActiveFilterDropdown(null)}
                    />
                )}
            </AnimatePresence>

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
