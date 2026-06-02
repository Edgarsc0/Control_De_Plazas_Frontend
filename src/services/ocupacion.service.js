import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio encargado de obtener la ocupación por oficios de las 1800 plazas
 */
export const OcupacionService = {
    /**
     * Obtiene el resumen dinámico de ocupación por oficios con desglose por nivel
     */
    getOcupacionPorOficios: (options = {}) => {
        return apiFetch("/plantilla/ocupacion_por_oficios_resumen/",
            {
                method: 'GET',
                ...options
            }
        )
    }

}
