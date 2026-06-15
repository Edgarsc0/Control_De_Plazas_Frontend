'use client';

import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Network,
  Database,
  GitFork,
} from 'lucide-react';
import MagicBento from '@/components/ui/MagicBento';

export default function DashboardSkeleton() {
  const SKELETON_BG = "bg-slate-200/70 dark:bg-slate-700/50";
  const SKELETON_BG_LIGHT = "bg-slate-200/40 dark:bg-slate-700/30";

  const cardConfigs = [
    {
      span: 'col-span-2',
      fullContent: true,
      renderContent: () => (
        <div className="flex items-center justify-between gap-8 h-full min-h-[240px] p-6 animate-pulse">
          <div className="flex-1 space-y-8 w-full">
            <div className="flex justify-between items-start">
              <div className={`size-14 ${SKELETON_BG} rounded-2xl`}></div>
              <div className={`w-24 h-6 ${SKELETON_BG} rounded-full`}></div>
            </div>
            <div className="space-y-4">
              <div className={`h-8 ${SKELETON_BG} rounded-lg w-3/4`}></div>
              <div className={`h-4 ${SKELETON_BG_LIGHT} rounded-md w-1/2`}></div>
            </div>
            <div className={`h-14 ${SKELETON_BG_LIGHT} rounded-xl w-1/2 mt-4`}></div>
          </div>
          <div className={`hidden md:block size-36 ${SKELETON_BG} rounded-full ring-8 ring-slate-100 dark:ring-slate-800`}></div>
        </div>
      ),
    },
    {
      span: 'col-span-2',
      icon: BarChart3,
      iconColor: '#d97706',
      iconBg: '#fef3c7',
      label: 'Plazas de Nueva creación',
      title: 'Ocupación por Oficios',
      description: 'Análisis detallado de la ocupación por oficios en las 1800 plazas de la ANAM',
      renderContent: () => (
        <div className="mt-6 animate-pulse">
          <div className={`h-8 ${SKELETON_BG} rounded-lg w-1/2 mb-6`}></div>
          <div className="flex items-end gap-3 h-28 w-full">
             {/* Fake chart bars */}
             {[40, 70, 45, 90, 60, 30].map((height, i) => (
                <div key={i} className={`w-full rounded-t-lg ${SKELETON_BG_LIGHT}`} style={{ height: `${height}%` }}></div>
             ))}
          </div>
        </div>
      ),
    },
    {
      span: 'col-span-2',
      icon: BarChart3,
      iconColor: '#9333ea',
      iconBg: '#f3e8ff',
      label: 'Presupuesto',
      title: 'Presupuestar Volumen de plazas solicitadas',
      description: 'Análisis de presupuesto y costos por nivel y periodo',
      renderContent: () => (
        <div className="mt-6 animate-pulse grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className={`h-12 ${SKELETON_BG} rounded-xl w-full`}></div>
            <div className={`h-5 ${SKELETON_BG_LIGHT} rounded-md w-3/4`}></div>
          </div>
          <div className="space-y-4 flex flex-col justify-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-2.5 ${SKELETON_BG_LIGHT} rounded-full w-full`}></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      span: 'col-span-2',
      icon: Users,
      iconColor: '#621f32',
      iconBg: 'rgba(98,31,50,0.1)',
      label: 'Gestión de movimientos',
      title: 'Oficios Turnados a Dirección de Organización por Control de Gestión',
      description: 'Gestión de movimiento de personal por oficios',
      renderContent: () => (
        <div className="mt-6 animate-pulse space-y-5">
          <div className={`h-7 ${SKELETON_BG} rounded-lg w-1/3`}></div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className={`h-12 ${SKELETON_BG_LIGHT} rounded-xl w-full`}></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      span: 'col-span-2',
      icon: GitFork,
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      label: 'Estructura Organizacional',
      title: 'Organigrama ANAM',
      description: '13 unidades de negocio · 1,365 áreas · Jerarquía interactiva',
      renderContent: () => (
        <div className="mt-6 animate-pulse space-y-4">
          <div className={`h-14 ${SKELETON_BG_LIGHT} rounded-xl w-full`}></div>
          <div className={`h-20 ${SKELETON_BG} rounded-xl w-full`}></div>
        </div>
      ),
    },
    {
      span: 'col-span-1',
      icon: Network,
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      label: 'Red',
      title: 'Conectividad',
      description: 'Integración y sincronización de sistemas',
      renderContent: () => (
        <div className="mt-6 animate-pulse flex flex-col gap-6 h-full min-h-[120px]">
          <div className="grid grid-cols-3 gap-3 mt-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-8 ${SKELETON_BG_LIGHT} rounded-full w-full`}></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      span: 'col-span-1',
      icon: Database,
      iconColor: '#0ea5e9',
      iconBg: '#e0f2fe',
      label: 'Sincronización',
      title: 'Monitoreo ZAFIRO',
      description: 'Bitácora de actualizaciones automáticas de Plantilla y Estructura',
      renderContent: () => (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center mt-4">
          <Database className={`size-14 text-slate-300 dark:text-slate-600 mb-4 animate-pulse`} />
          <div className={`h-3 ${SKELETON_BG_LIGHT} rounded-full w-24 animate-pulse`}></div>
        </div>
      ),
    },
  ];

  return (
    <section className="bg-transparent pb-20">
      <div className="py-12 px-4 mx-auto max-w-screen-xl lg:px-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800 rounded-3xl p-5 md:p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/30 dark:shadow-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#621f32]/10 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#bc955c]/10 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center gap-5">
            <div className="relative group flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#621f32] to-[#bc955c] rounded-2xl blur-lg opacity-30" />
              <div className="relative p-3.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-sm">
                <LayoutDashboard className="size-7 text-[#621f32] dark:text-[#bc955c]" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1.5">
                <h2 className="text-2xl md:text-3xl tracking-tight font-extrabold text-gray-900 dark:text-white">
                  Dashboard de{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#621f32] to-[#bc955c]">
                    Control de Plazas
                  </span>
                </h2>
              </div>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed max-w-4xl">
                Monitorea en tiempo real la distribución de ocupación, valuación presupuestaria y gestión de movimientos de personal de la ANAM.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center w-full">
          <MagicBento cards={cardConfigs} disableAnimations={true} />
        </div>
      </div>
    </section>
  );
}
