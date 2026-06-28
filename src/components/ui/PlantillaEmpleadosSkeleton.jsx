'use client';

import React from 'react';
import { LayoutDashboard, ChevronRight, Users } from 'lucide-react';

const TABS = [
  'Plantilla Detalle',
  'Estatus Nómina',
  'Mov. Posiciones',
  'Movimientos',
  'Empleados Bajas',
  'Distribución Geográfica',
];

export default function PlantillaEmpleadosSkeleton() {
  return (
    <section className="bg-transparent relative overflow-hidden pb-20">
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      <div className="mx-auto w-full max-w-full flex flex-col items-center pt-6 md:pt-12 pb-12">
        <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 gap-4 md:gap-6">

          {/* Breadcrumb + tabs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full mb-2 md:mb-6">
            <div className="flex items-center">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 shadow-md">
                <LayoutDashboard className="size-3.5 text-slate-300 dark:text-slate-600" />
                <span className="skeleton-box h-3 w-16 rounded" />
                <ChevronRight className="size-3 text-slate-300 dark:text-slate-600" />
                <span className="skeleton-box h-3 w-28 rounded" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 shadow-md w-full lg:w-auto">
              <div className="flex p-0.5 gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {TABS.map((label, i) => (
                  <div
                    key={label}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg ${i === 0 ? 'bg-[#621f32]/20' : 'skeleton-box'}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-0">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8 mb-6 md:mb-12">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32]/40 to-[#8d2c48]/40 rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl flex-shrink-0">
                <Users className="size-8 sm:size-10 text-white/40" />
              </div>
              <div className="max-w-screen-md space-y-3">
                <div className="skeleton-box h-8 sm:h-9 w-56 sm:w-72 rounded-lg" />
                <div className="skeleton-box h-4 w-64 sm:w-96 rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de tab: full-bleed, fuera del max-w-screen-xl (igual que PlantillaDetalleTab) */}
        <div className="w-full mt-2">
          {/* Stats row: donut card + 6 tiles */}
          <div className="w-full px-4 lg:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch">
              <div className="lg:col-span-3 bg-white/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex items-center justify-center min-h-[160px]">
                <div className="skeleton-box size-28 rounded-full" />
              </div>
              <div className="lg:col-span-9 grid grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-3 py-3 border-2 border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 flex flex-col justify-between min-h-[96px]"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="skeleton-box size-6 rounded-lg" />
                      <span className="skeleton-box h-2.5 w-10 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="skeleton-box h-5 w-12 rounded" />
                      <div className="skeleton-box h-1 w-full rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card de tabla: full-bleed (igual que cardRef real) */}
          <div className="w-full flex justify-center mt-4">
            <div className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col w-full overflow-hidden">

              {/* Toolbar móvil */}
              <div className="md:hidden flex flex-col gap-2.5 p-4 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
                <div className="flex items-center gap-2">
                  <div className="skeleton-box flex-1 h-11 rounded-2xl" />
                  <div className="h-11 w-11 rounded-2xl bg-[#621f32]/20" />
                  <div className="skeleton-box h-11 w-11 rounded-2xl" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="skeleton-box h-7 w-24 rounded-full" />
                  <div className="skeleton-box h-7 w-20 rounded-full" />
                </div>
              </div>

              {/* Toolbar desktop */}
              <div className="hidden md:flex p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex-wrap items-center gap-3 bg-slate-50/30 dark:bg-slate-900/10">
                <div className="skeleton-box flex-1 sm:max-w-80 h-[50px] rounded-2xl" />
                <div className="skeleton-box h-[50px] w-28 rounded-2xl" />
                <div className="skeleton-box h-[50px] w-40 rounded-2xl" />
                <div className="skeleton-box h-[50px] w-40 rounded-2xl" />
                <div className="skeleton-box h-[50px] w-32 rounded-2xl" />
                <div className="h-[50px] w-36 rounded-2xl bg-[#621f32]/20 ml-auto" />
              </div>

              {/* Tabla desktop */}
              <div className="hidden md:block w-full">
                <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton-box h-3 rounded" />
                  ))}
                </div>
                {Array.from({ length: 9 }).map((_, row) => (
                  <div
                    key={row}
                    className="grid grid-cols-6 gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                  >
                    {Array.from({ length: 6 }).map((_, col) => (
                      <div
                        key={col}
                        className="skeleton-box h-3 rounded"
                        style={{ width: `${55 + ((row * 7 + col * 13) % 35)}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Tarjetas móvil */}
              <div className="md:hidden flex flex-col gap-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="skeleton-box h-3.5 w-2/3 rounded" />
                        <div className="skeleton-box h-2.5 w-1/3 rounded" />
                      </div>
                      <div className="skeleton-box h-5 w-16 rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/70">
                      {Array.from({ length: 4 }).map((__, j) => (
                        <div key={j} className="space-y-1.5">
                          <div className="skeleton-box h-2 w-12 rounded" />
                          <div className="skeleton-box h-2.5 w-16 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
