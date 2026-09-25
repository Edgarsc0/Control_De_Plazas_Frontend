'use client';

import { useCallback, useRef, useState } from 'react';
import { TableroLayoutService } from '@/services/tableroLayout.service';
import { useToast } from '@/hooks/useToast';
import ExportarTableroModal from '@/app/dashboard/tablero/_components/personalizable/ExportarTableroModal';
import ImportarTableroModal from '@/app/dashboard/tablero/_components/personalizable/ImportarTableroModal';
import { mensajeImportacion } from '@/app/dashboard/tablero/_components/personalizable/PortabilidadTablero';
import {
    aplicarImportacion,
    leerArchivoTablero,
} from '@/app/dashboard/tablero/_components/personalizable/portabilidadTablero';

const slug = (email) => email.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

async function cargarLayout(entry) {
    const res = await TableroLayoutService.getLayoutDeUsuario(entry.id);
    if (!res.ok) throw new Error('No se pudo leer el tablero del usuario.');
    const data = await res.json();
    return {
        widgets: Array.isArray(data.widgets) ? data.widgets : [],
        nombres: Array.isArray(data.escritorios) ? data.escritorios.map((n) => String(n || '')) : [],
    };
}

/**
 * Exportar / cargar el tablero personalizable de un usuario desde la
 * administración de usuarios. Devuelve `iniciarExportar(entry)`,
 * `iniciarImportar(entry)` y `dialogos` (nodo que hay que renderizar una vez).
 */
export function useTableroUsuario() {
    const { toast } = useToast();
    const inputRef = useRef(null);
    const importEntryRef = useRef(null);
    const [exportacion, setExportacion] = useState(null); // { entry, widgets, nombres }
    const [importacion, setImportacion] = useState(null); // { entry, widgets, nombres, escritorios, omitidos }

    const iniciarExportar = useCallback(async (entry) => {
        try {
            const layout = await cargarLayout(entry);
            if (layout.widgets.length === 0) {
                toast.error(`${entry.email} todavía no tiene módulos en su tablero.`);
                return;
            }
            setExportacion({ entry, ...layout });
        } catch (err) {
            toast.error(err.message);
        }
    }, [toast]);

    const iniciarImportar = useCallback((entry) => {
        importEntryRef.current = entry;
        inputRef.current?.click();
    }, []);

    const alElegirArchivo = async (e) => {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        const entry = importEntryRef.current;
        if (!archivo || !entry) return;
        try {
            const { escritorios, omitidos } = await leerArchivoTablero(archivo);
            const layout = await cargarLayout(entry);
            setImportacion({ entry, ...layout, escritorios, omitidos });
        } catch (err) {
            toast.error(err.message || 'No se pudo leer el archivo.');
        }
    };

    const confirmarImportacion = async (importados, opciones) => {
        const { entry, widgets, nombres, omitidos } = importacion;
        const resultado = aplicarImportacion(widgets, nombres, importados, opciones);
        if (resultado.agregados === 0) {
            toast.error('Se alcanzó el máximo de escritorios permitido.');
            return;
        }
        try {
            const res = await TableroLayoutService.saveLayoutDeUsuario(entry.id, resultado.widgets, resultado.nombres);
            if (!res.ok) throw new Error('No se pudo guardar el tablero del usuario.');
            toast.success(`${entry.email}: ${mensajeImportacion(resultado, omitidos)}`);
            setImportacion(null);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const dialogos = (
        <>
            <input ref={inputRef} type="file" accept="application/json,.json" onChange={alElegirArchivo} className="hidden" />
            <ExportarTableroModal
                open={exportacion !== null}
                onClose={() => setExportacion(null)}
                widgets={exportacion?.widgets ?? []}
                nombres={exportacion?.nombres ?? []}
                nombreArchivo={`tablero-${slug(exportacion?.entry.email ?? 'usuario')}-${new Date().toISOString().slice(0, 10)}.json`}
                descripcion={`Tablero de ${exportacion?.entry.email ?? ''}. Elige los escritorios a incluir; el archivo sirve para cargarlo a otro usuario o en «Importar» de su propio tablero.`}
                onExportado={(n) => toast.success(n === 1 ? 'Escritorio exportado.' : `${n} escritorios exportados.`)}
            />
            <ImportarTableroModal
                open={importacion !== null}
                onClose={() => setImportacion(null)}
                titulo={`Cargar tablero a ${importacion?.entry.email ?? ''}`}
                importados={importacion?.escritorios ?? []}
                widgets={importacion?.widgets ?? []}
                nombres={importacion?.nombres ?? []}
                escritorioActual={null}
                permitirReemplazar
                onConfirmar={confirmarImportacion}
            />
        </>
    );

    return { iniciarExportar, iniciarImportar, dialogos };
}
