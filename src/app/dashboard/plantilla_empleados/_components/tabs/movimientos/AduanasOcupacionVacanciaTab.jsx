"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Filter, Download } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";
import { useZafiroUpdates } from "@/context/ZafiroUpdatesContext";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import EmployeesModal from "../../shared/EmployeesModal";
import { mapVacanteRowToEmployeeRow } from "../../shared/mapVacanteRow";
import {
  getUniqueColumnValues,
  finalizeFilterDropdownValues,
  resolveColumnFilterCommit,
  normalizeForSearch,
} from "@/utils/columnFilters";

// Columnas por defecto del modal de detalle cuando se abre desde una celda de
// Ocupación (trae identidad de empleado) — en Vacancia se usa el default de
// EmployeesModal en modo local (LOCAL_MODE_DEFAULT_COLUMN_KEYS), pensado para
// plazas sin titular.
const OCUPACION_DEFAULT_COLUMN_KEYS = ["id_empleado", "nombres", "rfc", "curp", "posicion", "nivel", "nombre_puesto_funcional"];

// Tabla compacta de conteos agrupados (Aduana x NJ x Nivel x Ocup/Vac). No
// reusa DataTable (shared) porque esa trae filtros/orden/selección de celda
// tipo Excel que no aplican a un resumen de ~10-20 filas — aquí se necesita
// nada más un header de 3 niveles (grupo NJ + subcolumna Nivel + Ocup/Vac) vía colSpan.
function GroupedCountTable({
  gruposNj = [],
  filas = [],
  loading,
  aduanaFilterActive,
  onOpenAduanaFilter,
  onCellClick,
  onRowTotalClick,
  onNivelTotalClick,
  onNjTotalClick,
  headerRight,
}) {
  const totalCols = useMemo(
    () => gruposNj.reduce((acc, g) => acc + g.niveles.length * 2, 0),
    [gruposNj]
  );

  // Totales por fila (aduana), por nivel (columna) y por NJ (grupo jerárquico).
  const { filaTotales, totalesPorNivel, totalesPorNj } = useMemo(() => {
    const filaTotales = new Map();
    const totalesPorNivel = new Map();
    const totalesPorNj = new Map();

    gruposNj.forEach((g) => {
      let ocupNj = 0;
      let vacNj = 0;
      g.niveles.forEach((nivel) => {
        totalesPorNivel.set(`${g.nj}|${nivel}`, { ocup: 0, vac: 0 });
      });
      totalesPorNj.set(g.nj, { ocup: 0, vac: 0 });
    });

    filas.forEach((row) => {
      let ocupFila = 0;
      let vacFila = 0;
      gruposNj.forEach((g) => {
        g.niveles.forEach((nivel) => {
          const key = `${g.nj}|${nivel}`;
          const ocup = row.ocupacion?.[key] ?? 0;
          const vac = row.vacancia?.[key] ?? 0;
          ocupFila += ocup;
          vacFila += vac;

          const nivelAcc = totalesPorNivel.get(key);
          nivelAcc.ocup += ocup;
          nivelAcc.vac += vac;

          const njAcc = totalesPorNj.get(g.nj);
          njAcc.ocup += ocup;
          njAcc.vac += vac;
        });
      });
      filaTotales.set(row.aduana, { ocup: ocupFila, vac: vacFila });
    });

    return { filaTotales, totalesPorNivel, totalesPorNj };
  }, [gruposNj, filas]);

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-[#621f32]">Ocupación vs Vacancia</h4>
          <p className="text-[10px] font-semibold text-slate-400">
            {filas.length} {filas.length === 1 ? "aduana" : "aduanas"}
          </p>
        </div>
        {headerRight}
      </div>

      <div className="max-h-[560px] overflow-auto overscroll-contain">
        <table className="w-full border-collapse text-[11px]">
          <thead className="text-white sticky top-0 z-30">
            <tr>
              <th
                rowSpan={3}
                className="sticky left-0 top-0 z-40 bg-[#40121e] border border-[#621f32]/35 p-2 text-center font-bold uppercase tracking-wider min-w-[190px]"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Aduana</span>
                  <button
                    type="button"
                    onClick={onOpenAduanaFilter}
                    title="Filtrar aduanas"
                    className={`p-1 rounded-md transition-colors ${
                      aduanaFilterActive
                        ? "bg-[#bc955c] text-[#40121e]"
                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    <Filter className="size-3" />
                  </button>
                </div>
              </th>
              <th
                rowSpan={3}
                className="bg-[#501929] border border-[#621f32]/35 border-l-4 border-l-[#bc955c] p-2 text-center font-bold uppercase tracking-wider min-w-[70px] text-[#f2e5d0]"
              >
                Total
                <br />
                Ocupadas
              </th>
              <th
                rowSpan={3}
                className="bg-[#501929] border border-[#621f32]/35 p-2 text-center font-bold uppercase tracking-wider min-w-[70px] text-[#bc955c]"
              >
                Total
                <br />
                Vacantes
              </th>
              {gruposNj.map((g, gIdx) => (
                <th
                  key={g.nj}
                  colSpan={g.niveles.length * 2}
                  className={`bg-[#501929] border border-[#621f32]/35 p-1.5 text-center font-bold uppercase tracking-wider whitespace-nowrap ${
                    gIdx > 0 ? "border-l-4 border-l-[#bc955c]" : ""
                  }`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {gruposNj.flatMap((g, gIdx) =>
                g.niveles.map((nivel, nIdx) => (
                  <th
                    key={`${g.nj}|${nivel}|lbl`}
                    colSpan={2}
                    className={`bg-[#40121e] border border-[#621f32]/35 p-1 text-center font-semibold min-w-[84px] ${
                      nIdx === 0
                        ? gIdx > 0
                          ? "border-l-4 border-l-[#bc955c]"
                          : ""
                        : "border-l-2 border-l-slate-400"
                    }`}
                  >
                    {nivel}
                  </th>
                ))
              )}
            </tr>
            <tr>
              {gruposNj.flatMap((g, gIdx) =>
                g.niveles.flatMap((nivel, nIdx) => [
                  <th
                    key={`${g.nj}|${nivel}|ocup`}
                    className={`bg-[#2b0d15] border border-[#621f32]/35 p-1 text-center font-semibold min-w-[42px] text-[#f2e5d0] ${
                      nIdx === 0
                        ? gIdx > 0
                          ? "border-l-4 border-l-[#bc955c]"
                          : ""
                        : "border-l-2 border-l-slate-400"
                    }`}
                  >
                    Ocup
                  </th>,
                  <th
                    key={`${g.nj}|${nivel}|vac`}
                    className="bg-[#2b0d15] border border-[#621f32]/35 p-1 text-center font-semibold min-w-[42px] text-[#bc955c] border-l border-l-slate-500/40"
                  >
                    Vac
                  </th>,
                ])
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((row, idx) => (
              <tr
                key={row.aduana}
                className={`group border-b-2 border-slate-200 hover:bg-[#621f32]/5 ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <td
                  className={`sticky left-0 z-10 p-2 font-bold text-[#40121e] border-r border-b-2 border-slate-200 whitespace-nowrap group-hover:bg-[#621f32]/5 ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                  }`}
                  title={row.aduana}
                >
                  {row.aduana}
                </td>
                <td
                  onClick={
                    (filaTotales.get(row.aduana)?.ocup ?? 0) > 0
                      ? () => onRowTotalClick(row.aduana, "ocupacion")
                      : undefined
                  }
                  title={
                    (filaTotales.get(row.aduana)?.ocup ?? 0) > 0
                      ? `Ver total ocupadas en ${row.aduana}`
                      : undefined
                  }
                  className={`p-1 text-center border-r border-b-2 border-l-4 border-l-[#bc955c] border-slate-200 bg-[#621f32]/[0.06] font-black text-[#621f32] ${
                    (filaTotales.get(row.aduana)?.ocup ?? 0) > 0 ? "cursor-pointer hover:bg-[#621f32]/10" : ""
                  }`}
                >
                  {filaTotales.get(row.aduana)?.ocup ?? 0}
                </td>
                <td
                  onClick={
                    (filaTotales.get(row.aduana)?.vac ?? 0) > 0
                      ? () => onRowTotalClick(row.aduana, "vacancia")
                      : undefined
                  }
                  title={
                    (filaTotales.get(row.aduana)?.vac ?? 0) > 0
                      ? `Ver total vacantes en ${row.aduana}`
                      : undefined
                  }
                  className={`p-1 text-center border-r border-b-2 border-slate-200 bg-[#bc955c]/[0.10] font-black text-[#8a6739] ${
                    (filaTotales.get(row.aduana)?.vac ?? 0) > 0 ? "cursor-pointer hover:bg-[#bc955c]/15" : ""
                  }`}
                >
                  {filaTotales.get(row.aduana)?.vac ?? 0}
                </td>
                {gruposNj.flatMap((g, gIdx) =>
                  g.niveles.flatMap((nivel, nIdx) => {
                    const ocup = row.ocupacion?.[`${g.nj}|${nivel}`] ?? 0;
                    const vac = row.vacancia?.[`${g.nj}|${nivel}`] ?? 0;
                    const nivelBorder =
                      nIdx === 0
                        ? gIdx > 0
                          ? "border-l-4 border-l-[#bc955c]"
                          : ""
                        : "border-l-2 border-l-slate-300";
                    return [
                      <td
                        key={`${g.nj}|${nivel}|ocup`}
                        onClick={ocup > 0 ? () => onCellClick(row.aduana, g.nj, nivel, "ocupacion") : undefined}
                        title={ocup > 0 ? `Ver empleados ocupando ${nivel} en ${row.aduana}` : undefined}
                        className={`p-1 text-center border-r border-b-2 border-slate-200 bg-[#621f32]/[0.04] group-hover:bg-[#621f32]/10 ${
                          ocup > 0
                            ? "font-bold text-[#621f32] cursor-pointer hover:bg-[#621f32]/10"
                            : "text-slate-300"
                        } ${nivelBorder}`}
                      >
                        {ocup}
                      </td>,
                      <td
                        key={`${g.nj}|${nivel}|vac`}
                        onClick={vac > 0 ? () => onCellClick(row.aduana, g.nj, nivel, "vacancia") : undefined}
                        title={vac > 0 ? `Ver vacantes de ${nivel} en ${row.aduana}` : undefined}
                        className={`p-1 text-center border-r border-l border-l-slate-200 border-b-2 border-slate-200 bg-[#bc955c]/[0.06] group-hover:bg-[#bc955c]/15 ${
                          vac > 0
                            ? "font-bold text-[#8a6739] cursor-pointer hover:bg-[#bc955c]/15"
                            : "text-slate-300"
                        }`}
                      >
                        {vac}
                      </td>,
                    ];
                  })
                )}
              </tr>
            ))}
            {!loading && filas.length === 0 && (
              <tr>
                <td colSpan={totalCols + 3} className="p-6 text-center text-slate-400 font-semibold">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
          {!loading && filas.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#40121e] text-white">
                <td colSpan={3} className="sticky left-0 z-30 bg-[#40121e] border border-[#621f32]/35 p-2 font-bold uppercase tracking-wider text-right">
                  Total por Nivel
                </td>
                {gruposNj.flatMap((g, gIdx) =>
                  g.niveles.flatMap((nivel, nIdx) => {
                    const totales = totalesPorNivel.get(`${g.nj}|${nivel}`) || { ocup: 0, vac: 0 };
                    const nivelBorder =
                      nIdx === 0
                        ? gIdx > 0
                          ? "border-l-4 border-l-[#bc955c]"
                          : ""
                        : "border-l-2 border-l-slate-400";
                    return [
                      <td
                        key={`${g.nj}|${nivel}|ocup-total`}
                        onClick={totales.ocup > 0 ? () => onNivelTotalClick(g.nj, nivel, "ocupacion") : undefined}
                        title={totales.ocup > 0 ? `Ver total ocupadas en ${nivel}` : undefined}
                        className={`p-1 text-center border border-[#621f32]/35 font-black text-[#f2e5d0] ${nivelBorder} ${
                          totales.ocup > 0 ? "cursor-pointer hover:bg-white/10" : ""
                        }`}
                      >
                        {totales.ocup}
                      </td>,
                      <td
                        key={`${g.nj}|${nivel}|vac-total`}
                        onClick={totales.vac > 0 ? () => onNivelTotalClick(g.nj, nivel, "vacancia") : undefined}
                        title={totales.vac > 0 ? `Ver total vacantes en ${nivel}` : undefined}
                        className={`p-1 text-center border border-[#621f32]/35 font-black text-[#bc955c] ${
                          totales.vac > 0 ? "cursor-pointer hover:bg-white/10" : ""
                        }`}
                      >
                        {totales.vac}
                      </td>,
                    ];
                  })
                )}
              </tr>
              <tr className="bg-[#2b0d15] text-white">
                <td colSpan={3} className="sticky left-0 z-30 bg-[#2b0d15] border border-[#621f32]/35 p-2 font-bold uppercase tracking-wider text-right">
                  Total Nivel Jerárquico
                </td>
                {gruposNj.map((g, gIdx) => {
                  const totales = totalesPorNj.get(g.nj) || { ocup: 0, vac: 0 };
                  return (
                    <td
                      key={`${g.nj}|nj-total`}
                      colSpan={g.niveles.length * 2}
                      className={`p-1 text-center border border-[#621f32]/35 font-black whitespace-nowrap ${
                        gIdx > 0 ? "border-l-4 border-l-[#bc955c]" : ""
                      }`}
                    >
                      <span
                        onClick={totales.ocup > 0 ? () => onNjTotalClick(g.nj, "ocupacion") : undefined}
                        title={totales.ocup > 0 ? `Ver total ocupadas en ${g.label}` : undefined}
                        className={`text-[#f2e5d0] ${totales.ocup > 0 ? "cursor-pointer hover:underline" : ""}`}
                      >
                        Ocup: {totales.ocup}
                      </span>
                      {" / "}
                      <span
                        onClick={totales.vac > 0 ? () => onNjTotalClick(g.nj, "vacancia") : undefined}
                        title={totales.vac > 0 ? `Ver total vacantes en ${g.label}` : undefined}
                        className={`text-[#bc955c] ${totales.vac > 0 ? "cursor-pointer hover:underline" : ""}`}
                      >
                        Vac: {totales.vac}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
        {loading && (
          <div className="p-6 text-center text-slate-400 font-semibold text-xs">Cargando…</div>
        )}
      </div>
    </div>
  );
}

export default function AduanasOcupacionVacanciaTab({ cardRef }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useZafiroUpdates();
  const [zafiroTick, setZafiroTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribe(() => setZafiroTick((t) => t + 1));
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    VacantesService.getAduanasOcupacionVacancia({ signal: ctrl.signal })
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Error cargando Aduanas Ocupación vs Vacantes:", err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [zafiroTick]);

  const filasMerged = useMemo(() => {
    const ocupacion = data?.ocupacion || [];
    const vacancia = data?.vacancia || [];
    const porAduana = new Map();

    ocupacion.forEach((row) => {
      porAduana.set(row.aduana, { aduana: row.aduana, ocupacion: row.valores, vacancia: {} });
    });
    vacancia.forEach((row) => {
      const existente = porAduana.get(row.aduana);
      if (existente) existente.vacancia = row.valores;
      else porAduana.set(row.aduana, { aduana: row.aduana, ocupacion: {}, vacancia: row.valores });
    });

    return Array.from(porAduana.values()).sort((a, b) => a.aduana.localeCompare(b.aduana));
  }, [data]);

  const filters = useColumnFilters();
  const [isAduanaFilterOpen, setIsAduanaFilterOpen] = useState(false);
  const aduanaSelected = filters.columnFilters.aduana || [];

  const baseUniqueValues = useMemo(
    () => getUniqueColumnValues(filasMerged, "aduana"),
    [filasMerged]
  );
  const filteredValues = useMemo(() => {
    const q = normalizeForSearch(filters.filterSearchText);
    return q ? baseUniqueValues.filter((v) => normalizeForSearch(v.value).includes(q)) : baseUniqueValues;
  }, [baseUniqueValues, filters.filterSearchText]);
  const dropdownValues = useMemo(
    () =>
      finalizeFilterDropdownValues({
        baseUniqueValues,
        filtered: filteredValues,
        tempSelectedValues: filters.tempSelectedValues,
        committedSelectedValues: aduanaSelected,
      }),
    [baseUniqueValues, filteredValues, filters.tempSelectedValues, aduanaSelected]
  );

  const filasFiltradas = useMemo(() => {
    if (aduanaSelected.length === 0) return filasMerged;
    const set = new Set(aduanaSelected);
    return filasMerged.filter((row) => set.has(row.aduana));
  }, [filasMerged, aduanaSelected]);

  const handleOpenAduanaFilter = () => {
    filters.setTempSelectedValues(aduanaSelected.length > 0 ? aduanaSelected : baseUniqueValues.map((v) => v.value));
    setIsAduanaFilterOpen(true);
  };
  const handleApplyAduanaFilter = () => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(filters.tempSelectedValues, dropdownValues.allVals);
    filters.setColumnFilters((prev) => {
      const next = { ...prev };
      if (shouldClear) delete next.aduana;
      else next.aduana = valuesToCommit;
      return next;
    });
    setIsAduanaFilterOpen(false);
  };
  const handleClearAduanaFilter = () => {
    filters.setColumnFilters((prev) => {
      const next = { ...prev };
      delete next.aduana;
      return next;
    });
    filters.setTempSelectedValues(baseUniqueValues.map((v) => v.value));
    setIsAduanaFilterOpen(false);
  };

  // Detalle por celda (Ocup/Vac) — el endpoint de este tab solo entrega
  // conteos agregados (Aduana x NJ x Nivel), así que el listado de empleados
  // se arma reutilizando los mismos datasets fila-a-fila que ya alimentan
  // Cuadros de Vacancia (Desglose Jerárquico), filtrados aquí por
  // Aduana+NJ+Nivel. Se cargan una sola vez, bajo demanda (primer clic).
  const detailDataRef = useRef({ vacantes: null, ocupados: null });
  // Promesa en vuelo compartida — evita refetch duplicado si el usuario abre
  // otra celda mientras la primera carga sigue pendiente (ver ensureDetailData).
  const detailPromiseRef = useRef(null);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  // null (no array) = todavía sin datos: EmployeesModal detecta que `rows` no
  // es array y, al no recibir tampoco nivel/estatus, cae en su propio modo de
  // "aún sin resolver" y pinta el skeleton interno solo — así el modal abre
  // de inmediato al primer clic en vez de esperar a que resuelva el fetch.
  const [detalleRows, setDetalleRows] = useState(null);
  const [detalleTitle, setDetalleTitle] = useState("");
  const [detalleDefaultColumnKeys, setDetalleDefaultColumnKeys] = useState(null);

  const ensureDetailData = useCallback(() => {
    if (detailDataRef.current.vacantes && detailDataRef.current.ocupados) {
      return Promise.resolve(detailDataRef.current);
    }
    if (!detailPromiseRef.current) {
      detailPromiseRef.current = Promise.all([
        VacantesService.getDesgloseJerarquico(),
        VacantesService.getDesgloseJerarquicoOcupados(),
      ])
        .then(([vacRes, ocuRes]) => Promise.all([vacRes.json(), ocuRes.json()]))
        .then(([vacantes, ocupados]) => {
          detailDataRef.current = { vacantes, ocupados };
          return detailDataRef.current;
        })
        .finally(() => {
          detailPromiseRef.current = null;
        });
    }
    return detailPromiseRef.current;
  }, []);

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const handleExportExcel = useCallback(async () => {
    setIsExportingExcel(true);
    try {
      const { vacantes, ocupados } = await ensureDetailData();
      const { generateAduanasOcupacionVacanciaExcel } = await import("@/utils/aduanasOcupacionVacanciaExcel");
      await generateAduanasOcupacionVacanciaExcel(data?.grupos_nj || [], filasFiltradas, vacantes, ocupados);
    } catch (err) {
      console.error("Error generando Excel de Ocupación vs Vacancia:", err);
      alert("Error al generar Excel: " + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  }, [ensureDetailData, data, filasFiltradas]);

  // Filtro genérico sobre el dataset fila-a-fila (ocupados/vacantes): cualquier
  // criterio omitido (undefined) actúa como "todos" — así una misma función
  // sirve para el detalle de una celda (aduana+nj+nivel), el total de fila
  // (solo aduana), el total por columna de nivel (nj+nivel, todas las aduanas
  // visibles) y el total por NJ (solo nj, todas las aduanas visibles).
  const filterDetailRows = useCallback((source, { aduana, nj, nivel, allowedAduanas } = {}) => {
    const njNorm = nj !== undefined ? nj || "" : undefined;
    return (source || []).filter((item) => {
      const itemAduana = String(item["Aduana"] || "").trim();
      const itemNj = String(item["NJ"] ?? "").trim();
      const itemNivel = String(item["Nivel"] || "").trim();
      if (aduana !== undefined && itemAduana !== aduana) return false;
      if (allowedAduanas && !allowedAduanas.has(itemAduana)) return false;
      if (njNorm !== undefined && itemNj !== njNorm) return false;
      if (nivel !== undefined && itemNivel !== nivel) return false;
      return true;
    });
  }, []);

  // Abre el modal de inmediato (título + skeleton, `rows` aún null) y llena
  // las filas cuando `loadRows` resuelve — separado de abrir para que el
  // usuario nunca vea el modal "tardar" en aparecer al primer clic.
  const openDetalle = useCallback((title, tipo, loadRows) => {
    setDetalleTitle(title);
    setDetalleRows(null);
    setDetalleDefaultColumnKeys(tipo === "ocupacion" ? OCUPACION_DEFAULT_COLUMN_KEYS : null);
    setIsDetalleModalOpen(true);
    loadRows().then((rows) => setDetalleRows(rows.map(mapVacanteRowToEmployeeRow)));
  }, []);

  const handleCellClick = useCallback(
    (aduana, nj, nivel, tipo) => {
      openDetalle(`${aduana} — ${nivel} — ${tipo === "ocupacion" ? "Ocupación" : "Vacancia"}`, tipo, async () => {
        const { vacantes, ocupados } = await ensureDetailData();
        const source = tipo === "ocupacion" ? ocupados : vacantes;
        return filterDetailRows(source, { aduana, nj, nivel });
      });
    },
    [ensureDetailData, filterDetailRows, openDetalle]
  );

  const handleRowTotalClick = useCallback(
    (aduana, tipo) => {
      openDetalle(`${aduana} — Total ${tipo === "ocupacion" ? "Ocupadas" : "Vacantes"}`, tipo, async () => {
        const { vacantes, ocupados } = await ensureDetailData();
        const source = tipo === "ocupacion" ? ocupados : vacantes;
        return filterDetailRows(source, { aduana });
      });
    },
    [ensureDetailData, filterDetailRows, openDetalle]
  );

  const handleNivelTotalClick = useCallback(
    (nj, nivel, tipo) => {
      openDetalle(`${nivel} — Total ${tipo === "ocupacion" ? "Ocupadas" : "Vacantes"}`, tipo, async () => {
        const { vacantes, ocupados } = await ensureDetailData();
        const source = tipo === "ocupacion" ? ocupados : vacantes;
        const allowedAduanas = new Set(filasFiltradas.map((f) => f.aduana));
        return filterDetailRows(source, { nj, nivel, allowedAduanas });
      });
    },
    [ensureDetailData, filterDetailRows, openDetalle, filasFiltradas]
  );

  const handleNjTotalClick = useCallback(
    (nj, tipo) => {
      const njLabel = (data?.grupos_nj || []).find((g) => g.nj === nj)?.label || nj;
      openDetalle(`${njLabel} — Total ${tipo === "ocupacion" ? "Ocupadas" : "Vacantes"}`, tipo, async () => {
        const { vacantes, ocupados } = await ensureDetailData();
        const source = tipo === "ocupacion" ? ocupados : vacantes;
        const allowedAduanas = new Set(filasFiltradas.map((f) => f.aduana));
        return filterDetailRows(source, { nj, allowedAduanas });
      });
    },
    [ensureDetailData, filterDetailRows, openDetalle, filasFiltradas, data]
  );

  return (
    <div ref={cardRef} className="w-full flex flex-col gap-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <GroupedCountTable
          gruposNj={data?.grupos_nj || []}
          filas={filasFiltradas}
          loading={loading}
          aduanaFilterActive={aduanaSelected.length > 0}
          onOpenAduanaFilter={handleOpenAduanaFilter}
          onCellClick={handleCellClick}
          onRowTotalClick={handleRowTotalClick}
          onNivelTotalClick={handleNivelTotalClick}
          onNjTotalClick={handleNjTotalClick}
          headerRight={
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-2 bg-gradient-to-r from-[#621f32] to-[#8d2c48] hover:from-[#7a2942] hover:to-[#a13456] text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExportingExcel
                ? <div className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : <Download className="size-3.5" />}
              <span>{isExportingExcel ? "Generando..." : "Descargar Excel"}</span>
            </button>
          }
        />
      </div>

      <EmployeesModal
        open={isDetalleModalOpen}
        onOpenChange={setIsDetalleModalOpen}
        rows={detalleRows}
        title={detalleTitle}
        defaultColumnKeys={detalleDefaultColumnKeys}
      />

      <ColumnFilterDropdown
        open={isAduanaFilterOpen}
        columnKey="aduana"
        columnLabel="Aduana"
        isDate={false}
        data={filasMerged}
        filters={filters}
        dropdownValues={dropdownValues}
        onApply={handleApplyAduanaFilter}
        onClear={handleClearAduanaFilter}
        onClose={() => setIsAduanaFilterOpen(false)}
      />
    </div>
  );
}
