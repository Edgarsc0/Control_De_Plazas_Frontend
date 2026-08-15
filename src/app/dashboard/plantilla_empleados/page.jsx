import PlantillaEmpleadosDetalle from "./ClientComponent"
import { VacantesService } from "@/services/vacantes.service";
import { Suspense } from 'react';
import PlantillaEmpleadosSkeleton from '@/components/ui/PlantillaEmpleadosSkeleton';
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

const PLANTILLA_TAB_PERMISSIONS = [
    PERMISSIONS.VIEW_PLANTILLA_DETALLE,
    PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA,
    PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES,
    PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS,
    PERMISSIONS.VIEW_PLANTILLA_BAJAS,
    PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA,
    PERMISSIONS.VIEW_PLANTILLA_CATALOGOS,
];

export const dynamic = 'force-dynamic';

export const metadata = { title: "Plantilla de Empleados" };

const parseJsonResponse = (responsePromise, label) =>
    responsePromise
        .then(res => (res && res.ok ? res.json() : null))
        .catch(err => {
            console.error(`Error fetching ${label}:`, err);
            return null;
        });

// Datos críticos: usados por los tabs default (Detalle, Estatus, Movimientos).
// Se esperan aquí para que el Suspense de arriba los bloquee — son rápidos y
// son lo primero que el usuario ve.
async function PlantillaEmpleadosData({ criticalDataPromise, secondaryDataPromise }) {
    const [
        resumenResult,
        detalleResult,
        estatusResult,
        geograficaResult
    ] = await criticalDataPromise;

    const resumen = resumenResult.status === 'fulfilled' ? resumenResult.value : null;
    const detalle = detalleResult.status === 'fulfilled' ? (detalleResult.value || []) : [];
    const estatusPorNivelUa = estatusResult.status === 'fulfilled' ? (estatusResult.value || { por_nivel: {}, por_ua: {} }) : { por_nivel: {}, por_ua: {} };
    const distribucionGeografica = geograficaResult.status === 'fulfilled' ? (geograficaResult.value || []) : [];

    return (
        <PlantillaEmpleadosDetalle
            resumen={resumen}
            detalle={detalle}
            estatusPorNivelUa={estatusPorNivelUa}
            distribucionGeografica={distribucionGeografica}
            secondaryDataPromise={secondaryDataPromise}
        />
    );
}

export default async function PlantillaEmpleadosPage() {
    // "mov pos detalle" (~970KB) vivía aquí pero solo lo usa el tab
    // "Movimientos" — no el tab "Detalle" con el que arranca la página.
    // Bloqueaba el primer render de TODOS los usuarios (incluidos quienes
    // nunca visitan "Movimientos") esperando ~1MB que no iban a usar. Se
    // mueve a `secondaryDataPromise`, mismo patrón ya usado para Bajas/Cuadros
    // de Vacancia (ver comentario de abajo).
    const criticalDataPromise = Promise.allSettled([
        parseJsonResponse(VacantesService.getEmpleadosCompletosEstatusResumen(), "resumen"),
        parseJsonResponse(VacantesService.getEmpleadosCompletosActivosDetalle(), "detalle"),
        parseJsonResponse(VacantesService.getEmpleadosEstatusPorNivelUa(), "estatus por nivel y UA"),
        parseJsonResponse(VacantesService.getEmpleadosDistribucionGeografica(), "distribución geográfica")
    ]);

    // Datos secundarios: solo los usan los tabs "Bajas", "Cuadros de Vacancia"
    // y "Movimientos". No se esperan aquí — se pasan como promesa al cliente,
    // que los resuelve (vía `use()`) recién cuando esos tabs se abren, sin
    // bloquear el resto.
    const secondaryDataPromise = Promise.allSettled([
        parseJsonResponse(VacantesService.getBajasSig(), "bajas"),
        parseJsonResponse(VacantesService.getBajasMotivos(), "bajas motivos"),
        parseJsonResponse(VacantesService.getBajasHistorico(), "bajas historico"),
        parseJsonResponse(VacantesService.getCuadroVacancia(), "cuadro vacancia"),
        parseJsonResponse(VacantesService.getDesgloseJerarquico(), "desglose jerarquico"),
        parseJsonResponse(VacantesService.getDesgloseJerarquicoOcupados(), "desglose jerarquico ocupados"),
        parseJsonResponse(VacantesService.getConteoPlazasHistoricoSerie(), "conteo plazas historico serie"),
        parseJsonResponse(VacantesService.getMovPosDetalle(), "mov pos detalle")
    ]);

    return (
        <RequirePermission permission={PLANTILLA_TAB_PERMISSIONS}>
            <Suspense fallback={<PlantillaEmpleadosSkeleton />}>
                <PlantillaEmpleadosData criticalDataPromise={criticalDataPromise} secondaryDataPromise={secondaryDataPromise} />
            </Suspense>
        </RequirePermission>
    );
}
