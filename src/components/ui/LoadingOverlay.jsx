'use client';

import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

/**
 * Componente de Overlay de carga reutilizable
 * @param {boolean} isLoading - Estado de carga
 * @param {string} text - Texto opcional a mostrar debajo de la animación
 */
export default function LoadingOverlay({ isLoading, text = "Cargando..." }) {
  const [mounted, setFocused] = useState(false);

  useEffect(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="relative flex flex-col items-center">
            {/* Contenedor del Spinner y Logo */}
            <div className="relative size-32 flex items-center justify-center">
              {/* Círculos de rotación institucionales */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-4 border-t-[#621f32] border-r-transparent border-b-[#bc955c] border-l-transparent"
              />
              
              {/* Logo Central Animado */}
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.9, 1, 0.9] 
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="flex items-center justify-center"
              >
                <Image
                  src="/anam.png"
                  alt="ANAM Loading"
                  width={80}
                  height={80}
                  className="drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] object-contain"
                />
              </motion.div>
            </div>

            {/* Texto de carga */}
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-white font-bold text-lg tracking-[0.2em] uppercase text-center px-4"
            >
              {text}
            </motion.p>
            
            {/* Barra de progreso infinita sutil */}
            <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#621f32] to-[#bc955c]"
                animate={{ 
                  x: [-200, 200] 
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
