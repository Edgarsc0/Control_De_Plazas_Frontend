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

    // Next.js no permite combinar `cache: 'no-store'` con `next.revalidate`.
    // Si el caller pide revalidación explícita, respetamos esa estrategia de caché
    // en vez de forzar no-store por defecto.
    const defaultCache = options.next || options.cache ? {} : { cache: 'no-store' };

    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
        ...defaultCache,
        ...options,
        headers,
    });

    // Un 401 solo significa "sesión expirada" cuando la petición llevaba
    // token: si no lo llevaba (p. ej. el propio POST a /auth/login/ con
    // credenciales incorrectas), es una respuesta normal del endpoint que el
    // caller debe leer y mostrar. Redirigir aquí también en ese caso
    // interrumpe el fetch a medio `response.json()` y el login termina
    // reportando "no se pudo conectar con el servidor" en vez del error real.
    if (response.status === 401 && headers['Authorization']) {
        if (typeof window !== 'undefined') {
            Cookies.remove('auth_token');
            window.location.href = '/login';
        }
    }

    return response;
};
