import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio de catálogo de Unidades Administrativas (UA).
 */
export const UaService = {
    list: () => apiFetch('/ua/'),
};
