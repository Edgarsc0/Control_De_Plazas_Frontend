import { apiFetch } from '@/lib/fetch-interceptor';
import Cookies from 'js-cookie';

/**
 * Servicio encargado de la lógica de autenticación
 */
export const AuthService = {
    /**
     * Valida si el correo está en la whitelist y dispara el envío del código OTP
     */
    checkEmail: (email) => {
        return apiFetch('/auth/check-email/', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    /**
     * Verifica el código OTP y obtiene el token de sesión
     */
    verifyCode: (email, code) => {
        return apiFetch('/auth/verify-code/', {
            method: 'POST',
            body: JSON.stringify({ email, code }),
        });
    },

    /**
     * Almacena el token de sesión en las cookies
     */
    saveToken: (token) => {
        // En desarrollo permitimos HTTP (secure: false) para que funcione en red local
        const isProduction = process.env.NODE_ENV === 'production';

        Cookies.set('auth_token', token, {
            expires: 7,
            secure: isProduction, // Solo true en producción (HTTPS)
            sameSite: 'lax'       // Más permisivo para desarrollo en red local
        });
    },

    /**
     * Cierra la sesión y limpia las cookies
     */
    logout: () => {
        Cookies.remove('auth_token');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },

    /**
     * Verifica si hay una sesión activa
     */
    isAuthenticated: () => {
        return !!Cookies.get('auth_token');
    }
};
