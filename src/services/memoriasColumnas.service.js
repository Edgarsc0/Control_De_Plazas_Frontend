import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Memorias de columnas (hasta 3 por tabla) del usuario autenticado — autoescopadas en el
 * backend a `request.user` (ver MemoriasColumnasView). `tabla`: plantilla_detalle, bajas,
 * mov_posiciones, movimientos o alineacion.
 */
export const MemoriasColumnasService = {
    listar: (tabla, options = {}) =>
        apiFetch(`/auth/memorias-columnas/?tabla=${encodeURIComponent(tabla)}`, { method: 'GET', ...options }),

    guardar: (tabla, slot, nombre, columnas, options = {}) =>
        apiFetch('/auth/memorias-columnas/', {
            method: 'PUT',
            body: JSON.stringify({ tabla, slot, nombre, columnas }),
            ...options,
        }),

    borrar: (tabla, slot, options = {}) =>
        apiFetch(`/auth/memorias-columnas/?tabla=${encodeURIComponent(tabla)}&slot=${slot}`, { method: 'DELETE', ...options }),
};
