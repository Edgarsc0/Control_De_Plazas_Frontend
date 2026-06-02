import React, { useState, useMemo, useDeferredValue, useRef, useEffect, startTransition } from 'react';
import { Search, Filter, X, ArrowUpDown } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Constantes y Helpers
const DATE_KEYS_MOV = ["f_efva", "fecha_est", "fecha_captura", "fh_ult_actz"];

const formatDate = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  try {
    // Some dates might come with time or just YYYY-MM-DD
    const date = typeof dateString === 'string' && dateString.includes('-') 
        ? parseISO(dateString.split(' ')[0].split('-').slice(0,3).join('-')) 
        : new Date(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: es }) : dateString;
  } catch (e) {
    return dateString;
  }
};

const getColumnLetter = (index) => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

const MOV_STATUS_BADGE_STYLES = {
  "A": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50", label: "Activo" },
  "I": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/50", label: "Inactivo" },
  "L": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/50", label: "Licencia" },
  "S": { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/50", label: "Suspendido" },
  "R": { bg: "bg-slate-50 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700", label: "Retirado/Baja" }
};

export default function HistoryDataTable({ data = [] }) {
  const [columns, setColumns] = useState([
    { key: "no_pos_actual", label: "No. Posición", width: 130, visible: true },
    { key: "estado_psn", label: "Estado (A/I)", width: 110, visible: true },
    { key: "f_efva", label: "Fecha Efectiva", width: 130, visible: true },
    { key: "cd_motivo", label: "Cod. Motivo", width: 120, visible: true },
    { key: "motivo", label: "Motivo", width: 250, visible: true },
    { key: "cd_un", label: "Cod. UN", width: 100, visible: true },
    { key: "unidad_de_negocio", label: "Unidad Negocio", width: 280, visible: true },
    { key: "unidad_adva", label: "Unidad Adva", width: 250, visible: true },
    { key: "cd_departamento", label: "Cod. Depto", width: 120, visible: true },
    { key: "cd_puesto", label: "Cod. Puesto", width: 120, visible: true },
    { key: "puesto_ptal", label: "Puesto Ptal", width: 250, visible: true },
    { key: "estado_ptal", label: "Estado Ptal", width: 130, visible: true },
    { key: "fecha_est", label: "Fecha Est", width: 130, visible: true },
    { key: "maximo", label: "Máximo", width: 100, visible: true },
    { key: "depnd_drt", label: "Depnd Drt", width: 250, visible: true },
    { key: "depnd_indrt", label: "Depnd Indrt", width: 250, visible: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true },
    { key: "nvl_direc", label: "Nvl Direc", width: 100, visible: true },
    { key: "plan_sal", label: "Plan Sal", width: 120, visible: true },
    { key: "grado", label: "Grado", width: 100, visible: true },
    { key: "esc", label: "Esc", width: 100, visible: true },
    { key: "partida_ptal", label: "Partida Ptal", width: 150, visible: true },
    { key: "gp_pago", label: "Gp Pago", width: 120, visible: true },
    { key: "prog_beneficios", label: "Prog Beneficios", width: 150, visible: true },
    { key: "fecha_captura", label: "Fecha Captura", width: 140, visible: true },
    { key: "fh_ult_actz", label: "F/H Últ Actz", width: 150, visible: true },
    { key: "por", label: "Por", width: 180, visible: true },
    { key: "hr_estd_semn", label: "Hr Estd/Semn", width: 120, visible: true },
    { key: "descr", label: "Descr", width: 200, visible: true },
    { key: "gp_trabajo", label: "Gp Trabajo", width: 150, visible: true },
    { key: "org_code", label: "Org Code", width: 120, visible: true },
    { key: "grupo_cd_sal", label: "Grupo Cd Sal", width: 150, visible: true },
    { key: "formal_desc", label: "Formal Desc", width: 250, visible: true },
    { key: "pto_compt", label: "Pto Compt", width: 120, visible: true },
    { key: "posn_clv", label: "Posn Clv", width: 100, visible: true },
    { key: "presupuesto", label: "Presupuesto", width: 120, visible: true },
    { key: "nombre_puesto", label: "Nombre Puesto", width: 200, visible: true }
  ]);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [columnFilters, setColumnFilters] = useState({});
  const [textFilters, setTextFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  
  const deferredTextFilters = useDeferredValue(textFilters);
  const dropdownRef = useRef(null);

  // Cerrar dropdown si se hace click afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSort = (key) => {
    startTransition(() => {
      let direction = "asc";
      if (sortConfig.key === key) {
        if (sortConfig.direction === "asc") direction = "desc";
        else { key = null; direction = null; }
      }
      setSortConfig({ key, direction });
    });
  };

  const openFilterDropdown = (key) => {
    if (activeFilterDropdown === key) setActiveFilterDropdown(null);
    else setActiveFilterDropdown(key);
  };

  const toggleFilter = (colKey, value) => {
    startTransition(() => {
      const current = columnFilters[colKey] || [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      const newFilters = { ...columnFilters };
      if (next.length === 0) delete newFilters[colKey];
      else newFilters[colKey] = next;
      setColumnFilters(newFilters);
    });
  };

  const clearFilter = (colKey) => {
    startTransition(() => {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    });
    setActiveFilterDropdown(null);
  };

  const handleMouseDown = (e, index) => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns(prevCols => {
        const newCols = [...prevCols];
        newCols[index] = { ...newCols[index], width: Math.max(60, startWidth + deltaX) };
        return newCols;
      });
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // uniqueColumnValues
  const uniqueColumnValues = useMemo(() => {
    const uniques = {};
    columns.forEach(col => {
      const vals = new Set();
      data.forEach(row => {
        let v = row[col.key];
        if (v === null || v === undefined || v === "") v = "(Vacío)";
        vals.add(String(v));
      });
      uniques[col.key] = Array.from(vals).sort();
    });
    return uniques;
  }, [data, columns]);

  // filteredSortedData
  const filteredSortedData = useMemo(() => {
    let result = [...data];

    // Array Filters (Embudo)
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter(row => {
          let cellValue = row[key];
          if (cellValue === null || cellValue === undefined || cellValue === "") cellValue = "(Vacío)";
          return values.includes(String(cellValue));
        });
      }
    });

    // Text Filters (Inputs bajo columnas)
    Object.entries(deferredTextFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const lowerFilter = filterValue.toLowerCase();
        result = result.filter(row => {
          let val = row[key];
          if (val === null || val === undefined) return false;
          if (DATE_KEYS_MOV.includes(key)) {
            val = formatDate(val);
          }
          return String(val).toLowerCase().includes(lowerFilter);
        });
      }
    });

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (valA === null || valA === undefined) valA = "";
        if (valB === null || valB === undefined) valB = "";
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, columnFilters, deferredTextFilters, sortConfig]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 relative">
      <div className="overflow-auto relative flex-1 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner">
        <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 50 + columns.filter(c => c.visible).reduce((sum, col) => sum + col.width, 0) }}>
          <colgroup>
            <col style={{ width: 50 }} />
            {columns.filter(c => c.visible).map(col => <col key={col.key} style={{ width: col.width }} />)}
          </colgroup>
          <thead className="bg-[#501929]/90 dark:bg-[#3e131f]/90 text-white sticky top-0 z-30 shadow-md border-b border-[#bc955c]/30">
            <tr>
              <th className="sticky left-0 top-0 z-40 bg-[#40121e]/90 dark:bg-[#2b0d15]/90 backdrop-blur-md border-r border-b border-[#621f32]/35 w-[50px] min-w-[50px] text-center align-middle">#</th>
              {columns.filter(c => c.visible).map((col, index) => (
                <th key={col.key} className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors bg-[#501929] text-slate-200`}>
                  <div className="flex flex-col items-center gap-1 w-full">
                    <span className="text-[9px] font-mono text-[#bc955c]">{getColumnLetter(index)}</span>
                    <div className="flex items-center justify-between w-full">
                      <div onClick={() => handleSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5">
                        <span>{col.label}</span>
                        <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); openFilterDropdown(col.key); }} className={`p-1 rounded-md transition-colors ${columnFilters[col.key] ? "text-amber-300" : "text-white/60"}`}>
                        <Filter className="size-3 fill-current" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => handleMouseDown(e, columns.findIndex(c => c.key === col.key))} />
                </th>
              ))}
            </tr>
            <tr className="bg-[#40121e]/80 dark:bg-[#2b0d15]/80 backdrop-blur-md">
              <th className="sticky left-0 z-40 bg-[#40121e]/90 dark:bg-[#2b0d15]/90 border-r border-[#621f32]/35">
                <button 
                  onClick={() => setTextFilters({})}
                  disabled={Object.keys(textFilters).length === 0 || Object.values(textFilters).every(v => !v)}
                  title="Limpiar filtros de columna"
                  className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </th>
              {columns.filter(c => c.visible).map((col) => (
                <th key={`filter-${col.key}`} className="p-1.5 border-r border-[#621f32]/30">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2 size-2.5 text-white/40" />
                    <input
                      type="text"
                      value={textFilters[col.key] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextFilters(prev => ({ ...prev, [col.key]: val }));
                      }}
                      placeholder={`Filtrar...`}
                      className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-white text-[9px] font-bold placeholder-white/30 rounded-md py-1.5 pl-6 pr-2 outline-none transition-all border border-white/5 focus:border-[#bc955c]/50"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
            {filteredSortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.filter(c => c.visible).length + 1} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="size-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="size-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-700 dark:text-slate-300">Sin coincidencias</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">Ajusta tus filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSortedData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="hover:bg-[#621f32]/[0.015] h-[37px]">
                  <td className="sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle bg-slate-50/85 text-slate-400">
                    {rowIdx + 1}
                  </td>
                  {columns.filter(c => c.visible).map((col) => {
                    let val = row[col.key];
                    if (val === null || val === undefined) val = '-';
                    
                    if (col.key === "estado_psn") { 
                      const badge = MOV_STATUS_BADGE_STYLES[val] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: val }; 
                      return (
                        <td key={col.key} className="px-4 text-[10px] border-r align-middle h-[37px] transition-all bg-white/10 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label}
                          </span>
                        </td>
                      );
                    }
                    
                    if (DATE_KEYS_MOV.includes(col.key)) {
                      val = formatDate(val);
                    }

                    return (
                      <td key={col.key} className="px-4 text-[10px] text-slate-950 dark:text-slate-50 font-bold border-r align-middle h-[37px] whitespace-nowrap truncate overflow-hidden bg-white/10" title={String(val)}>
                        {String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeFilterDropdown && (
        <div ref={dropdownRef} className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-3 w-64 max-h-[300px] flex flex-col gap-2" style={{ top: "80px", left: "20%" }}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">Filtrar columna</span>
            <button onClick={() => clearFilter(activeFilterDropdown)} className="text-[10px] text-rose-500 hover:text-rose-600 font-bold px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">Limpiar</button>
          </div>
          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {uniqueColumnValues[activeFilterDropdown]?.map(val => {
              const isChecked = (columnFilters[activeFilterDropdown] || []).includes(val);
              return (
                <label key={val} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer group">
                  <div className={`size-3.5 rounded flex items-center justify-center border transition-colors ${isChecked ? "bg-[#621f32] border-[#621f32]" : "border-slate-300 dark:border-slate-600 group-hover:border-[#621f32]/50"}`}>
                    {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate flex-1" title={val}>{val}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
