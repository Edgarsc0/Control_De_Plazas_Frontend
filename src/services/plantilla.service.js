import { apiFetch } from "@/lib/fetch-interceptor";

/**
 * Servicio para la plantilla de 1800 plazas y datos derivados (organigrama,
 * exportaciones y bitácora). Todas las peticiones pasan por `apiFetch`, que
 * inyecta el token de sesión (cookie `auth_token`).
 */
export const PlantillaService = {
    /**
     * Obtiene todos los registros de la plantilla de 1800 plazas.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    getPlantilla1800: (options = {}) => {
        return apiFetch("/plantilla/plantilla_1800_plazas_list/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Actualiza uno o varios registros de la plantilla.
     * @param {Object|Object[]} data - Objeto (o lista) con `id` y los campos a actualizar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    updatePlantilla1800: (data, options = {}) => {
        return apiFetch("/plantilla/plantilla_1800_plazas_list/", {
            method: 'PATCH',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Exporta datos JSON a un archivo Excel (.xlsx) real generado por el backend.
     * @param {Object[]} data - Filas a exportar.
     * @param {string} [filename="Plantilla.xlsx"] - Nombre del archivo de salida.
     * @returns {Promise<Response>} Respuesta cruda; usar `.blob()` para el archivo.
     */
    exportExcel: (data, filename = "Plantilla.xlsx") => {
        return apiFetch(`/plantilla/export/excel/?filename=${encodeURIComponent(filename)}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * Obtiene la última fecha de actualización exitosa de ZAFIRO.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    getUltimaActualizacion: (options = {}) => {
        return apiFetch("/plantilla/bitacora/ultima/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el catálogo global del organigrama para la búsqueda en memoria.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el arreglo de nodos.
     */
    getOrganigramaSearch: (options = {}) => {
        return apiFetch("/plantilla/organigrama_search/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el árbol jerárquico completo (nodo raíz con `subordinados` anidados)
     * de una unidad de negocio, construido en el backend desde ORGANIGRAMA_ANAM.
     * @param {string} unidadNegocio - Código de la unidad de negocio (p.ej. "00900").
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el árbol.
     */
    getOrganigramaTree: (unidadNegocio, options = {}) => {
        return apiFetch(`/plantilla/organigrama-tree/?unidad_negocio=${encodeURIComponent(unidadNegocio)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Dado un número de plaza, indica si está activa hoy (MOV_POS_LATEST) y,
     * de estarlo, el ocupante actual en EMPLEADOS_COMPLETOS_SIG.
     * @param {string} posicion - Número de plaza (posición).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para los datos.
     */
    getOrganigramaPosicionInfo: (posicion, options = {}) => {
        return apiFetch(`/plantilla/organigrama-posicion-info/?posicion=${encodeURIComponent(posicion)}`, {
            method: 'GET',
            ...options
        });
    }
};
