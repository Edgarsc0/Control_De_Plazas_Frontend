import { useState, useCallback } from 'react';

/**
 * Estado de selección de celda/fila: celda activa, datos de la fila, modal de
 * detalle de celda y menú contextual. Compartido por los tabs (tabla genérica).
 * @returns {{
 *   selectedCell: ({row: number, col: number}|null),
 *   selectedRowData: (Object|null),
 *   isCellModalOpen: boolean,
 *   contextMenu: ({x: number, y: number, row: Object}|null),
 *   selectCell: (cell: {row: number, col: number}) => void,
 *   openCellModal: (cell: {row: number, col: number}, rowData: Object) => void,
 *   closeCellModal: () => void,
 *   openContextMenu: (event: MouseEvent, row: Object) => void,
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

  const openContextMenu = useCallback((event, row) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, row });
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
