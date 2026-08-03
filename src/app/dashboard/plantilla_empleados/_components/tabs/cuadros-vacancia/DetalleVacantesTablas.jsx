import { useMemo, useState, useCallback } from 'react';
import { TableProperties } from 'lucide-react';
import EmployeesModal, { ALL_AVAILABLE_COLUMNS } from '../../shared/EmployeesModal';
import { mapVacanteRowToEmployeeRow } from '../../shared/mapVacanteRow';
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";

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
// simplemente queda vacía porque no hay persona asignada a la plaza) — salvo
// "fecha_vacancia", que sólo el JOIN de DesgloseJerarquicoView (vacantes)
// trae; una plaza ocupada no tiene fecha de vacancia.
const DETALLE_OCUPACION_COLUMN_KEYS = ALL_COLUMN_KEYS.filter(k => k !== 'fecha_vacancia');
const DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS = ['id_empleado', 'nombres', 'rfc', 'curp', 'posicion', 'nivel', 'nombre_puesto_funcional'];

function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Orden pedido en pantalla: J, K, A, S, D, P y Operativos. Cada nivel se
// muestra en una sola tabla fusionada (Vacancia + Ocupación en el mismo
// renglón, columnas Ocup/Vac pareadas) con el mismo desglose de 3 vías
// (Eventuales / Evt. Nueva Creación / Permanentes) para los 7 niveles.
const LEVELS_ORDER = [
  { key: 'J', label: 'Nivel J' },
  { key: 'K', label: 'Nivel K' },
  { key: 'A', label: 'Nivel A' },
  { key: 'S', label: 'Nivel S' },
  { key: 'D', label: 'Nivel D' },
  { key: 'P', label: 'Enlaces P' },
  { key: 'OPERATIVOS', label: 'Niveles Operativos' },
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

// Funde en un solo renglón por Nivel tabular los conteos de Vacancia y
// Ocupación (ya agregados por buildTableData/buildNumericTableData) — mismo
// caso de uso que AduanasOcupacionVacanciaTab.jsx (ocupadas vs vacantes),
// aquí con Eventuales/Evt. Nueva Creación/Permanentes como ejes y el par
// Ocup/Vac contiguo dentro de cada uno.
const EMPTY_SIDE = () => ({ ocup: 0, vac: 0 });

function mergeVacOcupBreakdown(vacRows, ocupRows) {
  const byNivel = {};
  const ensure = (nivel) => {
    if (!byNivel[nivel]) {
      byNivel[nivel] = { nivel, eventual: EMPTY_SIDE(), nuevaCreacion: EMPTY_SIDE(), permanente: EMPTY_SIDE() };
    }
    return byNivel[nivel];
  };
  vacRows.forEach((r) => {
    const row = ensure(r.nivel);
    row.eventual.vac = r.eventuales;
    row.nuevaCreacion.vac = r.nuevaCreacion;
    row.permanente.vac = r.permanentes;
  });
  ocupRows.forEach((r) => {
    const row = ensure(r.nivel);
    row.eventual.ocup = r.eventuales;
    row.nuevaCreacion.ocup = r.nuevaCreacion;
    row.permanente.ocup = r.permanentes;
  });
  return Object.values(byNivel)
    .map((row) => ({
      ...row,
      total: {
        ocup: row.eventual.ocup + row.nuevaCreacion.ocup + row.permanente.ocup,
        vac: row.eventual.vac + row.nuevaCreacion.vac + row.permanente.vac,
      },
    }))
    .sort((a, b) => a.nivel.localeCompare(b.nivel, undefined, { numeric: true }));
}

function calcMergedTotal(rows) {
  return rows.reduce(
    (acc, row) => ({
      eventual: { ocup: acc.eventual.ocup + row.eventual.ocup, vac: acc.eventual.vac + row.eventual.vac },
      nuevaCreacion: { ocup: acc.nuevaCreacion.ocup + row.nuevaCreacion.ocup, vac: acc.nuevaCreacion.vac + row.nuevaCreacion.vac },
      permanente: { ocup: acc.permanente.ocup + row.permanente.ocup, vac: acc.permanente.vac + row.permanente.vac },
      total: { ocup: acc.total.ocup + row.total.ocup, vac: acc.total.vac + row.total.vac },
    }),
    { eventual: EMPTY_SIDE(), nuevaCreacion: EMPTY_SIDE(), permanente: EMPTY_SIDE(), total: EMPTY_SIDE() }
  );
}

// Clickable number cell — `tone` distingue Ocup/Vac dentro de la tabla
// fusionada por nivel; sin `tone` conserva el estilo guinda/dorado original
// (usado en Observaciones, que no está pareado Ocup/Vac).
function ClickableNum({ value, onClick, tone }) {
  if (value <= 0) return <span className="text-slate-350 dark:text-slate-700 font-medium">—</span>;
  const toneClasses = tone === 'ocup'
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 hover:text-white'
    : tone === 'vac'
      ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-600 hover:text-white'
      : 'text-[#10243e] dark:text-[#bc955c] bg-[#10243e]/5 dark:bg-[#bc955c]/5 hover:bg-[#10243e] hover:text-white dark:hover:bg-[#bc955c] dark:hover:text-[#10243e]';
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-205 active:scale-95 cursor-pointer shadow-sm ${toneClasses}`}
    >
      {formatNumber(value)}
    </button>
  );
}

const PLAZA_GROUPS = [
  { key: 'eventual', label: 'Eventuales' },
  { key: 'nuevaCreacion', label: 'Evt. Nueva Creación' },
  { key: 'permanente', label: 'Permanentes' },
  { key: 'total', label: 'Total' },
];

// Tabla fusionada por nivel jerárquico: filas = Nivel tabular, columnas =
// Eventuales / Evt. Nueva Creación / Permanentes / Total, cada una con el
// par Ocup/Vac contiguo — reemplaza al antiguo par VacanciaTable/
// VacanciaTableK (Vacancia y Ocupación ya no van en tablas separadas lado a
// lado, sino fundidas en una sola).
function NivelPlazaTable({ levelLabel, rows, totalRow, onCellClick }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-[#621f32] to-[#8c2d4a] rounded-full inline-block" />
        {levelLabel}
      </h4>
      <div className="overflow-auto custom-scrollbar max-h-[420px] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-md bg-white dark:bg-slate-900">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-white sticky top-0 z-30">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-40 bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-3 text-center font-bold text-[11px] uppercase tracking-wider"
              >
                Nivel
              </th>
              {PLAZA_GROUPS.map((g, i) => (
                <th
                  key={g.key}
                  colSpan={2}
                  className={`bg-gradient-to-r from-[#10243e] to-[#152e4f] border border-slate-200/10 p-2 text-center font-bold text-[11px] uppercase tracking-wider whitespace-nowrap ${
                    i > 0 ? "border-l-4 border-l-amber-400/60" : ""
                  }`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {PLAZA_GROUPS.flatMap((g, i) => [
                <th
                  key={`${g.key}|ocup`}
                  className={`bg-[#152e4f] border border-slate-200/10 p-1.5 text-center font-semibold text-[10px] text-emerald-300 ${
                    i > 0 ? "border-l-4 border-l-amber-400/60" : ""
                  }`}
                >
                  Ocup
                </th>,
                <th
                  key={`${g.key}|vac`}
                  className="bg-[#152e4f] border border-slate-200/10 p-1.5 text-center font-semibold text-[10px] text-amber-300 border-l border-l-slate-500/40"
                >
                  Vac
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.nivel}
                className={`transition-colors border-b border-slate-100 dark:border-slate-800/60 hover:bg-[#bc955c]/5 ${
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/20 dark:bg-slate-800/10"
                }`}
              >
                <td
                  className={`sticky left-0 z-10 p-3 text-center font-extrabold text-[#10243e] dark:text-[#bc955c] border-r border-slate-100 dark:border-slate-800/60 ${
                    idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800"
                  }`}
                >
                  {row.nivel}
                </td>
                {PLAZA_GROUPS.flatMap((g, i) => [
                  <td
                    key={`${row.nivel}|${g.key}|ocup`}
                    className={`p-2 text-center border-r border-slate-100 dark:border-slate-800/60 ${i > 0 ? "border-l-2 border-l-slate-200 dark:border-l-slate-800" : ""} ${
                      g.key === "total" ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
                    }`}
                  >
                    <ClickableNum value={row[g.key].ocup} tone="ocup" onClick={() => onCellClick(row.nivel, g.key, "ocup")} />
                  </td>,
                  <td
                    key={`${row.nivel}|${g.key}|vac`}
                    className={`p-2 text-center border-r border-slate-100 dark:border-slate-800/60 ${
                      g.key === "total" ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
                    }`}
                  >
                    <ClickableNum value={row[g.key].vac} tone="vac" onClick={() => onCellClick(row.nivel, g.key, "vac")} />
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#10243e] text-white font-bold border-t-2 border-[#bc955c]/45">
              <td className="sticky left-0 z-10 bg-[#10243e] p-3 text-center border-r border-slate-200/10 uppercase text-[10px] tracking-wider font-black">
                Total
              </td>
              {PLAZA_GROUPS.flatMap((g, i) => [
                <td key={`total|${g.key}|ocup`} className={`p-2 text-center border-r border-slate-200/10 ${i > 0 ? "border-l-4 border-l-amber-400/45" : ""} ${g.key === "total" ? "bg-[#1a3b63]" : ""}`}>
                  <button
                    onClick={() => onCellClick("__ALL__", g.key, "ocup")}
                    className={`text-xs font-black rounded-lg border transition-all active:scale-95 cursor-pointer ${
                      g.key === "total"
                        ? "px-3.5 py-1.5 bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white border-[#bc955c] shadow-md shadow-[#bc955c]/20"
                        : "px-3 py-1 bg-white/10 hover:bg-white hover:text-[#10243e] text-white border-white/20"
                    }`}
                  >
                    {formatNumber(totalRow[g.key].ocup)}
                  </button>
                </td>,
                <td key={`total|${g.key}|vac`} className={`p-2 text-center border-r border-slate-200/10 ${g.key === "total" ? "bg-[#1a3b63]" : ""}`}>
                  <button
                    onClick={() => onCellClick("__ALL__", g.key, "vac")}
                    className={`text-xs font-black rounded-lg border transition-all active:scale-95 cursor-pointer ${
                      g.key === "total"
                        ? "px-3.5 py-1.5 bg-[#bc955c] text-[#10243e] hover:bg-[#d0ab75] hover:text-white border-[#bc955c] shadow-md shadow-[#bc955c]/20"
                        : "px-3 py-1 bg-white/10 hover:bg-white hover:text-[#10243e] text-white border-white/20"
                    }`}
                  >
                    {formatNumber(totalRow[g.key].vac)}
                  </button>
                </td>,
              ])}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function DetalleVacantesTablas({ data = [], ocupadosData = [] }) {
  const { hasPermission } = useAuth();
  const canViewFotoMovPosiciones = hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES_FOTO);
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
  // (buildTableData/buildNumericTableData) — y las funde en un solo
  // renglón por Nivel tabular con el par Ocup/Vac contiguo.
  const levelRows = useMemo(() => {
    return LEVELS_ORDER.map(lvl => {
      const vacTableData = getTableData(data, lvl.key);
      const ocupTableData = getTableData(ocupadosData, lvl.key);
      const mergedRows = mergeVacOcupBreakdown(vacTableData, ocupTableData);
      return {
        ...lvl,
        mergedRows,
        mergedTotal: calcMergedTotal(mergedRows),
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

        {/* Una tabla fundida por nivel (Vacancia + Ocupación en el mismo
            renglón, columnas Ocup/Vac pareadas) — orden J, K, A, S, D, P,
            Operativos, seguido de Observaciones (Vacancia | Ocupación). */}
        <div className="flex flex-col gap-8 relative z-10">
          {levelRows.map(lvl => {
            if (lvl.mergedRows.length === 0) return null;
            return (
              <NivelPlazaTable
                key={lvl.key}
                levelLabel={lvl.label}
                rows={lvl.mergedRows}
                totalRow={lvl.mergedTotal}
                onCellClick={(nivel, tipo, estatus) => {
                  const estatusLabel = estatus === 'ocup' ? 'Ocupación' : 'Vacancia';
                  if (estatus === 'ocup') {
                    openDetailModal(ocupadosData, lvl.key, nivel, tipo, `${lvl.label} — ${estatusLabel}`, DETALLE_OCUPACION_COLUMN_KEYS, DETALLE_OCUPACION_DEFAULT_COLUMN_KEYS);
                  } else {
                    openDetailModal(data, lvl.key, nivel, tipo, `${lvl.label} — ${estatusLabel}`, DETALLE_VACANTES_COLUMN_KEYS, null);
                  }
                }}
              />
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
        canViewPhoto={canViewFotoMovPosiciones}
        fotoPermissionCodename="view_plantilla_mov_posiciones_foto"
      />
    </div>
  );
}
