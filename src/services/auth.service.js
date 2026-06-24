import { apiFetch } from '@/lib/fetch-interceptor';
import Cookies from 'js-cookie';

/**
 * Servicio encargado de la lógica de autenticación
 */
export const AuthService = {
    /**
     * Valida si el correo está en la whitelist y dispara el envío del código OTP.
     * @param {string} email - Correo electrónico del usuario.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para el resultado.
     */
    checkEmail: (email) => {
        return apiFetch('/auth/check-email/', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    /**
     * Verifica el código OTP y obtiene el token de sesión.
     * @param {string} email - Correo electrónico del usuario.
     * @param {string} code - Código OTP recibido por el usuario.
     * @returns {Promise<Response>} Respuesta cruda; usar `.json()` para obtener el token.
     */
    verifyCode: (email, code) => {
        return apiFetch('/auth/verify-code/', {
            method: 'POST',
            body: JSON.stringify({ email, code }),
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
    }
};
