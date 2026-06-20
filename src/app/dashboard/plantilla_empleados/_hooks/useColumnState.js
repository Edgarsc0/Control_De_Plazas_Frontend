import { useState, useMemo, useCallback } from 'react';

/**
 * Estado de las columnas de una tabla: visibilidad, ancho y el modal de columnas.
 * @param {Array<{key: string, label: string, width: number, visible: boolean, isBasic?: boolean}>} initialColumns
 * @returns {{
 *   columns: Array<Object>,
 *   setColumns: Function,
 *   visibleColumns: Array<Object>,
 *   toggleVisibility: (key: string) => void,
 *   setWidth: (key: string, width: number) => void,
 *   isColumnsModalOpen: boolean,
 *   setColumnsModalOpen: (open: boolean) => void
 * }}
 */
export function useColumnState(initialColumns = []) {
  const [columns, setColumns] = useState(initialColumns);
  const [isColumnsModalOpen, setColumnsModalOpen] = useState(false);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const toggleVisibility = useCallback((key) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }, []);

  const setWidth = useCallback((key, width) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width } : c)));
  }, []);

  return { columns, setColumns, visibleColumns, toggleVisibility, setWidth, isColumnsModalOpen, setColumnsModalOpen };
}
