'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import DashboardSubmenu from './ui/DashboardSubmenu';
import { ChevronDown } from 'lucide-react';
import { PlantillaService } from '@/services/plantilla.service';

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const menuRef = useRef(null);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsDashboardMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Consultar la última actualización de ZAFIRO y escuchar cambios en tiempo real vía SSE
  useEffect(() => {
    let active = true;

    const formatAndSetDate = (isoString) => {
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

      setLastUpdate(`${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`);
    };

    const fetchLastUpdate = async () => {
      try {
        const response = await PlantillaService.getUltimaActualizacion();
        if (response.ok && active) {
          const res = await response.json();
          if (res && res.fecha) {
            formatAndSetDate(res.fecha);
          }
        }
      } catch (err) {
        console.error("Error fetching last update:", err);
      }
    };

    // Carga inicial
    fetchLastUpdate();

    // Suscribirse a actualizaciones en tiempo real vía Server-Sent Events (SSE)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const sseUrl = `${apiBaseUrl}/api/plantilla/bitacora/sse/`;
    let eventSource;

    const connectSSE = () => {
      if (!active) return;
      
      eventSource = new EventSource(sseUrl);
      
      eventSource.onmessage = (event) => {
        if (!active) return;
        if (event.data === 'init') {
          fetchLastUpdate();
        } else if (event.data !== 'ping' && event.data) {
          formatAndSetDate(event.data);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection error, attempting reconnect in 5s...", err);
        if (eventSource) {
          eventSource.close();
        }
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <nav className="fixed top-20 left-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm h-16 flex items-center z-40">
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
            <div className="flex flex-col">
              <span className="text-[#621f32] font-semibold text-sm md:text-lg leading-none md:leading-tight max-w-[200px] md:max-w-none">
                Sistema de Control de Plazas
              </span>
              {lastUpdate && (
                <span className="text-[9px] md:text-[10px] text-gray-500 font-light mt-0.5 leading-none md:leading-normal">
                  Última actualización de información: <span className="font-semibold text-[#621f32]/85">{lastUpdate}</span>
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center gap-x-8">
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
      </div>
    </nav>
  );
}
