import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Layout del tablero personalizable (ver Whitelist.tablero == 'personalizable')
 * del usuario autenticado — un único layout por usuario, autoescopado en el
 * backend a `request.user` (ver TableroLayoutView).
 */
export const TableroLayoutService = {
    /**
     * Obtiene el layout guardado del usuario autenticado.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `{ widgets: [] }`.
     */
    getLayout: (options = {}) => {
        return apiFetch('/auth/tablero-layout/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Reemplaza el layout completo del usuario autenticado.
     * @param {Array<Object>} widgets - Lista de widgets (forma de react-grid-layout: i/x/y/w/h + `type`).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    saveLayout: (widgets, options = {}) => {
        return apiFetch('/auth/tablero-layout/', {
            method: 'PUT',
            body: JSON.stringify({ widgets }),
            ...options
        });
    },
};
