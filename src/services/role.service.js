import { apiFetch } from '@/lib/fetch-interceptor';

/**
 * Servicio de administración de roles (Group) y catálogo de permisos (auth_permission).
 */
export const RoleService = {
    listRoles: () => apiFetch('/auth/roles/'),

    // `payload`: { name, padre?, permission_ids?, un_scope?, columnas_detalle? }
    // — todo en una sola llamada, para que el rol nunca exista a medias.
    createRole: (payload) =>
        apiFetch('/auth/roles/', {
            method: 'POST',
            body: JSON.stringify(payload),
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
