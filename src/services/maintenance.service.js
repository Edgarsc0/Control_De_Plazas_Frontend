import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Modo mantenimiento del sistema.
 */
export const MaintenanceService = {
    /** Estado público: `{ activo, mensaje, bloqueado, exentos? }` (`exentos` solo para superadmin). */
    get: () => apiFetch('/auth/maintenance/'),

    /**
     * Enciende/apaga el modo (solo superadmin).
     * @param {{activo: boolean, mensaje?: string, exentos: number[]}} payload
     *   `exentos` = ids de whitelist a quienes NO se les niega el servicio.
     */
    set: (payload) =>
        apiFetch('/auth/maintenance/', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),
};
