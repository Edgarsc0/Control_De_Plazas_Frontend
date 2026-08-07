import { useCallback, useEffect, useState } from "react";
import { VacantesService } from "@/services/vacantes.service";

/**
 * Suscripciones ACTIVAS del usuario autenticado a "Notificarme cuando la
 * posición quede vacante/se ocupe" (menú contextual columna Posición en
 * PlantillaDetalleTab/MovimientosTab, botón compartido en CopyCellMenu).
 *
 * Carga la lista al montar (para que el menú sepa de entrada si ya existe
 * una suscripción y ofrezca "Cancelar aviso" en vez de duplicarla) y expone
 * `crear`/`cancelar`, que actualizan el estado local de inmediato (sin
 * esperar un refetch) tras confirmar con el backend.
 *
 * @returns {{
 *   find: (posicion: string, tipo: 'VACANTE'|'OCUPACION') => ?{id:number, posicion:string, tipo:string},
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

  const find = useCallback(
    (posicion, tipo) => suscripciones.find((s) => s.posicion === posicion && s.tipo === tipo) || null,
    [suscripciones]
  );

  const crear = useCallback(async (posicion, tipo) => {
    const res = await VacantesService.crearSuscripcionPosicion(posicion, tipo);
    if (!res.ok) throw new Error("No se pudo crear la suscripción");
    const data = await res.json();
    setSuscripciones((prev) => [...prev.filter((s) => !(s.posicion === posicion && s.tipo === tipo)), data]);
  }, []);

  const cancelar = useCallback(async (id) => {
    const res = await VacantesService.cancelarSuscripcionPosicion(id);
    if (!res.ok) throw new Error("No se pudo cancelar la suscripción");
    setSuscripciones((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { find, crear, cancelar };
}
