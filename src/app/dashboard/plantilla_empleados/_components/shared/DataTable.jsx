"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpDown, Filter, X, Check, Search, Eye } from "lucide-react";
import { getConditionLabel } from "@/utils/columnFilters";

gsap.registerPlugin(useGSAP);

const CONDITION_DROPDOWN_OPTIONS = [
  { key: "contains", label: "Contiene (*)" },
  { key: "not_contains", label: "No contiene (!*)" },
  { key: "starts_with", label: "Comienza con (^)" },
  { key: "not_starts_with", label: "No comienza con (!^)" },
  { key: "ends_with", label: "Termina con ($)" },
  { key: "not_ends_with", label: "No termina con (!$)" },
  { key: "equals", label: "Es igual a (=)" },
  { key: "not_equals", label: "Diferente de (!=)" },
];
const CONDITION_SYMBOLS = {
  contains: "*", not_contains: "!*", starts_with: "^", not_starts_with: "!^",
  ends_with: "$", not_ends_with: "!$", equals: "=", not_equals: "!=",
};

/**
 * Fila memoizada: sólo se re-renderiza si cambian sus propias props (row, selección,
 * columnas visibles...), no en cada `setState` no relacionado del tab padre (hover,
 * tooltip, dropdown, etc). Requiere que `renderCell`/`onRowClick`/`onSelectCell`/
 * `onCellContextMenu`/`onShowRecord` lleguen con identidad estable (useCallback) desde
 * el consumidor; de lo contrario el memo se invalida en cada render igualmente.
 */
const TableRow = memo(function TableRow({
  row,
  actualRowIdx,
  visible,
  stickyMeta,
  rowNumberOffset,
  isRowSelected,
  selectedColIdx,
  renderCell,
  onRowClick,
  onSelectCell,
  onCellContextMenu,
  onCellDoubleClick,
  onShowRecord,
  renderRowAction,
  preHidden,
}) {
  return (
    <tr className={`data-table-row hover:bg-[#621f32]/[0.015] h-[37px] cursor-pointer ${preHidden ? "invisible" : ""}`} onClick={() => onRowClick(actualRowIdx)}>
      <td className={`sticky left-0 z-25 text-center font-mono text-[10px] border-r h-[37px] px-4 align-middle ${isRowSelected ? "bg-[#f0e4e6] dark:bg-[#201015] text-[#621f32] font-black border-l-[#621f32] border-l-2" : "bg-white dark:bg-slate-950 text-slate-400"}`}>{rowNumberOffset + actualRowIdx + 1}</td>
      <td className={`sticky left-[50px] z-25 text-center border-r h-[37px] align-middle px-1 ${isRowSelected ? "bg-[#f0e4e6] dark:bg-[#201015]" : "bg-white dark:bg-slate-950"}`}>
        {renderRowAction
          ? renderRowAction({ row, actualRowIdx, isSelected: isRowSelected })
          : <button onClick={(e) => { e.stopPropagation(); onShowRecord(row); }} className="p-1 rounded-md text-slate-400 hover:text-[#621f32] dark:text-slate-500 dark:hover:text-[#bc955c] transition-colors cursor-pointer" title="Ver expediente detallado"><Eye className="size-4" /></button>}
      </td>
      {visible.map((col, colIdx) => {
        const { isSticky, leftOffset } = stickyMeta[colIdx];
        const value = row[col.key];
        const isSelected = isRowSelected && colIdx === selectedColIdx;
        const onClick = (e) => { e.stopPropagation(); onSelectCell({ row: actualRowIdx, col: colIdx }); };
        const onContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); onCellContextMenu(e, value, e.currentTarget.getBoundingClientRect(), row, col.key); };
        const onDoubleClick = onCellDoubleClick
          ? (e) => { e.stopPropagation(); onCellDoubleClick(e, value, row, col.key); }
          : undefined;
        return renderCell({ row, col, colIdx, actualRowIdx, value, isSticky, leftOffset, isSelected, onClick, onContextMenu, onDoubleClick });
      })}
    </tr>
  );
});

/**
 * Tabla genérica estilo Excel (sticky + resize + header de 2 filas +
 * virtualización por filas) compartida por los tabs de plantilla. El contenido
 * de cada celda lo provee el tab vía `renderCell` (mapeos de dominio: badges de
 * estado, moneda, etc.). El estado vive en los hooks (`useColumnState`,
 * `useColumnFilters`, `useSort`/sortConfig, `useCellSelection`).
 *
 * @param {Object} props
 * @param {Object} props.containerRef - Ref del contenedor con scroll (para scroll-into-view del tab).
 * @param {Object} props.tbodyRef - Ref del `<tbody>`.
 * @param {(scrollTop: number) => void} props.onScroll - Reporta el scroll vertical (para virtualización en el tab).
 * @param {Array<{key: string, label: string, width: number, visible: boolean, noFilter?: boolean, greenHeader?: boolean, yellowHeader?: boolean}>} props.columns - Columnas (todas; se filtran las visibles internamente). `noFilter` marca columnas sin dato filtrable (ej. la de fotografía): se les oculta el orden, el botón de filtro y el buscador de texto del encabezado. `greenHeader` pinta el encabezado de esa columna en verde (grupos visuales definidos por el tab, ej. columnas AL-AV de Plantilla Detalle) — cede ante el resaltado de selección/filtro activo. `yellowHeader` lo pinta en amarillo pálido (ej. columnas de solicitud de candidato en Plantilla Detalle) — a propósito tiene MÁS prioridad que la selección de columna (para que no desaparezca al seleccionar una celda de esa columna), pero cede ante un filtro activo.
 * @param {Object<string, string[]>} props.columnFilters - Filtros de valores activos (resalta header).
 * @param {Function} props.setColumnFilters - Setter de `columnFilters` (checkboxes por columna); usado por "Limpiar filtros de columna" además de `setTextFilters`.
 * @param {Object<string, {value: string, condition?: string}>} props.textFilters - Filtros de texto por columna.
 * @param {Function} props.setTextFilters - Setter de `textFilters`.
 * @param {?string} props.activeConditionDropdown - Columna con el dropdown de condición abierto.
 * @param {Function} props.setActiveConditionDropdown - Setter del anterior.
 * @param {?{row: number, col: number}} props.selectedCell - Celda seleccionada.
 * @param {(cell: {row: number, col: number}) => void} props.onSelectCell - Selecciona celda.
 * @param {(event: MouseEvent, value: *, rect: DOMRect, row: Object, colKey: string) => void} props.onCellContextMenu - Click derecho sobre celda (menú "copiar/pegar valor"); rect posiciona el resaltado punteado. `row`/`colKey` identifican la celda para soportar "pegar".
 * @param {(event: MouseEvent, value: *, row: Object, colKey: string) => void} [props.onCellDoubleClick] - Doble click sobre celda (ej. entrar a edición inline). Opcional: sin este prop no se agrega el listener.
 * @param {(row: Object) => void} props.onShowRecord - Abre el expediente de la fila (botón VER).
 * @param {{key: ?string, direction: ?string}} props.sortConfig - Estado de orden.
 * @param {(key: string) => void} props.onSort - Alterna orden por columna.
 * @param {(key: string) => void} props.onOpenFilter - Abre el dropdown de filtro de una columna.
 * @param {(event: MouseEvent, index: number, direction: ('left'|'right')) => void} props.onResizeStart - Inicia el resize de columna.
 * @param {(index: number) => string} props.getColumnLetter - Letra estilo hoja de cálculo.
 * @param {(key: string) => boolean} props.isMonoColumn - Si la columna usa `starts_with` por defecto / fuente mono.
 * @param {boolean} props.isPending - Overlay de "Procesando...".
 * @param {boolean} props.isLoading - Estado de carga inicial.
 * @param {string} [props.loadingMessage] - Mensaje de carga.
 * @param {Object[]} props.data - Filas visibles (slice virtualizado).
 * @param {number} props.startIndex - Índice de la primera fila visible.
 * @param {number} props.endIndex - Índice de la última fila visible.
 * @param {number} props.totalCount - Total de filas (para spacers de virtualización).
 * @param {number} props.rowHeight - Altura de fila en px.
 * @param {(row: Object, index: number) => (string|number)} [props.getRowId] - Clave de fila.
 * @param {(args: {row: Object, col: Object, colIdx: number, value: *, isSticky: boolean, leftOffset: number, isSelected: boolean, onClick: Function, onContextMenu: Function}) => JSX.Element} props.renderCell - Render del `<td>` de cada celda.
 * @param {(args: {row: Object, actualRowIdx: number, isSelected: boolean}) => JSX.Element} [props.renderRowAction] - Override del botón de la columna sticky "VER" (default: ícono de ojo + `onShowRecord`); úsalo para reemplazarlo por un checkbox de selección múltiple, por ejemplo.
 * @param {string} [props.rowActionHeaderLabel="VER"] - Texto del header de esa columna.
 * @param {(col: Object) => ?JSX.Element} [props.renderColumnHeaderExtra] - Contenido extra en el header de cada columna (entre el label y el botón de filtro); ej. un checkbox de prioridad. Su click no dispara `onSort`.
 * @param {boolean} [props.enableKeyboardNav=false] - Activa mover `selectedCell` con las flechas del teclado (con aceleración de paso al mantener presionado). Opt-in: no se activa por defecto para no duplicar listeners en tabs que ya implementan su propia navegación.
 * @param {() => void} [props.onEscape] - Callback al presionar Escape con `enableKeyboardNav` activo (ej. cerrar el menú contextual de copiar/pegar).
 * @returns {JSX.Element}
 */
function DataTable({
  containerRef,
  tbodyRef,
  onScroll,
  columns,
  columnFilters,
  setColumnFilters,
  textFilters,
  setTextFilters,
  activeConditionDropdown,
  setActiveConditionDropdown,
  selectedCell,
  onSelectCell,
  onCellContextMenu,
  onCellDoubleClick,
  onShowRecord,
  sortConfig,
  onSort,
  onOpenFilter,
  onResizeStart,
  getColumnLetter,
  isMonoColumn,
  isPending,
  isLoading,
  loadingVariant = 'spinner',
  loadingMessage = "Cargando...",
  rowNumberOffset = 0,
  isRowSelected = (idx) => selectedCell?.row === idx,
  isCellSelected = (idx, colIdx) => selectedCell?.row === idx && selectedCell?.col === colIdx,
  isColSelected = (idx) => selectedCell?.col === idx,
  onRowClick: onRowClickProp,
  data = [],
  startIndex,
  endIndex,
  totalCount,
  rowHeight,
  getRowId = (row, i) => row.id ?? i,
  renderCell,
  renderRowAction,
  rowActionHeaderLabel = "VER",
  renderColumnHeaderExtra,
  centerTable = false,
  fillWidth = false,
  fillHeight = false,
  edgeToEdge = false,
  stickyColumnKeys = null,
  enableKeyboardNav = false,
  onEscape,
}) {
  const visible = useMemo(() => columns.filter(c => c.visible), [columns]);
  const colSpan = visible.length + 2;
  const columnsWidth = 95 + visible.reduce((sum, col) => sum + col.width, 0);

  // Metadata de columnas "congeladas" (sticky), calculada una sola vez y
  // reutilizada por el header, la fila de filtros, el skeleton y el body — antes
  // cada uno recalculaba `isSticky`/`leftOffset` a mano asumiendo siempre las
  // primeras 2 columnas. Con `stickyColumnKeys` un consumidor puede fijar
  // cualquier subconjunto (ej. sólo "posicion"); sin la prop, cae al default
  // histórico (las 2 primeras columnas visibles).
  const stickyMeta = useMemo(() => {
    let offset = 95;
    let contiguous = true;
    return visible.map((col, idx) => {
      const isSticky = stickyColumnKeys ? stickyColumnKeys.includes(col.key) : idx < 2;
      const meta = { isSticky, leftOffset: offset };
      if (isSticky && contiguous) offset += col.width;
      else contiguous = false;
      return meta;
    });
  }, [visible, stickyColumnKeys]);

  // Dropdown de condición de filtro: se porta a `document.body` (posicionado por
  // el rect del botón) para no quedar recortado por el `overflow-auto` de la
  // tabla — el mismo problema que ya resolvía `ColumnsModal` con su propio portal.
  const [conditionDropdownRect, setConditionDropdownRect] = useState(null);
  const closeConditionDropdown = useCallback(() => {
    setActiveConditionDropdown(null);
    setConditionDropdownRect(null);
  }, [setActiveConditionDropdown]);
  useEffect(() => {
    if (!activeConditionDropdown) return;
    const scrollEl = containerRef?.current;
    if (!scrollEl) return;
    const handleScroll = () => closeConditionDropdown();
    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [activeConditionDropdown, containerRef, closeConditionDropdown]);

  // Navegación con flechas (opt-in vía `enableKeyboardNav`): mueve `selectedCell`
  // dentro de los límites de filas/columnas visibles, con aceleración de paso en
  // mantenido presionado. Refs (no deps de effect) para no remover/re-agregar el
  // listener global en cada cambio de selección/datos.
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const totalCountRef = useRef(totalCount);
  totalCountRef.current = totalCount;
  const visibleColCountRef = useRef(visible.length);
  visibleColCountRef.current = visible.length;
  const onSelectCellRef = useRef(onSelectCell);
  onSelectCellRef.current = onSelectCell;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const arrowRepeatRef = useRef(0);
  const hasRevealedRef = useRef(false);
  // Sólo los tabs cuyos datos ya vienen resueltos al montar (isLoading false
  // desde el primer render, ej. SSR) necesitan nacer ocultos por CSS para que
  // la cascada tenga algo que revelar (ver comentario del useGSAP más abajo).
  // Los tabs con fetch cliente (isLoading true al montar) nunca tuvieron ese
  // problema — se dejan con el comportamiento previo para no arriesgar filas
  // invisibles si `isLoading` pasa a false en un commit sin filas todavía.
  const needsPreHideRef = useRef(!isLoading);

  useEffect(() => {
    if (!enableKeyboardNav) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!e.key.startsWith('Arrow')) {
        if (e.key === 'Escape') onEscapeRef.current?.();
        return;
      }
      const prev = selectedCellRef.current;
      if (!prev) return;
      e.preventDefault();
      if (e.repeat) arrowRepeatRef.current += 1; else arrowRepeatRef.current = 1;
      let step = 1;
      if (arrowRepeatRef.current > 5) step = 2;
      if (arrowRepeatRef.current > 12) step = 5;
      if (arrowRepeatRef.current > 20) step = 10;
      if (arrowRepeatRef.current > 35) step = 20;
      let newRow = prev.row, newCol = prev.col;
      if (e.key === 'ArrowUp') newRow = Math.max(0, prev.row - step);
      if (e.key === 'ArrowDown') newRow = Math.min(totalCountRef.current - 1, prev.row + step);
      if (e.key === 'ArrowLeft') newCol = Math.max(0, prev.col - step);
      if (e.key === 'ArrowRight') newCol = Math.min(visibleColCountRef.current - 1, prev.col + step);
      onSelectCellRef.current({ row: newRow, col: newCol });
    };
    const handleKeyUp = (e) => { if (e.key.startsWith('Arrow')) arrowRepeatRef.current = 0; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enableKeyboardNav]);

  // Header agrupado (opt-in, no afecta tabs que no usan `col.group`): dos o más
  // columnas consecutivas que comparten `col.group` (p.ej. "MOV_POS"/"PLANTILLA"
  // bajo un mismo campo comparado) se fusionan en una celda superior con el
  // nombre del grupo, y cada una conserva su propio sub-header (label, orden,
  // filtro) en la fila de abajo — formando una "T" por grupo. Columnas sin
  // `group` siguen exactamente igual que antes (rowSpan de 2 en vez de 1 fila).
  const hasGroups = useMemo(() => visible.some(c => c.group), [visible]);
  const headerGroupRuns = useMemo(() => {
    if (!hasGroups) return null;
    const runs = [];
    let i = 0;
    while (i < visible.length) {
      const col = visible[i];
      if (col.group) {
        let j = i + 1;
        while (j < visible.length && visible[j].group === col.group) j++;
        runs.push({ type: 'group', label: col.group, startIndex: i, span: j - i });
        i = j;
      } else {
        runs.push({ type: 'single', startIndex: i, span: 1 });
        i += 1;
      }
    }
    return runs;
  }, [visible, hasGroups]);

  // Identidad estable: si el consumidor no pasa `onRowClick`, el default no debe
  // recrearse en cada render (invalidaría el memo de TableRow).
  const fallbackOnRowClick = useCallback(
    (idx) => onSelectCell({ row: idx, col: selectedCell?.col ?? 0 }),
    [onSelectCell, selectedCell?.col]
  );
  const onRowClick = onRowClickProp ?? fallbackOnRowClick;

  // Cascada estilo AG-Grid: al terminar de cargar (isLoading true -> false),
  // las filas ya montadas entran con un stagger rápido de arriba hacia abajo.
  // Mira `isLoading` y `hasRows` (booleano derivado, no `data` en crudo) como
  // dependencias — no `data` directamente para no repetir la animación en
  // cada slice que entrega la virtualización al hacer scroll.
  //
  // `needsPreHideRef`/`hasRevealedRef` tapan el FOUC de la primera carga en
  // tabs cuyos datos llegan ya resueltos por props (SSR, ej. Plantilla
  // Detalle/Bajas): las filas existen en el HTML antes de que corra este
  // efecto, así que sin esto se verían de golpe (el navegador ya las pintó).
  // Esas primeras filas nacen con la clase `invisible` (ver TableRow) y este
  // efecto las revela con `autoAlpha` (opacity+visibility) en cuanto monta.
  // Tras la primera revelada, `hasRevealedRef` queda en true y las filas que
  // entren después por scroll/virtualización ya no nacen ocultas.
  // `hasRows` (además de `isLoading`) en las dependencias: consumidores como
  // DetalleVacantesTablas.jsx abren el modal con `rowData` todavía vacío y
  // nunca pasan `rowsLoading` (isLoading se queda en `false` todo el tiempo,
  // jamás transiciona) — si el primer montaje de este efecto encontraba el
  // tbody sin `<tr>` (rowData llega un tick después vía otro setState),
  // `hasRevealedRef` nunca se marcaba true y, como `isLoading` no volvía a
  // cambiar, las filas quedaban con la clase `invisible` para siempre (bug
  // real: tabla en blanco pese al contador de registros correcto). Con
  // `hasRows` el efecto reintenta en cuanto pasa de 0 a >0 filas.
  const hasRows = data.length > 0;
  useGSAP(() => {
    if (isLoading) return;
    const rows = tbodyRef?.current?.querySelectorAll("tr.data-table-row");
    if (!rows || !rows.length) return;
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(rows, { autoAlpha: 1 });
    } else {
      // `clearProps: "transform"` es necesario porque GSAP deja un `transform`
      // inline (matriz identidad) en cada `<tr>` al terminar el tween: eso solo
      // no debería notarse, pero en una tabla `border-collapse` Chrome deja de
      // dibujar los bordes colapsados de cualquier fila con `transform` inline,
      // aunque sea la identidad — los bordes de la tabla desaparecen tras la
      // primera animación de revelado si no se limpia.
      gsap.from(rows, { autoAlpha: 0, y: -10, duration: 0.28, stagger: 0.015, ease: "power1.out", clearProps: "transform" });
    }
    hasRevealedRef.current = true;
  }, { scope: tbodyRef, dependencies: [isLoading, hasRows] });

  return (
    <div ref={containerRef} onScroll={(e) => onScroll(e.currentTarget.scrollTop)} className={`overflow-auto relative flex-1 min-h-0 border border-slate-200/50 dark:border-slate-800/80 shadow-inner ${edgeToEdge ? "" : "mx-2 lg:mx-6 mb-4"}`} style={fillHeight ? undefined : { height: 'calc(100vh - 280px)' }}>
      <AnimatePresence>{isPending && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/30 backdrop-blur-[3px] z-40 flex items-center justify-center"><div className="flex flex-col items-center gap-3.5 p-6 bg-white/95 rounded-[2rem] shadow-2xl border border-slate-200/50"><div className="size-8 border-[4px] border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" /><span className="text-[10px] font-black uppercase text-[#621f32] bg-[#621f32]/5 px-3.5 py-1 rounded-xl">Procesando...</span></div></motion.div>)}</AnimatePresence>
      <table className={`text-left text-gray-500 border-collapse ${centerTable && !fillWidth ? "mx-auto" : ""}`} style={{ tableLayout: "fixed", width: fillWidth ? "100%" : columnsWidth, minWidth: columnsWidth }}>
        <colgroup><col style={{ width: 50 }} /><col style={{ width: 45 }} />{visible.map(col => <col key={col.key} style={{ width: col.width }} />)}</colgroup>
        <thead className="bg-[#501929] dark:bg-[#3e131f] text-white sticky top-0 z-30 shadow-md">
          {hasGroups ? (
            <>
              <tr>
                <th rowSpan={2} className="sticky left-0 top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35">#</th>
                <th rowSpan={2} className="sticky left-[50px] top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35 px-1"><span className="text-[9px] font-bold text-slate-500">{rowActionHeaderLabel}</span></th>
                {headerGroupRuns.map((run) => {
                  if (run.type === 'group') {
                    return (
                      <th key={`group-${run.startIndex}`} colSpan={run.span} className="py-1.5 px-3 text-center font-black text-[10px] uppercase border-r border-b-2 border-[#621f32]/30 border-b-[#bc955c]/70 bg-[#3e131f] dark:bg-[#2b0d15] text-[#bc955c]">
                        {run.label}
                      </th>
                    );
                  }
                  const index = run.startIndex;
                  const col = visible[index];
                  const { isSticky, leftOffset } = stickyMeta[index];
                  const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
                  const bgClass = hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : (col.yellowHeader ? "bg-[#ffffa6] dark:bg-[#ffffa6]/25 text-slate-900 dark:text-yellow-50" : (isColSelected(index) ? "bg-[#621f32] text-white" : (col.greenHeader ? "bg-emerald-800 dark:bg-emerald-900 text-emerald-50" : "bg-[#501929] text-slate-200")));
                  const filterTitle = columnFilters[col.key]?.length > 0
                    ? `${columnFilters[col.key].length} valor(es) filtrado(s)`
                    : "Filtrar columna";
                  return (
                    <th key={col.key} rowSpan={2} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${bgClass} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                      {hasFilter && <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />}
                      <div className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'left')} />
                      <div className="flex flex-col items-center gap-1 w-full">
                        <span className={`text-[9px] font-mono ${hasFilter ? 'text-[#3e131f]/70' : 'text-[#bc955c]'}`}>{getColumnLetter(index)}</span>
                        <div className="flex items-center justify-between w-full">
                          <div
                            onClick={() => onSort(col.key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(col.key); } }}
                            title={col.label}
                            className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                          >
                            <span>{col.label}</span>
                            <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />
                          </div>
                          {renderColumnHeaderExtra && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">{renderColumnHeaderExtra(col)}</div>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); onOpenFilter(col.key); }} title={filterTitle} className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}>
                            <Filter className="size-3 fill-current" />
                          </button>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'right')} />
                    </th>
                  );
                })}
              </tr>
              <tr>
                {headerGroupRuns.filter(r => r.type === 'group').flatMap((run) =>
                  Array.from({ length: run.span }).map((_, offset) => {
                    const index = run.startIndex + offset;
                    const col = visible[index];
                    const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
                    const bgClass = hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : (col.yellowHeader ? "bg-[#ffffa6] dark:bg-[#ffffa6]/25 text-slate-900 dark:text-yellow-50" : (isColSelected(index) ? "bg-[#621f32] text-white" : (col.greenHeader ? "bg-emerald-800 dark:bg-emerald-900 text-emerald-50" : "bg-[#501929] text-slate-200")));
                    const filterTitle = columnFilters[col.key]?.length > 0
                      ? `${columnFilters[col.key].length} valor(es) filtrado(s)`
                      : "Filtrar columna";
                    const isInternalSplit = offset < run.span - 1;
                    return (
                      <th key={col.key} className={`relative py-2 px-3 font-black text-[10px] uppercase transition-colors ${isInternalSplit ? "border-r-2 border-[#bc955c]/60" : "border-r border-[#621f32]/30"} ${bgClass}`}>
                        {hasFilter && <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />}
                        <div className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'left')} />
                        <div className="flex items-center justify-between w-full">
                          <div
                            onClick={() => onSort(col.key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(col.key); } }}
                            title={col.label}
                            className="flex items-center gap-1.5 cursor-pointer flex-1 truncate py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                          >
                            <span>{col.label}</span>
                            <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); onOpenFilter(col.key); }} title={filterTitle} className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}>
                            <Filter className="size-3 fill-current" />
                          </button>
                        </div>
                        <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'right')} />
                      </th>
                    );
                  })
                )}
              </tr>
            </>
          ) : (
          <tr>
            <th className="sticky left-0 top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35">#</th>
            <th className="sticky left-[50px] top-0 z-40 bg-[#40121e] text-center align-middle border-r border-[#621f32]/35 px-1"><span className="text-[9px] font-bold text-slate-500">{rowActionHeaderLabel}</span></th>
            {visible.map((col, index) => {
              const { isSticky, leftOffset } = stickyMeta[index];
              const hasFilter = columnFilters[col.key]?.length > 0 || !!(textFilters[col.key] && textFilters[col.key].value);
              const bgClass = hasFilter ? "bg-[#bc955c] text-slate-900 shadow-inner" : (col.yellowHeader ? "bg-[#ffffa6] dark:bg-[#ffffa6]/25 text-slate-900 dark:text-yellow-50" : (isColSelected(index) ? "bg-[#621f32] text-white" : (col.greenHeader ? "bg-emerald-800 dark:bg-emerald-900 text-emerald-50" : "bg-[#501929] text-slate-200")));
              const filterTitle = columnFilters[col.key]?.length > 0
                ? `${columnFilters[col.key].length} valor(es) filtrado(s)`
                : "Filtrar columna";
              return (
                <th key={col.key} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`relative py-2.5 px-4 font-black text-[10px] uppercase border-r border-[#621f32]/30 transition-colors ${bgClass} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                  {hasFilter && <div className="absolute top-1 right-1 size-2 bg-white rounded-full animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)]" title="Filtro activo" />}
                  <div className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'left')} />
                  <div className="flex flex-col items-center gap-1 w-full">
                    <span className={`text-[9px] font-mono ${hasFilter ? 'text-[#3e131f]/70' : 'text-[#bc955c]'}`}>{getColumnLetter(index)}</span>
                    <div className="flex items-center justify-between w-full">
                      <div onClick={() => { if (!col.noFilter) onSort(col.key); }} className={`flex items-center gap-1.5 flex-1 truncate py-0.5 ${col.noFilter ? "" : "cursor-pointer"}`}>
                        <span>{col.label}</span>
                        {!col.noFilter && <ArrowUpDown className={`size-3 transition-opacity ${sortConfig.key === col.key ? "opacity-100" : "opacity-0"}`} />}
                      </div>
                      {renderColumnHeaderExtra && (
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">{renderColumnHeaderExtra(col)}</div>
                      )}
                      {!col.noFilter && (
                        <button onClick={(e) => { e.stopPropagation(); onOpenFilter(col.key); }} title={filterTitle} className={`p-1 rounded-md transition-colors ${hasFilter ? "text-[#3e131f]" : "text-white/60"}`}>
                          <Filter className="size-3 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20" onMouseDown={(e) => onResizeStart(e, columns.findIndex(c => c.key === col.key), 'right')} />
                </th>
              );
            })}
          </tr>
          )}
          <tr className="bg-[#40121e] dark:bg-[#2b0d15]">
            <th className="sticky left-0 z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35">
              <button
                onClick={() => { setTextFilters({}); setColumnFilters?.({}); }}
                disabled={
                  (Object.keys(textFilters).length === 0 || Object.values(textFilters).every(v => !v || !v.value)) &&
                  Object.keys(columnFilters || {}).length === 0
                }
                title="Limpiar filtros de columna"
                className="size-full flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-0 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </th>
            <th className="sticky left-[50px] z-40 bg-[#40121e] dark:bg-[#2b0d15] border-r border-[#621f32]/35"></th>
            {visible.map((col, colIdx) => {
              const filterObj = textFilters[col.key] || { value: "", condition: isMonoColumn(col.key) ? "starts_with" : "contains" };
              const condition = filterObj.condition || (isMonoColumn(col.key) ? "starts_with" : "contains");
              const { isSticky, leftOffset } = stickyMeta[colIdx];
              const symbol = CONDITION_SYMBOLS[condition] || "*";

              // Columnas sin dato filtrable (ej. la de fotografía): sólo se
              // deja la celda vacía, sin buscador ni selector de condición.
              if (col.noFilter) {
                return (
                  <th key={`filter-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`p-1.5 border-r border-[#621f32]/30 ${isSticky ? 'bg-[#40121e] dark:bg-[#2b0d15] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`} />
                );
              }

              return (
                <th key={`filter-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 35 } : {}} className={`p-1.5 border-r border-[#621f32]/30 relative ${isSticky ? 'bg-[#40121e] dark:bg-[#2b0d15] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]' : ''}`}>
                  <div className="relative flex items-center w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeConditionDropdown === col.key) {
                          closeConditionDropdown();
                        } else {
                          setConditionDropdownRect(e.currentTarget.getBoundingClientRect());
                          setActiveConditionDropdown(col.key);
                        }
                      }}
                      title={`Condición: ${getConditionLabel(condition)}`}
                      className="absolute left-1.5 z-10 size-4 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 rounded text-white text-[8px] font-black cursor-pointer select-none transition-colors"
                    >
                      {symbol}
                    </button>
                    <input
                      type="text"
                      value={filterObj.value || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextFilters(prev => {
                          const next = { ...prev };
                          if (val === "") {
                            delete next[col.key];
                          } else {
                            next[col.key] = { value: val, condition };
                          }
                          return next;
                        });
                      }}
                      placeholder="Filtrar..."
                      className="w-full bg-white/10 hover:bg-white/20 focus:bg-white/30 text-white text-[9px] font-bold placeholder-white/30 rounded-md py-1.5 pl-7 pr-2 outline-none transition-all border border-white/5 focus:border-[#bc955c]/50"
                    />
                    {activeConditionDropdown === col.key && conditionDropdownRect && typeof document !== "undefined" && createPortal(
                      <>
                        <div className="fixed inset-0 z-[110] bg-transparent" onClick={(e) => { e.stopPropagation(); closeConditionDropdown(); }} />
                        <div
                          className="fixed z-[120] w-36 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 text-left text-slate-200"
                          style={{ top: conditionDropdownRect.bottom + 4, left: conditionDropdownRect.left }}
                        >
                          {CONDITION_DROPDOWN_OPTIONS.map(item => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTextFilters(prev => ({ ...prev, [col.key]: { value: filterObj.value, condition: item.key } }));
                                closeConditionDropdown();
                              }}
                              className={`px-2 py-1 text-[9px] font-bold rounded-lg text-left transition-colors cursor-pointer w-full flex items-center justify-between ${condition === item.key ? "bg-[#bc955c] text-slate-950" : "hover:bg-white/10"}`}
                            >
                              <span>{item.label}</span>
                              {condition === item.key && <Check className="size-2.5" />}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={tbodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {isLoading ? (
            loadingVariant === 'skeleton' ? (
              Array.from({ length: 15 }).map((_, rIdx) => (
                <tr key={`skeleton-row-${rIdx}`} className="h-[37px] bg-white dark:bg-slate-950">
                  <td className="sticky left-0 z-25 text-center border-r h-[37px] px-4 align-middle bg-white dark:bg-slate-950"><div className="h-3 w-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto animate-pulse" /></td>
                  <td className="sticky left-[50px] z-25 text-center border-r h-[37px] align-middle px-1 bg-white dark:bg-slate-950"><div className="size-5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto animate-pulse" /></td>
                  {visible.map((col, colIdx) => {
                    const { isSticky, leftOffset } = stickyMeta[colIdx];
                    const widthClass = colIdx % 3 === 0 ? "w-5/6" : colIdx % 3 === 1 ? "w-2/3" : "w-3/4";
                    return (<td key={`skeleton-td-${col.key}`} style={isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {}} className="px-4 border-r h-[37px] align-middle bg-white dark:bg-slate-950 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]"><div className={`h-3 ${widthClass} bg-slate-200 dark:bg-slate-800 rounded animate-pulse`} /></td>);
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colSpan} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="size-10 border-4 border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-450 uppercase tracking-widest animate-pulse">{loadingMessage}</p>
                  </div>
                </td>
              </tr>
            )
          ) : data.length === 0 ? (
            (() => {
              const activeFilterCount = Object.keys(columnFilters || {}).length + Object.values(textFilters || {}).filter((f) => f?.value).length;
              return (
                <tr>
                  <td colSpan={colSpan} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="size-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Search className="size-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-700 dark:text-slate-300">Sin coincidencias</h4>
                      <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                        {activeFilterCount > 1
                          ? `0 resultados por la combinación de ${activeFilterCount} filtros de columna activos. Prueba quitando alguno.`
                          : "Intenta ajustar tus filtros de búsqueda"}
                      </p>
                    </div>
                  </td>
                </tr>
              );
            })()
          ) : (
            <>
              {startIndex > 0 && <tr style={{ height: startIndex * rowHeight }}><td colSpan={colSpan} /></tr>}
              {data.map((row, rowIdx) => {
                const actualRowIdx = startIndex + rowIdx;
                const rowSelected = isRowSelected(actualRowIdx);
                let selectedColIdx = null;
                if (rowSelected) {
                  const foundIdx = visible.findIndex((_, colIdx) => isCellSelected(actualRowIdx, colIdx));
                  selectedColIdx = foundIdx === -1 ? null : foundIdx;
                }
                return (
                  <TableRow
                    key={getRowId(row, actualRowIdx)}
                    row={row}
                    actualRowIdx={actualRowIdx}
                    visible={visible}
                    stickyMeta={stickyMeta}
                    rowNumberOffset={rowNumberOffset}
                    isRowSelected={rowSelected}
                    selectedColIdx={selectedColIdx}
                    renderCell={renderCell}
                    onRowClick={onRowClick}
                    onSelectCell={onSelectCell}
                    onCellContextMenu={onCellContextMenu}
                    onCellDoubleClick={onCellDoubleClick}
                    onShowRecord={onShowRecord}
                    renderRowAction={renderRowAction}
                    preHidden={needsPreHideRef.current && !hasRevealedRef.current}
                  />
                );
              })}
              {endIndex < totalCount && <tr style={{ height: (totalCount - endIndex) * rowHeight }}><td colSpan={colSpan} /></tr>}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(DataTable);
