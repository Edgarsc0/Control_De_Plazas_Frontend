import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio encargado de obtener la ocupación por oficios de las 1800 plazas.
 * Las peticiones pasan por `apiFetch`, que inyecta el token de sesión.
 */
export const OcupacionService = {
    /**
     * Obtiene el resumen dinámico de ocupación por oficios con desglose por nivel.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    getOcupacionPorOficios: (options = {}) => {
        return apiFetch("/plantilla/ocupacion_por_oficios_resumen/", {
            method: 'GET',
            ...options
        });
    }
};
