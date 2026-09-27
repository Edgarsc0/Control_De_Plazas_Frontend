'use client';

import { motion } from 'motion/react';

// Patrón reactbits.dev "Blur Text", reimplementado sobre `motion` (ya es
// dependencia del proyecto — sin instalar nada nuevo). Cada palabra/letra
// entra de blur+desenfoque a foco nítido, una vez, escalonada. Sin
// IntersectionObserver/ScrollTrigger: aquí no hace falta, el título vive
// siempre sobre el pliegue.
export default function BlurText({
  text = '',
  animateBy = 'words', // 'words' | 'letters'
  direction = 'top', // 'top' | 'bottom'
  delay = 150, // ms entre cada unidad
  stepDuration = 0.4, // s de cada unidad
  className = '',
  // Compuerta de disparo: en false se queda parado en el estado inicial
  // (oculto/blur) indefinidamente — para encadenar el arranque a que
  // termine OTRA animación externa (p. ej. onComplete de un tween GSAP)
  // en vez de dispararse solo al montar.
  start = true,
  onAnimationComplete,
}) {
  const units = animateBy === 'letters' ? text.split('') : text.split(' ');
  const offsetY = direction === 'top' ? -20 : 20;
  const hidden = { opacity: 0, filter: 'blur(10px)', y: offsetY };
  const visible = { opacity: 1, filter: 'blur(0px)', y: 0 };

  return (
    <span className={`inline-block ${className}`}>
      {units.map((unit, i) => (
        <motion.span
          key={`${unit}-${i}`}
          initial={hidden}
          animate={start ? visible : hidden}
          transition={{
            duration: stepDuration,
            delay: start ? (i * delay) / 1000 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          onAnimationComplete={
            start && i === units.length - 1 ? onAnimationComplete : undefined
          }
          className="inline-block will-change-[filter,transform,opacity]"
        >
          {unit === ' ' ? ' ' : unit}
          {animateBy === 'words' && i < units.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}
