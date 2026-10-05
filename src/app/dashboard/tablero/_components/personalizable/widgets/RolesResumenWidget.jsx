"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { RoleService } from "@/services/role.service";
import { WhitelistService } from "@/services/whitelist.service";

function aLista(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

/** Cuántos roles existen y cuántos usuarios tiene asignado cada uno, espejo de heroStats en dashboard/roles/page.jsx. */
export default function RolesResumenWidget() {
  const [roles, setRoles] = useState(null);
  const [whitelist, setWhitelist] = useState([]);

  useEffect(() => {
    let activo = true;
    Promise.all([RoleService.listRoles(), WhitelistService.list()])
      .then(async ([r, w]) => {
        const rolesData = r.ok ? aLista(await r.json()) : [];
        const whitelistData = w.ok ? aLista(await w.json()) : [];
        if (activo) {
          setRoles(rolesData);
          setWhitelist(whitelistData);
        }
      })
      .catch((err) => {
        console.error("Error cargando resumen de roles:", err);
        if (activo) setRoles([]);
      });
    return () => { activo = false; };
  }, []);

  const conteoPorRol = useMemo(() => {
    const acc = new Map();
    whitelist.forEach((u) => acc.set(String(u.rol), (acc.get(String(u.rol)) || 0) + 1));
    return acc;
  }, [whitelist]);

  const ordenados = useMemo(
    () => (roles || []).slice().sort((a, b) => (conteoPorRol.get(String(b.id)) || 0) - (conteoPorRol.get(String(a.id)) || 0)),
    [roles, conteoPorRol]
  );
  const max = Math.max(1, ...ordenados.map((r) => conteoPorRol.get(String(r.id)) || 0));

  if (!roles) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="size-6 text-[#621f32] dark:text-[#bc955c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-3 px-3.5 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-center size-8 rounded-lg bg-[#621f32]/8 dark:bg-[#621f32]/20 text-[#621f32] dark:text-[#bc955c] shrink-0">
          <ShieldCheck className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-none text-slate-800 dark:text-slate-100">{roles.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">Roles · {whitelist.length} usuarios</p>
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 space-y-2.5">
        {ordenados.length === 0 ? (
          <p className="text-xs font-bold text-slate-400 text-center py-6">Sin roles registrados.</p>
        ) : (
          ordenados.map((r) => {
            const n = conteoPorRol.get(String(r.id)) || 0;
            return (
              <li key={r.id} className="text-xs">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                  <span className="font-black tabular-nums text-slate-900 dark:text-white shrink-0">{n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#621f32] to-[#bc955c]" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
