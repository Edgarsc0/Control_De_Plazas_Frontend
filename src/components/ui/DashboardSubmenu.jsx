'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useMotionTemplate } from 'motion/react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getVisibleSections } from '@/config/modules';

// ── Card de ítem ──────────────────────────────────────────────────────────────
function MenuCard({ item, onClose, featured = false }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`group relative flex ${featured ? 'flex-row items-center gap-4' : 'flex-col justify-between'} p-3.5 rounded-2xl transition-all duration-300 bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-slate-200/80 shadow-sm hover:shadow-lg hover:shadow-black/5 overflow-hidden`}
    >
      {/* Ghost background icon */}
      <item.icon
        className="absolute -right-3 -bottom-3 size-14 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-500 pointer-events-none"
        style={{ color: item.color }}
      />

      {/* Icon box */}
      <div
        className="p-2 rounded-xl shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm"
        style={{ backgroundColor: item.bg }}
      >
        <item.icon className="size-4" style={{ color: item.color }} />
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center justify-between gap-1">
          <h3 className={`${featured ? 'text-[13px]' : 'text-[11px]'} font-black text-slate-800 group-hover:text-slate-900 tracking-tight leading-tight truncate transition-colors`}>
            {item.title}
          </h3>
          <ChevronRight
            className="size-3 shrink-0 text-slate-300 group-hover:text-slate-500 -translate-x-1 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
          />
        </div>
        <p className="text-[9px] text-slate-400 mt-0.5 truncate group-hover:text-slate-500 transition-colors leading-tight">
          {item.description}
        </p>
      </div>

      {/* Active badge */}
      <span
        className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: item.color }}
      />
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardSubmenu({ onClose }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const auth = useAuth();
  const sections = getVisibleSections(auth);

  const handleMouseMove = ({ currentTarget, clientX, clientY }) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  const featuredItem = sections[0]?.items[0];
  const restSections = sections.slice(1);

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 8, scale: 0.97, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 8, scale: 0.97, filter: 'blur(8px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 420 }}
      className="group/submenu absolute top-full left-0 mt-3 w-[540px] max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.15)] border border-slate-200/80 p-4 z-50 overflow-hidden"
    >
      {/* Spotlight */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover/submenu:opacity-100 transition-opacity duration-500"
        style={{
          background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(98,31,50,0.07), transparent 75%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-1 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="size-5 rounded-full bg-[#621f32]/10 flex items-center justify-center">
            <Sparkles className="size-3 text-[#621f32]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#621f32]/70">
            Accesos Rápidos
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-[#621f32]/15 to-transparent" />
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          {sections.reduce((acc, s) => acc + s.items.length, 0)} módulos activos
        </span>
      </div>

      {/* Featured card */}
      {featuredItem && (
        <div className="mb-3">
          <MenuCard item={featuredItem} onClose={onClose} featured />
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent mb-3" />

      {/* Sections grid */}
      <div className="flex flex-col gap-3">
        {restSections.map((section) => (
          <div key={section.group}>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 mb-1.5">
              {section.group}
            </p>
            <div className={`grid gap-2 ${section.items.length === 1 ? 'grid-cols-1' : section.items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {section.items.map((item) => (
                <MenuCard key={item.href} item={item} onClose={onClose} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ambient glows */}
      <div className="absolute -bottom-16 -right-16 size-48 bg-[#621f32]/10 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" />
      <div className="absolute -top-16 -left-16 size-48 bg-[#bc955c]/8 rounded-full blur-3xl -z-10 pointer-events-none" />
    </motion.div>
  );
}
