'use client';

import {
  LayoutDashboard,
  LayoutGrid,
  BarChart3,
  Users,
  ShieldCheck,
  Network,
  Database,
  GitFork,
} from 'lucide-react';
import MagicBento from '@/components/ui/MagicBento';
import {
  VacantesPorNivelResumen,
  OcupacionVacantes,
  OficiosTurnadosDO,
  PlantillaEmpleados,
  SecurityContent,
  ConnectivityContent,
  PresupuestarVolumenContent,
  OrganigramaPreviewContent,
} from '@/components/ui/BentoContent';
import { Zoom } from 'react-awesome-reveal';

export default function Dashboard({
  resumenVacantes,
  ocupacion,
  oficiosTurnados,
  resumenEmpleados,
}) {
  const cardConfigs = [
    {
      span: 'col-span-2',
      fullContent: true,
      renderContent: () => (
        <PlantillaEmpleados resumenEmpleados={resumenEmpleados} />
      ),
      onClickRedirectTo: '/dashboard/plantilla_empleados',
    },
    {
      span: 'col-span-2',
      icon: BarChart3,
      iconColor: '#d97706',
      iconBg: '#fef3c7',
      label: 'Plazas de Nueva creación',
      title: 'Ocupación por Oficios',
      description:
        'Análisis detallado de la ocupación por oficios en las 1800 plazas de la ANAM',
      renderContent: () => <OcupacionVacantes resumenOcupacion={ocupacion} />,
      onClickRedirectTo: '/dashboard/ocupacion_plazas_por_oficio',
    },
    {
      span: 'col-span-2',
      icon: BarChart3,
      iconColor: '#9333ea',
      iconBg: '#f3e8ff',
      label: 'Presupuesto',
      title: 'Presupuestar Volumen de plazas solicitadas',
      description: 'Análisis de presupuesto y costos por nivel y periodo',
      renderContent: () => <PresupuestarVolumenContent />,
      onClickRedirectTo: '/dashboard/valuacion_presupuestaria',
    },
    {
      span: 'col-span-2',
      icon: Users,
      iconColor: '#621f32',
      iconBg: 'rgba(98,31,50,0.1)',
      label: 'Gestión de movimientos',
      title:
        'Oficios Turnados a Dirección de Organización por Control de Gestión',
      description: 'Gestión de movimiento de personal por oficios',
      renderContent: () => (
        <OficiosTurnadosDO
          oficiosTurnados={oficiosTurnados}
          color="#621f32"
          pendingColor="#bc955c"
        />
      ),
      onClickRedirectTo: '/dashboard/oficios_turnados_do',
    },
    {
      span: 'col-span-2',
      icon: GitFork,
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      label: 'Estructura Organizacional',
      title: 'Organigrama ANAM',
      description: '13 unidades de negocio · 1,365 áreas · Jerarquía interactiva',
      renderContent: () => <OrganigramaPreviewContent />,
      onClickRedirectTo: '/dashboard/organigrama',
    },
    {
      span: 'col-span-1',
      icon: Network,
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      label: 'Red',
      title: 'Conectividad',
      description: 'Integración y sincronización de sistemas',
      renderContent: () => <ConnectivityContent />,
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
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <Database className="size-12 text-[#0ea5e9] mb-4 opacity-50" />
        </div>
      ),
      onClickRedirectTo: '/dashboard/monitoreo_zafiro',
    },

  ];

  return (
    <>
      <section className="bg-transparent pb-20">
        {/* Header del Dashboard */}
        <div className="py-6 md:py-12 px-4 mx-auto max-w-screen-xl lg:px-6">
          {/* Elementos Zoom para animar el header */}
          <Zoom triggerOnce>
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800 rounded-3xl p-5 md:p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/30 dark:shadow-none">
              {/* Decorative background elements */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#621f32]/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#bc955c]/10 rounded-full blur-[60px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-center md:items-center gap-5">
                {/* Icon Container */}
                <div className="relative group flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#621f32] to-[#bc955c] rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500" />
                  <div className="relative p-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-sm md:p-3.5">
                    <LayoutDashboard className="size-6 md:size-7 text-[#621f32] dark:text-[#bc955c]" />
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1.5">
                    <h2 className="text-xl md:text-3xl tracking-tight font-extrabold text-gray-900 dark:text-white">
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
          </Zoom>

          {/* Contenedor Centrado del Magic Bento */}
          <Zoom triggerOnce>
            <div className="flex justify-center items-center w-full">
              <MagicBento cards={cardConfigs} />
            </div>
          </Zoom>
        </div>
      </section>
    </>
  );
}
