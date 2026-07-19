"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Search, RotateCcw } from "lucide-react";
import DataTable from "@/app/dashboard/plantilla_empleados/_components/shared/DataTable";
import ColumnFilterDropdown from "@/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown";
import { useColumnState } from "@/app/dashboard/plantilla_empleados/_hooks/useColumnState";
import { useCellSelection } from "@/app/dashboard/plantilla_empleados/_hooks/useCellSelection";
import { useColumnFilters } from "@/app/dashboard/plantilla_empleados/_hooks/useColumnFilters";
import {
  applyColumnFilters,
  getUniqueColumnValues,
  matchesTextCondition,
  finalizeFilterDropdownValues,
  defaultGetCellValue,
} from "@/utils/columnFilters";
import { Pill } from "@/components/shared/ModalShell";

const ROW_HEIGHT = 37;
const MONO_COLUMN_KEYS = ["num_empleado", "nivel"];

const COLUMNS = [
  { key: "num_empleado", label: "No. Emp", width: 100, visible: true },
  { key: "nombre", label: "Nombre completo", width: 230, visible: true },
  { key: "posicion", label: "Posición", width: 170, visible: true },
  { key: "nivel", label: "Nivel", width: 70, visible: true },
  { key: "ua", label: "Unidad administrativa", width: 220, visible: true },
  { key: "fecha_ingreso", label: "Ingreso", width: 110, visible: true },
  { key: "estatus", label: "Estatus", width: 110, visible: true },
];

// Insumo de demo — mismo shape que ALL_AVAILABLE_COLUMNS de EmployeesModal,
// para que abrir el "expediente" de una fila se sienta continuo con la propuesta.
export const MOCK_EMPLEADOS = [
  { num_empleado: "004521", nombre: "García Hernández, Luis Ángel", posicion: "JEFE DE DEPARTAMENTO", nivel: "23", ua: "Aduana de Nuevo Laredo", fecha_ingreso: "14/03/2011", estatus: "Activo", rfc: "GAHL850312AB1", curp: "GAHL850312HTSRRS02", puesto_funcional: "Jefe de Departamento de Operación Aduanera", tipo_contratacion: "Base", ubicacion: "Nuevo Laredo, Tamaulipas" },
  { num_empleado: "004598", nombre: "Ramírez Ortiz, Karla Sofía", posicion: "SUBDIRECTOR DE AREA", nivel: "25", ua: "Aduana de Manzanillo", fecha_ingreso: "02/09/2016", estatus: "Activo", rfc: "RAOK880921MK2", curp: "RAOK880921MCLRRT05", puesto_funcional: "Subdirectora de Operación Portuaria", tipo_contratacion: "Base", ubicacion: "Manzanillo, Colima" },
  { num_empleado: "004612", nombre: "Torres Villanueva, Jorge", posicion: "ENLACE ADUANERO", nivel: "21", ua: "Aduana de Veracruz", fecha_ingreso: "18/01/2022", estatus: "Licencia", rfc: "TOVJ900504HV3", curp: "TOVJ900504HVZRRR08", puesto_funcional: "Enlace de Comercio Exterior", tipo_contratacion: "Confianza", ubicacion: "Veracruz, Veracruz" },
  { num_empleado: "004630", nombre: "Domínguez Reyes, Ana Paula", posicion: "JEFE DE DEPARTAMENTO", nivel: "23", ua: "Aduana de Tijuana", fecha_ingreso: "23/11/2013", estatus: "Activo", rfc: "DORA870715MB4", curp: "DORA870715MBCMYN01", puesto_funcional: "Jefe de Departamento Jurídico", tipo_contratacion: "Base", ubicacion: "Tijuana, Baja California" },
  { num_empleado: "004655", nombre: "Salazar Cruz, Miguel Ángel", posicion: "OFICIAL DE COMERCIO EXTERIOR", nivel: "19", ua: "Aduana de Nuevo Laredo", fecha_ingreso: "05/06/2024", estatus: "Vacante", rfc: "SACM950228HT8", curp: "SACM950228HTSLRG02", puesto_funcional: "Oficial de Revisión Documental", tipo_contratacion: "Eventual", ubicacion: "Nuevo Laredo, Tamaulipas" },
  { num_empleado: "004671", nombre: "Mendoza Ibarra, Fernanda", posicion: "SUBDIRECTOR DE AREA", nivel: "25", ua: "Aduana de Ciudad Juárez", fecha_ingreso: "11/02/2015", estatus: "Activo", rfc: "MEIF860110MC5", curp: "MEIF860110MCHNRR04", puesto_funcional: "Subdirectora de Fiscalización", tipo_contratacion: "Base", ubicacion: "Ciudad Juárez, Chihuahua" },
  { num_empleado: "004689", nombre: "Cordero Ponce, Raúl", posicion: "JEFE DE DEPARTAMENTO", nivel: "23", ua: "Aduana de Manzanillo", fecha_ingreso: "30/09/2010", estatus: "Suspendido", rfc: "COPR820630HC1", curp: "COPR820630HCLRNL03", puesto_funcional: "Jefe de Departamento de Inspección", tipo_contratacion: "Base", ubicacion: "Manzanillo, Colima" },
  { num_empleado: "004702", nombre: "Villalobos Nuñez, Diana", posicion: "ENLACE ADUANERO", nivel: "21", ua: "Aduana de Tijuana", fecha_ingreso: "19/04/2019", estatus: "Activo", rfc: "VINE930817MB9", curp: "VINE930817MBCLXN07", puesto_funcional: "Enlace de Padrón de Importadores", tipo_contratacion: "Confianza", ubicacion: "Tijuana, Baja California" },
  { num_empleado: "004715", nombre: "Aguilar Solís, Emmanuel", posicion: "OFICIAL DE COMERCIO EXTERIOR", nivel: "19", ua: "Aduana de Veracruz", fecha_ingreso: "07/07/2023", estatus: "Activo", rfc: "AUSE970303HV5", curp: "AUSE970303HVZGLM06", puesto_funcional: "Oficial de Verificación Física", tipo_contratacion: "Eventual", ubicacion: "Veracruz, Veracruz" },
  { num_empleado: "004733", nombre: "Reséndiz Marín, Paola", posicion: "JEFE DE DEPARTAMENTO", nivel: "23", ua: "Aduana de Ciudad Juárez", fecha_ingreso: "26/08/2012", estatus: "Activo", rfc: "REMP851122MC6", curp: "REMP851122MCHSRL00", puesto_funcional: "Jefe de Departamento de Recursos Humanos", tipo_contratacion: "Base", ubicacion: "Ciudad Juárez, Chihuahua" },
  { num_empleado: "004749", nombre: "Bautista Flores, Sergio", posicion: "SUBDIRECTOR DE AREA", nivel: "25", ua: "Aduana de Nuevo Laredo", fecha_ingreso: "14/12/2017", estatus: "Vacante", rfc: "BAFS890415HT2", curp: "BAFS890415HTSTLR09", puesto_funcional: "Subdirector de Comercio Exterior", tipo_contratacion: "Base", ubicacion: "Nuevo Laredo, Tamaulipas" },
  { num_empleado: "004760", nombre: "Cabrera Luna, Ximena", posicion: "ENLACE ADUANERO", nivel: "21", ua: "Aduana de Manzanillo", fecha_ingreso: "09/10/2020", estatus: "Activo", rfc: "CALX920529MC3", curp: "CALX920529MCLBNM01", puesto_funcional: "Enlace de Estadística Aduanera", tipo_contratacion: "Confianza", ubicacion: "Manzanillo, Colima" },
];

const STATUS_TONE = { Activo: "emerald", Vacante: "rose", Licencia: "amber", Suspendido: "slate" };

export default function ListadoEmpleadosDemo({ onShowRecord }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const { columns, setColumns } = useColumnState(COLUMNS);
  const { selectedCell, setSelectedCell } = useCellSelection();
  const filters = useColumnFilters();
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    filterDropdownTab, setFilterDropdownTab,
    activeConditionDropdown, setActiveConditionDropdown,
    setTempSelectedValues,
    tempSelectedValues,
    setFilterSearchText,
    filterSearchCondition,
    debouncedFilterSearchText,
  } = filters;

  const isMonoColumn = useCallback((key) => MONO_COLUMN_KEYS.includes(key), []);

  const filteredData = useMemo(() => applyColumnFilters(MOCK_EMPLEADOS, {
    globalSearch, columnFilters, textFilters, getCellValue: defaultGetCellValue, isMonoColumn,
  }), [globalSearch, columnFilters, textFilters, isMonoColumn]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData;
    const { key, direction } = sortConfig;
    return [...filteredData].sort((a, b) => {
      const av = defaultGetCellValue(a, key), bv = defaultGetCellValue(b, key);
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  const getColumnLetter = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const handleResizeStart = (e, index, direction = "right") => {
    e.preventDefault();
    const startX = e.clientX, startWidth = columns[index].width;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns((prev) => {
        const next = [...prev];
        const newWidth = direction === "left" ? startWidth - deltaX : startWidth + deltaX;
        next[index] = { ...next[index], width: Math.max(60, newWidth) };
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
    setActiveFilterDropdown(colKey);
    setFilterDropdownTab("todos");
    setFilterSearchText("");
    const allValues = [...new Set(MOCK_EMPLEADOS.map((row) => defaultGetCellValue(row, colKey)))];
    setTempSelectedValues(columnFilters[colKey] || allValues);
  };

  const applyColumnFilter = (colKey) => {
    const totalUnique = getUniqueColumnValues(MOCK_EMPLEADOS, colKey, defaultGetCellValue).map((v) => v.value);
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
    return getUniqueColumnValues(MOCK_EMPLEADOS, activeFilterDropdown, defaultGetCellValue);
  }, [activeFilterDropdown]);

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) {
      return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
    }
    let baseUniqueValues = dropdownUniqueValues;
    if (filterDropdownTab === "actuales") {
      baseUniqueValues = getUniqueColumnValues(filteredData, activeFilterDropdown, defaultGetCellValue);
    }
    const filteredVals = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered: filteredVals,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
    });
  }, [activeFilterDropdown, dropdownUniqueValues, filterDropdownTab, filteredData, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

  const hasActiveFilters = !!globalSearch || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some((f) => f?.value);
  const resetAllFilters = () => {
    setGlobalSearch("");
    setColumnFilters({});
    setTextFilters({});
    setActiveFilterDropdown(null);
    setActiveConditionDropdown(null);
  };

  const renderCell = ({ col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
    return (
      <td
        key={col.key}
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={stickyStyle}
        className={`px-4 text-xs border-r truncate h-[37px] align-middle ${
          isSelected
            ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
            : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
        } ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"}`}
      >
        {col.key === "estatus" ? (
          <Pill tone={STATUS_TONE[value] || "slate"}>{value}</Pill>
        ) : (
          value || <span className="text-slate-300 dark:text-slate-700">—</span>
        )}
      </td>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-3.5 h-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#621f32]/20 focus:border-[#621f32]/40 transition-all w-48"
            />
          </div>
          <button
            onClick={resetAllFilters}
            disabled={!hasActiveFilters}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 hover:border-red-200 transition-all tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar filtros
          </button>
        </div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {sortedData.length} de {MOCK_EMPLEADOS.length} registros
        </span>
      </div>

      <div className="flex flex-col h-[52vh] rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <DataTable
          fillHeight
          fillWidth
          onScroll={setScrollTop}
          columns={columns}
          columnFilters={columnFilters}
          textFilters={textFilters}
          setTextFilters={setTextFilters}
          activeConditionDropdown={activeConditionDropdown}
          setActiveConditionDropdown={setActiveConditionDropdown}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
          onCellContextMenu={() => {}}
          onShowRecord={onShowRecord}
          sortConfig={sortConfig}
          onSort={handleSort}
          onOpenFilter={openFilterDropdown}
          onResizeStart={handleResizeStart}
          getColumnLetter={getColumnLetter}
          isMonoColumn={isMonoColumn}
          isPending={false}
          isLoading={false}
          data={sortedData}
          startIndex={0}
          endIndex={sortedData.length}
          totalCount={sortedData.length}
          rowHeight={ROW_HEIGHT}
          getRowId={(row) => row.num_empleado}
          renderCell={renderCell}
        />
      </div>

      <AnimatePresence>
        {activeFilterDropdown && (
          <ColumnFilterDropdown
            open={!!activeFilterDropdown}
            columnKey={activeFilterDropdown}
            columnLabel={COLUMNS.find((c) => c.key === activeFilterDropdown)?.label}
            isDate={false}
            data={MOCK_EMPLEADOS}
            getCellValue={defaultGetCellValue}
            filters={filters}
            dropdownValues={filterDropdownValues}
            onApply={() => applyColumnFilter(activeFilterDropdown)}
            onClear={() => clearColumnFilter(activeFilterDropdown)}
            onClose={() => setActiveFilterDropdown(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
