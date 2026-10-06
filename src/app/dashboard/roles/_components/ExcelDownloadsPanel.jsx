'use client';


import { omitirRegistroDescarga } from '@/lib/excelAudit';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Download, FileSpreadsheet, IdCard, ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { VisitsService } from '@/services/visits.service';
import { useToast } from '@/hooks/useToast';

const MODULO_LABEL = { plantilla_detalle: 'Plantilla de Empleados › Plantilla Detalle' };

const CONDICION_LABEL = {
    contains: 'contiene',
    not_contains: 'no contiene',
    starts_with: 'empieza con',
    not_starts_with: 'no empieza con',
    ends_with: 'termina con',
    not_ends_with: 'no termina con',
    equals: 'es igual a',
    not_equals: 'es distinto de',
};

function formatFecha(iso) {
    return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

/** Convierte el objeto `filtros` de la bitácora en renglones legibles. */
function describirFiltros(filtros) {
    if (!filtros || typeof filtros !== 'object') return [];
    const lineas = [];
    if (filtros.detalle) lineas.push(String(filtros.detalle));
    if (filtros.busqueda) lineas.push(`Búsqueda general: "${filtros.busqueda}"`);
    (filtros.columnas || []).forEach((f) => {
        const mostrados = (f.valores || []).join(', ');
        const resto = f.total > (f.valores || []).length ? ` y ${f.total - f.valores.length} más` : '';
        lineas.push(`${f.columna}: ${mostrados}${resto}`);
    });
    (filtros.texto || []).forEach((f) => {
        lineas.push(`${f.columna} ${CONDICION_LABEL[f.condicion] || f.condicion} "${f.valor}"`);
    });
    if (filtros.avanzados) lineas.push(`${filtros.avanzados} filtro(s) avanzado(s)`);
    if (filtros.orden) lineas.push(`Orden: ${filtros.orden.columna} (${filtros.orden.direccion === 'desc' ? 'descendente' : 'ascendente'})`);
    if (filtros.solo_plantilla_oficial === false) lineas.push('Switch "Plantilla oficial" apagado');
    return lineas;
}

function Etiqueta({ activo, icon: Icon, children }) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                activo
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
        >
            <Icon className="size-3" /> {children}
        </span>
    );
}

function DescargaRow({ descarga, onRegenerar, regenerando }) {
    const [abierto, setAbierto] = useState(false);
    const filtros = describirFiltros(descarga.filtros);
    const columnas = descarga.columnas || [];

    return (
        <li className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-start gap-2 px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => setAbierto((v) => !v)}
                    aria-expanded={abierto}
                    title={abierto ? 'Ocultar detalle' : 'Ver columnas y filtros'}
                    className="mt-0.5 p-0.5 rounded-md text-slate-400 hover:text-[#621f32] hover:bg-slate-100 cursor-pointer shrink-0"
                >
                    <ChevronRight className={`size-4 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-bold text-slate-800">{formatFecha(descarga.fecha)}</span>
                        <span className="text-xs text-slate-500">
                            {descarga.regenerable || descarga.total_filas > 0 || columnas.length > 0
                                ? `${descarga.total_filas.toLocaleString('es-MX')} filas · ${columnas.length} columnas`
                                : descarga.nombre_archivo}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {MODULO_LABEL[descarga.modulo] || descarga.modulo}
                        {descarga.modo === 'historico' && ` · Plantilla histórica al ${descarga.fecha_historica}`}
                    </p>
                    {descarga.regenerada_de && (
                        <p className="text-xs text-sky-700 mt-0.5">
                            Regeneración de la descarga #{descarga.regenerada_de.id} de {descarga.regenerada_de.email}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Etiqueta activo={descarga.incluyo_fotos} icon={ImageIcon}>
                            {descarga.incluyo_fotos ? 'Con fotografías' : 'Sin fotografías'}
                        </Etiqueta>
                        <Etiqueta activo={descarga.incluyo_datos_personales} icon={IdCard}>
                            {descarga.incluyo_datos_personales ? 'Con datos personales' : 'Sin datos personales'}
                        </Etiqueta>
                    </div>
                </div>
                {descarga.regenerable && (
                    <button
                        type="button"
                        onClick={() => onRegenerar(descarga)}
                        disabled={regenerando}
                        title="Generar de nuevo el mismo Excel que descargó el usuario"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-[#621f32] hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-wait"
                    >
                        {regenerando ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                        Generar de nuevo
                    </button>
                )}
            </div>

            {abierto && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-3 text-xs text-slate-600">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <p><span className="font-bold text-slate-400 uppercase text-[10px] block">Archivo</span>{descarga.nombre_archivo || '—'}</p>
                        <p><span className="font-bold text-slate-400 uppercase text-[10px] block">Rol al descargar</span>{descarga.rol || '—'}</p>
                        <p><span className="font-bold text-slate-400 uppercase text-[10px] block">Dirección IP</span>{descarga.ip || '—'}</p>
                    </div>
                    <div>
                        <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Filtros aplicados</p>
                        {filtros.length === 0 ? (
                            <p className="text-slate-400">
                                {descarga.regenerable
                                    ? 'Sin filtros: exportó toda la tabla a la que tiene acceso.'
                                    : 'Esta pantalla no reporta el detalle de sus filtros.'}
                            </p>
                        ) : (
                            <ul className="list-disc pl-4 space-y-0.5">
                                {filtros.map((linea, i) => <li key={i} className="break-words">{linea}</li>)}
                            </ul>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Columnas ({columnas.length})</p>
                        <div className="flex flex-wrap gap-1">
                            {columnas.map((c) => (
                                <span key={c.key} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.label}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </li>
    );
}

/**
 * Historial de archivos Excel generados por un usuario (bitácora de
 * auditoría, ver UserDescargasExcelView en el backend). "Generar de nuevo"
 * reconstruye el archivo con las filas y columnas guardadas el día de la
 * descarga; esa regeneración también queda registrada, a nombre de quien la pide.
 */
export default function ExcelDownloadsPanel({ email }) {
    const { toast } = useToast();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [regenerandoId, setRegenerandoId] = useState(null);

    const cargar = useCallback(async () => {
        if (!email) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await VisitsService.getUserDescargasExcel(email);
            if (!response.ok) throw new Error('No se pudo cargar el historial de descargas.');
            setData(await response.json());
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [email]);

    useEffect(() => { cargar(); }, [cargar]);

    const regenerar = async (descarga) => {
        setRegenerandoId(descarga.id);
        try {
            const response = await VisitsService.regenerarDescargaExcel(descarga.id);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || body?.detail || 'No se pudo generar el archivo.');
            }
            const extension = response.headers.get('Content-Type')?.includes('macroEnabled') ? 'xlsm' : 'xlsx';
            const url = window.URL.createObjectURL(await response.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = `Auditoria_Descarga_${descarga.regenerada_de?.id ?? descarga.id}.${extension}`;
            omitirRegistroDescarga(); // el backend ya registró esta regeneración
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Archivo generado. Esta regeneración también quedó registrada.');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setRegenerandoId(null);
        }
    };

    const descargas = data?.results || [];

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
                    <FileSpreadsheet className="size-4" /> Historial de descargas de Excel
                    {data && <span className="normal-case font-bold">· {data.total}</span>}
                </h4>
                <button
                    type="button"
                    onClick={cargar}
                    disabled={isLoading}
                    title="Actualizar"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                    <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {!error && isLoading && !data && <p className="text-xs text-slate-400">Cargando historial...</p>}
            {!error && data && descargas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                    Este usuario no ha generado ningún archivo Excel desde que se activó el registro de descargas.
                </p>
            )}

            <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {descargas.map((d) => (
                    <DescargaRow
                        key={d.id}
                        descarga={d}
                        onRegenerar={regenerar}
                        regenerando={regenerandoId === d.id}
                    />
                ))}
            </ul>
            {data && data.total > descargas.length && (
                <p className="text-[11px] text-slate-400">Se muestran las {descargas.length} descargas más recientes de {data.total}.</p>
            )}
        </div>
    );
}
