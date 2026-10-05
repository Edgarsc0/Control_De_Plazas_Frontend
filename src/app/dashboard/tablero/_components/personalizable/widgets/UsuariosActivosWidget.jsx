"use client";

import { Loader2, UsersRound } from "lucide-react";
import { useUsuariosActivos } from "@/hooks/useUsuariosActivos";

function timeAgoLabel(ts) {
  if (!ts) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (diffSec < 60) return `hace ${diffSec}s`;
  return `hace ${Math.round(diffSec / 60)}m`;
}

const pageLabel = (s) => `${s.title}${s.subtab ? ` › ${s.subtab}` : ""}`;

/** Quién está conectado ahora mismo y en qué página, usando el mismo endpoint de presencia que Roles > Usuarios. */
export default function UsuariosActivosWidget() {
  const activos = useUsuariosActivos();

  if (!activos) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-3 px-3.5 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <UsersRound className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-none text-slate-800 dark:text-slate-100">{activos.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Usuarios activos ahora</p>
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 space-y-2.5">
        {activos.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 text-center py-6">Nadie conectado en este momento.</p>
        ) : (
          activos.map((u) => {
            const first = u.sessions?.[0];
            return (
              <li key={u.email} className="text-xs flex items-start gap-2">
                <span className="relative flex size-1.5 mt-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 dark:text-slate-200 truncate" title={u.email}>{u.email}</p>
                  {first && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {pageLabel(first)} · {timeAgoLabel(first.ts)}
                    </p>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
