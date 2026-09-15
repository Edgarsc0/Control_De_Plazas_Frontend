'use client';

import React, { useState, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Paperclip,
  Loader2,
  Search,
  X,
  Filter,
  Eye,
  Table as TableIcon,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import DetailModal from '@/components/shared/OficioDetailModal';
import ValuacionGuardadaModal from '@/app/dashboard/valuacion_presupuestaria/_components/ValuacionGuardadaModal';
import AdjuntarResolucionModal from './AdjuntarResolucionModal';
import AdjuntarNotificacionOcupacionModal from './AdjuntarNotificacionOcupacionModal';
import MobileCardList from '@/components/ui/MobileCardList';
import { ControlGestionService } from '@/services/control_gestion.service';
import { useAsuntosValuacionData, tieneValuacion } from '@/app/dashboard/valuacion_presupuestaria/_hooks/useAsuntosValuacionData';
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

// Igual criterio que en AsuntosValuacion.jsx: el folio vive como sub-texto
// dentro de la celda "No. Oficio", no como columna propia.
const TEXT_FILTER_COLUMNS = { asuntoNoOficio: ['asuntoNoOficio', 'asuntoFolio'] };
const getTextFilterKeys = (colKey) => TEXT_FILTER_COLUMNS[colKey] || [colKey];

const COLUMNS = [
  { key: 'asuntoNoOficio', label: 'No. Oficio / Folio', width: 190, visible: true },
  { key: 'asuntoRemitente', label: 'Remitente', width: 190, visible: true },
  { key: 'asuntoRemitenteDependencia', label: 'Dependencia Remitente', width: 210, visible: true },
  { key: 'asuntoDescripcion', label: 'Descripción', width: 300, visible: true },
  { key: 'asuntoTema', label: 'Tema', width: 180, visible: true },
  { key: 'statusTurnado', label: 'Estado Oficio', width: 140, visible: true },
  { key: 'fechaRegistro', label: 'Fecha Registro', width: 125, visible: true },
  { key: 'estatusValuacionLabel', label: 'Estatus Valuación', width: 155, visible: true },
  { key: 'resolucionLabel', label: 'Resolución', width: 125, visible: true },
  { key: 'notificacionOcupacionLabel', label: 'Oficio de Notificación de Ocupación', width: 190, visible: true },
  { key: 'acciones', label: 'Acciones', width: 90, visible: true, noFilter: true },
];

const getColumnLetter = (colIdx) => {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// Tabla de oficios marcados como "Solicitud de Ocupación de Plazas de Nueva
// Creación" (CatTipoAsunto id=1) enfocada en el trámite posterior a la
// valuación: adjuntar Resolución y, si procede, el Oficio de Notificación de
// Ocupación. El simulador/valuación en sí vive en valuacion_presupuestaria —
// ambas vistas comparten el mismo universo de datos vía useAsuntosValuacionData.
export default function SolicitudesOcupacionTable() {
  const router = useRouter();
  const { asuntos, setAsuntos, loading, reload } = useAsuntosValuacionData();

  // Modal de expediente
  const [selectedItem, setSelectedItem] = useState(null);
  const [expedienteData, setExpedienteData] = useState(null);
  const [isLoadingExpediente, setIsLoadingExpediente] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState(null);

  // Valuación previamente guardada desde el simulador
  const [valuacionAbierta, setValuacionAbierta] = useState(null);

  // Adjuntar resolución (status + PDF) de un asunto
  const [adjuntarResolucionAsunto, setAdjuntarResolucionAsunto] = useState(null);

  // Adjuntar oficio de notificación de ocupación (sólo asuntos Procedente)
  const [adjuntarNotificacionAsunto, setAdjuntarNotificacionAsunto] = useState(null);

  const tableContainerRef = useRef(null);
  const tbodyRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const { columns, setColumns, resetWidth } = useColumnState(COLUMNS, 'ocupacion_solicitudes_columns');
  const [sortConfig, setSortConfig] = usePersistedState('ocupacion_solicitudes_sort', { key: null, direction: null });
  const { selectedCell, setSelectedCell, contextMenu, openContextMenu, closeContextMenu } = useCellSelection();
  const filters = useColumnFilters({ storageKey: 'ocupacion_solicitudes_filters' });
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

  // Aplana `oficioInfo` y deriva las etiquetas de estatus a nivel de fila —
  // mismo criterio que AsuntosValuacion.jsx.
  const tableData = useMemo(() => asuntos.map((item) => {
    const oInfo = item.oficioInfo || {};
    const s = item.status?.toLowerCase() || 'pendiente';
    const estatusValuacionLabel = s === 'procedente' ? 'Procedente' : s === 'improcedente' ? 'Improcedente' : 'Pendiente';
    return {
      ...item,
      asuntoNoOficio: oInfo.asuntoNoOficio || '',
      asuntoFolio: oInfo.asuntoFolio || '',
      asuntoRemitente: oInfo.asuntoRemitente || '',
      asuntoRemitenteDependencia: oInfo.asuntoRemitenteDependencia || '',
      asuntoDescripcion: oInfo.asuntoDescripcion || '',
      asuntoTema: oInfo.asuntoTema || '',
      statusTurnado: oInfo.statusTurnado || '',
      fechaRegistro: oInfo.fechaRegistro || '',
      estatusValuacionLabel,
      resolucionLabel: item.oficio_resolucion ? 'Con resolución' : 'Sin resolución',
      // El oficio de notificación de ocupación sólo aplica a asuntos ya
      // dictaminados como Procedente — en el resto ni se pide ni se muestra.
      notificacionOcupacionLabel: estatusValuacionLabel !== 'Procedente'
        ? 'No aplica'
        : (item.oficio_notificacion_ocupacion ? 'Con oficio' : 'Sin oficio'),
    };
  }), [asuntos]);

  // El backend no devuelve `oficioInfo` (lo arma useAsuntosValuacionData al
  // cargar), así que se conserva el que ya tenía la fila en memoria.
  // Compartido por `AdjuntarResolucionModal` y `AdjuntarNotificacionOcupacionModal`:
  // ambos sólo hacen PATCH parcial sobre el mismo `AsuntoValuacion`.
  const handleAsuntoActualizado = (asuntoActualizado) => {
    setAsuntos((prev) => prev.map((a) => (
      a.id === asuntoActualizado.id ? { ...a, ...asuntoActualizado, oficioInfo: a.oficioInfo } : a
    )));
  };

  const handleSelectItem = async (item) => {
    if (!item) return;
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

  // Mismo predicado reusado por los datos mostrados y por el universo
  // "alcanzable" de un dropdown de columna (ver oficios_turnados_do).
  const rowPassesFilters = useCallback((row, { excludeColKey = null } = {}) => {
    if (deferredGlobalSearch) {
      const searchText = normalizeForSearch(deferredGlobalSearch);
      const hit = Object.values(row).some((val) => {
        if (val && typeof val === 'object') return false;
        return normalizeForSearch(String(val ?? '')).includes(searchText);
      });
      if (!hit) return false;
    }
    for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
      if (colKey === excludeColKey) continue;
      const rowVal = getCellValue(row, colKey);
      if (!selectedVals.includes(rowVal)) return false;
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
    const counts = {};
    tableData.forEach((row) => {
      if (!rowPassesFilters(row, { excludeColKey: activeFilterDropdown })) return;
      const val = getCellValue(row, activeFilterDropdown);
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }, [activeFilterDropdown, tableData, rowPassesFilters, getCellValue]);
  const reachableValues = useMemo(() => Object.keys(reachableCounts), [reachableCounts]);

  const uniqueColumnValues = useMemo(() => {
    if (!activeFilterDropdown) return [];
    return getUniqueColumnValues(tableData, activeFilterDropdown, getCellValue);
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
    const reachableVals = [...new Set(
      tableData.filter((row) => rowPassesFilters(row, { excludeColKey: colKey })).map((row) => getCellValue(row, colKey)),
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
    return filteredSortedData.findIndex((row) => row.oficioInfo?.idTurnado === selectedItem?.idTurnado);
  }, [filteredSortedData, selectedItem]);

  const handleNextItem = () => {
    if (currentIndex < filteredSortedData.length - 1) handleSelectItem(filteredSortedData[currentIndex + 1].oficioInfo);
  };
  const handlePreviousItem = () => {
    if (currentIndex > 0) handleSelectItem(filteredSortedData[currentIndex - 1].oficioInfo);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + CONTAINER_HEIGHT) / ROW_HEIGHT) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    const baseTdClass = `px-4 text-xs border-r truncate h-[37px] align-middle ${
      isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]' : (isSticky ? 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300' : 'bg-white/10 text-slate-700 dark:text-slate-300')
    } ${isMonoColumn(col.key) ? 'font-mono font-bold' : 'font-semibold'}`;
    const cellBgClass = isSelected ? 'bg-white ring-2 ring-[#621f32] z-10 shadow-md' : (isSticky ? 'bg-white dark:bg-slate-950' : 'bg-white/10');

    if (col.key === 'asuntoNoOficio') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 border-r h-[37px] align-middle ${cellBgClass}`}>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 truncate">{value || <span className="text-slate-300">-</span>}</span>
            <span className="text-[9px] font-bold text-slate-400 truncate">Folio {row.asuntoFolio || 'N/A'}</span>
          </div>
        </td>
      );
    }

    if (col.key === 'asuntoRemitente') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>
          {value ? <span className="inline-flex items-center gap-1.5"><User className="size-3 text-[#bc955c] shrink-0" />{value}</span> : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'asuntoRemitenteDependencia') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>
          {value ? <span className="inline-flex items-center gap-1.5"><Building2 className="size-3 text-[#bc955c] shrink-0" />{value}</span> : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'asuntoDescripcion') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass} title={value || 'Sin descripción'}>
          {value || <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'fechaRegistro') {
      return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>{formatDateEsMx(row.fechaRegistro) || <span className="text-slate-300">-</span>}</td>);
    }

    if (col.key === 'estatusValuacionLabel') {
      const valuada = tieneValuacion(row);
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${cellBgClass}`}>
          {valuada ? (
            <button
              onClick={(e) => { e.stopPropagation(); setValuacionAbierta(row); }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border border-[#621f32]/20 bg-[#621f32]/5 text-[#621f32] dark:text-[#bc955c] dark:bg-[#bc955c]/10 dark:border-[#bc955c]/25 hover:bg-[#621f32] hover:text-white dark:hover:bg-[#bc955c] dark:hover:text-[#3e131f] transition-all cursor-pointer"
              title="Ver la valuación guardada"
            >
              <TableIcon className="size-2.5" />
              Valuada
              {row.valuacion?.guardado_en && (
                <span className="font-bold opacity-70 normal-case">· {new Date(row.valuacion.guardado_en).toLocaleDateString('es-MX')}</span>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/valuacion_presupuestaria?asuntoId=${row.id}`); }}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] uppercase hover:underline cursor-pointer transition-colors"
              title="Realizar la valuación de este asunto en el simulador"
            >
              <Calculator className="size-3" /> Realizar valuación
            </button>
          )}
        </td>
      );
    }

    if (col.key === 'resolucionLabel') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${cellBgClass}`}>
          {row.oficio_resolucion ? (
            <a
              href={row.oficio_resolucion}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase hover:underline w-fit"
              title="Abrir la resolución (PDF)"
            >
              {row.estatusValuacionLabel}
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAdjuntarResolucionAsunto(row); }}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] uppercase hover:underline cursor-pointer transition-colors"
              title="Adjuntar la resolución (Procedente/Improcedente) de este asunto"
            >
              <Paperclip className="size-3" /> Adjuntar PDF
            </button>
          )}
        </td>
      );
    }

    if (col.key === 'notificacionOcupacionLabel') {
      const esProcedente = row.estatusValuacionLabel === 'Procedente';
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${cellBgClass}`}>
          {!esProcedente ? (
            <span className="text-slate-300 dark:text-slate-700">No aplica</span>
          ) : row.oficio_notificacion_ocupacion ? (
            <a
              href={row.oficio_notificacion_ocupacion}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#bc955c] uppercase hover:underline"
            >
              <Paperclip className="size-3" /> Ver
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setAdjuntarNotificacionAsunto(row); }}
              className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] uppercase hover:underline cursor-pointer transition-colors"
              title="Adjuntar el oficio de notificación de ocupación de este asunto"
            >
              <Paperclip className="size-3" /> Adjuntar PDF
            </button>
          )}
        </td>
      );
    }

    if (col.key === 'statusTurnado') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-4 text-xs border-r h-[37px] align-middle ${cellBgClass}`}>
          {value ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-black text-[10px] uppercase text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">{value}</span>
          ) : <span className="text-slate-300">-</span>}
        </td>
      );
    }

    if (col.key === 'acciones') {
      return (
        <td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={`px-2 border-r h-[37px] align-middle ${cellBgClass}`}>
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleSelectItem(row.oficioInfo)} title="Ver expediente" className="text-black dark:text-white hover:opacity-50 transition-opacity cursor-pointer">
              <Eye className="size-3.5" />
            </button>
          </div>
        </td>
      );
    }

    return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} style={stickyStyle} className={baseTdClass}>{value || <span className="text-slate-300">-</span>}</td>);
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      {isPreviewing && (
        <div className="fixed inset-0 z-[100000] bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#621f32] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">Generando Vista Previa...</span>
          </div>
        </div>
      )}

      {valuacionAbierta && (
        <ValuacionGuardadaModal
          valuacion={valuacionAbierta.valuacion}
          oficioInfo={valuacionAbierta.oficioInfo || {}}
          onClose={() => setValuacionAbierta(null)}
        />
      )}

      {adjuntarResolucionAsunto && (
        <AdjuntarResolucionModal
          asunto={adjuntarResolucionAsunto}
          onClose={() => setAdjuntarResolucionAsunto(null)}
          onSaved={handleAsuntoActualizado}
        />
      )}

      {adjuntarNotificacionAsunto && (
        <AdjuntarNotificacionOcupacionModal
          asunto={adjuntarNotificacionAsunto}
          onClose={() => setAdjuntarNotificacionAsunto(null)}
          onSaved={handleAsuntoActualizado}
        />
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
            onUpdate={reload}
            onNext={handleNextItem}
            onPrevious={handlePreviousItem}
            hasNext={currentIndex < filteredSortedData.length - 1}
            hasPrevious={currentIndex > 0}
            onClose={() => {
              setSelectedItem(null);
              setExpedienteData(null);
              if (currentPdfUrl) window.URL.revokeObjectURL(currentPdfUrl);
              setCurrentPdfUrl(null);
            }}
          />
        )}
      </AnimatePresence>

      <div className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-y border-x-0 border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-none overflow-hidden flex flex-col w-full flex-1 min-h-0">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-stretch sm:items-center">
            <div className="relative w-full sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
              <Search className="text-slate-400 size-4 mr-2.5" />
              <input
                type="text"
                placeholder="Buscar por folio, oficio o remitente..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                disabled={loading}
                className="bg-transparent text-slate-800 dark:text-white text-xs font-bold w-full outline-none placeholder:text-slate-400 disabled:opacity-60"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')} className="text-slate-400 hover:text-red-500 ml-1.5 cursor-pointer">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Registros</span>
              <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none tabular-nums">{filteredSortedData.length}</span>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-2 px-5 py-3 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-900/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-xl text-[10px] uppercase transition-all duration-300 shadow-sm active:scale-95 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Restablecer Filtros</span>
            </button>
          )}
        </div>

        <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
          <DataTable
            containerRef={tableContainerRef}
            tbodyRef={tbodyRef}
            onScroll={setScrollTop}
            fillHeight
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
            onShowRecord={(row) => handleSelectItem(row.oficioInfo)}
            sortConfig={sortConfig}
            onSort={handleSort}
            onOpenFilter={openFilterDropdown}
            onResizeStart={handleResizeStart}
            onResizeReset={resetWidth}
            getColumnLetter={getColumnLetter}
            isMonoColumn={isMonoColumn}
            isPending={false}
            isLoading={loading}
            loadingVariant="skeleton"
            loadingMessage="Cargando solicitudes de ocupación..."
            data={paginatedData}
            startIndex={startIndex}
            endIndex={endIndex}
            totalCount={filteredSortedData.length}
            rowHeight={ROW_HEIGHT}
            getRowId={(row) => row.id}
            renderCell={renderCell}
          />
        </div>

        <div className="md:hidden">
          <MobileCardList
            data={filteredSortedData}
            config={{
              getRowId: (r, i) => r.id ?? i,
              getTitle: (r) => r.asuntoNoOficio || 'Sin oficio',
              getSubtitle: (r) => (r.asuntoFolio ? `Folio ${r.asuntoFolio}` : ''),
              fields: [
                { key: 'asuntoRemitente', label: 'Remitente' },
                { key: 'asuntoRemitenteDependencia', label: 'Dependencia' },
                { key: 'estatusValuacionLabel', label: 'Estatus Valuación' },
                { key: 'resolucionLabel', label: 'Resolución' },
                { key: 'notificacionOcupacionLabel', label: 'Notificación de Ocupación' },
                { label: 'Fecha', render: (r) => formatDateEsMx(r.fechaRegistro) },
              ],
            }}
            isLoading={loading}
            onCardClick={(row) => handleSelectItem(row.oficioInfo)}
          />
        </div>

        {!loading && filteredSortedData.length === 0 && (
          <div className="p-24 flex flex-col items-center justify-center text-gray-300 dark:text-slate-700 gap-6">
            <div className="p-8 bg-white/20 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-slate-800">
              <Filter className="size-16 opacity-10" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Sin resultados de solicitudes</p>
              {hasActiveFilters && (
                <button onClick={resetAllFilters} className="mt-4 text-[10px] font-black text-[#621f32] dark:text-[#bc955c] uppercase underline underline-offset-4 cursor-pointer">Limpiar filtros</button>
              )}
            </div>
          </div>
        )}
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
    </div>
  );
}
