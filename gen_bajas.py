import re

with open('src/components/MovimientosTab.jsx', 'r') as f:
    content = f.read()

# Replace MovimientosTab with BajasTab
content = content.replace('MovimientosTab', 'BajasTab')
content = content.replace('movPosData', 'bajasData')

# Remove total_movimientos from columns (we will rewrite columns entirely)
columns_def = """    { key: "posicion", label: "Posición", width: 120, visible: true },
    { key: "no_empleado", label: "No. Empleado", width: 120, visible: true },
    { key: "nombre_completo", label: "Nombre Completo", width: 250, visible: true },
    { key: "motivo_descr", label: "Motivo", width: 250, visible: true },
    { key: "fecha_efectiva", label: "Fecha Efectiva", width: 120, visible: true },
    { key: "unidad_admon", label: "Unidad Admon", width: 250, visible: true },
    { key: "departamento", label: "Departamento", width: 250, visible: true },
    { key: "puesto", label: "Puesto", width: 250, visible: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true },
    { key: "accion_descr", label: "Acción", width: 200, visible: true },
    { key: "nomina_status", label: "Estatus Nómina", width: 150, visible: true },
    { key: "humanos_status", label: "Estatus RH", width: 150, visible: true },
    { key: "partida", label: "Partida", width: 120, visible: true },
    { key: "nivel", label: "Nivel", width: 100, visible: true },
    { key: "rfc", label: "RFC", width: 150, visible: false },
    { key: "curp", label: "CURP", width: 180, visible: false },
    { key: "genero", label: "Género", width: 100, visible: false }"""

content = re.sub(r'const \[columns, setColumns\] = useState\(\[\s*\{ key: "no_pos_actual"[\s\S]*?\}\]\);', 
                 f'const [columns, setColumns] = useState([\n{columns_def}\n  ]);', content)

# Update ALL_MOV_KEYS
all_keys = """const ALL_MOV_KEYS = [
  "posicion", "no_empleado", "nombre_completo", "primer_apellido", "segundo_apellido", 
  "accion", "accion_descr", "motivo", "motivo_descr", "fecha_efectiva", "sequencia_efectiva", 
  "fecha_aplicacion", "humanos_status", "nomina_status", "partida", "unidad_general", 
  "unidad_admon", "departamento", "dependencia_directa", "plan_salarial", "grado", "escala", 
  "puesto_presupuestal", "nivel_tabular", "grupo_de_pago", "beneficios", "smb", "puesto", 
  "ubicacion", "inmueble", "fecha_prevista", "ultima_actualizacion", "ultimo_operador", 
  "ultima_fecha_ingreso", "fecha_ingreso", "grupo_trabajo", "codigo_grupo", "fecha_asignacion", 
  "rfc", "curp", "id_persona", "nivel", "nivel1", "unidad_administrativa", "genero", 
  "fecha_entrada_posicion", "fecha_posicion"
];"""
content = re.sub(r'const ALL_MOV_KEYS = \[[^\]]*\];', all_keys, content)

# Update DATE_KEYS
content = re.sub(r'const DATE_KEYS_MOV = \[[^\]]*\];', 'const DATE_KEYS_MOV = ["fecha_efectiva", "fecha_aplicacion", "ultima_actualizacion", "fecha_ingreso"];', content)

# Remove timeline and modal logic
content = re.sub(r'const timelineData = useMemo\(\(\) => \{[\s\S]*?\}, \[modalHistoryData, columns\]\);', '', content)
content = re.sub(r'const filteredTimelineData = useMemo\(\(\) => \{[\s\S]*?\}, \[timelineData, timelineSearch\]\);', '', content)
content = re.sub(r'const tableDataToRender = useMemo\(\(\) => \{[\s\S]*?\}, \[activeModalTab, comparingIndex, modalHistoryData, timelineData\]\);', '', content)

content = re.sub(r'const posicionesActivas = useMemo\(\(\) => bajasData.filter[^;]+;\n', '', content)
content = re.sub(r'const posicionesInactivas = useMemo\(\(\) => bajasData.filter[^;]+;\n', '', content)

# Update header cards
header_cards = """
          <div className="grid grid-cols-1 md:grid-cols-1 gap-5 mb-6 items-stretch w-full max-w-xl mx-auto">
            <div className={`relative overflow-hidden rounded-[1.5rem] p-4 flex flex-col justify-between transition-all duration-300 group bg-gradient-to-br from-[#621f32] to-[#8a2a46] text-white shadow-xl shadow-[#621f32]/25 scale-[1.02] ring-2 ring-white/20`}>
              <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-3xl opacity-20 transition-all bg-white`} />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className={`p-2 rounded-xl transition-colors bg-white/20 text-white`}>
                  <Users className="size-4" />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-white/90`}>Total de Bajas Registradas</span>
              </div>
              <span className={`text-4xl font-black tracking-tighter relative z-10 text-white`}>{formatNumber(bajasData.length)}</span>
            </div>
          </div>
"""
content = re.sub(r'<div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 items-stretch w-full max-w-5xl mx-auto">[\s\S]*?<\/Zoom>', f'{header_cards}</Zoom>', content)

# Fix some variables
content = content.replace('isMonoColumn = useCallback((key) => ["no_pos_actual", "cd_un", "cd_departamento", "cd_puesto", "maximo", "grado", "esc", "partida_ptal"].includes(key), [])', 'isMonoColumn = useCallback((key) => ["posicion", "no_empleado", "partida", "grado", "escala", "nivel"].includes(key), [])')

content = content.replace('columnFilters["estado_psn"] || []', '[]')
content = content.replace('activeStatusFilter = []', 'activeStatusFilter = []')
content = content.replace('handleStatusFilter(status)', '')

# Save
with open('src/components/BajasTab.jsx', 'w') as f:
    f.write(content)
