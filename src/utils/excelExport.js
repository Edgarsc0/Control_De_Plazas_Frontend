import ExcelJS from "exceljs";

// Helper to map status abbreviation to friendly name
const mapEstadoNomina = (val) => {
  if (!val || val.trim() === "") return "Vacante";
  switch (val.trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Licencia";
    case "P": return "Licencia Médica";
    default: return "Vacante";
  }
};

// Colors matching ANAM style (ARGB format: AARRGGBB)
const STATUS_COLORS = {
  Activo: "FF621F32",         // Burgundy
  Vacante: "FFBC955C",        // Gold
  Suspendido: "FF3B82F6",     // Blue
  Licencia: "FF8B5CF6",       // Purple
  "Licencia Médica": "FF10B981" // Green
};

const getEstatusColorHex = (label) => {
  return STATUS_COLORS[label] || "FF94A3B8";
};

const matchUa = (emp, uaName) => {
  const u1 = String(emp.unidad_administrativa || '').trim().toLowerCase();
  const u2 = String(emp.desc_unidad_administrativa || '').trim().toLowerCase();
  const target = uaName.trim().toLowerCase();
  return u1 === target || u2 === target;
};

const matchLevel = (emp, levelName) => {
  const empLvl = String(emp.nivel || '').trim();
  if (levelName === 'SIN NIVEL') {
    return !empLvl || empLvl === '';
  }
  return empLvl.toLowerCase() === levelName.trim().toLowerCase();
};

const downloadBlob = (buffer, filename) => {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Define reusable detailed columns for employees
const DETAIL_COLUMNS = [
  { header: 'Estructura / Posición', key: 'posicion', width: 45 },
  { header: 'No. Empleado', key: 'id_empleado', width: 15 },
  { header: 'RFC', key: 'rfc', width: 20 },
  { header: 'CURP', key: 'curp', width: 25 },
  { header: 'Nombre Completo', key: 'nombres', width: 35 },
  { header: 'Puesto Funcional', key: 'nombre_puesto_funcional', width: 45 },
  { header: 'Estatus Nómina', key: 'estado_nomina', width: 20 },
  { header: 'Motivo', key: 'motivo', width: 25 },
  { header: 'Fecha Efectiva', key: 'fecha_efectiva_personal', width: 18 },
  { header: 'Código Presupuestal', key: 'codigo_presupuestal', width: 25 }
];

const styleHeaderRow = (headerRow) => {
  headerRow.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF621F32' } // Guinda institucional
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 30;
};

/**
 * Level 1: Export multiple UAs with interactive drill-down (UA -> Nivel -> Empleados)
 */
export async function exportUasToExcel(selectedUas, estatusPorNivelUa, employeesData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Resumen de Estatus');

  worksheet.properties.outlineProperties = {
    summaryBelow: false,
    summaryRight: false,
  };

  worksheet.columns = DETAIL_COLUMNS;
  styleHeaderRow(worksheet.getRow(1));

  selectedUas.forEach(ua => {
    const levelsData = estatusPorNivelUa.por_ua[ua] || {};
    
    // 1. Calculate UA metrics
    let uaTotal = 0;
    const uaStatusSummary = {};
    Object.values(levelsData).forEach(statusCounts => {
      Object.entries(statusCounts || {}).forEach(([status, val]) => {
        uaTotal += val;
        const statusLabel = mapEstadoNomina(status);
        uaStatusSummary[statusLabel] = (uaStatusSummary[statusLabel] || 0) + val;
      });
    });

    const statusSummaryStr = Object.entries(uaStatusSummary)
      .map(([lbl, val]) => `${lbl}: ${val}`)
      .join(' | ');

    // Add UA summary row (Level 0)
    const uaRow = worksheet.addRow({
      posicion: ua.toUpperCase(),
      id_empleado: '',
      rfc: '',
      curp: '',
      nombres: `Resumen de Unidad: ${statusSummaryStr}`,
      nombre_puesto_funcional: '',
      estado_nomina: `Total: ${uaTotal}`,
      motivo: '',
      fecha_efectiva_personal: '',
      codigo_presupuestal: ''
    });
    
    uaRow.outlineLevel = 0;
    uaRow.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF3E131F' } };
    uaRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5EBEF' } // Suave guinda
    };
    uaRow.height = 28;
    uaRow.alignment = { vertical: 'middle' };

    // 2. Add Levels for this UA
    Object.keys(levelsData).sort().forEach(levelName => {
      const statusCounts = levelsData[levelName];
      let levelTotal = Object.values(statusCounts || {}).reduce((a, b) => a + b, 0);
      const levelStatusSummary = {};
      Object.entries(statusCounts || {}).forEach(([status, val]) => {
        const statusLabel = mapEstadoNomina(status);
        levelStatusSummary[statusLabel] = (levelStatusSummary[statusLabel] || 0) + val;
      });

      const levelStatusStr = Object.entries(levelStatusSummary)
        .map(([lbl, val]) => `${lbl}: ${val}`)
        .join(' | ');

      // Add Level summary row (Level 1)
      const levelRow = worksheet.addRow({
        posicion: `  Nivel: ${levelName}`,
        id_empleado: '',
        rfc: '',
        curp: '',
        nombres: `Resumen Nivel: ${levelStatusStr}`,
        nombre_puesto_funcional: '',
        estado_nomina: `Total: ${levelTotal}`,
        motivo: '',
        fecha_efectiva_personal: '',
        codigo_presupuestal: ''
      });

      levelRow.outlineLevel = 1;
      levelRow.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF856404' } };
      levelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' } // Suave dorado / amarillo
      };
      levelRow.height = 24;
      levelRow.alignment = { vertical: 'middle' };

      // 3. Filter and Add Employees for this UA + Level (Level 2)
      const levelEmployees = employeesData.filter(emp => matchUa(emp, ua) && matchLevel(emp, levelName));

      levelEmployees.forEach(emp => {
        const estatusFriendly = mapEstadoNomina(emp.estado_nomina);
        const empRow = worksheet.addRow({
          posicion: emp.posicion || 'VACANTE',
          id_empleado: emp.id_empleado || '',
          rfc: emp.rfc || '',
          curp: emp.curp || '',
          nombres: emp.nombres || 'SIN EMPLEADO REGISTRADO',
          nombre_puesto_funcional: emp.nombre_puesto_funcional || emp.departamento || '',
          estado_nomina: estatusFriendly,
          motivo: emp.motivo || '',
          fecha_efectiva_personal: emp.fecha_efectiva_personal || '',
          codigo_presupuestal: emp.codigo_presupuestal || ''
        });

        empRow.outlineLevel = 2;
        empRow.font = { name: 'Arial', size: 9 };
        empRow.height = 20;
        empRow.alignment = { vertical: 'middle' };
        
        // Estatus color tag
        const estatusCell = empRow.getCell('estado_nomina');
        const colorHex = getEstatusColorHex(estatusFriendly);
        estatusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFF' } };
        estatusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorHex }
        };
        estatusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    });
  });

  // Enable gridlines
  worksheet.views = [{ showGridLines: true }];

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer, `Reporte_Plantilla_DrillDown_${new Date().toISOString().slice(0,10)}.xlsx`);
}

/**
 * Level 2: Export single UA with selected levels
 */
export async function exportSingleUaToExcel(uaName, selectedLevels, levelsData, employeesData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(uaName.slice(0, 30)); // Sheet name max length limit

  worksheet.properties.outlineProperties = {
    summaryBelow: false,
    summaryRight: false,
  };

  worksheet.columns = DETAIL_COLUMNS;
  styleHeaderRow(worksheet.getRow(1));

  // Add UA general summary row first
  let totalSelectedUaRows = 0;
  selectedLevels.forEach(lvl => {
    const statusCounts = levelsData[lvl] || {};
    totalSelectedUaRows += Object.values(statusCounts).reduce((a, b) => a + b, 0);
  });

  const uaHeaderRow = worksheet.addRow({
    posicion: uaName.toUpperCase(),
    id_empleado: '',
    rfc: '',
    curp: '',
    nombres: `Reporte de Unidad Administrativa - Niveles Seleccionados`,
    nombre_puesto_funcional: '',
    estado_nomina: `Total: ${totalSelectedUaRows}`,
    motivo: '',
    fecha_efectiva_personal: '',
    codigo_presupuestal: ''
  });
  uaHeaderRow.outlineLevel = 0;
  uaHeaderRow.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF3E131F' } };
  uaHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5EBEF' }
  };
  uaHeaderRow.height = 28;
  uaHeaderRow.alignment = { vertical: 'middle' };

  selectedLevels.forEach(levelName => {
    const statusCounts = levelsData[levelName] || {};
    let levelTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const levelStatusSummary = {};
    Object.entries(statusCounts).forEach(([status, val]) => {
      const statusLabel = mapEstadoNomina(status);
      levelStatusSummary[statusLabel] = (levelStatusSummary[statusLabel] || 0) + val;
    });

    const levelStatusStr = Object.entries(levelStatusSummary)
      .map(([lbl, val]) => `${lbl}: ${val}`)
      .join(' | ');

    // Add Level summary row (Level 1)
    const levelRow = worksheet.addRow({
      posicion: `  Nivel: ${levelName}`,
      id_empleado: '',
      rfc: '',
      curp: '',
      nombres: `Resumen Nivel: ${levelStatusStr}`,
      nombre_puesto_funcional: '',
      estado_nomina: `Total: ${levelTotal}`,
      motivo: '',
      fecha_efectiva_personal: '',
      codigo_presupuestal: ''
    });

    levelRow.outlineLevel = 1;
    levelRow.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF856404' } };
    levelRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF3CD' }
    };
    levelRow.height = 24;
    levelRow.alignment = { vertical: 'middle' };

    // Filter and Add Employees for this UA + Level (Level 2)
    const levelEmployees = employeesData.filter(emp => matchUa(emp, uaName) && matchLevel(emp, levelName));

    levelEmployees.forEach(emp => {
      const estatusFriendly = mapEstadoNomina(emp.estado_nomina);
      const empRow = worksheet.addRow({
        posicion: emp.posicion || 'VACANTE',
        id_empleado: emp.id_empleado || '',
        rfc: emp.rfc || '',
        curp: emp.curp || '',
        nombres: emp.nombres || 'SIN EMPLEADO REGISTRADO',
        nombre_puesto_funcional: emp.nombre_puesto_funcional || emp.departamento || '',
        estado_nomina: estatusFriendly,
        motivo: emp.motivo || '',
        fecha_efectiva_personal: emp.fecha_efectiva_personal || '',
        codigo_presupuestal: emp.codigo_presupuestal || ''
      });

      empRow.outlineLevel = 2;
      empRow.font = { name: 'Arial', size: 9 };
      empRow.height = 20;
      empRow.alignment = { vertical: 'middle' };
      
      const estatusCell = empRow.getCell('estado_nomina');
      const colorHex = getEstatusColorHex(estatusFriendly);
      estatusCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFF' } };
      estatusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorHex }
      };
      estatusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  worksheet.views = [{ showGridLines: true }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer, `Reporte_Plantilla_${uaName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
