# Auditoría de Bugs y Rendimiento — `eje_central_front`

> Fecha: 2026-07-03 · Alcance: `src/` (108 archivos JS/JSX, ~35.6k líneas) · Stack: Next.js 16 (App Router) + React 19.

Este documento lista bugs de correctitud, problemas de rendimiento (tiempos de carga) y malas
prácticas de React detectados, cada uno con ubicación `archivo:línea`, impacto y corrección
propuesta. Al final hay un **plan de corrección por fases**.

---

## Resumen ejecutivo

| # | Hallazgo | Severidad | Tipo |
|---|----------|-----------|------|
| B1 | Condiciones de carrera en fetch de cliente (sin cancelación) | 🔴 Alta | Bug |
| B2 | `MOTIVOS_COUNT_MAP` con conteos **hardcodeados** mostrados al usuario | 🔴 Alta | Bug de datos |
| B3 | Búsqueda global recorre **todas** las claves de cada fila (70+ cols) | 🟠 Media | Perf |
| B4 | Filtro/orden 100% en cliente sobre dataset completo en cada tecla | 🟠 Media | Perf |
| B5 | Tabs se desmontan/re-montan: pierden estado y **re-fetchean** | 🟠 Media | Perf/UX |
| B6 | Cero `React.memo`; filas de tabla re-renderizan en cada cambio | 🟠 Media | Perf |
| B7 | `next.config.mjs` sin optimizaciones de producción | 🟠 Media | Perf |
| B8 | Dos librerías de Excel (`xlsx` + `exceljs`) en el bundle | 🟠 Media | Perf/bundle |
| B9 | `cache: 'no-store'` + `force-dynamic` global: nada se cachea | 🟡 Baja | Perf |
| B10 | `getMovimientosPersonalHistorial` arma GET con lista gigante en URL | 🟡 Baja | Bug latente |
| B11 | 69 `console.*` en producción | 🟡 Baja | Limpieza |
| B12 | Catálogos UN/UA duplicados dentro de componente (283 líneas) | 🟡 Baja | Mantenibilidad |
| B13 | Efecto `keydown` se re-suscribe en cada cambio de datos | 🟡 Baja | Perf menor |
| B14 | Estado muerto (`isTightLayout` incluye `organigrama` inexistente) | 🟡 Baja | Limpieza |

---

## 🔴 Bugs de correctitud

### B1 — Condiciones de carrera: fetch de cliente sin cancelación

**Dónde:** patrón repetido en 7+ componentes. Ejemplos:
- `src/app/dashboard/plantilla_empleados/_components/tabs/mov-posiciones/MovimientosPersonalTab.jsx:770-778` (fetch principal)
- `…/MovimientosPersonalTab.jsx:436-451` (stats), `:539-567` (motif stats), `:498-510` (fechas)
- `src/app/dashboard/monitoreo_zafiro/ClientComponent.jsx`, `…/ocupacion_plazas_por_oficio/ClientComponent.jsx`, etc.

```js
VacantesService.getMovimientosPersonal(params)
  .then((res) => res.json())
  .then((resData) => { setData(resData.results || []); setCount(resData.count || 0); })
```

**Problema:** el efecto depende de ~13 variables (page, filtros, sort, año…). Al teclear/filtrar
rápido se disparan varias peticiones concurrentes. Como no hay `AbortController` ni guarda de
"última petición gana", **una respuesta lenta anterior puede sobrescribir a una más nueva** →
la tabla muestra datos que no corresponden a los filtros actuales. Solo `EstatusTab.jsx:323` usa
`AbortController`; el resto no.

**Corrección:**
```js
useEffect(() => {
  const ctrl = new AbortController();
  setLoading(true);
  VacantesService.getMovimientosPersonal(params, { signal: ctrl.signal })
    .then(res => res.json())
    .then(resData => { setData(resData.results || []); setCount(resData.count || 0); })
    .catch(err => { if (err.name !== 'AbortError') console.error(err); })
    .finally(() => setLoading(false));
  return () => ctrl.abort();
}, [/* deps */]);
```
`apiFetch` ya reenvía `options` a `fetch`, así que basta pasar `{ signal }`. Alternativa sin red:
guardar un `requestIdRef` que se incrementa y descartar respuestas viejas.

---

### B2 — `MOTIVOS_COUNT_MAP`: conteos hardcodeados mostrados en la UI

**Dónde:** `…/MovimientosPersonalTab.jsx:40-57` (definición) y `:1876-1877` (uso).

```js
const MOTIVOS_COUNT_MAP = { "Baja": 18, "Cambio Organizacional": 12, ... };
// ...
title={`${slice.accion_nombre} (con ${MOTIVOS_COUNT_MAP[slice.accion_nombre] || 0} motivos diferentes)`}
```

**Problema:** el número de "motivos diferentes" por acción está **fijo en código**. Cuando los
datos de ZAFIRO cambien, la UI mostrará conteos falsos (o `0` para acciones nuevas). Es dato de
negocio incrustado como constante.

**Corrección:** calcular el conteo real desde `statsData`/`motifStatsData` (o exponer el conteo
en el endpoint de stats del backend) y eliminar el mapa estático.

---

## 🟠 Rendimiento y tiempos de carga

### B3 — Búsqueda global recorre todas las claves de cada fila

**Dónde:** `…/plantilla-detalle/PlantillaDetalleTab.jsx:471-474` (y patrón similar en `:542`).

```js
if (!Object.entries(row).some(([key, val]) =>
    (key === "estado_nomina" ? mapEstadoNomina(val) : String(val || "")).toLowerCase().includes(searchText)))
  return false;
```

**Problema:** por cada fila se hace `Object.entries` (70+ columnas), se convierte cada valor a
string y `toLowerCase()` en cada tecla. Con miles de filas es O(filas × columnas) por pulsación.

**Corrección:** precomputar un índice de búsqueda por fila (un solo string en minúsculas) una vez
cuando llega `detalle`, y buscar sobre ese blob. O limitar la búsqueda a columnas visibles/relevantes.

---

### B4 — Filtro + orden 100% en cliente sobre el dataset completo

**Dónde:** `…/PlantillaDetalleTab.jsx:469-530` (`filteredSortedData`).

**Problema:** todo el pipeline (búsqueda global + filtros de columna + filtros de texto + filtros
avanzados + `sort` con `localeCompare` numérico) corre en el hilo principal. Mitigado por
`useDeferredValue` (`:202-203`) y virtualización (`:582-585`), pero el `sort` con `localeCompare`
sobre miles de filas sigue siendo caro y bloquea en datasets grandes. Contrasta con
`MovimientosPersonalTab`, que sí pagina en servidor.

**Corrección (elige según tamaño real):**
- Si `detalle` es < ~3-5k filas: aceptable; al menos memoizar `filtered` y `sorted` por separado
  para no re-ordenar cuando solo cambia un filtro.
- Si es grande: mover filtro/orden/paginación al backend (como ya hace `MovimientosPersonalTab`).

---

### B5 — Los tabs se desmontan/re-montan: pierden estado y re-fetchean

**Dónde:** `…/plantilla_empleados/ClientComponent.jsx:244-315` (render condicional `activeTab === … && <Tab/>` dentro de `<AnimatePresence mode="wait">` con `key={activeTab}`).

**Problema:** al cambiar de tab, React **desmonta** el tab anterior y monta el nuevo. Consecuencias:
1. Tabs que fetchean en cliente (`MovimientosPersonalTab`, que no recibe datos por props —
   `:287-293`) **vuelven a pedir todo** cada vez que se visita el tab.
2. Todos los tabs **pierden** filtros, orden, columnas y scroll al salir y volver.

**Corrección:** mantener montados los tabs visitados (ocultar con CSS en vez de desmontar), o
elevar el estado de cada tab a un store/URL, o cachear las respuestas (SWR/React Query o un cache
en el service). Mínimo: cachear el `secondaryDataPromise` ya lo hacen; extender ese patrón.

---

### B6 — Sin `React.memo`: las filas re-renderizan en cada cambio de estado

**Dónde:** `…/shared/DataTable.jsx` (0 usos de `memo` en todo el proyecto).

**Problema:** `renderCell` es una función nueva en cada render del tab padre, y `DataTable` no está
memoizado. Cualquier `setState` del padre (hover, tooltip, dropdown) re-renderiza todas las filas
visibles y todas las celdas.

**Corrección:** envolver `DataTable` en `React.memo`, memoizar `renderCell` con `useCallback`, y
extraer la fila a un componente `memo`. Ganancia grande en interacción con tablas grandes.

---

### B7 — `next.config.mjs` sin optimizaciones de producción

**Dónde:** `next.config.mjs` (solo tiene `allowedDevOrigins`).

**Problema:** no se aprovechan optimizaciones de bundle para librerías pesadas presentes en
`package.json`: `lucide-react`, `recharts`, `three`/`@react-three`, `maplibre-gl`, `motion`,
`ag-grid-react`, `jspdf`. Los imports con nombre de `lucide-react` (docenas por archivo) inflan el
bundle si no se optimizan.

**Corrección:**
```js
const nextConfig = {
  allowedDevOrigins: [...],
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', '@heroicons/react'],
  },
};
```
Verificar además con `next build` el reporte de tamaño por ruta.

---

### B8 — Dos librerías de Excel en el bundle

**Dónde:** `xlsx` **y** `exceljs` usados en 6 archivos (`utils/excelExport.js`, `utils/cuadroVacanciaExcel.js`, `PlantillaDetalleTab`, `MovimientosPersonalTab`, `BajasTab`, `SimuladorValuacion`).

**Problema:** ambas librerías son grandes (~800KB-1MB c/u) y hacen lo mismo. Además, la exportación
suele delegarse al backend (`PlantillaService.exportExcel`, `exportarEstatusExcel`), por lo que
tener dos libs cliente es redundante.

**Corrección:** estandarizar en **una** (preferible `exceljs`, ya cargada con `import()` diferido) o,
mejor, exportar siempre desde el backend y quitar ambas del cliente. `xlsx` (SheetJS) además arrastra
CVEs históricos.

---

### B9 — `cache: 'no-store'` + `force-dynamic` global

**Dónde:** `src/lib/fetch-interceptor.js:41` y `export const dynamic = 'force-dynamic'` en 6 páginas.

**Problema:** cada navegación a un dashboard re-ejecuta el Server Component y re-pide todo al backend,
sin dedupe ni caché. Es la causa base de "tarda en cargar cada vez".

**Corrección:** para datos que no cambian por segundo, usar `next: { revalidate: N }` en vez de
`no-store`, y reservar `force-dynamic` para lo realmente en vivo. El `ZafiroUpdatesContext` ya avisa
por SSE cuando hay datos nuevos (`router.refresh()`), así que se puede cachear con confianza e
invalidar en el evento.

---

### B13 — Efecto `keydown` se re-suscribe en cada cambio de datos

**Dónde:** `…/PlantillaDetalleTab.jsx:595-644` (dep array `[columns, filteredSortedData]`).

**Problema:** cada vez que cambian los datos filtrados (o sea, en cada tecla de búsqueda) se
remueve y re-agrega el listener global de teclado. Innecesario.

**Corrección:** leer `filteredSortedData.length`/`columns` desde refs actualizadas por otro efecto,
y dejar el listener con deps `[]`.

---

## 🟡 Menores / limpieza

- **B10** — `vacantes.service.js:326-333`: `getMovimientosPersonalHistorial` construye
  `?num_empleado__in=<lista>.join(",")` en un **GET**. Con muchas selecciones la URL supera el límite
  (~8KB en muchos servidores) → 414/silencioso. Cambiar a POST con body, o lotear.
- **B11** — 69 `console.log/error/warn`. Dejar solo los de error con un logger que se apague en prod
  (o `compiler.removeConsole` en `next.config`).
- **B12** — `UN_CATALOG`/`UA_CATALOG` (`MovimientosPersonalTab.jsx:60-143`) duplican catálogos que
  también viven en el backend. Moverlos a un módulo compartido o pedirlos por API para evitar
  divergencia.
- **B14** — `ClientComponent.jsx:92`: `isTightLayout` incluye `"organigrama"`, que no es un tab de
  este componente (el organigrama es página aparte). Condición muerta.
- **Interceptor 401 server-side** — `fetch-interceptor.js:46-50`: en el servidor un 401 no limpia
  sesión ni redirige (solo en cliente). Manejar el 401 en las páginas server para redirigir a login.
- **`useTableData`** (`hooks/useTableData.js:47`): excluye `fetcher` de deps a propósito; si algún
  consumidor pasa un `fetcher` que depende de props sin listarlo en `deps`, quedará capturado obsoleto.
  Documentado, pero es un footgun; considerar envolver `fetcher` en `useCallback` del lado del consumidor.

---

## Plan de corrección (por fases)

### Fase 1 — Correctitud (rápido, alto impacto)
1. **B1**: añadir `AbortController` (o guarda de request-id) a los 7 fetch de cliente. Crear un
   hook `useAbortableFetch` para no repetir el patrón.
2. **B2**: reemplazar `MOTIVOS_COUNT_MAP` por conteo real desde stats.
3. **B10**: pasar `getMovimientosPersonalHistorial` a POST con body.

### Fase 2 — Tiempos de carga
4. **B9**: sustituir `no-store` por `revalidate` + invalidación por SSE. Medir antes/después.
5. **B7**: activar `optimizePackageImports`, `compress`, `removeConsole` en `next.config`.
6. **B8**: consolidar Excel en una sola lib o mover a backend.
7. **B5**: mantener tabs montados (CSS hide) o cachear respuestas por tab.

### Fase 3 — Rendimiento de interacción
8. **B6**: `React.memo` en `DataTable` + fila memoizada + `renderCell` con `useCallback`.
9. **B3/B4**: índice de búsqueda precomputado; separar memos de filtro y orden; evaluar paginación
   server-side en `PlantillaDetalleTab` si el dataset es grande.
10. **B13**: listener de teclado con deps `[]` + refs.

### Fase 4 — Limpieza / mantenibilidad
11. **B11** consolas, **B12** catálogos compartidos, **B14** estado muerto, 401 server-side.

**Métrica objetivo:** medir con Lighthouse/`next build` el tamaño de bundle por ruta y el TTI antes
y después de Fase 2; medir tiempo de respuesta percibido al filtrar en tablas antes/después de Fase 3.
