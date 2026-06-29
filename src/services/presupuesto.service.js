import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio encargado de la lógica de presupuesto y valuación. Todas las
 * peticiones pasan por `apiFetch`, que inyecta el token de sesión.
 */
export const PresupuestoService = {
    /**
     * Obtiene el catálogo de plazas.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getCatalogoPlazas: (options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Actualiza una plaza del catálogo.
     * @param {string|number} id - Identificador de la plaza.
     * @param {Object} data - Campos a actualizar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    updatePlaza: (id, data, options = {}) => {
        return apiFetch(`/presupuesto/catalogo-plazas/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Obtiene las constantes del sistema.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getConstantes: (options = {}) => {
        return apiFetch("/presupuesto/constantes-sistema/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Actualiza una constante del sistema por su clave.
     * @param {string} clave - Clave de la constante.
     * @param {Object} data - Campos a actualizar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    updateConstante: (clave, data, options = {}) => {
        return apiFetch(`/presupuesto/constantes-sistema/${clave}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Obtiene los conceptos presupuestales.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getConceptos: (options = {}) => {
        return apiFetch("/presupuesto/conceptos-presupuestal/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Actualiza un concepto presupuestal.
     * @param {string|number} concepto - Identificador del concepto.
     * @param {Object} data - Campos a actualizar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    updateConcepto: (concepto, data, options = {}) => {
        return apiFetch(`/presupuesto/conceptos-presupuestal/${concepto}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Realiza el cálculo de valuación presupuestaria.
     * @param {number} meses - Número de meses (1-12).
     * @param {Array<{nivel: string, plazas: number}>} plazas - Plazas por nivel a valuar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el resultado.
     */
    calcularValuacion: (meses, plazas, options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/calcular/", {
            method: 'POST',
            body: JSON.stringify({ meses, plazas }),
            ...options
        });
    },

    getEventualesOcupadas: (options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/eventuales_ocupadas/", {
            method: 'GET',
            ...options
        });
    },

    getPermanentesOcupadas: (options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/permanentes_ocupadas/", {
            method: 'GET',
            ...options
        });
    },
};
