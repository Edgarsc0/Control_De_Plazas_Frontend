import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XCircle, Layers, FileText, CalendarDays, Landmark } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const fmt = (v) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);

const ORIGEN_LABEL = {
    eventuales_ocupadas: 'Eventuales Ocupadas',
    permanentes_ocupadas: 'Permanentes Ocupadas',
    manual: 'Selección Manual de Plazas',
};

/**
 * Muestra la valuación previamente guardada en un asunto: las dos tablas que
 * produce el simulador (Desglose Analítico por Nivel y Desglose por Concepto).
 *
 * @param {Object|null} valuacion - JSON almacenado en `AsuntoValuacion.valuacion`.
 * @param {Object} [oficioInfo] - Datos del oficio vinculado, para el encabezado.
 * @param {Function} onClose - Cierra el modal.
 */
export default function ValuacionGuardadaModal({ valuacion, oficioInfo = {}, onClose }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useBodyScrollLock(mounted && !!valuacion);

    if (!mounted || !valuacion) return null;

    // Se aceptan tanto el formato actual (`tablas.*`) como el crudo del
    // simulador (`tabla_2022` / `tabla_q322_t348`) por si quedó algún registro
    // guardado antes de esta pantalla.
    const porNivel = valuacion.tablas?.desglose_por_nivel || valuacion.tabla_2022 || [];
    const porConcepto = valuacion.tablas?.desglose_por_concepto || valuacion.tabla_q322_t348 || [];
    const totalesNivel = valuacion.totales?.por_nivel || {};
    const totalConcepto = valuacion.totales?.por_concepto || valuacion.total || {};

    const periodoLabel = valuacion.periodo?.label || `${valuacion.periodo?.meses ?? '—'} Meses`;
    const origen = ORIGEN_LABEL[valuacion.origen] || 'Selección Manual de Plazas';
    const guardadoEn = valuacion.guardado_en
        ? new Date(valuacion.guardado_en).toLocaleString('es-MX', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : '—';

    return createPortal(
        <div
            className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Encabezado ─────────────────────────────────────── */}
                <div
                    className="px-8 py-6 flex items-start justify-between gap-6 shrink-0"
                    style={{ background: 'linear-gradient(90deg, #3a1120 0%, #621f32 100%)' }}
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="bg-white/10 p-2.5 rounded-xl border border-white/20 shrink-0">
                            <Landmark className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-amber-400/80 text-[9px] font-black uppercase tracking-[0.25em]">
                                Valuación Presupuestaria Guardada
                            </p>
                            <h2 className="text-white font-black text-lg truncate">
                                {oficioInfo.asuntoNoOficio || valuacion.asunto?.no_oficio || 'Sin Oficio'}
                            </h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">
                                Folio {oficioInfo.asuntoFolio || valuacion.asunto?.folio || 'Sin Folio'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors shrink-0"
                        title="Cerrar"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                {/* ── Metadatos ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 border-b border-gray-200 shrink-0">
                    {[
                        ['Período Evaluado', periodoLabel],
                        ['Origen de la Información', origen],
                        ['Plazas Analizadas', String(totalesNivel.plazas ?? valuacion.plazas?.reduce((t, p) => t + (p.plazas || 0), 0) ?? '—')],
                        ['Guardada el', guardadoEn],
                    ].map(([label, value]) => (
                        <div key={label} className="bg-white px-5 py-4">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</p>
                            <p className="text-[11px] font-black text-[#621f32] mt-1 leading-snug">{value}</p>
                        </div>
                    ))}
                </div>

                {/* ── Cuerpo desplazable ─────────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    {/* Tabla 1 — Desglose Analítico por Nivel */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                            <div className="bg-[#621f32] p-1.5 rounded-lg">
                                <Layers className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-gray-800 font-black text-[11px] uppercase tracking-[0.2em]">
                                Desglose Analítico por Nivel
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[860px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Nivel</th>
                                        <th className="px-6 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Plazas</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Sueldo Base</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Sueldo Colectivo / Período</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Comp. Garantizada</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Comp. Gar. Colectiva / Período</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {porNivel.map((row, idx) => (
                                        <tr key={`${row.nivel}-${row.codigo}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <div className="font-black text-[#621f32] text-xs">{row.nivel}</div>
                                                <div className="text-[9px] text-gray-400 font-medium uppercase truncate max-w-[200px] mt-0.5">{row.puesto}</div>
                                            </td>
                                            <td className="px-6 py-3.5 text-center">
                                                <span className="inline-flex items-center justify-center bg-[#621f32]/8 text-[#621f32] border border-[#621f32]/15 font-black rounded-lg px-2.5 py-0.5 text-xs">
                                                    {row.plazas}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right text-[11px] text-gray-400 font-medium">{fmt(row.sueldo)}</td>
                                            <td className="px-6 py-3.5 text-right text-[11px] font-black text-[#621f32] bg-[#621f32]/[0.02]">{fmt(row.sueldo_colectivo_periodo)}</td>
                                            <td className="px-6 py-3.5 text-right text-[11px] text-gray-400 font-medium">{fmt(row.compensacion)}</td>
                                            <td className="px-6 py-3.5 text-right text-[11px] font-black text-[#621f32] bg-[#621f32]/[0.02]">{fmt(row.compensacion_colectiva_periodo)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-800 text-white">
                                        <td className="px-6 py-4 font-black text-xs uppercase tracking-wider">Total</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-white/10 text-amber-400 border border-white/10 font-black rounded-lg px-2.5 py-0.5 text-xs">
                                                {totalesNivel.plazas ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-[11px] font-mono font-semibold text-gray-400">{fmt(totalesNivel.sueldo)}</td>
                                        <td className="px-6 py-4 text-right font-mono font-black text-amber-300 text-sm bg-[#621f32]/40">{fmt(totalesNivel.sueldoPeriodo)}</td>
                                        <td className="px-6 py-4 text-right text-[11px] font-mono font-black text-amber-400">{fmt(totalesNivel.compensacion)}</td>
                                        <td className="px-6 py-4 text-right font-mono font-black text-amber-300 text-sm bg-[#621f32]/40">{fmt(totalesNivel.compensacionPeriodo)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tabla 2 — Desglose por Concepto */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                        <div
                            className="px-6 py-4 flex items-center justify-between gap-3"
                            style={{ background: 'linear-gradient(90deg, #3a1120 0%, #621f32 100%)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-1.5 rounded-lg">
                                    <FileText className="w-4 h-4 text-amber-400" />
                                </div>
                                <h3 className="text-white font-black text-[11px] uppercase tracking-[0.2em]">
                                    Desglose por Concepto
                                </h3>
                            </div>
                            <div className="flex items-center gap-1.5 bg-amber-400 text-[#621f32] text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                <CalendarDays className="w-3 h-3" />
                                {periodoLabel}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[860px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Partida</th>
                                        <th className="px-6 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Período Colectivo</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Complemento Colectivo</th>
                                        <th className="px-6 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Regularizable (12m)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {porConcepto.map((row) => (
                                        <tr key={row.concepto} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-6 py-3.5 font-mono font-black text-[#621f32] text-xs">{row.concepto}</td>
                                            <td className="px-6 py-3.5 text-[10px] font-semibold text-gray-500 uppercase tracking-tight max-w-[320px]">{row.descripcion}</td>
                                            <td className="px-6 py-3.5 text-right font-mono font-black text-[#621f32] text-[11px] bg-[#621f32]/[0.02]">{fmt(row.periodo)}</td>
                                            <td className="px-6 py-3.5 text-right font-mono font-semibold text-gray-400 text-[11px]">{fmt(row.complemento)}</td>
                                            <td className="px-6 py-3.5 text-right font-mono font-semibold text-gray-500 text-[11px]">{fmt(row.anual)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'linear-gradient(90deg, #3a1120, #621f32)' }}>
                                        <td colSpan={2} className="px-6 py-5 text-right text-[10px] font-black text-white/70 uppercase tracking-widest">
                                            Total Valuación Presupuestal
                                        </td>
                                        <td className="px-6 py-5 text-right font-mono font-black text-amber-400 text-base">{fmt(totalConcepto.periodo)}</td>
                                        <td className="px-6 py-5 text-right font-mono font-black text-amber-400 text-base">{fmt(totalConcepto.complemento)}</td>
                                        <td className="px-6 py-5 text-right font-mono font-black text-amber-400 text-base">{fmt(totalConcepto.anual)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
