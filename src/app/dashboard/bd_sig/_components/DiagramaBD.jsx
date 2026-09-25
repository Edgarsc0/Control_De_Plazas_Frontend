'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Shape } from 'react-konva';
import {
  Search, X, Plus, Minus, Maximize2, ChevronUp, ChevronDown,
  PanelRightClose, PanelRightOpen, Key, GitBranch,
} from 'lucide-react';
import data from '../_data/esquema.json';
import { buildModel, buscar, limites, normalizar, HEAD, ROW } from '../_lib/modelo';
import { dibujar, golpe, PALETAS, COLOR_FAMILIA } from '../_lib/dibujo';

const ESCALA_MAX = 3;
const NOMBRE_FAMILIA = {
  SAT: 'SAT_ · institucionales', HRS: 'HRS_ · reclutamiento', JPM: 'JPM_ · perfiles y competencias',
  HR: 'HR_ · recursos humanos', OTRO: 'Otras (PeopleSoft base)',
};

export default function DiagramaBD() {
  const M = useMemo(() => buildModel(data), []);
  const contRef = useRef(null);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const miniRef = useRef(null);
  const inputRef = useRef(null);
  const estadoRef = useRef({});
  const animRef = useRef(0);
  const escalaMinRef = useRef(0.02);
  const pinchRef = useRef(null);

  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [oscuro, setOscuro] = useState(false);
  const [sel, setSel] = useState(-1);
  const [selFila, setSelFila] = useState(-1);
  const [query, setQuery] = useState('');
  const [colFoco, setColFoco] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [grupo, setGrupo] = useState('');
  const [mostrarD, setMostrarD] = useState(true);
  const [mostrarR, setMostrarR] = useState(true);
  const [soloSel, setSoloSel] = useState(false);
  const [panel, setPanel] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 900));
  const [zoom, setZoom] = useState(0);
  const [tick, setTick] = useState(0);
  const [tip, setTip] = useState(null);
  const [pos, setPos] = useState(0); // índice dentro de la lista de coincidencias

  /* ── tamaño del contenedor y tema ───────────────────────────────────────── */
  useEffect(() => {
    const el = contRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const leer = () => setOscuro(document.documentElement.classList.contains('dark'));
    leer();
    const mo = new MutationObserver(leer);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  const P = oscuro ? PALETAS.oscuro : PALETAS.claro;

  /* ── búsqueda y conjuntos derivados ────────────────────────────────────── */
  const busq = useMemo(() => buscar(M, query), [M, query]);
  const match = useMemo(() => {
    if (colFoco) return new Set(M.colIdx.get(colFoco) || []);
    return busq.coinciden && busq.coinciden.size ? busq.coinciden : null;
  }, [M, colFoco, busq]);
  const qFila = useMemo(() => {
    const n = normalizar(query).trim();
    return !colFoco && n.length >= 2 ? n : null;
  }, [query, colFoco]);
  const grupoSet = useMemo(
    () => (grupo ? new Set(M.tablas.filter((t) => t.g.includes(grupo)).map((t) => t.i)) : null),
    [M, grupo],
  );
  const vecinos = useMemo(() => {
    if (sel < 0) return null;
    const s = new Set();
    M.vec[sel].sal.forEach((k) => s.add(M.aristas[k].b));
    M.vec[sel].ent.forEach((k) => s.add(M.aristas[k].a));
    return s;
  }, [M, sel]);
  const lista = useMemo(
    () => (match ? [...match].sort((a, b) => M.tablas[a].x - M.tablas[b].x || M.tablas[a].y - M.tablas[b].y) : []),
    [M, match],
  );

  /* ── vista: sincronización, zoom y animación ───────────────────────────── */
  const redibujar = useCallback(() => layerRef.current?.batchDraw(), []);
  const sincronizar = useCallback(() => {
    const st = stageRef.current;
    if (!st) return;
    setZoom(Math.round(st.scaleX() * 100));
    setTick((n) => n + 1);
  }, []);

  const vistaA = useCallback((x, y, s, ms = 0) => {
    const st = stageRef.current;
    if (!st) return;
    cancelAnimationFrame(animRef.current);
    if (!ms) {
      st.scale({ x: s, y: s }); st.position({ x, y }); redibujar(); sincronizar();
      return;
    }
    const x0 = st.x(); const y0 = st.y(); const s0 = st.scaleX(); const t0 = performance.now();
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      // interpolación en el espacio del mundo para que el zoom no "salte"
      const sc = s0 + (s - s0) * e;
      st.scale({ x: sc, y: sc });
      st.position({ x: x0 + (x - x0) * e, y: y0 + (y - y0) * e });
      redibujar();
      if (k < 1) animRef.current = requestAnimationFrame(paso); else sincronizar();
    };
    animRef.current = requestAnimationFrame(paso);
  }, [redibujar, sincronizar]);

  const encuadrar = useCallback((r, margen = 60, ms = 450, maxEsc = 1) => {
    const { h } = tam;
    const w = panel && tam.w >= 640 ? tam.w - 380 : tam.w; // área libre (sin el panel)
    if (!w || !h) return;
    const s = Math.max(escalaMinRef.current, Math.min(maxEsc, (w - 2 * margen) / (r.x1 - r.x0), (h - 2 * margen) / (r.y1 - r.y0)));
    vistaA(w / 2 - ((r.x0 + r.x1) / 2) * s, h / 2 - ((r.y0 + r.y1) / 2) * s, s, ms);
  }, [tam, panel, vistaA]);

  const ajustarTodo = useCallback((ms = 450) => encuadrar({ x0: 0, y0: 0, x1: M.W, y1: M.H }, 24, ms, ESCALA_MAX), [M, encuadrar]);

  const irA = useCallback((i, fila = -1, ms = 450) => {
    const t = M.tablas[i];
    const { w, h } = tam;
    if (!w) return;
    const s = Math.min(1.1, Math.max(0.9, (w * 0.5) / t.w));
    const yFila = fila >= 0 ? t.y + HEAD + fila * ROW : t.y;
    // tablas altas: se alinea la cabecera (o la fila pedida) arriba; las bajas se centran
    const y = t.h * s < h * 0.85 && fila < 0 ? h / 2 - (t.y + t.h / 2) * s : h * 0.32 - yFila * s;
    const cx = panel && w >= 640 ? (w - 380) / 2 : w / 2;
    vistaA(cx - (t.x + t.w / 2) * s, y, s, ms);
  }, [M, tam, panel, vistaA]);

  // vista inicial: todo el mapa
  const inicializado = useRef(false);
  useEffect(() => {
    if (inicializado.current || !tam.w || !tam.h) return;
    inicializado.current = true;
    const fit = Math.min((panel && tam.w >= 640 ? tam.w - 380 : tam.w) / M.W, tam.h / M.H);
    escalaMinRef.current = fit * 0.6;
    ajustarTodo(0);
  }, [tam, M, panel, ajustarTodo]);

  /* ── estado de dibujo → Konva ──────────────────────────────────────────── */
  useEffect(() => {
    estadoRef.current = {
      ...estadoRef.current, sel, selFila, match, qFila, colFoco, grupoSet, vecinos,
      mostrarD, mostrarR, soloSel, atenuarNoVecinas: false,
    };
    redibujar();
  }, [sel, selFila, match, qFila, colFoco, grupoSet, vecinos, mostrarD, mostrarR, soloSel, oscuro, tam, redibujar]);

  const sceneFunc = useCallback((ctx) => {
    const st = stageRef.current;
    if (!st) return;
    const sc = st.scaleX();
    const v = { x0: -st.x() / sc, y0: -st.y() / sc, x1: (-st.x() + st.width()) / sc, y1: (-st.y() + st.height()) / sc };
    dibujar(ctx._context, M, v, sc, estadoRef.current, oscuro ? PALETAS.oscuro : PALETAS.claro);
  }, [M, oscuro]);

  /* ── interacción ───────────────────────────────────────────────────────── */
  const aMundo = (st, p) => ({ x: (p.x - st.x()) / st.scaleX(), y: (p.y - st.y()) / st.scaleX() });

  const alRueda = (e) => {
    e.evt.preventDefault();
    const st = stageRef.current;
    const p = st.getPointerPosition();
    const s0 = st.scaleX();
    const s1 = Math.min(ESCALA_MAX, Math.max(escalaMinRef.current, s0 * Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0016))));
    const w = aMundo(st, p);
    cancelAnimationFrame(animRef.current);
    st.scale({ x: s1, y: s1 });
    st.position({ x: p.x - w.x * s1, y: p.y - w.y * s1 });
    redibujar(); sincronizar();
  };

  const alMover = () => {
    const st = stageRef.current;
    if (!st || st.isDragging()) return;
    const p = st.getPointerPosition();
    if (!p) return;
    const w = aMundo(st, p);
    const h = golpe(M, w.x, w.y);
    const ant = estadoRef.current.hover;
    const nuevo = h ? { t: h.t, fila: h.fila } : null;
    if ((ant?.t ?? -1) === (nuevo?.t ?? -1) && (ant?.fila ?? -2) === (nuevo?.fila ?? -2)) {
      if (tip && h) setTip((x) => (x ? { ...x, x: p.x, y: p.y } : x));
      return;
    }
    estadoRef.current.hover = nuevo;
    redibujar();
    if (!h) { setTip(null); return; }
    const t = M.tablas[h.t];
    if (h.fila >= 0) {
      const c = t.c[h.fila];
      setTip({
        x: p.x, y: p.y, titulo: `${t.n}.${c[0]}`,
        texto: [c[1], `Tipo: ${c[2]}${c[3] ? ' · llave' : ''}`, c[5] && c[5] !== c[1] ? `Cabecera: ${c[5]}` : ''].filter(Boolean).join('\n'),
      });
    } else {
      setTip({ x: p.x, y: p.y, titulo: t.n, texto: `${t.d || 'Sin descripción en PeopleSoft'}\n${t.c.length} columnas · ${t.k.length} llave(s)` });
    }
  };

  const elegir = useCallback((i, fila = -1) => { setSel(i); setSelFila(fila); }, []);
  const alClic = () => {
    const st = stageRef.current;
    const p = st.getPointerPosition();
    if (!p) return;
    const w = aMundo(st, p);
    const h = golpe(M, w.x, w.y);
    if (h) { elegir(h.t, h.fila); setPanel(true); } else { setSel(-1); setSelFila(-1); }
  };
  const alDoble = () => {
    const st = stageRef.current;
    const p = st.getPointerPosition();
    const h = p && golpe(M, aMundo(st, p).x, aMundo(st, p).y);
    if (h) irA(h.t, h.fila);
  };

  // pellizco en pantallas táctiles
  const alTocar = (e) => {
    const t = e.evt.touches;
    const st = stageRef.current;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    st.stopDrag();
    const r = st.container().getBoundingClientRect();
    const a = { x: t[0].clientX - r.left, y: t[0].clientY - r.top };
    const b = { x: t[1].clientX - r.left, y: t[1].clientY - r.top };
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (!pinchRef.current) { pinchRef.current = { d, s: st.scaleX(), w: aMundo(st, c) }; return; }
    const s1 = Math.min(ESCALA_MAX, Math.max(escalaMinRef.current, pinchRef.current.s * (d / pinchRef.current.d)));
    st.scale({ x: s1, y: s1 });
    st.position({ x: c.x - pinchRef.current.w.x * s1, y: c.y - pinchRef.current.w.y * s1 });
    redibujar(); sincronizar();
  };

  const zoomBoton = (f) => {
    const st = stageRef.current;
    const c = { x: tam.w / 2, y: tam.h / 2 };
    const w = aMundo(st, c);
    const s1 = Math.min(ESCALA_MAX, Math.max(escalaMinRef.current, st.scaleX() * f));
    vistaA(c.x - w.x * s1, c.y - w.y * s1, s1, 160);
  };

  /* ── buscador ──────────────────────────────────────────────────────────── */
  const limpiarBusqueda = () => { setQuery(''); setColFoco(null); setPos(0); };
  const elegirTabla = (i) => { limpiarBusqueda(); setAbierto(false); elegir(i); setPanel(true); irA(i); };
  const elegirColumna = (campo) => {
    setColFoco(campo); setQuery(campo); setAbierto(false); setPos(0);
    const ids = M.colIdx.get(campo) || [];
    if (ids.length === 1) { elegir(ids[0], M.tablas[ids[0]].filaDe.get(campo)); irA(ids[0], M.tablas[ids[0]].filaDe.get(campo)); }
    else if (ids.length) encuadrar(limites(M, ids), 40, 500, 0.5);
  };
  const saltar = (d) => {
    if (!lista.length) return;
    const k = (pos + d + lista.length) % lista.length;
    setPos(k);
    const i = lista[k];
    const fila = colFoco ? M.tablas[i].filaDe.get(colFoco) ?? -1 : -1;
    elegir(i, fila); irA(i, fila);
  };
  const alTeclaBusqueda = (e) => {
    if (e.key === 'Escape') { limpiarBusqueda(); setAbierto(false); e.currentTarget.blur(); }
    if (e.key === 'Enter') {
      if (busq.tablas[0] != null && (busq.columnas.length === 0 || busq.tablas.some((i) => M.tablas[i].bN === normalizar(query).trim()))) elegirTabla(busq.tablas[0]);
      else if (busq.columnas[0]) elegirColumna(busq.columnas[0].campo);
      else if (busq.tablas[0] != null) elegirTabla(busq.tablas[0]);
    }
  };
  useEffect(() => {
    const f = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  /* ── minimapa ──────────────────────────────────────────────────────────── */
  const MINI_W = 208;
  const MINI_H = Math.round((MINI_W * M.H) / M.W);
  useEffect(() => {
    const cv = miniRef.current; const st = stageRef.current;
    if (!cv || !st) return;
    const c = cv.getContext('2d');
    const k = MINI_W / M.W;
    c.clearRect(0, 0, MINI_W, MINI_H);
    c.fillStyle = P.mesa; c.fillRect(0, 0, MINI_W, MINI_H);
    for (const t of M.tablas) {
      const act = (!match || match.has(t.i)) && (!grupoSet || grupoSet.has(t.i));
      c.globalAlpha = act ? 1 : 0.2;
      c.fillStyle = t.i === sel ? P.sel : COLOR_FAMILIA[t.fam];
      c.fillRect(t.x * k, t.y * k, Math.max(1.5, t.w * k), Math.max(1, t.h * k));
    }
    c.globalAlpha = 1;
    const s = st.scaleX();
    c.strokeStyle = P.dorado; c.lineWidth = 1.5;
    c.strokeRect((-st.x() / s) * k, (-st.y() / s) * k, (st.width() / s) * k, (st.height() / s) * k);
  }, [M, tick, sel, match, grupoSet, P, MINI_H]);
  const alMinimapa = (e) => {
    if (e.type === 'pointermove' && e.buttons !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / MINI_W) * M.W; const wy = ((e.clientY - r.top) / MINI_H) * M.H;
    const st = stageRef.current; const s = st.scaleX();
    vistaA(tam.w / 2 - wx * s, tam.h / 2 - wy * s, s, 0);
  };

  /* ── datos del panel ───────────────────────────────────────────────────── */
  const T = sel >= 0 ? M.tablas[sel] : null;
  const rel = useMemo(() => {
    if (!T) return null;
    const desc = (k) => { const e = M.aristas[k]; return { k, e }; };
    return {
      detalleDe: M.vec[sel].sal.map(desc).filter(({ e }) => e.tp === 'd'),
      refA: M.vec[sel].sal.map(desc).filter(({ e }) => e.tp === 'r'),
      tieneDetalles: M.vec[sel].ent.map(desc).filter(({ e }) => e.tp === 'd'),
      refPor: M.vec[sel].ent.map(desc).filter(({ e }) => e.tp === 'r'),
    };
  }, [M, T, sel]);
  const colSel = T && selFila >= 0 ? T.c[selFila] : null;

  const conteoFam = useMemo(() => {
    const o = {}; M.tablas.forEach((t) => { o[t.fam] = (o[t.fam] || 0) + 1; }); return o;
  }, [M]);

  const cajaBase = 'bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg';

  return (
    <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex flex-col">
      <div
        ref={contRef}
        className="relative flex-1 min-h-0 overflow-hidden select-none touch-none"
        style={{ background: P.fondo }}
      >
        {tam.w > 0 && (
          <Stage
            ref={stageRef}
            width={tam.w}
            height={tam.h}
            draggable
            onWheel={alRueda}
            onMouseMove={alMover}
            onMouseLeave={() => { estadoRef.current.hover = null; setTip(null); redibujar(); }}
            onClick={alClic}
            onTap={alClic}
            onDblClick={alDoble}
            onDblTap={alDoble}
            onDragMove={sincronizar}
            onDragEnd={sincronizar}
            onTouchMove={alTocar}
            onTouchEnd={() => { pinchRef.current = null; }}
          >
            <Layer ref={layerRef} listening={false}>
              <Shape sceneFunc={sceneFunc} />
            </Layer>
          </Stage>
        )}

        {/* buscador */}
        <div className="absolute top-3 left-3 z-20 w-[min(420px,calc(100%-4.75rem))]">
          <div className={`${cajaBase} rounded-xl flex items-center gap-2 px-3 h-11`}>
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setColFoco(null); setAbierto(true); setPos(0); }}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 150)}
              onKeyDown={alTeclaBusqueda}
              placeholder="Buscar tabla, columna o descripción  ( / )"
              aria-label="Buscar en el diagrama"
              className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 min-w-0"
            />
            {query && (
              <button type="button" onClick={limpiarBusqueda} aria-label="Limpiar búsqueda" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="size-4" />
              </button>
            )}
          </div>
          {match && query && (
            <div className={`${cajaBase} rounded-lg mt-1.5 px-3 py-1.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300`}>
              <span className="font-semibold tabular-nums">{lista.length}</span> tabla{lista.length === 1 ? '' : 's'}
              {colFoco && <span className="font-mono text-[11px] px-1.5 rounded bg-amber-200/70 dark:bg-amber-400/25">{colFoco}</span>}
              <span className="flex-1" />
              <button type="button" onClick={() => saltar(-1)} aria-label="Coincidencia anterior" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronUp className="size-4" /></button>
              <span className="tabular-nums w-14 text-center">{lista.length ? `${pos + 1} / ${lista.length}` : '—'}</span>
              <button type="button" onClick={() => saltar(1)} aria-label="Coincidencia siguiente" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronDown className="size-4" /></button>
            </div>
          )}
          {abierto && query.trim().length >= 2 && (busq.tablas.length > 0 || busq.columnas.length > 0) && (
            <div className={`${cajaBase} rounded-xl mt-1.5 max-h-[60vh] overflow-y-auto py-1`} role="listbox">
              {busq.tablas.length > 0 && <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">Tablas ({busq.tablas.length})</p>}
              {busq.tablas.slice(0, 8).map((i) => (
                <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegirTabla(i)}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-baseline gap-2">
                  <span className="size-2 rounded-full shrink-0 self-center" style={{ background: COLOR_FAMILIA[M.tablas[i].fam] }} />
                  <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{M.tablas[i].n}</span>
                  <span className="text-[11px] text-slate-500 truncate">{M.tablas[i].d}</span>
                </button>
              ))}
              {busq.columnas.length > 0 && <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">Columnas ({busq.columnas.length})</p>}
              {busq.columnas.slice(0, 8).map((c) => (
                <button key={c.campo} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegirColumna(c.campo)}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-baseline gap-2">
                  <span className="font-mono text-xs text-slate-800 dark:text-slate-100">{c.campo}</span>
                  <span className="text-[11px] text-slate-500">en {c.n} tabla{c.n === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* controles de zoom */}
        <div className={`${cajaBase} absolute bottom-3 left-3 z-20 rounded-xl flex items-center overflow-hidden`}>
          <button type="button" onClick={() => zoomBoton(1 / 1.35)} aria-label="Alejar" className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><Minus className="size-4" /></button>
          <span className="w-14 text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{zoom}%</span>
          <button type="button" onClick={() => zoomBoton(1.35)} aria-label="Acercar" className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="size-4" /></button>
          <button type="button" onClick={() => ajustarTodo()} aria-label="Ver todo el diagrama" title="Ver todo" className="p-2.5 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="size-4" /></button>
        </div>

        {/* minimapa */}
        <div className={`${cajaBase} absolute bottom-3 z-20 rounded-lg p-1 hidden sm:block`} style={{ right: panel && T ? 400 : panel ? 400 : 12 }}>
          <canvas ref={miniRef} width={MINI_W} height={MINI_H} onPointerDown={alMinimapa} onPointerMove={alMinimapa} className="block cursor-crosshair rounded" style={{ width: MINI_W, height: MINI_H }} aria-label="Minimapa del diagrama" />
        </div>

        {/* tooltip */}
        {tip && (
          <div className="absolute z-30 pointer-events-none max-w-[320px] rounded-lg px-3 py-2 text-xs shadow-xl bg-slate-900 text-slate-100 border border-slate-700"
            style={{ left: Math.min(tip.x + 14, tam.w - 336), top: Math.min(tip.y + 16, tam.h - 90) }}>
            <p className="font-mono font-bold text-[11px] text-amber-300 break-all">{tip.titulo}</p>
            <p className="whitespace-pre-line text-slate-200 mt-0.5">{tip.texto}</p>
          </div>
        )}

        {/* botón del panel */}
        <button type="button" onClick={() => setPanel((p) => !p)} aria-label={panel ? 'Ocultar panel' : 'Mostrar panel'}
          className={`${cajaBase} absolute top-3 z-30 rounded-xl p-2.5`} style={{ right: panel ? 392 : 12 }}>
          {panel ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </button>

        {/* panel de detalle */}
        {panel && (
          <aside className={`${cajaBase} absolute z-20 right-0 top-0 bottom-0 w-full sm:w-[380px] sm:border-y-0 sm:border-r-0 overflow-y-auto`} aria-label="Detalle">
            <div className="p-4 flex flex-col gap-4 text-sm text-slate-700 dark:text-slate-200">
              {T ? (
                <>
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 size-2.5 rounded-full shrink-0" style={{ background: COLOR_FAMILIA[T.fam] }} />
                      <h2 className="font-mono font-bold text-base break-all leading-tight">{T.n}</h2>
                      {T.v === 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 mt-0.5">VISTA</span>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{T.d || 'Sin descripción en PeopleSoft'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{T.c.length} columnas · {T.k.length} llave{T.k.length === 1 ? '' : 's'} · SQL: <span className="font-mono">PS_{T.n}</span></p>
                  </div>
                  {T.k.length > 0 && (
                    <Seccion titulo="Llave" icono={<Key className="size-3.5" />}>
                      <div className="flex flex-wrap gap-1.5">{T.k.map((k) => <span key={k} className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">{k}</span>)}</div>
                    </Seccion>
                  )}
                  {T.g.length > 0 && (
                    <Seccion titulo={`Grupos de acceso (${T.g.length})`}>
                      <div className="flex flex-wrap gap-1.5">{T.g.map((g) => <button key={g} type="button" onClick={() => setGrupo(g)} className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">{g}</button>)}</div>
                    </Seccion>
                  )}
                  {colSel && (
                    <Seccion titulo="Columna seleccionada">
                      <div className="rounded-lg border border-amber-400/60 bg-amber-100/50 dark:bg-amber-400/10 p-2.5 text-xs flex flex-col gap-1">
                        <span className="font-mono font-bold text-sm">{colSel[0]}</span>
                        <span>{colSel[1] || 'Sin descripción'}</span>
                        <span className="text-slate-500">Tipo <b className="font-mono">{colSel[2]}</b>{colSel[3] ? ' · llave' : ''}{colSel[4] ? ` · traducible (${colSel[4]})` : ''}</span>
                        {colSel[5] && colSel[5] !== colSel[1] && <span className="text-slate-500">Cabecera: {colSel[5]}</span>}
                        <button type="button" onClick={() => elegirColumna(colSel[0])} className="self-start mt-1 text-[11px] font-semibold underline underline-offset-2">Ver en las {M.colIdx.get(colSel[0]).length} tablas que la usan</button>
                      </div>
                    </Seccion>
                  )}
                  {[
                    ['Es detalle de', rel.detalleDe, 'sal'], ['Referencia a', rel.refA, 'sal'],
                    ['Tiene detalles', rel.tieneDetalles, 'ent'], ['Referenciada por', rel.refPor, 'ent'],
                  ].map(([tit, arr, lado]) => arr.length > 0 && (
                    <Seccion key={tit} titulo={`${tit} (${arr.length})`} icono={<GitBranch className="size-3.5" />}>
                      <ul className="flex flex-col gap-1">
                        {arr.slice(0, 40).map(({ k, e }) => {
                          const otra = M.tablas[lado === 'sal' ? e.b : e.a];
                          const propia = lado === 'sal' ? e.af : e.bf; const ajena = lado === 'sal' ? e.bf : e.af;
                          return (
                            <li key={k}>
                              <button type="button" onClick={() => { elegir(otra.i, lado === 'sal' ? e.bi : e.ai); irA(otra.i, lado === 'sal' ? e.bi : e.ai); }}
                                className="w-full text-left rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="font-mono text-xs font-semibold">{otra.n}</span>
                                <span className="block font-mono text-[10.5px] text-slate-500">{propia}{propia !== ajena ? ` → ${ajena}` : ''}</span>
                              </button>
                            </li>
                          );
                        })}
                        {arr.length > 40 && <li className="text-[11px] text-slate-500 px-2">y {arr.length - 40} más</li>}
                      </ul>
                    </Seccion>
                  ))}
                  {rel.detalleDe.length + rel.refA.length + rel.tieneDetalles.length + rel.refPor.length === 0 && (
                    <p className="text-xs text-slate-500">Sin relaciones deducibles (no tiene llave definida o ninguna otra tabla la comparte).</p>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <h2 className="font-bold text-base">BD del SIG · catálogo PeopleSoft</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {M.tablas.length} tablas · {M.tablas.reduce((s, t) => s + t.c.length, 0).toLocaleString('es-MX')} columnas · {M.aristas.length} relaciones deducidas. Clic en una tabla o columna para ver su detalle; doble clic para acercarte.
                    </p>
                  </div>
                  <Seccion titulo="Familias">
                    <ul className="flex flex-col gap-1">
                      {Object.entries(NOMBRE_FAMILIA).map(([f, n]) => (
                        <li key={f} className="flex items-center gap-2 text-xs"><span className="size-3 rounded" style={{ background: COLOR_FAMILIA[f] }} /><span>{n}</span><span className="flex-1" /><span className="tabular-nums text-slate-500">{conteoFam[f] || 0}</span></li>
                      ))}
                    </ul>
                  </Seccion>
                  <Seccion titulo="Leyenda">
                    <ul className="flex flex-col gap-1.5 text-xs">
                      <li className="flex items-center gap-2"><span className="w-7 border-t-2" style={{ borderColor: P.hier }} />Detalle de (la llave contiene la de otra tabla)</li>
                      <li className="flex items-center gap-2"><span className="w-7 border-t-2 border-dashed" style={{ borderColor: P.acento }} />Referencia (campo que es llave de otra tabla)</li>
                      <li className="flex items-center gap-2"><b className="w-7 text-[10px]" style={{ color: P.acento }}>PK</b>Columna de la llave</li>
                      <li className="flex items-center gap-2"><b className="w-7 text-[10px]" style={{ color: P.hier }}>FK</b>Columna que apunta a otra tabla</li>
                    </ul>
                  </Seccion>
                </>
              )}
              <Seccion titulo="Filtros y vista">
                <div className="flex flex-col gap-2 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mostrarD} onChange={(e) => setMostrarD(e.target.checked)} />Relaciones de detalle</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={mostrarR} onChange={(e) => setMostrarR(e.target.checked)} />Relaciones de referencia</label>
                  <label className={`flex items-center gap-2 ${T ? '' : 'opacity-50'}`}><input type="checkbox" disabled={!T} checked={soloSel} onChange={(e) => setSoloSel(e.target.checked)} />Solo relaciones de la tabla seleccionada</label>
                  <label className="flex flex-col gap-1">Grupo de acceso
                    <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 font-mono text-[11px]">
                      <option value="">Todos ({M.tablas.length} tablas)</option>
                      {M.grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                </div>
              </Seccion>
              <p className="text-[10.5px] text-slate-400">Datos: {M.generado?.slice(0, 10)} · Relaciones deducidas de las llaves; PeopleSoft no declara llaves foráneas.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Seccion({ titulo, icono, children }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1.5">{icono}{titulo}</h3>
      {children}
    </section>
  );
}
