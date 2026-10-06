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
    getUserVisitsHeatmap: (email, month) => {
        const params = new URLSearchParams({ email, ...(month ? { month } : {}) });
        return apiFetch(`/auth/visits/heatmap/?${params.toString()}`);
    },
    /** Bitácora de archivos Excel generados por el usuario (UserDescargasExcelView). */
    getUserDescargasExcel: (email) => {
        const params = new URLSearchParams({ email });
        return apiFetch(`/auth/descargas-excel/?${params.toString()}`);
    },
    /** Vuelve a generar el Excel de una descarga registrada; usar `.blob()`. */
    regenerarDescargaExcel: (id) => apiFetch(`/plantilla/descargas_excel/${id}/regenerar/`),
};
