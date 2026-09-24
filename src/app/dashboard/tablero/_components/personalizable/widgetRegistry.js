import dynamic from "next/dynamic";
import { Search, ArrowRightLeft, BarChart3, Users, ListTree, ClipboardList, LineChart, Table2, GitBranch, PieChart, GitCompareArrows, ChartColumnStacked, ArrowUpDown, ListChecks, UserX, Briefcase, Network } from "lucide-react";
import { ELEMENTOS_CUADROS_VACANCIA, prefijoTipoCuadrosVacancia } from "./widgets/cuadrosVacanciaElementos";

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
 *  - `enCatalogo`: si se ofrece o no en la barra lateral (ver abajo).
 *
 * Solo se listan widgets con datos reales del sistema — deliberadamente NO
 * se incluyen `PresupuestarVolumenContent` ni `OrganigramaPreviewContent`
 * (BentoContent.jsx): son contenido de ejemplo/demo sin fetch propio, no
 * widgets funcionales.
 *
 * `enCatalogo` separa "el widget existe y sabe renderizarse" de "lo ofrecemos
 * para agregar": se habilita módulo por módulo, conforme se valida cada uno
 * dentro de la cuadrícula. Los que están en `false` siguen registrados a
 * propósito — si un usuario ya los tenía en su tablero guardado, se siguen
 * viendo y funcionando; solo no aparecen como opción nueva.
 */
export const WIDGET_REGISTRY = {
  vacantes_por_nivel: {
    type: "vacantes_por_nivel",
    enCatalogo: false,
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
    enCatalogo: false,
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
    enCatalogo: false,
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
    enCatalogo: false,
    label: "Oficios Turnados a Dirección",
    icon: ClipboardList,
    component: lazyWidget(() => import("./widgets/OficiosTurnadosWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  estados_nomina: {
    type: "estados_nomina",
    enCatalogo: true,
    label: "Resumen de estados de nómina",
    icon: PieChart,
    component: lazyWidget(() => import("./widgets/EstadosNominaWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 2,
    minH: 2,
  },
  plazas_por_ua: {
    type: "plazas_por_ua",
    enCatalogo: true,
    label: "Plazas por unidad administrativa",
    icon: ChartColumnStacked,
    component: lazyWidget(() => import("./widgets/PlazasPorUaWidget")),
    defaultW: 8,
    defaultH: 5,
    minW: 4,
    minH: 3,
  },
  alineacion_organizacional: {
    type: "alineacion_organizacional",
    enCatalogo: true,
    label: "Alineación organizacional",
    icon: GitCompareArrows,
    component: lazyWidget(() => import("./widgets/AlineacionOrganizacionalWidget")),
    defaultW: 4,
    defaultH: 3,
    minW: 2,
    minH: 1,
  },
  movimientos_hoy_accion: {
    type: "movimientos_hoy_accion",
    enCatalogo: true,
    label: "Movimientos de hoy por acción",
    icon: ArrowUpDown,
    component: lazyWidget(() => import("./widgets/MovimientosHoyAccionWidget")),
    defaultW: 5,
    defaultH: 4,
    minW: 2,
    minH: 2,
  },
  movimientos_hoy_detalle: {
    type: "movimientos_hoy_detalle",
    enCatalogo: true,
    label: "Movimientos de hoy (detalle)",
    icon: ListChecks,
    component: lazyWidget(() => import("./widgets/MovimientosHoyDetalleWidget")),
    defaultW: 8,
    defaultH: 6,
    minW: 4,
    minH: 4,
  },
  buscar_baja: {
    type: "buscar_baja",
    enCatalogo: true,
    label: "Buscar Baja",
    icon: UserX,
    component: lazyWidget(() => import("./widgets/BuscarBajaWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
  buscar_plaza: {
    type: "buscar_plaza",
    enCatalogo: true,
    label: "Buscar Plaza / Posición",
    icon: Briefcase,
    component: lazyWidget(() => import("./widgets/BuscarPlazaWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
  cadena_mando: {
    type: "cadena_mando",
    enCatalogo: true,
    label: "Cadena de Mando",
    icon: Network,
    component: lazyWidget(() => import("./widgets/CadenaMandoWidget")),
    defaultW: 5,
    defaultH: 5,
    minW: 3,
    minH: 4,
  },
  buscar_persona: {
    type: "buscar_persona",
    enCatalogo: true,
    label: "Buscar Persona",
    icon: Search,
    component: lazyWidget(() => import("./widgets/BuscarPersonaWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
  arbol_movimientos: {
    type: "arbol_movimientos",
    enCatalogo: true,
    label: "Árbol de Movimientos",
    icon: GitBranch,
    component: lazyWidget(() => import("./widgets/ArbolMovimientosWidget")),
    defaultW: 6,
    defaultH: 8,
    minW: 4,
    minH: 5,
  },
  buscar_movimiento: {
    type: "buscar_movimiento",
    enCatalogo: true,
    label: "Buscar Movimiento",
    icon: ArrowRightLeft,
    component: lazyWidget(() => import("./widgets/BuscarMovimientoWidget")),
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
};

// Cada gráfica/tabla de "Cuadros de Vacancia" es un widget propio (`cv_<id>`),
// agrupado en el catálogo bajo "Cuadros de Vacancia" (ver GRUPOS_CATALOGO).
const iconoCuadros = (origen) => (origen === "tab" ? LineChart : origen === "desglose" ? BarChart3 : Table2);
for (const el of ELEMENTOS_CUADROS_VACANCIA) {
  const type = `${prefijoTipoCuadrosVacancia}${el.id}`;
  WIDGET_REGISTRY[type] = {
    type,
    enCatalogo: true,
    grupo: "cuadros_vacancia",
    label: el.label,
    icon: iconoCuadros(el.origen),
    component: lazyWidget(() =>
      import("./widgets/CuadrosVacanciaElementoWidget").then((m) => m.componentesPorElemento[el.id])
    ),
    defaultW: el.w,
    defaultH: el.h,
    minW: el.minW,
    minH: el.minH,
  };
}

// Grupos desplegables de la barra lateral (CatalogSidebar). Los widgets con
// `grupo` se listan dentro; el resto va suelto.
export const GRUPOS_CATALOGO = [
  { id: "cuadros_vacancia", label: "Cuadros de Vacancia", icon: ListTree },
];

export const WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);

// Solo los módulos ya validados dentro de la cuadrícula — es lo que consume
// CatalogSidebar. Se van habilitando de uno en uno (ver `enCatalogo`).
export const WIDGETS_DE_CATALOGO = Object.values(WIDGET_REGISTRY).filter((w) => w.enCatalogo);
