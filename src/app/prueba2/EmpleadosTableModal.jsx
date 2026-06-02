"use client";

import React, { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Search, Filter, Check, X, ChevronDown, FilterX } from "lucide-react";

const getConditionLabel = (cond) => {
  switch (cond) {
    case "contains": return "Contiene";
    case "not_contains": return "No contiene";
    case "starts_with": return "Comienza con";
    case "not_starts_with": return "No comienza con";
    case "ends_with": return "Termina con";
    case "not_ends_with": return "No termina con";
    case "equals": return "Es igual a";
    case "not_equals": return "Diferente de";
    default: return "Contiene";
  }
};

const CONDITIONS = [
  "contains", "not_contains", "starts_with", "not_starts_with",
  "ends_with", "not_ends_with", "equals", "not_equals"
];

const getStatusStyle = (status) => {
  switch(status) {
    case 'Activo': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'Vacante': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'Suspendido': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'Licencia': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Licencia Médica': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default: return 'bg-slate-500/10 text-slate-800 border border-slate-500/20';
  }
};

export default function EmpleadosTableModal({ data, loading, title, onClose }) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [textFilters, setTextFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [activeConditionDropdown, setActiveConditionDropdown] = useState(null);
  const [tempSelectedValues, setTempSelectedValues] = useState([]);
  const [filterSearchText, setFilterSearchText] = useState("");
  
  const resetFilters = () => {
    setGlobalSearch("");
    setColumnFilters({});
    setTextFilters({});
  };

  const hasActiveFilters = globalSearch || Object.keys(columnFilters).length > 0 || Object.keys(textFilters).length > 0;
  
  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const deferredTextFilters = useDeferredValue(textFilters);

  const columns = [
    { key: "num_empleado", label: "No. Emp", width: 120 },
    { key: "nombre", label: "Nombre Completo", width: 280 },
    { key: "posicion", label: "Posición", width: 110 },
    { key: "ua", label: "UA Adscrito", width: 200 },
    { key: "ubicacion", label: "Ubicación", width: 200 },
    { key: "estado_nomina", label: "Estatus", width: 120 },
  ];

  const uniqueColumnValues = useMemo(() => {
    if (!data) return {};
    const unique = {};
    columns.forEach(col => {
      const counts = {};
      data.forEach(row => {
        let val = row[col.key];
        if (val === null || val === undefined) val = "";
        const strVal = String(val).trim();
        counts[strVal] = (counts[strVal] || 0) + 1;
      });
      unique[col.key] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });
    return unique;
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data;

    if (deferredGlobalSearch) {
      const searchStr = deferredGlobalSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      result = result.filter(row => {
        return columns.some(col => {
          const val = String(row[col.key] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return val.includes(searchStr);
        });
      });
    }

    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        result = result.filter(row => {
          let val = row[key];
          if (val === null || val === undefined) val = "";
          return values.includes(String(val).trim());
        });
      }
    });

    Object.entries(deferredTextFilters).forEach(([key, filter]) => {
      if (filter && filter.value) {
        const searchStr = String(filter.value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        result = result.filter(row => {
          let val = String(row[key] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          switch (filter.condition) {
            case "contains": return val.includes(searchStr);
            case "not_contains": return !val.includes(searchStr);
            case "starts_with": return val.startsWith(searchStr);
            case "not_starts_with": return !val.startsWith(searchStr);
            case "ends_with": return val.endsWith(searchStr);
            case "not_ends_with": return !val.endsWith(searchStr);
            case "equals": return val === searchStr;
            case "not_equals": return val !== searchStr;
            default: return val.includes(searchStr);
          }
        });
      }
    });

    return result;
  }, [data, deferredGlobalSearch, columnFilters, deferredTextFilters]);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
        setActiveConditionDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openFilterDropdown = (e, colKey) => {
    e.stopPropagation();
    if (activeFilterDropdown === colKey) {
      setActiveFilterDropdown(null);
    } else {
      setActiveFilterDropdown(colKey);
      setActiveConditionDropdown(null);
      setFilterSearchText("");
      setTempSelectedValues(columnFilters[colKey] || uniqueColumnValues[colKey].map(v => v.value));
    }
  };

  const applyColumnFilter = (colKey) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: tempSelectedValues }));
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
    setActiveFilterDropdown(null);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-md p-4 md:p-8 pointer-events-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[70vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 shrink-0 gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#621f32] flex items-center gap-2">
              {title}
              {!loading && data && (
                <span className="text-xs font-black text-[#621f32] bg-[#bc955c]/20 px-2 py-0.5 rounded-full border border-[#bc955c]/50">
                  {filteredData.length} registros
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {hasActiveFilters && (
              <button 
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 text-[#621f32] text-xs font-bold rounded-xl border border-[#bc955c]/50 transition-colors"
                title="Restablecer todos los filtros"
              >
                <FilterX className="size-4" />
                <span className="hidden sm:inline">Restablecer</span>
              </button>
            )}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-800" />
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Búsqueda global..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-[#621f32] placeholder-slate-500 focus:outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32] transition-all"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-800 hover:text-[#621f32]">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-800 hover:text-[#621f32] p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0 bg-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white custom-scrollbar relative min-h-[450px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="w-10 h-10 border-4 border-[#621f32] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-800 font-medium text-sm">Consultando base de datos...</p>
            </div>
          ) : data?.error ? (
            <div className="p-8 text-center text-rose-400 font-bold h-full flex items-center justify-center">Error: {data.error}</div>
          ) : data?.length === 0 ? (
            <div className="p-8 text-center text-slate-800 font-bold h-full flex items-center justify-center">No se encontraron empleados.</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-900">
              <thead className="text-xs uppercase bg-slate-50/90 text-slate-800 sticky top-0 backdrop-blur-md z-20 shadow-md">
                <tr>
                  {columns.map(col => {
                    const isFiltered = !!columnFilters[col.key] || !!textFilters[col.key]?.value;
                    return (
                      <th key={col.key} className="p-0 align-top border-b border-slate-200" style={{ minWidth: col.width }}>
                        <div className="flex flex-col h-full filter-dropdown-container">
                          
                          {/* Col Header Name & Funnel */}
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-100">
                            <span className="font-bold tracking-wider">{col.label}</span>
                            <div className="relative">
                              <button 
                                onClick={(e) => openFilterDropdown(e, col.key)}
                                className={`p-1.5 rounded-lg transition-colors ${isFiltered ? 'bg-[#bc955c]/20 text-[#621f32]' : 'hover:bg-slate-100 text-slate-800 hover:text-slate-900'}`}
                              >
                                <Filter className="size-3.5" />
                              </button>
                              
                              {/* DISTINCT Funnel Dropdown */}
                              {activeFilterDropdown === col.key && (
                                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80" onClick={e => e.stopPropagation()}>
                                  <div className="p-2 border-b border-slate-200 bg-white/50">
                                    <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-800" />
                                      <input 
                                        type="text" 
                                        value={filterSearchText}
                                        onChange={e => setFilterSearchText(e.target.value)}
                                        placeholder="Buscar..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#621f32] placeholder-slate-500 focus:outline-none focus:border-[#621f32] transition-colors"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                    <button onClick={() => {
                                      const allVals = uniqueColumnValues[col.key].map(v => v.value);
                                      setTempSelectedValues(tempSelectedValues.length === allVals.length ? [] : allVals);
                                    }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors text-left group">
                                      <div className={`size-4 rounded-md border flex items-center justify-center transition-all ${tempSelectedValues.length === (uniqueColumnValues[col.key]?.length || 0) ? "bg-[#621f32] border-[#621f32]" : "border-slate-500"}`}>
                                        {tempSelectedValues.length === (uniqueColumnValues[col.key]?.length || 0) && <Check className="size-3 text-[#621f32]" />}
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-900 group-hover:text-[#621f32]">Seleccionar Todo</span>
                                    </button>
                                    <div className="h-px bg-slate-100 my-1 mx-2" />
                                    
                                    {uniqueColumnValues[col.key]
                                      ?.filter(v => String(v.value).toLowerCase().includes(filterSearchText.toLowerCase()))
                                      .slice(0, 100)
                                      .map(({ value, count }) => (
                                      <button key={value} onClick={() => {
                                        setTempSelectedValues(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
                                      }} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left group">
                                        <div className={`size-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${tempSelectedValues.includes(value) ? "bg-[#621f32] border-[#621f32]" : "border-slate-500"}`}>
                                          {tempSelectedValues.includes(value) && <Check className="size-3 text-[#621f32]" />}
                                        </div>
                                        <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
                                          <span className="text-[11px] font-medium text-slate-900 truncate" title={value || "(Vacío)"}>{value || "(Vacío)"}</span>
                                          <span className="text-[9px] font-black text-slate-800 bg-white px-1.5 py-0.5 rounded-md">{count}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="p-2 border-t border-slate-200 bg-white/50 flex gap-2">
                                    <button onClick={() => clearColumnFilter(col.key)} className="flex-1 px-3 py-2 bg-white border border-slate-200 text-[#621f32] text-[10px] font-bold rounded-lg hover:bg-slate-100 transition-colors">Limpiar</button>
                                    <button onClick={() => applyColumnFilter(col.key)} className="flex-1 px-3 py-2 bg-[#621f32] text-white text-[10px] font-bold rounded-lg hover:bg-[#621f32] transition-colors">Aplicar</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Text Filter Input */}
                          <div className="px-2 pb-2 bg-slate-100 border-t border-slate-200">
                            <div className="flex items-center gap-1">
                              <div className="relative filter-dropdown-container">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveConditionDropdown(activeConditionDropdown === col.key ? null : col.key);
                                    setActiveFilterDropdown(null);
                                  }}
                                  className="flex items-center justify-center p-1.5 hover:bg-slate-100 rounded text-slate-800 hover:text-slate-700 transition-colors"
                                  title={getConditionLabel(textFilters[col.key]?.condition || "contains")}
                                >
                                  <span className="text-[10px] font-mono font-bold w-4 text-center">
                                    {getConditionLabel(textFilters[col.key]?.condition || "contains").substring(0, 2).toUpperCase()}
                                  </span>
                                </button>
                                
                                {activeConditionDropdown === col.key && (
                                  <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1" onClick={e => e.stopPropagation()}>
                                    {CONDITIONS.map(cond => (
                                      <button
                                        key={cond}
                                        onClick={() => {
                                          setTextFilters(prev => ({
                                            ...prev,
                                            [col.key]: { ...prev[col.key], condition: cond, value: prev[col.key]?.value || "" }
                                          }));
                                          setActiveConditionDropdown(null);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${textFilters[col.key]?.condition === cond || (!textFilters[col.key]?.condition && cond === "contains") ? "bg-[#bc955c]/20 text-[#621f32]" : "text-slate-900 hover:bg-slate-100"}`}
                                      >
                                        {getConditionLabel(cond)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="Filtrar..."
                                value={textFilters[col.key]?.value || ""}
                                onChange={(e) => setTextFilters(prev => ({
                                  ...prev,
                                  [col.key]: { value: e.target.value, condition: prev[col.key]?.condition || "contains" }
                                }))}
                                className="w-full bg-slate-100 border border-slate-200 rounded pl-2 pr-2 py-1 text-[11px] text-[#621f32] placeholder-slate-500 focus:outline-none focus:border-[#621f32]/50 transition-colors font-medium"
                              />
                              {textFilters[col.key]?.value && (
                                <button
                                  onClick={() => setTextFilters(prev => {
                                    const next = { ...prev };
                                    delete next[col.key];
                                    return next;
                                  })}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-800 hover:text-slate-700"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-800 font-medium italic">
                      No hay registros que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {filteredData.map((emp, i) => (
                  <tr key={i} className="hover:bg-slate-100 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-800 align-middle">{emp.num_empleado}</td>
                    <td className="px-5 py-3.5 font-bold text-[#621f32] align-middle">{emp.nombre}</td>
                    <td className="px-5 py-3.5 text-slate-800 align-middle">{emp.posicion}</td>
                    <td className="px-5 py-3.5 text-slate-800 align-middle leading-tight">{emp.ua}</td>
                    <td className="px-5 py-3.5 text-slate-800 align-middle">{emp.ubicacion}</td>
                    <td className="px-5 py-3.5 align-middle">
                      <span className={`inline-flex px-2.5 py-1 rounded text-[11px] font-bold tracking-wide ${getStatusStyle(emp.estado_nomina)}`}>
                        {emp.estado_nomina}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
