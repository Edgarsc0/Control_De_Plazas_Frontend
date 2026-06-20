"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";

export default function MapaTab({ distribucionGeografica = [] }) {
  const [mapFilter, setMapFilter] = useState("all");

  return (
    <div className="w-full h-[calc(100vh-144px)] flex justify-center">
      <div className="w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col relative">
        {/* Header Panel */}
        <div className="absolute bottom-6 left-6 right-6 lg:left-auto p-4 rounded-2xl flex flex-col items-start gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 shadow-xl border border-slate-200 dark:border-slate-800/80 pointer-events-auto">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Globe className="size-5 text-[#bc955c]" />
              Distribución Geográfica de Empleados
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
              Visualización en tiempo real de la concentración de personal activo en aduanas y oficinas administrativas de la ANAM.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            {[
              { key: "all", label: "Todos", color: null },
              { key: "Fronteriza", label: "Fronteriza", gradient: "from-red-500 to-orange-500" },
              { key: "Marítima", label: "Marítima", gradient: "from-[#06b6d4] to-[#3b82f6]" },
              { key: "Interna", label: "Interna", gradient: "from-purple-500 to-indigo-500" },
              { key: "Administrativa", label: "Oficinas / Otros", gradient: "from-[#bc955c] to-[#621f32]" },
            ].map(({ key, label, gradient }) => (
              <button
                key={key}
                onClick={() => setMapFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                  mapFilter === key
                    ? key === "all"
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-100 dark:bg-slate-800 shadow-sm border-current"
                    : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                }`}
              >
                {gradient && <span className={`size-3 rounded-full bg-gradient-to-r ${gradient} shadow`} />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 w-full overflow-hidden relative">
          <Map viewport={{ center: [-102.55, 23.63], zoom: 4.8 }} className="w-full h-full">
            {distribucionGeografica.map((loc, idx) => {
              let markerBg = "from-[#bc955c] to-[#621f32]";
              let label = "Administrativa";
              let filterCategory = "Administrativa";

              if (loc.is_aduana) {
                const t = (loc.tipo || "").toLowerCase();
                if (t.includes("fron")) {
                  markerBg = "from-red-500 to-orange-500";
                  label = "Aduana Fronteriza";
                  filterCategory = "Fronteriza";
                } else if (t.includes("mar")) {
                  markerBg = "from-[#06b6d4] to-[#3b82f6]";
                  label = "Aduana Marítima";
                  filterCategory = "Marítima";
                } else if (t.includes("int")) {
                  markerBg = "from-purple-500 to-indigo-500";
                  label = "Aduana Interna";
                  filterCategory = "Interna";
                } else {
                  markerBg = "from-amber-500 to-amber-700";
                  label = "Aduana";
                  filterCategory = "Administrativa";
                }
              }

              if (mapFilter !== "all" && filterCategory !== mapFilter) return null;

              const minSize = 22;
              const maxSize = 50;
              const count = loc.count || 1;
              const size = Math.min(maxSize, minSize + Math.log2(count) * 4);

              return (
                <MapMarker key={idx} latitude={loc.latitud} longitude={loc.longitud}>
                  <MarkerContent>
                    <div
                      style={{ width: `${size}px`, height: `${size}px` }}
                      className={`rounded-full bg-gradient-to-br ${markerBg} text-white font-extrabold flex items-center justify-center text-[10px] shadow-lg border border-white/60 hover:scale-110 active:scale-95 transition-transform duration-200 relative group cursor-pointer`}
                    >
                      <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${markerBg} animate-ping opacity-30 -z-10`} style={{ animationDuration: "2.5s" }} />
                      <span>{loc.count}</span>
                    </div>
                  </MarkerContent>

                  <MarkerPopup closeButton={true} className="rounded-2xl shadow-2xl p-0 overflow-hidden border border-slate-200/50 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md max-w-[280px]">
                    <div className="flex flex-col max-h-[350px]">
                      {/* Fixed Header */}
                      <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-1 shrink-0 bg-white/50 dark:bg-slate-900/50">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full self-start text-white bg-gradient-to-r ${markerBg}`}>
                          {label}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight mt-1">{loc.nombre}</h4>
                      </div>

                      {/* Scrollable Content */}
                      <div className="p-4 pt-3 flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        <div className="flex items-center justify-between text-[11px] shrink-0">
                          <span className="font-bold text-slate-400 dark:text-slate-500">Personal Concentrado:</span>
                          <span className="font-black text-slate-800 dark:text-white bg-[#621f32]/5 dark:bg-[#621f32]/15 px-2 py-0.5 rounded-lg border border-[#621f32]/10 text-xs">
                            {loc.count} {loc.count === 1 ? "empleado" : "empleados"}
                          </span>
                        </div>

                        {loc.uas && loc.uas.length > 0 && (
                          <div className="flex flex-col gap-1.5 text-[10px] shrink-0">
                            <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[8px]">Unidades Administrativas:</span>
                            <div className="flex flex-wrap gap-1">
                              {loc.uas.map((ua, ui) => (
                                <span key={ui} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-semibold break-words max-w-full leading-tight" title={ua}>
                                  {ua}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {loc.descripciones && loc.descripciones.length > 1 && (
                          <div className="flex flex-col gap-1.5 text-[10px] border-t border-slate-100 dark:border-slate-800/40 pt-2 shrink-0">
                            <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[8px]">Áreas o Sub-direcciones:</span>
                            <div className="flex flex-col gap-1">
                              {loc.descripciones.map((d, di) => (
                                <span key={di} className="text-slate-500 dark:text-slate-400 font-medium break-words leading-tight" title={d}>
                                  • {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </MarkerPopup>
                </MapMarker>
              );
            })}
            <MapControls />
          </Map>
        </div>
      </div>
    </div>
  );
}
