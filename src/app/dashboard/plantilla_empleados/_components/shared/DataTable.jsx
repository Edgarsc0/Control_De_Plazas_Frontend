"use client";

import { motion, AnimatePresence } from "motion/react";
import { ArrowUpDown, Filter, X, Check, Search, Eye } from "lucide-react";
import { getConditionLabel } from "@/utils/columnFilters";

const CONDITION_DROPDOWN_OPTIONS = [
  { key: "contains", label: "Contiene (*)" },
  { key: "not_contains", label: "No contiene (!*)" },
  { key: "starts_with", label: "Comienza con (^)" },
  { key: "not_starts_with", label: "No comienza con (!^)" },
  { key: "ends_with", label: "Termina con ($)" },
  { key: "not_ends_with", label: "No termina con (!$)" },
  { key: "equals", label: "Es igual a (=)" },
  { key: "not_equals", label: "Diferente de (!=)" },
];
const CONDITION_SYMBOLS = {
  contains: "*", not_contains: "!*", starts_with: "^", not_starts_with: "!^",
  ends_with: "$", not_ends_with: "!$", equals: "=", not_equals: "!=",
};

/**
 * Tabla genérica estilo Excel (sticky + resize + header de 2 filas +
 * virtualización por filas) compartida por los tabs de plantilla. El contenido
 * de cada celda lo provee el tab vía `renderCell` (mapeos de dominio: badges de
 * estado, moneda, etc.). El estado vive en los hooks (`useColumnState`,
 * `useColumnFilters`, `useSort`/sortConfig, `useCellSelection`).
 *
 * @param {Object} props
 * @param {Object} props.containerRef - Ref del contenedor con scroll (para scroll-into-view del tab).
 * @param {Object} props.tbodyRef - Ref del `<tbody>`.
 * @param {(scrollTop: number) => void} props.onScroll - Reporta el scroll vertical (para virtualización en el tab).
 * @param {Array<{key: string, label: string, width: number, visible: boolean}>} props.columns - Columnas (todas; se filtran las visibles internamente).
 * @param {Object<string, string[]>} props.columnFilters - Filtros de valores activos (resalta header).
 * @param {Object<string, {value: string, condition?: string}>} props.textFilters - Filtros de texto por columna.
 * @param {Function} props.setTextFilters - Setter de `textFilters`.
 * @param {?string} props.activeConditionDropdown - Columna con el dropdown de condición abierto.
 * @param {Function} props.setActiveConditionDropdown - Setter del anterior.
 * @param {?{row: number, col: number}} props.selectedCell - Celda seleccionada.
 * @param {(cell: {row: number, col: number}) => void} props.onSelectCell - Selecciona celda.
 * @param {(event: MouseEvent, row: Object) => void} props.onRowContextMenu - Menú contextual de fila.
 * @param {(row: Object) => void} props.onShowRecord - Abre el expediente de la fila (botón VER).
 * @param {{key: ?string, direction: ?string}} props.sortConfig - Estado de orden.
 * @param {(key: string) => void} props.onSort - Alterna orden por columna.
 * @param {(key: string) => void} props.onOpenFilter - Abre el dropdown de filtro de una columna.
 * @param {(event: MouseEvent, index: number, direction: ('left'|'right')) => void} props.onResizeStart - Inicia el resize de columna.
 * @param {(index: number) => string} props.getColumnLetter - Letra estilo hoja de cálculo.
 * @param {(key: string) => boolean} props.isMonoColumn - Si la columna usa `starts_with` por defecto / fuente mono.
 * @param {boolean} props.isPending - Overlay de "Procesando...".
 * @param {boolean} props.isLoading - Estado de carga inicial.
 * @param {string} [props.loadingMessage] - Mensaje de carga.
 * @param {Object[]} props.data - Filas visibles (slice virtualizado).
 * @param {number} props.startIndex - Índice de la primera fila visible.
 * @param {number} props.endIndex - Índice de la última fila visible.
 * @param {number} props.totalCount - Total de filas (para spacers de virtualización).
 * @param {number} props.rowHeight - Altura de fila en px.
 * @param {(row: Object, index: number) => (string|number)} [props.getRowId] - Clave de fila.
 * @param {(args: {row: Object, col: Object, colIdx: number, value: *, isSticky: boolean, leftOffset: number, isSelected: boolean, onClick: Function, onContextMenu: Function}) => JSX.Element} props.renderCell - Render del `<td>` de cada celda.
 * @returns {JSX.Element}
 */
export default function DataTable({
  containerRef,
  tbodyRef,
  onScroll,
  columns,
  columnFilters,
  textFilters,
  setTextFilters,
  activeConditionDropdown,
  setActiveConditionDropdown,
  selectedCell,
  onSelectCell,
  onRowContextMenu,
  onShowRecord,
  sortConfig,
  onSort,
  onOpenFilter,
  onResizeStart,
  getColumnLetter,
  isMonoColumn,
  isPending,
  isLoading,
  loadingVariant = 'spinner',
  loadingMessage = "Cargando...",
  rowNumberOffset = 0,
  data = [],
  startIndex,
  endIndex,
  totalCount,
  rowHeight,
  getRowId = (row, i) => row.id ?? i,
  renderCell,
}) {
  const visible = columns.filter(c => c.visible);
  const colSpan = visible.length + 2;

  return (
    <div ref={containerRef} onScroll={(e) => onScroll(e.currentTarget.scrollTop)} className="overflow-auto relative flex-1 mx-2 lg:mx-6 mb-4 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner" style={{ height: 'calc(100vh - 280px)' }}>
      <AnimatePresence>{isPending && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/30 backdrop-blur-[3px] z-40 flex items-center justify-center"><div className="flex flex-col items-center gap-3.5 p-6 bg-white/95 rounded-[2rem] shadow-2xl border border-slate-200/50"><div className="size-8 border-[4px] border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" /><span className="text-[10px] font-black uppercase text-[#621f32] bg-[#621f32]/5 px-3.5 py-1 rounded-xl">Procesando...</span></div></motion.div>)}</AnimatePresence>
      <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 95 + visible.reduce((sum, col) => sum + col.width, 0) }}>
        <colgroup><col style={{ width: 50 }} /><col style={{ width: 45 }} />{visible.map(col => <col key={col.key} style={{ width: col.width }} />)}</colgroup>
        <thead className="bg-[#501929] dark:bg-[#3e131f] text-white sticky top-0 z-30 shadow-md">
          <tr>
            <th className="sticky left-0 top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35">#</th>
            <th className="sticky left-[50px] top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35 px-1"><span className="text-[9px] font-bold text-slate-300">VER</span></th>
            {visible.map((col, index, arr) => {
              const isSticky = index < 2;
              let leftOffset = 95;
              if (index === 1) leftOffset = 95 + arr[0].width;
              const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
              const bgClass = selectedCell?.col === index ? "bg-[#621f32] text-white" : (hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : "bg-[#501929] text-slate-200");
              return (
                <th key={col.key} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${bgClass} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                  {hasFilter && <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />}
                  <div className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'left')} />
                  <div className="flex flex-col items-center gap-1 w-full">
                    <span className={`text-[9px] font-mono ${hasFilter ? 'text-[#3e131f]/70' : 'text-[#bc955c]'}`}>{getColumnLetter(index)}</span>
                    <div className="flex items-center justify-between w-full">
                      <div onClick={() => onSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5">
                        <span>{col.label}</span>
                        <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onOpenFilter(col.key); }} className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}>
                        <Filter className="size-3 fill-current" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'right')} />
                </th>
              );
            })}
          </tr>
          <tr className="bg-[#40121e] dark:bg-[#2b0d15]">
            <th className="sticky left-0 z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35">
              <button
                onClick={() => setTextFilters({})}
                disabled={Object.keys(textFilters).length === 0 || Object.values(textFilters).every(v => !v || !v.value)}
                title="Limpiar filtros de columna"
                className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </th>
            <th className="sticky left-[50px] z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35"></th>
            {visible.map((col, colIdx, arr) => {
              const filterObj = textFilters[col.key] || { value: "", condition: isMonoColumn(col.key) ? "starts_with" : "contains" };
              const condition = filterObj.condition || (isMonoColumn(col.key) ? "starts_with" : "contains");
              const isSticky = colIdx < 2;
              let leftOffset = 95;
              if (colIdx === 1) leftOffset = 95 + arr[0].width;
              const symbol = CONDITION_SYMBOLS[condition] || "*";

              return (
                <th key={`filter-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`p-1.5 border-r border-[#621f32]/30 relative ${isSticky ? 'bg-[#40121e] dark:bg-[#2b0d15] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                  <div className="relative flex items-center w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveConditionDropdown(activeConditionDropdown === col.key ? null : col.key);
                      }}
                      title={`Condición: ${getConditionLabel(condition)}`}
                      className="absolute left-1.5 z-10 size-4 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 rounded text-white text-[8px] font-black cursor-pointer select-none transition-colors"
                    >
                      {symbol}
                    </button>
                    <input
                      type="text"
                      value={filterObj.value || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextFilters(prev => {
                          const next = { ...prev };
                          if (val === "") {
                            delete next[col.key];
                          } else {
                            next[col.key] = { value: val, condition };
                          }
                          return next;
                        });
                      }}
                      placeholder="Filtrar..."
                      className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-white text-[9px] font-bold placeholder-white/30 rounded-md py-1.5 pl-7 pr-2 outline-none transition-all border border-white/5 focus:border-[#bc955c]/50"
                    />
                    {activeConditionDropdown === col.key && (
                      <>
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => { e.stopPropagation(); setActiveConditionDropdown(null); }} />
                        <div className="absolute top-full left-0 mt-1 z-50 w-36 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-left text-slate-200">
                          {CONDITION_DROPDOWN_OPTIONS.map(item => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTextFilters(prev => ({ ...prev, [col.key]: { value: filterObj.value, condition: item.key } }));
                                setActiveConditionDropdown(null);
                              }}
                              className={`px-2 py-1 text-[9px] font-bold rounded-lg text-left transition-colors cursor-pointer w-full flex items-center justify-between ${condition === item.key ? "bg-[#bc955c] text-slate-950" : "hover:bg-white/10"}`}
                            >
                              <span>{item.label}</span>
                              {condition === item.key && <Check className="size-2.5" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={tbodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {isLoading ? (
            loadingVariant === 'skeleton' ? (
              Array.from({ length: 15 }).map((_, rIdx) => (
                <tr key={`skeleton-row-${rIdx}`} className="h-[37px] bg-white dark:bg-slate-950">
                  <td className="sticky left-0 z-25 text-center border-r h-[37px] px-4 align-middle bg-white dark:bg-slate-950"><div className="h-3 w-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse" /></td>
                  <td className="sticky left-[50px] z-25 text-center border-r h-[37px] align-middle px-1 bg-white dark:bg-slate-950"><div className="size-5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto animate-pulse" /></td>
                  {visible.map((col, colIdx, arr) => {
                    const isSticky = colIdx < 2;
                    let leftOffset = 95;
                    if (colIdx === 1) leftOffset = 95 + arr[0].width;
                    const widthClass = colIdx % 3 === 0 ? "w-5/6" : colIdx % 3 === 1 ? "w-2/3" : "w-3/4";
                    return (<td key={`skeleton-td-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {}} className="px-4 border-r h-[37px] align-middle bg-white dark:bg-slate-950 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]"><div className={`h-3 ${widthClass} bg-slate-200 dark:bg-slate-800 rounded animate-pulse`} /></td>);
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colSpan} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-450 uppercase tracking-widest animate-pulse">{loadingMessage}</p>
                  </div>
                </td>
              </tr>
            )
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="size-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Search className="size-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-700 dark:text-slate-300">Sin coincidencias</h4>
                  <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">Intenta ajustar tus filtros de búsqueda</p>
                </div>
              </td>
            </tr>
          ) : (
            <>
              {startIndex > 0 && <tr style={{ height: startIndex * rowHeight }}><td colSpan={colSpan} /></tr>}
              {data.map((row, rowIdx) => {
                const actualRowIdx = startIndex + rowIdx;
                return (
                  <tr key={getRowId(row, actualRowIdx)} className="hover:bg-[#621f32]/[0.015] h-[37px] cursor-pointer" onClick={() => onSelectCell({ row: actualRowIdx, col: selectedCell?.col ?? 0 })} onContextMenu={(e) => { e.preventDefault(); onRowContextMenu(e, row); }}>
                    <td className={`sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle ${selectedCell?.row === actualRowIdx ? "bg-[#f0e4e6] dark:bg-[#201015] text-[#621f32] font-black border-l-[#621f32] border-l-2" : "bg-white dark:bg-slate-950 text-slate-400"}`}>{rowNumberOffset + actualRowIdx + 1}</td>
                    <td className={`sticky left-[50px] z-25 text-center border-r h-[37px] align-middle px-1 ${selectedCell?.row === actualRowIdx ? "bg-[#f0e4e6] dark:bg-[#201015]" : "bg-white dark:bg-slate-950"}`}><button onClick={(e) => { e.stopPropagation(); onShowRecord(row); }} className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:text-slate-500 dark:hover:text-[#bc955c] transition-colors cursor-pointer" title="Ver expediente detallado"><Eye className="size-4" /></button></td>
                    {visible.map((col, colIdx, arr) => {
                      const isSticky = colIdx < 2;
                      let leftOffset = 95;
                      if (colIdx === 1) leftOffset = 95 + arr[0].width;
                      const value = row[col.key];
                      const isSelected = selectedCell?.row === actualRowIdx && selectedCell?.col === colIdx;
                      const onClick = (e) => { e.stopPropagation(); onSelectCell({ row: actualRowIdx, col: colIdx }); };
                      const onContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); onRowContextMenu(e, row); };
                      return renderCell({ row, col, colIdx, value, isSticky, leftOffset, isSelected, onClick, onContextMenu });
                    })}
                  </tr>
                );
              })}
              {endIndex < totalCount && <tr style={{ height: (totalCount - endIndex) * rowHeight }}><td colSpan={colSpan} /></tr>}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
