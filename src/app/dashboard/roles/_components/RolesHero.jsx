'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, KeyRound, Plus, ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react';
import CountUp from './CountUp';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(useGSAP);

function Stat({ label, value, icon: Icon, live, warn, onClick }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                onClick ? 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer' : ''
            }`}
        >
            <Icon className={`size-4 shrink-0 ${warn && value > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            <div className="text-left leading-tight">
                <div className="flex items-center gap-1.5">
                    <CountUp value={value} className="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums" />
                    {live && value > 0 && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
                <p className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{label}</p>
            </div>
        </Tag>
    );
}

export default function RolesHero({ stats, activeTab, onCreate, onSelectTab }) {
    const rootRef = useRef(null);

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            gsap.from(rootRef.current, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.out' });
        },
        { scope: rootRef }
    );

    const items = [
        { id: 'roles', label: 'Roles', value: stats.roles, icon: ShieldCheck, onClick: () => onSelectTab('roles') },
        { id: 'usuarios', label: 'Usuarios', value: stats.usuarios, icon: UsersIcon, onClick: () => onSelectTab('usuarios') },
        { id: 'online', label: 'En línea ahora', value: stats.online, icon: Activity, live: true },
        { id: 'sinpass', label: 'Sin contraseña', value: stats.sinPassword, icon: KeyRound, warn: stats.sinPassword > 0 },
    ];

    return (
        <div
            ref={rootRef}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-4"
        >
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#621f32]/8 dark:bg-white/10">
                    <ShieldCheck className="size-5 text-[#621f32] dark:text-[#bc955c]" />
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                        Roles y Permisos
                    </h1>
                    <p className="text-xs text-slate-400">
                        Crea roles y decide qué módulos puede ver o editar cada usuario.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center divide-x divide-slate-200 dark:divide-slate-800">
                {items.map((item) => (
                    <Stat key={item.id} {...item} />
                ))}
            </div>

            {activeTab !== 'mantenimiento' && (
                <button
                    type="button"
                    onClick={onCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#621f32] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4d1827] cursor-pointer"
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
                </button>
            )}
        </div>
    );
}
