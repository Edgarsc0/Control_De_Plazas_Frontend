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
        <div className="py-12 px-4 mx-auto max-w-screen-xl lg:px-6">
          {/* Elementos Zoom para animar el header */}
          <Zoom triggerOnce>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-16">
              {/* Icono Estilizado */}
              <div className="p-5 bg-[#621f32] rounded-3xl shadow-xl shadow-[#621f32]/20 flex-shrink-0">
                <LayoutDashboard className="size-12 text-white" />
              </div>

              <div className="max-w-screen-md">
                <h2 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
                  Dashboard de{' '}
                  <span className="text-[#621f32]">Control de plazas</span>
                </h2>
                <p className="mt-4 text-gray-500 sm:text-xl font-medium leading-relaxed">
                  Bienvenido al panel integral del Sistema de Control de Plazas.
                  Aquí podras monitorear y gestionar los oficios de solicitud de
                  ocupación asi como tambien algunas otras estadisticas de
                  interes.
                </p>
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
