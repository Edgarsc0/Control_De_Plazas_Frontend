'use client';

import React from 'react';
import { Users } from 'lucide-react';

const TABS = [
  { id: "detalle", label: "Plantilla Detalle" },
  { id: "estatus", label: "Estatus Nómina" },
  { id: "movimientos", label: "Mov. Posiciones" },
  { id: "movimientos_personal", label: "Movimientos" },
  { id: "bajas", label: "Empleados Bajas" },
  { id: "mapa", label: "Distribución Geográfica" }
];

export default function PlantillaEmpleadosSkeleton() {
  return (
    <section className="bg-transparent relative transition-all duration-300 overflow-hidden pb-0">
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      {/* Barra de tabs fija: esquina superior derecha bajo Navbar (top-20 + h-16 = top-36 = 144px) */}
      <div className="fixed top-36 left-0 right-0 z-30 hidden sm:flex items-stretch bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-md">
        {TABS.map((tab) => {
          const subtabConfig = {
            estatus: true,
            movimientos: true,
            mapa: true,
          }[tab.id];
          const isActive = tab.id === "detalle";
          return (
            <div key={tab.id} className="relative flex-1">
              <div
                className={`flex items-center justify-center gap-2 w-full whitespace-nowrap px-3.5 py-2.5 border-r border-slate-200/50 ${isActive
                  ? "bg-gradient-to-b from-[#621f32] to-[#8d2c48]"
                  : "bg-white"
                  }`}
              >
                {/* Icon placeholder */}
                <div
                  className="skeleton-box size-3.5 flex-shrink-0 rounded"
                  style={isActive ? { backgroundColor: 'rgba(255, 255, 255, 0.25)' } : undefined}
                />

                {/* Label placeholder */}
                <div
                  className="skeleton-box rounded px-1"
                  style={isActive ? { backgroundColor: 'rgba(255, 255, 255, 0.25)' } : undefined}
                >
                  <span className="opacity-0 text-xs font-bold uppercase tracking-wide">
                    {tab.label}
                  </span>
                </div>

                {/* Chevron placeholder */}
                {subtabConfig && (
                  <div
                    className="skeleton-box size-3 flex-shrink-0 rounded-sm"
                    style={isActive ? { backgroundColor: 'rgba(255, 255, 255, 0.25)' } : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 pt-14 pb-0">
        <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 transition-all duration-300 gap-2">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 mb-4">
            <div className="flex items-start sm:items-center gap-6">
              <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Users className="size-8 sm:size-10 text-white" />
              </div>
              <div className="max-w-screen-md">
                <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
                  Plantilla de <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">Empleados Activos</span>
                </h2>
                <p className="mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                  Detalle completo de plazas, estatus administrativo y estructura funcional en la ANAM.
                </p>
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
