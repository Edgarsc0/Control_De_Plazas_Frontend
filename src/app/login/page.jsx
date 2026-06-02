'use client';

import { Zoom } from 'react-awesome-reveal';
import CodigoVerificacionDrawer from '@/components/CodigoVerificacionDrawer';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import {
  BarChart3,
  Mail,
  Activity,
  TrendingUp,
  PieChart,
  LineChart,
  Database,
  Globe,
} from 'lucide-react';
import { AuthService } from '@/services/auth.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

export default function Login() {
  const [email, setEmail] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Cargando...');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingText('Validando credenciales...');
    setIsLoading(true);
    setError('');

    try {
      const response = await AuthService.checkEmail(email);
      const data = await response.json();

      if (response.ok) {
        setIsVerificationSent(true);
        setDrawerOpen(true);
      } else {
        setError(data.error || 'Ocurrió un error al validar el correo.');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsVerificationSent(false);
    setDrawerOpen(false);
    setError('');
    // Opcional: limpiar el email si quieres resetear totalmente
    // setEmail("");
  };

  return (
    <div className="relative min-h-[calc(100vh-200px)] overflow-hidden flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <LoadingOverlay isLoading={isLoading} text={loadingText} />

      {/* Elementos Decorativos de Fondo (Estadísticas Volando y Coloridas) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating Card: Eficiencia (Guinda) */}
        <motion.div
          animate={{ y: [0, -30, 0], x: [0, 10, 0], rotate: [5, 10, 5] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[5%] hidden xl:block"
        >
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border-l-4 border-[#621f32] shadow-2xl flex flex-col gap-y-2 w-48">
            <div className="flex justify-between items-center">
              <div className="p-2 bg-[#621f32]/10 rounded-lg">
                <BarChart3 className="size-6 text-[#621f32]" />
              </div>
              <span className="text-[10px] font-bold text-green-500">+24%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: ['20%', '80%', '20%'] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="h-full bg-[#621f32]"
              ></motion.div>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Eficiencia
            </span>
          </div>
        </motion.div>

        {/* Floating Card: Usuarios (Azul) */}
        <motion.div
          animate={{ y: [0, 40, 0], x: [0, -15, 0], rotate: [-5, -10, -5] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute top-[15%] right-[8%] hidden xl:block"
        >
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border-l-4 border-blue-500 shadow-2xl flex flex-col gap-y-2 w-48">
            <div className="flex justify-between items-center">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Globe className="size-6 text-blue-500" />
              </div>
              {/* react-doctor-disable-next-line react-doctor/design-no-space-on-flex-children */}
              <div className="flex -space-x-2">
                <div className="size-5 rounded-full bg-gray-200 border border-white"></div>
                <div className="size-5 rounded-full bg-gray-300 border border-white"></div>
              </div>
            </div>
            <span className="text-lg font-black text-gray-800">4.2k</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Conexiones Globales
            </span>
          </div>
        </motion.div>

        {/* Floating Card: Rendimiento (Dorado) */}
        <motion.div
          animate={{ y: [0, -25, 0], x: [0, -20, 0], rotate: [0, -5, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
          className="absolute bottom-[15%] left-[12%] hidden xl:block"
        >
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border-l-4 border-[#bc955c] shadow-2xl flex flex-col gap-y-2 w-48">
            <div className="flex justify-between items-center">
              <div className="p-2 bg-[#bc955c]/10 rounded-lg">
                <TrendingUp className="size-6 text-[#bc955c]" />
              </div>
              <Activity className="size-4 text-orange-400 animate-pulse" />
            </div>
            <div className="flex items-end gap-x-1 h-8">
              {[0.4, 0.7, 0.5, 0.9, 0.6].map((h) => (
                <div
                  key={h}
                  className="flex-1 bg-[#bc955c]/60 rounded-t-sm"
                  style={{ height: `\${h*100}%` }}
                ></div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Tendencia Anual
            </span>
          </div>
        </motion.div>

        {/* Floating Card: Datos (Esmeralda) */}
        <motion.div
          animate={{ y: [0, 35, 0], x: [0, 25, 0], rotate: [10, 0, 10] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
          className="absolute bottom-[20%] right-[5%] hidden xl:block"
        >
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border-l-4 border-emerald-500 shadow-2xl flex flex-col gap-y-2 w-48">
            <div className="flex justify-between items-center">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Database className="size-6 text-emerald-500" />
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold rounded-full">
                OPTIMIZADO
              </span>
            </div>
            <span className="text-lg font-black text-gray-800">99.9%</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Integridad de Datos
            </span>
          </div>
        </motion.div>

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[30%] right-[25%] opacity-20 hidden lg:block"
        >
          <PieChart className="size-16 text-[#bc955c]" />
        </motion.div>

        <motion.div
          animate={{ x: [0, 20, 0], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[40%] right-[20%] hidden lg:block"
        >
          <LineChart className="size-10 text-blue-500" />
        </motion.div>
      </div>

      <Zoom triggerOnce>
        <div className="z-10 flex flex-col justify-center px-6 py-12 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-gray-200">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
              <img
                alt="Logo ANAM"
                src="/anam.png"
                className="mx-auto h-20 w-auto drop-shadow-sm"
              />
              <h2 className="mt-8 text-center text-2xl font-bold tracking-tight text-gray-900">
                Inicia sesión en tu cuenta
              </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Correo institucional (@anam.gob.mx)
                  </label>
                  <div className="mt-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isVerificationSent || isLoading}
                      placeholder="usuario@anam.gob.mx"
                      className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#621f32] sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-2 rounded-md border border-red-100">
                    {error}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isVerificationSent || isLoading}
                    className="flex w-full justify-center rounded-md bg-[#621f32] px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#4a1726] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#621f32] transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading
                      ? 'Validando...'
                      : isVerificationSent
                        ? '✓ Código Enviado'
                        : 'Iniciar sesión'}
                  </button>
                </div>
              </form>

              {isVerificationSent && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDrawerOpen(true)}
                    className="w-full border-[#621f32] text-[#621f32] hover:bg-[#621f32]/10"
                  >
                    Ingresar código de verificación
                  </Button>
                </div>
              )}

              <p className="mt-10 text-center text-sm text-gray-600">
                Acceso exclusivo para personal de la{' '}
                <span className="font-semibold text-[#621f32]">
                  Agencia Nacional de Aduanas de México
                </span>
              </p>
            </div>
          </div>
        </div>
      </Zoom>

      <CodigoVerificacionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        email={email}
        setGlobalLoading={setIsLoading}
        setGlobalLoadingText={setLoadingText}
        onCancel={handleCancel}
      />
    </div>
  );
}
