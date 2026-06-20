# Plan de Refactorización Mayor — `eje_central_front`

> Documento maestro. Generado tras auditoría del repositorio. Cubre 3 tareas
> secuenciales: arquitectura de carpetas, capa de servicios y modularización +
> reutilización. No borrar hasta cerrar las 3 tareas.

---

## Resumen de hallazgos (auditoría)

- **23 archivos `.py`** sueltos (22 en raíz + `src/components/fix_actuales.py`):
  codemods/parches autogenerados mezclados con el código fuente. Todos
  trackeados en git, ninguno referenciado desde JS/JSX.
- **30 componentes planos** en `src/components/` sin agrupación por dominio.
- **Capa de servicios parcial ya existe**: `src/lib/fetch-interceptor.js`
  (`apiFetch`, inyecta cookie/token) + 7 services en `src/services/`. Los tabs
  ya consumen `VacantesService`. Falta JSDoc estricto y migrar fetches sueltos.
- **`fetch(` manual pendiente de migrar**: `src/app/dashboard/organigrama/page.jsx`
  y `src/app/prueba/page.jsx` (página de prueba). El resto vive dentro de
  services (válido).
- **4 monolitos** en `plantilla_empleados` (~8.500 líneas juntas):
  - `MovimientosTab.jsx` — 2540 L
  - `MovimientosPersonalTab.jsx` — 2460 L (mov. posiciones)
  - `BajasTab.jsx` — 1875 L
  - `PlantillaDetalleTab.jsx` — 1672 L
- **Duplicación copy-paste confirmada** entre los 4 tabs:
  - Tabla idéntica (misma `className`, misma fórmula de ancho
    `95 + columns.filter(c => c.visible)...`, mismo `<thead>` `bg-[#501929]`).
    MovimientosTab y BajasTab repiten la tabla 2 veces internamente.
  - Lógica de filtro inline reimplementada por tab (`OPERATORS`,
    `getColumnType`, `applyOperator`): 21 / 19 / 16 / 14 ocurrencias.
  - **21 variables de estado idénticas en los 4 tabs.** Cada tab carga
    33–55 `useState`.
- **`AdvancedFilterModal.jsx` (331 L) + `useAdvancedFilter.js` (167 L) son
  huérfanos**: nadie los importa. Intento previo de extracción nunca cableado.
  Se reviven como base genérica en lugar de escribir nuevos.

---

## TAREA 1 — Limpieza y arquitectura de carpetas

### 1a. Aislamiento de scripts Python → `/scripts`

Mover los 23 `.py` (con `git mv`, preservan historia) a `/scripts` con subcarpetas:

```
scripts/
  patches/    # codemods que editan el fuente
    add_search.py, fix_layout.py, fix_movimientos.py, fix_service.py,
    fix_tabs.py, make_mapatab_fullscreen.py, make_map_fullscreen.py,
    make_text_darker.py, make_text_darker_main.py, patch_movimientos.py,
    replace_theme.py, replace_theme_modal.py, fix_actuales.py
  scratch/    # recuperación / reversión / generación puntual
    refactor.py, recover_file.py, recover_stats.py, restore_filters.py,
    restore_stats.py, revert_tabs.py, gen_bajas.py
  extract/    # extracción de datos
    extract_full.py, extract_pie.py, table_extract.py
  README.md   # qué hace cada script
```

Riesgo: **cero** (ningún import JS los toca).

### 1b. Co-location por página + ordenar `src/components/`

Mapa de propiedad (qué página consume cada componente):

| Dominio | Componentes |
|---|---|
| `plantilla_empleados` (tabs) | `PlantillaDetalleTab`, `MovimientosTab`, `MovimientosPersonalTab`, `BajasTab`, `EstatusTab`, `CuadrosVacanciaTab`, `MapaTab`, `TorreCaballito3DTab` |
| `plantilla_empleados` (modals/charts internos) | `EmpleadoTimelineModal`, `PosicionTimelineModal`, `DetalleVacantesModal`, `DetalleVacantesTablas`, `DesgloseJerarquicoCharts`, `PieChartsGrid`, `EmployeesModal` (usado por los 6 tabs) |
| `ocupacion_plazas_por_oficio` | `OcupacionFilterDrawer`, `OcupacionSankeyView`, `OcupacionStatsView`, `OcupacionTableView`, `RegistrosOficioModal` |
| `valuacion_presupuestaria` | `AsuntosValuacion`, `ParametrosValuacion`, `SimuladorValuacion` |
| Compartido 2+ páginas | `OficioDetailModal` (ocupacion + oficios_turnados_do), `OficioSelectStyles` |
| Global / layout | `Navbar`, `Banner`, `CodigoVerificacionDrawer`, `EmpleadosTableModal` |
| Genérico (T3) | `AdvancedFilterModal` → base de `FilterModal` |
| Sin tocar | `src/components/ui/` (shadcn) |

Árbol objetivo:

```
src/
  app/dashboard/
    plantilla_empleados/
      page.jsx
      ClientComponent.jsx            # solo orquesta tabs
      _components/
        shared/
          DataTable.jsx              # (T3) tabla genérica
          FilterModal.jsx            # (T3) ex-AdvancedFilterModal
          EmployeesModal.jsx
        tabs/
          plantilla-detalle/
          movimientos/
          mov-posiciones/
          bajas/
          estatus/
          cuadros-vacancia/          # + DesgloseJerarquicoCharts, DetalleVacantes*, PieChartsGrid
          mapa/
          torre-3d/
        modals/
          EmpleadoTimelineModal.jsx
          PosicionTimelineModal.jsx
      _hooks/                        # hooks específicos de la página
    ocupacion_plazas_por_oficio/_components/...
    valuacion_presupuestaria/_components/...
  components/
    layout/      # Navbar, Banner, CodigoVerificacionDrawer, EmpleadosTableModal
    shared/      # OficioDetailModal, OficioSelectStyles
    ui/          # shadcn, intacto
  hooks/         # hooks genéricos
  services/      # capa API (T2)
  utils/         # lógica pura (T3: filters.js)
scripts/         # Python (T1a)
```

Regla: ver el árbol de una página = inferir su UI. Al mover, **arreglar cada
import** (`@/components/X` → nueva ruta) y verificar que compile.

---

## TAREA 2 — Capa de servicios (API layer)

1. **Cero `fetch` manual en componentes.** Migrar `organigrama/page.jsx` y
   evaluar `prueba/page.jsx` (borrar o migrar).
2. **Todo service usa `apiFetch`** (interceptor con cookie/token), nunca `fetch`
   crudo. Auditar `control_gestion.service.js` y `cat_tipo_oficio.service.js`.
3. **Integrar `useAuth` / `apiFetch`** para que toda petición lleve el token de
   sesión.
4. **JSDoc estricto** en cada función de servicio: resumen, `@param {tipo} nombre`,
   `@returns {Promise<tipo>}`.

Inventario services actual: `auth`, `cat_tipo_oficio`, `control_gestion`,
`ocupacion`, `plantilla`, `presupuesto`, `vacantes`.

---

## TAREA 3 — Modularización + reutilización

### 3a. Funciones puras → `src/utils/filters.js`
`OPERATORS`, `getColumnType`, `applyOperator(value, op, target)`,
`matchesFilters(row, filters)`. Una sola fuente; los tabs importan, no copian.

### 3b. Hooks (estado repetido → hook)

| Hook | Absorbe (estado repetido x4) | Ubicación |
|---|---|---|
| `useTableData(service, params)` | `loading`, datos, error, `mounted` | `src/hooks/` (ata T2) |
| `useColumnState(initCols)` | `columns`, `cardWidth`, `isColumnsModalOpen`, resize/visibilidad | `_hooks/` |
| `useSort()` | `sortConfig` | `src/hooks/` |
| `useColumnFilters()` | `textFilters`, `columnFilters`, `tempSelectedValues`, `activeFilterDropdown`, `activeConditionDropdown`, `filterDropdownTab`, `filterSearchText`, `columnSearchText`, `filterSearchCondition` | refactor de `useAdvancedFilter` |
| `useCellSelection()` | `selectedCell`, `selectedRowData`, `isCellModalOpen`, `contextMenu` | `_hooks/` |
| `useExcelExport()` | `isExportingExcel` + fn export | `src/hooks/` |
| `useDebouncedValue(v, ms)` | patrón `debouncedFilterSearchText` | `src/hooks/` (genérico) |
| `useGlobalSearch()` | `searchQuery`, `globalSearch` | `_hooks/` |

### 3c. Componentes genéricos
- `<DataTable>`: props `columns`, `data`, `onSort`, `rowRender`, anchos/visibilidad.
  Mata las ~8 copias de `<table>`.
- `<FilterModal>`: revivir `AdvancedFilterModal`. Props `columns`, `filters`, `onApply`.

### 3d. Resultado por tab
De ~50 `useState` sueltos → ~4 llamadas a hooks + config de columnas + render con
`<DataTable>` y `<FilterModal>`.

---

## Orden de ejecución

1. **T1a** — mover `.py` a `/scripts` (riesgo cero). ← EN CURSO
2. **T1b** — co-location de componentes + arreglar imports + verificar build.
3. **T2** — auditar services, migrar `organigrama`, JSDoc.
4. **T3** — `utils/filters.js`, hooks, `DataTable`, `FilterModal`, adelgazar los 4 tabs.

## Decisiones tomadas
- Carpeta de scripts: `/scripts` (no `/automation`).
- Los `.py` se **conservan versionados** y movidos (reversible), no se borran.

## Estado
- [x] T1a — 23 `.py` movidos a `scripts/{patches,scratch,extract}/` + README.
- [x] T1b — componentes co-locados (build ✓ `Compiled successfully`):
  - `components/layout/` ← Navbar, Banner
  - `components/shared/` ← CodigoVerificacionDrawer, EmpleadosTableModal, OficioDetailModal, OficioSelectStyles
  - `ocupacion_plazas_por_oficio/_components/` ← 4 vistas Ocupacion + RegistrosOficioModal
  - `valuacion_presupuestaria/_components/` ← Asuntos/Parametros/Simulador Valuacion
  - `plantilla_empleados/_components/{shared,modals,tabs/<x>}/` ← 8 tabs + EmployeesModal + AdvancedFilterModal + cuadros-vacancia subtree + 2 timeline modals
  - imports reescritos; 2 imports relativos huérfanos de batch1 corregidos (TorreCaballito3DTab).
  - `components/` raíz queda solo con `ui/`, `layout/`, `shared/`.
- [x] T2 — capa de servicios (build ✓ limpio, sin ruido de prerender):
  - `cat_tipo_oficio` (5) y `control_gestion` (6 catálogos Django) migrados de `fetch` crudo a `apiFetch`.
  - 3 llamadas de `control_gestion` a la API externa de CG quedan en `fetch` directo
    **intencional** (host distinto, header `Origin`, sin token de sesión); documentado.
  - `organigrama/page.jsx`: fetch inline `/plantilla/organigrama_search/` → `PlantillaService.getOrganigramaSearch()` (nuevo método).
  - JSDoc estricto (resumen + `@param` tipados + `@returns`) en los 7 services.
  - `vacantes`: deduplicado el armado de query string en helper `buildQuery`.
  - Fetch crudo restante justificado: organigrama L54 (`/organigramas/*.json`, asset estático),
    `prueba/page.jsx` (`/api/ai/chat/`, página de pruebas — pendiente borrar o migrar).
- [x] T3a — capa pura. CORRECCIÓN: los 4 tabs usan filtro Excel-style por-columna
  (valores + condición de texto + árbol de fecha), NO el rule-chain del hook
  huérfano (0 importadores). Resultado:
  - `utils/columnFilters.js` (modelo real, canónico). Commit `2897fd7`.
  - hooks genéricos `useDebouncedValue`, `useSort`, `useTableData`. Commit `35a4b5a`.
  - BORRADO código muerto: `utils/filters.js`, `useAdvancedFilter.js`, `AdvancedFilterModal.jsx`.
- [~] T3b — genéricos (firmas aprobadas, hook completo). Construido additivo
  (commit `bcb8159`), sin cablear aún:
  - hooks `useColumnState`, `useCellSelection`, `useColumnFilters` (`_hooks/`).
  - `ColumnsModal` genérico (`_components/shared/`).
  - PENDIENTE: `ColumnFilterDropdown` (panel valores+texto+árbol fecha) y `DataTable`
    (tabla sticky + resize + header 2-filas + virtualización). Son los más grandes.
- [~] T3c — piloto `PlantillaDetalleTab` (incremental, cada paso build ✓):
  - [x] `<ColumnsModal>` genérico (commit `bf7319d`).
  - [x] `useColumnState` (commit `322f2ce`).
  - [x] `useCellSelection` (commit `305862b`, expone setters crudos para drop-in).
  - [x] `useColumnFilters` (drop-in setters planos, commit `02d8a3a`): agrupa
    estado de filtros + UI dropdown + debounce. Tab mantiene su `filteredSortedData`
    y panel, ahora sourcing del hook.
  - `useState` del tab: **33 → 14** (los 14 restantes son propios: cadena de mando,
    donut, export, scroll, mounted).
  - PILOTO funcionalmente completo (build verde en cada paso). PENDIENTE: smoke-test
    en dev (filtros/columnas/celda) — build ✓ no garantiza paridad runtime.
  - [ ] replicar hooks/ColumnsModal en MovimientosTab/MovimientosPersonalTab/BajasTab.

> Nota desviación menor vs plan: `EmpleadosTableModal` y `CodigoVerificacionDrawer`
> quedaron en `components/shared/` (no `layout/`) por ser modales/widgets reusables,
> no chrome de layout.
