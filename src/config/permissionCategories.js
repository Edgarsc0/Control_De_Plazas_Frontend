import { PERMISSIONS } from './permissions';

/**
 * Agrupa los permisos del catálogo por módulo de negocio, para que el picker
 * de permisos en Roles y Permisos sea navegable aunque el catálogo crezca.
 */
const CATEGORY_MAP = {
  [PERMISSIONS.VIEW_PLANTILLA_DETALLE]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_BAJAS]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA]: 'Plantilla de Empleados',
  [PERMISSIONS.VIEW_PLANTILLA_CATALOGOS]: 'Plantilla de Empleados',

  [PERMISSIONS.VIEW_OCUPACION_SANKEY]: 'Ocupación de Plazas por Oficio',
  [PERMISSIONS.VIEW_OCUPACION_TABLA]: 'Ocupación de Plazas por Oficio',
  [PERMISSIONS.VIEW_OCUPACION_ESTADISTICAS]: 'Ocupación de Plazas por Oficio',
  [PERMISSIONS.EDIT_OCUPACION_PLAZAS]: 'Ocupación de Plazas por Oficio',

  [PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA]: 'Valuación Presupuestaria',
  [PERMISSIONS.EDIT_VALUACION_PARAMETROS]: 'Valuación Presupuestaria',

  [PERMISSIONS.VIEW_OFICIOS_TURNADOS]: 'Oficios Turnados a Dirección de Organización',
  [PERMISSIONS.VIEW_ORGANIGRAMA]: 'Organigrama',
  [PERMISSIONS.VIEW_MONITOREO_ZAFIRO]: 'Monitoreo ZAFIRO',

  [PERMISSIONS.MANAGE_ROLES]: 'Administración del Sistema',
  [PERMISSIONS.MANAGE_USUARIOS]: 'Administración del Sistema',
};

export const FALLBACK_PERMISSION_CATEGORY = 'Otros';

export const PERMISSION_CATEGORY_ORDER = [
  'Plantilla de Empleados',
  'Ocupación de Plazas por Oficio',
  'Valuación Presupuestaria',
  'Oficios Turnados a Dirección de Organización',
  'Organigrama',
  'Monitoreo ZAFIRO',
  'Administración del Sistema',
  FALLBACK_PERMISSION_CATEGORY,
];

export function getPermissionCategory(fullCodename) {
  return CATEGORY_MAP[fullCodename] || FALLBACK_PERMISSION_CATEGORY;
}
