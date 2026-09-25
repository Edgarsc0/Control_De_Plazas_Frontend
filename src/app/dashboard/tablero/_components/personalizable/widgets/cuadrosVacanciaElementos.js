// Elementos individuales de "Cuadros de Vacancia" (plantilla_empleados) que
// se ofrecen como widgets sueltos en el tablero personalizable. Fuente única
// para el registro (widgetRegistry.js) y para el widget que los renderiza
// (CuadrosVacanciaElementoWidget.jsx).
//  - `id`: se pasa como prop `only` al componente que lo dibuja.
//  - `origen`: qué componente lo renderiza ("tab" | "desglose" | "detalle").
//  - `needs`: datasets que necesita (ver FUENTES en useCuadrosVacanciaData).
//  - `w/h/minW/minH`: tamaño en celdas de la cuadrícula.
export const ELEMENTOS_CUADROS_VACANCIA = [
  { id: "plazas", label: "Plazas Totales, Activas e Inactivas", origen: "tab", needs: ["serie"], w: 8, h: 6, minW: 5, minH: 4 },
  { id: "ocup_mensual", label: "Ocupación Histórica (Mensual)", origen: "tab", needs: ["serie"], w: 6, h: 6, minW: 4, minH: 4 },
  { id: "vac_mensual", label: "Vacancia Histórica (Mensual)", origen: "tab", needs: ["serie"], w: 6, h: 6, minW: 4, minH: 4 },
  { id: "ocup_quincenal", label: "Ocupación Histórica (Quincenal)", origen: "tab", needs: ["cuadros"], w: 6, h: 6, minW: 4, minH: 4 },
  { id: "vac_quincenal", label: "Vacancia Histórica (Quincenal)", origen: "tab", needs: ["cuadros"], w: 6, h: 6, minW: 4, minH: 4 },
  { id: "cuadro_general", label: "Cuadro de Vacancia General", origen: "tab", needs: ["cuadros"], w: 12, h: 9, minW: 4, minH: 2 },
  { id: "vac_nj", label: "Vacantes por Nivel Jerárquico", origen: "desglose", needs: ["desglose", "ocupados"], w: 6, h: 8, minW: 2, minH: 2 },
  { id: "ocup_nj", label: "Ocupación por Nivel Jerárquico", origen: "desglose", needs: ["desglose", "ocupados"], w: 6, h: 8, minW: 2, minH: 2 },
  { id: "vac_tabular", label: "Vacantes por Nivel Tabular", origen: "desglose", needs: ["desglose", "ocupados"], w: 6, h: 8, minW: 2, minH: 2 },
  { id: "ocup_tabular", label: "Ocupación por Nivel Tabular", origen: "desglose", needs: ["desglose", "ocupados"], w: 6, h: 8, minW: 2, minH: 2 },
  { id: "familia", label: "Ocupadas vs Vacantes por Familia de Nivel", origen: "desglose", needs: ["desglose", "ocupados"], w: 6, h: 10, minW: 2, minH: 2 },
  { id: "nivel_J", label: "Vacancia y Ocupación — Nivel J", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_K", label: "Vacancia y Ocupación — Nivel K", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_A", label: "Vacancia y Ocupación — Nivel A", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_S", label: "Vacancia y Ocupación — Nivel S", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_D", label: "Vacancia y Ocupación — Nivel D", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_P", label: "Vacancia y Ocupación — Enlaces P", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "nivel_OPERATIVOS", label: "Vacancia y Ocupación — Operativos", origen: "detalle", needs: ["desglose", "ocupados"], w: 8, h: 7, minW: 3, minH: 2 },
  { id: "obs_vacancia", label: "Observaciones Vacancia", origen: "detalle", needs: ["desglose", "ocupados"], w: 5, h: 5, minW: 3, minH: 2 },
  { id: "obs_ocupacion", label: "Observaciones Ocupación", origen: "detalle", needs: ["desglose", "ocupados"], w: 5, h: 5, minW: 3, minH: 2 },
];

export const prefijoTipoCuadrosVacancia = "cv_";
