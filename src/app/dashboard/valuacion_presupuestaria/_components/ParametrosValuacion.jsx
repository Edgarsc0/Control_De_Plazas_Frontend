import React, { useMemo } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import { Database, Layers, FileText, Variable, Search, Check, AlertCircle } from 'lucide-react';

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

    const filteredParams = useMemo(() => {
        const t = paramSearchTerm.toLowerCase();
        if (activeParamTab === 'catalogo') return catalogo.filter(p => p.nivel.toLowerCase().includes(t) || p.denominacion.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t));
        if (activeParamTab === 'constantes') return constantes.filter(c => c.clave.toLowerCase().includes(t) || c.descripcion?.toLowerCase().includes(t));
        return conceptos.filter(c => c.concepto.toLowerCase().includes(t) || c.descripcion.toLowerCase().includes(t));
    }, [activeParamTab, catalogo, constantes, conceptos, paramSearchTerm]);

    const { icon: TabIcon, label: tabLabel } = TAB_META[activeParamTab] ?? TAB_META.catalogo;

    return (
        <div className="animate-in fade-in duration-400 sticky bottom-0 flex flex-col overflow-hidden bg-white border-y border-gray-200/80 shadow-sm md:max-h-[calc(100vh-var(--stack-h,9rem)-2.5rem)]">

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
                    {/* Reload */}
                    <button
                        onClick={fetchInitialData}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#621f32]/5 border border-[#621f32]/20 rounded-xl
                                   text-[9px] font-black uppercase text-[#621f32] hover:bg-[#621f32]/10 transition-all tracking-wider"
                    >
                        <Database className="w-3 h-3" /> Recargar
                    </button>
                </div>
            </div>

            {/* ── Table body ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto min-h-0">

                    {/* Catálogo */}
                    {activeParamTab === 'catalogo' && (
                        <table className="w-full text-sm text-left min-w-[2400px]">
                            <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                <tr>
                                    {['Nivel / Código', 'Nivel Cruce', 'Denominación', 'Zona', 'Sueldo', 'Despensa', 'Prev. Soc.', 'Ayuda Serv.', 'Apoyo Cap.', 'Ayuda Transp.', 'Comp. Garant.', 'ISSSTE', 'FOVISSSTE', 'Cesantía', 'Ahorro Sol.', 'EPR Quinc.', 'Grp. Vac.', 'Grp. Grat.', '¿EPR?'].map((h, i) => (
                                        <th key={i}
                                            className={`px-5 py-3.5 font-black text-gray-500 uppercase tracking-wide text-xs
                                                ${i === 0 ? 'sticky left-0 bg-gray-100 z-30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]' : ''}
                                                ${i >= 3 ? 'text-right' : ''}`}>
                                            {h}
                                        </th>
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
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-100 z-30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">Partida</th>
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Descripción</th>
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Sección</th>
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Orden</th>
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
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-100 z-30">Clave</th>
                                    <th className="px-7 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Descripción Operativa</th>
                                    <th className="px-7 py-4 text-xs font-black text-[#621f32] uppercase tracking-widest text-right">Valor</th>
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
        </div>
    );
}
