'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { MaintenanceService } from '@/services/maintenance.service';

const POLL_MS = 30000;
// Rutas que siguen accesibles con el sistema en mantenimiento: la landing y el
// login (sin él los desarrolladores exentos no podrían entrar a apagarlo).
const RUTAS_LIBRES = ['/', '/login'];

const MaintenanceContext = createContext({
    activo: false,
    mensaje: '',
    bloqueado: false,
    refresh: () => {},
});

/**
 * Estado del modo mantenimiento. `bloqueado` ya viene resuelto por el backend
 * para el usuario actual (superadmin y exentos nunca lo están); se re-consulta
 * cada POLL_MS y al cambiar la sesión para que encender/apagar el modo se
 * refleje sin recargar. La restricción real la aplica el backend (503).
 */
export function MaintenanceProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const [estado, setEstado] = useState({ activo: false, mensaje: '', bloqueado: false });

    const refresh = useCallback(async () => {
        try {
            const res = await MaintenanceService.get();
            if (!res.ok) return;
            const data = await res.json();
            setEstado({ activo: !!data.activo, mensaje: data.mensaje || '', bloqueado: !!data.bloqueado });
        } catch {
            // Sin red: conservamos el último estado conocido.
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, POLL_MS);
        return () => clearInterval(interval);
    }, [refresh, isAuthenticated]);

    const value = useMemo(() => ({ ...estado, refresh }), [estado, refresh]);
    return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export const useMaintenance = () => useContext(MaintenanceContext);

/** Muestra la pantalla de mantenimiento en lugar de la página cuando corresponde. */
export function MaintenanceGate({ screen, children }) {
    const pathname = usePathname();
    const { bloqueado } = useMaintenance();
    if (bloqueado && !RUTAS_LIBRES.includes(pathname)) return screen;
    return children;
}
