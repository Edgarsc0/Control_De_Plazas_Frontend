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
import { useUsuariosActivos } from '@/hooks/useUsuariosActivos';
import { useTableroUsuario } from './_components/useTableroUsuario';
import UserActivityDialog from './_components/UserActivityDialog';
import ConfirmModal from '@/components/shared/ConfirmModal';
import StatDetailDialog from './_components/StatDetailDialog';
import { PERMISSIONS } from '@/config/permissions';
import { PERMISSION_PREVIEWS } from '@/config/permissionPreviews';
import { labelUN, labelUA } from '@/utils/catalogosUnUa';
import { PERMISSION_TREE, PERMISSION_COLUMNS, OTROS_ID, getTreeCodenameSet } from '@/config/permissionTree';
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

/**
 * Primer mensaje legible de una respuesta de error de DRF, que puede venir
 * como `{detail}`, como `{campo: [mensajes]}` o como una lista suelta.
 */
function mensajeDeError(data, fallback) {
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data[0] || fallback;
    if (data.detail) return data.detail;
    const primero = Object.values(data)[0];
    if (Array.isArray(primero)) return primero[0] || fallback;
    return typeof primero === 'string' ? primero : fallback;
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
    const [roleToDelete, setRoleToDelete] = useState(null);
    // Indicador del banner cuyo detalle está abierto (ver StatDetailDialog).
    const [statAbierto, setStatAbierto] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [whitelist, setWhitelist] = useState([]);
    const [uas, setUas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingRole, setEditingRole] = useState(null); // objeto rol | 'new' | null
    const [roleName, setRoleName] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);
    // Rol padre del que se está creando/editando (null = rol raíz). Fija el
    // techo de permisos del diálogo — ver allowedPermissionIds.
    const [parentRole, setParentRole] = useState(null);
    const [previewCodename, setPreviewCodename] = useState(null);
    // Lado del modal donde flota la vista previa: el contrario a la columna
    // bajo el cursor, para no tapar los permisos que se están revisando.
    const [previewSide, setPreviewSide] = useState('right');
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
    const [activityEntry, setActivityEntry] = useState(null);
    const panelRef = useRef(null);
    const tableroUsuario = useTableroUsuario();

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

    // Presencia: quién está activo ahora y en qué página (ver PresenceHeartbeat,
    // que es quien alimenta este endpoint). useUsuariosActivos es un poll
    // compartido a nivel módulo — si UsuariosActivosWidget.jsx (tablero)
    // también está montado, no duplica el request.
    const activosRaw = useUsuariosActivos();
    const activeSessionsByEmail = useMemo(() => {
        const byEmail = {};
        (activosRaw || []).forEach((entry) => {
            byEmail[entry.email] = entry;
        });
        return byEmail;
    }, [activosRaw]);

    // `parent` = rol del que dependerá el subrol nuevo; sin él se crea un rol
    // transversal raíz. Un subrol nace con todos los permisos de su padre ya
    // marcados (los hereda) y de ahí se le quitan los que no deba tener.
    const openNewRole = (parent = null) => {
        setEditingRole('new');
        setParentRole(parent);
        setRoleName('');
        setSelectedPermissionIds(new Set(parent ? parent.permissions.map((p) => p.id) : []));
        setPermSearch('');
        setUnScope(null);
        setColumnasDetalle(null);
    };

    const openEditRole = (role) => {
        setEditingRole(role);
        setParentRole(role.padre ? roles.find((r) => r.id === role.padre) || null : null);
        setRoleName(role.name);
        setSelectedPermissionIds(new Set(role.permissions.map((p) => p.id)));
        setPermSearch('');
        setUnScope(role.un_scope ?? null);
        setColumnasDetalle(role.columnas_detalle ?? null);
    };

    const closeDialog = () => setEditingRole(null);

    // Un rol con padre solo puede tener permisos que su padre tenga (el
    // backend lo valida igual; aquí se evita ofrecer lo que rechazaría).
    const allowedPermissionIds = useMemo(
        () => (parentRole ? new Set(parentRole.permissions.map((p) => p.id)) : null),
        [parentRole]
    );
    const esRolSistema = editingRole && editingRole !== 'new' && editingRole.es_sistema;
    // Titular al que el backend sí deja cambiar el alcance por UN (hoy solo el
    // de la oficina del titular de la ANAM, ver UN_TITULAR_ALCANCE_LIBRE).
    const alcanceEditable = !!(esRolSistema && editingRole.alcance_editable);

    // Techo que el rol padre (y sus ancestros) le impone a este rol: se
    // intersectan las restricciones de toda la cadena, igual que hace el
    // backend al resolver el alcance (authentication/scoping.py). null en un
    // campo = nadie en la cadena restringe eso.
    const techoDelPadre = useMemo(() => {
        const techo = { un: null, ua: null, columnas: null };
        const rolesById = new Map(roles.map((r) => [r.id, r]));
        const intersectar = (actual, lista) =>
            actual === null ? [...lista] : actual.filter((x) => lista.includes(x));
        for (let rol = parentRole, saltos = 0; rol && saltos < 10; saltos += 1) {
            if (Array.isArray(rol.un_scope)) techo.un = intersectar(techo.un, rol.un_scope);
            if (Array.isArray(rol.ua_scope)) techo.ua = intersectar(techo.ua, rol.ua_scope);
            if (Array.isArray(rol.columnas_detalle)) {
                techo.columnas = intersectar(techo.columnas, rol.columnas_detalle);
            }
            rol = rol.padre ? rolesById.get(rol.padre) : null;
        }
        return techo;
    }, [parentRole, roles]);

    const togglePermission = (id) => {
        // "Plazas Ocupadas" y "Plazas Vacantes" (plantillas históricas) no se
        // pueden revocar a la vez: juntas forman "Plazas Activas", que es
        // implícita de VIEW_PLANTILLA_HISTORICO y no tiene checkbox propio —
        // dejar ambas fuera la vaciaría sin haber quitado el permiso que la
        // sostiene. Al conceder VIEW_PLANTILLA_HISTORICO por primera vez se
        // conceden también las 2 de entrada (se pueden revocar después, de
        // una a la vez), igual que hace el backfill de la migración 0034
        // para roles que ya tenían el permiso general.
        const permOcupadas = permsByCodename.get(PERMISSIONS.VIEW_PLANTILLA_HISTORICO_PLAZAS_OCUPADAS);
        const permVacantes = permsByCodename.get(PERMISSIONS.VIEW_PLANTILLA_HISTORICO_PLAZAS_VACANTES);
        const permHistorico = permsByCodename.get(PERMISSIONS.VIEW_PLANTILLA_HISTORICO);
        setSelectedPermissionIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                if (permOcupadas && permVacantes && (id === permOcupadas.id || id === permVacantes.id)) {
                    const otraId = id === permOcupadas.id ? permVacantes.id : permOcupadas.id;
                    if (!next.has(otraId)) {
                        toast.error('No se pueden quitar "Ocupadas" y "Vacantes" al mismo tiempo: juntas forman "Plazas Activas", que no se puede revocar.');
                        return current;
                    }
                }
                next.delete(id);
            } else {
                next.add(id);
                if (permHistorico && id === permHistorico.id) {
                    if (permOcupadas && (!allowedPermissionIds || allowedPermissionIds.has(permOcupadas.id))) next.add(permOcupadas.id);
                    if (permVacantes && (!allowedPermissionIds || allowedPermissionIds.has(permVacantes.id))) next.add(permVacantes.id);
                }
            }
            return next;
        });
    };

    const toggleCategoryAll = (ids, allSelected) => {
        setSelectedPermissionIds((current) => {
            const next = new Set(current);
            ids.forEach((id) => {
                if (allSelected) next.delete(id);
                else if (!allowedPermissionIds || allowedPermissionIds.has(id)) next.add(id);
            });
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
            // Por si el rol traía guardada una columna que su padre ya no
            // tiene: no se ve en el selector, así que tampoco se manda.
            const columnasAGuardar =
                Array.isArray(columnasDetalle) && Array.isArray(techoDelPadre.columnas)
                    ? columnasDetalle.filter((c) => techoDelPadre.columnas.includes(c))
                    : columnasDetalle;
            const isNew = editingRole === 'new';
            let response;
            if (isNew) {
                response = await RoleService.createRole({
                    name: roleName.trim(),
                    padre: parentRole ? parentRole.id : null,
                    permission_ids,
                    columnas_detalle: columnasAGuardar,
                    // Un rol con padre no define alcance por UN propio: lo
                    // hereda (ver la sección de alcance del diálogo).
                    ...(parentRole ? {} : { un_scope: unScope }),
                });
            } else {
                // A un titular de unidad no se le manda nombre ni alcance por
                // UN: los define el sistema y el backend rechaza cambiarlos.
                response = await RoleService.updateRole(editingRole.id, {
                    permission_ids,
                    columnas_detalle: columnasAGuardar,
                    ...(esRolSistema ? {} : { name: roleName.trim() }),
                    ...((esRolSistema && !alcanceEditable) || parentRole ? {} : { un_scope: unScope }),
                });
            }
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(mensajeDeError(data, 'No se pudo guardar el rol.'));
            }
            await response.json();
            // Se recarga la lista completa en vez de parchar un solo rol:
            // quitarle un permiso a un rol se lo quita también a sus subroles.
            const recargados = await parseJson(await RoleService.listRoles());
            if (recargados) setRoles(recargados);
            toast.success('Rol guardado correctamente.');
            closeDialog();
        } catch (error) {
            toast.error(error.message || 'No se pudo guardar el rol.');
        } finally {
            setIsSaving(false);
        }
    };

    // La confirmación la pide ConfirmModal (ver `roleToDelete`); si el borrado
    // falla se relanza el error para que el modal siga abierto.
    const handleDeleteRole = async (role) => {
        try {
            const response = await RoleService.deleteRole(role.id);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(mensajeDeError(data, 'No se pudo eliminar el rol.'));
            }
            toast.success('Rol eliminado.');
            setRoles((current) => current.filter((r) => r.id !== role.id));
        } catch (error) {
            toast.error(error.message);
            throw error;
        }
    };

    const handleReassignRole = async (whitelistEntry, rolId) => {
        try {
            const response = await WhitelistService.assignRole(whitelistEntry.id, Number(rolId));
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(mensajeDeError(data, 'No se pudo reasignar el rol.'));
            }
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

    const filteredTreeById = useMemo(
        () => new Map(filteredTree.map((moduleNode) => [moduleNode.id, moduleNode])),
        [filteredTree]
    );

    // Columnas del modal según PERMISSION_COLUMNS; un módulo del árbol que no
    // esté asignado a ninguna columna se agrega al final de la última.
    const permissionColumns = useMemo(() => {
        const asignados = new Set(PERMISSION_COLUMNS.flat());
        const sinColumna = PERMISSION_TREE.map((m) => m.id).filter((id) => !asignados.has(id));
        return PERMISSION_COLUMNS.map((col, i) =>
            i === PERMISSION_COLUMNS.length - 1 ? [...col, ...sinColumna] : col
        );
    }, []);

    const renderOtrosSection = () => {
        if (filteredOrphanPermissions.length === 0) return null;
        const ids = filteredOrphanPermissions.map((p) => p.id);
        const allSelected = ids.every((id) => selectedPermissionIds.has(id));
        return (
            <div key={OTROS_ID}>
                <div className="flex items-center justify-between px-2 mb-1">
                    <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-400">Otros</h4>
                    <button
                        type="button"
                        onClick={() => toggleCategoryAll(ids, allSelected)}
                        className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                    >
                        {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                </div>
                <div className="space-y-0.5">
                    {filteredOrphanPermissions.map((perm) => {
                        const hasPreview = Boolean(PERMISSION_PREVIEWS[perm.full_codename]);
                        return (
                            <label
                                key={perm.id}
                                onMouseEnter={() => hasPreview && setPreviewCodename(perm.full_codename)}
                                onFocus={() => hasPreview && setPreviewCodename(perm.full_codename)}
                                className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedPermissionIds.has(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                    disabled={Boolean(allowedPermissionIds) && !allowedPermissionIds.has(perm.id)}
                                    className="mt-0.5 accent-[#621f32] disabled:opacity-40"
                                />
                                <span className="text-sm text-slate-700">{perm.name}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    };

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
        titulares: roles.filter((r) => r.tipo === 'titular').length,
        subroles: roles.filter((r) => r.tipo === 'subrol').length,
        transversales: roles.filter((r) => r.tipo === 'transversal').length,
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
                onCreate={activeTab === 'roles' ? () => openNewRole() : openNewUser}
                onOpenStat={setStatAbierto}
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
                <RolesGrid
                    roles={roles}
                    whitelist={whitelist}
                    isLoading={isLoading}
                    onEdit={openEditRole}
                    onDelete={setRoleToDelete}
                    onCreateSubrole={openNewRole}
                />
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
                    onExportTablero={tableroUsuario.iniciarExportar}
                    onImportTablero={tableroUsuario.iniciarImportar}
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
                <DialogContent className="lg:max-w-[min(94vw,1500px)] max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole === 'new'
                                ? parentRole
                                    ? `Nuevo subrol de: ${parentRole.name}`
                                    : 'Nuevo rol transversal'
                                : `Editar rol: ${editingRole?.name || ''}`}
                        </DialogTitle>
                        <DialogDescription>
                            {editingRole === 'new' && !parentRole
                                ? 'Rol sin unidad propia (ej. un área de Recursos Humanos). Para un rol que dependa de otro, usa "Crear subrol" en la fila del rol padre.'
                                : 'Define el nombre y los permisos que tendrá este rol.'}
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
                                disabled={esRolSistema}
                                title={esRolSistema ? 'El nombre de un rol titular lo define su unidad' : undefined}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32] disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                            />
                        </div>

                        {(parentRole || esRolSistema) && (
                            <div className="rounded-xl border border-[#621f32]/15 bg-[#621f32]/[0.03] px-3 py-2 text-xs text-slate-600 space-y-1">
                                {esRolSistema && (
                                    <p>
                                        <strong>Rol titular de unidad.</strong> Lo define el sistema: su nombre
                                        {alcanceEditable ? ' es fijo' : ' y su alcance de datos son fijos'}, y admite
                                        una sola persona (el titular). Para dar acceso a más personas de la unidad,
                                        crea un subrol.
                                        {alcanceEditable && ' Por ser la oficina del titular de la ANAM, su alcance de datos sí se puede cambiar, incluso a "Sin restricción".'}
                                    </p>
                                )}
                                {parentRole && (
                                    <p>
                                        Depende de <strong>{parentRole.name}</strong>: solo puede tener permisos que
                                        ese rol tenga ({parentRole.permissions.length}) y nunca ve más datos que él.
                                        Si a su rol padre se le quita un permiso, este también lo pierde.
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                <label className="text-sm font-medium text-slate-700">Permisos</label>
                                <span className="text-xs font-bold text-slate-400">
                                    {selectedPermissionIds.size} seleccionado
                                    {selectedPermissionIds.size === 1 ? '' : 's'}
                                </span>
                                <div className="relative flex flex-1 min-w-[16rem] items-center pl-3 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-[#621f32]/10 focus-within:border-[#621f32]/40">
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
                            </div>

                            {/* 3 columnas: Plantilla | Expediente + módulos | resto de módulos
                                (ver PERMISSION_COLUMNS en config/permissionTree.js). */}
                            <div
                                className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-3"
                                onMouseLeave={() => setPreviewCodename(null)}
                            >
                                {permissionColumns.map((sectionIds, colIndex) => (
                                    <div
                                        key={colIndex}
                                        onMouseEnter={() => setPreviewSide(colIndex === 2 ? 'left' : 'right')}
                                        className={`space-y-4 ${colIndex > 0 ? 'lg:border-l lg:border-slate-100 lg:pl-6' : ''}`}
                                    >
                                        {sectionIds.map((sectionId) => {
                                            if (sectionId === OTROS_ID) return renderOtrosSection();
                                            const moduleNode = filteredTreeById.get(sectionId);
                                            if (!moduleNode) return null;
                                            return (
                                                <PermissionTreeSection
                                                    key={moduleNode.id}
                                                    moduleNode={moduleNode}
                                                    permsByCodename={permsByCodename}
                                                    selectedPermissionIds={selectedPermissionIds}
                                                    togglePermission={togglePermission}
                                                    toggleManyIds={toggleCategoryAll}
                                                    allowedPermissionIds={allowedPermissionIds}
                                                    previewCodename={previewCodename}
                                                    setPreviewCodename={setPreviewCodename}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            {filteredTree.length === 0 && filteredOrphanPermissions.length === 0 && (
                                <p className="text-sm text-slate-400">
                                    {permissions.length === 0
                                        ? 'No hay permisos en el catálogo.'
                                        : `Sin permisos que coincidan con "${permSearch}".`}
                                </p>
                            )}
                        </div>

                        {/* Fila inferior: alcance por UN | columnas visibles. */}
                        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 pt-4 lg:grid-cols-2">
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
                                {esRolSistema && !alcanceEditable ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                        <p>
                                            <span className="font-semibold">Unidad de Negocio:</span>{' '}
                                            {(editingRole.un_scope || []).map((c) => labelUN(c)).join(', ')}
                                        </p>
                                        {Array.isArray(editingRole.ua_scope) && (
                                            <p className="mt-0.5">
                                                <span className="font-semibold">Unidad Administrativa:</span>{' '}
                                                {editingRole.ua_scope.map((c) => labelUA(c)).join(', ')}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            {Array.isArray(editingRole.ua_scope)
                                                ? 'Solo ve las plazas de su Unidad Administrativa dentro de esa Unidad de Negocio.'
                                                : 'Ve toda su Unidad de Negocio, incluidas sus Unidades Administrativas adscritas.'}
                                        </p>
                                    </div>
                                ) : parentRole ? (
                                    // Rol con padre: el alcance no se elige, se
                                    // hereda. Se muestra para que quede claro
                                    // qué datos verá, sin ofrecer cambiarlo.
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                        {techoDelPadre.un === null && techoDelPadre.ua === null ? (
                                            <p>Sin restricción: ve los datos de toda la ANAM, igual que su rol padre.</p>
                                        ) : (
                                            <>
                                                {techoDelPadre.un !== null && (
                                                    <p>
                                                        <span className="font-semibold">Unidad de Negocio:</span>{' '}
                                                        {techoDelPadre.un.map((c) => labelUN(c)).join(', ') || 'ninguna'}
                                                    </p>
                                                )}
                                                {techoDelPadre.ua !== null && (
                                                    <p className="mt-0.5">
                                                        <span className="font-semibold">Unidad Administrativa:</span>{' '}
                                                        {techoDelPadre.ua.map((c) => labelUA(c)).join(', ') || 'ninguna'}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            Heredado de <strong>{parentRole.name}</strong>. Un subrol siempre ve los
                                            mismos datos que su rol padre; lo que se personaliza son sus permisos y
                                            columnas.
                                        </p>
                                    </div>
                                ) : (
                                    <UnScopeSelector value={unScope} onChange={setUnScope} />
                                )}
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

                            <div className="lg:border-l lg:border-slate-100 lg:pl-6">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Columnas visibles (Plantilla Detalle)
                                </label>
                                <p className="text-xs text-slate-400 mb-2">
                                    Las columnas no permitidas ni siquiera llegan al navegador de este rol
                                    (no es solo ocultarlas en pantalla). Las que sí se permiten, el usuario
                                    las puede mostrar/ocultar libremente para personalizar su vista y su Excel.
                                </p>
                                <ColumnScopeSelector
                                    value={columnasDetalle}
                                    onChange={setColumnasDetalle}
                                    allowedKeys={techoDelPadre.columnas}
                                    unrestrictedLabel={parentRole ? 'Heredar las del rol padre' : 'Sin restricción'}
                                    inheritedHint={
                                        parentRole
                                            ? techoDelPadre.columnas === null
                                                ? `Ve todas las columnas, igual que "${parentRole.name}".`
                                                : `Ve las ${techoDelPadre.columnas.length} columnas de "${parentRole.name}". Si a ese rol se le agregan o quitan columnas, este cambia con él.`
                                            : null
                                    }
                                />
                            </div>
                        </div>
                    </StaggerIn>

                    {/* Vista previa flotante del permiso bajo el cursor (no ocupa
                        columna propia; pointer-events-none para no estorbar). */}
                    {previewCodename && PERMISSION_PREVIEWS[previewCodename] && (
                        <div
                            className={`pointer-events-none absolute top-24 z-10 hidden lg:block w-[22rem] h-60 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl ${
                                previewSide === 'left' ? 'left-6' : 'right-6'
                            }`}
                        >
                            <img
                                src={PERMISSION_PREVIEWS[previewCodename]}
                                alt="Vista previa del permiso"
                                className="h-full w-full object-cover object-top"
                            />
                        </div>
                    )}

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

            {tableroUsuario.dialogos}

            <UserActivityDialog entry={activityEntry} onClose={() => setActivityEntry(null)} />

            <StatDetailDialog
                stat={statAbierto}
                onClose={() => setStatAbierto(null)}
                roles={roles}
                whitelist={whitelist}
                activeSessionsByEmail={activeSessionsByEmail}
                timeAgoLabel={timeAgoLabel}
            />

            <ConfirmModal
                open={!!roleToDelete}
                onClose={() => setRoleToDelete(null)}
                onConfirm={() => handleDeleteRole(roleToDelete)}
                title="Eliminar rol"
                message={`¿Eliminar el rol "${roleToDelete?.name ?? ''}"? Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
            />
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
