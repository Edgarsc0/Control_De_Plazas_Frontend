import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PresupuestoService } from '@/services/presupuesto.service';
import { ControlGestionService } from '@/services/control_gestion.service';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { addExcelLetterhead } from '@/utils/excelLetterhead';
import {
    LETTERHEAD_LOGO_BASE64,
    LETTERHEAD_LOGO_WIDTH,
    LETTERHEAD_LOGO_HEIGHT,
} from '@/assets/letterhead-logo';
import {
    Calculator, ChevronUp, ChevronDown, CheckCircle2, XCircle, Info,
    Landmark, FileText, ClipboardList, CalendarDays, Layers, TrendingUp,
    Download, Table as TableIcon, Search, User, File, Paperclip, Loader2,
    Save, AlertCircle
} from 'lucide-react';

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

// ─── NIVEL DETALLE MODAL ────────────────────────────────────────────────────
const NivelDetalleModal = ({ nivel, detalle, onClose }) => {
    useBodyScrollLock(!!nivel);
    if (!nivel) return null;
    const info = detalle || {};
    const codigos = info.codigos || [];

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#621f32] px-6 py-4 flex items-center justify-between">
                    <div>
                        <p className="text-amber-300/80 text-[9px] font-black uppercase tracking-[0.2em]">Detalle de Ocupación</p>
                        <h3 className="text-white font-black text-lg">Nivel {nivel}</h3>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 pt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                        <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Plazas</div>
                        <div className="text-lg font-black text-gray-700">{info.total_plazas ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                        <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Ocupadas</div>
                        <div className="text-lg font-black text-emerald-700">{info.ocupadas ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-center">
                        <div className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Vacantes</div>
                        <div className="text-lg font-black text-amber-700">{info.vacantes ?? '—'}</div>
                    </div>
                </div>

                <p className="px-6 pt-4 pb-2 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                    Desglose por Código Presupuestal
                </p>
                <div className="px-6 pb-6 max-h-[320px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="text-left text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <th className="py-1.5 pr-2">Código Presupuestal</th>
                                <th className="py-1.5 px-2 text-center">Zona / Escala</th>
                                <th className="py-1.5 px-2 text-right">Cantidad</th>
                                <th className="py-1.5 pl-2 text-right">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {codigos.map((c, i) => (
                                <tr key={i}>
                                    <td className="py-2 pr-2 font-mono font-bold text-gray-700">{c.codigo_presupuestal}</td>
                                    <td className="py-2 px-2 text-center text-gray-400 font-medium">{c.zona ?? c.escala ?? '—'}</td>
                                    <td className="py-2 px-2 text-right font-black text-[#621f32]">{c.cantidad}</td>
                                    <td className="py-2 pl-2 text-right">
                                        {c.matched ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[9px]">
                                                <CheckCircle2 className="w-3 h-3" /> Coincide
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-red-500 font-black text-[9px]">
                                                <XCircle className="w-3 h-3" /> Sin match
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>,
        document.body
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

// Fecha de hoy en 'YYYY-MM-DD', para el default de `fechaInicio` y como base
// del "31 de diciembre" default de `fechaFin`.
const hoyISO = () => new Date().toISOString().slice(0, 10);
const finDeAnioISO = (fechaISO) => `${(fechaISO || hoyISO()).slice(0, 4)}-12-31`;

// Un 'YYYY-MM-DD' se parsea a medianoche UTC — construir el timestamp con
// Date.UTC en vez de `new Date(iso)` evita que el huso horario del
// navegador recorra la fecha un día (mismo criterio que `aFechaExcel` en el
// Anexo 2 de Anuencia).
const parseFechaISOaUTC = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
};

const DIA_MS = 24 * 60 * 60 * 1000;

const partesFecha = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return { anio: y, mes: m, dia: d };
};

/** ¿`iso` es el último día real de su mes calendario (28/29/30/31 según corresponda)? */
const esUltimoDiaDelMes = (iso) => {
    const { anio, mes, dia } = partesFecha(iso);
    const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));
    return siguiente.getUTCMonth() !== mes - 1;
};

/**
 * Día dentro de un mes VIRTUAL de 30 días (no del mes calendario real) — el
 * mismo criterio que usa el formato oficial del Anexo 3: el último día real
 * de cualquier mes (28, 29, 30 o 31) siempre representa el día 30 del mes
 * virtual, y cualquier otro día se usa tal cual, topado en 30.
 */
const diaVirtual = (iso) => {
    const { dia } = partesFecha(iso);
    return esUltimoDiaDelMes(iso) ? 30 : Math.min(dia, 30);
};

/**
 * Meses de evaluación entre dos fechas, en la convención de "meses de 30
 * días" del Anexo 3 oficial — NO son días de calendario reales entre 30: un
 * mes completo siempre vale 1.0 exacto sin importar si el mes calendario
 * tiene 28, 30 o 31 días, y los meses de arranque/cierre se prorratean
 * contra ese mes virtual de 30 días. Por eso empezar el día 16 de CUALQUIER
 * mes vale siempre exactamente 0.5 (la segunda quincena completa), igual
 * que empezar el 1° vale siempre 1.0 completo, sin importar el mes.
 *
 * Verificado contra un Anexo 3 oficial real (Excel de referencia UDPCSG):
 * 16 feb – 31 dic 2026 → 10.5 meses exactos (no 319 días / 30 = 10.63, que
 * era el cálculo — incorrecto — de la versión anterior de esta función).
 *
 * El resultado se redondea a 4 decimales (p. ej. 6.0333, no
 * 6.033333333333333) — es el número que viaja tal cual a
 * `PresupuestoService.calcularValuacion` y se multiplica ahí contra sueldos
 * y compensaciones, así que la precisión se fija AQUÍ, en el origen, y no en
 * el texto que se muestra después (`formatMeses`); si no, el monto que
 * arrastra el float de 15+ decimales y el texto que el usuario lee
 * divergirían. Espejo exacto en el backend: `calcular_meses_periodo` en
 * `presupuesto/valuacion.py` — si se toca una, hay que tocar la otra.
 */
const redondear4 = (n) => Math.round(n * 10000) / 10000;

const calcularMeses = (fechaInicioISO, fechaFinISO) => {
    const ini = partesFecha(fechaInicioISO);
    const fin = partesFecha(fechaFinISO);
    const diaVirtualIni = diaVirtual(fechaInicioISO);
    const diaVirtualFin = diaVirtual(fechaFinISO);

    if (ini.anio === fin.anio && ini.mes === fin.mes) {
        // Mismo mes calendario: un único tramo dentro del mismo mes virtual.
        return redondear4(Math.max(0, diaVirtualFin - diaVirtualIni + 1) / 30);
    }

    const fraccionInicio = (31 - diaVirtualIni) / 30; // días virtuales que quedan del mes de arranque
    const fraccionFin = diaVirtualFin / 30;             // días virtuales transcurridos del mes de cierre
    const mesesCompletosEntre = Math.max(0, (fin.anio * 12 + fin.mes) - (ini.anio * 12 + ini.mes) - 1);

    return redondear4(fraccionInicio + mesesCompletosEntre + fraccionFin);
};

// Muestra los mismos 4 decimales con los que ya se redondeó `calcularMeses`
// (nunca menos: mostrar "6.03" para un valor que en realidad vale y se
// calculó como 6.0333 fue justo la confusión que llevó a fijar esta
// precisión) y quita ceros sobrantes (12 en vez de "12.0000", 10.5 en vez de
// "10.5000").
const formatMeses = (n) => {
    const r = redondear4(n);
    return Number.isInteger(r) ? String(r) : String(r.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '');
};

// `timeZone: 'UTC'` es obligatorio aquí: el timestamp que se formatea ya es
// medianoche UTC (ver parseFechaISOaUTC), así que formatear en el huso LOCAL
// del navegador recorrería la fecha un día en cualquier huso con offset
// negativo (América).
const MESES_FMT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatFechaCorta = (iso) => (iso ? MESES_FMT.format(new Date(parseFechaISOaUTC(iso))) : '—');

export default function SimuladorValuacion({ catalogo, searchTerm, setSearchTerm, selectedAsunto = null, onCloseAsunto, onValuacionGuardada }) {
    // El período de evaluación ya NO es "N meses + ½ quincena" (eso obligaba a
    // empezar siempre en un 1° o un 16 de mes): ahora es un rango de fechas
    // libre — el usuario puede arrancar cualquier día (5, 14, 15, 26...) y el
    // costo se prorratea por DÍAS, no por meses calendario. Por default llega
    // hasta el 31 de diciembre del año en curso, como se pidió explícitamente.
    const [fechaInicio, setFechaInicio] = useState(hoyISO);
    const [fechaFin, setFechaFin] = useState(() => finDeAnioISO(hoyISO()));

    // Días de calendario entre ambas fechas (informativo, sólo para el texto
    // del período) — el monto en sí NO se calcula con esto, se calcula con
    // `calcularMeses`, que usa la convención de "meses de 30 días" del Anexo
    // 3 oficial (ver su docstring más arriba).
    const dias = Math.round((parseFechaISOaUTC(fechaFin) - parseFechaISOaUTC(fechaInicio)) / DIA_MS) + 1;
    const periodoValido = Boolean(fechaInicio) && Boolean(fechaFin) && dias > 0;
    const meses = periodoValido ? calcularMeses(fechaInicio, fechaFin) : 0;
    const mesesFmt = formatMeses(meses);
    const periodoLabel = periodoValido
        ? `${formatFechaCorta(fechaInicio)} – ${formatFechaCorta(fechaFin)} · ${dias} ${dias === 1 ? 'día' : 'días'} (${mesesFmt} ${meses === 1 ? 'mes' : 'meses'})`
        : 'La fecha final debe ser posterior a la inicial';
    const [plazasInput, setPlazasInput] = useState({});
    const [calculating, setCalculating] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [eventualesData, setEventualesData] = useState(null);
    const [loadingEventuales, setLoadingEventuales] = useState(false);
    const [permanentesData, setPermanentesData] = useState(null);
    const [loadingPermanentes, setLoadingPermanentes] = useState(false);
    const [eventualesSinMatch, setEventualesSinMatch] = useState([]);
    const [permanentesSinMatch, setPermanentesSinMatch] = useState([]);
    const [detalleNiveles, setDetalleNiveles] = useState({});
    const [nivelDetalleAbierto, setNivelDetalleAbierto] = useState(null);

    // Document loading states for split pane layout
    const [expedienteData, setExpedienteData] = useState(null);
    const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [currentDocPath, setCurrentDocPath] = useState(null);

    // Guardado de la valuación en el asunto vinculado
    const [savingValuacion, setSavingValuacion] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState(null);
    const [guardadoEn, setGuardadoEn] = useState(selectedAsunto?.valuacion?.guardado_en || null);

    // Identificadores estables: guardar la valuación reemplaza el objeto
    // `selectedAsunto`, y sin estas claves los efectos de abajo volverían a
    // descargar el expediente y a limpiar el aviso de guardado.
    const idAsuntoValuacion = selectedAsunto?.id ?? null;
    const idAsuntoSCG = selectedAsunto?.oficioInfo?.idAsunto ?? null;

    useEffect(() => {
        setGuardadoEn(selectedAsunto?.valuacion?.guardado_en || null);
        setSaveFeedback(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idAsuntoValuacion]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idAsuntoSCG]);

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
                (data.plazas || []).forEach(({ catalogo_id, cantidad }) => {
                    map[catalogo_id] = (map[catalogo_id] || 0) + cantidad;
                    newInput[catalogo_id] = (newInput[catalogo_id] || 0) + cantidad;
                });
                setEventualesData(map);
                setPermanentesData(null);
                setPlazasInput(newInput);
                setEventualesSinMatch(data.sin_match || []);
                setDetalleNiveles(data.detalle_niveles || {});
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
                (data.plazas || []).forEach(({ catalogo_id, cantidad }) => {
                    map[catalogo_id] = (map[catalogo_id] || 0) + cantidad;
                    newInput[catalogo_id] = (newInput[catalogo_id] || 0) + cantidad;
                });
                setPermanentesData(map);
                setEventualesData(null);
                setPlazasInput(newInput);
                setPermanentesSinMatch(data.sin_match || []);
                setDetalleNiveles(data.detalle_niveles || {});
            }
        } catch (e) { console.error(e); }
        finally { setLoadingPermanentes(false); }
    };

    const filteredCatalogo = useMemo(() => {
        if (!searchTerm) return catalogo;
        const t = searchTerm.toLowerCase();
        return catalogo.filter(i => i.nivel.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t) || i.denominacion.toLowerCase().includes(t));
    }, [catalogo, searchTerm]);

    const sinMatchByNivel = useMemo(() => {
        const activeSinMatch = eventualesData ? eventualesSinMatch : permanentesData ? permanentesSinMatch : [];
        const map = {};
        activeSinMatch.forEach(({ nivel, cantidad }) => {
            const niv = (nivel || '').trim();
            map[niv] = (map[niv] || 0) + cantidad;
        });
        return map;
    }, [eventualesData, permanentesData, eventualesSinMatch, permanentesSinMatch]);

    const selectedPlazas = useMemo(() => {
        return Object.entries(plazasInput).filter(([, q]) => q > 0).map(([id, qty]) => {
            const plaza = catalogo.find(p => String(p.id) === id);
            return {
                id: plaza?.id ?? id, qty,
                nivel: plaza?.nivel || '', denominacion: plaza?.denominacion || '', codigo: plaza?.codigo || '',
                zona: plaza?.zona ?? plaza?.escala ?? null,
            };
        });
    }, [plazasInput, catalogo]);

    // Totales del desglose analítico por nivel. Se centralizan aquí para que la
    // vista, el PDF y el Excel muestren exactamente los mismos números.
    const totalesNivel = useMemo(() => {
        const rows = resultado?.tabla_2022 || [];
        return {
            plazas: Object.values(plazasInput).reduce((t, q) => t + (q > 0 ? q : 0), 0),
            sueldo: rows.reduce((t, r) => t + r.sueldo, 0),
            sueldoPeriodo: rows.reduce((t, r) => t + r.sueldo_colectivo_periodo, 0),
            compensacion: rows.reduce((t, r) => t + r.compensacion, 0),
            compensacionPeriodo: rows.reduce((t, r) => t + r.compensacion_colectiva_periodo, 0),
        };
    }, [resultado, plazasInput]);

    const handlePlazaChange = (id, value) => {
        const qty = parseInt(value) || 0;
        setPlazasInput(prev => { const n = { ...prev }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
    };

    const adjustPlaza = (id, delta) => {
        handlePlazaChange(id, Math.max(0, (plazasInput[id] || 0) + delta));
    };

    const handleCalcular = async () => {
        const plazas = selectedPlazas.map(p => ({ catalogo_id: p.id, plazas: p.qty }));
        if (!plazas.length || !periodoValido) return;
        setCalculating(true);
        setSaveFeedback(null);
        try {
            const res = await PresupuestoService.calcularValuacion(meses, plazas);
            if (res.ok) {
                setResultado(await res.json());
                setTimeout(() => document.getElementById('resultados-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        } catch (e) { console.error(e); }
        finally { setCalculating(false); }
    };

    // ─── GUARDADO DE LA VALUACIÓN EN EL ASUNTO ────────────────────────────────
    // Se persiste el mismo par de tablas que ve el usuario: `tabla_2022`
    // (Desglose Analítico por Nivel) y `tabla_q322_t348` (Desglose por
    // Concepto), más el contexto necesario para releerlas sin recalcular.
    const buildValuacionPayload = () => {
        if (!resultado) return null;
        return {
            version: 1,
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                dias,
                meses,
                label: periodoLabel,
            },
            origen: eventualesData
                ? 'eventuales_ocupadas'
                : permanentesData
                    ? 'permanentes_ocupadas'
                    : 'manual',
            asunto: {
                id_asunto: selectedAsunto?.oficioInfo?.idAsunto ?? null,
                folio: selectedAsunto?.oficioInfo?.asuntoFolio ?? null,
                no_oficio: selectedAsunto?.oficioInfo?.asuntoNoOficio ?? null,
                remitente: selectedAsunto?.oficioInfo?.asuntoRemitente ?? null,
            },
            plazas: selectedPlazas.map(p => ({
                catalogo_id: p.id,
                plazas: p.qty,
                nivel: p.nivel,
                codigo: p.codigo,
                denominacion: p.denominacion,
            })),
            tablas: {
                desglose_por_nivel: resultado.tabla_2022,
                desglose_por_concepto: resultado.tabla_q322_t348,
            },
            totales: {
                por_nivel: totalesNivel,
                por_concepto: resultado.total,
            },
        };
    };

    const handleGuardarValuacion = async () => {
        const payload = buildValuacionPayload();
        if (!payload || !selectedAsunto?.id) return;

        setSavingValuacion(true);
        setSaveFeedback(null);
        try {
            const actualizado = await CatTipoOficioService.guardarValuacion(selectedAsunto.id, payload);
            setGuardadoEn(actualizado?.valuacion?.guardado_en || new Date().toISOString());
            setSaveFeedback({ type: 'ok', msg: 'Valuación guardada correctamente' });
            onValuacionGuardada?.(actualizado);
        } catch (e) {
            console.error('Error al guardar la valuación:', e);
            setSaveFeedback({ type: 'error', msg: e.message || 'No se pudo guardar la valuación' });
        } finally {
            setSavingValuacion(false);
        }
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

    // ─── EXPORTACIÓN PDF INSTITUCIONAL ────────────────────────────────────────
    // Documento sobrio: membretado ANAM en todas las páginas, una sola tinta de
    // acento (guinda institucional) y jerarquía apoyada en tipografía, no en
    // rellenos de color.
    const PDF = {
        pageW: 210,
        pageH: 297,
        margin: 15,
        headerH: 32,
        footerH: 18,
        ink: [26, 26, 26],
        muted: [115, 115, 115],
        hair: [205, 205, 205],
        accent: [98, 31, 50],
        soft: [243, 243, 243],
    };

    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const { pageW, pageH, margin: M, headerH, ink, muted, hair, accent, soft } = PDF;
        const contentW = pageW - M * 2;
        const bottomLimit = pageH - PDF.footerH - 6;
        const now = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
        const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

        const modoLabel = eventualesData ? 'EVENTUALES OCUPADAS' : permanentesData ? 'PERMANENTES OCUPADAS' : null;
        const origenLabel = modoLabel || 'SELECCIÓN MANUAL DE PLAZAS';
        const origenDetalle = eventualesData
            ? 'Plazas eventuales ocupadas conforme a la nómina vigente, conciliadas contra el catálogo PECEN.'
            : permanentesData
                ? 'Plazas permanentes ocupadas conforme a la nómina vigente, conciliadas contra el catálogo PECEN.'
                : 'Plazas capturadas manualmente por el usuario en el simulador de valuación.';

        // ── Membrete y pie, una sola vez por página ──
        const stamped = new Set();
        const stampPage = () => {
            const page = doc.internal.getCurrentPageInfo().pageNumber;
            if (stamped.has(page)) return;
            stamped.add(page);

            const logoW = 58;
            const logoH = (logoW * LETTERHEAD_LOGO_HEIGHT) / LETTERHEAD_LOGO_WIDTH;
            doc.addImage(LETTERHEAD_LOGO_BASE64, 'PNG', M, 11, logoW, logoH);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...ink);
            doc.text('AGENCIA NACIONAL DE ADUANAS DE MÉXICO', pageW - M, 14.5, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...muted);
            doc.text('UNIDAD DE ADMINISTRACIÓN Y FINANZAS', pageW - M, 19, { align: 'right' });
            doc.text('DIRECCIÓN DE RECURSOS HUMANOS', pageW - M, 23, { align: 'right' });

            doc.setDrawColor(...accent);
            doc.setLineWidth(0.7);
            doc.line(M, 26.5, pageW - M, 26.5);
            doc.setDrawColor(...hair);
            doc.setLineWidth(0.2);
            doc.line(M, 27.6, pageW - M, 27.6);

            doc.setDrawColor(...hair);
            doc.setLineWidth(0.2);
            doc.line(M, pageH - 15, pageW - M, pageH - 15);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            doc.text(`FUMP 2025 · Sistema de Control de Plazas · Generado el ${now} a las ${hora} h`, M, pageH - 10.5);
            doc.text(`Página ${page} de {tp}`, pageW - M, pageH - 10.5, { align: 'right' });
        };

        stampPage();
        let y = headerH + 6;

        const ensureSpace = (h) => {
            if (y + h <= bottomLimit) return;
            doc.addPage();
            stampPage();
            y = headerH + 6;
        };

        // ── Título del documento ──
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...ink);
        doc.text('REPORTE DE VALUACIÓN PRESUPUESTARIA', pageW / 2, y, { align: 'center' });
        y += 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...muted);
        doc.text(`Período de evaluación: ${periodoLabel}`, pageW / 2, y, { align: 'center' });
        y += 9;

        // ── Origen de la información (eventuales / permanentes / manual) ──
        const origenH = 18;
        doc.setFillColor(...soft);
        doc.rect(M, y, contentW, origenH, 'F');
        doc.setFillColor(...accent);
        doc.rect(M, y, 2, origenH, 'F');
        doc.setDrawColor(...hair);
        doc.setLineWidth(0.2);
        doc.rect(M, y, contentW, origenH, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(...muted);
        doc.text('ORIGEN DE LA INFORMACIÓN', M + 6, y + 6);
        doc.setFontSize(13);
        doc.setTextColor(...accent);
        doc.text(origenLabel, M + 6, y + 13);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        const origenLineas = doc.splitTextToSize(origenDetalle, 78);
        origenLineas.slice(0, 3).forEach((linea, i) => {
            doc.text(linea, pageW - M - 5, y + 8 + i * 3.4, { align: 'right' });
        });
        y += origenH + 7;

        // ── Indicadores principales ──
        const totSueldo    = totalesNivel.sueldo;
        const totSueldoPer = totalesNivel.sueldoPeriodo;
        const totComp      = totalesNivel.compensacion;
        const totCompPer   = totalesNivel.compensacionPeriodo;
        const totPlazas    = totalesNivel.plazas;

        const kpis = [
            ['PERÍODO EVALUADO', periodoLabel],
            ['PLAZAS ANALIZADAS', String(totPlazas)],
            ['NIVELES INVOLUCRADOS', String(resultado.tabla_2022.length)],
        ];
        const kpiGap = 3;
        const kpiW = (contentW - kpiGap * (kpis.length - 1)) / kpis.length;
        const kpiH = 16;
        kpis.forEach(([label, value], i) => {
            const x = M + i * (kpiW + kpiGap);
            doc.setDrawColor(...hair);
            doc.setLineWidth(0.2);
            doc.rect(x, y, kpiW, kpiH, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.2);
            doc.setTextColor(...muted);
            doc.text(label, x + 3, y + 5);
            doc.setFontSize(10);
            doc.setTextColor(...ink);
            doc.text(value, x + 3, y + 12);
        });
        y += kpiH + 4;

        if (selectedAsunto?.oficioInfo) {
            const oficio = selectedAsunto.oficioInfo;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...muted);
            doc.text(
                `Oficio vinculado: ${oficio.asuntoNoOficio || 's/n'} · Folio ${oficio.asuntoFolio || 's/f'}` +
                (oficio.asuntoRemitente ? ` · Remitente: ${oficio.asuntoRemitente}` : ''),
                M, y + 3, { maxWidth: contentW }
            );
            y += 7;
        }
        y += 4;

        // ── Encabezado de sección ──
        // Reserva espacio para el título y las primeras filas de su tabla: evita
        // que un encabezado de sección quede huérfano al final de la página.
        const sectionTitle = (num, label) => {
            ensureSpace(34);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(...ink);
            doc.text(`${num}.  ${label}`, M, y);
            doc.setDrawColor(...accent);
            doc.setLineWidth(0.4);
            doc.line(M, y + 2, M + 22, y + 2);
            doc.setDrawColor(...hair);
            doc.setLineWidth(0.2);
            doc.line(M + 22, y + 2, pageW - M, y + 2);
            y += 7;
        };

        const baseTableOptions = {
            theme: 'grid',
            margin: { left: M, right: M, top: headerH + 6, bottom: PDF.footerH + 6 },
            styles: {
                font: 'helvetica',
                textColor: ink,
                lineColor: [222, 222, 222],
                lineWidth: 0.1,
                cellPadding: 2,
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: accent,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'center',
                valign: 'middle',
                lineWidth: 0,
            },
            didDrawPage: stampPage,
        };

        // ── I. Desglose por concepto ──
        sectionTitle('I', 'DESGLOSE POR CONCEPTO');

        autoTable(doc, {
            ...baseTableOptions,
            startY: y,
            head: [['PARTIDA', 'CONCEPTO', `PERÍODO (${mesesFmt} M)`, 'REGULARIZABLE (12 M)', 'COMPLEMENTO']],
            body: [
                ...resultado.tabla_q322_t348.map(r => [
                    r.concepto,
                    r.descripcion,
                    fmt(r.periodo),
                    fmt(r.anual),
                    fmt(r.complemento),
                ]),
                [
                    { content: 'TOTAL VALUACIÓN', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: fmt(resultado.total.periodo), styles: { fontStyle: 'bold' } },
                    { content: fmt(resultado.total.anual), styles: { fontStyle: 'bold' } },
                    { content: fmt(resultado.total.complemento), styles: { fontStyle: 'bold' } },
                ],
            ],
            styles: { ...baseTableOptions.styles, fontSize: 9, cellPadding: 2.2 },
            columnStyles: {
                0: { cellWidth: 18, fontStyle: 'bold', halign: 'center' },
                1: { cellWidth: 47 },
                2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
                3: { cellWidth: 37, halign: 'right' },
                4: { cellWidth: 38, halign: 'right' },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                if (data.row.index === resultado.tabla_q322_t348.length) {
                    data.cell.styles.fillColor = [232, 232, 232];
                    data.cell.styles.fontSize = 10;
                    data.cell.styles.lineWidth = { top: 0.5, right: 0, bottom: 0, left: 0 };
                    data.cell.styles.lineColor = accent;
                    // Los importes de la fila TOTAL nunca deben partirse en dos
                    // líneas: sin salto y con menos aire lateral.
                    data.cell.styles.overflow = 'visible';
                    data.cell.styles.cellPadding = { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 };
                } else if (data.column.index === 2) {
                    data.cell.styles.fillColor = [248, 248, 248];
                }
            },
        });
        y = doc.lastAutoTable.finalY + 10;

        // ── II. Desglose analítico por nivel ──
        sectionTitle('II', 'DESGLOSE ANALÍTICO POR NIVEL');

        const nivelTotalIdx = resultado.tabla_2022.length;
        const nivelQuincenaIdx = nivelTotalIdx + 1;

        autoTable(doc, {
            ...baseTableOptions,
            startY: y,
            head: [['NIVEL', 'CÓDIGO', 'ZONA', 'PLAZAS', 'SUELDO BASE', 'SUELDO COLECTIVO / PERÍODO', 'COMP. GARANTIZADA', 'COMP. GAR. COLECTIVA / PERÍODO']],
            body: [
                ...resultado.tabla_2022.map(r => [
                    r.nivel,
                    r.codigo,
                    r.zona,
                    r.plazas,
                    fmt(r.sueldo),
                    fmt(r.sueldo_colectivo_periodo),
                    fmt(r.compensacion),
                    fmt(r.compensacion_colectiva_periodo),
                ]),
                [
                    { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: totPlazas, styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldo), styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldoPer), styles: { fontStyle: 'bold' } },
                    { content: fmt(totComp), styles: { fontStyle: 'bold' } },
                    { content: fmt(totCompPer), styles: { fontStyle: 'bold' } },
                ],
                [
                    { content: 'EQUIVALENTE QUINCENAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: totPlazas, styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldo / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totSueldoPer / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totComp / meses / 2), styles: { fontStyle: 'bold' } },
                    { content: fmt(totCompPer / meses / 2), styles: { fontStyle: 'bold' } },
                ],
            ],
            styles: { ...baseTableOptions.styles, fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: 'bold' },
                1: { cellWidth: 17, halign: 'center' },
                2: { cellWidth: 12, halign: 'center' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 24, halign: 'right' },
                5: { cellWidth: 31, halign: 'right', fontStyle: 'bold' },
                6: { cellWidth: 26, halign: 'right' },
                7: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                const esColectiva = data.column.index === 5 || data.column.index === 7;
                const esResumen = data.row.index === nivelTotalIdx || data.row.index === nivelQuincenaIdx;
                if (esColectiva) data.cell.styles.fillColor = [248, 248, 248];
                if (esResumen) {
                    // Importes acumulados siempre en una sola línea.
                    data.cell.styles.overflow = 'visible';
                    data.cell.styles.cellPadding = { top: 2.2, right: 1.5, bottom: 2.2, left: 1.5 };
                }
                if (data.row.index === nivelTotalIdx) {
                    data.cell.styles.fillColor = [232, 232, 232];
                    data.cell.styles.lineWidth = { top: 0.5, right: 0, bottom: 0, left: 0 };
                    data.cell.styles.lineColor = accent;
                }
                if (data.row.index === nivelQuincenaIdx) {
                    data.cell.styles.fillColor = [243, 243, 243];
                    data.cell.styles.textColor = muted;
                }
                if (esColectiva && esResumen) {
                    data.cell.styles.fontSize = 9.5;
                    data.cell.styles.textColor = accent;
                    data.cell.styles.fillColor = [225, 225, 225];
                }
            },
        });
        y = doc.lastAutoTable.finalY + 8;

        // ── Acumulados colectivos por período (dato principal del reporte) ──
        const highlightH = 20;
        ensureSpace(highlightH + 4);
        const highlights = [
            ['TOTAL SUELDOS COLECTIVOS POR PERÍODO', fmt(totSueldoPer)],
            ['TOTAL COMPENSACIONES GARANTIZADAS COLECTIVAS POR PERÍODO', fmt(totCompPer)],
        ];
        const hlGap = 4;
        const hlW = (contentW - hlGap) / 2;
        highlights.forEach(([label, value], i) => {
            const x = M + i * (hlW + hlGap);
            doc.setDrawColor(...accent);
            doc.setLineWidth(0.5);
            doc.rect(x, y, hlW, highlightH, 'S');
            doc.setFillColor(...accent);
            doc.rect(x, y, hlW, 1.2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.4);
            doc.setTextColor(...muted);
            doc.text(label, x + 4, y + 7, { maxWidth: hlW - 8 });
            doc.setFontSize(15);
            doc.setTextColor(...ink);
            doc.text(value, x + 4, y + 16);
        });
        y += highlightH + 10;

        // ── III. Detalle de ocupación por nivel — código presupuestal ──
        const nivelesUsados = [...new Set(selectedPlazas.map(p => p.nivel))].filter(n => detalleNiveles[n]);
        if (modoLabel && nivelesUsados.length > 0) {
            // El detalle de ocupación arranca siempre en hoja nueva.
            doc.addPage();
            stampPage();
            y = headerH + 6;
            sectionTitle('III', `DETALLE DE OCUPACIÓN POR NIVEL — ${modoLabel}`);

            nivelesUsados.forEach((niv) => {
                const info = detalleNiveles[niv];
                ensureSpace(28);
                autoTable(doc, {
                    ...baseTableOptions,
                    startY: y,
                    head: [[`NIVEL ${niv}`, 'ZONA / ESCALA', 'CANTIDAD', 'ESTADO']],
                    body: info.codigos.map(c => [
                        c.codigo_presupuestal,
                        String(c.zona ?? c.escala ?? ''),
                        String(c.cantidad),
                        c.matched ? 'Coincide' : 'Sin match',
                    ]),
                    foot: [[{
                        content: `Total de plazas: ${info.total_plazas}     ·     Ocupadas: ${info.ocupadas}     ·     Vacantes: ${info.vacantes}`,
                        colSpan: 4,
                        styles: { halign: 'left', fontStyle: 'bold' },
                    }]],
                    styles: { ...baseTableOptions.styles, fontSize: 8, cellPadding: 1.8 },
                    headStyles: { ...baseTableOptions.headStyles, fillColor: [70, 70, 70], halign: 'left', fontSize: 7 },
                    footStyles: { fillColor: [243, 243, 243], textColor: ink, fontSize: 7.5, lineWidth: 0.1, lineColor: [222, 222, 222] },
                    columnStyles: {
                        0: { cellWidth: 60, fontStyle: 'bold' },
                        1: { cellWidth: 40, halign: 'center' },
                        2: { cellWidth: 30, halign: 'center' },
                        3: { cellWidth: 50, halign: 'right' },
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.column.index === 3) {
                            const sinMatch = data.row.raw[3] !== 'Coincide';
                            data.cell.styles.textColor = sinMatch ? [140, 26, 26] : muted;
                            data.cell.styles.fontStyle = sinMatch ? 'bold' : 'normal';
                        }
                    },
                });
                y = doc.lastAutoTable.finalY + 6;
            });
        }

        doc.putTotalPages('{tp}');
        doc.save(`Valuacion_Presupuestaria_${new Date().getTime()}.pdf`);
    };

    const exportToExcel = async () => {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = 'FUMP 2025 · Sistema de Control de Plazas';
        wb.created = new Date();

        const MAROON = 'FF621F32';
        const MAROON_DARK = 'FF3A1120';
        const AMBER = 'FFFBBF24';
        const GRAY_HEADER = 'FFF3F4F6';
        const GRAY_TEXT = 'FF6B7280';
        const WHITE = 'FFFFFFFF';
        const now = new Date().toLocaleDateString('es-MX');
        const moneyFmt = '"$"#,##0.00';

        const thinBorder = { style: 'thin', color: { argb: 'FFE5E7EB' } };
        const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

        const styleTitleBand = (ws, off, colSpan, title, subtitle) => {
            const r1 = off + 1;
            const r2 = off + 2;
            ws.mergeCells(r1, 1, r1, colSpan);
            ws.mergeCells(r2, 1, r2, colSpan);
            const titleCell = ws.getCell(r1, 1);
            titleCell.value = title;
            titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(r1).height = 30;

            const subtitleCell = ws.getCell(r2, 1);
            subtitleCell.value = subtitle;
            subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: AMBER } };
            subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(r2).height = 20;

            for (let r = r1; r <= r2; r++) {
                for (let c = 1; c <= colSpan; c++) {
                    ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === r1 ? MAROON_DARK : MAROON } };
                }
            }
        };

        const styleHeaderRow = (row) => {
            row.eachCell((cell) => {
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = allBorders;
            });
            row.height = 32;
        };

        const styleTotalRow = (row, colSpanLabel) => {
            row.eachCell((cell, colNumber) => {
                cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: colNumber <= colSpanLabel ? WHITE : AMBER } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_DARK } };
                cell.border = allBorders;
                cell.alignment = { vertical: 'middle', horizontal: colNumber <= colSpanLabel ? 'right' : 'right' };
            });
            row.height = 30;
        };

        // ── HOJA 1: Resumen por Concepto ──────────────────────────────
        const ws1 = wb.addWorksheet('Resumen por Concepto', { views: [{ showGridLines: false }] });
        ws1.columns = [
            { width: 16 }, { width: 52 }, { width: 24 }, { width: 24 }, { width: 24 },
        ];

        const off1 = addExcelLetterhead(wb, ws1, 5);
        styleTitleBand(ws1, off1, 5, 'REPORTE DE VALUACIÓN PRESUPUESTARIA', `FUMP 2025 · Período de Evaluación: ${periodoLabel} · Generado el ${now}`);
        ws1.addRow([]);

        const headerRow1 = ws1.addRow(['PARTIDA', 'CONCEPTO', `PERÍODO (${mesesFmt}m)`, 'ANUAL (12m)', 'COMPLEMENTO']);
        styleHeaderRow(headerRow1);

        resultado.tabla_q322_t348.forEach((r, idx) => {
            const row = ws1.addRow([r.concepto, r.descripcion, r.periodo, r.anual, r.complemento]);
            row.eachCell((cell, colNumber) => {
                cell.border = allBorders;
                cell.font = { name: 'Calibri', size: 12, color: { argb: colNumber === 1 ? MAROON : GRAY_TEXT }, bold: colNumber === 1 };
                if (colNumber >= 3) { cell.numFmt = moneyFmt; cell.alignment = { horizontal: 'right' }; }
                if (colNumber === 3) { cell.font = { ...cell.font, bold: true, color: { argb: MAROON } }; }
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_HEADER } };
            });
            row.height = 24;
        });

        const totalRow1 = ws1.addRow(['TOTAL VALUACIÓN', '', resultado.total.periodo, resultado.total.anual, resultado.total.complemento]);
        ws1.mergeCells(totalRow1.number, 1, totalRow1.number, 2);
        totalRow1.getCell(3).numFmt = moneyFmt;
        totalRow1.getCell(4).numFmt = moneyFmt;
        totalRow1.getCell(5).numFmt = moneyFmt;
        styleTotalRow(totalRow1, 2);

        headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };

        // ── HOJA 2: Desglose Analítico ────────────────────────────────
        const ws2 = wb.addWorksheet('Desglose Analítico', { views: [{ showGridLines: false }] });
        ws2.columns = [
            { width: 26 }, { width: 14 }, { width: 14 }, { width: 12 },
            { width: 22 }, { width: 24 }, { width: 22 }, { width: 26 },
        ];

        const off2 = addExcelLetterhead(wb, ws2, 8);
        styleTitleBand(ws2, off2, 8, 'DESGLOSE ANALÍTICO POR NIVEL', `Detalle individualizado por plaza seleccionada · Base PECEN · ${now}`);
        ws2.addRow([]);

        const headerRow2 = ws2.addRow(['NIVEL', 'CÓDIGO', 'ZONA', 'PLAZAS', 'SUELDO BASE', 'SUELDO PERÍODO', 'COMP. GAR.', 'COMP. GAR. PERÍODO']);
        styleHeaderRow(headerRow2);

        resultado.tabla_2022.forEach((r, idx) => {
            const row = ws2.addRow([
                r.nivel, r.codigo, r.zona, r.plazas,
                r.sueldo, r.sueldo_colectivo_periodo, r.compensacion, r.compensacion_colectiva_periodo
            ]);
            row.eachCell((cell, colNumber) => {
                cell.border = allBorders;
                cell.font = { name: 'Calibri', size: 11, color: { argb: GRAY_TEXT } };
                if (colNumber === 1) cell.font = { ...cell.font, bold: true, color: { argb: MAROON } };
                if (colNumber === 4) cell.alignment = { horizontal: 'center' };
                if (colNumber >= 5) { cell.numFmt = moneyFmt; cell.alignment = { horizontal: 'right' }; }
                if (colNumber >= 5 && colNumber <= 8) cell.font = { ...cell.font, bold: true, color: { argb: MAROON } };
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_HEADER } };
            });
            row.height = 24;
        });

        const totPlazas = totalesNivel.plazas;
        const totSueldo = totalesNivel.sueldo;
        const totSueldoPer = totalesNivel.sueldoPeriodo;
        const totComp = totalesNivel.compensacion;
        const totCompPer = totalesNivel.compensacionPeriodo;

        const totalRow2 = ws2.addRow(['TOTAL', '', '', totPlazas, totSueldo, totSueldoPer, totComp, totCompPer]);
        ws2.mergeCells(totalRow2.number, 1, totalRow2.number, 3);
        [5, 6, 7, 8].forEach(c => totalRow2.getCell(c).numFmt = moneyFmt);
        styleTotalRow(totalRow2, 3);
        totalRow2.getCell(4).alignment = { horizontal: 'center' };
        // Los dos acumulados colectivos por período son la lectura principal del
        // reporte: van más grandes y con fondo propio dentro de la fila TOTAL.
        [6, 8].forEach(c => {
            const cell = totalRow2.getCell(c);
            cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: AMBER } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F0A12' } };
        });
        totalRow2.height = 34;

        const quincenaRow2 = ws2.addRow(['QUINCENA', '', '', totPlazas, totSueldo / meses / 2, totSueldoPer / meses / 2, totComp / meses / 2, totCompPer / meses / 2]);
        ws2.mergeCells(quincenaRow2.number, 1, quincenaRow2.number, 3);
        [5, 6, 7, 8].forEach(c => quincenaRow2.getCell(c).numFmt = moneyFmt);
        quincenaRow2.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: colNumber === 6 || colNumber === 8 ? 13 : 11, bold: true, color: { argb: colNumber <= 3 ? WHITE : AMBER } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNumber === 6 || colNumber === 8 ? 'FF123253' : 'FF1A4A7A' } };
            cell.border = allBorders;
            cell.alignment = { vertical: 'middle', horizontal: colNumber === 4 ? 'center' : 'right' };
        });
        quincenaRow2.height = 28;

        // ── Bloque de resalte: totales colectivos por período ──
        ws2.addRow([]);
        const hlLabelRow = ws2.addRow(['TOTAL SUELDOS COLECTIVOS / PERÍODO', '', '', '', 'TOTAL COMP. GAR. COLECTIVAS / PERÍODO', '', '', '']);
        ws2.mergeCells(hlLabelRow.number, 1, hlLabelRow.number, 4);
        ws2.mergeCells(hlLabelRow.number, 5, hlLabelRow.number, 8);
        const hlValueRow = ws2.addRow([totSueldoPer, '', '', '', totCompPer, '', '', '']);
        ws2.mergeCells(hlValueRow.number, 1, hlValueRow.number, 4);
        ws2.mergeCells(hlValueRow.number, 5, hlValueRow.number, 8);

        [1, 5].forEach(c => {
            const labelCell = hlLabelRow.getCell(c);
            labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFBC955C' } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            const valueCell = hlValueRow.getCell(c);
            valueCell.numFmt = moneyFmt;
            valueCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: AMBER } };
            valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        [hlLabelRow, hlValueRow].forEach(row => {
            for (let c = 1; c <= 8; c++) {
                row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON_DARK } };
                row.getCell(c).border = allBorders;
            }
        });
        hlLabelRow.height = 22;
        hlValueRow.height = 38;

        headerRow1.alignment = { vertical: 'middle', horizontal: 'left' };
        [ws1, ws2].forEach(ws => { ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Valuacion_Presupuestaria_${new Date().getTime()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const renderSimulatorContent = () => {
        return (
        <div className="space-y-7 animate-in fade-in duration-400">
            <NivelDetalleModal
                nivel={nivelDetalleAbierto}
                detalle={detalleNiveles[nivelDetalleAbierto]}
                onClose={() => setNivelDetalleAbierto(null)}
            />
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
                        <div className="flex items-end gap-2">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="valuacion-fecha-inicio" className="text-[8px] font-black text-white/40 uppercase tracking-widest px-0.5">
                                    Del
                                </label>
                                <input
                                    id="valuacion-fecha-inicio"
                                    type="date"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] font-bold text-white outline-none focus:border-amber-400/60 transition-colors [color-scheme:dark]"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="valuacion-fecha-fin" className="text-[8px] font-black text-white/40 uppercase tracking-widest px-0.5">
                                    Al
                                </label>
                                <input
                                    id="valuacion-fecha-fin"
                                    type="date"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] font-bold text-white outline-none focus:border-amber-400/60 transition-colors [color-scheme:dark]"
                                />
                            </div>
                            <button
                                onClick={() => setFechaFin(finDeAnioISO(fechaInicio))}
                                title="Restablecer la fecha final al 31 de diciembre del año de la fecha inicial"
                                className="px-2.5 py-2 rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            >
                                31 Dic
                            </button>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${periodoValido ? 'text-white/50' : 'text-red-400'}`}>
                            {periodoValido
                                ? <>Total: <span className="text-amber-400">{periodoLabel}</span></>
                                : periodoLabel}
                        </span>
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
                        {Object.keys(sinMatchByNivel).length > 0 && (
                            <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-500 mb-2">
                                    <Info className="w-3 h-3 shrink-0" />
                                    {Object.keys(sinMatchByNivel).length} nivel(es) de nómina sin correspondencia en catálogo — no incluidos en la carga. Clic para ver detalle.
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(sinMatchByNivel).map(([niv, cant]) => (
                                        <button
                                            key={niv}
                                            type="button"
                                            onClick={() => setNivelDetalleAbierto(niv)}
                                            className="text-[8px] font-black px-2 py-1 rounded-md bg-white text-red-500 border border-red-200 hover:bg-red-100 transition-colors"
                                        >
                                            {niv} · {cant} sin match
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                                <span className="text-amber-500 font-bold text-[10px]">({item.codigo})</span>
                                                {(item.zona ?? item.escala) != null && (
                                                    <span
                                                        title="Zona/Escala — distingue niveles con el mismo código presupuestal pero distinto tabulador de sueldo"
                                                        className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200"
                                                    >
                                                        Zona {item.zona ?? item.escala}
                                                    </span>
                                                )}
                                                {eventualesData?.[item.id] != null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNivelDetalleAbierto(item.nivel)}
                                                        className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#621f32]/8 text-[#621f32] border border-[#621f32]/15 hover:bg-[#621f32]/15 transition-colors"
                                                    >
                                                        {eventualesData[item.id]} ocp.
                                                    </button>
                                                )}
                                                {permanentesData?.[item.id] != null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setNivelDetalleAbierto(item.nivel)}
                                                        className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#1a4a7a]/8 text-[#1a4a7a] border border-[#1a4a7a]/15 hover:bg-[#1a4a7a]/15 transition-colors"
                                                    >
                                                        {permanentesData[item.id]} ocp.
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-medium uppercase truncate max-w-[160px] mt-0.5">{item.denominacion}</div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => adjustPlaza(item.id, -1)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#621f32] hover:bg-[#621f32]/5 transition-all">
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={plazasInput[item.id] || ''}
                                                    onChange={(e) => handlePlazaChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    className="w-12 h-8 bg-gray-50 border border-gray-200 rounded-lg text-center font-black text-[#621f32] text-sm focus:outline-none focus:border-[#621f32]/50 focus:bg-white transition-all"
                                                />
                                                <button onClick={() => adjustPlaza(item.id, 1)}
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
                                    <div key={p.id}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100
                                                    hover:border-[#621f32]/20 hover:bg-[#621f32]/[0.02] transition-all group">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[#621f32] text-sm">{p.nivel}</span>
                                                <span className="text-[9px] text-gray-300 font-mono">({p.codigo})</span>
                                                {p.zona != null && (
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
                                                        Zona {p.zona}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-gray-400 font-medium uppercase truncate mt-0.5">{p.denominacion}</div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-3 shrink-0">
                                            <div className="flex items-baseline gap-1 bg-[#621f32]/8 border border-[#621f32]/15 rounded-lg px-3 py-1.5">
                                                <span className="text-sm font-black text-[#621f32] leading-none">{p.qty}</span>
                                                <span className="text-[8px] font-bold text-[#621f32]/60 uppercase tracking-wider leading-none">
                                                    {p.qty === 1 ? 'plaza' : 'plazas'}
                                                </span>
                                            </div>
                                            <button onClick={() => handlePlazaChange(p.id, 0)}
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
                            disabled={calculating || selectedPlazas.length === 0 || !periodoValido}
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

                    {/* Table 1 — Analytic Breakdown */}
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
                            <table className="w-full text-[14px] text-left min-w-[1000px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-7 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest
                                                       sticky left-0 bg-gray-50 z-20 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                            Nivel
                                        </th>
                                        <th className="px-7 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">Plazas</th>
                                        <th className="px-7 py-4 text-right text-[11px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-200">Sueldo Base</th>
                                        <th className="px-7 py-4 text-right text-[11px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Sueldo Colectivo / Período</th>
                                        <th className="px-7 py-4 text-right text-[11px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Comp. Garantizada</th>
                                        <th className="px-7 py-4 text-right text-[11px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">Comp. Gar. Colectiva / Período</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-semibold uppercase tracking-tight">
                                    {resultado.tabla_2022.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/60 transition-colors group">
                                            <td className="px-7 py-5 sticky left-0 bg-white group-hover:bg-gray-50/60 z-10 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                                <FormulaTooltip formula={`Nivel: ${row.nivel} | Código: ${row.codigo}`}>
                                                    <div className="font-black text-[#621f32] text-sm">{row.nivel}</div>
                                                    <div className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5 max-w-[200px]">{row.puesto}</div>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-7 py-5 text-center">
                                                <FormulaTooltip formula="Plazas asignadas para la simulación">
                                                    <span className="inline-flex items-center justify-center bg-[#621f32]/8 text-[#621f32] border border-[#621f32]/15 font-black rounded-lg px-3 py-1 text-sm">
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
                                        </tr>
                                    ))}

                                    {/* Totals row */}
                                    <tr className="bg-gray-800 text-white">
                                        <td className="px-7 py-5 sticky left-0 bg-gray-800 z-10 font-black text-base uppercase tracking-wider">TOTAL</td>
                                        <td className="px-7 py-5 text-center">
                                            <span className="bg-white/10 text-amber-400 border border-white/10 font-black rounded-lg px-3 py-1 text-sm">
                                                {totalesNivel.plazas}
                                            </span>
                                        </td>
                                        <td className="px-7 py-5 text-right text-base font-mono font-semibold text-gray-400 border-r border-gray-700">
                                            {fmt(totalesNivel.sueldo)}
                                        </td>
                                        <td className="px-7 py-5 text-right font-mono font-black text-amber-300 text-xl bg-[#621f32]/40 border-x border-amber-400/20">
                                            {fmt(totalesNivel.sueldoPeriodo)}
                                        </td>
                                        <td className="px-7 py-5 text-right text-base font-mono font-black text-amber-400">
                                            {fmt(totalesNivel.compensacion)}
                                        </td>
                                        <td className="px-7 py-5 text-right font-mono font-black text-amber-300 text-xl bg-[#621f32]/40 border-x border-amber-400/20">
                                            {fmt(totalesNivel.compensacionPeriodo)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Highlight — totales colectivos por período */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10"
                            style={{ background: 'linear-gradient(90deg, #3a1120 0%, #621f32 100%)' }}>
                            <div className="px-8 py-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bc955c]">
                                    Total Sueldos Colectivos / Período
                                </p>
                                <p className="mt-1.5 font-mono font-black text-amber-400 text-3xl md:text-4xl leading-none break-words">
                                    {fmt(totalesNivel.sueldoPeriodo)}
                                </p>
                            </div>
                            <div className="px-8 py-6 border-t md:border-t-0 md:border-l border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bc955c]">
                                    Total Comp. Gar. Colectivas / Período
                                </p>
                                <p className="mt-1.5 font-mono font-black text-amber-400 text-3xl md:text-4xl leading-none break-words">
                                    {fmt(totalesNivel.compensacionPeriodo)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Table 2 — Executive Summary */}
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
                                FUMP 2025 · {periodoLabel}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-base min-w-[950px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-8 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest
                                                       sticky left-0 bg-gray-50 z-20 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                            Partida
                                        </th>
                                        <th className="px-8 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                                        <th className="px-8 py-4 text-right text-[11px] font-black text-[#621f32] uppercase tracking-widest bg-[#621f32]/[0.03]">
                                            Período Colectivo ({mesesFmt}m)
                                        </th>
                                        <th className="px-8 py-4 text-right text-[11px] font-black text-gray-400 uppercase tracking-widest">Complemento Colectivo</th>
                                        <th className="px-8 py-4 text-right text-[11px] font-black text-gray-400 uppercase tracking-widest">Regularizable (12m)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {resultado.tabla_q322_t348.map((row) => (
                                        <tr key={row.concepto} className="hover:bg-gray-50/60 transition-colors group">
                                            {/* Partida — sticky */}
                                            <td className="px-8 py-4 sticky left-0 bg-white group-hover:bg-gray-50/60 z-10 shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)]">
                                                <FormulaTooltip formula="Código de concepto presupuestal">
                                                    <span className="font-mono font-black text-[#621f32] text-base">{row.concepto}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 font-semibold text-gray-500 uppercase text-[13px] tracking-tight max-w-[320px]">
                                                <FormulaTooltip formula="Descripción oficial del concepto según FUMP">
                                                    {row.descripcion}
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right bg-[#621f32]/[0.02]">
                                                <FormulaTooltip formula={conceptFormulas[row.concepto] || 'Cálculo base'}>
                                                    <span className="font-mono font-black text-[#621f32] text-base">{fmt(row.periodo)}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <FormulaTooltip formula="Diferencia entre el monto Anual y el monto del Período (T – R)">
                                                    <span className="font-mono font-semibold text-gray-400 text-base">{fmt(row.complemento)}</span>
                                                </FormulaTooltip>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <FormulaTooltip formula={`${conceptFormulas[row.concepto] || 'Cálculo base'} (Proyección 12m)`}>
                                                    <span className="font-mono font-semibold text-gray-500 text-base">{fmt(row.anual)}</span>
                                                </FormulaTooltip>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Totals row */}
                                    <tr style={{ background: 'linear-gradient(90deg, #3a1120, #621f32)' }}>
                                        <td colSpan={2} className="px-8 py-6 text-right text-xs font-black text-white/70 uppercase tracking-widest">
                                            Total Valuación Presupuestal
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Totales del período seleccionado">
                                                <span className="font-mono font-black text-amber-400 text-xl">{fmt(resultado.total.periodo)}</span>
                                            </FormulaTooltip>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Complementos">
                                                <span className="font-mono font-black text-amber-400 text-xl">{fmt(resultado.total.complemento)}</span>
                                            </FormulaTooltip>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <FormulaTooltip formula="Σ Proyección anual">
                                                <span className="font-mono font-black text-amber-400 text-xl">{fmt(resultado.total.anual)}</span>
                                            </FormulaTooltip>
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

                    {/* Guardar valuación — habilitado solo tras calcular */}
                    <div className="shrink-0 border-t border-gray-100 pt-4 mt-4 space-y-2">
                        <button
                            onClick={handleGuardarValuacion}
                            disabled={!resultado || savingValuacion}
                            title={
                                resultado
                                    ? 'Guardar el resultado de la valuación en este asunto'
                                    : 'Primero presiona «Calcular Valuación Presupuestaria»'
                            }
                            className="w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-[0.25em]
                                       flex items-center justify-center gap-3 transition-all duration-200
                                       bg-[#621f32] text-white shadow-lg shadow-[#621f32]/30
                                       hover:bg-[#4e1828] hover:shadow-xl hover:shadow-[#621f32]/40
                                       active:scale-[0.98]
                                       disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                                       disabled:hover:bg-[#621f32] disabled:active:scale-100"
                        >
                            {savingValuacion ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 text-amber-400" />
                                    Guardar Valuación
                                </>
                            )}
                        </button>

                        {!resultado && (
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center leading-relaxed">
                                Calcula la valuación presupuestaria para habilitar el guardado
                            </p>
                        )}

                        {saveFeedback && (
                            <div
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider
                                    ${saveFeedback.type === 'ok'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-red-50 text-red-600 border border-red-100'}`}
                            >
                                {saveFeedback.type === 'ok'
                                    ? <CheckCircle2 className="size-3.5 shrink-0" />
                                    : <AlertCircle className="size-3.5 shrink-0" />}
                                {saveFeedback.msg}
                            </div>
                        )}

                        {guardadoEn && (
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">
                                Última valuación guardada:{' '}
                                <span className="text-[#621f32]">
                                    {new Date(guardadoEn).toLocaleString('es-MX', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </span>
                            </p>
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
