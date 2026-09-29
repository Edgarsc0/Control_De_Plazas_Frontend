import { VacantesService } from "@/services/vacantes.service";

// Piezas para abrir el expediente de una BAJA con EmployeeRecordModal igual en todos lados
// (widget Buscar baja, Árbol de movimientos).

// Las bajas (BAJAS_SIG) llegan completas en un solo GET y no hay búsqueda del
// lado del servidor: se baja una vez (caché corto compartido) y se filtra aquí.
const TTL_MS = 5 * 60 * 1000;
let cache = null;
export function cargarBajas() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.promise;
  const promise = VacantesService.getBajasSig()
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudieron cargar las bajas."))))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch((err) => { cache = null; throw err; });
  cache = { t: Date.now(), promise };
  return promise;
}

// Mismo mapeo que `buildBajaRecord` de PlantillaDetalleTab: el expediente se ve
// igual sin importar desde dónde se abrió.
export const buildBajaRecord = (b) => ({
  ...b,
  id_empleado: b.no_empleado,
  nombres: b.nombre_completo,
  nivel: b.nivel || b.nivel_tabular,
});

// Mismas claves que `dataColumns` en BajasTab.jsx (misma fuente, BAJAS_SIG):
// EmployeeRecordModal, sin `columns` propias, asume que `record` es una fila
// de Plantilla Detalle y filtra por ese catálogo — con una fila de bajas
// (claves distintas) eso deja casi todo en blanco.
export const BAJA_RECORD_COLUMNS = [
  { key: "posicion", label: "Posición" },
  { key: "no_empleado", label: "No. Empleado" },
  { key: "nombre_completo", label: "Nombre Completo" },
  { key: "motivo_descr", label: "Motivo" },
  { key: "fecha_efectiva", label: "Fecha Efectiva" },
  { key: "unidad_admon", label: "Unidad Admon" },
  { key: "departamento", label: "Departamento" },
  { key: "puesto", label: "Puesto" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "accion_descr", label: "Acción" },
  { key: "nomina_status", label: "Estatus Nómina" },
  { key: "humanos_status", label: "Estatus RH" },
  { key: "partida", label: "Partida" },
  { key: "nivel", label: "Nivel" },
  { key: "rfc", label: "RFC" },
  { key: "curp", label: "CURP" },
  { key: "genero", label: "Género" },
  { key: "primer_apellido", label: "Primer Apellido" },
  { key: "segundo_apellido", label: "Segundo Apellido" },
  { key: "accion", label: "Cód. Acción" },
  { key: "motivo", label: "Cód. Motivo" },
  { key: "sequencia_efectiva", label: "Secuencia Efectiva" },
  { key: "fecha_aplicacion", label: "Fecha Aplicación" },
  { key: "unidad_general", label: "Unidad General" },
  { key: "dependencia_directa", label: "Dependencia Directa" },
  { key: "plan_salarial", label: "Plan Salarial" },
  { key: "grado", label: "Grado" },
  { key: "escala", label: "Escala" },
  { key: "puesto_presupuestal", label: "Puesto Presupuestal" },
  { key: "nivel_tabular", label: "Nivel Tabular" },
  { key: "grupo_de_pago", label: "Grupo de Pago" },
  { key: "beneficios", label: "Beneficios" },
  { key: "smb", label: "SMB" },
  { key: "inmueble", label: "Inmueble" },
  { key: "fecha_prevista", label: "Fecha Prevista" },
  { key: "ultima_actualizacion", label: "Última Actualización" },
  { key: "ultimo_operador", label: "Último Operador" },
  { key: "ultima_fecha_ingreso", label: "Última Fecha Ingreso" },
  { key: "fecha_ingreso", label: "Fecha Ingreso" },
  { key: "grupo_trabajo", label: "Grupo Trabajo" },
  { key: "codigo_grupo", label: "Código Grupo" },
  { key: "fecha_asignacion", label: "Fecha Asignación" },
  { key: "id_persona", label: "ID Persona" },
  { key: "nivel1", label: "Nivel 1" },
  { key: "unidad_administrativa", label: "Unidad Administrativa" },
  { key: "fecha_entrada_posicion", label: "Fecha Entrada Posición" },
  { key: "fecha_posicion", label: "Fecha Posición" },
];
