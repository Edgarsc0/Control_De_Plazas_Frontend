# Reporte QA — Filtros Avanzados y Filtros de Columna (Módulo "Plantilla Empleados")

**Fecha:** 2026-07-22
**Entorno probado:** `http://89.116.51.124:3030/dashboard/plantilla_empleados` (build productivo)
**Componentes bajo prueba:**
- `_components/shared/AdvancedFiltersModal.jsx` (modal "Filtros Avanzados": condiciones combinables AND/OR, `compareType` valor vs. campo, condiciones de texto y de fecha)
- `_components/shared/ColumnFilterDropdown.jsx` (filtro estilo Excel por columna: checkbox-list, buscador con condición, árbol de fechas año→mes→día)
- Lógica pura: `src/utils/advancedFilters.js`, `src/utils/columnFilters.js`
- Backend: `eje_central_back/plantilla/views.py` (`apply_advanced_filters`, `apply_dynamic_column_filters`, `build_condition_q`)

**Tabs cubiertos:** Plantilla Detalle (`PlantillaDetalleTab.jsx`), Mov. Posiciones (`MovimientosTab.jsx`, subtab Tabla Principal), Movimientos (`MovimientosPersonalTab.jsx`), Empleados Bajas (`BajasTab.jsx`).

**Método:** 4 sesiones E2E independientes con `playwright-cli` (una por tab), cookie de sesión inyectada directamente, cruzando cada resultado de la UI contra `mysql` (`168.231.73.222:3306`, BD `EjeCentral`) o contra la respuesta JSON cruda del endpoint (tabs `mode:"server"`) para confirmar conteos exactos.

**Distinción clave de arquitectura:** Plantilla Detalle y Empleados Bajas filtran 100% en memoria del navegador (`useAdvancedFilters({mode:"client"})`); Mov. Posiciones y Movimientos envían las condiciones al backend Django vía querystring `advanced_filters` (`useAdvancedFilters({mode:"server"})`). Los bugs #1 y #2 viven en la utilidad compartida de front y afectan a los 4 tabs por igual; los bugs #4 y #5 viven en el backend y solo afectan a los tabs `server`.

---

## 1. Resumen ejecutivo

| Categoría | Cantidad |
|---|---|
| Bugs funcionales — ALTA/CRÍTICA prioridad | 5 |
| Bugs funcionales — MEDIA prioridad | 5 |
| Bugs — BAJA prioridad / UX menor | 3 |
| Verificado correcto (sin bug) | ver §5 |

Lo más urgente: **comparación `campo` vs `campo` con destino vacío devuelve falso positivo** (bug transversal a los 4 tabs), **acentos ignorados en Filtros Avanzados pero no en el filtro de columna** (mismo dato, dos resultados distintos según qué buscador use el usuario), y **dos columnas de fecha con hora embebida (`fh_ult_actz`, `fecha_ult_actz`) rompen las condiciones "igual/no igual/antes-o-igual/después"** en el backend.

---

## 2. Bugs funcionales — ALTA / CRÍTICA prioridad

### BUG-F01 · `compareType: "campo"` con columna destino vacía → falso positivo masivo (los 4 tabs)

- **Dónde:** `src/utils/columnFilters.js:200` (`matchesTextCondition`) y `src/utils/advancedFilters.js:70` (`matchesDateCondition`), invocadas desde `matchesAdvancedCondition` (`advancedFilters.js:94-103`).
- **Causa raíz:** ambas funciones abren con una guarda `if (!needle) return true;` pensada para el caso "el usuario no escribió un valor de búsqueda" (comparación contra literal). Esa misma guarda se reutiliza cuando `compareType==="campo"` y `needle = row[compareColumn]`; si la fila tiene esa columna vacía, la condición se evalúa como verdadera sin comparar nada.
- **Reproducción 1 (Plantilla Detalle, fecha):** columna `Fecha efectiva (Personal)`, condición `Es después de`, Comparar con `Campo` → `Fecha prevista de salida`. UI: **4,155** resultados. DB: filas con `Fecha prevista de salida` vacía = **4,155** (coincide exacto); filas donde de verdad `fecha_efectiva > fecha_prevista` (ambas con valor) = **0**. El filtro devuelve el 100% de casos opuestos a lo que promete.
- **Reproducción 2 (Bajas, texto):** columna `Puesto`, `Es igual a`, Comparar con `Campo` → `Nivel`. UI: **106**. DB: `PUESTO = NIVEL` → 0; filas con `NIVEL` vacío → 106. Mismo patrón.
- **Nota:** en Mov. Posiciones se probó `compareType:"campo"` con `fecha_captura` vs `fecha_est"` (ninguna vacía en esa muestra) y dio partición exacta — el bug no se manifestó ahí solo porque el dataset probado no tenía nulos en la columna destino, no porque el código esté a salvo.
- **Fix sugerido:** separar el caso "sin valor de búsqueda" (aplica solo cuando `compareType==="valor"` y el input está vacío) del caso "columna de comparación vacía en esta fila" (debe evaluar como `false` para `equals`/`contains`/etc., no como `true` automático).
- **Impacto:** cualquier condición campo-vs-campo es sospechosa de devolver resultados invertidos si la columna destino puede tener valores vacíos — que es el caso común (fechas de baja/salida, niveles opcionales, etc.).

### BUG-F02 · Filtros Avanzados ignora acentos; ColumnFilterDropdown no — mismo dato, resultado distinto según el buscador usado

- **Dónde:** `advancedFilters.js:102` llama `matchesTextCondition(rowValue, cond.condition, compareValue)` **sin** `{ normalize: true }`. En cambio `columnFilters.js:359` (`applyColumnFilters`, usado por `ColumnFilterDropdown`) sí pasa `{ normalize: true }`, igual que el autocompletado de valores del propio modal.
- **Reproducción 1 (Plantilla Detalle):** columna `Nombres`, `Contiene`, valor `cesar` (sin tilde) → UI: 98. Con folding de acentos (comportamiento del resto de la app): 102 — se pierden 4 registros con "César".
- **Reproducción 2 (Bajas):** columna `Motivo`, `Contiene`, valor `jubilacion` (sin tilde) → UI: **0**. DB real (con tilde, "Jubilación\*"): 85 filas. El usuario que no tipea el acento cree que no hay bajas por jubilación.
- **Fix sugerido:** pasar `{ normalize: true }` en la llamada de `advancedFilters.js:102`, igual que ya hace `columnFilters.js`. Riesgo bajo, la utilidad ya existe y está probada en el resto de la app.
- **Impacto:** nombres/motivos con acentos (norma en México) se pierden silenciosamente en Filtros Avanzados si el usuario no tipea la tilde, aunque el filtro de columna (dropdown) sí los encuentra — inconsistencia que erosiona la confianza en el módulo que primero se pruebe.

### BUG-F03 · Mov. Posiciones — columna `F/H Últ Actz` (`fh_ult_actz`) compara fecha como string crudo con sufijo de hora

- **Dónde:** backend `apply_advanced_filters()`, `eje_central_back/plantilla/views.py:281-291`. Modelo `MovPosBase.fh_ult_actz` (`plantilla/models.py:821`) es `CharField` con formato real `YYYY-MM-DD-HH.MM.SS.ffffff`, a diferencia de las otras 4 columnas de fecha del mismo tab (`f_efva`, `fecha_captura`, `fecha_est`, `fecha_vacancia`) que son `YYYY-MM-DD` puro.
- **Reproducción (API real, base `is_latest=true&estado_psn__in=A`, total=11,451):**
  - `before` (antes de hoy) → 11,436
  - `before_or_equal` (antes o igual a hoy) → 11,436 — **idéntico a `before`**, debería incluir las 15 filas de hoy (11,451)
  - `after` (después de hoy) → 15 — **debería ser 0** (ninguna fila tiene fecha futura), pero el sufijo de hora empuja las filas de "hoy" al lado "after"
  - `after_or_equal` → 15, coincide con `after` por la razón equivocada
- **Fix sugerido:** para `fh_ult_actz` normalizar con `SUBSTRING(target_field, 1, 10)` antes de comparar en `apply_advanced_filters`, o convertir la columna a un `DateTimeField` real vía migración.
- **Impacto:** cualquier filtro "antes/después/antes-o-igual/después-o-igual" sobre esta columna es incorrecto exactamente en el límite del día elegido.

### BUG-F04 · Movimientos — condiciones "es igual a" / "no es igual a" rotas sobre columnas `DateTimeField` (`fecha_ult_actz`)

- **Dónde:** backend `apply_advanced_filters()`, `eje_central_back/plantilla/views.py:298-301` — cae en el branch genérico `Q(target_field=value)` sin truncar el datetime a fecha.
- **Reproducción:** columna "Fecha Últ. Actz.", condición "Es igual a", valor `2024-07-01` → UI: **0**. DB real (`DATE(fecha_ult_actz)='2024-07-01'`): **11,020** filas.
- "No es igual a" mismo valor → UI: **152,117** (el total sin filtrar). Esperado: **141,097** (152,117 − 11,020).
- Columnas `DateField` puras del mismo tab (`fecha_efectiva`, `fecha_captura`) no tienen el problema — verificado con conteos exactos en AND/OR y `compareType:"campo"`.
- **Fix sugerido:** truncar a fecha (`__date=value` o `Trim`/`DATE()`) también para los branches `equals`/`not_equals`, igual que ya se hace (parcialmente, ver BUG-F03) para `before`/`after`.
- **Impacto:** afecta a cualquier `DateTimeField` filtrado con igualdad exacta — el más intuitivo de los casos de uso para un usuario de RH ("dame los movimientos capturados el día X").

### BUG-F05 · Bajas — overlay invisible de pantalla completa queda "pegado" tras seleccionar una opción de un `AdvFilterSelect`, bloqueando el siguiente clic

- **Dónde:** `AdvancedFiltersModal.jsx:41` — el click-outside-catcher (`<div className="fixed inset-0 z-[200]" onClick={...}>`) de `AdvFilterSelect` no se desmonta de forma fiable en algún camino de interacción.
- **Reproducción:** en el modal, elegir columna y luego comparación en dropdowns searchable; el siguiente clic en "Aplicar Filtros" es absorbido silenciosamente (confirmado con Playwright: el overlay de 1280×720, `pointer-events:auto`, intercepta el clic). Solo se libera haciendo clic directo sobre el overlay invisible. Reproducido 2 veces de forma consistente.
- **Fix sugerido:** auditar el ciclo de vida del backdrop de `AdvFilterSelect` — asegurar que `setIsOpen(false)` se dispare siempre al seleccionar una opción o al desmontar, y considerar un único backdrop compartido en vez de uno por instancia de select.
- **Impacto:** el usuario percibe que el botón "Aplicar Filtros" no responde, sin ninguna pista visual de la causa.

---

## 3. Bugs funcionales — MEDIA prioridad

### BUG-F06 · Movimientos — condiciones de texto negadas excluyen silenciosamente filas con valor NULL

- **Dónde:** `apply_advanced_filters` / `build_condition_q`, backend. "No contiene" (y previsiblemente "No empieza con"/"No termina con"/"No es igual a") se traduce a `~Q(campo__icontains=valor)`; por lógica de tres valores de SQL, `NOT (NULL LIKE ...)` es `NULL`, no `TRUE`, así que las filas con el campo NULL desaparecen tanto del "Contiene" como del "No contiene".
- **Reproducción:** 1 fila con `accion_nombre` NULL desaparece de ambos lados de la condición (ni "Contiene X" ni "No contiene X" la incluyen).
- **Inconsistencia:** los filtros `__in` (checkbox de columna) sí son NULL-aware vía `EMPTY_VALUE_TOKEN`; los de Filtros Avanzados no.
- **Fix sugerido:** en las condiciones negadas, envolver con `Q(campo__isnull=True) | ~Q(campo__icontains=valor)` cuando el "no cumple" deba incluir NULL como caso válido.

### BUG-F07 · Movimientos — `ColumnFilterDropdown`: contador "X de Y seleccionados" no reconcilia al cambiar "Todos los datos" → "Vista actual"

- **Dónde:** `ColumnFilterDropdown.jsx` (línea ~268-273, label de conteo).
- **Reproducción:** con varios valores marcados en "Todos los datos", cambiar a "Vista actual" (universo reducido) produce contadores imposibles como "17 de 1 seleccionados" — `tempSelectedValues` no se acota al `allVals` del tab activo.
- **Fix sugerido:** al cambiar de tab, filtrar `tempSelectedValues` contra el universo de valores del tab activo antes de mostrar el conteo (o mostrar el conteo crudo aclarando que refiere al total global).

### BUG-F08 · Movimientos — botón "Limpiar filtros de columna" ignora los filtros de tipo checkbox

- **Dónde:** `DataTable.jsx:420-422` — el botón depende solo de `textFilters`, no de `columnFilters` (los aplicados vía `ColumnFilterDropdown`).
- **Reproducción:** con un filtro de columna (checkbox) activo — badge "Filtro activo" visible en el header — el botón "Limpiar filtros de columna" permanece deshabilitado. No existe forma de limpiar todos los filtros de columna de un solo clic.
- **Fix sugerido:** habilitar/hacer efectivo el botón cuando `columnFilters` o `textFilters` tengan entradas, y limpiar ambos.

### BUG-F09 · Plantilla Detalle / Bajas — AND/OR es evaluación secuencial estricta sin precedencia tipo SQL (comportamiento intencional, documentar en UI)

- **Dónde:** `advancedFilters.js:105-109`, documentado en el propio código como decisión de diseño (izquierda a derecha, sin precedencia AND-antes-que-OR).
- **Repro:** `A OR B AND C` se evalúa como `(A OR B) AND C`, no como `A OR (B AND C)` (precedencia SQL estándar).
- No es un bug — pero puede sorprender a un usuario que espera semántica SQL con 3+ condiciones mixtas AND/OR. Recomendado: nota inline en el modal ("las condiciones se evalúan en orden, de izquierda a derecha") o reordenar visualmente por grupos.

### BUG-F10 · Bajas — cambiar "Columna" resetea "Condición" pero no "Valor" ni "Columna a comparar"

- **Dónde:** `useAdvancedFilters.js:41-43`.
- **Reproducción:** al cambiar la columna de una condición, `condition` se resetea correctamente (`contains`/`before` según tipo), pero `value` y `compareColumn` conservan el valor de la columna anterior — puede quedar un filtro con un valor "fantasma" que el usuario no relacionó con la nueva columna.
- **Fix sugerido:** resetear también `value`/`compareColumn` al cambiar `column` en el mismo `updateAdvancedCondition`.

---

## 4. Bugs — BAJA prioridad / UX menor

| # | Hallazgo | Dónde |
|---|---|---|
| B-01 | `AdvancedFiltersModal` no cierra con `Escape` (sí lo hace `ColumnFilterDropdown`). Visto en Mov. Posiciones y Bajas. | `AdvancedFiltersModal.jsx` (sin handler de teclado) vs `ColumnFilterDropdown.jsx:142-148` |
| B-02 | Consola con reconexiones repetidas "SSE desconectado, reintentando en 5s" en varios tabs. No relacionado a los componentes de filtro, fuera de alcance de esta sesión. | infraestructura / SSE |
| B-03 | 404 recurrentes en `/gobierno`, `/tramites` (prefetch de nav superior). No relacionado a filtros. | navegación global |

---

## 5. Verificado correcto (sin bug, cruzado contra DB)

- **Totales sin filtrar** de los 4 tabs (11,451 Mov. Posiciones; 152,117 Movimientos; 5,677 Bajas; universo de Plantilla Detalle) coinciden exacto con `COUNT(*)` en DB — sin truncamiento ni paginación oculta que afecte el universo sobre el que operan los filtros.
- **AND/OR con 2 condiciones de texto** (Mov. Posiciones): verificado por inclusión-exclusión exacta (A=9,047, B=5,978, AND=4,944, OR=10,081; A+B−AND=OR ✓).
- **`compareType:"campo"`** con columnas sin nulos en la muestra (Mov. Posiciones `fecha_captura` vs `fecha_est`, Bajas `RFC` vs `CURP`): partición exacta contra DB — el bug F-01 no se manifiesta aquí precisamente porque no hay valores vacíos, no porque el código esté corregido.
- **Contains / not_contains simple** (Bajas: "renuncia" → 3,441; "no contiene" → 2,236, complemento exacto de 5,677).
- **Condiciones de fecha `DateField` puras** (`fecha_efectiva`, `f_efva`, `fecha_captura`, `fecha_est`, `fecha_vacancia`) — solo `fh_ult_actz`/`fecha_ult_actz` (con hora embebida) están afectadas.
- **Alta cardinalidad** (`HIGH_CARDINALITY_THRESHOLD=500`): columnas ID (Posición 4,362 valores en Bajas, `no_pos_actual` 11,451 en Mov. Posiciones, Id Empleado 10,561 en Plantilla Detalle) ocultan la lista hasta escribir búsqueda, según diseño; la búsqueda por substring funciona.
- **"Todos los datos" vs "Vista actual"** en `ColumnFilterDropdown`: scoping correcto contra DB en los tabs probados (excepto el contador visual de BUG-F07).
- **Árbol de fechas año→mes→día**: conteos correctos, botones "Todo"/"Ninguno" por nodo correctos.
- **Badge de conteo** en el botón trigger de "Filtros Avanzados" y persistencia del formulario al cerrar sin aplicar: correctos.
- **Catálogo de motivos de baja** (checkbox Motivo=Jubilación\* → 85, coincide con DB) y "(Vacío)" mostrado correctamente cuando aplica.

---

## 6. Prioridad de corrección sugerida

1. **BUG-F01** y **BUG-F02** — viven en utilidad compartida (`advancedFilters.js`/`columnFilters.js`), afectan los 4 tabs simultáneamente. Fix es acotado (una guarda + un flag `normalize:true`).
2. **BUG-F03** y **BUG-F04** — server-side, datos reales del negocio filtrados incorrectamente en producción hoy mismo.
3. **BUG-F05** — bloquea la interacción sin señal visual, alta fricción aunque baja frecuencia de repro exacta.
4. Resto de MEDIA/BAJA según disponibilidad.
