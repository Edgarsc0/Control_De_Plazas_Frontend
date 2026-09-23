'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, KeyRound, Plus, ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react';
import CountUp from './CountUp';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(useGSAP);

const TITLE_WORDS = ['Roles', 'y', 'Permisos'];

/** Tarjeta de cristal con foco de luz que sigue al cursor. */
function StatCard({ label, value, icon: Icon, live, warn, onClick }) {
    const handleMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            onMouseMove={handleMove}
            className={`hero-stat group relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4 text-left backdrop-blur-md transition-colors hover:bg-white/80 dark:hover:bg-white/10 ${
                onClick ? 'cursor-pointer' : ''
            }`}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background:
                        'radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), rgba(188,149,92,0.22), transparent 70%)',
                }}
            />
            <div className="relative flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
                <span
                    className={`p-1.5 rounded-lg ${
                        warn
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                            : 'bg-[#621f32]/10 text-[#621f32] dark:bg-white/10 dark:text-[#bc955c]'
                    }`}
                >
                    <Icon className="size-3.5" />
                </span>
            </div>
            <div className="relative mt-2 flex items-end gap-2">
                <CountUp value={value} className="text-3xl font-black leading-none text-slate-800 dark:text-slate-100 tabular-nums" />
                {live && value > 0 && (
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                        </span>
                        en vivo
                    </span>
                )}
            </div>
        </Tag>
    );
}

export default function RolesHero({ stats, activeTab, onCreate, onSelectTab }) {
    const rootRef = useRef(null);

    useGSAP(
        () => {
            if (prefersReducedMotion()) return;

            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
            tl.from('.hero-shell', { opacity: 0, y: 24, scale: 0.98, duration: 0.7 })
                .from('.hero-orb', { scale: 0, opacity: 0, duration: 1.3, stagger: 0.15, ease: 'expo.out' }, 0)
                .from('.hero-icon', { rotate: -90, scale: 0, duration: 0.7, ease: 'back.out(1.8)' }, 0.15)
                .from('.hero-word', { yPercent: 115, opacity: 0, duration: 0.6, stagger: 0.07 }, 0.25)
                .from('.hero-sub', { opacity: 0, y: 10, duration: 0.5 }, 0.5)
                .from('.hero-cta', { opacity: 0, scale: 0.8, duration: 0.55, ease: 'back.out(2)' }, 0.55)
                .from('.hero-stat', { opacity: 0, y: 28, duration: 0.6, stagger: 0.09 }, 0.45);

            // Deriva lenta y continua de los orbes de fondo.
            gsap.to('.hero-orb-a', { x: 50, y: -24, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
            gsap.to('.hero-orb-b', { x: -40, y: 30, duration: 10, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        },
        { scope: rootRef }
    );

    // El texto del botón cambia con la pestaña: entra deslizándose.
    useGSAP(
        () => {
            if (prefersReducedMotion()) return;
            gsap.fromTo(
                '.hero-cta-label',
                { opacity: 0, y: 8 },
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,transform' }
            );
        },
        { scope: rootRef, dependencies: [activeTab] }
    );

    const items = [
        { id: 'roles', label: 'Roles', value: stats.roles, icon: ShieldCheck, onClick: () => onSelectTab('roles') },
        { id: 'usuarios', label: 'Usuarios', value: stats.usuarios, icon: UsersIcon, onClick: () => onSelectTab('usuarios') },
        { id: 'online', label: 'En línea ahora', value: stats.online, icon: Activity, live: true },
        { id: 'sinpass', label: 'Sin contraseña', value: stats.sinPassword, icon: KeyRound, warn: stats.sinPassword > 0 },
    ];

    return (
        <div ref={rootRef}>
            <section className="hero-shell relative overflow-hidden rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl p-5 sm:p-7 shadow-sm">
                {/* Fondo: retícula + orbes difuminados */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(98,31,50,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(98,31,50,0.07) 1px, transparent 1px)',
                        backgroundSize: '36px 36px',
                        maskImage: 'radial-gradient(ellipse at 30% 0%, black 30%, transparent 75%)',
                        WebkitMaskImage: 'radial-gradient(ellipse at 30% 0%, black 30%, transparent 75%)',
                    }}
                />
                <div className="hero-orb hero-orb-a pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[#bc955c]/15 blur-3xl" />
                <div className="hero-orb hero-orb-b pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-[#621f32]/10 dark:bg-[#0f766e]/15 blur-3xl" />

                <div className="relative flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="hero-icon p-3 rounded-2xl bg-[#621f32]/10 dark:bg-white/10 ring-1 ring-[#621f32]/15 dark:ring-white/15">
                            <ShieldCheck className="size-7 text-[#621f32] dark:text-[#bc955c]" />
                        </div>
                        <div>
                            <h1 className="flex flex-wrap gap-x-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                                {TITLE_WORDS.map((word) => (
                                    <span key={word} className="inline-block overflow-hidden pb-1">
                                        <span className="hero-word inline-block">{word}</span>
                                    </span>
                                ))}
                            </h1>
                            <p className="hero-sub text-sm text-slate-500 dark:text-slate-400">
                                Crea roles y decide qué módulos puede ver o editar cada usuario.
                            </p>
                        </div>
                    </div>

                    {activeTab !== 'mantenimiento' && (
                    <button
                        type="button"
                        onClick={onCreate}
                        className="hero-cta group inline-flex items-center gap-2 rounded-xl bg-[#621f32] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#621f32]/25 transition-all hover:-translate-y-0.5 hover:bg-[#4d1827] hover:shadow-lg cursor-pointer"
                    >
                        <span className="hero-cta-label inline-flex items-center gap-2">
                            {activeTab === 'roles' ? (
                                <>
                                    <Plus className="size-4 transition-transform group-hover:rotate-90" /> Nuevo rol
                                </>
                            ) : (
                                <>
                                    <UserPlus className="size-4" /> Nuevo usuario
                                </>
                            )}
                        </span>
                    </button>
                    )}
                </div>

                <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {items.map((item) => (
                        <StatCard key={item.id} {...item} />
                    ))}
                </div>
            </section>
        </div>
    );
}
