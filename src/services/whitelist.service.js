import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio de administración de la whitelist (correos autorizados + rol + UA asignados).
 */
export const WhitelistService = {
    list: () => apiFetch('/auth/whitelist/'),

    create: (payload) =>
        apiFetch('/auth/whitelist/', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    update: (id, payload) =>
        apiFetch(`/auth/whitelist/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),

    remove: (id) =>
        apiFetch(`/auth/whitelist/${id}/`, {
            method: 'DELETE',
        }),

    /**
     * Reasigna el rol de un usuario de la whitelist.
     * @param {number} id - id de la entrada de whitelist
     * @param {number} rolId - id del Group (rol) a asignar
     */
    assignRole: (id, rolId) =>
        apiFetch(`/auth/whitelist/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ rol: rolId }),
        }),
};
