'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ShieldCheck,
    Plus,
    Pencil,
    Trash2,
    Users as UsersIcon,
    UserPlus,
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import RequirePermission from '@/components/auth/RequirePermission';
import { useToast } from '@/hooks/useToast';
import { RoleService } from '@/services/role.service';
import { WhitelistService } from '@/services/whitelist.service';
import { UaService } from '@/services/ua.service';
import { PresenceService } from '@/services/presence.service';
import { PERMISSIONS } from '@/config/permissions';
import { PERMISSION_PREVIEWS } from '@/config/permissionPreviews';
import { PERMISSION_CATEGORY_ORDER, getPermissionCategory } from '@/config/permissionCategories';

const ROLE_PAGE_SIZE = 8;
const USER_PAGE_SIZE = 10;
const PRESENCE_POLL_MS = 15000;

function timeAgoLabel(ts) {
    if (!ts) return '';
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
    if (diffSec < 60) return `hace ${diffSec}s`;
    return `hace ${Math.round(diffSec / 60)}m`;
}

const SELECT_TRIGGER_CLASS =
    'rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 focus-visible:border-[#621f32] focus-visible:ring-[#621f32]/20';

async function parseJson(response) {
    if (!response.ok) return null;
    try {
        const data = await response.json();
        return Array.isArray(data) ? data : data.results || [];
    } catch {
        return null;
    }
}

function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between gap-3 pt-3">
            <button
                onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
            >
                <ChevronLeft className="size-3.5" /> Anterior
            </button>
            <span className="text-xs font-bold text-slate-400">
                Página {page} de {totalPages}
            </span>
            <button
                onClick={() => onChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
            >
                Siguiente <ChevronRight className="size-3.5" />
            </button>
        </div>
    );
}

const SKELETON_BG = 'bg-slate-200/70 dark:bg-slate-700/50';
const SKELETON_BG_LIGHT = 'bg-slate-200/40 dark:bg-slate-700/30';

function RolesSkeleton() {
    return (
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6 w-full animate-pulse">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className={`size-11 rounded-2xl ${SKELETON_BG}`} />
                    <div className="space-y-2">
                        <div className={`h-5 w-40 rounded-lg ${SKELETON_BG}`} />
                        <div className={`h-3.5 w-64 rounded-md ${SKELETON_BG_LIGHT}`} />
                    </div>
                </div>
                <div className={`h-9 w-32 rounded-xl ${SKELETON_BG}`} />
            </div>

            <div className={`h-10 w-48 rounded-2xl ${SKELETON_BG_LIGHT}`} />

            <div className="space-y-3">
                <div className={`h-10 w-full rounded-xl ${SKELETON_BG_LIGHT}`} />
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {Array.from({ length: ROLE_PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                            <div className={`size-8 rounded-xl shrink-0 ${SKELETON_BG_LIGHT}`} />
                            <div className="flex-1 min-w-0 space-y-2">
                                <div className={`h-4 w-1/3 rounded-md ${SKELETON_BG}`} />
                                <div className={`h-3 w-1/4 rounded-md ${SKELETON_BG_LIGHT}`} />
                            </div>
                            <div className={`hidden sm:block h-6 w-14 rounded-full shrink-0 ${SKELETON_BG_LIGHT}`} />
                            <div className="flex gap-1 shrink-0">
                                <div className={`size-8 rounded-lg ${SKELETON_BG_LIGHT}`} />
                                <div className={`size-8 rounded-lg ${SKELETON_BG_LIGHT}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RolesAdminContent() {
    const { toast } = useToast();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [whitelist, setWhitelist] = useState([]);
    const [uas, setUas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingRole, setEditingRole] = useState(null); // objeto rol | 'new' | null
    const [roleName, setRoleName] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [previewCodename, setPreviewCodename] = useState(null);
    const [permSearch, setPermSearch] = useState('');
    const [isNewUserOpen, setIsNewUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', rol: '', ua: '', activo: true });
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const [activeTab, setActiveTab] = useState('roles');
    const [roleSearch, setRoleSearch] = useState('');
    const [roleSort, setRoleSort] = useState('name');
    const [rolePage, setRolePage] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [activeSessionsByEmail, setActiveSessionsByEmail] = useState({});

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rolesRes, permsRes, whitelistRes, uasRes] = await Promise.all([
                RoleService.listRoles(),
                RoleService.listPermissions(),
                WhitelistService.list(),
                UaService.list(),
            ]);
            setRoles((await parseJson(rolesRes)) || []);
            setPermissions((await parseJson(permsRes)) || []);
            setWhitelist((await parseJson(whitelistRes)) || []);
            setUas((await parseJson(uasRes)) || []);
        } catch (error) {
            console.error('Error cargando roles:', error);
            toast.error('No se pudieron cargar los roles.');
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Presencia: quién está activo ahora y en qué página, refrescado por
    // polling (ver PresenceHeartbeat, que es quien alimenta este endpoint).
    useEffect(() => {
        let active = true;

        const pollActiveSessions = async () => {
            try {
                const response = await PresenceService.listActive();
                if (!response.ok || !active) return;
                const data = await response.json();
                const byEmail = {};
                data.forEach((entry) => {
                    byEmail[entry.email] = entry;
                });
                if (active) setActiveSessionsByEmail(byEmail);
            } catch (error) {
                console.error('Error cargando usuarios activos:', error);
            }
        };

        pollActiveSessions();
        const interval = setInterval(pollActiveSessions, PRESENCE_POLL_MS);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        setRolePage(1);
    }, [roleSearch, roleSort]);

    useEffect(() => {
        setUserPage(1);
    }, [userSearch, userRoleFilter]);

    useEffect(() => {
        setRolePage((p) => Math.min(p, Math.max(1, Math.ceil(roles.length / ROLE_PAGE_SIZE))));
    }, [roles]);

    useEffect(() => {
        setUserPage((p) => Math.min(p, Math.max(1, Math.ceil(whitelist.length / USER_PAGE_SIZE))));
    }, [whitelist]);

    const openNewRole = () => {
        setEditingRole('new');
        setRoleName('');
        setSelectedPermissionIds(new Set());
        setPermSearch('');
    };

    const openEditRole = (role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setSelectedPermissionIds(new Set(role.permissions.map((p) => p.id)));
        setPermSearch('');
    };

    const closeDialog = () => setEditingRole(null);

    const togglePermission = (id) => {
        setSelectedPermissionIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCategoryAll = (ids, allSelected) => {
        setSelectedPermissionIds((current) => {
            const next = new Set(current);
            ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
            return next;
        });
    };

    const handleSaveRole = async () => {
        if (!roleName.trim()) {
            toast.error('El nombre del rol es obligatorio.');
            return;
        }
        setIsSaving(true);
        try {
            const permission_ids = Array.from(selectedPermissionIds);
            const isNew = editingRole === 'new';
            let response;
            if (isNew) {
                response = await RoleService.createRole(roleName.trim());
                if (response.ok) {
                    const created = await response.json();
                    response = await RoleService.setRolePermissions(created.id, permission_ids);
                }
            } else {
                response = await RoleService.updateRole(editingRole.id, {
                    name: roleName.trim(),
                    permission_ids,
                });
            }
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || data.name?.[0] || 'No se pudo guardar el rol.');
            }
            const savedRole = await response.json();
            setRoles((current) =>
                isNew
                    ? [...current, savedRole]
                    : current.map((r) => (r.id === savedRole.id ? savedRole : r))
            );
            toast.success('Rol guardado correctamente.');
            closeDialog();
        } catch (error) {
            toast.error(error.message || 'No se pudo guardar el rol.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRole = async (role) => {
        if (!window.confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const response = await RoleService.deleteRole(role.id);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo eliminar el rol.');
            }
            toast.success('Rol eliminado.');
            setRoles((current) => current.filter((r) => r.id !== role.id));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleReassignRole = async (whitelistEntry, rolId) => {
        try {
            const response = await WhitelistService.assignRole(whitelistEntry.id, Number(rolId));
            if (!response.ok) throw new Error('No se pudo reasignar el rol.');
            const updated = await response.json();
            setWhitelist((current) =>
                current.map((entry) => (entry.id === updated.id ? updated : entry))
            );
            toast.success(`Rol actualizado para ${whitelistEntry.email}.`);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const openNewUser = () => {
        setNewUser({ email: '', rol: roles[0]?.id ? String(roles[0].id) : '', ua: '', activo: true });
        setIsNewUserOpen(true);
    };

    const closeNewUser = () => setIsNewUserOpen(false);

    const handleCreateUser = async () => {
        if (!newUser.email.trim()) {
            toast.error('El correo es obligatorio.');
            return;
        }
        if (!newUser.rol) {
            toast.error('Selecciona un rol.');
            return;
        }
        setIsCreatingUser(true);
        try {
            const payload = {
                email: newUser.email.trim(),
                rol: Number(newUser.rol),
                ua: newUser.ua ? Number(newUser.ua) : null,
                activo: newUser.activo,
            };
            const response = await WhitelistService.create(payload);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || data.email?.[0] || data.rol?.[0] || 'No se pudo crear el usuario.');
            }
            const created = await response.json();
            setWhitelist((current) => [...current, created]);
            toast.success('Usuario creado correctamente.');
            closeNewUser();
        } catch (error) {
            toast.error(error.message || 'No se pudo crear el usuario.');
        } finally {
            setIsCreatingUser(false);
        }
    };

    // --- Roles: búsqueda, orden y paginación ---
    const filteredRoles = useMemo(() => {
        const q = roleSearch.trim().toLowerCase();
        const base = q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles;
        const sorted = [...base];
        if (roleSort === 'users') sorted.sort((a, b) => b.user_count - a.user_count);
        else sorted.sort((a, b) => a.name.localeCompare(b.name));
        return sorted;
    }, [roles, roleSearch, roleSort]);

    const roleTotalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLE_PAGE_SIZE));
    const paginatedRoles = filteredRoles.slice((rolePage - 1) * ROLE_PAGE_SIZE, rolePage * ROLE_PAGE_SIZE);

    // --- Usuarios: búsqueda, filtro por rol y paginación ---
    const roleNameById = useMemo(() => new Map(roles.map((r) => [String(r.id), r.name])), [roles]);

    const filteredWhitelist = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return whitelist.filter((entry) => {
            if (userRoleFilter && String(entry.rol) !== userRoleFilter) return false;
            if (!q) return true;
            const roleName = roleNameById.get(String(entry.rol)) || '';
            return (
                entry.email.toLowerCase().includes(q) ||
                (entry.ua_nombre || '').toLowerCase().includes(q) ||
                roleName.toLowerCase().includes(q)
            );
        });
    }, [whitelist, userSearch, userRoleFilter, roleNameById]);

    const userTotalPages = Math.max(1, Math.ceil(filteredWhitelist.length / USER_PAGE_SIZE));
    const paginatedWhitelist = filteredWhitelist.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE);

    // --- Permisos del dialog: agrupados por módulo + búsqueda ---
    const groupedPermissions = useMemo(() => {
        const groups = new Map();
        permissions.forEach((perm) => {
            const cat = getPermissionCategory(perm.full_codename);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(perm);
        });
        return PERMISSION_CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => ({
            category: cat,
            perms: groups.get(cat),
        }));
    }, [permissions]);

    const filteredPermissionGroups = useMemo(() => {
        const q = permSearch.trim().toLowerCase();
        if (!q) return groupedPermissions;
        return groupedPermissions
            .map(({ category, perms }) => ({
                category,
                perms: perms.filter((p) => p.name.toLowerCase().includes(q)),
            }))
            .filter((g) => g.perms.length > 0);
    }, [groupedPermissions, permSearch]);

    if (isLoading) {
        return <RolesSkeleton />;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-[#0f766e]/10 dark:bg-[#0f766e]/20">
                        <ShieldCheck className="size-6 text-[#0f766e] dark:text-[#2dd4bf]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">Roles y Permisos</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Crea roles y decide qué módulos puede ver o editar cada usuario.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={activeTab === 'roles' ? openNewRole : openNewUser}
                    className="bg-[#621f32] hover:bg-[#4d1827] text-white"
                >
                    {activeTab === 'roles' ? (
                        <>
                            <Plus className="size-4" /> Nuevo rol
                        </>
                    ) : (
                        <>
                            <UserPlus className="size-4" /> Nuevo usuario
                        </>
                    )}
                </Button>
            </div>

            <div className="inline-flex p-1 gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60">
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        activeTab === 'roles'
                            ? 'bg-white dark:bg-slate-900 text-[#621f32] dark:text-[#bc955c] shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <ShieldCheck className="size-4" /> Roles
                    <span className="text-xs font-black text-slate-400">{roles.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('usuarios')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        activeTab === 'usuarios'
                            ? 'bg-white dark:bg-slate-900 text-[#621f32] dark:text-[#bc955c] shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <UsersIcon className="size-4" /> Usuarios
                    <span className="text-xs font-black text-slate-400">{whitelist.length}</span>
                </button>
            </div>

            {activeTab === 'roles' && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px] flex items-center pl-3 pr-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-[#621f32]/10 focus-within:border-[#621f32]/40">
                            <Search className="size-4 text-slate-400 mr-2 shrink-0" />
                            <input
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                placeholder="Buscar rol..."
                                className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400 text-slate-700 dark:text-slate-100"
                            />
                            {roleSearch && (
                                <button onClick={() => setRoleSearch('')} aria-label="Limpiar búsqueda">
                                    <X className="size-4 text-slate-400" />
                                </button>
                            )}
                        </div>
                        <Select value={roleSort} onValueChange={setRoleSort}>
                            <SelectTrigger className={`w-[180px] ${SELECT_TRIGGER_CLASS}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Nombre (A-Z)</SelectItem>
                                <SelectItem value="users">Más usuarios</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {paginatedRoles.map((role) => (
                            <div
                                key={role.id}
                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                                <div className="p-2 rounded-xl bg-[#621f32]/8 dark:bg-[#bc955c]/10 shrink-0">
                                    <ShieldCheck className="size-4 text-[#621f32] dark:text-[#bc955c]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                        {role.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                        <KeyRound className="size-3" /> {role.permissions.length} permiso
                                        {role.permissions.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-300 shrink-0">
                                    <UsersIcon className="size-3.5" /> {role.user_count}
                                </span>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="icon-sm" onClick={() => openEditRole(role)}>
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteRole(role)}>
                                        <Trash2 className="size-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {paginatedRoles.length === 0 && (
                            <p className="text-sm text-slate-400 px-4 py-10 text-center">
                                {roles.length === 0
                                    ? 'Aún no hay roles creados.'
                                    : 'Sin roles que coincidan con la búsqueda.'}
                            </p>
                        )}
                    </div>

                    <Pagination page={rolePage} totalPages={roleTotalPages} onChange={setRolePage} />
                </div>
            )}

            {activeTab === 'usuarios' && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px] flex items-center pl-3 pr-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-[#621f32]/10 focus-within:border-[#621f32]/40">
                            <Search className="size-4 text-slate-400 mr-2 shrink-0" />
                            <input
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="Buscar por correo, UA o rol..."
                                className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400 text-slate-700 dark:text-slate-100"
                            />
                            {userSearch && (
                                <button onClick={() => setUserSearch('')} aria-label="Limpiar búsqueda">
                                    <X className="size-4 text-slate-400" />
                                </button>
                            )}
                        </div>
                        <Select
                            value={userRoleFilter || 'all'}
                            onValueChange={(value) => setUserRoleFilter(value === 'all' ? '' : value)}
                        >
                            <SelectTrigger className={`w-[180px] ${SELECT_TRIGGER_CLASS}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los roles</SelectItem>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={String(role.id)}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                            {filteredWhitelist.length} usuario{filteredWhitelist.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="text-left px-4 py-2.5">Correo</th>
                                    <th className="text-left px-4 py-2.5">UA</th>
                                    <th className="text-left px-4 py-2.5">Estado</th>
                                    <th className="text-left px-4 py-2.5">Página actual</th>
                                    <th className="text-left px-4 py-2.5">Rol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedWhitelist.map((entry) => {
                                    const sessions = activeSessionsByEmail[entry.email]?.sessions || [];
                                    return (
                                        <tr
                                            key={entry.id}
                                            className="border-t border-slate-100 dark:border-slate-800"
                                        >
                                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                                                {entry.email}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                                                {entry.ua_nombre || '—'}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {sessions.length > 0 ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold whitespace-nowrap">
                                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Activo{sessions.length > 1 ? ` · ${sessions.length} pestañas` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                                                {sessions.length > 0 ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        {sessions.map((s) => (
                                                            <span key={`${s.path}-${s.ts}`} className="whitespace-nowrap">
                                                                {s.title}
                                                                {s.subtab ? ` › ${s.subtab}` : ''}
                                                                <span className="text-slate-300 dark:text-slate-600"> · {timeAgoLabel(s.ts)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Select
                                                    defaultValue={String(entry.rol)}
                                                    onValueChange={(value) => handleReassignRole(entry, value)}
                                                >
                                                    <SelectTrigger className={`w-[160px] ${SELECT_TRIGGER_CLASS}`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {roles.map((role) => (
                                                            <SelectItem key={role.id} value={String(role.id)}>
                                                                {role.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedWhitelist.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                                            {whitelist.length === 0
                                                ? 'Sin usuarios en la whitelist.'
                                                : 'Sin usuarios que coincidan con la búsqueda.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination page={userPage} totalPages={userTotalPages} onChange={setUserPage} />
                </div>
            )}

            <Dialog
                open={!!editingRole}
                onOpenChange={(open) => {
                    if (!open) {
                        closeDialog();
                        setPreviewCodename(null);
                    }
                }}
            >
                <DialogContent className="lg:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole === 'new' ? 'Nuevo rol' : `Editar rol: ${editingRole?.name || ''}`}
                        </DialogTitle>
                        <DialogDescription>
                            Define el nombre y los permisos que tendrá este rol.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nombre del rol
                            </label>
                            <input
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                placeholder="p. ej. Editor de Plantilla"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-700">Permisos</label>
                                <span className="text-xs font-bold text-slate-400">
                                    {selectedPermissionIds.size} seleccionado
                                    {selectedPermissionIds.size === 1 ? '' : 's'}
                                </span>
                            </div>

                            <div className="relative flex items-center pl-3 pr-2 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-[#621f32]/10 focus-within:border-[#621f32]/40">
                                <Search className="size-4 text-slate-400 mr-2 shrink-0" />
                                <input
                                    value={permSearch}
                                    onChange={(e) => setPermSearch(e.target.value)}
                                    placeholder="Buscar permiso..."
                                    className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400 text-slate-700"
                                />
                                {permSearch && (
                                    <button onClick={() => setPermSearch('')} aria-label="Limpiar búsqueda">
                                        <X className="size-4 text-slate-400" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
                                <div
                                    className="space-y-4 max-h-80 overflow-y-auto pr-1"
                                    onMouseLeave={() => setPreviewCodename(null)}
                                >
                                    {filteredPermissionGroups.map(({ category, perms }) => {
                                        const catIds = perms.map((p) => p.id);
                                        const allSelected = catIds.every((id) => selectedPermissionIds.has(id));
                                        return (
                                            <div key={category}>
                                                <div className="flex items-center justify-between px-2 mb-1">
                                                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                                        {category}
                                                    </h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategoryAll(catIds, allSelected)}
                                                        className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                                                    >
                                                        {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                                                    </button>
                                                </div>
                                                <div className="space-y-0.5">
                                                    {perms.map((perm) => {
                                                        const hasPreview = Boolean(
                                                            PERMISSION_PREVIEWS[perm.full_codename]
                                                        );
                                                        return (
                                                            <label
                                                                key={perm.id}
                                                                onMouseEnter={() =>
                                                                    hasPreview &&
                                                                    setPreviewCodename(perm.full_codename)
                                                                }
                                                                onFocus={() =>
                                                                    hasPreview &&
                                                                    setPreviewCodename(perm.full_codename)
                                                                }
                                                                className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedPermissionIds.has(perm.id)}
                                                                    onChange={() => togglePermission(perm.id)}
                                                                    className="mt-0.5 accent-[#621f32]"
                                                                />
                                                                <span className="text-sm text-slate-700">
                                                                    {perm.name}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredPermissionGroups.length === 0 && (
                                        <p className="text-sm text-slate-400">
                                            {permissions.length === 0
                                                ? 'No hay permisos en el catálogo.'
                                                : `Sin permisos que coincidan con "${permSearch}".`}
                                        </p>
                                    )}
                                </div>

                                <div className="hidden lg:flex h-80 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                    {previewCodename && PERMISSION_PREVIEWS[previewCodename] ? (
                                        <img
                                            src={PERMISSION_PREVIEWS[previewCodename]}
                                            alt="Vista previa del permiso"
                                            className="h-full w-full object-cover object-top"
                                        />
                                    ) : (
                                        <p className="px-4 text-center text-xs text-slate-400">
                                            Pasa el cursor sobre un permiso para ver su vista previa.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSaveRole}
                            disabled={isSaving}
                            className="bg-[#621f32] hover:bg-[#4d1827] text-white"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isNewUserOpen} onOpenChange={(open) => !open && closeNewUser()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo usuario</DialogTitle>
                        <DialogDescription>
                            Da de alta un correo autorizado con su rol y UA. El usuario podrá
                            iniciar sesión verificando ese correo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser((c) => ({ ...c, email: e.target.value }))}
                                placeholder="usuario@ejemplo.gob.mx"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                            <Select
                                value={newUser.rol || undefined}
                                onValueChange={(value) => setNewUser((c) => ({ ...c, rol: value }))}
                            >
                                <SelectTrigger className={`w-full ${SELECT_TRIGGER_CLASS}`}>
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.id} value={String(role.id)}>
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">UA (opcional)</label>
                            <Select
                                value={newUser.ua || 'none'}
                                onValueChange={(value) =>
                                    setNewUser((c) => ({ ...c, ua: value === 'none' ? '' : value }))
                                }
                            >
                                <SelectTrigger className={`w-full ${SELECT_TRIGGER_CLASS}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin UA</SelectItem>
                                    {uas.map((ua) => (
                                        <SelectItem key={ua.id} value={String(ua.id)}>
                                            {ua.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={newUser.activo}
                                onChange={(e) => setNewUser((c) => ({ ...c, activo: e.target.checked }))}
                                className="accent-[#621f32]"
                            />
                            Activo
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeNewUser} disabled={isCreatingUser}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateUser}
                            disabled={isCreatingUser}
                            className="bg-[#621f32] hover:bg-[#4d1827] text-white"
                        >
                            {isCreatingUser ? 'Creando...' : 'Crear usuario'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function RolesAdminPage() {
    return (
        <RequirePermission permission={PERMISSIONS.MANAGE_ROLES}>
            <RolesAdminContent />
        </RequirePermission>
    );
}
