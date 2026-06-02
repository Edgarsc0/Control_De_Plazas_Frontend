'use client';

import { useState, useEffect } from 'react';
import { AuthService } from '@/services/auth.service';

/**
 * Hook para gestionar el estado de autenticación en componentes de React
 */
export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Verificar el estado al montar el componente
        const checkAuth = () => {
            const authStatus = AuthService.isAuthenticated();
            setIsAuthenticated(authStatus);
            setIsLoading(false);
        };

        checkAuth();

    }, []);

    const logout = () => {
        AuthService.logout();
        setIsAuthenticated(false);
    };

    return { isAuthenticated, isLoading, logout };
};
