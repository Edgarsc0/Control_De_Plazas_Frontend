import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * Aplica sobre `initialColumns` la visibilidad/ancho guardados en `localStorage`
 * bajo `storageKey` (si existen), preservando el resto de cada columna (label,
 * isBasic, group...) tal cual viene de `initialColumns` — así un cambio de
 * catálogo de columnas en código no deja huérfano lo persistido.
 */
const applyPersistedColumns = (storageKey, initialColumns) => {
  if (!storageKey || typeof window === 'undefined') return initialColumns;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return initialColumns;
    const persisted = JSON.parse(raw);
    return initialColumns.map((c) => (
      persisted[c.key] ? { ...c, visible: persisted[c.key].visible ?? c.visible, width: persisted[c.key].width ?? c.width } : c
    ));
  } catch {
    return initialColumns;
  }
};

/**
 * Estado de las columnas de una tabla: visibilidad, ancho y el modal de columnas.
 * @param {Array<{key: string, label: string, width: number, visible: boolean, isBasic?: boolean}>} initialColumns
 * @param {?string} [storageKey] - 7.3 QA: si se provee, persiste visibilidad/ancho por usuario en `localStorage` bajo esta clave (se restaura al recargar).
 * @returns {{
 *   columns: Array<Object>,
 *   setColumns: Function,
 *   visibleColumns: Array<Object>,
 *   toggleVisibility: (key: string) => void,
 *   setWidth: (key: string, width: number) => void,
 *   resetWidth: (key: string) => void,
 *   isColumnsModalOpen: boolean,
 *   setColumnsModalOpen: (open: boolean) => void
 * }}
 */
export function useColumnState(initialColumns = [], storageKey) {
  const [columns, setColumns] = useState(() => applyPersistedColumns(storageKey, initialColumns));
  const [isColumnsModalOpen, setColumnsModalOpen] = useState(false);
  // Ancho "de fábrica" (el que trae `initialColumns` en código, ignorando lo
  // persistido en localStorage) — se refleja en cada render (no sólo al
  // montar) para que `resetWidth` (doble clic en el grip de resize) siga
  // funcionando en consumidores como `CatalogosEstructuraTab`, donde
  // `initialColumns` cambia de catálogo en catálogo sin desmontar el hook.
  const originalColumnsRef = useRef(initialColumns);
  originalColumnsRef.current = initialColumns;

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const toSave = {};
      columns.forEach((c) => { toSave[c.key] = { visible: c.visible, width: c.width }; });
      window.localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch {
      // localStorage lleno/deshabilitado: no es crítico, se ignora.
    }
  }, [columns, storageKey]);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const toggleVisibility = useCallback((key) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }, []);

  const setWidth = useCallback((key, width) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width } : c)));
  }, []);

  const resetWidth = useCallback((key) => {
    const original = originalColumnsRef.current.find((c) => c.key === key);
    if (!original) return;
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width: original.width } : c)));
  }, []);

  return { columns, setColumns, visibleColumns, toggleVisibility, setWidth, resetWidth, isColumnsModalOpen, setColumnsModalOpen };
}
