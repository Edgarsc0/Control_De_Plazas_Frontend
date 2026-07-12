'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthService } from '@/services/auth.service';

const AuthContext = createContext(null);

const EMPTY_SESSION = {
    isAuthenticated: false,
    email: null,
    role: null,
    ua: null,
    isSuperuser: false,
    permissions: [],
};

/**
 * Fuente única del estado de sesión: rol y permisos efectivos se hidratan
 * una vez (aquí) desde /auth/me/permissions/ en vez de que cada componente
 * que use useAuth() dispare su propio fetch.
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(EMPTY_SESSION);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!AuthService.isAuthenticated()) {
            setSession(EMPTY_SESSION);
            setIsLoading(false);
            return;
        }

        try {
            const response = await AuthService.getMe();
            if (!response.ok) {
                setSession(EMPTY_SESSION);
                return;
            }
            const data = await response.json();
            setSession({
                isAuthenticated: true,
                email: data.email,
                role: data.role,
                ua: data.ua,
                isSuperuser: !!data.is_superuser,
                permissions: data.permissions || [],
            });
        } catch (error) {
            console.error('Error al obtener el perfil de usuario:', error);
            // El token sigue siendo válido aunque el perfil haya fallado (p. ej.
            // caída puntual de red); no lo tratamos como sesión cerrada.
            setSession((current) => ({ ...current, isAuthenticated: true }));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const logout = useCallback(() => {
        AuthService.logout();
        setSession(EMPTY_SESSION);
    }, []);

    const hasPermission = useCallback(
        (codename) => {
            if (!codename) return true;
            if (session.isSuperuser) return true;
            return session.permissions.includes(codename);
        },
        [session.isSuperuser, session.permissions]
    );

    const hasAnyPermission = useCallback(
        (codenames) => {
            if (!codenames || codenames.length === 0) return true;
            if (session.isSuperuser) return true;
            return codenames.some((codename) => session.permissions.includes(codename));
        },
        [session.isSuperuser, session.permissions]
    );

    const value = useMemo(
        () => ({
            isAuthenticated: session.isAuthenticated,
            isLoading,
            email: session.email,
            role: session.role,
            ua: session.ua,
            isSuperuser: session.isSuperuser,
            permissions: session.permissions,
            hasPermission,
            hasAnyPermission,
            refresh,
            logout,
        }),
        [session, isLoading, hasPermission, hasAnyPermission, refresh, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para gestionar el estado de autenticación en componentes de React.
 */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    }
    return ctx;
}
