import dynamic from "next/dynamic";
import { PERMISSIONS as P } from "@/config/permissions";
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
 *  - `permisos`: codenames que habilitan el widget — basta tener UNO (mismo
 *    criterio "OR" que `view_permission` en el backend). Sin esto, un usuario
 *    vería en el catálogo módulos cuyos endpoints le responden 403.
 *  - `alcanceUnSoportado`: si el widget sigue siendo correcto para un rol
 *    restringido a ciertas Unidades de Negocio. `true` solo cuando TODOS los
 *    endpoints que consume ya filtran por UN — es el espejo exacto de
 *    `un_scope = UN_SCOPE_APLICADO` en las vistas del backend, y hay que
 *    moverlo junto con él. Es información para la interfaz, no la defensa:
 *    quien realmente niega el acceso es el backend (ver HasModulePermission),
 *    esto solo evita ofrecer un módulo que respondería 403.
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
    permisos: [P.VIEW_PLANTILLA_ESTATUS_NOMINA],
    alcanceUnSoportado: false,
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
    permisos: [P.VIEW_PLANTILLA_DETALLE],
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_OCUPACION_SOLICITUDES],
    alcanceUnSoportado: false,
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
    permisos: [P.VIEW_PLANTILLA_MOV_POSICIONES],
    alcanceUnSoportado: false,
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
    permisos: [P.VIEW_PLANTILLA_ESTATUS_NOMINA],
    // EmpleadosEstatusPorNivelUaView agrega por petición sobre grupos que
    // llevan cd_un, así que estos conteos ya salen recortados por unidad.
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_ESTATUS_NOMINA],
    // Mismo endpoint que estados_nomina (ver estatusNominaData.js): las UA
    // que no son de su unidad ni siquiera llegan al cliente.
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOV_POSICIONES],
    alcanceUnSoportado: false,
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
    permisos: [P.VIEW_PLANTILLA_MOVIMIENTOS],
    // MovimientosPersonalStatsView agrega ya recortado por UN.
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOVIMIENTOS],
    // Mismo endpoint que movimientos_hoy_accion, ya recortado por UN.
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_BAJAS],
    // BajasSigListView recorta las filas por `unidad_general`, así que las
    // bajas de otras unidades ni siquiera llegan al cliente.
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOV_POSICIONES, P.VIEW_PLANTILLA_MOVIMIENTOS],
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_ORGANIGRAMA_INSTITUCIONAL, P.VIEW_ORGANIGRAMA_ALINEACION],
    alcanceUnSoportado: false,
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
    permisos: [P.VIEW_PLANTILLA_DETALLE],
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOV_POSICIONES, P.VIEW_PLANTILLA_MOVIMIENTOS],
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOVIMIENTOS],
    // MovimientosPersonalListView recorta por `un` (ver _scope_un_movimientos).
    alcanceUnSoportado: true,
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
    permisos: [P.VIEW_PLANTILLA_MOV_POSICIONES],
    // Depende de la fuente del elemento, no del módulo:
    //   · "cuadros" (`cuadro_vacancia`) y "serie"
    //     (`sp_conteo_plazas_historico_serie`) son tablas ya agregadas que no
    //     guardan la Unidad de Negocio de cada plaza, solo totales por fecha
    //     — no hay forma de recortarlas, así que no se ofrecen a roles
    //     restringidos (el backend además les responde 403).
    //   · "desglose"/"ocupados" (`desglose_jerarquico`) sí traen el `Cd UN`
    //     de cada fila y el backend ya los recorta, así que esos elementos
    //     funcionan igual con alcance.
    alcanceUnSoportado: !el.needs.some((n) => n === "cuadros" || n === "serie"),
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

/**
 * ¿Este usuario puede usar el widget `def`? Se exige tener al menos uno de sus
 * `permisos` y, si el rol está restringido a ciertas Unidades de Negocio, que
 * el widget además soporte ese alcance (`alcanceUnSoportado`).
 *
 * Es solo para no OFRECER ni montar algo que respondería 403: la restricción
 * de verdad la impone el backend (HasModulePermission niega por defecto a los
 * roles con alcance por UN toda vista que no declare `un_scope`).
 *
 * @param {object} def - Entrada de WIDGET_REGISTRY.
 * @param {(codenames: string[]) => boolean} hasAnyPermission - De `useAuth()`.
 * @param {string[]|null} unScope - `null` = rol sin restricción por UN.
 * @returns {boolean}
 */
export function puedeUsarWidget(def, hasAnyPermission, unScope) {
  if (!def) return false;
  if (def.permisos?.length && !hasAnyPermission(def.permisos)) return false;
  if (unScope !== null && !def.alcanceUnSoportado) return false;
  return true;
}
