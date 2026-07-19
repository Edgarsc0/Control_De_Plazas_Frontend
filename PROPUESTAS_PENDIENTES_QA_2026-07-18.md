# Propuestas pendientes de plática — derivadas de REPORTE_QA_PLANTILLA_EMPLEADOS_2026-07-18.md

Puntos marcados como "interesantes, platicar después" durante la sesión de implementación del 2026-07-18. No implementados a propósito — decisión de producto/alcance pendiente, no limitación técnica.

## 5. Anomalías de datos (investigar antes de tocar, son de negocio/carga, no bugs de front)

1. **Fecha de captura un año anterior a la efectiva, masivo** — decenas de filas con `Fecha efectiva 2026-04-01` / `Fecha de captura 2025-04-07` (motivo "Cambio Dep. Directa/Indirecta"). Patrón −1 año + 6 días sugiere error de año en la carga.
2. **Expediente de plaza vacante** — "FECHA INGRESO: Vacante" (texto de estatus dentro de campo fecha) y "ESTATUS NÓMINA: —" vacío. Mapeo de campos invertido para plazas vacantes.
3. **Historial de Ocupantes con inicio futuro** — ocupante con inicio 1 ago 2026 (hoy 18 jul) ya etiquetado "OCUPANTE ACTUAL / Presente". Debería mostrarse como "Programado".
4. *(Excepción: el sub-punto de "ruido en Historial de Cambios" — entradas `(vacío)→(vacío)` y cambios idénticos registrados como VIGENTE — SÍ se implementó como fix, ver 8.10 abajo.)*

## 7.4 — "Restablecer Filtros" debería volver al estado inicial del tab

Hoy vuelve a "sin filtros" (11,451 registros); debería volver al estado inicial del tab (p. ej. Activo, 10,068). Alternativa: dos acciones separadas — "Quitar todos" / "Restaurar vista por defecto". Pendiente: definir cuál es el "estado inicial" por tab (¿siempre el filtro de tarjeta default? ¿configurable?).

## 7.5 — Selector de fecha en Bitácora + histórico de días anteriores

Hoy la fecha de bitácora está fija en "hoy" y no es editable desde la UI, así que no se puede consultar bitácora de días previos. Falta: date picker + endpoint que acepte fecha, y empty-state "Sin capturas hoy — última actualización 17/07 20:11" con CTA al día previo.

## 7.13 — Empty-state que cuente TODOS los filtros activos

El mensaje inteligente de "sin resultados" en `DataTable.jsx:478` sólo cuenta `columnFilters` + `textFilters`, ignora filtro de tarjeta, búsqueda global y filtros avanzados. Casi siempre cae al mensaje genérico. Requiere que `DataTable` reciba el conteo total de filtros activos desde cada tab (props nuevas), o que cada tab le pase un string ya armado — decidir el contrato antes de tocarlo porque afecta a todos los tabs que usan `DataTable`.

## 8.1 — Alertas de vacancia prolongada

Plazas vacantes ya tienen "Fecha de Vacancia" y "Categoría Vacancia" (A/B). Un panel "vacantes > 90 días" con responsable de UA daría accionabilidad al cuadro de vacancia. Pendiente: definir umbral (90 días es propuesta), a quién se le notifica, si es panel o alerta activa (correo/campana, cruza con 8.9).

## 8.2 — Panel "salidas próximas"

La columna "Fecha prevista de salida" existe (ej. 2026-10-15) pero nada la explota. Lista de próximos 30/60 días para planear reemplazos. Pendiente: definir ventana (30/60/90), a quién se le muestra, si es tab nuevo o card en uno existente.

## 8.3 — Delta quincenal

"¿Qué cambió desde la quincena pasada?" — altas, bajas, movimientos y variación de ocupación por UA, aprovechando el histórico de Cuadros de Vacancia. Es la pregunta que un director hace primero, según el reporte. Pendiente: es una feature grande (nueva vista + queries agregadas de comparación entre dos cortes quincenales); definir alcance antes de estimar.

## 8.7 — Validaciones de captura en backend

Fecha de captura > 1 año antes de la efectiva (cruza con anomalía 5.1), movimiento sin acción (cruza con BUG-08, ese sí ya se corrigió del lado de agregación), nombres duplicados con/sin tilde — reglas para que el dato sucio no llegue al front. Pendiente: esto es validación en el pipeline de carga/ETL del backend, no en la app — definir dónde vive esa carga antes de tocar.

## 8.9 — Suscripciones/notificaciones de bitácora

Correo o campana con la bitácora diaria (movimientos capturados ayer) para roles de supervisión, dado que la bitácora de "hoy" suele estar vacía por el desfase de carga. Pendiente: mecanismo de envío (¿ya existe infra de correo en el back?), a qué roles, frecuencia.

---

*Generado durante la sesión de implementación QA 2026-07-18. Retomar cuando se defina alcance de negocio.*
