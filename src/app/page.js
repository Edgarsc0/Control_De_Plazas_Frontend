'use client';

import { Zoom } from 'react-awesome-reveal';
import RotatingText from '@/components/ui/RotatingText';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative flex flex-col items-center justify-center bg-transparent min-h-[calc(100vh-240px)] text-slate-900 px-4 py-8 overflow-hidden w-full">
      <Zoom triggerOnce>
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto z-10">
          
          {/* Badge con RotatingText */}
          <div className="flex items-center gap-2 rounded-full border border-[#621f32]/25 bg-[#621f32]/5 pl-1 pr-3 py-1 backdrop-blur-sm">
            <span className="bg-[#621f32] text-white text-[10px] px-3 py-1 rounded-full font-semibold animate-pulse">
              NUEVO
            </span>
            <span className="text-[13px] text-[#621f32] font-semibold flex items-center gap-1.5">
              Plataforma de
              <RotatingText
                texts={[
                  'recursos humanos',
                  'gestión de movimientos',
                  'gestión de bajas',
                  'estadísticas',
                ]}
                mainClassName="font-extrabold text-[#621f32]"
                staggerFrom="last"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-120%', opacity: 0 }}
                staggerDuration={0.02}
                splitLevelClassName="overflow-hidden"
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                rotationInterval={3500}
              />
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-center text-[36px] leading-tight md:text-5xl lg:text-6xl mt-6 font-extrabold tracking-tight text-slate-900 max-w-4xl w-full">
            Sistema de <span className="text-[#621f32] drop-shadow-sm">Control de plazas</span>
          </h1>

          {/* Description */}
          <p className="text-center text-base md:text-lg max-w-[750px] mt-4 text-slate-500 font-light leading-relaxed">
            Plataforma institucional para la administración, monitoreo y análisis estratégico del capital humano en la ANAM. Gestione movimientos de plazas, supervise bajas y visualice estadísticas clave en tiempo real.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <a
              href={isAuthenticated ? '/dashboard' : '/login'}
              className="group bg-[#621f32] active:scale-95 hover:bg-[#621f32]/90 transition-all duration-300 px-8 py-3 text-white text-sm font-medium rounded-full cursor-pointer shadow-lg shadow-[#621f32]/25 inline-flex items-center gap-2"
            >
              {isAuthenticated ? 'Ir a dashboard' : 'Iniciar Sesión'}
              <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
            <Link
              href="/features"
              className="border border-[#621f32]/25 bg-white text-[#621f32] hover:bg-[#621f32]/5 active:scale-95 transition-all duration-300 rounded-full px-8 py-3 text-sm font-medium cursor-pointer shadow-sm inline-flex items-center justify-center"
            >
              Ver características
            </Link>
          </div>

        </div>
      </Zoom>

      {/* Imagen del Dashboard con glow guinda */}
      <Zoom triggerOnce delay={200} className="w-full max-w-7xl">
        <div className="mx-auto mt-16 w-full max-w-5xl px-4 md:px-6 lg:px-10 z-10 relative">
          {/* Capa de glow grande y suave (guinda de fondo amplio) */}
          <div className="pointer-events-none absolute -inset-4 bg-gradient-to-tr from-[#621f32]/15 to-[#bc955c]/5 rounded-3xl blur-[80px] opacity-75 z-0"></div>
          
          {/* Capa de glow intenso central (guinda puro) */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[60%] bg-[#621f32]/15 blur-[50px] rounded-full z-0"></div>
          
          {/* Contenedor de la Imagen con sombra guinda hacia afuera para un efecto de resplandor 3D */}
          <div className="relative z-10 rounded-xl overflow-hidden shadow-[0_0_60px_10px_rgba(98,31,50,0.2),_0_0_20px_2px_rgba(98,31,50,0.35),_0_25px_60px_-15px_rgba(0,0,0,0.3)]">
            <img 
              className="w-full h-auto object-cover object-top rounded-xl max-h-[400px] md:max-h-[500px]" 
              src="/image.png" 
              alt="Dashboard Preview" 
            />
          </div>
        </div>
      </Zoom>
    </section>
  );
}
