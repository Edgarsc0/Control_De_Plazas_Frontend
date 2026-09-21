'use client';

import { useState, useCallback } from 'react';
import { DatabaseZap, HardDriveDownload, Check, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useZafiroUpdates } from '@/context/ZafiroUpdatesContext';
import { PERMISSIONS } from '@/config/permissions';
import { apiFetch } from '@/lib/fetch-interceptor';
import { clearAllDatasets } from '@/lib/plantillaBrowserCache';

/** Botón de solo icono con tooltip. `pressed` lo marca como seleccionado. */
function IconToggle({ icon: Icon, label, pressed, disabled, onClick, tone = 'default' }) {
  const active =
    tone === 'confirm'
      ? 'text-white bg-emerald-600 hover:bg-emerald-700'
      : 'text-[#621f32] bg-[#621f32]/10 ring-1 ring-[#621f32]/40';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={tone === 'confirm' ? undefined : pressed}
          className={`p-1.5 rounded-md transition-colors cursor-pointer outline-none disabled:opacity-50 ${
            pressed || tone === 'confirm' ? active : 'text-gray-400 hover:text-[#621f32] hover:bg-gray-100'
          }`}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-64">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Acciones discretas de caché para el Navbar, en dos pasos: los iconos solo
 * MARCAN qué borrar; la palomita (que aparece a la derecha cuando hay algo
 * marcado) ejecuta lo seleccionado.
 *  - Servidor: TODAS las keys de caché de Django en Redis del backend al que
 *    apunta el front (requiere el permiso de Monitoreo ZAFIRO; afecta a todos).
 *  - Local: TODOS los datasets de IndexedDB de este navegador.
 * Al terminar, los suscriptores de ZAFIRO (Detalle, Mov. Posiciones, Bajas,
 * Server Components) vuelven a pedir sus datos por red — sin necesidad de F5.
 */
export default function CacheClearButtons() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { refetchSubscribers } = useZafiroUpdates();
  const [selServer, setSelServer] = useState(false);
  const [selLocal, setSelLocal] = useState(false);
  const [busy, setBusy] = useState(false);

  const canClearServer = hasPermission(PERMISSIONS.VIEW_MONITOREO_ZAFIRO);
  const serverMarked = canClearServer && selServer;
  const anyMarked = serverMarked || selLocal;

  const execute = useCallback(async () => {
    setBusy(true);
    const done = [];
    const failed = [];

    // Primero el servidor: el refetch del final debe encontrar Redis vacío.
    if (serverMarked) {
      try {
        const response = await apiFetch('/plantilla/bitacora/invalidar-cache-manual/', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          done.push(`servidor (${data.cache_keys_borradas} keys)`);
        } else {
          failed.push('servidor');
        }
      } catch (err) {
        console.error('Error borrando caché del servidor:', err);
        failed.push('servidor');
      }
    }
    if (selLocal) {
      if (await clearAllDatasets()) done.push('local (IndexedDB)');
      else failed.push('local');
    }

    if (done.length) {
      // Sin F5: los suscriptores refetchean por red y reescriben IndexedDB.
      refetchSubscribers();
      toast.success('Caché borrada', {
        description: `${done.join(' y ')}. Recargando datos…`,
      });
      setSelServer(false);
      setSelLocal(false);
    }
    if (failed.length) {
      toast.error('No se pudo borrar', { description: `Falló: ${failed.join(' y ')}.` });
    }
    setBusy(false);
  }, [serverMarked, selLocal, refetchSubscribers, toast]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-0.5">
        {canClearServer && (
          <IconToggle
            icon={DatabaseZap}
            pressed={selServer}
            disabled={busy}
            onClick={() => setSelServer((v) => !v)}
            label={
              selServer
                ? 'Seleccionado: borrar TODA la caché del servidor (Redis, afecta a todos). Clic para desmarcar.'
                : 'Marcar: borrar TODA la caché del servidor (Redis, afecta a todos los usuarios).'
            }
          />
        )}
        <IconToggle
          icon={HardDriveDownload}
          pressed={selLocal}
          disabled={busy}
          onClick={() => setSelLocal((v) => !v)}
          label={
            selLocal
              ? 'Seleccionado: borrar TODA la caché local de este navegador (IndexedDB). Clic para desmarcar.'
              : 'Marcar: borrar TODA la caché local de este navegador (IndexedDB).'
          }
        />
        {anyMarked &&
          (busy ? (
            <span className="p-1.5 text-gray-400" aria-live="polite">
              <Loader2 className="size-4 animate-spin" />
            </span>
          ) : (
            <IconToggle
              icon={Check}
              tone="confirm"
              onClick={execute}
              label={`Ejecutar: borrar ${[serverMarked && 'caché del servidor', selLocal && 'caché local'].filter(Boolean).join(' y ')}.`}
            />
          ))}
      </div>
    </TooltipProvider>
  );
}
