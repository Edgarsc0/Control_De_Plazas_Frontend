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
    Users as UsersIcon,
} from 'lucide-react';
import AdminDataGrid, { cellClassName } from './AdminDataGrid';

const COLUMNS = [
    { key: 'name', label: 'Rol', width: 460, visible: true },
    { key: 'tipo', label: 'Tipo', width: 150, visible: true },
    { key: 'permisos', label: 'Permisos', width: 120, visible: true },
    { key: 'alcance', label: 'Alcance de datos', width: 200, visible: true },
    { key: 'usuarios', label: 'Usuarios', width: 120, visible: true },
    { key: 'acciones', label: 'Acciones', width: 110, visible: true, noFilter: true },
];

const MONO_KEYS = [];

const TIPO_LABEL = { titular: 'Titular de unidad', transversal: 'Transversal', subrol: 'Subrol' };

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

/** Aplana el árbol en orden padre → hijos (por nombre), anotando la profundidad. */
function aplanarArbol(roles) {
    const ids = new Set(roles.map((r) => r.id));
    const hijosDe = new Map();
    for (const role of roles) {
        // Un padre que no vino en la lista se trata como raíz, para no perder el rol.
        const clave = role.padre && ids.has(role.padre) ? role.padre : null;
        if (!hijosDe.has(clave)) hijosDe.set(clave, []);
        hijosDe.get(clave).push(role);
    }
    // Raíces: primero los titulares en el orden del catálogo (cd_un), luego el
    // resto por nombre. Hijos: titulares de UA primero, después subroles.
    const ordenar = (lista) =>
        [...lista].sort((a, b) => {
            const ta = a.tipo === 'titular' ? 0 : 1;
            const tb = b.tipo === 'titular' ? 0 : 1;
            if (ta !== tb) return ta - tb;
            if (ta === 0 && !a.padre && !b.padre) return String(a.cd_un).localeCompare(String(b.cd_un));
            return a.name.localeCompare(b.name, 'es');
        });
    const filas = [];
    const visitar = (role, depth, ancestros) => {
        const hijos = ordenar(hijosDe.get(role.id) || []);
        filas.push({ role, depth, ancestros, numHijos: hijos.length });
        hijos.forEach((hijo) => visitar(hijo, depth + 1, [...ancestros, role.id]));
    };
    ordenar(hijosDe.get(null) || []).forEach((raiz) => visitar(raiz, 0, []));
    return filas;
}

export default function RolesGrid({ roles, isLoading, onEdit, onDelete, onCreateSubrole }) {
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
        return aplanarArbol(roles).map(({ role, depth, ancestros, numHijos }) => {
            const alcance = alcanceEfectivo(role, rolesById);
            return {
                id: role.id,
                name: role.name,
                tipo: TIPO_LABEL[role.tipo] || role.tipo,
                permisos: String(role.permissions.length),
                alcance: alcance.label,
                usuarios: role.max_usuarios ? `${role.user_count} / ${role.max_usuarios}` : String(role.user_count),
                _role: role,
                _depth: depth,
                _ancestros: ancestros,
                _numHijos: numHijos,
                _restringido: alcance.restringido,
            };
        });
    }, [roles]);

    const isRowCollapsed = useCallback(
        (row) => row._ancestros.some((id) => !expanded.has(id)),
        [expanded]
    );

    const renderRowAction = useCallback(
        ({ row }) => (
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

        if (col.key === 'name') {
            const abierto = expanded.has(role.id);
            const Icono = role.tipo === 'titular' ? Building2 : ShieldCheck;
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <div
                        className="flex items-center gap-2 min-w-0"
                        style={{ paddingLeft: `${row._depth * 1.5}rem` }}
                    >
                        {row._numHijos > 0 ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleExpanded(role.id); }}
                                title={abierto ? 'Ocultar roles que dependen de este' : `Mostrar los ${row._numHijos} roles que dependen de este`}
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
                        <span className="truncate" title={value}>{value}</span>
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
            storageKey="roles_admin_roles_v2"
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            renderCell={renderCell}
            renderRowAction={renderRowAction}
            stickyColumnKeys={[]}
            rowActionHeaderLabel="EDIT"
            monoKeys={MONO_KEYS}
            isLoading={isLoading}
            loadingMessage="Cargando roles..."
            searchPlaceholder="Buscar rol (también encuentra aduanas y subroles)..."
            entityLabel="rol"
            entityLabelPlural="roles"
            isRowCollapsed={isRowCollapsed}
        />
    );
}
