import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

/**
 * Cliente base de API con interceptor de tokens isomórfico (Server/Client)
 */
export const apiFetch = async (endpoint, options = {}) => {
    let token;

    // Si ya se proporcionó un token de autorización, no intentamos obtenerlo de las cookies
    // Esto es crucial para la compatibilidad con unstable_cache en el servidor
    const hasAuth = options.headers && (options.headers['Authorization'] || options.headers['authorization']);

    // Detectar si estamos en el Servidor (Next.js Server Components / Actions)
    if (typeof window === 'undefined') {
        if (!hasAuth) {
            try {
                const { cookies } = await import('next/headers');
                const cookieStore = await cookies();
                token = cookieStore.get('auth_token')?.value;
            } catch (error) {
                console.error("Error al acceder a cookies en el servidor:", error);
            }
        }
    } else {
        // Estamos en el Navegador
        token = Cookies.get('auth_token');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Token ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
        cache: 'no-store',
        ...options,
        headers,
    });

    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            Cookies.remove('auth_token');
            window.location.href = '/login';
        }
    }

    return response;
};
