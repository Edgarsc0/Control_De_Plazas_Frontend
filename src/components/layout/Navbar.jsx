'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import DashboardSubmenu from '@/components/ui/DashboardSubmenu';
import { ChevronDown } from 'lucide-react';
import { useZafiroUpdates } from '@/context/ZafiroUpdatesContext';
import { SystemService } from '@/services/system.service';

function formatFecha(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`;
}

export default function Navbar() {
  const { isAuthenticated, email, role, logout } = useAuth();
  const { lastUpdate } = useZafiroUpdates();
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [systemUpdate, setSystemUpdate] = useState(null);
  const [showCommitMessage, setShowCommitMessage] = useState(false);
  const systemUpdateRef = useRef(null);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsDashboardMenuOpen(false);
      }
      if (systemUpdateRef.current && !systemUpdateRef.current.contains(event.target)) {
        setShowCommitMessage(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Última actualización de código (commit más reciente entre back y front)
  useEffect(() => {
    let active = true;

    SystemService.getLastUpdate()
      .then(async (response) => {
        if (!response.ok || !active) return;
        const data = await response.json();
        if (data?.fecha) {
          setSystemUpdate({ fecha: formatFecha(data.fecha), mensaje: data.mensaje });
        }
      })
      .catch((err) => console.error('Error fetching system last update:', err));

    return () => {
      active = false;
    };
  }, []);

  return (
    // top-0 en móvil: el Banner gob.mx está oculto ahí, así que este header
    // (el único visible) ocupa el espacio superior en vez de dejarlo en blanco.
    <nav className="fixed top-0 md:top-20 left-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm h-16 flex items-center z-40">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex justify-between items-center">
        {/* Logo and System Name */}
        <div className="flex items-center gap-x-4">
          <Link href="/" className="flex items-center gap-x-3">
            <img
              src="/anam_logo.png"
              alt="Logo ANAM"
              className="h-10 w-auto"
            />
            <div className="hidden md:block h-8 w-[1px] bg-gray-300"></div>
            {/* El bloque de texto debe caber en los 64px de la barra: en móvil el
                título envuelve a 2 líneas, así que las DOS líneas de "última
                actualización" se colapsan en una sola (tocable, abre el detalle
                completo). Con las dos líneas el contenido medía ~70px y se
                pintaba por encima del banner gob.mx y por debajo, sobre la
                página. */}
            <div className="flex flex-col min-w-0">
              <span className="text-[#621f32] font-semibold text-[13px] md:text-lg leading-tight max-w-[200px] md:max-w-none">
                Sistema de Control de Plazas
              </span>
              {lastUpdate && (
                <span className="hidden md:block text-[10px] text-gray-500 font-light mt-0.5 leading-normal">
                  Última actualización de información: <span className="font-semibold text-[#621f32]/85">{lastUpdate}</span>
                </span>
              )}
              {(systemUpdate || lastUpdate) && (
                <div className="relative" ref={systemUpdateRef}>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Ver detalle de últimas actualizaciones"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCommitMessage((prev) => !prev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowCommitMessage((prev) => !prev);
                      }
                    }}
                    className="relative block text-[9px] md:text-[10px] text-gray-500 font-light mt-0.5 leading-none md:leading-normal hover:text-[#621f32] transition-colors cursor-pointer outline-none py-[18px] -my-[18px] md:py-0 md:my-0"
                  >
                    {/* Móvil: una sola línea resumida */}
                    <span className="md:hidden">
                      Actualizado: <span className="font-semibold text-[#621f32]/85">{lastUpdate || systemUpdate?.fecha}</span>
                    </span>
                    {/* Escritorio: la línea de sistema, como siempre */}
                    {systemUpdate && (
                      <span className="hidden md:inline">
                        Última actualización del sistema: <span className="font-semibold text-[#621f32]/85">{systemUpdate.fecha}</span>
                      </span>
                    )}
                  </span>

                  <AnimatePresence>
                    {showCommitMessage && (
                      <div
                        onClick={(e) => e.preventDefault()}
                        className="absolute top-full left-0 mt-1 w-64 max-w-[80vw] rounded-md border border-gray-200 bg-white shadow-lg p-2.5 text-xs text-gray-700 z-50"
                      >
                        {/* En móvil este popover es el único sitio donde se ven
                            las dos fechas completas (arriba sólo cabe una). */}
                        <div className="md:hidden flex flex-col gap-1 mb-2 pb-2 border-b border-gray-100">
                          {lastUpdate && <span><span className="font-semibold">Información:</span> {lastUpdate}</span>}
                          {systemUpdate && <span><span className="font-semibold">Sistema:</span> {systemUpdate.fecha}</span>}
                        </div>
                        {systemUpdate?.mensaje}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Navigation Links (desktop) — en móvil viven en el BottomNav */}
        <div className="hidden md:flex items-center gap-x-8">
          <Link
            href="/"
            className="text-gray-700 hover:text-[#621f32] font-medium transition-colors"
          >
            Página de inicio
          </Link>

          {isAuthenticated && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsDashboardMenuOpen(!isDashboardMenuOpen)}
                className={`flex items-center gap-1 text-gray-700 hover:text-[#621f32] font-medium transition-colors cursor-pointer outline-none ${isDashboardMenuOpen ? 'text-[#621f32]' : ''}`}
              >
                Dashboard
                <ChevronDown className={`size-4 transition-transform duration-300 ${isDashboardMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDashboardMenuOpen && (
                  <DashboardSubmenu onClose={() => setIsDashboardMenuOpen(false)} />
                )}
              </AnimatePresence>
            </div>
          )}

          {isAuthenticated && email && (
            <div className="hidden lg:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-[#621f32]">{email}</span>
              {role && <span className="text-[11px] text-[#621f32]/70">{role}</span>}
            </div>
          )}

          {isAuthenticated ? (
            <button
              onClick={logout}
              className="bg-[#621f32] text-white px-4 py-2 rounded-md hover:bg-[#4d1827] transition-colors font-medium cursor-pointer"
            >
              Cerrar Sesión
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-[#621f32] text-white px-4 py-2 rounded-md hover:bg-[#4d1827] transition-colors font-medium"
            >
              Login
            </Link>
          )}
        </div>

        {/* Móvil: solo Login si no hay sesión (el resto está en el BottomNav) */}
        {!isAuthenticated && (
          <Link
            href="/login"
            className="md:hidden bg-[#621f32] text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
