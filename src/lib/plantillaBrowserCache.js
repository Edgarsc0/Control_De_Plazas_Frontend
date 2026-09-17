/**
 * Cache de navegador (IndexedDB) para los datasets pesados de
 * `/dashboard/plantilla_empleados` (Plantilla Detalle, Mov. Posiciones,
 * Bajas). Ver PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md.
 *
 * Sin TTL: la única forma de reemplazar una entrada es llamando a
 * `setDataset`/`patchDataset` explícitamente, disparado por una de las 3
 * señales del plan (evento SSE de ZAFIRO, edición propia, `cell_update`
 * ajeno). Nunca expira sola.
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

/** Lee un dataset cacheado. `null` si no existe o si IndexedDB falló. */
export async function getDataset(key) {
  const db = await openDb();
  if (!db) return null;
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

/** Sobreescribe por completo un dataset (señal a: refetch tras evento ZAFIRO). */
export async function setDataset(key, data) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      console.error(`plantillaBrowserCache: error escribiendo "${key}"`, err);
      resolve();
    }
  });
}

/**
 * Parche quirúrgico sin refetch (señales b/c: edición propia o `cell_update`
 * ajeno). `updater` recibe el valor cacheado actual (o `null` si no había) y
 * regresa el nuevo valor completo a guardar. Si no había nada cacheado
 * todavía, no hace nada (no hay nada que parchear — llegará completo en el
 * próximo refetch/señal a).
 */
export async function patchDataset(key, updater) {
  const current = await getDataset(key);
  if (current === null) return;
  await setDataset(key, updater(current));
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
