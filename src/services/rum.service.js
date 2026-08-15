import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Web Vitals reales de usuarios (RUM) — ver WebVitalsReporter. Solo POST,
 * fire-and-forget: nunca debe bloquear ni afectar la UI si falla.
 */
export const RumService = {
    report: (payload) =>
        apiFetch('/auth/metrics/rum/', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};
