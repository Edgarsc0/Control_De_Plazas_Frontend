import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio para el catálogo de tipos de oficio y sus relaciones asunto-oficio.
 * Todas las peticiones pasan por `apiFetch`, que inyecta el token de sesión
 * (cookie `auth_token`) y resuelve la URL base del backend de Django.
 */
export const CatTipoOficioService = {
  /**
   * Obtiene el catálogo de tipos de asunto.
   * @param {RequestInit} [options={}] - Opciones extra para `fetch` (señal, headers, etc.).
   * @returns {Promise<Object[]>} Promesa con el arreglo de tipos de asunto (JSON parseado).
   */
  getTiposAsunto: async (options = {}) => {
    const res = await apiFetch('/cat-tipo-oficio/tipos-asunto/', {
      method: 'GET',
      ...options,
    });
    return res.json();
  },

  /**
   * Crea una relación entre un asunto del SCG y un tipo de asunto.
   * @param {number} idAsuntoSCG - Identificador del asunto en el Sistema de Control de Gestión.
   * @param {number} idTipoAsunto - Identificador del tipo de asunto a vincular.
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object>} Promesa con la relación creada (JSON parseado).
   */
  createRelacionAsuntoOficio: async (idAsuntoSCG, idTipoAsunto, options = {}) => {
    const res = await apiFetch('/cat-tipo-oficio/relaciones-asunto-oficio/', {
      method: 'POST',
      body: JSON.stringify({ idAsuntoSCG, idTipoAsunto }),
      ...options,
    });
    return res.json();
  },

  /**
   * Elimina una relación asunto-oficio por su identificador.
   * @param {number} idRelacion - Identificador de la relación a eliminar.
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<boolean>} `true` si la eliminación fue exitosa.
   * @throws {Error} Si la respuesta del servidor no es satisfactoria.
   */
  deleteRelacionAsuntoOficio: async (idRelacion, options = {}) => {
    const res = await apiFetch(`/cat-tipo-oficio/relaciones-asunto-oficio/${idRelacion}/`, {
      method: 'DELETE',
      ...options,
    });
    if (!res.ok) {
      throw new Error('Error al eliminar la relacion');
    }
    return true;
  },

  /**
   * Obtiene las relaciones asunto-oficio, opcionalmente filtradas por asunto.
   * @param {number} [idAsuntoSCG] - Si se provee, filtra por ese asunto del SCG.
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Promesa con el arreglo de relaciones (JSON parseado).
   */
  getRelacionesAsuntoOficio: async (idAsuntoSCG, options = {}) => {
    const endpoint = idAsuntoSCG
      ? `/cat-tipo-oficio/relaciones-asunto-oficio/?idAsuntoSCG=${idAsuntoSCG}`
      : '/cat-tipo-oficio/relaciones-asunto-oficio/';
    const res = await apiFetch(endpoint, { method: 'GET', ...options });
    return res.json();
  },

  /**
   * Obtiene el catálogo de asuntos de valuación.
   * @param {RequestInit} [options={}] - Opciones extra para `fetch`.
   * @returns {Promise<Object[]>} Promesa con el arreglo de asuntos de valuación (JSON parseado).
   */
  getAsuntosValuacion: async (options = {}) => {
    const res = await apiFetch('/cat-tipo-oficio/asuntos-valuacion/', {
      method: 'GET',
      ...options,
    });
    return res.json();
  },
};
