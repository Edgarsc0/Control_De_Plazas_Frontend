'use client';

import { useAuth } from '@/hooks/useAuth';

/**
 * @param {string|null} codename - "app_label.codename", ver src/config/permissions.js
 * @returns {boolean}
 */
export function usePermission(codename) {
    const { hasPermission } = useAuth();
    return hasPermission(codename);
}

/**
 * @param {string[]} codenames
 * @returns {boolean} true si el usuario tiene al menos uno de los permisos.
 */
export function useAnyPermission(codenames) {
    const { hasAnyPermission } = useAuth();
    return hasAnyPermission(codenames);
}
