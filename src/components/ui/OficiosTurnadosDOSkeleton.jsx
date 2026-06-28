'use client';

import React from 'react';
import { ClipboardList, Search, X } from 'lucide-react';

const BG = 'bg-white/30';
const BG_LIGHT = 'bg-gray-200/70';
const BG_LIGHTER = 'bg-gray-100/80';

export default function OficiosTurnadosDOSkeleton() {
  return (
    <div className="space-y-10 pb-0 font-sans animate-pulse">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 w-full pt-8">
        <div
          className="relative overflow-hidden rounded-2xl shadow-lg border border-[#621f32]/10"
          style={{ background: 'linear-gradient(135deg, #621f32 0%, #4e1828 60%, #3a1120 100%)' }}
        >
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 p-7 md:p-10">
            <div className="flex items-center gap-5">
              <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                <ClipboardList className="w-9 h-9 text-amber-400/50" />
              </div>
              <div className="space-y-2">
                <div className={`h-2.5 w-32 rounded ${BG}`} />
                <div className={`h-7 w-56 rounded ${BG}`} />
                <div className={`h-2.5 w-40 rounded ${BG}`} />
              </div>
            </div>
            <div className="px-6 py-4 bg-black/20 rounded-xl border border-white/10 flex flex-col items-end gap-2">
              <div className={`h-2.5 w-24 rounded ${BG}`} />
              <div className={`h-8 w-16 rounded ${BG}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 w-full">
        <div className="bg-white/80 rounded-[2.5rem] py-8 px-10 border border-white/40 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className={`size-[150px] rounded-full ${BG_LIGHTER}`} />
            <div className="space-y-2.5 text-center md:text-left">
              <div className={`h-2.5 w-40 rounded ${BG_LIGHTER}`} />
              <div className={`h-6 w-56 rounded ${BG_LIGHT}`} />
              <div className={`h-2.5 w-44 rounded ${BG_LIGHTER}`} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 px-6 rounded-3xl bg-white border border-gray-100 min-w-[180px]">
                <div className={`size-2.5 rounded-full ${BG_LIGHT}`} />
                <div className="flex flex-col gap-1.5">
                  <span className={`h-2 w-16 rounded ${BG_LIGHTER}`} />
                  <span className={`h-4 w-10 rounded ${BG_LIGHT}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full space-y-6">
        <div className="bg-white/15 border-y border-x-0 border-slate-200/80 shadow-2xl overflow-hidden flex flex-col w-full">
          {/* Top header */}
          <div className="p-6 border-b border-slate-200/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/30">
            <div className="flex gap-4 items-center">
              <div className="relative w-80 flex items-center pr-3 pl-4 py-3 bg-white border border-slate-200/80 rounded-2xl">
                <Search className="text-slate-300 size-4 mr-2.5" />
                <span className={`h-2.5 w-32 rounded ${BG_LIGHTER}`} />
              </div>
              <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 border border-[#621f32]/10 rounded-2xl min-w-[100px] gap-1.5">
                <span className={`h-2 w-14 rounded ${BG_LIGHTER}`} />
                <span className={`h-3 w-8 rounded ${BG_LIGHT}`} />
              </div>
            </div>
          </div>

          {/* Table header row */}
          <div className="hidden md:grid bg-[#501929] grid-cols-6 gap-4 px-6 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-2.5 rounded bg-white/15 mx-auto w-3/4" />
            ))}
          </div>

          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, row) => (
            <div
              key={row}
              className={`hidden md:grid grid-cols-6 gap-4 px-6 py-4 border-b border-slate-100 ${row % 2 === 0 ? 'bg-white/40' : ''}`}
            >
              {Array.from({ length: 6 }).map((_, col) => (
                <div
                  key={col}
                  className={`h-3 rounded ${col === 0 ? BG_LIGHT : BG_LIGHTER}`}
                  style={{ width: `${50 + ((row * 7 + col * 13) % 40)}%` }}
                />
              ))}
            </div>
          ))}

          {/* Tarjetas: sólo móvil */}
          <div className="md:hidden flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 border border-slate-200/70 bg-white flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className={`h-3.5 w-2/3 rounded ${BG_LIGHT}`} />
                    <div className={`h-2.5 w-1/3 rounded ${BG_LIGHTER}`} />
                  </div>
                  <div className={`h-5 w-16 rounded-md ${BG_LIGHT}`} />
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-100">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="space-y-1.5">
                      <div className={`h-2 w-12 rounded ${BG_LIGHTER}`} />
                      <div className={`h-2.5 w-16 rounded ${BG_LIGHT}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="hidden md:flex px-8 py-5 border-t border-slate-200/50 bg-slate-50/30 items-center justify-between">
            <span className={`h-2.5 w-64 rounded ${BG_LIGHTER}`} />
            <div className="flex items-center gap-2">
              <div className={`size-9 rounded-xl ${BG_LIGHTER}`} />
              <div className={`size-9 rounded-xl ${BG_LIGHTER}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
