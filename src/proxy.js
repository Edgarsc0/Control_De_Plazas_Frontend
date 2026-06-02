import { NextResponse } from 'next/server';

/**
 * Middleware para la gestión de rutas y protección de sesión.
 * En Next.js 16+, este interceptor permite manejar redirecciones de forma eficiente.
 */
export default function proxy(request) {
    // 1. Intentar obtener el token de las cookies
    const token = request.cookies.get('auth_token')?.value;
    const { pathname } = request.nextUrl;

    // Definición de tipos de rutas
    const isPublicRoute = pathname === '/login';
    const isProtectedRoute = pathname.startsWith('/dashboard');

    // CASO 1: El usuario ya está autenticado e intenta ir al Login
    // Lo mandamos al Dashboard para evitar que se loguee dos veces.
    if (isPublicRoute && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // CASO 2: El usuario NO está autenticado e intenta entrar a una zona protegida
    // Lo mandamos al Login.
    if (isProtectedRoute && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Permitir el paso para cualquier otra ruta o si las condiciones se cumplen
    return NextResponse.next();
}

/**
 * Configuración del Matcher para optimizar el rendimiento.
 * Solo se ejecutará el middleware en las rutas definidas aquí.
 */
export const config = {
    matcher: [
        '/dashboard/:path*',
        '/login',
    ],
};
