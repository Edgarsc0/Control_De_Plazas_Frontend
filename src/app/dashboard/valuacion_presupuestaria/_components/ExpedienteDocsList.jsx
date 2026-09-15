'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { ControlGestionService } from '@/services/control_gestion.service';

/**
 * Carga los anexos/respuestas/documentos del expediente de un asunto (API
 * externa de Control de Gestión) como una lista plana y homogénea.
 * @param {number|undefined} idAsunto - `oficioInfo.idAsunto` del asunto.
 */
export function useExpedienteDocs(idAsunto) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!idAsunto) { setDocs([]); return; }
    let active = true;
    setLoading(true);
    ControlGestionService.getExpedienteAsunto(idAsunto)
      .then((data) => {
        if (!active) return;
        const model = data?.model || {};
        setDocs([
          ...(model.documentos || []).map((d, i) => ({ key: `doc-${d.idDocumentoAsunto ?? i}`, nombre: d.nombre, ruta: d.ruta, tipoLabel: d.tipoDocumento || 'Documento' })),
          ...(model.respuestas || []).map((r, i) => ({ key: `resp-${r.idDocumentoTurnado ?? i}`, nombre: r.nombre, ruta: r.ruta, tipoLabel: `Respuesta Turnado #${r.consecutivoTurnado}` })),
          ...(model.anexos || []).map((a, i) => ({ key: `anexo-${i}`, nombre: a.nombre || 'Anexo', ruta: a.ruta, tipoLabel: 'Anexo Digital' })),
        ]);
      })
      .catch(() => { if (active) setDocs([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idAsunto]);

  return { docs, loading };
}

/**
 * Lista de anexos/respuestas del expediente con hipervínculo de previsualización
 * (abre el PDF en pestaña nueva). Usado junto al checkbox "ya está en el
 * expediente" de los modales de adjuntar oficio de valuación.
 *
 * @param {number|undefined} idAsunto
 * @param {Array} docs
 * @param {boolean} loading
 * @param {(msg: string) => void} [onError]
 */
export default function ExpedienteDocsList({ idAsunto, docs, loading, onError }) {
  const [previewingKey, setPreviewingKey] = useState(null);

  const handlePreview = async (doc) => {
    if (!idAsunto || previewingKey) return;
    setPreviewingKey(doc.key);
    try {
      const blob = await ControlGestionService.getVisualizarDocumento(idAsunto, doc.ruta || doc.nombre);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      onError?.('No se pudo abrir el documento.');
    } finally {
      setPreviewingKey(null);
    }
  };

  return (
    <div className="px-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Archivos del expediente</span>
      {loading ? (
        <p className="text-[11px] font-semibold text-slate-400 mt-1.5 flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Cargando archivos...</p>
      ) : docs.length === 0 ? (
        <p className="text-[11px] font-semibold text-slate-400 mt-1.5">Sin anexos ni respuestas registrados.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {docs.map((doc) => (
            <li key={doc.key} className="flex items-baseline gap-1.5 text-[11px]">
              <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">{doc.tipoLabel}:</span>
              <button
                type="button"
                onClick={() => handlePreview(doc)}
                disabled={!!previewingKey}
                className="inline-flex items-center gap-1 font-bold text-[#621f32] dark:text-[#bc955c] hover:underline underline-offset-2 truncate cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {previewingKey === doc.key ? <Loader2 className="size-3 animate-spin shrink-0" /> : <ExternalLink className="size-3 shrink-0" />}
                <span className="truncate">{doc.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
