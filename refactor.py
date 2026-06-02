import re

with open('src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'r') as f:
    content = f.read()

# 1. Update Component Signature
content = content.replace(
    'export default function PlantillaEmpleadosDetalle({ resumen, detalle = [], estatusPorNivelUa = { por_nivel: {}, por_ua: {} }, distribucionGeografica = [] }) {',
    'export default function PlantillaEmpleadosDetalle({ resumen, detalle = [], estatusPorNivelUa = { por_nivel: {}, por_ua: {} }, distribucionGeografica = [], movPosData = [] }) {'
)

# 2. Add movPos states after activeTab and uasPageSize
states_addition = """
  const [movPosColumns, setMovPosColumns] = useState([
    { key: "no_pos_actual", label: "No. Posición", width: 130, visible: true, isBasic: true },
    { key: "estado_psn", label: "Estado (A/I)", width: 110, visible: true, isBasic: true },
    { key: "f_efva", label: "Fecha Efectiva", width: 130, visible: true, isBasic: true },
    { key: "unidad_de_negocio", label: "Unidad Negocio", width: 280, visible: true, isBasic: true },
    { key: "cd_motivo", label: "Cod. Motivo", width: 120, visible: true, isBasic: true },
    { key: "motivo", label: "Motivo", width: 250, visible: true, isBasic: true },
    { key: "puesto_ptal", label: "Puesto", width: 250, visible: true, isBasic: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true, isBasic: true },
    { key: "nvl_direc", label: "Nivel", width: 100, visible: true, isBasic: true },
    { key: "fecha_captura", label: "Fecha Captura", width: 130, visible: true, isBasic: true },
  ]);

  const isMovPos = activeTab === "movimientos";
  const currentData = isMovPos ? movPosData : detalle;
  const currentColumns = isMovPos ? movPosColumns : columns;
  const currentSetColumns = isMovPos ? setMovPosColumns : setColumns;
"""
content = content.replace(
    'const [mapFilter, setMapFilter] = useState("all");',
    'const [mapFilter, setMapFilter] = useState("all");\n' + states_addition
)

# 3. Replace columns with currentColumns in handleMouseDown
content = content.replace('const startWidth = columns[index].width;', 'const startWidth = currentColumns[index].width;')
content = content.replace('setColumns(prev => {', 'currentSetColumns(prev => {')

# 4. Replace columns with currentColumns in visibleColCount
content = content.replace('() => columns.filter(c => c.visible).length,', '() => currentColumns.filter(c => c.visible).length,')
content = content.replace('[columns]', '[currentColumns]')

# 5. Replace uniqueValues dependencies and mapping
content = content.replace('columns.forEach(col => {', 'currentColumns.forEach(col => {')
content = content.replace('detalle.forEach(row => {', 'currentData.forEach(row => {')
content = content.replace('}, [detalle]);', '}, [currentData, currentColumns]);')

# 6. Replace filteredSortedData dependencies and mapping
content = content.replace('let result = detalle.filter(row => {', 'let result = currentData.filter(row => {')
# Fix activeStatusFilter to only apply for 'detalle'
content = content.replace(
    'if (activeStatusFilter && activeStatusFilter.length > 0) {',
    'if (!isMovPos && activeStatusFilter && activeStatusFilter.length > 0) {'
)
content = content.replace('}, [detalle, globalSearch, columnFilters, sortConfig, activeStatusFilter]);', '}, [currentData, currentColumns, globalSearch, columnFilters, sortConfig, activeStatusFilter, isMovPos]);')

# 7. Add tab button for Movimientos
tab_button = """
                  <button
                    onClick={() => setActiveTab("movimientos")}
                    className={`px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                      activeTab === "movimientos" 
                        ? "bg-[#bc955c] text-white shadow-lg shadow-[#bc955c]/30" 
                        : "bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                    }`}
                  >
                    Mov. Posiciones
                  </button>
                  <button
"""
content = content.replace('<button\n                    onClick={() => setActiveTab("mapa")}', tab_button + '                    onClick={() => setActiveTab("mapa")}')

# 8. Render table condition
content = content.replace('{activeTab === "detalle" && (', '{(activeTab === "detalle" || activeTab === "movimientos") && (')

# 9. Table column mapping in render
content = content.replace('width: columns.filter(c => c.visible).reduce', 'width: currentColumns.filter(c => c.visible).reduce')
content = content.replace('{columns.filter(c => c.visible).map(col => (', '{currentColumns.filter(c => c.visible).map(col => (')
content = content.replace('{columns.filter(c => c.visible).map((col, index) => {', '{currentColumns.filter(c => c.visible).map((col, index) => {')
content = content.replace('const colIndex = columns.findIndex(c => c.key === col.key);', 'const colIndex = currentColumns.findIndex(c => c.key === col.key);')
content = content.replace('{columns.filter(c => c.visible).map((col, colIdx) => {', '{currentColumns.filter(c => c.visible).map((col, colIdx) => {')

# 10. Columns modal mapping
content = content.replace('{columns.filter(c => c.visible).length} de {columns.length} columnas visibles', '{currentColumns.filter(c => c.visible).length} de {currentColumns.length} columnas visibles')
content = content.replace('{columns.map((col) => {', '{currentColumns.map((col) => {')
content = content.replace('setColumns(columns.map(c =>', 'currentSetColumns(currentColumns.map(c =>')

# 11. Pagination text
content = content.replace('{formatNumber(filteredSortedData.length)} de {formatNumber(detalle.length)}', '{formatNumber(filteredSortedData.length)} de {formatNumber(currentData.length)}')

# 12. Reset states on tab change
content = content.replace(
    'const [activeEstatusSubTab, setActiveEstatusSubTab] = useState("nivel");',
    """
  useEffect(() => {
    setGlobalSearch("");
    setColumnFilters({});
    setCurrentPage(1);
    setTempSelectedValues([]);
    setActiveFilterDropdown(null);
  }, [activeTab]);

  const [activeEstatusSubTab, setActiveEstatusSubTab] = useState("nivel");"""
)

with open('src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'w') as f:
    f.write(content)

print("Refactor complete.")
