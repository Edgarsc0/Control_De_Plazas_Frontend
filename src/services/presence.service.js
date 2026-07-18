import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Presencia de usuarios: heartbeat periódico del cliente + lectura del panel
 * admin (Roles > Usuarios). Ver eje_central_back/authentication/presence.py.
 */
export const PresenceService = {
    heartbeat: (payload) =>
        apiFetch('/auth/presence/heartbeat/', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    listActive: () => apiFetch('/auth/presence/active/'),
};
