import os

with open("src/components/MovimientosPersonalTab.jsx", "r") as f:
    lines = f.readlines()

# Locate line 949 (0-indexed 948)
# Let's search for "onMouseDown={handleCardResizeMouseDown}"
split_idx = -1
for i, line in enumerate(lines):
    if "onMouseDown={handleCardResizeMouseDown}" in line:
        split_idx = i + 2  # The closing div is 2 lines below
        break

if split_idx == -1:
    print("Could not find split point")
    exit(1)

top_part = lines[:split_idx]
bottom_part = lines[split_idx:]

# Table content
table_content = """
            {/* Shared Scrollable Table Area */}
            <div 
              ref={tbodyRef}
              className="overflow-auto relative flex-1 mx-2 lg:mx-6 mb-4 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner" 
              style={{ height: '70vh', minHeight: '500px' }}
            >
              {!loading && displayData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40">
                  <div className="size-16 bg-gray-100 dark:bg-slate-850 rounded-full flex items-center justify-center mb-4">
                    <Search className="size-8 text-gray-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350">No se encontraron resultados</h4>
                  <p className="text-xs text-slate-500 mt-1">Intenta con otros filtros de búsqueda</p>
                </div>
              ) : (
                <table className="text-left text-gray-500 border-collapse" style={{ tableLayout: "fixed", width: 95 + columns.filter(c => c.visible).reduce((sum, col) => sum + col.width, 0) }}>
                  <colgroup>
                    <col style={{ width: 50 }} />
                    <col style={{ width: 45 }} />
                    {columns.filter(c => c.visible).map(col => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                  </colgroup>
                  <thead className="bg-[#501929] dark:bg-[#3e131f] text-white sticky top-0 z-30 shadow-md">
                    <tr>
                      <th className="sticky left-0 top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35">#</th>
                      <th className="sticky left-[50px] top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35 px-1">
                        <span className="text-[9px] font-bold text-slate-300">VER</span>
                      </th>
                      {columns.filter(c => c.visible).map((col, index, arr) => {
                        const isSticky = index < 2;
                        let leftOffset = 95;
                        if (index === 1) leftOffset = 95 + arr[0].width;
                        
                        const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
                        const bgClass = selectedCell?.colName === col.label 
                          ? "bg-[#621f32] text-white" 
                          : (hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : "bg-[#501929] text-slate-200");
                        
                        return (
                          <th 
                            key={col.key} 
                            style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}}
                            className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${bgClass} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}
                          >
                            {hasFilter && (
                              <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />
                            )}
                            <div className="flex flex-col items-center gap-1 w-full">
                              <span className={`text-[9px] font-mono ${hasFilter ? 'text-[#3e131f]/70' : 'text-[#bc955c]'}`}>
                                {getColumnLetter(index)}
                              </span>
                              <div className="flex items-center justify-between w-full">
                                <div onClick={() => handleRequestSort(col.key)} className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5">
                                  <span>{col.label}</span>
                                  <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key || (col.key === "fecha_efectiva" && sortConfig.key === "fecha_efectiva,fecha_captura") ? "opacity-100" : "opacity-0"}`} />
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openFilterDropdown(col.key); }} 
                                  className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}
                                >
                                  <Filter className="size-3 fill-current" />
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    
                    {/* TR Filter Headers go here ... (Wait, text filters are disabled for simplicity, but let's add them back) */}
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-355 bg-white/20 dark:bg-slate-900/10">
                    {loading ? (
                      [...Array(15)].map((_, rowIdx) => (
                        <tr key={`skeleton-${rowIdx}`} className="h-[37px] animate-pulse">
                          <td className="sticky left-0 bg-[#f0e4e6] dark:bg-[#3e131f] z-20 text-center border-r h-[37px] px-4"><div className="h-3 w-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                          <td className="sticky left-[50px] bg-[#f0e4e6] dark:bg-[#3e131f] z-20 text-center border-r h-[37px] px-2"><div className="h-4 w-5 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                          {columns.filter(c => c.visible).map((col, colIdx, arr) => {
                            const isSticky = colIdx < 2;
                            let leftOffset = 95;
                            if (colIdx === 1) leftOffset = 95 + arr[0].width;
                            return (
                              <td key={`sk-${rowIdx}-${colIdx}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {}} className={`px-4 border-r align-middle ${isSticky ? 'bg-[#f0e4e6] dark:bg-[#3e131f]' : 'bg-white/5'}`}>
                                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6 animate-pulse" />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      displayData.map((row, rowIdx) => {
                        const globalIdx = (page - 1) * pageSize + rowIdx + 1;
                        const isSelectedRow = selectedCell?.rowIdx === ((page - 1) * pageSize + rowIdx);
                        const rowBg = isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "hover:bg-[#621f32]/[0.015] dark:hover:bg-[#bc955c]/[0.015]";
                        
                        return (
                          <tr 
                            key={`row-${rowIdx}`} 
                            className={`h-[37px] transition-colors cursor-pointer ${rowBg}`}
                          >
                            <td 
                              className={`sticky left-0 z-20 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle text-slate-400 ${isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "bg-slate-50/85 dark:bg-slate-900/50"}`}
                              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row }); }}
                            >
                              {globalIdx}
                            </td>
                            <td 
                              className={`sticky left-[50px] z-20 text-center border-r h-[37px] px-1 align-middle ${isSelectedRow ? "bg-[#f0e4e6] dark:bg-[#621f32]/20" : "bg-slate-50/85 dark:bg-slate-900/50"}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeSubTab === "movimientos") {
                                    setSelectedRowData(row);
                                  } else {
                                    // Set some state for bitacora if needed, or share the same state
                                    setSelectedRowData(row);
                                  }
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-[#621f32] text-slate-400 hover:text-white dark:bg-slate-800 dark:hover:bg-[#bc955c] dark:text-slate-500 dark:hover:text-[#3e131f] rounded-md transition-all group"
                                title="Ver registro completo"
                              >
                                <Eye className="size-3" />
                              </button>
                            </td>
                            {columns.filter(c => c.visible).map((col, colIdx, arr) => {
                              const isSticky = colIdx < 2;
                              let leftOffset = 95;
                              if (colIdx === 1) leftOffset = 95 + arr[0].width;
                              
                              let val = row[col.key];
                              if (val === null || val === undefined) val = "";
                              
                              if (col.key === "fecha_ult_actz" && val) {
                                try {
                                  const dateObj = new Date(val);
                                  if (!isNaN(dateObj.getTime())) {
                                    val = dateObj.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
                                  }
                                } catch(e){}
                              } else if (["sal_base", "smb", "smn", "sueldo_bruto", "sueldo_neto"].includes(col.key) && val) {
                                val = `$${formatNumber(val)}`;
                              }
                              
                              const isSelectedCell = isSelectedRow && selectedCell?.colIdx === colIdx;
                              let cellClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${isSelectedCell ? "ring-2 ring-inset ring-[#621f32] dark:ring-[#bc955c] bg-white dark:bg-slate-950 font-black text-[#621f32] dark:text-[#bc955c] shadow-lg relative z-[25]" : "font-semibold"}`;
                              
                              if (isSticky) {
                                cellClass += isSelectedRow ? " bg-[#f0e4e6] dark:bg-[#621f32]/20" : " bg-white/95 dark:bg-slate-900/95";
                              }

                              if (col.key === "posicion" || col.key === "num_empleado") {
                                cellClass += " font-mono font-bold hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer";
                              } else if (col.key === "accion_nombre" && val && val.toLowerCase().includes("baja")) {
                                cellClass += " text-red-600 dark:text-red-400";
                              } else if (col.key === "motivo_nombre" && val && val.toLowerCase().includes("baja")) {
                                cellClass += " text-red-600 dark:text-red-400";
                              }

                              return (
                                <td 
                                  key={col.key} 
                                  style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: isSelectedCell ? 25 : 20 } : {}}
                                  className={cellClass}
                                  onClick={(e) => {
                                    if (col.key === "posicion" && val) {
                                      e.stopPropagation();
                                      setSelectedPosicion(val);
                                      setPosicionTimelineModalOpen(true);
                                    } else if (col.key === "num_empleado" && val) {
                                      e.stopPropagation();
                                      setSelectedNumEmpleado(val);
                                      setTimelineModalOpen(true);
                                    } else {
                                      const minRowIdx = (page - 1) * pageSize;
                                      setSelectedCell({ rowIdx: minRowIdx + rowIdx, colIdx, colName: col.label, value: val });
                                    }
                                  }}
                                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row }); }}
                                >
                                  {String(val) || "-"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
"""

with open("src/components/MovimientosPersonalTab.jsx", "w") as out:
    out.writelines(top_part)
    out.write(table_content)
    out.write("\n")
    out.writelines(bottom_part)
