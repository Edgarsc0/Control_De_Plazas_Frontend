import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio para información de sistema (versión de código desplegada).
 */
export const SystemService = {
    /**
     * Obtiene el commit más reciente entre back y front (fecha + mensaje).
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    getLastUpdate: (options = {}) => {
        return apiFetch("/system/last-update/", {
            method: 'GET',
            ...options
        });
    },
};
