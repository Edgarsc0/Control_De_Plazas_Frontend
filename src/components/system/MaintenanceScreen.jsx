'use client';

import Link from 'next/link';
import { Home, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMaintenance } from '@/context/MaintenanceContext';

/** Pantalla que ven los usuarios sin exención mientras el sistema está en mantenimiento. */
export default function MaintenanceScreen() {
    const { isAuthenticated, logout } = useAuth();
    const { mensaje } = useMaintenance();

    return (
        <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 w-full text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/mantenimiento.gif"
                alt="Estamos arreglando cositas"
                width={480}
                height={360}
                className="w-full max-w-md h-auto"
            />

            <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">
                Estamos arreglando cositas
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                {mensaje || 'Volvemos muy pronto.'}
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
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <LogOut className="size-4" /> Cerrar sesión
                    </button>
                )}
            </div>
        </section>
    );
}
