# Catálogo de funcionalidades — eje_central_front

Generado 2026-07-13. Base para casos de prueba (`casos_prueba/`). Cada ítem tiene un
ID estable (`F01`, `F02`, ...) usado para referenciar el caso de prueba correspondiente.

## 1. Landing (`/`)
- F01. Hero rotatorio con CTA a dashboard/login según sesión.

## 2. Features (`/features`)
- F02. Carrusel de 6 módulos con auto-rotación y video demo mock.

## 3. Login (`/login`)
- F03. Login sin contraseña (código a correo @anam.gob.mx).
- F04. Drawer de verificación de código.

## 4. Dashboard (`/dashboard`)
- F05. Resumen consolidado server-side (vacantes, estatus, ocupación, oficios turnados).

## 5. Ocupación Plazas por Oficio
- F06. Vista Sankey (drill-down oficio→nivel).
- F07. Vista Tabla (matriz oficio×nivel, búsqueda, exclusión).
- F08. Vista Estadísticas (top oficios, media/mediana).
- F09. Drawer de filtros incluir/excluir oficios.
- F10. Modal de registros por oficio (drill-down).
- F11. Modal de detalle de expediente (compartido con Oficios Turnados DO), preview PDF.
- F12. Indicadores % ocupación local vs SIG.
- F13. Sub-página Plantilla: editor tipo Excel (autocompletado, buscar/reemplazar, filtro columnas, guardar, exportar Excel).

## 6. Valuación Presupuestaria
- F14. Simulador de costo/impacto (vigencia mensual/bimestral/anual), exporta Excel.
- F15. Parámetros: Catálogo de Plazas.
- F16. Parámetros: Conceptos Presupuestales.
- F17. Parámetros: Constantes.
- F18. Asuntos de Plazas (listado + envío directo a simulador).

## 7. Plantilla de Empleados
- F19. Plantilla Detalle (tabla densa, búsqueda, cadena de mando, edición celda, exportar Excel).
- F20. Estatus Nómina (resumen por Nivel/UA, exportar Excel cancelable).
- F21. Mov. Posiciones — Tabla Principal (histórico, click celda).
- F22. Mov. Posiciones — Cuadros de Vacancia (gráficas pastel, exporta imagen/Excel).
- F23. Mov. Posiciones — Comprobar Alineación Organizacional (MOV_POS vs SIG, exporta Excel).
- F24. Movimientos Personal (altas/bajas/adscripción, selector año/mes, Excel multi-hoja).
- F25. Empleados Bajas (histórico, gráfica motivos, exportar Excel, buscador).
- F26. Distribución Geográfica — Mapa Nacional.
- F27. Distribución Geográfica — Torre Caballito 3D (beacons, búsqueda empleado).
- F28. Catálogos CRUD (Acciones, Motivos, Puesto Funcional, Códigos Presupuestales, Organigrama ANAM).
- F29. Niveles Jerárquicos por Plaza (sub-tab de Catálogos).
- F30. Modales compartidos: Timeline Empleado / Timeline Posición / Empleados por plaza-UA.

## 8. Oficios Turnados a DO
- F31. Listado filtrable (fecha, folio, unidad, orden), server-side.
- F32. Detalle de expediente (compartido).

## 9. Organigrama ANAM
- F33. Selector de unidad de negocio + búsqueda.
- F34. Árbol jerárquico interactivo (expandir/colapsar, zoom, pan).
- F35. Búsqueda global de nodos con auto-salto.
- F36. Detalle de nodo (ocupante titular + superior).
- F37. Edición de titular/superior (reasignar + undo 10s).
- F38. Edición de nodo (descripción, UA, DOAF).
- F39. Creación de nodos (raíz o subordinado).
- F40. Eliminación de nodo (bloqueada si tiene subordinados).
- F41. Exportar organigrama a PNG.
- F42. Estadísticas (total nodos, desglose por nivel).

## 10. Monitoreo ZAFIRO
- F43. Terminal en vivo (polling 2s durante RUNNING).
- F44. Sincronización manual + modal de confirmación.
- F45. Historial de ejecuciones paginado con filtros Excel-style.
- F46. Tarjetas de estadísticas (total, último estado, duración, registros).

## 11. Roles y Permisos
- F47. CRUD de roles (nombre + permisos).
- F48. Editor de permisos por rol (agrupado, preview visual on-hover).
- F49. Gestión de usuarios whitelist (alta, reasignación de rol inline).

## 12. Infraestructura transversal
- F50. Control de acceso granular (useAuth / RequirePermission / usePermission).
- F51. Navbar desktop / BottomNav móvil.
- F52. PageTabBar / PageTabsContext.
- F53. Sistema de toasts.
- F54. DataTable genérico + hooks (filtros Excel-style, selección de celda, columnas visibles).
- F55. ZafiroUpdatesContext (auto-refresh tras sync ZAFIRO).
- F56. Exportación a Excel (transversal a casi todos los tabs de datos).

---

## Casos de prueba generados
| ID | Funcionalidad | Archivo | Estado |
|----|---------------|---------|--------|
| F27 | Torre Caballito 3D — búsqueda de empleado y beacon | `casos_prueba/CP-F27-torre-caballito-busqueda.pdf` | Generado, pendiente de revisión |
