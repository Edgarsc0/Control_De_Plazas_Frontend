'use client';

import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ClipboardList,
  Filter,
  X,
  Loader2,
  Tag,
  User,
  Building2,
  FileText,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Zoom } from '@/components/shared/Reveal';
import { PieChart } from '@/components/ui/BentoMiniComponents';
import { ControlGestionService } from '@/services/control_gestion.service';
import DetailModal from '@/components/shared/OficioDetailModal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import MobileCardList from '@/components/ui/MobileCardList';
import DataTable from '@/app/dashboard/plantilla_empleados/_components/shared/DataTable';
import ColumnFilterDropdown from '@/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown';
import CopyCellMenu from '@/app/dashboard/plantilla_empleados/_components/shared/CopyCellMenu';
import { useColumnState } from '@/app/dashboard/plantilla_empleados/_hooks/useColumnState';
import { useCellSelection } from '@/app/dashboard/plantilla_empleados/_hooks/useCellSelection';
import { useColumnFilters } from '@/app/dashboard/plantilla_empleados/_hooks/useColumnFilters';
import { usePersistedState } from '@/app/dashboard/plantilla_empleados/_hooks/usePersistedState';
import {
  defaultGetCellValue,
  getUniqueColumnValues,
  sortValueCounts,
  matchesTextCondition,
  finalizeFilterDropdownValues,
  resolveColumnFilterCommit,
  normalizeForSearch,
  formatDateEsMx,
} from '@/utils/columnFilters';

const ROW_HEIGHT = 37;
const CONTAINER_HEIGHT = 800;
const MONO_COLUMN_KEYS = ['asuntoNoOficio'];
const DATE_COLUMN_KEYS = ['fechaRegistro'];

// La columna "No. Oficio" debe poder filtrarse por número de oficio Y/O por
// clasificación (que ya no es columna propia — vive como badge dentro de esa
// misma celda, ver renderCell). Los dos filtros de la tabla se reparten cada
// dominio en vez de mezclarlos en un solo pool:
//  - El dropdown de checkboxes (Excel-style) sólo lista "clasificacion": son
//    pocos valores distintos, ideal para un checkbox-list. Meterle ahí
//    también ~700 números de oficio casi únicos rompía el "Seleccionar
//    Todo"/auto-acotado-al-buscar de `ColumnFilterDropdown` (pensado para UN
//    campo, no dos de cardinalidad muy distinta) y dejaba números de oficio
//    sueltos seleccionados sin que el usuario los viera — filas sin badge de
//    clasificación colándose en el resultado filtrado.
//  - El buscador de texto de esa misma columna (fila de "Filtrar..." bajo el
//    encabezado) sí compara ambos campos: es una comparación de substring
//    simple, sin el estado de "seleccionar todo" que causaba el bug arriba.
const CHECKBOX_FILTER_COLUMNS = { asuntoNoOficio: ['clasificacion'] };
const TEXT_FILTER_COLUMNS = { asuntoNoOficio: ['asuntoNoOficio', 'clasificacion'] };
const getCheckboxFilterKeys = (colKey) => CHECKBOX_FILTER_COLUMNS[colKey] || [colKey];
const getTextFilterKeys = (colKey) => TEXT_FILTER_COLUMNS[colKey] || [colKey];

const COLUMNS = [
  { key: 'asuntoNoOficio', label: 'No. Oficio / Clasificación', width: 200, visible: true },
  { key: 'asuntoDescripcion', label: 'Descripción', width: 280, visible: true },
  { key: 'asuntoTema', label: 'Tema', width: 220, visible: true },
  { key: 'asuntoRemitente', label: 'Remitente', width: 220, visible: true },
  { key: 'asuntoRemitenteDependencia', label: 'Dependencia Remitente', width: 220, visible: true },
  { key: 'unidadArea', label: 'Unidad Área', width: 200, visible: true },
  { key: 'instruccion', label: 'Instrucción', width: 220, visible: true },
  { key: 'asuntoPrioridad', label: 'Prioridad', width: 110, visible: true },
  { key: 'statusTurnado', label: 'Estado', width: 150, visible: true },
  { key: 'fechaRegistro', label: 'Fecha Registro', width: 130, visible: true },
];

const PRIORITY_STYLES = {
  Alta: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/10 border-red-150',
  Media: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/10 border-amber-150',
  Baja: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/10 border-emerald-150',
  default: 'text-gray-500 bg-gray-50 dark:bg-slate-800 border-gray-150',
};

const getColumnLetter = (colIdx) => {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export default function OficiosTurnadosDO({ oficiosTurnados }) {
  const [localOficiosData, setLocalOficiosData] = useState({
    distribucionPorStatus: oficiosTurnados?.distribucionPorStatus || [],
    detalleTurnados: oficiosTurnados?.detalleTurnados || [],
  });

  const { distribucionPorStatus, detalleTurnados } = localOficiosData;

  const [selectedItem, setSelectedItem] = useState(null);
  const [expedienteData, setExpedienteData] = useState(null);
  const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(null);

  const tableContainerRef = useRef(null);
  const tbodyRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const { columns, setColumns, resetWidth } = useColumnState(COLUMNS, 'oficios_turnados_columns');
  const [sortConfig, setSortConfig] = usePersistedState('oficios_turnados_sort', { key: null, direction: null });
  const { selectedCell, setSelectedCell, contextMenu, openContextMenu, closeContextMenu } = useCellSelection();
  const filters = useColumnFilters({ storageKey: 'oficios_turnados_filters' });
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    setFilterSearchText,
    filterSearchCondition,
    debouncedFilterSearchText,
  } = filters;

  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const deferredTextFilters = useDeferredValue(textFilters);

  const isMonoColumn = useCallback((key) => MONO_COLUMN_KEYS.includes(key), []);
  const isDateColumn = useCallback((key) => DATE_COLUMN_KEYS.includes(key), []);
  const getCellValue = useCallback(
    (row, key) => (isDateColumn(key) ? formatDateEsMx(row[key]) : defaultGetCellValue(row, key)),
    [isDateColumn],
  );

  // Instrucción: viene de dos posibles campos según si hubo instrucción
  // cruzada — se aplana en un solo campo real para que sea una columna
  // filtrable/ordenable más de la tabla, en vez de un caso especial.
  const tableData = useMemo(
    () => detalleTurnados.map((item) => ({ ...item, instruccion: item.nombreInstruccionCruzada || item.nombreInstruccion || '' })),
    [detalleTurnados],
  );

  const statusColorMap = useMemo(() => {
    const map = {};
    const statuses = distribucionPorStatus.map((s) => s.statusTurnado).filter(Boolean);
    const palette = ['#621f32', '#bc955c', '#802842', '#d0ab75', '#967440', '#1f4e37', '#475569', '#ebd1ac', '#a37944'];

    statuses.forEach((status) => {
      const s = status.toLowerCase();
      if (s === 'concluido') map[status] = '#1f4e37';
      else if (s === 'atendido') map[status] = '#621f32';
      else if (s === 'recibido') map[status] = '#bc955c';
      else if (s === 'en proceso' || s === 'proceso') map[status] = '#d0ab75';
      else if (s === 'en trámite' || s === 'en tramite' || s === 'trámite' || s === 'tramite') map[status] = '#967440';
    });

    let paletteIndex = 0;
    statuses.forEach((status) => {
      if (!map[status]) {
        const usedColors = Object.values(map);
        const availableColors = palette.filter((c) => !usedColors.includes(c));
        if (availableColors.length > 0) map[status] = availableColors[0];
        else { map[status] = palette[paletteIndex % palette.length]; paletteIndex++; }
      }
    });
    return map;
  }, [distribucionPorStatus]);

  const getStatusConfig = useCallback((status) => {
    const color = statusColorMap[status] || '#94a3b8';
    return {
      label: status,
      color,
      styleBadge: { backgroundColor: `${color}1A`, color, borderColor: `${color}33` },
      styleDot: { backgroundColor: color },
    };
  }, [statusColorMap]);

  const getStatusIcon = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'recibido') return Info;
    if (s === 'atendido' || s === 'concluido') return CheckCircle2;
    return FileText;
  };

  const handleUpdateClasificacion = (idTurnado, nuevaClasificacion) => {
    setLocalOficiosData((prev) => ({
      ...prev,
      detalleTurnados: prev.detalleTurnados.map((item) =>
        item.idTurnado === idTurnado ? { ...item, clasificacion: nuevaClasificacion } : item,
      ),
    }));
    if (selectedItem && selectedItem.idTurnado === idTurnado) {
      setSelectedItem((prev) => ({ ...prev, clasificacion: nuevaClasificacion }));
    }
  };

  const handleStatusBadgeClick = (statusValue) => {
    setColumnFilters((prev) => {
      const current = prev.statusTurnado || [];
      const exists = current.includes(statusValue);
      const next = exists ? current.filter((v) => v !== statusValue) : [...current, statusValue];
      const newFilters = { ...prev };
      if (next.length === 0) delete newFilters.statusTurnado;
      else newFilters.statusTurnado = next;
      return newFilters;
    });
  };

  // Predicado de fila reusado tanto por los datos mostrados en tabla como por
  // el universo "alcanzable" de un dropdown de columna (excluyendo el filtro
  // propio de esa columna vía `excludeColKey`), igual que en los tabs de
  // plantilla_empleados — ver useCellSelection/ColumnFilterDropdown ahí.
  const rowPassesFilters = useCallback((row, { excludeColKey = null } = {}) => {
    if (deferredGlobalSearch) {
      const searchText = normalizeForSearch(deferredGlobalSearch);
      const hit = Object.values(row).some((val) => normalizeForSearch(String(val ?? '')).includes(searchText));
      if (!hit) return false;
    }
    for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
      if (colKey === excludeColKey) continue;
      const rowVals = getCheckboxFilterKeys(colKey).map((k) => getCellValue(row, k));
      if (!rowVals.some((v) => selectedVals.includes(v))) return false;
    }
    for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {
      if (colKey === excludeColKey) continue;
      if (!filterObj?.value?.trim()) continue;
      const condition = filterObj.condition || (isMonoColumn(colKey) ? 'starts_with' : 'contains');
      const matchesAny = getTextFilterKeys(colKey).some((k) => matchesTextCondition(getCellValue(row, k), condition, filterObj.value, { normalize: true }));
      if (!matchesAny) return false;
    }
    return true;
  }, [deferredGlobalSearch, columnFilters, deferredTextFilters, isMonoColumn, getCellValue]);

  const filteredSortedData = useMemo(() => {
    let result = tableData.filter((row) => rowPassesFilters(row));
    if (sortConfig.key && sortConfig.direction) {
      const { key, direction } = sortConfig;
      result = [...result].sort((a, b) => {
        const av = getCellValue(a, key), bv = getCellValue(b, key);
        const numA = Number(av), numB = Number(bv);
        if (av !== '' && bv !== '' && !isNaN(numA) && !isNaN(numB)) return direction === 'asc' ? numA - numB : numB - numA;
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [tableData, rowPassesFilters, sortConfig, getCellValue]);

  const reachableCounts = useMemo(() => {
    if (!activeFilterDropdown) return {};
    const keys = getCheckboxFilterKeys(activeFilterDropdown);
    const counts = {};
    tableData.forEach((row) => {
      if (!rowPassesFilters(row, { excludeColKey: activeFilterDropdown })) return;
      keys.forEach((k) => {
        const val = getCellValue(row, k);
        counts[val] = (counts[val] || 0) + 1;
      });
    });
    return counts;
  }, [activeFilterDropdown, tableData, rowPassesFilters, getCellValue]);
  const reachableValues = useMemo(() => Object.keys(reachableCounts), [reachableCounts]);

  const uniqueColumnValues = useMemo(() => {
    if (!activeFilterDropdown) return [];
    const keys = getCheckboxFilterKeys(activeFilterDropdown);
    if (keys.length === 1) return getUniqueColumnValues(tableData, activeFilterDropdown, getCellValue);
    const counts = {};
    tableData.forEach((row) => keys.forEach((k) => {
      const val = getCellValue(row, k).trim();
      counts[val] = (counts[val] || 0) + 1;
    }));
    return sortValueCounts(Object.entries(counts).map(([value, count]) => ({ value, count })));
  }, [activeFilterDropdown, tableData, getCellValue]);

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };
    const baseUniqueValues = uniqueColumnValues.map((v) => ({ ...v, count: reachableCounts[v.value] ?? 0 }));
    const filtered = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
      reachableValues,
    });
  }, [activeFilterDropdown, uniqueColumnValues, reachableValues, reachableCounts, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
    setActiveFilterDropdown(colKey);
    setFilterSearchText('');
    const keys = getCheckboxFilterKeys(colKey);
    const reachableVals = [...new Set(
      tableData.filter((row) => rowPassesFilters(row, { excludeColKey: colKey })).flatMap((row) => keys.map((k) => getCellValue(row, k))),
    )];
    setTempSelectedValues(columnFilters[colKey] || reachableVals);
  };

  const applyColumnFilter = (colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (shouldClear) delete next[colKey]; else next[colKey] = valuesToCommit;
      return next;
    });
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    setActiveFilterDropdown(null);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key, direction });
  };

  const handleResizeStart = (e, index, direction = 'right') => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns((prev) => {
        const next = [...prev];
        const newWidth = direction === 'left' ? startWidth - deltaX : startWidth + deltaX;
        next[index] = { ...next[index], width: Math.max(60, newWidth) };
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const hasActiveFilters = !!globalSearch || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some((f) => f?.value);
  const resetAllFilters = () => {
    setGlobalSearch('');
    setColumnFilters({});
    setTextFilters({});
    setSortConfig({ key: null, direction: null });
    setActiveFilterDropdown(null);
    setActiveConditionDropdown(null);
  };

  const currentIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return filteredSortedData.findIndex((item) => item.idTurnado === selectedItem.idTurnado);
  }, [filteredSortedData, selectedItem]);

  const handleNextItem = () => {
    if (currentIndex < filteredSortedData.length - 1) handleSelectItem(filteredSortedData[currentIndex + 1]);
  };
  const handlePreviousItem = () => {
    if (currentIndex > 0) handleSelectItem(filteredSortedData[currentIndex - 1]);
  };

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setIsLoadingExpediente(true);
    setExpedienteData(null);
    setCurrentPdfUrl(null);
    try {
      const data = await ControlGestionService.getExpedienteAsunto(item.idAsunto);
      if (data.status === 200) {
        setExpedienteData(data);
        const firstDoc = data.model?.documentos?.[0] || data.model?.respuestas?.[0] || data.model?.anexos?.[0];
        if (firstDoc) handlePreviewDocument(firstDoc.ruta || firstDoc.nombre, item.idAsunto);
      }
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    } finally {
      setIsLoadingExpediente(false);
    }
  };

  const handlePreviewDocument = async (relativePath, forceId = null) => {
    const idToUse = forceId || selectedItem?.idAsunto;
    if (!idToUse) return;
    setIsPreviewing(true);
    try {
      const blob = await ControlGestionService.getVisualizarDocumento(idToUse, relativePath);
      const url = window.URL.createObjectURL(blob);
      setCurrentPdfUrl(url);
    } catch (error) {
      console.error('Error al previsualizar documento:', error);
    } finally {
      setIsPreviewing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (currentPdfUrl) window.URL.revokeObjectURL(currentPdfUrl);
    };
  }, [currentPdfUrl]);

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + CONTAINER_HEIGHT) / ROW_HEIGHT) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    const baseTdClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${
      isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]' : (isSticky ? 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300' : 'bg-white/10 text-slate-700 dark:text-slate-300')
    } ${isMonoColumn(col.key) ? 'font-mono font-bold' : 'font-semibold'}`;

    if (col.key === 'statusTurnado') {
      const config = getStatusConfig(value);
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md' : (isSticky ? 'bg-white dark:bg-slate-950' : 'bg-white/10')}`}>
          {value ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-black text-[10px] uppercase" style={config.styleBadge}>
              <span className="size-1.5 rounded-full shrink-0" style={config.styleDot} />
              {value}
            </span>
          ) : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'asuntoPrioridad') {
      const pStyle = PRIORITY_STYLES[value] || PRIORITY_STYLES.default;
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md' : (isSticky ? 'bg-white dark:bg-slate-950' : 'bg-white/10')}`}>
          {value ? <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold text-[10px] uppercase ${pStyle}`}>{value}</span> : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'asuntoNoOficio') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 border-r h-[37px] align-middle ${isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md' : (isSticky ? 'bg-white dark:bg-slate-950' : 'bg-white/10')}`}>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 truncate">{value || <span className="text-slate-300">-</span>}</span>
            {row.clasificacion && (
              <span className="inline-flex items-center gap-1 w-fit px-1.5 py-px rounded text-[8px] font-black uppercase leading-tight bg-[#bc955c]/15 text-[#8a6a3c] dark:text-[#e3c793] border border-[#bc955c]/30">
                <Tag className="size-2 shrink-0" />{row.clasificacion}
              </span>
            )}
          </div>
        </td>
      );
    }

    if (col.key === 'asuntoDescripcion') {
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`${baseTdClass} ${value ? 'cursor-help' : ''}`}>{value || <span className="text-slate-300">-</span>}</td>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-md">
            <p className="text-[11px] font-semibold leading-relaxed">{value || 'Sin descripción'}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (col.key === 'fechaRegistro') {
      return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>{formatDateEsMx(value) || <span className="text-slate-300">-</span>}</td>);
    }

    if (col.key === 'asuntoRemitente') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>
          {value ? <span className="inline-flex items-center gap-1.5"><User className="size-3 text-[#bc955c] shrink-0" />{value}</span> : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'unidadArea') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>
          {value ? <span className="inline-flex items-center gap-1.5"><Building2 className="size-3 text-[#bc955c] shrink-0" />{value}</span> : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>{value || <span className="text-slate-300">-</span>}</td>);
  };

  const chartData = distribucionPorStatus.map((s) => {
    const config = getStatusConfig(s.statusTurnado);
    return { label: s.statusTurnado, count: s.cantidad, percent: s.porcentaje / 100, color: config.color };
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-10 pb-0 font-sans">
        {isPreviewing && (
          <div className="fixed inset-0 z-[100000] bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-[#621f32] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">Generando Vista Previa...</span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedItem && (
            <DetailModal
              item={selectedItem}
              expediente={expedienteData}
              isLoading={isLoadingExpediente}
              pdfUrl={currentPdfUrl}
              isPreviewing={isPreviewing}
              onPreview={handlePreviewDocument}
              onUpdate={handleUpdateClasificacion}
              onNext={handleNextItem}
              onPrevious={handlePreviousItem}
              hasNext={currentIndex < filteredSortedData.length - 1}
              hasPrevious={currentIndex > 0}
              onClose={() => { setSelectedItem(null); setExpedienteData(null); setCurrentPdfUrl(null); }}
            />
          )}
        </AnimatePresence>

        <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 pt-3 md:pt-8 gap-2">
          <Zoom triggerOnce>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-4">
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <div className="flex items-start sm:items-center gap-6">
                  <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <ClipboardList className="size-8 sm:size-10 text-white" />
                  </div>
                  <div className="max-w-screen-md">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
                      Oficios Turnados a <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">DO</span>
                    </h2>
                    <p className="hidden md:block mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                      Seguimiento, clasificación y estatus de los oficios turnados a la Dirección de Organización.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Zoom>
        </div>

        <div className="w-full px-4 lg:px-6">
          <Zoom triggerOnce>
            <div className="flex flex-col lg:flex-row gap-3 mb-6 items-stretch">
              <div className="lg:w-56 shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-3 w-full text-center">Distribución de Estatus</h3>
                <div className="relative size-24 flex items-center justify-center">
                  <PieChart data={chartData} size={96} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total</span>
                    <span className="text-lg font-black text-gray-800 dark:text-white tracking-tighter tabular-nums leading-none">{detalleTurnados.length}</span>
                  </div>
                </div>
              </div>

              {distribucionPorStatus.map((status) => {
                const config = getStatusConfig(status.statusTurnado);
                const StatusIcon = getStatusIcon(status.statusTurnado);
                const isSelected = columnFilters.statusTurnado?.includes(status.statusTurnado);
                const hasStatusFilter = !!columnFilters.statusTurnado?.length;
                return (
                  <motion.div
                    key={status.statusTurnado}
                    onClick={() => handleStatusBadgeClick(status.statusTurnado)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`flex-1 min-w-0 rounded-xl px-3 py-3 border-2 transition-all duration-200 shadow-sm flex flex-col justify-between group cursor-pointer relative overflow-hidden ${isSelected ? 'border-[#621f32] dark:border-[#bc955c] shadow-md bg-white dark:bg-slate-900' : hasStatusFilter ? 'border-slate-200/50 dark:border-slate-800/80 opacity-55 hover:opacity-85 bg-white/60 dark:bg-slate-900/60' : 'border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 hover:border-[#621f32]/30'}`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-20">
                        <span className="relative flex size-1.5 rounded-full" style={{ backgroundColor: config.color }}>
                          <span className="animate-ping absolute inline-flex size-1.5 rounded-full opacity-75" style={{ backgroundColor: config.color }} />
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config.color}15`, color: config.color }}>
                        <StatusIcon className="size-3.5" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500 truncate">{status.statusTurnado}</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{status.cantidad}</h4>
                      <div className="w-full bg-slate-100 dark:bg-slate-800/60 h-1 rounded-full overflow-hidden mt-2">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: config.color }} initial={{ width: 0 }} animate={{ width: `${status.porcentaje}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 mt-1">{status.porcentaje}%</p>
                    </div>
                  </motion.div>
                );
              })}

              <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                onClick={() => setColumnFilters((prev) => { const next = { ...prev }; delete next.statusTurnado; return next; })}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={`lg:w-56 shrink-0 bg-gradient-to-br from-[#621f32] via-[#4d1827] to-[#bc955c] rounded-xl px-3 py-3 shadow-md flex flex-col justify-between text-white relative overflow-hidden group cursor-pointer transition-all duration-200 ${!columnFilters.statusTurnado?.length ? 'ring-2 ring-white/30 shadow-lg' : ''}`}
              >
                <div className="absolute -top-8 -right-8 size-24 bg-[#bc955c]/15 rounded-full blur-xl group-hover:bg-[#bc955c]/25 transition-colors duration-300 pointer-events-none" />
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-white/10 text-white rounded-lg flex items-center justify-center flex-shrink-0"><ClipboardList className="size-3.5" /></div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/70 truncate">Total de Oficios</span>
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tight text-white leading-none">{detalleTurnados.length}</h4>
                  <div className="w-full bg-white/15 h-1 rounded-full overflow-hidden mt-2"><div className="h-full bg-white/60 rounded-full w-full" /></div>
                  <p className="text-[8px] font-bold text-white/60 mt-1">100%</p>
                </div>
              </motion.div>
            </div>
          </Zoom>
        </div>

        <div className="w-full space-y-6">
          <div className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-y border-x-0 border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-none overflow-hidden flex flex-col w-full">

            <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-stretch sm:items-center">
                <div className="relative w-full sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar en la tabla..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-white text-xs font-bold w-full outline-none placeholder:text-slate-400"
                  />
                  {globalSearch && (
                    <button onClick={() => setGlobalSearch('')} className="text-slate-400 hover:text-slate-650 ml-1.5 cursor-pointer">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none tabular-nums">{filteredSortedData.length}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={resetAllFilters}
                    className="flex items-center gap-2 px-5 py-3 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 bg-white/80 dark:bg-slate-900/85 hover:bg-red-50/50 dark:hover:bg-red-950/10 text-slate-650 dark:text-slate-300 hover:text-red-750 font-black rounded-xl text-[10px] uppercase transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <X className="size-3.5" />
                    <span>Limpiar Filtros</span>
                  </button>
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <DataTable
                containerRef={tableContainerRef}
                tbodyRef={tbodyRef}
                onScroll={setScrollTop}
                edgeToEdge
                stickyColumnKeys={['asuntoNoOficio']}
                columns={columns}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                textFilters={textFilters}
                setTextFilters={setTextFilters}
                activeConditionDropdown={activeConditionDropdown}
                setActiveConditionDropdown={setActiveConditionDropdown}
                selectedCell={selectedCell}
                onSelectCell={setSelectedCell}
                onCellContextMenu={openContextMenu}
                onShowRecord={handleSelectItem}
                sortConfig={sortConfig}
                onSort={handleSort}
                onOpenFilter={openFilterDropdown}
                onResizeStart={handleResizeStart}
                onResizeReset={resetWidth}
                getColumnLetter={getColumnLetter}
                isMonoColumn={isMonoColumn}
                isPending={false}
                isLoading={false}
                data={paginatedData}
                startIndex={startIndex}
                endIndex={endIndex}
                totalCount={filteredSortedData.length}
                rowHeight={ROW_HEIGHT}
                getRowId={(row) => row.idTurnado}
                renderCell={renderCell}
              />
            </div>

            <div className="md:hidden">
              <MobileCardList
                data={filteredSortedData}
                config={{
                  getRowId: (r, i) => r.idTurnado ?? i,
                  getTitle: (r) => r.asuntoNoOficio || 'Sin oficio',
                  getSubtitle: (r) => (r.asuntoFolio ? `Folio ${r.asuntoFolio}` : ''),
                  renderBadge: (r) => {
                    const c = getStatusConfig(r.statusTurnado);
                    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black uppercase bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"><span className="size-1.5 rounded-full" style={c?.styleDot} />{r.statusTurnado}</span>;
                  },
                  fields: [
                    { key: 'asuntoTema', label: 'Tema' },
                    { key: 'asuntoRemitente', label: 'Remitente' },
                    { key: 'unidadArea', label: 'Unidad' },
                    { key: 'asuntoPrioridad', label: 'Prioridad' },
                    { key: 'instruccion', label: 'Instrucción' },
                    { label: 'Fecha', render: (r) => formatDateEsMx(r.fechaRegistro) },
                  ],
                }}
                onCardClick={(row) => handleSelectItem(row)}
              />
            </div>

            {filteredSortedData.length === 0 && (
              <div className="hidden md:flex p-24 flex-col items-center justify-center text-slate-300 gap-6">
                <div className="p-8 bg-white/20 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Filter className="size-16 opacity-10" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Sin resultados para los filtros</p>
                  <button onClick={resetAllFilters} className="mt-4 text-[10px] font-black text-[#621f32] dark:text-[#bc955c] uppercase underline underline-offset-4 cursor-pointer">Limpiar todos los filtros</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={COLUMNS.find((c) => c.key === activeFilterDropdown)?.label}
            isDate={false}
            data={tableData}
            getCellValue={getCellValue}
            filters={filters}
            dropdownValues={filterDropdownValues}
            reachableValues={reachableValues}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>

      <CopyCellMenu contextMenu={contextMenu} onClose={closeContextMenu} />
    </TooltipProvider>
  );
}
