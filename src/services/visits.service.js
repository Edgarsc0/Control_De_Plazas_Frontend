import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Actividad histórica de un usuario (histograma de Roles > Usuarios).
 * Ver eje_central_back/authentication/views.py -> UserVisitsView.
 */
export const VisitsService = {
    getUserVisits: (email, date) => {
        const params = new URLSearchParams({ email, ...(date ? { date } : {}) });
        return apiFetch(`/auth/visits/?${params.toString()}`);
    },
};
