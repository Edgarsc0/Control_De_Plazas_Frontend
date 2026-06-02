import { apiFetch } from "@/lib/fetch-interceptor";

export const PlantillaService = {
    /**
     * Obtiene todos los registros de la plantilla de 1800 plazas
     */
    getPlantilla1800: (options = {}) => {
        return apiFetch("/plantilla/plantilla_1800_plazas_list/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Actualiza uno o varios registros de la plantilla
     * @param {Object|Array} data - Objeto o lista de objetos con id y campos a actualizar
     */
    updatePlantilla1800: (data, options = {}) => {
        return apiFetch("/plantilla/plantilla_1800_plazas_list/", {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Exporta datos JSON a un archivo Excel (.xlsx) real usando el backend
     */
    exportExcel: (data, filename = "Plantilla.xlsx") => {
        return apiFetch(`/plantilla/export/excel/?filename=${encodeURIComponent(filename)}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * Obtiene la última fecha de actualización exitosa de ZAFIRO
     */
    getUltimaActualizacion: (options = {}) => {
        return apiFetch("/plantilla/bitacora/ultima/", {
            method: 'GET',
            ...options
        });
    }
};
