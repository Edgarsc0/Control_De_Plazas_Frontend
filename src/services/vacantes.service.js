import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Construye un query string a partir de un objeto, omitiendo valores vacíos
 * (`undefined`, `null` o cadena vacía).
 * @param {Object<string, (string|number)>} params - Pares clave/valor a serializar.
 * @returns {string} Query string con `?` inicial, o cadena vacía si no hay parámetros.
 */
const buildQuery = (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            queryParams.append(key, val);
        }
    });
    const qs = queryParams.toString();
    return qs ? `?${qs}` : '';
};

/**
 * Servicio encargado de la lógica de vacantes, estatus de nómina, movimientos de
 * personal y vistas de la Torre Caballito. Todas las peticiones pasan por
 * `apiFetch`, que inyecta el token de sesión (cookie `auth_token`).
 *
 * Nota: cada método devuelve la `Response` cruda; el consumidor debe llamar a
 * `.json()` (o `.blob()` para exportaciones) para obtener los datos.
 */
export const VacantesService = {
    /**
     * Obtiene el resumen de vacantes agrupado por nivel.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getVacantesPorNivelResumen: (options = {}) => {
        return apiFetch('/plantilla/estatus_nomina_por_nivel/resumen', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el resumen de estatus de nómina para empleados completos.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosCompletosEstatusResumen: (options = {}) => {
        return apiFetch('/plantilla/empleados_completos_estatus_resumen/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el detalle completo de vacantes por nivel.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getVacantesPorNivelCompleto: (options = {}) => {
        return apiFetch('/plantilla/estatus_nomina_por_nivel/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene los empleados filtrados por nivel y estado de nómina.
     * @param {string|number} nivel - Nivel jerárquico a filtrar.
     * @param {string} estado_nomina - Estado de nómina a filtrar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosPorNivelYEstatus: (nivel, estado_nomina, options = {}) => {
        return apiFetch(`/plantilla/empleados_por_nivel_y_estatus/?nivel=${nivel}&estado_nomina=${estado_nomina}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Exporta el estatus de nómina a Excel generado por el backend.
     * @param {string} [uas=''] - Lista de unidades administrativas separadas por coma.
     * @param {string} [levels=''] - Lista de niveles separados por coma.
     * @param {string} [groupBy='ua'] - Criterio de agrupación (`ua` por defecto).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.blob()` para el archivo.
     */
    exportarEstatusExcel: (uas = '', levels = '', groupBy = 'ua', options = {}) => {
        return apiFetch(`/plantilla/exportar_estatus_excel/?uas=${encodeURIComponent(uas)}&levels=${encodeURIComponent(levels)}&group_by=${groupBy}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el detalle de empleados en posiciones activas.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosCompletosActivosDetalle: (options = {}) => {
        return apiFetch('/plantilla/empleados_completos_activos_detalle/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el resumen de estatus de nómina por nivel y unidad administrativa.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosEstatusPorNivelUa: (options = {}) => {
        return apiFetch('/plantilla/empleados_estatus_por_nivel_ua/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene la distribución geográfica de los empleados.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosDistribucionGeografica: (options = {}) => {
        return apiFetch('/plantilla/empleados_distribucion_geografica/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el detalle de movimientos de posiciones según filtros dinámicos.
     * @param {Object<string, (string|number)>} [query={}] - Filtros a aplicar (se omiten vacíos).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosDetalle: (query = {}, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_detalle/${buildQuery(query)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el cuadro de vacancia.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getCuadroVacancia: (options = {}) => {
        return apiFetch('/plantilla/cuadro_vacancia/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el desglose jerárquico de la plantilla.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getDesgloseJerarquico: (options = {}) => {
        return apiFetch('/plantilla/desglose_jerarquico/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el histórico de movimientos de una posición.
     * @param {string|number} posicion - Identificador de la posición.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosHistoria: (posicion, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_historia/?posicion=${posicion}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene la cadena de mando para una búsqueda dada.
     * @param {string} query - Texto de búsqueda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getCadenaMando: (query, options = {}) => {
        return apiFetch(`/plantilla/cadena_mando/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene las bajas registradas en SIG.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getBajasSig: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el catálogo de motivos de baja de SIG.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getBajasMotivos: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/motivos/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el histórico de bajas de SIG.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getBajasHistorico: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/historico/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene los datos para la visualización 3D de la Torre Caballito.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getTorreCaballito3D: (options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene los empleados de un piso y unidad administrativa de la Torre Caballito.
     * @param {string|number} piso - Piso a consultar.
     * 
     * @param {string} ua - Unidad administrativa.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getTorreCaballitoEmpleados: (piso, ua, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/empleados/?piso=${encodeURIComponent(piso)}&ua=${encodeURIComponent(ua)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Busca empleados/posiciones dentro de la Torre Caballito.
     * @param {string} query - Texto de búsqueda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    searchTorreCaballito: (query, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/search/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene las estadísticas de movimientos de personal según filtros.
     * @param {Object<string, (string|number)>} [params={}] - Filtros a aplicar (se omiten vacíos).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovimientosPersonalStats: (params = {}, options = {}) => {
        return apiFetch(`/plantilla/movimientos-personal/stats/${buildQuery(params)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el listado de movimientos de personal según filtros.
     * @param {Object<string, (string|number)>} [params={}] - Filtros a aplicar (se omiten vacíos).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovimientosPersonal: (params = {}, options = {}) => {
        return apiFetch(`/plantilla/movimientos-personal/${buildQuery(params)}`, {
            method: 'GET',
            ...options
        });
    }
};
