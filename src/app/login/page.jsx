'use client';

import { Zoom } from '@/components/shared/Reveal';
import CambiarPasswordDrawer from '@/components/shared/CambiarPasswordDrawer';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthService } from '@/services/auth.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import DriftWall from '@/components/ui/DriftWall';

const DRIFT_WALL_ITEMS = [
  'view_oficios_turnados',
  'view_ocupacion_estadisticas',
  'view_plantilla_estatus_nomina',
  'view_valuacion_presupuestaria',
  'view_plantilla_mov_posiciones',
  'view_ocupacion_tabla',
  'edit_ocupacion_plazas',
  'view_plantilla_bajas',
  'view_plantilla_geografia',
  'view_plantilla_catalogos',
  'view_ocupacion_sankey',
  'view_plantilla_detalle',
  'view_monitoreo_zafiro',
  'view_plantilla_movimientos',
  'view_organigrama',
  'manage_usuarios',
  'manage_roles',
  'edit_valuacion_parametros',
].map((name) => ({
  image: `/permission-previews/${name}.png`,
  title: name.replace(/_/g, ' '),
}));

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cambioPasswordOpen, setCambioPasswordOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Cargando...');
  const [error, setError] = useState('');

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
    <div className="relative min-h-[calc(100vh-200px)] overflow-hidden flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <LoadingOverlay isLoading={isLoading} text={loadingText} />

      {/* Muro a la deriva de fondo (previews de permisos del sistema), a pantalla completa */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <DriftWall
          items={DRIFT_WALL_ITEMS}
          columns={6}
          parallax={0.5}
          dim={1}
          tileHeight={176}
          depth={20}
          lift={36}
          tilt={0}
          turn={0}
          roll={0}
          fade={0.45}
          gap={14}
          radius={16}
          overlayColor="rgba(0,0,0,0.2)"
        />
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
                      disabled={isLoading}
                      placeholder="usuario@anam.gob.mx"
                      className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#621f32] sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-900"
                  >
                    Contraseña
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      name="password"
                      type={verPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="block w-full rounded-md bg-white px-3 py-2 pr-10 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#621f32] sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setVerPassword((v) => !v)}
                      aria-label={
                        verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-[#621f32]"
                    >
                      {verPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
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
                    disabled={isLoading}
                    className="flex w-full justify-center rounded-md bg-[#621f32] px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#4a1726] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#621f32] transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading ? 'Validando...' : 'Iniciar sesión'}
                  </button>
                </div>
              </form>

              <p className="mt-6 text-center text-xs text-gray-500">
                ¿Olvidaste tu contraseña? Solicita a un administrador del sistema
                que te la restablezca.
              </p>

              <p className="mt-6 text-center text-sm text-gray-600">
                Acceso exclusivo para personal de la{' '}
                <span className="font-semibold text-[#621f32]">
                  Agencia Nacional de Aduanas de México
                </span>
              </p>
            </div>
          </div>
        </div>
      </Zoom>

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
