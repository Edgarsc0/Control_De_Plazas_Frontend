import {
  LayoutDashboard, BarChart3, Calculator, Users,
  GitFork, Database, FileText, ShieldCheck,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';

/**
 * Fuente única de los módulos de navegación del dashboard. La consumen tanto
 * DashboardSubmenu (desktop, agrupado por `group`) como BottomNav (móvil,
 * separado por `primary`) — antes eran dos arrays estáticos duplicados.
 *
 * `permission: null` = visible para cualquier usuario autenticado.
 * `permissions: [...]` = visible si tiene AL MENOS UNO (módulos con varios
 * tabs, cada uno gateado por su propio permiso — ver src/config/permissions.js).
 */
export const MODULES = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    label: 'Inicio',
    href: '/dashboard',
    icon: LayoutDashboard,
    color: '#621f32',
    bg: 'rgba(98,31,50,0.10)',
    description: 'Panel integral de control',
    group: 'Principal',
    permission: null,
    primary: true,
    featured: true,
    exact: true,
  },
  {
    key: 'ocupacion',
    title: 'Ocupación por Oficios',
    label: 'Ocupación',
    href: '/dashboard/ocupacion_plazas_por_oficio',
    icon: BarChart3,
    color: '#d97706',
    bg: 'rgba(217,119,6,0.10)',
    description: '1,800 plazas ANAM',
    group: 'Plazas',
    permissions: [
      PERMISSIONS.VIEW_OCUPACION_SANKEY,
      PERMISSIONS.VIEW_OCUPACION_TABLA,
      PERMISSIONS.VIEW_OCUPACION_ESTADISTICAS,
      PERMISSIONS.EDIT_OCUPACION_PLAZAS,
    ],
    primary: true,
  },
  {
    key: 'valuacion',
    title: 'Valuación Presupuestaria',
    label: 'Presupuesto',
    href: '/dashboard/valuacion_presupuestaria',
    icon: Calculator,
    color: '#9333ea',
    bg: 'rgba(147,51,234,0.10)',
    description: 'Simulador de costos',
    group: 'Plazas',
    permissions: [PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA, PERMISSIONS.EDIT_VALUACION_PARAMETROS],
    primary: false,
  },
  {
    key: 'plantilla',
    title: 'Plantilla de Empleados',
    label: 'Plantilla',
    href: '/dashboard/plantilla_empleados',
    icon: Users,
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.10)',
    description: 'Directorio de personal',
    group: 'Gestión',
    permissions: [
      PERMISSIONS.VIEW_PLANTILLA_DETALLE,
      PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA,
      PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES,
      PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS,
      PERMISSIONS.VIEW_PLANTILLA_BAJAS,
      PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA,
      PERMISSIONS.VIEW_PLANTILLA_CATALOGOS,
    ],
    primary: true,
  },
  {
    key: 'oficios_turnados',
    title: 'Oficios Turnados DO',
    label: 'Oficios',
    href: '/dashboard/oficios_turnados_do',
    icon: FileText,
    color: '#621f32',
    bg: 'rgba(98,31,50,0.10)',
    description: 'Gestión de solicitudes',
    group: 'Gestión',
    permission: PERMISSIONS.VIEW_OFICIOS_TURNADOS,
    primary: true,
  },
  {
    key: 'organigrama',
    title: 'Organigrama ANAM',
    label: 'Org.',
    href: '/dashboard/organigrama',
    icon: GitFork,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.10)',
    description: '13 unidades · 1,365 áreas',
    group: 'Estructura',
    permission: PERMISSIONS.VIEW_ORGANIGRAMA,
    primary: false,
  },
  {
    key: 'zafiro',
    title: 'Monitoreo ZAFIRO',
    label: 'Sync',
    href: '/dashboard/monitoreo_zafiro',
    icon: Database,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.10)',
    description: 'Bitácora de actualizaciones',
    group: 'Estructura',
    permission: PERMISSIONS.VIEW_MONITOREO_ZAFIRO,
    primary: false,
  },
  {
    key: 'roles',
    title: 'Roles y Permisos',
    label: 'Roles',
    href: '/dashboard/roles',
    icon: ShieldCheck,
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.10)',
    description: 'Administración de accesos',
    group: 'Administración',
    permission: PERMISSIONS.MANAGE_ROLES,
    primary: false,
  },
];

const GROUP_ORDER = ['Principal', 'Plazas', 'Gestión', 'Estructura', 'Administración'];

/**
 * @param {{ hasPermission: Function, hasAnyPermission: Function }} auth - de useAuth()
 */
export function isModuleVisible(module, auth) {
  if (module.permissions) return auth.hasAnyPermission(module.permissions);
  return auth.hasPermission(module.permission);
}

/**
 * Agrupa MODULES en secciones (orden fijo) filtrando por permiso.
 * @param {{ hasPermission: Function, hasAnyPermission: Function }} auth
 */
export function getVisibleSections(auth) {
  return GROUP_ORDER.map((group) => ({
    group,
    items: MODULES.filter((m) => m.group === group && isModuleVisible(m, auth)),
  })).filter((section) => section.items.length > 0);
}

/**
 * @param {{ hasPermission: Function, hasAnyPermission: Function }} auth
 */
export function getVisibleModules(auth) {
  return MODULES.filter((m) => isModuleVisible(m, auth));
}
