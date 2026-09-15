'use client';

import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Paperclip, Loader2, FileText, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import ExpedienteDocsList, { useExpedienteDocs } from './ExpedienteDocsList';

gsap.registerPlugin(useGSAP);

const TIPOS = [
  { value: 'Procedente', label: 'Procedente' },
  { value: 'Improcedente', label: 'Improcedente' },
];

/**
 * Modal (mismo `ModalShell` que usa el resto de la app) para capturar la
 * resolución de un asunto de valuación: `status` (Procedente/Improcedente) y,
 * salvo que ya viva en el expediente de Control de Gestión, el PDF de esa
 * resolución (`AsuntoValuacion.oficio_resolucion`).
 *
 * @param {Object|null} asunto - Fila de `AsuntoValuacion` (con `.id`, `.oficioInfo`). El
 *   componente se monta gateado por este dato desde el padre (no controla su propio `open`).
 * @param {Function} onClose - Cierra el modal sin guardar.
 * @param {(asuntoActualizado: Object) => void} onSaved - Se llama con el JSON
 *   actualizado que devuelve el backend tras guardar.
 */
export default function AdjuntarResolucionModal({ asunto, onClose, onSaved }) {
  const [tipo, setTipo] = useState('');
  const [yaEnExpediente, setYaEnExpediente] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const idAsunto = asunto?.oficioInfo?.idAsunto;
  const { docs: expedienteDocs, loading: loadingExpediente } = useExpedienteDocs(idAsunto);

  const checkboxRef = useRef(null);

  // El checkbox "ya viene en el expediente" sólo aplica a Procedente — aparece
  // animado con gsap al elegir ese tipo, en vez de simplemente mostrarse/
  // ocultarse de golpe.
  useGSAP(() => {
    if (tipo !== 'Procedente' || !checkboxRef.current) return;
    gsap.from(checkboxRef.current, { opacity: 0, y: -8, height: 0, duration: 0.32, ease: 'power2.out', clearProps: 'height' });
  }, { dependencies: [tipo], scope: checkboxRef });

  if (!asunto) return null;

  const handleTipoChange = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setYaEnExpediente(false);
    setFile(null);
    setError('');
  };

  const handleYaEnExpedienteChange = (checked) => {
    setYaEnExpediente(checked);
    if (checked) setFile(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (f && f.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF.');
      e.target.value = '';
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
  };

  const fileDisabled = tipo === 'Procedente' && yaEnExpediente;
  const canSubmit = tipo === 'Improcedente' ? !!file : tipo === 'Procedente' ? (yaEnExpediente || !!file) : false;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await CatTipoOficioService.actualizarResolucion(asunto.id, {
        status: tipo,
        file: fileDisabled ? null : file,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la resolución.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={!!asunto}
      onClose={() => !saving && onClose()}
      size="sm"
      icon={Paperclip}
      eyebrow="Adjuntar Resolución"
      title={asunto.oficioInfo?.asuntoNoOficio || 'Sin Oficio'}
      subtitle={`Folio ${asunto.oficioInfo?.asuntoFolio || 'N/A'}`}
      footer={
        <>
          <button
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-all disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-5 py-2.5 bg-[#621f32] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-[#4a1726] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Guardar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">Tipo de resolución</label>
          <div className="grid grid-cols-2 gap-3">
            {TIPOS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleTipoChange(value)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                  tipo === value
                    ? value === 'Procedente'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {tipo === value && <Check className="size-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'Procedente' && (
          <div ref={checkboxRef} className="overflow-hidden flex flex-col gap-2.5">
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/10 cursor-pointer select-none">
              <span className="relative inline-flex items-center justify-center shrink-0 mt-0.5">
                <input type="checkbox" checked={yaEnExpediente} onChange={(e) => handleYaEnExpedienteChange(e.target.checked)} className="peer sr-only" />
                <span className="size-4.5 rounded-md border-2 border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-950 peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-colors flex items-center justify-center">
                  {yaEnExpediente && <CheckCircle2 className="size-3.5 text-white" />}
                </span>
              </span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 leading-snug">
                El documento de autorización ya viene en el expediente de Control de Gestión
              </span>
            </label>

            <ExpedienteDocsList idAsunto={idAsunto} docs={expedienteDocs} loading={loadingExpediente} onError={setError} />
          </div>
        )}

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">
            PDF de resolución {!fileDisabled && tipo && <span className="text-red-500">*</span>}
          </label>
          <label className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed transition-colors ${
            fileDisabled
              ? 'border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 opacity-50 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-800 hover:border-[#621f32]/40 dark:hover:border-[#bc955c]/40 cursor-pointer bg-white dark:bg-slate-950'
          }`}>
            <FileText className={`size-4 shrink-0 ${file ? 'text-[#621f32] dark:text-[#bc955c]' : 'text-slate-400'}`} />
            <span className={`text-xs font-bold truncate ${file ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
              {fileDisabled ? 'No requerido (ya está en el expediente)' : file ? file.name : 'Seleccionar archivo PDF...'}
            </span>
            <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={fileDisabled} className="hidden" />
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
            <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
