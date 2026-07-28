"use client";

import { memo, useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";

/**
 * Celda de fotografía para las tablas de plantilla.
 *
 * La tabla se sirve completa al cliente (sin paginar), así que precargar la
 * foto de cada fila significaría miles de peticiones y miles de lecturas de
 * disco en el backend por cada carga. Aquí la foto se pide SÓLO cuando la
 * celda entra realmente al viewport del contenedor con scroll: si la tabla
 * muestra 3 filas, se piden 3 fotos. La virtualización de `DataTable` monta
 * filas de más (overscan) que quedan fuera de pantalla; esas no disparan
 * ninguna petición porque el disparador es el IntersectionObserver, no el
 * montaje del componente.
 *
 * Endpoint: `GET /plantilla/empleado_foto/<numempleado>/` — el mismo que usa
 * el expediente (EmployeesModal). Devuelve el binario y exige el header
 * Authorization, por eso se pasa por `blob()` + Object URL en vez de poner la
 * URL directa en `<img src>`.
 */

// ── Caché compartida entre montajes ────────────────────────────────────────
// La virtualización desmonta/re-monta filas constantemente al hacer scroll;
// sin esta caché a nivel de módulo, volver a subir por la tabla re-pediría
// fotos ya descargadas. Guarda `null` para los empleados sin foto (404), para
// no reintentar en cada aparición.
const fotoCache = new Map(); // numempleado -> objectURL | null
const inflight = new Map(); // numempleado -> Promise<objectURL|null>

// Tope de Object URLs vivos (evicción FIFO). Muy por encima de las filas que
// caben en pantalla, así nunca se revoca una URL que se esté mostrando.
const CACHE_MAX = 400;

const evictIfNeeded = () => {
  while (fotoCache.size > CACHE_MAX) {
    const oldestKey = fotoCache.keys().next().value;
    const oldestUrl = fotoCache.get(oldestKey);
    fotoCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
};

// ── Cola con concurrencia limitada ─────────────────────────────────────────
// Al abrir la tabla entran ~25 filas a la vez; sin la cola serían 25 peticiones
// simultáneas (cada una lee un archivo de disco en el backend) compitiendo con
// el resto de llamadas de la pantalla.
const MAX_CONCURRENT = 4;
let activeCount = 0;
const pendingQueue = [];

const pump = () => {
  while (activeCount < MAX_CONCURRENT && pendingQueue.length > 0) {
    const task = pendingQueue.shift();
    activeCount += 1;
    task().finally(() => {
      activeCount -= 1;
      pump();
    });
  }
};

const enqueue = (task) =>
  new Promise((resolve) => {
    pendingQueue.push(() => task().then(resolve, () => resolve(null)));
    pump();
  });

/** Descarga (o reutiliza) la foto de un empleado. Nunca rechaza: sin foto = `null`. */
const fetchFotoEmpleado = (numempleado) => {
  if (fotoCache.has(numempleado)) return Promise.resolve(fotoCache.get(numempleado));
  if (inflight.has(numempleado)) return inflight.get(numempleado);

  const promise = enqueue(() =>
    // `cache: "default"` en vez del `no-store` global de apiFetch: el endpoint
    // manda ETag y `Cache-Control: private, max-age=86400`, así que el propio
    // navegador se queda las fotos y al recargar la página no vuelve a pegarle
    // al backend por las mismas imágenes.
    VacantesService.getEmpleadoFoto(numempleado, { cache: "default" })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null)
  ).then((url) => {
    fotoCache.set(numempleado, url);
    evictIfNeeded();
    inflight.delete(numempleado);
    return url;
  });

  inflight.set(numempleado, promise);
  return promise;
};

// Retardo entre "la celda es visible" y "pide la foto": con scroll rápido las
// filas cruzan el viewport en pocos milisegundos y sin esta espera se pedirían
// también las fotos de todo lo que se pasó de largo.
const VISIBILITY_DELAY_MS = 150;

/**
 * @param {Object} props
 * @param {?(string|number)} props.numempleado - Número de empleado (vacío en posiciones vacantes: no se pide nada).
 * @param {Object} [props.rootRef] - Ref del contenedor con scroll de la tabla; es el viewport contra el que se mide la visibilidad.
 * @param {boolean} [props.enabled=true] - `false` (sin permiso de ver fotografía) no dispara ninguna petición.
 * @param {number} [props.size=28] - Lado del avatar en px.
 */
const FotoEmpleadoCell = memo(function FotoEmpleadoCell({ numempleado, rootRef, enabled = true, size = 28 }) {
  const holderRef = useRef(null);
  const key = numempleado === null || numempleado === undefined ? "" : String(numempleado).trim();
  const [fotoUrl, setFotoUrl] = useState(() => (key ? fotoCache.get(key) ?? null : null));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !key) {
      setFotoUrl(null);
      setIsLoading(false);
      return;
    }
    if (fotoCache.has(key)) {
      setFotoUrl(fotoCache.get(key));
      setIsLoading(false);
      return;
    }

    setFotoUrl(null);
    setIsLoading(false);

    const el = holderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let cancelled = false;
    let timer = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry.isIntersecting) {
          clearTimeout(timer);
          timer = null;
          return;
        }
        timer = setTimeout(() => {
          observer.disconnect();
          if (cancelled) return;
          setIsLoading(true);
          fetchFotoEmpleado(key).then((url) => {
            if (cancelled) return;
            setFotoUrl(url);
            setIsLoading(false);
          });
        }, VISIBILITY_DELAY_MS);
      },
      { root: rootRef?.current ?? null }
    );

    observer.observe(el);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [key, enabled, rootRef]);

  const dimension = { width: size, height: size };

  return (
    <div ref={holderRef} className="flex items-center justify-center">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt=""
          style={dimension}
          className="rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        />
      ) : (
        <div
          style={dimension}
          className={`rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 ${isLoading ? "animate-pulse" : ""}`}
        >
          <User className="size-3.5 text-slate-300 dark:text-slate-600" />
        </div>
      )}
    </div>
  );
});

export default FotoEmpleadoCell;
