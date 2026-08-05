"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { VacantesService } from "@/services/vacantes.service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { X, Search, Columns3, Stamp, LayoutGrid, MousePointerClick, UserRound, Loader2, Lock, Download, Eye, EyeOff, ClipboardCopy, ClipboardCheck, IdCard, Briefcase, GraduationCap, Phone, MapPin, AlertTriangle, FileQuestion, Pencil, Check, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import { copyToClipboard } from "@/utils/clipboard";
import ModalShell, { Pill } from "@/components/shared/ModalShell";
import VacanciaDetalleModal from "./VacanciaDetalleModal";
import ExportConFotosModal from "./ExportConFotosModal";
import { useToast } from "@/hooks/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import DataTable from "./DataTable";
import ColumnFilterDropdown from "./ColumnFilterDropdown";
import CopyCellMenu from "./CopyCellMenu";
import { useColumnFilters } from "../../_hooks/useColumnFilters";
import { useCellSelection, useClearSelectionOnFilterChange } from "../../_hooks/useCellSelection";
import {
    applyColumnFilters,
    getUniqueColumnValues,
    matchesTextCondition,
    finalizeFilterDropdownValues,
    resolveColumnFilterCommit,
    defaultGetCellValue,
    normalizeForSearch,
    formatDateEsMx,
} from "@/utils/columnFilters";

// --- CONSTANTS ---
// Exportado para que otros consumidores del modo local de EmployeesModal
// (p.ej. DetalleVacantesTablas.jsx) puedan derivar su whitelist de
// `restrictColumnsTo` de esta misma fuente, en vez de duplicar la lista a
// mano y arriesgar un mismatch con lo que el botón "Columnas" ofrece aquí.
export const ALL_AVAILABLE_COLUMNS = [
  // Básicos
  { key: "id_empleado", label: "NO. EMPLEADO", category: "Básicos" },
  { key: "nombres", label: "NOMBRE", category: "Básicos" },
  { key: "rfc", label: "RFC", category: "Básicos" },
  { key: "curp", label: "CURP", category: "Básicos" },
  { key: "posicion", label: "POSICIÓN", category: "Básicos" },
  { key: "nivel", label: "NIVEL", category: "Básicos" },
  { key: "fecha_de_ingreso", label: "FECHA INGRESO", category: "Básicos" },
  { key: "estado_nomina", label: "ESTATUS NÓMINA", category: "Básicos" },
  // Solo poblada cuando la fila representa una posición vacante (ver
  // mapVacanteRow.js); interactiva igual que en MovimientosTab: abre
  // VacanciaDetalleModal con el detalle completo de la vacancia.
  { key: "fecha_vacancia", label: "FECHA DE VACANCIA", category: "Básicos" },

  // Adscripción / Estructura
  { key: "unidad_administrativa", label: "UNIDAD ADMINISTRATIVA", category: "Estructura" },
  { key: "nombre_puesto_funcional", label: "PUESTO", category: "Estructura" },
  { key: "departamento", label: "DEPARTAMENTO", category: "Estructura" },
  { key: "unidad_de_negocio", label: "UNIDAD DE NEGOCIO", category: "Estructura" },
  { key: "aduana", label: "ADUANA", category: "Estructura" },
  { key: "tipo_de_aduana", label: "TIPO DE ADUANA", category: "Estructura" },
  { key: "entidad_federativa", label: "ESTADO / ENTIDAD", category: "Estructura" },
  { key: "municipio", label: "MUNICIPIO", category: "Estructura" },
  { key: "ubicacion", label: "UBICACIÓN", category: "Estructura" },
  { key: "descripcion_ubicacion", label: "DESCRIPCIÓN UBICACIÓN", category: "Estructura" },

  // Detalle de Plaza / Presupuesto
  { key: "codigo_presupuestal", label: "CÓDIGO PRESUPUESTAL", category: "Plaza" },
  { key: "partida", label: "PARTIDA", category: "Plaza" },
  { key: "tipo_de_contratacion", label: "TIPO CONTRATACIÓN", category: "Plaza" },
  { key: "tipo", label: "TIPO PLAZA", category: "Plaza" },
  { key: "escala", label: "ESCALA", category: "Plaza" },
  { key: "smb", label: "SMB", category: "Plaza" },
  { key: "smn", label: "SMN", category: "Plaza" },
  { key: "val_estat", label: "VAL ESTAT", category: "Plaza" },

  // Estatus y Validación
  { key: "estado_en_nomina", label: "ESTADO EN NÓMINA", category: "Validación" },
  { key: "ua_validacion", label: "UA VALIDACIÓN", category: "Validación" },
  { key: "validando_posicion_por_documento", label: "VALIDANDO POSICIÓN POR DOCTO", category: "Validación" },
  { key: "status_jefe_inm_posicion", label: "STATUS JEFE INMEDIATO", category: "Validación" },

  // Datos Internos y Otros
  { key: "numeral", label: "NUMERAL", category: "Otros" },
  { key: "observaciones", label: "OBSERVACIONES", category: "Otros" },
  { key: "sindicato", label: "SINDICATO", category: "Otros" },
  { key: "personal_militar_o_civil", label: "TIPO PERSONAL (CIVIL/MILITAR)", category: "Otros" },
  { key: "rango", label: "RANGO MILITAR", category: "Otros" },
  { key: "posicion_civil_sedena_semar", label: "POSICIÓN CIVIL/MILITAR", category: "Otros" },
  { key: "tipo_de_personal_sedena_semar", label: "TIPO PERSONAL SEDENA/SEMAR", category: "Otros" },
  { key: "dg_o_aduana_compactada", label: "DG O ADUANA COMPACTADA", category: "Otros" },
  { key: "proyecto_2024_reduccion_plazas_eventuales", label: "PROYECTO REDUCCIÓN 2024", category: "Otros" },
  { key: "fecha_efectiva_personal", label: "FECHA EFECTIVA PERSONAL", category: "Otros" },
  { key: "fecha_de_captura", label: "FECHA DE CAPTURA", category: "Otros" },
  { key: "qna", label: "QUINCENA", category: "Otros" },
  { key: "fecha_prevista_de_salida", label: "FECHA SALIDA PREVISTA", category: "Otros" },
  { key: "nj", label: "NJ", category: "Otros" },
  { key: "dependencia_directa", label: "DEPENDENCIA DIRECTA", category: "Otros" },
  { key: "numempleado", label: "NÚMERO EMPLEADO (ALT)", category: "Otros" },
  { key: "id_field", label: "ID CAMPO", category: "Otros" },
  { key: "cent", label: "CENT", category: "Otros" },
  { key: "dir", label: "DIR", category: "Otros" },
  { key: "subd", label: "SUBD", category: "Otros" },
  { key: "jd", label: "JD", category: "Otros" },
  { key: "depto", label: "DEPTO", category: "Otros" },
  { key: "id_tipo", label: "ID TIPO", category: "Otros" },
  { key: "ua2", label: "UA2", category: "Otros" },
  { key: "latitud", label: "LATITUD", category: "Otros" },
  { key: "longitud", label: "LONGITUD", category: "Otros" },
  { key: "cd_un", label: "CD UN", category: "Otros" },
  { key: "cd_ua", label: "CD UA", category: "Otros" },
  { key: "cd_pto_funcional", label: "CD PTO FUNCIONAL", category: "Otros" },
  { key: "id_departamento", label: "ID DEPARTAMENTO", category: "Otros" },
  { key: "nombre_nj", label: "NOMBRE NJ", category: "Otros" },
];

// EstatusTab.jsx muestra "Permiso"/"Permiso Retribuido" (nomenclatura de la
// plantilla de Excel), pero EmpleadosPorNivelYEstatusView en el backend sigue
// esperando los nombres históricos Licencia/Licencia Médica para resolver el
// código A/S/L/P — se traduce aquí, en el único punto donde el estatus viaja
// al backend, sin necesidad de tocar el contrato existente.
const ESTADO_NOMINA_BACKEND_LABELS = { "Permiso": "Licencia", "Permiso Retribuido": "Licencia Médica" };

const DEFAULT_COLUMN_KEYS = [
  "id_empleado",
  "nombres",
  "rfc",
  "curp",
  "posicion",
  "nivel",
  "unidad_administrativa",
  "nombre_puesto_funcional",
  "fecha_de_ingreso"
];

// Columnas por defecto en modo local (`rows` precargados desde
// desgloseJerarquicoData): ese dataset describe plazas, no empleados —
// no trae rfc/curp/nombres/fecha_de_ingreso — así que el set por defecto
// de arriba se vería casi vacío. Replica los defaults de la extinta
// DetalleVacantesModal.
export const LOCAL_MODE_DEFAULT_COLUMN_KEYS = [
  "posicion",
  "nivel",
  "fecha_vacancia",
  "nombre_puesto_funcional",
  "unidad_de_negocio",
  "unidad_administrativa",
  "smb",
  "smn",
];

const isMonoColumn = (key) => {
    return ["id_empleado", "posicion", "rfc", "curp", "nivel", "fecha_de_ingreso"].includes(key);
};

// 7.9 QA: formato de fecha consistente — todas las columnas de fecha de este modal empiezan con "fecha_".
const isDateField = (key) => typeof key === 'string' && key.startsWith('fecha_');

// Columnas monetarias (SMB/SMN) — mismo criterio y formato que PlantillaDetalleTab.jsx.
const CURRENCY_KEYS = new Set(["smb", "smn"]);
const isCurrencyField = (key) => CURRENCY_KEYS.has(key);
const formatCurrency = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

const COLUMN_LABEL_BY_KEY = ALL_AVAILABLE_COLUMNS.reduce((acc, col) => {
    acc[col.key] = col.label;
    return acc;
}, {});
const HighlightText = ({ text, highlight }) => {
    if (!highlight || !highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) => 
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 dark:text-white px-0.5 rounded font-black">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

// Franja ornamental de "membrete" — firma visual del expediente
const LetterheadBar = () => (
    <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#bc955c] via-[#621f32] to-[#bc955c]" />
);

// --- COMPONENTE SELECTOR DE COLUMNAS (MODAL CENTRADO) ---
// `availableColumns`: universo de columnas ofrecidas — por defecto todas
// (ALL_AVAILABLE_COLUMNS); en modo restringido (ver `restrictColumnsTo` en
// EmployeesModal) solo las que la fuente de datos realmente trae, para no
// listar campos que siempre saldrían vacíos.
const ColumnsSelectorModal = ({ isOpen, onClose, visibleKeys, setVisibleKeys, availableColumns = ALL_AVAILABLE_COLUMNS, defaultKeys = DEFAULT_COLUMN_KEYS }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [tempVisibleKeys, setTempVisibleKeys] = useState(visibleKeys);

    useEffect(() => {
        if (isOpen) {
            setTempVisibleKeys(visibleKeys);
            setSearchQuery("");
        }
    }, [isOpen, visibleKeys]);

    const groupedColumns = useMemo(() => {
        const groups = {};
        const normalizedQuery = normalizeForSearch(searchQuery);
        availableColumns.forEach(col => {
            if (normalizedQuery && !normalizeForSearch(col.label).includes(normalizedQuery) && !normalizeForSearch(col.key).includes(normalizedQuery)) {
                return;
            }
            if (!groups[col.category]) groups[col.category] = [];
            groups[col.category].push(col);
        });
        return groups;
    }, [searchQuery, availableColumns]);

    const toggleColumn = (key) => {
        setTempVisibleKeys(prev => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev;
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handleSelectDefault = () => setTempVisibleKeys(defaultKeys);
    const handleClearAll = () => setTempVisibleKeys([availableColumns[0]?.key].filter(Boolean));
    const handleSelectAll = () => setTempVisibleKeys(availableColumns.map(col => col.key));
    const handleConfirm = () => {
        setVisibleKeys(tempVisibleKeys);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideClose
                overlayClassName="z-[1100]"
                className="z-[1100] w-full max-w-xl max-h-[80vh] flex flex-col p-0 bg-transparent border-none shadow-none overflow-hidden data-[state=closed]:animate-out data-[state=closed]:zoom-out-90 data-[state=closed]:fade-out-0 duration-300"
            >
                <div className="w-full max-h-[80vh] min-h-0 bg-white dark:bg-slate-950 flex flex-col rounded-[28px] shadow-2xl border border-[#621f32]/10 dark:border-slate-800/80 overflow-hidden">
                    <LetterheadBar />
                    <div className="flex flex-col flex-1 min-h-0 p-7">
                        <DialogHeader className="mb-5 shrink-0 flex flex-row justify-between items-center border-b-2 border-dashed border-[#621f32]/15 dark:border-slate-800/60 pb-5">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-full shadow-md text-white border-2 border-double border-[#bc955c]/60">
                                    <Columns3 className="size-6 text-[#bc955c]" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-black text-[#621f32] dark:text-[#bc955c] tracking-tight font-serif">
                                        Configurar columnas
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                                        Campos visibles en el registro
                                    </DialogDescription>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full bg-white dark:bg-slate-900 border border-[#621f32]/15 dark:border-slate-800 text-slate-450 dark:text-slate-550 hover:text-red-500 transition-all cursor-pointer"
                            >
                                <X className="size-5" />
                            </button>
                        </DialogHeader>

                        <div className="mb-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#bc955c]/60 transition-all">
                                <Search className="size-4 text-[#621f32]/50 dark:text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar columna..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <button onClick={handleSelectDefault} className="text-xs font-black text-[#bc955c] uppercase hover:underline cursor-pointer">
                                    Por defecto
                                </button>
                                <div className="flex gap-3.5 items-center">
                                    <button onClick={handleSelectAll} className="text-xs font-black text-slate-500 hover:text-[#621f32] dark:hover:text-white uppercase cursor-pointer">
                                        Todas
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-750">|</span>
                                    <button onClick={handleClearAll} className="text-xs font-black text-slate-550 hover:text-red-500 uppercase cursor-pointer">
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5 border-y-2 border-dashed border-[#621f32]/10 dark:border-slate-900 py-4">
                            {Object.keys(groupedColumns).length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-12 font-serif">Sin resultados</p>
                            ) : (
                                Object.entries(groupedColumns).map(([category, cols]) => (
                                    <div key={category} className="flex flex-col gap-2.5">
                                        <span className="text-xs font-black text-[#bc955c] uppercase tracking-widest font-serif italic border-b border-[#621f32]/10 dark:border-slate-900/50 pb-1.5 mb-1">
                                            {category}
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {cols.map(col => {
                                                const isChecked = tempVisibleKeys.includes(col.key);
                                                return (
                                                    <label key={col.key} className="flex items-center gap-3 py-2 hover:bg-[#621f32]/6 dark:hover:bg-slate-900/40 rounded-lg px-2.5 cursor-pointer transition-colors group">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleColumn(col.key)}
                                                            className="size-4 rounded border-gray-300 dark:border-slate-750 text-[#621f32] dark:text-[#bc955c] focus:ring-[#621f32]/20 cursor-pointer"
                                                        />
                                                        <span className={`text-sm font-semibold uppercase truncate ${isChecked ? 'text-slate-800 dark:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                                            {col.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-5 flex justify-between items-center shrink-0 mt-2">
                            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                                {tempVisibleKeys.length} / {availableColumns.length} Columnas
                            </span>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#621f32]/10 transition-all cursor-pointer">
                                    Cancelar
                                </button>
                                <button onClick={handleConfirm} className="px-7 py-2.5 bg-[#621f32] dark:bg-[#bc955c] text-white dark:text-slate-950 rounded-full text-xs font-black uppercase tracking-wider hover:bg-[#4a1726] dark:hover:opacity-90 transition-all shadow-md shadow-[#621f32]/10 cursor-pointer">
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- COMPONENTE DE FICHERO DETALLADO (EXPEDIENTE) ---

// Orden canónico de las "secciones" (apartados) del expediente. Las categorías
// que no estén aquí — p.ej. cuando el consumidor pasa sus propias `columns` sin
// `category`, que caen todas en "General" — se agregan al final conservando su
// orden de aparición.
const EXPEDIENTE_CATEGORY_ORDER = ["Básicos", "Estructura", "Plaza", "Validación", "Otros"];
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Grupos del tab "Datos personales" (tabla DATOS_PERSONALES, ver
// DatosPersonalesEmpleadoView en el backend) — campos mono para los que se
// ven/copian tal cual (folios, RFC, CURP...), el resto en fuente normal.
const DATOS_PERSONALES_GROUPS = [
    {
        title: "Identificación",
        icon: IdCard,
        fields: [
            { key: "no_empleado", label: "No. Empleado", mono: true },
            { key: "hr_id_persona", label: "ID Persona (HR)", mono: true },
            { key: "position_nbr", label: "No. Posición", mono: true },
            { key: "nombre_completo", label: "Nombre completo" },
            { key: "rfc", label: "RFC", mono: true },
            { key: "curp", label: "CURP", mono: true },
        ],
    },
    {
        title: "Puesto y adscripción",
        icon: Briefcase,
        fields: [
            { key: "puesto", label: "Puesto" },
            { key: "puesto_estructural", label: "Puesto estructural" },
            { key: "puesto_funcional", label: "Puesto funcional" },
            { key: "unidad_administrativa", label: "Unidad administrativa" },
            { key: "deptid", label: "ID Departamento", mono: true },
            { key: "humanos_status", label: "Status RH" },
            { key: "estatus_nomina", label: "Estatus nómina" },
        ],
    },
    {
        title: "Escolaridad",
        icon: GraduationCap,
        fields: [
            { key: "escolaridad_tipo", label: "Tipo" },
            { key: "escolaridad_nivrl", label: "Nivel" },
            { key: "escolaridad_area", label: "Área" },
            { key: "carrera", label: "Carrera" },
            { key: "centro_escolar", label: "Centro escolar" },
        ],
    },
    {
        title: "Contacto",
        icon: Phone,
        fields: [
            { key: "phone", label: "Teléfono 1" },
            { key: "phone1", label: "Teléfono 2" },
            { key: "conmutador", label: "Conmutador", mono: true },
            { key: "extension", label: "Extensión", mono: true, json: true },
            { key: "email_addr", label: "Correo personal" },
            { key: "email_addr2", label: "Correo institucional" },
        ],
    },
    {
        title: "Domicilio",
        icon: MapPin,
        fields: [
            { key: "calle", label: "Calle" },
            { key: "hr_numero_exterior", label: "No. exterior", mono: true },
            { key: "hr_numero_interior", label: "No. interior", mono: true },
            { key: "colonia", label: "Colonia" },
            { key: "postal", label: "C.P.", mono: true },
            { key: "hr_municipio", label: "Municipio" },
            { key: "estado", label: "Estado" },
        ],
    },
];

// Apartados de DATOS_PERSONALES editables desde el permiso
// authentication.edit_datos_personales (ver DatosPersonalesCeldaOverrideView,
// backend) — el resto del expediente (identificación, puesto/adscripción)
// no es editable desde aquí.
const EDITABLE_DATOS_PERSONALES_GROUPS = new Set(["Escolaridad", "Contacto", "Domicilio"]);

// Valor "presentable" o null: unifica undefined / null / cadenas en blanco, que
// en estos datasets significan lo mismo (campo sin capturar).
const cleanFieldValue = (v) => (v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : null);

// `extension` (DATOS_PERSONALES, ver DatosPersonalesBase en el backend) es un
// JSONField: la mayoría de los empleados tiene un solo número (string simple,
// p.ej. "0229"), pero quien cubre varias áreas/módulos trae una lista
// `[{"extension": "...", "area": "..."}, ...]` (ver Directorio ANAM, casos
// como "Luis Ernesto Sena Hernandez" con 14 extensiones). Estos helpers
// normalizan ambas formas a filas {extension, area} para edición, y de vuelta
// al contrato que espera el backend al guardar.
const parseExtensionRows = (raw) => {
    if (raw === null || raw === undefined || raw === "") return [];
    if (Array.isArray(raw)) {
        return raw
            .map((item) => ({
                extension: item?.extension != null ? String(item.extension) : "",
                area: item?.area != null ? String(item.area) : "",
            }))
            .filter((row) => row.extension || row.area);
    }
    return [{ extension: String(raw), area: "" }];
};

// Filas -> valor a mandar al backend: string simple si es una sola extensión
// sin área capturada (caso típico), arreglo de objetos si hay más de una fila
// o la única trae área, null si no queda ninguna fila con dato.
const serializeExtensionRows = (rows) => {
    const limpias = rows
        .map((r) => ({ extension: r.extension.trim(), area: r.area.trim() }))
        .filter((r) => r.extension || r.area);
    if (limpias.length === 0) return null;
    if (limpias.length === 1 && !limpias[0].area) return limpias[0].extension;
    return limpias;
};

// Botón de copiado por campo. Sólo aparece al pasar el cursor en escritorio;
// en pantallas táctiles (sin hover) queda siempre visible.
const CopyValueButton = ({ label, copied, onCopy, className = "" }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCopy(); }}
        title={`Copiar ${label}`}
        aria-label={`Copiar ${label}`}
        className={`shrink-0 p-1 rounded-md transition-all cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 ${copied
            ? "text-emerald-600 dark:text-emerald-400 sm:opacity-100"
            : "text-slate-300 hover:text-[#621f32] hover:bg-[#621f32]/8 dark:text-slate-600 dark:hover:text-[#bc955c] dark:hover:bg-slate-800"} ${className}`}
    >
        {copied ? <ClipboardCheck className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
    </button>
);

// --- PESTAÑA "DATOS PERSONALES" (tabla DATOS_PERSONALES, ver DATOS_PERSONALES_GROUPS) ---
// Recibe `estado` = { status: "idle"|"loading"|"success"|"empty"|"error", data }
// del fetch bajo demanda en EmployeeRecordModal (mismo patrón que la foto).
const DatosPersonalesTab = ({ estado, copiedKey, onCopy, canEdit, noEmpleado, onFieldSaved }) => {
    const { toast } = useToast();
    const [editingKey, setEditingKey] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [editExtensionRows, setEditExtensionRows] = useState([]);
    const [savingKey, setSavingKey] = useState(null);

    const startEdit = (field) => {
        setEditingKey(field.key);
        if (field.json) {
            const rows = field.extensionRows.length > 0 ? field.extensionRows.map((r) => ({ ...r })) : [{ extension: "", area: "" }];
            setEditExtensionRows(rows);
        } else {
            setEditValue(field.value ?? "");
        }
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setEditValue("");
        setEditExtensionRows([]);
    };

    const saveEdit = async (field) => {
        const valorNuevo = field.json ? serializeExtensionRows(editExtensionRows) : editValue.trim();
        setSavingKey(field.key);
        try {
            const res = await VacantesService.patchDatosPersonalesOverride(noEmpleado, field.key, valorNuevo);
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.detail || "No se pudo guardar el cambio.");
            }
            const body = await res.json();
            onFieldSaved?.(field.key, body.sin_cambios ? valorNuevo : (body.valor_nuevo ?? valorNuevo));
            setEditingKey(null);
            setEditValue("");
            setEditExtensionRows([]);
            toast.success("Dato actualizado");
        } catch (err) {
            toast.error(err.message || "No se pudo guardar el cambio.");
        } finally {
            setSavingKey(null);
        }
    };

    const updateExtensionRow = (idx, key, val) => {
        setEditExtensionRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
    };
    const addExtensionRow = () => setEditExtensionRows((rows) => [...rows, { extension: "", area: "" }]);
    const removeExtensionRow = (idx) => setEditExtensionRows((rows) => rows.filter((_, i) => i !== idx));

    if (estado.status === "loading" || estado.status === "idle") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <Loader2 className="size-7 text-[#621f32]/40 dark:text-slate-600 animate-spin mb-3" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cargando datos personales...</p>
            </div>
        );
    }

    if (estado.status === "error") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-4 border-2 border-double border-red-200 dark:border-red-900/50">
                    <AlertTriangle className="size-6 text-red-400 dark:text-red-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">No se pudieron cargar los datos personales</p>
                <p className="text-xs text-slate-400 mt-1">Intenta cerrar y volver a abrir el expediente</p>
            </div>
        );
    }

    if (estado.status === "empty") {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="size-14 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                    <FileQuestion className="size-6 text-[#621f32]/40 dark:text-slate-500" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">Sin datos personales registrados</p>
                <p className="text-xs text-slate-400 mt-1">Este empleado no tiene un registro en DATOS_PERSONALES</p>
            </div>
        );
    }

    const record = estado.data || {};
    const groups = DATOS_PERSONALES_GROUPS
        .map((group) => ({
            ...group,
            editable: canEdit && EDITABLE_DATOS_PERSONALES_GROUPS.has(group.title),
            fields: group.fields.map((f) => f.json
                ? { ...f, extensionRows: parseExtensionRows(record[f.key]), value: null }
                : { ...f, value: cleanFieldValue(record[f.key]) }),
        }))
        .map((group) => ({
            ...group,
            filled: group.fields.filter((f) => (f.json ? f.extensionRows.length > 0 : f.value !== null)).length,
        }));

    return (
        <div className="flex flex-col gap-6 sm:gap-7 mb-2">
            {groups.map((group) => {
                const GroupIcon = group.icon;
                return (
                    <section key={group.title} className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5">
                            <span className="shrink-0 size-6 rounded-md bg-[#621f32] dark:bg-[#3e131f] text-[#bc955c] flex items-center justify-center">
                                <GroupIcon className="size-3.5" />
                            </span>
                            <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#621f32] dark:text-[#e3c793] whitespace-nowrap">
                                {group.title}
                            </h4>
                            <span className="flex-1 h-px bg-gradient-to-r from-[#bc955c]/50 to-transparent" />
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                                {group.filled}/{group.fields.length} con dato
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 rounded-xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/40 px-2.5 py-1.5 sm:px-3.5 sm:py-2">
                            {group.fields.map((field) => {
                                const isEditing = editingKey === field.key;
                                const isSaving = savingKey === field.key;

                                // `extension`: JSONField (string simple o lista de {extension, area}
                                // para quien cubre varias áreas, ver parseExtensionRows/serializeExtensionRows).
                                if (field.json) {
                                    const rows = field.extensionRows;
                                    const hasRows = rows.length > 0;
                                    const copyText = rows.map((r) => (r.area ? `${r.extension} (${r.area})` : r.extension)).join(", ");

                                    if (isEditing) {
                                        return (
                                            <div key={field.key} className="flex flex-col gap-2 py-2 px-1.5 rounded-md bg-[#621f32]/[0.04] dark:bg-slate-900/60 sm:col-span-2">
                                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    {field.label}
                                                </span>
                                                <div className="flex flex-col gap-1.5">
                                                    {editExtensionRows.map((row, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5">
                                                            <input
                                                                autoFocus={idx === 0}
                                                                type="text"
                                                                placeholder="Extensión"
                                                                value={row.extension}
                                                                disabled={isSaving}
                                                                onChange={(e) => updateExtensionRow(idx, "extension", e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                                                                className="w-24 shrink-0 text-[12px] sm:text-[13px] font-mono font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-[#bc955c]/50 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#bc955c]/30"
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Área / módulo (opcional)"
                                                                value={row.area}
                                                                disabled={isSaving}
                                                                onChange={(e) => updateExtensionRow(idx, "area", e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                                                                className="flex-1 min-w-[10px] text-[12px] sm:text-[13px] font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-[#bc955c]/50 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#bc955c]/30"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeExtensionRow(idx)}
                                                                disabled={isSaving || editExtensionRows.length === 1}
                                                                title="Quitar extensión"
                                                                aria-label="Quitar extensión"
                                                                className="shrink-0 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 cursor-pointer"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={addExtensionRow}
                                                        disabled={isSaving}
                                                        className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-[#621f32] dark:text-[#bc955c] hover:underline disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <Plus className="size-3" /> Agregar extensión
                                                    </button>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => saveEdit(field)}
                                                            disabled={isSaving}
                                                            title="Guardar"
                                                            aria-label="Guardar"
                                                            className="shrink-0 p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEdit}
                                                            disabled={isSaving}
                                                            title="Cancelar"
                                                            aria-label="Cancelar"
                                                            className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                                        >
                                                            <X className="size-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={field.key}
                                            className="group flex flex-col gap-1 py-1.5 px-1.5 rounded-md transition-colors hover:bg-[#621f32]/[0.04] dark:hover:bg-slate-900/60 sm:col-span-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="shrink-0 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" title={field.label}>
                                                    {field.label}
                                                </span>
                                                <span className="flex-1 h-px bg-gradient-to-r from-[#bc955c]/50 to-transparent" />
                                                {hasRows && (
                                                    <CopyValueButton
                                                        label={field.label}
                                                        copied={copiedKey === field.key}
                                                        onCopy={() => onCopy(field.key, copyText)}
                                                    />
                                                )}
                                                {group.editable && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); startEdit(field); }}
                                                        title={`Editar ${field.label}`}
                                                        aria-label={`Editar ${field.label}`}
                                                        className="shrink-0 p-1 rounded-md transition-all cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 text-slate-300 hover:text-[#621f32] hover:bg-[#621f32]/8 dark:text-slate-600 dark:hover:text-[#bc955c] dark:hover:bg-slate-800"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            {hasRows ? (
                                                <div className="flex flex-col gap-0.5 pl-0.5">
                                                    {rows.map((row, idx) => (
                                                        <div key={idx} className="flex items-baseline gap-2.5">
                                                            <span className="shrink-0 min-w-[56px] font-mono font-bold text-[12px] sm:text-[13px] text-slate-700 dark:text-slate-300">
                                                                {row.extension}
                                                            </span>
                                                            {row.area && (
                                                                <span className="text-[11px] sm:text-[12px] text-slate-500 dark:text-slate-400 truncate" title={row.area}>
                                                                    {row.area}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="pl-0.5 text-[12px] sm:text-[13px] text-slate-300 dark:text-slate-700 italic font-normal">Sin dato</span>
                                            )}
                                        </div>
                                    );
                                }

                                const hasValue = field.value !== null;
                                const isLong = (field.value?.length || 0) > 34;

                                if (isEditing) {
                                    return (
                                        <div key={field.key} className="flex items-center gap-2 py-1.5 px-1.5 rounded-md bg-[#621f32]/[0.04] dark:bg-slate-900/60 sm:col-span-2">
                                            <span className="shrink-0 max-w-[35%] truncate text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" title={field.label}>
                                                {field.label}
                                            </span>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editValue}
                                                disabled={isSaving}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") saveEdit(field);
                                                    if (e.key === "Escape") cancelEdit();
                                                }}
                                                className="flex-1 min-w-[10px] text-[12px] sm:text-[13px] font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-[#bc955c]/50 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#bc955c]/30"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => saveEdit(field)}
                                                disabled={isSaving}
                                                title="Guardar"
                                                aria-label="Guardar"
                                                className="shrink-0 p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 disabled:opacity-50 cursor-pointer"
                                            >
                                                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                disabled={isSaving}
                                                title="Cancelar"
                                                aria-label="Cancelar"
                                                className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={field.key}
                                        className={`group flex items-baseline gap-2 py-1.5 px-1.5 rounded-md transition-colors hover:bg-[#621f32]/[0.04] dark:hover:bg-slate-900/60 ${isLong ? "sm:col-span-2" : ""}`}
                                    >
                                        <span className="shrink-0 max-w-[52%] truncate text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" title={field.label}>
                                            {field.label}
                                        </span>
                                        <span className="flex-1 min-w-[10px] self-end mb-[5px] border-b border-dotted border-slate-200 dark:border-slate-800" />
                                        <span className={`text-right text-[12px] sm:text-[13px] font-semibold break-words ${isLong ? "max-w-[75%]" : "max-w-[60%]"} ${field.mono ? "font-mono font-bold text-slate-700 dark:text-slate-300" : "text-slate-800 dark:text-slate-200"}`}>
                                            {hasValue ? field.value : <span className="text-slate-300 dark:text-slate-700 italic font-normal">Sin dato</span>}
                                        </span>
                                        {hasValue && (
                                            <CopyValueButton
                                                label={field.label}
                                                copied={copiedKey === field.key}
                                                onCopy={() => onCopy(field.key, field.value)}
                                                className="self-center"
                                            />
                                        )}
                                        {group.editable && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); startEdit(field); }}
                                                title={`Editar ${field.label}`}
                                                aria-label={`Editar ${field.label}`}
                                                className="shrink-0 p-1 rounded-md transition-all cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 text-slate-300 hover:text-[#621f32] hover:bg-[#621f32]/8 dark:text-slate-600 dark:hover:text-[#bc955c] dark:hover:bg-slate-800"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};

export const EmployeeRecordModal = ({ isOpen, onClose, record, columns, fieldClickHandlers = {}, canViewPhoto = true }) => {
    const [fieldSearch, setFieldSearch] = useState("");
    // Un expediente completo son ~60 campos y la mayoría suele venir vacía; el
    // toggle deja "limpiar la hoja" sin perder la vista completa por defecto.
    const [hideEmptyFields, setHideEmptyFields] = useState(false);
    const [activeSection, setActiveSection] = useState(null);
    const sectionRefs = useRef({});
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    const canEditDatosPersonales = hasPermission(PERMISSIONS.EDIT_DATOS_PERSONALES);
    // Clave del último campo copiado — sólo para la palomita temporal del botón.
    const [copiedKey, setCopiedKey] = useState(null);
    const copiedTimeoutRef = useRef(null);

    // Pestaña interna del expediente: "Expediente" (plaza, todas las columnas
    // de la tabla) vs. "Datos personales" (tabla DATOS_PERSONALES, cargada
    // bajo demanda igual que la fotografía — ver useEffect de fetch abajo).
    const [activeTab, setActiveTab] = useState("expediente");
    const [datosPersonales, setDatosPersonales] = useState({ status: "idle", data: null });
    // Guarda si ya se disparó el fetch para esta apertura del modal — en un ref
    // (no en `datosPersonales.status`) para no meter ese estado en las deps del
    // useEffect de abajo: si estuviera ahí, el propio `setDatosPersonales`
    // dentro del efecto (idle -> loading) dispara un re-render que reprograma
    // el efecto, cuyo cleanup marca `cancelado = true` ANTES de que la
    // petición en vuelo resuelva — la respuesta llega bien (rápido, ver
    // request en prod) pero el `if (!cancelado)` la descarta y el spinner se
    // queda pegado en "loading" para siempre. Bug real detectado en prod: la
    // API respondía en ~450ms pero el tab nunca salía de "Cargando...".
    const datosPersonalesFetchedRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setFieldSearch("");
            setHideEmptyFields(false);
            setActiveSection(null);
            setCopiedKey(null);
            setActiveTab("expediente");
            setDatosPersonales({ status: "idle", data: null });
            datosPersonalesFetchedRef.current = false;
        }
    }, [isOpen]);

    useEffect(() => () => clearTimeout(copiedTimeoutRef.current), []);

    const handleCopyField = useCallback(async (key, value) => {
        const ok = await copyToClipboard(value);
        if (!ok) {
            toast.error("No se pudo copiar al portapapeles");
            return;
        }
        setCopiedKey(key);
        toast.success("Se ha copiado al portapapeles!");
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1400);
    }, [toast]);

    // Refleja en el estado local el valor recién guardado en DATOS_PERSONALES
    // (CeldaOverride), sin volver a pedir el registro completo al servidor.
    const handleDatosPersonalesFieldSaved = useCallback((columna, valorNuevo) => {
        setDatosPersonales((prev) => ({
            ...prev,
            data: { ...(prev.data || {}), [columna]: valorNuevo },
        }));
    }, []);

    // ── Foto del empleado — carga bajo demanda (solo al abrir este modal, no
    // precargada en la tabla, ver decisión de diseño: prioriza que la tabla
    // y este modal abran rápido, la foto es la única petición extra y solo
    // ocurre cuando el usuario realmente la pidió). Object URL en vez de
    // <img src> directo porque el endpoint exige el header Authorization,
    // que un <img> plano no puede mandar (mismo patrón que el visor de PDF
    // en SimuladorValuacion.jsx).
    const [fotoUrl, setFotoUrl] = useState(null);
    const [fotoLoading, setFotoLoading] = useState(false);
    const [fotoExpandida, setFotoExpandida] = useState(false);
    useBodyScrollLock(fotoExpandida);
    const numempleadoFoto = record?.numempleado || record?.id_empleado;

    useEffect(() => {
        if (!isOpen || !numempleadoFoto || !canViewPhoto) {
            setFotoUrl(null);
            return;
        }
        let cancelado = false;
        setFotoLoading(true);
        setFotoUrl(null);
        setFotoExpandida(false);
        VacantesService.getEmpleadoFoto(numempleadoFoto)
            .then((res) => (res.ok ? res.blob() : null))
            .then((blob) => {
                if (cancelado) return;
                if (blob) setFotoUrl(URL.createObjectURL(blob));
            })
            .catch(() => {})
            .finally(() => { if (!cancelado) setFotoLoading(false); });
        return () => { cancelado = true; };
    }, [isOpen, numempleadoFoto, canViewPhoto]);

    useEffect(() => {
        return () => { if (fotoUrl) URL.revokeObjectURL(fotoUrl); };
    }, [fotoUrl]);

    // Cierra la foto expandida con Escape, igual que el resto de overlays del proyecto.
    useEffect(() => {
        if (!fotoExpandida) return;
        const handler = (e) => { if (e.key === "Escape") setFotoExpandida(false); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [fotoExpandida]);

    // Datos personales (DATOS_PERSONALES vía DatosPersonalesEmpleadoView) —
    // igual que la foto, sólo se piden cuando el usuario abre esa pestaña, y
    // una sola vez por apertura del modal (status "idle" -> se dispara, luego
    // queda en loading/success/error/empty hasta el próximo open).
    useEffect(() => {
        if (!isOpen || activeTab !== "personales" || !numempleadoFoto) return;
        if (datosPersonalesFetchedRef.current) return;
        datosPersonalesFetchedRef.current = true;
        let cancelado = false;
        setDatosPersonales({ status: "loading", data: null });
        VacantesService.getDatosPersonales(numempleadoFoto)
            .then(async (res) => {
                if (res.status === 404) {
                    if (!cancelado) setDatosPersonales({ status: "empty", data: null });
                    return;
                }
                if (!res.ok) throw new Error("request failed");
                const json = await res.json();
                if (!cancelado) setDatosPersonales({ status: "success", data: json });
            })
            .catch(() => { if (!cancelado) setDatosPersonales({ status: "error", data: null }); });
        return () => { cancelado = true; };
    }, [isOpen, activeTab, numempleadoFoto]);

    // Apartados del expediente: mismo filtrado de siempre (label / valor /
    // categoría) pero devuelto ya ordenado y con conteos, para el índice lateral.
    const sections = useMemo(() => {
        if (!record) return [];
        const fieldsSource = columns || ALL_AVAILABLE_COLUMNS;
        const query = normalizeForSearch(fieldSearch.trim());
        const groups = new Map();

        fieldsSource.forEach(field => {
            const category = field.category || 'General';
            const label = normalizeForSearch(field.label || '');
            const valStr = normalizeForSearch(record[field.key] ?? '');
            const catLower = normalizeForSearch(category);

            if (query && !label.includes(query) && !valStr.includes(query) && !catLower.includes(query)) {
                return;
            }

            const value = cleanFieldValue(record[field.key]);
            if (hideEmptyFields && value === null) return;

            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push({ label: field.label, key: field.key, value });
        });

        return [...groups.entries()]
            .sort((a, b) => {
                const ia = EXPEDIENTE_CATEGORY_ORDER.indexOf(a[0]);
                const ib = EXPEDIENTE_CATEGORY_ORDER.indexOf(b[0]);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            })
            .map(([category, fields]) => ({
                category,
                fields,
                filled: fields.filter(f => f.value !== null).length,
            }));
    }, [record, columns, fieldSearch, hideEmptyFields]);

    const totalFieldsShown = useMemo(() => sections.reduce((sum, s) => sum + s.fields.length, 0), [sections]);
    const hasVisibleFields = totalFieldsShown > 0;
    const sectionKeys = sections.map(s => s.category).join("|");

    // Marca en el índice el apartado que el usuario está leyendo. `root: null`
    // (viewport) basta: el modal es fixed, así que al hacer scroll dentro de su
    // contenedor las secciones igual se mueven respecto al viewport.
    useEffect(() => {
        if (!isOpen || sections.length < 2) return;
        const els = sections.map(s => sectionRefs.current[s.category]).filter(Boolean);
        if (els.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const top = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (top) setActiveSection(top.target.dataset.category);
            },
            { rootMargin: "-15% 0px -65% 0px", threshold: 0 }
        );
        els.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [isOpen, sectionKeys, sections.length]);

    const scrollToSection = useCallback((category) => {
        setActiveSection(category);
        sectionRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    if (!record) return null;

    // --- Carátula: identidad de la plaza y su titular ---
    const nombreTitular = cleanFieldValue(record.nombres) || cleanFieldValue(record.nombre);
    const posicionPlaza = cleanFieldValue(record.posicion);
    const puestoPlaza = cleanFieldValue(record.nombre_puesto_funcional);
    const uaPlaza = cleanFieldValue(record.unidad_administrativa) || cleanFieldValue(record.unidad_de_negocio);
    const fechaVacancia = cleanFieldValue(record.fecha_vacancia);
    const estatusNomina = cleanFieldValue(record.estado_nomina) || cleanFieldValue(record.estado_en_nomina);
    const identificadores = [
        { label: "No. Empleado", value: cleanFieldValue(record.id_empleado) || cleanFieldValue(record.numempleado) },
        { label: "RFC", value: cleanFieldValue(record.rfc) },
        { label: "CURP", value: cleanFieldValue(record.curp) },
        { label: "Nivel", value: cleanFieldValue(record.nivel) },
    ];

    return (
        <>
        <ModalShell
            open={isOpen}
            onClose={onClose}
            size="xl"
            icon={Stamp}
            eyebrow="Expediente de plaza"
            title={nombreTitular || (posicionPlaza ? `Posición ${posicionPlaza}` : "Expediente de Plaza")}
            subtitle={[puestoPlaza, uaPlaza].filter(Boolean).join(" · ") || "Consulta detallada de la plaza"}
            headerExtra={
                fechaVacancia
                    ? <Pill tone="rose" className="hidden sm:inline-flex">Vacante</Pill>
                    : estatusNomina
                        ? <Pill tone="slate" className="hidden sm:inline-flex uppercase">{estatusNomina}</Pill>
                        : null
            }
        >
            <div className="flex flex-col gap-5 sm:gap-6">
                {/* ── Carátula del expediente: foto tipo credencial, titular, folio de
                    posición y tira de identificadores oficiales ── */}
                <div className="relative overflow-hidden rounded-2xl border border-[#621f32]/15 dark:border-slate-800 bg-gradient-to-br from-[#621f32]/[0.05] via-white to-[#bc955c]/[0.08] dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#bc955c] via-[#621f32] to-[#bc955c]" />
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 pt-5 sm:p-5 sm:pt-6">
                        {/* Foto del empleado — cargada bajo demanda al abrir este modal (ver useEffect arriba).
                            Clic para expandir (ver lightbox al final del componente) solo si ya hay foto. */}
                        <div className="shrink-0 mx-auto sm:mx-0">
                            <div
                                onClick={fotoUrl ? () => setFotoExpandida(true) : undefined}
                                className={`h-28 w-24 sm:h-34 sm:w-28 rounded-lg border-[3px] border-double border-[#bc955c]/50 dark:border-[#bc955c]/30 bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex flex-col items-center justify-center ${fotoUrl ? "cursor-pointer hover:opacity-90 hover:border-[#bc955c] transition-all" : ""}`}
                                title={fotoUrl ? "Clic para ampliar" : undefined}
                            >
                                {fotoLoading ? (
                                    <Loader2 className="size-5 text-slate-300 dark:text-slate-600 animate-spin" />
                                ) : !canViewPhoto ? (
                                    <>
                                        <Lock className="size-7 sm:size-8 text-slate-200 dark:text-slate-700" />
                                        <span className="text-[7px] sm:text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tight text-center leading-tight mt-1 px-1">
                                            Foto restringida
                                        </span>
                                    </>
                                ) : fotoUrl ? (
                                    <img src={fotoUrl} alt="Fotografía del empleado" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <UserRound className="size-7 sm:size-8 text-slate-200 dark:text-slate-700" />
                                        <span className="text-[7px] sm:text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tight text-center leading-tight mt-1 px-1">
                                            Sin foto registrada
                                        </span>
                                    </>
                                )}
                            </div>
                            <span className="mt-1.5 block text-center text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">
                                Fotografía
                            </span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-3">
                                <div className="group min-w-0">
                                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#bc955c]">
                                        {nombreTitular ? "Titular de la plaza" : "Plaza sin titular"}
                                    </span>
                                    <h3 className="flex items-center gap-1.5 text-base sm:text-xl font-black text-[#621f32] dark:text-[#f0d9b8] leading-tight break-words mt-0.5">
                                        {nombreTitular || "Vacante"}
                                        {nombreTitular && (
                                            <CopyValueButton
                                                label="nombre"
                                                copied={copiedKey === "caratula-nombre"}
                                                onCopy={() => handleCopyField("caratula-nombre", nombreTitular)}
                                            />
                                        )}
                                    </h3>
                                    {(puestoPlaza || uaPlaza) && (
                                        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 break-words">
                                            {[puestoPlaza, uaPlaza].filter(Boolean).join(" · ")}
                                        </p>
                                    )}
                                    {fechaVacancia && (
                                        <p className="text-[10px] sm:text-[11px] font-bold text-rose-600/90 dark:text-rose-400/90 mt-1.5 uppercase tracking-wide">
                                            Vacante desde {formatDateEsMx(fechaVacancia)}
                                        </p>
                                    )}
                                </div>
                                <div className="group shrink-0 text-right border-l border-dashed border-[#621f32]/20 dark:border-slate-800 pl-3 sm:pl-4">
                                    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-[#bc955c]">Posición</span>
                                    <span className="flex items-center justify-end gap-1 font-mono text-base sm:text-lg font-black text-[#621f32] dark:text-[#e3c793] leading-tight mt-0.5">
                                        {posicionPlaza || "—"}
                                        {posicionPlaza && (
                                            <CopyValueButton
                                                label="posición"
                                                copied={copiedKey === "caratula-posicion"}
                                                onCopy={() => handleCopyField("caratula-posicion", posicionPlaza)}
                                            />
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3.5 sm:mt-4 flex flex-wrap gap-y-2.5 border-t border-dashed border-[#621f32]/15 dark:border-slate-800 pt-3">
                                {identificadores.map((item, idx) => (
                                    <div
                                        key={item.label}
                                        className={`group min-w-0 flex-1 basis-1/2 sm:basis-0 px-3 sm:px-4 ${idx === 0 ? "pl-0" : "border-l border-slate-200 dark:border-slate-800"}`}
                                    >
                                        <span className="block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
                                            {item.label}
                                        </span>
                                        <span className="flex items-center gap-1 font-mono text-[12px] sm:text-[13px] font-bold text-slate-700 dark:text-[#e3c793]" title={item.value || undefined}>
                                            <span className="truncate">
                                                {item.value || <span className="text-slate-300 dark:text-slate-700">—</span>}
                                            </span>
                                            {item.value && (
                                                <CopyValueButton
                                                    label={item.label}
                                                    copied={copiedKey === `caratula-${item.label}`}
                                                    onCopy={() => handleCopyField(`caratula-${item.label}`, item.value)}
                                                />
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Pestañas internas: expediente de la plaza vs. datos personales del titular ── */}
                <div className="flex items-center gap-2 border-b-2 border-dashed border-[#621f32]/12 dark:border-slate-800/60">
                    <button
                        onClick={() => setActiveTab("expediente")}
                        className={`relative flex items-center gap-2 px-4 py-2.5 -mb-0.5 rounded-t-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${activeTab === "expediente"
                            ? "border-[#621f32] dark:border-[#bc955c] text-[#621f32] dark:text-[#e3c793] bg-[#621f32]/[0.05] dark:bg-slate-900"
                            : "border-transparent text-slate-400 dark:text-slate-500 hover:text-[#621f32] dark:hover:text-[#e3c793] hover:bg-[#621f32]/[0.03]"}`}
                    >
                        <Stamp className="size-3.5" />
                        Expediente
                    </button>
                    <button
                        onClick={() => setActiveTab("personales")}
                        className={`relative flex items-center gap-2 px-4 py-2.5 -mb-0.5 rounded-t-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${activeTab === "personales"
                            ? "border-[#621f32] dark:border-[#bc955c] text-[#621f32] dark:text-[#e3c793] bg-[#621f32]/[0.05] dark:bg-slate-900"
                            : "border-transparent text-slate-400 dark:text-slate-500 hover:text-[#621f32] dark:hover:text-[#e3c793] hover:bg-[#621f32]/[0.03]"}`}
                    >
                        <IdCard className="size-3.5" />
                        Datos personales
                    </button>
                </div>

                {activeTab === "personales" ? (
                    <DatosPersonalesTab
                        estado={datosPersonales}
                        copiedKey={copiedKey}
                        onCopy={handleCopyField}
                        canEdit={canEditDatosPersonales}
                        noEmpleado={numempleadoFoto}
                        onFieldSaved={handleDatosPersonalesFieldSaved}
                    />
                ) : (
                <>
                {/* ── Barra de consulta: buscador de campos + depuración de vacíos ── */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="flex-1 flex items-center gap-2.5 sm:gap-3 bg-white dark:bg-slate-900 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-[#621f32]/15 dark:border-slate-800 focus-within:border-[#bc955c]/60 focus-within:ring-2 focus-within:ring-[#bc955c]/10 transition-all shadow-sm">
                        <Search className="size-4.5 text-[#bc955c] shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar campos (RFC, aduana, nivel, sueldo...)"
                            value={fieldSearch}
                            onChange={(e) => setFieldSearch(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-[13px] sm:text-sm font-semibold w-full p-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                        />
                        {fieldSearch && (
                            <button
                                onClick={() => setFieldSearch("")}
                                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-all cursor-pointer shrink-0"
                            >
                                <X className="size-4.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={() => setHideEmptyFields(v => !v)}
                            title={hideEmptyFields ? "Mostrar también los campos sin capturar" : "Ocultar los campos sin capturar"}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${hideEmptyFields
                                ? "bg-[#621f32] border-[#621f32] text-white dark:bg-[#bc955c] dark:border-[#bc955c] dark:text-slate-950"
                                : "bg-white dark:bg-slate-900 border-[#621f32]/15 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-[#bc955c]/60"}`}
                        >
                            {hideEmptyFields ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            Vacíos
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600 whitespace-nowrap">
                            {totalFieldsShown} {totalFieldsShown === 1 ? "campo" : "campos"}
                        </span>
                    </div>
                </div>

                {/* ── Cuerpo del expediente: índice de apartados + hojas de datos ── */}
                {!hasVisibleFields ? (
                    <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                        <div className="size-14 sm:size-16 bg-[#621f32]/8 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 border-2 border-double border-[#621f32]/20">
                            <Search className="size-6 sm:size-7 text-[#621f32]/40 dark:text-slate-500 animate-pulse" />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">No se encontraron campos coincidentes</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {hideEmptyFields ? "Prueba con otra palabra clave o vuelve a mostrar los campos vacíos" : "Prueba con otra palabra clave o limpia el buscador"}
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-6">
                        {sections.length > 1 && (
                            <nav className="hidden lg:block w-40 shrink-0">
                                <div className="sticky top-0 flex flex-col gap-1 pb-4">
                                    <span className="px-2 pb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600">
                                        Índice
                                    </span>
                                    {sections.map((section, idx) => {
                                        const isActive = (activeSection ?? sections[0].category) === section.category;
                                        return (
                                            <button
                                                key={section.category}
                                                onClick={() => scrollToSection(section.category)}
                                                className={`flex items-center gap-2 rounded-r-lg border-l-2 py-1.5 pl-2.5 pr-2 text-left transition-all cursor-pointer ${isActive
                                                    ? "border-[#621f32] bg-[#621f32]/[0.06] text-[#621f32] dark:border-[#bc955c] dark:bg-slate-900 dark:text-[#e3c793]"
                                                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:border-[#bc955c] hover:text-[#621f32] dark:hover:text-[#e3c793]"}`}
                                            >
                                                <span className="w-4 shrink-0 font-mono text-[9px] font-black text-[#bc955c]">{ROMAN_NUMERALS[idx] || idx + 1}</span>
                                                <span className="flex-1 truncate text-[11px] font-bold uppercase tracking-wide">{section.category}</span>
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600">{section.fields.length}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col gap-6 sm:gap-7 mb-2">
                            {sections.map((section, sectionIdx) => (
                                <section
                                    key={section.category}
                                    data-category={section.category}
                                    ref={(el) => { sectionRefs.current[section.category] = el; }}
                                    className="scroll-mt-1 flex flex-col gap-2.5"
                                >
                                    {/* Separador de apartado — el "índice" impreso del expediente */}
                                    <div className="flex items-center gap-3">
                                        <span className="shrink-0 size-6 rounded-md bg-[#621f32] dark:bg-[#3e131f] text-[#bc955c] text-[9px] font-black font-mono flex items-center justify-center">
                                            {ROMAN_NUMERALS[sectionIdx] || sectionIdx + 1}
                                        </span>
                                        <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#621f32] dark:text-[#e3c793] whitespace-nowrap">
                                            {section.category}
                                        </h4>
                                        <span className="flex-1 h-px bg-gradient-to-r from-[#bc955c]/50 to-transparent" />
                                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                                            {section.filled}/{section.fields.length} con dato
                                        </span>
                                    </div>

                                    {/* Hoja de datos: renglones con guía punteada (label ··· valor),
                                        los valores largos ocupan el renglón completo */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 rounded-xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/40 px-2.5 py-1.5 sm:px-3.5 sm:py-2">
                                        {section.fields.map((field) => {
                                            const hasValue = field.value !== null;
                                            const clickHandler = fieldClickHandlers[field.key];
                                            const isClickable = hasValue && typeof clickHandler === "function";
                                            const displayValue = hasValue
                                                ? (isDateField(field.key)
                                                    ? formatDateEsMx(field.value)
                                                    : (isCurrencyField(field.key) && !isNaN(Number(field.value)) ? formatCurrency(field.value) : field.value))
                                                : null;
                                            const isLong = (displayValue?.length || 0) > 34;
                                            return (
                                                <div
                                                    key={field.key}
                                                    className={`group flex items-baseline gap-2 py-1.5 px-1.5 rounded-md transition-colors hover:bg-[#621f32]/[0.04] dark:hover:bg-slate-900/60 ${isLong ? "sm:col-span-2" : ""}`}
                                                >
                                                    <span className="shrink-0 max-w-[52%] truncate text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500" title={field.label}>
                                                        <HighlightText text={field.label} highlight={fieldSearch} />
                                                    </span>
                                                    <span className="flex-1 min-w-[10px] self-end mb-[5px] border-b border-dotted border-slate-200 dark:border-slate-800" />
                                                    <span
                                                        onClick={isClickable ? () => clickHandler(record) : undefined}
                                                        className={`text-right text-[12px] sm:text-[13px] font-semibold break-words ${isLong ? "max-w-[75%]" : "max-w-[60%]"} ${isMonoColumn(field.key) ? "font-mono font-bold text-slate-700 dark:text-slate-300" : "text-slate-800 dark:text-slate-200"} ${isClickable ? "cursor-pointer text-[#621f32] dark:text-[#bc955c] underline decoration-dotted underline-offset-2 hover:decoration-solid" : ""}`}
                                                    >
                                                        {hasValue ? (
                                                            <HighlightText text={displayValue} highlight={fieldSearch} />
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-700 italic font-normal">Sin dato</span>
                                                        )}
                                                    </span>
                                                    {/* Se copia el valor tal como se muestra (fechas ya formateadas) */}
                                                    {hasValue && (
                                                        <CopyValueButton
                                                            label={field.label}
                                                            copied={copiedKey === field.key}
                                                            onCopy={() => handleCopyField(field.key, displayValue)}
                                                            className="self-center"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>
                )}
                </>
                )}
            </div>
        </ModalShell>

        {/* Foto ampliada — overlay simple (no ModalShell/Dialog anidado, para
            evitar conflictos de focus-trap con el modal que ya la contiene).
            Portal a document.body + z-index por encima de ModalShell (que
            porta el suyo a z-[1000]): sin el portal, este div se queda
            dentro del árbol normal y ModalShell (ya portado a body) queda
            encima sin importar el z-index. */}
        {fotoExpandida && fotoUrl && createPortal(
            <div
                className="fixed inset-0 z-[1100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
                onClick={() => setFotoExpandida(false)}
            >
                <button
                    onClick={() => setFotoExpandida(false)}
                    className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Cerrar"
                >
                    <X className="size-5" />
                </button>
                <img
                    src={fotoUrl}
                    alt="Fotografía del empleado (ampliada)"
                    onClick={(e) => e.stopPropagation()}
                    className="max-w-full max-h-full rounded-2xl shadow-2xl cursor-default"
                />
            </div>,
            document.body
        )}
        </>
    );
};


// --- COMPONENTE PRINCIPAL ---
// `categoryTabs`: [{ key, label, estatus }] opcional — cuando se pasa, el modal
// reemplaza el Pill de estatus fijo por pestañas internas; cada pestaña dispara
// su propio fetch usando su `estatus` (p.ej. las 6 categorías de "Ocupadas vs
// Vacantes por familia de nivel": Ocup. Permanentes / Ocup. Eventuales /
// Ocup. Event. N.C. / Vac. Eventuales / Vac. Permanentes / Vac. Event. N.C.).
// Sin `categoryTabs`, se comporta como antes.
// `rows` + `title`: modo local — cuando `rows` viene poblado (array, aunque
// esté vacío), el modal muestra esos registros directamente en vez de hacer
// fetch por nivel/estatus contra VacantesService. Pensado para datasets ya
// cargados en el padre (p.ej. desgloseJerarquicoData filtrado client-side)
// que no mapean 1:1 a un solo nivel+estatus, como agrupaciones por NJ o los
// filtros de "Observaciones Vacancia". `title` reemplaza los Pills de
// nivel/estatus por un único Pill descriptivo.
// `restrictColumnsTo`: whitelist de keys — cuando se pasa, el botón
// "Columnas" (y el expediente) solo ofrece esos campos, en vez del
// universo completo de ALL_AVAILABLE_COLUMNS. Pensado para datasets que no
// traen todos los campos de empleado (p.ej. desglose_jerarquico, que es de
// plazas): sin esto, el selector listaría columnas que siempre salen vacías.
export default function EmployeesModal({ open, onOpenChange, nivel, estatus, ua, categoryTabs = null, rows = null, title = null, defaultColumnKeys = null, restrictColumnsTo = null, canViewPhoto = true, fotoPermissionCodename = null }) {
    const isLocalMode = Array.isArray(rows);
    const [isExportFotosModalOpen, setIsExportFotosModalOpen] = useState(false);
    const [isExportingConFotos, setIsExportingConFotos] = useState(false);
    const exportConFotosAbortRef = useRef(null);
    const { toast } = useToast();
    const isCategoryMode = Array.isArray(categoryTabs) && categoryTabs.length > 0;
    const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
    const effectiveEstatus = isCategoryMode ? categoryTabs[activeCategoryIdx]?.estatus : estatus;

    // Descompone `categoryTabs` en dos dimensiones (tipo: "Ocupadas"/"Vacantes" +
    // modalidad: "Permanentes"/"Eventuales"/"Eventuales Nueva Creación") a partir
    // de la primera palabra de `estatus`. Sólo se activa si el set forma una
    // rejilla completa tipo x modalidad (hoy: 2 x 3 = 6); si no calza, se cae al
    // listado de pestañas plano como respaldo.
    const categoryMatrix = useMemo(() => {
        if (!isCategoryMode) return null;
        const tipos = [];
        const modalidades = [];
        const map = {};
        categoryTabs.forEach((tab, idx) => {
            const estatusValue = tab.estatus || "";
            const spaceIdx = estatusValue.indexOf(" ");
            if (spaceIdx === -1) return;
            const tipo = estatusValue.slice(0, spaceIdx);
            const modalidad = estatusValue.slice(spaceIdx + 1);
            if (!tipos.includes(tipo)) tipos.push(tipo);
            if (!modalidades.includes(modalidad)) modalidades.push(modalidad);
            map[`${tipo}|${modalidad}`] = idx;
        });
        const isFullGrid = tipos.length * modalidades.length === categoryTabs.length
            && tipos.every(t => modalidades.every(m => map[`${t}|${m}`] !== undefined));
        return isFullGrid ? { tipos, modalidades, map } : null;
    }, [isCategoryMode, categoryTabs]);

    const currentEstatusValue = isCategoryMode ? (categoryTabs[activeCategoryIdx]?.estatus || "") : "";
    const currentSpaceIdx = currentEstatusValue.indexOf(" ");
    const currentTipo = categoryMatrix && currentSpaceIdx !== -1 ? currentEstatusValue.slice(0, currentSpaceIdx) : null;
    const currentModalidad = categoryMatrix && currentSpaceIdx !== -1 ? currentEstatusValue.slice(currentSpaceIdx + 1) : null;

    const handleTipoChange = (tipo) => {
        const idx = categoryMatrix?.map[`${tipo}|${currentModalidad}`];
        if (idx !== undefined) setActiveCategoryIdx(idx);
    };
    const handleModalidadChange = (modalidad) => {
        const idx = categoryMatrix?.map[`${currentTipo}|${modalidad}`];
        if (idx !== undefined) setActiveCategoryIdx(idx);
    };

    // Reset de pestaña solo al abrir/cerrar el modal — no en cada cambio de
    // categoría (eso recrearía effectiveEstatus y, si viviera en el mismo
    // efecto que dispara el fetch, se pisaría a sí mismo de vuelta a la 0).
    useEffect(() => {
        if (open) setActiveCategoryIdx(0);
    }, [open]);

    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const [visibleKeys, setVisibleKeys] = useState(defaultColumnKeys || (isLocalMode ? LOCAL_MODE_DEFAULT_COLUMN_KEYS : DEFAULT_COLUMN_KEYS));
    const [showColumnsModal, setShowColumnsModal] = useState(false);
    const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState(null);

    // Detalle de vacancia (columna "Fecha de Vacancia") — mismo patrón que
    // MovimientosTab: el id de MOV_POS viaja en `row.mov_pos_id` (ver
    // mapVacanteRow.js), sólo poblado cuando la fila representa una vacante.
    const [isVacanciaModalOpen, setIsVacanciaModalOpen] = useState(false);
    const [vacanciaRowId, setVacanciaRowId] = useState(null);
    const [vacanciaDetalle, setVacanciaDetalle] = useState(null);
    const [isVacanciaLoading, setIsVacanciaLoading] = useState(false);

    const openVacanciaModal = useCallback((row) => {
        if (!row || row.mov_pos_id === undefined || row.mov_pos_id === null) return;
        setVacanciaRowId(row.mov_pos_id);
        setIsVacanciaModalOpen(true);
    }, []);

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

    // Altura dinámica: la tabla mide su propio contenido (header + filas) y el
    // contenedor adopta esa altura, topada por max-h-[70vh] (el máximo actual).
    // Con pocos registros el modal se ve más chico; con muchos, hace scroll interno.
    const tableContainerRef = useRef(null);
    const [tableHeight, setTableHeight] = useState(null);

    // Virtualización por ventana de scroll (mismo patrón que MovimientosTab):
    // con datasets de miles de filas (cuadros de ocupación), renderizar cada
    // <tr> real vuelve el modal perceptiblemente lento (miles de nodos DOM +
    // listeners). DataTable ya soporta esto vía startIndex/endIndex — antes
    // este modal se los pasaba fijos (0..length), desactivando la ventana.
    // `viewportHeight` se mide con ResizeObserver porque, a diferencia de
    // MovimientosTab, este contenedor no tiene alto fijo: depende del propio
    // contenido (topado por max-h-[70vh]) y del modal (resizable en ancho).
    const rowHeight = 37;
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(700);
    useEffect(() => {
        const el = tableContainerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver((entries) => {
            const h = entries[0]?.contentRect?.height;
            if (h) setViewportHeight(h);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [open]);

    const { selectedCell, setSelectedCell, contextMenu, setContextMenu } = useCellSelection();
    const filters = useColumnFilters();
    const {
        columnFilters, setColumnFilters,
        textFilters, setTextFilters,
        activeFilterDropdown, setActiveFilterDropdown,
        activeConditionDropdown, setActiveConditionDropdown,
        setTempSelectedValues,
        tempSelectedValues,
        setFilterSearchText,
        filterSearchCondition,
        debouncedFilterSearchText,
        resetFilters,
    } = filters;

    // BUG-05 QA: selección posicional — limpiarla cuando cambia filtro/orden.
    useClearSelectionOnFilterChange(setSelectedCell, [columnFilters, textFilters, sortConfig.key, sortConfig.direction]);

    // La ventana virtualizada es posicional (scrollTop / rowHeight): si el
    // dataset filtrado encoge, un scrollTop heredado del dataset anterior
    // puede quedar fuera de rango y renderizar una ventana vacía. Se resetea
    // el estado y el scroll real del contenedor en el mismo evento.
    useEffect(() => {
        setScrollTop(0);
        if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    }, [columnFilters, textFilters, sortConfig.key, sortConfig.direction]);

    const [columnWidths, setColumnWidths] = useState(() => {
        const widths = {};
        ALL_AVAILABLE_COLUMNS.forEach(col => { widths[col.key] = 175; });
        widths["id_empleado"] = 130;
        widths["nombres"] = 280;
        widths["rfc"] = 145;
        widths["curp"] = 185;
        widths["posicion"] = 120;
        widths["nivel"] = 100;
        widths["unidad_administrativa"] = 280;
        widths["nombre_puesto_funcional"] = 280;
        widths["fecha_de_ingreso"] = 145;
        return widths;
    });

    const availableColumns = useMemo(() => {
        if (!restrictColumnsTo) return ALL_AVAILABLE_COLUMNS;
        return ALL_AVAILABLE_COLUMNS.filter(col => restrictColumnsTo.includes(col.key));
    }, [restrictColumnsTo]);

    // "Posición" es la única columna congelada (sticky) de este modal — se
    // adelanta al frente del listado para que quede pegada justo después de las
    // columnas fijas (#, VER); el resto conserva su orden de ALL_AVAILABLE_COLUMNS.
    const orderedColumns = useMemo(() => {
        const posicionCol = availableColumns.find(col => col.key === "posicion");
        const rest = availableColumns.filter(col => col.key !== "posicion");
        return posicionCol ? [posicionCol, ...rest] : availableColumns;
    }, [availableColumns]);

    const columns = useMemo(() => orderedColumns.map(col => ({
        key: col.key,
        label: col.label,
        width: columnWidths[col.key] || 175,
        visible: visibleKeys.includes(col.key),
    })), [orderedColumns, visibleKeys, columnWidths]);

    const fetchData = useCallback(async () => {
        if (isLocalMode) return;
        if (!nivel || !effectiveEstatus) return;
        setLoading(true);
        setError(null);
        try {
            // El backend de EmpleadosPorNivelYEstatusView todavía espera los
            // nombres históricos Licencia/Licencia Médica (estatus_map_reverse
            // en views.py); EstatusTab ya muestra Permiso/Permiso Retribuido
            // en pantalla, así que aquí se traduce de vuelta justo antes de
            // llamar al backend, sin tocar el contrato existente.
            const backendEstatus = ESTADO_NOMINA_BACKEND_LABELS[effectiveEstatus] || effectiveEstatus;
            const response = await VacantesService.getEmpleadosPorNivelYEstatus(nivel, backendEstatus);
            const data = await response.json();
            if (response.ok) {
                let results = data.resultados || [];
                if (ua) {
                    const searchUa = String(ua).trim().toLowerCase();
                    const filtered = results.filter(r => {
                        const val1 = String(r.unidad_administrativa || '').trim().toLowerCase();
                        const val2 = String(r.desc_unidad_administrativa || '').trim().toLowerCase();
                        return val1 === searchUa || val2 === searchUa;
                    });

                    if (filtered.length === 0 && results.length > 0) {
                        setError(`DEBUG: Buscando UA "${ua}". Las disponibles en los datos son: ${Array.from(new Set(results.map(r => r.unidad_administrativa || r.desc_unidad_administrativa || 'NULO'))).join(' | ')}`);
                        setLoading(false);
                        return;
                    }
                    results = filtered;
                }
                setRowData(results);
            } else {
                setError(data.mensaje || data.error || "Error al cargar los datos.");
            }
        } catch (err) {
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    }, [isLocalMode, nivel, effectiveEstatus, ua]);

    useEffect(() => {
        if (open) {
            if (isLocalMode) {
                setRowData(rows);
                setLoading(false);
                setError(null);
            } else if (!nivel || !effectiveEstatus) {
                // El modal ya está abierto (open=true) aunque el padre todavía no
                // haya resuelto nivel/estatus (p.ej. drill-down que arma esos
                // valores en un segundo tick) — se muestra el skeleton en vez de
                // una tabla vacía silenciosa hasta que lleguen y disparen el fetch.
                setRowData([]);
                setError(null);
                setLoading(true);
            } else {
                fetchData();
            }
            resetFilters();
            setSortConfig({ key: null, direction: 'asc' });
            setScrollTop(0);
        } else {
            setRowData([]);
            setActiveFilterDropdown(null);
            setShowColumnsModal(false);
            setSelectedEmployeeRecord(null);
            setContextMenu(null);
            setIsVacanciaModalOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, fetchData, isLocalMode, rows, nivel, effectiveEstatus]);

    // Columnas visibles por defecto: se recalculan solo al abrir (no en cada
    // cambio de `rows` dentro de una misma sesión abierta) para que no se
    // pisen las columnas que el usuario ya eligió al pasar de una consulta a
    // otra sin cerrar el modal — mismo criterio que activeCategoryIdx arriba.
    useEffect(() => {
        if (open) setVisibleKeys(defaultColumnKeys || (isLocalMode ? LOCAL_MODE_DEFAULT_COLUMN_KEYS : DEFAULT_COLUMN_KEYS));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleResizeStart = (e, index, direction = 'right') => {
        e.preventDefault();
        const colKey = columns[index]?.key;
        if (!colKey) return;
        const startX = e.clientX;
        const startWidth = columnWidths[colKey] || 175;
        const onMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = direction === 'left' ? startWidth - deltaX : startWidth + deltaX;
            setColumnWidths(prev => ({ ...prev, [colKey]: Math.max(80, newWidth) }));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return { key: null, direction: 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const processedData = useMemo(() => {
        const result = applyColumnFilters(rowData, {
            columnFilters, textFilters, getCellValue: defaultGetCellValue, isMonoColumn,
        });
        if (!sortConfig.key) return result;
        const { key, direction } = sortConfig;
        return [...result].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return direction === 'asc' ? -1 : 1;
            if (strA > strB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [rowData, columnFilters, textFilters, sortConfig]);

    // Export a Excel con fotos — proceso NUEVO y aislado (no toca los
    // exports complejos de Estatus Nómina ni Cuadros de Vacancia). Reutiliza
    // la misma clave de negocio (`posicion`) que ya usan ambas fuentes de
    // este modal (fetch por nivel/estatus y modo local por mapVacanteRowToEmployeeRow)
    // contra EMPLEADOS_COMPLETOS_SIG — las filas vacantes simplemente no
    // tienen numempleado resoluble y no llevan foto.
    const handleConfirmExportConFotos = async (incluirFotos) => {
        const controller = new AbortController();
        exportConFotosAbortRef.current = controller;
        setIsExportingConFotos(true);
        try {
            const visibleCols = columns.filter(c => c.visible);
            const posiciones = processedData.map(row => row.posicion).filter(Boolean);
            const res = await VacantesService.exportarEmpleadosPorPosicionConFotos(
                {
                    posiciones,
                    columnas: visibleCols.map(c => ({ key: c.key, label: c.label })),
                    incluirFotos,
                    permisoFoto: fotoPermissionCodename,
                },
                { signal: controller.signal }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Error al generar el Excel con fotografías.");
            }
            const extension = res.headers.get("Content-Type")?.includes("macroEnabled") ? "xlsm" : "xlsx";
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Listado_Empleados.${extension}`;
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

    // Ventana de filas realmente montadas en el DOM (ver `viewportHeight` más
    // arriba). Los `<tr>` spacer de DataTable rellenan el resto del alto, así
    // que la medición de abajo (altura real de la tabla) sigue reflejando el
    // total de `processedData`, no sólo lo que está virtualizado.
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 15);
    const endIndex = Math.min(processedData.length, Math.floor((scrollTop + viewportHeight) / rowHeight) + 15);
    const windowedData = useMemo(() => processedData.slice(startIndex, endIndex), [processedData, startIndex, endIndex]);

    // El contenedor de DataTable es flex-1: se estira al alto del padre, así que su
    // scrollHeight refleja ese alto estirado, no el contenido real. Medimos el
    // <table> mismo (su alto es intrínseco al contenido, no se estira con flexbox).
    // +18px cubre el mb-4 y el borde del contenedor que la medición no incluye.
    // Sin paginación: el backend ya entrega todo el listado de una vez, así que
    // aquí solo se muestra completo (el contenedor hace scroll interno, topado
    // por max-h-[70vh], en vez de partir los resultados en páginas).
    useLayoutEffect(() => {
        const el = tableContainerRef.current;
        if (!el) return;
        const table = el.querySelector("table");
        if (!table) return;
        setTableHeight(table.getBoundingClientRect().height + 18);
    }, [processedData, loading]);

    const getColumnLetter = useCallback((index) => {
        let temp = index, letter = "";
        while (temp >= 0) { letter = String.fromCharCode((temp % 26) + 65) + letter; temp = Math.floor(temp / 26) - 1; }
        return letter;
    }, []);

    // Valores alcanzables de una columna dado el resto de filtros (todos
    // EXCEPTO el propio de esa columna).
    const computeReachableValues = useCallback((colKey) => {
        const { [colKey]: _omitCF, ...otherColumnFilters } = columnFilters;
        const { [colKey]: _omitTF, ...otherTextFilters } = textFilters;
        const reachableData = applyColumnFilters(rowData, {
            columnFilters: otherColumnFilters, textFilters: otherTextFilters, getCellValue: defaultGetCellValue, isMonoColumn,
        });
        return getUniqueColumnValues(reachableData, colKey, defaultGetCellValue).map((v) => v.value);
    }, [rowData, columnFilters, textFilters]);

    const openFilterDropdown = (colKey) => {
        if (activeFilterDropdown === colKey) { setActiveFilterDropdown(null); return; }
        setActiveFilterDropdown(colKey);
        setFilterSearchText("");
        setTempSelectedValues(columnFilters[colKey] || computeReachableValues(colKey));
    };

    const applyColumnFilter = (colKey) => {
        const { shouldClear, valuesToCommit } = resolveColumnFilterCommit(tempSelectedValues, reachableValues);
        if (shouldClear) {
            setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
        } else {
            setColumnFilters((prev) => ({ ...prev, [colKey]: valuesToCommit }));
        }
        setActiveFilterDropdown(null);
    };

    const clearColumnFilter = (colKey) => {
        setColumnFilters((prev) => { const next = { ...prev }; delete next[colKey]; return next; });
        setActiveFilterDropdown(null);
    };

    const dropdownUniqueValues = useMemo(() => {
        if (!activeFilterDropdown) return [];
        return getUniqueColumnValues(rowData, activeFilterDropdown, defaultGetCellValue);
    }, [activeFilterDropdown, rowData]);

    const reachableValues = useMemo(
        () => (activeFilterDropdown ? computeReachableValues(activeFilterDropdown) : []),
        [activeFilterDropdown, computeReachableValues]
    );

    const filterDropdownValues = useMemo(() => {
        if (!activeFilterDropdown) {
            return { allVals: [], sliced: [], filteredCount: 0, isAllSelected: false, isPartialSelected: false, visibleVals: [], isVisibleAllSelected: false, isVisiblePartialSelected: false };
        }
        const baseUniqueValues = dropdownUniqueValues;
        const filteredVals = baseUniqueValues.filter((v) => matchesTextCondition(v.value, filterSearchCondition, debouncedFilterSearchText, { normalize: true }));
        return finalizeFilterDropdownValues({
            baseUniqueValues,
            filtered: filteredVals,
            tempSelectedValues,
            committedSelectedValues: columnFilters[activeFilterDropdown] || [],
            reachableValues,
        });
    }, [activeFilterDropdown, dropdownUniqueValues, reachableValues, tempSelectedValues, filterSearchCondition, debouncedFilterSearchText, columnFilters]);

    // Chips de filtros activos (columna + texto libre) para retirarlos con un clic
    const activeFilterChips = useMemo(() => {
        const chips = [];
        Object.keys(columnFilters).forEach((key) => {
            chips.push({ id: `col-${key}`, label: COLUMN_LABEL_BY_KEY[key] || key, remove: () => setColumnFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        Object.entries(textFilters).forEach(([key, f]) => {
            if (!f?.value) return;
            chips.push({ id: `text-${key}`, label: `${COLUMN_LABEL_BY_KEY[key] || key}: "${f.value}"`, remove: () => setTextFilters(prev => { const n = { ...prev }; delete n[key]; return n; }) });
        });
        return chips;
    }, [columnFilters, textFilters]);

    const hasActiveFilters = activeFilterChips.length > 0;
    const clearAllFilters = () => { setColumnFilters({}); setTextFilters({}); setSortConfig({ key: null, direction: 'asc' }); };

    const renderCell = ({ row, col, value, isSticky, leftOffset, isSelected, onClick, onContextMenu }) => {
        const stickyStyle = isSticky ? { position: "sticky", left: leftOffset, zIndex: 20 } : {};
        if (col.key === "fecha_vacancia") {
            const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
            const isClickable = hasValue && row.mov_pos_id !== undefined && row.mov_pos_id !== null;
            const tdClassName = `px-4 text-sm border-r truncate h-[37px] align-middle ${
                isSelected
                    ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
                    : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
            } font-medium ${isClickable ? "cursor-pointer hover:underline hover:text-[#621f32] dark:hover:text-[#bc955c]" : ""}`;
            const handleVacanciaClick = (e) => { onClick(e); if (isClickable) openVacanciaModal(row); };
            return (
                <td key={col.key} onClick={handleVacanciaClick} onContextMenu={onContextMenu} style={stickyStyle} className={tdClassName} title={value}>
                    {hasValue ? (
                        <div className="flex items-center justify-between gap-2">
                            <span>{formatDateEsMx(value)}</span>
                            {isClickable && <MousePointerClick className="size-3 shrink-0 text-[#bc955c]" title="Clic para ver detalle de vacancia" />}
                        </div>
                    ) : <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>}
                </td>
            );
        }
        return (
            <td
                key={col.key}
                onClick={onClick}
                onContextMenu={onContextMenu}
                style={stickyStyle}
                className={`px-4 text-sm border-r truncate h-[37px] align-middle ${
                    isSelected
                        ? "bg-white ring-2 ring-[#621f32] z-10 shadow-md text-[#621f32]"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                } ${isMonoColumn(col.key) ? "font-mono text-[13px] font-semibold" : "font-medium"}`}
                title={value}
            >
                {value !== undefined && value !== null && String(value).trim() !== "" ? (
                    isDateField(col.key)
                        ? formatDateEsMx(value)
                        : (isCurrencyField(col.key) && !isNaN(Number(value)) ? formatCurrency(value) : String(value))
                ) : (
                    <span className="text-slate-300 dark:text-slate-700 italic font-normal">—</span>
                )}
            </td>
        );
    };

    const headerExtra = (
        <div className="flex flex-wrap items-center justify-end gap-2 max-w-[560px]">
            {!isLocalMode && <Pill tone="guinda">Nivel {nivel ?? "—"}</Pill>}
            {!isLocalMode && isCategoryMode ? (
                categoryMatrix ? (
                    <div className="flex items-center gap-2">
                        <Select value={currentTipo ?? undefined} onValueChange={handleTipoChange}>
                            <SelectTrigger className="h-8 w-[128px] rounded-lg border-[#621f32]/20 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-black uppercase text-[#621f32] dark:text-[#bc955c] cursor-pointer">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[1100]">
                                {categoryMatrix.tipos.map(tipo => (
                                    <SelectItem key={tipo} value={tipo} className="text-[11px] font-bold uppercase">
                                        {tipo}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={currentModalidad ?? undefined} onValueChange={handleModalidadChange}>
                            <SelectTrigger className="h-8 w-[180px] rounded-lg border-[#621f32]/20 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-black uppercase text-[#621f32] dark:text-[#bc955c] cursor-pointer">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[1100]">
                                {categoryMatrix.modalidades.map(modalidad => (
                                    <SelectItem key={modalidad} value={modalidad} className="text-[11px] font-bold uppercase">
                                        {modalidad}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        {categoryTabs.map((tab, i) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveCategoryIdx(i)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer ${
                                    activeCategoryIdx === i
                                        ? 'bg-[#621f32] text-white shadow-sm dark:bg-[#bc955c] dark:text-slate-950'
                                        : 'text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )
            ) : (
                !isLocalMode && <Pill tone="dorado">{estatus ?? "—"}</Pill>
            )}
            {ua && <Pill tone="slate">{ua}</Pill>}
            <Pill tone="guinda" className="font-black text-[11px] px-3 py-1.5">
                {loading ? "···" : processedData.length.toLocaleString()} registros
            </Pill>
            <button
                onClick={() => setShowColumnsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold hover:border-[#bc955c]/50 hover:text-[#621f32] dark:hover:text-[#bc955c] transition-all cursor-pointer"
            >
                <Columns3 className="size-3.5" /> Columnas
            </button>
            {canViewPhoto && (
                <button
                    onClick={() => setIsExportFotosModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold hover:border-[#bc955c]/50 hover:text-[#621f32] dark:hover:text-[#bc955c] transition-all cursor-pointer"
                >
                    <Download className="size-3.5" /> Exportar a Excel
                </button>
            )}
            {hasActiveFilters && (
                <button onClick={clearAllFilters} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-[11px] font-black uppercase cursor-pointer">
                    <X className="size-3.5" /> Limpiar filtros
                </button>
            )}
        </div>
    );

    return (
        <>
            <ModalShell
                open={open}
                onClose={() => onOpenChange(false)}
                size="xl"
                resizable
                minWidth={640}
                maxWidth={1800}
                icon={LayoutGrid}
                eyebrow={isLocalMode ? "Detalle" : "Listado"}
                title={isLocalMode ? (title || "Detalle de Vacantes") : "Listado de Empleados"}
                subtitle={isLocalMode ? "Consulta detallada del cuadro de vacancia" : "Exploración y filtrado de capital humano"}
                headerExtra={headerExtra}
                bodyClassName="p-3 sm:p-4"
            >
                <div className="flex flex-col gap-2">
                    {/* Chips de filtros activos */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2">
                            {activeFilterChips.map(chip => (
                                <span key={chip.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-[#621f32]/8 dark:bg-[#bc955c]/10 border border-[#621f32]/15 dark:border-[#bc955c]/20 text-[#621f32] dark:text-[#bc955c] rounded-full text-[11px] font-bold">
                                    {chip.label}
                                    <button onClick={chip.remove} className="p-0.5 rounded-full hover:bg-[#621f32]/15 dark:hover:bg-[#bc955c]/20 cursor-pointer">
                                        <X className="size-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {error ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 bg-red-50/40 dark:bg-red-950/10 rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900/30">
                            <div className="size-16 bg-red-100/40 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <X className="size-8" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">Error de carga</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md font-medium">{error}</p>
                            <button onClick={fetchData} className="mt-6 px-8 py-3 bg-[#621f32] text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-[#4a1726] transition-all shadow-lg shadow-[#621f32]/30 active:scale-95 cursor-pointer">
                                Reintentar ahora
                            </button>
                        </div>
                    ) : (
                        <div
                            className="flex flex-col max-h-[70vh] rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
                            style={{ height: tableHeight ? `${tableHeight}px` : "70vh" }}
                        >
                            <DataTable
                                containerRef={tableContainerRef}
                                fillHeight
                                fillWidth
                                edgeToEdge
                                stickyColumnKeys={["posicion"]}
                                onScroll={setScrollTop}
                                columns={columns}
                                columnFilters={columnFilters}
                                setColumnFilters={setColumnFilters}
                                textFilters={textFilters}
                                setTextFilters={setTextFilters}
                                activeConditionDropdown={activeConditionDropdown}
                                setActiveConditionDropdown={setActiveConditionDropdown}
                                selectedCell={selectedCell}
                                onSelectCell={setSelectedCell}
                                onCellContextMenu={(e, value, rect) => setContextMenu({ x: e.clientX, y: e.clientY, value, rect })}
                                onShowRecord={(row) => setSelectedEmployeeRecord(row)}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                onOpenFilter={openFilterDropdown}
                                onResizeStart={handleResizeStart}
                                getColumnLetter={getColumnLetter}
                                isMonoColumn={isMonoColumn}
                                isPending={false}
                                isLoading={loading}
                                loadingVariant="skeleton"
                                loadingMessage="Consultando base de datos..."
                                data={windowedData}
                                startIndex={startIndex}
                                endIndex={endIndex}
                                totalCount={processedData.length}
                                rowHeight={rowHeight}
                                getRowId={(row, i) => {
                                    const idEmp = (row.id_empleado ?? '').toString().trim();
                                    const pos = (row.posicion ?? '').toString().trim();
                                    return idEmp || (pos ? `${pos}-${i}` : i);
                                }}
                                renderCell={renderCell}
                            />
                        </div>
                    )}
                </div>
            </ModalShell>

            <AnimatePresence>
                {activeFilterDropdown && (
                    <ColumnFilterDropdown
                        open={!!activeFilterDropdown}
                        columnKey={activeFilterDropdown}
                        columnLabel={COLUMN_LABEL_BY_KEY[activeFilterDropdown]}
                        isDate={false}
                        data={rowData}
                        getCellValue={defaultGetCellValue}
                        filters={filters}
                        dropdownValues={filterDropdownValues}
                        onApply={() => applyColumnFilter(activeFilterDropdown)}
                        onClear={() => clearColumnFilter(activeFilterDropdown)}
                        onClose={() => setActiveFilterDropdown(null)}
                        zIndexClass="z-[1100]"
                    />
                )}
            </AnimatePresence>

            <ColumnsSelectorModal
                isOpen={showColumnsModal}
                onClose={() => setShowColumnsModal(false)}
                visibleKeys={visibleKeys}
                setVisibleKeys={setVisibleKeys}
                availableColumns={availableColumns}
                defaultKeys={defaultColumnKeys || (isLocalMode ? LOCAL_MODE_DEFAULT_COLUMN_KEYS : DEFAULT_COLUMN_KEYS)}
            />

            <EmployeeRecordModal
                isOpen={!!selectedEmployeeRecord}
                onClose={() => setSelectedEmployeeRecord(null)}
                record={selectedEmployeeRecord}
                columns={restrictColumnsTo ? availableColumns : null}
                fieldClickHandlers={{ fecha_vacancia: (r) => openVacanciaModal(r) }}
                canViewPhoto={canViewPhoto}
            />

            <CopyCellMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} />

            <VacanciaDetalleModal
                open={isVacanciaModalOpen}
                onClose={() => setIsVacanciaModalOpen(false)}
                detalle={vacanciaDetalle}
                isLoading={isVacanciaLoading}
            />

            <ExportConFotosModal
                open={isExportFotosModalOpen}
                onClose={() => setIsExportFotosModalOpen(false)}
                onConfirm={handleConfirmExportConFotos}
                isExporting={isExportingConFotos}
                onCancelExport={handleCancelExportConFotos}
                rowCount={processedData.length}
            />
        </>
    );
}
