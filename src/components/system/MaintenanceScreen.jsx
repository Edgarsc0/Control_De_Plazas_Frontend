'use client';

import Link from 'next/link';
import { Home, LogOut, Settings, Wrench } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMaintenance } from '@/context/MaintenanceContext';

/** Pantalla que ven los usuarios sin exención mientras el sistema está en mantenimiento. */
export default function MaintenanceScreen() {
    const { isAuthenticated, logout } = useAuth();
    const { mensaje } = useMaintenance();

    return (
        <section className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12 w-full">
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[#bc955c]/20 blur-3xl motion-safe:animate-pulse" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-10 size-80 rounded-full bg-[#621f32]/15 blur-3xl motion-safe:animate-pulse" />

            <div className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-8 sm:p-10 text-center shadow-xl">
                <div className="relative mx-auto mb-6 flex size-28 items-center justify-center">
                    <Settings className="absolute size-28 text-[#621f32]/15 dark:text-white/10 motion-safe:animate-[spin_14s_linear_infinite]" strokeWidth={1.2} />
                    <Settings className="absolute -right-3 -bottom-1 size-12 text-[#bc955c] motion-safe:animate-[spin_8s_linear_infinite_reverse]" strokeWidth={1.6} />
                    <div className="relative rounded-2xl bg-[#621f32] p-4 shadow-lg shadow-[#621f32]/30">
                        <Wrench className="size-8 text-white motion-safe:animate-[wiggle_2.4s_ease-in-out_infinite]" />
                    </div>
                </div>

                <span className="inline-block rounded-full border border-[#621f32]/25 bg-[#621f32]/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#621f32] dark:text-[#bc955c]">
                    Mantenimiento
                </span>
                <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                    Estamos arreglando cositas
                </h1>
                <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                    {mensaje || 'Volvemos muy pronto.'}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Esta pantalla se actualiza sola en cuanto el sistema esté de vuelta.
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#621f32] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4d1827]"
                    >
                        <Home className="size-4" /> Ir al inicio
                    </Link>
                    {isAuthenticated && (
                        <button
                            type="button"
                            onClick={logout}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <LogOut className="size-4" /> Cerrar sesión
                        </button>
                    )}
                </div>
            </div>

            <style>{`@keyframes wiggle{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}`}</style>
        </section>
    );
}
