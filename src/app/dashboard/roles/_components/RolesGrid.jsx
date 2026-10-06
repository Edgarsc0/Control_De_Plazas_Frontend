'use client';

import { useCallback, useMemo, useState } from 'react';
import {
    Building2,
    ChevronRight,
    GitBranchPlus,
    KeyRound,
    Lock,
    Pencil,
    ShieldCheck,
    Trash2,
    User as UserIcon,
    Users as UsersIcon,
} from 'lucide-react';
import AdminDataGrid, { cellClassName } from './AdminDataGrid';
import { aplanarArbol } from './rolesTree';
import { nombreCortoRol } from '@/utils/catalogosUnUa';

const COLUMNS = [
    { key: 'name', label: 'Rol', width: 460, visible: true },
    { key: 'tipo', label: 'Tipo', width: 150, visible: true },
    { key: 'permisos', label: 'Permisos', width: 120, visible: true },
    { key: 'alcance', label: 'Alcance de datos', width: 200, visible: true },
    { key: 'usuarios', label: 'Usuarios', width: 210, visible: true },
    { key: 'acciones', label: 'Acciones', width: 110, visible: true, noFilter: true },
];

const MONO_KEYS = [];

const TIPO_LABEL = { titular: 'Titular de unidad', transversal: 'Transversal', subrol: 'Subrol' };

// La columna Rol se busca/filtra por nombre compactado Y por nombre completo.
const getCellValue = (row, key) => {
    if (key === 'name' && row.nombre_largo && row.nombre_largo !== row.name) return `${row.name} · ${row.nombre_largo}`;
    const v = row?.[key];
    return v === null || v === undefined ? '' : String(v);
};

const TIPO_BADGE = {
    titular: 'bg-[#621f32]/8 text-[#621f32] border-[#621f32]/20 dark:bg-[#bc955c]/10 dark:text-[#bc955c] dark:border-[#bc955c]/30',
    transversal: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    subrol: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

/**
 * Alcance EFECTIVO de un rol: su restricción o, si no tiene una propia, la del
 * ancestro más cercano que sí la tenga (el backend lo resuelve igual, en vivo
 * — ver authentication/scoping.py). Informativo: quien recorta es el servidor.
 */
function alcanceEfectivo(role, rolesById) {
    let un = null;
    let ua = null;
    let heredado = false;
    for (let actual = role, saltos = 0; actual && saltos < 10; saltos += 1) {
        if (un === null && Array.isArray(actual.un_scope)) {
            un = actual.un_scope;
            if (actual !== role) heredado = true;
        }
        if (ua === null && Array.isArray(actual.ua_scope)) {
            ua = actual.ua_scope;
            if (actual !== role) heredado = true;
        }
        actual = actual.padre ? rolesById.get(actual.padre) : null;
    }
    if (un === null && ua === null) return { restringido: false, label: 'Sin restricción' };
    const partes = [];
    if (un !== null) partes.push(`${un.length} UN`);
    if (ua !== null) partes.push(`${ua.length} UA`);
    return { restringido: true, label: `${partes.join(' · ')}${heredado ? ' (heredado)' : ''}` };
}

export default function RolesGrid({ roles, whitelist = [], isLoading, onEdit, onDelete, onCreateSubrole }) {
    // Roles con sus hijos desplegados. Arranca todo colapsado: 13 unidades +
    // los roles transversales, y de ahí se abre lo que se necesite.
    const [expanded, setExpanded] = useState(() => new Set());

    const toggleExpanded = useCallback((id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const rows = useMemo(() => {
        const rolesById = new Map(roles.map((r) => [r.id, r]));
        const usuariosDe = new Map();
        for (const entry of whitelist) {
            if (!usuariosDe.has(entry.rol)) usuariosDe.set(entry.rol, []);
            usuariosDe.get(entry.rol).push(entry);
        }
        const arbol = aplanarArbol(roles);
        // Usuarios en los roles que dependen de cada rol (subroles, aduanas...):
        // cada rol suma los suyos a todos sus ancestros.
        const enDescendencia = new Map();
        for (const { role, ancestros } of arbol) {
            const propios = (usuariosDe.get(role.id) || []).length;
            if (propios) ancestros.forEach((id) => enDescendencia.set(id, (enDescendencia.get(id) || 0) + propios));
        }
        const filas = [];
        for (const { role, depth, ancestros, numHijos } of arbol) {
            const alcance = alcanceEfectivo(role, rolesById);
            const usuarios = [...(usuariosDe.get(role.id) || [])].sort((a, b) => a.email.localeCompare(b.email));
            filas.push({
                id: role.id,
                name: nombreCortoRol(role),
                nombre_largo: role.name,
                tipo: TIPO_LABEL[role.tipo] || role.tipo,
                permisos: String(role.permissions.length),
                alcance: alcance.label,
                usuarios: role.max_usuarios ? `${role.user_count} / ${role.max_usuarios}` : String(role.user_count),
                _role: role,
                _depth: depth,
                _ancestros: ancestros,
                _numHijos: numHijos,
                _numUsuarios: usuarios.length,
                _usuariosDescendencia: enDescendencia.get(role.id) || 0,
                _restringido: alcance.restringido,
            });
            // Los usuarios del rol cuelgan de él como filas hijas (se ven al
            // desplegarlo, o al buscar su correo).
            for (const entry of usuarios) {
                filas.push({
                    id: `u-${entry.id}`,
                    name: entry.email,
                    tipo: 'Usuario',
                    permisos: '',
                    alcance: '',
                    usuarios: '',
                    _user: entry,
                    _depth: depth + 1,
                    _ancestros: [...ancestros, role.id],
                    _numHijos: 0,
                });
            }
        }
        return filas;
    }, [roles, whitelist]);

    const isRowCollapsed = useCallback(
        (row) => row._ancestros.some((id) => !expanded.has(id)),
        [expanded]
    );

    const renderRowAction = useCallback(
        ({ row }) => row._user ? null : (
            <button
                onClick={(e) => { e.stopPropagation(); onEdit(row._role); }}
                title="Editar rol"
                className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:text-slate-500 dark:hover:text-[#bc955c] transition-colors cursor-pointer"
            >
                <Pencil className="size-4" />
            </button>
        ),
        [onEdit]
    );

    const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu, onDoubleClick }) => {
        const style = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : undefined;
        const base = { onClick, onContextMenu, onDoubleClick, style };
        const role = row._role;

        // Fila de usuario colgada de su rol: solo correo y unidad.
        if (row._user) {
            if (col.key === 'name') {
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: `${row._depth * 1.5}rem` }}>
                            <span className="w-5 shrink-0" />
                            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                <UserIcon className="size-3.5 text-slate-500 dark:text-slate-400" />
                            </span>
                            <span className="truncate font-medium" title={value}>{value}</span>
                            {row._user.ua_nombre && (
                                <span className="truncate text-[11px] font-normal text-slate-400" title={row._user.ua_nombre}>
                                    · {row._user.ua_nombre}
                                </span>
                            )}
                        </div>
                    </td>
                );
            }
            if (col.key === 'tipo') {
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                            Usuario
                        </span>
                    </td>
                );
            }
            return <td key={col.key} {...base} className={cellClassName({ isSelected })} />;
        }

        if (col.key === 'name') {
            const desplegables = row._numHijos + row._numUsuarios;
            const abierto = expanded.has(role.id);
            const Icono = role.tipo === 'titular' ? Building2 : ShieldCheck;
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <div
                        className="flex items-center gap-2 min-w-0"
                        style={{ paddingLeft: `${row._depth * 1.5}rem` }}
                    >
                        {desplegables > 0 ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleExpanded(role.id); }}
                                title={abierto ? 'Ocultar lo que depende de este rol' : `Mostrar ${[row._numHijos ? `${row._numHijos} rol(es)` : '', row._numUsuarios ? `${row._numUsuarios} usuario(s)` : ''].filter(Boolean).join(' y ')}`}
                                aria-expanded={abierto}
                                className="p-0.5 rounded-md text-slate-400 hover:text-[#621f32] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                            >
                                <ChevronRight className={`size-4 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                            </button>
                        ) : (
                            <span className="w-5 shrink-0" />
                        )}
                        <span className="p-1.5 rounded-lg bg-[#621f32]/8 dark:bg-[#bc955c]/10 shrink-0">
                            <Icono className="size-3.5 text-[#621f32] dark:text-[#bc955c]" />
                        </span>
                        <span className="truncate" title={row.nombre_largo}>{value}</span>
                        {row._numHijos > 0 && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                {row._numHijos}
                            </span>
                        )}
                    </div>
                </td>
            );
        }
        if (col.key === 'tipo') {
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${TIPO_BADGE[role.tipo] || TIPO_BADGE.subrol}`}>
                        {value}
                    </span>
                </td>
            );
        }
        if (col.key === 'permisos') {
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <KeyRound className="size-3" /> {value}
                    </span>
                </td>
            );
        }
        if (col.key === 'alcance') {
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    {row._restringido ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                            Alcance: {value}
                        </span>
                    ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Sin restricción</span>
                    )}
                </td>
            );
        }
        if (col.key === 'usuarios') {
            const lleno = role.max_usuarios && role.user_count >= role.max_usuarios;
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <span
                        title={role.max_usuarios ? `Este rol admite ${role.max_usuarios} usuario(s)` : undefined}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            lleno
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        <UsersIcon className="size-3" /> {value}
                    </span>
                    {row._usuariosDescendencia > 0 && (
                        <span
                            title={`${row._usuariosDescendencia} usuario(s) en los roles que dependen de este (subroles y unidades adscritas)`}
                            className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400"
                        >
                            +{row._usuariosDescendencia} en subroles
                        </span>
                    )}
                </td>
            );
        }
        return (
            <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                <div className="flex items-center gap-1">
                    {role.name.toLowerCase() !== 'superadmin' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCreateSubrole(role); }}
                            title="Crear un subrol que dependa de este rol"
                            className="p-1 rounded-md text-slate-400 hover:text-[#621f32] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <GitBranchPlus className="size-4" />
                        </button>
                    )}
                    {role.es_sistema ? (
                        <span title="Rol titular de unidad: lo define el sistema y no se puede eliminar" className="p-1 text-slate-300 dark:text-slate-600">
                            <Lock className="size-4" />
                        </span>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(role); }}
                            title="Eliminar rol"
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </div>
            </td>
        );
    };

    return (
        <AdminDataGrid
            storageKey="roles_admin_roles_v3"
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            getCellValue={getCellValue}
            countLabel={`${roles.length} roles`}
            renderCell={renderCell}
            renderRowAction={renderRowAction}
            stickyColumnKeys={[]}
            rowActionHeaderLabel="EDIT"
            monoKeys={MONO_KEYS}
            isLoading={isLoading}
            loadingMessage="Cargando roles..."
            searchPlaceholder="Buscar por siglas, nombre completo o correo de usuario..."
            entityLabel="rol"
            entityLabelPlural="roles"
            isRowCollapsed={isRowCollapsed}
        />
    );
}
