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

export function dibujar(c, M, v, sc, E, P) {
  const { tablas, aristas } = M;
  const px = (n) => n / sc; // píxeles de pantalla → mundo

  // ── rejilla de puntos ────────────────────────────────────────────────────
  if (sc >= 0.12) {
    const paso = 100;
    c.fillStyle = P.punto;
    const r = Math.max(1.2, px(1.4));
    for (let x = Math.floor(v.x0 / paso) * paso; x < v.x1; x += paso) {
      for (let y = Math.floor(v.y0 / paso) * paso; y < v.y1; y += paso) c.fillRect(x, y, r, r);
    }
  }

  const visible = (t) => t.x < v.x1 && t.x + t.w > v.x0 && t.y < v.y1 && t.y + t.h > v.y0;
  const enSel = (k) => E.sel >= 0 && (aristas[k].a === E.sel || aristas[k].b === E.sel);

  // ── aristas ──────────────────────────────────────────────────────────────
  c.lineCap = 'round';
  const haySel = E.sel >= 0;
  for (let k = 0; k < aristas.length; k++) {
    const e = aristas[k];
    if (e.tp === 'd' ? !E.mostrarD : !E.mostrarR) continue;
    const propia = enSel(k);
    if (E.soloSel && !propia) continue;
    const A = tablas[e.a]; const B = tablas[e.b];
    // recorte por caja envolvente de la arista
    const bx0 = Math.min(A.x, B.x); const bx1 = Math.max(A.x + A.w, B.x + B.w);
    const by0 = Math.min(A.y, B.y); const by1 = Math.max(A.y + A.h, B.y + B.h);
    if (bx0 > v.x1 || bx1 < v.x0 || by0 > v.y1 || by1 < v.y0) continue;
    const g = geometria(A, B, e);
    c.beginPath();
    c.moveTo(g.p0.x, g.p0.y);
    c.bezierCurveTo(g.c0.x, g.c0.y, g.c1.x, g.c1.y, g.p1.x, g.p1.y);
    c.strokeStyle = e.tp === 'd' ? P.hier : P.acento;
    c.setLineDash(e.tp === 'r' ? [px(7), px(5)] : []);
    if (propia) { c.globalAlpha = 0.95; c.lineWidth = px(2.4); }
    else { c.globalAlpha = haySel ? 0.05 : (e.tp === 'd' ? 0.3 : 0.2); c.lineWidth = px(1.2); }
    c.stroke();
    if (propia) {
      c.setLineDash([]);
      c.fillStyle = c.strokeStyle;
      c.beginPath(); c.arc(g.p0.x, g.p0.y, px(4), 0, 6.283); c.fill();
      // flecha en el destino
      const dir = g.lb === 'l' ? 1 : -1; const s = px(9);
      c.beginPath();
      c.moveTo(g.p1.x, g.p1.y);
      c.lineTo(g.p1.x - dir * s, g.p1.y - s * 0.55);
      c.lineTo(g.p1.x - dir * s, g.p1.y + s * 0.55);
      c.closePath(); c.fill();
    }
  }
  c.setLineDash([]);
  c.globalAlpha = 1;

  // ── tablas ───────────────────────────────────────────────────────────────
  const conDesc = sc >= 0.8;
  const conTipo = sc >= 0.55;
  for (const t of tablas) {
    if (!visible(t)) continue;
    const esSel = t.i === E.sel;
    const vecina = E.vecinos && E.vecinos.has(t.i);
    let activa = true;
    if (E.match && !E.match.has(t.i)) activa = false;
    if (E.grupoSet && !E.grupoSet.has(t.i)) activa = false;
    if (E.sel >= 0 && !esSel && !vecina) activa = activa && E.atenuarNoVecinas ? false : activa;
    c.globalAlpha = activa ? 1 : 0.22;
    const color = COLOR_FAMILIA[t.fam];
    const coincide = E.match && E.match.has(t.i);

    if (sc < 0.1) {
      c.fillStyle = color; c.fillRect(t.x, t.y, t.w, t.h);
      if (esSel || coincide) { c.strokeStyle = esSel ? P.sel : P.dorado; c.lineWidth = px(3); c.strokeRect(t.x, t.y, t.w, t.h); }
      continue;
    }

    // cuerpo
    c.shadowColor = P.sombra; c.shadowBlur = sc >= 0.35 ? px(8) : 0; c.shadowOffsetY = px(2);
    c.fillStyle = P.mesa; c.fillRect(t.x, t.y, t.w, t.h);
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;

    if (sc < 0.35) {
      c.fillStyle = color; c.fillRect(t.x, t.y, t.w, Math.min(t.h, Math.max(HEAD, px(26))));
      const fs = Math.min(px(13), (t.w * 0.94) / (t.n.length * 0.6));
      c.fillStyle = '#fff'; c.font = `600 ${fs}px ${MONO}`; c.textBaseline = 'middle';
      c.fillText(t.n, t.x + t.w * 0.03, t.y + Math.max(HEAD, px(26)) / 2);
    } else {
      // cabecera
      c.fillStyle = color; c.fillRect(t.x, t.y, t.w, HEAD);
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff'; c.font = `700 14px ${MONO}`;
      c.fillText(cortar(t.n, t.v ? 26 : 34), t.x + 12, t.y + 20);
      if (t.v) {
        c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(t.x + t.w - 52, t.y + 8, 42, 16);
        c.fillStyle = '#fff'; c.font = `700 9px ${SANS}`; c.fillText('VISTA', t.x + t.w - 46, t.y + 19.5);
      }
      c.fillStyle = 'rgba(255,255,255,0.86)'; c.font = `11px ${SANS}`;
      c.fillText(cortar(t.d || 'Sin descripción en PeopleSoft', 58), t.x + 12, t.y + 36);
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = `10px ${SANS}`; c.textAlign = 'right';
      c.fillText(`${t.c.length} col.`, t.x + t.w - 10, t.y + 44);
      c.textAlign = 'left';

      // columnas (solo las visibles)
      const i0 = Math.max(0, Math.floor((v.y0 - t.y - HEAD) / ROW));
      const i1 = Math.min(t.c.length - 1, Math.ceil((v.y1 - t.y - HEAD) / ROW));
      c.textBaseline = 'middle';
      for (let j = i0; j <= i1; j++) {
        const col = t.c[j];
        const ry = t.y + HEAD + j * ROW;
        const esLlave = col[3] === 1;
        if (esLlave) { c.fillStyle = P.llave; c.fillRect(t.x, ry, t.w, ROW); }
        else if (j % 2) { c.fillStyle = P.fila; c.fillRect(t.x, ry, t.w, ROW); }
        const foco = (E.colFoco && col[0] === E.colFoco) || (E.qFila && t.cN[j].includes(E.qFila));
        if (foco) { c.fillStyle = P.resalta; c.fillRect(t.x, ry, t.w, ROW); }
        if (esSel && E.selFila === j) {
          c.fillStyle = P.resalta; c.fillRect(t.x, ry, t.w, ROW);
          c.strokeStyle = P.sel; c.lineWidth = px(1.5); c.strokeRect(t.x + 1, ry + 0.5, t.w - 2, ROW - 1);
        }
        if (E.hover && E.hover.t === t.i && E.hover.fila === j) {
          c.fillStyle = 'rgba(148,163,184,0.25)'; c.fillRect(t.x, ry, t.w, ROW);
        }
        // marca PK / FK
        c.font = `700 8.5px ${SANS}`;
        if (esLlave) { c.fillStyle = P.acento; c.fillText('PK', t.x + 6, ry + ROW / 2 + 0.5); }
        const fk = t.fk.get(j);
        if (fk && !esLlave) { c.fillStyle = fk === 'd' ? P.hier : P.acento; c.fillText('FK', t.x + 6, ry + ROW / 2 + 0.5); }
        else if (fk && esLlave) { c.fillStyle = P.hier; c.fillText('FK', t.x + 22, ry + ROW / 2 + 0.5); }
        // nombre
        c.fillStyle = P.texto; c.font = `${esLlave ? 600 : 400} 11.5px ${MONO}`;
        c.fillText(cortar(col[0], 24), t.x + (esLlave && fk ? 40 : 28), ry + ROW / 2 + 0.5);
        if (conDesc && col[1]) {
          c.fillStyle = P.suave; c.font = `10px ${SANS}`;
          c.fillText(cortar(col[1], 26), t.x + 198, ry + ROW / 2 + 0.5);
        }
        if (conTipo) {
          c.fillStyle = P.suave; c.font = `9.5px ${MONO}`; c.textAlign = 'right';
          c.fillText(col[2], t.x + t.w - 8, ry + ROW / 2 + 0.5);
          c.textAlign = 'left';
        }
      }
    }
    // borde
    c.strokeStyle = esSel ? P.sel : (coincide ? P.dorado : vecina ? P.hier : P.borde);
    c.lineWidth = esSel ? px(3) : (coincide || vecina ? px(2.2) : px(1));
    c.strokeRect(t.x, t.y, t.w, t.h);
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
