import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio encargado de la lógica de presupuesto y valuación
 */
export const PresupuestoService = {
    /**
     * Catálogo de Plazas
     */
    getCatalogoPlazas: (options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/", {
            method: 'GET',
            ...options
        });
    },
    updatePlaza: (id, data, options = {}) => {
        return apiFetch(`/presupuesto/catalogo-plazas/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Constantes del Sistema
     */
    getConstantes: (options = {}) => {
        return apiFetch("/presupuesto/constantes-sistema/", {
            method: 'GET',
            ...options
        });
    },
    updateConstante: (clave, data, options = {}) => {
        return apiFetch(`/presupuesto/constantes-sistema/${clave}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Conceptos Presupuestales
     */
    getConceptos: (options = {}) => {
        return apiFetch("/presupuesto/conceptos-presupuestal/", {
            method: 'GET',
            ...options
        });
    },
    updateConcepto: (concepto, data, options = {}) => {
        return apiFetch(`/presupuesto/conceptos-presupuestal/${concepto}/`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Realiza el cálculo de valuación presupuestaria
     * @param {number} meses - Número de meses (1-12)
     * @param {Array} plazas - Lista de {nivel: string, plazas: number}
     */
    calcularValuacion: (meses, plazas, options = {}) => {
        return apiFetch("/presupuesto/catalogo-plazas/calcular/", {
            method: 'POST',
            body: JSON.stringify({ meses, plazas }),
            ...options
        });
    }
};
