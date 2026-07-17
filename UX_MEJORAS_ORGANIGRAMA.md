# Mejoras UX y bugs — Organigrama ANAM (Verificador Jerárquico)

Componente: `src/app/dashboard/organigrama/page.jsx` (archivo único, ~2113 líneas)
Backend: `eje_central_back/plantilla/views.py` (`OrganigramaCrearNodoView`), tabla `ORGANIGRAMA_ANAM`.

> **Sesión 2026-07-16:** prueba en vivo con `playwright-cli` sobre `http://89.116.51.124:3030/dashboard/organigrama` (SuperAdmin). Se probaron: buscador de área, selector de unidad de negocio, crear/eliminar Dirección General, crear subordinado, expandir/colapsar, zoom, exportar PNG, modal de detalle/edición, y viewport móvil. Toda la unidad de negocio y los nodos dummy creados durante la prueba (`99999` / `99999999999`, tipo "ZZZ-PRUEBA-...") fueron eliminados al cierre de la sesión — confirmado con `SELECT COUNT(*) ... = 0` contra `ORGANIGRAMA_ANAM`. No se modificó ningún dato real.

> **Actualización 2026-07-16 (revisión de código):** se releyó `page.jsx` completo (2475 líneas) + `views.py` contra los 9 hallazgos de abajo. **8 de 9 ya están resueltos en el código actual** — quedan marcados inline como ✅ RESUELTO con la evidencia (línea/archivo). Solo sigue pendiente el **Bug #7 (móvil)**.

---

## Bugs encontrados

### Bug #1 — El canvas se ve en blanco al cargar la página [CRÍTICO] — ✅ RESUELTO

> `page.jsx:373-381`: `useEffect` hace `scrollIntoView({block:"start", inline:"center"})` sobre el nodo raíz al terminar de cargar `organigramaData` (con doble `requestAnimationFrame` para esperar el layout), saltándose solo cuando hay un `pendingScrollNode` pendiente (Bug #2). Comportamiento descrito abajo ya no aplica.

**Repro:** entrar a `/dashboard/organigrama` con cualquier unidad de negocio grande (ej. `00900`, 337 nodos). El área del árbol se ve completamente en blanco; solo se ven los paneles flotantes (selector, stats, zoom). No hay skeleton, ni spinner, ni ninguna pista de que el árbol sí cargó.

**Causa raíz:** el árbol se renderiza centrado sobre sí mismo con `flex flex-col items-center` (`page.jsx:995`), así que la tarjeta raíz queda posicionada en el punto medio del ancho total de sus descendientes. Con 337 nodos, medí el contenedor real vía `getBoundingClientRect()`: **20 784 × 898 px**. El contenedor con scroll (`page.jsx:1355-1361`, `overflow-auto`) arranca en `scrollLeft:0, scrollTop:0` — no hay ningún `scrollIntoView` ni centrado automático al montar (el único mecanismo de scroll-a-nodo, `pendingScrollNode`, solo se dispara para resultados de búsqueda entre unidades, nunca en la carga inicial). Con scroll en `(0,0)`, la tarjeta raíz visible más cercana queda en `x≈128, y≈740` — fuera del viewport (`clientHeight: 576`). Resultado: el usuario aterriza en un rectángulo vacío del lienzo, no en el árbol.

Confirmado con captura de pantalla (`organigrama-inicial.png`) y con medición directa del DOM. **Reducir el zoom no lo arregla** (probado a 50 %): el scroll sigue en `(0,0)`, así que sigue sin mostrar nada hasta que el usuario arrastra manualmente el canvas.

**Impacto:** primera impresión del feature es "está roto" — específicamente grave porque el propio footer de stats (`Total áreas: 337`) sí carga y contradice la sensación de que no hay datos.

**Fix sugerido:** al terminar de cargar `organigramaData` (o tras `expandAll`/`Exportar → Todo Desglosado`), centrar el scroll sobre el nodo raíz (`document.getElementById('node-'+organigramaData.departamento)?.scrollIntoView({block:'start', inline:'center'})`) o calcular un zoom inicial que quepa el ancho total en el viewport (`fit to screen`), similar a lo que ya intenta `pendingScrollNode` para búsquedas cross-unidad.

---

### Bug #2 — La búsqueda entre unidades no resalta ni abre el nodo destino [ALTO] — ✅ RESUELTO

> `page.jsx:383-410`: la resolución de `pendingScrollNode` vive en su propio `useEffect`, separado del effect de expand-al-cargar. Ya no se reejecuta por su propia limpieza ni borra el highlight/modal recién aplicado. Comentario en el propio código documenta el porqué.

**Repro:** buscar un área que pertenezca a una unidad de negocio distinta a la actual (ej. buscar "recursos" desde `00900` y hacer click en un resultado de la unidad `00003`) → `expandToNode` (`page.jsx:902-925`) cambia de unidad y guarda `pendingScrollNode`, pero al aterrizar en el nuevo lienzo **no se abre el modal de detalle, no hay highlight ámbar, y no se hace scroll al nodo** — solo se ve el lienzo de la nueva unidad en su posición de scroll por defecto (mismo blanco del Bug #1).

**Causa raíz:** el `useEffect` en `page.jsx:291-325` depende de `[organigramaData, pendingScrollNode]`. Cuando el árbol termina de cargar, expande la ruta al nodo, resalta y selecciona (`setHighlightedNodeId`, `setSelectedNode`) — y 150 ms después llama `setPendingScrollNode(null)` como limpieza. Pero **esa limpieza es en sí misma un cambio de dependencia del mismo effect**, así que el effect se vuelve a ejecutar: en su nueva pasada, `pendingScrollNode` ya es `null`, así que reconstruye `initialExpanded` (solo raíz + hijos directos) y ejecuta incondicionalmente `setSelectedNode(null)` (línea 300) — **borrando el modal/resaltado que acababa de aplicarse 50-150 ms antes**, sin que el usuario llegue a verlo.

Verificado con `getBoundingClientRect()`: el nodo destino sí termina en el DOM (porque por coincidencia era hijo directo de la raíz en ese caso), pero ni el modal ni el highlight ni el scroll persistieron.

**Fix sugerido:** usar un `useRef` para `pendingScrollNode` en vez de estado, o separar la limpieza en un effect distinto que no dispare la reconstrucción de `expandedNodes`/`selectedNode`.

---

### Bug #3 — Buscador de área sin mensaje de "sin resultados" [MEDIO] — ✅ RESUELTO

> `page.jsx:1814-1818`: bloque `searchQuery.trim() && searchResults.length === 0` renderiza "Sin resultados para «...»", igual que `UnidadSelector`.

**Repro:** escribir una búsqueda que no matchea nada (ej. "zzzzznoexiste"). El dropdown de resultados simplemente no aparece — ninguna pista visual de que la búsqueda corrió y no encontró nada, contra un input que simplemente "no hace nada".

**Causa:** `page.jsx:1465` renderiza el dropdown solo si `searchResults.length > 0`. El selector de unidad de negocio (`UnidadSelector`, línea 114-116) sí tiene este patrón ("Sin resultados") — es inconsistente que el buscador principal no lo tenga.

**Fix sugerido:** replicar el mismo patrón: si `searchQuery.trim()` no está vacío y `searchResults.length === 0`, mostrar "Sin resultados para «...»".

---

### Bug #4 — Crear una nueva Dirección General no la deja buscable hasta recargar [MEDIO] — ✅ RESUELTO

> `page.jsx:898-903`: `handleCreateGeneral` ya llama `setGlobalCatalog(prev => [...prev, {...}])` tras crear, igual que `handleCreateChild`.

**Repro:** crear una Dirección General nueva (botón "+ Nueva Dirección General") → queda seleccionada y visible en el lienzo, pero si se busca su nombre en "Buscar área" **no aparece** en los resultados.

**Causa raíz:** `handleCreateChild` (subordinados) sí sincroniza el catálogo en memoria tras crear (`page.jsx:737-742`, `setGlobalCatalog(prev => [...prev, {...}])`), pero `handleCreateGeneral` (`page.jsx:650-684`) nunca lo hace. Es la misma clase de nodo (recién creado, sin refetch), pero con comportamiento inconsistente entre los dos flujos de creación.

**Fix sugerido:** agregar la misma línea `setGlobalCatalog(prev => [...prev, {...}])` al final de `handleCreateGeneral`.

---

### Bug #5 — Backend: crear el primer subordinado bajo una Dirección General nueva puede fallar con "numeración agotada" [ALTO, BACKEND] — ✅ RESUELTO

> `views.py:4531-4534`: la query ya incluye `.exclude(departamento=parent_code)`, tal cual se sugería.

**Repro:** crear una Dirección General con determinante que termine en dígitos distintos de cero (ej. `99999999999`) y de inmediato intentar "Agregar subordinado" tipo "Dirección Central" → el backend responde `409 Conflict`: *"Se agotó la numeración disponible (2 dígitos) bajo 99999999999 para el nivel 'Central'"* — con el nodo recién creado y **cero hijos**.

**Causa raíz** (`eje_central_back/plantilla/views.py:4531-4548`): la query que calcula el siguiente número libre de 2 dígitos es

```python
siblings = OrganigramaAnam.objects.filter(
    unidad_negocio=parent.unidad_negocio,
    departamento__startswith=prefix,
).values_list("departamento", flat=True)
```

Esta query **no excluye al propio nodo padre**, y el código del padre siempre matchea trivialmente su propio prefijo (`departamento__startswith=prefix` incluye a `parent_code` mismo). Si el segmento correspondiente al nivel del hijo dentro del código del padre no es `"00"` (p. ej. porque el determinante fue capturado a mano y no sigue la convención de terminar en ceros — el formulario de "Nueva Dirección General" no valida ni sugiere esto más allá de un placeholder de ejemplo), ese valor se cuela como si fuera un "hermano" existente e infla `max_num`, bloqueando la numeración real desde el primer hijo.

**Fix sugerido:** excluir al padre explícitamente: `siblings = OrganigramaAnam.objects.filter(...).exclude(departamento=parent_code)`.

---

### Bug #6 — "Exportar PNG → Todo Desglosado" produce una imagen truncada e inutilizable [ALTO] — ✅ RESUELTO

> El export ya no es PNG: `page.jsx:1208-1301` (`handleExportPdf`) genera un PDF troceando el árbol en franjas verticales (`PDF_TILE_PX`) capturadas con `toCanvas` a `pixelRatio 3`, cada una volcada como imagen independiente en el PDF y liberada de memoria antes de la siguiente. Ya no hay límite de 16384px (ese límite era de canvas PNG, no aplica a páginas PDF) ni recorte de niveles inferiores. También corrige la causa raíz reportada: usa doble `requestAnimationFrame` en vez de `setTimeout` fijo, y fuerza `zoom:1` en el DOM real antes de medir.

**Repro:** con la unidad `00900` (337 nodos) → Exportar PNG → "Todo Desglosado". Se descarga `organigrama_00900_completo_....png`.

**Resultado:** el PNG mide **16 384 × 331 px** — el ancho topa exactamente con el límite máximo de canvas de Chromium (16384 px), y la altura de 331 px es una fracción mínima de lo que debería medir un árbol de 5 niveles con cientos de tarjetas expandidas (medí ~900 px solo para 2 niveles parcialmente expandidos). Al inspeccionar la imagen a resolución real, **faltan por completo las Subdirecciones y Jefaturas** — solo se alcanzan a capturar Generales/Centrales/Directores en el borde superior.

**Causa probable:** `handleExportPng("full")` (`page.jsx:928-958`) expande todos los nodos y espera **400 ms fijos** antes de llamar `toPng()` (html-to-image) sobre `#tree-capture-container` — insuficiente para que el navegador termine de re-renderizar/repintar miles de nodos nuevos en un árbol tan grande, sobre todo contra el host remoto de pruebas. Además, el contenedor capturado usa la propiedad CSS no estándar `zoom` (línea 1366) para el control de zoom de la UI, la cual es conocida por interferir con las mediciones de `getBoundingClientRect()`/`offsetHeight` que usan librerías de captura como html-to-image.

**Fix sugerido:**
1. Esperar a un frame post-layout real (`requestAnimationFrame` doble, o esperar a que `scrollHeight` del contenedor se estabilice) en vez de un `setTimeout` fijo.
2. Migrar el control de zoom de `style={{ zoom }}` a `transform: scale()` (estándar, sin las inconsistencias de `zoom` en herramientas de captura/impresión).
3. Advertir o bloquear la exportación "Todo Desglosado" cuando el ancho proyectado exceda el límite de canvas del navegador (16384 px), o trocear la exportación en varias imágenes/páginas.

---

### Bug #7 — La página no es usable en viewport móvil [ALTO] — ❌ SIGUE PENDIENTE

> Verificado en código: el panel flotante (`page.jsx:1717`) sigue siendo `absolute top-4 left-4 z-20 w-80` fijo, sin ningún breakpoint `sm:`/`md:` que lo colapse o reubique. Único hallazgo de los 9 que no tiene fix en el código actual.

**Repro:** abrir `/dashboard/organigrama` en 390×844 (iPhone estándar).

**Resultado:** el panel flotante de selector+búsqueda (`w-80` = 320 px fijo, `absolute top-4 left-4`) ocupa **más del 80 % del ancho de pantalla**, tapando el logo de ADUANAS y encimándose con el panel de controles (Expandir/Colapsar/Exportar). El canvas del árbol queda 100 % inaccesible detrás de los paneles. No hay ningún breakpoint (`sm:`/`md:`) que reubique o colapse estos paneles en pantallas chicas — a diferencia del resto de la app, que ya tiene navegación inferior adaptada a móvil (visible en la captura: barra "Inicio / Ocupación / Plantilla / Oficios / Más").

**Fix sugerido:** dado que el resto de `eje_central_front` ya pasó por un rediseño responsive (ver memoria del proyecto), agregar Organigrama a ese alcance: paneles flotantes colapsables/en drawer por debajo de un breakpoint, o vista de lista jerárquica alternativa para pantallas chicas (un árbol horizontal de miles de px de ancho no es viable en mobile bajo ninguna adaptación de solo-CSS).

---

### Hallazgo menor #8 — Al eliminar la raíz de un lienzo, salta a otra unidad de negocio sin avisar — ✅ RESUELTO

> `page.jsx:1144-1151`: al borrar un nodo raíz ya no salta a una unidad arbitraria — hace `setOrganigramaData(null)` + `setSelectedUnidad(null)`, cayendo en la pantalla "Selecciona una unidad de negocio" (exactamente el fix sugerido abajo).

`handleDeleteNode`, al borrar un nodo raíz (`General`), recarga el catálogo de unidades y hace `setSelectedUnidad(data.find(u => u.id !== selectedUnidad.id) || null)` — es decir, salta a la **primera unidad distinta que encuentre en la lista**, sin relación necesaria con lo que el usuario estaba viendo, y sin ningún mensaje ("Se eliminó X, ahora estás viendo Y"). Confirmado en la prueba: tras borrar la unidad dummy `99999`, la app aterrizó silenciosamente en la unidad `00001` ("Jefatura del Servicio de Administración Tributaria"), que no tiene relación con lo eliminado.

**Fix sugerido:** mostrar un toast explicando el cambio de lienzo, o mejor, regresar a "sin selección" (pantalla "Selecciona una unidad de negocio") en vez de saltar a una unidad arbitraria.

---

### Hallazgo menor #9 — Nombres truncados en resultados de búsqueda sin tooltip — ✅ RESUELTO

> `page.jsx:1805`: el contenedor del resultado ya lleva `title={r.descripcion_larga}`.

El nombre del área en cada resultado de búsqueda usaba `truncate` sin `title={r.descripcion_larga}`. Con nombres largos y parecidos (ej. "Administración de Operación de Recursos y Servicios 4" vs "...9"), era imposible distinguirlos sin hacer click.

---

## Hallazgo de datos (informativo — NO tocar sin autorización explícita)

Durante la investigación del Bug de duplicados visibles en el árbol de la unidad `00900` (ej. "DIRECCIÓN DE RECURSOS HUMANOS" aparece dos veces: una vez como nodo `#90000UCANAM` con nivel `General` mal heredado y `posicion_director` en blanco, y otra como `#90001000000` con nivel `Central` correcto — mismo titular, misma plaza), se confirmó vía consulta de solo lectura contra `ORGANIGRAMA_ANAM` que:

- El campo `subordinados` del nodo raíz `90000000000` lista **tanto** el código limpio (`90001000000`) **como** el código legado `90000UCANAM` (y también `9001UPCANAM`) como hijos directos — ramas duplicadas del mismo departamento.
- Existen **320 filas** (en 3 unidades de negocio: `00900`, `00002`, `00003`) cuyo `departamento` mezcla letras (ej. `101B010000`, `293F040000`, `90000UCANAM`), fuera del patrón numérico de 10-11 dígitos que usa el resto de la tabla (1403 filas totales).

**Por instrucción explícita del usuario, no se modificó ni se propone tocar esta data** — se documenta únicamente porque explica visualmente por qué el árbol de `00900` muestra ramas repetidas y es la causa de fondo de la desconfianza que puede generar el "Verificador Jerárquico" en ese lienzo específico. Cualquier limpieza de estos datos debe decidirse aparte, con el dueño del pipeline ZAFIRO que puebla la tabla.

---

## Prioridad sugerida (impacto / esfuerzo) — estado 2026-07-16

| # | Hallazgo | Impacto | Esfuerzo | Estado |
|---|----------|---------|----------|--------|
| 1 | Canvas en blanco al cargar | Crítico | Medio (auto-scroll/fit al montar) | ✅ Resuelto |
| 6 | Exportar "Todo Desglosado" roto | Alto | Medio-Alto | ✅ Resuelto (migrado a PDF por franjas) |
| 7 | No usable en móvil | Alto | Alto (requiere diseño) | ❌ Pendiente |
| 5 | Backend: numeración de subordinados (excluir padre) | Alto | Bajo | ✅ Resuelto |
| 2 | Búsqueda cross-unidad no resalta/abre destino | Alto | Bajo-Medio | ✅ Resuelto |
| 4 | Catálogo no actualizado al crear General | Medio | Bajo | ✅ Resuelto |
| 3 | Sin "Sin resultados" en buscador | Medio | Bajo | ✅ Resuelto |
| 8 | Salto silencioso de unidad al borrar raíz | Bajo-Medio | Bajo | ✅ Resuelto |
| 9 | Sin tooltip en resultados truncados | Bajo | Muy bajo | ✅ Resuelto |

**Único pendiente: Bug #7 (móvil)** — requiere trabajo de diseño (paneles colapsables/drawer o vista alternativa), no es un fix mecánico como los demás.

---

## Funcionalidades verificadas sin bugs

- Selector de unidad de negocio: abre, filtra por texto, selecciona, cierra al click-afuera — sin problemas.
- Crear Dirección General: formulario, validación de campos obligatorios, creación y apertura de lienzo nuevo — funciona (más allá del Bug #4).
- Eliminar nodo: modal de confirmación muestra código + descripción correctos, botón deshabilitado mientras tiene subordinados, borrado real confirmado en BD.
- Modal de detalle de nodo: abre con los datos correctos, edición inline de descripción/unidad administrativa/DOAF, botones Eliminar/Editar/Agregar subordinado/Centrar en Organigrama presentes según corresponda al nivel.
- Expandir Todo / Colapsar Todo: cambian correctamente el set de nodos expandidos (verificado por tamaño de canvas antes/después).
- Zoom +/-/Reset: cambia el porcentaje mostrado y la escala visual del canvas correctamente (aunque no resuelve el Bug #1).
