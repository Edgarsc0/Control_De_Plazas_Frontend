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

    /**
     * Establece o restablece la contraseña de un usuario.
     *
     * No hay recuperación por correo (el envío a las cuentas institucionales
     * está bloqueado), así que este es el único camino para devolverle el
     * acceso a alguien que la olvidó. El backend invalida las sesiones
     * abiertas del usuario y le exige cambiarla la próxima vez que entre.
     * @param {number} id - id de la entrada de whitelist
     * @param {string} password - contraseña temporal a asignar
     */
    setPassword: (id, password) =>
        apiFetch(`/auth/whitelist/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ password }),
        }),
};
