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
     * @param {{oficio?: string, nivel?: string, search?: string}} [params={}] - Sin params: dataset completo (cacheado 20 min). `search`: filtra en el backend (nombre/RFC/CURP/UA/etc., ver TableroRH.jsx) y no se cachea.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadosCompletosActivosDetalle: (params = {}, options = {}) => {
        return apiFetch(`/plantilla/empleados_completos_activos_detalle/${buildQuery(params)}`, {
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

    patchColumnaQuincenal: (posicion, columna, valorNuevo, options = {}) => {
        return apiFetch('/plantilla/plantilla_quincenal/columnas/', {
            method: 'PATCH',
            body: JSON.stringify({ posicion, columna, valor: valorNuevo }),
            ...options
        });
    },

    deleteColumnaQuincenal: (posicion, columna, options = {}) => {
        return apiFetch('/plantilla/plantilla_quincenal/columnas/', {
            method: 'DELETE',
            body: JSON.stringify({ posicion, columna }),
            ...options
        });
    },

    /**
     * Obtiene el historial completo de ediciones manuales (CeldaOverride) sobre
     * EMPLEADOS_COMPLETOS_SIG, para el modal "Historial de Cambios" del tab
     * Detalle. Incluye estadísticas agregadas (total de cambios, posiciones
     * afectadas, usuarios, columnas más editadas).
     * @param {Object} [params={}] - Filtros: search, columna, posicion, activo ('true'|'false'), limit, offset.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getEmpleadoCompletoOverrideHistorial: (params = {}, options = {}) => {
        return apiFetch(`/plantilla/empleados_completos_sig/override/historial/${buildQuery(params)}`, {
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
     * Obtiene la distribución de ocupación vs vacancia por Aduana, Nivel
     * Jerárquico y Nivel, para el subtab "Aduanas Ocupación vs Vacantes".
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getAduanasOcupacionVacancia: (options = {}) => {
        return apiFetch('/plantilla/aduanas_ocupacion_vacancia/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el historial de ediciones manuales (CeldaOverride) sobre MOV_POS
     * —hoy solo `fecha_anuencia`—, para el modal "Historial de Cambios" del tab
     * Mov. Posiciones. Misma forma de respuesta que el historial de
     * EMPLEADOS_COMPLETOS_SIG (count, resultados, estadisticas).
     * @param {Object} [params={}] - Filtros: search, columna, posicion, activo ('true'|'false'), limit, offset.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosOverrideHistorial: (params = {}, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_detalle/override/historial/${buildQuery(params)}`, {
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
     * Obtiene la fotografía de un empleado (carga bajo demanda, no en el listado).
     * Respuesta cruda: usar `.blob()` y convertir a Object URL para un <img>,
     * ya que este endpoint requiere el header Authorization que un <img src>
     * plano no puede enviar.
     * @param {string} numempleado
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>}
     */
    getEmpleadoFoto: (numempleado, options = {}) => {
        return apiFetch(`/plantilla/empleado_foto/${encodeURIComponent(numempleado)}/`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Datos personales (tabla DATOS_PERSONALES, importada de ZAFIRO) de un
     * empleado — cargados bajo demanda por el tab "Datos personales" del
     * expediente (EmployeeRecordModal).
     * @param {string|number} noEmpleado
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getDatosPersonales: (noEmpleado, options = {}) => {
        return apiFetch(`/plantilla/datos_personales/${encodeURIComponent(noEmpleado)}/`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Datos personales (tabla DATOS_PERSONALES) de VARIOS empleados en una
     * sola consulta — usado por la opción "Incluir datos personales" del
     * export a Excel de Plantilla Detalle (cruce por numempleado, 100%
     * client-side vía ExcelJS).
     * @param {(string|number)[]} noEmpleados
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `{ results: { [no_empleado]: {...} } }`.
     */
    getDatosPersonalesBulk: (noEmpleados, options = {}) => {
        return apiFetch('/plantilla/datos_personales_bulk/', {
            method: 'POST',
            body: JSON.stringify({ no_empleados: noEmpleados }),
            ...options
        });
    },

    /**
     * Edita una celda de DATOS_PERSONALES (Escolaridad/Contacto/Domicilio en
     * el tab "Datos personales" del expediente, permiso edit_datos_personales).
     * Registra el cambio en CeldaOverride y lo aplica de inmediato sobre la
     * fila viva; sobrevive a la siguiente importación de ZAFIRO.
     * @param {string|number} noEmpleado - Clave de negocio (columna `no_empleado`).
     * @param {string} columna - Nombre del campo del modelo a editar.
     * @param {*} valorNuevo - Nuevo valor de la celda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    patchDatosPersonalesOverride: (noEmpleado, columna, valorNuevo, options = {}) => {
        return apiFetch('/plantilla/datos_personales/override/', {
            method: 'POST',
            body: JSON.stringify({ no_empleado: noEmpleado, columna, valor_nuevo: valorNuevo }),
            ...options
        });
    },

    /**
     * Genera el Excel de Plantilla Detalle en el backend, opcionalmente con
     * fotografías de empleados embebidas en la celda (.xlsm con macro VBA).
     * Camino opt-in — el export normal (sin fotos) sigue siendo client-side.
     * @param {{posiciones: string[], columnas: {key:string,label:string}[], incluirFotos: boolean, incluirDatosPersonales?: boolean}} payload
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.blob()` para el archivo.
     */
    exportarPlantillaDetalleConFotos: ({ posiciones, columnas, incluirFotos, incluirDatosPersonales = false }, options = {}) => {
        return apiFetch('/plantilla/exportar_plantilla_detalle_con_fotos/', {
            method: 'POST',
            body: JSON.stringify({ posiciones, columnas, incluir_fotos: incluirFotos, incluir_datos_personales: incluirDatosPersonales }),
            ...options
        });
    },

    /**
     * Genera el Excel de Movimientos (tab "Movimientos", MovimientosPersonalTab)
     * en el backend, opcionalmente con fotografías embebidas. Reenvía los
     * MISMOS filtros que ya usa `getMovimientosPersonal` (no_pagination
     * forzado en el backend), para que el export refleje exactamente lo que
     * la tabla tiene filtrado en ese momento.
     * @param {object} filtros - Mismos query params que `getMovimientosPersonal`.
     * @param {{key:string,label:string}[]} columnas
     * @param {boolean} incluirFotos
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    exportarMovimientosPersonalConFotos: (filtros = {}, columnas, incluirFotos, options = {}) => {
        const query = buildQuery({
            ...filtros,
            incluir_fotos: incluirFotos ? 'true' : 'false',
            columnas: JSON.stringify(columnas),
        });
        return apiFetch(`/plantilla/exportar_movimientos_personal_con_fotos/${query}`, {
            method: 'GET',
            ...options
        });
    },

    /**
     * Genera el Excel de Empleados Bajas en el backend, opcionalmente con
     * fotografías embebidas.
     * @param {{ids: number[], columnas: {key:string,label:string}[], incluirFotos: boolean}} payload
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    exportarBajasConFotos: ({ ids, columnas, incluirFotos }, options = {}) => {
        return apiFetch('/plantilla/exportar_bajas_con_fotos/', {
            method: 'POST',
            body: JSON.stringify({ ids, columnas, incluir_fotos: incluirFotos }),
            ...options
        });
    },

    /**
     * Genera el Excel de un listado de empleados por posición (usado por el
     * componente compartido EmployeesModal — drill-down de Estatus Nómina y
     * de Cuadros de Vacancia), opcionalmente con fotografías embebidas.
     * @param {{posiciones: string[], columnas: {key:string,label:string}[], incluirFotos: boolean, permisoFoto: string}} payload
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    exportarEmpleadosPorPosicionConFotos: ({ posiciones, columnas, incluirFotos, permisoFoto }, options = {}) => {
        return apiFetch('/plantilla/exportar_empleados_por_posicion_con_fotos/', {
            method: 'POST',
            body: JSON.stringify({ posiciones, columnas, incluir_fotos: incluirFotos, permiso_foto: permisoFoto }),
            ...options
        });
    },

    /**
     * Edita manualmente la Fecha de Anuencia de una posición (por default es
     * fecha_vacancia + 30 días, calculada al vuelo). Persiste el override
     * (CeldaOverride) de forma independiente de MOV_POS, que se trunca y
     * recarga completa cada 30 min — el override sobrevive esa recarga sin
     * ningún trabajo extra porque nunca depende de esa tabla.
     * @param {string} noPosActual - Identificador estable de la posición (`Nº Pos Actual`).
     * @param {string} valorNuevo - Fecha 'YYYY-MM-DD'.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    patchFechaAnuenciaOverride: (noPosActual, valorNuevo, options = {}) => {
        return apiFetch('/plantilla/mov_pos_detalle/fecha_anuencia_override/', {
            method: 'POST',
            body: JSON.stringify({ no_pos_actual: noPosActual, valor_nuevo: valorNuevo }),
            ...options
        });
    },

    /**
     * Revierte la Fecha de Anuencia de una posición al cálculo automático
     * (fecha_vacancia + 30 días), desactivando el override manual vigente.
     * @param {string} noPosActual - Identificador estable de la posición (`Nº Pos Actual`).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    deleteFechaAnuenciaOverride: (noPosActual, options = {}) => {
        return apiFetch('/plantilla/mov_pos_detalle/fecha_anuencia_override/', {
            method: 'DELETE',
            body: JSON.stringify({ no_pos_actual: noPosActual }),
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
     * Obtiene la serie histórica mensual (fin de mes, desde 2022-01) de
     * plazas totales/activas/inactivas/ocupadas/vacantes.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getConteoPlazasHistoricoSerie: (options = {}) => {
        return apiFetch('/plantilla/conteo_plazas_historico_serie/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Obtiene el detalle de posiciones que se crearon (activas) o
     * desactivaron (inactivas) entre dos cortes mensuales consecutivos.
     * @param {{tipo: 'creacion'|'desactivacion', fechaActual: string, fechaAnterior: string}} params
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getPlazasMovimientoMes: ({ tipo, fechaActual, fechaAnterior }, options = {}) => {
        return apiFetch(`/plantilla/plazas_movimiento_mes/${buildQuery({ tipo, fecha_actual: fechaActual, fecha_anterior: fechaAnterior })}`, {
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
     * Obtiene el detalle del registro decisivo que originó la fecha de
     * ocupación vigente de un renglón de MOV_POS.
     * @param {string|number} id - Id del renglón de MOV_POS (no el id_registro_des_fecha_ocupacion).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getMovPosOcupacionDetalle: (id, options = {}) => {
        return apiFetch(`/plantilla/mov_pos_ocupacion_detalle/?id=${id}`, {
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
     * @param {Object} [params={}] - Parámetros extra.
     * @param {('arriba'|'abajo')} [params.direction='arriba'] - 8.5 QA: 'arriba' (jefes, Bottom-Up, camino único) o 'abajo' (subordinados directos+indirectos, árbol completo).
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    getCadenaMando: (query, { direction = 'arriba' } = {}, options = {}) => {
        return apiFetch(`/plantilla/cadena_mando/?q=${encodeURIComponent(query)}&direction=${encodeURIComponent(direction)}`, {
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
     * Busca empleados por nombre/número devolviendo su ubicación geográfica (lat/long).
     * @param {string} query - Texto de búsqueda.
     * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()`.
     */
    searchEmpleadosGeografia: (query, options = {}) => {
        return apiFetch(`/plantilla/empleados_geografia_search/?q=${encodeURIComponent(query)}`, {
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
    },

    /**
     * Suscripciones ACTIVAS del usuario autenticado a "Notificarme cuando la
     * posición quede vacante/se ocupe" (menú contextual columna Posición).
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `[{id, posicion, tipo, creado_en}]`.
     */
    getMisSuscripcionesPosicion: (options = {}) => {
        return apiFetch('/plantilla/suscripciones-posicion/', {
            method: 'GET',
            ...options
        });
    },

    /**
     * Crea una suscripción de notificación por correo para una posición.
     * Idempotente del lado backend: si ya existe una activa igual, la
     * devuelve tal cual (`ya_existia: true`) en vez de duplicarla.
     * @param {string} posicion - Nº Pos Actual / Posición.
     * @param {'VACANTE'|'OCUPACION'} tipo
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` -> `{id, posicion, tipo, ya_existia}`.
     */
    crearSuscripcionPosicion: (posicion, tipo, options = {}) => {
        return apiFetch('/plantilla/suscripciones-posicion/', {
            method: 'POST',
            body: JSON.stringify({ posicion, tipo }),
            ...options
        });
    },

    /**
     * Cancela (soft delete) una suscripción propia.
     * @param {number} id
     * @param {RequestInit} [options={}]
     * @returns {Promise<Response>}
     */
    cancelarSuscripcionPosicion: (id, options = {}) => {
        return apiFetch(`/plantilla/suscripciones-posicion/${id}/`, {
            method: 'DELETE',
            ...options
        });
    }
};
