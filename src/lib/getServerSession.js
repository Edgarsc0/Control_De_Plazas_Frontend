import { cache } from 'react';
import { AuthService } from '@/services/auth.service';

/**
 * Permisos efectivos del usuario autenticado, resueltos en el servidor a
 * partir de la cookie `auth_token` (ver apiFetch, isomórfico). Memoizado con
 * React `cache()` para que loading.jsx y page.jsx compartan una sola llamada
 * a /auth/me/permissions/ por request en vez de duplicarla.
 *
 * `tablero` (ej. "rh") es el tablero ejecutivo asignado a este usuario en
 * Roles y Permisos (Whitelist.tablero) — `/dashboard/page.jsx` lo lee para
 * decidir si renderiza ese tablero en vez del dashboard normal.
 *
 * Fallo cerrado: si no hay sesión válida o la petición falla, no se filtra
 * ningún módulo como visible.
 */
export const getServerSession = cache(async () => {
    try {
        const response = await AuthService.getMe();
        if (!response.ok) return { permissions: [], isSuperuser: false, tablero: null };
        const data = await response.json();
        return { permissions: data.permissions || [], isSuperuser: !!data.is_superuser, tablero: data.tablero || null };
    } catch (error) {
        console.error('Error al resolver sesión en servidor:', error);
        return { permissions: [], isSuperuser: false, tablero: null };
    }
});
