/**
 * Codenames de permisos de negocio, en formato "app_label.codename" — deben
 * coincidir exactamente con el catálogo generado por ModulePermission en
 * eje_central_back/authentication/models.py.
 */
export const PERMISSIONS = {
  // Plantilla de Empleados — un permiso por tab (datos con distinta sensibilidad).
  VIEW_PLANTILLA_DETALLE: 'authentication.view_plantilla_detalle',
  VIEW_PLANTILLA_ESTATUS_NOMINA: 'authentication.view_plantilla_estatus_nomina',
  VIEW_PLANTILLA_MOV_POSICIONES: 'authentication.view_plantilla_mov_posiciones',
  VIEW_PLANTILLA_MOVIMIENTOS: 'authentication.view_plantilla_movimientos',
  VIEW_PLANTILLA_BAJAS: 'authentication.view_plantilla_bajas',
  VIEW_PLANTILLA_GEOGRAFIA: 'authentication.view_plantilla_geografia',
  VIEW_PLANTILLA_CATALOGOS: 'authentication.view_plantilla_catalogos',
  EDIT_PLANTILLA_DETALLE: 'authentication.edit_plantilla_detalle',
  EDIT_DATOS_PERSONALES: 'authentication.edit_datos_personales',
  VIEW_PLANTILLA_HISTORICO: 'authentication.view_plantilla_historico',
  EDIT_PLANTILLA_MOV_POSICIONES: 'authentication.edit_plantilla_mov_posiciones',
  VIEW_ANUENCIA_ELIMINADOS: 'authentication.view_anuencia_eliminados',

  // Plantilla de Empleados — fotografía: permiso independiente por tab, para
  // poder mostrar el tab pero ocultar la fotografía dentro de él (o viceversa).
  VIEW_PLANTILLA_DETALLE_FOTO: 'authentication.view_plantilla_detalle_foto',
  VIEW_PLANTILLA_ESTATUS_NOMINA_FOTO: 'authentication.view_plantilla_estatus_nomina_foto',
  VIEW_PLANTILLA_MOV_POSICIONES_FOTO: 'authentication.view_plantilla_mov_posiciones_foto',
  VIEW_PLANTILLA_MOVIMIENTOS_FOTO: 'authentication.view_plantilla_movimientos_foto',
  VIEW_PLANTILLA_BAJAS_FOTO: 'authentication.view_plantilla_bajas_foto',
  VIEW_PLANTILLA_GEOGRAFIA_FOTO: 'authentication.view_plantilla_geografia_foto',

  // Expediente del personal — una pestaña por permiso. El modal de
  // expediente (EmployeesModal) se abre desde cualquier fila de empleado en
  // todo el sistema, así que su contenido se configura aparte del módulo
  // por el que se entró (ver EXPEDIENTE_TABS en ese componente).
  VIEW_EXPEDIENTE_PLAZA: 'authentication.view_expediente_plaza',
  VIEW_EXPEDIENTE_DATOS_PERSONALES: 'authentication.view_expediente_datos_personales',
  VIEW_EXPEDIENTE_HISTORIAL_MOVIMIENTOS: 'authentication.view_expediente_historial_movimientos',
  VIEW_EXPEDIENTE_HISTORIAL_POSICION: 'authentication.view_expediente_historial_posicion',

  // Ocupación de Plazas por Oficio
  // view_ocupacion_sankey/tabla/estadisticas quedaron sin uso en el rediseño
  // 2026-09 (la vista pasó a listar Solicitudes de Nueva Creación) — se
  // dejan asignadas en roles existentes por compatibilidad, sin referenciarse
  // más desde el front.
  VIEW_OCUPACION_SOLICITUDES: 'authentication.view_ocupacion_solicitudes',
  EDIT_OCUPACION_PLAZAS: 'authentication.edit_ocupacion_plazas',

  // Valuación Presupuestaria
  VIEW_VALUACION_PRESUPUESTARIA: 'authentication.view_valuacion_presupuestaria',
  EDIT_VALUACION_PARAMETROS: 'authentication.edit_valuacion_parametros',

  // Módulos sin tabs
  VIEW_OFICIOS_TURNADOS: 'authentication.view_oficios_turnados',
  VIEW_ORGANIGRAMA_INSTITUCIONAL: 'authentication.view_organigrama_institucional',
  VIEW_ORGANIGRAMA_ALINEACION: 'authentication.view_organigrama_alineacion',
  VIEW_ORGANIGRAMA_SIG: 'authentication.view_organigrama_sig',
  EDIT_ORGANIGRAMA: 'authentication.edit_organigrama',
  VIEW_MONITOREO_ZAFIRO: 'authentication.view_monitoreo_zafiro',

  // Administración del propio sistema de roles
  MANAGE_ROLES: 'authentication.manage_roles',
  MANAGE_USUARIOS: 'authentication.manage_usuarios',
};
