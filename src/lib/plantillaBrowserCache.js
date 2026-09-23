import { PlantillaService } from "@/services/plantilla.service";

/**
 * Cache de navegador (IndexedDB) para los datasets pesados de
 * `/dashboard/plantilla_empleados` (Plantilla Detalle, Mov. Posiciones,
 * Bajas). Ver PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md.
 *
 * Sin TTL de reloj, pero cada entrada guarda la fecha de la última corrida
 * exitosa de ZAFIRO vigente cuando se guardó (`fecha`) y la hora local
 * (`savedAt`). Al leer, `getDataset` consulta la última corrida del servidor
 * (la misma que muestra el Navbar): si es más nueva que la de la entrada, la
 * borra y regresa `null` (cache frío → fetch). Esto cubre al navegador que
 * estuvo cerrado y nunca recibió el SSE de ZAFIRO. Además, sigue valiendo
 * reemplazar entradas con `setDataset`/`patchDataset` por las 3 señales del
 * plan (SSE ZAFIRO, edición propia, `cell_update` ajeno).
 *
 * Entradas guardadas con el formato viejo (sin envoltorio) se consideran
 * caducas. Si el servidor no responde la fecha, se usa el cache tal cual
 * (mejor datos posiblemente viejos que nada).
 *
 * Todas las funciones fallan suave (resuelven `null`/no-op) si IndexedDB no
 * está disponible (SSR, modo privado agresivo, cuota agotada) — el llamador
 * debe tratar `null` igual que "cache frío" y hacer fetch normal.
 */

const DB_NAME = "plantilla_empleados_cache";
const DB_VERSION = 1;
const STORE = "datasets";

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.error("plantillaBrowserCache: no se pudo abrir IndexedDB", req.error);
        resolve(null);
      };
    });
  }
  return dbPromise;
}

const ENTRY_VERSION = 2;

let latestFecha = null; // ISO de la última corrida exitosa de ZAFIRO conocida
let fechaPromise = null;

/**
 * Lo llama ZafiroUpdatesContext cada vez que conoce una fecha real de ZAFIRO
 * (fetch REST o SSE). Debe llamarse ANTES de avisar a los suscriptores, para
 * que su `setDataset` posterior quede sellado con la fecha nueva.
 */
export function setLatestZafiroFecha(fecha) {
  if (fecha && !Number.isNaN(Date.parse(fecha))) latestFecha = fecha;
}

/** Última fecha de ZAFIRO conocida; la pide al servidor una sola vez por carga. */
function ensureLatestFecha() {
  if (latestFecha) return Promise.resolve(latestFecha);
  if (!fechaPromise) {
    fechaPromise = (async () => {
      try {
        const res = await PlantillaService.getUltimaActualizacion();
        if (res.ok) setLatestZafiroFecha((await res.json())?.fecha);
      } catch (err) {
        console.error("plantillaBrowserCache: no se pudo leer la última actualización", err);
      }
      fechaPromise = null; // permite reintento si falló
      return latestFecha;
    })();
  }
  return fechaPromise;
}

function idbGet(db, key) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch (err) {
      console.error(`plantillaBrowserCache: error leyendo "${key}"`, err);
      resolve(null);
    }
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      console.error(`plantillaBrowserCache: error escribiendo "${key}"`, err);
      resolve();
    }
  });
}

function isStale(entry, serverFecha) {
  if (!entry || entry.v !== ENTRY_VERSION) return true; // formato viejo
  if (!serverFecha) return false; // sin referencia: usar cache
  const server = Date.parse(serverFecha);
  const saved = entry.fecha ? Date.parse(entry.fecha) : entry.savedAt;
  return server > saved;
}

/** Lee la entrada completa (con sello) sin validar frescura. */
async function readEntry(key) {
  const db = await openDb();
  return db ? idbGet(db, key) : null;
}

/**
 * Lee un dataset cacheado. `null` si no existe, si IndexedDB falló o si es
 * anterior a la última corrida exitosa de ZAFIRO (en ese caso se elimina).
 */
export async function getDataset(key) {
  const db = await openDb();
  if (!db) return null;
  const [entry, serverFecha] = await Promise.all([idbGet(db, key), ensureLatestFecha()]);
  if (entry === null) return null;
  if (isStale(entry, serverFecha)) {
    await clearDataset(key);
    return null;
  }
  return entry.data;
}

/** Sobreescribe por completo un dataset (señal a: refetch tras evento ZAFIRO). */
export async function setDataset(key, data) {
  const db = await openDb();
  if (!db) return;
  const fecha = await ensureLatestFecha();
  await idbPut(db, key, { v: ENTRY_VERSION, fecha: fecha ?? null, savedAt: Date.now(), data });
}

/**
 * Parche quirúrgico sin refetch (señales b/c: edición propia o `cell_update`
 * ajeno). `updater` recibe el valor cacheado actual (o `null` si no había) y
 * regresa el nuevo valor completo a guardar. Si no había nada cacheado
 * todavía (o estaba caduco), no hace nada. Conserva el sello original: un
 * parche no vuelve "más fresca" la entrada respecto a ZAFIRO.
 */
export async function patchDataset(key, updater) {
  const current = await getDataset(key);
  if (current === null) return;
  const entry = await readEntry(key);
  const db = await openDb();
  if (!entry || !db) return;
  await idbPut(db, key, { ...entry, data: updater(current) });
}

/** Borra un dataset (poco uso esperado: solo para depuración/reset manual). */
export async function clearDataset(key) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Vacía TODOS los datasets cacheados (Plantilla Detalle, Mov. Posiciones,
 * Bajas...). Regresa `true` si se pudo vaciar, `false` si IndexedDB no está
 * disponible o falló. Lo usa Monitoreo ZAFIRO ("Borrar caché") para forzar
 * que el próximo montaje de `/plantilla_empleados` haga fetch a red.
 */
export async function clearAllDatasets() {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (err) {
      console.error("plantillaBrowserCache: error vaciando datasets", err);
      resolve(false);
    }
  });
}
