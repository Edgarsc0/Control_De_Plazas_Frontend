# Reporte QA — Módulo "Plantilla Empleados" (Eje Central Front)

**Fecha:** 2026-07-18
**Entorno probado:** `http://89.116.51.124:3030/dashboard/plantilla_empleados` (build productivo, HTTP plano)
**Usuario:** SuperAdmin (`sanchez.catarino.edgar2005@gmail.com`)
**Método:** pruebas E2E manuales con `playwright-cli` (viewport 1920×1080) + revisión de código fuente. 51 capturas de evidencia generadas durante la sesión.
**Alcance:** tabs Plantilla Detalle, Estatus Nómina (Por Nivel / Por UA), Mov. Posiciones (Tabla Principal / Cuadros Vacancia / Comprobar Alineación), Movimientos (Personal / Bitácora), Empleados Bajas; componentes compartidos `ColumnsModal.jsx` y `DataTable.jsx`.

---

## 1. Resumen ejecutivo

El módulo es funcional y sorprendentemente completo: filtrado estilo Excel, virtualización, headers agrupados, drill-downs, exportaciones y auditoría funcionan. **No se encontró ningún crash ni pérdida de datos.** Los hallazgos se concentran en:

| Categoría | Cantidad |
|---|---|
| Bugs funcionales (alta prioridad) | 4 |
| Bugs funcionales (media prioridad) | 6 |
| Bugs visuales / de consistencia | 6 |
| Anomalías de datos a investigar | 4 |
| Recomendaciones UX | 15 |
| Propuestas de negocio | 10 |

Lo más urgente: **búsqueda/filtros sensibles a acentos** (los usuarios pierden registros reales al buscar), **dropdown de condición de filtro recortado** (2 de 8 condiciones inaccesibles) y **orden lexicográfico de niveles** en Estatus Nómina.

---

## 2. Bugs funcionales — ALTA prioridad

### BUG-01 · Búsqueda y filtros sensibles a acentos (pérdida de resultados)

- **Dónde:** búsqueda global, filtros de texto por columna y buscador del modal de columnas — todos los tabs.
- **Reproducción:** en Plantilla Detalle, filtrar columna Nombres con `cesar` → **88 registros**; con `césar` → **4 registros**. Búsqueda global: `cesar` → 90, `césar` → 4. Los 4 "César" (con tilde) no aparecen al buscar sin tilde, y viceversa. En el modal de columnas, buscar `nom` NO encuentra "Estado **Nóm**ina".
- **Causa raíz:** `src/utils/columnFilters.js` ya tiene `normalizeForSearch()` (NFD + strip diacríticos, línea 94), pero:
  - `applyAllFilters()` llama `matchesTextCondition()` **sin** `{ normalize: true }` (línea ~295).
  - La búsqueda global usa `toLowerCase()` plano (líneas 278–283).
  - `ColumnsModal.jsx:27` usa `toLowerCase()` plano.
- **Fix sugerido:** pasar `{ normalize: true }` en `applyAllFilters` y usar `normalizeForSearch` en búsqueda global y en el filtro del modal. Riesgo bajo: la utilidad ya existe y está probada.
- **Impacto:** usuarios de RH buscan por nombre; los nombres en BD mezclan con/sin tildes ("Cesar" y "César" coexisten). Resultados incompletos silenciosos = decisiones con datos incompletos.

### BUG-02 · Dropdown de condición de filtro recortado: "Es igual a (=)" y "Diferente de (!=)" inaccesibles

- **Dónde:** `DataTable.jsx:422–443` (fila de filtros del header, todos los tabs que usan DataTable).
- **Reproducción:** filtrar Nombres para que queden pocas filas (p.ej. `césar` → 4). Abrir el botón de condición (`*`) del filtro. El dropdown de 8 opciones se recorta: contenedor con scroll termina en y=887px, "Es igual a (=)" queda en y=904 y "Diferente de (!=)" en y=927 → **invisibles e inclickeables**. Como el dropdown está anclado al header sticky, scrollear la tabla no lo revela jamás.
- **Causa raíz:** el dropdown es `absolute top-full` dentro del `<th>`, y el ancestro `overflow-auto` lo recorta.
- **Fix sugerido:** renderizarlo con `createPortal` a `document.body` (como ya hace `ColumnsModal`) o `position: fixed` calculado con el rect del botón.

### BUG-03 · Estatus Nómina: niveles ordenados lexicográficamente

- **Dónde:** `EstatusTab.jsx` líneas 360, 374, 388, 410, 748 — `Object.keys(...).sort()` plano.
- **Reproducción:** en "Estatus de Nómina por Nivel" el orden de tarjetas es `11, 2, 3, 5, 6, 7, 8, A101…` ("11" antes que "2"). Mismo defecto en el drill-down por UA ("11, 6, 7, A110, D209…").
- **Fix sugerido:** `sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))` — el patrón ya existe en `columnFilters.js → sortValueCounts()`.

### BUG-04 · Modal de columnas permite dejar la tabla sin columnas, sin aviso ni salida evidente

- **Dónde:** `ColumnsModal.jsx` (`onHideAll`) + `DataTable.jsx` (sin estado para 0 columnas visibles).
- **Reproducción:** Columnas → "Borrar todas" → Confirmar. La tabla queda solo con `#` y `VER`, sin filas de filtro, sin mensaje, sin CTA. Un usuario no técnico percibe "se rompió la tabla".
- **Fix sugerido:** (a) impedir ocultar la última columna visible, o (b) empty-state en `DataTable` cuando `visible.length === 0` con botón "Configurar columnas".

---

## 3. Bugs funcionales — MEDIA prioridad

### BUG-05 · Selección de celda es posicional: tras refiltrar/ordenar apunta a otro registro

- **Dónde:** `selectedCell = {row: idx, col: idx}` (hooks de selección + `DataTable`).
- **Evidencia:** seleccioné G4 = "Promoción"; tras aplicar el filtro de tarjeta "Vacante" el chip indicador siguió diciendo "G4" pero ahora "Val: **Alineación Organizacional**" — otro registro, sin que el usuario lo note.
- **Fix sugerido:** limpiar selección al cambiar filtros/orden, o anclar selección a id de fila (posición) y recalcular el índice.

### BUG-06 · Filtros avanzados: la lista de sugerencias de valor no se cierra al hacer click fuera y tapa "Aplicar Filtros"

- **Reproducción:** Filtros Avanzados → columna Nombres → escribir `garcia`. Aparece autocomplete con conteos (bien), pero cubre "Agregar condición" y "Aplicar Filtros"; clicks fuera de la lista no la cierran; la única forma es elegir una sugerencia. Lo mismo en Cadena de Mando: tras buscar con Enter, la sugerencia queda abierta encima del resultado.
- **Fix sugerido:** cerrar con click-outside (backdrop transparente como el del dropdown de condición) y al hacer submit.

### BUG-07 · Escape no cierra la mayoría de los modales (inconsistente)

- **Cierra con Escape:** Expediente ("Expediente de Plaza"), dropdowns de filtro.
- **NO cierra con Escape:** Configurar Columnas, Cadena de Mando, Historial de Cambios, Desglose por Nivel (drill-down UA), Historial de Ocupantes.
- Grep confirma: solo `DataTable`, `AdvancedFiltersModal` y `ColumnFilterDropdown` manejan `Escape` en `_components/shared/`.
- **Fix sugerido:** handler de `Escape` + click en backdrop en todos los modales (el backdrop ya cierra en varios; Escape no).

### BUG-08 · Mov. Personal: tarjeta "Total de Movimientos" (151,477) ≠ Registros de la tabla (151,478)

- **Dónde:** `MovimientosPersonalTab.jsx:381–383` — `pieTotal` = suma de `activeStatsList` (endpoint de stats agrupado por acción); la tabla usa el total de filas.
- **Causa probable:** 1 movimiento con acción nula/vacía que el endpoint de stats excluye del agrupamiento.
- **Fix sugerido:** en el backend, incluir bucket "(Sin acción)"; o en el front, mostrar el mismo total en ambos lados. Además vale identificar y corregir ese registro huérfano.

### BUG-09 · Comprobar Alineación: tarjetas de resumen no son interactivas (inconsistencia)

- En Plantilla Detalle las tarjetas (Activo/Vacante/…) filtran la tabla al hacer click. En Comprobar Alineación, "CON DIFERENCIAS 745" no hace nada — el usuario tiene que descubrir el dropdown "Diferencia en campo" (que sí funciona: Nivel Jerárquico → 11 registros).
- **Fix sugerido:** click en tarjeta = filtro `estado_alineacion`. Mismo patrón mental en todo el módulo.

### BUG-10 · Bitácora: tarjeta "Total de Movimientos: 0" junto a gráfica global de 151,477

- Al entrar a "Bitácora de Movimientos" (hoy sin capturas), la tarjeta del pie/card queda en "0 movimientos / 0 acciones distintas", mientras que la vista "En el tiempo (Barras)" muestra el total histórico 151,477. Dos datasets distintos presentados como uno.
- Además la fecha de bitácora (`2026-07-18`) **no es editable**: no hay forma de consultar la bitácora de días anteriores desde la UI.

---

## 4. Bugs visuales / de consistencia

| # | Hallazgo | Dónde | Detalle |
|---|---|---|---|
| V-01 | Ticks del eje Y muestran "00" | `DesgloseJerarquicoCharts.jsx:276–282` (Cuadros Vacancia → Desglose de Vacantes) | `YAxis width={35}` recorta "600"→"00". Subir a ~45 o `tickFormatter` compacto. |
| V-02 | Eje X del sparkline "Historial de Bajas" ilegible | `BajasTab.jsx` | Fechas "25/03/2026…" solapadas en una sola línea continua. Mostrar 4–6 ticks espaciados. |
| V-03 | Eje X de "Histórico de Ocupación" categórico con intervalos temporales desiguales | Cuadros Vacancia | 01/Ene/2025 → 01/Ene/2026 ocupa el mismo espacio que quincenas consecutivas: distorsiona tendencia. |
| V-04 | Labels crudos de columnas extra | ColumnsModal en Plantilla Detalle | "ua", "ua2", "cent", "jd", "depto", "nombreNJ" en minúsculas junto a "TIPO DE CONTRATACIÓN" en mayúsculas. Mapear a etiquetas humanas. |
| V-05 | Botón "Confirmar Selección" en modal de columnas | `ColumnsModal.jsx:125–130` | Los cambios aplican en vivo; el botón solo cierra. Renombrar a "Cerrar" / "Listo". |
| V-06 | Motivos de baja con asterisco (`Cese de Nombramiento*`) sin nota al pie | Empleados Bajas | El asterisco no se explica en ninguna parte visible. |

---

## 5. Anomalías de DATOS a investigar (no son bugs de front)

1. **Fecha de captura un año anterior a la efectiva, masivo:** decenas de filas con `Fecha efectiva 2026-04-01` y `Fecha de captura 2025-04-07` (motivo "Cambio Dep. Directa/Indirecta"). Patrón exacto de −1 año + 6 días sugiere error de año en la carga, no coincidencia.
2. **Expediente de plaza vacante:** "FECHA INGRESO: **Vacante**" (texto de estatus dentro de un campo fecha) y "ESTATUS NÓMINA: —" vacío. Mapeo de campos invertido para plazas vacantes.
3. **Historial de Ocupantes:** ocupante con inicio **futuro** (1 ago 2026, hoy 18 jul) ya etiquetado "OCUPANTE ACTUAL / Presente". Efectividad futura debería mostrarse como "Programado".
4. **Ruido en Historial de Cambios:** entradas `(vacío) → (vacío)` y `"Jorge Luis Ibarra Torres" → "Jorge Luis Ibarra Torres"` (cambio idéntico, probablemente whitespace) registradas como VIGENTE. Filtrar no-cambios al guardar auditoría.

Además: `GET /gobierno` y `/tramites` devuelven **404** (prefetch de links del template gob.mx del navbar superior) y hay warning de preload CSS sin uso — ruido en consola en cada carga.

---

## 6. Veredicto de los componentes solicitados

### `ColumnsModal.jsx` — **Funciona correctamente** con 4 detalles

Probado: abrir/cerrar, búsqueda, toggle individual, "Mostrar todas", "Borrar todas", aplicación en vivo sobre la tabla, grid responsivo, empty-state de búsqueda. Todo OK.
Defectos: búsqueda sin normalizar acentos (BUG-01), permite 0 columnas (BUG-04), no cierra con Escape (BUG-07), wording "Confirmar Selección" (V-05) y labels crudos (V-04). Ningún error de estado ni de render.

### `DataTable.jsx` — **Funciona correctamente** con 3 defectos y 2 notas

Probado: doble fila de header sticky + columnas sticky (#/VER), letras de columna estilo Excel, sort asc/desc (texto y fechas correcto), filtros de texto con condición, filtro de valores (checkboxes con conteos), limpiar filtros (X), resize handles presentes, virtualización (spacers arriba/abajo correctos con 10k+ filas), navegación con flechas + aceleración, menú contextual copiar/pegar/borrar, header agrupado (Comprobar Alineación: "T" por grupo renderiza bien), skeleton loader, empty-state.
Defectos: dropdown de condición recortado (BUG-02), selección posicional (BUG-05), y el mensaje inteligente de empty-state (`DataTable.jsx:478`) solo cuenta `columnFilters`+`textFilters` — ignora filtro de tarjeta, búsqueda global y filtros avanzados, por lo que casi siempre cae al mensaje genérico.
Notas: (1) el fallback `onRowClick` (líneas 242–246) depende de `selectedCell?.col`, así que cada cambio de selección invalida el memo de TODAS las `TableRow` — funciona, pero anula parte del beneficio del memo; (2) clases `z-25` no son Tailwind estándar (verificar que estén en el config o safelist).

### Extra verificado: `CopyCellMenu.jsx` — el toast "Se ha copiado" es legítimo

Sobre HTTP plano `navigator.clipboard` no existe; el componente ya tiene fallback con `document.execCommand("copy")` y pegado vía evento nativo. Correcto.

### Extra verificado: Cadena de Mando — **SÍ funciona**

Falsa alarma inicial (el click de prueba cayó en el "Buscar" del navbar). Con submit real: `GET /api/plantilla/cadena_mando/?q=10300116` → 200 y render de la jerarquía completa (Cúspide → Mandos → Empleado consultado). Solo aplica BUG-06 (sugerencias abiertas tapando el resultado tras Enter).

---

## 7. Recomendaciones de UX

1. **Normalización de acentos en todo** (BUG-01) — el fix de mayor ROI del reporte.
2. **Chips de filtros activos** sobre la tabla (columna+condición+valor, con "x" individual). Hoy el único indicio es el punto blanco del header y hay hasta 4 mecanismos de filtro simultáneos (tarjeta, global, columna, avanzados) invisibles entre sí.
3. **Persistir configuración por usuario** (columnas visibles, anchos, filtros, orden) en `localStorage` — hoy todo se pierde al recargar.
4. **"Restablecer Filtros" debería volver al estado inicial del tab** (Activo, 10,068), no a "sin filtros" (11,451). O dos acciones: "Quitar todos" / "Restaurar vista por defecto".
5. **Selector de fecha en Bitácora** + acceso al histórico de días anteriores; si el día está vacío, mostrar "Sin capturas hoy — última actualización 17/07 20:11" con CTA al día previo.
6. **Chip "Históric" clickeable en Mov. Posiciones** → abrir `PosicionTimelineModal` (en Movimientos el ícono de histórico sí existe; en Mov. Posiciones el número es un `span` muerto).
7. **Drill-down cruzado:** click en un donut de Estatus Nómina → Plantilla Detalle prefiltrado por nivel/UA/estatus. Hoy son islas.
8. **Export con feedback:** el botón Excel con 151k filas necesita spinner/progreso y estimación (hoy no hay indicación de que algo pasa).
9. **Formato de fechas es-MX consistente** (tabla muestra `2026-04-01`, historial "1 ago 2026", bitácora `2026-07-18`). Unificar `DD/MM/AAAA` o `D mmm AAAA`.
10. **Accesibilidad:** `role="dialog"` + `aria-modal` + focus-trap en modales; los headers de tabla no son alcanzables por teclado (sort solo con mouse); contraste del texto `text-[9px]` gris sobre blanco.
11. **Tooltips en truncados:** headers como "FECHA EFECTIVA (PERSON" y mini-cards "Dependen…" truncan sin `title`.
12. **Números de página navegables** en paginaciones server-side (PÁG 1 DE 3030 solo tiene ‹ ›; saltar a página N / última).
13. **Mensaje de empty-state que cuente TODOS los filtros activos** (ver DataTable arriba) y ofrezca "Quitar último filtro".
14. **Doble confirmación en "Borrar contenido de celda"** del menú contextual (es destructivo, está a un click del "Copiar") y verificar que quede en Historial de Cambios.
15. **Unificar patrón de tarjetas-filtro** (BUG-09): toda tarjeta de resumen debería filtrar o declararse estática visualmente (sin hover/cursor-pointer).

---

## 8. Qué agregaría según la lógica de negocio

1. **Alertas de vacancia prolongada:** las plazas vacantes ya tienen "Fecha de Vacancia" y "Categoría Vacancia" (A/B). Un panel "vacantes > 90 días" con responsable de UA daría accionabilidad inmediata al cuadro de vacancia.
2. **Panel "salidas próximas":** la columna "Fecha prevista de salida" existe (ej. 2026-10-15) pero nada la explota. Lista de próximos 30/60 días para planear reemplazos.
3. **Delta quincenal:** "¿qué cambió desde la quincena pasada?" — altas, bajas, movimientos y variación de ocupación por UA, aprovechando el histórico de Cuadros de Vacancia. Es la pregunta que un director hace primero.
4. **KPI de rotación en Bajas:** bajas ÷ plantilla promedio por UA/periodo, con comparativo entre aduanas; hoy Bajas solo lista y grafica volumen absoluto.
5. **Cadena de mando descendente:** hoy solo sube ("hacia arriba"). Ver subordinados directos e indirectos de una posición + export del árbol completaría el explorador.
6. **Puestos críticos sin sucesión:** cruzar cadena de mando con vacantes — posiciones de mando cuyo único reporte está vacante o próximo a salir.
7. **Validaciones de captura en backend:** fecha de captura > 1 año antes de la efectiva (anomalía §5.1), movimiento sin acción (BUG-08), nombres duplicados con/sin tilde — reglas que eviten que el dato sucio llegue al front.
8. **Semáforo de alineación embebido:** el % de alineación (93.5%) vive escondido en un subtab; un badge por UA en Plantilla Detalle ("⚠ 12 plazas desalineadas en esta UA") conectaría ambos mundos.
9. **Suscripciones/notificaciones:** correo o campana con la bitácora diaria (movimientos capturados ayer) para roles de supervisión, dado que la bitácora de "hoy" suele estar vacía por el desfase de carga.
10. **Auditoría con diff limpio:** descartar cambios `X→X` y `(vacío)→(vacío)` al escribir (anomalía §5.4), y agregar filtro por posición/usuario/campo con export — hoy el historial es bueno para ver, difícil para investigar.

---

## 9. Cobertura de la sesión de pruebas

| Área | Probado | Resultado |
|---|---|---|
| Plantilla Detalle: tarjetas de estatus, búsqueda global, filtros de texto+condición, filtro de valores, sort, limpiar/restablecer, selección+teclado, menú contextual, expediente, columnas, filtros avanzados, cadena de mando, historial de cambios | ✅ | 8 bugs, resto OK |
| Estatus Nómina: Por Nivel (search, paginación), Por UA (drill-down a niveles) | ✅ | BUG-03, resto OK |
| Mov. Posiciones: Tabla Principal, Cuadros Vacancia (expandir histórico, gráficas), Comprobar Alineación (header agrupado, diferencia en campo, paginación) | ✅ | BUG-09, V-01..V-03 |
| Movimientos: Personal (pie, barras por año, paginación 3030 págs, histórico de posición), Bitácora | ✅ | BUG-08, BUG-10 |
| Empleados Bajas: donut de motivos, sparkline, sort por fecha, tabla | ✅ | V-02, V-06 |
| No probado | Descargas Excel/PDF/Word reales (no se descargaron archivos), edición inline de celdas y "Borrar contenido" (destructivo en producción), Distribución Geográfica y Catálogos (fuera de alcance solicitado), vista móvil | — |

**Evidencia:** 51 capturas en el scratchpad de la sesión (`.../scratchpad/evidencia/shot*.png`).
