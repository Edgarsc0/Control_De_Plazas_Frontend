// Traduce una fila de `desgloseJerarquicoData` (esquema "Posición"/"Nivel"/...,
// tal como lo entrega el backend de desglose jerárquico) al esquema
// snake_case que consume EmployeesModal (ver ALL_AVAILABLE_COLUMNS ahí). Sin
// esto, pasar esas filas directo al modo local de EmployeesModal (prop
// `rows`) no mostraría nada porque las claves no calzan.
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
        nombre_puesto_funcional: item["Nombre Puesto Funcional"],
        unidad_de_negocio: item["Unidad de Negocio"],
        unidad_administrativa: item["nombre_ua"],
        cd_ua: item["Cd UA"],
        id_departamento: item["Id Departamento"],
        departamento: item["Departamento"],
        nj: item["NJ"],
        nombre_nj: item["nombreNJ"],
        cd_un: item["Cd UN"],
        codigo_presupuestal: item["Código Presupuestal"],
        escala: item["Escala"],
        partida: item["Partida"],
        tipo_de_contratacion: item["TIPO DE CONTRATACIÓN"],
        sindicato: item["Sindicato"],
        entidad_federativa: item["Entidad Federativa"],
        smb: item["SMB"],
        smn: item["SMN"],
    };
}
