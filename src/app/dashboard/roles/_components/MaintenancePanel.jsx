'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Power, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useMaintenance } from '@/context/MaintenanceContext';
import { MaintenanceService } from '@/services/maintenance.service';

const MENSAJE_DEFAULT = 'Estamos arreglando cositas. Volvemos muy pronto.';

/**
 * Interruptor del modo mantenimiento (solo superadmin). Al activarlo pregunta
 * a qué usuarios (desarrolladores) NO se les niega el servicio. Se elige
 * manualmente entre todos; quien activa queda siempre exento (si no, no
 * podría apagarlo).
 */
export default function MaintenancePanel({ whitelist }) {
    const { toast } = useToast();
    const { email: miEmail } = useAuth();
    const { refresh: refreshContext } = useMaintenance();
    const [estado, setEstado] = useState(null); // { activo, mensaje, exentos }
    const [dialogOpen, setDialogOpen] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [exentos, setExentos] = useState(new Set());
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await MaintenanceService.get();
            if (!res.ok) return;
            setEstado(await res.json());
        } catch (error) {
            console.error('Error cargando modo mantenimiento:', error);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const candidatos = useMemo(() => {
        const q = search.trim().toLowerCase();
        return whitelist
            .filter((e) => e.activo)
            .filter((e) => !q || e.email.toLowerCase().includes(q) || (e.rol_nombre || '').toLowerCase().includes(q))
            .sort((a, b) => a.email.localeCompare(b.email));
    }, [whitelist, search]);

    const openDialog = () => {
        setMensaje(estado?.mensaje && estado.mensaje !== MENSAJE_DEFAULT ? estado.mensaje : '');
        // Al activar por primera vez se sugiere a los superadmins; al editar
        // se respeta exactamente lo guardado.
        setExentos(
            new Set(
                estado?.activo
                    ? estado.exentos || []
                    : whitelist.filter((e) => e.activo && e.rol_nombre?.toLowerCase() === 'superadmin').map((e) => e.id)
            )
        );
        setSearch('');
        setDialogOpen(true);
    };

    const esPropio = (e) => e.email === miEmail;

    const toggleExento = (id) =>
        setExentos((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const save = async (activo, exentosIds, mensajeTexto) => {
        setIsSaving(true);
        try {
            if (activo) {
                const propio = whitelist.find(esPropio);
                if (propio) exentosIds = [...new Set([...exentosIds, propio.id])];
            }
            const res = await MaintenanceService.set({
                activo,
                mensaje: mensajeTexto,
                exentos: exentosIds,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo cambiar el modo mantenimiento.');
            }
            setEstado(await res.json());
            refreshContext();
            setDialogOpen(false);
            toast.success(activo ? 'Modo mantenimiento activado.' : 'Modo mantenimiento desactivado.');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const activo = !!estado?.activo;
    const exentosActuales = estado?.exentos || [];

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${activo ? 'bg-amber-500/15 text-amber-600' : 'bg-[#621f32]/10 text-[#621f32]'}`}>
                        <Wrench className="size-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Modo mantenimiento</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activo
                                ? 'ACTIVO: los usuarios sin exención solo pueden ver la landing.'
                                : 'Apagado: el sistema funciona con normalidad.'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {activo && (
                        <Button variant="outline" onClick={openDialog} disabled={isSaving}>
                            Editar exentos
                        </Button>
                    )}
                    {activo ? (
                        <Button
                            onClick={() => save(false, exentosActuales, estado?.mensaje || '')}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Power className="size-4" /> Desactivar
                        </Button>
                    ) : (
                        <Button onClick={openDialog} disabled={!estado} className="bg-[#621f32] hover:bg-[#4d1827] text-white">
                            <Power className="size-4" /> Activar mantenimiento
                        </Button>
                    )}
                </div>
            </div>

            {activo && (
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    <p><span className="font-semibold">Mensaje:</span> {estado.mensaje}</p>
                    <p>
                        <span className="font-semibold">Usuarios exentos:</span>{' '}
                        {exentosActuales.length === 0
                            ? 'ninguno'
                            : whitelist
                                  .filter((e) => exentosActuales.includes(e.id))
                                  .map((e) => e.email)
                                  .join(', ')}
                    </p>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto]">
                    <DialogHeader>
                        <DialogTitle>{activo ? 'Editar mantenimiento' : 'Activar modo mantenimiento'}</DialogTitle>
                        <DialogDescription>
                            Elige a qué usuarios (desarrolladores) NO se les negará el servicio. Los demás
                            solo verán la landing y la pantalla de mantenimiento. Tú siempre conservas acceso para poder apagarlo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 overflow-y-auto pr-1">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                Mensaje (opcional)
                            </label>
                            <input
                                value={mensaje}
                                onChange={(e) => setMensaje(e.target.value)}
                                maxLength={300}
                                placeholder={MENSAJE_DEFAULT}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar usuario o rol…"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm"
                            />
                        </div>

                        <p className="text-xs text-slate-500">
                            {exentos.size} usuario{exentos.size === 1 ? '' : 's'} con acceso durante el mantenimiento
                        </p>

                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                            {candidatos.map((e) => (
                                <li key={e.id}>
                                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <input
                                            type="checkbox"
                                            checked={exentos.has(e.id) || esPropio(e)}
                                            disabled={esPropio(e)}
                                            onChange={() => toggleExento(e.id)}
                                            className="size-4 accent-[#621f32]"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{e.email}{esPropio(e) && ' (tú, siempre con acceso)'}</span>
                                        <span className="text-xs text-slate-400">{e.rol_nombre}</span>
                                    </label>
                                </li>
                            ))}
                            {candidatos.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-slate-400">Sin resultados</li>
                            )}
                        </ul>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => save(true, Array.from(exentos), mensaje.trim())}
                            disabled={isSaving}
                            className="bg-[#621f32] hover:bg-[#4d1827] text-white"
                        >
                            {activo ? 'Guardar cambios' : 'Activar mantenimiento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
