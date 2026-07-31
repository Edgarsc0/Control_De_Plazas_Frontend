"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { 
  Search, Download, Columns, Filter, ArrowUpDown, ChevronLeft, 
  ChevronRight as ChevronRightIcon, ChevronDown, ChevronsLeft, ChevronsRight, 
  X, Check, RotateCcw, Activity, Users, UserCheck, UserMinus,
  UserX, CalendarDays, Briefcase, Network, ArrowUp, ArrowUpCircle, ArrowDown, Eye, History, Loader2,
  MousePointerClick, UserPlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Zoom } from "react-awesome-reveal";
import { VacantesService } from "@/services/vacantes.service";
import { useZafiroUpdates } from "@/context/ZafiroUpdatesContext";
import { addExcelLetterhead } from "@/utils/excelLetterhead";
import { EmployeeRecordModal } from "../../shared/EmployeesModal";
import EmpleadoTimelineModal from "../../modals/EmpleadoTimelineModal";
import ExportConFotosModal from "../../shared/ExportConFotosModal";
import ColumnsModal from "../../shared/ColumnsModal";
import ColumnFilterDropdown from "../../shared/ColumnFilterDropdown";
import DataTable from "../../shared/DataTable";
import FotoEmpleadoCell from "../../shared/FotoEmpleadoCell";
import CopyCellMenu from "../../shared/CopyCellMenu";
import CeldaHistorialModal from "../../shared/CeldaHistorialModal";
import CeldaValorModal from "../../shared/CeldaValorModal";
import VacanciaDetalleModal from "../../shared/VacanciaDetalleModal";
import ModalShell from "@/components/shared/ModalShell";
import MobileCardList from "@/components/ui/MobileCardList";
import MobileTableToolbar from "@/components/ui/MobileTableToolbar";
import AdvancedFiltersModal, { AdvancedFiltersButton } from "../../shared/AdvancedFiltersModal";
import { useColumnState } from "../../../_hooks/useColumnState";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../../_hooks/useCellSelection";
import { useEscapeToClose } from "../../../_hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { usePersistedState } from "../../../_hooks/usePersistedState";
import { useColumnFilters } from "../../../_hooks/useColumnFilters";
import { useAdvancedFilters } from "../../../_hooks/useAdvancedFilters";
import { matchesTextCondition, getUniqueColumnValues, finalizeFilterDropdownValues, resolveColumnFilterCommit, normalizeForSearch, getConditionLabel, formatDateEsMx, parseDateParts, applyColumnFilters, defaultGetCellValue } from "@/utils/columnFilters";
import { evaluateAdvancedFilters } from "@/utils/advancedFilters";
import { getDeptoInfo } from "@/utils/organigramaCatalog";
import { useOrganigramaCatalog } from "../../../_hooks/useOrganigramaCatalog";
import { getMotivoInfo } from "@/utils/accionesMotivosCatalog";
import { useAccionesMotivosCatalog } from "../../../_hooks/useAccionesMotivosCatalog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { daysUntil, getAnuenciaColorClasses, FECHA_ANUENCIA_CATEGORIAS } from "@/utils/anuencia";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/hooks/useToast";

// Columna de presentación (no es un campo de la tabla): la fotografía se pide
// bajo demanda por número de empleado, no viene en `detalle`. Se excluye de
// exportaciones, filtros avanzados y tarjetas móviles, y no es editable.
const FOTO_COLUMN_KEY = "foto";

// Clave de negocio (identifica la fila) y columna de foto: no admiten
// "Pegar valor en celda" ni edición inline.
// "fecha_genera_vacante" tampoco es editable: siempre muestra la fecha
// calculada (fecha_vacancia de MOV_POS), nunca la del Excel (que tiene
// errores conocidos en esa columna) — ver comentario de QUINCENAL_COLS.
const NON_EDITABLE_KEYS = new Set(["posicion", FOTO_COLUMN_KEY, "fecha_genera_vacante"]);

// "fecha_anuencia_detalle" (columna AL) NO está aquí: se unificó con el
// sistema de "Fecha de Anuencia" que ya existe en Mov. Posiciones (mismo
// override, misma fecha en ambos tabs — ver FECHA_ANUENCIA_COL más abajo).
// "fecha_genera_vacante" (columna AQ) tampoco: se unificó con "Fecha de
// Vacancia" de Mov. Posiciones (fecha_vacancia calculada por el SP de
// ZAFIRO) — el Excel tiene errores conocidos ahí, así que dejó de ser
// editable y de cargarse del Excel (ver NON_EDITABLE_KEYS arriba y
// plantilla.views._get_fecha_vacancia_bulk_map en el backend).
const QUINCENAL_COLS = new Set([
  "oficios_autorizacion_shcp",
  "plazas_eventuales_autorizacion_2026",
  "candidato",
  "reportada",
  "cap_anual",
  "cap_mensual",
  "observaciones_plantillas_do",
  "observaciones_proyectos_alineaciones",
  "anno_vacancia",
  "solicitante",
  "nombre_candidato",
  "motivo_solicitud"
]);

// Columnas dedicadas para capturar el candidato de una plaza VACANTE que fue
// solicitada (mismo dato que en el Excel se escribe sobre RFC/CURP/Nombres/
// Motivo, pero en columnas propias — así nunca se pisan los datos reales del
// empleado si la plaza se llega a ocupar). El backend ya las blanquea si la
// posición está ocupada (ver COLUMNAS_SOLICITUD_VACANTE en el backend), así
// que "hay datos de solicitud" es suficiente para derivar el estatus.
const SOLICITUD_COLS = ["solicitante", "nombre_candidato", "motivo_solicitud"];
const hasSolicitudData = (row) => SOLICITUD_COLS.some((k) => String(row[k] || "").trim() !== "");

// "Fecha de Anuencia" edita/borra vía el MISMO endpoint que Mov. Posiciones
// (VacantesService.patchFechaAnuenciaOverride/deleteFechaAnuenciaOverride,
// keyed por posicion === no_pos_actual) — no por patchColumnaQuincenal.
const FECHA_ANUENCIA_COL = "fecha_anuencia_detalle";

// El filtro de columna de "Fecha de Anuencia" agrupa por el MISMO semáforo
// de color que ya se ve en la celda (ver getAnuenciaColorClasses), en vez de
// por fecha exacta — así se puede filtrar "todas las rojas", por ejemplo.
// Las categorías de texto fijo (Nueva Creación, etc.) se conservan tal cual,
// fuera del semáforo, para poder seguir filtrando por ellas también.
const getFechaAnuenciaBucket = (row) => {
  const value = row[FECHA_ANUENCIA_COL];
  if (value === null || value === undefined || String(value).trim() === "") return "Sin fecha";
  if (row.fecha_anuencia_detalle_override) return "🔵 Editado manualmente";
  const dias = daysUntil(value);
  if (dias === null) return String(value).trim();
  if (dias >= 20) return "🟢 Verde (20+ días)";
  if (dias >= 10) return "🟡 Ámbar (10-19 días)";
  return "🔴 Rojo (≤9 días o vencida)";
};

// Valor "efectivo" de una celda para filtrar/agrupar por columna — centraliza
// los casos especiales (estado_nomina se filtra por su etiqueta, no por el
// código A/S/L/P; Fecha de Anuencia se filtra por semáforo, ver arriba) en un
// solo lugar para que dropdown, conteos alcanzables y filtrado real nunca se
// desincronicen entre sí.
const getFilterCellValue = (row, key) => {
  if (key === "estado_nomina") return getEstadoNominaDisplay(row);
  if (key === FECHA_ANUENCIA_COL) return getFechaAnuenciaBucket(row);
  return String(row[key] || "").trim();
};

const STATUS_COLORS = { "Activo": "#621f32", "Vacante": "#bc955c", "Solicitada": "#eab308", "Suspendido": "#3b82f6", "Permiso": "#8b5cf6", "Permiso Retribuido": "#10b981" };
const STATUS_ICONS = { "Activo": UserCheck, "Vacante": UserMinus, "Solicitada": UserPlus, "Suspendido": UserX, "Permiso": CalendarDays, "Permiso Retribuido": Activity };
const STATUS_BADGE_STYLES = {
  "Activo": { bg: "bg-[#621f32]/8 dark:bg-[#621f32]/15", text: "text-[#621f32] dark:text-[#f3dcd4]", border: "border-[#621f32]/20 dark:border-[#621f32]/30" },
  "Vacante": { bg: "bg-[#bc955c]/8 dark:bg-[#bc955c]/15", text: "text-[#a37944] dark:text-[#ebd1ac]", border: "border-[#bc955c]/20 dark:border-[#bc955c]/30" },
  "Solicitada": { bg: "bg-yellow-100 dark:bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-300 dark:border-yellow-500/30" },
  "Suspendido": { bg: "bg-blue-50/50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-300", border: "border-blue-200/50 dark:border-blue-900/40" },
  "Permiso": { bg: "bg-purple-50/50 dark:bg-purple-950/20", text: "text-purple-600 dark:text-purple-300", border: "border-purple-200/50 dark:border-purple-900/40" },
  "Permiso Retribuido": { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/50 dark:border-emerald-900/40" }
};

// Códigos crudos (A/S/L/P) tal como llegan de EmpleadosCompletosSig; las
// etiquetas usan la nomenclatura de la plantilla de Excel (Permiso/Permiso
// Retribuido), no los nombres históricos Licencia/Licencia Médica.
const mapEstadoNomina = (val) => {
  if (!val || val.trim() === "") return "Vacante";
  switch (val.trim().toUpperCase()) {
    case "A": return "Activo";
    case "S": return "Suspendido";
    case "L": return "Permiso";
    case "P": return "Permiso Retribuido";
    default: return "Vacante";
  }
};

// Estatus mostrado al usuario: igual que mapEstadoNomina, salvo que una plaza
// Vacante con datos de candidato capturados (ver SOLICITUD_COLS) se muestra
// como "Solicitada" — el backend ya garantiza que esos datos solo existen
// mientras la plaza siga vacante (ver COLUMNAS_SOLICITUD_VACANTE), así que no
// hace falta ninguna bandera guardada, solo derivarlo en cada lectura.
const getEstadoNominaDisplay = (row) => {
  const base = mapEstadoNomina(row.estado_nomina);
  return base === "Vacante" && hasSolicitudData(row) ? "Solicitada" : base;
};

// Códigos de partida confirmados con el usuario: 11301=Permanente,
// 12201=Eventual (Eventual N.C. si además la posición inicia con "2026"),
// 11401=PASEM (solo 2 posiciones). El código 12101 (119 posiciones, todas
// vacantes, prefijo "2019", ninguna en el catálogo Plantilla1800Plazas —
// probablemente plazas eventuales legadas fuera de la plantilla oficial
// vigente) aún no tiene regla confirmada — se muestra tal cual (sin mapear)
// en vez de adivinar.
const mapPartida = (val, posicion) => {
  const codigo = String(val ?? "").trim();
  if (codigo === "11301") return "Permanente";
  if (codigo === "11401") return "PASEM";
  if (codigo === "12201") {
    return String(posicion ?? "").trim().startsWith("2026") ? "Eventual N.C." : "Eventual";
  }
  return codigo;
};

const TIPO_CONTRATACION_LABELS = { SAT_CFZA: "Confianza", SAT_BSE: "Base" };
const mapTipoContratacion = (val) => {
  const codigo = String(val ?? "").trim();
  return TIPO_CONTRATACION_LABELS[codigo] || codigo;
};

// "Rango" (grado militar) viene vacío para la gran mayoría del personal
// (77% medido) porque solo aplica a personal SEDENA/SEMAR — para personal
// Civil, el propio valor por default es "Civil" (confirmado con el usuario).
const displayRango = (rango, tipoPersonal) => {
  const val = String(rango ?? "").trim();
  if (val) return val;
  return String(tipoPersonal ?? "").trim().toLowerCase() === "civil" ? "Civil" : "";
};

const CURRENCY_KEYS = new Set(["smb", "smn", "cap_anual", "cap_mensual"]);
const formatCurrency = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Cadena de mando: el backend ya manda `Estado_Nomina` real por nodo (A/S/L/P
// o vacío = vacante). Fallback para respuestas viejas sin el campo: nombre
// vacío = posición vacante.
const getNodoEstado = (node) => {
  if (node?.Estado_Nomina !== undefined && node?.Estado_Nomina !== null) {
    return mapEstadoNomina(String(node.Estado_Nomina));
  }
  return !node?.Empleado || String(node.Empleado).trim() === "" ? "Vacante" : "Activo";
};
const isNodoVacante = (node) => getNodoEstado(node) === "Vacante";

// `Posicion_Activa`: independiente del estado del empleado que la ocupa —
// viene del backend (MOV_POS: `Estado Psn` del movimiento más reciente por
// posición). Una posición puede seguir marcada "Activo" en Estado_Nomina sin
// que su último movimiento la reconozca como vigente (dato desincronizado).
const isPosicionActiva = (node) => node?.Posicion_Activa === true;

// Configuración de todas las claves posibles (fuera del componente para evitar re-creación)
const ALL_DETAIL_KEYS = [
  "posicion", "estado_nomina", "id_empleado", "rfc", "curp", "nombres", "motivo", 
  "fecha_efectiva_personal", "fecha_de_captura", "qna", "fecha_prevista_de_salida", 
  "nj", "codigo_presupuestal", "nivel", "numeral", "ua", "cent", "dir", "subd", "jd", 
  "depto", "aduana", "tipo", "estado", "municipio", "ua2", "escala", "smb", "smn", 
  "partida", "tipo_de_contratacion", "cd_un", "unidad_de_negocio", "cd_ua", 
  "unidad_administrativa", "cd_pto_funcional", "nombre_puesto_funcional", 
  "id_departamento", "departamento", "dependencia_directa", "observaciones", 
  "ubicacion", "descripcion_ubicacion", "posicion_civil_sedena_semar", 
  "personal_militar_o_civil", "tipo_de_personal_sedena_semar", "rango", 
  "fecha_de_ingreso", "val_estat", "status_jefe_inm_posicion", "numempleado", 
  "sindicato", "entidad_federativa", "tipo_de_aduana", "dg_o_aduana_compactada", 
  "estado_en_nomina", "ua_validacion", "validando_posicion_por_documento", 
  "nj_comp", "nj_ok", "columna", "nombre_nj", "nj_operativo_comb",
  "codigo",
  "fecha_anuencia_detalle", "oficios_autorizacion_shcp", "plazas_eventuales_autorizacion_2026",
  "candidato", "reportada", "fecha_genera_vacante", "cap_anual", "cap_mensual",
  "observaciones_plantillas_do", "observaciones_proyectos_alineaciones", "anno_vacancia"
];

const DATE_KEYS = ["fecha_efectiva_personal", "fecha_de_captura", "fecha_prevista_de_salida", "fecha_de_ingreso", "fecha_anuencia_detalle", "fecha_genera_vacante"];

// El dropdown de filtro por columna agrupa las fechas en un árbol año>mes>día
// (ver dateHierarchies) — pero "fecha_anuencia_detalle" puede traer texto
// (categorías fijas: "Nueva Creación", "En Proceso", etc., ver
// FECHA_ANUENCIA_COL), que ese árbol simplemente descarta (no son fechas
// parseables) dejando el dropdown sin poder filtrarlas y con solo el año
// visible. Se excluye aquí de MODO FILTRO (cae a lista plana de valores
// únicos, que sí las incluye) sin afectar el formateo de fecha en pantalla
// (que sigue usando DATE_KEYS/isDateColumn tal cual).
const DATE_HIERARCHY_KEYS = DATE_KEYS.filter((k) => k !== FECHA_ANUENCIA_COL);

// Columnas que DEFINEN la vacancia de la posición: su dropdown debe iterar
// `detalle` (con vacantes) y no `detalleParaFiltros` (que las excluye a
// propósito para el resto de columnas, ver ahí). Si iteran el dataset recortado
// se excluyen a sí mismas el valor "Vacante" antes de contarlo y nunca aparece
// en su propio filtro. En BD son el mismo conjunto de filas: `Val_estat`
// ='Vacante' <=> `Estado Nómina` vacío (mapEstadoNomina → "Vacante").
const VACANCY_DEFINING_KEYS = new Set(["estado_nomina", "val_estat"]);

// CpTblMovCompleto290526 no trae un campo de nombre completo combinado (igual
// que en MovimientosPersonalTab): se arma a partir de nombre + ap_pat + ap_mat.
const buildMovHoyFullName = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(" ").trim();
const MOV_HOY_DATE_KEYS = ["fecha_efectiva", "fecha_captura"];

/**
 * 8.5 QA — Cadena de mando descendente: nodo recursivo del árbol de
 * subordinados (directos + indirectos). A diferencia de la pirámide
 * ascendente (camino único, 1 jefe por nivel), aquí cada nodo puede tener N
 * hijos, así que se renderiza como árbol expandible en vez de columna lineal.
 * Colapsado por defecto salvo la raíz, para no reventar el layout con
 * organigramas grandes.
 */
function CadenaTreeNode({
  node, depth, expandedNodes, onToggle, isRoot = false,
  // Filtro/búsqueda dentro del árbol: visibleSet = nodos a renderizar (matches
  // + sus ancestros como contexto atenuado); null = sin filtro, todo visible.
  filterActive = false, visibleSet = null, matchedSet = null,
  // Catálogo departamento→{nombre, nivel} de ORGANIGRAMA_ANAM (isSIGInfo=1).
  deptoCatalog = null,
  // Agrupación de vacantes hoja y drill-down de rama.
  expandedVacGroups, onToggleVacGroup, onFocusNode,
  // Poda "solo directos": no renderizar hijos a partir de esta profundidad.
  maxDepth = Infinity,
}) {
  const hasChildren = node.children.length > 0;
  const canShowChildren = hasChildren && depth < maxDepth;
  // Con filtro activo se fuerza expansión: los visibles son matches y su
  // cadena de ancestros, colapsarlos escondería justo lo buscado.
  const isExpanded = filterActive ? true : (isRoot || expandedNodes.has(node.Posicion));
  const estado = getNodoEstado(node);
  const isVacante = estado === "Vacante";
  const isDimmed = filterActive && matchedSet && !matchedSet.has(node.Posicion);
  // Hijos ya vienen ordenados (ocupados primero, vacantes al final) desde
  // cadenaTree; aquí solo se cuentan para el resumen del badge.
  const ocupadosDirectos = node.children.reduce((acc, c) => acc + (isNodoVacante(c) ? 0 : 1), 0);
  const vacantesDirectos = node.children.length - ocupadosDirectos;
  const statusStyle = STATUS_BADGE_STYLES[estado] || STATUS_BADGE_STYLES["Vacante"];
  const StatusIcon = STATUS_ICONS[estado] || STATUS_ICONS["Vacante"];
  const deptoInfo = getDeptoInfo(deptoCatalog, node.Id_Departamento);
  const sinMatchSig = !!deptoCatalog && !!String(node.Id_Departamento || "").trim() && !deptoInfo;

  // Vacantes hoja (sin subordinados) se agrupan en una sola fila expandible
  // cuando son 4+, para no ahogar el árbol; con filtro activo se muestran
  // normales (podrían ser justo el resultado buscado).
  const visibleChildren = visibleSet ? node.children.filter(c => visibleSet.has(c.Posicion)) : node.children;
  const vacantesHoja = [];
  const hijosNormales = [];
  visibleChildren.forEach(c => {
    if (isNodoVacante(c) && c.children.length === 0) vacantesHoja.push(c);
    else hijosNormales.push(c);
  });
  const agruparVacantes = !filterActive && vacantesHoja.length > 3;
  const grupoExpandido = agruparVacantes && expandedVacGroups?.has(node.Posicion);

  const childProps = { expandedNodes, onToggle, filterActive, visibleSet, matchedSet, deptoCatalog, expandedVacGroups, onToggleVacGroup, onFocusNode, maxDepth };

  return (
    <div className={depth > 0 ? "ml-5 sm:ml-7 border-l-2 border-slate-200 dark:border-slate-800 pl-4 sm:pl-5" : ""}>
      <div
        className={`group/nodo flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-colors ${isDimmed ? "opacity-50" : ""} ${
          isRoot
            ? "bg-[#621f32]/5 dark:bg-[#bc955c]/10 border-[#621f32]/15 dark:border-[#bc955c]/20"
            : isVacante
              ? "border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40"
              : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60"
        }`}
      >
        <button
          type="button"
          onClick={() => canShowChildren && onToggle(node.Posicion)}
          disabled={!canShowChildren}
          className={`shrink-0 size-6 flex items-center justify-center rounded-lg transition-colors ${canShowChildren ? "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer" : "text-slate-300 dark:text-slate-700"}`}
          title={canShowChildren ? (isExpanded ? "Colapsar" : "Expandir") : "Sin subordinados"}
        >
          {canShowChildren ? (isExpanded ? <ChevronDown className="size-4" /> : <ChevronRightIcon className="size-4" />) : <span className="size-1.5 rounded-full bg-current" />}
        </button>
        <div className={`shrink-0 size-8 rounded-full flex items-center justify-center border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
          <StatusIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black truncate ${isRoot ? "text-base text-slate-900 dark:text-white" : isVacante ? "text-sm text-slate-400 dark:text-slate-500 italic" : "text-sm text-slate-700 dark:text-slate-200"}`}>
              {isVacante ? "Posición vacante" : node.Empleado}
            </span>
            {isRoot && <span className="shrink-0 px-2 py-0.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] text-[9px] font-black uppercase rounded-full">Consultado</span>}
            {!isRoot && (
              <span className={`shrink-0 px-2 py-0.5 text-[9px] font-black uppercase rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                {estado === "Activo" ? "Ocupada" : estado}
              </span>
            )}
            {hasChildren && (
              <span className="shrink-0 flex items-center gap-1">
                {ocupadosDirectos > 0 && (
                  <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${STATUS_BADGE_STYLES["Activo"].bg} ${STATUS_BADGE_STYLES["Activo"].text} ${STATUS_BADGE_STYLES["Activo"].border}`}>
                    {ocupadosDirectos} ocupado{ocupadosDirectos === 1 ? "" : "s"}
                  </span>
                )}
                {vacantesDirectos > 0 && (
                  <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${STATUS_BADGE_STYLES["Vacante"].bg} ${STATUS_BADGE_STYLES["Vacante"].text} ${STATUS_BADGE_STYLES["Vacante"].border}`}>
                    {vacantesDirectos} vacante{vacantesDirectos === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            )}
            {sinMatchSig && (
              <span className="shrink-0 px-2 py-0.5 text-[9px] font-black uppercase rounded-full border bg-amber-50/60 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40" title="El código de departamento no existe en ORGANIGRAMA_ANAM (isSIGInfo=1)">
                Sin match SIG
              </span>
            )}
            {node.Posicion_Activa === false && (
              <span className="shrink-0 px-2 py-0.5 text-[9px] font-black uppercase rounded-full border bg-rose-50/60 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40" title="El movimiento más reciente de esta posición en MOV_POS no tiene Estado Psn = 'A'">
                Posición inactiva
              </span>
            )}
            {hasChildren && !isRoot && onFocusNode && (
              <button
                type="button"
                onClick={() => onFocusNode(node.Posicion)}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/nodo:opacity-100 transition-all cursor-pointer"
                title="Enfocar esta rama"
              >
                <Eye className="size-3.5" />
              </button>
            )}
          </div>
          <p className={`text-xs font-bold truncate ${isVacante ? "text-slate-400 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>{node.Puesto_Funcional || "Puesto no especificado"}</p>
          {(deptoInfo || node.Departamento || node.Unidad_Administrativa) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5 cursor-help w-fit max-w-full">
                  <span className="text-slate-500 dark:text-slate-400">{deptoInfo?.nombre || node.Departamento || "Departamento no especificado"}</span>
                  {deptoInfo?.nivel && <span className="ml-1.5 px-1.5 py-px rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[8px] font-black">{deptoInfo.nivel}</span>}
                </p>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="text-[11px] space-y-1">
                  <p><span className="font-black uppercase text-[9px] opacity-70">Unidad de Negocio:</span> {node.Cd_UN ? `${node.Cd_UN} — ` : ""}{node.Unidad_Negocio || "—"}</p>
                  <p><span className="font-black uppercase text-[9px] opacity-70">Unidad Administrativa:</span> {node.Cd_UA ? `${node.Cd_UA} — ` : ""}{node.Unidad_Administrativa || "—"}</p>
                  <p><span className="font-black uppercase text-[9px] opacity-70">Departamento:</span> {node.Id_Departamento || "—"}</p>
                  <p><span className="font-black uppercase text-[9px] opacity-70">Nombre SIG:</span> {deptoInfo?.nombre || "Sin match en organigrama SIG"}</p>
                  {deptoInfo?.nivel && <p><span className="font-black uppercase text-[9px] opacity-70">Nivel dirección:</span> {deptoInfo.nivel}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">
            POS: {node.Posicion}
            {node.Nivel && <span className="ml-2">NIVEL: {node.Nivel}</span>}
            {node.Cd_UA && <span className="ml-2">UA: {node.Cd_UA}</span>}
            {node.Cd_UN && <span className="ml-2">UN: {node.Cd_UN}</span>}
            {node.Id_Departamento && <span className="ml-2">DEPTO: {node.Id_Departamento}</span>}
            {hasChildren && !isRoot && <span className="ml-2 text-[#621f32]/60 dark:text-[#bc955c]/60 font-bold">{node.totalDescendants} en rama</span>}
          </p>
        </div>
      </div>
      {canShowChildren && isExpanded && (
        <div className="flex flex-col gap-1 mt-1">
          {hijosNormales.map(child => (
            <CadenaTreeNode key={child.Posicion} node={child} depth={depth + 1} {...childProps} />
          ))}
          {agruparVacantes ? (
            <div className="ml-5 sm:ml-7 border-l-2 border-slate-200 dark:border-slate-800 pl-4 sm:pl-5">
              <button
                type="button"
                onClick={() => onToggleVacGroup?.(node.Posicion)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border border-dashed border-[#bc955c]/40 dark:border-[#bc955c]/30 bg-[#bc955c]/5 dark:bg-[#bc955c]/10 text-left hover:bg-[#bc955c]/10 dark:hover:bg-[#bc955c]/15 transition-colors cursor-pointer"
              >
                {grupoExpandido ? <ChevronDown className="size-4 text-[#a37944] dark:text-[#ebd1ac]" /> : <ChevronRightIcon className="size-4 text-[#a37944] dark:text-[#ebd1ac]" />}
                <UserMinus className="size-4 text-[#a37944] dark:text-[#ebd1ac]" />
                <span className="text-xs font-black text-[#a37944] dark:text-[#ebd1ac]">{vacantesHoja.length} posiciones vacantes</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{grupoExpandido ? "(clic para agrupar)" : "(clic para desglosar)"}</span>
              </button>
            </div>
          ) : null}
          {(agruparVacantes ? (grupoExpandido ? vacantesHoja : []) : vacantesHoja).map(child => (
            <CadenaTreeNode key={child.Posicion} node={child} depth={depth + 1} {...childProps} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlantillaDetalleTab({ detalle = [], onCellEdited, resumen = {}, isPending, startTransition, cardRef, isLoading, remoteUpdatesCount = 0, onClearRemoteUpdates }) {
  const [mounted, setMounted] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportFotosModalOpen, setIsExportFotosModalOpen] = useState(false);
  const [isExportingConFotos, setIsExportingConFotos] = useState(false);
  const exportConFotosAbortRef = useRef(null);
  useEffect(() => setMounted(true), []);

  // Indicador flotante de movimientos capturados hoy en cp_tbl_mov_completo_29_05_26
  // (fecha_captura = hoy). `page_size: 1` porque solo se necesita el total paginado.
  // Se refetchea al montar y cada vez que Celery termina el swap blue-green
  // (evento SSE "zafiro_updates" publicado en tasks.py y propagado por
  // ZafiroUpdatesContext) — sin esto el badge quedaba congelado con el valor
  // del montaje hasta que el usuario recargaba la página.
  const fechaHoy = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const [movimientosHoyCount, setMovimientosHoyCount] = useState(0);
  const { subscribe: subscribeZafiroUpdates } = useZafiroUpdates();
  useEffect(() => {
    let active = true;
    const fetchMovimientosHoyCount = () => {
      VacantesService.getMovimientosPersonal({ fecha_captura: fechaHoy, page_size: 1 })
        .then(async (response) => {
          if (!response.ok || !active) return;
          const data = await response.json();
          setMovimientosHoyCount(data?.count ?? 0);
        })
        .catch((err) => console.error("Error fetching movimientos de hoy:", err));
    };
    fetchMovimientosHoyCount();
    const unsubscribe = subscribeZafiroUpdates(fetchMovimientosHoyCount);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [fechaHoy, subscribeZafiroUpdates]);

  // Resumen (modal) de movimientos de hoy: desglose por acción y, al elegir una
  // acción, por motivo — mismo patrón de dona+leyenda que la tarjeta de
  // estadísticas de MovimientosPersonalTab, pero acotado al día de hoy.
  const [isMovimientosHoyModalOpen, setIsMovimientosHoyModalOpen] = useState(false);
  const [accionHoyStats, setAccionHoyStats] = useState([]);
  const [accionHoyStatsLoading, setAccionHoyStatsLoading] = useState(false);
  const [selectedAccionHoy, setSelectedAccionHoy] = useState(null);
  const [motivoHoyStats, setMotivoHoyStats] = useState([]);
  const [motivoHoyStatsLoading, setMotivoHoyStatsLoading] = useState(false);

  // Al elegir un motivo dentro de una acción, se muestra el listado de
  // movimientos reales que componen ese cruce (acción + motivo + hoy) en una
  // DataTable — el detalle "de última milla" tras el resumen por acción/motivo.
  const [selectedMotivoHoy, setSelectedMotivoHoy] = useState(null);
  const [movimientosHoyDetalle, setMovimientosHoyDetalle] = useState([]);
  const [movimientosHoyDetalleLoading, setMovimientosHoyDetalleLoading] = useState(false);

  useEffect(() => {
    if (!isMovimientosHoyModalOpen) return;
    let active = true;
    setAccionHoyStatsLoading(true);
    setSelectedAccionHoy(null);
    VacantesService.getMovimientosPersonalStats({ fecha_captura__in: fechaHoy })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const data = await response.json();
        setAccionHoyStats(data?.all || []);
      })
      .catch((err) => console.error("Error fetching stats de movimientos de hoy:", err))
      .finally(() => { if (active) setAccionHoyStatsLoading(false); });
    return () => {
      active = false;
    };
  }, [isMovimientosHoyModalOpen, fechaHoy]);

  useEffect(() => {
    setSelectedMotivoHoy(null);
    if (!selectedAccionHoy) {
      setMotivoHoyStats([]);
      return;
    }
    let active = true;
    setMotivoHoyStatsLoading(true);
    VacantesService.getMovimientosPersonalStats({ fecha_captura__in: fechaHoy, accion_nombre: selectedAccionHoy })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const data = await response.json();
        setMotivoHoyStats(data?.all || []);
      })
      .catch((err) => console.error("Error fetching stats de motivos de hoy:", err))
      .finally(() => { if (active) setMotivoHoyStatsLoading(false); });
    return () => {
      active = false;
    };
  }, [selectedAccionHoy, fechaHoy]);

  useEffect(() => {
    if (!selectedAccionHoy || !selectedMotivoHoy) {
      setMovimientosHoyDetalle([]);
      return;
    }
    let active = true;
    setMovimientosHoyDetalleLoading(true);
    VacantesService.getMovimientosPersonal({
      fecha_captura: fechaHoy,
      accion_nombre: selectedAccionHoy,
      motivo_nombre: selectedMotivoHoy,
      no_pagination: "true",
      sort_by: "fecha_efectiva,fecha_captura",
      sort_order: "desc",
    })
      .then(async (response) => {
        if (!response.ok || !active) return;
        const data = await response.json();
        setMovimientosHoyDetalle(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error fetching detalle de movimientos de hoy:", err))
      .finally(() => { if (active) setMovimientosHoyDetalleLoading(false); });
    return () => {
      active = false;
    };
  }, [selectedAccionHoy, selectedMotivoHoy, fechaHoy]);

  const HOY_PIE_COLORS = [
    "#621f32", "#bc955c", "#8d2c48", "#d4a96a", "#4a1625",
    "#e8c280", "#3d1020", "#a07040", "#7a2038", "#f0d090",
    "#2d0a18", "#c8a050", "#b06040", "#6a1828", "#dbb870",
  ];

  const buildHoyPieSlices = useCallback((list, nameKey) => {
    const total = list.reduce((s, d) => s + d.total, 0);
    if (!list.length || total === 0) return { slices: [], total: 0 };
    const R = 80, cx = 100, cy = 100;
    // Una sola categoría (100%): inicio y fin del arco coinciden en el mismo
    // punto (círculo completo de 360°), lo que SVG dibuja como arco de
    // longitud cero -> nada visible. Se dibuja como círculo con dos arcos de
    // 180° en vez de un único arco de 360°.
    if (list.length === 1) {
      return {
        slices: [{
          d: `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx} ${cy + R} A ${R} ${R} 0 1 1 ${cx} ${cy - R} Z`,
          color: HOY_PIE_COLORS[0],
          pct: "100.0",
          name: list[0][nameKey],
          total: list[0].total,
        }],
        total,
      };
    }
    let angle = -Math.PI / 2;
    const slices = list.map((d, i) => {
      const sliceAngle = (d.total / total) * 2 * Math.PI;
      const x1 = cx + R * Math.cos(angle);
      const y1 = cy + R * Math.sin(angle);
      angle += sliceAngle;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      return {
        d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: HOY_PIE_COLORS[i % HOY_PIE_COLORS.length],
        pct: ((d.total / total) * 100).toFixed(1),
        name: d[nameKey],
        total: d.total,
      };
    });
    return { slices, total };
  }, []);

  const accionHoyPie = useMemo(() => buildHoyPieSlices(accionHoyStats, "accion_nombre"), [accionHoyStats, buildHoyPieSlices]);
  const motivoHoyPie = useMemo(() => buildHoyPieSlices(motivoHoyStats, "motivo_nombre"), [motivoHoyStats, buildHoyPieSlices]);

  // DataTable del detalle acción+motivo (tabla dentro del modal "Movimientos
  // realizados hoy"): estado propio y desacoplado del de la tabla principal
  // — mismo patrón que el modo local de EmployeesModal, pero acotado a las 7
  // columnas pedidas y sin selector de columnas (siempre las mismas).
  const MOV_HOY_MONO_KEYS = useMemo(() => new Set(["posicion", "num_empleado"]), []);
  const isMonoColumnMovHoy = useCallback((key) => MOV_HOY_MONO_KEYS.has(key), [MOV_HOY_MONO_KEYS]);
  const getColumnLetterMovHoy = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const {
    selectedCell: movHoySelectedCell, setSelectedCell: setMovHoySelectedCell,
    contextMenu: movHoyContextMenu, setContextMenu: setMovHoyContextMenu,
  } = useCellSelection();
  const movHoyFiltersHook = useColumnFilters();
  const {
    columnFilters: movHoyColumnFilters, setColumnFilters: setMovHoyColumnFilters,
    textFilters: movHoyTextFilters, setTextFilters: setMovHoyTextFilters,
    activeFilterDropdown: movHoyActiveFilterDropdown, setActiveFilterDropdown: setMovHoyActiveFilterDropdown,
    activeConditionDropdown: movHoyActiveConditionDropdown, setActiveConditionDropdown: setMovHoyActiveConditionDropdown,
    setTempSelectedValues: setMovHoyTempSelectedValues, tempSelectedValues: movHoyTempSelectedValues,
    setFilterSearchText: setMovHoyFilterSearchText, filterSearchCondition: movHoyFilterSearchCondition,
    debouncedFilterSearchText: movHoyDebouncedFilterSearchText,
  } = movHoyFiltersHook;
  const [movHoySortConfig, setMovHoySortConfig] = useState({ key: null, direction: "asc" });
  const [movHoyColumnWidths, setMovHoyColumnWidths] = useState({
    posicion: 100, num_empleado: 110, nombre: 220, accion_nombre: 170, motivo_nombre: 170, fecha_efectiva: 130, fecha_captura: 130,
  });
  const [movHoySelectedRecord, setMovHoySelectedRecord] = useState(null);
  const movHoyTableContainerRef = useRef(null);

  // Clic en "No. Empleado" del detalle → modal "Detalle de Empleado" (mismo
  // comportamiento que la columna homónima en MovimientosPersonalTab).
  const [movHoyTimelineOpen, setMovHoyTimelineOpen] = useState(false);
  const [movHoyTimelineNumEmpleado, setMovHoyTimelineNumEmpleado] = useState(null);

  // Reset de selección/scroll al cambiar de motivo — mismo dataset previo
  // podría dejar una celda/scroll apuntando fuera de rango del nuevo listado.
  useEffect(() => {
    setMovHoySelectedCell(null);
    setMovHoyColumnFilters({});
    setMovHoyTextFilters({});
    setMovHoySortConfig({ key: null, direction: "asc" });
    if (movHoyTableContainerRef.current) movHoyTableContainerRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMotivoHoy]);

  const MOV_HOY_COLUMNS_BASE = useMemo(() => ([
    { key: "posicion", label: "Posición" },
    { key: "num_empleado", label: "No. Empleado" },
    { key: "nombre", label: "Nombre" },
    { key: "accion_nombre", label: "Acción" },
    { key: "motivo_nombre", label: "Motivo" },
    { key: "fecha_efectiva", label: "Fecha Efectiva" },
    { key: "fecha_captura", label: "Fecha Captura" },
  ]), []);
  const movHoyColumns = useMemo(() => MOV_HOY_COLUMNS_BASE.map(col => ({
    key: col.key,
    label: col.label,
    width: movHoyColumnWidths[col.key] || 150,
    visible: true,
  })), [MOV_HOY_COLUMNS_BASE, movHoyColumnWidths]);

  const getMovHoyCellValue = useCallback((row, key) => key === "nombre" ? buildMovHoyFullName(row) : defaultGetCellValue(row, key), []);

  const movHoyProcessedRows = useMemo(() => {
    const result = applyColumnFilters(movimientosHoyDetalle, {
      columnFilters: movHoyColumnFilters, textFilters: movHoyTextFilters, getCellValue: getMovHoyCellValue, isMonoColumn: isMonoColumnMovHoy,
    });
    if (!movHoySortConfig.key) return result;
    const { key, direction } = movHoySortConfig;
    return [...result].sort((a, b) => {
      const valA = getMovHoyCellValue(a, key);
      const valB = getMovHoyCellValue(b, key);
      if (valA === valB) return 0;
      if (valA === "" || valA === null || valA === undefined) return 1;
      if (valB === "" || valB === null || valB === undefined) return -1;
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return direction === "asc" ? -1 : 1;
      if (strA > strB) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [movimientosHoyDetalle, movHoyColumnFilters, movHoyTextFilters, movHoySortConfig, getMovHoyCellValue, isMonoColumnMovHoy]);

  // Alto de la tabla proporcional a su contenido (header + filas reales, sin
  // virtualización acá) — mismo patrón que el modo local de EmployeesModal:
  // se mide el <table> real (su alto es intrínseco al contenido, no se estira
  // con flexbox) y se topa al máximo que el bloque ya tenía fijo antes.
  const MOV_HOY_TABLE_MAX_HEIGHT = 380;
  const [movHoyTableHeight, setMovHoyTableHeight] = useState(MOV_HOY_TABLE_MAX_HEIGHT);
  useLayoutEffect(() => {
    const el = movHoyTableContainerRef.current;
    if (!el) return;
    const table = el.querySelector("table");
    if (!table) return;
    setMovHoyTableHeight(Math.min(table.getBoundingClientRect().height + 2, MOV_HOY_TABLE_MAX_HEIGHT));
  }, [movHoyProcessedRows, movimientosHoyDetalleLoading]);

  const movHoyComputeReachableValues = useCallback((colKey) => {
    const { [colKey]: _omitCF, ...otherColumnFilters } = movHoyColumnFilters;
    const { [colKey]: _omitTF, ...otherTextFilters } = movHoyTextFilters;
    const reachableData = applyColumnFilters(movimientosHoyDetalle, {
      columnFilters: otherColumnFilters, textFilters: otherTextFilters, getCellValue: getMovHoyCellValue, isMonoColumn: isMonoColumnMovHoy,
    });
    return getUniqueColumnValues(reachableData, colKey, getMovHoyCellValue).map((v) => v.value);
  }, [movimientosHoyDetalle, movHoyColumnFilters, movHoyTextFilters, getMovHoyCellValue, isMonoColumnMovHoy]);

  const openMovHoyFilterDropdown = useCallback((colKey) => {
    if (movHoyActiveFilterDropdown === colKey) { setMovHoyActiveFilterDropdown(null); return; }
    setMovHoyActiveFilterDropdown(colKey);
    setMovHoyFilterSearchText("");
    setMovHoyTempSelectedValues(movHoyColumnFilters[colKey] || movHoyComputeReachableValues(colKey));
  }, [movHoyActiveFilterDropdown, movHoyColumnFilters, movHoyComputeReachableValues, setMovHoyActiveFilterDropdown, setMovHoyFilterSearchText, setMovHoyTempSelectedValues]);

  const movHoyReachableValues = useMemo(
    () => (movHoyActiveFilterDropdown ? movHoyComputeReachableValues(movHoyActiveFilterDropdown) : []),
    [movHoyActiveFilterDropdown, movHoyComputeReachableValues]
  );

  const applyMovHoyColumnFilter = useCallback((colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(movHoyTempSelectedValues, movHoyReachableValues);
    if (shouldClear) {
      setMovHoyColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    } else {
      setMovHoyColumnFilters((prev) => ({ ...prev, [colKey]: valuesToCommit }));
    }
    setMovHoyActiveFilterDropdown(null);
  }, [movHoyTempSelectedValues, movHoyReachableValues, setMovHoyColumnFilters, setMovHoyActiveFilterDropdown]);

  const clearMovHoyColumnFilter = useCallback((colKey) => {
    setMovHoyColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
    setMovHoyActiveFilterDropdown(null);
  }, [setMovHoyColumnFilters, setMovHoyActiveFilterDropdown]);

  const movHoyDropdownUniqueValues = useMemo(() => {
    if (!movHoyActiveFilterDropdown) return [];
    return getUniqueColumnValues(movimientosHoyDetalle, movHoyActiveFilterDropdown, getMovHoyCellValue);
  }, [movHoyActiveFilterDropdown, movimientosHoyDetalle, getMovHoyCellValue]);

  const movHoyFilterDropdownValues = useMemo(() => {
    if (!movHoyActiveFilterDropdown) {
      return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
    }
    const filteredVals = movHoyDropdownUniqueValues.filter((v) => matchesTextCondition(v.value, movHoyFilterSearchCondition, movHoyDebouncedFilterSearchText, { normalize: true }));
    return finalizeFilterDropdownValues({
      baseUniqueValues: movHoyDropdownUniqueValues,
      filtered: filteredVals,
      tempSelectedValues: movHoyTempSelectedValues,
      committedSelectedValues: movHoyColumnFilters[movHoyActiveFilterDropdown] || [],
      reachableValues: movHoyReachableValues,
    });
  }, [movHoyActiveFilterDropdown, movHoyDropdownUniqueValues, movHoyReachableValues, movHoyTempSelectedValues, movHoyFilterSearchCondition, movHoyDebouncedFilterSearchText, movHoyColumnFilters]);

  const handleMovHoySort = useCallback((key) => {
    setMovHoySortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const handleMovHoyResizeStart = useCallback((e, index, direction = "right") => {
    e.preventDefault();
    const colKey = movHoyColumns[index]?.key;
    if (!colKey) return;
    const startX = e.clientX;
    const startWidth = movHoyColumnWidths[colKey] || 150;
    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = direction === "left" ? startWidth - deltaX : startWidth + deltaX;
      setMovHoyColumnWidths(prev => ({ ...prev, [colKey]: Math.max(80, newWidth) }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [movHoyColumns, movHoyColumnWidths]);

  const renderMovHoyCell = useCallback(({ row, col, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
    const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
    const rawValue = col.key === "nombre" ? buildMovHoyFullName(row) : row[col.key];
    const displayValue = rawValue === null || rawValue === undefined || String(rawValue).trim() === "" ? "" : (MOV_HOY_DATE_KEYS.includes(col.key) ? formatDateEsMx(rawValue) : String(rawValue));
    const isEmpleadoLink = col.key === "num_empleado" && !!displayValue;
    const handleClick = isEmpleadoLink
      ? (e) => { e.stopPropagation(); setMovHoyTimelineNumEmpleado(displayValue); setMovHoyTimelineOpen(true); }
      : onClick;
    return (
      <td
        key={col.key}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        style={stickyStyle}
        className={`px-4 text-sm border-r truncate h-[37px] align-middle ${
          isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
        } ${isMonoColumnMovHoy(col.key) ? "font-mono text-[13px] font-semibold" : "font-medium"}${
          isEmpleadoLink ? " font-bold hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c] cursor-pointer" : ""
        }`}
        title={isEmpleadoLink ? "Clic para ver el detalle del empleado" : displayValue}
      >
        {isEmpleadoLink ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{displayValue}</span>
            <MousePointerClick className="size-3 shrink-0 text-[#bc955c]" />
          </div>
        ) : (
          displayValue || <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
        )}
      </td>
    );
  }, [isMonoColumnMovHoy]);

  const deptoCatalog = useOrganigramaCatalog();
  const { motivosCatalog } = useAccionesMotivosCatalog();
  const { hasPermission } = useAuth();
  const canEditCeldas = hasPermission(PERMISSIONS.EDIT_PLANTILLA_DETALLE);
  const canViewFotoDetalle = hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE_FOTO);
  const { toast } = useToast();
  const { columns, setColumns, toggleVisibility: toggleColumnVisibility, isColumnsModalOpen, setColumnsModalOpen: setIsColumnsModalOpen } = useColumnState([
    { key: FOTO_COLUMN_KEY, label: "Foto", width: 64, visible: true, isBasic: true, noFilter: true },
    { key: "posicion", label: "Posición", width: 110, visible: true, isBasic: true },
    { key: "estado_nomina", label: "Estado Nómina", width: 120, visible: true, isBasic: true },
    { key: "id_empleado", label: "Número de Empleado", width: 115, visible: true, isBasic: true },
    { key: "rfc", label: "RFC", width: 140, visible: false, isBasic: true },
    { key: "curp", label: "CURP", width: 185, visible: false, isBasic: true },
    { key: "nombres", label: "Nombres", width: 280, visible: true, isBasic: true },
    { key: "motivo", label: "Motivo", width: 200, visible: true, isBasic: true },
    { key: "fecha_efectiva_personal", label: "Fecha efectiva (Personal)", width: 180, visible: true, isBasic: true },
    { key: "fecha_de_captura", label: "Fecha de captura", width: 150, visible: true, isBasic: true },
    { key: "qna", label: "Qna #", width: 80, visible: true, isBasic: true },
    { key: "fecha_prevista_de_salida", label: "Fecha prevista de salida", width: 180, visible: true, isBasic: true },
    { key: "nj", label: "Nivel Jerárquico", width: 120, visible: true, isBasic: true },
    { key: "codigo_presupuestal", label: "Código Presupuestal", width: 150, visible: true, isBasic: true },
    { key: "nivel", label: "Nivel", width: 85, visible: true, isBasic: true },
    { key: "escala", label: "Escala", width: 120, visible: true, isBasic: true },
    { key: "smb", label: "SMB", width: 150, visible: true, isBasic: true },
    { key: "smn", label: "SMN", width: 150, visible: true, isBasic: true },
    { key: "partida", label: "Partida", width: 100, visible: true, isBasic: true },
    { key: "tipo_de_contratacion", label: "TIpo de Contratación", width: 180, visible: true, isBasic: true },
    { key: "cd_un", label: "Cd UN", width: 100, visible: true, isBasic: true },
    { key: "unidad_de_negocio", label: "Unidad de Negocio", width: 250, visible: true, isBasic: true },
    { key: "cd_ua", label: "Cd UA", width: 100, visible: true, isBasic: true },
    { key: "unidad_administrativa", label: "Unidad Administrativa", width: 280, visible: true, isBasic: true },
    { key: "cd_pto_funcional", label: "Cd Pto Funcional", width: 120, visible: true, isBasic: true },
    { key: "nombre_puesto_funcional", label: "Nombre Puesto Funcional", width: 250, visible: true, isBasic: true },
    { key: "id_departamento", label: "Id Departamento", width: 120, visible: true, isBasic: true },
    { key: "departamento", label: "Departamento", width: 200, visible: true, isBasic: true },
    { key: "dependencia_directa", label: "Dependencia Directa", width: 250, visible: true, isBasic: true },
    { key: "codigo", label: "Código", width: 200, visible: true, isBasic: true, greenHeader: true },
    { key: "entidad_federativa", label: "Entidad Federativa", width: 180, visible: true, isBasic: true, greenHeader: true },
    { key: "tipo_de_aduana", label: "Tipo de Aduana", width: 130, visible: true, isBasic: true, greenHeader: true },
    { key: "ubicacion", label: "Ubicación", width: 200, visible: true, isBasic: true, greenHeader: true },
    { key: "descripcion_ubicacion", label: "Descripción ubicación", width: 200, visible: true, isBasic: true, greenHeader: true },
    { key: "tipo_de_personal_sedena_semar", label: "Tipo de personal SEDENA / SEMAR", width: 220, visible: true, isBasic: true },
    { key: "rango", label: "Rango", width: 150, visible: true, isBasic: true },
    { key: "fecha_de_ingreso", label: "Fecha de ingreso", width: 130, visible: true, isBasic: true },
    { key: "dg_o_aduana_compactada", label: "DG o Aduana compactada", width: 200, visible: true, isBasic: true },
    { key: "fecha_anuencia_detalle", label: "Fecha de Anuencia", width: 150, visible: true, isBasic: true, greenHeader: true },
    { key: "oficios_autorizacion_shcp", label: "Oficios de Autorización SHCP", width: 200, visible: true, isBasic: true, greenHeader: true },
    { key: "plazas_eventuales_autorizacion_2026", label: "Plazas eventuales registradas para autorización 2026", width: 350, visible: true, isBasic: true, greenHeader: true },
    { key: "candidato", label: "Candidato", width: 150, visible: true, isBasic: true, greenHeader: true },
    { key: "reportada", label: "Reportada", width: 120, visible: true, isBasic: true, greenHeader: true },
    { key: "fecha_genera_vacante", label: "Fecha que se genera la vacante", width: 220, visible: true, isBasic: true, greenHeader: true },
    { key: "cap_anual", label: "CAP ANUAL", width: 120, visible: true, isBasic: true, greenHeader: true },
    { key: "cap_mensual", label: "CAP MENSUAL", width: 120, visible: true, isBasic: true, greenHeader: true },
    { key: "observaciones_plantillas_do", label: "Observaciones - Plantillas DO", width: 250, visible: true, isBasic: true, greenHeader: true },
    { key: "observaciones_proyectos_alineaciones", label: "Observaciones - Proyectos y Alineaciones", width: 280, visible: true, isBasic: true, greenHeader: true },
    { key: "anno_vacancia", label: "Año de Vacancia (Nuevo Reporte)", width: 220, visible: true, isBasic: true, greenHeader: true },
    { key: "solicitante", label: "Solicitante", width: 200, visible: false, isBasic: false, greenHeader: true },
    { key: "nombre_candidato", label: "Nombre del candidato", width: 200, visible: false, isBasic: false, greenHeader: true },
    { key: "motivo_solicitud", label: "Motivo de solicitud", width: 200, visible: false, isBasic: false, greenHeader: true },
    { key: "numeral", label: "Numeral", width: 100, visible: false, isBasic: false },
    { key: "ua", label: "UA (Código)", width: 150, visible: false, isBasic: false },
    { key: "cent", label: "Centro (Código)", width: 80, visible: false, isBasic: false },
    { key: "dir", label: "Dirección (Código)", width: 80, visible: false, isBasic: false },
    { key: "subd", label: "Subdirección (Código)", width: 80, visible: false, isBasic: false },
    { key: "jd", label: "Jefatura Depto. (Código)", width: 80, visible: false, isBasic: false },
    { key: "depto", label: "Departamento (Código)", width: 120, visible: false, isBasic: false },
    { key: "aduana", label: "Aduana", width: 200, visible: false, isBasic: false },
    { key: "tipo", label: "Tipo", width: 130, visible: false, isBasic: false },
    { key: "estado", label: "Estado", width: 150, visible: false, isBasic: false },
    { key: "municipio", label: "Municipio", width: 180, visible: false, isBasic: false },
    { key: "ua2", label: "UA (Nombre)", width: 200, visible: false, isBasic: false },
    
    { key: "observaciones", label: "OBSERVACIONES", width: 200, visible: false, isBasic: false },
    { key: "posicion_civil_sedena_semar", label: "Posición _Civil / SEDENA / SEMAR", width: 250, visible: false, isBasic: false },
    { key: "personal_militar_o_civil", label: "Personal Militar o Civil", width: 180, visible: false, isBasic: false },
    { key: "val_estat", label: "Val_estat", width: 100, visible: false, isBasic: false },
    { key: "status_jefe_inm_posicion", label: "Status Jefe Inm Posición", width: 180, visible: false, isBasic: false },
    { key: "numempleado", label: "Numempleado", width: 120, visible: false, isBasic: false },
    { key: "sindicato", label: "Sindicato", width: 150, visible: false, isBasic: false },
    { key: "estado_en_nomina", label: "Estado en nomina", width: 150, visible: false, isBasic: false },
    { key: "ua_validacion", label: "UA Validación", width: 180, visible: false, isBasic: false },
    { key: "validando_posicion_por_documento", label: "Validando de posición por documento", width: 250, visible: false, isBasic: false },
    { key: "nj_comp", label: "NJ COMP", width: 150, visible: false, isBasic: false },
    { key: "nj_ok", label: "NJ OK", width: 150, visible: false, isBasic: false },
    { key: "columna", label: "Columna", width: 150, visible: false, isBasic: false },
    { key: "nombre_nj", label: "Nombre NJ", width: 150, visible: false, isBasic: false },
    { key: "nj_operativo_comb", label: "NJ Operativo Combinado", width: 150, visible: false, isBasic: false },
  ], "plantilla_detalle_columns");

  // `columns` es el estado persistido completo; para lo demás se usan dos vistas:
  // - `tableColumns`: lo que ven la tabla y el selector de columnas — sin la
  //   columna de foto si el usuario no tiene permiso de verla (así no ocupa
  //   espacio ni se puede activar por error). `selectedCell.col` indexa las
  //   columnas VISIBLES de esta lista, así que todo lo posicional debe partir
  //   de aquí y no de `columns`.
  // - `dataColumns`: sólo columnas que corresponden a un campo real de la fila
  //   (sin la de foto) — exportaciones, filtros avanzados, historial y tarjetas
  //   móviles, donde una columna de presentación no tiene ningún valor que dar.
  const tableColumns = useMemo(
    () => (canViewFotoDetalle ? columns : columns.filter(c => c.key !== FOTO_COLUMN_KEY)),
    [columns, canViewFotoDetalle]
  );
  const dataColumns = useMemo(() => columns.filter(c => c.key !== FOTO_COLUMN_KEY), [columns]);

  const [searchQuery, setSearchQuery] = useState("");
  // 7.3 QA: persistir configuración por usuario — orden de tabla en localStorage.
  const [sortConfig, setSortConfig] = usePersistedState("plantilla_detalle_sort", { key: null, direction: null });
  const [scrollTop, setScrollTop] = useState(0);
  const { selectedCell, setSelectedCell, isCellModalOpen, setIsCellModalOpen, selectedRowData, setSelectedRowData, contextMenu, setContextMenu } = useCellSelection();
  const filters = useColumnFilters({ initialColumnFilters: { estado_nomina: ["Activo"] }, storageKey: "plantilla_detalle_filters" });
  const {
    globalSearch, setGlobalSearch,
    columnFilters, setColumnFilters,
    textFilters, setTextFilters,
    activeFilterDropdown, setActiveFilterDropdown,
    activeConditionDropdown, setActiveConditionDropdown,
    tempSelectedValues, setTempSelectedValues,
    filterSearchText, setFilterSearchText,
    filterSearchCondition, setFilterSearchCondition,
    isFilterSearchConditionOpen, setIsFilterSearchConditionOpen,
    expandedDateNodes, setExpandedDateNodes,
    debouncedFilterSearchText,
  } = filters;
  // Modal de Detalle de Vacancia (columna "Fecha que se genera la vacante")
  // — mismo componente y mismo flujo que Mov. Posiciones (VacanciaDetalleModal),
  // solo que aquí se abre con `row.mov_pos_id` (inyectado por el backend,
  // ver EmpleadosCompletosActivosDetalleView) en vez de `row.id` (MovPos).
  const [isVacanciaModalOpen, setIsVacanciaModalOpen] = useState(false);
  const [vacanciaRowId, setVacanciaRowId] = useState(null);
  const [vacanciaDetalle, setVacanciaDetalle] = useState(null);
  const [isVacanciaLoading, setIsVacanciaLoading] = useState(false);
  const openVacanciaModal = useCallback((row) => {
    if (!row || row.mov_pos_id === undefined || row.mov_pos_id === null) return;
    setVacanciaRowId(row.mov_pos_id);
    setIsVacanciaModalOpen(true);
  }, []);

  // Clic en el pill de "Vacante"/"Solicitada" (columna Estado Nómina): muestra
  // u oculta en bloque las 3 columnas de solicitud. Si estaban en un estado
  // mixto (alguna visible por "Configurar Columnas" y otra no), primero las
  // deja a todas visibles en vez de alternar cada una por separado — evita
  // que el pill deje una combinación inconsistente.
  const toggleSolicitudColumns = useCallback(() => {
    const allVisible = SOLICITUD_COLS.every((k) => columns.find((c) => c.key === k)?.visible);
    SOLICITUD_COLS.forEach((k) => {
      const col = columns.find((c) => c.key === k);
      if (col && col.visible === allVisible) toggleColumnVisibility(k);
    });
  }, [columns, toggleColumnVisibility]);
  useEffect(() => {
    let active = true;
    if (isVacanciaModalOpen && vacanciaRowId !== null) {
      setIsVacanciaLoading(true);
      setVacanciaDetalle(null);
      VacantesService.getMovPosVacanciaDetalle(vacanciaRowId)
        .then(res => res.json())
        .then(data => { if (active) setVacanciaDetalle(data); })
        .catch(err => {
          console.error("Error fetching vacancia detalle:", err);
          if (active) setVacanciaDetalle({ error: "Error al cargar el detalle de la vacancia." });
        })
        .finally(() => { if (active) setIsVacanciaLoading(false); });
    } else {
      setVacanciaDetalle(null);
    }
    return () => { active = false; };
  }, [isVacanciaModalOpen, vacanciaRowId]);

  const [isHistorialModalOpen, setIsHistorialModalOpen] = useState(false);
  // Abre el modal y apaga el badge de "cambios de otros usuarios pendientes de ver"
  // (ver remoteUpdatesCount, contado en ClientComponent vía useCeldaUpdatesRealtime).
  const openHistorialModal = useCallback(() => {
    setIsHistorialModalOpen(true);
    onClearRemoteUpdates?.();
  }, [onClearRemoteUpdates]);
  const formatHistorialValue = useCallback((colKey, val) => (
    colKey === "estado_nomina" ? mapEstadoNomina(val) : val
  ), []);
  // El historial unificado (el backend ya combina EMPLEADOS_COMPLETOS_SIG +
  // PLANTILLA_QUINCENAL + MOV_POS para este endpoint, ver
  // EmpleadosCompletosCeldaHistorialView) incluye ediciones de "fecha_anuencia"
  // (columna real en CeldaOverride/MOV_POS) — no está en `dataColumns` porque
  // en la tabla se muestra bajo la key "fecha_anuencia_detalle" (ver FECHA_ANUENCIA_COL).
  const historialColumns = useMemo(() => (
    dataColumns.some((c) => c.key === "fecha_anuencia")
      ? dataColumns
      : [...dataColumns, { key: "fecha_anuencia", label: "Fecha de Anuencia" }]
  ), [dataColumns]);
  const [isCadenaModalOpen, setIsCadenaModalOpen] = useState(false);
  const [cadenaQuery, setCadenaQuery] = useState("");
  const [cadenaData, setCadenaData] = useState(null);
  // 8.5 QA: cadena de mando descendente — 'arriba' (jefes, camino único,
  // pirámide lineal ya existente) o 'abajo' (subordinados directos+indirectos,
  // árbol con N hijos por nivel, nuevo).
  const [cadenaDirection, setCadenaDirection] = useState("arriba");
  const [expandedCadenaNodes, setExpandedCadenaNodes] = useState(() => new Set());
  const [showCadenaSuggestions, setShowCadenaSuggestions] = useState(false);
  const cadenaSuggestions = useMemo(() => {
    const q = normalizeForSearch(cadenaQuery.trim());
    if (q.length < 2 || !detalle) return [];
    return detalle.filter(row =>
      normalizeForSearch(row.posicion).includes(q) ||
      normalizeForSearch(row.nombres).includes(q) ||
      normalizeForSearch(row.numempleado).includes(q)
    ).slice(0, 5);
  }, [cadenaQuery, detalle]);
  const [isCadenaLoading, setIsCadenaLoading] = useState(false);
  const [cadenaError, setCadenaError] = useState(null);
  // Herramientas del árbol descendente: búsqueda/filtros internos, agrupación
  // de vacantes hoja y drill-down ("enfocar rama").
  const [cadenaTreeSearch, setCadenaTreeSearch] = useState("");
  const [cadenaEstadoFilter, setCadenaEstadoFilter] = useState(() => new Set());
  const [cadenaNivelFilter, setCadenaNivelFilter] = useState(() => new Set());
  // Filtro por "posición activa" (MOV_POS, independiente del estado del
  // empleado): valores posibles "activa" / "inactiva".
  const [cadenaPosActivaFilter, setCadenaPosActivaFilter] = useState(() => new Set());
  const [cadenaSoloDirectos, setCadenaSoloDirectos] = useState(false);
  const [expandedVacGroups, setExpandedVacGroups] = useState(() => new Set());
  const [cadenaFocusPos, setCadenaFocusPos] = useState(null);
  const resetCadenaTreeTools = useCallback(() => {
    setCadenaTreeSearch("");
    setCadenaEstadoFilter(new Set());
    setCadenaNivelFilter(new Set());
    setCadenaPosActivaFilter(new Set());
    setCadenaSoloDirectos(false);
    setExpandedVacGroups(new Set());
    setCadenaFocusPos(null);
  }, []);
  useEscapeToClose(isCadenaModalOpen, () => setIsCadenaModalOpen(false));
  useBodyScrollLock(isCadenaModalOpen);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [cardWidth, setCardWidth] = useState(null);

  // `queryOverride`: al elegir una sugerencia el input se rellena con
  // "Posición - Nombre" (más legible) pero el backend necesita solo la
  // posición para el match exacto; además evita leer `cadenaQuery` del
  // closure justo después de un setCadenaQuery (estado aún no actualizado).
  const handleBuscarCadena = async (e, direction = cadenaDirection, queryOverride = null) => {
    e?.preventDefault();
    const raw = (queryOverride ?? cadenaQuery).trim();
    if (!raw) return;
    const searchTerm = raw.includes(" - ") ? raw.split(" - ")[0].trim() : raw;
    setShowCadenaSuggestions(false);
    setIsCadenaLoading(true);
    setCadenaError(null);
    setCadenaData(null);
    setExpandedCadenaNodes(new Set());
    resetCadenaTreeTools();
    try {
      const response = await VacantesService.getCadenaMando(searchTerm, { direction });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.detail || "Error al buscar la cadena de mando");
      }
      setCadenaData(data);
    } catch (err) {
      setCadenaError(err.message || "Error al buscar la cadena de mando");
    } finally {
      setIsCadenaLoading(false);
    }
  };

  // 8.5 QA: alterna Ascendente/Descendente; si ya hay una búsqueda hecha,
  // vuelve a consultar de inmediato en la nueva dirección.
  const handleToggleCadenaDirection = useCallback((direction) => {
    setCadenaDirection(direction);
    if (cadenaQuery.trim() && (cadenaData || cadenaError)) {
      handleBuscarCadena(null, direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadenaQuery, cadenaData, cadenaError]);

  const toggleCadenaNode = useCallback((posicion) => {
    setExpandedCadenaNodes(prev => {
      const next = new Set(prev);
      if (next.has(posicion)) next.delete(posicion); else next.add(posicion);
      return next;
    });
  }, []);

  // Arma el árbol de subordinados a partir del arreglo plano que devuelve el
  // backend (cada fila trae su Jefe_Directo) — agrupa hijos por padre una vez
  // (Map) en vez de un .filter() por nodo, O(n) en vez de O(n²).
  const cadenaTree = useMemo(() => {
    if (cadenaDirection !== "abajo" || !cadenaData?.cadena?.length) return null;
    const childrenByParent = new Map();
    let root = null;
    cadenaData.cadena.forEach(nodo => {
      if (nodo.Nivel_Hacia_Abajo === 0) { root = nodo; return; }
      const parentKey = nodo.Jefe_Directo;
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
      childrenByParent.get(parentKey).push(nodo);
    });
    // Ocupadas al inicio, vacantes hasta el final (dentro de cada nivel);
    // sort es estable, así que conserva el orden original (por posición) dentro de cada grupo.
    // `totalDescendants` se precalcula aquí una vez (badge "N en rama" por nodo).
    const buildNode = (nodo) => {
      const children = (childrenByParent.get(nodo.Posicion) || [])
        .map(buildNode)
        .sort((a, b) => Number(isNodoVacante(a)) - Number(isNodoVacante(b)));
      return {
        ...nodo,
        children,
        totalDescendants: children.reduce((acc, c) => acc + 1 + c.totalDescendants, 0),
      };
    };
    return root ? buildNode(root) : null;
  }, [cadenaDirection, cadenaData]);

  // Drill-down: raíz mostrada = nodo enfocado (o la raíz consultada).
  const cadenaDisplayRoot = useMemo(() => {
    if (!cadenaTree) return null;
    if (!cadenaFocusPos) return cadenaTree;
    const find = (n) => (n.Posicion === cadenaFocusPos ? n : n.children.reduce((f, c) => f || find(c), null));
    return find(cadenaTree) || cadenaTree;
  }, [cadenaTree, cadenaFocusPos]);

  // Camino raíz→nodo enfocado para el breadcrumb; null si no hay enfoque.
  const cadenaBreadcrumb = useMemo(() => {
    if (!cadenaTree || !cadenaFocusPos || cadenaFocusPos === cadenaTree.Posicion) return null;
    const path = [];
    const walk = (n, acc) => {
      const next = [...acc, n];
      if (n.Posicion === cadenaFocusPos) { path.push(...next); return true; }
      return n.children.some((c) => walk(c, next));
    };
    walk(cadenaTree, []);
    return path.length > 1 ? path : null;
  }, [cadenaTree, cadenaFocusPos]);

  // Resumen del subárbol mostrado: directos vs indirectos, ocupadas/vacantes,
  // profundidad y distribución de niveles por grupo (chips clicables = filtro).
  const cadenaStats = useMemo(() => {
    if (!cadenaDisplayRoot) return null;
    const stats = {
      directos: 0, indirectos: 0,
      ocupadasDir: 0, vacantesDir: 0, ocupadasInd: 0, vacantesInd: 0,
      posActivas: 0, posInactivas: 0,
      profundidad: 0,
      nivelesDir: new Map(), nivelesInd: new Map(),
      estados: new Map(),
    };
    const walk = (n, depth) => {
      n.children.forEach((c) => {
        const esDirecto = depth === 0;
        const vacante = isNodoVacante(c);
        if (esDirecto) { stats.directos++; vacante ? stats.vacantesDir++ : stats.ocupadasDir++; }
        else { stats.indirectos++; vacante ? stats.vacantesInd++ : stats.ocupadasInd++; }
        isPosicionActiva(c) ? stats.posActivas++ : stats.posInactivas++;
        const nivel = String(c.Nivel || "").trim() || "Sin nivel";
        const bucket = esDirecto ? stats.nivelesDir : stats.nivelesInd;
        bucket.set(nivel, (bucket.get(nivel) || 0) + 1);
        const estado = getNodoEstado(c);
        stats.estados.set(estado, (stats.estados.get(estado) || 0) + 1);
        stats.profundidad = Math.max(stats.profundidad, depth + 1);
        walk(c, depth + 1);
      });
    };
    walk(cadenaDisplayRoot, 0);
    return stats;
  }, [cadenaDisplayRoot]);

  // Filas de la gráfica de barras apiladas de niveles (Directos + Indirectos),
  // ordenadas por total descendente. maxTotal escala el ancho de las barras.
  const cadenaNivelesChart = useMemo(() => {
    if (!cadenaStats) return null;
    const niveles = new Set([...cadenaStats.nivelesDir.keys(), ...cadenaStats.nivelesInd.keys()]);
    if (niveles.size === 0) return null;
    const rows = [...niveles].map((nivel) => {
      const dir = cadenaStats.nivelesDir.get(nivel) || 0;
      const ind = cadenaStats.nivelesInd.get(nivel) || 0;
      return { nivel, dir, ind, total: dir + ind };
    }).sort((a, b) => b.total - a.total || a.nivel.localeCompare(b.nivel, undefined, { numeric: true }));
    return { rows, maxTotal: rows[0].total };
  }, [cadenaStats]);

  // Búsqueda + filtros dentro del árbol: matched = nodos que cumplen todo;
  // visible = matched + ancestros (contexto atenuado para no perder la ruta).
  const cadenaFilterResult = useMemo(() => {
    const inactive = { active: false, matchedSet: null, visibleSet: null, matchCount: 0 };
    if (!cadenaDisplayRoot) return inactive;
    const q = normalizeForSearch(cadenaTreeSearch.trim());
    const hasSearch = q.length >= 2;
    const hasEstado = cadenaEstadoFilter.size > 0;
    const hasNivel = cadenaNivelFilter.size > 0;
    const hasPosActiva = cadenaPosActivaFilter.size > 0;
    if (!hasSearch && !hasEstado && !hasNivel && !hasPosActiva) return inactive;
    const matched = new Set();
    const visible = new Set();
    const walk = (n, ancestors) => {
      const matchSearch = !hasSearch || [
        n.Posicion, n.Empleado, n.Puesto_Funcional, n.Departamento,
        n.Unidad_Administrativa, n.Unidad_Negocio, n.Id_Departamento,
      ].some((v) => normalizeForSearch(String(v || "")).includes(q));
      const matchEstado = !hasEstado || cadenaEstadoFilter.has(getNodoEstado(n));
      const matchNivel = !hasNivel || cadenaNivelFilter.has(String(n.Nivel || "").trim() || "Sin nivel");
      const matchPosActiva = !hasPosActiva || cadenaPosActivaFilter.has(isPosicionActiva(n) ? "activa" : "inactiva");
      if (matchSearch && matchEstado && matchNivel && matchPosActiva) {
        matched.add(n.Posicion);
        visible.add(n.Posicion);
        ancestors.forEach((a) => visible.add(a));
      }
      const next = [...ancestors, n.Posicion];
      n.children.forEach((c) => walk(c, next));
    };
    walk(cadenaDisplayRoot, []);
    visible.add(cadenaDisplayRoot.Posicion);
    return { active: true, matchedSet: matched, visibleSet: visible, matchCount: matched.size };
  }, [cadenaDisplayRoot, cadenaTreeSearch, cadenaEstadoFilter, cadenaNivelFilter, cadenaPosActivaFilter]);

  const handleExpandAllCadena = useCallback(() => {
    if (!cadenaDisplayRoot) return;
    const conHijos = new Set();
    const walk = (n) => { if (n.children.length) { conHijos.add(n.Posicion); n.children.forEach(walk); } };
    walk(cadenaDisplayRoot);
    setExpandedCadenaNodes((prev) => new Set([...prev, ...conHijos]));
    setExpandedVacGroups((prev) => new Set([...prev, ...conHijos]));
  }, [cadenaDisplayRoot]);

  const handleCollapseAllCadena = useCallback(() => {
    setExpandedCadenaNodes(new Set());
    setExpandedVacGroups(new Set());
  }, []);

  const toggleCadenaEstadoFilter = useCallback((estado) => {
    setCadenaEstadoFilter((prev) => {
      const next = new Set(prev);
      if (next.has(estado)) next.delete(estado); else next.add(estado);
      return next;
    });
  }, []);

  const toggleCadenaPosActivaFilter = useCallback((valor) => {
    setCadenaPosActivaFilter((prev) => {
      const next = new Set(prev);
      if (next.has(valor)) next.delete(valor); else next.add(valor);
      return next;
    });
  }, []);

  const toggleCadenaNivelFilter = useCallback((nivel) => {
    setCadenaNivelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(nivel)) next.delete(nivel); else next.add(nivel);
      return next;
    });
  }, []);

  const toggleVacGroup = useCallback((posicion) => {
    setExpandedVacGroups((prev) => {
      const next = new Set(prev);
      if (next.has(posicion)) next.delete(posicion); else next.add(posicion);
      return next;
    });
  }, []);

  const handleFocusCadenaNode = useCallback((posicion) => {
    setCadenaFocusPos(posicion);
  }, []);

  const handleExportCadenaDescendente = useCallback(async () => {
    if (!cadenaDisplayRoot) return;
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cadena_Mando_Descendente");
    const CADENA_COLS = [
      { header: "Profundidad", key: "profundidad", width: 12 },
      { header: "Posición", key: "posicion", width: 16 },
      { header: "Nombre", key: "nombre", width: 35 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Posición Activa (MOV_POS)", key: "pos_activa", width: 20 },
      { header: "Puesto Funcional", key: "puesto", width: 35 },
      { header: "Nivel", key: "nivel", width: 12 },
      { header: "Cd UN", key: "cd_un", width: 10 },
      { header: "Unidad de Negocio", key: "un", width: 30 },
      { header: "Cd UA", key: "cd_ua", width: 10 },
      { header: "Unidad Administrativa", key: "ua", width: 30 },
      { header: "Id Departamento", key: "id_depto", width: 16 },
      { header: "Departamento (SIG)", key: "depto_sig", width: 40 },
      { header: "Nivel Dirección (SIG)", key: "nivel_dir", width: 16 },
      { header: "Jefe Directo (Posición)", key: "jefe", width: 20 },
      { header: "Subordinados en rama", key: "rama", width: 18 },
    ];
    worksheet.columns = CADENA_COLS.map(({ key, width }) => ({ key, width }));
    const cadenaOff = addExcelLetterhead(workbook, worksheet, CADENA_COLS.length);
    const cadenaHeaderRowNum = cadenaOff + 1;
    const cadenaHeaderRow = worksheet.getRow(cadenaHeaderRowNum);
    CADENA_COLS.forEach((c, i) => { cadenaHeaderRow.getCell(i + 1).value = c.header; });
    const flatten = (node) => {
      const deptoInfo = getDeptoInfo(deptoCatalog, node.Id_Departamento);
      worksheet.addRow({
        profundidad: node.Nivel_Hacia_Abajo,
        posicion: node.Posicion,
        nombre: node.Empleado || "",
        estado: getNodoEstado(node),
        pos_activa: isPosicionActiva(node) ? "Sí" : "No",
        puesto: node.Puesto_Funcional || "",
        nivel: node.Nivel || "",
        cd_un: node.Cd_UN || "",
        un: node.Unidad_Negocio || "",
        cd_ua: node.Cd_UA || "",
        ua: node.Unidad_Administrativa || "",
        id_depto: node.Id_Departamento || "",
        depto_sig: deptoInfo?.nombre || node.Departamento || "",
        nivel_dir: deptoInfo?.nivel || "",
        jefe: node.Jefe_Directo || "",
        rama: node.totalDescendants,
      });
      node.children.forEach(flatten);
    };
    flatten(cadenaDisplayRoot);
    cadenaHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cadenaHeaderRow.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } }; });

    // Hoja Resumen: totales + distribución de niveles (directos/indirectos).
    if (cadenaStats) {
      const resumenSheet = workbook.addWorksheet("Resumen");
      const RESUMEN_COLS = [
        { header: "Concepto", key: "concepto", width: 32 },
        { header: "Valor", key: "valor", width: 18 },
      ];
      resumenSheet.columns = RESUMEN_COLS.map(({ key, width }) => ({ key, width }));
      const resOff = addExcelLetterhead(workbook, resumenSheet, RESUMEN_COLS.length);
      const resHeaderRowNum = resOff + 1;
      const resHeaderRow0 = resumenSheet.getRow(resHeaderRowNum);
      RESUMEN_COLS.forEach((c, i) => { resHeaderRow0.getCell(i + 1).value = c.header; });
      [
        ["Posición raíz", cadenaDisplayRoot.Posicion],
        ["Nombre raíz", cadenaDisplayRoot.Empleado || "(Vacante)"],
        ["Total subordinados", cadenaStats.directos + cadenaStats.indirectos],
        ["Directos", cadenaStats.directos],
        ["Indirectos", cadenaStats.indirectos],
        ["Ocupadas (directos)", cadenaStats.ocupadasDir],
        ["Vacantes (directos)", cadenaStats.vacantesDir],
        ["Ocupadas (indirectos)", cadenaStats.ocupadasInd],
        ["Vacantes (indirectos)", cadenaStats.vacantesInd],
        ["Posiciones activas (MOV_POS)", cadenaStats.posActivas],
        ["Posiciones inactivas (MOV_POS)", cadenaStats.posInactivas],
        ["Profundidad máxima", cadenaStats.profundidad],
      ].forEach(([concepto, valor]) => resumenSheet.addRow({ concepto, valor }));
      resumenSheet.addRow({});
      const nivelesHeader = resumenSheet.addRow({ concepto: "Nivel", valor: "Directos" });
      nivelesHeader.getCell(3).value = "Indirectos";
      nivelesHeader.getCell(4).value = "Total";
      nivelesHeader.font = { bold: true };
      const todosNiveles = new Set([...cadenaStats.nivelesDir.keys(), ...cadenaStats.nivelesInd.keys()]);
      [...todosNiveles]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .forEach((nivel) => {
          const dir = cadenaStats.nivelesDir.get(nivel) || 0;
          const ind = cadenaStats.nivelesInd.get(nivel) || 0;
          const row = resumenSheet.addRow({ concepto: nivel, valor: dir });
          row.getCell(3).value = ind;
          row.getCell(4).value = dir + ind;
        });
      resHeaderRow0.font = { bold: true, color: { argb: "FFFFFFFF" } };
      resHeaderRow0.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF621F32" } }; });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cadena_Mando_Descendente_${cadenaDisplayRoot.Posicion}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }, [cadenaDisplayRoot, cadenaStats, deptoCatalog]);

  const deferredTextFilters = useDeferredValue(textFilters);
  const deferredGlobalSearch = useDeferredValue(globalSearch);

  const dropdownRef = useRef(null);
  const tbodyRef = useRef(null);
  const tableContainerRef = useRef(null);
  const arrowRepeatRef = useRef(0);

  const getColumnLetter = useCallback((index) => {
    let temp = index, letter = "";
    while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
    return letter;
  }, []);

  const isMonoColumn = useCallback((key) => ["posicion", "codigo", "id_empleado", "rfc", "curp", "nivel", "codigo_presupuestal", "ua", "cd_ua", "cent", "dir", "subd", "jd", "depto", "numeral"].includes(key), []);


  const isDateColumn = useCallback((colKey) => {
    return DATE_KEYS.includes(colKey);
  }, []);

  const getAdvCellValue = useCallback((row, key) =>
    key === "estado_nomina" ? mapEstadoNomina(row[key]) : (row[key] === null || row[key] === undefined ? "" : String(row[key])), []);

  const fetchAdvSuggestions = useCallback((column) =>
    getUniqueColumnValues(detalle, column, getAdvCellValue), [detalle, getAdvCellValue]);

  const {
    isAdvancedFiltersOpen, setIsAdvancedFiltersOpen,
    advancedConditions,
    appliedAdvancedFilters,
    addAdvancedCondition, removeAdvancedCondition, updateAdvancedCondition,
    applyAdvancedFilters, resetAdvancedFilters,
  } = useAdvancedFilters({ mode: "client", isDateColumn });

  // BUG-05 QA: la selección es posicional ({row, col}); si cambia el filtro u
  // orden, la celda puede quedar apuntando a otro registro sin avisar.
  useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, globalSearch, sortConfig.key, sortConfig.direction, appliedAdvancedFilters]);

  // Dataset del filtro de columna ("Todos los datos"): `detalle` ya viene del
  // backend restringido a Estado Psn='A' (última posición por Nº Pos Actual,
  // ver obtener_posiciones_activas), pero incluye posiciones vacantes. QA pidió
  // acotar además a Estado Nómina ocupado (A/S/L/P) — excluye vacantes — para
  // que el queryset del dropdown sea EMPLEADOS_COMPLETOS_SIG INNER JOIN MOV_POS
  // (última) WHERE Estado Psn='A' AND Estado Nómina IN ('A','P','L','S').
  const detalleParaFiltros = useMemo(
    () => detalle.filter(row => mapEstadoNomina(row.estado_nomina) !== "Vacante"),
    [detalle]
  );

  // BUG: si un filtro activo de columna de vacancia (Estado Nómina o Val_estat)
  // incluye "Vacante", intersectar ese filtro contra `detalleParaFiltros` (que
  // las excluye estructuralmente, ver arriba) siempre da 0 filas — todo el resto
  // de columnas queda sin ningún valor alcanzable (checkboxes deshabilitados,
  // imposible filtrar por ellas) mientras "Vacante" siga marcado. Cuando aplica,
  // se usa `detalle` (con vacantes) como universo para el resto de columnas.
  const filtroIncluyeVacantes = [...VACANCY_DEFINING_KEYS].some(
    (key) => (columnFilters[key] || []).includes("Vacante")
  );
  const datosParaColumnaActiva = filtroIncluyeVacantes ? detalle : detalleParaFiltros;

  // OPTIMIZACIÓN CRÍTICA: Los cálculos pesados dependen solo de los datos y de la columna activa
  const dateHierarchies = useMemo(() => {
    const hierarchies = {};
    const targetKeys = [];
    if (activeFilterDropdown && DATE_HIERARCHY_KEYS.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const years = {};
      datosParaColumnaActiva.forEach(row => {
        const val = row[key];
        const parts = parseDateParts(val);
        if (!parts) return;
        const { year, month, day, monthName } = parts;
        if (!years[year]) years[year] = { count: 0, months: {} };
        years[year].count++;
        if (!years[year].months[month]) years[year].months[month] = { count: 0, name: monthName, days: {} };
        years[year].months[month].count++;
        years[year].months[month].days[day] = (years[year].months[month].days[day] || 0) + 1;
      });
      hierarchies[key] = years;
    });
    return hierarchies;
  }, [datosParaColumnaActiva, activeFilterDropdown, parseDateParts]);

  const uniqueColumnValues = useMemo(() => {
    const valuesMap = {};
    const targetKeys = ["estado_nomina"];
    if (activeFilterDropdown && !targetKeys.includes(activeFilterDropdown)) {
      targetKeys.push(activeFilterDropdown);
    }

    targetKeys.forEach(key => {
      const counts = {};
      // Las columnas de vacancia ("estado_nomina", "val_estat") iteran `detalle`
      // (incluye vacantes): `detalleParaFiltros` las excluye a propósito para el
      // resto de columnas (BUG QA 2026-07-23), pero aplicado a estas columnas se
      // excluyen a sí mismas la opción "Vacante" antes de contarla, dejándola sin
      // aparecer nunca en su propio dropdown (ver VACANCY_DEFINING_KEYS).
      const sourceRows = VACANCY_DEFINING_KEYS.has(key) ? detalle : datosParaColumnaActiva;
      sourceRows.forEach(row => {
        let val = getFilterCellValue(row, key);
        counts[val] = (counts[val] || 0) + 1;
      });
      valuesMap[key] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    });
    return valuesMap;
  }, [detalle, datosParaColumnaActiva, activeFilterDropdown]);

  const toggleDateNode = (path) => {
    setExpandedDateNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleDateSelection = (colKey, type, value, parentPath = "") => {
    const hierarchy = dateHierarchies[colKey];
    if (!hierarchy) return;

    let targetRawValues = [];
    if (type === 'year') {
      targetRawValues = datosParaColumnaActiva
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'month') {
      const year = parentPath;
      targetRawValues = datosParaColumnaActiva
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === value;
        })
        .map(row => String(row[colKey] || "").trim());
    } else if (type === 'day') {
      const [year, month] = parentPath.split('-');
      targetRawValues = datosParaColumnaActiva
        .filter(row => {
          const p = parseDateParts(row[colKey]);
          return p && p.year === year && p.month === month && p.day === value;
        })
        .map(row => String(row[colKey] || "").trim());
    }

    // Sólo togglear lo alcanzable dado el resto de filtros (el nodo ya aparece
    // deshabilitado en el dropdown cuando nada de él es alcanzable).
    const reachableSet = new Set(reachableValues);
    const uniqueTargetValues = [...new Set(targetRawValues)].filter(v => reachableSet.has(v));
    if (uniqueTargetValues.length === 0) return;
    const allInTemp = uniqueTargetValues.every(v => tempSelectedValues.includes(v));

    if (allInTemp) {
      setTempSelectedValues(prev => prev.filter(v => !uniqueTargetValues.includes(v)));
    } else {
      setTempSelectedValues(prev => [...new Set([...prev, ...uniqueTargetValues])]);
    }
  };

  const openFilterDropdown = (colKey) => {
    if (activeFilterDropdown === colKey) setActiveFilterDropdown(null);
    else {
      setActiveFilterDropdown(colKey);
      setFilterSearchText("");
      // Inline (no vía el memo `reachableValues`, que es lazy y aún no se ha
      // recomputado para la columna recién activada).
      setTempSelectedValues(columnFilters[colKey] || Object.keys(computeReachableCounts(colKey)));
    }
  };

  const applyColumnFilter = (colKey) => {
    const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
    if (shouldClear) {
      const newFilters = { ...columnFilters };
      delete newFilters[colKey];
      setColumnFilters(newFilters);
    } else {
      setColumnFilters({ ...columnFilters, [colKey]: valuesToCommit });
    }
    setActiveFilterDropdown(null);
  };

  const clearColumnFilter = (colKey) => {
    const newFilters = { ...columnFilters };
    delete newFilters[colKey];
    setColumnFilters(newFilters);
    setActiveFilterDropdown(null);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    resetAdvancedFilters();
    startTransition(() => {
      setColumnFilters({});
      setTextFilters({});
      setGlobalSearch("");
      setSortConfig({ key: null, direction: null });
    });
  };

  const handleStatusFilter = (label) => {
    const current = columnFilters["estado_nomina"] || [];
    const next = current.includes(label) ? current.filter(s => s !== label) : [...current, label];
    const newFilters = { ...columnFilters };
    // Ojo: uniqueColumnValues["estado_nomina"] excluye "Vacante" a propósito
    // (detalleParaFiltros la filtra, ver línea 817), así que no sirve como
    // total de tarjetas — hay que usar STATUS_COLORS (las 5 tarjetas reales).
    if (next.length === 0 || next.length === Object.keys(STATUS_COLORS).length) delete newFilters["estado_nomina"];
    else newFilters["estado_nomina"] = next;
    startTransition(() => { setColumnFilters(newFilters); setScrollTop(0); });
  };

  // El índice llega desde DataTable y es relativo a `tableColumns` (lo que la
  // tabla recibe), que puede no incluir la columna de foto; el ancho se aplica
  // por clave sobre `columns` para no desfasarse con ese recorte.
  const handleMouseDown = (e, index, direction = 'right') => {
    e.preventDefault();
    const target = tableColumns[index];
    if (!target) return;
    const startX = e.clientX, startWidth = target.width;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumns(prevCols => {
        const newWidth = direction === 'left' ? startWidth - deltaX : startWidth + deltaX;
        return prevCols.map(c => (c.key === target.key ? { ...c, width: Math.max(60, newWidth) } : c));
      });
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    else if (sortConfig.key === key && sortConfig.direction === "desc") direction = null;
    setSortConfig({ key, direction });
  };

  const handleCardResizeMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const rect = cardRef.current?.getBoundingClientRect();
    const startWidth = rect ? rect.width : 1280;
    const maxAllowedWidth = window.innerWidth - 48;
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setCardWidth(Math.max(400, Math.min(maxAllowedWidth, startWidth + 2 * deltaX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setActiveFilterDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const shouldLock = !!activeFilterDropdown || isColumnsModalOpen;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activeFilterDropdown, isColumnsModalOpen]);

  // Índice de búsqueda precomputado por fila: un solo string normalizado (sin
  // acentos, minúsculas) por fila, calculado una vez cuando cambia `detalle` (no
  // en cada tecla de la búsqueda global). Antes se hacía Object.entries +
  // toLowerCase de las 70+ columnas de cada fila en cada pulsación; ahora es una
  // búsqueda O(1) sobre un blob ya normalizado.
  const searchIndex = useMemo(() => {
    const map = new Map();
    detalle.forEach((row) => {
      const blob = normalizeForSearch(
        Object.entries(row)
          .map(([key, val]) => (key === "estado_nomina" ? mapEstadoNomina(val) : String(val || "")))
          .join(" ")
      );
      map.set(row, blob);
    });
    return map;
  }, [detalle]);

  // Filtro y orden se memoizan por separado: cambiar sólo el orden (click en encabezado)
  // no debe re-ejecutar todo el pipeline de filtros (búsqueda global, columnas, texto,
  // filtros avanzados), sólo re-ordenar el resultado ya filtrado.
  const filteredData = useMemo(() => {
    return detalle.filter(row => {
      if (deferredGlobalSearch) {
        const searchText = normalizeForSearch(deferredGlobalSearch);
        const blob = searchIndex.get(row) || "";
        if (!blob.includes(searchText)) return false;
      }
      for (const [colKey, selectedVals] of Object.entries(columnFilters)) {
        if (!selectedVals.includes(getFilterCellValue(row, colKey))) return false;
      }
      for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {
        if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
        const searchText = filterObj.value;
        const condition = filterObj.condition || (isMonoColumn(colKey) ? "starts_with" : "contains");

        const val = getFilterCellValue(row, colKey);
        const lowerVal = normalizeForSearch(val).trim();
        const lowerSearch = normalizeForSearch(searchText).trim();

        switch (condition) {
          case "contains":
            if (!lowerVal.includes(lowerSearch)) return false;
            break;
          case "not_contains":
            if (lowerVal.includes(lowerSearch)) return false;
            break;
          case "starts_with":
            if (!lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "not_starts_with":
            if (lowerVal.startsWith(lowerSearch)) return false;
            break;
          case "ends_with":
            if (!lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "not_ends_with":
            if (lowerVal.endsWith(lowerSearch)) return false;
            break;
          case "equals":
            if (lowerVal !== lowerSearch) return false;
            break;
          case "not_equals":
            if (lowerVal === lowerSearch) return false;
            break;
          default:
            if (!lowerVal.includes(lowerSearch)) return false;
        }
      }
      if (!evaluateAdvancedFilters(row, appliedAdvancedFilters, { getCellValue: getAdvCellValue, isDateColumn })) return false;
      return true;
    });
  }, [detalle, deferredGlobalSearch, columnFilters, deferredTextFilters, isMonoColumn, appliedAdvancedFilters, getAdvCellValue, isDateColumn, searchIndex]);

  const filteredSortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData;
    const { key, direction } = sortConfig;
    const result = [...filteredData];
    result.sort((a, b) => {
      let valA = key === "estado_nomina" ? mapEstadoNomina(a[key]) : String(a[key] || "").trim();
      let valB = key === "estado_nomina" ? mapEstadoNomina(b[key]) : String(b[key] || "").trim();
      const numA = Number(valA), numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) return direction === "asc" ? numA - numB : numB - numA;
      return direction === "asc" ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
    });
    return result;
  }, [filteredData, sortConfig]);


  // Valores alcanzables de una columna dado el resto de filtros (todos EXCEPTO
  // el propio de esa columna). Función pura (no memo) para poder llamarla
  // también desde `openFilterDropdown` con la columna recién activada, antes
  // de que `reachableValues` (memo, atado a `activeFilterDropdown`) se
  // recompute.
  //
  // BUG QA 2026-07-23: debe iterar sobre el MISMO dataset que arma
  // `uniqueColumnValues` (la lista que ve el usuario) — `datosParaColumnaActiva`
  // (que excluye vacantes salvo que el filtro de Estado Nómina ya incluya
  // "Vacante", ver definición arriba). Iterar antes sobre `detalle` (incluye
  // vacantes) siempre hacía que `reachableValues` incluyera valores de columna
  // que sólo existían en posiciones vacantes — invisibles en la lista del
  // dropdown. Al usar "Seleccionar Todo"/"Desmarcar Todo" (que sólo togglean lo
  // VISIBLE), esos valores fantasma quedaban seleccionados sin que el usuario
  // pudiera verlos ni desmarcarlos, y se colaban en el filtro aplicado (ej.
  // columna "Nivel": marcar 2 valores visibles terminaba aplicando 4).
  // Devuelve conteos por valor (no sólo un set de alcanzables): el mismo bucle
  // que antes sólo marcaba `counts[val] = true` ahora tambien sirve para
  // mostrar en el dropdown cuántas filas de ESTA columna matchean dado el
  // resto de filtros activos (contador dinámico, ver REPORTE_QA... "contador
  // de vacantes no baja al filtrar por unidad administrativa").
  const computeReachableCounts = useCallback((colKey) => {
    const counts = {};
    // Mismo motivo que en `uniqueColumnValues`: para las columnas de vacancia
    // hay que iterar `detalle` (incluye vacantes), si no "Vacante" nunca es
    // alcanzable ni seleccionable en su propio dropdown.
    const sourceRows = VACANCY_DEFINING_KEYS.has(colKey) ? detalle : datosParaColumnaActiva;
    sourceRows.forEach(row => {
      if (deferredGlobalSearch) {
        const searchText = normalizeForSearch(deferredGlobalSearch);
        const blob = searchIndex.get(row) || "";
        if (!blob.includes(searchText)) return;
      }
      for (const [ck, selectedVals] of Object.entries(columnFilters)) {
        if (ck === colKey) continue;
        if (!selectedVals.includes(getFilterCellValue(row, ck))) return;
      }
      for (const [ck, filterObj] of Object.entries(deferredTextFilters)) {
        if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
        const searchText = filterObj.value;
        const condition = filterObj.condition || (isMonoColumn(ck) ? "starts_with" : "contains");
        const valStr = getFilterCellValue(row, ck);
        const lowerVal = normalizeForSearch(valStr).trim();
        const lowerSearch = normalizeForSearch(searchText).trim();
        let pass = false;
        switch (condition) {
          case "contains": pass = lowerVal.includes(lowerSearch); break;
          case "not_contains": pass = !lowerVal.includes(lowerSearch); break;
          case "starts_with": pass = lowerVal.startsWith(lowerSearch); break;
          case "not_starts_with": pass = !lowerVal.startsWith(lowerSearch); break;
          case "ends_with": pass = lowerVal.endsWith(lowerSearch); break;
          case "not_ends_with": pass = !lowerVal.endsWith(lowerSearch); break;
          case "equals": pass = lowerVal === lowerSearch; break;
          case "not_equals": pass = lowerVal !== lowerSearch; break;
          default: pass = lowerVal.includes(lowerSearch); break;
        }
        if (!pass) return;
      }
      if (!evaluateAdvancedFilters(row, appliedAdvancedFilters, { getCellValue: getAdvCellValue, isDateColumn })) return;
      const val = getFilterCellValue(row, colKey);
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }, [detalle, datosParaColumnaActiva, deferredGlobalSearch, columnFilters, deferredTextFilters, isMonoColumn, appliedAdvancedFilters, getAdvCellValue, isDateColumn, searchIndex]);

  const reachableCounts = useMemo(
    () => (activeFilterDropdown ? computeReachableCounts(activeFilterDropdown) : {}),
    [activeFilterDropdown, computeReachableCounts]
  );
  const reachableValues = useMemo(() => Object.keys(reachableCounts), [reachableCounts]);

  const filterDropdownValues = useMemo(() => {
    if (!activeFilterDropdown) return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false };

    // Conteo dinámico: el `count` de `uniqueColumnValues` es sobre el dataset
    // completo (sin considerar el resto de filtros activos); se sobreescribe
    // aquí con `reachableCounts`, que sí los considera (0 si ya no es
    // alcanzable dado el resto de filtros).
    const baseUniqueValues = (uniqueColumnValues[activeFilterDropdown] || []).map(v => ({
      ...v,
      count: reachableCounts[v.value] ?? 0,
    }));
    const filtered = baseUniqueValues.filter(v => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));

    return finalizeFilterDropdownValues({
      baseUniqueValues,
      filtered,
      tempSelectedValues,
      committedSelectedValues: columnFilters[activeFilterDropdown] || [],
      reachableValues,
    });
  }, [activeFilterDropdown, uniqueColumnValues, reachableValues, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

  const rowHeight = 37, containerHeight = 1200;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
  const endIndex = Math.min(filteredSortedData.length, Math.floor((scrollTop + containerHeight) / rowHeight) + 15);
  const paginatedData = filteredSortedData.slice(startIndex, endIndex);

  // Edición inline (doble click en celda). `editingCell` identifica la celda en
  // edición por clave de negocio (posicion) + columna, no por índice de fila,
  // así sobrevive a re-ordenamientos/filtros mientras se edita.
  const [editingCell, setEditingCell] = useState(null); // { posicion, colKey, value, originalValue, saving, error }
  const editCancelledRef = useRef(false);

  const isPasteableColumn = useCallback((colKey) => !!colKey && !NON_EDITABLE_KEYS.has(colKey), []);

  // Pila de deshacer (Ctrl+Z): cada edición confirmada (doble click, "Pegar
  // valor"/Ctrl+V o "Borrar contenido") empuja aquí el valor previo. Deshacer
  // vuelve a escribirlo con el mismo endpoint de override (backend + estado
  // local), por lo que queda registrado como un cambio más en el historial.
  const undoStackRef = useRef([]);
  const isUndoingRef = useRef(false);
  const pushUndo = useCallback((posicion, colKey, previousValue) => {
    undoStackRef.current.push({ posicion, colKey, previousValue });
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
  }, []);

  // Indicador visual por celda (spinner mientras se guarda, palomita al éxito),
  // esquina derecha de la celda. Cubre los 3 caminos de edición (doble click,
  // "Pegar valor"/Ctrl+V, "Borrar contenido") y el deshacer con Ctrl+Z.
  // Keyed por posicion+columna (no por índice de fila) para sobrevivir a
  // filtros/orden mientras la petición sigue en vuelo.
  const [cellStatusMap, setCellStatusMap] = useState({});
  const cellStatusTimersRef = useRef({});
  const cellStatusKey = useCallback((posicion, colKey) => `${posicion}::${colKey}`, []);
  const setCellSaving = useCallback((posicion, colKey) => {
    const k = cellStatusKey(posicion, colKey);
    clearTimeout(cellStatusTimersRef.current[k]);
    setCellStatusMap((prev) => ({ ...prev, [k]: "saving" }));
  }, [cellStatusKey]);
  const setCellSuccess = useCallback((posicion, colKey) => {
    const k = cellStatusKey(posicion, colKey);
    clearTimeout(cellStatusTimersRef.current[k]);
    setCellStatusMap((prev) => ({ ...prev, [k]: "success" }));
    cellStatusTimersRef.current[k] = setTimeout(() => {
      setCellStatusMap((prev) => { if (!(k in prev)) return prev; const next = { ...prev }; delete next[k]; return next; });
    }, 1400);
  }, [cellStatusKey]);
  const clearCellStatus = useCallback((posicion, colKey) => {
    const k = cellStatusKey(posicion, colKey);
    clearTimeout(cellStatusTimersRef.current[k]);
    setCellStatusMap((prev) => { if (!(k in prev)) return prev; const next = { ...prev }; delete next[k]; return next; });
  }, [cellStatusKey]);
  useEffect(() => () => {
    Object.values(cellStatusTimersRef.current).forEach(clearTimeout);
  }, []);
  const renderCellStatusOverlay = useCallback((posicion, colKey) => {
    const status = cellStatusMap[cellStatusKey(posicion, colKey)];
    if (!status) return null;
    return (
      <AnimatePresence>
        {status === "saving" ? (
          <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
            <Loader2 className="size-3.5 animate-spin text-[#621f32] dark:text-[#bc955c]" />
          </motion.span>
        ) : (
          <motion.span key="success" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    );
  }, [cellStatusMap, cellStatusKey]);

  const handleCellDoubleClick = useCallback((e, value, row, colKey) => {
    if (!canEditCeldas || !isPasteableColumn(colKey)) return;
    // Los datos de solicitud solo tienen sentido mientras la plaza siga
    // vacante — el backend los va a seguir blanqueando si ya se ocupó, así
    // que ni siquiera se deja entrar en modo edición ahí.
    if (SOLICITUD_COLS.includes(colKey) && getEstadoNominaDisplay(row) !== "Vacante" && getEstadoNominaDisplay(row) !== "Solicitada") return;
    const strValue = value === undefined || value === null ? "" : String(value);
    setEditingCell({ posicion: row.posicion, colKey, value: strValue, originalValue: strValue });
  }, [canEditCeldas, isPasteableColumn]);

  // Mismo flujo que "Pegar valor": guarda en CeldaOverride + UPDATE en
  // EMPLEADOS_COMPLETOS_SIG (backend, 1 transacción); solo tras la
  // confirmación se refleja en el estado local, sin fetch.
  const commitCellEdit = useCallback(async () => {
    if (!editingCell || editingCell.saving) return;
    const { posicion, colKey, value, originalValue } = editingCell;
    setEditingCell((c) => (c ? { ...c, saving: true, error: null } : c));
    setCellSaving(posicion, colKey);
    try {
      const isQuincenal = QUINCENAL_COLS.has(colKey);
      const isFechaAnuencia = colKey === FECHA_ANUENCIA_COL;
      const res = isFechaAnuencia
        ? (value
          ? await VacantesService.patchFechaAnuenciaOverride(posicion, value)
          : await VacantesService.deleteFechaAnuenciaOverride(posicion))
        : isQuincenal
          ? await VacantesService.patchColumnaQuincenal(posicion, colKey, value)
          : await VacantesService.patchEmpleadoCompletoOverride(posicion, colKey, value);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo guardar el cambio.");
      }
      onCellEdited?.(posicion, colKey, value);
      if (value !== originalValue) pushUndo(posicion, colKey, originalValue);
      setEditingCell(null);
      setCellSuccess(posicion, colKey);
    } catch (err) {
      clearCellStatus(posicion, colKey);
      setEditingCell((c) => (c ? { ...c, saving: false, error: err.message || "Error al guardar." } : c));
    }
  }, [editingCell, onCellEdited, pushUndo, setCellSaving, setCellSuccess, clearCellStatus]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); editCancelledRef.current = true; setEditingCell(null); }
  }, []);

  const handleEditBlur = useCallback(() => {
    if (editCancelledRef.current) { editCancelledRef.current = false; return; }
    commitCellEdit();
  }, [commitCellEdit]);

  const renderCell = useCallback(({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu, onDoubleClick }) => {
    const stickyStyle = isSticky ? { position: 'sticky', left: leftOffset, zIndex: 20 } : {};
    // Fotografía: la fila NO trae la imagen (la tabla se sirve completa, sin
    // paginar; mandarlas todas serían miles de imágenes por carga). Se pide una
    // por una y sólo cuando la celda entra al viewport — ver FotoEmpleadoCell.
    if (col.key === FOTO_COLUMN_KEY) {
      return (
        <td
          key={col.key}
          onClick={onClick}
          onContextMenu={onContextMenu}
          style={stickyStyle}
          className={`relative px-1 border-r h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}
        >
          <FotoEmpleadoCell
            numempleado={row.numempleado || row.id_empleado}
            rootRef={tableContainerRef}
            enabled={canViewFotoDetalle}
            caption={[row.nombres, row.posicion ? `POS ${row.posicion}` : null].filter(Boolean).join(" — ")}
          />
        </td>
      );
    }
    // "Fecha que se genera la vacante" = fecha_vacancia calculada (ver
    // NON_EDITABLE_KEYS) — clic abre el mismo modal de Detalle de Vacancia
    // que Mov. Posiciones (VacanciaDetalleModal), keyed por `row.mov_pos_id`
    // en vez de `row.id` (MovPos) ya que esta tabla parte de EMPLEADOS_COMPLETOS_SIG.
    if (col.key === "fecha_genera_vacante") {
      const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
      const tdClassName = `relative px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} font-semibold ${hasValue ? "cursor-pointer hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c]" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const handleVacanciaClick = (e) => { onClick(e); if (hasValue) openVacanciaModal(row); };
      const content = hasValue
        ? (<div className="flex items-center justify-between gap-2"><span>{formatDateEsMx(value)}</span><MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title="Clic para ver detalle de vacancia" /></div>)
        : <span className="text-slate-300 dark:text-slate-700 italic">-</span>;
      return (<td key={col.key} style={stickyStyle} onContextMenu={onContextMenu} onClick={handleVacanciaClick} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>);
    }
    if (editingCell && editingCell.posicion === row.posicion && editingCell.colKey === col.key) {
      return (
        <td key={col.key} style={stickyStyle} className={`relative px-1.5 text-xs border-r h-[37px] align-middle ring-2 ring-[#621f32] z-10 ${isSticky ? "bg-white dark:bg-slate-950" : "bg-white dark:bg-slate-900"}`}>
          {col.key === "reportada" ? (
            <select
              autoFocus
              value={editingCell.value}
              disabled={editingCell.saving}
              onChange={(e) => setEditingCell((c) => (c ? { ...c, value: e.target.value, error: null } : c))}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditBlur}
              className="w-full h-full bg-transparent outline-none text-xs font-bold text-[#621f32] dark:text-[#bc955c] disabled:opacity-50"
            >
              <option value=""></option>
              <option value="Si">Si</option>
              <option value="No">No</option>
            </select>
          ) : col.key === FECHA_ANUENCIA_COL ? (
            <>
              <input
                autoFocus
                type="text"
                list="fecha-anuencia-categorias"
                placeholder="YYYY-MM-DD o categoría..."
                value={editingCell.value}
                disabled={editingCell.saving}
                onChange={(e) => setEditingCell((c) => (c ? { ...c, value: e.target.value, error: null } : c))}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleEditKeyDown}
                onBlur={handleEditBlur}
                className="w-full h-full bg-transparent outline-none text-xs font-bold text-[#621f32] dark:text-[#bc955c] disabled:opacity-50"
              />
              <datalist id="fecha-anuencia-categorias">
                {FECHA_ANUENCIA_CATEGORIAS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </>
          ) : (
            <input
              autoFocus
              type="text"
              value={editingCell.value}
              disabled={editingCell.saving}
              onChange={(e) => setEditingCell((c) => (c ? { ...c, value: e.target.value, error: null } : c))}
              onFocus={(e) => e.target.select()}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditBlur}
              className="w-full h-full bg-transparent outline-none text-xs font-bold text-[#621f32] dark:text-[#bc955c] disabled:opacity-50"
            />
          )}
          {editingCell.error && (
            <span className="absolute left-1 top-full mt-0.5 z-20 text-[9px] font-bold text-red-600 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">{editingCell.error}</span>
          )}
          {renderCellStatusOverlay(row.posicion, col.key)}
        </td>
      );
    }
    // "Fecha de Anuencia": mismo semáforo de color (días restantes) y tooltip
    // que ya existe en Mov. Posiciones (misma fecha/override, ver
    // FECHA_ANUENCIA_COL) — solo entra aquí cuando NO se está editando esta
    // celda (el modo edición ya se resolvió arriba, con el combobox).
    if (col.key === FECHA_ANUENCIA_COL) {
      const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
      const dias = hasValue ? daysUntil(value) : null;
      const isOverride = !!row.fecha_anuencia_detalle_override;
      // El override manual (azul) tiene prioridad visual sobre el semáforo de
      // urgencia — "editado a mano" es la señal más relevante para identificarlo.
      const colorClasses = isOverride
        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
        : (dias !== null ? getAnuenciaColorClasses(dias) : null);
      const tdClassName = `relative px-4 text-xs border-r truncate h-[37px] align-middle font-semibold ${
        colorClasses || (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")
      } ${isSelected ? "ring-2 ring-[#621f32] z-10 shadow-md" : ""} ${canEditCeldas ? "cursor-pointer" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = hasValue ? formatDateEsMx(value) : <span className="text-slate-300 dark:text-slate-700 italic">-</span>;
      if (dias === null) {
        return (<td key={col.key} style={stickyStyle} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} className={tdClassName} title={canEditCeldas ? "Doble clic para editar" : undefined}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>);
      }
      // Tooltip con los días restantes para llegar a esta fecha (o los que
      // ya pasaron desde que venció) — ver daysUntil.
      const tooltipMsg = (dias > 0
        ? `Faltan ${dias} ${dias === 1 ? "día" : "días"} para la fecha de anuencia`
        : dias === 0
        ? "Hoy vence la fecha de anuencia"
        : `La fecha de anuencia venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`
      ) + (isOverride ? " (fecha editada manualmente)" : "");
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td style={stickyStyle} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipMsg}{canEditCeldas ? " — doble clic para editar" : ""}</TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "estado_nomina") {
      const est = getEstadoNominaDisplay(row), Icon = STATUS_ICONS[est] || UserCheck, badge = STATUS_BADGE_STYLES[est] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
      // Solo Vacante/Solicitada tienen columnas de solicitud que mostrar/ocultar.
      const canToggleSolicitud = est === "Vacante" || est === "Solicitada";
      return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={`relative px-4 text-[10px] border-r align-middle h-[37px] transition-all ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md" : (isSticky ? "bg-white dark:bg-slate-950" : "bg-white/10")} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`}><span
        onClick={canToggleSolicitud ? (e) => { e.stopPropagation(); toggleSolicitudColumns(); } : undefined}
        title={canToggleSolicitud ? "Clic para mostrar/ocultar los datos de la solicitud" : undefined}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold uppercase ${badge.bg} ${badge.text} ${badge.border} ${canToggleSolicitud ? "cursor-pointer hover:brightness-95 dark:hover:brightness-110" : ""}`}
      ><Icon className="size-3" />{est}</span>{renderCellStatusOverlay(row.posicion, col.key)}</td>);
    }
    if (col.key === "depto" || col.key === "id_departamento") {
      const deptoInfo = getDeptoInfo(deptoCatalog, value);
      const tdClassName = `relative px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${deptoInfo ? "cursor-help" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = value === undefined || value === null || String(value).trim() === "" ? <span className="text-slate-300 dark:text-slate-700 italic">-</span> : String(value);
      if (!deptoInfo) {
        return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>);
      }
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{deptoInfo.nombre}</span>
              <span className="text-[10px] opacity-80">Nivel: {deptoInfo.nivel || "N/D"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (col.key === "motivo") {
      const motivoInfo = getMotivoInfo(motivosCatalog, value);
      const tdClassName = `relative px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${motivoInfo ? "cursor-help" : ""} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''}`;
      const content = value === undefined || value === null || String(value).trim() === "" ? <span className="text-slate-300 dark:text-slate-700 italic">-</span> : String(value);
      if (!motivoInfo) {
        return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>);
      }
      return (
        <Tooltip key={col.key}>
          <TooltipTrigger asChild>
            <td onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={tdClassName}>{content}{renderCellStatusOverlay(row.posicion, col.key)}</td>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{motivoInfo.cd_motivo}</span>
              <span className="text-[10px] opacity-80">{motivoInfo.descripcion_larga || "Sin descripción"}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    let displayContent;
    if (col.key === "rango") {
      const rangoVal = displayRango(value, row.tipo_de_personal_sedena_semar);
      displayContent = rangoVal ? String(rangoVal) : <span className="text-slate-300 dark:text-slate-700 italic">-</span>;
    } else if (value === undefined || value === null || String(value).trim() === "") {
      displayContent = <span className="text-slate-300 dark:text-slate-700 italic">-</span>;
    } else if (col.key === "partida") {
      displayContent = mapPartida(value, row.posicion);
    } else if (col.key === "tipo_de_contratacion") {
      displayContent = mapTipoContratacion(value);
    } else if (isDateColumn(col.key)) {
      displayContent = formatDateEsMx(value);
    } else if (CURRENCY_KEYS.has(col.key) && !isNaN(Number(value))) {
      displayContent = formatCurrency(value);
    } else {
      displayContent = String(value);
    }
    // Las 3 columnas de solicitud aparecen/desaparecen al vuelo con el pill de
    // Estado Nómina (ver toggleSolicitudColumns) — un fade-in suave al montarse
    // hace visible esa transición sin animar el ancho de la tabla completa.
    const solicitudFadeClass = SOLICITUD_COLS.includes(col.key) ? "animate-in fade-in slide-in-from-left-1 duration-300" : "";
    return (<td key={col.key} onClick={onClick} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} style={stickyStyle} className={`relative px-4 text-xs border-r truncate h-[37px] align-middle ${isSelected ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]" : (isSticky ? "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300" : "bg-white/10 text-slate-700 dark:text-slate-300")} ${isMonoColumn(col.key) ? "font-mono font-bold" : "font-semibold"} ${isSticky ? 'shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]' : ''} ${solicitudFadeClass}`}>{displayContent}{renderCellStatusOverlay(row.posicion, col.key)}</td>);
  }, [isMonoColumn, isDateColumn, deptoCatalog, motivosCatalog, editingCell, handleEditKeyDown, handleEditBlur, renderCellStatusOverlay, canViewFotoDetalle, openVacanciaModal, canEditCeldas, toggleSolicitudColumns]);

  const handleCellContextMenu = useCallback((e, value, rect, row, colKey) => {
    setContextMenu({ x: e.clientX, y: e.clientY, value, rect, row, colKey });
  }, []);

  // Guarda primero en CeldaOverride + aplica el UPDATE en EMPLEADOS_COMPLETOS_SIG
  // (backend, todo en una transacción); solo tras esa confirmación se refleja
  // en el estado local — sin volver a pedir los datos al servidor. Núcleo
  // compartido por el menú contextual ("Pegar valor") y el atajo Ctrl+V.
  const pasteValueToCell = useCallback(async (row, colKey, text) => {
    if (!row || !colKey || !isPasteableColumn(colKey)) return;
    if (SOLICITUD_COLS.includes(colKey) && getEstadoNominaDisplay(row) !== "Vacante" && getEstadoNominaDisplay(row) !== "Solicitada") return;
    const previousValue = row[colKey] === undefined || row[colKey] === null ? "" : String(row[colKey]);
    setCellSaving(row.posicion, colKey);
    try {
      const isQuincenal = QUINCENAL_COLS.has(colKey);
      const isFechaAnuencia = colKey === FECHA_ANUENCIA_COL;
      const res = isFechaAnuencia
        ? (text
          ? await VacantesService.patchFechaAnuenciaOverride(row.posicion, text)
          : await VacantesService.deleteFechaAnuenciaOverride(row.posicion))
        : isQuincenal
          ? await VacantesService.patchColumnaQuincenal(row.posicion, colKey, text)
          : await VacantesService.patchEmpleadoCompletoOverride(row.posicion, colKey, text);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo guardar el cambio.");
      }
      onCellEdited?.(row.posicion, colKey, text);
      if (text !== previousValue) pushUndo(row.posicion, colKey, previousValue);
      setCellSuccess(row.posicion, colKey);
    } catch (err) {
      clearCellStatus(row.posicion, colKey);
      throw err;
    }
  }, [isPasteableColumn, onCellEdited, pushUndo, setCellSaving, setCellSuccess, clearCellStatus]);

  const handlePasteCell = useCallback(async (text) => {
    const { row, colKey } = contextMenu || {};
    await pasteValueToCell(row, colKey, text);
  }, [contextMenu, pasteValueToCell]);

  // Borra el contenido de la celda: NULL en EMPLEADOS_COMPLETOS_SIG +
  // elimina (no solo desactiva) el historial de CeldaOverride de esa celda
  // (backend, ver plantilla.celda_override.borrar_contenido_celda).
  const handleClearCell = useCallback(async () => {
    const { row, colKey } = contextMenu || {};
    if (!row || !colKey || !isPasteableColumn(colKey)) return;
    const previousValue = row[colKey] === undefined || row[colKey] === null ? "" : String(row[colKey]);
    setCellSaving(row.posicion, colKey);
    try {
      const isQuincenal = QUINCENAL_COLS.has(colKey);
      const isFechaAnuencia = colKey === FECHA_ANUENCIA_COL;
      const res = isFechaAnuencia
        ? await VacantesService.deleteFechaAnuenciaOverride(row.posicion)
        : isQuincenal
          ? await VacantesService.deleteColumnaQuincenal(row.posicion, colKey)
          : await VacantesService.deleteEmpleadoCompletoOverride(row.posicion, colKey);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo borrar el contenido.");
      }
      onCellEdited?.(row.posicion, colKey, null);
      if (previousValue !== "") pushUndo(row.posicion, colKey, previousValue);
      setCellSuccess(row.posicion, colKey);
    } catch (err) {
      clearCellStatus(row.posicion, colKey);
      throw err;
    }
  }, [contextMenu, isPasteableColumn, onCellEdited, pushUndo, setCellSaving, setCellSuccess, clearCellStatus]);
  // Refs actualizadas sin re-suscribir el listener global de teclado (ver más abajo):
  // antes el efecto dependía de [columns, filteredSortedData], así que se removía y
  // re-agregaba en cada tecla de búsqueda (cualquier cambio en los datos filtrados).
  const columnsRef = useRef(tableColumns);
  useEffect(() => { columnsRef.current = tableColumns; }, [tableColumns]);
  const filteredSortedDataRef = useRef(filteredSortedData);
  useEffect(() => { filteredSortedDataRef.current = filteredSortedData; }, [filteredSortedData]);
  const selectedCellRef = useRef(selectedCell);
  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  const contextMenuRef = useRef(contextMenu);
  useEffect(() => { contextMenuRef.current = contextMenu; }, [contextMenu]);

  // Ctrl+C / Ctrl+V nativos sobre la celda seleccionada: mismas acciones que
  // "Copiar/Pegar valor de celda" del menú contextual (CopyCellMenu), pero
  // sin pasar por él. Usa los eventos nativos `copy`/`paste` (no la Clipboard
  // API async) porque no requieren secure context — funcionan igual en HTTPS,
  // localhost o el servidor por IP/HTTP plano. Si el menú contextual está
  // abierto se cede el paso a su propio flujo (ver CopyCellMenu) para no
  // disparar el pegado dos veces.
  useEffect(() => {
    const handleWindowCopy = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (contextMenuRef.current) return;
      const cell = selectedCellRef.current;
      if (!cell || !e.clipboardData) return;
      const col = columnsRef.current.filter(c => c.visible)[cell.col];
      const row = filteredSortedDataRef.current[cell.row];
      if (!col || !row) return;
      const raw = row[col.key];
      e.preventDefault();
      e.clipboardData.setData('text/plain', raw === undefined || raw === null ? "" : String(raw));
      toast.success("Se ha copiado al portapapeles!");
    };

    const handleWindowPaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (contextMenuRef.current) return;
      if (!canEditCeldas) return;
      const cell = selectedCellRef.current;
      if (!cell) return;
      const col = columnsRef.current.filter(c => c.visible)[cell.col];
      const row = filteredSortedDataRef.current[cell.row];
      if (!col || !row || !isPasteableColumn(col.key)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') ?? "";
      pasteValueToCell(row, col.key, text)
        .then(() => toast.success("Se ha pegado en la celda seleccionada!"))
        .catch((err) => {
          console.error("No se pudo pegar el valor con Ctrl+V:", err);
          toast.error(err.message || "No se pudo pegar el valor.");
        });
    };

    window.addEventListener('copy', handleWindowCopy);
    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('copy', handleWindowCopy);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [canEditCeldas, isPasteableColumn, pasteValueToCell, toast]);

  // Ctrl+Z: deshace la última edición de celda confirmada (doble click,
  // "Pegar valor"/Ctrl+V o "Borrar contenido"), ya se haya guardado en la
  // base de datos o no. Reescribe el valor previo con el mismo endpoint de
  // override, así que el "deshacer" queda registrado como un cambio más en
  // el historial (ver comentario en undoStackRef más arriba).
  const undoLastEdit = useCallback(async () => {
    if (isUndoingRef.current) return;
    const entry = undoStackRef.current.pop();
    if (!entry) {
      toast.info("No hay cambios para deshacer.");
      return;
    }
    isUndoingRef.current = true;
    setCellSaving(entry.posicion, entry.colKey);
    try {
      const res = await VacantesService.patchEmpleadoCompletoOverride(entry.posicion, entry.colKey, entry.previousValue);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "No se pudo deshacer el cambio.");
      }
      onCellEdited?.(entry.posicion, entry.colKey, entry.previousValue);
      setCellSuccess(entry.posicion, entry.colKey);
      toast.success("Cambio deshecho.");
    } catch (err) {
      clearCellStatus(entry.posicion, entry.colKey);
      undoStackRef.current.push(entry);
      toast.error(err.message || "No se pudo deshacer el cambio.");
    } finally {
      isUndoingRef.current = false;
    }
  }, [onCellEdited, toast, setCellSaving, setCellSuccess, clearCellStatus]);

  useEffect(() => {
    const handleWindowUndo = (e) => {
      if ((e.key !== 'z' && e.key !== 'Z') || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!canEditCeldas) return;
      e.preventDefault();
      undoLastEdit();
    };
    window.addEventListener('keydown', handleWindowUndo);
    return () => window.removeEventListener('keydown', handleWindowUndo);
  }, [canEditCeldas, undoLastEdit]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (!e.key.startsWith('Arrow')) {
        if (e.key === 'Escape') setContextMenu(null);
        return;
      }

      e.preventDefault();

      if (e.repeat) {
        arrowRepeatRef.current += 1;
      } else {
        arrowRepeatRef.current = 1;
      }

      let step = 1;
      if (arrowRepeatRef.current > 5) step = 2;
      if (arrowRepeatRef.current > 12) step = 5;
      if (arrowRepeatRef.current > 20) step = 10;
      if (arrowRepeatRef.current > 35) step = 20;

      const visibleCols = columnsRef.current.filter(c => c.visible).length;

      setSelectedCell(prev => {
        if (!prev) return prev; // Do nothing if no cell is selected
        let newRow = prev.row;
        let newCol = prev.col;
        if (e.key === 'ArrowUp') newRow = Math.max(0, prev.row - step);
        if (e.key === 'ArrowDown') newRow = Math.min(filteredSortedDataRef.current.length - 1, prev.row + step);
        if (e.key === 'ArrowLeft') newCol = Math.max(0, prev.col - step);
        if (e.key === 'ArrowRight') newCol = Math.min(visibleCols - 1, prev.col + step);
        return { row: newRow, col: newCol };
      });
    };

    const handleKeyUp = (e) => {
      if (e.key.startsWith('Arrow')) {
        arrowRepeatRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);


  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Plantilla_Empleados");

      const visibleCols = dataColumns.filter(c => c.visible);

      // Define columns
      worksheet.columns = visibleCols.map(col => ({
        key: col.key,
        width: 15
      }));

      const off = addExcelLetterhead(workbook, worksheet, visibleCols.length);
      const headerRowNum = off + 1;
      const headerRow = worksheet.getRow(headerRowNum);
      visibleCols.forEach((col, i) => { headerRow.getCell(i + 1).value = col.label; });

      // Add rows
      filteredSortedData.forEach(row => {
        const dataRow = {};
        visibleCols.forEach(col => {
          if (col.key === "estado_nomina") dataRow[col.key] = getEstadoNominaDisplay(row);
          else if (col.key === "partida") dataRow[col.key] = mapPartida(row[col.key], row.posicion);
          else if (col.key === "tipo_de_contratacion") dataRow[col.key] = mapTipoContratacion(row[col.key]);
          else if (col.key === "rango") dataRow[col.key] = displayRango(row[col.key], row.tipo_de_personal_sedena_semar);
          else dataRow[col.key] = row[col.key];
        });
        worksheet.addRow(dataRow);
      });

      // Header styling
      headerRow.height = 24;
      headerRow.eachCell(cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2B4C7E" } // Navy Blue
        };
        cell.font = {
          name: "Segoe UI",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFBC955C" } },
          left: { style: "thin", color: { argb: "FFBC955C" } },
          bottom: { style: "thin", color: { argb: "FFBC955C" } },
          right: { style: "thin", color: { argb: "FFBC955C" } }
        };
      });

      // Data rows styling
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNum) return; // skip membretado + header
        row.height = 20;
        const isZebra = rowNumber % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = {
            name: "Segoe UI",
            size: 9
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFBC955C" } },
            left: { style: "thin", color: { argb: "FFBC955C" } },
            bottom: { style: "thin", color: { argb: "FFBC955C" } },
            right: { style: "thin", color: { argb: "FFBC955C" } }
          };
          if (isZebra) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF4F7FA" } // Zebra background
            };
          }

          const colKey = visibleCols[colNumber - 1]?.key;
          if (isMonoColumn(colKey)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // Auto-fit columns (se ignora el membretado: son celdas combinadas con
      // texto largo que inflaría el ancho de todas las columnas)
      worksheet.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
          if (rowNumber <= off) return;
          const val = cell.value ? String(cell.value) : "";
          maxLen = Math.max(maxLen, val.length);
        });
        column.width = Math.max(maxLen + 4, 12);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Plantilla_Empleados_Activos.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error al exportar a Excel: " + error.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Botón "Exportar a Excel": si el usuario tiene permiso de ver fotografía
  // en este tab, se le ofrece elegir incluirlas (modal) antes de exportar;
  // si no tiene el permiso, exporta directo como siempre (sin fotos, 100%
  // client-side vía handleExportExcel, sin cambios).
  const handleOpenExportClick = () => {
    if (canViewFotoDetalle) {
      setIsExportFotosModalOpen(true);
    } else {
      handleExportExcel();
    }
  };

  const handleConfirmExportConFotos = async (incluirFotos) => {
    if (!incluirFotos) {
      setIsExportFotosModalOpen(false);
      handleExportExcel();
      return;
    }
    const controller = new AbortController();
    exportConFotosAbortRef.current = controller;
    setIsExportingConFotos(true);
    try {
      const visibleCols = dataColumns.filter(c => c.visible);
      const posiciones = filteredSortedData.map(row => row.posicion);
      const res = await VacantesService.exportarPlantillaDetalleConFotos(
        {
          posiciones,
          columnas: visibleCols.map(c => ({ key: c.key, label: c.label })),
          incluirFotos: true,
        },
        { signal: controller.signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Error al generar el Excel con fotografías.");
      }
      // La extensión depende de si el backend incluyó la macro VBA
      // (VBA_HABILITADO en excel_fotos.py) — se lee de Content-Type en vez
      // de Content-Disposition porque ese último no siempre es legible
      // desde JS en peticiones cross-origin sin CORS_EXPOSE_HEADERS.
      const extension = res.headers.get("Content-Type")?.includes("macroEnabled") ? "xlsm" : "xlsx";
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Plantilla_Empleados_ConFotos.${extension}`;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsExportFotosModalOpen(false);
    } catch (err) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Error al generar el Excel con fotografías.");
      }
    } finally {
      setIsExportingConFotos(false);
      exportConFotosAbortRef.current = null;
    }
  };

  const handleCancelExportConFotos = () => {
    exportConFotosAbortRef.current?.abort();
  };

  const donutData = useMemo(() => {
    const total = resumen?.total_registros || 11957;
    const slices = [
      { label: "Activo", count: resumen?.Activo || 9421, color: STATUS_COLORS["Activo"] },
      { label: "Vacante", count: resumen?.Vacante || 2482, color: STATUS_COLORS["Vacante"] },
      { label: "Suspendido", count: resumen?.Suspendido || 23, color: STATUS_COLORS["Suspendido"] },
      { label: "Permiso Retribuido", count: resumen?.Licencia_Medica || 27, color: STATUS_COLORS["Permiso Retribuido"] },
      { label: "Permiso", count: resumen?.Licencia || 4, color: STATUS_COLORS["Permiso"] }
    ];
    let cumulativePercent = 0;
    return slices.map(slice => {
      const percent = slice.count / total, startPercent = cumulativePercent;
      cumulativePercent += percent;
      const endPercent = cumulativePercent;
      const getCoords = (p) => { const angle = 2 * Math.PI * p - Math.PI / 2; return [Math.cos(angle), Math.sin(angle)]; };
      const [startX, startY] = getCoords(startPercent), [endX, endY] = getCoords(endPercent);
      const largeArc = percent > 0.5 ? 1 : 0;
      return { ...slice, percent, pathData: `M ${startX.toFixed(8)} ${startY.toFixed(8)} A 1 1 0 ${largeArc} 1 ${endX.toFixed(8)} ${endY.toFixed(8)} L 0 0 Z` };
    });
  }, [resumen]);

  const activeHoverData = hoveredSlice !== null ? donutData[hoveredSlice] : null;
  const activeStatusFilter = columnFilters["estado_nomina"] || [];

  // Badge de estado para la vista de tarjetas en móvil (mismo lenguaje visual que la celda).
  const renderEstadoBadge = useCallback((row) => {
    const est = getEstadoNominaDisplay(row);
    const Icon = STATUS_ICONS[est] || UserCheck;
    const badge = STATUS_BADGE_STYLES[est] || { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] font-black uppercase ${badge.bg} ${badge.text} ${badge.border}`}>
        <Icon className="size-3" />{est}
      </span>
    );
  }, []);

  // Config de la tarjeta móvil para Plantilla Detalle (qué campos muestra cada fila).
  // `fields` se deriva de `columns` (mismo estado que controla el botón "Columnas" /
  // ColumnsModal): así, activar una columna ahí la agrega también a la tarjeta móvil,
  // sin mantener una lista separada. posicion/nombres/estado_nomina se excluyen porque
  // ya se muestran como título/subtítulo/badge.
  const MOBILE_CARD_EXCLUDED_KEYS = useMemo(() => new Set(["posicion", "nombres", "estado_nomina"]), []);
  const MOBILE_CARD_CURRENCY_KEYS = useMemo(() => CURRENCY_KEYS, []);
  const mobileCardConfig = useMemo(() => ({
    getRowId: (row, i) => row.id ?? row.posicion ?? i,
    getTitle: (row) => (row.nombres && String(row.nombres).trim()) ? row.nombres : "Vacante",
    getSubtitle: (row) => (row.posicion ? `POS ${row.posicion}` : ""),
    renderBadge: renderEstadoBadge,
    fields: dataColumns
      .filter((col) => col.visible && !MOBILE_CARD_EXCLUDED_KEYS.has(col.key))
      .map((col) => ({
        key: col.key,
        label: col.label,
        mono: isMonoColumn(col.key),
        ...(MOBILE_CARD_CURRENCY_KEYS.has(col.key) ? {
          render: (row) => {
            const n = Number(row[col.key]);
            return isNaN(n) ? row[col.key] : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
          },
        } : {}),
      })),
  }), [dataColumns, renderEstadoBadge, isMonoColumn, MOBILE_CARD_EXCLUDED_KEYS, MOBILE_CARD_CURRENCY_KEYS]);

  // Auto-scroll when navigating with keyboard
  useEffect(() => {
    if (!selectedCell || !tableContainerRef.current) return;
    
    const { row, col } = selectedCell;
    const container = tableContainerRef.current;
    
    // Vertical scroll logic
    const rowHeight = 37; // based on h-[37px]
    const headerHeight = 36; // approximate header height
    const rowTop = row * rowHeight;
    const rowBottom = rowTop + rowHeight;
    
    // Check if row is out of view (vertically)
    // Add a small offset (like 2 rows) to scroll eagerly
    if (rowTop < container.scrollTop + headerHeight) {
      container.scrollTop = rowTop - headerHeight;
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = rowBottom - container.clientHeight + headerHeight;
    }
    
    // Horizontal scroll logic
    const visibleCols = tableColumns.filter(c => c.visible);
    if (!visibleCols[col]) return;
    
    const fixedWidth = 95; // # (50) + VER (45)
    let frozenWidth = fixedWidth;
    if (visibleCols.length > 0) frozenWidth += visibleCols[0].width || 120;
    if (visibleCols.length > 1) frozenWidth += visibleCols[1].width || 120;
    
    let colLeft = fixedWidth;
    for (let i = 0; i < col; i++) {
      colLeft += visibleCols[i].width || 120;
    }
    const colRight = colLeft + (visibleCols[col].width || 120);
    
    if (col >= 2) {
      if (colLeft < container.scrollLeft + frozenWidth) {
        container.scrollLeft = colLeft - frozenWidth - 20;
      } else if (colRight > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = colRight - container.clientWidth + 20;
      }
    } else {
      if (container.scrollLeft > 0) {
        container.scrollLeft = 0;
      }
    }
  }, [selectedCell, tableColumns]);


  return (
    <div className="w-full flex flex-col">
      {/* Indicador flotante: movimientos capturados hoy (fecha_captura = hoy en cp_tbl_mov_completo_29_05_26) */}
      <button
        type="button"
        onClick={() => setIsMovimientosHoyModalOpen(true)}
        title="Ver resumen de movimientos de hoy"
        className="fixed top-36 sm:top-48 right-4 md:right-8 z-30 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm shadow-md hover:shadow-lg hover:border-[#621f32]/30 dark:hover:border-[#bc955c]/30 active:scale-95 transition-all cursor-pointer"
      >
        <div className="relative shrink-0 flex items-center justify-center size-8 rounded-xl bg-[#621f32]/8 dark:bg-[#621f32]/20 text-[#621f32] dark:text-[#bc955c]">
          <ArrowUpDown className="size-4" />
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[9px] font-black leading-none shadow-sm ring-2 ring-white dark:ring-slate-950">
            {movimientosHoyCount > 99 ? "99+" : movimientosHoyCount}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase leading-tight text-slate-600 dark:text-slate-300 max-w-[130px] text-left">
          Movimientos realizados por dirección operativa
        </span>
      </button>

      <ModalShell
        open={isMovimientosHoyModalOpen}
        // Con el detalle de empleado encima, Escape solo debe cerrar ese modal:
        // ambos escuchan la tecla a nivel documento.
        onClose={() => { if (!movHoyTimelineOpen) setIsMovimientosHoyModalOpen(false); }}
        size="xl"
        resizable
        minWidth={900}
        maxWidth={1500}
        icon={ArrowUpDown}
        eyebrow="Cp Tbl Mov Completo"
        title="Movimientos realizados hoy"
        subtitle={`${formatDateEsMx(fechaHoy)} — ${accionHoyPie.total} movimiento${accionHoyPie.total === 1 ? "" : "s"} por dirección operativa`}
      >
        <div className="flex flex-col gap-4 w-full">
          {/* Pequeño resumen: total del día + distintas, sin las tarjetas grandes ni la gráfica */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#621f32]/8 dark:bg-[#bc955c]/10 text-[#621f32] dark:text-[#bc955c]">
                <Briefcase className="size-3.5" />
              </div>
              <span className="text-lg font-black text-slate-800 dark:text-white leading-none">{formatNumber(accionHoyPie.total)}</span>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">movimiento{accionHoyPie.total === 1 ? "" : "s"} hoy</span>
            </div>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {accionHoyStats.length} acci{accionHoyStats.length === 1 ? "ón" : "ones"} distinta{accionHoyStats.length === 1 ? "" : "s"}
            </span>
            {selectedAccionHoy && (
              <>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
                <span className="text-[10px] font-bold text-[#bc955c]">
                  {motivoHoyStats.length} motivo{motivoHoyStats.length === 1 ? "" : "s"} en "{selectedAccionHoy}"
                </span>
              </>
            )}
            {selectedMotivoHoy && (
              <>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
                <span className="text-[10px] font-bold text-[#621f32] dark:text-[#bc955c]">
                  {movimientosHoyDetalleLoading ? "Cargando…" : `${movimientosHoyDetalle.length} movimiento${movimientosHoyDetalle.length === 1 ? "" : "s"} de "${selectedMotivoHoy}"`}
                </span>
              </>
            )}
          </div>

          {/* Lista de acciones (sin cuadros grandes ni gráfica de pastel) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Acciones</span>
            {accionHoyStatsLoading ? (
              <div className="flex flex-col gap-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 dark:bg-slate-900/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : accionHoyPie.slices.length > 0 ? (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                {accionHoyPie.slices.map((slice) => (
                  <button
                    key={slice.name}
                    type="button"
                    onClick={() => setSelectedAccionHoy(selectedAccionHoy === slice.name ? null : slice.name)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      selectedAccionHoy === slice.name ? "bg-[#621f32]/8 dark:bg-[#bc955c]/10" : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    }`}
                  >
                    <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                    <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{slice.name}</span>
                    <span className="text-xs font-black text-slate-500 shrink-0">
                      {formatNumber(slice.total)}<span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                    </span>
                    <ChevronRightIcon className={`size-3.5 shrink-0 transition-transform ${selectedAccionHoy === slice.name ? "rotate-90 text-[#621f32] dark:text-[#bc955c]" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Sin movimientos capturados hoy.</span>
              </div>
            )}
          </div>

          {/* Desglose de motivos de la acción seleccionada */}
          <AnimatePresence>
            {selectedAccionHoy && (
              <motion.div
                key="motivo-hoy-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-1.5 overflow-hidden"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#bc955c] dark:text-[#d4a96a] truncate" title={`Motivos de ${selectedAccionHoy}`}>
                    Motivos de {selectedAccionHoy}
                  </span>
                  <button
                    onClick={() => setSelectedAccionHoy(null)}
                    className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Cerrar desglose de motivos"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {motivoHoyStatsLoading ? (
                  <div className="flex flex-col gap-1.5">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 bg-slate-100 dark:bg-slate-900/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : motivoHoyPie.slices.length > 0 ? (
                  <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    {motivoHoyPie.slices.map((slice) => (
                      <button
                        key={slice.name}
                        type="button"
                        onClick={() => setSelectedMotivoHoy(selectedMotivoHoy === slice.name ? null : slice.name)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                          selectedMotivoHoy === slice.name ? "bg-[#bc955c]/10 dark:bg-[#bc955c]/15" : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        }`}
                      >
                        <span className="shrink-0 size-2.5 rounded-full" style={{ background: slice.color }} />
                        <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{slice.name}</span>
                        <span className="text-xs font-black text-slate-500 shrink-0">
                          {formatNumber(slice.total)}<span className="text-slate-400 font-normal ml-0.5">({slice.pct}%)</span>
                        </span>
                        <ChevronRightIcon className={`size-3.5 shrink-0 transition-transform ${selectedMotivoHoy === slice.name ? "rotate-90 text-[#bc955c]" : "text-slate-300"}`} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">Sin motivos para esta acción hoy.</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabla de detalle: movimientos reales del cruce acción + motivo seleccionado */}
          <AnimatePresence>
            {selectedMotivoHoy && (
              <motion.div
                key="motivo-hoy-tabla"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-1.5 overflow-hidden"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 truncate">
                  Movimientos: {selectedAccionHoy} / {selectedMotivoHoy}
                </span>
                <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60" style={{ height: movHoyTableHeight }}>
                  <DataTable
                    containerRef={movHoyTableContainerRef}
                    fillHeight
                    fillWidth
                    edgeToEdge
                    stickyColumnKeys={["posicion"]}
                    onScroll={() => {}}
                    columns={movHoyColumns}
                    columnFilters={movHoyColumnFilters}
                    setColumnFilters={setMovHoyColumnFilters}
                    textFilters={movHoyTextFilters}
                    setTextFilters={setMovHoyTextFilters}
                    activeConditionDropdown={movHoyActiveConditionDropdown}
                    setActiveConditionDropdown={setMovHoyActiveConditionDropdown}
                    selectedCell={movHoySelectedCell}
                    onSelectCell={setMovHoySelectedCell}
                    onCellContextMenu={(e, value, rect) => setMovHoyContextMenu({ x: e.clientX, y: e.clientY, value, rect })}
                    onShowRecord={(row) => setMovHoySelectedRecord({ ...row, nombre: buildMovHoyFullName(row) })}
                    sortConfig={movHoySortConfig}
                    onSort={handleMovHoySort}
                    onOpenFilter={openMovHoyFilterDropdown}
                    onResizeStart={handleMovHoyResizeStart}
                    getColumnLetter={getColumnLetterMovHoy}
                    isMonoColumn={isMonoColumnMovHoy}
                    isPending={false}
                    isLoading={movimientosHoyDetalleLoading}
                    loadingVariant="skeleton"
                    loadingMessage="Consultando movimientos..."
                    data={movHoyProcessedRows}
                    startIndex={0}
                    endIndex={movHoyProcessedRows.length}
                    totalCount={movHoyProcessedRows.length}
                    rowHeight={37}
                    getRowId={(row, i) => `${row.num_empleado ?? ""}-${row.posicion ?? ""}-${row.sec ?? i}`}
                    renderCell={renderMovHoyCell}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ModalShell>

      {/* Detalle de Empleado desde la columna "No. Empleado" del modal de hoy —
          z por encima del ModalShell (z-[1000]) para que no quede debajo. */}
      <EmpleadoTimelineModal
        open={movHoyTimelineOpen}
        onOpenChange={setMovHoyTimelineOpen}
        numEmpleado={movHoyTimelineNumEmpleado}
        zIndexClass="z-[1100]"
      />

      <div className="w-full px-4 lg:px-6">
        <Zoom triggerOnce>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch">
            <div className="lg:col-span-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/80 shadow-md flex flex-col items-center justify-center min-h-[180px]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-3 w-full text-center">Distribución de Estatus</h3>
              <div className="relative size-28 flex items-center justify-center">
                <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90 select-none"><defs><mask id="donut-mask-detalle"><circle cx="0" cy="0" r="1" fill="white" /><circle cx="0" cy="0" r="0.65" fill="black" /></mask></defs><g mask="url(#donut-mask-detalle)">{donutData.map((slice, i) => (<path key={slice.label} d={slice.pathData} fill={slice.color} className="cursor-pointer transition-all duration-300 origin-center hover:opacity-90" style={{ transform: hoveredSlice === i ? "scale(1.04)" : "scale(1.0)", opacity: activeStatusFilter.length > 0 && !activeStatusFilter.includes(slice.label) ? 0.35 : 1 }} onMouseEnter={() => setHoveredSlice(i)} onMouseLeave={() => setHoveredSlice(null)} onClick={() => handleStatusFilter(slice.label)} />))}</g></svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center flex-col p-1"><AnimatePresence mode="wait">{activeHoverData ? (<motion.div key={activeHoverData.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}><span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[80px]">{activeHoverData.label}</span><br /><span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">{formatNumber(activeHoverData.count)}</span><br /><span className="text-[8px] font-extrabold px-2 py-0.5 rounded-full mt-1 border border-current" style={{ color: activeHoverData.color, backgroundColor: `${activeHoverData.color}15` }}>{(activeHoverData.percent * 100).toFixed(1)}%</span></motion.div>) : (<motion.div key="total" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}><span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total</span><br /><span className="text-xl font-black text-gray-800 dark:text-white leading-none mt-0.5">{formatNumber(resumen?.total_registros || 11957)}</span><br /><span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full">100%</span></motion.div>)}</AnimatePresence></div>
              </div>
            </div>
            <div className="lg:col-span-9 grid grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-3">{donutData.map((slice, index) => { const IconComponent = STATUS_ICONS[slice.label] || Users; const isActiveFilter = activeStatusFilter.includes(slice.label); return (<motion.div key={slice.label} onMouseEnter={() => setHoveredSlice(index)} onMouseLeave={() => setHoveredSlice(null)} onClick={() => handleStatusFilter(slice.label)} whileHover={{ scale: 1.03, y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className={`rounded-xl px-3 py-3 border-2 transition-all duration-200 shadow-sm flex flex-col justify-between group cursor-pointer relative overflow-hidden ${isActiveFilter ? "border-[#621f32] dark:border-[#bc955c] shadow-md bg-white dark:bg-slate-900" : activeStatusFilter.length > 0 ? "border-slate-200/50 dark:border-slate-800/80 opacity-55 hover:opacity-85 bg-white/60 dark:bg-slate-900/60" : hoveredSlice === index ? "border-[#621f32]/40 dark:border-[#bc955c]/40 shadow-md bg-white dark:bg-slate-900" : "border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60"}`}><div className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-200 pointer-events-none" style={{ backgroundColor: slice.color }} />{isActiveFilter && (<div className="absolute top-2 right-2 z-20"><span className="relative flex size-1.5 rounded-full" style={{ backgroundColor: slice.color }}><span className="animate-ping absolute inline-flex size-1.5 rounded-full opacity-75" style={{ backgroundColor: slice.color }} /></span></div>)}<div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${slice.color}15`, color: slice.color }}><IconComponent className="size-3.5" /></div><span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500 truncate">{slice.label}</span></div><div><h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{formatNumber(slice.count)}</h4><div className="w-full bg-slate-100 dark:bg-slate-800/60 h-1 rounded-full overflow-hidden mt-2"><motion.div className="h-full rounded-full" style={{ backgroundColor: slice.color }} initial={{ width: 0 }} animate={{ width: `${slice.percent * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} /></div><p className="text-[8px] font-bold text-slate-400 mt-1">{(slice.percent * 100).toFixed(1)}%</p></div></motion.div>); })}<motion.div whileHover={{ scale: 1.03, y: -2 }} onClick={() => { startTransition(() => setColumnFilters({})); }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className={`bg-gradient-to-br from-[#621f32] via-[#4d1827] to-[#bc955c] rounded-xl px-3 py-3 shadow-md flex flex-col justify-between text-white relative overflow-hidden group cursor-pointer transition-all duration-200 ${activeStatusFilter.length === 0 ? "ring-2 ring-white/30 shadow-lg" : ""}`}><div className="absolute -top-8 -right-8 size-24 bg-[#bc955c]/15 rounded-full blur-xl group-hover:bg-[#bc955c]/25 transition-colors duration-300 pointer-events-none" /><div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-white/10 text-white rounded-lg flex items-center justify-center flex-shrink-0"><Briefcase className="size-3.5" /></div><span className="text-[9px] font-black uppercase tracking-wider text-white/70 truncate">Posiciones Totales</span></div><div><h4 className="text-xl font-black tracking-tight text-white leading-none">{formatNumber(resumen?.total_registros || 11957)}</h4><div className="w-full bg-white/15 h-1 rounded-full overflow-hidden mt-2"><div className="h-full bg-white/60 rounded-full w-full" /></div><p className="text-[8px] font-bold text-white/60 mt-1">100%</p></div></motion.div></div>
          </div>
        </Zoom>
      </div>

      <div className="w-full flex justify-center mt-4">
        <div ref={cardRef} className="bg-white/15 dark:bg-slate-950/20 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 shadow-2xl h-fit flex flex-col z-30 overflow-hidden w-full md:max-h-[calc(100vh-var(--stack-h))] md:sticky md:bottom-0 md:scroll-mt-[var(--stack-h)]" style={{ width: cardWidth ? `${cardWidth}px` : '100%', maxWidth: cardWidth ? 'none' : '100%' }}>
          {/* Toolbar móvil (búsqueda + Excel + Drawer de herramientas) */}
          <MobileTableToolbar
            searchValue={searchQuery}
            onSearch={(v) => { setSearchQuery(v); startTransition(() => setGlobalSearch(v)); }}
            count={filteredSortedData.length}
            primaryAction={{ icon: Download, label: "Exportar a Excel", onClick: handleOpenExportClick, loading: isExportingExcel }}
            actions={[
              { icon: RotateCcw, label: "Restablecer filtros", onClick: resetAllFilters, disabled: Object.keys(columnFilters).length === 0 && !globalSearch && !sortConfig.key && !Object.values(textFilters).some(v => v && v.value) && appliedAdvancedFilters.length === 0 },
              { icon: Filter, label: "Filtros avanzados", onClick: () => setIsAdvancedFiltersOpen(true), badge: appliedAdvancedFilters.length },
              { icon: Network, label: "Cadena de Mando", onClick: () => setIsCadenaModalOpen(true) },
              { icon: Columns, label: "Columnas", onClick: () => setIsColumnsModalOpen(true) },
              { icon: History, label: "Historial de Cambios", onClick: openHistorialModal, badge: remoteUpdatesCount },
            ]}
            chips={activeStatusFilter.map(status => (
              <button key={status} onClick={() => handleStatusFilter(status)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border active:scale-95 transition-transform" style={{ backgroundColor: `${STATUS_COLORS[status]}12`, color: STATUS_COLORS[status], borderColor: `${STATUS_COLORS[status]}30` }}>
                {STATUS_ICONS[status] && React.createElement(STATUS_ICONS[status], { className: "size-3" })}
                <span>{status}</span><X className="size-3" />
              </button>
            ))}
          />

          <div className="hidden md:flex p-6 border-b border-slate-200/50 dark:border-slate-800/80 flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch sm:items-center">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-80 flex items-center pr-3 pl-4 py-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 focus-within:ring-2 focus-within:ring-[#621f32]/10 rounded-2xl transition-all shadow-sm">
                  <Search className="text-slate-400 size-4 mr-2.5" />
                  <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); startTransition(() => setGlobalSearch(e.target.value)); }} placeholder="Buscar..." className="bg-transparent text-slate-800 text-xs font-bold w-full outline-none" />
                  {searchQuery && <button onClick={() => { setSearchQuery(""); startTransition(() => setGlobalSearch("")); }} className="text-slate-400 hover:text-slate-600 ml-1.5"><X className="size-3.5" /></button>}
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center px-4 py-2 bg-[#621f32]/5 dark:bg-[#bc955c]/10 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-2xl min-w-[100px]">
                  <span className="text-[9px] font-black uppercase text-slate-500 leading-none mb-1">Registros</span>
                  <span className="text-sm font-black text-[#621f32] dark:text-[#bc955c] leading-none">{formatNumber(filteredSortedData.length)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">{activeStatusFilter.map(status => (<button key={status} onClick={() => handleStatusFilter(status)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm transition-all hover:opacity-80 active:scale-95 cursor-pointer" style={{ backgroundColor: `${STATUS_COLORS[status]}12`, color: STATUS_COLORS[status], borderColor: `${STATUS_COLORS[status]}30` }}>{STATUS_ICONS[status] && React.createElement(STATUS_ICONS[status], { className: "size-3" })}<span>{status}</span><X className="size-3" /></button>))}</div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {selectedCell && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 py-2 px-3.5 bg-[#621f32]/5 dark:bg-[#bc955c]/5 border border-[#621f32]/10 dark:border-[#bc955c]/20 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 group">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[#621f32] dark:text-[#bc955c] flex-shrink-0">{getColumnLetter(selectedCell.col)}{selectedCell.row + 1}</span>
                      <span className="hidden md:inline whitespace-nowrap">Col: <strong className="text-slate-700 dark:text-slate-200">{tableColumns.filter(c => c.visible)[selectedCell.col]?.label}</strong></span>
                      <span className="opacity-30 hidden md:inline">|</span>
                      <span className="max-w-[150px] sm:max-w-[300px] lg:max-w-[450px] truncate">Val: <strong className="text-slate-700 dark:text-slate-200">{(() => { const v = filteredSortedData[selectedCell.row]?.[tableColumns.filter(c => c.visible)[selectedCell.col]?.key]; if (!v) return "-"; if (tableColumns.filter(c => c.visible)[selectedCell.col]?.key === "estado_nomina") return mapEstadoNomina(v); return String(v); })()}</strong></span>
                      <button onClick={() => setIsCellModalOpen(true)} className="ml-1 p-1 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] rounded-md shadow-sm hover:opacity-90 active:scale-95 transition-all flex-shrink-0" title="Ver detalle completo"><ChevronRightIcon className="size-3" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={resetAllFilters} disabled={Object.keys(columnFilters).length === 0 && !globalSearch && !sortConfig.key && !Object.values(textFilters).some(v => v && v.value) && appliedAdvancedFilters.length === 0} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200/60 dark:border-slate-800/80 hover:border-red-200/80 dark:hover:border-red-950/50 bg-white/80 dark:bg-slate-900/85 hover:bg-red-50/50 dark:hover:bg-red-950/15 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 font-black rounded-2xl text-[10px] uppercase transition-all duration-300 shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"><RotateCcw className="size-3.5" /><span>Restablecer Filtros</span></button>
              <AdvancedFiltersButton onClick={() => setIsAdvancedFiltersOpen(true)} appliedCount={appliedAdvancedFilters.length} />
              <button onClick={() => setIsCadenaModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 to-white dark:from-slate-900 dark:to-slate-950 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer flex-shrink-0"><Network className="size-3.5" /><span>Cadena de Mando</span></button>
              <button onClick={openHistorialModal} title={remoteUpdatesCount > 0 ? `${remoteUpdatesCount} cambio${remoteUpdatesCount === 1 ? "" : "s"} de otros usuarios sin ver` : "Ver historial de cambios de la tabla"} className="relative flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer flex-shrink-0">
                <History className="size-3.5" />
                <span>Historial de Cambios</span>
                {remoteUpdatesCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[9px] font-black leading-none shadow-sm ring-2 ring-white dark:ring-slate-950 animate-pulse">
                    {remoteUpdatesCount > 99 ? "99+" : remoteUpdatesCount}
                  </span>
                )}
              </button>
              <button onClick={() => setIsColumnsModalOpen(true)} className="flex items-center gap-2 px-5 py-3.5 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 text-[#621f32] dark:text-[#bc955c] font-black rounded-2xl text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"><Columns className="size-3.5" /><span>Columnas</span></button>
              <button
                onClick={handleOpenExportClick}
                disabled={isExportingExcel}
                className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] font-black rounded-2xl text-[10px] uppercase transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 disabled:opacity-75 disabled:pointer-events-none"
              >
                {isExportingExcel ? (
                  <div className="size-3.5 border-2 border-white/20 border-t-white dark:border-[#3e131f]/20 dark:border-t-[#3e131f] rounded-full animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span>{isExportingExcel ? "Cargando..." : "Excel"}</span>
              </button>
            </div>
          </div>

          {/* 7.2 QA: chips de filtros activos — antes el único indicio era el
              punto blanco del header y había hasta 4 mecanismos de filtro
              (tarjeta, global, columna, avanzados) invisibles entre sí. */}
          {(globalSearch || Object.keys(columnFilters).length > 0 || Object.values(textFilters).some(v => v?.value) || appliedAdvancedFilters.length > 0) && (
            <div className="hidden md:flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest shrink-0">Filtros activos:</span>
              {globalSearch && (
                <button onClick={() => { setSearchQuery(""); setGlobalSearch(""); }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer">
                  <Search className="size-2.5" /><span>Búsqueda: "{globalSearch}"</span><X className="size-2.5" />
                </button>
              )}
              {Object.entries(columnFilters).map(([colKey, values]) => (
                <button key={`cf-${colKey}`} onClick={() => setColumnFilters(prev => { const next = { ...prev }; delete next[colKey]; return next; })} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer">
                  <span>{columns.find(c => c.key === colKey)?.label || colKey}: {values.length} valor{values.length === 1 ? "" : "es"}</span><X className="size-2.5" />
                </button>
              ))}
              {Object.entries(textFilters).filter(([, f]) => f?.value).map(([colKey, f]) => (
                <button key={`tf-${colKey}`} onClick={() => setTextFilters(prev => { const next = { ...prev }; delete next[colKey]; return next; })} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer">
                  <span>{columns.find(c => c.key === colKey)?.label || colKey} {getConditionLabel(f.condition)}: "{f.value}"</span><X className="size-2.5" />
                </button>
              ))}
              {appliedAdvancedFilters.length > 0 && (
                <button onClick={resetAdvancedFilters} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer">
                  <Filter className="size-2.5" /><span>{appliedAdvancedFilters.length} filtro{appliedAdvancedFilters.length === 1 ? "" : "s"} avanzado{appliedAdvancedFilters.length === 1 ? "" : "s"}</span><X className="size-2.5" />
                </button>
              )}
            </div>
          )}

          {/* Tabla densa estilo Excel: sólo desktop */}
          <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
          <DataTable
            containerRef={tableContainerRef}
            tbodyRef={tbodyRef}
            onScroll={setScrollTop}
            columns={tableColumns}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            textFilters={textFilters}
            setTextFilters={setTextFilters}
            activeConditionDropdown={activeConditionDropdown}
            setActiveConditionDropdown={setActiveConditionDropdown}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            onCellContextMenu={handleCellContextMenu}
            onCellDoubleClick={handleCellDoubleClick}
            onShowRecord={setSelectedRowData}
            sortConfig={sortConfig}
            onSort={handleSort}
            onOpenFilter={openFilterDropdown}
            onResizeStart={handleMouseDown}
            getColumnLetter={getColumnLetter}
            isMonoColumn={isMonoColumn}
            isPending={isPending}
            isLoading={isLoading}
            loadingMessage="Cargando plantilla (11,955 registros)..."
            data={paginatedData}
            startIndex={startIndex}
            endIndex={endIndex}
            totalCount={filteredSortedData.length}
            rowHeight={rowHeight}
            renderCell={renderCell}
          />
          </div>

          {/* Vista de tarjetas: sólo móvil */}
          <div className="md:hidden">
            <MobileCardList
              data={filteredSortedData}
              config={mobileCardConfig}
              onCardClick={(row) => setSelectedRowData(row)}
              isLoading={isLoading}
              isPending={isPending}
            />
          </div>

          <div className="hidden md:block absolute top-0 right-0 h-full w-2.5 cursor-col-resize z-30" onMouseDown={handleCardResizeMouseDown} />
        </div>
      </div>

      {mounted && createPortal(
        <>
        <ColumnsModal
          open={isColumnsModalOpen}
          columns={tableColumns}
          onToggle={toggleColumnVisibility}
          onShowAll={() => startTransition(() => setColumns(prev => prev.map(c => ({ ...c, visible: true }))))}
          onHideAll={() => startTransition(() => setColumns(prev => prev.map(c => ({ ...c, visible: false }))))}
          onClose={() => setIsColumnsModalOpen(false)}
        />

      <AnimatePresence>
        {isCadenaModalOpen && (
          <div key="cadena-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCadenaModalOpen(false)} className="fixed inset-0 bg-slate-950/70 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col z-[100] overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 sticky top-0">
                <div className="flex items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-[#621f32] to-[#802842] dark:from-[#bc955c] dark:to-[#d0ab75] text-white dark:text-[#3e131f] rounded-2xl shadow-lg shadow-[#621f32]/20 dark:shadow-[#bc955c]/20">
                      <Network className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Cadena de Mando</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Explorador de jerarquía operativa</p>
                    </div>
                  </div>
                  <button onClick={() => setIsCadenaModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-all active:scale-95"><X className="size-5" /></button>
                </div>
                
                <form onSubmit={handleBuscarCadena} className="relative flex items-center bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] rounded-[1.2rem] px-4 py-3 shadow-sm transition-all">
                  <Search className="size-5 text-slate-400 mr-3" />
                  <input 
                    type="text" 
                    value={cadenaQuery} 
                    onChange={(e) => {
                      setCadenaQuery(e.target.value);
                      setShowCadenaSuggestions(true);
                      setCadenaError(null);
                    }} 
                    onFocus={() => setShowCadenaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCadenaSuggestions(false), 200)}
                    placeholder="Buscar por Número de Posición, Nombre o Num Empleado..." 
                    className="bg-transparent text-sm sm:text-base w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400" 
                  />
                  <button type="submit" disabled={isCadenaLoading || !cadenaQuery.trim()} className="ml-2 px-5 py-2.5 bg-[#621f32] dark:bg-[#bc955c] hover:bg-[#802842] dark:hover:bg-[#d0ab75] text-white dark:text-[#3e131f] text-xs font-black uppercase rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                    {isCadenaLoading ? "Buscando..." : "Buscar"}
                  </button>

                  {/* Sugerencias Autocomplete */}
                  <AnimatePresence>
                    {showCadenaSuggestions && cadenaSuggestions.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        {cadenaSuggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const label = sug.posicion
                                ? (sug.nombres?.trim() ? `${sug.posicion} - ${sug.nombres.trim()}` : sug.posicion)
                                : sug.numempleado;
                              setCadenaQuery(label);
                              handleBuscarCadena(null, cadenaDirection, label);
                            }}
                            className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col transition-colors group"
                          >
                            <span className="font-black text-sm text-slate-800 dark:text-slate-200 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors">{sug.nombres}</span>
                            <span className="text-xs text-slate-500 font-bold mt-0.5">
                              POS: <span className="text-slate-700 dark:text-slate-400">{sug.posicion}</span> 
                              {sug.numempleado && <span className="ml-3 border-l border-slate-300 dark:border-slate-700 pl-3">NUM EMP: <span className="text-slate-700 dark:text-slate-400">{sug.numempleado}</span></span>}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

                {/* 8.5 QA: toggle Ascendente/Descendente */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => handleToggleCadenaDirection("arriba")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${cadenaDirection === "arriba" ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] shadow-sm" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c]"}`}
                  >
                    <ArrowUp className="size-3" /><span>Ascendente (jefes)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCadenaDirection("abajo")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${cadenaDirection === "abajo" ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] shadow-sm" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c]"}`}
                  >
                    <ArrowDown className="size-3" /><span>Descendente (subordinados)</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar relative">
                {isCadenaLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="size-12 border-4 border-[#621f32]/20 border-t-[#621f32] dark:border-[#bc955c]/20 dark:border-t-[#bc955c] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest animate-pulse">Rastreando jerarquía...</p>
                  </div>
                ) : cadenaError ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="size-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                      <UserX className="size-8" />
                    </div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">Sin resultados</h4>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-md">{cadenaError}</p>
                  </div>
                ) : cadenaDirection === "abajo" && cadenaDisplayRoot ? (
                  <div className="w-full max-w-4xl mx-auto py-4 px-2">
                    {/* Breadcrumb del drill-down (enfocar rama) */}
                    {cadenaBreadcrumb && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-4 px-1">
                        {cadenaBreadcrumb.map((n, idx) => {
                          const isLast = idx === cadenaBreadcrumb.length - 1;
                          return (
                            <React.Fragment key={n.Posicion}>
                              {idx > 0 && <ChevronRightIcon className="size-3 text-slate-400 shrink-0" />}
                              <button
                                type="button"
                                onClick={() => setCadenaFocusPos(idx === 0 ? null : n.Posicion)}
                                disabled={isLast}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors ${isLast ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f]" : "text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"}`}
                                title={isLast ? "Rama enfocada" : "Ir a este nivel"}
                              >
                                {(n.Empleado || "").trim() || `POS ${n.Posicion}`}
                              </button>
                            </React.Fragment>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setCadenaFocusPos(null)}
                          className="ml-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Quitar enfoque y volver a la raíz consultada"
                        >
                          <X className="size-3" /><span>Quitar enfoque</span>
                        </button>
                      </div>
                    )}

                    {/* Panel resumen: totales del subárbol mostrado */}
                    {cadenaStats && (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                          {[
                            { label: "Total", value: cadenaStats.directos + cadenaStats.indirectos, sub: "subordinados" },
                            { label: "Directos", value: cadenaStats.directos, sub: `${cadenaStats.ocupadasDir} ocup · ${cadenaStats.vacantesDir} vac` },
                            { label: "Indirectos", value: cadenaStats.indirectos, sub: `${cadenaStats.ocupadasInd} ocup · ${cadenaStats.vacantesInd} vac` },
                            { label: "Ocupadas", value: cadenaStats.ocupadasDir + cadenaStats.ocupadasInd, sub: "posiciones" },
                            { label: "Vacantes", value: cadenaStats.vacantesDir + cadenaStats.vacantesInd, sub: "posiciones" },
                            { label: "Profundidad", value: cadenaStats.profundidad, sub: cadenaStats.profundidad === 1 ? "nivel" : "niveles" },
                          ].map((tile) => (
                            <div key={tile.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{tile.label}</p>
                              <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{formatNumber(tile.value)}</p>
                              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate">{tile.sub}</p>
                            </div>
                          ))}
                        </div>

                        {/* Chips de estado (clic = filtrar) */}
                        {cadenaStats.estados.size > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-2 px-1">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">Estado:</span>
                            {[...cadenaStats.estados.entries()].sort((a, b) => b[1] - a[1]).map(([estado, count]) => {
                              const style = STATUS_BADGE_STYLES[estado] || STATUS_BADGE_STYLES["Vacante"];
                              const active = cadenaEstadoFilter.has(estado);
                              return (
                                <button
                                  key={estado}
                                  type="button"
                                  onClick={() => toggleCadenaEstadoFilter(estado)}
                                  className={`px-2.5 py-1 text-[10px] font-black rounded-full border transition-all cursor-pointer ${active ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] border-transparent shadow-sm" : `${style.bg} ${style.text} ${style.border} hover:shadow-sm`}`}
                                  title={active ? "Quitar filtro" : `Filtrar por ${estado}`}
                                >
                                  {estado === "Activo" ? "Ocupada" : estado} ×{count}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Posición activa/inactiva por MOV_POS (independiente del estado
                            del empleado) — clic filtra el árbol; ver isPosicionActiva. */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-2 px-1">
                          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">Posición (MOV_POS):</span>
                          {[
                            { key: "activa", label: "Activa", count: cadenaStats.posActivas, style: { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/50 dark:border-emerald-900/40" } },
                            { key: "inactiva", label: "Inactiva", count: cadenaStats.posInactivas, style: { bg: "bg-rose-50/60 dark:bg-rose-950/20", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200/60 dark:border-rose-900/40" } },
                          ].map(({ key, label, count, style }) => {
                            const active = cadenaPosActivaFilter.has(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => toggleCadenaPosActivaFilter(key)}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-full border transition-all cursor-pointer ${active ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] border-transparent shadow-sm" : `${style.bg} ${style.text} ${style.border} hover:shadow-sm`}`}
                                title={active ? "Quitar filtro" : `Ver solo posiciones ${label.toLowerCase()}s (clic para detalle)`}
                              >
                                {label} ×{formatNumber(count)}
                              </button>
                            );
                          })}
                        </div>

                        {/* Distribución de niveles: barras apiladas Directos/Indirectos.
                            Paleta validada (CVD + contraste) sobre blanco/#0f172a:
                            light #93304a/#b8823a · dark #d65f85/#b08a26. Clic en
                            fila = filtrar por ese nivel. */}
                        {cadenaNivelesChart && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 mb-2">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Distribución de niveles</p>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                  <span className="size-2 rounded-[2px] bg-[#93304a] dark:bg-[#d65f85]" />Directos
                                </span>
                                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                  <span className="size-2 rounded-[2px] bg-[#b8823a] dark:bg-[#b08a26]" />Indirectos
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                              {cadenaNivelesChart.rows.map(({ nivel, dir, ind, total }) => {
                                const active = cadenaNivelFilter.has(nivel);
                                const dimmed = cadenaNivelFilter.size > 0 && !active;
                                return (
                                  <Tooltip key={nivel}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => toggleCadenaNivelFilter(nivel)}
                                        className={`w-full flex items-center gap-2 py-0.5 px-1 rounded-lg transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${active ? "bg-slate-50 dark:bg-slate-800/60 ring-1 ring-[#621f32]/40 dark:ring-[#bc955c]/40" : ""} ${dimmed ? "opacity-40" : ""}`}
                                        title={active ? "Quitar filtro" : `Filtrar por nivel ${nivel}`}
                                      >
                                        <span className="shrink-0 w-16 text-right text-[10px] font-black font-mono text-slate-600 dark:text-slate-300 truncate">{nivel}</span>
                                        <span className="flex-1 flex items-center h-3.5 min-w-0">
                                          {dir > 0 && (
                                            <span
                                              className={`h-full bg-[#93304a] dark:bg-[#d65f85] ${ind === 0 ? "rounded-r-[4px]" : "mr-[2px]"}`}
                                              style={{ width: `${Math.max((dir / cadenaNivelesChart.maxTotal) * 100, 1.5)}%` }}
                                            />
                                          )}
                                          {ind > 0 && (
                                            <span
                                              className="h-full bg-[#b8823a] dark:bg-[#b08a26] rounded-r-[4px]"
                                              style={{ width: `${Math.max((ind / cadenaNivelesChart.maxTotal) * 100, 1.5)}%` }}
                                            />
                                          )}
                                        </span>
                                        <span className="shrink-0 w-10 text-left text-[10px] font-black text-slate-600 dark:text-slate-300">{formatNumber(total)}</span>
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-[11px] font-bold">{nivel}: {formatNumber(dir)} directo{dir === 1 ? "" : "s"} · {formatNumber(ind)} indirecto{ind === 1 ? "" : "s"} · {formatNumber(total)} total</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Toolbar: búsqueda en el árbol + controles */}
                    <div className="flex items-center gap-2 flex-wrap mb-4 px-1 mt-3">
                      <div className="flex items-center flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-[#621f32] dark:focus-within:border-[#bc955c] rounded-xl px-3 py-2 transition-colors">
                        <Search className="size-4 text-slate-400 mr-2 shrink-0" />
                        <input
                          type="text"
                          value={cadenaTreeSearch}
                          onChange={(e) => setCadenaTreeSearch(e.target.value)}
                          placeholder="Filtrar por nombre, posición, puesto, UA, depto..."
                          className="bg-transparent text-xs w-full outline-none text-slate-700 dark:text-slate-200 font-bold placeholder-slate-400"
                        />
                        {cadenaTreeSearch && (
                          <button type="button" onClick={() => setCadenaTreeSearch("")} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" title="Limpiar búsqueda">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCadenaSoloDirectos((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${cadenaSoloDirectos ? "bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-[#3e131f] shadow-sm" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c]"}`}
                        title="Mostrar solo subordinados directos"
                      >
                        <Users className="size-3" /><span>Solo directos</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExpandAllCadena}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] text-[10px] font-black uppercase rounded-xl transition-all active:scale-95 cursor-pointer"
                        title="Expandir todos los nodos"
                      >
                        <ChevronDown className="size-3" /><span>Expandir todo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAllCadena}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] text-[10px] font-black uppercase rounded-xl transition-all active:scale-95 cursor-pointer"
                        title="Colapsar todos los nodos"
                      >
                        <ChevronRightIcon className="size-3" /><span>Colapsar todo</span>
                      </button>
                      <button
                        onClick={handleExportCadenaDescendente}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[#621f32] dark:text-[#bc955c] text-[10px] font-black uppercase rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                        title="Exportar árbol de subordinados a Excel (con hoja de resumen)"
                      >
                        <Download className="size-3" /><span>Exportar</span>
                      </button>
                    </div>

                    {/* Contador de coincidencias / limpiar filtros */}
                    {cadenaFilterResult.active && (
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {formatNumber(cadenaFilterResult.matchCount)} coincidencia{cadenaFilterResult.matchCount === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCadenaTreeSearch(""); setCadenaEstadoFilter(new Set()); setCadenaNivelFilter(new Set()); setCadenaPosActivaFilter(new Set()); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-3" /><span>Limpiar filtros</span>
                        </button>
                      </div>
                    )}

                    {cadenaFilterResult.active && cadenaFilterResult.matchCount === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                        <Filter className="size-8 text-slate-400 mb-3" />
                        <p className="text-sm font-black text-slate-600 dark:text-slate-300">Sin coincidencias en el árbol</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">Ajusta la búsqueda o quita filtros de estado/nivel/posición.</p>
                      </div>
                    ) : (
                      <CadenaTreeNode
                        node={cadenaDisplayRoot}
                        depth={0}
                        expandedNodes={expandedCadenaNodes}
                        onToggle={toggleCadenaNode}
                        isRoot
                        filterActive={cadenaFilterResult.active}
                        visibleSet={cadenaFilterResult.visibleSet}
                        matchedSet={cadenaFilterResult.matchedSet}
                        deptoCatalog={deptoCatalog}
                        expandedVacGroups={expandedVacGroups}
                        onToggleVacGroup={toggleVacGroup}
                        onFocusNode={handleFocusCadenaNode}
                        maxDepth={cadenaSoloDirectos ? 1 : Infinity}
                      />
                    )}
                  </div>
                ) : cadenaDirection === "arriba" && cadenaData && cadenaData.cadena ? (
                  <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col items-center">
                    {/* Pirámide / Organigrama Centrado */}
                    <div className="flex flex-col items-center relative w-full">
                      {[...cadenaData.cadena].reverse().map((nodo, idx, arr) => {
                        const isTopBoss = idx === 0;
                        const isBaseEmployee = idx === arr.length - 1;
                        
                        return (
                          <React.Fragment key={`${nodo.Posicion}-${idx}`}>
                            <motion.div 
                              initial={{ opacity: 0, y: -20, scale: 0.95 }} 
                              animate={{ opacity: 1, y: 0, scale: 1 }} 
                              transition={{ delay: idx * 0.15, type: 'spring', stiffness: 100 }}
                              className={`relative w-full sm:w-[500px] z-10 transition-all duration-300 hover:scale-[1.02] ${isTopBoss ? 'mb-2' : ''}`}
                            >
                              <div className={`bg-white dark:bg-slate-900 border-2 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group flex flex-col items-center text-center
                                ${isTopBoss ? 'border-[#bc955c] dark:border-[#bc955c] shadow-[#bc955c]/10' : 
                                  isBaseEmployee ? 'border-[#621f32] dark:border-[#621f32] shadow-[#621f32]/10' : 
                                  'border-slate-200 dark:border-slate-800'}`}
                              >
                                {/* Background Decoration */}
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                  {isTopBoss ? <Users className="size-32 text-[#bc955c]" /> : 
                                   isBaseEmployee ? <Users className="size-32 text-[#621f32]" /> : 
                                   <ArrowUpCircle className="size-32" />}
                                </div>

                                {/* Header Tag */}
                                {isTopBoss && (
                                  <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#bc955c] to-[#9a7848] text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-sm">
                                    Cúspide de Jerarquía
                                  </span>
                                )}
                                {isBaseEmployee && (
                                  <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#621f32] to-[#4a1726] text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-sm">
                                    Empleado Consultado
                                  </span>
                                )}
                                {!isTopBoss && !isBaseEmployee && (
                                  <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full mb-4">
                                    Mando Superior (Nivel {nodo.Nivel_Hacia_Arriba})
                                  </span>
                                )}

                                {/* Name & Title */}
                                <h4 className={`text-xl sm:text-2xl font-black leading-tight mb-2
                                  ${isTopBoss ? 'text-slate-800 dark:text-white' : 
                                    isBaseEmployee ? 'text-slate-800 dark:text-white' : 
                                    'text-slate-700 dark:text-slate-200'}`}
                                >
                                  {nodo.Empleado || "Sin Nombre"}
                                </h4>
                                <p className={`text-sm font-bold uppercase tracking-wide mb-5 px-4
                                  ${isTopBoss ? 'text-[#bc955c]' : 
                                    isBaseEmployee ? 'text-[#621f32]' : 
                                    'text-slate-500 dark:text-slate-400'}`}
                                >
                                  {nodo.Puesto_Funcional || "Puesto no especificado"}
                                </p>
                                
                                {/* Info Pills */}
                                <div className="flex flex-wrap justify-center gap-3 w-full">
                                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/50 flex-1 min-w-[120px]">
                                    <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Posición</span>
                                    <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{nodo.Posicion}</span>
                                  </div>
                                  {nodo.Nivel && (
                                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/50 flex-1 min-w-[120px]">
                                      <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Nivel</span>
                                      <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{nodo.Nivel}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>

                            {/* Línea Conectora Centrada (Excepto después del último elemento) */}
                            {!isBaseEmployee && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 40 }}
                                transition={{ delay: (idx * 0.15) + 0.1, duration: 0.3 }}
                                className="w-1 h-10 bg-gradient-to-b from-[#bc955c] via-slate-300 dark:via-slate-700 to-[#621f32] rounded-full my-2 relative z-0"
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <div className="size-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <Network className="size-10 text-slate-400 dark:text-slate-600" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Buscar Jerarquía</h4>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-sm">
                      Ingresa la posición, nombre o número de empleado para visualizar {cadenaDirection === "abajo" ? "sus subordinados directos e indirectos" : "toda su cadena de mando hacia arriba"}.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>,
        document.body
      )}

      {/* Dropdown de Filtro por Valores Únicos */}
      <ColumnFilterDropdown
        open={!!activeFilterDropdown}
        columnKey={activeFilterDropdown}
        columnLabel={columns.find(c => c.key === activeFilterDropdown)?.label}
        isDate={DATE_HIERARCHY_KEYS.includes(activeFilterDropdown)}
        data={datosParaColumnaActiva}
        filters={filters}
        dropdownValues={filterDropdownValues}
        dateHierarchy={dateHierarchies[activeFilterDropdown]}
        onDateSelection={(type, value, parentPath) => handleDateSelection(activeFilterDropdown, type, value, parentPath)}
        onToggleDateNode={toggleDateNode}
        onApply={() => applyColumnFilter(activeFilterDropdown)}
        onClear={() => clearColumnFilter(activeFilterDropdown)}
        onClose={() => setActiveFilterDropdown(null)}
        reachableValues={reachableValues}
      />

      <AdvancedFiltersModal
        open={isAdvancedFiltersOpen}
        onClose={() => setIsAdvancedFiltersOpen(false)}
        mounted={mounted}
        columns={dataColumns}
        conditions={advancedConditions}
        onAddCondition={addAdvancedCondition}
        onRemoveCondition={removeAdvancedCondition}
        onUpdateCondition={updateAdvancedCondition}
        onApply={applyAdvancedFilters}
        isDateColumn={isDateColumn}
        fetchSuggestions={fetchAdvSuggestions}
      />

      <CeldaValorModal
        open={isCellModalOpen && !!selectedCell}
        onClose={() => setIsCellModalOpen(false)}
        columnLabel={selectedCell ? tableColumns.filter(c => c.visible)[selectedCell.col]?.label : ""}
        cellRef={selectedCell ? `${getColumnLetter(selectedCell.col)}${selectedCell.row + 1}` : ""}
        value={(() => {
          if (!selectedCell) return null;
          const row = filteredSortedData[selectedCell.row];
          const col = tableColumns.filter(c => c.visible)[selectedCell.col];
          const v = row?.[col?.key];
          if (!v) return null;
          if (col?.key === "estado_nomina") return mapEstadoNomina(v);
          return v;
        })()}
      />

      <CeldaHistorialModal
        open={isHistorialModalOpen}
        onClose={() => setIsHistorialModalOpen(false)}
        columns={historialColumns}
        formatValue={formatHistorialValue}
        subtitle="EMPLEADOS_COMPLETOS_SIG · Columnas quincenal · Fecha de Anuencia"
      />

      <VacanciaDetalleModal
        open={isVacanciaModalOpen}
        onClose={() => setIsVacanciaModalOpen(false)}
        detalle={vacanciaDetalle}
        isLoading={isVacanciaLoading}
      />

      <CopyCellMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onPaste={canEditCeldas ? handlePasteCell : undefined}
        canPaste={isPasteableColumn(contextMenu?.colKey)}
        onDelete={canEditCeldas ? handleClearCell : undefined}
        canDelete={isPasteableColumn(contextMenu?.colKey)}
      />

      {selectedRowData && (
        <EmployeeRecordModal
          isOpen={!!selectedRowData}
          onClose={() => setSelectedRowData(null)}
          record={selectedRowData}
          canViewPhoto={canViewFotoDetalle}
        />
      )}

      <ExportConFotosModal
        open={isExportFotosModalOpen}
        onClose={() => setIsExportFotosModalOpen(false)}
        onConfirm={handleConfirmExportConFotos}
        isExporting={isExportingConFotos}
        onCancelExport={handleCancelExportConFotos}
        rowCount={filteredSortedData.length}
      />
    </div>
  );
}
