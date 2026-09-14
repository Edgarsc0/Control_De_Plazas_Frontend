import dynamic from "next/dynamic";
import { Search, ArrowRightLeft, BarChart3, Users, ListTree, ClipboardList } from "lucide-react";

// Skeleton mínimo para el fallback de `next/dynamic` mientras se descarga el
// código del widget (code-split: solo se baja lo que el usuario realmente
// tiene en su tablero, no el catálogo completo).
const WidgetLoadingFallback = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="size-6 border-2 border-[#621f32] dark:border-[#bc955c] border-t-transparent rounded-full animate-spin" />
  </div>
);

const lazyWidget = (loader) => dynamic(loader, { ssr: false, loading: WidgetLoadingFallback });

/**
 * Catálogo de widgets disponibles para el tablero personalizable (ver
 * CatalogSidebar.jsx y PersonalizableGrid.jsx). Cada entrada:
 *  - `type`: identificador guardado en el layout persistido (TableroLayoutService).
 *  - `component`: componente sin props, autocontenido (fetch propio).
 *  - `defaultW/defaultH`: tamaño inicial al soltar desde el catálogo (en celdas de grid).
 *  - `minW/minH`: tamaño mínimo permitido al redimensionar.
 *
 * Solo se listan widgets con datos reales del sistema — deliberadamente NO
 * se incluyen `PresupuestarVolumenContent` ni `OrganigramaPreviewContent`
 * (BentoContent.jsx): son contenido de ejemplo/demo sin fetch propio, no
 * widgets funcionales.
 */
export const WIDGET_REGISTRY = {
  vacantes_por_nivel: {
    type: "vacantes_por_nivel",
    label: "Vacantes por Nivel",
    icon: BarChart3,
    component: lazyWidget(() => import("./widgets/VacantesPorNivelWidget")),
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  plantilla_empleados: {
    type: "plantilla_empleados",
    label: "Plantilla de Empleados",
    icon: Users,
    component: lazyWidget(() => import("./widgets/PlantillaEmpleadosWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  ocupacion_vacantes: {
    type: "ocupacion_vacantes",
    label: "Ocupación por Oficios",
    icon: BarChart3,
    component: lazyWidget(() => import("./widgets/OcupacionVacantesWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  oficios_turnados: {
    type: "oficios_turnados",
    label: "Oficios Turnados a Dirección",
    icon: ClipboardList,
    component: lazyWidget(() => import("./widgets/OficiosTurnadosWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  cuadros_vacancia: {
    type: "cuadros_vacancia",
    label: "Cuadros de Vacancia",
    icon: ListTree,
    component: lazyWidget(() => import("../CuadrosVacanciaCard")),
    defaultW: 8,
    defaultH: 5,
    minW: 5,
    minH: 3,
  },
  buscar_persona: {
    type: "buscar_persona",
    label: "Buscar Persona",
    icon: Search,
    component: lazyWidget(() => import("./widgets/BuscarPersonaWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
  buscar_movimiento: {
    type: "buscar_movimiento",
    label: "Buscar Movimiento",
    icon: ArrowRightLeft,
    component: lazyWidget(() => import("./widgets/BuscarMovimientoWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
};

export const WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);
