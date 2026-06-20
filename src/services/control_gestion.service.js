/**
 * Servicio para Control de Gestión (movimientos de personal por oficios).
 *
 * Convive con DOS backends:
 *  - Backend propio de Django: se accede vía `apiFetch`, que inyecta el token
 *    de sesión (cookie `auth_token`). Son los catálogos.
 *  - API externa de Control de Gestión (`NEXT_PUBLIC_CONTROL_DE_GESTION_API_URL`):
 *    host y esquema de autenticación distintos (header `Origin`, sin token de
 *    sesión). `apiFetch` apunta sólo al backend de Django, por lo que estas
 *    llamadas se mantienen con `fetch` directo de forma intencional.
 */

import { apiFetch } from '@/lib/fetch-interceptor';
import { CatTipoOficioService } from './cat_tipo_oficio.service';

const CG_API_URL = process.env.NEXT_PUBLIC_CONTROL_DE_GESTION_API_URL;

export const ControlGestionService = {
  /**
   * Obtiene el catálogo de Unidades Responsables (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de unidades responsables (JSON parseado).
   */
  getUnidadesResponsables: async (options = {}) => {
    const res = await apiFetch('/control-gestion/unidad-responsable/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de Instrucciones (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de instrucciones (JSON parseado).
   */
  getInstrucciones: async (options = {}) => {
    const res = await apiFetch('/control-gestion/instruccion/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de Prioridades (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de prioridades (JSON parseado).
   */
  getPrioridades: async (options = {}) => {
    const res = await apiFetch('/control-gestion/prioridad/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de Temas (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de temas (JSON parseado).
   */
  getTemas: async (options = {}) => {
    const res = await apiFetch('/control-gestion/tema/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de Status de Turnado (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de status de turnado (JSON parseado).
   */
  getStatusTurnados: async (options = {}) => {
    const res = await apiFetch('/control-gestion/status-turnado/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de Medios de Recepción (backend Django).
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Arreglo de medios de recepción (JSON parseado).
   */
  getMediosRecepcion: async (options = {}) => {
    const res = await apiFetch('/control-gestion/medio-recepcion/', { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Devuelve la lista de oficios turnados desde la API externa de Control de
   * Gestión y la cruza con los catálogos de Django para enriquecer cada registro
   * (clasificación, unidad responsable, instrucción, prioridad, etc.).
   *
   * Llama a la API externa (`fetch` directo intencional, ver nota del módulo).
   *
   * @param {Object} [options={}] - Parámetros de búsqueda y bandera de control.
   * @param {number} [options.idUnidadResponsable=11]
   * @param {?string} [options.fechaInicio=null]
   * @param {?string} [options.fechaFin=null]
   * @param {?string} [options.folio=null]
   * @param {string} [options.ordenamiento='fecha']
   * @param {string} [options.direccion='DESC']
   * @param {number} [options.limite=10000]
   * @param {number} [options.offset=0]
   * @param {boolean} [options.skipCatalogCross] - Si es `true`, omite el cruce con catálogos.
   * @returns {Promise<Object>} Respuesta de la API externa (JSON), con
   *   `model.detalleTurnados` enriquecido salvo que `skipCatalogCross` sea `true`.
   */
  getOficiosTurnados: async (options = {}) => {
    const defaultOptions = {
      idUnidadResponsable: 11,
      fechaInicio: null,
      fechaFin: null,
      folio: null,
      ordenamiento: 'fecha',
      direccion: 'DESC',
      limite: 10000,
      offset: 0,
      idUnidadResponsableUsuario: '1',
      idUsuario: 9999,
      idUsuarioRol: 1,
    };
    const { skipCatalogCross, ...finalOptions } = { ...defaultOptions, ...options };

    // 1. Obtener la respuesta original (API externa de Control de Gestión)
    const response = await fetch(
      `${CG_API_URL}/catalogo/busquedaAvanzadaTurnados`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
        },
        body: JSON.stringify(finalOptions),
      },
    );
    const data = await response.json();

    if (skipCatalogCross) {
      return data;
    }

    if (data.status === 200 && data.model && data.model.detalleTurnados) {
      try {
        // 2. Obtener los catálogos usando las nuevas funciones
        const [
          unidadesResponsables,
          instrucciones,
          prioridades,
          temas,
          statusTurnados,
          medios,
          tiposAsunto,
          relacionesAsunto,
        ] = await Promise.all([
          ControlGestionService.getUnidadesResponsables(),
          ControlGestionService.getInstrucciones(),
          ControlGestionService.getPrioridades(),
          ControlGestionService.getTemas(),
          ControlGestionService.getStatusTurnados(),
          ControlGestionService.getMediosRecepcion(),
          CatTipoOficioService.getTiposAsunto(),
          CatTipoOficioService.getRelacionesAsuntoOficio(),
        ]);

        // Mapear los catálogos para búsqueda rápida (asumiendo arrays de resultados)
        const mapCatalog = (catalog, idKey) => {
          const arr = Array.isArray(catalog) ? catalog : catalog.results || [];
          return arr.reduce((acc, item) => {
            acc[item[idKey]] = item;
            return acc;
          }, {});
        };

        const urMap = mapCatalog(unidadesResponsables, 'idunidadresponsable');
        const instruccionMap = mapCatalog(instrucciones, 'idinstruccion');
        const prioridadMap = mapCatalog(prioridades, 'idprioridad');
        const temaMap = mapCatalog(temas, 'idtema');
        const statusMap = mapCatalog(statusTurnados, 'idstatusturnado');
        const medioMap = mapCatalog(medios, 'idmediorecepcion');
        const tipoAsuntoMap = mapCatalog(tiposAsunto, 'id');

        // Mapear relaciones por idAsuntoSCG
        const relacionesArr = Array.isArray(relacionesAsunto)
          ? relacionesAsunto
          : relacionesAsunto.results || [];
        const relacionMap = relacionesArr.reduce((acc, item) => {
          acc[item.idAsuntoSCG] = item;
          return acc;
        }, {});

        // 3. Cruzar los datos con detalleTurnados
        data.model.detalleTurnados = data.model.detalleTurnados.map(
          (turnado) => {
            const relacion = relacionMap[turnado.idAsunto];
            const tipoAsunto = relacion
              ? tipoAsuntoMap[relacion.idTipoAsunto]
              : null;

            return {
              ...turnado,
              // Clasificación personalizada
              clasificacion: tipoAsunto ? tipoAsunto.nombre : null,

              // Datos cruzados de Unidad Responsable
              _unidadResponsable: turnado.idUnidadResponsable
                ? urMap[turnado.idUnidadResponsable]
                : null,
              nombreUnidadResponsable:
                turnado.idUnidadResponsable &&
                  urMap[turnado.idUnidadResponsable]
                  ? urMap[turnado.idUnidadResponsable].unidadresponsable
                  : null,

              // Datos cruzados de Instrucción
              _instruccion: turnado.idInstruccion
                ? instruccionMap[turnado.idInstruccion]
                : null,
              nombreInstruccionCruzada:
                turnado.idInstruccion && instruccionMap[turnado.idInstruccion]
                  ? instruccionMap[turnado.idInstruccion].instruccion
                  : turnado.nombreInstruccion,

              // Datos cruzados de Prioridad (Turnado)
              _prioridad: turnado.idTipoPrioridad
                ? prioridadMap[turnado.idTipoPrioridad]
                : null,

              // Datos cruzados adicionales del asunto
              _asuntoTema: turnado.asuntoIdTema
                ? temaMap[turnado.asuntoIdTema]
                : null,
              _asuntoMedio: turnado.asuntoIdMedio
                ? medioMap[turnado.asuntoIdMedio]
                : null,
              _asuntoPrioridad: turnado.asuntoIdPrioridad
                ? prioridadMap[turnado.asuntoIdPrioridad]
                : null,
            };
          },
        );
      } catch (error) {
        console.error('Error cruzando catálogos de Control de Gestión:', error);
        // Retornar la data original si falla el cruce
      }
    }

    return data;
  },

  /**
   * Consulta el expediente de un asunto en la API externa de Control de Gestión.
   * `fetch` directo intencional (API externa, ver nota del módulo).
   * @param {number} idAsunto - Identificador del asunto a consultar.
   * @returns {Promise<Object>} Expediente del asunto (JSON parseado).
   */
  getExpedienteAsunto: async (idAsunto) => {
    const response = await fetch(
      `${CG_API_URL}/asunto/consultarExpedienteAsunto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
        },
        body: JSON.stringify({ idAsunto }),
      },
    );
    const data = await response.json();
    return data;
  },

  /**
   * Obtiene el blob de un documento para previsualizarlo (API externa de CG).
   * `fetch` directo intencional (API externa, ver nota del módulo).
   * @param {number} idAsunto - Identificador del asunto dueño del documento.
   * @param {string} relativePath - Ruta relativa del documento en el repositorio de CG.
   * @returns {Promise<Blob>} Blob binario del documento.
   * @throws {Error} Si la respuesta del servidor no es satisfactoria.
   */
  getVisualizarDocumento: async (idAsunto, relativePath) => {
    const response = await fetch(
      `${CG_API_URL}/asunto/verDocumento`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: process.env.NEXT_PUBLIC_FRONTEND_URL,
        },
        body: JSON.stringify({ id: idAsunto, relativePath }),
      },
    );
    if (!response.ok) throw new Error('Error al obtener el documento');
    return response.blob();
  },
};
