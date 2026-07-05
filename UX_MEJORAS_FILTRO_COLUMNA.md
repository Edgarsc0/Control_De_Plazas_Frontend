# Mejoras UX — Filtro de columna estilo Excel

Componente: `src/app/dashboard/plantilla_empleados/_components/shared/ColumnFilterDropdown.jsx`
Objetivo: acercar el comportamiento al filtro de columna de Excel (AutoFilter).

## 1. Orden de valores: seleccionados arriba

**Hoy:** `sliced` llega en el orden que calcule `dropdownValues` en cada tab (probablemente orden de aparición/alfabético plano), sin distinguir seleccionados.

**Propuesta:** ordenar la lista con los valores ya presentes en `tempSelectedValues` primero (grupo "seleccionados", orden alfabético/numérico interno), luego el resto también ordenado. Se recalcula solo cuando cambia el set de datos o se abre el dropdown — **no** en cada click de checkbox, para que el ítem no "salte" de posición mientras el usuario sigue marcando opciones (eso rompe la experiencia en Excel real: el salto ocurre al reabrir el filtro, no mientras interactúas).

Cambio va en el `useMemo` que arma `dropdownValues` (en el tab), no en este componente — pasar ya el arreglo pre-ordenado, congelado al abrir.

## 2. Checkbox "Seleccionar Todo" con estado indeterminado

**Hoy:** `isAllSelected` es binario (líneas 234-236). Si hay selección parcial no hay pista visual, solo se infiere por los checks individuales.

**Propuesta:** añadir estado "parcial" (guion `-` en vez de check), igual al patrón que ya existe para año/mes en el árbol de fechas (`isYearPartial`, líneas 151, 162). Reutilizar el mismo bloque visual para consistencia.

## 3. "Seleccionar Todo" debe operar sobre lo filtrado por búsqueda, no sobre el universo completo

**Hoy:** revisar si `allVals` representa todos los valores de la columna o solo los que matchean `filterSearchText`. Comportamiento Excel: al escribir en el buscador y tocar "Seleccionar Todo", solo selecciona/deselecciona los valores **visibles** (los que matchean la búsqueda), dejando intacta la selección de los que quedaron ocultos.

**Propuesta:** confirmar que `allVals`/`sliced` ya reflejan el filtro de texto (`filterSearchText` + `filterSearchCondition`); si no, corregirlo. Es la trampa más común al replicar Excel: perder selección de items no visibles al tocar "Todo".

## 4. Cancelar sin aplicar debe descartar cambios

**Hoy:** `onClose` (botón X, click en overlay) solo cierra el dropdown. No hay evidencia de que restaure `tempSelectedValues` al valor de `columnFilters[columnKey]` previo.

**Propuesta:** al cerrar sin pulsar "Aplicar Filtro", resetear `tempSelectedValues` al filtro ya aplicado (o vacío si no había). Si no se hace, reabrir el dropdown puede mostrar selección "fantasma" que el usuario nunca confirmó — bug de UX, no solo mejora.

## 5. Buscador: autofocus + botón limpiar (×)

**Hoy:** input de búsqueda (línea 106) sin autofocus ni botón de limpiar.

**Propuesta:**
- `autoFocus` al montar el dropdown (Excel abre con foco directo en el buscador).
- Icono `×` dentro del input cuando `filterSearchText` no está vacío, para limpiarlo en un click sin seleccionar texto manualmente.

## 6. Resaltar coincidencia de búsqueda en la lista

**Propuesta:** cuando `filterSearchText` tiene valor, resaltar (bold o `<mark>`) la subcadena coincidente dentro de cada `value` renderizado (línea 248). Ayuda a escanear listas largas rápido, como buscador de Excel/Sheets.

## 7. Atajos de teclado

**Propuesta:**
- `Escape` → cierra el dropdown (equivalente a click en overlay).
- `Enter` (con foco en buscador o lista) → aplica el filtro (`onApply`).
- `Espacio` con checkbox enfocado → toggle.
- Navegación con flechas arriba/abajo entre valores de la lista (type-ahead: escribir una letra salta al primer valor que empieza con ella, como el picker nativo de Excel).

Hoy el componente no maneja `onKeyDown` en absoluto — es la brecha más grande respecto a Excel real, donde el filtro es totalmente operable sin mouse.

## 8. Contador de selección visible

**Propuesta:** mostrar junto al header o sobre la lista un texto tipo `"12 de 45 seleccionados"`, para que el usuario no tenga que contar checks marcados manualmente en listas largas. Dato ya disponible (`tempSelectedValues.length` vs `allVals.length`).

## 9. Reemplazar el corte a 100 resultados por lista virtualizada

**Hoy:** `filteredCount > 100` corta la lista y solo avisa "Mostrando 100 de N resultados. Usa el buscador." (líneas 253-257). Fuerza al usuario a buscar en vez de poder scrollear toda la lista, cosa que Excel sí permite.

**Propuesta:** usar virtualización (ej. `react-window`) para renderizar toda la lista de valores sin límite arbitrario, manteniendo el buscador como atajo pero no como único camino.

## 10. "Seleccionar todo" pegado (sticky) bajo el buscador

**Hoy:** el botón "Seleccionar Todo" (líneas 231-238) scrollea junto con la lista larga de valores; en listas largas queda fuera de vista y hay que volver arriba para des/seleccionar todo.

**Propuesta:** fijarlo (`sticky top-0`) justo debajo del buscador, igual que ya está fijo el header completo del modal.

## 11. Orden numérico correcto para columnas numéricas

**Propuesta:** si la columna es numérica (sueldo, id, etc.), ordenar los valores por valor numérico real, no lexicográficamente (evita "10" antes que "2"). Aplica junto con el punto 1 (seleccionados arriba, luego orden numérico dentro de cada grupo).

## 12. Indicar filtro activo en el botón que abre el dropdown

**Nota:** esto ya existe parcialmente en `DataTable.jsx` (punto pulsante blanco cuando `hasFilter`, línea 165). Solo agregar el conteo aquí: mostrar cuántos valores están excluidos/incluidos en el tooltip del botón de filtro del header, para que quede consistente con el punto 8.

---

## Prioridad sugerida (impacto / esfuerzo)

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | Seleccionados arriba | Alto | Medio (mover a `useMemo` del tab) |
| 4 | Cancelar descarta cambios | Alto (bug) | Bajo |
| 3 | "Todo" opera sobre filtrado | Alto (bug potencial) | Bajo (verificar) |
| 2 | Checkbox indeterminado | Medio | Bajo |
| 7 | Atajos de teclado | Alto (accesibilidad) | Medio |
| 5 | Autofocus + botón limpiar | Medio | Bajo |
| 10 | Sticky "Seleccionar Todo" | Medio | Bajo |
| 8 | Contador de selección | Medio | Bajo |
| 6 | Resaltar coincidencia | Bajo-Medio | Bajo |
| 11 | Orden numérico | Medio | Medio |
| 9 | Virtualización | Medio | Alto |

Empezar por 4 y 3 (posibles bugs de correctitud), luego 1 y 2 (lo pedido + lo más "Excel"), el resto son incrementales.
