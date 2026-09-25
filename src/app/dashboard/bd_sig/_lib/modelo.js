/**
 * Modelo del diagrama de la BD del SIG (catálogo de Query Manager de PeopleSoft):
 * geometría de cada tabla en el "mundo" del canvas, aristas columna→columna e
 * índices de búsqueda. Puro (sin DOM ni React) para poder probarlo en Node.
 *
 * Los datos vienen de `_data/esquema.json`, generado por
 * `peanam_query_scraper/export_front_json.py`.
 */

export const TW = 380; // ancho de cada tabla
export const HEAD = 48; // cabecera (nombre + descripción)
export const ROW = 18; // alto de cada columna
export const FOOT = 8;
export const GAP_X = 90; // hueco horizontal entre columnas de tablas (por aquí pasan las aristas)
export const GAP_Y = 30;

export const familiaDe = (nombre) =>
  nombre.startsWith('SAT_') ? 'SAT'
    : nombre.startsWith('HRS_') ? 'HRS'
      : nombre.startsWith('JPM_') ? 'JPM'
        : nombre.startsWith('HR_') ? 'HR'
          : 'OTRO';

export const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export function buildModel(data) {
  const tablas = data.tablas.map((t, i) => ({
    ...t,
    i,
    fam: familiaDe(t.n),
    w: TW,
    h: HEAD + ROW * t.c.length + FOOT,
    x: 0,
    y: 0,
    col: 0,
    filaDe: new Map(t.c.map((c, j) => [c[0], j])),
    // texto ya normalizado para búsquedas sin acentos ni mayúsculas
    bN: normalizar(t.n),
    bD: normalizar(t.d),
  }));
  const porNombre = new Map(tablas.map((t) => [t.n, t]));

  // ── aristas columna → columna ────────────────────────────────────────────
  const aristas = [];
  for (const [a, af, b, bf, tp] of data.aristas) {
    const A = porNombre.get(a);
    const B = porNombre.get(b);
    if (!A || !B) continue;
    const ai = A.filaDe.get(af);
    const bi = B.filaDe.get(bf);
    if (ai == null || bi == null) continue;
    aristas.push({ a: A.i, b: B.i, ai, bi, tp, af, bf });
  }
  const vec = tablas.map(() => ({ sal: [], ent: [] }));
  aristas.forEach((e, k) => {
    vec[e.a].sal.push(k);
    vec[e.b].ent.push(k);
  });
  // columnas que son origen de alguna referencia/detalle (para marcarlas "FK")
  tablas.forEach((t) => {
    t.fk = new Map();
  });
  aristas.forEach((e) => tablas[e.a].fk.set(e.ai, e.tp));

  // ── orden: jerarquía de entidades (padres antes que detalles) ────────────
  const ents = data.entidades;
  const hijos = new Map();
  const tienePadre = new Set();
  for (const e of aristas) {
    if (e.tp !== 'd') continue;
    const ea = tablas[e.a].e;
    const eb = tablas[e.b].e;
    if (ea < 0 || eb < 0 || ea === eb) continue;
    if (!hijos.has(eb)) hijos.set(eb, new Set());
    hijos.get(eb).add(ea);
    tienePadre.add(ea);
  }
  const repNombre = (ei) => ents[ei].rep;
  const cmpEnt = (a, b) => {
    const fa = familiaDe(repNombre(a));
    const fb = familiaDe(repNombre(b));
    return fa === fb ? repNombre(a).localeCompare(repNombre(b)) : fa.localeCompare(fb);
  };
  const orden = [];
  const vistas = new Set();
  const visitar = (ei) => {
    if (vistas.has(ei)) return;
    vistas.add(ei);
    const ts = [...ents[ei].t].sort((x, y) =>
      x === ents[ei].rep ? -1 : y === ents[ei].rep ? 1 : x.localeCompare(y));
    ts.forEach((n) => orden.push(porNombre.get(n)));
    [...(hijos.get(ei) || [])].sort(cmpEnt).forEach(visitar);
  };
  ents.map((_, i) => i).filter((i) => !tienePadre.has(i)).sort(cmpEnt).forEach(visitar);
  ents.map((_, i) => i).forEach(visitar); // ciclos improbables: nada se pierde
  tablas.filter((t) => t.e < 0).sort((a, b) => a.n.localeCompare(b.n)).forEach((t) => orden.push(t));

  // ── flujo tipo periódico: llena una columna y sigue con la siguiente ────
  const total = orden.reduce((s, t) => s + t.h + GAP_Y, 0);
  const ncol = Math.max(4, Math.round(Math.sqrt((1.9 * total) / (TW + GAP_X))));
  const objetivo = total / ncol;
  let c = 0;
  let y = 0;
  let H = 0;
  for (const t of orden) {
    t.col = c;
    t.x = c * (TW + GAP_X);
    t.y = y;
    y += t.h + GAP_Y;
    // corta DESPUÉS de superar el objetivo: así el sobrante no se acumula en la última columna
    if (y >= objetivo && c < ncol - 1) {
      H = Math.max(H, y);
      c += 1;
      y = 0;
    }
  }
  H = Math.max(H, y);
  const W = (c + 1) * (TW + GAP_X) - GAP_X;

  // ── índices de búsqueda ──────────────────────────────────────────────────
  const colIdx = new Map(); // CAMPO -> [idx tabla]
  tablas.forEach((t) => {
    t.c.forEach((col) => {
      const k = col[0];
      if (!colIdx.has(k)) colIdx.set(k, []);
      colIdx.get(k).push(t.i);
    });
    t.cN = t.c.map((col) => normalizar(col[0] + ' ' + col[1]));
    t.cNom = t.c.map((col) => normalizar(col[0]));
    t.cDes = t.c.map((col) => normalizar(col[1]));
  });
  const grupos = [...new Set(tablas.flatMap((t) => t.g))].sort();

  return { tablas, porNombre, aristas, vec, W, H, ncol, colIdx, grupos, ents, generado: data.generado };
}

/** Rectángulo que contiene a un conjunto de tablas. */
export function limites(model, idxs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of idxs) {
    const t = model.tablas[i];
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y);
    x1 = Math.max(x1, t.x + t.w); y1 = Math.max(y1, t.y + t.h);
  }
  return { x0, y0, x1, y1 };
}

/**
 * Búsqueda: tablas por nombre/descripción/llave y columnas por nombre/descripción.
 * Devuelve {tablas:[idx], columnas:[{campo, n}]} ordenado por relevancia.
 */
export function buscar(model, q) {
  const t = normalizar(q).trim();
  if (t.length < 2) return { tablas: [], columnas: [], campos: [], coinciden: null };
  // sintaxis TABLA.CAMPO: filtra por tabla y por campo a la vez
  const punto = t.indexOf('.');
  if (punto > 0 && punto < t.length - 1) {
    const pt = t.slice(0, punto); const pc = t.slice(punto + 1);
    const campos = [];
    for (const T of model.tablas) {
      if (!T.bN.includes(pt)) continue;
      T.cNom.forEach((n, j) => { if (n.includes(pc)) campos.push({ t: T.i, fila: j, p: (n === pc ? 0 : n.startsWith(pc) ? 1 : 2) + (T.bN === pt ? 0 : 0.5) }); });
    }
    campos.sort((a, b) => a.p - b.p || model.tablas[a.t].n.localeCompare(model.tablas[b.t].n) || a.fila - b.fila);
    return { tablas: [], columnas: [], campos, coinciden: new Set(campos.map((c) => c.t)) };
  }
  const puntaje = (t0, i) => {
    const T = model.tablas[i];
    if (T.bN === t0) return 0;
    if (T.bN.startsWith(t0)) return 1;
    if (T.bN.includes(t0)) return 2;
    if (T.bD.includes(t0)) return 3;
    return 9;
  };
  const tablas = model.tablas.map((_, i) => i).filter((i) => puntaje(t, i) < 9)
    .sort((a, b) => puntaje(t, a) - puntaje(t, b) || model.tablas[a].n.localeCompare(model.tablas[b].n));
  const columnas = [];
  for (const [campo, ts] of model.colIdx) {
    const n = normalizar(campo);
    let p = n === t ? 0 : n.startsWith(t) ? 1 : n.includes(t) ? 2 : 9;
    if (p === 9) {
      // descripción de la columna (usa la de la primera tabla que la trae)
      const T = model.tablas[ts[0]];
      const d = normalizar(T.c[T.filaDe.get(campo)][1]);
      if (d.includes(t)) p = 3;
    }
    if (p < 9) columnas.push({ campo, n: ts.length, p });
  }
  columnas.sort((a, b) => a.p - b.p || b.n - a.n || a.campo.localeCompare(b.campo));
  // cada campo individual (TABLA.CAMPO) cuyo nombre o descripción coincide
  const campos = [];
  for (const T of model.tablas) {
    T.cNom.forEach((n, j) => {
      const p = n === t ? 0 : n.startsWith(t) ? 1 : n.includes(t) ? 2 : T.cDes[j].includes(t) ? 3 : 9;
      if (p < 9) campos.push({ t: T.i, fila: j, p });
    });
  }
  campos.sort((a, b) => a.p - b.p || model.tablas[a.t].n.localeCompare(model.tablas[b.t].n) || a.fila - b.fila);
  // conjunto de tablas que coinciden por cualquier motivo (para atenuar el resto)
  const coinciden = new Set(tablas);
  for (const c of columnas) model.colIdx.get(c.campo).forEach((i) => coinciden.add(i));
  return { tablas, columnas, campos, coinciden };
}
