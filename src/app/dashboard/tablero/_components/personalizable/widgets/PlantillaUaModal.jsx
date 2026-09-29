"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutList } from "lucide-react";
import ModalShell from "@/components/shared/ModalShell";
import { VacantesService } from "@/services/vacantes.service";
import PlantillaDetalleTab from "@/app/dashboard/plantilla_empleados/_components/tabs/plantilla-detalle/PlantillaDetalleTab";

// Orden inicial: nivel tabular, del más alto al más bajo (la misma lógica que la pestaña usa para "nj",
// donde el 0 —Titular— va primero). `compareNivelTabular` (utils/nivelTabular) aplica la regla
// P<D<S<A<K<J<H con los numéricos al fondo; "desc" deja arriba los niveles más altos.
const ORDEN_NIVEL_TABULAR = { key: "nivel", direction: "desc" };
const CLAVE_ORDEN_MODAL = "plantilla_detalle_ua_modal_sort_v1"; // distinta a la de la pestaña

/**
 * Plantilla de UNA unidad administrativa, en un modal grande que es la MISMA pestaña "Plantilla
 * Detalle" (PlantillaDetalleTab: tarjetas de resumen, dona, filtros, columnas, exportación, etc.)
 * alimentada solo con las filas de esa unidad: SELECT * FROM EMPLEADOS_COMPLETOS_SIG WHERE
 * unidad_administrativa = <UA> (parámetro `unidad_administrativa` de
 * /plantilla/empleados_completos_activos_detalle/). Las tarjetas y la dona se calculan sobre esas
 * filas (el tab lo hace solo mientras "Plantilla oficial" está activo, que es su valor por defecto).
 *
 * Se dibuja por portal en <body> (ModalShell), así que no queda atrapado en el widget.
 */
// Etiquetas de `estado_nomina` que activa cada estatus del tablero. "Vacante" incluye también
// "Solicitada" y "No Disponible", igual que la tarjeta Vacante de la pestaña (ver
// handleVacanteCardClick): así la tabla cuadra con el conteo del widget.
const ETIQUETAS_ESTATUS = { Vacante: ["Vacante", "Solicitada", "No Disponible"] };

/**
 * `unidad` opcional: sin ella se carga la plantilla COMPLETA (widget Resumen de estados de
 * nómina). `estatus` opcional: arranca filtrado por ese estado de nómina; sin él, en "Activo"
 * como la pestaña.
 */
export default function PlantillaUaModal({ unidad, unidades, estatus, onClose }) {
  // `unidades`: todas las UA que forman la barra (la principal + sus adscritas, p. ej. la UAF con
  // sus dos DOAF). Se consulta cada una con el mismo endpoint y se juntan las filas: la tabla,
  // las tarjetas y la exportación a Excel incluyen así las plazas adscritas. Cada consulta pasa
  // por el recorte por UN del backend igual que siempre.
  const listaUnidades = unidades?.length ? unidades : unidad ? [unidad] : [];
  const claveUnidades = listaUnidades.join("\u001f");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef(null);

  useEffect(() => {
    let active = true;
    setCargando(true);
    setError(null);
    const consulta = (params) => VacantesService.getEmpleadosCompletosActivosDetalle(params)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar la plantilla de la unidad."))))
      .then((d) => (Array.isArray(d) ? d : []));
    (listaUnidades.length
      ? Promise.all(listaUnidades.map((u) => consulta({ unidad_administrativa: u }))).then((partes) => partes.flat())
      : consulta({}))
      .then((d) => { if (active) setFilas(d); })
      .catch((err) => { if (active) setError(err.message || "No se pudo cargar la plantilla de la unidad."); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveUnidades]);

  return (
    <ModalShell
      open
      onClose={onClose}
      size="2xl"
      fixedHeight
      icon={LayoutList}
      eyebrow={unidad ? "Plantilla Detalle" : "Plantilla Detalle · plantilla completa"}
      title={unidad || (estatus ? `Estado de nómina: ${estatus}` : "Plantilla completa")}
      subtitle={cargando ? "Cargando plantilla…" : `${filas.length.toLocaleString("es-MX")} registros en EMPLEADOS_COMPLETOS_SIG${listaUnidades.length > 1 ? ` · incluye ${listaUnidades.length - 1} unidad${listaUnidades.length > 2 ? "es" : ""} adscrita${listaUnidades.length > 2 ? "s" : ""}` : ""}`}
      bodyClassName="p-0 flex-1 min-h-0 overflow-y-auto"
    >
      {/* `--stack-h` es la altura de "banner + navbar" que el tab descuenta de su tarjeta de tabla
          (max-h-stack-vh); aquí lo que hay que descontar es el resto del viewport que NO es cuerpo
          del modal (margen del panel + franja + encabezado), para que la tabla llene el modal. */}
      <div style={{ "--stack-h": "calc(15vh + 8.5rem)" }} className="min-h-full">
        {error ? (
          <p className="p-10 text-center text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <PlantillaDetalleTab
            detalle={filas}
            isLoading={cargando}
            resumen={{}}
            isPending={isPending}
            startTransition={startTransition}
            cardRef={cardRef}
            isActiveTab={false}
            persistSortKey={CLAVE_ORDEN_MODAL}
            initialSort={ORDEN_NIVEL_TABULAR}
            barraMinima
            filtersStorageKey={null}
            initialColumnFilters={{ estado_nomina: estatus ? (ETIQUETAS_ESTATUS[estatus] || [estatus]) : ["Activo"] }}
          />
        )}
      </div>
    </ModalShell>
  );
}
