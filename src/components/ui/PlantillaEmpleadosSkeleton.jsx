'use client';

import React from 'react';
import { LayoutDashboard, ChevronRight, Users } from 'lucide-react';

const BG = 'bg-slate-200/70 dark:bg-slate-700/50';
const BG_LIGHT = 'bg-slate-200/40 dark:bg-slate-700/30';

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
    <section className="bg-transparent relative overflow-hidden pb-20 animate-pulse">
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      <div className="mx-auto w-full max-w-full flex flex-col items-center pt-12 pb-12">
        <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 gap-6">

          {/* Breadcrumb + tabs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full mb-6">
            <div className="flex items-center">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 shadow-md">
                <LayoutDashboard className="size-3.5 text-slate-300 dark:text-slate-600" />
                <span className={`h-3 w-16 rounded ${BG_LIGHT}`} />
                <ChevronRight className="size-3 text-slate-300 dark:text-slate-600" />
                <span className={`h-3 w-28 rounded ${BG}`} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 shadow-md w-full lg:w-auto">
              <div className="flex p-0.5 gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto">
                {TABS.map((label, i) => (
                  <div
                    key={label}
                    className={`px-4 py-2 rounded-lg ${i === 0 ? 'bg-[#621f32]/20' : BG_LIGHT}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-0">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
            <div className="flex items-start sm:items-center gap-6">
              <div className="relative p-5 bg-gradient-to-tr from-[#621f32]/40 to-[#8d2c48]/40 rounded-[2.2rem] shadow-xl flex-shrink-0">
                <Users className="size-10 text-white/40" />
              </div>
              <div className="max-w-screen-md space-y-3">
                <div className={`h-9 w-72 rounded-lg ${BG}`} />
                <div className={`h-4 w-96 rounded-md ${BG_LIGHT}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de tab: full-bleed, fuera del max-w-screen-xl (igual que PlantillaDetalleTab) */}
        <div className="w-full mt-2">
          {/* Stats row: donut card + 6 tiles */}
          <div className="w-full px-4 lg:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch">
              <div className="lg:col-span-3 bg-white/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex items-center justify-center min-h-[180px]">
                <div className={`size-28 rounded-full ${BG_LIGHT}`} />
              </div>
              <div className="lg:col-span-9 grid grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-3 py-3 border-2 border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 flex flex-col justify-between min-h-[100px]"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`p-1.5 rounded-lg size-6 ${BG_LIGHT}`} />
                      <span className={`h-2.5 w-14 rounded ${BG_LIGHT}`} />
                    </div>
                    <div className="space-y-2">
                      <div className={`h-5 w-12 rounded ${BG}`} />
                      <div className={`h-1 w-full rounded-full ${BG_LIGHT}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card de tabla: full-bleed, sin max-width ni padding lateral, igual que cardRef real */}
          <div className="w-full flex justify-center mt-4">
            <div className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl flex flex-col w-full overflow-hidden">

              {/* Search bar + actions */}
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-wrap items-center gap-3 bg-slate-50/30 dark:bg-slate-900/10">
                <div className="flex-1 sm:w-80 h-[50px] bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm" />
                <div className={`hidden sm:block h-[50px] w-28 rounded-2xl ${BG_LIGHT}`} />
                <div className={`h-[50px] w-40 rounded-2xl ${BG_LIGHT}`} />
                <div className={`h-[50px] w-40 rounded-2xl ${BG_LIGHT}`} />
                <div className={`h-[50px] w-32 rounded-2xl ${BG_LIGHT}`} />
                <div className="h-[50px] w-36 rounded-2xl bg-[#621f32]/20 ml-auto" />
              </div>

              {/* Table */}
              <div className="w-full">
                <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`h-3 rounded ${BG_LIGHT}`} />
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
                        className={`h-3 rounded ${col === 0 ? BG : BG_LIGHT}`}
                        style={{ width: `${55 + ((row * 7 + col * 13) % 35)}%` }}
                      />
                    ))}
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
