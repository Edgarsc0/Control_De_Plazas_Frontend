import { apiFetch } from '@/lib/fetch-interceptor';
import Cookies from 'js-cookie';

/**
 * Servicio encargado de la lógica de autenticación
 */
export const AuthService = {
    /**
     * Inicia sesión con correo y contraseña.
     * @param {string} email - Correo electrónico del usuario.
     * @param {string} password - Contraseña del usuario.
     * @returns {Promise<Response>} Respuesta cruda; `.json()` da `{ token, debe_cambiar_password, user }`.
     */
    login: (email, password) => {
        return apiFetch('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    /**
     * Cambia la contraseña del usuario autenticado.
     *
     * El backend rota el token al cambiarla (invalida el anterior), así que la
     * respuesta trae uno nuevo que hay que persistir con `saveToken`.
     * @param {string} passwordActual - Contraseña vigente.
     * @param {string} passwordNueva - Contraseña nueva.
     * @returns {Promise<Response>} Respuesta cruda; `.json()` da `{ token }`.
     */
    changePassword: (passwordActual, passwordNueva) => {
        return apiFetch('/auth/change-password/', {
            method: 'POST',
            body: JSON.stringify({
                password_actual: passwordActual,
                password_nueva: passwordNueva,
            }),
        });
    },

    /**
     * Almacena el token de sesión en las cookies.
     * @param {string} token - Token de sesión a persistir.
     * @returns {void}
     */
    saveToken: (token) => {
        // Producción corre sobre HTTP (sin TLS), así que se chequea el protocolo real
        // en vez de NODE_ENV: NODE_ENV==='production' pondría secure:true y rompería la cookie.
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

        Cookies.set('auth_token', token, {
            expires: 7,
            secure: isHttps,
            sameSite: 'lax'
        });
    },

    /**
     * Cierra la sesión, limpia las cookies y redirige al login.
     * @returns {void}
     */
    logout: () => {
        Cookies.remove('auth_token');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },

    /**
     * Verifica si hay una sesión activa (existe token en cookies).
     * @returns {boolean} `true` si hay un token de sesión almacenado.
     */
    isAuthenticated: () => {
        return !!Cookies.get('auth_token');
    },

    /**
     * Obtiene el rol y los permisos efectivos del usuario autenticado.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el resultado.
     */
    getMe: () => {
        return apiFetch('/auth/me/permissions/');
    },
};
