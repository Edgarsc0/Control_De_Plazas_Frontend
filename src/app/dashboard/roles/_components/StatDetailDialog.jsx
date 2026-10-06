'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { aplanarArbol } from './rolesTree';
import { nombreCortoRol } from '@/utils/catalogosUnUa';

const TITULOS = {
    titulares: ['Roles titulares de unidad', 'Los 65 roles fijos del sistema: 13 Unidades de Negocio y sus 52 unidades adscritas.'],
    subroles: ['Subroles', 'Roles creados bajo otro rol; heredan su alcance de datos y nunca tienen más permisos que él.'],
    transversales: ['Roles transversales', 'Roles que no pertenecen a una unidad en particular.'],
    usuarios: ['Usuarios', 'Todas las cuentas dadas de alta, en el orden del árbol de roles.'],
    online: ['En línea ahora', 'Usuarios con una sesión activa en este momento y la pantalla en la que están.'],
    sinPassword: ['Sin contraseña', 'Cuentas que todavía no tienen contraseña asignada y no pueden entrar.'],
};

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Detalle de un indicador del banner de Roles y Permisos: la lista de roles o
 * de usuarios que ese número está contando.
 */
export default function StatDetailDialog({ stat, onClose, roles, whitelist, activeSessionsByEmail, timeAgoLabel }) {
    const [busqueda, setBusqueda] = useState('');

    const items = useMemo(() => {
        if (!stat) return [];
        const arbol = aplanarArbol(roles);
        const rolPorId = new Map(arbol.map(({ role }, orden) => [role.id, { role, orden }]));
        const usuariosPorRol = new Map();
        whitelist.forEach((e) => usuariosPorRol.set(e.rol, (usuariosPorRol.get(e.rol) || 0) + 1));

        const filaRol = ({ role }) => {
            const padre = role.padre ? rolPorId.get(role.padre)?.role : null;
            const corto = nombreCortoRol(role);
            const n = usuariosPorRol.get(role.id) || 0;
            return {
                key: `r-${role.id}`,
                titulo: corto,
                detalle: [corto !== role.name ? role.name : '', padre ? `Depende de ${nombreCortoRol(padre)}` : '']
                    .filter(Boolean)
                    .join(' · '),
                extra: `${n} usuario${n === 1 ? '' : 's'}`,
                resaltar: n > 0,
            };
        };
        const filaUsuario = (entry) => {
            const rol = rolPorId.get(entry.rol)?.role;
            const sesiones = activeSessionsByEmail[entry.email]?.sessions || [];
            return {
                key: `u-${entry.id}`,
                titulo: entry.email,
                detalle:
                    stat === 'online'
                        ? sesiones.map((s) => `${s.title}${s.subtab ? ` › ${s.subtab}` : ''} · ${timeAgoLabel(s.ts)}`).join('  |  ')
                        : [rol ? nombreCortoRol(rol) : '', entry.ua_nombre].filter(Boolean).join(' · '),
                extra: stat === 'online' ? (rol ? nombreCortoRol(rol) : '') : sesiones.length > 0 ? 'En línea' : '',
                resaltar: sesiones.length > 0,
                orden: rolPorId.get(entry.rol)?.orden ?? Infinity,
            };
        };
        const usuarios = (filtro) =>
            whitelist.filter(filtro).map(filaUsuario).sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));

        switch (stat) {
            case 'titulares': return arbol.filter(({ role }) => role.tipo === 'titular').map(filaRol);
            case 'subroles': return arbol.filter(({ role }) => role.tipo === 'subrol').map(filaRol);
            case 'transversales': return arbol.filter(({ role }) => role.tipo === 'transversal').map(filaRol);
            case 'online': return usuarios((e) => (activeSessionsByEmail[e.email]?.sessions?.length || 0) > 0);
            case 'sinPassword': return usuarios((e) => !e.tiene_password);
            default: return usuarios(() => true);
        }
    }, [stat, roles, whitelist, activeSessionsByEmail, timeAgoLabel]);

    const q = normalizar(busqueda);
    const visibles = q ? items.filter((i) => normalizar(`${i.titulo} ${i.detalle} ${i.extra}`).includes(q)) : items;
    const [titulo, descripcion] = TITULOS[stat] || ['', ''];

    return (
        <Dialog open={!!stat} onOpenChange={(open) => { if (!open) { setBusqueda(''); onClose(); } }}>
            <DialogContent className="lg:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{titulo} · {items.length}</DialogTitle>
                    <DialogDescription>{descripcion}</DialogDescription>
                </DialogHeader>

                {items.length > 8 && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <input
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar en la lista..."
                            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                        />
                    </div>
                )}

                {visibles.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                        {items.length === 0 ? 'No hay nada que mostrar aquí.' : 'Sin coincidencias.'}
                    </p>
                ) : (
                    <ul className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200">
                        {visibles.map((item) => (
                            <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{item.titulo}</p>
                                    {item.detalle && <p className="text-xs text-slate-500 truncate" title={item.detalle}>{item.detalle}</p>}
                                </div>
                                {item.extra && (
                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        item.resaltar ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {item.extra}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}
