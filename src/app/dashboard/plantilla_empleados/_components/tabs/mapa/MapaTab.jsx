"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Search, MapPin, X } from "lucide-react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import { VacantesService } from "@/services/vacantes.service";

export default function MapaTab({ distribucionGeografica = [] }) {
  const [mapFilter, setMapFilter] = useState("all");
  const mapRef = useRef(null);

  // Búsqueda de empleados por nombre/número, centrada en su ubicación geográfica
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedEmpleado, setHighlightedEmpleado] = useState(null);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const ctrl = new AbortController();
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length < 3) {
        setSearchResults([]);
        setShowDropdown(false);
        setIsSearching(false);
        return;
      }

      VacantesService.searchEmpleadosGeografia(searchQuery, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((data) => {
          setSearchResults(data.results || []);
          setShowDropdown(true);
        })
        .catch((err) => { if (err.name !== "AbortError") console.error(err); })
        .finally(() => setIsSearching(false));
    }, 400);

    return () => { clearTimeout(delayDebounceFn); ctrl.abort(); };
  }, [searchQuery]);

  const handleSelectEmpleado = (emp) => {
    const lat = parseFloat(emp.latitud);
    const lng = parseFloat(emp.longitud);
    setSearchQuery(emp.Nombres);
    setShowDropdown(false);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert(`El empleado ${emp.Nombres} no tiene una ubicación geográfica registrada.`);
      return;
    }

    setHighlightedEmpleado({ ...emp, lat, lng });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });
  };

  const clearHighlight = () => {
    setHighlightedEmpleado(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  // En móvil hay que descontar también el BottomNav: con `100vh-144px` el panel
  // de filtros y la atribución quedaban por debajo de la barra fija. `100dvh`
  // evita además el salto de la barra dinámica de Safari iOS.
  return (
    <div className="w-full h-[calc(100dvh-var(--stack-h)-var(--bottomnav-h))] md:h-[calc(100dvh-var(--stack-h))] md:pt-9 flex justify-center">
      <div className="w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col relative">
        {/* Header Bar (docked, no flota sobre el mapa) */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 z-10">
          <div className="flex items-center gap-3.5 md:shrink-0">
            <div className="p-2.5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] text-white rounded-2xl shadow-md shrink-0">
              <Globe className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                Distribución Geográfica de Empleados
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                Visualización en tiempo real de la concentración de personal activo en aduanas y oficinas administrativas de la ANAM.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 md:ml-auto">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              {[
                { key: "all", label: "Todos", gradient: "from-[#621f32] to-[#8d2c48]" },
                { key: "Fronteriza", label: "Fronteriza", gradient: "from-red-500 to-orange-500" },
                { key: "Marítima", label: "Marítima", gradient: "from-[#06b6d4] to-[#3b82f6]" },
                { key: "Interna", label: "Interna", gradient: "from-purple-500 to-indigo-500" },
                { key: "Administrativa", label: "Oficinas / Otros", gradient: "from-[#bc955c] to-[#621f32]" },
              ].map(({ key, label, gradient }) => (
                <button
                  key={key}
                  onClick={() => setMapFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-xl border transition-all cursor-pointer ${
                    mapFilter === key
                      ? `bg-gradient-to-r ${gradient} text-white border-transparent shadow-md`
                      : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  {key !== "all" && (
                    <span className={`size-3 rounded-full shadow ${mapFilter === key ? "bg-white/70" : `bg-gradient-to-r ${gradient}`}`} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Search Bar: buscar empleado por nombre y centrar el mapa en su ubicación */}
            <div className="relative w-full md:w-80 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="size-5 text-[#621f32] dark:text-[#bc955c]" />
              </div>
              <input
                type="text"
                className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-md focus:outline-none focus:ring-4 focus:ring-[#621f32]/15 dark:focus:ring-[#bc955c]/15 focus:border-[#621f32] dark:focus:border-[#bc955c] text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all"
                placeholder="Buscar empleado por nombre..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setIsSearching(val.trim().length > 0);
                }}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#621f32', borderTopColor: 'transparent' }}
                  />
                </div>
              )}
              {!isSearching && (searchQuery || highlightedEmpleado) && (
                <button
                  type="button"
                  onClick={clearHighlight}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl max-h-80 overflow-y-auto overflow-hidden flex flex-col py-2 z-30">
                  {searchResults.map((emp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectEmpleado(emp)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer"
                    >
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{emp.Nombres}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <span className="truncate flex-1" title={emp["Unidad Administrativa"]}>{emp["Unidad Administrativa"]}</span>
                      </div>
                      {emp.latitud && emp.longitud ? (
                        <div className="flex items-center gap-1.5 mt-1 text-[#621f32] dark:text-[#f3dcd4] bg-[#621f32]/5 dark:bg-[#621f32]/15 border border-[#621f32]/10 dark:border-[#bc955c]/25 w-fit px-2 py-0.5 rounded-md">
                          <MapPin className="size-3" />
                          <span className="font-black text-xs truncate max-w-[180px]" title={emp["Descripción ubicación"] || emp.Aduana}>
                            {emp.Aduana || emp["Descripción ubicación"] || "Ubicación registrada"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1 text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 w-fit px-2 py-0.5 rounded-md">
                          <span className="font-bold text-[10px]">Sin ubicación registrada</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map: ocupa el espacio real restante, ya no queda tapado por el header */}
        <div className="flex-1 w-full overflow-hidden relative">
          <Map ref={mapRef} theme="light" viewport={{ center: [-102.55, 23.63], zoom: 4.8 }} className="w-full h-full">
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

                  <MarkerPopup closeButton={true} className="rounded-[1.75rem] shadow-2xl p-0 overflow-hidden border border-slate-200/50 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md max-w-[280px]">
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
                          <span className="font-extrabold text-[#621f32] dark:text-[#f3dcd4] bg-[#621f32]/5 dark:bg-[#621f32]/15 px-2.5 py-1 rounded-xl border border-[#621f32]/10 dark:border-[#bc955c]/25 text-xs">
                            {loc.count} {loc.count === 1 ? "empleado" : "empleados"}
                          </span>
                        </div>

                        {loc.uas && loc.uas.length > 0 && (
                          <div className="flex flex-col gap-1.5 text-[10px] shrink-0">
                            <span className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[8px]">Unidades Administrativas:</span>
                            <div className="flex flex-wrap gap-1">
                              {loc.uas.map((ua, ui) => (
                                <span key={ui} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg font-semibold break-words max-w-full leading-tight" title={ua}>
                                  {ua}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {loc.descripciones && loc.descripciones.length > 1 && (
                          <div className="flex flex-col gap-1.5 text-[10px] border-t border-slate-100 dark:border-slate-800/40 pt-2 shrink-0">
                            <span className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[8px]">Áreas o Sub-direcciones:</span>
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

            {/* Marcador destacado del empleado encontrado por búsqueda */}
            {highlightedEmpleado && (
              <MapMarker latitude={highlightedEmpleado.lat} longitude={highlightedEmpleado.lng}>
                <MarkerContent>
                  <div className="relative flex items-center justify-center">
                    <span className="absolute size-12 rounded-full bg-[#bc955c] animate-ping opacity-40 -z-10" style={{ animationDuration: "1.8s" }} />
                    <div className="size-8 rounded-full bg-gradient-to-br from-[#bc955c] to-[#621f32] border-2 border-white shadow-lg flex items-center justify-center text-white">
                      <MapPin className="size-4" fill="white" />
                    </div>
                  </div>
                </MarkerContent>

                <MarkerPopup closeButton={true} className="rounded-[1.75rem] shadow-2xl p-0 overflow-hidden border border-slate-200/50 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md max-w-[280px]">
                  <div className="p-4 flex flex-col gap-1.5">
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full self-start text-white bg-gradient-to-r from-[#bc955c] to-[#621f32]">
                      Empleado
                    </span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight mt-1">{highlightedEmpleado.Nombres}</h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{highlightedEmpleado["Unidad Administrativa"]}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                      {highlightedEmpleado.Aduana || highlightedEmpleado["Descripción ubicación"]}
                    </span>
                  </div>
                </MarkerPopup>
              </MapMarker>
            )}

            <MapControls />
          </Map>
        </div>
      </div>
    </div>
  );
}
