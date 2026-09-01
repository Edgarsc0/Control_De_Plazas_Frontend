"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, Trash2, Download, Save, BookMarked, AlertTriangle, CheckCircle2, FileSpreadsheet, FilePlus2, MousePointerClick, History, X, FileOutput } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useToast } from "@/hooks/useToast";
import ConfirmModal from "@/components/shared/ConfirmModal";
import VacanciaDetalleModal from "../../shared/VacanciaDetalleModal";
import CodigoFederalCell from "./CodigoFederalCell";
import NumeroStepper from "./NumeroStepper";
import AnuenciaHistorialModal from "./AnuenciaHistorialModal";
import JustificacionCatalogoModal from "./JustificacionCatalogoModal";
import { CANAL_ANEXO3, guardarDatosAnexo3, borrarDatosAnexo3 } from "./anexo3TabChannel";
import {
  ANEXO2_COLUMNAS,
  ANEXO2_TEXTOS,
  ANEXO2_FIRMA_DEFAULT,
  ANEXO2_NOMBRE_ARCHIVO_DEFAULT,
  NOMBRE_HOJA_MAX,
  crearFilaVacia,
  crearHojaVacia,
  ordenarFilasPorNivel,
  sanitizarNombreHoja,
  siguienteNombreHoja,
  OFICIO_AUTORIZACION_EVENTUAL,
} from "./anexo2Schema";
import { exportarAnexo2 } from "./anexo2Excel";

// Estado del autollenado por fila, para pintar el estado de la celda "Código
// Federal de Puesto" sin bloquear la captura del resto del cuadro.
const ESTADO = { INACTIVO: "inactivo", BUSCANDO: "buscando", OK: "ok", ERROR: "error" };

const CELDA_BASE =
  "w-full h-full px-2 py-1.5 bg-transparent text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:bg-[#621f32]/5 dark:focus:bg-[#bc955c]/10 transition-colors";

// Días naturales mínimos entre que inicia la vacancia y la fecha de alta
// solicitada. Es sólo un aviso informativo (ver renderCelda, columna
// "fecha_alta_solicitada"): no bloquea la captura ni afecta el cálculo de la
// valuación, que sigue usando la fecha que se haya escrito.
const DIAS_MINIMOS_VACANCIA = 30;

const diasEntreFechas = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) return null;
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = new Date(`${fechaFin}T00:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  return Math.round((fin - inicio) / 86400000);
};

// Completa el oficio en cualquier plaza Eventual que llegue en blanco —
// cubre lo que NO pasa por `autollenarDesdeCodigo` en el momento en que se
// agrega el oficio (un anexo cargado del historial, un borrador restaurado).
// Se llama SÓLO una vez en esos dos puntos de carga, no en cada cambio de
// `hojas`: con 800+ plazas, recorrerlas todas en cada tecla escrita en
// cualquier celda es el tipo de trabajo repetido que hace sentir lento el
// cuadro completo — aquí basta con hacerlo una vez, al recibir los datos.
const completarOficioEventual = (hojasList) =>
  hojasList.map((h) => ({
    ...h,
    filas: h.filas.map((f) => {
      const esEventual = String(f.tipo_contratacion || "").trim().toLowerCase() === "eventual";
      return esEventual && !String(f.oficio_autorizacion || "").trim()
        ? { ...f, oficio_autorizacion: OFICIO_AUTORIZACION_EVENTUAL }
        : f;
    }),
  }));

// Borrador en localStorage: sobrevive a cerrar la pestaña o perder internet a
// media captura — no hay backend de por medio (ver useEffects de
// restauración/guardado más abajo). La versión va en la llave porque la forma
// del borrador cambió al pasar de una captura plana a un libro de N hojas.
const BORRADOR_STORAGE_KEY = "anuencia_anexo2_borrador_v2";
const BORRADOR_STORAGE_KEY_V1 = "anuencia_anexo2_borrador_v1";
const BORRADOR_DEBOUNCE_MS = 500;

/**
 * Completa una hoja que viene de JSON (borrador de localStorage o historial
 * del servidor) con lo que el componente da por hecho al renderizar — una
 * hoja guardada por una versión anterior, o a medio escribir, podría no
 * traer `filas` o `_id`.
 */
const normalizarHoja = (hoja, indice) => {
  const base = crearHojaVacia(`Hoja ${indice + 1}`);
  return {
    ...base,
    ...hoja,
    _id: hoja?._id || base._id,
    nombre: sanitizarNombreHoja(hoja?.nombre) || base.nombre,
    unidad_administrativa: hoja?.unidad_administrativa || "",
    justificacion: hoja?.justificacion || "",
    // Un anexo guardado antes de que existiera esta regla puede no venir ya
    // ordenado por nivel — se reordena al cargarlo, igual que al resolver un
    // código nuevo (ver autollenarDesdeCodigo).
    filas: Array.isArray(hoja?.filas) && hoja.filas.length ? ordenarFilasPorNivel(hoja.filas) : [crearFilaVacia()],
    _unidades_detectadas: Array.isArray(hoja?._unidades_detectadas) ? hoja._unidades_detectadas : [],
  };
};

/**
 * Extrae un mensaje legible de una respuesta 4xx de DRF — en particular el
 * de `validate_nombre_archivo` (nombre de anexo duplicado, ver
 * AnuenciaAnexoDetailSerializer), que si no se rescata aquí se pierde detrás
 * de un "no se pudo guardar" genérico y el usuario no sabe qué corregir.
 */
async function extraerMensajeError(res) {
  try {
    const data = await res.json();
    if (Array.isArray(data?.nombre_archivo) && data.nombre_archivo[0]) return data.nombre_archivo[0];
    if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) return data.non_field_errors[0];
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // Respuesta sin cuerpo JSON (p. ej. 500) — se cae al mensaje genérico del caller.
  }
  return null;
}

/** ¿La hoja tiene algo capturado? Decide si borrarla pide confirmación. */
const hojaTieneContenido = (hoja) =>
  String(hoja.unidad_administrativa || "").trim() !== "" ||
  String(hoja.justificacion || "").trim() !== "" ||
  (hoja.filas || []).some((f) => ANEXO2_COLUMNAS.some((c) => String(f[c.key] ?? "").trim() !== ""));

/**
 * Lee el borrador guardado, migrando el formato v1 (una sola captura plana)
 * al de hojas si es lo único que hay — así un borrador a medias no se pierde
 * al desplegar el soporte multi-hoja.
 */
function leerBorrador() {
  try {
    const crudoV2 = localStorage.getItem(BORRADOR_STORAGE_KEY);
    if (crudoV2) return JSON.parse(crudoV2);

    const crudoV1 = localStorage.getItem(BORRADOR_STORAGE_KEY_V1);
    if (!crudoV1) return null;
    const v1 = JSON.parse(crudoV1);
    localStorage.removeItem(BORRADOR_STORAGE_KEY_V1);
    return {
      hojas: [
        {
          ...crearHojaVacia("Hoja 1"),
          filas: Array.isArray(v1.filas) && v1.filas.length ? v1.filas : [crearFilaVacia()],
          unidad_administrativa: v1.unidadAdministrativa || "",
          justificacion: v1.justificacion || "",
          _unidades_detectadas: Array.isArray(v1.unidadesDetectadas) ? v1.unidadesDetectadas : [],
        },
      ],
      firmaNombre: v1.firmaNombre,
      firmaPuesto: v1.firmaPuesto,
      nombreArchivo: v1.nombreArchivo,
      anexoIdActual: v1.anexoIdActual ?? null,
    };
  } catch (err) {
    console.error("No se pudo leer el borrador de Anuencia:", err);
    return null;
  }
}

/**
 * Sub-tab "Anuencia" de Mov. Posiciones: captura del ANEXO 2 (Solicitud de
 * Ocupación de Plazas y/o Contratación de Honorarios) que se entrega a la
 * Unidad de Diseño Presupuestario.
 *
 * Reproduce el formato oficial como una hoja de cálculo en blanco: el cuadro
 * de plazas (12 columnas, N filas) y, debajo, el bloque de justificación.
 * La captura se reduce al Código Federal de Puesto — con él, el backend
 * (`AnuenciaLookupView`) resuelve Ramo, Unidad Responsable, denominación,
 * nivel salarial, tipo de contratación y fecha de inicio de la vacancia a
 * partir de la plantilla que ya mantiene Celery. Todo lo autollenado queda
 * editable: es una comodidad de captura, no una restricción.
 *
 * Como en Excel, un anexo es un LIBRO de N hojas: cada pestaña tiene su
 * propio cuadro, su Unidad Administrativa y su justificación, y se exporta
 * como una hoja del .xlsx. La firma y el nombre del archivo son del libro
 * completo, no de cada hoja.
 *
 * La estructura del formato (columnas, anchos, textos) vive en
 * `anexo2Schema.js` y la exportación en `anexo2Excel.js`, para que el .xlsx
 * generado no pueda desviarse de lo que se ve en pantalla.
 */
export default function AnuenciaTab({ cardRef }) {
  const { toast } = useToast();
  const [hojas, setHojas] = useState(() => [crearHojaVacia("Hoja 1")]);
  const [hojaActivaId, setHojaActivaId] = useState(null);
  const [firmaNombre, setFirmaNombre] = useState(ANEXO2_FIRMA_DEFAULT.nombre);
  const [firmaPuesto, setFirmaPuesto] = useState(ANEXO2_FIRMA_DEFAULT.puesto);
  // Nombre del archivo (sin extensión) — se ve junto al título ("Anuencia -
  // {nombre}") y es el nombre con el que se descarga el .xlsx; editable y se
  // persiste junto con el resto del anexo (ver handleExportar).
  const [nombreArchivo, setNombreArchivo] = useState(ANEXO2_NOMBRE_ARCHIVO_DEFAULT);
  const [estados, setEstados] = useState({}); // { [fila._id]: { estado, mensaje } }
  const [exportando, setExportando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [isHistorialOpen, setIsHistorialOpen] = useState(false);
  const [isCatalogoOpen, setIsCatalogoOpen] = useState(false);
  // El editor de Anexo 3 ahora vive en su propia pestaña del navegador (ver
  // anexo3TabChannel.js) — mientras esa pestaña sigue abierta, esta se
  // bloquea para no editar sobre una captura que ya se le pasó (ver el aviso
  // en la tabla de plazas más abajo). Se desbloquea con el mensaje de
  // "cerrado" que manda esa pestaña por BroadcastChannel al cerrarse.
  const [anexo3Bloqueado, setAnexo3Bloqueado] = useState(false);
  const canalAnexo3Ref = useRef(null);
  const [hojaAEliminar, setHojaAEliminar] = useState(null);
  const [confirmarNuevoAnexo, setConfirmarNuevoAnexo] = useState(false);
  // id del anexo en el historial del servidor que se está editando — null
  // mientras es un anexo nuevo que aún no se ha descargado ninguna vez (ver
  // handleExportar: sin id crea un registro nuevo, con id actualiza el
  // existente). Se restaura junto con el borrador para no crear un duplicado
  // si se cierra la pestaña a medio editar un anexo ya guardado.
  const [anexoIdActual, setAnexoIdActual] = useState(null);

  // Cae a la primera hoja cuando `hojaActivaId` aún no se ha fijado (montaje)
  // o apunta a una hoja que ya se borró — así nunca queda sin hoja activa.
  const hojaActiva = hojas.find((h) => h._id === hojaActivaId) || hojas[0];

  // --- Virtualización del cuadro de plazas ----------------------------------
  // Hojas como "DGOA" llegan a tener cientos de filas — dibujarlas todas de
  // golpe (cada una con varios inputs y su propio autollenado) es lo que
  // trababa el navegador al entrar al componente. En vez de eso, el cuadro
  // vive en su propio contenedor con scroll y sólo se montan al DOM las
  // filas que caben en pantalla (más un colchón arriba/abajo) — el resto se
  // reemplaza por dos filas "espaciadoras" que ocupan su alto exacto, así el
  // scroll se siente idéntico a tener las 800 filas reales sin pagar su costo.
  const ALTO_FILA_PX = 36; // h-9, igual que las celdas del cuadro (ver CELDA_BASE)
  const scrollCuadroRef = useRef(null);
  const virtualizadorFilas = useVirtualizer({
    count: hojaActiva.filas.length,
    getScrollElement: () => scrollCuadroRef.current,
    estimateSize: () => ALTO_FILA_PX,
    overscan: 12,
  });

  // Al cambiar de hoja, el contenedor conserva el scroll de la hoja anterior
  // (es el mismo <div>, sólo cambian los datos) — sin esto, una hoja corta
  // podría abrir "a la mitad" si la anterior estaba muy desplazada.
  useEffect(() => {
    scrollCuadroRef.current?.scrollTo({ top: 0 });
    virtualizadorFilas.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojaActivaId]);

  // Total de columnas reales del cuadro (para los colSpan de las filas
  // espaciadoras y la de mensajes) — 12 columnas del formato + la de Unidad
  // Administrativa informativa (sólo tras "codigo") + la de acciones.
  const totalColumnasCuadro = useMemo(
    () => ANEXO2_COLUMNAS.length + ANEXO2_COLUMNAS.filter((c) => c.esLlave).length + 1,
    []
  );

  // Un AbortController por fila: si el capturista sigue escribiendo el código,
  // la búsqueda anterior de ESA fila se cancela (no las de las demás).
  const peticiones = useRef({});

  // Espejo de `hojas` sin depender de él en useCallback: autollenarDesdeCodigo
  // necesita leer el estado más fresco de TODAS las hojas (para el chequeo de
  // códigos duplicados) sin recrearse cada vez que `hojas` cambia.
  const hojasRef = useRef(hojas);
  hojasRef.current = hojas;

  // --- Detección de cambios sin guardar ---
  // Antes esto comparaba un JSON.stringify() del anexo completo en CADA
  // render — con 800+ plazas capturadas, serializar todo el árbol en cada
  // tecla que se escribe en cualquier celda es carísimo y es lo que hacía
  // que el navegador se sintiera trabado al editar un anexo grande. En vez
  // de comparar contenido, se lleva un contador de "revisión": se incrementa
  // (en un efecto, O(1)) cada vez que `hojas`/firma*/nombreArchivo cambian, y
  // "sin guardar" es sólo comparar dos números.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((r) => r + 1);
  }, [hojas, firmaNombre, firmaPuesto, nombreArchivo]);

  // `snapshotRevisionRef` es la revisión que se sabe reflejada en el servidor
  // (guardado, descargado, o recién cargado del historial) — `null` significa
  // "no hay un punto de guardado conocido" (anexo nuevo recién restaurado de
  // un borrador local, por ejemplo), en cuyo caso basta con que haya algo
  // capturado para considerarlo sin guardar. Se usa para advertir antes de
  // "Nuevo anexo" (ver solicitarNuevoAnexo más abajo).
  const snapshotRevisionRef = useRef(null);
  const marcarComoGuardado = useCallback(() => {
    snapshotRevisionRef.current = revision;
  }, [revision]);
  const hayCambiosSinGuardar =
    snapshotRevisionRef.current === null ? hojas.some(hojaTieneContenido) : revision !== snapshotRevisionRef.current;

  // --- Borrador en localStorage ---
  // `restauradoRef` evita que el efecto de guardado (más abajo) pise el
  // borrador guardado con el estado inicial vacío ANTES de que el efecto de
  // restauración (que corre después, en el siguiente useEffect) alcance a
  // leerlo — sin este guard, montar el componente borraría el borrador.
  const restauradoRef = useRef(false);

  useEffect(() => {
    try {
      const borrador = leerBorrador();
      const hojasBorrador = (Array.isArray(borrador?.hojas) ? borrador.hojas : []).map(normalizarHoja);
      const hayContenido = hojasBorrador.some(hojaTieneContenido);

      if (hayContenido) {
        setHojas(completarOficioEventual(hojasBorrador));
        setHojaActivaId(hojasBorrador[0]?._id ?? null);
        setFirmaNombre(borrador.firmaNombre || ANEXO2_FIRMA_DEFAULT.nombre);
        setFirmaPuesto(borrador.firmaPuesto || ANEXO2_FIRMA_DEFAULT.puesto);
        setNombreArchivo(borrador.nombreArchivo || ANEXO2_NOMBRE_ARCHIVO_DEFAULT);
        setAnexoIdActual(borrador.anexoIdActual ?? null);
        toast.info("Se restauró tu borrador de Anuencia guardado en este navegador.");
      }
    } finally {
      restauradoRef.current = true;
    }
    // Sólo al montar: es una restauración única, no debe repetirse por
    // cambios posteriores de `toast`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restauradoRef.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          BORRADOR_STORAGE_KEY,
          JSON.stringify({ hojas, firmaNombre, firmaPuesto, nombreArchivo, anexoIdActual })
        );
      } catch (err) {
        // Cuota llena u otro error de localStorage: la captura en pantalla
        // sigue funcionando, sólo no queda respaldada — no es fatal.
        console.error("No se pudo guardar el borrador de Anuencia:", err);
      }
    }, BORRADOR_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hojas, firmaNombre, firmaPuesto, nombreArchivo, anexoIdActual]);

  // Textarea de justificación sin scrollbar interno: crece con el contenido
  // en vez de recortarlo, conservando el alto mínimo de `min-h-[280px]` (el
  // que ya tenía con `rows={14}`) cuando el texto es corto.
  const justificacionRef = useRef(null);
  useEffect(() => {
    const el = justificacionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [hojaActiva.justificacion, hojaActiva._id]);

  // Modal de Detalle de Vacancia en "Fecha de inicio de la vacancia" — mismo
  // componente y mismo flujo que Mov. Posiciones/Plantilla Detalle
  // (VacanciaDetalleModal), keyed por el `mov_pos_id` que ya trae el
  // autollenado (ver `_movPosId` en cada fila).
  const [isVacanciaModalOpen, setIsVacanciaModalOpen] = useState(false);
  const [vacanciaRowId, setVacanciaRowId] = useState(null);
  const [vacanciaDetalle, setVacanciaDetalle] = useState(null);
  const [isVacanciaLoading, setIsVacanciaLoading] = useState(false);

  const openVacanciaModal = useCallback((fila) => {
    if (fila._movPosId === undefined || fila._movPosId === null) return;
    setVacanciaRowId(fila._movPosId);
    setIsVacanciaModalOpen(true);
  }, []);

  useEffect(() => {
    let active = true;
    if (isVacanciaModalOpen && vacanciaRowId !== null) {
      setIsVacanciaLoading(true);
      setVacanciaDetalle(null);
      VacantesService.getMovPosVacanciaDetalle(vacanciaRowId)
        .then((res) => res.json())
        .then((data) => { if (active) setVacanciaDetalle(data); })
        .catch((err) => {
          console.error("Error fetching vacancia detalle:", err);
          if (active) setVacanciaDetalle({ error: "Error al cargar el detalle de la vacancia." });
        })
        .finally(() => { if (active) setIsVacanciaLoading(false); });
    } else {
      setVacanciaDetalle(null);
    }
    return () => { active = false; };
  }, [isVacanciaModalOpen, vacanciaRowId]);

  // --- Edición dentro de una hoja ---
  // Todas las mutaciones van por `hojaId` explícito y no por "la hoja activa":
  // el autollenado es asíncrono y el usuario puede cambiar de pestaña antes de
  // que responda, así que la respuesta debe aterrizar en la hoja donde se
  // escribió el código, no en la que esté abierta al llegar.

  const parchearHoja = useCallback((hojaId, cambios) => {
    setHojas((prev) => prev.map((h) => (h._id === hojaId ? { ...h, ...cambios } : h)));
  }, []);

  const parchearFilas = useCallback((hojaId, transformar) => {
    setHojas((prev) => prev.map((h) => (h._id === hojaId ? { ...h, filas: transformar(h.filas) } : h)));
  }, []);

  const actualizarCelda = useCallback((hojaId, filaId, key, valor) => {
    parchearFilas(hojaId, (filas) => filas.map((f) => (f._id === filaId ? { ...f, [key]: valor } : f)));
  }, [parchearFilas]);

  const agregarFila = useCallback((hojaId) => {
    parchearFilas(hojaId, (filas) => [...filas, crearFilaVacia()]);
    // La fila nueva se agrega al final — con el cuadro virtualizado esa
    // posición puede quedar fuera de lo que hay montado en pantalla, así que
    // se desplaza el cuadro para que la vea de inmediato y pueda capturar.
    requestAnimationFrame(() => virtualizadorFilas.scrollToIndex(hojaActiva.filas.length, { align: "end" }));
  }, [parchearFilas, virtualizadorFilas, hojaActiva]);

  const eliminarFila = useCallback((hojaId, filaId) => {
    // Nunca se queda sin filas: el formato siempre muestra al menos una vacía.
    parchearFilas(hojaId, (filas) => (filas.length === 1 ? [crearFilaVacia()] : filas.filter((f) => f._id !== filaId)));
    setEstados((prev) => {
      const siguiente = { ...prev };
      delete siguiente[filaId];
      return siguiente;
    });
  }, [parchearFilas]);

  // --- Hojas del libro ---

  const agregarHoja = useCallback(() => {
    const nueva = crearHojaVacia(siguienteNombreHoja(hojas));
    setHojas((prev) => [...prev, nueva]);
    setHojaActivaId(nueva._id);
  }, [hojas]);

  const renombrarHoja = useCallback((hojaId, nombre) => {
    // Se sanea al escribir (no al exportar) para que el nombre en pantalla sea
    // exactamente el que tendrá la pestaña en Excel.
    parchearHoja(hojaId, { nombre: sanitizarNombreHoja(nombre) });
  }, [parchearHoja]);

  const eliminarHoja = useCallback((hojaId) => {
    if (hojas.length === 1) return; // el libro nunca se queda sin hojas
    const idx = hojas.findIndex((h) => h._id === hojaId);
    if (idx === -1) return;

    const restantes = hojas.filter((h) => h._id !== hojaId);
    setHojas(restantes);

    // Si se borró la hoja abierta, se abre la que quedó en su lugar.
    if (hojaActiva._id === hojaId) {
      setHojaActivaId((restantes[idx] || restantes[restantes.length - 1])._id);
    }

    // Los mensajes de autollenado de sus filas dejan de tener a qué referirse.
    const idsBorrados = new Set((hojas[idx].filas || []).map((f) => f._id));
    setEstados((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !idsBorrados.has(id))));
  }, [hojas, hojaActiva]);

  const pedirEliminarHoja = useCallback((hoja) => {
    // Una hoja en blanco se va sin ceremonia; una con captura pide confirmar.
    if (!hojaTieneContenido(hoja)) {
      eliminarHoja(hoja._id);
      return;
    }
    setHojaAEliminar(hoja);
  }, [eliminarHoja]);

  const ejecutarNuevoAnexo = useCallback(() => {
    peticiones.current = {};
    const hoja = crearHojaVacia("Hoja 1");
    setHojas([hoja]);
    setHojaActivaId(hoja._id);
    setEstados({});
    setFirmaNombre(ANEXO2_FIRMA_DEFAULT.nombre);
    setFirmaPuesto(ANEXO2_FIRMA_DEFAULT.puesto);
    setNombreArchivo(ANEXO2_NOMBRE_ARCHIVO_DEFAULT);
    // Empezar un anexo nuevo: la próxima descarga debe crear un registro nuevo
    // en el historial, no seguir actualizando el que se estaba editando.
    setAnexoIdActual(null);
    // La plantilla en blanco es, por definición, el estado ya "guardado":
    // no hay nada que perder hasta que se capture algo — así el botón no
    // vuelve a advertir hasta que haya contenido real de nuevo. Los `set*`
    // de arriba (todos síncronos, en el mismo evento) se agrupan en un único
    // re-render, así que la revisión sólo sube en +1 por este cambio — se
    // anticipa aquí porque el efecto que la incrementa todavía no corrió.
    snapshotRevisionRef.current = revision + 1;
    try {
      localStorage.removeItem(BORRADOR_STORAGE_KEY);
    } catch (err) {
      console.error("No se pudo borrar el borrador de Anuencia:", err);
    }
    toast.success("Anexo nuevo — plantilla en blanco lista para capturar.");
  }, [toast, revision]);

  /** Botón "Nuevo anexo": si hay algo sin guardar, pide confirmar primero
   * (ver ConfirmModal más abajo) — nunca se descarta captura en silencio. */
  const solicitarNuevoAnexo = useCallback(() => {
    if (hayCambiosSinGuardar) {
      setConfirmarNuevoAnexo(true);
      return;
    }
    ejecutarNuevoAnexo();
  }, [hayCambiosSinGuardar, ejecutarNuevoAnexo]);

  /**
   * Guarda el anexo en el historial del servidor SIN descargar el .xlsx (a
   * diferencia de handleExportar, que hace ambas cosas) — para poder ir
   * capturando varias hojas a lo largo del tiempo sin generar un archivo en
   * cada paso intermedio. No toca `generado_por`/`generado_en`/
   * `veces_generado`: esos sólo se estampan al descargar (ver `generar/` en
   * AnuenciaAnexoViewSet).
   */
  const handleGuardar = useCallback(async () => {
    setGuardando(true);
    try {
      const payload = {
        hojas,
        firma_nombre: firmaNombre,
        firma_puesto: firmaPuesto,
        nombre_archivo: nombreArchivo,
      };
      if (anexoIdActual) {
        const res = await VacantesService.actualizarAnuenciaAnexo(anexoIdActual, payload);
        if (!res.ok) throw new Error(await extraerMensajeError(res) || "No se pudo guardar el anexo. Intenta de nuevo.");
      } else {
        const res = await VacantesService.crearAnuenciaAnexo(payload);
        if (!res.ok) throw new Error(await extraerMensajeError(res) || "No se pudo guardar el anexo. Intenta de nuevo.");
        const creado = await res.json();
        setAnexoIdActual(creado.id);
      }
      marcarComoGuardado();
      toast.success("Anexo guardado en el historial.");
    } catch (err) {
      toast.error(err.message || "No se pudo guardar el anexo. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }, [hojas, firmaNombre, firmaPuesto, nombreArchivo, anexoIdActual, marcarComoGuardado, toast]);

  /**
   * Resuelve el resto de la fila a partir del Código Federal de Puesto.
   * Se dispara al salir de la celda (blur) o con Enter — no en cada tecla:
   * el código se escribe completo antes de tener sentido buscarlo.
   */
  const autollenarDesdeCodigo = useCallback(async (hojaId, filaId, codigo) => {
    const termino = String(codigo || "").trim();
    if (!termino) {
      setEstados((prev) => ({ ...prev, [filaId]: { estado: ESTADO.INACTIVO } }));
      return;
    }

    // Un mismo Código Federal de Puesto / identificador no puede repetirse en
    // el anexo, sin importar en qué hoja esté — el Anexo 2 es UNA sola
    // solicitud, así que dos filas con el mismo código estarían pidiendo la
    // misma plaza dos veces. Se corta ANTES de llamar al backend: ni se
    // autollena ni se marca ocupada/vacante, sólo se avisa del duplicado.
    const normalizado = termino.toUpperCase();
    const hojaConDuplicado = hojasRef.current.find((h) =>
      h.filas.some((f) => f._id !== filaId && String(f.codigo || "").trim().toUpperCase() === normalizado)
    );
    if (hojaConDuplicado) {
      peticiones.current[filaId]?.abort();
      setEstados((prev) => ({
        ...prev,
        [filaId]: {
          estado: ESTADO.ERROR,
          mensaje: `Código duplicado: ya está capturado en "${hojaConDuplicado.nombre}". No puede repetirse en el mismo anexo.`,
        },
      }));
      return;
    }

    peticiones.current[filaId]?.abort();
    const controller = new AbortController();
    peticiones.current[filaId] = controller;

    setEstados((prev) => ({ ...prev, [filaId]: { estado: ESTADO.BUSCANDO } }));

    try {
      const res = await VacantesService.getAnuenciaLookup(termino, { signal: controller.signal });
      const data = await res.json();

      if (!res.ok) {
        setEstados((prev) => ({
          ...prev,
          [filaId]: { estado: ESTADO.ERROR, mensaje: data?.error || "No se pudo resolver el código." },
        }));
        return;
      }

      setHojas((prev) =>
        prev.map((h) => {
          if (h._id !== hojaId) return h;

          const filasResueltas = h.filas.map((f) =>
            f._id === filaId
              ? {
                  ...f,
                  ramo: data.ramo ?? "",
                  unidad_responsable: data.unidad_responsable ?? "",
                  denominacion_puesto: data.denominacion_puesto ?? "",
                  nivel_salarial: data.nivel_salarial ?? "",
                  rango_salarial: data.rango_salarial ?? "",
                  numero_plazas: data.numero_plazas ?? "",
                  tipo_contratacion: data.tipo_contratacion ?? "",
                  fecha_inicio_vacancia: data.fecha_inicio_vacancia ?? "",
                  // Todas las plazas Eventuales se autorizan con el mismo
                  // oficio (ver OFICIO_AUTORIZACION_EVENTUAL) — las demás
                  // conservan lo que ya tuvieran capturado.
                  oficio_autorizacion:
                    data.tipo_contratacion === "Eventual" ? OFICIO_AUTORIZACION_EVENTUAL : f.oficio_autorizacion,
                  // Sólo informativa (ver columna junto a "Código Federal de
                  // Puesto"): no forma parte del formato oficial, así que no
                  // está en ANEXO2_COLUMNAS y anexo2Excel.js nunca la toca.
                  _unidadDeNegocioResuelta: data.unidad_de_negocio ?? "",
                  _movPosId: data.mov_pos_id ?? null,
                  // Nueva resolución = nueva fecha calculada: vuelve a estar
                  // vinculada al modal hasta que el usuario la edite a mano.
                  _fechaVacanciaEditada: false,
                }
              : f
          );
          // El nivel de esta fila acaba de quedar fijo — las plazas de una
          // hoja SIEMPRE van ordenadas por nivel (ver ordenarFilasPorNivel).
          const filas = ordenarFilasPorNivel(filasResueltas);

          // Cada UA nueva y distinta que aparece EN ESTA HOJA se agrega a su
          // encabezado concatenada con " y " — igual que el formato de
          // referencia, que trae "DGOA y DGMEIA" cuando una misma hoja mezcla
          // plazas de más de una unidad. El campo del encabezado se sigue
          // llamando `unidad_administrativa` (así se llama en el formato
          // oficial impreso), pero ahora se llena con la Unidad de Negocio
          // que resuelve MOV_POS.
          const ua = data.unidad_de_negocio;
          const detectadas = h._unidades_detectadas || [];
          if (!ua || detectadas.includes(ua)) return { ...h, filas };

          const siguientes = [...detectadas, ua];
          return { ...h, filas, _unidades_detectadas: siguientes, unidad_administrativa: siguientes.join(" y ") };
        })
      );

      setEstados((prev) => ({
        ...prev,
        [filaId]: data.ocupada
          ? {
              estado: ESTADO.ERROR,
              mensaje: `Plaza OCUPADA por ${data.ocupante || "otra persona"}. Verifica el código antes de solicitarla.`,
            }
          : { estado: ESTADO.OK, mensaje: `Posición ${data.posicion} · vacante` },
      }));
    } catch (err) {
      if (err.name === "AbortError") return;
      setEstados((prev) => ({
        ...prev,
        [filaId]: { estado: ESTADO.ERROR, mensaje: "Error de conexión al resolver el código." },
      }));
    }
  }, []);

  const handleExportar = useCallback(async () => {
    setExportando(true);
    try {
      // Se exporta sólo lo capturado: una fila totalmente en blanco no debe
      // llegar al formato oficial como renglón vacío. Las HOJAS sí se
      // conservan aunque estén vacías — si el usuario creó la pestaña, va en
      // el archivo.
      const hojasParaGuardar = hojas.map((h) => {
        const conDatos = (h.filas || []).filter((f) =>
          ANEXO2_COLUMNAS.some((c) => String(f[c.key] ?? "").trim() !== "")
        );
        return { ...h, filas: conDatos.length ? conDatos : [crearFilaVacia()] };
      });

      await exportarAnexo2({ hojas: hojasParaGuardar, firmaNombre, firmaPuesto, nombreArchivo });

      // Historial en el servidor: cada descarga queda guardada y auditada
      // (ver AnuenciaAnexoViewSet). Se guarda DESPUÉS de generar el archivo —
      // si `exportarAnexo2` fallara arriba, no debe quedar un registro de
      // "generado" a medias. Un fallo AQUÍ no debe impedir que el usuario se
      // quede con su .xlsx ya descargado, así que sólo se avisa, no se corta
      // el flujo.
      const payload = {
        hojas: hojasParaGuardar,
        firma_nombre: firmaNombre,
        firma_puesto: firmaPuesto,
        nombre_archivo: nombreArchivo,
      };
      try {
        if (anexoIdActual) {
          const resPatch = await VacantesService.actualizarAnuenciaAnexo(anexoIdActual, payload);
          if (!resPatch.ok) throw new Error(await extraerMensajeError(resPatch));
          const resGenerar = await VacantesService.generarAnuenciaAnexo(anexoIdActual);
          if (!resGenerar.ok) throw new Error(await extraerMensajeError(resGenerar));
        } else {
          const resCrear = await VacantesService.crearAnuenciaAnexo(payload);
          if (!resCrear.ok) throw new Error(await extraerMensajeError(resCrear));
          const creado = await resCrear.json();
          setAnexoIdActual(creado.id);
          // `crearAnuenciaAnexo` ya no estampa la generación (eso permite
          // guardar sin descargar, ver handleGuardar) — al descargar sí debe
          // quedar auditado, así que se marca aparte con el mismo `generar/`
          // que usa el otro branch.
          const resGenerar = await VacantesService.generarAnuenciaAnexo(creado.id);
          if (!resGenerar.ok) throw new Error(await extraerMensajeError(resGenerar));
        }
        marcarComoGuardado();
      } catch (err) {
        toast.warning(
          err?.message
            ? `El Anexo 2 se descargó, pero no se pudo guardar en el historial: ${err.message}`
            : "El Anexo 2 se descargó, pero no se pudo guardar en el historial."
        );
      }
    } finally {
      setExportando(false);
    }
  }, [hojas, firmaNombre, firmaPuesto, nombreArchivo, anexoIdActual, marcarComoGuardado, toast]);

  const handleCargarDesdeHistorial = useCallback((detalle) => {
    const hojasCargadas = completarOficioEventual(
      Array.isArray(detalle.hojas) && detalle.hojas.length
        ? detalle.hojas.map(normalizarHoja)
        : [crearHojaVacia("Hoja 1")]
    );
    const firmaNombreCargado = detalle.firma_nombre || ANEXO2_FIRMA_DEFAULT.nombre;
    const firmaPuestoCargado = detalle.firma_puesto || ANEXO2_FIRMA_DEFAULT.puesto;
    const nombreArchivoCargado = detalle.nombre_archivo || ANEXO2_NOMBRE_ARCHIVO_DEFAULT;

    setHojas(hojasCargadas);
    setHojaActivaId(hojasCargadas[0]?._id ?? null);
    setFirmaNombre(firmaNombreCargado);
    setFirmaPuesto(firmaPuestoCargado);
    setNombreArchivo(nombreArchivoCargado);
    setEstados({});
    setAnexoIdActual(detalle.id);
    // Recién cargado del servidor: no hay nada sin guardar todavía. Se
    // construye a mano (no con `marcarComoGuardado`) porque los `set*` de
    // arriba aún no se reflejan en `hojas`/`firmaNombre`/etc. en este mismo
    // tick — igual que en `ejecutarNuevoAnexo`, se anticipa la revisión que
    // va a quedar tras este único re-render agrupado.
    snapshotRevisionRef.current = revision + 1;
    toast.success(`Anexo #${detalle.id} cargado — sigue editando o descárgalo de nuevo.`);
  }, [toast, revision]);

  /**
   * "Agregar" en el catálogo de justificaciones (ver JustificacionCatalogoModal):
   * cae en la hoja ACTIVA — si ya había texto escrito se concatena en vez de
   * reemplazarlo, para no borrar lo que el usuario ya redactó a mano.
   */
  const handleAgregarJustificacionCatalogo = useCallback((texto) => {
    setHojas((prev) =>
      prev.map((h) => {
        if (h._id !== hojaActiva._id) return h;
        const previo = String(h.justificacion || "").trim();
        return { ...h, justificacion: previo ? `${previo}\n\n${texto}` : texto };
      })
    );
  }, [hojaActiva]);

  // El Anexo 3 se arma a partir de los Códigos Federales de Puesto
  // capturados: sin al menos uno no hay nada que agrupar ni valuar.
  const hayPlazasCapturadas = hojas.some((h) =>
    (h.filas || []).some((f) => String(f.codigo || "").trim() !== "")
  );

  // Abre el editor de Anexo 3 en una pestaña nueva, pasándole la captura
  // actual de `hojas` por localStorage (una pestaña nueva no comparte
  // memoria de JS con ésta — ver anexo3TabChannel.js) y bloquea esta pestaña
  // hasta que la otra avise que se cerró.
  const handleGenerarAnexo3 = useCallback(() => {
    // crypto.randomUUID() exige contexto seguro (https o localhost) — en
    // producción este sistema corre sobre HTTP plano, donde la función ni
    // siquiera existe. Sin este fallback, la línea de abajo lanzaba
    // TypeError de inmediato y todo el clic quedaba en silencio (nunca se
    // llegaba a guardar en localStorage ni a abrir la pestaña). Mismo
    // patrón que ya usan anexo2Schema.js y Anexo3Editor.jsx.
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `anexo3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    guardarDatosAnexo3(id, { hojas, nombreArchivo, anexoIdActual });

    canalAnexo3Ref.current?.close();
    const canal = new BroadcastChannel(CANAL_ANEXO3);
    canal.onmessage = (evento) => {
      if (evento.data?.id === id && evento.data?.tipo === "cerrado") {
        setAnexo3Bloqueado(false);
        borrarDatosAnexo3(id);
        canal.close();
        if (canalAnexo3Ref.current === canal) canalAnexo3Ref.current = null;
      }
    };
    canalAnexo3Ref.current = canal;
    setAnexo3Bloqueado(true);
    window.open(`/dashboard/plantilla_empleados/anexo3?id=${id}`, "_blank", "noopener");
  }, [hojas, nombreArchivo, anexoIdActual]);

  useEffect(() => () => canalAnexo3Ref.current?.close(), []);

  // El cuadro reproduce las proporciones de columna del Excel original, pero
  // en PORCENTAJE en vez de px fijos — así la tabla siempre ocupa el ancho
  // disponible sin scroll horizontal, sea cual sea el tamaño de pantalla.
  // La columna de acciones (eliminar fila) no forma parte del formato, así
  // que se le reserva un porcentaje fijo pequeño y el resto se reparte entre
  // las 12 columnas reales, proporcional a su ancho original.
  const ANCHO_ACCION_PORCENTAJE = 3.5;
  // Columna informativa "Unidad de Negocio" (ver _unidadDeNegocioResuelta):
  // no es parte del formato oficial, no se exporta, sólo ayuda a leer en
  // pantalla — se le resta su ancho al resto para que la tabla siga sin
  // scroll horizontal.
  const ANCHO_INFO_UA_PORCENTAJE = 11;
  const anchoExcelTotal = ANEXO2_COLUMNAS.reduce((t, c) => t + c.anchoExcel, 0);
  const anchoColumnaPorcentaje = (col) =>
    (col.anchoExcel / anchoExcelTotal) * (100 - ANCHO_ACCION_PORCENTAJE - ANCHO_INFO_UA_PORCENTAJE);

  const renderCelda = (hoja, fila, col) => {
    const valor = fila[col.key] ?? "";

    if (col.esLlave) {
      return (
        <CodigoFederalCell
          className={`${CELDA_BASE} font-bold`}
          valor={valor}
          onChange={(v) => actualizarCelda(hoja._id, fila._id, col.key, v)}
          onConfirmar={(codigo) => autollenarDesdeCodigo(hoja._id, fila._id, codigo)}
          estado={estados[fila._id]?.estado}
        />
      );
    }

    if (col.tipo === "numero") {
      return <NumeroStepper valor={valor} onChange={(v) => actualizarCelda(hoja._id, fila._id, col.key, v)} />;
    }

    // "Fecha de inicio de la vacancia": se autollena con la misma fecha
    // calculada que Mov. Posiciones > Tabla Principal (ver AnuenciaLookupView),
    // pero sigue siendo un campo editable como cualquier otro — el capturista
    // puede corregirla si hace falta. Mientras NO se edite a mano, un ícono a
    // la derecha permite abrir el mismo modal de Detalle de Vacancia; en
    // cuanto se edita, el vínculo con el modal se apaga (ya no representa el
    // valor calculado) y no vuelve a encenderse hasta resolver el código de
    // nuevo (ver `_fechaVacanciaEditada` en autollenarDesdeCodigo).
    if (col.tipo === "fecha_vacancia") {
      const esClicable = !fila._fechaVacanciaEditada && fila._movPosId !== null && fila._movPosId !== undefined && String(valor).trim() !== "";
      return (
        <div className="relative flex items-center h-full">
          <input
            type="date"
            value={valor}
            onChange={(e) => {
              const nuevoValor = e.target.value;
              parchearFilas(hoja._id, (filas) =>
                filas.map((f) => (f._id === fila._id ? { ...f, fecha_inicio_vacancia: nuevoValor, _fechaVacanciaEditada: true } : f))
              );
            }}
            className={`${CELDA_BASE} text-center ${esClicable ? "pr-6" : ""}`}
          />
          {esClicable && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => openVacanciaModal(fila)}
              title="Clic para ver detalle de vacancia"
              className="absolute right-1 text-[#bc955c] hover:text-[#621f32] dark:hover:text-[#bc955c] transition-colors cursor-pointer"
            >
              <MousePointerClick className="size-3.5" />
            </button>
          )}
        </div>
      );
    }

    // "Fecha de alta solicitada": sólo un aviso visual, de conocimiento nada
    // más — se sigue permitiendo capturar y calcular con esa fecha tal cual
    // (ver diasEntreFechas arriba). Dos casos, mismo ícono, mensaje distinto:
    // fecha de alta ANTES de que inicie la vacancia (dias < 0, no tiene
    // sentido pedir el alta antes de que la plaza esté vacante), o dentro de
    // los 30 días naturales posteriores (0 <= dias < 30).
    if (col.key === "fecha_alta_solicitada") {
      const dias = diasEntreFechas(fila.fecha_inicio_vacancia, valor);
      const esAnteriorAVacancia = dias !== null && dias < 0;
      const faltanDias = dias !== null && dias >= 0 && dias < DIAS_MINIMOS_VACANCIA;
      const esValida = dias !== null && dias >= DIAS_MINIMOS_VACANCIA;
      const mensajeAviso = esAnteriorAVacancia
        ? "La fecha de alta solicitada no puede ser anterior al inicio de la vacancia."
        : faltanDias
        ? "Aún no se han cumplido los 30 días de vacancia."
        : null;
      // Resalte de toda la celda (fondo + contorno), no sólo el ícono — más
      // visible a simple vista al recorrer el cuadro. Sin color cuando falta
      // alguna de las dos fechas (nada que validar todavía).
      const resalte = mensajeAviso
        ? "bg-amber-50 dark:bg-amber-950/40 ring-2 ring-inset ring-amber-400 dark:ring-amber-500"
        : esValida
        ? "bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-inset ring-emerald-400 dark:ring-emerald-600"
        : "";
      return (
        <div className={`relative flex items-center h-full w-full ${resalte}`}>
          <input
            type="date"
            value={valor}
            onChange={(e) => actualizarCelda(hoja._id, fila._id, col.key, e.target.value)}
            className={`${CELDA_BASE} bg-transparent text-center ${mensajeAviso ? "pr-6" : ""}`}
          />
          {mensajeAviso && (
            <span className="absolute right-1.5 text-amber-600 dark:text-amber-500" title={mensajeAviso}>
              <AlertTriangle className="size-3.5" />
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        type={col.tipo === "fecha" ? "date" : "text"}
        value={valor}
        onChange={(e) => actualizarCelda(hoja._id, fila._id, col.key, e.target.value)}
        // "Nivel Salarial" casi siempre llega autollenado (ver
        // autollenarDesdeCodigo, que ya reordena ahí mismo), pero sigue
        // siendo editable a mano — si se corrige, se reordena la hoja al
        // salir de la celda, no en cada tecla (evitaría que la fila salte de
        // lugar mientras todavía se está escribiendo el nivel).
        onBlur={col.key === "nivel_salarial" ? () => parchearFilas(hoja._id, ordenarFilasPorNivel) : undefined}
        className={`${CELDA_BASE} ${col.key === "denominacion_puesto" ? "text-left" : "text-center"}`}
      />
    );
  };

  const filasVirtuales = virtualizadorFilas.getVirtualItems();

  return (
    <div ref={cardRef} className="w-full px-0 sm:px-4 lg:px-6">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-200/20 dark:shadow-black/40">
        {/* Barra de acciones (no forma parte del formato oficial) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-2xl shadow-lg shadow-[#10243e]/30 text-white shrink-0">
              <FileSpreadsheet className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Anuencia -</h3>
                <input
                  type="text"
                  value={nombreArchivo}
                  onChange={(e) => setNombreArchivo(e.target.value)}
                  placeholder={ANEXO2_NOMBRE_ARCHIVO_DEFAULT}
                  title="Nombre con el que se descarga el .xlsx"
                  className="text-2xl font-black text-slate-500 dark:text-slate-400 tracking-tight bg-transparent outline-none border-b border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors min-w-[10ch] flex-1 max-w-[520px]"
                />
              </div>
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-1">
                Captura del Anexo 2 · escribe el Código Federal de Puesto y el resto de la fila se completa solo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-1.5 shrink-0">
            <button
              onClick={() => setIsHistorialOpen(true)}
              disabled={anexo3Bloqueado}
              title={anexo3Bloqueado ? "Cierra la pestaña del editor de Anexo 3 para continuar" : undefined}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <History className="size-3.5" />
              <span>Historial</span>
            </button>
            <button
              onClick={solicitarNuevoAnexo}
              disabled={anexo3Bloqueado}
              title={anexo3Bloqueado ? "Cierra la pestaña del editor de Anexo 3 para continuar" : "Empieza un anexo en blanco (avisa si hay cambios sin guardar)"}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <FilePlus2 className="size-3.5" />
              <span>Nuevo anexo</span>
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando || !hayCambiosSinGuardar || anexo3Bloqueado}
              title={anexo3Bloqueado ? "Cierra la pestaña del editor de Anexo 3 para continuar" : "Guarda el anexo en el historial sin descargar el .xlsx"}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {guardando ? (
                <div className="size-3.5 border-2 border-slate-300 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>{guardando ? "Guardando..." : "Guardar"}</span>
            </button>
            <button
              onClick={handleGenerarAnexo3}
              disabled={!hayPlazasCapturadas || anexo3Bloqueado}
              title={
                anexo3Bloqueado
                  ? "Ya tienes el editor de Anexo 3 abierto en otra pestaña"
                  : hayPlazasCapturadas
                  ? "Agrupa las plazas por Unidad Administrativa y período, y genera el FUMP"
                  : "Captura al menos una plaza con su Código Federal de Puesto"
              }
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileOutput className="size-3.5" />
              <span>Generar Anexo 3</span>
            </button>
            <button
              onClick={handleExportar}
              disabled={exportando || anexo3Bloqueado}
              title={anexo3Bloqueado ? "Cierra la pestaña del editor de Anexo 3 para continuar" : undefined}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#10243e] to-[#1a3b63] hover:from-[#152e4f] hover:to-[#1f4a7a] text-white px-4 py-2.5 min-h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {exportando ? (
                <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>{exportando ? "Generando..." : "Descargar Anexo 2"}</span>
            </button>
          </div>
        </div>

        {/* ---- Pestañas del libro ----
            Van ARRIBA de la hoja y no abajo como en Excel: el formato es muy
            alto (cuadro + justificación + firma), así que unas pestañas al pie
            obligarían a hacer scroll hasta el final cada vez que se quiere
            cambiar de hoja. */}
        <div className="flex items-end gap-1 overflow-x-auto custom-scrollbar pb-px">
          {hojas.map((h) => {
            const activa = h._id === hojaActiva._id;
            return (
              <div
                key={h._id}
                className={`group/tab flex items-center gap-1 pl-3 pr-1.5 py-2 rounded-t-xl border border-b-0 shrink-0 transition-colors ${
                  activa
                    ? "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 shadow-[0_-2px_8px_-4px_rgba(15,23,42,0.15)]"
                    : "bg-slate-100/70 dark:bg-slate-900/60 border-transparent hover:bg-slate-200/70 dark:hover:bg-slate-800/60"
                }`}
              >
                {activa ? (
                  // Ancho dinámico EXACTO al texto: un `<span>` invisible con
                  // el mismo texto y la misma tipografía se apila en la misma
                  // celda de grid que el input (truco de "ghost sizer") — el
                  // contenedor `inline-grid` termina midiendo lo que ese
                  // span mide de verdad, sin la aproximación de `Nch` (que
                  // se queda corta con fuentes en negrita: el ancho real de
                  // cada carácter es mayor al de la "0" en la que se basa esa
                  // unidad, y el error se acumula en nombres largos).
                  <span className="relative inline-grid">
                    <span aria-hidden="true" className="[grid-area:1/1] invisible whitespace-pre text-[11px] font-black px-px">
                      {h.nombre || " "}
                    </span>
                    <input
                      type="text"
                      value={h.nombre}
                      maxLength={NOMBRE_HOJA_MAX}
                      onChange={(e) => renombrarHoja(h._id, e.target.value)}
                      title="Nombre de la pestaña en el Excel"
                      className="[grid-area:1/1] w-full min-w-[3ch] bg-transparent outline-none text-[11px] font-black text-slate-800 dark:text-slate-100 border-b border-dashed border-transparent focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                    />
                  </span>
                ) : (
                  <button
                    onClick={() => setHojaActivaId(h._id)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {h.nombre || "(sin nombre)"}
                  </button>
                )}

                {hojas.length > 1 && (
                  <button
                    onClick={() => pedirEliminarHoja(h)}
                    title="Eliminar hoja"
                    className="opacity-0 group-hover/tab:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={agregarHoja}
            title="Agregar hoja"
            className="flex items-center gap-1.5 px-3 py-2 mb-px rounded-t-xl text-[10px] font-black uppercase tracking-wider text-[#10243e] dark:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Hoja</span>
          </button>
        </div>

        {/* ---- Hoja: reproduce el formato oficial ----
            Sin overflow-x-auto ni minWidth a propósito: el cuadro debe caber
            siempre en el ancho de la página (columnas por porcentaje, ver
            anchoColumnaPorcentaje) para no obligar a hacer scroll horizontal
            ni para llegar a los botones ni para leer la justificación. */}
        <div className="rounded-b-2xl rounded-tr-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-inner">
          <div className="p-5">
            {/* Encabezado del formato */}
            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase">
              {ANEXO2_TEXTOS.dependencia}
            </p>
            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 mt-0.5">
              {ANEXO2_TEXTOS.titulo}
            </p>

            <div className="flex items-start justify-between gap-6 mt-3 mb-2">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">{ANEXO2_TEXTOS.instruccion}</p>
              <div className="flex items-start gap-2 shrink-0 max-w-[420px] w-full">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 whitespace-nowrap">
                  Unidad Administrativa:
                </span>
                <textarea
                  rows={2}
                  value={hojaActiva.unidad_administrativa}
                  onChange={(e) => parchearHoja(hojaActiva._id, { unidad_administrativa: e.target.value })}
                  placeholder="Dirección General de..."
                  className="flex-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-[#621f32] dark:focus:border-[#bc955c] outline-none resize-none px-1 py-1 transition-colors"
                />
              </div>
            </div>

            {/* Cuadro de plazas — bloqueado mientras el Anexo 3 está abierto
                en su propia pestaña, para no editar sobre una captura que ya
                se le pasó (ver handleGenerarAnexo3). */}
            <div className="relative">
              {anexo3Bloqueado && (
                <div
                  onClick={() =>
                    toast.error("No puedes editar Anexo 2 mientras tienes el editor de anexo3 abierto, ciérralo para continuar.")
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  title="No puedes editar Anexo 2 mientras tienes el editor de anexo3 abierto"
                  className="absolute inset-0 z-10 cursor-not-allowed bg-white/40 dark:bg-slate-950/40 backdrop-blur-[1px] rounded-xl flex items-start justify-center pt-6"
                >
                  <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-slate-800/90 dark:bg-slate-700/90 shadow-lg">
                    Anexo 3 abierto en otra pestaña
                  </span>
                </div>
              )}
            <div ref={scrollCuadroRef} className="max-h-[65vh] min-h-[240px] overflow-y-auto custom-scrollbar rounded-lg">
              <table className="border-collapse w-full table-fixed">
                <colgroup>
                  {ANEXO2_COLUMNAS.map((col) => (
                    <Fragment key={col.key}>
                      <col style={{ width: `${anchoColumnaPorcentaje(col)}%` }} />
                      {col.esLlave && <col style={{ width: `${ANCHO_INFO_UA_PORCENTAJE}%` }} />}
                    </Fragment>
                  ))}
                  <col style={{ width: `${ANCHO_ACCION_PORCENTAJE}%` }} />
                </colgroup>
                <thead>
                  <tr>
                    {ANEXO2_COLUMNAS.map((col) => (
                      <Fragment key={col.key}>
                        <th className="sticky top-0 z-[1] border border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-2 align-middle text-center text-[9px] font-black text-slate-700 dark:text-slate-200 leading-tight">
                          {col.label}
                        </th>
                        {col.esLlave && (
                          <th
                            title="Sólo informativa — no forma parte del Anexo 2, no se incluye en el .xlsx"
                            className="sticky top-0 z-[1] border border-slate-400 dark:border-slate-600 bg-blue-100 dark:bg-blue-950/50 px-2 py-2 align-middle text-center text-[9px] font-black text-blue-700 dark:text-blue-300 leading-tight"
                          >
                            Unidad de Negocio (info)
                          </th>
                        )}
                      </Fragment>
                    ))}
                    {/* Columna de acciones — no forma parte del formato */}
                    <th className="sticky top-0 z-[1] w-10 bg-white dark:bg-slate-950" />
                  </tr>
                </thead>
                <tbody>
                  {/* Fila espaciadora de arriba: ocupa el alto exacto de todas
                      las filas anteriores a la ventana visible, para que el
                      scroll se sienta idéntico a tener las filas reales. */}
                  {filasVirtuales.length > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={totalColumnasCuadro} style={{ height: filasVirtuales[0].start, padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {filasVirtuales.map((filaVirtual) => {
                    const fila = hojaActiva.filas[filaVirtual.index];
                    if (!fila) return null;
                    return (
                      <tr key={fila._id} className="group">
                        {ANEXO2_COLUMNAS.map((col) => (
                          <Fragment key={col.key}>
                            <td className="border border-slate-400 dark:border-slate-600 p-0 h-9 align-middle">
                              {renderCelda(hojaActiva, fila, col)}
                            </td>
                            {col.esLlave && (
                              <td
                                title="Sólo informativa — no forma parte del Anexo 2, no se incluye en el .xlsx"
                                className="border border-slate-400 dark:border-slate-600 p-0 h-9 align-middle bg-blue-50/70 dark:bg-blue-950/20"
                              >
                                <p className="px-2 py-1.5 text-[10px] text-blue-800 dark:text-blue-300 truncate">
                                  {fila._unidadDeNegocioResuelta || "—"}
                                </p>
                              </td>
                            )}
                          </Fragment>
                        ))}
                        <td className="p-0 pl-1 align-middle">
                          <button
                            onClick={() => eliminarFila(hojaActiva._id, fila._id)}
                            title="Eliminar fila"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila espaciadora de abajo: el resto del alto total. */}
                  {filasVirtuales.length > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={totalColumnasCuadro}
                        style={{
                          height: virtualizadorFilas.getTotalSize() - filasVirtuales[filasVirtuales.length - 1].end,
                          padding: 0,
                          border: 0,
                        }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mensajes de autollenado — fuera del cuadro virtualizado (son
                pocos a la vez, no hace falta virtualizarlos también). */}
            {hojaActiva.filas.some((f) => estados[f._id]?.mensaje) && (
              <div className="flex flex-col gap-1 pt-2">
                {hojaActiva.filas.map((f) => {
                  const e = estados[f._id];
                  if (!e?.mensaje) return null;
                  const esError = e.estado === ESTADO.ERROR;
                  return (
                    <p
                      key={f._id}
                      className={`text-[10px] font-bold flex items-center gap-1.5 ${
                        esError
                          ? "text-amber-700 dark:text-amber-500"
                          : "text-emerald-700 dark:text-emerald-500"
                      }`}
                    >
                      {esError ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
                      <span className="font-bold">{f.codigo}</span> — {e.mensaje}
                    </p>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => agregarFila(hojaActiva._id)}
              className="mt-2 flex items-center gap-2 px-3 py-2 min-h-9 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#10243e] dark:text-[#bc955c] border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#10243e] dark:hover:border-[#bc955c] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Agregar plaza</span>
            </button>
            </div>

            <p className="text-[10px] italic text-slate-500 dark:text-slate-500 mt-3">
              {ANEXO2_TEXTOS.notaResponsabilidad}
            </p>

            {/* Bloque de justificación */}
            <div className="mt-6">
              <div className="flex items-start justify-between gap-3 border border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-2">
                <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 leading-snug">
                  {ANEXO2_TEXTOS.tituloJustificacion}
                </p>
                <button
                  onClick={() => setIsCatalogoOpen(true)}
                  title="Insertar una justificación guardada"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-[#10243e] dark:text-[#bc955c] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-[#10243e] dark:hover:border-[#bc955c] transition-colors shrink-0 cursor-pointer"
                >
                  <BookMarked className="size-3" />
                  <span>Catálogo</span>
                </button>
              </div>
              <div className="border border-t-0 border-slate-400 dark:border-slate-600">
                <textarea
                  ref={justificacionRef}
                  value={hojaActiva.justificacion}
                  onChange={(e) => parchearHoja(hojaActiva._id, { justificacion: e.target.value })}
                  rows={14}
                  placeholder="Escribe aquí la justificación de la ocupación de las plazas descritas en el cuadro anterior..."
                  className="w-full min-h-[280px] px-3 py-2.5 bg-transparent text-[11px] text-slate-800 dark:text-slate-100 leading-relaxed outline-none resize-none overflow-hidden text-justify focus:bg-[#621f32]/[0.03] dark:focus:bg-[#bc955c]/[0.06] transition-colors"
                />
              </div>
            </div>

            <p className="text-[10px] italic text-slate-500 dark:text-slate-500 mt-3">
              {ANEXO2_TEXTOS.notaLegible}
            </p>

            {/* Firma (celda F23:I24 en el original) — nombre y puesto de quien
                firma, editables. Es del libro completo (se repite al pie de
                cada hoja del .xlsx), por eso no vive dentro de `hojaActiva`. */}
            <div className="flex justify-center mt-10">
              <div className="flex flex-col items-center gap-1.5 w-full max-w-xs">
                <input
                  type="text"
                  value={firmaNombre}
                  onChange={(e) => setFirmaNombre(e.target.value)}
                  placeholder="Nombre de quien firma"
                  className="w-full text-center text-[11px] font-black text-slate-800 dark:text-slate-100 bg-transparent border-t border-slate-400 dark:border-slate-600 pt-1.5 outline-none focus:border-[#621f32] dark:focus:border-[#bc955c] transition-colors"
                />
                <input
                  type="text"
                  value={firmaPuesto}
                  onChange={(e) => setFirmaPuesto(e.target.value)}
                  placeholder="Puesto"
                  className="w-full text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-transparent outline-none focus:text-[#621f32] dark:focus:text-[#bc955c] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <VacanciaDetalleModal
        open={isVacanciaModalOpen}
        onClose={() => setIsVacanciaModalOpen(false)}
        detalle={vacanciaDetalle}
        isLoading={isVacanciaLoading}
      />

      <AnuenciaHistorialModal
        open={isHistorialOpen}
        onClose={() => setIsHistorialOpen(false)}
        onCargar={handleCargarDesdeHistorial}
      />

      <JustificacionCatalogoModal
        open={isCatalogoOpen}
        onClose={() => setIsCatalogoOpen(false)}
        onAgregar={handleAgregarJustificacionCatalogo}
      />

      <ConfirmModal
        open={hojaAEliminar !== null}
        onClose={() => setHojaAEliminar(null)}
        onConfirm={async () => eliminarHoja(hojaAEliminar._id)}
        title={`¿Eliminar la hoja "${hojaAEliminar?.nombre || ""}"?`}
        message="Se perderán las plazas y la justificación capturadas en esta hoja. Las demás hojas del anexo no se tocan."
        confirmLabel="Eliminar hoja"
      />

      <ConfirmModal
        open={confirmarNuevoAnexo}
        onClose={() => setConfirmarNuevoAnexo(false)}
        onConfirm={async () => ejecutarNuevoAnexo()}
        title="¿Empezar un anexo nuevo?"
        message="Tienes cambios sin guardar en este anexo — se perderán. Si quieres conservarlos, cierra esto y usa Guardar primero."
        confirmLabel="Descartar y empezar nuevo"
      />
    </div>
  );
}
