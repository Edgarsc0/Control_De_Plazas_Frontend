import { prefijoTipoCuadrosVacancia, ELEMENTOS_CUADROS_VACANCIA } from "./widgets/cuadrosVacanciaElementos";

/**
 * Metadatos de presentación del catálogo (WidgetStoreModal): descripción corta
 * y tipo de vista previa animada (ver WidgetPreview.jsx) de cada módulo.
 * Viven aparte del registro para no mezclar texto de interfaz con la
 * definición funcional del widget (componente, tamaños, permisos).
 */
const META = {
  estados_nomina: {
    preview: "dona",
    descripcion: "Distribución de la plantilla por estado de nómina: quién está activo, en licencia o en otras situaciones, de un vistazo.",
  },
  plazas_por_ua: {
    preview: "barras",
    descripcion: "Plazas ocupadas y vacantes por unidad administrativa, en barras apiladas para comparar unidades rápidamente.",
  },
  alineacion_organizacional: {
    preview: "comparar",
    descripcion: "Contrasta la estructura organizacional con la alineación registrada e identifica diferencias.",
  },
  movimientos_hoy_accion: {
    preview: "acciones",
    descripcion: "Movimientos de personal registrados hoy agrupados por tipo de acción (altas, bajas, cambios…).",
  },
  movimientos_hoy_detalle: {
    preview: "tabla",
    descripcion: "Listado detallado de los movimientos de personal del día, con persona, plaza y acción.",
  },
  buscar_baja: {
    preview: "buscador",
    descripcion: "Localiza una baja por nombre, RFC o plaza y consulta su detalle sin salir del tablero.",
  },
  buscar_plaza: {
    preview: "buscador",
    descripcion: "Consulta una plaza o posición: quién la ocupa, su historia y sus movimientos.",
  },
  cadena_mando: {
    preview: "cadena",
    descripcion: "Muestra la cadena de mando de una posición, de la plaza hacia arriba hasta la cabeza de la estructura.",
  },
  buscar_persona: {
    preview: "buscador",
    descripcion: "Busca a una persona de la plantilla y consulta su plaza, nivel y datos de adscripción.",
  },
  arbol_movimientos: {
    preview: "arbol",
    descripcion: "Árbol de movimientos de una plaza: cómo se ha ido moviendo el personal a lo largo del tiempo.",
  },
  titulares_aduanas_resumen: {
    preview: "barras",
    descripcion: "Resumen de la rotación de titulares en las aduanas del país: cuántos cambios y con qué frecuencia.",
  },
  titulares_aduanas_actuales: {
    preview: "lista",
    descripcion: "Quién es hoy el titular de cada aduana, con su fecha de inicio en el cargo.",
  },
  torre_caballito: {
    preview: "torre",
    descripcion: "La Torre Caballito en 3D: busca a un empleado y te muestra en qué piso está. Sin búsqueda, haz clic en un piso para ver a todos sus empleados.",
  },
  buscar_movimiento: {
    preview: "buscador",
    descripcion: "Encuentra un movimiento de personal específico por persona, plaza o folio.",
  },
};

const PREVIEW_CV = { tab: "linea", desglose: "barras", detalle: "tabla" };
const cvPorTipo = Object.fromEntries(
  ELEMENTOS_CUADROS_VACANCIA.map((el) => [`${prefijoTipoCuadrosVacancia}${el.id}`, el])
);

/** `{ descripcion, preview }` de un widget del registro (con valores por defecto). */
export function metaDeWidget(type) {
  if (META[type]) return META[type];
  const el = cvPorTipo[type];
  if (el) {
    return {
      preview: el.id === "cuadro_general" ? "tabla" : PREVIEW_CV[el.origen] || "barras",
      descripcion: `Elemento de Cuadros de Vacancia: ${el.label.toLowerCase()}. Se actualiza con los datos reales del sistema.`,
    };
  }
  return { preview: "barras", descripcion: "Módulo del sistema con datos en tiempo real." };
}
