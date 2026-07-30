// Cálculo compartido de "días restantes hasta la Fecha de Anuencia" y su
// semáforo de color — usado tanto por Mov. Posiciones (columna
// "fecha_anuencia") como por Plantilla Detalle (columna
// "fecha_anuencia_detalle"): es la misma fecha/override en ambos tabs, así
// que viven en un solo lugar para que no puedan desincronizarse entre sí.

const parseIsoDate = (str) => {
  if (!str) return null;
  const [y, m, d] = String(str).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

// `null` si `str` no es una fecha real (vacío, o una de las categorías de
// texto fijo como "Nueva Creación") — nunca lanza ni devuelve basura.
export const daysUntil = (str) => {
  const target = parseIsoDate(str);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const getAnuenciaColorClasses = (dias) => {
  if (dias === null) return null;
  if (dias >= 20) return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
  if (dias >= 10) return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
  return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
};

// No siempre es una fecha: el Excel de origen trae, para algunas posiciones,
// una de estas 4 categorías de texto fijo en vez de una fecha real (mismo
// set que valida el backend, ver FECHA_ANUENCIA_CATEGORIAS_VALIDAS en
// plantilla/models.py). El combobox (input + datalist) de ambos tabs sugiere
// estas 4 más permite escribir una fecha 'YYYY-MM-DD' libremente; el backend
// rechaza cualquier otro texto con un mensaje de error bajo la celda.
export const FECHA_ANUENCIA_CATEGORIAS = ["Nueva Creación", "En Proceso", "Sin Anuencia", "N/A"];
