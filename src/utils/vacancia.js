// Semáforo de color de "Fecha de Vacancia" (Mov. Posiciones) / "Fecha de
// inicio de la vacancia" (Anexo 2) según cuántos días lleva vacante la
// plaza — mismas 3 categorías y mismos umbrales en ambos lugares para que
// nunca puedan desincronizarse (ver AnexoTab/AnuenciaTab.jsx y
// MovimientosTab.jsx, columna "fecha_vacancia").
//
// - Amarillo: menos de 30 días vacante.
// - Verde: 30 a 89 días vacante.
// - Rojo: 90 días o más (ya lleva 3+ meses vacante).

export const VACANCIA_COLOR_LABELS = {
  amarillo: "Amarillo (menos de 30 días)",
  verde: "Verde (30 a 89 días)",
  rojo: "Rojo (90 días o más)",
};

export const VACANCIA_COLOR_ORDEN = ["amarillo", "verde", "rojo"];

/** `null` si `dias` no es un número válido — nunca lanza ni devuelve basura. */
export const getVacanciaColorCategoria = (dias) => {
  const n = Number(dias);
  if (dias === null || dias === undefined || Number.isNaN(n)) return null;
  if (n >= 90) return "rojo";
  if (n >= 30) return "verde";
  return "amarillo";
};

const VACANCIA_COLOR_CLASSES = {
  amarillo: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  verde: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
  rojo: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
};

export const getVacanciaColorClasses = (dias) => {
  const categoria = getVacanciaColorCategoria(dias);
  return categoria ? VACANCIA_COLOR_CLASSES[categoria] : null;
};

// Fondo sólido (sin variante dark: dedicado a inputs con fondo propio, como
// la celda de "Fecha de inicio de la vacancia" en AnuenciaTab.jsx).
const VACANCIA_COLOR_BG_SOLID = {
  amarillo: "bg-amber-100 dark:bg-amber-950/50",
  verde: "bg-emerald-100 dark:bg-emerald-950/50",
  rojo: "bg-red-100 dark:bg-red-950/50",
};

export const getVacanciaColorBgSolid = (dias) => {
  const categoria = getVacanciaColorCategoria(dias);
  return categoria ? VACANCIA_COLOR_BG_SOLID[categoria] : null;
};

const parseIsoDate = (str) => {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Días transcurridos desde `fechaVacanciaStr` ('YYYY-MM-DD') hasta hoy —
 * usado en AnuenciaTab.jsx, donde la fila del Anexo 2 sólo trae la fecha
 * (no un `dias_vacante` ya calculado por el backend como en MOV_POS). `null`
 * si la fecha no es válida.
 */
export const diasVacanteDesdeFecha = (fechaVacanciaStr) => {
  const fecha = parseIsoDate(fechaVacanciaStr);
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((hoy - fecha) / 86400000);
};
