import React, { useMemo } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import { Settings2, Database, Layers, FileText, Variable, ArrowRight, Search, Check, AlertCircle } from 'lucide-react';

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

export default function ParametrosValuacion({ 
    activeParamTab, 
    setActiveParamTab, 
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

    return (
        <div className="space-y-7 animate-in fade-in duration-400">
            {/* Params Header */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/40"
                style={{ background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)' }}>
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '18px 18px' }} />
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5 p-7 md:p-9">
                    <div className="flex items-center gap-5">
                        <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                            <Settings2 className="w-8 h-8 text-amber-300" />
                        </div>
                        <div>
                            <p className="text-amber-300/70 text-[9px] font-bold uppercase tracking-[0.3em] mb-1">Sistema FUMP</p>
                            <h1 className="text-white text-2xl font-black tracking-tight leading-none">Configuración de Parámetros</h1>
                            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest mt-1.5">Catálogos y Constantes del Sistema</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchInitialData}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl
                                   text-[10px] font-black uppercase text-amber-200 hover:bg-white/20 transition-all tracking-wider"
                    >
                        <Database className="w-3.5 h-3.5" /> Recargar Datos
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar */}
                <div className="lg:w-1/4 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-2 space-y-1">
                        {[
                            { id: 'catalogo', label: 'Catálogo Plazas', icon: Layers },
                            { id: 'conceptos', label: 'Conceptos Pres.', icon: FileText },
                            { id: 'constantes', label: 'Constantes', icon: Variable },
                        ].map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveParamTab(id)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all
                                    ${activeParamTab === id
                                        ? 'bg-[#621f32] text-white shadow-md shadow-[#621f32]/20'
                                        : 'text-gray-400 hover:bg-gray-50 hover:text-[#621f32]'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${activeParamTab === id ? 'text-amber-400' : ''}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                </div>
                                <ArrowRight className={`w-3.5 h-3.5 transition-transform ${activeParamTab === id ? 'translate-x-0.5' : 'opacity-0'}`} />
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-4">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2.5 block">Búsqueda</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Filtrar..."
                                value={paramSearchTerm}
                                onChange={(e) => setParamSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                                           text-[10px] font-medium text-gray-600 placeholder-gray-300
                                           focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Table panel */}
                <div className="lg:w-3/4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col h-[680px]">
                        {/* Panel header */}
                        <div className="px-7 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="bg-[#621f32] p-2 rounded-lg">
                                    {activeParamTab === 'catalogo' && <Layers className="w-4 h-4 text-amber-400" />}
                                    {activeParamTab === 'conceptos' && <FileText className="w-4 h-4 text-amber-400" />}
                                    {activeParamTab === 'constantes' && <Variable className="w-4 h-4 text-amber-400" />}
                                </div>
                                <div>
                                    <h2 className="text-gray-800 font-black text-sm uppercase tracking-widest">
                                        {activeParamTab === 'catalogo' && 'Catálogo PECEN'}
                                        {activeParamTab === 'conceptos' && 'Conceptos Presupuestales'}
                                        {activeParamTab === 'constantes' && 'Constantes del Sistema'}
                                    </h2>
                                    <p className="text-[9px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">
                                        Clic en un valor para editar · Enter para guardar
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-green-500 uppercase tracking-wider">
                                <Check className="w-3 h-3" /> Guardado automático
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {/* ── Catálogo ── */}
                            {activeParamTab === 'catalogo' && (
                                <table className="w-full text-[10px] text-left min-w-[2400px]">
                                    <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                        <tr>
                                            {['Nivel / Código', 'Nivel Cruce', 'Denominación', 'Zona', 'Sueldo', 'Despensa', 'Prev. Soc.', 'Ayuda Serv.', 'Apoyo Cap.', 'Ayuda Transp.', 'Comp. Garant.', 'ISSSTE', 'FOVISSSTE', 'Cesantía', 'Ahorro Sol.', 'EPR Quinc.', 'Grp. Vac.', 'Grp. Grat.', '¿EPR?'].map((h, i) => (
                                                <th key={i}
                                                    className={`px-5 py-3.5 font-black text-gray-400 uppercase tracking-widest text-[9px]
                                                        ${i === 0 ? 'sticky left-0 bg-gray-100 z-30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]' : ''}
                                                        ${i >= 3 ? 'text-right' : ''}`}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredParams.map((p) => (
                                            <tr key={p.id} className="hover:bg-gray-50/50 group">
                                                <td className="px-5 py-4 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">
                                                    <div className="font-black text-[#621f32] text-xs">{p.nivel}</div>
                                                    <div className="text-[9px] text-gray-400 font-medium uppercase">{p.codigo}</div>
                                                </td>
                                                <td className="px-5 py-4"><EditableCell value={p.nivel_cruce} onSave={(v) => handleUpdatePlaza(p.id, 'nivel_cruce', v)} /></td>
                                                <td className="px-5 py-4 min-w-[220px]"><EditableCell value={p.denominacion} onSave={(v) => handleUpdatePlaza(p.id, 'denominacion', v)} className="uppercase text-[9px] font-medium" /></td>
                                                <td className="px-5 py-4 text-center"><EditableCell value={p.zona} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'zona', parseInt(v))} /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.sueldo)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'sueldo', v)} className="font-black text-gray-800 justify-end" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.despensa)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'despensa', v)} className="justify-end text-gray-400" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.prev_social_multiple)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'prev_social_multiple', v)} className="justify-end text-gray-400" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.ayuda_servicios)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ayuda_servicios', v)} className="justify-end text-gray-400" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.apoyo_capacitacion)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'apoyo_capacitacion', v)} className="justify-end text-gray-400" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.ayuda_transporte)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ayuda_transporte', v)} className="justify-end text-gray-400" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.compensacion_garantizada)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'compensacion_garantizada', v)} className="font-black text-gray-800 justify-end" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.cuota_issste)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_issste', v)} className="justify-end text-amber-700/50" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.cuota_fovissste)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_fovissste', v)} className="justify-end text-amber-700/50" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.cuota_cesantia)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'cuota_cesantia', v)} className="justify-end text-amber-700/50" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.ahorro_solidario)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'ahorro_solidario', v)} className="justify-end text-amber-700/50" /></td>
                                                <td className="px-5 py-4 text-right"><EditableCell value={Number(p.epr_quincenal)} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'epr_quincenal', v)} className="justify-end text-blue-600/50" /></td>
                                                <td className="px-5 py-4 text-center"><EditableCell value={p.grupo_vacaciones} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'grupo_vacaciones', parseInt(v))} /></td>
                                                <td className="px-5 py-4 text-center"><EditableCell value={p.grupo_gratificacion} type="number" onSave={(v) => handleUpdatePlaza(p.id, 'grupo_gratificacion', parseInt(v))} /></td>
                                                <td className="px-5 py-4 text-center"><EditableCell value={p.tiene_epr === 1} type="boolean" onSave={(v) => handleUpdatePlaza(p.id, 'tiene_epr', v === 'SÍ' || v === true ? 1 : 0)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* ── Conceptos ── */}
                            {activeParamTab === 'conceptos' && (
                                <table className="w-full text-[11px] text-left min-w-[700px]">
                                    <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                        <tr>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-100 z-30 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">Partida</th>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Descripción</th>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Sección</th>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Orden</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredParams.map((c) => (
                                            <tr key={c.concepto} className="hover:bg-gray-50/50 group">
                                                <td className="px-7 py-5 font-mono font-black text-[#621f32] sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]">{c.concepto}</td>
                                                <td className="px-7 py-5"><EditableCell value={c.descripcion} onSave={(v) => handleUpdateConcepto(c.concepto, 'descripcion', v)} className="font-semibold text-gray-600 uppercase text-[10px]" /></td>
                                                <td className="px-7 py-5 text-center"><EditableCell value={c.seccion} onSave={(v) => handleUpdateConcepto(c.concepto, 'seccion', v)} className="text-[9px] font-bold text-gray-400 uppercase justify-center" /></td>
                                                <td className="px-7 py-5 text-center"><EditableCell value={c.orden} type="number" onSave={(v) => handleUpdateConcepto(c.concepto, 'orden', parseInt(v))} className="font-black text-gray-400 justify-center" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* ── Constantes ── */}
                            {activeParamTab === 'constantes' && (
                                <table className="w-full text-[11px] text-left min-w-[600px]">
                                    <thead className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 shadow-sm">
                                        <tr>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-100 z-30">Clave</th>
                                            <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Descripción Operativa</th>
                                            <th className="px-7 py-4 text-[9px] font-black text-[#621f32] uppercase tracking-widest text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredParams.map((c) => (
                                            <tr key={c.clave} className="hover:bg-gray-50/50 group">
                                                <td className="px-7 py-5 font-mono font-black text-[#621f32] sticky left-0 bg-white group-hover:bg-gray-50/50 z-10">{c.clave}</td>
                                                <td className="px-7 py-5"><EditableCell value={c.descripcion || ''} onSave={(v) => handleUpdateConstante(c.clave, { descripcion: v })} className="text-gray-400 font-medium uppercase tracking-tight text-[10px] max-w-[380px]" /></td>
                                                <td className="px-7 py-5 text-right">
                                                    <EditableCell value={Number(c.valor)} type="number" onSave={(v) => handleUpdateConstante(c.clave, v)} className="font-black text-[#621f32] text-base justify-end" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Warning footer */}
                        <div className="flex items-center gap-3 px-6 py-3.5 bg-amber-50 border-t border-amber-100">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <p className="text-[9px] text-amber-800 font-semibold uppercase tracking-tight">
                                Precaución: Las modificaciones afectarán directamente todos los cálculos de valuación en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}