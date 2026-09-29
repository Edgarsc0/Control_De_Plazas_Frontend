"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, RefreshCw, Trash2, Check, X, Loader2 } from "lucide-react";
import { MemoriasColumnasService } from "@/services/memoriasColumnas.service";

const SLOTS = [1, 2, 3];

/**
 * Hasta 3 "memorias" de columnas visibles por tabla (guardadas en el servidor por usuario, así
 * que siguen al usuario en cualquier equipo). Clic en una memoria = mostrar exactamente sus
 * columnas y ocultar las demás.
 *
 * Restricción de columnas del rol: `columns` ya llega recortado por la tabla (Plantilla Detalle
 * quita las columnas fuera de RolColumnScope antes de pasarlas al modal), así que solo se pueden
 * guardar columnas permitidas; el backend vuelve a recortar al guardar. Al aplicar, las claves de
 * una memoria que ya no existan (o que el rol dejó de permitir) simplemente se ignoran.
 */
export default function MemoriasColumnas({ tabla, columns, onApply }) {
  const [memorias, setMemorias] = useState({}); // slot -> {slot, nombre, columnas}
  const [cargando, setCargando] = useState(true);
  const [guardandoSlot, setGuardandoSlot] = useState(null);
  const [nombrando, setNombrando] = useState(null); // slot en el que se escribe el nombre
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState(null);
  // Móvil: la sección es una sola fila con 3 círculos numerados; el tocado muestra debajo su
  // nombre y sus acciones (sobrescribir / borrar).
  const [slotMovil, setSlotMovil] = useState(null);

  useEffect(() => {
    let activo = true;
    MemoriasColumnasService.listar(tabla)
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => { if (activo) setMemorias(Object.fromEntries((Array.isArray(lista) ? lista : []).map((m) => [m.slot, m]))); })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tabla]);

  const clavesDisponibles = new Set(columns.map((c) => c.key));
  const visiblesActuales = columns.filter((c) => c.visible).map((c) => c.key);
  const aplicables = (m) => (m?.columnas || []).filter((k) => clavesDisponibles.has(k));
  const esActiva = (m) => {
    const a = aplicables(m);
    return a.length > 0 && a.length === visiblesActuales.length && a.every((k) => visiblesActuales.includes(k));
  };

  const guardar = useCallback(async (slot, nombreMemoria) => {
    if (!visiblesActuales.length) return;
    setGuardandoSlot(slot);
    setError(null);
    try {
      const r = await MemoriasColumnasService.guardar(tabla, slot, nombreMemoria, visiblesActuales);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "No se pudo guardar la memoria.");
      setMemorias((prev) => ({ ...prev, [slot]: d }));
      setNombrando(null);
      setNombre("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoSlot(null);
    }
  }, [tabla, visiblesActuales]);

  const borrar = async (slot) => {
    setGuardandoSlot(slot);
    setError(null);
    try {
      const r = await MemoriasColumnasService.borrar(tabla, slot);
      if (!r.ok && r.status !== 204) throw new Error("No se pudo borrar la memoria.");
      setMemorias((prev) => { const n = { ...prev }; delete n[slot]; return n; });
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoSlot(null);
    }
  };

  const tocarSlotMovil = (slot) => {
    const m = memorias[slot];
    setError(null);
    if (!m) { setSlotMovil(slot); setNombrando(slot); setNombre(""); return; }
    setNombrando(null);
    setSlotMovil(slot);
    if (aplicables(m).length) onApply(aplicables(m));
  };
  const mSel = slotMovil ? memorias[slotMovil] : null;

  return (
    <>
    {/* ---- Móvil: compacto ---- */}
    <div className="sm:hidden mt-3">
      <div className="flex items-center gap-2">
        <Bookmark className="size-3.5 text-[#621f32] dark:text-[#bc955c] shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mr-auto">Memorias</span>
        {cargando && <Loader2 className="size-3 animate-spin text-slate-400" />}
        {SLOTS.map((slot) => {
          const m = memorias[slot];
          const activa = m && esActiva(m);
          const sel = slotMovil === slot;
          return (
            <button
              key={slot}
              type="button"
              disabled={cargando}
              onClick={() => tocarSlotMovil(slot)}
              aria-label={m ? `Memoria ${slot}: ${m.nombre || `Memoria ${slot}`}` : `Guardar vista actual en la memoria ${slot}`}
              className={`size-9 rounded-full text-xs font-black flex items-center justify-center border-2 transition-colors cursor-pointer disabled:opacity-50 ${
                activa
                  ? "bg-[#621f32] border-[#621f32] text-white dark:bg-[#bc955c] dark:border-[#bc955c] dark:text-[#3e131f]"
                  : m
                    ? `bg-white dark:bg-slate-900 text-[#621f32] dark:text-[#bc955c] ${sel ? "border-[#621f32] dark:border-[#bc955c]" : "border-[#621f32]/40 dark:border-[#bc955c]/40"}`
                    : `border-dashed text-slate-400 ${sel ? "border-[#621f32]/60" : "border-slate-300 dark:border-slate-600"}`
              }`}
            >
              {m ? slot : <BookmarkPlus className="size-3.5" />}
            </button>
          );
        })}
      </div>
      {slotMovil && nombrando === slotMovil && (
        <form
          onSubmit={(e) => { e.preventDefault(); guardar(slotMovil, nombre.trim() || `Memoria ${slotMovil}`); }}
          className="mt-2 flex items-center gap-1 rounded-xl border-2 border-[#621f32]/40 dark:border-[#bc955c]/40 bg-white dark:bg-slate-950 px-2 py-1"
        >
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            placeholder={`Nombre de la memoria ${slotMovil}`}
            aria-label="Nombre de la memoria"
            className="flex-1 min-w-0 bg-transparent text-xs font-bold outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
          />
          <button type="submit" disabled={guardandoSlot === slotMovil} title="Guardar vista actual" className="p-1.5 rounded-lg text-emerald-600 cursor-pointer">
            {guardandoSlot === slotMovil ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
          <button type="button" onClick={() => { setNombrando(null); setSlotMovil(null); }} title="Cancelar" className="p-1.5 rounded-lg text-slate-400 cursor-pointer"><X className="size-4" /></button>
        </form>
      )}
      {mSel && nombrando !== slotMovil && (
        <div className="mt-2 flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 pl-3 pr-1 py-1">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black text-[#621f32] dark:text-[#bc955c] truncate">{mSel.nombre || `Memoria ${slotMovil}`}</span>
            <span className="block text-[9px] font-bold uppercase text-slate-400">{aplicables(mSel).length} columnas{esActiva(mSel) ? " · aplicada" : ""}</span>
          </span>
          {guardandoSlot === slotMovil ? <Loader2 className="size-4 mx-2 animate-spin text-slate-400" /> : (
            <>
              <button type="button" onClick={() => guardar(slotMovil, mSel.nombre)} aria-label="Sobrescribir con las columnas visibles ahora" className="p-2 rounded-lg text-slate-500 cursor-pointer"><RefreshCw className="size-4" /></button>
              <button type="button" onClick={() => { borrar(slotMovil); setSlotMovil(null); }} aria-label="Borrar memoria" className="p-2 rounded-lg text-slate-500 hover:text-red-600 cursor-pointer"><Trash2 className="size-4" /></button>
              <button type="button" onClick={() => setSlotMovil(null)} aria-label="Ocultar" className="p-2 rounded-lg text-slate-400 cursor-pointer"><X className="size-4" /></button>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
    </div>

    {/* ---- sm+: tarjetas completas ---- */}
    <div className="hidden sm:block mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Bookmark className="size-3.5 text-[#621f32] dark:text-[#bc955c]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Memorias de columnas</span>
        {cargando && <Loader2 className="size-3 animate-spin text-slate-400" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SLOTS.map((slot) => {
          const m = memorias[slot];
          const ocupado = guardandoSlot === slot;
          if (nombrando === slot) {
            return (
              <form
                key={slot}
                onSubmit={(e) => { e.preventDefault(); guardar(slot, nombre.trim() || `Memoria ${slot}`); }}
                className="flex items-center gap-1 rounded-xl border-2 border-[#621f32]/40 dark:border-[#bc955c]/40 bg-white dark:bg-slate-950 px-2 py-1.5"
              >
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setNombrando(null); } }}
                  maxLength={40}
                  placeholder={`Memoria ${slot}`}
                  aria-label="Nombre de la memoria"
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
                />
                <button type="submit" disabled={ocupado} title="Guardar" className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer">
                  {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                </button>
                <button type="button" onClick={() => setNombrando(null)} title="Cancelar" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="size-3.5" /></button>
              </form>
            );
          }
          if (!m) {
            return (
              <button
                key={slot}
                type="button"
                disabled={cargando}
                onClick={() => { setNombrando(slot); setNombre(""); }}
                title="Guardar las columnas visibles ahora en este espacio"
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-[11px] font-bold text-slate-400 hover:border-[#621f32]/40 hover:text-[#621f32] dark:hover:border-[#bc955c]/40 dark:hover:text-[#bc955c] transition-colors cursor-pointer disabled:opacity-50"
              >
                <BookmarkPlus className="size-4 shrink-0" />
                Guardar vista actual
              </button>
            );
          }
          const activa = esActiva(m);
          const n = aplicables(m).length;
          return (
            <div
              key={slot}
              className={`flex items-center gap-1 rounded-xl border-2 px-1 transition-colors ${activa ? "border-[#621f32] bg-[#621f32]/[0.05] dark:border-[#bc955c] dark:bg-[#bc955c]/[0.06]" : "border-slate-200 dark:border-slate-700 hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40"}`}
            >
              <button
                type="button"
                disabled={n === 0}
                onClick={() => onApply(aplicables(m))}
                title={n === 0 ? "Ninguna de sus columnas está disponible aquí" : "Mostrar solo las columnas de esta memoria"}
                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Bookmark className={`size-4 shrink-0 ${activa ? "fill-current text-[#621f32] dark:text-[#bc955c]" : "text-slate-400"}`} />
                <span className="min-w-0">
                  <span className={`block text-xs font-black truncate ${activa ? "text-[#621f32] dark:text-[#bc955c]" : "text-slate-700 dark:text-slate-200"}`}>{m.nombre || `Memoria ${slot}`}</span>
                  <span className="block text-[9px] font-bold uppercase text-slate-400">{n} columnas{activa ? " · activa" : ""}</span>
                </span>
              </button>
              {ocupado ? (
                <Loader2 className="size-3.5 mx-1.5 animate-spin text-slate-400" />
              ) : (
                <>
                  <button type="button" onClick={() => guardar(slot, m.nombre)} title="Sobrescribir con las columnas visibles ahora" aria-label="Sobrescribir memoria" className="p-1.5 rounded-lg text-slate-400 hover:text-[#621f32] hover:bg-slate-100 dark:hover:text-[#bc955c] dark:hover:bg-slate-800 cursor-pointer"><RefreshCw className="size-3.5" /></button>
                  <button type="button" onClick={() => borrar(slot)} title="Borrar memoria" aria-label="Borrar memoria" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"><Trash2 className="size-3.5" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
    </div>
    </>
  );
}
