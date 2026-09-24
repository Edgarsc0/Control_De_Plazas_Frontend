// Geometría de la cuadrícula del tablero personalizable.
//
// El tablero se organiza en "escritorios": cada uno ocupa exactamente el área
// visible (ni más ni menos) y se navega horizontalmente entre ellos. De ahí que
// la cuadrícula tenga un número FIJO de filas y que la altura de fila se derive
// del alto disponible en vez de ser una constante: así el contenido siempre
// cabe completo, sin scroll vertical, a cualquier nivel de zoom o tamaño de
// ventana. Un widget guarda su alto en filas (1..GRID_ROWS), que es una medida
// relativa; al cambiar el zoom se recalculan los píxeles, no las filas.
//
// Las fórmulas de píxeles son una réplica exacta de `calcGridColWidth`,
// `calcGridItemWHPx`, `calcXY` y `calcGridItemPosition` de react-grid-layout
// v2 — si se actualiza la librería y cambia su matemática, el preview y la
// posición final se desalinearían, así que conviene revisarlas juntas.
export const GRID_COLS = 12;
export const GRID_ROWS = 8;
export const GRID_MARGIN = [12, 12];
// react-grid-layout usa `containerPadding ?? margin` cuando no se le pasa
// `containerPadding` explícito (default `null`), así que el padding efectivo
// del contenedor es el mismo margen.
export const GRID_PADDING = GRID_MARGIN;

const clamp = (valor, min, max) => Math.max(min, Math.min(valor, max));

/**
 * Altura de fila para que GRID_ROWS filas ocupen exactamente `alturaDisponible`.
 * Es la inversa de la fórmula con la que react-grid-layout calcula el alto
 * total del contenedor, así que la cuadrícula acaba midiendo justo el alto del
 * escritorio y nunca desborda.
 */
export function alturaFila(alturaDisponible) {
  const util = alturaDisponible - GRID_PADDING[1] * 2 - GRID_MARGIN[1] * (GRID_ROWS - 1);
  return Math.max(1, util / GRID_ROWS);
}

/** Ancho en píxeles de una columna, dado el ancho del escritorio. */
export function anchoColumna(anchoEscritorio) {
  return (anchoEscritorio - GRID_MARGIN[0] * (GRID_COLS - 1) - GRID_PADDING[0] * 2) / GRID_COLS;
}

/** Tamaño en píxeles de un elemento de `w` x `h` celdas. */
export function tamanoEnPx(anchoEscritorio, rowHeight, w, h) {
  return {
    width: Math.round(anchoColumna(anchoEscritorio) * w + Math.max(0, w - 1) * GRID_MARGIN[0]),
    height: Math.round(rowHeight * h + Math.max(0, h - 1) * GRID_MARGIN[1]),
  };
}

/** Posición en píxeles (relativa al escritorio) de la celda `x`,`y`. */
export function posicionEnPx(anchoEscritorio, rowHeight, x, y) {
  return {
    left: Math.round((anchoColumna(anchoEscritorio) + GRID_MARGIN[0]) * x + GRID_PADDING[0]),
    top: Math.round((rowHeight + GRID_MARGIN[1]) * y + GRID_PADDING[1]),
  };
}

/**
 * Convierte una posición del puntero (relativa a la esquina superior izquierda
 * del escritorio) en la celda donde debe quedar un elemento de `w` x `h`,
 * centrándolo bajo el cursor — el mismo criterio que usa la librería al
 * arrastrar, para que soltar se sienta igual que reposicionar.
 */
export function celdaDesdePuntero(anchoEscritorio, rowHeight, offsetX, offsetY, w, h) {
  const colW = anchoColumna(anchoEscritorio);
  const { width, height } = tamanoEnPx(anchoEscritorio, rowHeight, w, h);

  const left = Math.max(0, offsetX - width / 2);
  const top = Math.max(0, offsetY - height / 2);

  return {
    x: clamp(Math.round((left - GRID_PADDING[0]) / (colW + GRID_MARGIN[0])), 0, GRID_COLS - w),
    y: clamp(Math.round((top - GRID_PADDING[1]) / (rowHeight + GRID_MARGIN[1])), 0, GRID_ROWS - h),
  };
}

/** ¿El rectángulo `x,y,w,h` se traslapa con alguno de `items`? */
export function colisiona(items, x, y, w, h, ignorarId = null) {
  return items.some((it) => (
    it.i !== ignorarId &&
    x < it.x + it.w && it.x < x + w &&
    y < it.y + it.h && it.y < y + h
  ));
}

/**
 * Primer hueco libre (de arriba a abajo, de izquierda a derecha) donde cabe un
 * elemento de `w` x `h` en un escritorio que ya contiene `items`. `null` si no
 * cabe en ningún lado — ese es el criterio con el que un escritorio se
 * considera lleno y el widget pasa al siguiente.
 */
export function buscarHueco(items, w, h) {
  for (let y = 0; y <= GRID_ROWS - h; y += 1) {
    for (let x = 0; x <= GRID_COLS - w; x += 1) {
      if (!colisiona(items, x, y, w, h)) return { x, y };
    }
  }
  return null;
}

/**
 * Deja la lista de widgets en un estado siempre válido para el modelo de
 * escritorios: cada uno dentro de los límites de la cuadrícula, sin traslapes y
 * repartido en escritorios. Se aplica al cargar el layout guardado — los
 * layouts creados antes de que el tablero se dividiera en escritorios no traen
 * `page` y pueden tener widgets más altos que un escritorio, así que aquí se
 * reacomodan en vez de romperse.
 */
export function normalizarWidgets(widgets) {
  const porEscritorio = new Map();
  const ordenados = [...widgets].sort(
    (a, b) => (a.page ?? 0) - (b.page ?? 0) || (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)
  );

  return ordenados.map((widget) => {
    const w = clamp(widget.w ?? 1, 1, GRID_COLS);
    const h = clamp(widget.h ?? 1, 1, GRID_ROWS);
    let escritorio = Math.max(0, widget.page ?? 0);
    let pos = null;

    // Un escritorio vacío siempre admite un widget ya acotado a GRID_COLS x
    // GRID_ROWS, así que este bucle no puede quedarse sin salida.
    while (pos === null) {
      const items = porEscritorio.get(escritorio) ?? [];
      const x = clamp(widget.x ?? 0, 0, GRID_COLS - w);
      const y = clamp(widget.y ?? 0, 0, GRID_ROWS - h);
      if (!colisiona(items, x, y, w, h)) pos = { x, y };
      else {
        const hueco = buscarHueco(items, w, h);
        if (hueco) pos = hueco;
        else escritorio += 1;
      }
    }

    const colocado = { ...widget, w, h, x: pos.x, y: pos.y, page: escritorio };
    porEscritorio.set(escritorio, [...(porEscritorio.get(escritorio) ?? []), colocado]);
    return colocado;
  });
}
