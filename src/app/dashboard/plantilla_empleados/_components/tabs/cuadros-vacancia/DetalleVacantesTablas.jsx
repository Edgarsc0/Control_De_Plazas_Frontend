import { useMemo, useState, useCallback } from 'react';
import { TableProperties, Inbox } from 'lucide-react';
import EmployeesModal, { ALL_AVAILABLE_COLUMNS } from '../../shared/EmployeesModal';
import { mapVacanteRowToEmployeeRow } from '../../shared/mapVacanteRow';

// Whitelist del selector "Columnas" de EmployeesModal — derivada de
// ALL_AVAILABLE_COLUMNS (fuente única en EmployeesModal.jsx) en vez de una
// lista duplicada a mano, para que nunca haya mismatch entre lo que el
// backend entrega (DesgloseJerarquicoView / DesgloseJerarquicoOcupadosView,
// ambos ampliados a devolver todas las columnas de EMPLEADOS_COMPLETOS_SIG) y
// lo que el botón "Columnas" ofrece seleccionar.
const ALL_COLUMN_KEYS = ALL_AVAILABLE_COLUMNS.map(col => col.key);
const DETALLE_VACANTES_COLUMN_KEYS = ALL_COLUMN_KEYS;

// Ocupación: mismo universo que Vacancia — ambos endpoints ya devuelven todas
// las columnas (incluida identidad de empleado, que en filas de vacantes
// simplemente queda vacía porque no hay persona asignada a la plaza).
const DETALLE_OCUPACION_COLUMN_KEYS = ALL_COLUMN_KEYS;
const DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS = ['id_empleado', 'nombres', 'rfc', 'curp', 'posicion', 'nivel', 'nombre_puesto_funcional'];

function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Orden pedido en pantalla: J, K, A, S, D, P y Operativos. `wide: true` = 2
// vías (Eventuales combinado + Permanentes, tabla VacanciaTableK), igual que
// hoy K y Operativos; `wide: false` = 3 vías (Eventuales/Evt. Nueva
// Creación/Permanentes, VacanciaTable), igual que hoy P/A/S/D. J se trata
// como 3 vías (supuesto — ver plan; no hay forma de confirmarlo desde el
// query de referencia de niveles).
const LEVELS_ORDER = [
  { key: 'J', vacLabel: 'Vacancia del nivel J', ocupLabel: 'Ocupación del nivel J', wide: false },
  { key: 'K', vacLabel: 'Vacancia del nivel K', ocupLabel: 'Ocupación del nivel K', wide: true },
  { key: 'A', vacLabel: 'Vacancia del nivel A', ocupLabel: 'Ocupación del nivel A', wide: false },
  { key: 'S', vacLabel: 'Vacancia del nivel S', ocupLabel: 'Ocupación del nivel S', wide: false },
  { key: 'D', vacLabel: 'Vacancia del nivel D', ocupLabel: 'Ocupación del nivel D', wide: false },
  { key: 'P', vacLabel: 'Vacancia de enlaces P', ocupLabel: 'Ocupación de enlaces P', wide: false },
  { key: 'OPERATIVOS', vacLabel: 'Vacancia de niveles Operativos', ocupLabel: 'Ocupación de niveles Operativos', wide: true },
];

function classifyPos(pos) {
  if (pos.startsWith('103')) return 'permanente';
  if (pos.startsWith('2026')) return 'nuevaCreacion';
  return 'eventual';
}

function buildTableData(data, prefix) {
  if (!data || data.length === 0) return [];
  const rows = data.filter(item => {
    const nivel = (item.Nivel || '').trim();
    return nivel.toUpperCase().startsWith(prefix);
  });

  const byNivel = {};
  rows.forEach(item => {
    const nivel = (item.Nivel || '').trim();
    const pos = (item['Posición'] || '').trim();
    if (!byNivel[nivel]) {
      byNivel[nivel] = { nivel, eventuales: 0, nuevaCreacion: 0, permanentes: 0 };
    }
    if (pos.startsWith('103')) byNivel[nivel].permanentes += 1;
    else if (pos.startsWith('2026')) byNivel[nivel].nuevaCreacion += 1;
    else byNivel[nivel].eventuales += 1;
  });

  return Object.values(byNivel)
    .map(row => ({ ...row, total: row.eventuales + row.nuevaCreacion + row.permanentes }))
    .sort((a, b) => a.nivel.localeCompare(b.nivel));
}

function buildNumericTableData(data) {
  if (!data || data.length === 0) return [];
  const rows = data.filter(item => {
    const nivel = (item.Nivel || '').trim();
    return nivel.length > 0 && /^\d/.test(nivel);
  });

  const byNivel = {};
  rows.forEach(item => {
    const nivel = (item.Nivel || '').trim();
    const pos = (item['Posición'] || '').trim();
    if (!byNivel[nivel]) {
      byNivel[nivel] = { nivel, eventuales: 0, nuevaCreacion: 0, permanentes: 0 };
    }
    if (pos.startsWith('103')) byNivel[nivel].permanentes += 1;
    else if (pos.startsWith('2026')) byNivel[nivel].nuevaCreacion += 1;
    else byNivel[nivel].eventuales += 1;
  });

  return Object.values(byNivel)
    .map(row => ({ ...row, total: row.eventuales + row.nuevaCreacion + row.permanentes }))
    .sort((a, b) => a.nivel.localeCompare(b.nivel, undefined, { numeric: true }));
}

// Centraliza el `if` de "Operativos usa buildNumericTableData, el resto usa
// buildTableData(prefix)" para poder llamarlo una vez por dataset (Vacancia/
// Ocupación) por cada nivel de LEVELS_ORDER sin duplicar la rama.
function getTableData(sourceData, levelKey) {
  return levelKey === 'OPERATIVOS' ? buildNumericTableData(sourceData) : buildTableData(sourceData, levelKey);
}

function calcTotal(tableData) {
  return tableData.reduce(
    (acc, row) => ({
      eventuales: acc.eventuales + row.eventuales,
      nuevaCreacion: acc.nuevaCreacion + row.nuevaCreacion,
      permanentes: acc.permanentes + row.permanentes,
      total: acc.total + row.total,
    }),
    { eventuales: 0, nuevaCreacion: 0, permanentes: 0, total: 0 }
  );
}

// Clickable number cell
function ClickableNum({ value, onClick }) {
  if (value <= 0) return <span className="text-slate-350 dark:text-slate-700 font-medium">—</span>;
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-xs font-bold text-[#10243e] dark:text-[#bc955c] bg-[#10243e]/5 dark:bg-[#bc955c]/5 hover:bg-[#10243e] hover:text-white dark:hover:bg-[#bc955c] dark:hover:text-[#10243e] rounded-lg transition-all duration-205 active:scale-95 cursor-pointer shadow-sm"
    >
      {formatNumber(value)}
    </button>
  );
}

function VacanciaTableK({ tableData, totalRow, label, data, onCellClick }) {
  if (tableData.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-[#621f32] to-[#8c2d4a] rounded-full inline-block" />
        {label}
      </h4>
      <div className="overflow-auto custom-scrollbar max-h-[420px] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md bg-white dark:bg-slate-900">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-white sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 top-0 z-40 bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Nivel</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Eventuales</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Permanentes</th>
                <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={row.nivel} className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/10'}`}>
                  <td className={`sticky left-0 z-10 p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>{row.nivel}</td>
                  <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800/60">
                    <ClickableNum value={row.eventuales + row.nuevaCreacion} onClick={() => onCellClick(row.nivel, 'eventual', label)} />
                  </td>
                  <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800/60">
                    <ClickableNum value={row.permanentes} onClick={() => onCellClick(row.nivel, 'permanente', label)} />
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800 dark:text-white bg-slate-50/50 dark:bg-slate-800/20">
                    <ClickableNum value={row.total} onClick={() => onCellClick(row.nivel, 'total', label)} />
                  </td>
                </tr>
              ))}
              <tr className="bg-[#10243e] text-white font-bold border-t-2 border-[#bc955c]/45">
                <td className="sticky left-0 z-10 bg-[#10243e] p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
                <td className="p-3 text-center border-r border-slate-200/10">
                  <button onClick={() => onCellClick('__ALL__', 'eventual', label)} className="px-3 py-1 text-xs font-black bg-white/10 hover:bg-white hover:text-[#10243e] text-white rounded-lg border border-white/20 transition-all active:scale-95 cursor-pointer">{formatNumber(totalRow.eventuales + totalRow.nuevaCreacion)}</button>
                </td>
                <td className="p-3 text-center border-r border-slate-200/10">
                  <button onClick={() => onCellClick('__ALL__', 'permanente', label)} className="px-3 py-1 text-xs font-black bg-white/10 hover:bg-white hover:text-[#10243e] text-white rounded-lg border border-white/20 transition-all active:scale-95 cursor-pointer">{formatNumber(totalRow.permanentes)}</button>
                </td>
                <td className="p-3 text-center bg-[#1a3b63]">
                  <button onClick={() => onCellClick('__ALL__', 'total', label)} className="px-3.5 py-1.5 text-xs font-black bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white rounded-lg border border-[#bc955c] transition-all active:scale-95 cursor-pointer shadow-md shadow-[#bc955c]/20">{formatNumber(totalRow.total)}</button>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>
  );
}

function VacanciaTable({ tableData, totalRow, label, onCellClick }) {
  if (tableData.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-[#621f32] to-[#8c2d4a] rounded-full inline-block" />
        {label}
      </h4>
      <div className="overflow-auto custom-scrollbar max-h-[420px] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md bg-white dark:bg-slate-900">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-white sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 top-0 z-40 bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Nivel</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Eventuales</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Evt. Nueva Creación</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Permanentes</th>
                <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={row.nivel} className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/10'}`}>
                  <td className={`sticky left-0 z-10 p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}>{row.nivel}</td>
                  <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800/60">
                    <ClickableNum value={row.eventuales} onClick={() => onCellClick(row.nivel, 'eventual', label)} />
                  </td>
                  <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800/60">
                    <ClickableNum value={row.nuevaCreacion} onClick={() => onCellClick(row.nivel, 'nuevaCreacion', label)} />
                  </td>
                  <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800/60">
                    <ClickableNum value={row.permanentes} onClick={() => onCellClick(row.nivel, 'permanente', label)} />
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800 dark:text-white bg-slate-50/50 dark:bg-slate-800/20">
                    <ClickableNum value={row.total} onClick={() => onCellClick(row.nivel, 'total', label)} />
                  </td>
                </tr>
              ))}
              <tr className="bg-[#10243e] text-white font-bold border-t-2 border-[#bc955c]/45">
                <td className="sticky left-0 z-10 bg-[#10243e] p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
                <td className="p-3 text-center border-r border-slate-200/10">
                  <button onClick={() => onCellClick('__ALL__', 'eventual', label)} className="px-3 py-1 text-xs font-black bg-white/10 hover:bg-white hover:text-[#10243e] text-white rounded-lg border border-white/20 transition-all active:scale-95 cursor-pointer">{formatNumber(totalRow.eventuales)}</button>
                </td>
                <td className="p-3 text-center border-r border-slate-200/10">
                  <button onClick={() => onCellClick('__ALL__', 'nuevaCreacion', label)} className="px-3 py-1 text-xs font-black bg-white/10 hover:bg-white hover:text-[#10243e] text-white rounded-lg border border-white/20 transition-all active:scale-95 cursor-pointer">{formatNumber(totalRow.nuevaCreacion)}</button>
                </td>
                <td className="p-3 text-center border-r border-slate-200/10">
                  <button onClick={() => onCellClick('__ALL__', 'permanente', label)} className="px-3 py-1 text-xs font-black bg-white/10 hover:bg-white hover:text-[#10243e] text-white rounded-lg border border-white/20 transition-all active:scale-95 cursor-pointer">{formatNumber(totalRow.permanentes)}</button>
                </td>
                <td className="p-3 text-center bg-[#1a3b63]">
                  <button onClick={() => onCellClick('__ALL__', 'total', label)} className="px-3.5 py-1.5 text-xs font-black bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white rounded-lg border border-[#bc955c] transition-all active:scale-95 cursor-pointer shadow-md shadow-[#bc955c]/20">{formatNumber(totalRow.total)}</button>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>
  );
}

// Placeholder de una tabla vacía del par Vacancia/Ocupación de un nivel — se
// muestra en la columna correspondiente cuando ese lado (vacantes u
// ocupadas) no tiene registros para el nivel, en vez de dejar la columna en
// blanco (ej. nivel J con todas sus plazas ocupadas: 0 vacantes).
function EmptyLevelTable({ label, message }) {
  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-slate-400 dark:text-slate-600 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 rounded-full inline-block" />
        {label}
      </h4>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 h-[37px]">
              <div className="h-3 w-8 bg-slate-150 dark:bg-slate-800/60 rounded" />
              <div className="h-3 flex-1 bg-slate-150 dark:bg-slate-800/60 rounded" />
              <div className="h-3 w-14 bg-slate-150 dark:bg-slate-800/60 rounded" />
              <div className="h-3 w-10 bg-slate-150 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-800/10">
          <Inbox className="size-6 text-slate-300 dark:text-slate-700" />
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center px-4">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function DetalleVacantesTablas({ data = [], ocupadosData = [] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRows, setModalRows] = useState([]);
  const [modalTitle, setModalTitle] = useState('');
  // Whitelist/keys por defecto del modal — varían según se haya abierto desde
  // una tabla de Vacancia o de Ocupación (esta última sí trae identidad de
  // empleado, ver DETALLE_OCUPACION_COLUMN_KEYS).
  const [modalColumnKeys, setModalColumnKeys] = useState(DETALLE_VACANTES_COLUMN_KEYS);
  const [modalDefaultColumnKeys, setModalDefaultColumnKeys] = useState(null);

  // Por cada nivel de LEVELS_ORDER, arma la tabla de Vacancia (data) y su
  // equivalente de Ocupación (ocupadosData) — mismos helpers de siempre
  // (buildTableData/buildNumericTableData/calcTotal), solo variando la fuente.
  const levelRows = useMemo(() => {
    return LEVELS_ORDER.map(lvl => {
      const vacTableData = getTableData(data, lvl.key);
      const ocupTableData = getTableData(ocupadosData, lvl.key);
      return {
        ...lvl,
        vacTableData,
        vacTotalRow: calcTotal(vacTableData),
        ocupTableData,
        ocupTotalRow: calcTotal(ocupTableData),
      };
    });
  }, [data, ocupadosData]);

  // Observaciones Vacancia
  const observaciones = useMemo(() => {
    if (!data || data.length === 0) return { base: 0, oic: 0, titulares: 0, total: 0 };
    let base = 0, oic = 0, titulares = 0;
    const totalSet = new Set();
    data.forEach((item, idx) => {
      const isBase = (item['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
      const isOic = (item['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
      const isTitular = (item['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');

      if (isBase) base++;
      if (isOic) oic++;
      if (isTitular) titulares++;

      if (isBase || isOic || isTitular) {
        totalSet.add(idx);
      }
    });
    return { base, oic, titulares, total: totalSet.size };
  }, [data]);

  // Observaciones Ocupación — mismo criterio que Observaciones Vacancia
  // (Contratación Base / OIC / Titulares de Aduanas), pero sobre las plazas
  // ocupadas (ocupadosData) en vez de las vacantes (data).
  const observacionesOcup = useMemo(() => {
    if (!ocupadosData || ocupadosData.length === 0) return { base: 0, oic: 0, titulares: 0, total: 0 };
    let base = 0, oic = 0, titulares = 0;
    const totalSet = new Set();
    ocupadosData.forEach((item, idx) => {
      const isBase = (item['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE';
      const isOic = (item['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control';
      const isTitular = (item['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA');

      if (isBase) base++;
      if (isOic) oic++;
      if (isTitular) titulares++;

      if (isBase || isOic || isTitular) {
        totalSet.add(idx);
      }
    });
    return { base, oic, titulares, total: totalSet.size };
  }, [ocupadosData]);

  // `sourceData`/`levelKey` reemplazan al viejo `prefixMap` (que matcheaba por
  // texto de label): ahora se compara directo contra la key del nivel, ya
  // disponible en el loop de render (más robusto, sirve igual para Vacancia
  // que para Ocupación con solo cambiar `sourceData`/`columnKeys`).
  const openDetailModal = useCallback((sourceData, levelKey, nivel, type, tableLabel, columnKeys, defaultColumnKeys) => {
    const filtered = sourceData.filter(item => {
      const n = (item.Nivel || '').trim();

      // Filter by nivel
      if (nivel === '__ALL__') {
        // Match all niveles in this table's group
        if (levelKey === 'OPERATIVOS') {
          if (!/^\d/.test(n)) return false;
        } else if (levelKey) {
          if (!n.toUpperCase().startsWith(levelKey)) return false;
        }
      } else {
        if (n !== nivel) return false;
      }

      // Filter by type
      if (type === 'total') return true;
      const pos = (item['Posición'] || '').trim();
      const cat = classifyPos(pos);
      if (type === 'eventual') return cat === 'eventual' || cat === 'nuevaCreacion';
      if (type === 'nuevaCreacion') return cat === 'nuevaCreacion';
      if (type === 'permanente') return cat === 'permanente';
      return true;
    });

    const typeLabels = { total: 'Todas', eventual: 'Eventuales', nuevaCreacion: 'Evt. Nueva Creación', permanente: 'Permanentes' };
    const nivelLabel = nivel === '__ALL__' ? 'Total' : nivel;
    setModalTitle(`${tableLabel} — ${nivelLabel} — ${typeLabels[type] || type}`);
    setModalRows(filtered.map(mapVacanteRowToEmployeeRow));
    setModalColumnKeys(columnKeys);
    setModalDefaultColumnKeys(defaultColumnKeys || null);
    setModalOpen(true);
  }, []);

  if (!data || data.length === 0) return null;

  return (
    <div className="w-full px-0 sm:px-4 lg:px-6 mt-8">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y sm:border border-slate-200/50 dark:border-slate-800/50 sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#bc955c]/15 to-[#621f32]/15 blur-3xl -z-10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-[#621f32]/15 to-[#bc955c]/15 blur-3xl -z-10 rounded-full" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="p-3.5 bg-gradient-to-br from-[#10243e] to-[#1a3b63] rounded-2xl shadow-lg shadow-[#10243e]/30 text-white">
            <TableProperties className="size-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              Detalle de Vacantes
            </h3>
            <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              Desglose por tipo de plaza y nivel
            </p>
          </div>
        </div>

        {/* Vacancia (izquierda) | Ocupación (derecha), una fila por nivel para
            que ambas tablas queden alineadas — orden J, K, A, S, D, P,
            Operativos, seguido de Observaciones (solo Vacancia). */}
        <div className="flex flex-col gap-8 relative z-10">
          {levelRows.map(lvl => {
            if (lvl.vacTableData.length === 0 && lvl.ocupTableData.length === 0) return null;
            const Comp = lvl.wide ? VacanciaTableK : VacanciaTable;
            const nivelLabel = lvl.key === 'OPERATIVOS' ? 'niveles Operativos' : `este nivel ${lvl.key}`;
            return (
              <div key={lvl.key} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {lvl.vacTableData.length > 0 ? (
                  <Comp
                    tableData={lvl.vacTableData}
                    totalRow={lvl.vacTotalRow}
                    label={lvl.vacLabel}
                    data={data}
                    onCellClick={(nivel, type, tableLabel) => openDetailModal(data, lvl.key, nivel, type, tableLabel, DETALLE_VACANTES_COLUMN_KEYS, null)}
                  />
                ) : (
                  <EmptyLevelTable label={lvl.vacLabel} message={`No hay vacante de ${nivelLabel}.`} />
                )}
                {lvl.ocupTableData.length > 0 ? (
                  <Comp
                    tableData={lvl.ocupTableData}
                    totalRow={lvl.ocupTotalRow}
                    label={lvl.ocupLabel}
                    data={ocupadosData}
                    onCellClick={(nivel, type, tableLabel) => openDetailModal(ocupadosData, lvl.key, nivel, type, tableLabel, DETALLE_OCUPACION_COLUMN_KEYS, DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS)}
                  />
                ) : (
                  <EmptyLevelTable label={lvl.ocupLabel} message={`No hay ocupación de ${nivelLabel}.`} />
                )}
              </div>
            );
          })}

          {/* Observaciones Vacancia (izquierda) | Observaciones Ocupación (derecha) —
              mismo criterio (Contratación Base / OIC / Titulares de Aduanas),
              una sobre plazas vacantes y otra sobre plazas ocupadas. */}
          {(observaciones.total > 0 || observacionesOcup.total > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {observaciones.total > 0 ? (
                <div className="flex flex-col">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-[#621f32] to-[#8c2d4a] rounded-full inline-block" />
                    Observaciones Vacancia
                  </h4>
                  <div className="overflow-x-auto custom-scrollbar">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-white">
                          <tr>
                            <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Observación</th>
                            <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white dark:bg-slate-900 transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Contratación Base</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observaciones.base}
                                onClick={() => {
                                  const rows = data.filter(i => (i['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE');
                                  setModalTitle('Observaciones Vacancia — Contratación Base');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_VACANTES_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(null);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-slate-50/20 dark:bg-slate-800/10 transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Órgano Interno de Control</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observaciones.oic}
                                onClick={() => {
                                  const rows = data.filter(i => (i['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control');
                                  setModalTitle('Observaciones Vacancia — Órgano Interno de Control');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_VACANTES_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(null);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-white dark:bg-slate-900 transition-colors hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Titulares de Aduanas</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observaciones.titulares}
                                onClick={() => {
                                  const rows = data.filter(i => (i['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA'));
                                  setModalTitle('Observaciones Vacancia — Titulares de Aduanas');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_VACANTES_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(null);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-[#10243e] text-white font-bold border-t-2 border-[#bc955c]/45">
                            <td className="p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
                            <td className="p-3 text-center bg-[#1a3b63]">
                              <button
                                onClick={() => {
                                  const rows = data.filter(i =>
                                    (i['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE' ||
                                    (i['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control' ||
                                    (i['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA')
                                  );
                                  setModalTitle('Observaciones Vacancia — Total');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_VACANTES_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(null);
                                  setModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 text-xs font-black bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white rounded-lg border border-[#bc955c] transition-all active:scale-95 cursor-pointer shadow-md shadow-[#bc955c]/20"
                              >
                                {formatNumber(observaciones.total)}
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : <div />}

              {observacionesOcup.total > 0 ? (
                <div className="flex flex-col">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-[#621f32] to-[#8c2d4a] rounded-full inline-block" />
                    Observaciones Ocupación
                  </h4>
                  <div className="overflow-x-auto custom-scrollbar">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-white">
                          <tr>
                            <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Observación</th>
                            <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white dark:bg-slate-900 transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Contratación Base</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observacionesOcup.base}
                                onClick={() => {
                                  const rows = ocupadosData.filter(i => (i['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE');
                                  setModalTitle('Observaciones Ocupación — Contratación Base');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_OCUPACION_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-slate-50/20 dark:bg-slate-800/10 transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Órgano Interno de Control</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observacionesOcup.oic}
                                onClick={() => {
                                  const rows = ocupadosData.filter(i => (i['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control');
                                  setModalTitle('Observaciones Ocupación — Órgano Interno de Control');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_OCUPACION_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-white dark:bg-slate-900 transition-colors hover:bg-[#bc955c]/5">
                            <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">Titulares de Aduanas</td>
                            <td className="p-3 text-center">
                              <ClickableNum
                                value={observacionesOcup.titulares}
                                onClick={() => {
                                  const rows = ocupadosData.filter(i => (i['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA'));
                                  setModalTitle('Observaciones Ocupación — Titulares de Aduanas');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_OCUPACION_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS);
                                  setModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                          <tr className="bg-[#10243e] text-white font-bold border-t-2 border-[#bc955c]/45">
                            <td className="p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
                            <td className="p-3 text-center bg-[#1a3b63]">
                              <button
                                onClick={() => {
                                  const rows = ocupadosData.filter(i =>
                                    (i['TIPO DE CONTRATACIÓN'] || '').trim() === 'SAT_BSE' ||
                                    (i['Unidad de Negocio'] || '').trim() === 'Organo Interno de Control' ||
                                    (i['Nombre Puesto Funcional'] || '').trim().toUpperCase().startsWith('ADMINISTRADOR DE ADUANA')
                                  );
                                  setModalTitle('Observaciones Ocupación — Total');
                                  setModalRows(rows.map(mapVacanteRowToEmployeeRow));
                                  setModalColumnKeys(DETALLE_OCUPACION_COLUMN_KEYS);
                                  setModalDefaultColumnKeys(DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS);
                                  setModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 text-xs font-black bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white rounded-lg border border-[#bc955c] transition-all active:scale-95 cursor-pointer shadow-md shadow-[#bc955c]/20"
                              >
                                {formatNumber(observacionesOcup.total)}
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : <div />}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle — modo local de EmployeesModal: filas ya filtradas
          en cliente desde `data`/`ocupadosData`, no vienen de un fetch nivel+estatus (incluye
          los filtros de Observaciones Vacancia, que ni siquiera son por nivel). */}
      <EmployeesModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rows={modalRows}
        title={modalTitle}
        restrictColumnsTo={modalColumnKeys}
        defaultColumnKeys={modalDefaultColumnKeys}
      />
    </div>
  );
}
