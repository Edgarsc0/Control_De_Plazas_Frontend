// Reglas de clasificación de plazas de "Cuadros de Vacancia" (gráfica "Ocupadas vs Vacantes por
// familia de nivel"). Compartidas con el widget "Estatus de posiciones por unidad administrativa"
// para que los dos cuenten exactamente igual: si cambia una regla, cambia en ambos.

/* Desglose por tipo de plaza (Eventuales / Evt. Nueva Creación / Permanentes),
   igual clasificación que "Detalle de Vacantes" (DetalleVacantesTablas.jsx) */
export const classifyPos = (pos) => {
  const p = (pos || '').trim();
  if (p.startsWith('103')) return 'permanente';
  if (p.startsWith('2026')) return 'nuevaCreacion';
  return 'eventual';
};

// Desglose de OCUPADAS por tipo de plaza: mismas reglas de partida que usa el
// backend en EmpleadosPorNivelYEstatusView, pero para estado_nomina != ' '.
// Permanentes = posición 103% + partida 11301; Eventuales Nueva Creación =
// posición 2026% + partida 12201; Eventuales = partida 12201 sin 2026%.
// Todo registro ocupado cae en 11301 o 12201 (verificado contra la BD), así
// que no hace falta categoría "otras".
export const classifyOcupada = (item) => {
  const pos = (item['Posición'] || '').trim();
  const partida = (item['Partida'] || '').trim();
  if (pos.startsWith('103') && partida === '11301') return 'permanente';
  if (partida === '12201' && pos.startsWith('2026')) return 'nuevaCreacion';
  return 'eventual';
};


// P's, D's, S's, A's, J's: 3 divisiones. Operativos y K's: 2 (nueva creación
// se suma a eventuales). J's se trata igual que P/D/S/A (supuesto — no hay
// forma de confirmarlo desde el query de referencia de niveles).
export const THREE_WAY_FAMILIES = new Set(["P's", "D's", "S's", "A's", "J's"]);
export const TWO_WAY_FAMILIES = new Set(["Operativos", "K's"]);


// Familia de nivel: primera letra del nivel tabular ("P's", "D's"…); numéricos → "Operativos".
export const familiaDeNivel = (nivel) => {
  if (!nivel) return "Sin Nivel";
  const c = String(nivel).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? `${c}'s` : "Operativos";
};

// Pestañas del modal de detalle al hacer clic en un nivel dentro de una familia
// en "Ocupadas vs Vacantes por familia de nivel" (gráfica 3, segundo nivel de
// profundidad). Mismas reglas de partida presupuestal que usa el backend en
// EmpleadosPorNivelYEstatusView: Ocupadas Permanentes = estado_nomina != ' ' +
// posición 103% + partida 11301; Ocupadas Eventuales = estado_nomina != ' ' +
// partida 12201 sin posición 2026%; Ocupadas Eventuales Nueva Creación =
// estado_nomina != ' ' + partida 12201 + posición 2026%. Vacantes: mismas
// reglas de partida/posición pero con estado_nomina = ' '.
export const VACANCIA_CATEGORY_TABS = [
  { key: 'ocup_permanente', label: 'Ocup. Permanentes', estatus: 'Ocupadas Permanentes' },
  { key: 'ocup_eventual', label: 'Ocup. Eventuales', estatus: 'Ocupadas Eventuales' },
  { key: 'ocup_eventual_nc', label: 'Ocup. Event. N.C.', estatus: 'Ocupadas Eventuales Nueva Creación' },
  { key: 'vac_eventual', label: 'Vac. Eventuales', estatus: 'Vacantes Eventuales' },
  { key: 'vac_permanente', label: 'Vac. Permanentes', estatus: 'Vacantes Permanentes' },
  { key: 'vac_eventual_nc', label: 'Vac. Event. N.C.', estatus: 'Vacantes Eventuales Nueva Creación' },
];
