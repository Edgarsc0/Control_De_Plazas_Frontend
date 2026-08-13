import { useCallback, useEffect, useState } from "react";
import { FiltrosGuardadosService } from "@/services/filtrosGuardados.service";

/**
 * Filtros avanzados guardados por el usuario autenticado para una vista
 * (un tab de `AdvancedFiltersModal`; cada uno tiene su propio set de
 * columnas, así que los filtros guardados no se comparten entre vistas).
 *
 * Carga la lista al montar y expone `guardar`/`eliminar`, que actualizan el
 * estado local de inmediato tras confirmar con el backend.
 *
 * @param {string} vista - Key que identifica el tab, ej. "plantilla_bajas".
 * @returns {{
 *   filtros: Array<{id:number, vista:string, nombre:string, condiciones:Object[], creado_en:string}>,
 *   loading: boolean,
 *   guardar: (nombre: string, condiciones: Object[]) => Promise<Object>,
 *   eliminar: (id: number) => Promise<void>,
 * }}
 */
export function useFiltrosGuardados(vista) {
  const [filtros, setFiltros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    FiltrosGuardadosService.getFiltrosGuardados(vista)
      .then((res) => res.json())
      .then((data) => { if (active) setFiltros(Array.isArray(data) ? data : []); })
      .catch((err) => console.error("Error cargando filtros guardados:", err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vista]);

  const guardar = useCallback(async (nombre, condiciones) => {
    const res = await FiltrosGuardadosService.crearFiltroGuardado(vista, nombre, condiciones);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo guardar el filtro");
    }
    const data = await res.json();
    setFiltros((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return data;
  }, [vista]);

  const eliminar = useCallback(async (id) => {
    const res = await FiltrosGuardadosService.eliminarFiltroGuardado(id);
    if (!res.ok) throw new Error("No se pudo eliminar el filtro");
    setFiltros((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { filtros, loading, guardar, eliminar };
}
