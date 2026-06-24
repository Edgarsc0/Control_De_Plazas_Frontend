import PlantillaEmpleadosDetalle from "./ClientComponent"
import { VacantesService } from "@/services/vacantes.service";
import { Suspense } from 'react';
import PlantillaEmpleadosSkeleton from '@/components/ui/PlantillaEmpleadosSkeleton';

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
        geograficaResult,
        movPosResult
    ] = await criticalDataPromise;

    const resumen = resumenResult.status === 'fulfilled' ? resumenResult.value : null;
    const detalle = detalleResult.status === 'fulfilled' ? (detalleResult.value || []) : [];
    const estatusPorNivelUa = estatusResult.status === 'fulfilled' ? (estatusResult.value || { por_nivel: {}, por_ua: {} }) : { por_nivel: {}, por_ua: {} };
    const distribucionGeografica = geograficaResult.status === 'fulfilled' ? (geograficaResult.value || []) : [];
    const movPosData = movPosResult.status === 'fulfilled' ? (movPosResult.value || []) : [];

    return (
        <PlantillaEmpleadosDetalle
            resumen={resumen}
            detalle={detalle}
            estatusPorNivelUa={estatusPorNivelUa}
            distribucionGeografica={distribucionGeografica}
            movPosData={movPosData}
            secondaryDataPromise={secondaryDataPromise}
        />
    );
}

export default async function PlantillaEmpleadosPage() {
    const criticalDataPromise = Promise.allSettled([
        parseJsonResponse(VacantesService.getEmpleadosCompletosEstatusResumen(), "resumen"),
        parseJsonResponse(VacantesService.getEmpleadosCompletosActivosDetalle(), "detalle"),
        parseJsonResponse(VacantesService.getEmpleadosEstatusPorNivelUa(), "estatus por nivel y UA"),
        parseJsonResponse(VacantesService.getEmpleadosDistribucionGeografica(), "distribución geográfica"),
        parseJsonResponse(VacantesService.getMovPosDetalle(), "mov pos detalle")
    ]);

    // Datos secundarios: solo los usan los tabs "Bajas" y "Cuadros de Vacancia".
    // No se esperan aquí — se pasan como promesa al cliente, que los resuelve
    // (vía `use()`) recién cuando esos tabs se abren, sin bloquear el resto.
    const secondaryDataPromise = Promise.allSettled([
        parseJsonResponse(VacantesService.getBajasSig(), "bajas"),
        parseJsonResponse(VacantesService.getBajasMotivos(), "bajas motivos"),
        parseJsonResponse(VacantesService.getBajasHistorico(), "bajas historico"),
        parseJsonResponse(VacantesService.getCuadroVacancia(), "cuadro vacancia"),
        parseJsonResponse(VacantesService.getDesgloseJerarquico(), "desglose jerarquico")
    ]);

    return (
        <Suspense fallback={<PlantillaEmpleadosSkeleton />}>
            <PlantillaEmpleadosData criticalDataPromise={criticalDataPromise} secondaryDataPromise={secondaryDataPromise} />
        </Suspense>
    );
}
