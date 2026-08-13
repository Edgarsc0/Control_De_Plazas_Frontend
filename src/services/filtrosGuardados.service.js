import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Combinaciones de condiciones de `AdvancedFiltersModal` guardadas por el
 * usuario autenticado, para reaplicarlas sin reconstruirlas a mano.
 * `vista` identifica el tab de origen (cada uno tiene su propio set de
 * columnas) — un filtro guardado en un tab no aplica a otro.
 */
export const FiltrosGuardadosService = {
    /**
     * Filtros guardados del usuario autenticado para una vista.
     * @param {string} vista
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `[{id, vista, nombre, condiciones, creado_en}]`.
     */
    getFiltrosGuardados: (vista, options = {}) => {
        return apiFetch(`/plantilla/filtros-guardados/?vista=${encodeURIComponent(vista)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Guarda una combinación de condiciones con nombre. 409 si ya existe un
     * filtro con ese nombre para el usuario en esa vista.
     * @param {string} vista
     * @param {string} nombre
     * @param {Object[]} condiciones
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `{id, vista, nombre, condiciones, creado_en}`.
     */
    crearFiltroGuardado: (vista, nombre, condiciones, options = {}) => {
        return apiFetch('/plantilla/filtros-guardados/', {
            method: 'POST',
            body: JSON.stringify({ vista, nombre, condiciones }),
            ...options
        });
    },

    /**
     * Elimina un filtro guardado propio.
     * @param {number} id
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    eliminarFiltroGuardado: (id, options = {}) => {
        return apiFetch(`/plantilla/filtros-guardados/${id}/`, {
            method: 'DELETE',
            ...options
        });
    }
};
