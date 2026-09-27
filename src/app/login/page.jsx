'use client';

import CambiarPasswordDrawer from '@/components/shared/CambiarPasswordDrawer';
import { Zoom } from '@/components/shared/Reveal';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { gsap } from 'gsap';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { AuthService } from '@/services/auth.service';
import { clearAllDatasets } from '@/lib/plantillaBrowserCache';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import BlurText from '@/components/ui/BlurText';

// Tipografía propia de esta pantalla (no Noto Sans, la del resto del sitio
// vía `font-sans` en <html>): al aplicarse directo sobre el contenedor raíz,
// gana por herencia sin tocar la fuente global.
const loginFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cambioPasswordOpen, setCambioPasswordOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Cargando...');
  const [error, setError] = useState('');

  // Panel del formulario: entra deslizándose desde la derecha hasta su
  // posición final (GSAP, no framer) — el panel guinda se anima aparte.
  // `panelReady` se prende en el onComplete de ese tween y de ahí cuelgan,
  // encadenados (no en paralelo), el BlurText del título y el Zoom del
  // contenido del formulario.
  const rightPanelRef = useRef(null);
  const [panelReady, setPanelReady] = useState(false);
  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduceMotion) {
      setPanelReady(true);
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { xPercent: 100, opacity: 0 },
        {
          xPercent: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          onComplete: () => setPanelReady(true),
        }
      );
    });
    return () => ctx.revert();
  }, []);

  const entrarAlDashboard = () => {
    window.location.href = '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingText('Validando credenciales...');
    setIsLoading(true);
    setError('');

    try {
      const response = await AuthService.login(email, password);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ocurrió un error al iniciar sesión.');
        setIsLoading(false);
        return;
      }

      AuthService.saveToken(data.token);

      // Blindaje adicional a la clave namespaceada por usuario en
      // ClientComponent.jsx: en un navegador/perfil compartido, un cambio de
      // usuario nunca debe heredar datasets cacheados de la sesión anterior
      // (Plantilla Detalle, Mov. Posiciones, Bajas) — se vacía por completo
      // en cada login, no solo se namespacea.
      await clearAllDatasets();

      // Contraseña puesta por un administrador: alguien más la conoce, así que
      // el titular la cambia antes de entrar (el drawer no se puede cerrar).
      if (data.debe_cambiar_password) {
        setIsLoading(false);
        setCambioPasswordOpen(true);
        return;
      }

      // Sin apagar el overlay: la navegación releva el estado de carga.
      entrarAlDashboard();
    } catch {
      setError('No se pudo conectar con el servidor.');
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`relative h-stack-nav-dvh md:h-stack-dvh overflow-hidden bg-gradient-to-br from-[#4a1726] via-[#621f32] to-[#7a2740] ${loginFont.className}`}
    >
      <LoadingOverlay isLoading={isLoading} text={loadingText} />

      <div className="flex h-full flex-col md:flex-row">
        {/* Panel hero — identidad institucional, a pantalla completa.
            `@container`: el título usa unidades `cqw` (relativas al ANCHO
            de este panel, no al viewport) para caber siempre en una sola
            línea — a 46% de un viewport angosto el panel es más estrecho
            que en móvil apilado, un breakpoint fijo no alcanza ahí. */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden px-8 py-14 @container md:w-[46%] md:py-0">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40 mix-blend-soft-light"
            style={{ backgroundImage: "url('/pleca.png')" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex max-w-sm flex-col items-center text-center"
          >
            {/* /icon.svg tal cual (favicon real de ANAM): verde, guinda,
                dorado y su propio fondo blanco redondeado. Zoom de entrada
                (react-awesome-reveal) + flote en bucle una vez dentro. */}
            <Zoom triggerOnce duration={600}>
              <motion.img
                alt="Ícono ANAM"
                src="/icon.svg"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="h-24 w-24 drop-shadow-lg md:h-28 md:w-28"
              />
            </Zoom>

            <div className="mt-7 h-[3px] w-12 rounded-full bg-white/35" />

            <h1 className="mt-6 whitespace-nowrap text-[clamp(1.05rem,6.5cqw,2.125rem)] font-extrabold text-white">
              <BlurText
                text="Sistema de Control de Plazas"
                animateBy="words"
                direction="top"
                delay={90}
                stepDuration={0.45}
                start={panelReady}
              />
            </h1>
            <p className="mt-3 text-[11px] tracking-[3px] text-white/60 uppercase md:text-xs">
              <BlurText
                text="Agencia Nacional de Aduanas de México"
                animateBy="words"
                direction="top"
                delay={40}
                stepDuration={0.4}
                start={panelReady}
              />
            </p>
          </motion.div>
        </div>

        {/* Panel del formulario — animado con GSAP (ver useEffect arriba) */}
        <div
          ref={rightPanelRef}
          className="relative z-10 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[#f7f8fa] px-6 py-12 shadow-[0_0_60px_rgba(0,0,0,0.06)] md:-ml-7 md:w-[calc(54%+1.75rem)] md:rounded-l-[28px] md:px-10"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16]"
            style={{ backgroundImage: "url('/pleca.png')" }}
          />

          {/* Logo + Bienvenido/Iniciar sesión + form, todo junto dentro del
              Zoom (react-awesome-reveal): recién se MONTA cuando panelReady
              prende (onComplete del GSAP del panel), así que su entrada
              arranca encadenada, no junto con el slide del panel. */}
          {panelReady && (
          <Zoom triggerOnce duration={600}>
          <img
            alt="Logo Secretaría de Hacienda y Crédito Público — Agencia Nacional de Aduanas de México"
            src="/hacienda_aduanas.png"
            className="relative mb-8 h-auto w-full max-w-[420px]"
          />
          <div className="relative w-full max-w-[374px]">
            <div className="text-center">
              <p className="text-[13px] tracking-[1.5px] text-gray-400 uppercase">
                Bienvenido
              </p>
              <span className="text-[22px] font-extrabold text-gray-800">
                INICIAR SESIÓN
              </span>
              <div className="mx-auto mt-2 h-[3px] w-10 rounded-full bg-[#621f32]" />
            </div>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400 peer-focus:text-[#621f32]" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="peer block w-full rounded-xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 pl-10 pt-5 pb-2 text-sm text-gray-800 shadow-sm outline-none transition-colors duration-200 focus:border-[#621f32] focus:ring-4 focus:ring-[#621f32]/10 disabled:bg-gray-100"
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-all duration-150 peer-focus:top-3.5 peer-focus:text-[10px] peer-focus:text-[#621f32] peer-[&:not(:placeholder-shown)]:top-3.5 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:text-gray-500"
                >
                  Correo institucional (@anam.gob.mx)
                </label>
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400 peer-focus:text-[#621f32]" />
                <input
                  id="password"
                  name="password"
                  type={verPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="peer block w-full rounded-xl border border-gray-200 bg-[#fafafa] px-4 py-3.5 pl-10 pr-10 pt-5 pb-2 text-sm text-gray-800 shadow-sm outline-none transition-colors duration-200 focus:border-[#621f32] focus:ring-4 focus:ring-[#621f32]/10 disabled:bg-gray-100"
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-all duration-150 peer-focus:top-3.5 peer-focus:text-[10px] peer-focus:text-[#621f32] peer-[&:not(:placeholder-shown)]:top-3.5 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:text-gray-500"
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-[#621f32]"
                >
                  {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center text-sm font-medium text-red-600"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#621f32] to-[#4a1726] py-3.5 text-[15px] font-bold tracking-[0.4px] text-white shadow-md transition-colors duration-200 hover:to-[#3a1120] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#621f32] disabled:opacity-50"
              >
                {isLoading ? 'Validando...' : 'Ingresar'}
              </button>

              <p className="pt-1 text-center text-xs text-gray-500">
                ¿Olvidaste tu contraseña?{' '}
                <span className="font-bold text-[#bc955c]">
                  Solicita a un administrador que te la restablezca.
                </span>
              </p>
            </form>
          </div>
          </Zoom>
          )}
        </div>
      </div>

      <CambiarPasswordDrawer
        open={cambioPasswordOpen}
        passwordActual={password}
        forzado
        onSuccess={entrarAlDashboard}
        setGlobalLoading={setIsLoading}
        setGlobalLoadingText={setLoadingText}
      />
    </div>
  );
}
