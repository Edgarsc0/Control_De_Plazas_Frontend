// Catálogo de columnas de la tabla "Plantilla Detalle". Extraído de
// PlantillaDetalleTab.jsx para poder reutilizarlo también en el selector de
// "alcance de columnas" del modal de Roles y Permisos, sin duplicar la
// lista dos veces.
//
// No incluye "foto": es una columna presentacional (no un campo de datos),
// cuya visibilidad ya controla el permiso view_plantilla_detalle_foto, no el
// alcance de columnas por rol.
//
// Copia frontend del mismo catálogo que vive en el backend, en
// Control_Plazas_Back_REAL/authentication/columnas_detalle_catalog.py — si
// agregas/quitas una columna, actualiza AMBOS archivos.
export const PLANTILLA_DETALLE_COLUMNS_CATALOG = [
  { key: "posicion", label: "Posición", width: 110, visible: true, isBasic: true },
  // Sólo trae dato en modo histórico (`sp_plantilla_historica` la agrega;
  // no existe en `detalle` en vivo) — oculta por default para no dejar una
  // columna siempre vacía en el uso diario; se fuerza visible al activar
  // "Consultar plantillas pasadas" (ver `activarHistorico`).
  { key: "estado_plaza", label: "Estado de la Plaza", width: 130, visible: false, isBasic: true, greenHeader: true },
  // Idem estado_plaza: sólo traen dato en modo histórico (sp_periodo_plaza_masivo,
  // ver PlantillaHistoricaView) — fecha_vacancia sólo en plazas vacantes,
  // fecha_ocupacion sólo en ocupadas.
  { key: "fecha_vacancia", label: "Fecha de Vacancia", width: 150, visible: false, isBasic: true, greenHeader: true },
  { key: "fecha_ocupacion", label: "Fecha de Ocupación", width: 150, visible: false, isBasic: true, greenHeader: true },
  { key: "estado_nomina", label: "Estado Nómina", width: 120, visible: true, isBasic: true },
  { key: "solicitante", label: "Solicitante", width: 200, visible: false, isBasic: false, yellowHeader: true },
  { key: "nombre_candidato", label: "Nombre del candidato", width: 200, visible: false, isBasic: false, yellowHeader: true },
  { key: "motivo_solicitud", label: "Motivo de solicitud", width: 200, visible: false, isBasic: false, yellowHeader: true },
  { key: "id_empleado", label: "Número de Empleado", width: 115, visible: true, isBasic: true },
  { key: "rfc", label: "RFC", width: 140, visible: false, isBasic: true },
  { key: "curp", label: "CURP", width: 185, visible: false, isBasic: true },
  { key: "nombres", label: "Nombres", width: 280, visible: true, isBasic: true },
  { key: "motivo", label: "Motivo", width: 200, visible: true, isBasic: true },
  { key: "fecha_efectiva_personal", label: "Fecha efectiva (Personal)", width: 180, visible: true, isBasic: true },
  { key: "fecha_de_captura", label: "Fecha de captura", width: 150, visible: true, isBasic: true },
  { key: "qna", label: "Qna #", width: 80, visible: true, isBasic: true },
  { key: "fecha_prevista_de_salida", label: "Fecha prevista de salida", width: 180, visible: true, isBasic: true },
  { key: "nj", label: "Nivel Jerárquico", width: 120, visible: true, isBasic: true },
  { key: "codigo_presupuestal", label: "Código Presupuestal", width: 150, visible: true, isBasic: true },
  { key: "nivel", label: "Nivel", width: 85, visible: true, isBasic: true },
  { key: "escala", label: "Escala", width: 120, visible: true, isBasic: true },
  { key: "smb", label: "SMB", width: 150, visible: true, isBasic: true },
  { key: "smn", label: "SMN", width: 150, visible: true, isBasic: true },
  { key: "partida", label: "Partida", width: 100, visible: true, isBasic: true },
  { key: "tipo_de_contratacion", label: "TIpo de Contratación", width: 180, visible: true, isBasic: true },
  { key: "cd_un", label: "Cd UN", width: 100, visible: true, isBasic: true },
  { key: "unidad_de_negocio", label: "Unidad de Negocio", width: 250, visible: true, isBasic: true },
  { key: "cd_ua", label: "Cd UA", width: 100, visible: true, isBasic: true },
  { key: "unidad_administrativa", label: "Unidad Administrativa", width: 280, visible: true, isBasic: true },
  { key: "cd_pto_funcional", label: "Cd Pto Funcional", width: 120, visible: true, isBasic: true },
  { key: "nombre_puesto_funcional", label: "Nombre Puesto Funcional", width: 250, visible: true, isBasic: true },
  { key: "id_departamento", label: "Id Departamento", width: 120, visible: true, isBasic: true },
  { key: "departamento", label: "Departamento", width: 200, visible: true, isBasic: true },
  { key: "dependencia_directa", label: "Dependencia Directa", width: 250, visible: true, isBasic: true },
  { key: "codigo", label: "Código", width: 200, visible: true, isBasic: true, greenHeader: true },
  { key: "entidad_federativa", label: "Entidad Federativa", width: 180, visible: true, isBasic: true, greenHeader: true },
  { key: "tipo_de_aduana", label: "Tipo de Aduana", width: 130, visible: true, isBasic: true, greenHeader: true },
  { key: "ubicacion", label: "Ubicación", width: 200, visible: true, isBasic: true, greenHeader: true },
  { key: "descripcion_ubicacion", label: "Descripción ubicación", width: 200, visible: true, isBasic: true, greenHeader: true },
  { key: "tipo_de_personal_sedena_semar", label: "Tipo de personal SEDENA / SEMAR", width: 220, visible: true, isBasic: true },
  { key: "rango", label: "Rango", width: 150, visible: true, isBasic: true },
  { key: "fecha_de_ingreso", label: "Fecha de ingreso", width: 130, visible: true, isBasic: true },
  { key: "dg_o_aduana_compactada", label: "DG o Aduana compactada", width: 200, visible: true, isBasic: true },
  { key: "fecha_anuencia_detalle", label: "Fecha de Anuencia", width: 150, visible: true, isBasic: true, greenHeader: true },
  { key: "oficios_autorizacion_shcp", label: "Oficios de Autorización SHCP", width: 200, visible: true, isBasic: true, greenHeader: true },
  { key: "plazas_eventuales_autorizacion_2026", label: "Plazas eventuales registradas para autorización 2026", width: 350, visible: true, isBasic: true, greenHeader: true },
  { key: "candidato", label: "Candidato", width: 150, visible: true, isBasic: true, greenHeader: true },
  { key: "reportada", label: "Reportada", width: 120, visible: true, isBasic: true, greenHeader: true },
  { key: "fecha_genera_vacante", label: "Fecha que se genera la vacante", width: 220, visible: true, isBasic: true, greenHeader: true },
  { key: "cap_anual", label: "CAP ANUAL", width: 120, visible: true, isBasic: true, greenHeader: true },
  { key: "cap_mensual", label: "CAP MENSUAL", width: 120, visible: true, isBasic: true, greenHeader: true },
  { key: "observaciones_plantillas_do", label: "Observaciones - Plantillas DO", width: 250, visible: true, isBasic: true, greenHeader: true },
  { key: "observaciones_proyectos_alineaciones", label: "Observaciones - Proyectos y Alineaciones", width: 280, visible: true, isBasic: true, greenHeader: true },
  { key: "anno_vacancia", label: "Año de Vacancia (Nuevo Reporte)", width: 220, visible: true, isBasic: true, greenHeader: true },
  { key: "id_field", label: "Id Campo", width: 90, visible: false, isBasic: false },
  { key: "numeral", label: "Numeral", width: 100, visible: false, isBasic: false },
  { key: "ua", label: "UA (Código)", width: 150, visible: false, isBasic: false },
  { key: "cent", label: "Centro (Código)", width: 80, visible: false, isBasic: false },
  { key: "dir", label: "Dirección (Código)", width: 80, visible: false, isBasic: false },
  { key: "subd", label: "Subdirección (Código)", width: 80, visible: false, isBasic: false },
  { key: "jd", label: "Jefatura Depto. (Código)", width: 80, visible: false, isBasic: false },
  { key: "depto", label: "Departamento (Código)", width: 120, visible: false, isBasic: false },
  { key: "aduana", label: "Aduana", width: 200, visible: false, isBasic: false },
  { key: "id_tipo", label: "Id Tipo (Código)", width: 90, visible: false, isBasic: false },
  { key: "tipo", label: "Tipo", width: 130, visible: false, isBasic: false },
  { key: "estado", label: "Estado", width: 150, visible: false, isBasic: false },
  { key: "municipio", label: "Municipio", width: 180, visible: false, isBasic: false },
  { key: "latitud", label: "Latitud", width: 110, visible: false, isBasic: false },
  { key: "longitud", label: "Longitud", width: 110, visible: false, isBasic: false },
  { key: "ua2", label: "UA (Nombre)", width: 200, visible: false, isBasic: false },
  { key: "observaciones", label: "OBSERVACIONES", width: 200, visible: false, isBasic: false },
  { key: "posicion_civil_sedena_semar", label: "Posición _Civil / SEDENA / SEMAR", width: 250, visible: false, isBasic: false },
  { key: "personal_militar_o_civil", label: "Personal Militar o Civil", width: 180, visible: false, isBasic: false },
  { key: "val_estat", label: "Val_estat", width: 100, visible: false, isBasic: false },
  { key: "val_estatx", label: "Val_estatx", width: 100, visible: false, isBasic: false },
  { key: "status_jefe_inm_posicion", label: "Status Jefe Inm Posición", width: 180, visible: false, isBasic: false },
  { key: "numempleado", label: "Numempleado", width: 120, visible: false, isBasic: false },
  { key: "sindicato", label: "Sindicato", width: 150, visible: false, isBasic: false },
  { key: "estado_en_nomina", label: "Estado en nomina", width: 150, visible: false, isBasic: false },
  { key: "ua_validacion", label: "UA Validación", width: 180, visible: false, isBasic: false },
  { key: "validando_posicion_por_documento", label: "Validando de posición por documento", width: 250, visible: false, isBasic: false },
  { key: "nj_comp", label: "NJ COMP", width: 150, visible: false, isBasic: false },
  { key: "nj_ok", label: "NJ OK", width: 150, visible: false, isBasic: false },
  { key: "columna", label: "Columna", width: 150, visible: false, isBasic: false },
  { key: "nombre_nj", label: "Nombre NJ", width: 150, visible: false, isBasic: false },
  { key: "nj_operativo_comb", label: "NJ Operativo Combinado", width: 150, visible: false, isBasic: false },
  { key: "proyecto_2024_reduccion_plazas_eventuales", label: "Proyecto 2024 Reducción de plazas Eventuales", width: 260, visible: false, isBasic: false },
  { key: "salario_base_mov", label: "Salario Base (Movimiento)", width: 160, visible: false, isBasic: false },
];

// Claves que siempre viajan/están disponibles sin importar el alcance de
// columnas de un rol (ver RolColumnScope en el backend) — identificadores y
// datos de estatus que varias funciones de la UI necesitan para operar
// (foto, edición de celdas, badge de estatus), no información sensible por
// sí sola. Debe coincidir con COLUMNAS_DETALLE_SIEMPRE_INCLUIDAS en
// authentication/columnas_detalle_catalog.py del backend.
export const COLUMNAS_DETALLE_SIEMPRE_INCLUIDAS = new Set([
  "posicion", "numempleado", "id_empleado", "mov_pos_id",
  "estado_nomina", "val_estat", "marca_no_disponible",
  "fecha_anuencia_detalle_override", "partida",
]);
