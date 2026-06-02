/**
 *
 * Servicio para interactuar con el backend de Control de Gestión, específicamente para la gestión de movimientos de personal por oficios.
 *
 */

import { CatTipoOficioService } from './cat_tipo_oficio.service';

const djangoApi =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api';

export const ControlGestionService = {
  /** Obtener Unidades Responsables desde Django */
  getUnidadesResponsables: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/unidad-responsable/`);
    return res.json();
  },

  /** Obtener Instrucciones desde Django */
  getInstrucciones: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/instruccion/`);
    return res.json();
  },

  /** Obtener Prioridades desde Django */
  getPrioridades: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/prioridad/`);
    return res.json();
  },

  /** Obtener Temas desde Django */
  getTemas: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/tema/`);
    return res.json();
  },

  /** Obtener Status Turnado desde Django */
  getStatusTurnados: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/status-turnado/`);
    return res.json();
  },

  /** Obtener Medios de Recepción desde Django */
  getMediosRecepcion: async () => {
    const res = await fetch(`${djangoApi}/control-gestion/medio-recepcion/`);
    return res.json();
  },

  /** Devuelve la lista de oficios turnados cruzada con los catálogos de Django */
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

    // 1. Obtener la respuesta original
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CONTROL_DE_GESTION_API_URL}/catalogo/busquedaAvanzadaTurnados`,
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
  getExpedienteAsunto: async (idAsunto) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CONTROL_DE_GESTION_API_URL}/asunto/consultarExpedienteAsunto`,
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

  /** Obtener el blob de un documento para previsualizarlo */
  getVisualizarDocumento: async (idAsunto, relativePath) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CONTROL_DE_GESTION_API_URL}/asunto/verDocumento`,
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
