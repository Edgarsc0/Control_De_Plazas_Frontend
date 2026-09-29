"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { EmployeeRecordModal } from "./EmployeesModal";
import { cargarBajas, buildBajaRecord, BAJA_RECORD_COLUMNS } from "./bajasExpediente";

const sinCeros = (v) => String(v ?? "").trim().replace(/^0+/, "");

/**
 * Abre el expediente de una persona por su número de empleado, con el MISMO modal que los
 * widgets Buscar persona (activo: fila de Plantilla Detalle) y Buscar baja (fila de BAJAS_SIG
 * con sus columnas). Busca primero entre los activos —aunque hoy ocupe otra plaza— y, si no
 * está, entre las bajas (la más reciente). El número se compara completo sin ceros a la
 * izquierda, para que "2022032" no empate con otro número que solo termine igual.
 *
 * Todo pasa por los endpoints normales, así que respeta el scope por UN y los permisos del rol:
 * si el usuario no puede ver a esa persona, sale el aviso de "no se encontró".
 *
 * Uso: const { abrirExpediente, expedienteUI } = useExpedienteEmpleado({ canViewPhoto });
 *      ... onClick={() => abrirExpediente(numEmpleado, nombre)} ... {expedienteUI}
 */
export function useExpedienteEmpleado({ canViewPhoto = true } = {}) {
  const [expediente, setExpediente] = useState(null); // { record, columns? } | { error }
  const [buscando, setBuscando] = useState(false);

  const abrirExpediente = useCallback(async (numEmpleado, nombre) => {
    const objetivo = sinCeros(numEmpleado);
    if (!objetivo) return;
    setBuscando(true);
    setExpediente(null);
    try {
      const res = await VacantesService.getEmpleadosCompletosActivosDetalle({ search: objetivo });
      const filas = res.ok ? await res.json() : [];
      const activo = (Array.isArray(filas) ? filas : []).find(
        (r) => sinCeros(r.numempleado) === objetivo || sinCeros(r.id_empleado) === objetivo
      );
      if (activo) { setExpediente({ record: activo }); return; }
      const bajas = await cargarBajas().catch(() => []);
      const baja = [...bajas]
        .filter((b) => sinCeros(b.no_empleado) === objetivo)
        .sort((a, b) => String(b.fecha_efectiva || "").localeCompare(String(a.fecha_efectiva || "")))[0];
      if (baja) { setExpediente({ record: buildBajaRecord(baja), columns: BAJA_RECORD_COLUMNS }); return; }
      setExpediente({ error: `No se encontró el expediente de ${nombre || numEmpleado} en la plantilla ni en bajas.` });
    } catch {
      setExpediente({ error: "No se pudo abrir el expediente." });
    } finally {
      setBuscando(false);
    }
  }, []);

  const aviso = (buscando || expediente?.error) && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed bottom-6 left-1/2 z-[1200] -translate-x-1/2 max-w-[90vw]">
          {buscando ? (
            <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-slate-600 shadow-xl dark:bg-slate-900/95 dark:text-slate-300">
              <Loader2 className="size-4 animate-spin" /> Abriendo expediente…
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 shadow-xl dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-300">
              {expediente.error}
              <button onClick={() => setExpediente(null)} aria-label="Cerrar aviso" className="cursor-pointer"><X className="size-3.5" /></button>
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  const expedienteUI = (
    <>
      {aviso}
      {expediente?.record && (
        <EmployeeRecordModal
          isOpen
          onClose={() => setExpediente(null)}
          record={expediente.record}
          columns={expediente.columns}
          canViewPhoto={canViewPhoto}
        />
      )}
    </>
  );

  return { abrirExpediente, expedienteUI };
}
