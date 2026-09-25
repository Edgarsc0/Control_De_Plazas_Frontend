'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
    Activity,
    ShieldCheck,
    Pencil,
    Trash2,
    Users as UsersIcon,
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    KeyRound,
    Wrench,
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
import { useAuth } from '@/hooks/useAuth';
import MaintenancePanel from './_components/MaintenancePanel';
import RequirePermission from '@/components/auth/RequirePermission';
import { useToast } from '@/hooks/useToast';
import { RoleService } from '@/services/role.service';
import { WhitelistService } from '@/services/whitelist.service';
import { UaService } from '@/services/ua.service';
import { PresenceService } from '@/services/presence.service';
import UserActivityDialog from './_components/UserActivityDialog';
import { PERMISSIONS } from '@/config/permissions';
import { PERMISSION_PREVIEWS } from '@/config/permissionPreviews';
import { PERMISSION_TREE, getTreeCodenameSet } from '@/config/permissionTree';
import PermissionTreeSection from './_components/PermissionTreeSection';
import RolesGrid from './_components/RolesGrid';
import UsersGrid from './_components/UsersGrid';
import UnScopeSelector from './_components/UnScopeSelector';
import ColumnScopeSelector from './_components/ColumnScopeSelector';
import RolesHero from './_components/RolesHero';
import AnimatedTabs from './_components/AnimatedTabs';
import StaggerIn from './_components/StaggerIn';
import { prefersReducedMotion } from './_components/motion';

gsap.registerPlugin(useGSAP);

const PRESENCE_POLL_MS = 15000;

// Mismo catálogo que TABLERO_CHOICES en el backend (authentication/models.py)
// — sin endpoint propio porque es un puñado fijo de opciones, no un catálogo
// administrable como los roles.
const TABLERO_OPTIONS = [
    { value: 'none', label: 'Ninguno' },
    { value: 'rh', label: 'Tablero RH' },
    { value: 'personalizable', label: 'Tablero Personalizable' },
];

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

const SKELETON_BG = 'bg-slate-200/70 dark:bg-slate-700/50';
const SKELETON_BG_LIGHT = 'bg-slate-200/40 dark:bg-slate-700/30';

function RolesSkeleton() {
    return (
        <div className="max-w-[1600px] mx-auto px-4 md:px-7 py-8 space-y-5 w-full animate-pulse">
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
                    {Array.from({ length: 8 }).map((_, i) => (
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

// Entrada del panel de la pestaña activa. Sólo anima opacity: un transform en
// un ancestro de la tabla rompería los dropdowns `position: fixed` de filtros.
function TabPanel({ tab, panelRef, children }) {
    useGSAP(
        () => {
            if (prefersReducedMotion() || !panelRef.current) return;
            gsap.fromTo(
                panelRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'opacity' }
            );
        },
        { dependencies: [tab] }
    );
    return <div ref={panelRef}>{children}</div>;
}

function RolesAdminContent() {
    const { toast } = useToast();
    const { isSuperuser } = useAuth();
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
    // null = sin restricción (ve todo); string[] = restringido a esos códigos
    // de Unidad de Negocio (ver RolUnScope en el backend).
    const [unScope, setUnScope] = useState(null);
    // null = sin restricción (ve todas las columnas de Plantilla Detalle);
    // string[] = restringido a esas columnas (ver RolColumnScope).
    const [columnasDetalle, setColumnasDetalle] = useState(null);
    const [isNewUserOpen, setIsNewUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', rol: '', ua: '', activo: true, password: '' });
    // Restablecimiento de contraseña: sin correo institucional disponible no hay
    // liga de reseteo, así que un admin la reasigna desde aquí.
    const [passwordEntry, setPasswordEntry] = useState(null);
    const [passwordValue, setPasswordValue] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const [activeTab, setActiveTab] = useState('roles');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [activeSessionsByEmail, setActiveSessionsByEmail] = useState({});
    const [activityEntry, setActivityEntry] = useState(null);
    const panelRef = useRef(null);

    // Salida del panel actual (fade) y luego cambio de pestaña; TabPanel hace la entrada.
    const changeTab = useCallback(
        (id) => {
            if (id === activeTab) return;
            const el = panelRef.current;
            if (!el || prefersReducedMotion()) {
                setActiveTab(id);
                return;
            }
            gsap.killTweensOf(el);
            gsap.to(el, {
                opacity: 0,
                duration: 0.16,
                ease: 'power1.in',
                onComplete: () => setActiveTab(id),
            });
        },
        [activeTab]
    );

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

    const openNewRole = () => {
        setEditingRole('new');
        setRoleName('');
        setSelectedPermissionIds(new Set());
        setPermSearch('');
        setUnScope(null);
        setColumnasDetalle(null);
    };

    const openEditRole = (role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setSelectedPermissionIds(new Set(role.permissions.map((p) => p.id)));
        setPermSearch('');
        setUnScope(role.un_scope ?? null);
        setColumnasDetalle(role.columnas_detalle ?? null);
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
                    // Permisos y alcance de datos en UNA sola llamada — evita
                    // una ventana donde el rol ya existe con permisos pero
                    // sin su scope todavía.
                    response = await RoleService.updateRole(created.id, {
                        permission_ids,
                        un_scope: unScope,
                        columnas_detalle: columnasDetalle,
                    });
                }
            } else {
                response = await RoleService.updateRole(editingRole.id, {
                    name: roleName.trim(),
                    permission_ids,
                    un_scope: unScope,
                    columnas_detalle: columnasDetalle,
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

    // `value` llega "none" (placeholder de <Select>, que no admite value="") o
    // "rh" — se traduce a null/"rh" para el backend (Whitelist.tablero).
    const handleReassignTablero = async (whitelistEntry, value) => {
        try {
            const tablero = value === 'none' ? null : value;
            const response = await WhitelistService.assignTablero(whitelistEntry.id, tablero);
            if (!response.ok) throw new Error('No se pudo asignar el tablero.');
            const updated = await response.json();
            setWhitelist((current) =>
                current.map((entry) => (entry.id === updated.id ? updated : entry))
            );
            toast.success(`Tablero actualizado para ${whitelistEntry.email}.`);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const openNewUser = () => {
        setNewUser({
            email: '',
            rol: roles[0]?.id ? String(roles[0].id) : '',
            ua: '',
            activo: true,
            password: '',
        });
        setIsNewUserOpen(true);
    };

    const openPasswordDialog = (entry) => {
        setPasswordValue('');
        setPasswordEntry(entry);
    };

    const handleSetPassword = async () => {
        if (!passwordValue.trim()) {
            toast.error('Escribe una contraseña.');
            return;
        }
        setIsSavingPassword(true);
        try {
            const response = await WhitelistService.setPassword(passwordEntry.id, passwordValue);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(
                    data.password?.[0] || data.detail || 'No se pudo asignar la contraseña.'
                );
            }
            const actualizado = await response.json();
            setWhitelist((current) =>
                current.map((u) => (u.id === actualizado.id ? actualizado : u))
            );
            toast.success(
                `Contraseña asignada a ${passwordEntry.email}. Deberá cambiarla al entrar.`
            );
            setPasswordEntry(null);
            setPasswordValue('');
        } catch (error) {
            toast.error(error.message || 'No se pudo asignar la contraseña.');
        } finally {
            setIsSavingPassword(false);
        }
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
            // Opcional al dar de alta: si se omite, el usuario queda registrado
            // pero sin poder entrar hasta que se le asigne una desde la tabla.
            if (newUser.password) payload.password = newUser.password;
            const response = await WhitelistService.create(payload);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(
                    data.detail || data.email?.[0] || data.rol?.[0] || data.password?.[0] || 'No se pudo crear el usuario.'
                );
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

    // --- Permisos del dialog: árbol módulo > tab > sub-permiso + búsqueda ---
    const permsByCodename = useMemo(
        () => new Map(permissions.map((p) => [p.full_codename, p])),
        [permissions]
    );

    // Permisos del catálogo que ya no tienen lugar en el árbol (ej. los
    // `view_ocupacion_sankey/tabla/estadisticas`, dejados de usar en el
    // rediseño 2026-09 pero que algún rol viejo puede seguir teniendo
    // asignados) — se muestran aparte, en "Otros", para no ocultarlos.
    const orphanPermissions = useMemo(() => {
        const treeCodenames = getTreeCodenameSet();
        return permissions.filter((p) => !treeCodenames.has(p.full_codename));
    }, [permissions]);

    const filteredTree = useMemo(() => {
        const q = permSearch.trim().toLowerCase();
        if (!q) return PERMISSION_TREE;

        const filterNode = (node) => {
            const perm = node.codename ? permsByCodename.get(node.codename) : null;
            const selfMatches = Boolean(perm && perm.name.toLowerCase().includes(q));
            // Si el propio nodo matchea, se conservan sus hijos completos
            // (dan contexto); si no, solo los hijos que a su vez matcheen.
            const children = selfMatches
                ? (node.children || [])
                : (node.children || []).map(filterNode).filter(Boolean);
            if (!selfMatches && children.length === 0) return null;
            return { ...node, children };
        };

        return PERMISSION_TREE
            .map((moduleNode) => {
                const children = (moduleNode.children || []).map(filterNode).filter(Boolean);
                return children.length > 0 ? { ...moduleNode, children } : null;
            })
            .filter(Boolean);
    }, [permSearch, permsByCodename]);

    const filteredOrphanPermissions = useMemo(() => {
        const q = permSearch.trim().toLowerCase();
        if (!q) return orphanPermissions;
        return orphanPermissions.filter((p) => p.name.toLowerCase().includes(q));
    }, [orphanPermissions, permSearch]);

    // Módulos a los que todavía no se les hace el recorte por Unidad de
    // Negocio (ver el bloque-guía en plantilla/views.py, junto a
    // _scope_un_filas). El backend NO devuelve datos sin filtrar en estos
    // casos: niega el acceso (default-deny de HasModulePermission), así que
    // el aviso es sobre funcionalidad que no servirá, no sobre una fuga.
    //
    // Plantilla de Empleados ya está cubierta por completo (sus 7 tabs); lo
    // que queda son los módulos de al lado. Al cubrir uno, quítalo de aquí.
    const CODENAMES_FUERA_DE_COBERTURA_SCOPE = [
        PERMISSIONS.VIEW_ORGANIGRAMA_INSTITUCIONAL,
        PERMISSIONS.VIEW_ORGANIGRAMA_ALINEACION,
        PERMISSIONS.VIEW_ORGANIGRAMA_SIG,
        PERMISSIONS.VIEW_OCUPACION_SOLICITUDES,
        PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA,
        PERMISSIONS.VIEW_OFICIOS_TURNADOS,
    ];
    const scopeTieneHuecoDeCobertura =
        Array.isArray(unScope) &&
        CODENAMES_FUERA_DE_COBERTURA_SCOPE.some((codename) => {
            const perm = permsByCodename.get(codename);
            return perm && selectedPermissionIds.has(perm.id);
        });

    const heroStats = {
        roles: roles.length,
        usuarios: whitelist.length,
        online: whitelist.filter((e) => (activeSessionsByEmail[e.email]?.sessions?.length || 0) > 0).length,
        sinPassword: whitelist.filter((e) => !e.tiene_password).length,
    };

    if (isLoading) {
        return <RolesSkeleton />;
    }

    return (
        <div className="max-w-[1600px] mx-auto px-4 md:px-7 py-8 space-y-5 w-full">
            <RolesHero
                stats={heroStats}
                activeTab={activeTab}
                onCreate={activeTab === 'roles' ? openNewRole : openNewUser}
                onSelectTab={changeTab}
            />

            <AnimatedTabs
                tabs={[
                    { id: 'roles', label: 'Roles', icon: ShieldCheck, count: roles.length },
                    { id: 'usuarios', label: 'Usuarios', icon: UsersIcon, count: whitelist.length },
                    ...(isSuperuser ? [{ id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench }] : []),
                ]}
                active={activeTab}
                onChange={changeTab}
            />

            <TabPanel tab={activeTab} panelRef={panelRef}>
            {activeTab === 'roles' && (
                <RolesGrid roles={roles} isLoading={isLoading} onEdit={openEditRole} onDelete={handleDeleteRole} />
            )}

            {activeTab === 'usuarios' && (
                <UsersGrid
                    entries={userRoleFilter ? whitelist.filter((e) => String(e.rol) === userRoleFilter) : whitelist}
                    roles={roles}
                    tableroOptions={TABLERO_OPTIONS}
                    activeSessionsByEmail={activeSessionsByEmail}
                    timeAgoLabel={timeAgoLabel}
                    isLoading={isLoading}
                    roleFilter={userRoleFilter}
                    onRoleFilterChange={setUserRoleFilter}
                    onReassignRole={handleReassignRole}
                    onReassignTablero={handleReassignTablero}
                    onOpenActivity={setActivityEntry}
                    onOpenPassword={openPasswordDialog}
                />
            )}

            {activeTab === 'mantenimiento' && isSuperuser && <MaintenancePanel whitelist={whitelist} />}
            </TabPanel>

            <Dialog
                open={!!editingRole}
                onOpenChange={(open) => {
                    if (!open) {
                        closeDialog();
                        setPreviewCodename(null);
                    }
                }}
            >
                <DialogContent className="lg:max-w-5xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole === 'new' ? 'Nuevo rol' : `Editar rol: ${editingRole?.name || ''}`}
                        </DialogTitle>
                        <DialogDescription>
                            Define el nombre y los permisos que tendrá este rol.
                        </DialogDescription>
                    </DialogHeader>

                    <StaggerIn className="space-y-4 overflow-y-auto pr-1 -mr-1">
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
                                    {filteredTree.map((moduleNode) => (
                                        <PermissionTreeSection
                                            key={moduleNode.id}
                                            moduleNode={moduleNode}
                                            permsByCodename={permsByCodename}
                                            selectedPermissionIds={selectedPermissionIds}
                                            togglePermission={togglePermission}
                                            toggleManyIds={toggleCategoryAll}
                                            previewCodename={previewCodename}
                                            setPreviewCodename={setPreviewCodename}
                                        />
                                    ))}

                                    {filteredOrphanPermissions.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between px-2 mb-1">
                                                <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                                    Otros
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const ids = filteredOrphanPermissions.map((p) => p.id);
                                                        const allSelected = ids.every((id) =>
                                                            selectedPermissionIds.has(id)
                                                        );
                                                        toggleCategoryAll(ids, allSelected);
                                                    }}
                                                    className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                                                >
                                                    {filteredOrphanPermissions.every((p) =>
                                                        selectedPermissionIds.has(p.id)
                                                    )
                                                        ? 'Quitar todos'
                                                        : 'Seleccionar todos'}
                                                </button>
                                            </div>
                                            <div className="space-y-0.5">
                                                {filteredOrphanPermissions.map((perm) => {
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
                                    )}

                                    {filteredTree.length === 0 && filteredOrphanPermissions.length === 0 && (
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Alcance de datos (Unidad de Negocio)
                            </label>
                            <p className="text-xs text-slate-400 mb-2">
                                Cubre los 7 tabs de Plantilla de Empleados: Detalle (incluido
                                Histórico), Estatus Nómina, Mov. Posiciones, Movimientos, Bajas,
                                Distribución Geográfica y Catálogos. Quedan fuera, por no poder
                                recortarse, el subtab Rotación de personal, el subtab Anuencia,
                                los historiales de cambios y las series ya agregadas para toda la
                                ANAM. Los módulos fuera de Plantilla todavía no lo soportan y
                                quedan bloqueados para un rol restringido.
                            </p>
                            <UnScopeSelector value={unScope} onChange={setUnScope} />
                            {scopeTieneHuecoDeCobertura && (
                                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Los módulos fuera de Plantilla de Empleados (Organigrama,
                                    Ocupación de Plazas por Oficio, Valuación Presupuestaria y
                                    Oficios Turnados) aún no saben recortar sus datos por UN. Para
                                    no exponer otras unidades, a un rol restringido se le niega el
                                    acceso a esos módulos aunque tenga el permiso marcado.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Columnas visibles (Plantilla Detalle)
                            </label>
                            <p className="text-xs text-slate-400 mb-2">
                                Las columnas no permitidas ni siquiera llegan al navegador de este rol
                                (no es solo ocultarlas en pantalla). Las que sí se permiten, el usuario
                                las puede mostrar/ocultar libremente para personalizar su vista y su Excel.
                            </p>
                            <ColumnScopeSelector value={columnasDetalle} onChange={setColumnasDetalle} />
                        </div>
                    </StaggerIn>

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

                    <StaggerIn className="space-y-4">
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Contraseña temporal (opcional)
                            </label>
                            <input
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser((c) => ({ ...c, password: e.target.value }))}
                                autoComplete="new-password"
                                placeholder="Se le pedirá cambiarla al entrar"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Mínimo 8 caracteres, no solo números. Si la dejas vacía, el usuario
                                queda registrado pero sin acceso hasta que le asignes una.
                            </p>
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
                    </StaggerIn>

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

            <Dialog
                open={Boolean(passwordEntry)}
                onOpenChange={(open) => !open && setPasswordEntry(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {passwordEntry?.tiene_password
                                ? 'Restablecer contraseña'
                                : 'Asignar contraseña'}
                        </DialogTitle>
                        <DialogDescription>
                            Define la contraseña de{' '}
                            <span className="font-semibold">{passwordEntry?.email}</span> y
                            comunícasela por un canal interno. El sistema le exigirá cambiarla la
                            próxima vez que entre, y sus sesiones abiertas se cerrarán.
                        </DialogDescription>
                    </DialogHeader>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Contraseña temporal
                        </label>
                        <input
                            type="text"
                            value={passwordValue}
                            onChange={(e) => setPasswordValue(e.target.value)}
                            autoComplete="off"
                            placeholder="Mínimo 8 caracteres, no solo números"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            Se muestra en claro a propósito: tienes que poder leerla para
                            transmitírsela al usuario.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPasswordEntry(null)}
                            disabled={isSavingPassword}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSetPassword}
                            disabled={isSavingPassword}
                            className="bg-[#621f32] hover:bg-[#4d1827] text-white"
                        >
                            {isSavingPassword ? 'Guardando...' : 'Guardar contraseña'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <UserActivityDialog entry={activityEntry} onClose={() => setActivityEntry(null)} />
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
