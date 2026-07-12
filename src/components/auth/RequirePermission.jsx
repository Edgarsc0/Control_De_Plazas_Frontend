'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * Protección de UI por permiso (no reemplaza la protección real, que vive en
 * el backend vía HasModulePermission) — evita mostrar pantallas/botones a
 * quien no podrá usarlos y redirige si navega ahí directo por URL.
 *
 * `permission` acepta un codename único o un array (pasa si tiene AL MENOS
 * UNO — para módulos con varios tabs, cada uno gateado por su propio permiso).
 */
export default function RequirePermission({
    permission,
    redirectTo = '/dashboard',
    fallback = null,
    children,
}) {
    const { isLoading, hasPermission, hasAnyPermission } = useAuth();
    const router = useRouter();
    const allowed = Array.isArray(permission) ? hasAnyPermission(permission) : hasPermission(permission);

    useEffect(() => {
        if (!isLoading && !allowed && redirectTo) {
            router.replace(redirectTo);
        }
    }, [isLoading, allowed, redirectTo, router]);

    if (isLoading || !allowed) return fallback;
    return children;
}
