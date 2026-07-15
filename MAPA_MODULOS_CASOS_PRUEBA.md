# Mapa de módulos — base para casos de prueba

Generado 2026-07-14. Estructura jerárquica por **ruta → tab → subtab**, verificada contra código
(`src/app/...`), no contra el catálogo plano anterior (`LISTA_FUNCIONALIDADES.md`, F01-F56).
Objetivo: un documento de caso de prueba por **módulo** (nivel de página, ej. `/plantilla_empleados`),
cubriendo todos sus tabs y subtabs.

Convención de IDs: `M<n>` = módulo (página), `M<n>.T<n>` = tab, `M<n>.T<n>.S<n>` = subtab.

---

## M1. Landing (`/`)
- Hero: badge de texto rotando (`RotatingText`, 4 textos, cada 3500ms) + heading fijo.
- Imagen estática `/image.png` (NO rota — solo el texto del badge rota).
- CTA dinámico: si hay sesión (`useAuth`) → "Ir a dashboard" (`/dashboard`); si no → "Iniciar Sesión" (`/login`).
- Botón secundario fijo → `/features`.

## M2. Features (`/features`)
- 6 módulos fijos: plazas, presupuesto, plantilla, movimientos, organigrama, zafiro.
- Auto-rotación cada 5000ms, pausa con `onMouseEnter` sobre el layout.
- Layout: lista de tarjetas (col. izq.) + panel detalle sticky (col. der.) con `AnimatePresence`.
- "Video demo" es un `<video>` real apuntando a `/videos/{feature}.mp4` — depende de que existan
  6 archivos físicos; **sin fallback** si falta el archivo.
- Badge "DEMO" fijo, sin analítica de vistas.

## M3. Login (`/login`)
- Form de un solo campo: email `@anam.gob.mx`, sin password.
- Submit → `AuthService.checkEmail(email)`; si OK abre `CodigoVerificacionDrawer` y botón cambia a
  "✓ Código Enviado" (disabled).
- Botón secundario "Ingresar código de verificación" reabre el drawer si se cerró.
- `LoadingOverlay` global con texto dinámico ("Validando credenciales...").
- Error inline (banner rojo) si `checkEmail` falla.
- **`CodigoVerificacionDrawer.jsx`** (detalle interno):
  - 6 inputs OTP (`maxLength=1`, solo numérico), auto-focus al abrir (delay 100ms), auto-advance
    al siguiente input, Backspace en input vacío regresa foco al anterior.
  - Soporta pegar (`paste`) el código completo de 6 dígitos: valida numérico, autocompleta y
    auto-verifica.
  - **Auto-submit** al completar los 6 dígitos — no hay botón "Verificar" explícito.
  - Validación vía `AuthService.verifyCode(email, code)`.
  - Botón "Reenviar" es **decorativo, sin `onClick`** — no dispara ninguna acción, sin cooldown.
  - Error: mensaje único `"Código incorrecto o expirado."` (no distingue incorrecto/expirado/
    intentos máximos, sin límite de intentos en frontend); error de red: "Error de conexión con
    el servidor."
  - Éxito: guarda token y hace `window.location.href = "/dashboard"` (hard redirect, no `router.push`).
  - Loading: overlay global del padre ("Verificando código..."), sin loading local en el drawer.
  - Sin temporizador de expiración visible en UI.
  - Cancelar: resetea OTP + error, llama `onCancel()`.

## M4. Dashboard — Resumen (`/dashboard`)
- Server component con `Suspense` + skeleton (`DashboardSkeleton`).
- 4 fetches paralelos vía `Promise.allSettled` (resilientes, caen a fallback vacío si fallan):
  - `resumenVacantes` (`VacantesService.getVacantesPorNivelResumen`)
  - `resumenEmpleados` (`getEmpleadosCompletosEstatusResumen`)
  - `ocupacion` (`OcupacionService.getOcupacionPorOficios`)
  - `oficiosTurnados` (`ControlGestionService.getOficiosTurnados`, límite 10000)
- Renderiza `<Dashboard>` (`ClientComponent.jsx`, 187 líneas) + tarjetas en `BentoContent.jsx`:
  grid `MagicBento`, 7 tarjetas filtradas por permiso (mismo gate que el sidebar), cada tarjeta
  completa es clicable/navegable a su módulo (`onClickRedirectTo`, accesible con Enter/Space).
  Sin interactividad interna (sin tabs/filtros dentro del resumen).

  | Tarjeta | Prop real | Contenido | Nota |
  |---|---|---|---|
  | Plantilla Empleados | `resumenEmpleados` | Dona de status (Activo/Vacante/Suspendido/Licencia/Licencia Médica) + % | Si prop es null usa `defaultData` **hardcodeado** (no real); deja `console.log` de debug |
  | Ocupación por Oficios | `ocupacion` | `SankeyChart` real oficio→nivel, contador total, "Ocupadas SIG" | Si `filas` no existe, queda en "Cargando datos de ocupación..." indefinidamente (no es un error visible) |
  | Presupuestar Volumen | *(ninguno)* | Tabla 100% estática, solo encabezados, sin filas | Decorativo puro |
  | Oficios Turnados a DO | `oficiosTurnados` | Contador total + "hoy", `PieChart` por status | Si `model` falta, cae a `[]` → pie "Sin Datos" |
  | Organigrama ANAM | *(ninguno)* | Mini-árbol decorativo + texto fijo "13 unidades · 1,365 áreas" | Mock puro, no viene del backend |
  | Roles y Permisos | *(ninguno)* | Badge `roleCount` **siempre en "—"** + tags fijos | Estático, nunca recibe dato real |
  | Monitoreo ZAFIRO | *(ninguno)* | Solo ícono decorativo | Mock puro, sin datos ni estado |

  **Nota para caso de prueba**: 4 de 7 tarjetas (Presupuesto, Organigrama, Roles, ZAFIRO) son
  mock/estáticas pese a lucir como resumen en vivo — verificar si eso es el comportamiento
  esperado o pendiente de implementar antes de reportarlo como bug.

## M5. Ocupación Plazas por Oficio (`/dashboard/ocupacion_plazas_por_oficio`)
Header transversal a los 3 tabs: breadcrumb, contadores (Plazas Activas / Ocupadas Local + % /
Ocupadas SIG + % SIG), indicador "Vista Actual", buscador global de oficio, botón Filtros
(`OcupacionFilterDrawer`, badge con nº oficios incluidos), link "Plantilla" (solo con permiso
`EDIT_OCUPACION_PLAZAS`, solo desktop).

- **M5.T1 — Sankey** (permiso `VIEW_OCUPACION_SANKEY`)
  - Diagrama oficio→nivel, colores fijos por nivel (P33, D312, P13, A212, resto gris).
  - Click en nodo/link → drill-down → `RegistrosOficioModal`.
- **M5.T2 — Tabla** (permiso `VIEW_OCUPACION_TABLA`)
  - Matriz oficio×nivel, click celda → drill-down → `RegistrosOficioModal`.
  - Acción "ver detalle de oficio": busca expediente en Control de Gestión; si no existe → alert;
    si existe → abre `DetailModal` con preview PDF automático del primer documento.
- **M5.T3 — Estadísticas** (permiso `VIEW_OCUPACION_ESTADISTICAS`)
  - Top 10 oficios, media/mediana por oficio, totales por nivel.
  - Animación de barras con delay 500ms al montar el tab.
- **Drawer de filtros** (`OcupacionFilterDrawer`): buscar oficio, toggle incluir/excluir individual,
  "Restablecer todo", "Excluir todos".
- **Modal `RegistrosOficioModal`** (drill-down, 573 líneas): fetch a
  `/plantilla/registros_por_oficio_1800_plazas/?oficio=...&nivel=...` (envía `nivel=""` si el
  valor es "(vacío)", omite el param si es "Total Resultado"). Columnas: Posición, Estado
  Nómina, Estado Posición, Id Empleado, RFC, CURP, Nombres, Motivo, Fecha efectiva, Fecha de
  captura, Qna, Prevista salida, NJ, Código Presupuestal, Nivel, Programa.
  - Sin buscador global; sí filtro por columna estilo Excel (input de texto + dropdown checklist
    de valores únicos), botones "Limpiar filtros de columna" y "Limpiar Filtros".
  - Ordenar por columna (asc→desc→sin orden) y redimensionar columnas (drag).
  - Paginación 100% client-side, tamaños `[20, 50, 100, 500]` (default 50).
  - **Sin exportar** (no hay botón Excel/PDF en este modal).
  - **Filas no clicables** — no navega ni abre otro modal/timeline al hacer click en un registro.
  - Estados: loading (spinner), error (banner + "Reintentar ahora"), vacío ("Sin coincidencias").
- **Modal `DetailModal`** (`@/components/shared/OficioDetailModal`, **compartido con M8**): expediente +
  preview PDF vía blob, overlay "Generando Vista Previa...", cambio de documento.
- Estado vacío: botón "Restablecer todo".

### M5.1 — Sub-página Plantilla (`/dashboard/ocupacion_plazas_por_oficio/plantilla`)
Editor tipo Excel sobre "Plantilla 1800" (`PlantillaEditor.jsx`):
- Deshacer (Ctrl+Z, hasta 50 estados, sincroniza filas cambiadas al backend).
- Exportar Excel (.xlsx con fecha, sobre datos ya filtrados).
- Buscar y reemplazar: normaliza acentos/espacios, contador X/Y, navegar match, reemplazar uno o todos.
- "Quitar Filtros" (solo visible con filtros activos) + buscador global (normaliza texto).
- "Sync" (recarga desde backend, limpia historial de undo).
- Indicador de guardado: idle / saving / saved / error (auto-save).
- Grid: navegación con flechas, selección celda/fila/columna (drag + autoscroll en bordes),
  edición doble-click con autocompletado de valores existentes de la columna (u opción "(vacío)"),
  copiar (Ctrl+C o menú contextual, clipboard TSV), pegar multi-celda (Ctrl+V, TSV/CSV),
  menú contextual (Copiar Celda/Selección/Fila, Limpiar Celda, Eliminar Registro con `confirm()`),
  filtro por columna (modo Selección con checklist o modo Filtro de Texto con operadores
  Contiene/Es igual a/Empieza con/Termina con/Está vacío/No está vacío), redimensionar columna,
  ordenar columna (asc/desc), virtualización de filas.

## M6. Valuación Presupuestaria (`/dashboard/valuacion_presupuestaria`)
- **M6.T1 — Simulador** (`SimuladorValuacion.jsx`)
  - Selector período (botones Ene..Dic, 1-12 meses, default = meses restantes del año).
  - Botones "Eventuales Ocupadas" / "Permanentes Ocupadas" (precargan plazas, mutuamente excluyentes).
  - Aviso de niveles sin correspondencia en catálogo.
  - Buscador de catálogo + columna de niveles (stepper +/- e input numérico de plazas).
  - Columna "Selección Activa" (quitar individual, botón "Limpiar").
  - Botón "Calcular Valuación Presupuestaria" → scroll a resultados.
  - Resultados: tabla "Desglose por Concepto" (con tooltips de fórmula, fila TOTAL) + tabla
    "Desglose Analítico por Nivel".
  - Exportar PDF (jsPDF/autoTable) y Excel (ExcelJS, 2 hojas).
  - Flujo "Asunto seleccionado" (llega desde M6.T3): expediente + preview PDF en panel dividido,
    botón cerrar asunto.
- **M6.T2 — Parámetros** (permiso `EDIT_VALUACION_PARAMETROS`, `ParametrosValuacion.jsx`)
  - **M6.T2.S1 — Catálogo Plazas**: tabla editable, 18 columnas (nivel, zona, sueldo, prestaciones, etc.).
  - **M6.T2.S2 — Conceptos Presupuestales**: tabla editable (partida, descripción, sección, orden).
  - **M6.T2.S3 — Constantes**: tabla editable (clave, descripción, valor).
  - Común a las 3 subtabs: celda editable (click→editar, blur/Enter guarda, Esc cancela, auto-save),
    buscador global, filtro por columna estilo Excel, "Reiniciar filtros", botón "Recargar",
    aviso de que las modificaciones afectan cálculos en tiempo real.
- **M6.T3 — Asuntos de Plazas** (`AsuntosValuacion.jsx`)
  - Cruce de asuntos con oficios turnados (descarta huérfanos sin oficio).
  - Contador "Total de Solicitudes", buscador (folio/oficio/remitente/descripción/status).
  - Tabla con badge de Valuación (Procedente/Improcedente/Pendiente), link "Ver Resolución".
  - Acción "Ver detalles" → `DetailModal` (navegación next/previous entre asuntos).
  - Acción "Ir al simulador" → cambia a M6.T1 con expediente precargado.

## M7. Plantilla de Empleados (`/dashboard/plantilla_empleados`)
- **M7.T1 — Plantilla Detalle**: tabla densa con cadena de mando, búsqueda, edición de celda,
  exportar Excel.
- **M7.T2 — Estatus Nómina**
  - **S1 — Por Nivel** / **S2 — Por UA**: resumen agregado, exportar Excel.
- **M7.T3 — Mov. Posiciones**
  - **S1 — Tabla Principal**: histórico de posiciones, click celda → `CeldaHistorialModal`.
  - **S2 — Cuadros Vacancia**: gráficas de pastel (`PieChartsGrid`), exporta imagen/Excel,
    `DetalleVacantesModal`.
  - **S3 — Comprobar Alineación**: MOV_POS vs SIG, `AlineacionDetalleModal`, exporta Excel.
- **M7.T4 — Movimientos de personal**: altas/bajas/adscripción, selector año/mes, exporta Excel
  multi-hoja.
- **M7.T5 — Empleados Bajas**: histórico, gráfica de motivos, exportar Excel, buscador (carga
  vía `secondaryDataPromise`, no bloquea la carga inicial).
- **M7.T6 — Distribución Geográfica** (layout sin padding)
  - **S1 — Mapa Nacional**.
  - **S2 — Torre Caballito 3D**: beacons, búsqueda de empleado.
- **M7.T7 — Catálogos Estructura Organizacional**
  - **S1 — Acciones** (CRUD, pk `action`).
  - **S2 — Motivos** (CRUD, pk `id`).
  - **S3 — Puesto Funcional** (CRUD, pk `id`).
  - **S4 — Códigos Presupuestales** (CRUD, pk compuesta `codigo_presupuestal+escala`).
  - **S5 — Organigrama ANAM** (CRUD, pk `departamento`).
  - **S6 — Niveles Jerárquicos por Plaza**: DISTINTO de los anteriores — selección múltiple de
    plazas + asignación en bloque de nivel (`PrioridadNivelJerarquicoModal`), no es CRUD de
    registro único.
- **Modales compartidos**: `EmpleadoTimelineModal` / `PosicionTimelineModal` (usados desde
  Cuadros Vacancia); `CeldaHistorialModal`, `ColumnsModal`, `AdvancedFiltersModal`,
  `ColumnFilterDropdown`, `CopyCellMenu` (infraestructura de `DataTable`, transversal a casi
  todos los tabs de este módulo).

## M8. Oficios Turnados a DO (`/dashboard/oficios_turnados_do`)
- Datos server-side reales (límite 10000, sin paginación real de backend pese al parámetro
  `offset`) — filtrado/paginación es 100% client-side (50 por página).
- Header con contador animado + `PieChart` de distribución por status + tarjetas clicables
  (click = toggle filtro status).
- Buscador global (todos los campos) + botón limpiar filtros.
- Tabla desktop con columnas resizables y fila de filtros tipo Excel (`react-select` multi) por
  columna: Folio/Tipo, Tema, Remitente/Unidad, Unidad área, Instrucción/Prioridad, Estatus.
- Click en fila (VER) → `DetailModal` (**mismo componente compartido que M5**), navegación
  next/previous entre filas filtradas.
- Vista móvil: `MobileCardList` en vez de tabla.
- Paginación cliente inferior.

## M9. Organigrama ANAM (`/dashboard/organigrama`)
- Selector de unidad de negocio (dropdown con filtro en tiempo real, cierre en click-outside).
- Árbol jerárquico CSS puro (sin librería): expandir/colapsar por doble-click en nodo con hijos,
  expandAll/collapseAll.
- Zoom: Ctrl+Wheel, paso 0.05, rango [0.3, 2].
- Pan: drag-to-scroll manual (factor 1.5x).
- Búsqueda global de nodos: cruza todas las unidades; si el resultado pertenece a otra unidad,
  cambia de unidad y expande+resalta+hace scroll automático al nodo.
- Detalle de nodo: fetch de ocupante titular y superior al seleccionar.
- Edición de titular/superior: PATCH inmediato + actualización en sitio + toast con **undo real
  de 10s** (`setTimeout` 10000ms). Modo manual permite asignar plaza dejándola vacante (valida
  que esté activa antes de guardar).
- Edición de nodo: solo `descripcion_larga`, `unidad_administrativa`, `doaf` (los demás campos
  están bloqueados por el backend).
- Creación de nodos — **2 flujos distintos**:
  - Raíz nueva ("Dirección General"): abre lienzo/unidad_negocio nuevo.
  - Subordinado: bajo el nodo seleccionado, tipo restringido (Central/Director/Subdir./Jefe
    Depto — "General" excluido).
- Eliminación de nodo: la validación "bloqueada si tiene subordinados" vive en el **backend**;
  el front solo maneja el error si el backend la rechaza.
- Exportar PNG (`html-to-image`): modo vista actual vs modo completo (expande todo temporalmente,
  exporta, restaura).
- Estadísticas: panel flotante (bottom-left) con texto "Total áreas: N" + desglose oculto en
  pantallas medianas+ (Generales / Centrales / Direcciones / Subdirecciones / Jefaturas).
- Panel de zoom (bottom-right): botones −/+ (paso 0.1), % centrado, botón "Reset" (zoom=1).
- **Card de ocupante** (`PosicionOcupanteCard`, titular y superior): botón "Quitar" (PATCH a
  "(en blanco)"), botón "Cambiar" (buscador inline, mín. 3 caracteres, resultados clicables) o
  flujo "asignar plaza vacante por número" (input+Guardar, valida antes de persistir). Estados:
  sin plaza, cargando, error, plaza inactiva (banner rosa), plaza activa vacante (banner ámbar),
  plaza ocupada (nombre + nº empleado + estado nómina).
- **Modal Detalle de nodo**: título editable in-place, badge ID, grid con Nivel/Unidad de
  Negocio (solo lectura) y Unidad Administrativa/DOAF (editables); nota fija de que
  nivel/unidad_negocio no son editables ahí; 2 cards de ocupante (titular/superior). Footer:
  "Centrar en Organigrama", Cancelar/"Guardar cambios" (en edición) o "Eliminar" (disabled con
  tooltip si tiene subordinados) / "Editar" / "Agregar subordinado" (solo si el nivel admite un
  tipo hijo válido) / "Cerrar".
- **Modal confirmar borrado**: "¿Eliminar {id} — {descripción}? Esta acción no se puede
  deshacer.", error inline si el backend rechaza, Cancelar / "Sí, eliminar".
- **Modal Exportar PNG**: 2 tarjetas clicables — "Vista Actual" (respeta ramas colapsadas) vs
  "Todo Desglosado" (expande todo temporalmente) — + Cancelar.
- **Modal Crear Dirección General (raíz)**: campos `unidad_negocio*`, `departamento*`
  (placeholders "01000"/"01000000000", códigos oficiales externos), Descripción*, Unidad
  Administrativa, DOAF, Plaza titular (opcional). Botones Cancelar / "Crear y abrir lienzo".
- **Modal Crear subordinado**: texto "El determinante se genera automáticamente.". Campos:
  `Tipo*` (select filtrado a niveles inferiores al nodo actual), Descripción*, Unidad
  Administrativa/DOAF (placeholder heredado del padre), Plaza titular (mismo buscador que la
  card de ocupante). Botones Cancelar / "Crear subordinado".
- **Toast de cambio de plaza con undo**: botón "Revertir..." + botón X (cancela el timer
  manualmente) — confirma que el auto-cierre a los 10s y el cierre manual comparten el mismo timer.
- **Loader global de export**: overlay full-screen "Generando PNG..." durante la exportación.

## M10. Monitoreo ZAFIRO (`/dashboard/monitoreo_zafiro`)
- Banner con botones "ARRANCAR SINCRONIZACIÓN MANUAL" (disabled si loading o hay ejecución
  RUNNING) + "REFRESH".
- Modal de confirmación de sync manual: muestra minutos restantes hasta la próxima sync
  automática (calculada a :00/:30 de cada hora).
- 4 StatCards: Ejecuciones (total), Último estado, Duración (última), Registros (última).
- Gráfica "Duración Promedio por Hora" (solo ejecuciones EXITO), marca hora más rápida/lenta.
- Terminal en vivo: solo visible si hay log RUNNING, polling **cada 2000ms exacto**.
- Historial de Ejecuciones: filtros Excel-style (dropdown checkbox) en Timestamp/Status/Histórico;
  paginación client-side (10/25/50/100 filas), trae 500 registros de una vez (no hay paginación
  server-side real).

## M11. Roles y Permisos (`/dashboard/roles`, permiso `MANAGE_ROLES`)
- **M11.T1 — Roles**
  - Buscador por nombre, sort (Nombre A-Z | Más usuarios), paginación 8/página.
  - Nuevo rol / editar (dialog) / eliminar (`window.confirm` nativo).
  - Dialog: nombre + selector de permisos agrupado por categoría, buscador de permisos,
    "Seleccionar todos/Quitar todos" por categoría.
  - Preview on-hover: al pasar el mouse/foco sobre un permiso, muestra imagen de preview en
    panel lateral (si existe para ese permiso).
- **M11.T2 — Usuarios**
  - Buscador (correo/UA/rol), filtro por rol, paginación 10/página.
  - Reasignación de rol inline (Select por fila, dispara `assignRole` sin confirmación).
  - Botón "Nuevo usuario" (correo, rol, UA opcional, checkbox activo).

## M12. Infraestructura transversal (no es un módulo/página de prueba, es soporte compartido)
- Control de acceso granular: `useAuth` / `RequirePermission` / `usePermission`.
- Navbar desktop / `BottomNav` móvil.
- `PageTabBar` / `PageTabsContext` (motor de tabs usado en M6, M7, M11).
- Sistema de toasts.
- `DataTable` genérico + hooks (`useAdvancedFilters`, `useColumnFilters/State`,
  `useCellSelection`) — usado en la mayoría de tabs de datos (M5, M7).
- `ZafiroUpdatesContext` (auto-refresh tras sync de ZAFIRO).
- Exportación a Excel (transversal a casi todos los tabs de datos).
- `DetailModal` / `OficioDetailModal` (compartido entre M5 y M8).

---

## Huecos de inspección
Ninguno pendiente — los 4 puntos (M3 drawer, M4 widgets, M5 modal, M9 segunda mitad de
organigrama) fueron inspeccionados y volcados en sus secciones el 2026-07-14.

## Próximo paso sugerido
Un documento de caso de prueba por módulo (`M1`...`M11`), usando este archivo como fuente de
verdad de tabs/subtabs. `M12` no aplica para caso de prueba propio (es infraestructura,
se cubre indirectamente dentro de cada módulo que la usa).
