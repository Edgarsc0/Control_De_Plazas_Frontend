import { HEAD, ROW } from './modelo';

/**
 * Dibujo en modo inmediato del diagrama. Se ejecuta dentro del `sceneFunc` de un
 * Shape de Konva: el contexto ya trae la transformación (zoom + desplazamiento)
 * del Stage, así que todo se dibuja en coordenadas del "mundo".
 *
 * Solo se pintan las tablas que caen dentro de la vista, con tres niveles de detalle:
 *   sc < 0.10        bloque de color
 *   0.10 ≤ sc < 0.35 caja + nombre (con tamaño compensado para leerse)
 *   sc ≥ 0.35        cabecera, todas las columnas y —según el zoom— tipo, PK/FK y descripción
 */

export const PALETAS = {
  claro: {
    fondo: '#eef1f5', punto: '#cdd5df', mesa: '#ffffff', borde: '#c3ccd8', texto: '#0f172a',
    suave: '#64748b', fila: '#f6f8fb', llave: 'rgba(15,118,110,0.11)', acento: '#0f766e',
    hier: '#c2410c', sel: '#621f32', resalta: 'rgba(250,204,21,0.55)', dorado: '#bc955c',
    sombra: 'rgba(15,23,42,0.16)',
  },
  oscuro: {
    fondo: '#0b1220', punto: '#1e293b', mesa: '#152033', borde: '#2b3a52', texto: '#e5edf7',
    suave: '#94a3b8', fila: '#1a2740', llave: 'rgba(45,212,191,0.14)', acento: '#2dd4bf',
    hier: '#fb923c', sel: '#f0b7c5', resalta: 'rgba(250,204,21,0.38)', dorado: '#d4b06f',
    sombra: 'rgba(0,0,0,0.5)',
  },
};

export const COLOR_FAMILIA = {
  SAT: '#621f32', HRS: '#2563eb', JPM: '#7c3aed', HR: '#0f766e', OTRO: '#475569',
};

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const cortar = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);

/** Punto de anclaje de una arista en la fila `fila` de la tabla `t`. */
function ancla(t, fila, lado) {
  return { x: lado === 'r' ? t.x + t.w : t.x, y: t.y + HEAD + fila * ROW + ROW / 2 };
}

/** Geometría de una arista: lados de salida/entrada y puntos de control. */
export function geometria(A, B, e) {
  let la; let lb;
  if (B.x >= A.x + A.w) { la = 'r'; lb = 'l'; }
  else if (B.x + B.w <= A.x) { la = 'l'; lb = 'r'; }
  else { la = 'r'; lb = 'r'; } // misma columna: rodea por la derecha
  const p0 = ancla(A, e.ai, la);
  const p1 = ancla(B, e.bi, lb);
  const dx = Math.max(70, Math.abs(p1.x - p0.x) * 0.45);
  const s0 = la === 'r' ? 1 : -1;
  const s1 = lb === 'r' ? 1 : -1;
  return { p0, p1, c0: { x: p0.x + s0 * dx, y: p0.y }, c1: { x: p1.x + s1 * dx, y: p1.y }, la, lb };
}

/** Geometría de todas las aristas, calculada una sola vez por modelo (no cambia al hacer zoom). */
const cacheGeo = new WeakMap();
function geosDe(M) {
  let g = cacheGeo.get(M);
  if (!g) {
    g = M.aristas.map((e) => {
      const A = M.tablas[e.a]; const B = M.tablas[e.b];
      const r = geometria(A, B, e);
      r.bx0 = Math.min(A.x, B.x); r.bx1 = Math.max(A.x + A.w, B.x + B.w);
      r.by0 = Math.min(A.y, B.y); r.by1 = Math.max(A.y + A.h, B.y + B.h);
      return r;
    });
    cacheGeo.set(M, g);
  }
  return g;
}

/**
 * `E.rapido` = el usuario está haciendo zoom/arrastrando: se omiten sombras, guiones y
 * textos secundarios para mantener los cuadros fluidos; al soltar se repinta completo.
 * Para minimizar cambios de `font` (lo más caro del canvas 2D) el texto se pinta en
 * pasadas globales, una por tipo de letra, en vez de fila por fila.
 */
export function dibujar(c, M, v, sc, E, P) {
  const { tablas, aristas } = M;
  const geo = geosDe(M);
  const px = (n) => n / sc; // píxeles de pantalla → mundo
  const rapido = !!E.rapido;

  // ── rejilla de puntos (paso adaptativo: nunca más de ~1 punto cada 24 px) ─────
  if (sc >= 0.12) {
    let paso = 100;
    while (paso * sc < 24) paso *= 2;
    c.fillStyle = P.punto;
    const r = Math.max(1.2, px(1.4));
    for (let x = Math.floor(v.x0 / paso) * paso; x < v.x1; x += paso) {
      for (let y = Math.floor(v.y0 / paso) * paso; y < v.y1; y += paso) c.fillRect(x, y, r, r);
    }
  }

  const visible = (t) => t.x < v.x1 && t.x + t.w > v.x0 && t.y < v.y1 && t.y + t.h > v.y0;

  // ── aristas: un solo trazo por grupo (tipo × propia) ──────────────────────────
  c.lineCap = 'round';
  const haySel = E.sel >= 0;
  const grupos = [[], [], [], []]; // 0 detalle ajena · 1 ref ajena · 2 detalle propia · 3 ref propia
  for (let k = 0; k < aristas.length; k++) {
    const e = aristas[k];
    const d = e.tp === 'd';
    if (d ? !E.mostrarD : !E.mostrarR) continue;
    const propia = haySel && (e.a === E.sel || e.b === E.sel);
    if (E.soloSel && !propia) continue;
    const g = geo[k];
    if (g.bx0 > v.x1 || g.bx1 < v.x0 || g.by0 > v.y1 || g.by1 < v.y0) continue;
    grupos[(propia ? 2 : 0) + (d ? 0 : 1)].push(g);
  }
  for (let q = 0; q < 4; q++) {
    const lista = grupos[q];
    if (!lista.length) continue;
    const det = q % 2 === 0; const propia = q >= 2;
    c.beginPath();
    for (const g of lista) {
      c.moveTo(g.p0.x, g.p0.y);
      c.bezierCurveTo(g.c0.x, g.c0.y, g.c1.x, g.c1.y, g.p1.x, g.p1.y);
    }
    const color = det ? P.hier : P.acento;
    c.strokeStyle = color;
    c.setLineDash(!det && !rapido && sc >= 0.2 ? [px(7), px(5)] : []);
    if (propia) { c.globalAlpha = 0.95; c.lineWidth = px(2.4); }
    else { c.globalAlpha = haySel ? 0.05 : (det ? 0.3 : 0.2); c.lineWidth = px(1.2); }
    c.stroke();
    if (propia) {
      c.setLineDash([]);
      c.fillStyle = color;
      for (const g of lista) {
        c.beginPath(); c.arc(g.p0.x, g.p0.y, px(4), 0, 6.283); c.fill();
        const dir = g.lb === 'l' ? 1 : -1; const s = px(9); // flecha en el destino
        c.beginPath();
        c.moveTo(g.p1.x, g.p1.y);
        c.lineTo(g.p1.x - dir * s, g.p1.y - s * 0.55);
        c.lineTo(g.p1.x - dir * s, g.p1.y + s * 0.55);
        c.closePath(); c.fill();
      }
    }
  }
  c.setLineDash([]);
  c.globalAlpha = 1;

  // ── tablas visibles ───────────────────────────────────────────────────────────
  const detalle = sc >= 0.35;
  const conDesc = sc >= 0.8 && !rapido;
  const conTipo = sc >= 0.55 && !rapido;
  const vis = [];
  for (const t of tablas) {
    if (!visible(t)) continue;
    const activa = (!E.match || E.match.has(t.i)) && (!E.grupoSet || E.grupoSet.has(t.i));
    vis.push({
      t,
      a: activa ? 1 : 0.22,
      esSel: t.i === E.sel,
      vecina: !!(E.vecinos && E.vecinos.has(t.i)),
      coincide: !!(E.match && E.match.has(t.i)),
      i0: Math.max(0, Math.floor((v.y0 - t.y - HEAD) / ROW)),
      i1: Math.min(t.c.length - 1, Math.ceil((v.y1 - t.y - HEAD) / ROW)),
    });
  }

  // pasada 1: cuerpos, cabeceras y fondos de fila
  for (const o of vis) {
    const { t } = o;
    c.globalAlpha = o.a;
    const color = COLOR_FAMILIA[t.fam];
    if (sc < 0.1) {
      c.fillStyle = color; c.fillRect(t.x, t.y, t.w, t.h);
      if (o.esSel || o.coincide) { c.strokeStyle = o.esSel ? P.sel : P.dorado; c.lineWidth = px(3); c.strokeRect(t.x, t.y, t.w, t.h); }
      continue;
    }
    if (detalle && !rapido) { c.fillStyle = P.sombra; c.fillRect(t.x + px(1), t.y + px(3), t.w, t.h); }
    c.fillStyle = P.mesa; c.fillRect(t.x, t.y, t.w, t.h);
    if (!detalle) {
      const alto = Math.min(t.h, Math.max(HEAD, px(26)));
      c.fillStyle = color; c.fillRect(t.x, t.y, t.w, alto);
      const fs = Math.min(px(13), (t.w * 0.94) / (t.n.length * 0.6));
      c.fillStyle = '#fff'; c.font = `600 ${fs}px ${MONO}`; c.textBaseline = 'middle';
      c.fillText(t.n, t.x + t.w * 0.03, t.y + Math.max(HEAD, px(26)) / 2);
      continue;
    }
    c.fillStyle = color; c.fillRect(t.x, t.y, t.w, HEAD);
    for (let j = o.i0; j <= o.i1; j++) {
      const col = t.c[j];
      const ry = t.y + HEAD + j * ROW;
      if (col[3] === 1) { c.fillStyle = P.llave; c.fillRect(t.x, ry, t.w, ROW); }
      else if (j % 2) { c.fillStyle = P.fila; c.fillRect(t.x, ry, t.w, ROW); }
      if ((E.colFoco && col[0] === E.colFoco) || (E.qFila && t.cN[j].includes(E.qFila))) { c.fillStyle = P.resalta; c.fillRect(t.x, ry, t.w, ROW); }
      if (o.esSel && E.selFila === j) {
        c.fillStyle = P.resalta; c.fillRect(t.x, ry, t.w, ROW);
        c.strokeStyle = P.sel; c.lineWidth = px(1.5); c.strokeRect(t.x + 1, ry + 0.5, t.w - 2, ROW - 1);
      }
      if (E.hover && E.hover.t === t.i && E.hover.fila === j) { c.fillStyle = 'rgba(148,163,184,0.25)'; c.fillRect(t.x, ry, t.w, ROW); }
    }
  }

  // pasadas de texto (solo con detalle): una por tipo de letra
  if (detalle) {
    const porTabla = (fn) => { for (const o of vis) { c.globalAlpha = o.a; fn(o.t, o); } };
    const porFila = (fn) => {
      for (const o of vis) {
        c.globalAlpha = o.a;
        const t = o.t;
        for (let j = o.i0; j <= o.i1; j++) fn(t, j, t.c[j], t.y + HEAD + j * ROW + ROW / 2 + 0.5);
      }
    };

    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#fff'; c.font = `700 14px ${MONO}`;
    porTabla((t) => c.fillText(cortar(t.n, t.v ? 26 : 34), t.x + 12, t.y + 20));
    c.font = `700 9px ${SANS}`;
    porTabla((t) => {
      if (!t.v) return;
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(t.x + t.w - 52, t.y + 8, 42, 16);
      c.fillStyle = '#fff'; c.fillText('VISTA', t.x + t.w - 46, t.y + 19.5);
    });
    if (!rapido) {
      c.fillStyle = 'rgba(255,255,255,0.86)'; c.font = `11px ${SANS}`;
      porTabla((t) => c.fillText(cortar(t.d || 'Sin descripción en PeopleSoft', 58), t.x + 12, t.y + 36));
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `10px ${SANS}`; c.textAlign = 'right';
      porTabla((t) => c.fillText(`${t.c.length} col.`, t.x + t.w - 10, t.y + 44));
      c.textAlign = 'left';
    }

    c.textBaseline = 'middle';
    if (!rapido) {
      c.font = `700 8.5px ${SANS}`;
      porFila((t, j, col, y) => {
        const esLlave = col[3] === 1;
        if (esLlave) { c.fillStyle = P.acento; c.fillText('PK', t.x + 6, y); }
        const fk = t.fk.get(j);
        if (fk && !esLlave) { c.fillStyle = fk === 'd' ? P.hier : P.acento; c.fillText('FK', t.x + 6, y); }
        else if (fk && esLlave) { c.fillStyle = P.hier; c.fillText('FK', t.x + 22, y); }
      });
    }
    c.fillStyle = P.texto;
    c.font = `400 11.5px ${MONO}`;
    porFila((t, j, col, y) => { if (col[3] !== 1) c.fillText(cortar(col[0], 24), t.x + 28, y); });
    c.font = `600 11.5px ${MONO}`;
    porFila((t, j, col, y) => { if (col[3] === 1) c.fillText(cortar(col[0], 24), t.x + (t.fk.has(j) ? 40 : 28), y); });
    if (conDesc) {
      c.fillStyle = P.suave; c.font = `10px ${SANS}`;
      porFila((t, j, col, y) => { if (col[1]) c.fillText(cortar(col[1], 26), t.x + 198, y); });
    }
    if (conTipo) {
      c.fillStyle = P.suave; c.font = `9.5px ${MONO}`; c.textAlign = 'right';
      porFila((t, j, col, y) => c.fillText(col[2], t.x + t.w - 8, y));
      c.textAlign = 'left';
    }
  }

  // pasada final: bordes
  if (sc >= 0.1) {
    for (const o of vis) {
      const { t } = o;
      c.globalAlpha = o.a;
      c.strokeStyle = o.esSel ? P.sel : (o.coincide ? P.dorado : o.vecina ? P.hier : P.borde);
      c.lineWidth = o.esSel ? px(3) : (o.coincide || o.vecina ? px(2.2) : px(1));
      c.strokeRect(t.x, t.y, t.w, t.h);
    }
  }
  c.globalAlpha = 1;
  c.textBaseline = 'alphabetic';
}

/** ¿Qué hay bajo el punto (wx, wy) del mundo? → {t, fila} (fila −1 = cabecera) o null. */
export function golpe(M, wx, wy) {
  for (const t of M.tablas) {
    if (wx >= t.x && wx <= t.x + t.w && wy >= t.y && wy <= t.y + t.h) {
      const fila = Math.floor((wy - t.y - HEAD) / ROW);
      return { t: t.i, fila: fila >= 0 && fila < t.c.length ? fila : -1 };
    }
  }
  return null;
}
