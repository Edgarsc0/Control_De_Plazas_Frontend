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
     * @param {Object} [opts]
     * @param {boolean} [opts.stickyColumn=true] - Si es false, no congela la columna A (solo el encabezado).
     * @returns {Promise<Response>} Respuesta cruda; usar `.blob()` para el archivo.
     */
    exportExcel: (data, filename = "Plantilla.xlsx", { stickyColumn = true } = {}) => {
        const params = new URLSearchParams({ filename });
        if (!stickyColumn) params.set("sticky_column", "0");
        return apiFetch(`/plantilla/export/excel/?${params.toString()}`, {
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
     * @param {string} [vista="institucional"] - "institucional" (manual/curada, editable),
     * "alineacion" (recalculada en vivo desde el determinante real, solo lectura)
     * o "sig" (igual algoritmo que institucional, filtrado a filas isSIGInfo=1, solo lectura).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el árbol.
     */
    getOrganigramaTree: (unidadNegocio, vista = "institucional", options = {}) => {
        const params = new URLSearchParams({ unidad_negocio: unidadNegocio, vista });
        return apiFetch(`/plantilla/organigrama-tree/?${params.toString()}`, {
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
    },

    /**
     * Catálogo dinámico de unidades de negocio (una por lienzo del organigrama),
     * resuelto en el backend a partir de las raíces reales de ORGANIGRAMA_ANAM.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para [{id, label}, ...].
     */
    getOrganigramaUnidades: (options = {}) => {
        return apiFetch("/plantilla/organigrama-unidades/", {
            method: 'GET',
            ...options
        });
    },

    /**
     * Crea un nuevo nodo en ORGANIGRAMA_ANAM aplicando la regla de negocio del
     * determinante (ver plantilla/views.py OrganigramaCrearNodoView).
     * @param {object} data - { tipo, parent_departamento?, unidad_negocio?, departamento?, descripcion_larga, unidad_administrativa?, doaf?, num_posicion_gerente? }
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el nodo creado.
     */
    crearOrganigramaNodo: (data, options = {}) => {
        return apiFetch("/plantilla/organigrama-crear-nodo/", {
            method: 'POST',
            body: JSON.stringify(data),
            ...options
        });
    },

    /**
     * Busca empleados activos en EMPLEADOS_COMPLETOS_SIG por nombre, posición
     * o número de empleado (mínimo 3 caracteres), para reasignar plazas del
     * organigrama.
     * @param {string} query - Texto de búsqueda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para `{ results }`.
     */
    searchEmpleados: (query, options = {}) => {
        return apiFetch(`/plantilla/empleados-search/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    }
};
