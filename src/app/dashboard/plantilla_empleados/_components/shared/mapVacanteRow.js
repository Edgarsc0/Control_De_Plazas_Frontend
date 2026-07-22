// Traduce una fila de `desgloseJerarquicoData`/`ocupadosJerarquicoData` (esquema
// "Posición"/"Nivel"/..., tal como lo entrega el backend de desglose jerárquico)
// al esquema snake_case que consume EmployeesModal (ver ALL_AVAILABLE_COLUMNS
// ahí). Sin esto, pasar esas filas directo al modo local de EmployeesModal
// (prop `rows`) no mostraría nada porque las claves no calzan.
// Debe reflejar 1:1 las columnas que el SELECT de DesgloseJerarquicoView /
// DesgloseJerarquicoOcupadosView trae del backend (plantilla/views.py) — si el
// back agrega una columna nueva, hay que sumarla aquí también.
export function mapVacanteRowToEmployeeRow(item) {
    return {
        // Solo poblados cuando `item` viene de ocupadosJerarquicoData (trae
        // identidad de empleado); en filas de vacantes quedan undefined y el
        // modal los pinta como "—".
        id_empleado: item["Id Empleado"],
        nombres: item["Nombres"],
        rfc: item["RFC"],
        curp: item["CURP"],
        posicion: item["Posición"],
        nivel: item["Nivel"],
        // Solo poblados cuando `item` viene de desgloseJerarquicoData (vacantes):
        // DesgloseJerarquicoOcupadosView no hace este JOIN porque una plaza
        // ocupada no tiene fecha de vacancia. `mov_pos_id` es el id del renglón
        // de MOV_POS que consume VacantesService.getMovPosVacanciaDetalle para
        // abrir el detalle completo (ver columna "Fecha de Vacancia" en EmployeesModal).
        fecha_vacancia: item["Fecha Vacancia"],
        mov_pos_id: item["mov_pos_id"],
        fecha_de_ingreso: item["Fecha de ingreso"],
        estado_nomina: item["Estado Nómina"],
        nombre_puesto_funcional: item["Nombre Puesto Funcional"],
        unidad_de_negocio: item["Unidad de Negocio"],
        unidad_administrativa: item["nombre_ua"],
        aduana: item["Aduana"],
        tipo_de_aduana: item["Tipo de Aduana"],
        entidad_federativa: item["Entidad Federativa"],
        municipio: item["municipio"],
        ubicacion: item["Ubicación"],
        descripcion_ubicacion: item["Descripción ubicación"],
        cd_ua: item["Cd UA"],
        id_departamento: item["Id Departamento"],
        departamento: item["Departamento"],
        nj: item["NJ"],
        nombre_nj: item["nombreNJ"],
        cd_un: item["Cd UN"],
        codigo_presupuestal: item["Código Presupuestal"],
        partida: item["Partida"],
        tipo_de_contratacion: item["TIPO DE CONTRATACIÓN"],
        tipo: item["tipo"],
        escala: item["Escala"],
        smb: item["SMB"],
        smn: item["SMN"],
        val_estat: item["Val_estat"],
        estado_en_nomina: item["Estado en nomina"],
        ua_validacion: item["UA Validación"],
        validando_posicion_por_documento: item["Validando de posición por documento"],
        status_jefe_inm_posicion: item["Status Jefe Inm Posición"],
        numeral: item["numeral"],
        observaciones: item["OBSERVACIONES"],
        sindicato: item["Sindicato"],
        personal_militar_o_civil: item["Personal Militar o Civil"],
        rango: item["Rango"],
        posicion_civil_sedena_semar: item["Posición _Civil / SEDENA / SEMAR"],
        tipo_de_personal_sedena_semar: item["Tipo de personal SEDENA / SEMAR"],
        dg_o_aduana_compactada: item["DG o Aduana compactada"],
        proyecto_2024_reduccion_plazas_eventuales: item["Proyecto 2024 Reducción de plazas Eventuales"],
        fecha_efectiva_personal: item["Fecha efectiva (Personal)"],
        fecha_de_captura: item["Fecha de captura"],
        qna: item["Qna"],
        fecha_prevista_de_salida: item["Fecha prevista de salida"],
        dependencia_directa: item["DependenciaDirecta"],
        numempleado: item["Numempleado"],
        id_field: item["Id_campo"],
        cent: item["cent"],
        dir: item["dir"],
        subd: item["subd"],
        jd: item["jd"],
        depto: item["depto"],
        id_tipo: item["id tipo"],
        ua2: item["ua2"],
        latitud: item["latitud"],
        longitud: item["longitud"],
        cd_pto_funcional: item["Cd Pto Funcional"],
    };
}
