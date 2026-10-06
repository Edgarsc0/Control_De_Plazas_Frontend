'use client';

import { useCallback, useMemo } from 'react';
import { Activity, Download, KeyRound, Upload } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AdminDataGrid, { cellClassName } from './AdminDataGrid';
import { aplanarArbol } from './rolesTree';
import { nombreCortoRol } from '@/utils/catalogosUnUa';

const COLUMNS = [
    { key: 'email', label: 'Correo', width: 270, visible: true },
    { key: 'acceso', label: 'Acceso', width: 130, visible: true },
    { key: 'ua_nombre', label: 'UA', width: 170, visible: true },
    { key: 'estado', label: 'Estado', width: 150, visible: true },
    { key: 'pagina', label: 'Página actual', width: 230, visible: true },
    { key: 'rol', label: 'Rol', width: 180, visible: true },
    { key: 'tablero', label: 'Tablero', width: 170, visible: true },
    { key: 'acciones', label: 'Acciones', width: 130, visible: true, noFilter: true },
];

const MONO_KEYS = [];

// Sin columnas congeladas: todas scrollean con el resto.
const STICKY_KEYS = [];

const SELECT_CELL_CLASS =
    'h-7 w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-100 focus-visible:border-[#621f32] focus-visible:ring-[#621f32]/20';

const accesoLabel = (entry) =>
    !entry.tiene_password ? 'Sin contraseña' : entry.debe_cambiar_password ? 'Debe cambiarla' : 'Definida';

const ACCESO_STYLES = {
    'Sin contraseña': 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    'Debe cambiarla': 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400',
    Definida: 'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300',
};

const pageLabel = (s) => `${s.title}${s.subtab ? ` › ${s.subtab}` : ''}`;

export default function UsersGrid({
    entries,
    roles,
    tableroOptions,
    activeSessionsByEmail,
    timeAgoLabel,
    isLoading,
    roleFilter,
    onRoleFilterChange,
    onReassignRole,
    onReassignTablero,
    onOpenActivity,
    onOpenPassword,
    onExportTablero,
    onImportTablero,
}) {
    // Roles en el orden del árbol de la pestaña Roles (unidad por unidad), con
    // su nombre compactado: así se listan los usuarios y los desplegables.
    const rolesOrdenados = useMemo(
        () => aplanarArbol(roles).map(({ role, depth }) => ({ ...role, corto: nombreCortoRol(role), depth })),
        [roles]
    );
    const rolPorId = useMemo(
        () => new Map(rolesOrdenados.map((r, orden) => [String(r.id), { ...r, orden }])),
        [rolesOrdenados]
    );
    const tableroLabelByValue = useMemo(
        () => new Map(tableroOptions.map((o) => [o.value, o.label])),
        [tableroOptions]
    );

    // Una fila por usuario, agrupadas por rol en el orden del árbol de Roles.
    // Los 65 titulares de unidad aparecen SIEMPRE: los que no tienen usuario
    // dejan un renglón "Sin usuario asignado", para ver todas las unidades en
    // el mismo orden que en la pestaña Roles.
    const rows = useMemo(() => {
        const filaDeUsuario = (entry) => {
            const sessions = activeSessionsByEmail[entry.email]?.sessions || [];
            const rol = rolPorId.get(String(entry.rol));
            return {
                id: entry.id,
                email: entry.email,
                acceso: accesoLabel(entry),
                ua_nombre: entry.ua_nombre || '',
                estado: sessions.length > 0 ? 'Activo' : 'Sin sesión',
                pagina: sessions.map(pageLabel).join(' | '),
                rol: rol?.corto || '',
                // No es columna: existe para que la búsqueda encuentre también el nombre completo.
                rol_largo: rol?.name || '',
                tablero: tableroLabelByValue.get(entry.tablero || 'none') || '',
                _entry: entry,
                _sessions: sessions,
            };
        };
        const porRol = new Map();
        const sinRolConocido = [];
        for (const entry of entries) {
            const clave = String(entry.rol);
            if (!rolPorId.has(clave)) { sinRolConocido.push(entry); continue; }
            if (!porRol.has(clave)) porRol.set(clave, []);
            porRol.get(clave).push(entry);
        }
        const porCorreo = (a, b) => a.email.localeCompare(b.email);
        const filas = [];
        for (const role of rolesOrdenados) {
            const usuarios = porRol.get(String(role.id)) || [];
            if (usuarios.length > 0) {
                usuarios.sort(porCorreo).forEach((entry) => filas.push(filaDeUsuario(entry)));
            } else if (role.tipo === 'titular' && (!roleFilter || roleFilter === String(role.id))) {
                filas.push({
                    id: `vacio-${role.id}`,
                    email: 'Sin usuario asignado',
                    acceso: '',
                    ua_nombre: role.name,
                    estado: '',
                    pagina: '',
                    rol: role.corto,
                    rol_largo: role.name,
                    tablero: '',
                    _vacio: true,
                    _sessions: [],
                });
            }
        }
        sinRolConocido.sort(porCorreo).forEach((entry) => filas.push(filaDeUsuario(entry)));
        return filas;
    }, [entries, activeSessionsByEmail, rolPorId, rolesOrdenados, roleFilter, tableroLabelByValue]);

    const renderRowAction = useCallback(
        ({ row }) => row._vacio ? null : (
            <button
                onClick={(e) => { e.stopPropagation(); onOpenActivity(row._entry); }}
                title="Ver actividad"
                className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:text-slate-500 dark:hover:text-[#bc955c] transition-colors cursor-pointer"
            >
                <Activity className="size-4" />
            </button>
        ),
        [onOpenActivity]
    );

    const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu, onDoubleClick }) => {
        const style = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : undefined;
        const base = { onClick, onContextMenu, onDoubleClick, style };
        const entry = row._entry;
        const sessions = row._sessions;

        // Unidad sin usuario: renglón informativo, sin controles.
        if (row._vacio) {
            const texto = col.key === 'email' || col.key === 'ua_nombre' || col.key === 'rol' ? value : '';
            return (
                <td
                    key={col.key}
                    {...base}
                    title={texto || undefined}
                    className={`${cellClassName({ isSelected, muted: true })} ${col.key === 'email' ? 'italic font-normal' : ''}`}
                >
                    {texto || '—'}
                </td>
            );
        }

        switch (col.key) {
            case 'acceso':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${ACCESO_STYLES[value]}`}>
                            {value}
                        </span>
                    </td>
                );
            case 'ua_nombre':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected, muted: !value })}>
                        {value || '—'}
                    </td>
                );
            case 'estado':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        {sessions.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold whitespace-nowrap">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Activo{sessions.length > 1 ? ` · ${sessions.length} pestañas` : ''}
                            </span>
                        ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
                        )}
                    </td>
                );
            case 'pagina': {
                const first = sessions[0];
                return (
                    <td key={col.key}
                        {...base}
                        title={sessions.map((s) => `${pageLabel(s)} · ${timeAgoLabel(s.ts)}`).join('\n') || undefined}
                        className={cellClassName({ isSelected, muted: !first })}
                    >
                        {first ? (
                            <ul className="flex flex-col gap-0.5">
                                {sessions.map((s, i) => (
                                    <li key={i}>
                                        {pageLabel(s)}
                                        <span className="font-normal text-slate-400 dark:text-slate-500"> · {timeAgoLabel(s.ts)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : '—'}
                    </td>
                );
            }
            case 'rol':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <Select value={String(entry.rol)} onValueChange={(v) => onReassignRole(entry, v)}>
                                <SelectTrigger size="sm" className={SELECT_CELL_CLASS}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {rolesOrdenados.map((role) => (
                                        <SelectItem key={role.id} value={String(role.id)} title={role.name} style={{ paddingLeft: `${0.5 + role.depth * 0.9}rem` }}>
                                            {role.corto}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </td>
                );
            case 'tablero':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <Select value={entry.tablero || 'none'} onValueChange={(v) => onReassignTablero(entry, v)}>
                                <SelectTrigger size="sm" className={SELECT_CELL_CLASS}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {tableroOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </td>
                );
            case 'acciones':
                return (
                    <td key={col.key} {...base} className={cellClassName({ isSelected })}>
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenPassword(entry); }}
                                title={entry.tiene_password ? 'Restablecer contraseña' : 'Asignar contraseña'}
                                className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-[#621f32]/5 transition-colors cursor-pointer"
                            >
                                <KeyRound className="size-4" />
                            </button>
                            {entry.tablero === 'personalizable' && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onExportTablero(entry); }}
                                        title="Exportar su tablero"
                                        className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-[#621f32]/5 transition-colors cursor-pointer"
                                    >
                                        <Download className="size-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onImportTablero(entry); }}
                                        title="Cargarle un tablero"
                                        className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-[#621f32]/5 transition-colors cursor-pointer"
                                    >
                                        <Upload className="size-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </td>
                );
            default:
                return <td key={col.key} {...base} className={cellClassName({ isSelected })}>{value}</td>;
        }
    };

    return (
        <AdminDataGrid
            storageKey="roles_admin_usuarios"
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
            countLabel={`${entries.length} usuario${entries.length === 1 ? '' : 's'}`}
            renderCell={renderCell}
            renderRowAction={renderRowAction}
            stickyColumnKeys={STICKY_KEYS}
            rowActionHeaderLabel="ACT"
            monoKeys={MONO_KEYS}
            isLoading={isLoading}
            loadingMessage="Cargando usuarios..."
            searchPlaceholder="Buscar por correo, UA o rol (siglas o nombre completo)..."
            hasExternalFilters={!!roleFilter}
            onResetExternalFilters={() => onRoleFilterChange('')}
            entityLabel="usuario"
            toolbarLeft={
                <Select
                    value={roleFilter || 'all'}
                    onValueChange={(v) => onRoleFilterChange(v === 'all' ? '' : v)}
                >
                    <SelectTrigger className="w-[180px] rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-100 focus-visible:border-[#621f32] focus-visible:ring-[#621f32]/20">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los roles</SelectItem>
                        {rolesOrdenados.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)} title={role.name} style={{ paddingLeft: `${0.5 + role.depth * 0.9}rem` }}>
                                {role.corto}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            }
        />
    );
}
