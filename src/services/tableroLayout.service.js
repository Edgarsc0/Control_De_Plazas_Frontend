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
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `{ widgets: [], escritorios: [] }`.
     */
    getLayout: (options = {}) => {
        return apiFetch('/auth/tablero-layout/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Reemplaza el layout completo del usuario autenticado.
     * @param {Array<Object>} widgets - Lista de widgets (forma de react-grid-layout: i/x/y/w/h + `type` + `page`).
     * @param {string[]} [escritorios] - Nombre de cada escritorio por índice ("" = sin nombre propio).
     *   Si se omite, el backend conserva los guardados.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    saveLayout: (widgets, escritorios, options = {}) => {
        return apiFetch('/auth/tablero-layout/', {
            method: 'PUT',
            body: JSON.stringify(escritorios ? { widgets, escritorios } : { widgets }),
            ...options
        });
    },

    /**
     * Administración: layout de OTRO usuario (id de Whitelist). Exige el
     * permiso `manage_usuarios`.
     * @param {number} whitelistId
     */
    getLayoutDeUsuario: (whitelistId, options = {}) => {
        return apiFetch(`/auth/tablero-layout/usuario/${whitelistId}/`, {
            method: 'GET',
            ...options
        });
    },

    /** Administración: reemplaza el layout de otro usuario. */
    saveLayoutDeUsuario: (whitelistId, widgets, escritorios, options = {}) => {
        return apiFetch(`/auth/tablero-layout/usuario/${whitelistId}/`, {
            method: 'PUT',
            body: JSON.stringify({ widgets, escritorios }),
            ...options
        });
    },
};
