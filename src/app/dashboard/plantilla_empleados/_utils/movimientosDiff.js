// Lógica de comparación entre un movimiento de personal
// (cp_tbl_mov_completo_29_05_26) y su inmediato anterior cronológico.
// Compartida por EmpleadoTimelineModal.jsx y HistorialMovimientosTab.jsx —
// antes duplicada solo en el primero.

// Campos que no representan un "cambio" visible del movimiento en sí
// (metadata de auditoría, identidad del empleado, texto que no varía entre
// movimientos de la misma persona) — se excluyen tanto de "Cambios
// detectados" como de "Sin cambios".
export const IGNORED_DIFF_FIELDS = [
  "sec", "fecha_captura", "fecha_ult_actz", "por", "fecha_descarga",
  "accion", "accion_nombre", "motivo", "motivo_nombre", "fecha_efectiva",
  "id", "num_empleado", "nombre", "ap_pat", "ap_mat", "columna_C", "columna_D",
  "rfc", "curp", "sexo",
];

export const FIELD_LABELS = {
  sal_base: "Salario Base",
  puesto_ptal: "Puesto",
  ubicacion: "Ubicación",
  un_admin: "Unidad Administrativa",
  posicion: "Posición",
  nivel_tabular: "Nivel Tabular",
  estado_pago: "Estado Pago",
  est_hr: "Estatus HR",
  partida_presup: "Partida Presupuestal",
  cd_puesto: "Código Puesto",
  gp_pago: "Grupo Pago",
  escala: "Escala",
  grado: "Grado",
  plan_sal: "Plan Salarial",
  prog_benef: "Programa Benef.",
  id_estbl: "Id Establecimiento",
  grupo_cd_sal: "Grupo CD Sal",
  gp_trabajo: "Grupo Trabajo",
  antiguo_empr: "Antigüedad Emp.",
  nv_jerarquico: "Nivel Jerárquico",
  desc_larga_un: "Desc. Unidad Admin.",
  desc_larga_p: "Desc. Puesto",
};

const fieldLabel = (key) => FIELD_LABELS[key] || key.toUpperCase();

/**
 * Compara un movimiento contra su inmediato anterior (cronológicamente) y
 * separa los campos no ignorados en dos grupos: los que cambiaron
 * (`differences`, con valor anterior/nuevo) y los que se mantuvieron igual
 * (`unchanged`, solo si al menos un lado trae dato — un par vacío-vacío no
 * aporta nada al expediente).
 * @param {object} current
 * @param {object|null|undefined} previous - null/undefined si `current` es el primer movimiento (sin anterior que comparar).
 * @returns {{differences: Array<{key:string,label:string,oldValue:string,newValue:string}>, unchanged: Array<{key:string,label:string,value:string}>}}
 */
export const getMovimientoDiff = (current, previous) => {
  if (!previous) return { differences: [], unchanged: [] };
  const differences = [];
  const unchanged = [];
  for (const key in current) {
    if (IGNORED_DIFF_FIELDS.includes(key)) continue;
    const curVal = String(current[key] ?? "").trim();
    const prevVal = String(previous[key] ?? "").trim();
    if (curVal !== prevVal) {
      differences.push({
        key,
        label: fieldLabel(key),
        oldValue: prevVal || "(Vacío)",
        newValue: curVal || "(Vacío)",
      });
    } else if (curVal) {
      unchanged.push({ key, label: fieldLabel(key), value: curVal });
    }
  }
  return { differences, unchanged };
};

// Compat: firma original usada por EmpleadoTimelineModal.jsx (solo differences).
export const getDifferences = (current, previous) => getMovimientoDiff(current, previous).differences;
