import { useCallback, useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";

/**
 * Suscripciones del usuario autenticado a "Notificarme cuando la posición
 * quede vacante/se ocupe": las PENDIENTES (`activa: true`) y las YA
 * LLEGADAS (`notificado_en` no nulo, con `detalle_enviado` — snapshot de
 * lo que decía el correo). Fuente única compartida por el menú contextual
 * de la columna Posición (CopyCellMenu, vía `find`) y la campanita de
 * notificaciones (NotificacionesPosicionBell, vía `suscripciones`).
 *
 * Carga la lista al montar y expone `crear`/`cancelar`, que actualizan el
 * estado local de inmediato (sin esperar un refetch) tras confirmar con el
 * backend.
 *
 * @returns {{
 *   suscripciones: Array<{id:number, posicion:string, tipo:string, activa:boolean, notificado_en:?string, detalle_enviado:?Object}>,
 *   find: (posicion: string, tipo: 'VACANTE'|'OCUPACION') => ?Object - solo entre las ACTIVAS (para el menú contextual).
 *   crear: (posicion: string, tipo: 'VACANTE'|'OCUPACION') => Promise<void>,
 *   cancelar: (id: number) => Promise<void>,
 * }}
 */
export function useSuscripcionesPosicion() {
  const [suscripciones, setSuscripciones] = useState([]);

  useEffect(() => {
    let active = true;
    VacantesService.getMisSuscripcionesPosicion()
      .then((res) => res.json())
      .then((data) => { if (active) setSuscripciones(Array.isArray(data) ? data : []); })
      .catch((err) => console.error("Error cargando suscripciones de posición:", err));
    return () => { active = false; };
  }, []);

  // Solo entre las ACTIVAS: una entrega ya llegada para la misma
  // posición+tipo no debe ofrecer "Cancelar aviso" en el menú contextual
  // (ya no hay nada pendiente que cancelar).
  const find = useCallback(
    (posicion, tipo) => suscripciones.find((s) => s.activa && s.posicion === posicion && s.tipo === tipo) || null,
    [suscripciones]
  );

  const crear = useCallback(async (posicion, tipo) => {
    const res = await VacantesService.crearSuscripcionPosicion(posicion, tipo);
    if (!res.ok) throw new Error("No se pudo crear la suscripción");
    const data = await res.json();
    // Solo reemplaza una ACTIVA duplicada — una entrega histórica (ya
    // llegada) para la misma posición+tipo se conserva en la lista.
    setSuscripciones((prev) => [...prev.filter((s) => !(s.activa && s.posicion === posicion && s.tipo === tipo)), data]);
  }, []);

  const cancelar = useCallback(async (id) => {
    const res = await VacantesService.cancelarSuscripcionPosicion(id);
    if (!res.ok) throw new Error("No se pudo cancelar la suscripción");
    setSuscripciones((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { suscripciones, find, crear, cancelar };
}
