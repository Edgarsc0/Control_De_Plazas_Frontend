import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio de administración de roles (Group) y catálogo de permisos (auth_permission).
 */
export const RoleService = {
    listRoles: () => apiFetch('/auth/roles/'),

    createRole: (name) =>
        apiFetch('/auth/roles/', {
            method: 'POST',
            body: JSON.stringify({ name }),
        }),

    updateRole: (id, payload) =>
        apiFetch(`/auth/roles/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),

    deleteRole: (id) =>
        apiFetch(`/auth/roles/${id}/`, {
            method: 'DELETE',
        }),

    setRolePermissions: (id, permissionIds) =>
        apiFetch(`/auth/roles/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ permission_ids: permissionIds }),
        }),

    listPermissions: () => apiFetch('/auth/permissions/'),
};
