# Auditoría de Modals de Detalle — eje_central_front

Inventario completo de todos los modals que muestran información (detalle de un registro, expediente, historial, timeline, listado) más los modals utilitarios/config que también participan del mismo problema de inconsistencia visual. Objetivo: insumo para homogenizar el estilo de todos los modals del sistema.

Metodología: búsqueda por archivo (`*Modal*.jsx`), por patrón inline (`fixed inset-0`, `absolute inset-0 z-*`, `createPortal`, `<Dialog`) en cada Tab/ClientComponent/page, y lectura completa de cada componente encontrado.

## Tabla resumen

| # | Componente | Archivo | Se dispara desde | Categoría | Patrón técnico | Estilo (resumen) |
|---|---|---|---|---|---|---|
| 1 | `EmpleadosTableModal` | `src/components/shared/EmpleadosTableModal.jsx` | `TorreCaballito3DTab` (torre 3D, click en barra) | Detalle (tabla) | Custom `absolute inset-0` + backdrop propio (no portal, no Dialog) | bg blanco, `rounded-2xl`, backdrop `white/50` blur, sans, sin dark mode, sin motion |
| 2 | `DetailModal` (export default de `OficioDetailModal.jsx`) | `src/components/shared/OficioDetailModal.jsx` | `ocupacion_plazas_por_oficio/ClientComponent`, `oficios_turnados_do/ClientComponent`, `valuacion_presupuestaria/AsuntosValuacion` | Detalle | `createPortal` + `motion/react` | bg blanco, `rounded-[3.5rem]` (extremo), backdrop `black/60` blur, sans, sin dark mode |
| 3 | `EmployeesModal` (default export) | `.../plantilla_empleados/_components/shared/EmployeesModal.jsx` | `EstatusTab` (click nivel/estatus) | Detalle (listado) | `Dialog` primitive (`@/components/ui/dialog`) + `Zoom` (react-awesome-reveal) | estilo "membrete/carpeta": `LetterheadBar`, `rounded-[28px]`, bordes dashed, `font-serif`, dark mode sí |
| 4 | `EmployeeRecordModal` (named export, misma archivo) | ídem | `BajasTab`, `MovimientosTab`, `PlantillaDetalleTab`, `MovimientosPersonalTab` (botón "Ver expediente" en `DataTable`) | Detalle ("Expediente de plaza") | `Dialog` primitive | mismo estilo membrete/carpeta, sello circular `Stamp`, dark mode sí |
| 5 | `ColumnsSelectorModal` (interno, no exportado) | ídem | Dentro de `EmployeesModal` | Utilitario | `Dialog` primitive | mismo estilo membrete/carpeta |
| 6 | `RegistrosOficioModal` | `.../ocupacion_plazas_por_oficio/_components/RegistrosOficioModal.jsx` | `ocupacion_plazas_por_oficio/ClientComponent` | Detalle (tabla) | `Dialog` primitive + `Zoom` | bg blanco, `rounded-[3.5rem]` (calca `OficioDetailModal`), sans, sin dark mode |
| 7 | `AlineacionDetalleModal` | `.../plantilla_empleados/_components/modals/AlineacionDetalleModal.jsx` | `AlineacionOrganizacionalTab` | Detalle (comparación campo a campo) | `createPortal` + `motion/react` (`AnimatePresence`) | bg blanco/slate-900, `rounded-2xl`, backdrop `slate-950/75`, sans, dark mode sí |
| 8 | `EmpleadoTimelineModal` | `.../modals/EmpleadoTimelineModal.jsx` | `MovimientosPersonalTab` | Detalle (timeline + tabla) | `createPortal` + `framer-motion` (import directo, no `motion/react`) | bg blanco/slate-900, `rounded-[2.5rem]`, backdrop `slate-950/70` blur-md, dark mode sí |
| 9 | `PosicionTimelineModal` | `.../modals/PosicionTimelineModal.jsx` | `MovimientosPersonalTab` | Detalle (timeline ocupantes) | `createPortal` + `framer-motion` | idéntico patrón a #8, `rounded-[2.5rem]`, dark mode sí |
| 10 | `AdvancedFiltersModal` | `.../shared/AdvancedFiltersModal.jsx` | Varios tabs de plantilla | Utilitario | `createPortal` + `motion/react` | bg blanco/slate-900, `rounded-2xl`, dark mode sí |
| 11 | `CeldaHistorialModal` | `.../shared/CeldaHistorialModal.jsx` | `PlantillaDetalleTab` | Detalle (auditoría/historial) | `createPortal` + `motion/react` | bg `slate-50`/slate-950, `rounded-[2.5rem]`, dark mode sí |
| 12 | `ColumnsModal` | `.../shared/ColumnsModal.jsx` | Varios tabs de plantilla | Utilitario | `createPortal` + `motion/react` | bg blanco/slate-900, `rounded-[2.5rem]`, dark mode sí |
| 13 | `CatalogRecordModal` | `.../tabs/catalogos-estructura/CatalogRecordModal.jsx` | `CatalogosEstructuraTab` | Utilitario (form CRUD) | `Dialog` primitive | Dialog por defecto sin gradientes/carpeta, `sm:max-w-lg`, sin dark mode explícito en textos |
| 14 | `PrioridadNivelJerarquicoModal` | `.../catalogos-estructura/PrioridadNivelJerarquicoModal.jsx` | `NivelesJerarquicosPlazaSubtab` | Utilitario (confirmación) | `createPortal` + `motion/react` | bg blanco/slate-900, `rounded-[2.5rem]`, acento ámbar (no guinda/dorado), dark mode sí |
| 15 | `DetalleVacantesModal` | `.../tabs/cuadros-vacancia/DetalleVacantesModal.jsx` | `DesgloseJerarquicoCharts` y `DetalleVacantesTablas` (dentro de `CuadrosVacanciaTab`) | Detalle (tabla) | `createPortal` simple (sin motion) | bg blanco/slate-900, `rounded-2xl`, header degradado azul marino `#10243e→#1a3b63` (paleta ajena al resto), dark mode sí |
| 16 | "Detalle de nodo" (inline) | `app/dashboard/organigrama/page.jsx` (~L2265) | Click en nodo del organigrama | Detalle | Custom `fixed inset-0`, sin portal, sin motion | bg blanco/slate-900, `rounded-3xl`, barra superior degradado `rose-800→amber-500` (paleta totalmente distinta: rosa/ámbar en vez de guinda/dorado), sans, dark mode sí |
| 17 | "Confirmar borrado" (inline) | `organigrama/page.jsx` (~L2445) | Botón eliminar nodo | Utilitario (confirmación) | Custom `fixed inset-0` | `rounded-2xl`, paleta rose | 
| 18 | "Crear nueva Dirección General" (inline) | `organigrama/page.jsx` (~L2512) | Botón nueva raíz | Utilitario (form) | Custom `fixed inset-0` | `rounded-2xl`, paleta rose |
| 19 | Modal de exportar PDF (inline, `showExportModal`) | `organigrama/page.jsx` (~L2480) | Botón exportar | Utilitario | Custom `fixed inset-0` | `rounded-2xl`, paleta rose |
| 20 | "Custom Confirmation Modal" (sync manual) | `app/dashboard/monitoreo_zafiro/ClientComponent.jsx` (~L801) | Botón "Sincronizar ahora" | Utilitario (confirmación) | Custom `fixed inset-0` + `motion/react` | bg blanco/slate-900, `rounded-2xl`, acento ámbar + guinda mezclados, tipografía `font-mono` (única en todo el sistema), dark mode sí |
| 21 | "Modal de logs/errores de sincronización" (inline) | `monitoreo_zafiro/ClientComponent.jsx` (~L879) | Click en fila de historial de sync | Detalle | Custom `fixed inset-0` + `motion/react` | bg blanco/slate-900, `rounded-2xl`, dark mode sí, `font-mono` en varias partes |
| 22 | "Detalle de Posición" (tabla+timeline, inline, duplicado) | `BajasTab.jsx` (~L1255), `MovimientosTab.jsx` (~L1838) | Click en celda "posición" con historial | Detalle | Custom `fixed inset-0` + `motion/react` | **`rounded-none`** (esquinas rectas, único caso en todo el sistema), bg blanco/slate-900, dark mode sí |
| 23 | "Detalle de Celda" (valor completo, inline, duplicado) | `BajasTab.jsx` (~L1446), `MovimientosTab.jsx` (~L2413), `PlantillaDetalleTab.jsx` (~L1632), `MovimientosPersonalTab.jsx` (~L2476) | Click/expandir celda de tabla | Detalle (mini) | Custom `fixed inset-0` + `motion/react` | `rounded-[2rem]`, bg blanco/slate-900, dark mode sí — 4 copias casi idénticas del mismo componente no extraído a compartido |
| 24 | "Cadena de Mando" (inline) | `PlantillaDetalleTab.jsx` (~L1413) | Botón explorar jerarquía | Detalle | Custom `fixed inset-0` + `motion/react` | bg `slate-50`/slate-950, `rounded-[2.5rem]`, dark mode sí |
| 25 | "Desglose por Nivel" (inline) | `EstatusTab.jsx` (~L765) | Click en UA | Detalle (tabla) | `createPortal` + `motion/react` | `rounded-[2rem]`, dark mode sí |
| 26 | "Generando Reporte" (loading, inline) | `EstatusTab.jsx` (~L697) | Durante exportación Excel | Utilitario (loading) | Custom `fixed inset-0` + `motion/react` | `rounded-[2rem]`, dark mode sí |
| 27 | "Exportar Unidades Administrativas" (selector, inline) | `EstatusTab.jsx` (~L905) | Botón exportar | Utilitario (selector) | `createPortal` + `motion/react` | `rounded-[2rem]`, dark mode sí |
| 28 | Selector de niveles para exportar (inline) | `EstatusTab.jsx` (~L1035) | Dentro del flujo de exportación | Utilitario (selector) | `createPortal` + `motion/react` | `rounded-[2rem]`, dark mode sí |
| 29 | "Detalle de Vacancia" (inline) | `MovimientosTab.jsx` (~L2088) | Click en badge de vacancia | Detalle | `createPortal` + `motion/react` | `rounded-[2rem]`, franja superior con gradiente dinámico según categoría, dark mode sí |
| 30 | "bitacora-date-modal" (selector de fechas, inline) | `MovimientosPersonalTab.jsx` (~L188) | Filtro de bitácora | Utilitario (selector) | `createPortal` + `motion/react` | hoja inferior en móvil (`rounded-t-3xl`) / centrado en desktop (`rounded-3xl`), dark mode sí |

Nota: `DetalleVacantesModal` también incluye un menú de columnas inline (`showColMenu`), no se cuenta aparte por ser parte del mismo componente.

---

## Detalle por modal

### 1. `EmpleadosTableModal`
- **Archivo:** `src/components/shared/EmpleadosTableModal.jsx`
- **Trigger:** `TorreCaballito3DTab` — al hacer click en una barra/serie de la torre 3D para ver los empleados de ese nivel.
- **Qué muestra:** tabla de empleados con filtros estilo Excel (dropdown por columna + filtro de texto con condición), búsqueda global.
- **Patrón:** `absolute inset-0 z-50` dentro del contenedor padre (no `fixed`, no portal, no `Dialog` primitive). Backdrop propio `bg-white/50 backdrop-blur-md`.
- **Estilo:** panel blanco `rounded-2xl`, `max-w-[95vw] max-h-[65vh]`, paleta `#621f32`/`#bc955c`, tipografía sans, **sin soporte dark mode**, animación solo `animate-in fade-in zoom-in-95` (sin motion/framer).

### 2. `DetailModal` (`OficioDetailModal.jsx`)
- **Archivo:** `src/components/shared/OficioDetailModal.jsx`
- **Trigger:** `ocupacion_plazas_por_oficio/ClientComponent`, `oficios_turnados_do/ClientComponent`, `valuacion_presupuestaria/AsuntosValuacion` — "Expediente Digital Integrado" de un oficio/asunto.
- **Qué muestra:** split view con visor PDF a la izquierda y metadata (remitente, dirigido a, turnado, archivos adjuntos, clasificación de tipo de asunto) a la derecha, navegación anterior/siguiente entre oficios.
- **Patrón:** `createPortal` a `document.body` + `motion/react`.
- **Estilo:** panel blanco **`rounded-[3.5rem]`** (el radio más exagerado de todo el sistema), backdrop `black/60` blur-md, tamaño `max-w-[95vw] h-[90vh]`, sans, **sin dark mode**.

### 3 y 4. `EmployeesModal` / `EmployeeRecordModal` / `ColumnsSelectorModal`
- **Archivo:** `src/app/dashboard/plantilla_empleados/_components/shared/EmployeesModal.jsx` (1099 líneas, 3 componentes en un solo archivo).
- **`EmployeesModal` (default, "Listado de Empleados"):** trigger desde `EstatusTab` al hacer click en un nivel/estatus; muestra tabla paginada con sidebar tipo carpeta (sello circular con el nivel, KPI de total, selector de página, configurar columnas).
- **`EmployeeRecordModal` ("Expediente de plaza"):** trigger desde el botón de ojo/"Ver expediente" en `DataTable` (usado por `BajasTab`, `MovimientosTab`, `PlantillaDetalleTab`, `MovimientosPersonalTab`); es el modal que el usuario identificó como "Expediente de la plaza". Muestra tarjetas principales (No. Empleado, Posición, RFC, Nivel) + campos agrupados por categoría con buscador.
- **`ColumnsSelectorModal` (interno):** selector de columnas visibles del listado.
- **Patrón (los 3):** usan el `Dialog` primitive de `@/components/ui/dialog` + `Zoom` de `react-awesome-reveal` (no framer-motion).
- **Estilo:** el más elaborado del sistema — `LetterheadBar` (franja degradado `#bc955c→#621f32→#bc955c`), `rounded-[28px]`, bordes `border-dashed`, `font-serif` en títulos, sello circular con `border-double`, **soporta dark mode completo**.

### 6. `RegistrosOficioModal`
- **Archivo:** `.../ocupacion_plazas_por_oficio/_components/RegistrosOficioModal.jsx`
- **Trigger:** `ocupacion_plazas_por_oficio/ClientComponent` — drill-down de plazas por oficio/nivel.
- **Qué muestra:** tabla de plazas (posición, estado, empleado, fechas) con filtros y ordenamiento tipo hoja de cálculo (columnas con letra A, B, C…), sticky header en guinda oscuro `#501929`.
- **Patrón:** `Dialog` primitive + `Zoom`. Explícitamente comentado en el código: *"Solid white background, rounded-[3.5rem] and shadow to match OficioDetailModal"* — copia intencional del estilo del modal #2, no del estilo carpeta/membrete.
- **Estilo:** `rounded-[3.5rem]`, sans, **sin dark mode**.

### 7. `AlineacionDetalleModal`
- **Archivo:** `.../modals/AlineacionDetalleModal.jsx`
- **Trigger:** `AlineacionOrganizacionalTab` — ver el detalle campo a campo de la comparación MOV_POS vs. EMPLEADOS_COMPLETOS_SIG.
- **Qué muestra:** tabla de 4 columnas (campo, valor A, valor B, coincide) con resaltado en rojo de discrepancias.
- **Patrón:** `createPortal` + `motion/react` con `AnimatePresence`.
- **Estilo:** `rounded-2xl`, backdrop `slate-950/75`, dark mode sí, franja de acento con `GitCompareArrows` en gradiente guinda.

### 8 y 9. `EmpleadoTimelineModal` / `PosicionTimelineModal`
- **Archivos:** `.../modals/EmpleadoTimelineModal.jsx`, `.../modals/PosicionTimelineModal.jsx`
- **Trigger:** ambos desde `MovimientosPersonalTab`.
- **Qué muestran:** timeline vertical de movimientos de un empleado (con vista alterna de tabla) / timeline de ocupantes históricos de una posición.
- **Patrón:** `createPortal` + **`framer-motion` importado directo** (`from "framer-motion"`), a diferencia de la mayoría que usa el alias `motion/react` — inconsistencia también a nivel de import, aunque renderiza igual.
- **Estilo:** `rounded-[2.5rem]`, backdrop `slate-950/70` blur-md, dark mode sí, línea de tiempo con puntos animados (`animate-ping`).

### 10. `AdvancedFiltersModal`
- **Archivo:** `.../shared/AdvancedFiltersModal.jsx`
- **Trigger:** botón "Filtros Avanzados" en varios tabs de plantilla.
- **Qué muestra:** constructor de condiciones de filtro (columna/condición/valor con lógica AND/OR).
- **Patrón:** `createPortal` + `motion/react`. Categoría **utilitario**.
- **Estilo:** `rounded-2xl`, dark mode sí, el más "plano"/funcional de los utilitarios (sin gradientes ni iconografía grande).

### 11. `CeldaHistorialModal`
- **Archivo:** `.../shared/CeldaHistorialModal.jsx`
- **Trigger:** `PlantillaDetalleTab` — auditoría de ediciones manuales sobre `EMPLEADOS_COMPLETOS_SIG`.
- **Qué muestra:** stat cards (total cambios, vigentes, sobrescritos, etc.) + lista paginada de cambios con antes/después.
- **Patrón:** `createPortal` + `motion/react`.
- **Estilo:** bg `slate-50`/slate-950, `rounded-[2.5rem]`, dark mode sí, `max-w-6xl` (uno de los más anchos).

### 12. `ColumnsModal`
- **Archivo:** `.../shared/ColumnsModal.jsx`
- **Trigger:** varios tabs de plantilla, botón "Configurar columnas" genérico (distinto del selector interno de `EmployeesModal.jsx`, que es otra implementación separada del mismo concepto).
- **Patrón:** `createPortal` + `motion/react`. Utilitario.
- **Estilo:** `rounded-[2.5rem]`, dark mode sí.

### 13. `CatalogRecordModal`
- **Archivo:** `.../catalogos-estructura/CatalogRecordModal.jsx`
- **Trigger:** `CatalogosEstructuraTab` — crear/editar/borrar registros de catálogo.
- **Patrón:** `Dialog` primitive **sin** el estilo carpeta/membrete (usa el `DialogContent` genérico, `sm:max-w-lg`, sin `LetterheadBar` ni bordes dashed).
- **Estilo:** el único modal con `Dialog` primitive que NO sigue el estilo membrete — form plano, sin gradientes, sin dark mode explícito en las clases de texto (usa `text-gray-500` fijo).

### 14. `PrioridadNivelJerarquicoModal`
- **Archivo:** `.../catalogos-estructura/PrioridadNivelJerarquicoModal.jsx`
- **Trigger:** `NivelesJerarquicosPlazaSubtab` — advertencia antes de sobrescribir datos en producción.
- **Patrón:** `createPortal` + `motion/react`. Utilitario (confirmación).
- **Estilo:** `rounded-[2.5rem]`, acento **ámbar** (`amber-500/600`) en vez de guinda/dorado — paleta de advertencia distinta al resto del sistema, dark mode sí.

### 15. `DetalleVacantesModal`
- **Archivo:** `.../tabs/cuadros-vacancia/DetalleVacantesModal.jsx`
- **Trigger:** `DesgloseJerarquicoCharts.jsx` y `DetalleVacantesTablas.jsx`, ambos usados dentro de `CuadrosVacanciaTab` (confirma la mención del usuario de "modals" en ese tab: es un único componente reutilizado dos veces, no dos modals distintos).
- **Qué muestra:** tabla de posiciones con columnas configurables y ordenamiento.
- **Patrón:** `createPortal` simple, **sin motion/framer** (única transición es `transition-all duration-300` CSS).
- **Estilo:** `rounded-2xl`, header con degradado **azul marino `#10243e→#1a3b63`** — paleta completamente ajena al resto del sistema (ni guinda `#621f32` ni dorado `#bc955c` como protagonistas, aunque el dorado aparece de acento). Bordes de celda `border-[#bc955c]/20` en vez de `border-slate-*` como el resto.

### 16–19. Modals inline de `organigrama/page.jsx`
- **Archivo:** `app/dashboard/organigrama/page.jsx` (2500+ líneas, todos los modals están inline en el mismo archivo).
- **"Detalle de nodo" (~L2265):** trigger al hacer click en un nodo del árbol organizacional. Muestra/edita datos de la unidad administrativa (departamento, descripción, titular/superior). Es el modal de detalle más visible del módulo de organigrama y el que más se aleja del resto del sistema.
- **Patrón:** custom `fixed inset-0`, **sin** `createPortal`, **sin** motion — solo CSS.
- **Estilo:** `rounded-3xl`, barra superior con degradado **`rose-800→rose-700→amber-500`** — paleta rosa/ámbar que no corresponde a la guinda/dorado (`#621f32`/`#bc955c`) usada en el resto del sistema; iconos SVG inline en vez de `lucide-react` para el botón de cerrar.
- **"Confirmar borrado" (~L2445), "Crear nueva Dirección General" (~L2512), modal de exportar PDF (~L2480):** utilitarios (confirmación/formulario/loading), mismo patrón custom sin portal ni motion, `rounded-2xl`, paleta rose.

### 20–21. Modals inline de `monitoreo_zafiro/ClientComponent.jsx`
- **"Custom Confirmation Modal" (~L801):** confirmación antes de lanzar sincronización manual con ZAFIRO. Utilitario.
- **"Modal de logs/errores" (~L879):** trigger al hacer click en una fila del historial de sincronizaciones; muestra el detalle del log/error de esa corrida. Es detalle.
- **Patrón (ambos):** custom `fixed inset-0` + `motion/react`.
- **Estilo:** `rounded-2xl`, dark mode sí, pero con **tipografía `font-mono` en títulos y badges** — único lugar del sistema que usa monoespaciada para texto de UI en vez de solo para datos/códigos.

### 22. "Detalle de Posición" (duplicado en `BajasTab` y `MovimientosTab`)
- **Archivos:** `BajasTab.jsx` (~L1255), `MovimientosTab.jsx` (~L1838) — implementaciones separadas y casi idénticas, no un componente compartido.
- **Trigger:** ver historial de una posición con pestañas "Tabla" / "Línea del Tiempo" / "Comparar".
- **Patrón:** custom `fixed inset-0` + `motion/react`.
- **Estilo:** **`rounded-none`** (esquinas totalmente rectas) — el único caso de todo el inventario sin ningún border-radius en el panel principal. Contrasta fuerte contra el resto (`rounded-2xl` a `rounded-[3.5rem]`).

### 23. "Detalle de Celda" (duplicado 4 veces)
- **Archivos:** `BajasTab.jsx` (~L1446), `MovimientosTab.jsx` (~L2413), `PlantillaDetalleTab.jsx` (~L1632), `MovimientosPersonalTab.jsx` (~L2476).
- **Trigger:** ver el valor completo de una celda de tabla (cuando el texto está truncado).
- **Qué muestra:** columna + valor completo en un bloque de texto.
- **Patrón:** custom `fixed inset-0` + `motion/react`, prácticamente copy-paste entre los 4 tabs (mismo JSX, mismas clases).
- **Estilo:** `rounded-[2rem]`, `max-w-lg`, dark mode sí. Candidato obvio a extraerse como componente compartido antes/durante la homogenización, ya que hoy son 4 copias divergiendo silenciosamente.

### 24. "Cadena de Mando" (inline)
- **Archivo:** `PlantillaDetalleTab.jsx` (~L1413)
- **Trigger:** explorar la jerarquía operativa de una posición (buscador con autocompletar).
- **Patrón:** custom `fixed inset-0` + `motion/react`.
- **Estilo:** bg `slate-50`/slate-950, `rounded-[2.5rem]`, dark mode sí, `max-w-6xl`.

### 25–28. Modals inline de `EstatusTab.jsx`
- **"Desglose por Nivel" (~L765):** trigger al hacer click en una UA; muestra tabla de niveles con exportación a Excel. Detalle.
- **"Generando Reporte" (~L697):** loading modal durante exportación. Utilitario.
- **"Exportar Unidades Administrativas" (~L905)** y **selector de niveles (~L1035):** selectores de checkboxes para armar el reporte a exportar. Utilitarios.
- **Patrón (todos):** mezcla de `createPortal` + `motion/react` (los selectores) y custom `fixed inset-0` sin portal (el de "Generando Reporte", que vive dentro del mismo árbol JSX en vez de portal).
- **Estilo:** todos `rounded-[2rem]`, dark mode sí — el subgrupo más internamente consistente del archivo, pero sigue divergiendo del resto del sistema (ni carpeta/membrete ni `rounded-[3.5rem]`).

### 29. "Detalle de Vacancia" (inline)
- **Archivo:** `MovimientosTab.jsx` (~L2088)
- **Trigger:** click en un badge de vacancia dentro de la tabla de movimientos.
- **Qué muestra:** categoría de vacancia, posición, motivo — con franja superior de color dinámico según `VACANCIA_CATEGORIA_STYLE`.
- **Patrón:** `createPortal` + `motion/react`.
- **Estilo:** `rounded-[2rem]`, `max-w-lg`, dark mode sí.

### 30. "bitacora-date-modal" (inline)
- **Archivo:** `MovimientosPersonalTab.jsx` (~L188)
- **Trigger:** filtro de fechas de la bitácora de movimientos.
- **Patrón:** `createPortal` + `motion/react`. Utilitario (selector).
- **Estilo:** único modal del inventario con comportamiento de **bottom sheet en móvil** (`rounded-t-3xl`, se ancla a `items-end` en pantallas chicas) y modal centrado en desktop — patrón responsive que ningún otro modal del sistema replica, aunque sería deseable si se homogeniza para mobile.

---

## Resumen de inconsistencias

1. **Cuatro familias de "primitiva" de modal distintas y sin puente entre ellas:**
   - `Dialog` de `@/components/ui/dialog` (Radix-based): #3, #4, #5, #6, #13.
   - `createPortal` + `motion/react` (framer-motion vía alias): la mayoría de los modals nuevos (#7, #10, #11, #12, #14, #21, #25-30, etc.).
   - `createPortal` + `framer-motion` importado directo (mismo paquete, import distinto): #8, #9.
   - Custom `fixed`/`absolute` sin portal y sin motion, solo CSS: #1, #16-19 (organigrama), el "Generando Reporte" de EstatusTab, `DetalleVacantesModal` (#15, portal sin motion).

2. **Al menos 6 border-radius distintos usados como "el" radio del panel principal:** `rounded-none` (#22), `rounded-2xl` (#1, #7, #15, #20/21), `rounded-[2rem]` (#23, #25-29), `rounded-[2.5rem]` (#8, #9, #11, #12, #24), `rounded-[28px]` (#3-5), `rounded-3xl` (#16-19), `rounded-[3.5rem]` (#2, #6). No hay un valor dominante claro.

3. **Al menos 4 paletas de color distintas para el panel/acento**, cuando el sistema tiene una paleta institucional clara (`#621f32` guinda / `#bc955c` dorado):
   - Guinda/dorado (la mayoría, correcto).
   - Ámbar puro (#14, advertencias — podría justificarse semánticamente pero no está unificado con otros "warning").
   - Rosa/ámbar (`rose-800`/`amber-500`) en todo `organigrama/page.jsx` (#16-19) — no usa la paleta institucional en absoluto.
   - Azul marino (`#10243e`/`#1a3b63`) en `DetalleVacantesModal` (#15) — tampoco usa la paleta institucional.

4. **Soporte de dark mode inconsistente:** #1, #2, #6 (los 3 modals con estilo "carpeta antigua"/`OficioDetailModal`) **no tienen dark mode**; el resto de los modals creados después sí lo tiene. Si el sistema global soporta dark mode, estos 3 quedan rotos o forzando modo claro.

5. **Tipografía:** la mayoría usa sans-serif de sistema; los modals #3, #4, #5 (estilo membrete) usan `font-serif` deliberadamente para simular un "expediente/documento oficial"; los modals de `monitoreo_zafiro` (#20, #21) usan `font-mono` en títulos — 3 identidades tipográficas conviviendo sin razón funcional compartida.

6. **Backdrop sin estandarizar:** valores vistos incluyen `bg-white/50`, `bg-black/60`, `bg-slate-950/40`, `bg-slate-950/60`, `bg-slate-950/70`, `bg-slate-950/75`, `bg-slate-950/80`, `bg-slate-900/60`, `bg-slate-900/70`, con blur variando entre `blur-sm`, `blur-md` y `blur-[2px]`.

7. **Cuatro copias divergentes del mismo componente** ("Detalle de Celda", #23) en 4 tabs distintos en vez de un componente compartido — riesgo de que ya hayan divergido en comportamiento sin que nadie lo note.

8. **Dos implementaciones independientes de "Detalle de Posición" con historial** (#22, en `BajasTab` y `MovimientosTab`) con el mismo propósito pero código separado.

9. **Dos implementaciones independientes de "selector de columnas"** con propósito idéntico: `ColumnsSelectorModal` (interno de `EmployeesModal.jsx`, estilo carpeta) y `ColumnsModal.jsx` (compartido, estilo `motion/react` + `rounded-[2.5rem]`) — mismo problema que #23 pero a nivel de componente completo, no solo de copy-paste.

10. **z-index sin escala coherente:** valores observados van de `z-50` a `z-[9999999]` (literal, en `DetalleVacantesModal`), pasando por `z-[100]`, `z-[110]`, `z-[120]`, `z-[150]`, `z-[9000]`, `z-[9999]`, `z-[100000]`, `z-[100000000]`... — no hay una escala de capas definida, cada modal inventa su propio número para "asegurarse" de quedar encima.

11. **Uno de los 30 (`MovimientosPersonalTab`, "bitacora-date-modal", #30) ya implementa un patrón responsive (bottom sheet en móvil)** que ningún otro modal replica — vale la pena evaluarlo como base para la versión mobile del estándar homogenizado, en vez de descartarlo.

12. **Único caso sin border-radius** (`rounded-none`, #22 en Bajas/Movimientos) rompe visualmente contra absolutamente todo el resto del sistema, que en menor o mayor grado siempre redondea el panel.

No se propone aquí la solución de homogenización — queda pendiente decidir con el usuario cuál de estos patrones (o uno nuevo) se adopta como estándar único.
