"use client";

import { useEffect, useState } from "react";
import {
  Stamp,
  Users,
  FileText,
  GitCompareArrows,
  AlertTriangle,
  Eye,
  Calendar,
  Moon,
  Sun,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import ModalShell, { Field, SectionLabel, Pill } from "@/components/shared/ModalShell";
import ListadoEmpleadosDemo, { MOCK_EMPLEADOS } from "./_components/ListadoEmpleadosDemo";

const PROPOSALS = [
  {
    id: "expediente-plaza",
    icon: Stamp,
    title: "Expediente de Plaza",
    replaces: "EmployeeRecordModal (EmployeesModal.jsx)",
    before: "Ya usaba guinda/dorado, pero mezclaba font-serif + bordes punteados + sello girado.",
    size: "md",
  },
  {
    id: "listado-empleados",
    icon: Users,
    title: "Listado de Empleados",
    replaces: "EmployeesModal · RegistrosOficioModal · EmpleadosTableModal",
    before: "rounded-[3.5rem] o carpeta con sidebar; 3 implementaciones del mismo concepto (tabla+filtros).",
    size: "xl",
  },
  {
    id: "expediente-oficio",
    icon: FileText,
    title: "Expediente Digital de Oficio",
    replaces: "OficioDetailModal",
    before: "rounded-[3.5rem] (el radio más extremo del sistema), backdrop negro, sin dark mode.",
    size: "xl",
  },
  {
    id: "comparacion",
    icon: GitCompareArrows,
    title: "Alineación Organizacional",
    replaces: "AlineacionDetalleModal",
    before: "createPortal + AnimatePresence propio, rounded-2xl, backdrop slate-950/75.",
    size: "md",
  },
  {
    id: "confirmacion",
    icon: AlertTriangle,
    title: "Confirmar acción",
    replaces: "PrioridadNivelJerarquicoModal · confirmaciones de organigrama · sync ZAFIRO",
    before: "3 paletas distintas para lo mismo: ámbar puro, rose, y guinda+ámbar+font-mono mezclados.",
    size: "sm",
  },
  {
    id: "celda-mini",
    icon: Eye,
    title: "Valor completo de celda",
    replaces: "4 copias casi idénticas en Bajas, Movimientos, PlantillaDetalle, MovPersonal",
    before: "Mismo JSX copy-pasteado 4 veces — ya divergiendo en detalles menores sin que nadie lo note.",
    size: "sm",
  },
  {
    id: "selector-fecha",
    icon: Calendar,
    title: "Filtrar Bitácora",
    replaces: "bitacora-date-modal — MovimientosPersonalTab",
    before: "Es el único de los 30 con bottom sheet en móvil. Aquí ese patrón deja de ser la excepción y se vuelve la regla.",
    size: "sm",
  },
];

function ExpedienteFields({ record }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-[#621f32]/[0.03] dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
        <Field label="No. Empleado" value={record.num_empleado} mono />
        <Field label="Posición" value={record.posicion} mono />
        <Field label="RFC" value={record.rfc} mono />
        <Field label="Nivel" value={record.nivel} mono />
      </div>
      <div>
        <SectionLabel>Datos generales</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Nombre" value={record.nombre} />
          <Field label="CURP" value={record.curp} mono />
          <Field label="Fecha de ingreso" value={record.fecha_ingreso} />
          <Field label="Estatus nómina" value={record.estatus} highlight />
          <Field label="Tipo de contratación" value={record.tipo_contratacion} />
        </div>
      </div>
      <div>
        <SectionLabel>Adscripción</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Unidad administrativa" value={record.ua} />
          <Field label="Puesto funcional" value={record.puesto_funcional} />
          <Field label="Ubicación" value={record.ubicacion} />
        </div>
      </div>
    </div>
  );
}

export default function PruebaPage() {
  const [openId, setOpenId] = useState(null);
  const [expedienteRecord, setExpedienteRecord] = useState(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 mb-10">
        <Pill tone="dorado">Propuesta de diseño · No afecta producción</Pill>
        <h1 className="text-2xl sm:text-4xl font-black text-[#621f32] dark:text-[#f0d9b8] tracking-tight">
          Homogenización de modals de detalle
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
          La auditoría (<code className="text-[#621f32] dark:text-[#e3c793] font-semibold">AUDITORIA_MODALS_DETALLE.md</code>) encontró 30
          modals con 6 radios de esquina distintos, 4 backdrops distintos y hasta 3 paletas de color ajenas a la
          institucional. Esta selección de 7 usa un único componente
          (<code className="text-[#621f32] dark:text-[#e3c793] font-semibold">ModalShell</code>) que reemplazaría las
          implementaciones actuales. Guinda <span className="font-mono text-[#621f32] dark:text-[#e3c793]">#621f32</span> y
          dorado <span className="font-mono text-[#621f32] dark:text-[#e3c793]">#bc955c</span> aparecen en cada uno, siempre en el mismo lugar.
        </p>
        <button
          onClick={() => setDark((d) => !d)}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-full border border-[#621f32]/20 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#621f32] dark:text-[#e3c793] hover:bg-[#621f32]/5 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {dark ? "Ver en modo claro" : "Ver en modo oscuro"}
        </button>
      </div>

      {/* Tokens de diseño */}
      <div className="mb-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#bc955c] via-[#621f32] to-[#bc955c]" />
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <SectionLabel>Color</SectionLabel>
            <div className="flex flex-col gap-2">
              {[
                ["Guinda — primario, títulos, iconos", "#621f32"],
                ["Dorado — acento, franja, iconos", "#bc955c"],
                ["Ámbar — solo estados de advertencia", "#d97706"],
                ["Rosa — solo estados destructivos", "#e11d48"],
              ].map(([label, hex]) => (
                <div key={hex} className="flex items-center gap-2.5">
                  <span className="size-5 rounded-md border border-black/10 shrink-0" style={{ background: hex }} />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Forma</SectionLabel>
            <ul className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 space-y-1.5">
              <li>Un solo radio: <span className="font-mono text-slate-700 dark:text-slate-300">rounded-3xl</span> (antes 6 valores distintos)</li>
              <li>Backdrop único: <span className="font-mono text-slate-700 dark:text-slate-300">slate-950/50 blur-sm</span></li>
              <li>Franja "folio" guinda→dorado, siempre presente arriba</li>
              <li>z-index fijo: <span className="font-mono text-slate-700 dark:text-slate-300">1000</span> (antes iban de z-50 a z-[100000000])</li>
            </ul>
          </div>
          <div>
            <SectionLabel>Comportamiento</SectionLabel>
            <ul className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 space-y-1.5">
              <li>Móvil: bottom sheet siempre (antes solo 1 de 30 lo hacía)</li>
              <li>Escritorio: centrado, tamaños sm/md/lg/xl</li>
              <li>Animación única vía <span className="font-mono text-slate-700 dark:text-slate-300">motion/react</span></li>
              <li>Dark mode en los 7, sin excepción</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Galería */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROPOSALS.map((p) => (
          <button
            key={p.id}
            onClick={() => (p.id === "expediente-plaza" ? setExpedienteRecord(MOCK_EMPLEADOS[0]) : setOpenId(p.id))}
            className="group text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 hover:border-[#bc955c]/50 hover:shadow-lg transition-all cursor-pointer flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-xl bg-[#621f32] flex items-center justify-center">
                <p.icon className="size-5 text-[#bc955c]" />
              </div>
              <ArrowUpRight className="size-4 text-slate-300 group-hover:text-[#621f32] dark:group-hover:text-[#bc955c] transition-colors" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{p.title}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">
                Reemplaza: {p.replaces}
              </p>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-bold text-rose-500">Antes: </span>
              {p.before}
            </p>
          </button>
        ))}
      </div>

      {/* Modals */}
      <ModalShell
        open={openId === "expediente-plaza"}
        onClose={() => setOpenId(null)}
        size="md"
        icon={Stamp}
        eyebrow="Expediente"
        title="Expediente de Plaza"
        subtitle={`No. Empleado ${MOCK_EMPLEADOS[0].num_empleado}`}
      >
        <ExpedienteFields record={MOCK_EMPLEADOS[0]} />
      </ModalShell>

      {/* Expediente "en vivo": lo abre el ícono de ojo dentro del Listado de Empleados,
          apilado sobre ese modal — misma pieza que la tarjeta de arriba, con datos de la fila. */}
      <ModalShell
        open={!!expedienteRecord}
        onClose={() => setExpedienteRecord(null)}
        size="md"
        icon={Stamp}
        eyebrow="Expediente"
        title={expedienteRecord?.nombre || "Expediente de Plaza"}
        subtitle={expedienteRecord ? `No. Empleado ${expedienteRecord.num_empleado}` : ""}
      >
        {expedienteRecord && <ExpedienteFields record={expedienteRecord} />}
      </ModalShell>

      <ModalShell
        open={openId === "listado-empleados"}
        onClose={() => setOpenId(null)}
        size="xl"
        icon={Users}
        eyebrow="Listado"
        title="Listado de Empleados"
        subtitle="Filtros por columna estilo Excel — misma DataTable y ColumnFilterDropdown de producción"
      >
        <ListadoEmpleadosDemo onShowRecord={(row) => setExpedienteRecord(row)} />
      </ModalShell>

      <ModalShell
        open={openId === "expediente-oficio"}
        onClose={() => setOpenId(null)}
        size="xl"
        icon={FileText}
        eyebrow="Expediente digital"
        title="OF-2026-00187"
        subtitle="Turnado a Dirección General de Aduanas"
        footer={
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#621f32] text-white text-xs font-bold hover:bg-[#4a1726] transition-colors cursor-pointer">
            <ExternalLink className="size-3.5" /> Abrir documento
          </button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 aspect-[3/4] flex flex-col items-center justify-center gap-3 text-slate-300 dark:text-slate-600">
            <FileText className="size-12" />
            <span className="text-[10px] font-black uppercase tracking-widest">Visor de documento</span>
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>Asunto</SectionLabel>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Solicitud de validación de plantilla para el cuarto trimestre, con anexo de movimientos de personal
                eventual en la Aduana de Nuevo Laredo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Remitente" value="Lic. Patricia Nuñez Coss" />
              <Field label="Dirigido a" value="Dir. Gral. de Aduanas" highlight />
              <Field label="Fecha de recepción" value="02/07/2026" />
              <Field label="Estatus" value="Recibido" highlight />
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={openId === "comparacion"}
        onClose={() => setOpenId(null)}
        size="md"
        icon={GitCompareArrows}
        eyebrow="Comparación"
        title="Alineación Organizacional"
        subtitle="MOV_POS vs. EMPLEADOS_COMPLETOS_SIG"
      >
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase text-slate-400 font-black tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Campo</th>
                <th className="px-4 py-2.5">MOV_POS</th>
                <th className="px-4 py-2.5">SIG</th>
                <th className="px-4 py-2.5 text-center">Coincide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ["Unidad administrativa", "Aduana de Nuevo Laredo", "Aduana de Nuevo Laredo", true],
                ["Puesto funcional", "Jefe de Departamento", "Jefe de Depto. Operación", false],
                ["Nivel", "23", "23", true],
                ["Estatus", "Activo", "Licencia", false],
              ].map(([campo, a, b, ok]) => (
                <tr
                  key={campo}
                  className={!ok ? "bg-rose-100 dark:bg-rose-950/40 border-l-4 border-rose-600" : ""}
                >
                  <td className={`px-4 py-2.5 font-bold ${!ok ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}`}>{campo}</td>
                  <td className={`px-4 py-2.5 ${!ok ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}>{a}</td>
                  <td className={`px-4 py-2.5 ${!ok ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}>{b}</td>
                  <td className="px-4 py-2.5 text-center">
                    {ok ? (
                      <CheckCircle2 className="inline size-4 text-emerald-500" />
                    ) : (
                      <span className="inline-flex items-center justify-center size-5 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-sm shadow-rose-600/30">✕</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> 2 de 4 campos no coinciden entre las fuentes.
        </p>
      </ModalShell>

      <ModalShell
        open={openId === "confirmacion"}
        onClose={() => setOpenId(null)}
        size="sm"
        icon={AlertTriangle}
        eyebrow="Advertencia"
        title="Confirmar acción"
        footer={
          <>
            <button onClick={() => setOpenId(null)} className="px-4 py-2 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button className="px-4 py-2 rounded-full bg-[#621f32] text-white text-xs font-bold hover:bg-[#4a1726] transition-colors cursor-pointer">
              Confirmar
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Al sobrescribir la prioridad del nivel jerárquico se recalculará el organigrama para todas las unidades
          dependientes. Esta acción no se puede deshacer.
        </p>
      </ModalShell>

      <ModalShell
        open={openId === "celda-mini"}
        onClose={() => setOpenId(null)}
        size="sm"
        icon={Eye}
        eyebrow="Valor completo"
        title="Observaciones"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Personal en proceso de reasignación derivado del proyecto de reducción de plazas eventuales 2024. Pendiente
          confirmar fecha efectiva con la Dirección de Recursos Humanos.
        </p>
      </ModalShell>

      <ModalShell
        open={openId === "selector-fecha"}
        onClose={() => setOpenId(null)}
        size="sm"
        icon={Calendar}
        eyebrow="Filtro"
        title="Filtrar Bitácora"
        subtitle="Selecciona un rango de fechas"
        footer={
          <button className="w-full px-4 py-2.5 rounded-full bg-[#621f32] text-white text-xs font-bold hover:bg-[#4a1726] transition-colors cursor-pointer">
            Aplicar filtro
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde</span>
              <input type="date" className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasta</span>
              <input type="date" className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Hoy", "Últimos 7 días", "Este mes"].map((r) => (
              <button key={r} className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-[#621f32]/20 text-[#621f32] dark:text-[#e3c793] dark:border-slate-700 hover:bg-[#621f32]/5 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                {r}
              </button>
            ))}
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
