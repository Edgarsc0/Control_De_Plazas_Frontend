import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronUp, Settings2, Filter } from 'lucide-react';
import { useEscapeToClose } from '../../../_hooks/useEscapeToClose';
import ColumnFilterDropdown from '../../shared/ColumnFilterDropdown';
import { useColumnFilters } from '../../../_hooks/useColumnFilters';
import {
  applyColumnFilters,
  getUniqueColumnValues,
  matchesTextCondition,
  finalizeFilterDropdownValues,
  defaultGetCellValue,
} from '@/utils/columnFilters';

// El modal ya usa z-[9999999] (debe quedar por encima de otros portales de la
// misma pantalla, p.ej. los dropdowns año/qna de CuadrosVacanciaTab a z-9999).
// ColumnFilterDropdown trae z-[60] por defecto, así que sin este override
// quedaría oculto detrás del propio modal.
const FILTER_DROPDOWN_Z_INDEX_CLASS = 'z-[10000000]';

const ALL_COLUMNS = [
  { key: 'Posición', label: 'Posición', default: true },
  { key: 'Nivel', label: 'Nivel', default: true },
  { key: 'Nombre Puesto Funcional', label: 'Puesto Funcional', default: true },
  { key: 'Unidad de Negocio', label: 'Unidad de Negocio', default: true },
  { key: 'nombre_ua', label: 'Unidad Administrativa', default: true },
  { key: 'Cd UA', label: 'Cód. Unidad Administrativa', default: false },
  { key: 'Id Departamento', label: 'Id Departamento', default: false },
  { key: 'Departamento', label: 'Departamento', default: false },
  { key: 'NJ', label: 'NJ', default: false },
  { key: 'nombreNJ', label: 'Nombre NJ', default: false },
  { key: 'Cd UN', label: 'Cód. Unidad de Negocio', default: false },
  { key: 'Código Presupuestal', label: 'Código Presupuestal', default: false },
  { key: 'Escala', label: 'Escala', default: false },
  { key: 'Partida', label: 'Partida', default: false },
  { key: 'TIPO DE CONTRATACIÓN', label: 'Tipo de Contratación', default: false },
  { key: 'Sindicato', label: 'Sindicato', default: false },
  { key: 'Entidad Federativa', label: 'Entidad Federativa', default: false },
];

// Dynamic width based on column count
function getModalWidth(colCount) {
  if (colCount <= 3) return 'max-w-2xl';
  if (colCount <= 5) return 'max-w-5xl';
  if (colCount <= 7) return 'max-w-7xl';
  return 'max-w-[95vw]';
}

export default function DetalleVacantesModal({ isOpen, onClose, rows = [], title = '' }) {
  useEscapeToClose(isOpen, onClose);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);
  const [sortKey, setSortKey] = useState('Posición');
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleCols, setVisibleCols] = useState(() =>
    ALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [showColMenu, setShowColMenu] = useState(false);

  const filters = useColumnFilters();
  const {
    columnFilters, setColumnFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    filterDropdownTab, setFilterDropdownTab,
    tempSelectedValues, setTempSelectedValues,
    setFilterSearchText,
    filterSearchCondition,
    debouncedFilterSearchText,
    resetFilters,
  } = filters;

  // Nueva consulta (otro cuadro clicado) mientras el modal ya estaba abierto:
  // los filtros de columna de la consulta anterior no deben heredarse.
  useEffect(() => {
    if (isOpen) resetFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, title]);

  const filteredRows = useMemo(
    () => applyColumnFilters(rows, { columnFilters, getCellValue: defaultGetCellValue }),
    [rows, columnFilters]
  );

  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  const sorted = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const va = (a[sortKey] || '').toString();
      const vb = (b[sortKey] || '').toString();
      return sortAsc ? va.localeCompare(vb, undefined, { numeric: true }) : vb.localeCompare(va, undefined, { numeric: true });
    });
  }, [filteredRows, sortKey, sortAsc]);

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
    setActiveFilterDropdown(colKey);
    setFilterDropdownTab('todos');
    setFilterSearchText('');
    const allValues = [...new Set(rows.map((row) => defaultGetCellValue(row, colKey)))];
    setTempSelectedValues(columnFilters[colKey] || allValues);
  };

  const applyColumnFilter = (colKey) => {
    const totalUnique = getUniqueColumnValues(rows, colKey, defaultGetCellValue).map((v) => v.value);
    if (tempSelectedValues.length === totalUnique.length || tempSelectedValues.length === 0) {
      setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    } else {
      setColumnFilters((prev) => ({ ...prev, [colKey]: tempSelectedValues }));
    }
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    setActiveFilterDropdown(null);
  };

  const dropdownUniqueValues = useMemo(() => {
    if (!activeFilterDropdown) return [];
    return getUniqueColumnValues(rows, activeFilterDropdown, defaultGetCellValue);
  }, [activeFilterDropdown, rows]);

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) {
      return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
    }
    let baseUniqueValues = dropdownUniqueValues;
    if (filterDropdownTab === 'actuales') {
      baseUniqueValues = getUniqueColumnValues(filteredRows, activeFilterDropdown, defaultGetCellValue);
    }
    const filteredVals = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered: filteredVals,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
    });
  }, [activeFilterDropdown, dropdownUniqueValues, filterDropdownTab, filteredRows, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleCol = (key) => {
    setVisibleCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const activeCols = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));
  const widthClass = getModalWidth(activeCols.length);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full ${widthClass} max-h-[85vh] flex flex-col transition-all duration-300`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#10243e] to-[#1a3b63] rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-xs text-[#bc955c] font-medium mt-0.5">
              {hasActiveFilters ? `${sorted.length} de ${rows.length} posiciones encontradas` : `${rows.length} posiciones encontradas`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={() => setColumnFilters({})}
                className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-black uppercase tracking-wider text-white transition-colors"
                title="Limpiar filtros de columna"
              >
                Limpiar filtros
              </button>
            )}
            {/* Columnas */}
            <div className="relative">
              <button
                onClick={() => setShowColMenu(!showColMenu)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Mostrar/ocultar columnas"
              >
                <Settings2 className="size-4" />
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 w-56 z-50">
                  <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Columnas visibles
                  </p>
                  <div className="flex gap-1 px-4 py-1.5">
                    <button
                      onClick={() => setVisibleCols(ALL_COLUMNS.map(c => c.key))}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-[#10243e] text-white hover:bg-[#1a3b63] transition-colors"
                    >
                      Marcar todas
                    </button>
                    <button
                      onClick={() => setVisibleCols([])}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                    >
                      Desmarcar todas
                    </button>
                  </div>
                  {ALL_COLUMNS.map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="rounded border-slate-300 text-[#621f32] focus:ring-[#621f32]"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-[#10243e] text-white border border-[#bc955c] px-4 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider w-10">
                  #
                </th>
                {activeCols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="bg-[#10243e] text-white border border-[#bc955c] px-4 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider cursor-pointer hover:bg-[#1a3b63] transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        sortAsc
                          ? <ChevronUp className="size-3" />
                          : <ChevronDown className="size-3" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openFilterDropdown(col.key); }}
                        title="Filtrar columna"
                        className={`p-0.5 rounded transition-colors ${columnFilters[col.key]?.length ? 'text-[#bc955c]' : 'text-white/50 hover:text-white'}`}
                      >
                        <Filter className="size-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-[#bc955c]/5 ${
                    idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
                >
                  <td className="px-4 py-2 text-center text-slate-400 border border-[#bc955c]/20 text-xs font-medium">
                    {idx + 1}
                  </td>
                  {activeCols.map(col => (
                    <td
                      key={col.key}
                      className="px-4 py-2 text-center text-slate-700 dark:text-slate-300 border border-[#bc955c]/20 text-xs"
                    >
                      {(row[col.key] || '').toString().trim() || <span className="text-slate-200 dark:text-slate-700">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Mostrando {activeCols.length} de {ALL_COLUMNS.length} columnas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-semibold bg-[#10243e] text-white rounded-lg hover:bg-[#1a3b63] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={ALL_COLUMNS.find((c) => c.key === activeFilterDropdown)?.label}
            isDate={false}
            data={rows}
            getCellValue={defaultGetCellValue}
            filters={filters}
            dropdownValues={filterDropdownValues}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
            zIndexClass={FILTER_DROPDOWN_Z_INDEX_CLASS}
          />
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
