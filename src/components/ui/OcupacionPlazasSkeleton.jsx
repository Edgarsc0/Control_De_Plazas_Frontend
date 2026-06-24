'use client';

import React from 'react';
import { LayoutDashboard, ChevronRight, GitBranch, TableIcon, BarChart3 } from 'lucide-react';

const BG = 'bg-gray-200/70';
const BG_LIGHT = 'bg-gray-100/80';

export default function OcupacionPlazasSkeleton() {
  return (
    <section className="bg-gray-50/50 min-h-screen pb-20 relative overflow-hidden font-sans animate-pulse">
      <div className="py-8 px-4 mx-auto max-w-[1360px] lg:px-8">
        {/* Header & Navigation */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <LayoutDashboard className="size-3 text-gray-300" />
              <span className={`h-3 w-12 rounded ${BG_LIGHT}`} />
              <ChevronRight className="size-3 text-gray-300" />
              <span className={`h-3 w-32 rounded ${BG}`} />
            </div>
            <div className={`h-8 w-64 rounded-lg ${BG}`} />
          </div>

          <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm gap-1">
            {[GitBranch, TableIcon, BarChart3].map((Icon, i) => (
              <div key={i} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl ${i === 0 ? 'bg-gray-100' : ''}`}>
                <Icon className="size-4 text-gray-300" />
                <span className={`h-2.5 w-12 rounded ${BG_LIGHT}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl shadow-gray-200/40 overflow-hidden flex flex-col min-h-[700px]">
          {/* Control bar */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 w-full md:w-auto">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className={`h-2 w-20 rounded ${BG_LIGHT}`} />
                  <span className={`h-6 w-14 rounded ${BG}`} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className={`h-[42px] w-64 rounded-xl ${BG_LIGHT}`} />
              <div className={`h-[42px] w-28 rounded-xl ${BG_LIGHT}`} />
            </div>
          </div>

          {/* Sankey-like placeholder */}
          <div className="flex-1 bg-gray-50/20 p-10 flex items-center justify-center">
            <div className="w-full h-full max-h-[480px] flex items-center justify-between gap-10">
              <div className="flex flex-col gap-3 w-1/3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-8 rounded-lg ${BG_LIGHT}`} style={{ width: `${60 + (i % 3) * 15}%` }} />
                ))}
              </div>
              <div className="flex-1 h-full flex flex-col gap-4 justify-center opacity-60">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full ${BG}`} style={{ width: `${40 + (i % 4) * 12}%` }} />
                ))}
              </div>
              <div className="flex flex-col gap-3 w-1/4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`h-10 rounded-lg ${BG_LIGHT}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
