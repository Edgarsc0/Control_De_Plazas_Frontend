# Reporte QA — ColumnFilterDropdown + AdvancedFiltersModal

> **Actualización 2026-07-23 (tarde):** BUG-1, BUG-2, BUG-3 y BUG-4 fueron corregidos y verificados en navegador real (misma metodología playwright-cli). Detalle de cada fix al inicio de su sección. La OBSERVACIÓN de conteos globales en el árbol de fechas y las mejoras UX/UI quedan pendientes (no bloqueantes).

**Fecha:** 2026-07-23
**Componente bajo prueba:** `src/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown.jsx`
**Componente combinado:** `src/app/dashboard/plantilla_empleados/_components/shared/AdvancedFiltersModal.jsx`
**Herramienta:** playwright-cli (Chromium), navegador real contra `localhost:3000` + backend Django `localhost:8000`
**Tabs cubiertos:**
- `PlantillaDetalleTab.jsx` (Plantilla Detalle) — filtrado 100% cliente
- `MovimientosTab.jsx` (Mov. Posiciones) — filtrado 100% cliente
- `MovimientosPersonalTab.jsx` (Movimientos) — filtrado server-side, paginado (152,142 registros / 3043 páginas)
- `BajasTab.jsx` (Empleados Bajas) — carga diferida (secondaryDataPromise), filtrado cliente

Se probaron columnas de texto (baja/media/alta cardinalidad), columnas de fecha (árbol año→mes→día), teclado, búsqueda, selección masiva, y **6 casos combinados** con `AdvancedFiltersModal` (mínimo 2 por tab, en ambos órdenes de aplicación).

---

## Nota metodológica

Durante las primeras pruebas el backend devolvió `(1040, 'Too many connections')` de MySQL de forma intermitente (`CONN_MAX_AGE=60` en `runserver`, sin pool). Esto causó cargas iniciales con datasets vacíos (`Registros: 0`, "Sin coincidencias") que **no son bugs del componente** — son un problema de infraestructura de desarrollo ya conocido (ver memoria `backend-flaky-db-conexiones`). Todas las pruebas reportadas abajo se repitieron con el backend estable y datos reales cargados.

---

## Bugs detectados

### ✅ CORREGIDO — BUG-1 — Selección tras búsqueda deja seleccionados masivos "invisibles" (trampa UX, alta cardinalidad)

**Fix aplicado** en `ColumnFilterDropdown.jsx`: con texto en el buscador, se calcula `hiddenSelectedCount` (valores en `tempSelectedValues` que no están en `dropdownValues.visibleVals`) y se muestra un banner de aviso *"+N valor(es) seleccionado(s) fuera de tu búsqueda también se incluirán al aplicar"* con un botón **"Quitar"** que limpia esa selección oculta al instante (deja marcado sólo lo visible). Verificado en vivo: buscar "jose" con todo preseleccionado mostró el aviso "+9,979 fuera de tu búsqueda"; tras marcar 1 nombre y usar "Quitar", el chip aplicado quedó en "Nombres: 1 valor" y "Registros: 1" (antes hubiera aplicado ~9,988 valores sin avisar).

<details><summary>Reporte original</summary>

**Dónde:** Cualquier columna de alta cardinalidad (probado en "Nombres", Plantilla Detalle, 10,540 valores únicos).

**Repro:**
1. Abrir filtro de "Nombres" (arranca con **todos** los 10,540 valores seleccionados = sin filtro).
2. Buscar "jose" → aparecen 555 coincidencias.
3. Clic en "Seleccionar visibles" (para deseleccionar) → clic en 2 nombres puntuales para volver a marcarlos.
4. Aplicar.

**Resultado:** El chip final muestra **"Nombres: 9988 valores"** en vez de "2 valores". El usuario, tras buscar y marcar 2 nombres, termina con un filtro que incluye prácticamente **todo el dataset** (9,988 de 10,540), porque los ~9,985 valores fuera del texto buscado seguían marcados desde el estado inicial "todo seleccionado" y nunca se tocaron.

**Por qué pasa:** Mismo comportamiento que Excel (el checkbox "Seleccionar Todo/visibles" solo actúa sobre el subconjunto visible de la búsqueda), pero **sin ninguna señal visual** de que hay miles de valores seleccionados fuera de la vista actual. El contador sí es correcto ("2 de 555 visibles seleccionados") pero no comunica el total real aplicado.

**Impacto:** Alto — el usuario cree que filtró a "sólo 2 personas" y en realidad ve casi todo el padrón. Fácil de disparar sin darse cuenta, y el resultado (~todo el dataset) puede pasar desapercibido como "sin filtro" a simple vista.

**Propuesta de solución:**
- Cuando haya texto en el buscador, mostrar junto al contador un aviso explícito si existen valores seleccionados **fuera** de la búsqueda actual, ej.: *"2 visibles + 9,986 fuera de tu búsqueda también quedarán incluidos"*.
- Alternativa más simple: agregar un botón "Sólo estos" junto a "Seleccionar visibles" que limpie cualquier selección previa y dejeúnicamente los valores visibles marcados.

</details>

---

### ✅ CORREGIDO — BUG-2 — Discrepancia de conteo en columna "Nivel" (Plantilla Detalle): 2 valores marcados → filtro aplicado con "4 valores"

**Causa raíz encontrada:** `PlantillaDetalleTab.jsx` computa la lista visible del dropdown (`uniqueColumnValues`) sobre `detalleParaFiltros` (que excluye posiciones vacantes, por diseño explícito de un QA anterior), pero `computeReachableValues` — usada para sembrar la selección al abrir el dropdown y para decidir qué se compromete al aplicar — iteraba sobre `detalle` (dataset completo, **incluye vacantes**). Cuando una posición vacante tenía un valor de "Nivel" que ninguna posición ocupada tenía, ese valor terminaba en la selección "Seleccionar Todo" inicial sin aparecer nunca en la lista visible; al hacer "Desmarcar Todo" (que sólo togglea lo visible) ese valor fantasma quedaba seleccionado sin que el usuario pudiera verlo ni desmarcarlo, y se colaba en el filtro aplicado.

**Fix aplicado:** `computeReachableValues` ahora itera sobre `detalleParaFiltros` (el mismo dataset que arma la lista visible), eliminando la posibilidad de valores fantasma. Verificado en vivo repitiendo el repro exacto del bug: marcar "7" y "8" ahora aplica correctamente **"Nivel: 2 valores"** (antes "4 valor(es) filtrado(s)").

<details><summary>Reporte original</summary>

**Dónde:** Columna "Nivel" (Plantilla Detalle), 120 valores únicos.

**Repro:**
1. Abrir filtro de "Nivel". Deseleccionar todo. Marcar únicamente "7" (245) y "8" (361).
2. Confirmar en el dropdown: "2 de 120 seleccionados". Aplicar.

**Resultado:** El chip de columna muestra **"Nivel: 4 valor(es) filtrado(s)"** y `Registros = 642` en vez de los `606` esperados (245+361). Al **reabrir** el dropdown, sólo aparecen 2 valores marcados (7 y 8) — consistente con lo que el usuario hizo, pero inconsistente con el filtro realmente aplicado (4 valores, 642 filas).

**Contraprueba (para descartar bug general del componente):** Se repitió exactamente el mismo procedimiento en "Cod. Motivo" (Mov. Posiciones, 15 valores) marcando "NEW" (1045) y "REO" (1287): el resultado fue exacto — chip "2 valor(es) filtrado(s)", `Registros = 2,332` (=1045+1287). Igual en "Motivo" (Bajas, 18 valores): exacto, 575=514+61.

**Conclusión:** El bug **no es general del componente** — es específico de la columna "Nivel" en Plantilla Detalle. Lo más probable es que el dataset tenga variantes de valor "duplicadas" para el mismo nivel visual (p. ej. espacios, ceros a la izquierda, o tipo de dato numérico vs. texto — "7" vs "07"/"7.0"/" 7") que el agrupamiento para mostrar la lista colapsa en una sola fila visible, pero que al aplicar el filtro se expanden a más de un valor raw sin que el conteo mostrado junto al checkbox lo refleje.

**Impacto:** Alto donde ocurre — filtra ~6% más filas de las esperadas sin que el usuario lo note (el dropdown reabierto "miente" mostrando sólo 2 marcados).

**Propuesta de solución:** Revisar en el backend/hook `useColumnFilters` cómo se calculan los valores únicos de "Nivel" en Plantilla Detalle vs. cómo se guarda `activeFilters`. Si hay normalización de trim/case en la lista pero no en el filtro aplicado (o viceversa), unificar ambos pasos. Auditar la columna `Nivel` en la fuente de datos por posibles duplicados de formato.

</details>

---

### ✅ CORREGIDO — BUG-3 — El buscador de texto no filtra el árbol de fechas (columnas de fecha)

**Fix aplicado** en `ColumnFilterDropdown.jsx`: se agregó `filteredDateHierarchy` (memo) que filtra el árbol año→mes→día por el texto del buscador — un año/mes sobrevive si él mismo matchea (año, nombre de mes) o si cualquiera de sus días matchea (día suelto o fecha completa `dd/mm/aaaa` / `dd-mm-aaaa`, insensible a acentos vía `normalizeForSearch`). Con búsqueda activa, los nodos que sobreviven se auto-expanden (`isDateNodeExpanded`) para que el resultado sea visible sin expandir manualmente. Verificado en vivo con dos casos: buscar `"julio"` colapsó el árbol a sólo ese mes en todos los años; buscar `"15/07/2026"` filtró hasta el día exacto.

<details><summary>Reporte original</summary>

**Dónde:** Todas las columnas de fecha, en los 4 tabs (confirmado explícitamente en "Fecha Efectiva", tab Movimientos, server-side).

**Repro:**
1. Abrir filtro de una columna de fecha.
2. Escribir cualquier texto en "Buscar valor..." (ej. `15/08/2026`).

**Resultado:** El árbol año→mes→día permanece **exactamente igual**, sin filtrar ni resaltar nada. El campo de búsqueda es visualmente idéntico al de columnas de texto (mismo componente, mismo placeholder "Buscar valor...") pero **no tiene ningún efecto** para columnas de fecha.

**Causa (confirmada por código):** En `ColumnFilterDropdown.jsx`, el bloque `isDate ? (...) : (...)` que renderiza el árbol de fechas (líneas ~292-412) nunca lee `filterSearchText` — el árbol se arma sólo a partir de `dateHierarchy`, ignorando por completo lo escrito en el buscador.

**Impacto:** Medio — no rompe nada, pero es una funcionalidad "fantasma": el usuario ve un buscador activo, escribe una fecha esperando saltar directo a ella, y no pasa nada. En columnas con muchos años (ej. histórico de Movimientos) obliga a expandir manualmente año por año.

**Propuesta de solución:** Implementar filtrado real del árbol (por texto de año/mes/nombre de mes/día que matchee), o si no se va a implementar en el corto plazo, ocultar el buscador cuando `isDate === true` para no sugerir una función que no existe. Nota: esto coincide con un hallazgo previo de QA (`bug-distinct_search-fechas-movimientos-personal`), confirmado ahora también en Plantilla Detalle, Mov. Posiciones y Bajas — es transversal a las 4 tabs, no sólo a Movimientos.

**Nota:** el bug de backend documentado previamente (`distinct_search` sobre fecha completa devuelve 500 en el endpoint server-side de Movimientos) es un problema **distinto y aparte**, no cubierto por este fix de frontend — sigue pendiente en el backend.

</details>

---

### ✅ CORREGIDO — BUG-4 — Formato de fecha inconsistente entre columnas de la misma tabla

**Dónde:** Tab "Mov. Posiciones" — columna "Fecha de Vacancia" (`D`) se muestra en formato **ISO** (`2026-06-30`), mientras que columnas contiguas como "Fecha Efectiva" (`H`) usan **dd/mm/aaaa** (`01/08/2026`).

**Impacto:** Bajo pero genera confusión real de lectura (¿es 06/30 o 30/06?), especialmente al lado de otras columnas con formato distinto en la misma fila.

**Propuesta:** Unificar el formateo de fecha a nivel de configuración de columnas (probablemente falta pasar por el mismo formateador que las demás columnas de fecha del tab).

**Fix aplicado:** el renderer especial de la celda `fecha_vacancia` en `MovimientosTab.jsx` (línea ~1151) hacía `{String(value)}` crudo, sin pasar por `formatDateEsMx` — a diferencia del renderer genérico de columnas de fecha del mismo tab, que sí lo aplica (`isDateColumn(col.key) ? formatDateEsMx(value) : String(value)`). Se envolvió el valor con `formatDateEsMx(value)`. Verificado en vivo: la columna ahora muestra `30/06/2026` en vez de `2026-06-30`.

---

### 🟡 OBSERVACIÓN — Conteos del árbol de fechas son siempre globales, no contextuales al resto de filtros

**Dónde:** Árbol de fechas, en cualquier tab, al combinar con otro filtro (columna o avanzado).

**Repro:** Con "Motivo contiene Promoción" aplicado (178 filas), abrir el árbol de "Fecha efectiva": "Julio (5145)" sigue mostrando el conteo total de julio en **todo el dataset** (11,451 filas), no las ~pocas que además cumplen "Motivo=Promoción". La alcanzabilidad (deshabilitar meses sin datos) sí funciona correctamente — sólo el **número entre paréntesis** es engañoso.

**Impacto:** Bajo/medio — no es incorrecto técnicamente (es "cuántas filas tiene esa fecha en total"), pero puede confundir cuando se usa junto a otros filtros activos, ya que sugiere un volumen que no se corresponde con el resultado final.

**Propuesta:** Aclarar visualmente (tooltip o texto pequeño) que el número es un conteo global sin filtros combinados, o calcular el conteo contextual si el rendimiento lo permite.

---

## Cosas que SÍ funcionan bien (para no perder de vista lo positivo)

- **Búsqueda insensible a acentos:** buscar "jose" encuentra "José" correctamente (`normalizeForSearch`), con highlight correcto en ambos casos.
- **Checkboxes y "Seleccionar Todo"/"Seleccionar visibles":** funcionan correctamente cuando se usan como flujo completo (deseleccionar → marcar manualmente).
- **Navegación por teclado:** flechas ↑/↓ + Espacio para marcar + Enter para aplicar, funcionan como se espera; Escape cierra el panel de condición primero y el dropdown completo después (comportamiento en capas correcto).
- **Árbol de fechas — jerarquía y estado parcial:** togglear un mes individual actualiza correctamente el indicador de "parcialmente seleccionado" (punto) en el año padre; los botones "Todo"/"Ninguno" por nodo funcionan.
- **Alcanzabilidad (`reachable`) combinada con `AdvancedFiltersModal`:** verificado en **los 4 tabs**, incluyendo el tab server-side (Movimientos) — al aplicar un filtro avanzado, el dropdown de columna deshabilita correctamente los valores/fechas que ya no tienen ninguna fila que los alcance. En el tab server-side esto llega a limitar la lista a **un solo valor reachable** ("Baja") de forma exacta.
- **Combinación AND (ColumnFilterDropdown + AdvancedFiltersModal), en ambos órdenes de aplicación:** en 5 de 6 casos combinados probados el conteo final fue matemáticamente exacto (intersección correcta). El único caso con discrepancia fue BUG-2, ya aislado como problema de datos de la columna "Nivel", no de la lógica de combinación.
- **AdvancedFiltersModal — autocompletado de valores:** sugiere valores reales con conteo (`Promoción — 178`) tanto en modo cliente como cuando se usa `fetchSuggestions` contra backend.
- **Fix BUG-F05** (cierre de paneles flotantes por `mousedown` fuera, documentado en el propio código): no se observaron paneles fantasma bloqueando clics durante ninguna de las pruebas.

---

## Mejoras UX/UI sugeridas (no bugs, pero facilitan la vida al usuario final)

1. **Aviso de selección "oculta" tras búsqueda** (mitiga BUG-1): mostrar cuántos valores seleccionados quedan fuera del texto buscado actualmente.
2. **Quitar o habilitar el buscador en columnas de fecha** (BUG-3): tal como está, es una afordancia engañosa.
3. **Unificar formato de fechas** en toda la tabla (BUG-4).
4. **Diferenciar "sin datos capturados" de "sin coincidencias de búsqueda"**: cuando una columna genuinamente no tiene ningún valor (ej. "Motivo" en Plantilla Detalle sin filtro adicional, si aplica a ese subconjunto de datos), el mensaje "Sin resultados" es el mismo que cuando una búsqueda no encuentra nada — un mensaje distinto ayudaría a que el usuario no piense que el buscador está roto.
5. **Botón "Sólo este valor"** en cada fila de la lista (clic derecho o icono al hover) para aislar un valor sin pasar por "deseleccionar todo + buscar + marcar".
6. Considerar mostrar el conteo contextual (post-filtros combinados) en el árbol de fechas, aunque sea sólo cuando hay pocos filtros activos, para no generar la falsa expectativa del punto anterior sobre conteos globales.

---

## Resumen de casos combinados con AdvancedFiltersModal

| Tab | Caso | Orden | Resultado |
|---|---|---|---|
| Plantilla Detalle | Motivo contiene "Promoción" (avanzado) → Fecha Efectiva (columna) | Avanzado primero | Reachability correcta (Enero/Agosto deshabilitados) |
| Plantilla Detalle | Nivel 7+8 (columna) → Fecha de captura "antes de 2027" (avanzado) | Columna primero | AND correcto estructuralmente (persiste BUG-2 de datos) |
| Mov. Posiciones | Ocupación contiene "VACANTE" (avanzado) → Fecha de Vacancia (columna) | Avanzado primero | Reachability correcta, sin años deshabilitados (esperado, alta correlación) |
| Mov. Posiciones | Fecha de Vacancia = 2026 (columna) → con avanzado ya activo | Columna después | 787 registros, exacto y subconjunto válido de 908 |
| Movimientos (server) | Nombre Acción = "Baja" (columna) → Nombre Motivo contiene "Renuncia" (avanzado) | Columna primero | 3,804 registros exacto (server-side) |
| Movimientos (server) | Nombre Motivo contiene "Renuncia" (avanzado) → Nombre Acción (columna) | Avanzado primero | Reachable limitado a "Baja (3804)", exacto |
| Empleados Bajas | Unidad Admon = "002" (columna) → Motivo contiene "Renuncia" (avanzado) | Columna primero | 89 ≤ 100, subconjunto coherente |

---

## Conclusión

El componente `ColumnFilterDropdown` es sólido en su lógica central: búsqueda, selección, jerarquía de fechas, teclado y — lo más importante para el propósito de esta prueba — la **combinación con `AdvancedFiltersModal`** (alcanzabilidad y AND) funciona correctamente en cliente y servidor.

**Estado final (2026-07-23, tarde):** los 4 bugs reportados (BUG-1 a BUG-4) fueron corregidos y verificados en navegador real repitiendo el repro exacto de cada uno. Archivos tocados:
- `src/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown.jsx` — aviso de selección oculta (BUG-1) + filtrado real del árbol de fechas (BUG-3).
- `src/app/dashboard/plantilla_empleados/_components/tabs/plantilla-detalle/PlantillaDetalleTab.jsx` — alineación de dataset en `computeReachableValues` (BUG-2).
- `src/app/dashboard/plantilla_empleados/_components/tabs/movimientos/MovimientosTab.jsx` — formateo de fecha en `fecha_vacancia` (BUG-4).

Quedan pendientes, sin bloquear: la OBSERVACIÓN de conteos globales en el árbol de fechas (no confunde funcionalmente, sólo visualmente) y las mejoras UX/UI listadas arriba que no correspondían a un bug puntual (puntos 4 y 5 de esa lista).
