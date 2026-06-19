import { useMemo, useState, useCallback } from 'react';
import { TableProperties } from 'lucide-react';
import DetalleVacantesModal from './DetalleVacantesModal';

function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const TABLAS_ORDER = [
  { prefix: 'P', label: 'Vacancia de enlaces P' },
  { prefix: 'A', label: 'Vacancia del nivel A' },
  { prefix: 'S', label: 'Vacancia del nivel S' },
  { prefix: 'D', label: 'Vacancia del nivel D' },
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
      <div className="overflow-x-auto custom-scrollbar">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-white">
              <tr>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Nivel</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Eventuales</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Permanentes</th>
                <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={row.nivel} className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/10'}`}>
                  <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">{row.nivel}</td>
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
                <td className="p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
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
      <div className="overflow-x-auto custom-scrollbar">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden bg-white dark:bg-slate-900">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-white">
              <tr>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Nivel</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Eventuales</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Evt. Nueva Creación</th>
                <th className="bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Permanentes</th>
                <th className="bg-[#10243e] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={row.nivel} className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/20 dark:bg-slate-800/10'}`}>
                  <td className="p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60">{row.nivel}</td>
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
                <td className="p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">Total</td>
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
    </div>
  );
}

export default function DetalleVacantesTablas({ data = [] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRows, setModalRows] = useState([]);
  const [modalTitle, setModalTitle] = useState('');

  const tables = useMemo(() => {
    return TABLAS_ORDER.map(({ prefix, label }) => {
      const tableData = buildTableData(data, prefix);
      const totalRow = calcTotal(tableData);
      return { prefix, label, tableData, totalRow };
    });
  }, [data]);

  const operativosTable = useMemo(() => {
    const tableData = buildNumericTableData(data);
    const totalRow = calcTotal(tableData);
    return { tableData, totalRow };
  }, [data]);

  const kTable = useMemo(() => {
    const tableData = buildTableData(data, 'K');
    const totalRow = calcTotal(tableData);
    return { tableData, totalRow };
  }, [data]);

  const activeTables = tables.filter(t => t.tableData.length > 0);

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

  const handleCellClick = useCallback((nivel, type, tableLabel) => {
    // Determine which prefix group this table belongs to
    const prefixMap = {
      'Vacancia de enlaces P': 'P',
      'Vacancia del nivel A': 'A',
      'Vacancia del nivel S': 'S',
      'Vacancia del nivel D': 'D',
      'Vacancia del nivel K': 'K',
      'Vacancia de niveles Operativos': '__NUMERIC__',
    };
    const tablePrefix = prefixMap[tableLabel] || '';

    const filtered = data.filter(item => {
      const n = (item.Nivel || '').trim();

      // Filter by nivel
      if (nivel === '__ALL__') {
        // Match all niveles in this table's group
        if (tablePrefix === '__NUMERIC__') {
          if (!/^\d/.test(n)) return false;
        } else if (tablePrefix) {
          if (!n.toUpperCase().startsWith(tablePrefix)) return false;
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
    setModalRows(filtered);
    setModalOpen(true);
  }, [data]);

  if (!data || data.length === 0) return null;

  return (
    <div className="w-full px-4 lg:px-6 mt-8">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-slate-200/20 dark:shadow-black/40 relative overflow-hidden">
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

        {/* 2 columnas continuas: Operativos+P+S | K+A+D */}
        <div className="flex flex-col lg:flex-row gap-8 relative z-10">
          {/* Columna izquierda: Operativos, P, S */}
          <div className="flex-1 flex flex-col gap-8">
            {operativosTable.tableData.length > 0 && (
              <VacanciaTableK
                tableData={operativosTable.tableData}
                totalRow={operativosTable.totalRow}
                label="Vacancia de niveles Operativos"
                data={data}
                onCellClick={handleCellClick}
              />
            )}
            {activeTables.filter(t => t.prefix === 'P' || t.prefix === 'S').map(t => (
              <VacanciaTable
                key={t.prefix}
                tableData={t.tableData}
                totalRow={t.totalRow}
                label={t.label}
                onCellClick={handleCellClick}
              />
            ))}

            {/* Observaciones Vacancia */}
            {observaciones.total > 0 && (
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
                                setModalRows(rows);
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
                                setModalRows(rows);
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
                                setModalRows(rows);
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
                                setModalRows(rows);
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
            )}
          </div>
          {/* Columna derecha: K, A, D */}
          <div className="flex-1 flex flex-col gap-8">
            {kTable.tableData.length > 0 && (
              <VacanciaTableK
                tableData={kTable.tableData}
                totalRow={kTable.totalRow}
                label="Vacancia del nivel K"
                data={data}
                onCellClick={handleCellClick}
              />
            )}
            {activeTables.filter(t => t.prefix === 'A' || t.prefix === 'D').map(t => (
              <VacanciaTable
                key={t.prefix}
                tableData={t.tableData}
                totalRow={t.totalRow}
                label={t.label}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Modal de detalle */}
      <DetalleVacantesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rows={modalRows}
        title={modalTitle}
      />
    </div>
  );
}
