import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio encargado de la lógica de vacantes
 */
export const VacantesService = {
    /**
     * Obtiene el resumen de las vacantes por nivel
     */
    getVacantesPorNivelResumen: (options = {}) => {
        return apiFetch('/plantilla/estatus_nomina_por_nivel/resumen',
            {
                method: 'GET',
                ...options
            }
        );
    },
    /**
     * Obtiene el resumen de estatus de nómina para empleados completos
     */
    getEmpleadosCompletosEstatusResumen: (options = {}) => {
        return apiFetch('/plantilla/empleados_completos_estatus_resumen/', {
            method: 'GET',
            ...options
        });
    },
    getVacantesPorNivelCompleto: (options = {}) => {
        return apiFetch('/plantilla/estatus_nomina_por_nivel/', {
            method: 'GET',
            ...options
        });
    },
    /**
     * Obtiene los empleados filtrados por nivel y estado de nómina
     */
    getEmpleadosPorNivelYEstatus: (nivel, estado_nomina, options = {}) => {
        return apiFetch(`/plantilla/empleados_por_nivel_y_estatus/?nivel=${nivel}&estado_nomina=${estado_nomina}`, {
            method: 'GET',
            ...options
        });
    },
    exportarEstatusExcel: (uas = '', levels = '', groupBy = 'ua', options = {}) => {
        return apiFetch(`/plantilla/exportar_estatus_excel/?uas=${encodeURIComponent(uas)}&levels=${encodeURIComponent(levels)}&group_by=${groupBy}`, {
            method: 'GET',
            ...options
        });
    },
    /**
     * Obtiene el detalle de empleados en posiciones activas
     */
    getEmpleadosCompletosActivosDetalle: (options = {}) => {
        return apiFetch('/plantilla/empleados_completos_activos_detalle/', {
            method: 'GET',
            ...options
        });
    },
    /**
     * Obtiene el resumen de estatus de nómina por nivel y UA
     */
    getEmpleadosEstatusPorNivelUa: (options = {}) => {
        return apiFetch('/plantilla/empleados_estatus_por_nivel_ua/', {
            method: 'GET',
            ...options
        });
    },
    getEmpleadosDistribucionGeografica: (options = {}) => {
        return apiFetch('/plantilla/empleados_distribucion_geografica/', {
            method: 'GET',
            ...options
        });
    },
    getMovPosDetalle: (options = {}) => {
        return apiFetch('/plantilla/mov_pos_detalle/', {
            method: 'GET',
            ...options
        });
    },
    getMovPosHistoria: (posicion, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_historia/?posicion=${posicion}`, {
            method: 'GET',
            ...options
        });
    },
    getCadenaMando: (query, options = {}) => {
        return apiFetch(`/plantilla/cadena_mando/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    },
    getBajasSig: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/', {
            method: 'GET',
            ...options
        });
    },
    getBajasMotivos: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/motivos/', {
            method: 'GET',
            ...options
        });
    },
    getBajasHistorico: (options = {}) => {
        return apiFetch('/plantilla/bajas_sig/historico/', {
            method: 'GET',
            ...options
        });
    },
    getTorreCaballito3D: (options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/`, {
            method: 'GET',
            ...options
        });
    },
    getTorreCaballitoEmpleados: (piso, ua, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/empleados/?piso=${encodeURIComponent(piso)}&ua=${encodeURIComponent(ua)}`, {
            method: 'GET',
            ...options
        });
    },
    searchTorreCaballito: (query, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/search/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    },
    getMovimientosPersonalStats: (params = {}, options = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                queryParams.append(key, val);
            }
        });
        const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return apiFetch(`/plantilla/movimientos-personal/stats/${queryStr}`, {
            method: 'GET',
            ...options
        });
    },
    getMovimientosPersonal: (params = {}, options = {}) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                queryParams.append(key, val);
            }
        });
        const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return apiFetch(`/plantilla/movimientos-personal/${queryStr}`, {
            method: 'GET',
            ...options
        });
    }
};

