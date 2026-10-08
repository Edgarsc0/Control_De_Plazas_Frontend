'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetch-interceptor';
import { SlidersHorizontal, RefreshCw, Check, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ENDPOINT = '/plantilla/bitacora/tolerancias/';

/** Registros mínimos que la tarea acepta: referencia menos el % de tolerancia. */
function minimoAceptado(referencia, pct) {
  return Math.ceil(referencia * (1 - pct / 100));
}

function esValido(texto) {
  if (texto.trim() === '') return false;
  const n = Number(texto);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

/**
 * Tolerancia de baja de registros por consulta de importar_zafiro. La tarea
 * (worker de Celery en la PC Windows) relee estos valores de la BD justo antes
 * de validar cada consulta, así que un cambio aplica sin reiniciar nada.
 */
export default function ToleranciasPanel() {
  const [consultas, setConsultas] = useState([]);
  const [valores, setValores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  const aplicar = (data) => {
    setConsultas(data.consultas);
    setValores(Object.fromEntries(data.consultas.map(c => [c.consulta, String(c.tolerancia_pct)])));
  };

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(ENDPOINT);
      if (response.ok) aplicar(await response.json());
      else setError('No se pudieron cargar las tolerancias.');
    } catch (err) {
      console.error('Error fetching tolerancias:', err);
      setError('Error de red al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const enviar = async (cambios) => {
    setSaving(true);
    setError(null);
    setGuardado(false);
    try {
      const response = await apiFetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await response.json();
      if (response.ok) {
        aplicar(data);
        setGuardado(true);
      } else {
        setError(data.error || data.detail || 'Error al guardar las tolerancias.');
      }
    } catch (err) {
      console.error('Error saving tolerancias:', err);
      setError('Error de red al conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  const cambios = Object.fromEntries(
    consultas
      .filter(c => esValido(valores[c.consulta] ?? '') && Number(valores[c.consulta]) !== c.tolerancia_pct)
      .map(c => [c.consulta, Number(valores[c.consulta])])
  );
  const hayInvalidos = consultas.some(c => !esValido(valores[c.consulta] ?? ''));
  const hayCambios = Object.keys(cambios).length > 0;

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-lg bg-white dark:bg-slate-950 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 dark:border-slate-800 shadow-sm">
            <SlidersHorizontal className="size-4 text-[#bc955c]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Tolerancia por Consulta</h3>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
              Baja máxima de registros que se acepta respecto al máximo de las últimas 20 corridas exitosas. Aplica desde la siguiente consulta que se valide.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {guardado && !hayCambios && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" /> GUARDADO
            </span>
          )}
          <button
            onClick={() => enviar(cambios)}
            disabled={loading || saving || !hayCambios || hayInvalidos}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black font-mono tracking-wider bg-[#621f32] text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
          >
            {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            GUARDAR
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-mono text-[11px]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <RefreshCw className="size-6 animate-spin text-[#bc955c]/60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {consultas.map(c => {
            const texto = valores[c.consulta] ?? '';
            const valido = esValido(texto);
            const cambiado = valido && Number(texto) !== c.tolerancia_pct;
            return (
              <div
                key={c.consulta}
                className={`rounded-xl border px-3.5 py-3 bg-slate-50/60 dark:bg-slate-950/40 ${cambiado ? 'border-[#bc955c]' : 'border-slate-150 dark:border-slate-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`tolerancia-${c.consulta}`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono truncate">
                    {c.nombre}
                  </label>
                  {c.personalizada && (
                    <button
                      onClick={() => enviar({ [c.consulta]: null })}
                      disabled={saving}
                      title={`Restablecer al valor por defecto (${c.tolerancia_por_defecto_pct}%)`}
                      className="p-1 rounded text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    id={`tolerancia-${c.consulta}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={texto}
                    onChange={(e) => { setGuardado(false); setValores(v => ({ ...v, [c.consulta]: e.target.value })); }}
                    className={`w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900 font-mono text-sm font-black text-slate-800 dark:text-slate-100 outline-none focus:border-[#bc955c] ${valido ? 'border-slate-200 dark:border-slate-700' : 'border-red-400'}`}
                  />
                  <span className="font-mono text-sm font-black text-slate-400">%</span>
                </div>

                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                  {valido ? (
                    <>Acepta desde <span className="font-bold text-slate-600 dark:text-slate-300">{minimoAceptado(c.referencia, Number(texto)).toLocaleString()}</span> de {c.referencia.toLocaleString()}</>
                  ) : (
                    <span className="text-red-500">Debe ser un número entre 0 y 100</span>
                  )}
                </p>
                <p className="text-[9px] font-mono text-slate-400 dark:text-slate-600 mt-1 truncate" title={c.actualizado_por || ''}>
                  {c.personalizada
                    ? `${c.actualizado_por || '—'} · ${format(parseISO(c.actualizado_en), 'dd MMM HH:mm', { locale: es })}`
                    : 'Valor por defecto'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
