import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { PresupuestoService } from '@/services/presupuesto.service';
import { Database, Layers, FileText, Variable, Search, Check, AlertCircle, Filter, RotateCcw, Plus, XCircle } from 'lucide-react';
import ColumnFilterDropdown from '@/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown';
import { useColumnFilters } from '@/app/dashboard/plantilla_empleados/_hooks/useColumnFilters';
import {
    applyColumnFilters,
    getUniqueColumnValues,
    matchesTextCondition,
    finalizeFilterDropdownValues,
    getConditionLabel,
    CONDITION_OPTIONS,
    CONDITION_SHORTHANDS,
} from '@/utils/columnFilters';

// ─── EDITABLE CELL ────────────────────────────────────────────────────────────
const EditableCell = ({ value, onSave, type = 'text', className = '' }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [currentValue, setCurrentValue] = React.useState(value);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => { setCurrentValue(value); }, [value]);

    const handleBlur = async () => {
        if (currentValue === value) { setIsEditing(false); return; }
        setSaving(true);
        try {
            await onSave(currentValue);
            setIsEditing(false);
        } catch {
            alert('Error al guardar el cambio');
            setCurrentValue(value);
        } finally { setSaving(false); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleBlur();
        if (e.key === 'Escape') { setCurrentValue(value); setIsEditing(false); }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1.5">
                <input
                    autoFocus
                    type={type === 'number' ? 'number' : 'text'}
                    step={type === 'number' ? 'any' : undefined}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    disabled={saving}
                    className={`w-full px-2 py-1 text-xs border-b-2 border-[#621f32] bg-amber-50/40 focus:outline-none rounded-sm ${className}`}
                />
                {saving && <div className="w-3 h-3 border-2 border-[#621f32] border-t-transparent rounded-full animate-spin shrink-0" />}
            </div>
        );
    }

    let displayValue = currentValue;
    if (type === 'number' && typeof displayValue === 'number') {
        displayValue = displayValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else if (type === 'boolean') {
        displayValue = displayValue ? 'SÍ' : 'NO';
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`cursor-pointer px-2 py-1 rounded transition-all min-h-[24px] flex items-center
                        border border-transparent hover:border-amber-300 hover:bg-amber-50/50 ${className}`}
        >
            {displayValue}
        </div>
    );
};

const TAB_META = {
    catalogo:   { icon: Layers,   label: 'Catálogo PECEN' },
    conceptos:  { icon: FileText, label: 'Conceptos Presupuestales' },
    constantes: { icon: Variable, label: 'Constantes del Sistema' },
};

const CATALOGO_COLUMNS = [
    { key: 'nivel', label: 'Nivel / Código', align: 'left', sticky: true },
    { key: 'nivel_cruce', label: 'Nivel Cruce', align: 'left' },
    { key: 'denominacion', label: 'Denominación', align: 'left' },
    { key: 'zona', label: 'Zona', align: 'right' },
    { key: 'sueldo', label: 'Sueldo', align: 'right' },
    { key: 'despensa', label: 'Despensa', align: 'right' },
    { key: 'prev_social_multiple', label: 'Prev. Soc.', align: 'right' },
    { key: 'ayuda_servicios', label: 'Ayuda Serv.', align: 'right' },
    { key: 'apoyo_capacitacion', label: 'Apoyo Cap.', align: 'right' },
    { key: 'ayuda_transporte', label: 'Ayuda Transp.', align: 'right' },
    { key: 'compensacion_garantizada', label: 'Comp. Garant.', align: 'right' },
    { key: 'cuota_issste', label: 'ISSSTE', align: 'right' },
    { key: 'cuota_fovissste', label: 'FOVISSSTE', align: 'right' },
    { key: 'cuota_cesantia', label: 'Cesantía', align: 'right' },
    { key: 'ahorro_solidario', label: 'Ahorro Sol.', align: 'right' },
    { key: 'epr_quincenal', label: 'EPR Quinc.', align: 'right' },
    { key: 'grupo_vacaciones', label: 'Grp. Vac.', align: 'right' },
    { key: 'grupo_gratificacion', label: 'Grp. Grat.', align: 'right' },
    { key: 'tiene_epr', label: '¿EPR?', align: 'right' },
];

const CONCEPTOS_COLUMNS = [
    { key: 'concepto', label: 'Partida', align: 'left', sticky: true },
    { key: 'descripcion', label: 'Descripción', align: 'left' },
    { key: 'seccion', label: 'Sección', align: 'center' },
    { key: 'orden', label: 'Orden', align: 'center' },
];

const CONSTANTES_COLUMNS = [
    { key: 'clave', label: 'Clave', align: 'left', sticky: true },
    { key: 'descripcion', label: 'Descripción Operativa', align: 'left' },
    { key: 'valor', label: 'Valor', align: 'right' },
];

const PLAZA_FORM_FIELDS = [
    { key: 'codigo', label: 'Código', type: 'text' },
    { key: 'nivel', label: 'Nivel', type: 'text' },
    { key: 'nivel_cruce', label: 'Nivel Cruce', type: 'text' },
    { key: 'denominacion', label: 'Denominación', type: 'text', span: 2 },
    { key: 'zona', label: 'Zona', type: 'number' },
    { key: 'sueldo', label: 'Sueldo', type: 'number' },
    { key: 'despensa', label: 'Despensa', type: 'number' },
    { key: 'prev_social_multiple', label: 'Prev. Social Múltiple', type: 'number' },
    { key: 'ayuda_servicios', label: 'Ayuda Servicios', type: 'number' },
    { key: 'apoyo_capacitacion', label: 'Apoyo Capacitación', type: 'number' },
    { key: 'ayuda_transporte', label: 'Ayuda Transporte', type: 'number' },
    { key: 'compensacion_garantizada', label: 'Compensación Garantizada', type: 'number' },
    { key: 'cuota_issste', label: 'Cuota ISSSTE', type: 'number' },
    { key: 'cuota_fovissste', label: 'Cuota FOVISSSTE', type: 'number' },
    { key: 'cuota_cesantia', label: 'Cuota Cesantía', type: 'number' },
    { key: 'ahorro_solidario', label: 'Ahorro Solidario', type: 'number' },
    { key: 'epr_quincenal', label: 'EPR Quincenal', type: 'number' },
    { key: 'grupo_vacaciones', label: 'Grupo Vacaciones', type: 'number' },
    { key: 'grupo_gratificacion', label: 'Grupo Gratificación', type: 'number' },
    { key: 'tiene_epr', label: '¿Tiene EPR?', type: 'boolean' },
];

const EMPTY_PLAZA_FORM = PLAZA_FORM_FIELDS.reduce((acc, f) => {
    acc[f.key] = f.type === 'boolean' ? false : f.type === 'number' ? '0' : '';
    return acc;
}, {});

/** Modal para dar de alta un registro nuevo en el Catálogo PECEN. */
function AddPlazaModal({ open, onClose, onCreated }) {
    const [form, setForm] = useState(EMPTY_PLAZA_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) { setForm(EMPTY_PLAZA_FORM); setError(''); }
    }, [open]);

    if (!open) return null;

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {};
            PLAZA_FORM_FIELDS.forEach((f) => {
                if (f.type === 'number') payload[f.key] = Number(form[f.key]) || 0;
                else if (f.type === 'boolean') payload[f.key] = form[f.key] ? 1 : 0;
                else payload[f.key] = form[f.key];
            });
            const res = await PresupuestoService.createPlaza(payload);
            const data = await res.json();
            if (!res.ok) {
                const msg = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' · ');
                throw new Error(msg || 'No se pudo crear la plaza');
            }
            onCreated(data);
            onClose();
        } catch (err) {
            setError(err.message || 'Error al crear la plaza');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="bg-[#621f32] px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <p className="text-amber-300/80 text-[9px] font-black uppercase tracking-[0.2em]">Catálogo PECEN</p>
                        <h3 className="text-white font-black text-lg">Agregar Nueva Plaza</h3>
                    </div>
                    <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 grid grid-cols-2 gap-3.5 overflow-y-auto">
                    {PLAZA_FORM_FIELDS.map((f) => (
                        <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                            <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{f.label}</label>
                            {f.type === 'boolean' ? (
                                <button
                                    type="button"
                                    onClick={() => setField(f.key, !form[f.key])}
                                    className={`w-full py-2 rounded-lg text-xs font-black uppercase tracking-wider border transition-all
                                        ${form[f.key] ? 'bg-[#621f32] text-white border-[#621f32]' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                                >
                                    {form[f.key] ? 'Sí' : 'No'}
                                </button>
                            ) : (
                                <input
                                    required={f.key === 'codigo' || f.key === 'nivel' || f.key === 'nivel_cruce'}
                                    type={f.type === 'number' ? 'number' : 'text'}
                                    step={f.type === 'number' ? 'any' : undefined}
                                    value={form[f.key]}
                                    onChange={(e) => setField(f.key, e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700
                                               focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 transition-all"
                                />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="mx-6 mb-3 flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 shrink-0">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5 shrink-0">
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-all">
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white
                                   bg-[#621f32] hover:bg-[#4e1828] disabled:opacity-50 transition-all">
                        {saving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Guardar Plaza
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}

const MONO_COLUMN_KEYS = ['codigo', 'concepto', 'clave'];
const NIVEL_CODIGO_SEP = ' · ';

/** Encabezado de columna con botón de filtro (abre el dropdown de valores únicos). */
function ParamTh({ children, align = 'left', sticky = false, padding, hasFilter, onOpenFilter }) {
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '';
    return (
        <th className={`${padding} font-black text-gray-500 uppercase tracking-wide text-xs relative
            ${sticky ? 'sticky left-0 bg-gray-100 z-30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]' : ''} ${alignClass}`}>
            <div className={`flex items-center gap-1.5 ${justifyClass}`}>
                <span>{children}</span>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenFilter(); }}
                    title="Filtrar columna"
                    className={`shrink-0 p-0.5 rounded transition-colors cursor-pointer ${hasFilter ? 'text-[#621f32]' : 'text-gray-300 hover:text-gray-500'}`}
                >
                    <Filter className="w-3 h-3" />
                </button>
                {hasFilter && <span className="absolute top-1 right-1 size-1.5 bg-[#621f32] rounded-full" />}
            </div>
        </th>
    );
}

/** Fila de filtro de texto (condición + input) bajo el encabezado de cada columna. */
function ParamFilterTh({ colKey, sticky, padding, textFilters, setTextFilters, isMonoColumn, activeConditionDropdown, setActiveConditionDropdown }) {
    const filterObj = textFilters[colKey] || { value: '', condition: isMonoColumn(colKey) ? 'starts_with' : 'contains' };
    const condition = filterObj.condition || (isMonoColumn(colKey) ? 'starts_with' : 'contains');
    const symbol = CONDITION_SHORTHANDS[condition] || '*';
    return (
        <th className={`${padding} bg-gray-50 border-b border-gray-100 ${sticky ? 'sticky left-0 z-30 bg-gray-50' : ''}`}>
            <div className="relative flex items-center gap-1">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveConditionDropdown(activeConditionDropdown === colKey ? null : colKey); }}
                    title={`Condición: ${getConditionLabel(condition)}`}
                    className="shrink-0 size-4 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-gray-500 text-[8px] font-black cursor-pointer select-none transition-colors"
                >
                    {symbol}
                </button>
                <input
                    type="text"
                    value={filterObj.value || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        setTextFilters((prev) => {
                            const next = { ...prev };
                            if (val === '') delete next[colKey];
                            else next[colKey] = { value: val, condition };
                            return next;
                        });
                    }}
                    placeholder="Filtrar..."
                    className="w-full bg-white border border-gray-200 rounded-md text-[10px] font-medium text-gray-600 py-1 px-1.5 outline-none focus:border-[#621f32]/40 transition-all"
                />
                {activeConditionDropdown === colKey && (
                    <>
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => { e.stopPropagation(); setActiveConditionDropdown(null); }} />
                        <div className="absolute top-full left-0 mt-1 z-50 w-36 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-left">
                            {CONDITION_OPTIONS.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTextFilters((prev) => ({ ...prev, [colKey]: { value: filterObj.value, condition: item.key } }));
                                        setActiveConditionDropdown(null);
                                    }}
                                    className={`px-2 py-1 text-[9px] font-bold rounded-lg text-left transition-colors cursor-pointer w-full flex items-center justify-between ${condition === item.key ? 'bg-[#621f32] text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                                >
                                    <span>{item.label}</span>
                                    {condition === item.key && <Check className="size-2.5" />}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </th>
    );
}

export default function ParametrosValuacion({
    activeParamTab,
    catalogo,
    setCatalogo,
    constantes,
    setConstantes,
    conceptos,
    setConceptos,
    paramSearchTerm,
    setParamSearchTerm,
    fetchInitialData
}) {
    const [showAddPlazaModal, setShowAddPlazaModal] = useState(false);

    const isMonoColumn = useCallback((key) => MONO_COLUMN_KEYS.includes(key), []);
    const getCellValue = useCallback((row, key) => {
        if (key === 'tiene_epr') return row.tiene_epr === 1 ? 'SÍ' : 'NO';
        if (key === 'nivel') return [row.nivel, row.codigo].filter(Boolean).join(NIVEL_CODIGO_SEP);
        const v = row[key];
        return v === null || v === undefined ? '' : String(v);
    }, []);

    /** Muestra "Nivel · Código" como nivel destacado + código en mono, en el dropdown de filtro. */
    const nivelCodigoValueLabel = useCallback((value) => {
        const [nivelPart, codigoPart] = value.split(NIVEL_CODIGO_SEP);
        return (
            <span className="flex items-center gap-1.5">
                <span className="font-black text-[#621f32]">{nivelPart}</span>
                {codigoPart && <span className="text-gray-400 font-mono text-[10px]">{codigoPart}</span>}
            </span>
        );
    }, []);

    const activeColumns = activeParamTab === 'catalogo' ? CATALOGO_COLUMNS : activeParamTab === 'constantes' ? CONSTANTES_COLUMNS : CONCEPTOS_COLUMNS;
    const activeRawData = activeParamTab === 'catalogo' ? catalogo : activeParamTab === 'constantes' ? constantes : conceptos;

    const filters = useColumnFilters();
    const {
        columnFilters, setColumnFilters,
        textFilters, setTextFilters,
        activeFilterDropdown, setActiveFilterDropdown,
        filterDropdownTab, setFilterDropdownTab,
        activeConditionDropdown, setActiveConditionDropdown,
        tempSelectedValues, setTempSelectedValues,
        setFilterSearchText,
        filterSearchCondition,
        debouncedFilterSearchText,
    } = filters;

    // Cambió de subtab: filtros de columna de la tabla anterior ya no aplican (claves distintas).
    useEffect(() => {
        setColumnFilters({});
        setTextFilters({});
        setActiveFilterDropdown(null);
    }, [activeParamTab]);

    useEffect(() => {
        document.body.style.overflow = activeFilterDropdown ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [activeFilterDropdown]);

    const filteredParams = useMemo(() => {
        return applyColumnFilters(activeRawData, {
            globalSearch: paramSearchTerm,
            columnFilters,
            textFilters,
            getCellValue,
            isMonoColumn,
        });
    }, [activeRawData, paramSearchTerm, columnFilters, textFilters, getCellValue, isMonoColumn]);

    const openFilterDropdown = (colKey) => {
        if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
        setActiveFilterDropdown(colKey);
        setFilterDropdownTab('todos');
        setFilterSearchText('');
        const allValues = [...new Set(activeRawData.map((row) => getCellValue(row, colKey)))];
        setTempSelectedValues(columnFilters[colKey] || allValues);
    };

    const applyColumnFilter = (colKey) => {
        const totalUnique = getUniqueColumnValues(activeRawData, colKey, getCellValue).map((v) => v.value);
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

    const hasActiveFilters = !!paramSearchTerm || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some((f) => f?.value);

    const resetAllFilters = () => {
        setParamSearchTerm('');
        setColumnFilters({});
        setTextFilters({});
        setActiveFilterDropdown(null);
    };

    const dropdownUniqueValues = useMemo(() => {
        if (!activeFilterDropdown) return [];
        return getUniqueColumnValues(activeRawData, activeFilterDropdown, getCellValue);
    }, [activeFilterDropdown, activeRawData, getCellValue]);

    const filterDropdownValues = useMemo(() => {
        if (!activeFilterDropdown) {
            return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
        }
        let baseUniqueValues = dropdownUniqueValues;
        if (filterDropdownTab === 'actuales') {
            baseUniqueValues = getUniqueColumnValues(filteredParams, activeFilterDropdown, getCellValue);
        }
        const filtered = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
        return finalizeFilterDropdownValues({
            baseUniqueValues,
            filtered,
            tempSelectedValues,
            committedSelectedValues: columnFilters[activeFilterDropdown] || [],
        });
    }, [activeFilterDropdown, dropdownUniqueValues, filterDropdownTab, filteredParams, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters, getCellValue]);

    const handleUpdatePlaza = async (id, field, value) => {
        const res = await PresupuestoService.updatePlaza(id, { [field]: value });
        if (res.ok) { const u = await res.json(); setCatalogo(prev => prev.map(p => p.id === id ? u : p)); }
        else throw new Error();
    };
    const handleUpdateConstante = async (clave, value) => {
        const res = await PresupuestoService.updateConstante(clave, { valor: value });
        if (res.ok) { const u = await res.json(); setConstantes(prev => prev.map(c => c.clave === clave ? u : c)); }
        else throw new Error();
    };
    const handleUpdateConcepto = async (concepto, field, value) => {
        const res = await PresupuestoService.updateConcepto(concepto, { [field]: value });
        if (res.ok) { const u = await res.json(); setConceptos(prev => prev.map(c => c.concepto === concepto ? u : c)); }
        else throw new Error();
    };

    const { icon: TabIcon, label: tabLabel } = TAB_META[activeParamTab] ?? TAB_META.catalogo;

    return (
        <div className="animate-in fade-in duration-400 sticky bottom-0 flex flex-col overflow-hidden bg-white border-y border-gray-200/80 shadow-sm md:max-h-[calc(100vh-var(--stack-h,9rem)-3.5rem)]">

            {/* ── Subtab header ─────────────────────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-4">
                    <div className="bg-[#621f32] p-3 rounded-xl shrink-0">
                        <TabIcon className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{tabLabel}</h1>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em] mt-1">
                            Sistema FUMP · Clic en valor para editar · Enter para guardar
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Filtrar..."
                            value={paramSearchTerm}
                            onChange={(e) => setParamSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl
                                       text-xs font-medium text-gray-600 placeholder-gray-300
                                       focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40
                                       transition-all w-48"
                        />
                    </div>
                    {/* Auto-save badge */}
                    <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-green-500 uppercase tracking-wider">
                        <Check className="w-3 h-3" /> Auto guardado
                    </div>
                    {/* Reiniciar filtros */}
                    <button
                        onClick={resetAllFilters}
                        disabled={!hasActiveFilters}
                        className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 rounded-xl
                                   text-[9px] font-black uppercase text-gray-500 hover:bg-gray-100 hover:text-red-600 hover:border-red-200
                                   transition-all tracking-wider disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <RotateCcw className="w-3 h-3" /> Reiniciar filtros
                    </button>
                    {/* Reload */}
                    <button
                        onClick={fetchInitialData}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#621f32]/5 border border-[#621f32]/20 rounded-xl
                                   text-[9px] font-black uppercase text-[#621f32] hover:bg-[#621f32]/10 transition-all tracking-wider"
                    >
                        <Database className="w-3 h-3" /> Recargar
                    </button>
                    {/* Agregar plaza (solo en Catálogo PECEN) */}
                    {activeParamTab === 'catalogo' && (
                        <button
                            onClick={() => setShowAddPlazaModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#621f32] rounded-xl
                                       text-[9px] font-black uppercase text-white hover:bg-[#4e1828] transition-all tracking-wider shadow-sm shadow-[#621f32]/30"
                        >
                            <Plus className="w-3 h-3" /> Agregar Plaza
                        </button>
                    )}
                </div>
            </div>

            {/* ── Table body ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto min-h-0">

                    {/* Catálogo */}
                    {activeParamTab === 'catalogo' && (
                        <table className="w-full text-sm text-left min-w-[2400px]">
                            <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                <tr>
                                    {CATALOGO_COLUMNS.map((col) => (
                                        <ParamTh
                                            key={col.key}
                                            align={col.align}
                                            sticky={col.sticky}
                                            padding="px-5 py-3.5"
                                            hasFilter={!!(columnFilters[col.key]?.length || textFilters[col.key]?.value)}
                                            onOpenFilter={() => openFilterDropdown(col.key)}
                                        >
                                            {col.label}
                                        </ParamTh>
                                    ))}
                                </tr>
                                <tr>
                                    {CATALOGO_COLUMNS.map((col) => (
                                        <ParamFilterTh
                                            key={`f-${col.key}`}
                                            colKey={col.key}
                                            sticky={col.sticky}
                                            padding="px-3 py-1.5"
                                            textFilters={textFilters}
                                            setTextFilters={setTextFilters}
                                            isMonoColumn={isMonoColumn}
                                            activeConditionDropdown={activeConditionDropdown}
                                            setActiveConditionDropdown={setActiveConditionDropdown}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredParams.map((p) => (
                                    <tr key={p.id} className="hover:bg-amber-50/30 group">
                                        <td className="px-5 py-3.5 sticky left-0 bg-white group-hover:bg-amber-50/30 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                            <div className="font-black text-[#621f32] text-base">{p.nivel}</div>
                                            <div className="text-xs text-gray-400 font-medium uppercase">{p.codigo}</div>
                                        </td>
                                        <td className="px-5 py-3.5"><EditableCell value={p.nivel_cruce} onSave={(v) => handleUpdatePlaza(p.id, 'nivel_cruce', v)} /></td>
                                        <td className="px-5 py-3.5 min-w-[220px]"><EditableCell value={p.denominacion} onSave={(v) => handleUpdatePlaza(p.id, 'denominacion', v)} className="uppercase text-[9px] font-medium" /></td>
                                        <td className="px-5 py-3.5 text-center"><EditableCell value={p.zona} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'zona', parseInt(v))} /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.sueldo)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'sueldo', v)} className="font-black text-gray-800 justify-end" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.despensa)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'despensa', v)} className="justify-end text-gray-400" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.prev_social_multiple)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'prev_social_multiple', v)} className="justify-end text-gray-400" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.ayuda_servicios)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ayuda_servicios', v)} className="justify-end text-gray-400" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.apoyo_capacitacion)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'apoyo_capacitacion', v)} className="justify-end text-gray-400" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.ayuda_transporte)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ayuda_transporte', v)} className="justify-end text-gray-400" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.compensacion_garantizada)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'compensacion_garantizada', v)} className="font-black text-gray-800 justify-end" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.cuota_issste)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_issste', v)} className="justify-end text-amber-700/50" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.cuota_fovissste)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_fovissste', v)} className="justify-end text-amber-700/50" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.cuota_cesantia)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_cesantia', v)} className="justify-end text-amber-700/50" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.ahorro_solidario)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ahorro_solidario', v)} className="justify-end text-amber-700/50" /></td>
                                        <td className="px-5 py-3.5 text-right"><EditableCell value={Number(p.epr_quincenal)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'epr_quincenal', v)} className="justify-end text-blue-600/50" /></td>
                                        <td className="px-5 py-3.5 text-center"><EditableCell value={p.grupo_vacaciones} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'grupo_vacaciones', parseInt(v))} /></td>
                                        <td className="px-5 py-3.5 text-center"><EditableCell value={p.grupo_gratificacion} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'grupo_gratificacion', parseInt(v))} /></td>
                                        <td className="px-5 py-3.5 text-center"><EditableCell value={p.tiene_epr === 1} type="boolean" onSave={(v) => handleUpdatePlaza(p.id, 'tiene_epr', v === 'SÍ' || v === true ? 1 : 0)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Conceptos */}
                    {activeParamTab === 'conceptos' && (
                        <table className="w-full text-sm text-left min-w-[700px]">
                            <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                <tr>
                                    {CONCEPTOS_COLUMNS.map((col) => (
                                        <ParamTh
                                            key={col.key}
                                            align={col.align}
                                            sticky={col.sticky}
                                            padding="px-7 py-4"
                                            hasFilter={!!(columnFilters[col.key]?.length || textFilters[col.key]?.value)}
                                            onOpenFilter={() => openFilterDropdown(col.key)}
                                        >
                                            {col.label}
                                        </ParamTh>
                                    ))}
                                </tr>
                                <tr>
                                    {CONCEPTOS_COLUMNS.map((col) => (
                                        <ParamFilterTh
                                            key={`f-${col.key}`}
                                            colKey={col.key}
                                            sticky={col.sticky}
                                            padding="px-4 py-1.5"
                                            textFilters={textFilters}
                                            setTextFilters={setTextFilters}
                                            isMonoColumn={isMonoColumn}
                                            activeConditionDropdown={activeConditionDropdown}
                                            setActiveConditionDropdown={setActiveConditionDropdown}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredParams.map((c) => (
                                    <tr key={c.concepto} className="hover:bg-amber-50/30 group">
                                        <td className="px-7 py-4 font-mono font-black text-[#621f32] sticky left-0 bg-white group-hover:bg-amber-50/30 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">{c.concepto}</td>
                                        <td className="px-7 py-4"><EditableCell value={c.descripcion} onSave={(v) => handleUpdateConcepto(c.concepto, 'descripcion', v)} className="font-semibold text-gray-600 uppercase text-xs" /></td>
                                        <td className="px-7 py-4 text-center"><EditableCell value={c.seccion} onSave={(v) => handleUpdateConcepto(c.concepto, 'seccion', v)} className="text-[10px] font-bold text-gray-400 uppercase justify-center" /></td>
                                        <td className="px-7 py-4 text-center"><EditableCell value={c.orden} type="number" onSave={(v) => handleUpdateConcepto(c.concepto, 'orden', parseInt(v))} className="font-black text-gray-400 justify-center" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Constantes */}
                    {activeParamTab === 'constantes' && (
                        <table className="w-full text-sm text-left min-w-[600px]">
                            <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                <tr>
                                    {CONSTANTES_COLUMNS.map((col) => (
                                        <ParamTh
                                            key={col.key}
                                            align={col.align}
                                            sticky={col.sticky}
                                            padding="px-7 py-4"
                                            hasFilter={!!(columnFilters[col.key]?.length || textFilters[col.key]?.value)}
                                            onOpenFilter={() => openFilterDropdown(col.key)}
                                        >
                                            {col.label}
                                        </ParamTh>
                                    ))}
                                </tr>
                                <tr>
                                    {CONSTANTES_COLUMNS.map((col) => (
                                        <ParamFilterTh
                                            key={`f-${col.key}`}
                                            colKey={col.key}
                                            sticky={col.sticky}
                                            padding="px-4 py-1.5"
                                            textFilters={textFilters}
                                            setTextFilters={setTextFilters}
                                            isMonoColumn={isMonoColumn}
                                            activeConditionDropdown={activeConditionDropdown}
                                            setActiveConditionDropdown={setActiveConditionDropdown}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredParams.map((c) => (
                                    <tr key={c.clave} className="hover:bg-amber-50/30 group">
                                        <td className="px-7 py-4 font-mono font-black text-[#621f32] sticky left-0 bg-white group-hover:bg-amber-50/30 z-10">{c.clave}</td>
                                        <td className="px-7 py-4"><EditableCell value={c.descripcion || ''} onSave={(v) => handleUpdateConstante(c.clave, { descripcion: v })} className="text-gray-400 font-medium uppercase tracking-tight text-[10px] max-w-[380px]" /></td>
                                        <td className="px-7 py-4 text-right">
                                            <EditableCell value={Number(c.valor)} type="number" onSave={(v) => handleUpdateConstante(c.clave, v)} className="font-black text-[#621f32] text-base justify-end" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            {/* ── Warning footer ────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border-t border-amber-100 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <p className="text-[9px] text-amber-800 font-semibold uppercase tracking-tight">
                    Precaución: Las modificaciones afectarán directamente todos los cálculos de valuación en tiempo real.
                </p>
            </div>

            {/* Dropdown de filtro por valores únicos */}
            <AnimatePresence>
                {activeFilterDropdown && (
                    <ColumnFilterDropdown
                        open={!!activeFilterDropdown}
                        columnKey={activeFilterDropdown}
                        columnLabel={activeColumns.find((c) => c.key === activeFilterDropdown)?.label}
                        isDate={false}
                        data={activeRawData}
                        getCellValue={getCellValue}
                        filters={filters}
                        dropdownValues={filterDropdownValues}
                        onApply={() => applyColumnFilter(activeFilterDropdown)}
                        onClear={() => clearColumnFilter(activeFilterDropdown)}
                        onClose={() => setActiveFilterDropdown(null)}
                        dimBackdrop={false}
                        renderValueLabel={activeFilterDropdown === 'nivel' ? nivelCodigoValueLabel : undefined}
                    />
                )}
            </AnimatePresence>

            <AddPlazaModal
                open={showAddPlazaModal}
                onClose={() => setShowAddPlazaModal(false)}
                onCreated={(created) => setCatalogo((prev) => [...prev, created])}
            />
        </div>
    );
}
