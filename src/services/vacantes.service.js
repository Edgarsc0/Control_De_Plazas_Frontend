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
     * Edita una celda de EMPLEADOS_COMPLETOS_SIG (tab Plantilla Detalle).
     * Registra el cambio en CeldaOverride y lo aplica de inmediato sobre la
     * fila viva; sobrevive a la siguiente importación de ZAFIRO.
     * @param {string} posicion - Clave de negocio (columna `Posición`).
     * @param {string} columna - Nombre del campo del modelo a editar.
     * @param {*} valorNuevo - Nuevo valor de la celda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    patchEmpleadoCompletoOverride: (posicion, columna, valorNuevo, options = {}) => {
        return apiFetch('/plantilla/empleados_completos_sig/override/', {
            method: 'POST',
            body: JSON.stringify({ posicion, columna, valor_nuevo: valorNuevo }),
            ...options
        });
    },

    /**
     * Borra el contenido de una celda de EMPLEADOS_COMPLETOS_SIG (tab Plantilla
     * Detalle): pone la columna en NULL sobre la fila viva y elimina el
     * historial de CeldaOverride de esa celda (no solo lo desactiva).
     * @param {string} posicion - Clave de negocio (columna `Posición`).
     * @param {string} columna - Nombre del campo del modelo a borrar.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    deleteEmpleadoCompletoOverride: (posicion, columna, options = {}) => {
        return apiFetch('/plantilla/empleados_completos_sig/override/', {
            method: 'DELETE',
            body: JSON.stringify({ posicion, columna }),
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

    exportMovPosExcel: (query = {}, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_detalle/export_excel/${buildQuery(query)}`, {
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
     * Obtiene el desglose jerárquico de posiciones OCUPADAS de la plantilla.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getDesgloseJerarquicoOcupados: (options = {}) => {
        return apiFetch('/plantilla/desglose_jerarquico_ocupados/', {
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
     * Obtiene el detalle dinámico (por categoría A/B/C) del registro decisivo
     * que originó la fecha de vacancia de un renglón de MOV_POS.
     * @param {string|number} id - Id del renglón de MOV_POS (no el idRegistroDesicivo).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosVacanciaDetalle: (id, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_vacancia_detalle/?id=${id}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Comprobar Alineación Organizacional: cruza cada plaza activa de MOV_POS
     * con su fila en EMPLEADOS_COMPLETOS_SIG y compara los 14 campos que
     * deberían coincidir entre ambas tablas.
     * @param {Object<string, (string|number)>} [query={}] - Filtros a aplicar (se omiten vacíos).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosAlineacion: (query = {}, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_alineacion/${buildQuery(query)}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Histórico diario del % de Alineación General (1 fila por día, poblado
     * por la tarea Celery `importar_zafiro` cada vez que corre).
     * @param {Object<string, (string|number)>} [query={}] - p.ej. { dias: 90 }.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosAlineacionHistorico: (query = {}, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_alineacion_historico/${buildQuery(query)}`, {
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
    },

    /**
     * Historial completo de empleados desde cp_tbl_mov_completo_29_05_26 via raw SQL.
     * Sin filtro de año. Ordenado por num_empleado, fecha_efectiva, sec ASC.
     * @param {string[]} numEmpleadoList - Array de num_empleado
     * @returns {Promise<Response>}
     */
    getOrganigramaDeptos: (options = {}) => {
        return apiFetch(`/plantilla/organigrama-deptos/`, { method: 'GET', ...options });
    },

    getCatAcciones: (options = {}) => {
        return apiFetch(`/plantilla/cat-acciones/`, { method: 'GET', ...options });
    },

    getCatAccionesMotivos: (options = {}) => {
        return apiFetch(`/plantilla/cat-acciones-motivos/`, { method: 'GET', ...options });
    },

    getMovimientosPersonalHistorial: (numEmpleadoList = [], options = {}) => {
        return apiFetch(`/plantilla/movimientos-personal/historial/`, {
            method: 'POST',
            body: JSON.stringify({ num_empleado: numEmpleadoList }),
            ...options
        });
    }
};
