'use client';

import { useCallback, useMemo } from 'react';
import { KeyRound, Pencil, ShieldCheck, Trash2, Users as UsersIcon } from 'lucide-react';
import AdminDataGrid, { cellClassName } from './AdminDataGrid';

const COLUMNS = [
    { key: 'name', label: 'Rol', width: 300, visible: true },
    { key: 'permisos', label: 'Permisos', width: 150, visible: true },
    { key: 'alcance', label: 'Alcance de datos', width: 200, visible: true },
    { key: 'usuarios', label: 'Usuarios', width: 130, visible: true },
    { key: 'acciones', label: 'Acciones', width: 90, visible: true, noFilter: true },
];

const MONO_KEYS = [];

const alcanceLabel = (role) =>
    Array.isArray(role.un_scope) ? `${role.un_scope.length} UN` : 'Sin restricción';

export default function RolesGrid({ roles, isLoading, onEdit, onDelete }) {
    const rows = useMemo(
        () =>
            roles.map((role) => ({
                id: role.id,
                name: role.name,
                permisos: String(role.permissions.length),
                alcance: alcanceLabel(role),
                usuarios: String(role.user_count),
                _role: role,
            })),
        [roles]
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
        const restricted = Array.isArray(row._role.un_scope);

        if (col.key === 'name') {
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="p-1.5 rounded-lg bg-[#621f32]/8 dark:bg-[#bc955c]/10 shrink-0">
                            <ShieldCheck className="size-3.5 text-[#621f32] dark:text-[#bc955c]" />
                        </span>
                        <span className="truncate">{value}</span>
                    </div>
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
                    {restricted ? (
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
            return (
                <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                        <UsersIcon className="size-3" /> {value}
                    </span>
                </td>
            );
        }
        return (
            <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(row._role); }}
                    title="Eliminar rol"
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                    <Trash2 className="size-4" />
                </button>
            </td>
        );
    };

    return (
        <AdminDataGrid
            storageKey="roles_admin_roles"
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            renderCell={renderCell}
            renderRowAction={renderRowAction}
            rowActionHeaderLabel="EDIT"
            monoKeys={MONO_KEYS}
            isLoading={isLoading}
            loadingMessage="Cargando roles..."
            searchPlaceholder="Buscar rol..."
            entityLabel="rol"
            entityLabelPlural="roles"
        />
    );
}
