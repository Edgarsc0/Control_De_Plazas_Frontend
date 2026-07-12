import { PERMISSIONS } from './permissions';

/**
 * Screenshot de referencia por permiso, mostrado al hacer hover sobre cada
 * checkbox en el modal de Roles y Permisos. La clave es el `full_codename`
 * que expone PermissionSerializer (app_label.codename), igual a los valores
 * de PERMISSIONS.
 */
export const PERMISSION_PREVIEWS = {
  [PERMISSIONS.EDIT_OCUPACION_PLAZAS]: '/permission-previews/edit_ocupacion_plazas.png',
  [PERMISSIONS.EDIT_VALUACION_PARAMETROS]: '/permission-previews/edit_valuacion_parametros.png',
  [PERMISSIONS.MANAGE_ROLES]: '/permission-previews/manage_roles.png',
  [PERMISSIONS.MANAGE_USUARIOS]: '/permission-previews/manage_usuarios.png',
  [PERMISSIONS.VIEW_MONITOREO_ZAFIRO]: '/permission-previews/view_monitoreo_zafiro.png',
  [PERMISSIONS.VIEW_OCUPACION_ESTADISTICAS]: '/permission-previews/view_ocupacion_estadisticas.png',
  [PERMISSIONS.VIEW_OCUPACION_SANKEY]: '/permission-previews/view_ocupacion_sankey.png',
  [PERMISSIONS.VIEW_OCUPACION_TABLA]: '/permission-previews/view_ocupacion_tabla.png',
  [PERMISSIONS.VIEW_OFICIOS_TURNADOS]: '/permission-previews/view_oficios_turnados.png',
  [PERMISSIONS.VIEW_ORGANIGRAMA]: '/permission-previews/view_organigrama.png',
  [PERMISSIONS.VIEW_PLANTILLA_BAJAS]: '/permission-previews/view_plantilla_bajas.png',
  [PERMISSIONS.VIEW_PLANTILLA_CATALOGOS]: '/permission-previews/view_plantilla_catalogos.png',
  [PERMISSIONS.VIEW_PLANTILLA_DETALLE]: '/permission-previews/view_plantilla_detalle.png',
  [PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA]: '/permission-previews/view_plantilla_estatus_nomina.png',
  [PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA]: '/permission-previews/view_plantilla_geografia.png',
  [PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES]: '/permission-previews/view_plantilla_mov_posiciones.png',
  [PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS]: '/permission-previews/view_plantilla_movimientos.png',
  [PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA]: '/permission-previews/view_valuacion_presupuestaria.png',
};
