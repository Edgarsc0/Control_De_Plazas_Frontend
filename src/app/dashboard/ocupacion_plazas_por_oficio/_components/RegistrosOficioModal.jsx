"use client";

import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef, startTransition } from "react";
import { apiFetch } from "@/lib/fetch-interceptor";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, X, Filter, ChevronLeft, ChevronRight, Search, ArrowUpDown, FileText } from "lucide-react";
import { Zoom } from "react-awesome-reveal";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";

// --- CONSTANTES ---
const DATE_KEYS = [
  "fecha_efectiva_personal", 
  "fecha_de_captura", 
  "fecha_prevista_de_salida", 
  "fecha_de_ingreso", 
  "f_efva", 
  "fecha_est", 
  "fh_ult_actz", 
  "fecha_efectiva",
  "fecha_captura"
];

const PLANTILLA_COLUMNS = [
  { key: "posicion", label: "Posición", width: 110 },
  { key: "estado_nomina", label: "Estado Nómina", width: 120 },
  { key: "estado_posición", label: "Estado Posición", width: 130 },
  { key: "id_empleado", label: "Id Empleado", width: 115 },
  { key: "rfc", label: "RFC", width: 140 },
  { key: "curp", label: "CURP", width: 185 },
  { key: "nombres", label: "Nombres", width: 280 },
  { key: "motivo", label: "Motivo", width: 200 },
  { key: "fecha_efectiva_personal", label: "Fecha efectiva", width: 180 },
  { key: "fecha_de_captura", label: "Fecha de captura", width: 150 },
  { key: "qna", label: "Qna", width: 80 },
  { key: "fecha_prevista_de_salida", label: "Prevista salida", width: 180 },
  { key: "nj", label: "NJ", width: 120 },
  { key: "codigo_presupuestal", label: "Código Presupuestal", width: 150 },
  { key: "nivel", label: "Nivel", width: 85 },
  { key: "ipe", label: "Programa", width: 100 },
];

// --- HELPERS ---
const getColumnLetter = (index) => {
  let letter = "";
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

const formatDate = (dateString) => {
  if (!dateString || dateString === "-") return "-";
  try {
    const date = typeof dateString === "string" && dateString.includes("-") 
        ? parseISO(dateString.split(" ")[0].split("-").slice(0,3).join("-")) 
        : new Date(dateString);
    return isValid(date) ? format(date, "dd/MM/yyyy", { locale: es }) : dateString;
  } catch (e) {
    return dateString;
  }
};

const renderStatusBadge = (val) => {
  if (!val || String(val).trim() === "" || String(val).trim() === "-") {
    return <span className="text-slate-300 italic">-</span>;
  }
  const cleanVal = String(val).trim().toUpperCase();
  let mappedLabel = val;
  let styles = { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };

  if (cleanVal === "A" || cleanVal === "ACTIVO") {
    mappedLabel = "Activo";
    styles = { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/50" };
  } else if (cleanVal === "I" || cleanVal === "INACTIVO" || cleanVal === "R" || cleanVal === "RETIRADO/BAJA" || cleanVal === "BAJA") {
    mappedLabel = cleanVal === "R" ? "Retirado/Baja" : "Baja";
    styles = { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800/50" };
  } else if (cleanVal === "L" || cleanVal === "LICENCIA") {
    mappedLabel = "Licencia";
    styles = { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/50" };
  } else if (cleanVal === "S" || cleanVal === "SUSPENDIDO") {
    mappedLabel = "Suspendido";
    styles = { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800/50" };
  } else if (cleanVal === "P" || cleanVal === "LICENCIA MÉDICA" || cleanVal === "LICENCIA MEDICA") {
    mappedLabel = "Licencia Médica";
    styles = { bg: "bg-purple-50 dark:bg-purple-950/20", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800/50" };
  } else if (cleanVal === "VACANTE") {
    mappedLabel = "Vacante";
    styles = { bg: "bg-amber-50/50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-300", border: "border-amber-200/50 dark:border-amber-900/40" };
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border}`}>
      {mappedLabel}
    </span>
  );
};

// --- COMPONENTE INTERNO DE TABLA ---
function DetailTable({ data = [], initialColumns = [] }) {
  const [columns, setColumns] = useState(initialColumns);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [columnFilters, setColumnFilters] = useState({});
  const [textFilters, setTextFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const deferredTextFilters = useDeferredValue(textFilters);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setColumns(initialColumns.map(c => ({ ...c, visible: true })));
    setSortConfig({ key: null, direction: null });
    setColumnFilters({});
    setTextFilters({});
    setActiveFilterDropdown(null);
    setCurrentPage(1);
  }, [initialColumns]);

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

  const filteredSortedData = useMemo(() => {
    let result = [...data];

    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter(row => {
          let cellValue = row[key];
          if (cellValue === null || cellValue === undefined || cellValue === "") cellValue = "(Vacío)";
          return values.includes(String(cellValue));
        });
      }
    });

    Object.entries(deferredTextFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const lowerFilter = filterValue.toLowerCase();
        result = result.filter(row => {
          let val = row[key];
          if (val === null || val === undefined) return false;
          if (DATE_KEYS.includes(key)) {
            val = formatDate(val);
          }
          return String(val).toLowerCase().includes(lowerFilter);
        });
      }
    });

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

  const totalPages = Math.max(1, Math.ceil(filteredSortedData.length / pageSize));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, deferredTextFilters, pageSize, sortConfig.key, sortConfig.direction]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSortedData.slice(start, start + pageSize);
  }, [filteredSortedData, currentPage, pageSize]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 relative">
      <div className="overflow-auto relative flex-1 min-h-[300px] border border-slate-200 shadow-inner rounded-xl custom-scrollbar">
        <table className="text-left text-gray-500 border-collapse w-full" style={{ tableLayout: "fixed", width: 50 + columns.filter(c => c.visible).reduce((sum, col) => sum + col.width, 0) }}>
          <colgroup>
            <col style={{ width: 50 }} />
            {columns.filter(c => c.visible).map(col => <col key={col.key} style={{ width: col.width }} />)}
          </colgroup>
          <thead className="bg-[#501929] text-white sticky top-0 z-30 shadow-md border-b border-[#bc955c]/30">
            <tr>
              <th className="sticky left-0 top-0 z-40 bg-[#40121e] border-r border-b border-[#621f32]/35 w-[50px] min-w-[50px] text-center align-middle">#</th>
              {columns.filter(c => c.visible).map((col, index) => (
                <th key={col.key} className="relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors bg-[#501929] text-slate-200">
                  <div className="flex flex-col items-center gap-1 w-full">
                    <span className="text-[9px] font-mono text-[#bc955c]">{getColumnLetter(index)}</span>
                    <div className="flex items-center justify-between w-full">
                      <div onClick={() => handleSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5 select-none">
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
            <tr className="bg-[#40121e] dark:bg-[#2b0d15] backdrop-blur-none">
              <th className="sticky left-0 z-40 bg-[#40121e] border-r border-[#621f32]/35">
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
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.filter(c => c.visible).length + 1} className="py-20 text-center bg-white">
                  <div className="flex flex-col items-center justify-center">
                    <div className="size-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Search className="size-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-700">Sin coincidencias</h4>
                    <p className="text-sm text-gray-500 mt-1">Ajusta tus filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx} className="hover:bg-[#621f32]/[0.015] h-[37px] bg-white">
                  <td className="sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle bg-slate-50 text-slate-400">
                    {(currentPage - 1) * pageSize + rowIdx + 1}
                  </td>
                  {columns.filter(c => c.visible).map((col) => {
                    let val = row[col.key];
                    
                    if (col.key === "estado_psn" || col.key === "estado_nomina" || col.key === "nomina_status" || col.key === "humanos_status") { 
                      return (
                        <td key={col.key} className="px-4 text-[10px] border-r align-middle h-[37px] bg-white/10">
                          {renderStatusBadge(val)}
                        </td>
                      );
                    }
                    
                    if (DATE_KEYS.includes(col.key)) {
                      val = formatDate(val);
                    }
                    
                    const isMono = col.key === "posicion" || col.key === "no_pos_actual" || col.key === "id_empleado" || col.key === "no_empleado";

                    return (
                      <td key={col.key} className={`px-4 text-[11px] text-slate-800 border-r align-middle h-[37px] whitespace-nowrap truncate overflow-hidden bg-white/10 ${isMono ? "font-mono font-bold" : "font-semibold"}`} title={val !== null && val !== undefined ? String(val) : "-"}>
                        {val === null || val === undefined || String(val).trim() === "" ? <span className="text-slate-300 italic">-</span> : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación y Resumen */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 border-t border-slate-200 rounded-b-xl shrink-0 gap-4 mt-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Registros</span>
            <span className="text-[#621f32] text-base font-black">{filteredSortedData.length.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mostrar</span>
            <div className="flex gap-1">
              {[20, 50, 100, 500].map((size) => (
                <button key={size} onClick={() => setPageSize(size)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-300 ${pageSize === size ? "bg-[#621f32] text-white shadow-md" : "text-gray-500 hover:bg-slate-100 hover:text-[#621f32] cursor-pointer"}`}>
                  {size}
                </button>
              ))}
            </div>
          </div>
          {(Object.keys(columnFilters).length > 0 || Object.keys(textFilters).length > 0) && (
            <button onClick={() => { setColumnFilters({}); setTextFilters({}); }} className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-widest px-2 border-l border-slate-200 cursor-pointer">
              Limpiar Filtros
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-md text-gray-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-20 transition-all cursor-pointer">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex items-center px-4">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Página</span>
            <span className="mx-2 text-[13px] font-black text-[#621f32]">{currentPage}</span>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">de {totalPages}</span>
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md text-gray-500 hover:bg-slate-100 hover:text-[#621f32] disabled:opacity-20 transition-all cursor-pointer">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {activeFilterDropdown && (
        <div ref={dropdownRef} className="absolute z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-3 w-64 max-h-[300px] flex flex-col gap-2" style={{ top: "100px", right: "20px" }}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-black text-slate-700 uppercase">Filtrar columna</span>
            <button onClick={() => clearFilter(activeFilterDropdown)} className="text-[10px] text-rose-500 hover:text-rose-600 font-bold px-2 py-1 rounded-md hover:bg-rose-50 transition-colors">Limpiar</button>
          </div>
          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {uniqueColumnValues[activeFilterDropdown]?.map(val => {
              const isChecked = (columnFilters[activeFilterDropdown] || []).includes(val);
              return (
                <label key={val} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(activeFilterDropdown, val)}
                    className="size-4 rounded border-gray-300 text-[#621f32] focus:ring-[#621f32]/20 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-medium truncate flex-1" title={val}>{val}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function RegistrosOficioModal({ open, onOpenChange, oficio, nivel }) {
    const [plantillaData, setPlantillaData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isClosing, setIsClosing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!oficio && !nivel) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (oficio) params.append("oficio", oficio);
            if (nivel && nivel !== "Total Resultado" && nivel !== "(vacío)") {
                params.append("nivel", nivel);
            } else if (nivel === "(vacío)") {
                params.append("nivel", "");
            }

            const queryString = params.toString();
            const query = queryString ? `?${queryString}` : "";

            const resp = await apiFetch(`/plantilla/registros_por_oficio_1800_plazas/${query}`);

            if (resp.ok) {
                const rawPlantilla = await resp.json();
                const resultsPlantilla = rawPlantilla.resultados || rawPlantilla || [];
                
                const formattedPlantilla = resultsPlantilla.map(row => ({
                    posicion: row.posición || row.posicion,
                    estado_nomina: row.estado_nómina || row.estado_nomina,
                    id_empleado: row.num_empleado || row.id_empleado || row.numempleado,
                    rfc: row.rfc,
                    curp: row.curp,
                    nombres: row.nombres,
                    motivo: row.motivo,
                    fecha_efectiva_personal: row.fecha_efectiva_personal,
                    fecha_de_captura: row.fecha_de_captura,
                    qna: row.qna,
                    fecha_prevista_de_salida: row.fecha_prevista_de_salida,
                    nj: row.nj,
                    codigo_presupuestal: row.código_presupuestal || row.codigo_presupuestal,
                    nivel: row.nivel
                }));

                setPlantillaData(formattedPlantilla);
            } else {
                setError("Error al cargar los datos de las plazas.");
            }
        } catch (err) {
            console.error("Error en fetchData:", err);
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    }, [oficio, nivel]);

    useEffect(() => {
        if (open) {
            setIsClosing(false);
            fetchData();
        } else {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setPlantillaData([]);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [open, fetchData]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[96vw] lg:max-w-[95vw] h-[94vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
            >
                <Zoom
                    triggerOnce
                    duration={500}
                    className={`size-full flex flex-col ${isClosing ? "animate-out fade-out-0 zoom-out-90 duration-300" : ""}`}
                >
                    {/* MODAL WRAPPER - Solid white background, rounded-[3.5rem] and shadow to match OficioDetailModal */}
                    <div className="size-full bg-white flex flex-col p-8 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] border border-gray-100 overflow-hidden">
                        <DialogHeader className="mb-4 shrink-0 flex flex-row justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-[#621f32] rounded-xl shadow-xl shadow-[#621f32]/20 text-white">
                                    <FileText className="size-7 text-[#bc955c]" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-bold text-[#621f32] tracking-tight">
                                        Detalle de Plazas <span className="text-[#bc955c] ml-2 px-4 py-1.5 bg-[#bc955c]/10 rounded-full text-base font-bold border border-[#bc955c]/20">
                                            {oficio ? <>Oficio: <span className="text-[#621f32]">{oficio === "(vacío)" ? "Sin Registro" : oficio}</span></> : null}
                                            {oficio && nivel ? <span className="mx-2 text-gray-300">|</span> : null}
                                            {nivel ? <>Nivel: <span className="text-[#621f32]">{nivel}</span></> : null}
                                        </span>
                                    </DialogTitle>
                                    <DialogDescription className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider">
                                        Consulta detallada de las plazas del oficio y nivel seleccionados
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className={`flex-1 min-h-[200px] w-full relative overflow-hidden transition-all duration-300 flex flex-col ${isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-50 rounded-xl">
                                    <Loader2 className="size-12 text-[#621f32] animate-spin mb-4" />
                                    <p className="text-[#621f32] font-bold text-sm uppercase tracking-widest animate-pulse">Cargando registros...</p>
                                </div>
                            ) : error ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-red-50 rounded-xl border border-red-200">
                                    <div className="size-20 bg-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-600 shadow-xl shadow-red-100/10">
                                        <X className="size-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Error de carga</h3>
                                    <p className="text-gray-500 max-w-md font-medium">{error}</p>
                                    <button onClick={fetchData} className="mt-8 px-10 py-3 bg-[#621f32] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-xl shadow-[#621f32]/30 active:scale-95 cursor-pointer">
                                        Reintentar ahora
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-lg p-6">
                                    {/* Table view */}
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <DetailTable 
                                            data={plantillaData} 
                                            initialColumns={PLANTILLA_COLUMNS} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Zoom>
            </DialogContent>
        </Dialog>
    );
}
