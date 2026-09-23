'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { RotateCcw, Search, X } from 'lucide-react';
import DataTable from '../../plantilla_empleados/_components/shared/DataTable';
import ColumnFilterDropdown from '../../plantilla_empleados/_components/shared/ColumnFilterDropdown';
import CopyCellMenu from '../../plantilla_empleados/_components/shared/CopyCellMenu';
import {
    animateColumnWidth,
    killColumnWidthAnimation,
} from '../../plantilla_empleados/_components/shared/columnResize';
import { useColumnState } from '../../plantilla_empleados/_hooks/useColumnState';
import {
    useCellSelection,
    useClearSelectionOnFilterChange,
} from '../../plantilla_empleados/_hooks/useCellSelection';
import { usePersistedState } from '../../plantilla_empleados/_hooks/usePersistedState';
import { useColumnFilters } from '../../plantilla_empleados/_hooks/useColumnFilters';
import {
    applyColumnFilters,
    getUniqueColumnValues,
    matchesTextCondition,
    finalizeFilterDropdownValues,
    resolveColumnFilterCommit,
} from '@/utils/columnFilters';

export const ROW_HEIGHT = 37;
const TABLE_HEADER_PX = 100;

const noopScroll = () => {};

const defaultGetCellValue = (row, key) => {
    const v = row?.[key];
    return v === null || v === undefined ? '' : String(v);
};

/** Clases base de un `<td>` de la tabla, alineadas con el resto de tabs de DataTable. */
export function cellClassName({ isSelected, mono = false, muted = false }) {
    return `px-4 text-xs border-r h-[37px] align-middle truncate ${
        isSelected
            ? 'bg-white dark:bg-slate-900 ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32] dark:text-[#bc955c]'
            : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300'
    } ${mono ? 'font-mono font-bold' : 'font-semibold'} ${muted ? 'text-slate-400 dark:text-slate-500' : ''}`;
}

/**
 * Envoltorio de `DataTable` para las tablas administrativas de Roles/Usuarios:
 * cablea de una vez búsqueda global, filtros por columna (texto + dropdown estilo
 * Excel), orden, resize, selección de celda y menú de copiar, para que cada tab
 * sólo declare columnas, filas planas (una clave por columna) y `renderCell`.
 * Sin virtualización ni paginación: son decenas de filas, la tabla hace scroll.
 */
export default function AdminDataGrid({
    storageKey,
    columns: initialColumns,
    rows,
    getRowId,
    renderCell,
    renderRowAction,
    onRowClick,
    stickyColumnKeys = null,
    rowActionHeaderLabel = '',
    getCellValue = defaultGetCellValue,
    monoKeys = [],
    isLoading = false,
    loadingMessage = 'Cargando...',
    searchPlaceholder = 'Buscar...',
    toolbarLeft = null,
    toolbarRight = null,
    hasExternalFilters = false,
    onResetExternalFilters,
    entityLabel = 'registro',
    entityLabelPlural = `${entityLabel}s`,
}) {
    const [sortConfig, setSortConfig] = usePersistedState(`${storageKey}_sort`, { key: null, direction: null });
    const { columns, setColumns, resetWidth } = useColumnState(initialColumns, `${storageKey}_columns`);
    const tableContainerRef = useRef(null);
    // DataTable oculta (`invisible`) las filas del primer render si nace con
    // isLoading=false y espera a que la cascada GSAP las revele; con datos ya
    // en memoria esa revelada no las muestra. Arrancar en "cargando" un tick
    // lo deja en el camino de los tabs con fetch cliente.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const { selectedCell, setSelectedCell, contextMenu, setContextMenu } = useCellSelection();

    const filters = useColumnFilters({ storageKey: `${storageKey}_filters` });
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

    useClearSelectionOnFilterChange(setSelectedCell, [
        columnFilters, textFilters, globalSearch, sortConfig.key, sortConfig.direction, rows,
    ]);

    const isMonoColumn = useCallback((key) => monoKeys.includes(key), [monoKeys]);

    const filteredData = useMemo(
        () => applyColumnFilters(rows, { globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn }),
        [rows, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]
    );

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return filteredData;
        const { key, direction } = sortConfig;
        return [...filteredData].sort((a, b) => {
            const av = getCellValue(a, key);
            const bv = getCellValue(b, key);
            if (av === bv) return 0;
            if (av === '') return 1;
            if (bv === '') return -1;
            const cmp = av.localeCompare(bv, undefined, { numeric: true });
            return direction === 'asc' ? cmp : -cmp;
        });
    }, [filteredData, sortConfig, getCellValue]);

    const handleSort = useCallback((key) => {
        setSortConfig((prev) => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    }, [setSortConfig]);

    const getColumnLetter = useCallback((index) => {
        let temp = index;
        let letter = '';
        while (temp >= 0) {
            letter = String.fromCharCode((temp % 26) + 65) + letter;
            temp = Math.floor(temp / 26) - 1;
        }
        return letter;
    }, []);

    const handleResizeStart = (e, index, direction = 'right') => {
        e.preventDefault();
        const target = columns[index];
        const startX = e.clientX;
        const startWidth = target.width;
        let latestWidth = startWidth;
        const onMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            latestWidth = Math.max(60, direction === 'left' ? startWidth - deltaX : startWidth + deltaX);
            if (!animateColumnWidth(tableContainerRef, target.key, latestWidth)) {
                setColumns((prev) => prev.map((c) => (c.key === target.key ? { ...c, width: latestWidth } : c)));
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            killColumnWidthAnimation(tableContainerRef, target.key);
            setColumns((prev) => prev.map((c) => (c.key === target.key ? { ...c, width: latestWidth } : c)));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // Valores alcanzables de una columna dado el resto de filtros (todos menos el
    // propio) — alimenta el conteo dinámico del dropdown.
    const computeReachableValues = useCallback((colKey) => {
        const { [colKey]: _cf, ...otherColumnFilters } = columnFilters;
        const { [colKey]: _tf, ...otherTextFilters } = textFilters;
        const reachable = applyColumnFilters(rows, {
            globalSearch, columnFilters: otherColumnFilters, textFilters: otherTextFilters, getCellValue, isMonoColumn,
        });
        return getUniqueColumnValues(reachable, colKey, getCellValue);
    }, [rows, globalSearch, columnFilters, textFilters, getCellValue, isMonoColumn]);

    const openFilterDropdown = (colKey) => {
        if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
        setActiveFilterDropdown(colKey);
        setFilterSearchText('');
        setTempSelectedValues(columnFilters[colKey] || computeReachableValues(colKey).map((v) => v.value));
    };

    const dropdownUniqueValues = useMemo(
        () => (activeFilterDropdown ? getUniqueColumnValues(rows, activeFilterDropdown, getCellValue) : []),
        [activeFilterDropdown, rows, getCellValue]
    );
    const reachableList = useMemo(
        () => (activeFilterDropdown ? computeReachableValues(activeFilterDropdown) : []),
        [activeFilterDropdown, computeReachableValues]
    );
    const reachableValues = useMemo(() => reachableList.map((v) => v.value), [reachableList]);
    const reachableCounts = useMemo(
        () => Object.fromEntries(reachableList.map((v) => [v.value, v.count])),
        [reachableList]
    );

    const applyColumnFilter = (colKey) => {
        const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
        setColumnFilters((prev) => {
            const next = { ...prev };
            if (shouldClear) delete next[colKey];
            else next[colKey] = valuesToCommit;
            return next;
        });
        setActiveFilterDropdown(null);
    };

    const clearColumnFilter = (colKey) => {
        setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
        setActiveFilterDropdown(null);
    };

    const filterDropdownValues = useMemo(() => {
        if (!activeFilterDropdown) {
            return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
        }
        const base = dropdownUniqueValues.map((v) => ({ ...v, count: reachableCounts[v.value] ?? 0 }));
        const filtered = base.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
        return finalizeFilterDropdownValues({
            baseUniqueValues: base,
            filtered,
            tempSelectedValues,
            committedSelectedValues: columnFilters[activeFilterDropdown] || [],
            reachableValues,
        });
    }, [activeFilterDropdown, dropdownUniqueValues, reachableValues, reachableCounts, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

    useEffect(() => {
        document.body.style.overflow = activeFilterDropdown ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [activeFilterDropdown]);

    // Alto proporcional a las filas: encabezado (~100px, 2 filas) + filas de
    // ROW_HEIGHT; con 0 filas deja lugar al mensaje de "sin coincidencias".
    const tableHeightPx = TABLE_HEADER_PX + Math.max(sortedData.length, 3) * ROW_HEIGHT + 2;

    const hasActiveFilters =
        !!globalSearch ||
        Object.keys(columnFilters).length > 0 ||
        Object.values(textFilters).some((f) => f?.value) ||
        hasExternalFilters;

    const resetAll = () => {
        setGlobalSearch('');
        setColumnFilters({});
        setTextFilters({});
        setActiveFilterDropdown(null);
        setActiveConditionDropdown(null);
        onResetExternalFilters?.();
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                    <input
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#621f32]/15 focus:border-[#621f32]/40 transition-all"
                    />
                    {globalSearch && (
                        <button
                            onClick={() => setGlobalSearch('')}
                            aria-label="Limpiar búsqueda"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
                {toolbarLeft}
                <button
                    onClick={resetAll}
                    disabled={!hasActiveFilters}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                    <RotateCcw className="size-3" /> Reiniciar filtros
                </button>
                <span className="ml-auto text-xs font-bold text-slate-400 whitespace-nowrap">
                    {sortedData.length === rows.length
                        ? `${rows.length} ${rows.length === 1 ? entityLabel : entityLabelPlural}`
                        : `${sortedData.length} de ${rows.length} ${entityLabelPlural}`}
                </span>
                {toolbarRight}
            </div>

            <div className="flex flex-col" style={{ height: `min(${tableHeightPx}px, calc(100vh - 340px), 720px)` }}>
                <DataTable
                    containerRef={tableContainerRef}
                    fillHeight
                    fillWidth
                    glassHeader
                    edgeToEdge
                    onScroll={noopScroll}
                    columns={columns}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    textFilters={textFilters}
                    setTextFilters={setTextFilters}
                    activeConditionDropdown={activeConditionDropdown}
                    setActiveConditionDropdown={setActiveConditionDropdown}
                    selectedCell={selectedCell}
                    onSelectCell={setSelectedCell}
                    onCellContextMenu={(e, value, rect) => setContextMenu({ x: e.clientX, y: e.clientY, value, rect })}
                    onRowClick={onRowClick ? (idx) => onRowClick(sortedData[idx]) : undefined}
                    renderRowAction={renderRowAction}
                    stickyColumnKeys={stickyColumnKeys}
                    rowActionHeaderLabel={rowActionHeaderLabel}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onOpenFilter={openFilterDropdown}
                    onResizeStart={handleResizeStart}
                    onResizeReset={(index) => resetWidth(columns[index]?.key)}
                    getColumnLetter={getColumnLetter}
                    isMonoColumn={isMonoColumn}
                    isPending={false}
                    isLoading={isLoading || !mounted}
                    loadingVariant="skeleton"
                    loadingMessage={loadingMessage}
                    data={sortedData}
                    startIndex={0}
                    endIndex={sortedData.length}
                    totalCount={sortedData.length}
                    rowHeight={ROW_HEIGHT}
                    getRowId={getRowId}
                    renderCell={renderCell}
                    enableKeyboardNav
                    onEscape={() => setContextMenu(null)}
                />
            </div>

            <AnimatePresence>
                {activeFilterDropdown && (
                    <ColumnFilterDropdown
                        open={!!activeFilterDropdown}
                        columnKey={activeFilterDropdown}
                        columnLabel={initialColumns.find((c) => c.key === activeFilterDropdown)?.label}
                        isDate={false}
                        data={rows}
                        getCellValue={getCellValue}
                        filters={filters}
                        dropdownValues={filterDropdownValues}
                        onApply={() => applyColumnFilter(activeFilterDropdown)}
                        onClear={() => clearColumnFilter(activeFilterDropdown)}
                        onClose={() => setActiveFilterDropdown(null)}
                    />
                )}
            </AnimatePresence>

            <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />
        </div>
    );
}
