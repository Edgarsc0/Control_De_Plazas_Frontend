import os

file_path = '/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/MovimientosTab.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Replacement 1: Override movPosData
old_mov_pos = """  const movPosData = useMemo(() => {
    const mapEstadoNomina = (val) => {
      if (!val || val.trim() === "") return "Vacante";
      switch (val.trim().toUpperCase()) {
        case "A": return "Activo";
        case "S": return "Suspendido";
        case "L": return "Licencia";
        case "P": return "Licencia Médica";
        default: return "Vacante";
      }
    };
    
    const ocupadasSet = new Set();
    detalle.forEach(emp => {
      if (emp.posicion && mapEstadoNomina(emp.estado_nomina) !== "Vacante") {
        ocupadasSet.add(String(emp.posicion));
      }
    });

    return initialMovPosData.map(pos => {
      const isOcupada = ocupadasSet.has(String(pos.no_pos_actual));
      return {
        ...pos,
        ocupacion: isOcupada ? "Ocupada" : "Vacante",
        fecha_vacancia: isOcupada ? "" : pos.fecha_vacancia
      };
    });
  }, [initialMovPosData, detalle]);"""

new_mov_pos = """  const [movPosData, setMovPosData] = useState([]);"""

# Verify Replacement 1 exists
if old_mov_pos in code:
    code = code.replace(old_mov_pos, new_mov_pos)
else:
    print("Warning: old_mov_pos not found in source!")

# Replacement 2: Inject stats, pagination states, and effects
old_filter_search_decl = '  const [filterSearchText, setFilterSearchText] = useState("");'
new_filter_search_decl = """  const [filterSearchText, setFilterSearchText] = useState("");

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [stats, setStats] = useState({
    total_movimientos: 0,
    todas_posiciones: 0,
    posiciones_activas: 0,
    posiciones_inactivas: 0
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedTextFilters, setDebouncedTextFilters] = useState({});

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 450);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTextFilters(textFilters);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [textFilters]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters]);

  const [uniqueColumnValues, setUniqueColumnValues] = useState({});
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const [hasInitializedTemp, setHasInitializedTemp] = useState(false);
  const [debouncedFilterSearchText, setDebouncedFilterSearchText] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterSearchText(filterSearchText);
    }, 350);
    return () => clearTimeout(handler);
  }, [filterSearchText]);

  useEffect(() => {
    setLoading(true);

    const filterParams = {};
    Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
      if (filterObj && filterObj.value && filterObj.value.trim()) {
        const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        let suffix = "";
        if (cond === "contains") suffix = "__icontains";
        else if (cond === "not_contains") {
          filterParams[`exclude__${colKey}__icontains`] = filterObj.value.trim();
          return;
        }
        else if (cond === "starts_with") suffix = "__istartswith";
        else if (cond === "not_starts_with") {
          filterParams[`exclude__${colKey}__istartswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "ends_with") suffix = "__iendswith";
        else if (cond === "not_ends_with") {
          filterParams[`exclude__${colKey}__iendswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "equals") suffix = "__iexact";
        else if (cond === "not_equals") {
          filterParams[`exclude__${colKey}__iexact`] = filterObj.value.trim();
          return;
        }
        
        filterParams[`${colKey}${suffix}`] = filterObj.value.trim();
      }
    });

    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (key === "is_latest") return;
      if (values && values.length > 0) {
        colParams[`${key}__in`] = values.join(",");
      }
    });

    const isLatestVal = columnFilters.is_latest?.includes("true") ? "true" : "false";

    const params = {
      page,
      page_size: pageSize,
      search: debouncedSearch,
      is_latest: isLatestVal,
      ...filterParams,
      ...colParams
    };

    if (sortConfig.key) {
      if (sortConfig.key === "custom_movimientos") {
        params.sort_by = "f_efva,fecha_captura,no_pos_actual";
        params.sort_order = "desc";
      } else {
        params.sort_by = sortConfig.key;
        params.sort_order = sortConfig.direction || "asc";
      }
    }

    VacantesService.getMovPosDetalle(params)
      .then(res => res.json())
      .then(resData => {
        setMovPosData(resData.results || []);
        setCount(resData.count || 0);
        if (resData.stats) {
          setStats(resData.stats);
        }
      })
      .catch(err => console.error("Error loading MovPosDetalle:", err))
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, debouncedTextFilters, columnFilters, sortConfig]);

  useEffect(() => {
    if (!activeFilterDropdown) return;
    setLoadingUniqueValues(true);

    const filterParams = {};
    Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
      if (filterObj && filterObj.value && filterObj.value.trim()) {
        const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        let suffix = "";
        if (cond === "contains") suffix = "__icontains";
        else if (cond === "not_contains") {
          filterParams[`exclude__${colKey}__icontains`] = filterObj.value.trim();
          return;
        }
        else if (cond === "starts_with") suffix = "__istartswith";
        else if (cond === "not_starts_with") {
          filterParams[`exclude__${colKey}__istartswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "ends_with") suffix = "__iendswith";
        else if (cond === "not_ends_with") {
          filterParams[`exclude__${colKey}__iendswith`] = filterObj.value.trim();
          return;
        }
        else if (cond === "equals") suffix = "__iexact";
        else if (cond === "not_equals") {
          filterParams[`exclude__${colKey}__iexact`] = filterObj.value.trim();
          return;
        }
        
        filterParams[`${colKey}${suffix}`] = filterObj.value.trim();
      }
    });

    const colParams = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (key === activeFilterDropdown || key === "is_latest") return;
      if (values && values.length > 0) {
        colParams[`${key}__in`] = values.join(",");
      }
    });

    const isLatestVal = columnFilters.is_latest?.includes("true") ? "true" : "false";

    const params = {
      distinct_field: activeFilterDropdown,
      distinct_search: debouncedFilterSearchText,
      is_latest: isLatestVal,
      search: debouncedSearch,
      ...filterParams,
      ...colParams
    };

    VacantesService.getMovPosDetalle(params)
      .then(res => res.json())
      .then(resData => {
        const valuesList = Array.isArray(resData) ? resData : [];
        setUniqueColumnValues(prev => ({ ...prev, [activeFilterDropdown]: valuesList }));
        setHasInitializedTemp(prevInit => {
          if (!prevInit) {
            if (columnFilters[activeFilterDropdown]) {
              setTempSelectedValues(columnFilters[activeFilterDropdown]);
            } else {
              setTempSelectedValues(valuesList.map(v => v.value));
            }
            return true;
          }
          return prevInit;
        });
      })
      .catch(err => console.error("Error loading unique values:", err))
      .finally(() => setLoadingUniqueValues(false));
  }, [activeFilterDropdown, debouncedFilterSearchText, debouncedSearch, debouncedTextFilters, columnFilters]);"""

if old_filter_search_decl in code:
    code = code.replace(old_filter_search_decl, new_filter_search_decl)
else:
    print("Warning: old_filter_search_decl not found!")

# Replacement 3: Remove old posicionesActivas and posicionesInactivas
old_pos_memo = """  const posicionesActivas = useMemo(() => movPosData.filter(pos => pos.estado_psn === "A").length, [movPosData]);
  const posicionesInactivas = useMemo(() => movPosData.filter(pos => pos.estado_psn === "I").length, [movPosData]);"""

if old_pos_memo in code:
    code = code.replace(old_pos_memo, "")
else:
    print("Warning: old_pos_memo not found!")

# Replacement 4: Replace old dateHierarchies
old_date_hierarchies = """  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS_MOV.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      movPosData.forEach(row => {
        const val = row[key];
        const parts = parseDateParts(val);
        if (!parts) return;
        const { year, month, day, monthName } = parts;
        if (!years[year]) years[year] = { count: 0, months: {} };
        years[year].count++;
        if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
        years[year].months[month].count++;
        years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + 1;
      });
      hierarchies[key] = years;
    });
    return hierarchies;
  }, [movPosData, activeFilterDropdown, parseDateParts]);"""

new_date_hierarchies = """  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_KEYS_MOV.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      const valuesList = uniqueColumnValues[key] || [];
      valuesList.forEach(item => {
        const val = item.value;
        const count = item.count;
        const parts = parseDateParts(val);
        if (!parts) return;
        const { year, month, day, monthName } = parts;
        if (!years[year]) years[year] = { count: 0, months: {} };
        years[year].count += count;
        if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
        years[year].months[month].count += count;
        years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + count;
      });
      hierarchies[key] = years;
    });
    return hierarchies;
  }, [uniqueColumnValues, activeFilterDropdown, parseDateParts]);"""

if old_date_hierarchies in code:
    code = code.replace(old_date_hierarchies, new_date_hierarchies)
else:
    print("Warning: old_date_hierarchies not found!")

# Replacement 5: Remove old uniqueColumnValues useMemo
old_unique_col_vals = """  const uniqueColumnValues = useMemo(() => {
    const valuesMap = {};
    const targetKeys = ["estado_psn"];
    if (activeFilterDropdown && !targetKeys.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const counts = {};
      movPosData.forEach(row => {
        let val = String(row[key] || "").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      valuesMap[key] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    });
    return valuesMap;
  }, [movPosData, activeFilterDropdown]);"""

if old_unique_col_vals in code:
    code = code.replace(old_unique_col_vals, "")
else:
    print("Warning: old_unique_col_vals not found!")

# Replacement 6: Replace handleDateSelection
old_handle_date_selection = """  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      targetRawValues = movPosData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'month') {
      const year = parentPath;
      targetRawValues = movPosData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      targetRawValues = movPosData
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(row => String(row[colKey] || "").trim());
    }

    const uniqueTargetValues = [...new Set(targetRawValues)];
    const allInTemp = uniqueTargetValues.every(v => tempSelectedValues.includes(v));

    if (allInTemp) {
      setTempSelectedValues(prev => prev.filter(v => !uniqueTargetValues.includes(v)));
    } else {
      setTempSelectedValues(prev => [...new Set([...prev, ...uniqueTargetValues])]);
    }
  };"""

new_handle_date_selection = """  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'month') {
      const year = parentPath;
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === value;
        })
        .map(item => String(item.value).trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      const valuesList = uniqueColumnValues[colKey] || [];
      targetRawValues = valuesList
        .filter(item => {
          const p = parseDateParts(item.value);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(item => String(item.value).trim());
    }

    const uniqueTargetValues = [...new Set(targetRawValues)];
    const allInTemp = uniqueTargetValues.every(v => tempSelectedValues.includes(v));

    if (allInTemp) {
      setTempSelectedValues(prev => prev.filter(v => !uniqueTargetValues.includes(v)));
    } else {
      setTempSelectedValues(prev => [...new Set([...prev, ...uniqueTargetValues])]);
    }
  };"""

if old_handle_date_selection in code:
    code = code.replace(old_handle_date_selection, new_handle_date_selection)
else:
    print("Warning: old_handle_date_selection not found!")

# Replacement 7: Replace openFilterDropdown
old_open_filter_dropdown = """  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) setActiveFilterDropdown(null);
    else {
      setActiveFilterDropdown(colKey);
      setFilterDropdownTab('todos');
      setFilterSearchText("");
      if (columnFilters[colKey]) {
        setTempSelectedValues(columnFilters[colKey]);
      } else {
        let uniqueVals = uniqueColumnValues[colKey]?.map(v => v.value);
        if (!uniqueVals) {
          const counts = {};
          movPosData.forEach(row => {
            let val = String(row[colKey] || "").trim();
            counts[val] = true;
          });
          uniqueVals = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
        setTempSelectedValues(uniqueVals);
      }
    }
  };"""

new_open_filter_dropdown = """  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) {
      setActiveFilterDropdown(null);
      setHasInitializedTemp(false);
    } else {
      setHasInitializedTemp(false);
      setActiveFilterDropdown(colKey);
      setFilterDropdownTab('todos');
      setFilterSearchText("");
      if (columnFilters[colKey]) {
        setTempSelectedValues(columnFilters[colKey]);
      } else {
        setTempSelectedValues([]);
      }
    }
  };"""

if old_open_filter_dropdown in code:
    code = code.replace(old_open_filter_dropdown, new_open_filter_dropdown)
else:
    print("Warning: old_open_filter_dropdown not found!")

# Replacement 8: Replace applyColumnFilter and clearColumnFilter
old_apply_clear_filters = """  const applyColumnFilter = (colKey) => {
    const totalUnique = (uniqueColumnValues[colKey] || []).map(v => v.value);
    startTransition(() => {
      if (tempSelectedValues.length === totalUnique.length) {
        const newFilters = { ...columnFilters };
        delete newFilters[colKey];
        setColumnFilters(newFilters);
      } else {
        setColumnFilters({ ...columnFilters, [colKey]: tempSelectedValues });
      }
    });
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    startTransition(() => {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    });
    setActiveFilterDropdown(null);
  };"""

new_apply_clear_filters = """  const applyColumnFilter = (colKey) => {
    const totalUnique = (uniqueColumnValues[colKey] || []).map(v => v.value);
    startTransition(() => {
      if (tempSelectedValues.length === totalUnique.length || tempSelectedValues.length === 0) {
        const newFilters = { ...columnFilters };
        delete newFilters[colKey];
        setColumnFilters(newFilters);
      } else {
        setColumnFilters({ ...columnFilters, [colKey]: tempSelectedValues });
      }
    });
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };

  const clearColumnFilter = (colKey) => {
    startTransition(() => {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    });
    setActiveFilterDropdown(null);
    setHasInitializedTemp(false);
  };"""

if old_apply_clear_filters in code:
    code = code.replace(old_apply_clear_filters, new_apply_clear_filters)
else:
    print("Warning: old_apply_clear_filters not found!")

# Replacement 9: Replace filteredSortedData
old_filtered_sorted_data = """  const filteredSortedData = useMemo(() => {
    let result = movPosData.filter(row => {
      if (deferredGlobalSearch) {
        const searchText = deferredGlobalSearch.toLowerCase();
        if (!Object.entries(row).some(([key, val]) => String(val || "").toLowerCase().includes(searchText))) return false;
      }
      for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals.includes(String(row[colKey] || "").trim())) return false;
      }
      for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {
        if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
        const searchText = filterObj.value;
        const condition = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
        
        const val = String(row[colKey] || "");
        const lowerVal = val.toLowerCase().trim();
        const lowerSearch = searchText.toLowerCase().trim();
        
        switch (condition) {
          case "contains":
            if (!lowerVal.includes(lowerSearch)) return false;
            break;
          case "not_contains":
            if (lowerVal.includes(lowerSearch)) return false;
            break;
          case "starts_with":
            if (!lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "not_starts_with":
            if (lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "ends_with":
            if (!lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "not_ends_with":
            if (lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "equals":
            if (lowerVal !== lowerSearch) return false;
            break;
          case "not_equals":
            if (lowerVal === lowerSearch) return false;
            break;
          default:
            if (!lowerVal.includes(lowerSearch)) return false;
        }
      }
      return true;
    });

    result = advancedFilter.filterData(result);

    if (sortConfig.key === "custom_movimientos") {
      result.sort((a, b) => {
        const posA = String(a.no_pos_actual || "");
        const posB = String(b.no_pos_actual || "");
        if (posA !== posB) return posA.localeCompare(posB, undefined, { numeric: true });
        
        const d1 = new Date(a.f_efva || 0);
        const d2 = new Date(b.f_efva || 0);
        if (d1 > d2) return -1;
        if (d1 < d2) return 1;
        const c1 = new Date(a.fecha_captura || 0);
        const c2 = new Date(b.fecha_captura || 0);
        if (c1 > c2) return -1;
        if (c1 < c2) return 1;
        return 0;
      });
    } else if (sortConfig.key && sortConfig.direction) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let valA = String(a[key] || "").trim(), valB = String(b[key] || "").trim();
        const numA = Number(valA), numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) return direction === "asc" ? numA - numB : numB - numA;
        return direction === "asc" ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" }) : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: "base" });
      });
    }
    return result;
  }, [movPosData, deferredGlobalSearch, columnFilters, deferredTextFilters, sortConfig, isMonoColumn, advancedFilter.rules]);"""

new_filtered_sorted_data = """  const filteredSortedData = movPosData;"""

if old_filtered_sorted_data in code:
    code = code.replace(old_filtered_sorted_data, new_filtered_sorted_data)
else:
    print("Warning: old_filtered_sorted_data not found!")

# Replacement 10: Replace counts inside cards
code = code.replace('{formatNumber(posicionesActivas)}', '{formatNumber(stats.posiciones_activas)}')
code = code.replace('{formatNumber(posicionesInactivas)}', '{formatNumber(stats.posiciones_inactivas)}')
code = code.replace('{formatNumber(movPosDataLatest.length)}', '{formatNumber(stats.todas_posiciones)}')
code = code.replace('{formatNumber(movPosData.length)}', '{formatNumber(stats.total_movimientos)}')

# Replacement 11: Add totalPages
code = code.replace(
    "  const rowHeight = 37, containerHeight = 800;",
    "  const rowHeight = 37, containerHeight = 800;\n  const totalPages = Math.ceil(count / pageSize) || 1;"
)

# Replacement 12: Row Index page offset
code = code.replace('{actualRowIdx + 1}', '{(page - 1) * pageSize + actualRowIdx + 1}')

# Replacement 13: Export Excel Function
old_export_excel = """  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Movimientos_Posiciones");

      const visibleCols = columns.filter(c => c.visible);

      // Define columns
      worksheet.columns = visibleCols.map(col => ({
        header: col.label.toUpperCase(),
        key: col.key,
        width: Math.max(12, Math.min(40, col.width / 8))
      }));

      // Styles
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Inter', family: 4, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF621F32' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 30;

      filteredSortedData.forEach((row) => {
        const rowData = {};
        visibleCols.forEach(col => {
          rowData[col.key] = row[col.key] === null || row[col.key] === undefined ? "" : row[col.key];
        });
        worksheet.addRow(rowData);
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Movimientos_Posiciones.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setIsExportingExcel(false);
    }
  };"""

new_export_excel = """  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Movimientos_Posiciones");

      const visibleCols = columns.filter(c => c.visible);

      // Define columns
      worksheet.columns = visibleCols.map(col => ({
        header: col.label.toUpperCase(),
        key: col.key,
        width: Math.max(12, Math.min(40, col.width / 8))
      }));

      // Styles
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Inter', family: 4, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF621F32' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 30;

      // Call server to fetch all results without pagination
      const filterParams = {};
      Object.entries(debouncedTextFilters).forEach(([colKey, filterObj]) => {
        if (filterObj && filterObj.value && filterObj.value.trim()) {
          const cond = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");
          let suffix = "";
          if (cond === "contains") suffix = "__icontains";
          else if (cond === "not_contains") {
            filterParams[`exclude__${colKey}__icontains`] = filterObj.value.trim();
            return;
          }
          else if (cond === "starts_with") suffix = "__istartswith";
          else if (cond === "not_starts_with") {
            filterParams[`exclude__${colKey}__istartswith`] = filterObj.value.trim();
            return;
          }
          else if (cond === "ends_with") suffix = "__iendswith";
          else if (cond === "not_ends_with") {
            filterParams[`exclude__${colKey}__iendswith`] = filterObj.value.trim();
            return;
          }
          else if (cond === "equals") suffix = "__iexact";
          else if (cond === "not_equals") {
            filterParams[`exclude__${colKey}__iexact`] = filterObj.value.trim();
            return;
          }
          filterParams[`${colKey}${suffix}`] = filterObj.value.trim();
        }
      });

      const colParams = {};
      Object.entries(columnFilters).forEach(([key, values]) => {
        if (key === "is_latest") return;
        if (values && values.length > 0) {
          colParams[`${key}__in`] = values.join(",");
        }
      });

      const isLatestVal = columnFilters.is_latest?.includes("true") ? "true" : "false";

      const params = {
        no_pagination: 'true',
        search: debouncedSearch,
        is_latest: isLatestVal,
        ...filterParams,
        ...colParams
      };

      if (sortConfig.key) {
        if (sortConfig.key === "custom_movimientos") {
          params.sort_by = "f_efva,fecha_captura,no_pos_actual";
          params.sort_order = "desc";
        } else {
          params.sort_by = sortConfig.key;
          params.sort_order = sortConfig.direction || "asc";
        }
      }

      const res = await VacantesService.getMovPosDetalle(params);
      const allData = await res.json();

      allData.forEach((row) => {
        const rowData = {};
        visibleCols.forEach(col => {
          rowData[col.key] = row[col.key] === null || row[col.key] === undefined ? "" : row[col.key];
        });
        worksheet.addRow(rowData);
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Movimientos_Posiciones.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setIsExportingExcel(false);
    }
  };"""

if old_export_excel in code:
    code = code.replace(old_export_excel, new_export_excel)
else:
    print("Warning: old_export_excel not found!")

# Replacement 14: Inject Pagination UI Bar
old_header_controls = """            <div className="flex items-center gap-3">
              <AnimatePresence>
                {selectedCell && ("""

new_header_controls = """            <div className="flex items-center gap-3">
              {/* Pagination controls */}
              <div className="flex items-center gap-4 shrink-0 mr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Mostrar:</span>
                  <select 
                    value={pageSize} 
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase text-[#621f32] dark:text-[#bc955c] outline-none cursor-pointer"
                  >
                    {[25, 50, 100, 250, 500].map(sz => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 select-none">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1 || loading}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 px-1">
                    Pág. <span className="text-[#621f32] dark:text-[#bc955c]">{page}</span> de <span className="text-[#621f32] dark:text-[#bc955c]">{totalPages}</span>
                  </span>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages || loading}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronRightIcon className="size-3.5" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {selectedCell && ("""

if old_header_controls in code:
    code = code.replace(old_header_controls, new_header_controls)
else:
    print("Warning: old_header_controls not found!")

# Replacement 15: Loading overlays support
code = code.replace('isPending && (', '(isPending || loading) && (')

# Replacement 16: Checklist object map support (map baseUniqueValues to map value if it is an object)
old_base_unique_vals = '                      let baseUniqueValues = uniqueColumnValues[activeFilterDropdown] || [];'
new_base_unique_vals = """                      let baseUniqueValues = (uniqueColumnValues[activeFilterDropdown] || []).map(v => typeof v === 'object' ? v : { value: v, count: 0 });"""

if old_base_unique_vals in code:
    code = code.replace(old_base_unique_vals, new_base_unique_vals)
else:
    print("Warning: old_base_unique_vals not found!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched successfully!")
