import { Tags, MessageSquareText, Briefcase, Coins, Network, MapPin } from "lucide-react";
import { CatalogoEstructuraService } from "@/services/catalogo_estructura.service";

/**
 * Fuente única de verdad de los catálogos administrados en el tab
 * "Catálogos". Cada entrada describe columnas de tabla, campos de
 * formulario y las funciones list/create/update/remove (uniformes pese a
 * que las pk difieren: string simple, autoincremental o compuesta).
 *
 * `lazy: true` (solo `correccion_posicion`, ~11,432 filas — mucho más grande
 * que el resto): excluido de la carga automática de "todos los catálogos"
 * al abrir el tab (ver CatalogosEstructuraTab.loadAll) y se pide al servidor
 * solo cuando el usuario entra a ese sub-tab específico.
 */
export const CATALOGOS_CONFIG = {
  acciones: {
    key: "acciones",
    label: "Acciones",
    icon: Tags,
    tableName: "cat_acciones",
    getRowId: (row) => row.action,
    columns: [
      { key: "action", label: "Acción", width: 110, visible: true },
      { key: "action_description", label: "Descripción Acción", width: 220, visible: true },
      { key: "effective_status", label: "Estatus Efectivo", width: 140, visible: true },
      { key: "descripcion", label: "Descripción Larga", width: 280, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 160, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "action", label: "Acción (código)", type: "text", required: true, disabledOnEdit: true, maxLength: 50 },
      { key: "action_description", label: "Descripción de Acción", type: "text", maxLength: 255 },
      { key: "effective_status", label: "Estatus Efectivo", type: "text", maxLength: 50 },
      { key: "descripcion", label: "Descripción Larga", type: "textarea" },
    ],
    emptyRecord: { action: "", action_description: "", effective_status: "", descripcion: "" },
    list: (options) => CatalogoEstructuraService.getCatAcciones(options),
    create: (data) => CatalogoEstructuraService.createCatAccion(data),
    update: (record, data) => CatalogoEstructuraService.updateCatAccion(record.action, data),
    remove: (record) => CatalogoEstructuraService.deleteCatAccion(record.action),
  },

  motivos: {
    key: "motivos",
    label: "Motivos",
    icon: MessageSquareText,
    tableName: "cat_acciones_motivos",
    getRowId: (row) => row.id,
    columns: [
      { key: "accion", label: "Acción", width: 90, visible: true },
      { key: "cd_motivo", label: "Cód. Motivo", width: 110, visible: true },
      { key: "descripcion", label: "Descripción", width: 240, visible: true },
      { key: "estado_efectivo", label: "Estatus Efectivo", width: 140, visible: true },
      { key: "descripcion_larga", label: "Descripción Larga", width: 280, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 160, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "accion", label: "Acción", type: "text", required: true, maxLength: 10 },
      { key: "cd_motivo", label: "Código de Motivo", type: "text", required: true, maxLength: 10 },
      { key: "descripcion", label: "Descripción", type: "text", required: true, maxLength: 255 },
      { key: "estado_efectivo", label: "Estatus Efectivo", type: "text", required: true, maxLength: 20 },
      { key: "descripcion_larga", label: "Descripción Larga", type: "textarea" },
    ],
    emptyRecord: { accion: "", cd_motivo: "", descripcion: "", estado_efectivo: "", descripcion_larga: "" },
    list: (options) => CatalogoEstructuraService.getCatAccionesMotivos(options),
    create: (data) => CatalogoEstructuraService.createCatAccionMotivo(data),
    update: (record, data) => CatalogoEstructuraService.updateCatAccionMotivo(record.id, data),
    remove: (record) => CatalogoEstructuraService.deleteCatAccionMotivo(record.id),
  },

  pto_func: {
    key: "pto_func",
    label: "Puesto Funcional",
    icon: Briefcase,
    tableName: "CAT_PTO_FUNC",
    getRowId: (row) => row.id,
    columns: [
      { key: "cd_pto_funcional", label: "Cód. Puesto Funcional", width: 180, visible: true },
      { key: "nombre_puesto_funcional", label: "Nombre Puesto Funcional", width: 320, visible: true },
      { key: "cd_norm", label: "Código Normalizado", width: 180, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 160, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "cd_pto_funcional", label: "Código Puesto Funcional", type: "text", maxLength: 255 },
      { key: "nombre_puesto_funcional", label: "Nombre Puesto Funcional", type: "text", required: true, maxLength: 255 },
      { key: "cd_norm", label: "Código Normalizado", type: "text", maxLength: 255 },
    ],
    emptyRecord: { cd_pto_funcional: "", nombre_puesto_funcional: "", cd_norm: "" },
    list: (options) => CatalogoEstructuraService.getCatPtoFunc(options),
    create: (data) => CatalogoEstructuraService.createCatPtoFunc(data),
    update: (record, data) => CatalogoEstructuraService.updateCatPtoFunc(record.id, data),
    remove: (record) => CatalogoEstructuraService.deleteCatPtoFunc(record.id),
  },

  cod_presupuestal: {
    key: "cod_presupuestal",
    label: "Códigos Presupuestales",
    icon: Coins,
    tableName: "rc_cat_cod_presupuestal",
    getRowId: (row) => `${row.codigo_presupuestal}-${row.escala}`,
    columns: [
      { key: "codigo_presupuestal", label: "Código Presupuestal", width: 170, visible: true },
      { key: "escala", label: "Escala", width: 90, visible: true },
      { key: "nivel", label: "Nivel", width: 120, visible: true },
      { key: "smb", label: "SMB", width: 120, visible: true },
      { key: "smn", label: "SMN", width: 120, visible: true },
      { key: "nivel_jerarquico", label: "Nivel Jerárquico", width: 150, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 160, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "codigo_presupuestal", label: "Código Presupuestal", type: "text", required: true, disabledOnEdit: true, maxLength: 55 },
      { key: "escala", label: "Escala", type: "number", required: true, disabledOnEdit: true },
      { key: "nivel", label: "Nivel", type: "text", maxLength: 55 },
      { key: "smb", label: "SMB", type: "number", step: "0.01" },
      { key: "smn", label: "SMN", type: "number", step: "0.01" },
      { key: "nivel_jerarquico", label: "Nivel Jerárquico", type: "text", maxLength: 55 },
    ],
    emptyRecord: { codigo_presupuestal: "", escala: "", nivel: "", smb: "", smn: "", nivel_jerarquico: "" },
    list: (options) => CatalogoEstructuraService.getCatCodPresupuestal(options),
    create: (data) => CatalogoEstructuraService.createCatCodPresupuestal(data),
    update: (record, data) => CatalogoEstructuraService.updateCatCodPresupuestal(record.codigo_presupuestal, record.escala, data),
    remove: (record) => CatalogoEstructuraService.deleteCatCodPresupuestal(record.codigo_presupuestal, record.escala),
  },

  organigrama_anam: {
    key: "organigrama_anam",
    label: "Organigrama ANAM",
    icon: Network,
    tableName: "ORGANIGRAMA_ANAM",
    getRowId: (row) => row.departamento,
    columns: [
      { key: "unidad_negocio", label: "Unidad de Negocio", width: 140, visible: true },
      { key: "departamento", label: "Departamento", width: 140, visible: true },
      { key: "estado_fecha_efectiva", label: "Estatus", width: 110, visible: true },
      { key: "descripcion_larga", label: "Descripción Larga", width: 300, visible: true },
      { key: "nivel_direccion", label: "Nivel de Dirección", width: 150, visible: true },
      { key: "unidad_administrativa", label: "Unidad Administrativa", width: 170, visible: true },
      { key: "doaf", label: "DOAF", width: 90, visible: true },
      { key: "num_posicion_gerente", label: "Núm. Posición Gerente", width: 170, visible: true },
      { key: "posicion_director", label: "Posición Director", width: 150, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 160, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "departamento", label: "Departamento (código)", type: "text", required: true, disabledOnEdit: true, maxLength: 255 },
      { key: "unidad_negocio", label: "Unidad de Negocio", type: "text", required: true, maxLength: 255 },
      { key: "estado_fecha_efectiva", label: "Estatus", type: "text", required: true, maxLength: 255 },
      { key: "descripcion_larga", label: "Descripción Larga", type: "textarea", required: true, maxLength: 500 },
      { key: "nivel_direccion", label: "Nivel de Dirección", type: "text", maxLength: 255 },
      { key: "unidad_administrativa", label: "Unidad Administrativa", type: "text", required: true, maxLength: 255 },
      { key: "doaf", label: "DOAF", type: "text", required: true, maxLength: 255 },
      { key: "num_posicion_gerente", label: "Núm. Posición Gerente", type: "text", required: true, maxLength: 255 },
      { key: "posicion_director", label: "Posición Director", type: "text", required: true, maxLength: 255 },
    ],
    emptyRecord: {
      departamento: "", unidad_negocio: "", estado_fecha_efectiva: "", descripcion_larga: "",
      nivel_direccion: "", unidad_administrativa: "", doaf: "", num_posicion_gerente: "", posicion_director: "",
    },
    list: (options) => CatalogoEstructuraService.getOrganigramaAnam(options),
    create: (data) => CatalogoEstructuraService.createOrganigramaAnam(data),
    update: (record, data) => CatalogoEstructuraService.updateOrganigramaAnam(record.departamento, data),
    remove: (record) => CatalogoEstructuraService.deleteOrganigramaAnam(record.departamento),
  },

  correccion_posicion: {
    key: "correccion_posicion",
    label: "Corrección Posición",
    icon: MapPin,
    tableName: "cat_correccion_posicion",
    lazy: true,
    getRowId: (row) => row.posicion,
    columns: [
      { key: "posicion", label: "Posición", width: 120, visible: true },
      { key: "codigo", label: "Código", width: 200, visible: true },
      { key: "tipo_de_aduana", label: "Tipo de Aduana", width: 150, visible: true },
      { key: "dg_o_aduana_compactada", label: "DG de Aduana compactada", width: 220, visible: true },
      { key: "modificado_por", label: "Modificado Por", width: 220, audit: true, visible: true },
      { key: "fecha_modificacion", label: "Última Modificación", width: 170, audit: true, type: "datetime", visible: true },
    ],
    formFields: [
      { key: "posicion", label: "Posición", type: "text", required: true, disabledOnEdit: true, maxLength: 20 },
      { key: "codigo", label: "Código", type: "text", maxLength: 100 },
      { key: "tipo_de_aduana", label: "Tipo de Aduana", type: "text", maxLength: 100 },
      { key: "dg_o_aduana_compactada", label: "DG de Aduana compactada", type: "text", maxLength: 100 },
    ],
    emptyRecord: { posicion: "", codigo: "", tipo_de_aduana: "", dg_o_aduana_compactada: "" },
    list: (options) => CatalogoEstructuraService.getCatCorreccionPosicion(options),
    create: (data) => CatalogoEstructuraService.createCatCorreccionPosicion(data),
    update: (record, data) => CatalogoEstructuraService.updateCatCorreccionPosicion(record.posicion, data),
    remove: (record) => CatalogoEstructuraService.deleteCatCorreccionPosicion(record.posicion),
  },
};

export const CATALOGOS_ORDER = ["acciones", "motivos", "pto_func", "cod_presupuestal", "organigrama_anam", "correccion_posicion"];

export const MONO_CATALOG_COLUMN_KEYS = [
  "action", "accion", "cd_motivo", "cd_pto_funcional", "cd_norm", "codigo_presupuestal", "escala",
  "departamento", "unidad_negocio", "doaf", "num_posicion_gerente", "posicion_director", "posicion",
];
