# Mejoras UX — Filtro de columna estilo Excel

Componente: `src/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown.jsx`
Objetivo: acercar el comportamiento al filtro de columna de Excel (AutoFilter).

> **Actualización 2026-07-15:** sesión de pruebas en vivo con `playwright-cli` sobre los tabs `plantilla-detalle`, `mov-posiciones`, `movimientos`, `bajas` y `catalogos-estructura` (los 5 usos reales del componente; `estatus` y `mapa` no lo usan). Revisar estado de cada punto abajo y la sección **Hallazgos sesión 2026-07-15** al final con bugs nuevos + plan de implementación.

## 1. Orden de valores: seleccionados arriba

**Hoy:** `sliced` llega en el orden que calcule `dropdownValues` en cada tab (probablemente orden de aparición/alfabético plano), sin distinguir seleccionados.

**Propuesta:** ordenar la lista con los valores ya presentes en `tempSelectedValues` primero (grupo "seleccionados", orden alfabético/numérico interno), luego el resto también ordenado. Se recalcula solo cuando cambia el set de datos o se abre el dropdown — **no** en cada click de checkbox, para que el ítem no "salte" de posición mientras el usuario sigue marcando opciones (eso rompe la experiencia en Excel real: el salto ocurre al reabrir el filtro, no mientras interactúas).

Cambio va en el `useMemo` que arma `dropdownValues` (en el tab), no en este componente — pasar ya el arreglo pre-ordenado, congelado al abrir.

## 2. Checkbox "Seleccionar Todo" con estado indeterminado [RESUELTO]

**Hoy:** `isAllSelected` es binario (líneas 234-236). Si hay selección parcial no hay pista visual, solo se infiere por los checks individuales.

**Propuesta:** añadir estado "parcial" (guion `-` en vez de check), igual al patrón que ya existe para año/mes en el árbol de fechas (`isYearPartial`, líneas 151, 162). Reutilizar el mismo bloque visual para consistencia.

## 3. "Seleccionar Todo" debe operar sobre lo filtrado por búsqueda, no sobre el universo completo [RESUELTO]

**Hoy:** revisar si `allVals` representa todos los valores de la columna o solo los que matchean `filterSearchText`. Comportamiento Excel: al escribir en el buscador y tocar "Seleccionar Todo", solo selecciona/deselecciona los valores **visibles** (los que matchean la búsqueda), dejando intacta la selección de los que quedaron ocultos.

**Propuesta:** confirmar que `allVals`/`sliced` ya reflejan el filtro de texto (`filterSearchText` + `filterSearchCondition`); si no, corregirlo. Es la trampa más común al replicar Excel: perder selección de items no visibles al tocar "Todo".

## 4. Cancelar sin aplicar debe descartar cambios [DESCARTADO tras revisión de código 2026-07-16 — falso positivo]

**Hoy:** `onClose` (botón X, click en overlay) solo hace `setActiveFilterDropdown(null)`, no toca `tempSelectedValues`.

**Verificación:** revisados los 7 tabs (`PlantillaDetalleTab`, `MovimientosTab`, `AlineacionOrganizacionalTab`, `BajasTab`, `MovimientosPersonalTab`, `CatalogosEstructuraTab`, `NivelesJerarquicosPlazaSubtab`). En todos, la **única** vía para abrir el dropdown es `openFilterDropdown(colKey)`, y esa función siempre re-sincroniza `tempSelectedValues` desde `columnFilters[colKey]` (o el universo/vacío por defecto) en su rama `else`, sin importar si `activeFilterDropdown` ya estaba en `null` por cierre previo o por un toggle. No existe ningún otro camino que reabra el dropdown sin pasar por ahí. Por lo tanto, aunque `tempSelectedValues` queda "sucio" tras cancelar, nunca se muestra: la siguiente apertura (misma columna u otra) siempre lo pisa con el filtro ya aplicado. No requiere fix — mismo patrón que el bug #16 (falso positivo).

## 5. Buscador: autofocus + botón limpiar (×) [RESUELTO — ver bug nuevo #14, el autofocus permanente causa efecto secundario con el atajo de teclado Espacio]

**Hoy:** input de búsqueda (línea 106) sin autofocus ni botón de limpiar.

**Propuesta:**

- `autoFocus` al montar el dropdown (Excel abre con foco directo en el buscador).
- Icono `×` dentro del input cuando `filterSearchText` no está vacío, para limpiarlo en un click sin seleccionar texto manualmente.

## 6. Resaltar coincidencia de búsqueda en la lista [RESUELTO]

**Propuesta:** cuando `filterSearchText` tiene valor, resaltar (bold o `<mark>`) la subcadena coincidente dentro de cada `value` renderizado (línea 248). Ayuda a escanear listas largas rápido, como buscador de Excel/Sheets.

## 7. Atajos de teclado [RESUELTO parcialmente — ver bug nuevo #14]

**Propuesta:**

- `Escape` → cierra el dropdown (equivalente a click en overlay).
- `Enter` (con foco en buscador o lista) → aplica el filtro (`onApply`).
- `Espacio` con checkbox enfocado → toggle.
- Navegación con flechas arriba/abajo entre valores de la lista (type-ahead: escribir una letra salta al primer valor que empieza con ella, como el picker nativo de Excel).

Hoy el componente no maneja `onKeyDown` en absoluto — es la brecha más grande respecto a Excel real, donde el filtro es totalmente operable sin mouse.

## 8. Contador de selección visible [RESUELTO parcialmente — ver bug nuevo #15, no descuenta por búsqueda]

**Propuesta:** mostrar junto al header o sobre la lista un texto tipo `"12 de 45 seleccionados"`, para que el usuario no tenga que contar checks marcados manualmente en listas largas. Dato ya disponible (`tempSelectedValues.length` vs `allVals.length`).

## 9. Reemplazar el corte a 100 resultados por lista virtualizada [RESUELTO]

**Hoy:** `filteredCount > 100` corta la lista y solo avisa "Mostrando 100 de N resultados. Usa el buscador." (líneas 253-257). Fuerza al usuario a buscar en vez de poder scrollear toda la lista, cosa que Excel sí permite.

**Propuesta:** usar virtualización (ej. `react-window`) para renderizar toda la lista de valores sin límite arbitrario, manteniendo el buscador como atajo pero no como único camino.

## 10. "Seleccionar todo" pegado (sticky) bajo el buscador [RESUELTO]

**Hoy:** el botón "Seleccionar Todo" (líneas 231-238) scrollea junto con la lista larga de valores; en listas largas queda fuera de vista y hay que volver arriba para des/seleccionar todo.

**Propuesta:** fijarlo (`sticky top-0`) justo debajo del buscador, igual que ya está fijo el header completo del modal.

## 11. Orden numérico correcto para columnas numéricas [RESUELTO 2026-07-16]

**Hallazgo real (distinto al sospechado):** los tabs con universo calculado en cliente (`PlantillaDetalleTab`, `BajasTab`, `CatalogosEstructuraTab`, `NivelesJerarquicosPlazaSubtab`, y la pestaña "Todos los datos" de `MovimientosPersonalTab`) ya ordenaban bien vía `getUniqueColumnValues` (`localeCompare(..., {numeric:true})`, que sí trata "2"/"10" correctamente). El bug real estaba en los 3 tabs con valores distintos servidos por el backend (`MovimientosTab`, `MovimientosPersonalTab`, `AlineacionOrganizacionalTab`): el `valuesList` de la respuesta se usaba tal cual, **sin ningún sort** (ni siquiera alfabético) — orden de DB/inserción.

**Fix:** nuevo helper `sortValueCounts(list)` en `columnFilters.js` (mismo criterio `localeCompare(..., {numeric:true})`, reutilizado también dentro de `getUniqueColumnValues`). Se aplica a `valuesList` justo después del fetch en los 3 tabs server-side, sin tocar backend.

## 12. Indicar filtro activo en el botón que abre el dropdown [RESUELTO — el botón del header ya muestra "N valor(es) filtrado(s)"]

**Nota:** esto ya existe parcialmente en `DataTable.jsx` (punto pulsante blanco cuando `hasFilter`, línea 165). Solo agregar el conteo aquí: mostrar cuántos valores están excluidos/incluidos en el tooltip del botón de filtro del header, para que quede consistente con el punto 8.

---

## Prioridad sugerida (impacto / esfuerzo)

| #   | Mejora                      | Impacto              | Esfuerzo                          |
| --- | --------------------------- | -------------------- | --------------------------------- |
| 1   | Seleccionados arriba        | Alto                 | Medio (mover a `useMemo` del tab) |
| 4   | Cancelar descarta cambios   | Alto (bug)           | Bajo                              |
| 3   | "Todo" opera sobre filtrado | Alto (bug potencial) | Bajo (verificar)                  |
| 2   | Checkbox indeterminado      | Medio                | Bajo                              |
| 7   | Atajos de teclado           | Alto (accesibilidad) | Medio                             |
| 5   | Autofocus + botón limpiar   | Medio                | Bajo                              |
| 10  | Sticky "Seleccionar Todo"   | Medio                | Bajo                              |
| 8   | Contador de selección       | Medio                | Bajo                              |
| 6   | Resaltar coincidencia       | Bajo-Medio           | Bajo                              |
| 11  | Orden numérico              | Medio                | Medio                             |
| 9   | Virtualización              | Medio                | Alto                              |

Empezar por 4 y 3 (posibles bugs de correctitud), luego 1 y 2 (lo pedido + lo más "Excel"), el resto son incrementales.

---

## Hallazgos sesión 2026-07-15 (prueba en vivo, playwright-cli)

Cobertura: los 5 tabs que realmente usan `ColumnFilterDropdown` —
`plantilla-detalle/PlantillaDetalleTab`, `mov-posiciones/MovimientosPersonalTab`,
`movimientos/{MovimientosTab,AlineacionOrganizacionalTab}`, `bajas/BajasTab`,
`catalogos-estructura/{CatalogosEstructuraTab,NivelesJerarquicosPlazaSubtab}`.
`estatus` (dashboard de donuts) y `mapa` (mapa geográfico) no usan el componente — confirmado por grep y por UI.

### Bug #13 — Condición de búsqueda se pega entre columnas de la misma tabla [RESUELTO 2026-07-16]

`filterSearchCondition`/`filterSearchText` viven en el hook `useColumnFilters` **una sola vez por tabla**, no por columna (`ColumnFilterDropdown.jsx:80-87`). Si el usuario cambia la condición a "Es igual a (=)" en la columna A y abre el filtro de la columna B, la B hereda la condición "=" de A. No se resetea al cambiar `columnKey` (el `useEffect` de la línea 98 solo resetea `highlightIndex`/`scrollTop`, no la condición ni el texto).

**Repro:** Plantilla Detalle → filtro columna "Posición" → cambiar condición a "=" → cerrar → abrir filtro columna "Motivo" → la condición sigue en "=".

### Bug #14 — Espacio en el buscador rompe el atajo de teclado y produce "Sin resultados" fantasma [RESUELTO 2026-07-16]

El input de búsqueda tiene `autoFocus` (línea 199) y nunca pierde el foco tras navegar con flechas. El atajo `Espacio` para marcar/desmarcar el ítem resaltado (línea 134) solo actúa si `document.activeElement?.tagName !== "INPUT"` — pero el foco sigue en el input, así que `Espacio` en realidad **escribe un espacio invisible** en el buscador. Combinado con el bug #13 (condición "=" heredada), produce "SIN RESULTADOS" sin ninguna pista visual de por qué (la caja se ve "vacía" a simple vista, el carácter espacio no se nota).

**Repro:** abrir cualquier filtro de columna con condición "=" activa (ver bug #13) → flecha abajo → `Espacio` → lista queda en "Sin resultados".

### Bug #15 — El contador "X de Y seleccionados" no descuenta por búsqueda [RESUELTO 2026-07-16]

Línea 230-233: el contador siempre compara contra `dropdownValues.allVals.length` (universo completo de la columna), nunca contra los resultados que matchean `filterSearchText`. Con columnas de miles de valores es imposible saber cuántos de los resultados visibles están marcados sin contarlos a mano.

### Bug #16 — "Limpiar" no refresca el estado visual del propio dropdown [DESCARTADO tras revisión de código 2026-07-16 — falso positivo]

Al revisar `clearColumnFilter` en los 3 tabs (`PlantillaDetalleTab.jsx:402-409`, `MovimientosPersonalTab.jsx:1708-1714`, `BajasTab.jsx:428`) el `onClear` sí llama `setActiveFilterDropdown(null)` de forma síncrona, cerrando el dropdown en el mismo evento. El "estado viejo" que se veía en la sesión de pruebas del 2026-07-15 fue un artefacto de la animación de salida de `AnimatePresence`/`motion.div` (el modal queda montado unos ms más mientras hace fade-out, y el snapshot de playwright se capturó en ese instante intermedio). No requiere fix.

### Bug #17 — Pestaña "Todos los datos" puede combinarse con otro filtro activo y dar 0 resultados sin explicación [RESUELTO 2026-07-16]

Bajo "Todos los datos" el dropdown lista valores del universo completo de la columna, ignorando otros filtros ya aplicados en otras columnas. Seleccionar un valor perfectamente válido ahí puede resultar en "Sin coincidencias" en la tabla al combinarse (AND) con el otro filtro, sin que la UI indique el conflicto.

**Repro:** con columna B ("Estado Nómina") filtrada a 1 valor → abrir columna A ("Posición"), tab "Todos los datos" → seleccionar un valor que no coexista con el valor de B → Aplicar → tabla "Sin coincidencias".

### Mejora — Columnas de altísima cardinalidad

Columnas tipo ID (`Posición`: 11,451 valores únicos, `No. Posición`: 13,254) hacen que el checkbox-list, aunque virtualizado, sea poco útil como filtro categórico — nadie va a escanear miles de checkboxes. El buscador con condición es la única vía práctica; falta reforzar ese camino (ver plan, punto 5).

### Nota aparte (no bloqueante)

Warnings repetidos de Recharts en consola (`width(-1) and height(-1) of chart`) al cambiar de subtab — cosmético, contenedor con tamaño 0 durante la transición de entrada. No afecta a `ColumnFilterDropdown`.

---

## Plan de implementación (hallazgos 2026-07-15)

| # | Fix | Archivo(s) | Cambio | Esfuerzo | Estado |
|---|-----|-----------|--------|----------|--------|
| 1 | Bug #13 — condición no se resetea por columna | `ColumnFilterDropdown.jsx` | Nuevo `useEffect` separado (dependencia solo `[columnKey]`, no `filteredCount`) que llama `setFilterSearchText("")` y `setFilterSearchCondition("contains")` al cambiar de columna | Bajo | **Hecho 2026-07-16** |
| 2 | Bug #14 — Espacio escribe en el buscador | `ColumnFilterDropdown.jsx` | En `ArrowDown`/`ArrowUp` se mueve el foco al panel (`panelRef.current?.focus()`, con `ref`+`tabIndex={-1}` nuevos en el `motion.div` del modal) en vez de solo hacer `blur()` del input — `blur()` a secas dejaba el foco en `<body>`, que no es ancestro del portal del modal, así que el siguiente `keydown` (Espacio) ya no llegaba al handler del panel. Se detectó y corrigió en la misma sesión, verificado con playwright | Bajo-Medio | **Hecho 2026-07-16** |
| 3 | Bug #15 — contador no cuenta filtrado | `ColumnFilterDropdown.jsx` | Con `filterSearchText` activo, el contador usa `dropdownValues.visibleVals` en vez de `allVals` | Bajo | **Hecho 2026-07-16** |
| 4 | Bug #16 — "Limpiar" no refresca UI | — | Descartado: revisión de código mostró que `onClear` ya cierra el dropdown síncronamente en los 3 tabs; el hallazgo original era un artefacto de la animación de salida capturado a medio transición | — | **Descartado (falso positivo)** |
| 5 | Bug #17 — conflicto silencioso entre filtros | `DataTable.jsx` (estado vacío compartido) | Cuando `data.length === 0`, cuenta filtros activos (`columnFilters` + `textFilters` con valor) y si son 2+ muestra "0 resultados por la combinación de N filtros de columna activos. Prueba quitando alguno." en vez del genérico "Intenta ajustar tus filtros de búsqueda" | Medio | **Hecho 2026-07-16** |
| 6 | Mejora — cardinalidad alta | `ColumnFilterDropdown.jsx` | `HIGH_CARDINALITY_THRESHOLD = 500`: si `dropdownValues.allVals.length` lo supera y no hay `filterSearchText`, se oculta la lista virtualizada (y la navegación por flechas/Espacio) mostrando "Escribe para buscar entre {N} valores"; el buscador con condición y "Seleccionar Todo" (que opera sobre el universo completo) siguen disponibles | Medio | **Hecho 2026-07-16** |
| 7 | #4 — cancelar descarta cambios | — | Descartado tras revisión de código: los 7 tabs solo abren el dropdown vía `openFilterDropdown(colKey)`, que siempre resincroniza `tempSelectedValues` desde `columnFilters[colKey]` al abrir, sin importar cómo se cerró antes. No hay forma de ver selección fantasma | — | **Descartado (falso positivo)** |
| 8 | #11 — orden numérico | `columnFilters.js` + `MovimientosTab.jsx`, `MovimientosPersonalTab.jsx`, `AlineacionOrganizacionalTab.jsx` | Nuevo helper `sortValueCounts` (numeric-aware `localeCompare`), reutilizado en `getUniqueColumnValues` y aplicado a `valuesList` tras el fetch en los 3 tabs server-side (antes sin ningún sort) | Bajo-Medio | **Hecho 2026-07-16** |

Los 4 fixes de la sesión 2026-07-15 se verificaron en vivo con `playwright-cli` sobre `PlantillaDetalleTab`. Los 3 pendientes (puntos 6, 7 y 8 de esta tabla) se resolvieron el 2026-07-16 vía revisión de código directa (lectura de los 7 tabs + `columnFilters.js`); no se pudo repetir la verificación en vivo con `playwright-cli` en esta sesión porque el paquete no estaba instalado y la instalación global falló por permisos (`EACCES` en `/usr/local/lib/node_modules`). Recomendado verificar visualmente en la próxima sesión: (a) columna "Posición" en Plantilla Detalle debe mostrar el mensaje de cardinalidad alta hasta escribir en el buscador; (b) abrir/cambiar de condición y cerrar sin aplicar en cualquier tab no debe dejar selección fantasma al reabrir; (c) un filtro server-side (ej. "Presupuesto" en Movimientos) debe listar valores en orden numérico ascendente.
