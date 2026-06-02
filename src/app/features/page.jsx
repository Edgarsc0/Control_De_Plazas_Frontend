'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Zoom, Fade } from 'react-awesome-reveal';
import {
  LayoutDashboard,
  BarChart3,
  Calculator,
  Users,
  FileText,
  GitFork,
  Database,
  Network,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Layers,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
  Globe,
  Settings,
} from 'lucide-react';

const FEATURES = [
  {
    id: 'plazas',
    title: 'Control y Ocupación de Plazas',
    label: 'Plazas ANAM',
    icon: BarChart3,
    color: '#d97706',
    bgColor: 'rgba(217,119,6,0.1)',
    description: 'Administración y desglose de las 1,800 plazas autorizadas dentro de la estructura institucional de la ANAM.',
    bullets: [
      'Monitoreo detallado de estatus (Ocupada, Vacante, Congelada).',
      'Cruce automático de plazas creadas contra oficios autorizados.',
      'Exportación directa a Excel y generación automatizada de reportes.'
    ],
    detailsTitle: 'Monitoreo de Plazas en Tiempo Real',
    detailsDesc: 'Visualiza la disponibilidad y asignación del capital humano con indicadores en tiempo real.',
  },
  {
    id: 'presupuesto',
    title: 'Valuación Presupuestaria',
    label: 'Costo e Impacto',
    icon: Calculator,
    color: '#9333ea',
    bgColor: 'rgba(147,51,234,0.1)',
    description: 'Simulador dinámico para estimar la valuación presupuestal y el impacto económico de nuevos movimientos de personal.',
    bullets: [
      'Simulaciones avanzadas por tabulador de sueldos oficiales de la ANAM.',
      'Cálculo de vigencias (mensual, bimestral, anual).',
      'Proyección de impacto financiero neto para aprobación directiva.'
    ],
    detailsTitle: 'Simulador Financiero Integrado',
    detailsDesc: 'Estima el impacto financiero de las plazas antes de autorizarlas.',
  },
  {
    id: 'plantilla',
    title: 'Plantilla de Personal y RRHH',
    label: 'Gestión Humana',
    icon: Users,
    color: '#2563eb',
    bgColor: 'rgba(37,99,235,0.1)',
    description: 'Módulo integral para la gestión activa y pasiva del personal de la ANAM con bitácora detallada.',
    bullets: [
      'Registro histórico y trazabilidad total de Bajas y Reingresos.',
      'Geolocalización en mapa interactivo de la distribución de empleados.',
      'Búsqueda inteligente multi-filtro (nombre, RFC, CURP, área, puesto).'
    ],
    detailsTitle: 'Directorio y Control de Personal',
    detailsDesc: 'Administra la información de los servidores públicos con historial completo de movimientos.',
  },
  {
    id: 'movimientos',
    title: 'Gestión de Movimientos (Oficios DO)',
    label: 'Dictaminación',
    icon: FileText,
    color: '#621f32',
    bgColor: 'rgba(98,31,50,0.1)',
    description: 'Seguimiento riguroso de solicitudes de personal turnadas a la Dirección de Organización.',
    bullets: [
      'Trazabilidad de estatus (Pendiente, En revisión, Aprobado).',
      'Asociación directa a plazas creadas y validadas presupuestalmente.',
      'Control de firmas, folios y fechas de vigencia administrativa.'
    ],
    detailsTitle: 'Trazabilidad de Solicitudes de Plazas',
    detailsDesc: 'Flujo de trabajo estructurado para la revisión y aprobación de oficios de personal.',
  },
  {
    id: 'organigrama',
    title: 'Organigrama Jerárquico Interactivo',
    label: 'Estructura ANAM',
    icon: GitFork,
    color: '#7c3aed',
    bgColor: 'rgba(124,58,237,0.1)',
    description: 'Visualizador de la estructura institucional de la ANAM con navegación fluida y jerárquica.',
    bullets: [
      'Navegación dinámica por 13 Unidades Responsables principales.',
      'Visualización de 1,365 áreas estructuradas de forma multinivel.',
      'Identificación inmediata de plazas y titulares asignados en cada área.'
    ],
    detailsTitle: 'Exploración de la Estructura Orgánica',
    detailsDesc: 'Navega interactivamente a través de los diferentes niveles de la jerarquía de la ANAM.',
  },
  {
    id: 'zafiro',
    title: 'Sincronización con Sistema ZAFIRO',
    label: 'Sync Integrado',
    icon: Database,
    color: '#0ea5e9',
    bgColor: 'rgba(14,165,233,0.1)',
    description: 'Bitácora y monitoreo en tiempo real de actualizaciones de plantilla con el sistema central de nómina ZAFIRO.',
    bullets: [
      'Sincronización automatizada periódica para evitar discrepancias.',
      'Bitácora detallada de registros agregados, modificados o suspendidos.',
      'Alertas visuales en caso de diferencias entre catálogos.'
    ],
    detailsTitle: 'Bitácora de Sincronización ZAFIRO',
    detailsDesc: 'Auditoría en tiempo real de los procesos de conciliación entre bases de datos externas e internas.',
  }
];

// Interactive Marketing Video component showing a clean demo preview
function InteractiveMarketingVideo({ src, activeFeature }) {
  const [hovered, setHovered] = useState(false);
  const activeData = FEATURES.find(f => f.id === activeFeature);
  const themeColor = activeData?.color || '#621f32';

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-full rounded-2xl border overflow-hidden shadow-2xl bg-slate-950 aspect-video flex items-center justify-center group/video select-none transition-all duration-500"
      style={{
        borderColor: hovered ? `${themeColor}66` : '#1e293b', // slate-800
        boxShadow: hovered 
          ? `0 20px 40px -15px ${themeColor}4d, 0 0 0 1px ${themeColor}33` 
          : '0 25px 50px -12px rgb(0 0 0 / 0.25)'
      }}
    >
      <div className="w-full h-full overflow-hidden relative">
        <video 
          key={activeFeature} 
          src={src} 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 ease-out group-hover/video:scale-105" 
        />
      </div>

      {/* Live Badge */}
      <div 
        className="absolute top-4 left-4 backdrop-blur-md border px-3.5 py-1.5 rounded-full text-[10px] font-mono font-bold text-white tracking-wider shadow pointer-events-none select-none z-10 transition-all duration-500"
        style={{
          backgroundColor: `${themeColor}d9`, // 85% opacity
          borderColor: `${themeColor}59` // 35% opacity
        }}
      >
        DEMO
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [activeFeature, setActiveFeature] = useState('plazas');
  const [isHovered, setIsHovered] = useState(false);
  
  // States for interactive simulations
  // Presupuesto State
  const [plazaCount, setPlazaCount] = useState(5);
  const [sueldoNivel, setSueldoNivel] = useState(25000);
  
  // Organigrama State
  const [orgActiveNode, setOrgActiveNode] = useState('dg');

  // ZAFIRO log simulator ticker
  const [zafiroLogs, setZafiroLogs] = useState([]);

  // Carousel auto-cycling effect
  useEffect(() => {
    if (isHovered) return;

    const timer = setInterval(() => {
      setActiveFeature((current) => {
        const currentIndex = FEATURES.findIndex(f => f.id === current);
        const nextIndex = (currentIndex + 1) % FEATURES.length;
        return FEATURES[nextIndex].id;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isHovered]);
  
  useEffect(() => {
    // Generate initial logs
    const initialLogs = [
      { time: '09:00:00', text: 'Iniciando sincronización con ZAFIRO...', type: 'info' },
      { time: '09:00:05', text: 'Comparando 1,800 plazas locales contra registros centrales...', type: 'info' },
      { time: '09:00:12', text: 'Sincronización completada. 0 discrepancias.', type: 'success' },
    ];
    setZafiroLogs(initialLogs);

    // Add a log every 8 seconds
    const interval = setInterval(() => {
      const types = ['info', 'success', 'warning'];
      const actions = [
        'Consulta de plantilla procesada para Unidad Responsable 11.',
        'Sincronización exitosa. Base de datos actualizada.',
        'Chequeo de plazas inactivas: 0 discrepancias detectadas.',
        'Verificando vigencias de plazas creadas...',
        'Actualización automática de catálogo de puestos realizada.'
      ];
      
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomType = types[Math.floor(Math.random() * 2)]; // Keep it clean, avoid warning spam
      
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      
      setZafiroLogs(prev => [
        { time: timeStr, text: randomAction, type: randomType },
        ...prev.slice(0, 5) // Keep last 6 logs
      ]);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const activeData = FEATURES.find(f => f.id === activeFeature);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8 min-h-screen text-slate-800">
      
      {/* Volver al inicio */}
      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-[#621f32] font-semibold text-sm transition-all duration-200 active:scale-95 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200/50 shadow-sm"
        >
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </div>

      {/* Header de la Página */}
      <div className="text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
        <Zoom triggerOnce duration={600}>
          <div className="max-w-2xl">
            <span className="text-[#bc955c] font-bold text-xs tracking-wider uppercase bg-[#bc955c]/10 px-3 py-1 rounded-full">
              Características del Sistema
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mt-2 leading-tight">
              Diseñado para el <span className="text-[#621f32]">Control Estratégico</span>
            </h1>
            <p className="text-slate-500 font-light mt-3 leading-relaxed">
              Explora las capacidades e integración modular de la plataforma de control de plazas y administración de recursos humanos de la ANAM.
            </p>
          </div>
        </Zoom>
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 shadow-md">
          <div className="p-3 bg-[#621f32]/5 rounded-xl text-[#621f32]">
            <Sparkles className="size-6 animate-pulse" />
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 font-medium">Estadísticas Clave</p>
            <p className="text-lg font-black text-slate-900">1,800 Plazas</p>
          </div>
        </div>
      </div>

      {/* Layout de Exploración de Features (Fila Principal) */}
      <div 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        
        {/* LADO IZQUIERDO: Tarjetas de Features (5 Columnas) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Selecciona un módulo</p>
          
          <div className="flex flex-col gap-3">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              const isActive = activeFeature === feat.id;
              return (
                <button
                  key={feat.id}
                  onClick={() => setActiveFeature(feat.id)}
                  className={`group w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-start gap-4 relative overflow-hidden cursor-pointer ${
                    isActive 
                      ? 'bg-white border-[#621f32] shadow-md shadow-[#621f32]/5 scale-[1.01]' 
                      : 'bg-white/50 hover:bg-white border-slate-200/60 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Color bar indicator on active */}
                  {isActive && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-[5px]" 
                      style={{ backgroundColor: feat.color }}
                    />
                  )}
                  
                  {/* Icon Container */}
                  <div 
                    className="p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 shrink-0 shadow-sm"
                    style={{ 
                      backgroundColor: isActive ? feat.bgColor : 'rgba(100, 116, 139, 0.05)',
                      color: isActive ? feat.color : '#64748b'
                    }}
                  >
                    <Icon className="size-5 transition-transform group-hover:rotate-3" />
                  </div>
                  
                  {/* Text Container */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <h3 className={`text-sm font-black tracking-tight transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                        {feat.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold tracking-tight shrink-0 hidden sm:inline-block"
                        style={{ 
                          backgroundColor: isActive ? feat.bgColor : 'rgba(100, 116, 139, 0.05)',
                          color: isActive ? feat.color : '#64748b'
                        }}
                      >
                        {feat.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-light mt-1 line-clamp-2 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                  
                  {/* Arrow Indicator */}
                  <div className="self-center text-slate-300 group-hover:text-slate-500 shrink-0 transition-all group-hover:translate-x-0.5">
                    <ChevronRight className="size-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* LADO DERECHO: Detalle Interactivo y Mock Preview (7 Columnas) */}
        <div className="lg:col-span-7 lg:sticky lg:top-40">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl border border-slate-200/70 shadow-xl overflow-hidden flex flex-col"
            >
              
              {/* Header del panel de detalle */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: activeData.color }}>
                    Vista Detallada del Módulo
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
                    {activeData.detailsTitle}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-light">
                    {activeData.detailsDesc}
                  </p>
                </div>
                
                {/* Micro logo decorativo */}
                <div 
                  className="p-3 rounded-2xl text-white shadow-md shadow-black/5"
                  style={{ backgroundColor: activeData.color }}
                >
                  {React.createElement(activeData.icon, { className: 'size-6' })}
                </div>
              </div>

              {/* Contenido del Detalle */}
              <div className="p-6 flex flex-col gap-6 flex-1">
                
                {/* Descripción y viñetas */}
                <div>
                  <p className="text-sm text-slate-500 leading-relaxed font-light">
                    {activeData.description}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-3 mt-4">
                    {activeData.bullets.map((bullet, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-normal">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MOCK PREVIEW VIDEO WITH MARKETING ZOOM & CURSOR TRACKING */}
                <InteractiveMarketingVideo 
                  src={`/videos/${activeFeature}.mp4`} 
                  activeFeature={activeFeature} 
                />
              </div>

              {/* Botón de acción */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-400">
                  ¿Quieres ver este módulo en producción?
                </span>
                
                <Link
                  href="/login"
                  className="w-full sm:w-auto text-center px-6 py-2.5 rounded-full text-xs font-bold text-white transition-all active:scale-95 duration-200 hover:shadow-lg inline-flex items-center justify-center gap-1.5"
                  style={{ 
                    backgroundColor: activeData.color,
                    boxShadow: `0 8px 20px -6px ${activeData.color}` 
                  }}
                >
                  Acceder al Sistema
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>

        </div>

      </div>

    </div>
  );
}
