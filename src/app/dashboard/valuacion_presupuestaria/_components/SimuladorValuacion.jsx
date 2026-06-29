import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PresupuestoService } from '@/services/presupuesto.service';
import { ControlGestionService } from '@/services/control_gestion.service';
import {
    Calculator, ChevronUp, ChevronDown, CheckCircle2, XCircle, Info,
    Landmark, FileText, ClipboardList, CalendarDays, Layers, TrendingUp,
    Download, Table as TableIcon, Search, User, File, Paperclip, Loader2
} from 'lucide-react';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── CURRENCY FORMAT ──────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
const FormulaTooltip = ({ formula, children }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
        }
    };

    if (!mounted) return children;

    return (
        <div
            ref={triggerRef}
            className="cursor-help inline-block w-full"
            onMouseEnter={() => { updateCoords(); setVisible(true); }}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && createPortal(
                <div
                    className="fixed z-[9999] -translate-x-1/2 -translate-y-full pointer-events-none"
                    style={{ top: coords.top - 14, left: coords.left }}
                >
                    <div className="w-max max-w-[300px] rounded-xl overflow-hidden shadow-2xl border border-[#621f32]/20">
                        <div className="bg-[#4e1828] px-4 py-2 flex items-center gap-2">
                            <Info className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="text-[9px] font-bold text-amber-200 uppercase tracking-[0.15em]">
                                Detalle de Cálculo
                            </span>
                        </div>
                        <div className="bg-white px-4 py-3">
                            <code className="text-[#621f32] font-mono font-semibold text-[11px] leading-relaxed block break-words">
                                {formula}
                            </code>
                        </div>
                    </div>
                    {/* Arrow */}
                    <div className="flex justify-center">
                        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-white" />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── SECTION BADGE ────────────────────────────────────────────────────────────
const StepBadge = ({ n, label, icon: Icon }) => (
    <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#621f32] flex items-center justify-center shadow-md shadow-[#621f32]/30">
            <span className="text-[10px] font-black text-amber-300">{n}</span>
        </div>
        <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#621f32]" />
            <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">{label}</span>
        </div>
    </div>
);

export default function SimuladorValuacion({ catalogo, searchTerm, setSearchTerm, selectedAsunto = null, onCloseAsunto }) {
    const getRemainingMonths = () => { const now = new Date(); return 12 - now.getMonth(); };
    const [meses, setMeses] = useState(getRemainingMonths());
    const [plazasInput, setPlazasInput] = useState({});
    const [calculating, setCalculating] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [eventualesData, setEventualesData] = useState(null);
    const [loadingEventuales, setLoadingEventuales] = useState(false);
    const [permanentesData, setPermanentesData] = useState(null);
    const [loadingPermanentes, setLoadingPermanentes] = useState(false);

    // Document loading states for split pane layout
    const [expedienteData, setExpedienteData] = useState(null);
    const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [currentDocPath, setCurrentDocPath] = useState(null);

    useEffect(() => {
        if (!selectedAsunto?.oficioInfo?.idAsunto) {
            setExpedienteData(null);
            if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            setCurrentDocPath(null);
            return;
        }

        const loadExpediente = async () => {
            setIsLoadingExpediente(true);
            setExpedienteData(null);
            if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            setCurrentDocPath(null);

            const idAsunto = selectedAsunto.oficioInfo.idAsunto;
            try {
                const data = await ControlGestionService.getExpedienteAsunto(idAsunto);
                if (data.status === 200) {
                    setExpedienteData(data);
                    const firstDoc =
                        data.model?.documentos?.[0] ||
                        data.model?.respuestas?.[0] ||
                        data.model?.anexos?.[0];
                    if (firstDoc) {
                        const docPath = firstDoc.ruta || firstDoc.nombre;
                        setCurrentDocPath(docPath);
                        const blob = await ControlGestionService.getVisualizarDocumento(idAsunto, docPath);
                        const url = window.URL.createObjectURL(blob);
                        setPdfUrl(url);
                    }
                }
            } catch (error) {
                console.error('Error al cargar expediente en simulación:', error);
            } finally {
                setIsLoadingExpediente(false);
            }
        };

        loadExpediente();

        return () => {
            if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
        };
    }, [selectedAsunto]);

    const handleSwitchPreviewDocument = async (relativePath) => {
        const idAsunto = selectedAsunto?.oficioInfo?.idAsunto;
        if (!idAsunto) return;

        setIsLoadingExpediente(true);
        try {
            if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
            setCurrentDocPath(relativePath);

            const blob = await ControlGestionService.getVisualizarDocumento(idAsunto, relativePath);
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (error) {
            console.error('Error al previsualizar documento adicional:', error);
        } finally {
            setIsLoadingExpediente(false);
        }
    };

    const handleCargarEventuales = async () => {
        setLoadingEventuales(true);
        try {
            const res = await PresupuestoService.getEventualesOcupadas();
            if (res.ok) {
                const data = await res.json();
                const map = {};
                const newInput = {};
                data.forEach(({ nivel, cantidad }) => {
                    map[nivel] = cantidad;
                    newInput[nivel] = cantidad;
                });
                setEventualesData(map);
                setPermanentesData(null);
                setPlazasInput(newInput);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingEventuales(false); }
    };

    const handleCargarPermanentes = async () => {
        setLoadingPermanentes(true);
        try {
            const res = await PresupuestoService.getPermanentesOcupadas();
            if (res.ok) {
                const data = await res.json();
                const map = {};
                const newInput = {};
                data.forEach(({ nivel, cantidad }) => {
                    map[nivel] = cantidad;
                    newInput[nivel] = cantidad;
                });
                setPermanentesData(map);
                setEventualesData(null);
                setPlazasInput(newInput);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingPermanentes(false); }
    };

    const filteredCatalogo = useMemo(() => {
        if (!searchTerm) return catalogo;
        const t = searchTerm.toLowerCase();
        return catalogo.filter(i => i.nivel.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t) || i.denominacion.toLowerCase().includes(t));
    }, [catalogo, searchTerm]);

    const selectedPlazas = useMemo(() => {
        return Object.entries(plazasInput).filter(([, q]) => q > 0).map(([nivel, qty]) => {
            const plaza = catalogo.find(p => p.nivel === nivel);
            return { nivel, qty, denominacion: plaza?.denominacion || '', codigo: plaza?.codigo || '' };
        });
    }, [plazasInput, catalogo]);

    const handlePlazaChange = (nivel, value) => {
        const qty = parseInt(value) || 0;
        setPlazasInput(prev => { const n = { ...prev }; if (qty <= 0) delete n[nivel]; else n[nivel] = qty; return n; });
    };

    const adjustPlaza = (nivel, delta) => {
        handlePlazaChange(nivel, Math.max(0, (plazasInput[nivel] || 0) + delta));
    };

    const handleCalcular = async () => {
        const plazas = selectedPlazas.map(p => ({ nivel: p.nivel, plazas: p.qty }));
        if (!plazas.length) return;
        setCalculating(true);
        try {
            const res = await PresupuestoService.calcularValuacion(meses, plazas);
            if (res.ok) {
                setResultado(await res.json());
                setTimeout(() => document.getElementById('resultados-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        } catch (e) { console.error(e); }
        finally { setCalculating(false); }
    };

    const conceptFormulas = {
        '12201': 'Σ(Sueldo Base × Plazas) × Meses',
        '13201': '(Σ Grupo Vac. 1 + Σ Grupo Vac. 2 + (Σ Grupo Vac. 2 × 15%)) / 3 × (Meses / 12)',
        '13202': '((Σ Grupo Grat. 1 / 30 × 40 × 1.35) + (Σ Grupo Grat. 2 / 30 × 40 × 1.17)) × (Meses / 12)',
        '14101': 'Σ(Cuota ISSSTE precalculada × Plazas) × Meses',
        '14201': 'Σ(Cuota FOVISSSTE precalculada × Plazas) × Meses',
        '14401': '(Masa Sueldos + Masa Comp. Garantizada) × 1.4%',
        '14403': 'Σ(Gastos Médicos × Plazas) × Meses',
        '14405': '35.45 × Total Plazas × Meses',
        '14301': '(Masa Sueldos + Masa Apoyo Cap.) × Meses × 2%',
        '14105': 'Σ(Cuota Cesantía precalculada × Plazas) × Meses',
        '15402': 'Σ(Compensación Garantizada × Plazas) × Meses',
        '15403': 'Σ(Asignaciones Adicionales × Plazas) × Meses',
        '15901': 'Σ(EPR Quincenal × Plazas) × Meses',
    };

    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const now = new Date().toLocaleDateString('es-MX');

        const modoLabel = eventualesData ? 'EVENTUALES OCUPADAS' : permanentesData ? 'PERMANENTES OCUPADAS' : null;
        const headerHeight = modoLabel ? 48 : 40;

        doc.setFillColor(98, 31, 50);
        doc.rect(0, 0, 210, headerHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.text('REPORTE DE VALUACIÓN PRESUPUESTARIA', 15, 20);
        doc.setFontSize(10);
        doc.text(`FUMP 2025 · SISTEMA DE CONTROL DE PLAZAS · ${now}`, 15, 28);
        doc.text(`Período de Evaluación: ${meses} ${meses === 1 ? 'Mes' : 'Meses'}`, 15, 34);
        if (modoLabel) {
            doc.setFillColor(188, 149, 92);
            doc.roundedRect(15, 38, 60, 7, 1, 1, 'F');
            doc.setTextColor(98, 31, 50);
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.text(modoLabel, 17, 43.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(255, 255, 255);
        }

        const conceptosStartY = headerHeight + 10;
        doc.setTextColor(98, 31, 50);
        doc.setFontSize(12);
        doc.text('DESGLOSE POR CONCEPTO', 15, conceptosStartY);

        autoTable(doc, {
            startY: conceptosStartY + 5,
            head: [['PARTIDA', 'CONCEPTO', `PERÍODO (${meses}m)`, 'ANUAL (12m)', 'COMPLEMENTO']],
            body: [
                ...resultado.tabla_q322_t348.map(r => [
                    r.concepto,
                    r.descripcion,
                    fmt(r.periodo),
                    fmt(r.anual),
                    fmt(r.complemento)
                ]),
                [{ content: 'TOTAL VALUACIÓN', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: fmt(resultado.total.periodo), styles: { fontStyle: 'bold' } },
                { content: fmt(resultado.total.anual), styles: { fontStyle: 'bold' } },
                { content: fmt(resultado.total.complemento), styles: { fontStyle: 'bold' } }]
            ],
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [98, 31, 50], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
        });

        const finalY = doc.lastAutoTable.finalY || 150;
        doc.setTextColor(98, 31, 50);
        doc.setFontSize(12);
        doc.text('DESGLOSE ANALÍTICO POR NIVEL', 15, finalY + 15);

        const totSueldo        = resultado.tabla_2022.reduce((t, r) => t + r.sueldo, 0);
        const totSueldoPer     = resultado.tabla_2022.reduce((t, r) => t + r.sueldo_colectivo_periodo, 0);
        const totComp          = resultado.tabla_2022.reduce((t, r) => t + r.compensacion, 0);
        const totCompPer       = resultado.tabla_2022.reduce((t, r) => t + r.compensacion_colectiva_periodo, 0);
        const totTotal         = resultado.tabla_2022.reduce((t, r) => t + r.sueldo_colectivo_periodo + r.compensacion_colectiva_periodo + r.compensacion, 0);
        const totPlazas        = selectedPlazas.reduce((t, p) => t + p.qty, 0);

        autoTable(doc, {
            startY: finalY + 20,
            head: [['NIVEL', 'PLAZAS', 'SUELDO BASE', 'SUELDO PER.', 'COMP. GAR.', 'COMP. GAR. PER.', 'TOTAL']],
            body: [
                ...resultado.tabla_2022.map(r => [
                    r.nivel,
                    r.plazas,
                    fmt(r.sueldo),
                    fmt(r.sueldo_colectivo_periodo),
                    fmt(r.compensacion),
                    fmt(r.compensacion_colectiva_periodo),
                    fmt(r.sueldo_colectivo_periodo + r.compensacion_colectiva_periodo + r.compensacion)
                ]),
                [
                    { content: 'TOTAL', styles: { fontStyle: 'bold' } },
                    { content: totPlazas, styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldo), styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldoPer), styles: { fontStyle: 'bold' } },
                    { content: fmt(totComp), styles: { fontStyle: 'bold' } },
                    { content: fmt(totCompPer), styles: { fontStyle: 'bold' } },
                    { content: fmt(totTotal), styles: { fontStyle: 'bold' } },
                ],
                [
                    { content: 'QUINCENA', styles: { fontStyle: 'bold' } },
                    { content: totPlazas, styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldo / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldoPer / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totComp / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totCompPer / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totTotal / meses / 2), styles: { fontStyle: 'bold' } },
                ],
            ],
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [78, 24, 40], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            didParseCell: (data) => {
                const totalRowIdx = resultado.tabla_2022.length;
                const quincenaRowIdx = totalRowIdx + 1;
                if (data.row.index === totalRowIdx) {
                    data.cell.styles.fillColor = [40, 40, 40];
                    data.cell.styles.textColor = [255, 255, 255];
                }
                if (data.row.index === quincenaRowIdx) {
                    data.cell.styles.fillColor = [26, 74, 122];
                    data.cell.styles.textColor = [255, 255, 255];
                }
            },
        });

        doc.save(`Valuacion_Presupuestaria_${new Date().getTime()}.pdf`);
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const ws1Data = [
            ['REPORTE DE VALUACIÓN PRESUPUESTARIA'],
            [`Período de Evaluación: ${meses} ${meses === 1 ? 'Mes' : 'Meses'}`],
            [''],
            ['PARTIDA', 'CONCEPTO', `PERÍODO (${meses}m)`, 'ANUAL (12m)', 'COMPLEMENTO'],
            ...resultado.tabla_q322_t348.map(r => [
                r.concepto,
                r.descripcion,
                r.periodo,
                r.anual,
                r.complemento
            ]),
            ['TOTAL', '', resultado.total.periodo, resultado.total.anual, resultado.total.complemento]
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen por Concepto');

        const ws2Data = [
            ['DESGLOSE ANALÍTICO POR NIVEL'],
            [''],
            ['NIVEL', 'PLAZAS', 'SUELDO BASE', 'SUELDO PERÍODO', 'COMP. GAR.', 'COMP. GAR. PERÍODO', 'TOTAL NIVEL'],
            ...resultado.tabla_2022.map(r => [
                r.nivel,
                r.plazas,
                r.sueldo,
                r.sueldo_colectivo_periodo,
                r.compensacion,
                r.compensacion_colectiva_periodo,
                r.sueldo_colectivo_periodo + r.compensacion_colectiva_periodo + r.compensacion
            ])
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
        XLSX.utils.book_append_sheet(wb, ws2, 'Desglose Analítico');

        XLSX.writeFile(wb, `Valuacion_Presupuestaria_${new Date().getTime()}.xlsx`);
    };

    const renderSimulatorContent = () => {
        return (
        <div className="space-y-7 animate-in fade-in duration-400">
            {/* ── HERO HEADER ─────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl shadow-lg border border-[#621f32]/10"
                style={{ background: 'linear-gradient(135deg, #621f32 0%, #4e1828 60%, #3a1120 100%)' }}>
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
                <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-5"
                    style={{ background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

                <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 p-7 md:p-10">
                    <div className="flex items-center gap-5">
                        <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                            <Landmark className="w-9 h-9 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-amber-400/80 text-[9px] font-bold uppercase tracking-[0.3em] mb-1">
                                FUMP 2025 — Sistema de Control de Plazas
                            </p>
                            <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight leading-none">
                                Valuación Presupuestaria
                            </h1>
                            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-1.5">
                                Evalua el volumen de plazas y calcula su valuación presupuestaria
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full lg:w-auto shrink-0">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-amber-400/70" />
                            <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
                                Período de Evaluación
                            </span>
                        </div>
                        <div className="flex gap-1 bg-black/20 p-1.5 rounded-xl border border-white/10 overflow-x-auto">
                            {MONTHS_SHORT.map((m, i) => (
                                <button
                                    key={i}
                                    onClick={() => setMeses(i + 1)}
                                    title={`${i + 1} mes${i > 0 ? 'es' : ''}`}
                                    className={`flex flex-col items-center justify-center min-w-[36px] h-10 rounded-lg text-[8px] font-black uppercase tracking-wide transition-all duration-150
                                        ${meses === i + 1
                                            ? 'bg-amber-400 text-[#621f32] shadow-md shadow-amber-400/30 scale-110'
                                            : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                                >
                                    <span className={`text-sm mt-0.5 ${meses === i + 1 ? 'text-[#621f32]' : 'text-white/20'}`}>{i + 1}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STEP 1 + 2: Two-column layout ─────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Column 1 — Catalogue */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col h-[580px]">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <StepBadge n="1" label="Selección de Niveles" icon={ClipboardList} />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCargarEventuales}
                                    disabled={loadingEventuales || loadingPermanentes}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                                               border disabled:opacity-50 disabled:cursor-not-allowed
                                               ${eventualesData
                                                   ? 'border-[#621f32] text-white bg-[#621f32]'
                                                   : 'border-[#621f32]/30 text-[#621f32] bg-[#621f32]/5 hover:bg-[#621f32]/10'}`}
                                >
                                    {loadingEventuales
                                        ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Cargando...</>
                                        : <><User className="w-3 h-3" /> Eventuales Ocupadas</>
                                    }
                                </button>
                                <button
                                    onClick={handleCargarPermanentes}
                                    disabled={loadingPermanentes || loadingEventuales}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                                               border disabled:opacity-50 disabled:cursor-not-allowed
                                               ${permanentesData
                                                   ? 'border-[#1a4a7a] text-white bg-[#1a4a7a]'
                                                   : 'border-[#1a4a7a]/30 text-[#1a4a7a] bg-[#1a4a7a]/5 hover:bg-[#1a4a7a]/10'}`}
                                >
                                    {loadingPermanentes
                                        ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Cargando...</>
                                        : <><User className="w-3 h-3" /> Permanentes Ocupadas</>
                                    }
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Filtrar por nivel o puesto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl
                                           text-xs text-gray-600 placeholder-gray-300 font-medium
                                           focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Nivel / Puesto</th>
                                    <th className="px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Plazas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-[11px]">
                                {filteredCatalogo.map((item) => (
                                    <tr key={item.id} className="hover:bg-[#621f32]/[0.02] transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[#621f32] text-xs">{item.nivel}</span>
                                                {eventualesData?.[item.nivel] != null && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#621f32]/8 text-[#621f32] border border-[#621f32]/15">
                                                        {eventualesData[item.nivel]} ocp.
                                                    </span>
                                                )}
                                                {permanentesData?.[item.nivel] != null && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#1a4a7a]/8 text-[#1a4a7a] border border-[#1a4a7a]/15">
                                                        {permanentesData[item.nivel]} ocp.
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-medium uppercase truncate max-w-[160px] mt-0.5">{item.denominacion}</div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => adjustPlaza(item.nivel, -1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-all">
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={plazasInput[item.nivel] || ''}
                                                    onChange={(e) => handlePlazaChange(item.nivel, e.target.value)}
                                                    placeholder="0"
                                                    className="w-12 h-8 bg-gray-50 border border-gray-200 rounded-lg text-center font-black text-[#621f32] text-sm focus:outline-none focus:border-[#621f32]/50 focus:bg-white transition-all"
                                                />
                                                <button onClick={() => adjustPlaza(item.nivel, 1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-all">
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Column 2 — Active selection */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden flex flex-col h-[580px]">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <StepBadge n="2" label="Selección Activa" icon={CheckCircle2} />
                        {selectedPlazas.length > 0 && (
                            <button onClick={() => setPlazasInput({})}
                                className="flex items-center gap-1.5 text-[9px] font-black text-red-400 hover:text-red-600 uppercase tracking-wider transition-colors">
                                <XCircle className="w-3 h-3" /> Limpiar
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-5">
                        {selectedPlazas.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                                    <Layers className="w-7 h-7 text-gray-200" />
                                </div>
                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Sin niveles seleccionados</p>
                                <p className="text-[9px] text-gray-200 mt-1 max-w-[200px]">Agrega plazas desde el catálogo de la izquierda</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {selectedPlazas.map((p) => (
                                    <div key={p.nivel}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100
                                                    hover:border-[#621f32]/20 hover:bg-[#621f32]/[0.02] transition-all group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[#621f32] text-sm">{p.nivel}</span>
                                                <span className="text-[9px] text-gray-300 font-mono">({p.codigo})</span>
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-medium uppercase truncate mt-0.5">{p.denominacion}</div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-3 shrink-0">
                                            <div className="bg-[#621f32] text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm shadow-[#621f32]/20">
                                                {p.qty} pl.
                                            </div>
                                            <button onClick={() => handlePlazaChange(p.nivel, 0)}
                                                className="text-gray-200 hover:text-red-400 transition-colors">
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                        <button
                            onClick={handleCalcular}
                            disabled={calculating || selectedPlazas.length === 0}
                            className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.25em]
                                       flex items-center justify-center gap-3 transition-all duration-200
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       bg-[#621f32] text-white
                                       shadow-lg shadow-[#621f32]/30
                                       hover:bg-[#4e1828] hover:shadow-xl hover:shadow-[#621f32]/40
                                       active:scale-[0.98]"
                        >
                            {calculating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-amber-400 rounded-full animate-spin" />
                                    Procesando valuación...
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-5 h-5 text-amber-400" />
                                    Calcular Valuación Presupuestaria
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── RESULTS ─────────────────────────────────────────── */}
            {resultado ? (
                <div id="resultados-section" className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">

                    {/* Divider with label */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
                        <div className="flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white
                                        shadow-lg shadow-[#621f32]/20"
                            style={{ background: 'linear-gradient(90deg, #621f32, #4e1828)' }}>
                            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                            Resultados de la Simulación
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />

                        {/* Export Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportToPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-[#621f32] hover:border-[#621f32]/30 transition-all shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5 text-red-600" />
                                PDF
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-green-700 hover:border-green-600/30 transition-all shadow-sm"
                            >
                                <TableIcon className="w-3.5 h-3.5 text-green-600" />
                                Excel
                            </button>
                        </div>
                    </div>

                    {/* Table 1 — Executive Summary */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
                        {/* Table header */}
                        <div className="flex items-center justify-between px-8 py-5"
                            style={{ background: 'linear-gradient(90deg, #3a1120 0%, #621f32 100%)' }}>
                            <div className="flex items-center gap-3.5">
                                <div className="bg-white/10 p-2 rounded-lg">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-sm uppercase tracking-widest">
                                        Desglose por Concepto
                                    </h2>
                                    <p className="text-white/40 text-[9px] font-medium uppercase tracking-widest mt-0.5">
                                        Resumen por
                                    </p>
                                </div>
                            </div>
                            <div className="bg-amber-400 text-[#621f32] text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                FUMP 2025 · {meses} {meses === 1 ? 'Mes' : 'Meses'}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-8 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest
                                                       sticky left-0 bg-gray-50 z-20 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                            Partida
                                        </th>
                                        <th className="px-8 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">
                                            Período Colectivo ({meses}m)
                                        </th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Regularizable (12m)</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Complemento Colectivo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {resultado.tabla_q322_t348.map((row) => (
                                        <tr key={row.concepto} className="hover:bg-gray-50/60 transition-colors group">
                                            {/* Partida — sticky */}
                                            <td className="px-8 py-4 sticky left-0 bg-white group-hover:bg-gray-50/60 z-10 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                                <FormulaTooltip formula="Código de concepto presupuestal">
                                                    <span className="font-mono font-black text-[#621f32] text-sm">{row.concepto}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 font-semibold text-gray-500 uppercase text-[10px] tracking-tight max-w-[280px]">
                                                <FormulaTooltip formula="Descripción oficial del concepto según FUMP">
                                                    {row.descripcion}
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right bg-[#621f32]/[0.02]">
                                                <FormulaTooltip formula={conceptFormulas[row.concepto] || 'Cálculo base'}>
                                                    <span className="font-mono font-black text-[#621f32]">{fmt(row.periodo)}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <FormulaTooltip formula={`${conceptFormulas[row.concepto] || 'Cálculo base'} (Proyección 12m)`}>
                                                    <span className="font-mono font-semibold text-gray-500">{fmt(row.anual)}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <FormulaTooltip formula="Diferencia entre el monto Anual y el monto del Período (T – R)">
                                                    <span className="font-mono font-semibold text-gray-400">{fmt(row.complemento)}</span>
                                                </FormulaTooltip>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Totals row */}
                                    <tr style={{ background: 'linear-gradient(90deg, #3a1120, #621f32)' }}>
                                        <td colSpan={2} className="px-8 py-6 text-right text-[10px] font-black text-white/70 uppercase tracking-widest">
                                            Total Valuación Presupuestal
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Totales del período seleccionado">
                                                <span className="font-mono font-black text-amber-400 text-lg">{fmt(resultado.total.periodo)}</span>
                                            </FormulaTooltip>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Proyección anual">
                                                <span className="font-mono font-black text-amber-400 text-lg">{fmt(resultado.total.anual)}</span>
                                            </FormulaTooltip>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Complementos">
                                                <span className="font-mono font-black text-amber-400 text-lg">{fmt(resultado.total.complemento)}</span>
                                            </FormulaTooltip>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2 — Analytic Breakdown */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-3.5">
                                <div className="bg-[#621f32] p-2 rounded-xl">
                                    <Layers className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-gray-800 font-black text-sm uppercase tracking-widest">
                                        Desglose Analítico por Nivel
                                    </h2>
                                    <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                                        Detalle individualizado por plaza seleccionada
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest shadow-sm">
                                Base PECEN
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left min-w-[1100px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest
                                                       sticky left-0 bg-gray-50 z-20 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                            Nivel
                                        </th>
                                        <th className="px-7 py-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Plazas</th>
                                        <th className="px-7 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-200">Sueldo Base</th>
                                        <th className="px-7 py-4 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Sueldo Colectivo / Período</th>
                                        <th className="px-7 py-4 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Comp. Garantizada</th>
                                        <th className="px-7 py-4 text-right text-[9px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Comp. Gar. Colectiva / Período</th>
                                        <th className="px-7 py-4 text-right text-[9px] font-black text-amber-700 uppercase tracking-widest bg-amber-50/40">Total Nivel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-semibold uppercase tracking-tight">
                                    {resultado.tabla_2022.map((row, idx) => {
                                        row.total_nivel = row.sueldo_colectivo_periodo + row.compensacion_colectiva_periodo + row.compensacion;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/60 transition-colors group">
                                                <td className="px-7 py-5 sticky left-0 bg-white group-hover:bg-gray-50/60 z-10 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                                    <FormulaTooltip formula={`Nivel: ${row.nivel} | Código: ${row.codigo}`}>
                                                        <div className="font-black text-[#621f32] text-xs">{row.nivel}</div>
                                                        <div className="text-[9px] text-gray-400 font-medium leading-tight mt-0.5 max-w-[180px]">{row.puesto}</div>
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-center">
                                                    <FormulaTooltip formula="Plazas asignadas para la simulación">
                                                        <span className="inline-flex items-center justify-center bg-[#621f32]/8 text-[#621f32] border border-[#621f32]/15 font-black rounded-lg px-3 py-1 text-xs">
                                                            {row.plazas}
                                                        </span>
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-right text-gray-400 font-medium border-r border-gray-100">
                                                    <FormulaTooltip formula="Monto mensual unitario según Tabulador PECEN">
                                                        {fmt(row.sueldo)}
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-right text-[#621f32] font-black bg-[#621f32]/[0.02]">
                                                    <FormulaTooltip formula="Sueldo Base × Plazas × Meses">
                                                        {fmt(row.sueldo_colectivo_periodo)}
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-right text-[#621f32] font-black bg-[#621f32]/[0.02]">
                                                    <FormulaTooltip formula="Compensación Garantizada unitaria">
                                                        {fmt(row.compensacion)}
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-right text-[#621f32] font-black bg-[#621f32]/[0.02]">
                                                    <FormulaTooltip formula="Comp. Garantizada × Plazas × Meses">
                                                        {fmt(row.compensacion_colectiva_periodo)}
                                                    </FormulaTooltip>
                                                </td>
                                                <td className="px-7 py-5 text-right text-amber-700 font-black bg-amber-50/30">
                                                    <FormulaTooltip formula="Sueldo Colectivo + Comp. Colectiva + Compensación">
                                                        {fmt(row.total_nivel)}
                                                    </FormulaTooltip>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Totals row */}
                                    <tr className="bg-gray-800 text-white">
                                        <td className="px-7 py-5 sticky left-0 bg-gray-800 z-10 font-black text-sm uppercase tracking-wider">TOTAL</td>
                                        <td className="px-7 py-5 text-center">
                                            <span className="bg-white/10 text-amber-400 border border-white/10 font-black rounded-lg px-3 py-1 text-xs">
                                                {selectedPlazas.reduce((t, p) => t + p.qty, 0)}
                                            </span>
                                        </td>
                                        <td className="px-7 py-5 text-right text-sm font-mono font-semibold text-gray-400 border-r border-gray-700">
                                            {fmt(resultado.tabla_2022.reduce((t, r) => t + r.sueldo, 0))}
                                        </td>
                                        <td className="px-7 py-5 text-right text-sm font-mono font-black text-amber-400">
                                            {fmt(resultado.tabla_2022.reduce((t, r) => t + r.sueldo_colectivo_periodo, 0))}
                                        </td>
                                        <td className="px-7 py-5 text-right text-sm font-mono font-black text-amber-400">
                                            {fmt(resultado.tabla_2022.reduce((t, r) => t + r.compensacion, 0))}
                                        </td>
                                        <td className="px-7 py-5 text-right text-sm font-mono font-black text-amber-400">
                                            {fmt(resultado.tabla_2022.reduce((t, r) => t + r.compensacion_colectiva_periodo, 0))}
                                        </td>
                                        <td className="px-7 py-5 text-right text-sm font-mono font-black text-amber-300 text-base bg-[#621f32]/30">
                                            {fmt(resultado.tabla_2022.reduce((t, r) => t + r.total_nivel, 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center text-center py-20 px-12 rounded-2xl border-2 border-dashed border-gray-200 bg-white/60">
                    <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-6">
                        <Calculator className="w-9 h-9 text-gray-200" />
                    </div>
                    <h3 className="text-base font-black text-gray-300 uppercase tracking-[0.3em]">Esperando Datos de Entrada</h3>
                    <p className="text-gray-300 text-[10px] font-medium uppercase tracking-widest leading-relaxed mt-3 max-w-xs">
                        Seleccione niveles y cantidades de plazas para generar el reporte de impacto fiscal.
                    </p>
                </div>
            )}
        </div>
        );
    };

    if (selectedAsunto) {
        return (
            <div className="flex flex-col xl:flex-row gap-8 items-start w-full animate-in fade-in duration-400">
                {/* Left Pane: Oficio Details and Document Viewer */}
                <div className="w-full xl:w-[48%] bg-white rounded-3xl border border-gray-200/80 p-7 flex flex-col h-[900px] sticky top-6 shadow-xl shrink-0">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#621f32] rounded-xl text-white shadow-md">
                                <FileText className="size-4 text-amber-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-[#bc955c] uppercase tracking-widest">Oficio Vinculado</span>
                                </div>
                                <h2 className="text-sm font-black text-gray-900 truncate max-w-[260px]">
                                    {selectedAsunto.oficioInfo?.asuntoFolio}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={onCloseAsunto}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            <XCircle className="size-3" /> Cerrar Asunto
                        </button>
                    </div>

                    {/* PDF / Document preview */}
                    <div className="flex-1 bg-gray-50 rounded-xl overflow-hidden relative border border-gray-100 my-4">
                        {isLoadingExpediente ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="size-6 text-[#621f32] animate-spin" />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cargando Documento...</span>
                            </div>
                        ) : pdfUrl ? (
                            <iframe
                                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-full border-none"
                                title="Visor de Documento de Simulación"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2 p-4 text-center">
                                <Info className="size-8 opacity-40" />
                                <span className="text-[10px] font-black uppercase tracking-wider">No se pudo cargar el documento</span>
                            </div>
                        )}
                    </div>

                    {/* Metadata and Description */}
                    <div className="h-[180px] overflow-y-auto pr-1 space-y-4 shrink-0 border-t border-gray-100 pt-4 custom-scrollbar">
                        <div>
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Número de Oficio</span>
                            <p className="text-xs font-bold text-gray-800">{selectedAsunto.oficioInfo?.asuntoNoOficio || 'No especificado'}</p>
                        </div>
                        <div>
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Remitente</span>
                            <p className="text-xs font-bold text-gray-800">{selectedAsunto.oficioInfo?.asuntoRemitente || 'No especificado'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{selectedAsunto.oficioInfo?.asuntoRemitenteCargo} - {selectedAsunto.oficioInfo?.asuntoRemitenteDependencia}</p>
                        </div>
                        <div>
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Descripción</span>
                            <p className="text-xs font-medium text-gray-600 leading-relaxed">{selectedAsunto.oficioInfo?.asuntoDescripcion || 'Sin descripción'}</p>
                        </div>

                        {/* List of files/documents of the expediente */}
                        {expedienteData?.model?.documentos?.length > 0 && (
                            <div className="pt-2">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Archivos del Expediente</span>
                                <div className="flex flex-col gap-1.5 mt-2">
                                    {expedienteData.model.documentos.map((doc, idx) => {
                                        const docPath = doc.ruta || doc.nombre;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSwitchPreviewDocument(docPath)}
                                                className={`text-left text-[10px] font-bold p-2.5 rounded-lg border transition-all truncate flex items-center gap-2
                                                    ${currentDocPath === docPath
                                                        ? 'bg-[#621f32]/5 text-[#621f32] border-[#621f32]/20'
                                                        : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                            >
                                                <FileText className="size-3 shrink-0" />
                                                {doc.nombre}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* List of responses of the expediente */}
                        {expedienteData?.model?.respuestas?.length > 0 && (
                            <div className="pt-2">
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Respuestas</span>
                                <div className="flex flex-col gap-1.5 mt-2">
                                    {expedienteData.model.respuestas.map((resp, idx) => {
                                        const docPath = resp.ruta || resp.nombre;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSwitchPreviewDocument(docPath)}
                                                className={`text-left text-[10px] font-bold p-2.5 rounded-lg border transition-all truncate flex items-center gap-2
                                                    ${currentDocPath === docPath
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                            >
                                                <FileText className="size-3 shrink-0 text-emerald-600" />
                                                {resp.nombre}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Simulator Component */}
                <div className="w-full xl:w-[52%]">
                    {renderSimulatorContent()}
                </div>
            </div>
        );
    }

    return renderSimulatorContent();
}
