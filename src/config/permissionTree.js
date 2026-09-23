import { PERMISSIONS } from './permissions';

/**
 * Árbol de permisos para el picker de "Roles y Permisos": refleja la
 * jerarquía real de navegación (módulo > tab > sub-permiso) en vez de la
 * lista plana por categoría que había antes.
 *
 * Cada nodo es uno de dos tipos:
 *  - Contenedor puro: { id, label, children } — sin `codename`, no es un
 *    permiso real, solo agrupa (los módulos de nivel superior).
 *  - Nodo de permiso: { id, codename, info?, children? } — sin `label`
 *    propio a propósito: el texto del checkbox sale de `perm.name` (el
 *    catálogo del backend), para no duplicar strings que puedan desalinearse.
 *    `info` es una línea de ayuda opcional (ej. qué sub-tabs comparten este
 *    mismo permiso hoy, cuando aún no tienen uno propio — ver nota abajo).
 *
 * IMPORTANTE: varios de estos permisos (el "ver tab X") cubren HOY varias
 * sub-pestañas de esa tab a la vez (ej. las 5 sub-pestañas de "Mov.
 * Posiciones" comparten `view_plantilla_mov_posiciones`). `info` deja esa
 * cobertura visible en el picker sin inventar checkboxes que no existen en
 * el backend. Si más adelante se crean permisos independientes por
 * sub-pestaña, esos sub-tabs pasan a ser sus propios nodos hijos aquí.
 */
export const PERMISSION_TREE = [
  {
    id: 'plantilla_empleados',
    label: 'Plantilla de Empleados',
    children: [
      {
        id: 'detalle',
        codename: PERMISSIONS.VIEW_PLANTILLA_DETALLE,
        children: [
          { id: 'detalle_edit', codename: PERMISSIONS.EDIT_PLANTILLA_DETALLE },
          { id: 'detalle_foto', codename: PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO },
          { id: 'detalle_historico', codename: PERMISSIONS.VIEW_PLANTILLA_HISTORICO },
          { id: 'detalle_datos_personales', codename: PERMISSIONS.EDIT_DATOS_PERSONALES },
        ],
      },
      {
        id: 'estatus_nomina',
        codename: PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA,
        info: 'Incluye las vistas Por Nivel y Por UA',
        children: [
          { id: 'estatus_nomina_foto', codename: PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA_FOTO },
        ],
      },
      {
        id: 'mov_posiciones',
        codename: PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES,
        info: 'Incluye: Tabla Principal, Cuadros Vacancia, Comprobar Alineación, Aduanas Ocupación vs Vacantes y Anuencia',
        children: [
          { id: 'mov_posiciones_edit', codename: PERMISSIONS.EDIT_PLANTILLA_MOV_POSICIONES },
          { id: 'mov_posiciones_anuencia_eliminados', codename: PERMISSIONS.VIEW_ANUENCIA_ELIMINADOS },
          { id: 'mov_posiciones_foto', codename: PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO },
        ],
      },
      {
        id: 'movimientos',
        codename: PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS,
        info: 'Incluye: Movimientos de Personal, Bitácora de Movimientos y Rotación de personal',
        children: [
          { id: 'movimientos_foto', codename: PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS_FOTO },
        ],
      },
      {
        id: 'bajas',
        codename: PERMISSIONS.VIEW_PLANTILLA_BAJAS,
        children: [
          { id: 'bajas_foto', codename: PERMISSIONS.VIEW_PLANTILLA_BAJAS_FOTO },
        ],
      },
      {
        id: 'geografia',
        codename: PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA,
        info: 'Incluye: Mapa Nacional y Torre Caballito',
        children: [
          { id: 'geografia_foto', codename: PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA_FOTO },
        ],
      },
      {
        id: 'catalogos',
        codename: PERMISSIONS.VIEW_PLANTILLA_CATALOGOS,
        info: 'Incluye: Acciones, Motivos, Puesto Funcional, Códigos Presupuestales, Organigrama ANAM, Corrección Posición y Niveles Jerárquicos por Plaza',
      },
    ],
  },
  {
    id: 'ocupacion_plazas',
    label: 'Ocupación de Plazas por Oficio',
    children: [
      { id: 'ocupacion_solicitudes', codename: PERMISSIONS.VIEW_OCUPACION_SOLICITUDES },
      { id: 'ocupacion_edit', codename: PERMISSIONS.EDIT_OCUPACION_PLAZAS },
    ],
  },
  {
    id: 'valuacion',
    label: 'Valuación Presupuestaria',
    children: [
      { id: 'valuacion_simulador', codename: PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA },
      { id: 'valuacion_parametros', codename: PERMISSIONS.EDIT_VALUACION_PARAMETROS },
    ],
  },
  {
    id: 'oficios_turnados',
    label: 'Oficios Turnados a Dirección de Organización',
    children: [
      { id: 'oficios_turnados_ver', codename: PERMISSIONS.VIEW_OFICIOS_TURNADOS },
    ],
  },
  {
    id: 'organigrama',
    label: 'Organigrama',
    children: [
      { id: 'organigrama_institucional', codename: PERMISSIONS.VIEW_ORGANIGRAMA_INSTITUCIONAL },
      { id: 'organigrama_alineacion', codename: PERMISSIONS.VIEW_ORGANIGRAMA_ALINEACION },
      { id: 'organigrama_sig', codename: PERMISSIONS.VIEW_ORGANIGRAMA_SIG },
      { id: 'organigrama_edit', codename: PERMISSIONS.EDIT_ORGANIGRAMA },
    ],
  },
  {
    id: 'monitoreo_zafiro',
    label: 'Monitoreo ZAFIRO',
    children: [
      { id: 'monitoreo_zafiro_ver', codename: PERMISSIONS.VIEW_MONITOREO_ZAFIRO },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración del Sistema',
    children: [
      { id: 'admin_roles', codename: PERMISSIONS.MANAGE_ROLES },
      { id: 'admin_usuarios', codename: PERMISSIONS.MANAGE_USUARIOS },
    ],
  },
];

/** Junta recursivamente todos los `codename` bajo un nodo (incluido él mismo). */
export function collectCodenames(node) {
  const own = node.codename ? [node.codename] : [];
  const fromChildren = (node.children || []).flatMap(collectCodenames);
  return [...own, ...fromChildren];
}

/** Set con todos los codenames ya ubicados en el árbol, para detectar huérfanos. */
export function getTreeCodenameSet() {
  const all = PERMISSION_TREE.flatMap((moduleNode) => collectCodenames(moduleNode));
  return new Set(all);
}
