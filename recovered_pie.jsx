                <div className="relative shrink-0">
                        style={hoveredSlice === i ? { filter: 'brightness(1.15)' } : {}}
                          <div className="relative shrink-0">
                                  style={hoveredMotifSlice === i ? { filter: 'brightness(1.15)' } : {}}


  const handleExportBitacoraExcel = async () => {
    if (!bitacoraDate) return;
    setIsExportingBitacoraExcel(true);
    try {
      const params = {
        no_pagination: true,
        fecha_captura__in: bitacoraDate,
        sort_by: "fecha_captura,fecha_ult_actz",
        sort_order: "desc"
      };

      const res = await VacantesService.getMovimientosPersonal(params);
      const allData = await res.json();

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Bitacora ${bitacoraDate}`);

      const relevantCols = [
        { key: "posicion", label: "Posición" },
        { key: "num_empleado", label: "No. Empleado" },
        { key: "nombre", label: "Nombre" },
        { key: "ap_pat", label: "Ap. Paterno" },
        { key: "ap_mat", label: "Ap. Mat" },
        { key: "accion_nombre", label: "Acción" },
        { key: "motivo_nombre", label: "Motivo" },
        { key: "fecha_efectiva", label: "Fecha Efectiva" },
        { key: "fecha_captura", label: "Fecha Captura" },
        { key: "fecha_ult_actz", label: "Última Actualización" },
        { key: "un_admin", label: "UN Admin" },
        { key: "ubicacion", label: "Ubicación" }
      ];

      worksheet.columns = relevantCols.map((c) => ({
        header: c.label,
        key: c.key,
        width: 15,
      }));

      allData.forEach((row) => {
        const rowData = {};
        relevantCols.forEach((c) => {
          rowData[c.key] = row[c.key];
        });
        const addedRow = worksheet.addRow(rowData);
        addedRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBC955C' } },
            left: { style: 'thin', color: { argb: 'FFBC955C' } },
            bottom: { style: 'thin', color: { argb: 'FFBC955C' } },
            right: { style: 'thin', color: { argb: 'FFBC955C' } }
          };
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2B4C7E" }
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFBC955C' } },
          left: { style: 'medium', color: { argb: 'FFBC955C' } },
          bottom: { style: 'medium', color: { argb: 'FFBC955C' } },
          right: { style: 'medium', color: { argb: 'FFBC955C' } }
        };
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : "";
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Bitacora_Movimientos_${bitacoraDate}.xlsx`;
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingBitacoraExcel(false);
    }
  };

  

  // States for Motif Distribution
  // Sync selectedActionName with textFilters.accion_nombre
  // Fetch motif stats when selectedActionName changes
  // Reset motif year selector when action name changes
  // Reset table page to 1 when selectedYear or selectedMotifYear changes
      // Also delete motif_nombre filter if we close the action stats
  // States and refs for column checklist filtering (funnel buttons)
  // Debounce column filter search text
  // Debounce global search
  // Debounce text filters
  // Load paginated data from backend
      }
      if (yearFilter) {
        params.fecha_efectiva__year = yearFilter;
      }

      const res = await VacantesService.getMovimientosPersonal(params);
      const allData = await res.json();

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Movimientos de Personal");
        
        // Celdas con bordes dorados
        addedRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBC955C' } },
            left: { style: 'thin', color: { argb: 'FFBC955C' } },
            bottom: { style: 'thin', color: { argb: 'FFBC955C' } },
            right: { style: 'thin', color: { argb: 'FFBC955C' } }
          };
        });
      });

      // Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2B4C7E" } // Navy Blue
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFBC955C' } },
          left: { style: 'medium', color: { argb: 'FFBC955C' } },
          bottom: { style: 'medium', color: { argb: 'FFBC955C' } },
          right: { style: 'medium', color: { argb: 'FFBC955C' } }
        };
      });

      // Auto-fit columns width
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : "";
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Movimientos_Personal_${new Date().toISOString().split("T")[0]}.xlsx`;
    let valStr = String(val).trim().split('T')[0]; // Extract just the date part
      // Fallback
  // Dynamically fetch unique column values matching active filters and filter popover search text


    const filterParams = getTextFilterParams(debouncedTextFilters);
    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      // Skip the current active column to show other unchecked possibilities
        
            // First time opening the filter popover for this column
    
  const bitacoraTotalPages = Math.ceil(bitacoraCount / bitacoraPageSize) || 1;
  // Auto-scroll when navigating with keyboard
    
    if (rowIdx === undefined || colIdx === undefined) return;

    
    const localRowIdx = rowIdx - (page - 1) * pageSize;
    const rowHeight = 37; 
    const headerHeight = 36;
    const rowTop = localRowIdx * rowHeight;
    
    if (rowTop < container.scrollTop + headerHeight) {
      container.scrollTop = Math.max(0, rowTop - headerHeight);
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = rowBottom - container.clientHeight + headerHeight;
    }
    
    
    for (let i = 0; i < colIdx; i++) {
      colLeft += visibleCols[i].width || 120;
    }
    
      if (colLeft < container.scrollLeft + frozenWidth) {
        container.scrollLeft = Math.max(0, colLeft - frozenWidth - 20);
      } else if (colRight > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = colRight - container.clientWidth + 20;
      }
      
      
      if (e.repeat) {
        arrowRepeatRef.current += 1;
      } else {
        arrowRepeatRef.current = 1;
      }
      
      let step = 1;
      if (arrowRepeatRef.current > 5) step = 2;
      if (arrowRepeatRef.current > 12) step = 5;
      if (arrowRepeatRef.current > 20) step = 10;
      if (arrowRepeatRef.current > 35) step = 20;
      
      
        if (!prev) return prev; 
        const minRowIdx = (page - 1) * pageSize;
        const maxRowIdx = minRowIdx + data.length - 1;
        
        let newRowIdx = prev.rowIdx;
        let newColIdx = prev.colIdx;
        
        
        const newColName = visibleColsArray[newColIdx]?.label;
        const colKey = visibleColsArray[newColIdx]?.key;
        const newRowLocalIdx = newRowIdx - minRowIdx;
        const newValue = data[newRowLocalIdx]?.[colKey];

        return { rowIdx: newRowIdx, colIdx: newColIdx, colName: newColName || prev.colName, value: newValue !== undefined ? newValue : prev.value };
      });
    };

    const handleKeyUp = (e) => {
      if (e.key.startsWith('Arrow')) {
        arrowRepeatRef.current = 0;
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };

      {/* Statistics Card and Pie Chart */}
        <Zoom triggerOnce>
          <div className="flex flex-col lg:flex-row gap-5 mb-6 items-stretch w-full">
                    {statsLoading ? (
              <div className="flex-shrink-0 lg:w-56">
                <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-[#621f32]/90 text-white shadow-xl shadow-[#621f32]/25 ring-2 ring-white/20 animate-pulse">
                  <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-white/20 size-8" />
                    <div className="h-3 w-28 bg-white/20 rounded-md" />
                  </div>
                  
                  <div className="flex flex-col relative z-10 gap-2">
                    <div className="h-10 w-24 bg-white/20 rounded-lg" />
                    <div className="h-3 w-32 bg-white/10 rounded-md mt-2" />
                  </div>

                  <div className="mt-4 relative z-10">
                    <div className="h-2.5 w-20 bg-white/10 rounded-md mb-2" />
                    <div className="h-10 min-h-10 max-h-10 w-full bg-white/20 rounded-xl flex-shrink-0" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 lg:w-56">
                <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-gradient-to-br from-[#621f32] to-[#8a2a46] text-white shadow-xl shadow-[#621f32]/25 ring-2 ring-white/20">
                  <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-white/20 text-white">
                      <Briefcase className="size-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Total de Movimientos</span>
                  </div>
                  
                  <div className="flex flex-col relative z-10">
                    <span className="text-5xl font-black tracking-tighter text-white">
                      {formatNumber(pieTotal)}
                    </span>
                    <span className="text-xs text-white/60 mt-2 relative z-10 font-semibold">
                      {activeStatsList.length} acciones distintas
                    </span>
                  </div>

                  {/* Year Selector */}
                  <div className="mt-4 relative z-10">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/75 block mb-1">Año de Efectividad</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 !h-10 !min-h-10 !max-h-10 flex-shrink-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:text-slate-500 shadow-sm transition-colors">
                        <SelectValue placeholder="Seleccionar año" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="bg-white border border-slate-200 text-slate-850 max-h-60 rounded-xl shadow-xl [&_svg]:text-slate-800 w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="all" className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                          Todos los años
                        </SelectItem>
                        {Object.keys(statsData.by_year).sort((a, b) => b.localeCompare(a)).map(year => (
                          <SelectItem key={year} value={year} className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Pie chart */}
            {statsLoading ? (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center animate-pulse">
                {/* SVG skeleton */}
                <div className="relative shrink-0 size-[180px] rounded-full border-[22px] border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-900/50" />
                </div>
                {/* Legend skeleton */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className="shrink-0 size-2.5 rounded-full bg-slate-200 dark:bg-slate-850" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-24" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-10 ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            ) : pieSlices.length > 0 ? (
              <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center">
                <div className="relative shrink-0" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                  <svg viewBox="0 0 200 200" width="180" height="180" className="drop-shadow-md">
                    {pieSlices.map((slice, i) => (
                      <path
                        key={i}
                        d={slice.d}
                        fill={slice.color}
                        opacity={hoveredSlice === null || hoveredSlice === i ? 1 : 0.35}
                        stroke="white"
                        strokeWidth="1.5"
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredSlice(i)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => handleActionClick(slice.accion_nombre)}
                        style={hoveredSlice === i ? { filter: 'brightness(1.15)', transform: 'scale(1.03)', transformOrigin: 'center' } : {}}
                      />
                    ))}
                    {/* Donut hole */}
                    <circle cx="100" cy="100" r="42" fill="white" className="dark:fill-slate-900" />
                    <text x="100" y="96" textAnchor="middle" className="text-[9px]" fill="#621f32" fontWeight="900" fontSize="11">
                      {hoveredSlice !== null ? pieSlices[hoveredSlice].pct + "%" : formatNumber(pieTotal)}
                    </text>
                    <text x="100" y="110" textAnchor="middle" fill="#999" fontSize="7" fontWeight="600">
                      {hoveredSlice !== null ? "del total" : "movimientos"}
                    </text>
                  </svg>
                </div>

                {/* Leyenda */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pieSlices.map((slice, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => handleActionClick(slice.accion_nombre)}
                      className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                        hoveredSlice === null || hoveredSlice === i ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={`${slice.accion_nombre} (con ${MOTIVOS_COUNT_MAP[slice.accion_nombre] || 0} motivos diferentes)`}>
                        {slice.accion_nombre} <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500"> (con {MOTIVOS_COUNT_MAP[slice.accion_nombre] || 0} motivos diferentes)</span>
                      </span>
                      <span className="text-[10px] font-black text-slate-500 shrink-0">
                        {formatNumber(slice.total)}
                        <span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <AnimatePresence>
              {selectedActionName && (
                <>
                  {/* Motif stats card */}
                  <motion.div
                    key="motif-card"
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex-shrink-0 lg:w-56 flex flex-col gap-2"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#bc955c] dark:text-[#d4a96a] px-1 truncate" title={`Motivos de ${selectedActionName}`}>
                      Motivos de {selectedActionName}
                    </div>
                    {motifStatsLoading ? (
                      <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-[#bc955c]/90 text-slate-950 shadow-xl shadow-[#bc955c]/25 ring-2 ring-white/20 animate-pulse min-h-[224px]">
                        <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 bg-white" />
                        <div className="flex items-center gap-2 mb-3 relative z-10 pr-4">
                          <div className="p-2 rounded-xl bg-slate-950/20 text-slate-950 shrink-0">
                            <Filter className="size-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/90 truncate" title={`${selectedActionName}`}>
                            {selectedActionName}
                          </span>
                        </div>
                        
                        <div className="flex flex-col relative z-10 gap-2">
                          <div className="h-10 w-24 bg-slate-950/20 rounded-lg" />
                          <div className="h-3 w-32 bg-slate-950/10 rounded-md mt-2" />
                        </div>

                        <div className="mt-4 relative z-10">
                          <div className="h-2.5 w-20 bg-slate-950/10 rounded-md mb-2" />
                          <div className="h-10 min-h-10 max-h-10 w-full bg-slate-950/20 rounded-xl flex-shrink-0" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col justify-between h-full bg-gradient-to-br from-[#bc955c] to-[#9a753c] text-slate-950 shadow-xl shadow-[#bc955c]/25 ring-2 ring-white/20 min-h-[224px]">
                        <div className="absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-30 bg-white" />
                        
                        {/* Close button in top-right */}
                        <button 
                          onClick={handleCloseMotifStats} 
                          className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-950/10 text-slate-950 transition-colors z-20 cursor-pointer"
                          title="Cerrar distribución por motivos"
                        >
                          <X className="size-3.5" />
                        </button>

                        <div className="flex items-center gap-2 mb-3 relative z-10 pr-4">
                          <div className="p-2 rounded-xl bg-slate-950/15 text-slate-950 shrink-0">
                            <Filter className="size-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-950/90 truncate" title={`${selectedActionName}`}>
                            {selectedActionName}
                          </span>
                        </div>
                        
                        <div className="flex flex-col relative z-10">
                          <span className="text-5xl font-black tracking-tighter text-slate-950">
                            {formatNumber(motifPieTotal)}
                          </span>
                          <span className="text-xs text-slate-950/70 mt-2 relative z-10 font-semibold truncate">
                            {activeMotifStatsList.length} motivos distintos
                          </span>
                        </div>

                        {/* Year Selector for Motifs */}
                        <div className="mt-4 relative z-10">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-950/75 block mb-1">Año de Efectividad</label>
                          <Select value={selectedMotifYear} onValueChange={setSelectedMotifYear}>
                            <SelectTrigger className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 !h-10 !min-h-10 !max-h-10 flex-shrink-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:text-slate-500 shadow-sm transition-colors">
                              <SelectValue placeholder="Seleccionar año" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="bg-white border border-slate-200 text-slate-850 max-h-60 rounded-xl shadow-xl [&_svg]:text-slate-800 w-[var(--radix-select-trigger-width)]">
                              <SelectItem value="all" className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                                Todos los años
                              </SelectItem>
                              {Object.keys(motifStatsData.by_year).sort((a, b) => b.localeCompare(a)).map(year => (
                                <SelectItem key={year} value={year} className="hover:bg-slate-100 focus:bg-slate-100 text-slate-700 cursor-pointer py-1.5 px-3 rounded-lg text-xs font-bold transition-colors">
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Motif Pie chart */}
                  <motion.div
                    key="motif-pie"
                    initial={{ opacity: 0, scale: 0.95, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: 20 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex-1 flex flex-col gap-2"
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 truncate">
                      Distribución por Motivos
                    </div>
                    <div className="flex-1 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-[1.5rem] p-5 shadow-md flex flex-col md:flex-row gap-6 items-center min-h-[224px] overflow-hidden w-full">
                      {motifStatsLoading ? (
                        <div className="flex-1 flex flex-col md:flex-row gap-6 items-center w-full animate-pulse">
                          <div className="relative shrink-0 size-[180px] rounded-full border-[22px] border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-900/50" />
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="flex items-center gap-2 py-1">
                                <span className="shrink-0 size-2.5 rounded-full bg-slate-200 dark:bg-slate-850" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-24" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded-md w-10 ml-auto" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : motifPieSlices.length > 0 ? (
                        <>
                          <div className="relative shrink-0" onMouseMove={(e) => setPieTooltipPos({ x: e.clientX, y: e.clientY })}>
                            <svg viewBox="0 0 200 200" width="180" height="180" className="drop-shadow-md">
                              {motifPieSlices.map((slice, i) => (
                                <path
                                  key={i}
                                  d={slice.d}
                                  fill={slice.color}
                                  opacity={hoveredMotifSlice === null || hoveredMotifSlice === i ? 1 : 0.35}
                                  stroke="white"
                                  strokeWidth="1.5"
                                  className="transition-all duration-200 cursor-pointer"
                                  onMouseEnter={() => setHoveredMotifSlice(i)}
                                  onMouseLeave={() => setHoveredMotifSlice(null)}
                                  onClick={() => handleMotifClick(slice.motivo_nombre)}
                                  style={hoveredMotifSlice === i ? { filter: 'brightness(1.15)', transform: 'scale(1.03)', transformOrigin: 'center' } : {}}
                                />
                              ))}
                              <circle cx="100" cy="100" r="42" fill="white" className="dark:fill-slate-900" />
                              <text x="100" y="96" textAnchor="middle" className="text-[9px]" fill="#bc955c" fontWeight="900" fontSize="11">
                                {hoveredMotifSlice !== null ? motifPieSlices[hoveredMotifSlice].pct + "%" : formatNumber(motifPieTotal)}
                              </text>
                              <text x="100" y="110" textAnchor="middle" fill="#999" fontSize="7" fontWeight="600">
                                {hoveredMotifSlice !== null ? "del total" : "motivos"}
                              </text>
                            </svg>
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-48 overflow-y-auto pr-1 w-full">
                            {motifPieSlices.map((slice, i) => (
                              <div
                                key={i}
                                onMouseEnter={() => setHoveredMotifSlice(i)}
                                onMouseLeave={() => setHoveredMotifSlice(null)}
                                onClick={() => handleMotifClick(slice.motivo_nombre)}
                                className={`flex items-center gap-2 cursor-pointer hover:bg-slate-500/5 dark:hover:bg-white/5 rounded-lg px-1.5 py-0.5 transition-all duration-150 ${
                                  hoveredMotifSlice === null || hoveredMotifSlice === i ? 'opacity-100' : 'opacity-40'
                                }`}
                              >
                                <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1" title={slice.motivo_nombre}>
                                  {slice.motivo_nombre}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 shrink-0">
                                  {formatNumber(slice.total)}
                                  <span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center w-full min-h-[180px]">
                          <span className="text-xs text-slate-400 font-medium">No hay datos de motivos para esta acción en el año seleccionado</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </Zoom>
      </div>

        <div 
          ref={cardRef} 
        className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl max-h-[calc(100vh-144px)] h-fit flex flex-col sticky bottom-0 z-30 overflow-hidden w-full scroll-mt-36" 
        style={{ width: cardWidth ? `${cardWidth}px` : '100%', maxWidth: cardWidth ? 'none' : '100%' }}
      >
        {/* SUBTAB BAR */}
        <div className="flex items-center gap-2 p-3 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-800/80">
          {[
            { id: "movimientos", label: "Movimientos de Personal", icon: Briefcase },
            { id: "bitacora", label: "Bitácora de Movimientos", icon: UserCheck }
          ].map((sub) => {
            const Icon = sub.icon;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubTab(sub.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer text-center ${
                  activeSubTab === sub.id
                    ? "bg-[#621f32] text-white shadow-md shadow-[#621f32]/25 dark:bg-[#bc955c] dark:text-[#3e131f] dark:shadow-none"
                    : "text-slate-500 hover:text-[#621f32] dark:text-slate-400 dark:hover:text-[#bc955c] hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Icon className="size-3.5" />
                {sub.label}
              </button>
            );
          })}
        </div>

        {activeSubTab === "movimientos" ? (
          <>
            {/* Top Controls Toolbar */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
              
              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      placeholder="Buscar..." 
                      className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-bold w-full outline-none" 
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-655 ml-1.5 mr-1">
                        <X className="size-3.5" />
                      </
