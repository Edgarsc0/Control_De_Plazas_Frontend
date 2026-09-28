'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Carrusel de fondo con leyenda: fotos en crossfade lento, con
// título/ubicación pintados abajo (scrim degradado para legibilidad).
// `images`: array de string (solo ruta) o de { src, title, location }.
export default function ImageCarousel({
  images = [],
  interval = 6000,
  fadeDuration = 1.6,
  opacity = 0.3,
  className = '',
}) {
  const [index, setIndex] = useState(0);

  const items = images.map((it) =>
    typeof it === 'string' ? { src: it, title: '', location: '' } : it
  );

  useEffect(() => {
    if (items.length < 2) return;
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduceMotion) return; // se queda en la primera foto, sin ciclar

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, interval);
    return () => clearInterval(id);
  }, [items.length, interval]);

  if (items.length === 0) return null;

  const current = items[index];
  const hasCaption = Boolean(current.title || current.location);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {items.map((it, i) => (
        <motion.div
          key={it.src}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${it.src}')`, filter: 'saturate(1.35) brightness(1.12) contrast(1.08)' }}
          initial={false}
          animate={{ opacity: i === index ? opacity : 0 }}
          transition={{ duration: fadeDuration, ease: 'easeInOut' }}
        />
      ))}

      {/* Scrim inferior: solo mientras haya leyenda que leer encima. */}
      {hasCaption && (
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 60%, transparent)',
          }}
        />
      )}

      <AnimatePresence mode="wait">
        {hasCaption && (
          <motion.div
            key={current.src}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-x-0 bottom-0 px-5 pb-4 text-white"
          >
            {current.title && (
              <p className="text-sm font-semibold drop-shadow-sm">{current.title}</p>
            )}
            {current.location && (
              <p className="text-xs text-white/75 drop-shadow-sm">{current.location}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
