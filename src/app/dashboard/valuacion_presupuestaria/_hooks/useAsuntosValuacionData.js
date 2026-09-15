'use client';

import { useState, useCallback, useEffect } from 'react';
import { CatTipoOficioService } from '@/services/cat_tipo_oficio.service';
import { ControlGestionService } from '@/services/control_gestion.service';

// Un asunto se considera valuado cuando trae al menos la tabla por nivel. Se
// aceptan también los JSON crudos del simulador (`tabla_2022`).
export const tieneValuacion = (item) => {
  const v = item?.valuacion;
  return !!(v && (v.tablas?.desglose_por_nivel?.length || v.tabla_2022?.length));
};

export const getEstatusValuacionLabel = (status) => {
  const s = status?.toLowerCase() || 'pendiente';
  if (s === 'procedente') return 'Procedente';
  if (s === 'improcedente') return 'Improcedente';
  return 'Pendiente';
};

// Carga todos los `AsuntoValuacion` (idTipoAsunto=1, "Oficio de Solicitud de
// Ocupación de Plazas de Nueva Creación") y los enriquece con su oficio
// turnado de Control de Gestión. Compartido por Asuntos de Valuación
// (valuacion_presupuestaria) y por la tabla de Solicitudes de Ocupación
// (ocupacion_plazas_por_oficio) — ambos módulos leen el mismo universo de
// asuntos, sólo difieren en qué columnas exponen.
export function useAsuntosValuacionData() {
  const [asuntos, setAsuntos] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const asuntosValData = await CatTipoOficioService.getAsuntosValuacion();
      const asuntosValList = Array.isArray(asuntosValData) ? asuntosValData : asuntosValData.results || [];

      if (asuntosValList.length === 0) {
        setAsuntos([]);
        return;
      }

      const oficiosData = await ControlGestionService.getOficiosTurnados({
        idUnidadResponsable: 11,
        fechaInicio: null,
        fechaFin: null,
        folio: null,
        ordenamiento: 'fecha',
        direccion: 'DESC',
        limite: 10000,
        offset: 0,
        idUnidadResponsableUsuario: '1',
        idUsuario: 9999,
        idUsuarioRol: 1,
      });
      const oficiosList = oficiosData?.model?.detalleTurnados || [];

      const enriched = asuntosValList
        .map((av) => {
          const matchedOficio = oficiosList.find((o) => o.idAsunto === av.idAsuntoSCG);
          return { ...av, oficioInfo: matchedOficio || null };
        })
        // Descarta huérfanos (asuntos de valuación sin oficio turnado asociado)
        .filter((av) => av.oficioInfo !== null);

      setAsuntos(enriched);
    } catch (e) {
      console.error('Error loading asuntos valuacion:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { asuntos, setAsuntos, loading, reload };
}
