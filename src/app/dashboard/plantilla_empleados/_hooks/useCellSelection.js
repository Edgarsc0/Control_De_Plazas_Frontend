import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Estado de selección de celda/fila: celda activa, datos de la fila, modal de
 * detalle de celda y menú contextual. Compartido por los tabs (tabla genérica).
 * @returns {{
 *   selectedCell: ({row: number, col: number}|null),
 *   selectedRowData: (Object|null),
 *   isCellModalOpen: boolean,
 *   contextMenu: ({x: number, y: number, value: *, rect: ?DOMRect}|null),
 *   selectCell: (cell: {row: number, col: number}) => void,
 *   openCellModal: (cell: {row: number, col: number}, rowData: Object) => void,
 *   closeCellModal: () => void,
 *   openContextMenu: (event: MouseEvent, value: *, rect: ?DOMRect) => void,
 *   closeContextMenu: () => void
 * }}
 */
export function useCellSelection() {
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const selectCell = useCallback((cell) => setSelectedCell(cell), []);

  const openCellModal = useCallback((cell, rowData) => {
    setSelectedCell(cell);
    setSelectedRowData(rowData);
    setIsCellModalOpen(true);
  }, []);

  const closeCellModal = useCallback(() => setIsCellModalOpen(false), []);

  const openContextMenu = useCallback((event, value, rect) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, value, rect });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return {
    selectedCell, selectedRowData, isCellModalOpen, contextMenu,
    // setters crudos (compatibilidad directa al cablear en los tabs)
    setSelectedCell, setSelectedRowData, setIsCellModalOpen, setContextMenu,
    // métodos semánticos (preferidos en código nuevo)
    selectCell, openCellModal, closeCellModal, openContextMenu, closeContextMenu,
  };
}

/**
 * Limpia la celda seleccionada cuando cambia cualquier criterio de
 * filtrado/orden de la tabla (`deps`). Evita el BUG-05 del QA: la selección es
 * posicional (`{row, col}` por índice), así que tras refiltrar/reordenar el
 * chip "seleccionado" podía terminar apuntando a otro registro sin que el
 * usuario lo notara. No corre en el primer render (sólo ante cambios reales).
 * @param {(cell: null) => void} setSelectedCell
 * @param {Array} deps - Criterios que invalidan la selección (filtros, orden, búsqueda...).
 */
export function useClearSelectionOnFilterChange(setSelectedCell, deps) {
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setSelectedCell(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
