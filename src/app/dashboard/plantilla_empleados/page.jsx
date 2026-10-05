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

// Datos críticos: usados por los tabs default (Estatus, Mapa) y por el
// header de "Detalle" (resumen). Se esperan aquí para que el Suspense de
// arriba los bloquee — son rápidos y son lo primero que el usuario ve.
//
// `detalle` (empleados_completos_activos_detalle) YA NO viaja por acá: era,
// junto con mov_pos_detalle, el mayor contribuyente a los ~89MB del
// documento RSC medidos en PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md
// — se mueve a fetch client-side cacheado en IndexedDB dentro de
// `ClientComponent` (mismo tratamiento que ya recibieron Bajas y Mov.
// Posiciones). `EstatusTab`/`PlantillaDetalleTab`/`MovimientosTab` lo siguen
// recibiendo como prop, pero ahora ese prop lo llena `ClientComponent` desde
// su propio estado (`detalleData`), no desde este Server Component.
async function PlantillaEmpleadosData({ criticalDataPromise }) {
    const [
        resumenResult,
        estatusResult,
        geograficaResult
    ] = await criticalDataPromise;

    const resumen = resumenResult.status === 'fulfilled' ? resumenResult.value : null;
    const estatusPorNivelUa = estatusResult.status === 'fulfilled' ? (estatusResult.value || { por_nivel: {}, por_ua: {} }) : { por_nivel: {}, por_ua: {} };
    const distribucionGeografica = geograficaResult.status === 'fulfilled' ? (geograficaResult.value || []) : [];

    return (
        <PlantillaEmpleadosDetalle
            resumen={resumen}
            estatusPorNivelUa={estatusPorNivelUa}
            distribucionGeografica={distribucionGeografica}
        />
    );
}

export default async function PlantillaEmpleadosPage() {
    const criticalDataPromise = Promise.allSettled([
        parseJsonResponse(VacantesService.getEmpleadosCompletosEstatusResumen(), "resumen"),
        parseJsonResponse(VacantesService.getEmpleadosEstatusPorNivelUa(), "estatus por nivel y UA"),
        parseJsonResponse(VacantesService.getEmpleadosDistribucionGeografica(), "distribución geográfica")
    ]);

    // Los 4 datasets de "Cuadros de Vacancia" (cuadro_vacancia,
    // desglose_jerarquico[_ocupados], conteo_plazas_historico_serie) YA NO
    // viajan por acá: aunque no se esperaban en este Server Component,
    // arrancarlos aquí (una de ellas ~975KB) hacía que Next.js no cerrara el
    // stream RSC del documento hasta que las 4 resolvían — retrasando CADA
    // carga de la página sin importar qué tab estuviera abierto. Reportado
    // 2026-10-05: ~2.2s extra de servidor-a-servidor en toda carga de
    // Plantilla de Empleados, incluso sin abrir nunca "Cuadros de Vacancia".
    // Ahora `CuadrosVacanciaSection` (ClientComponent.jsx) las pide client-side
    // (cargarFuente, mismo cache de 5 min que ya usan los widgets de tablero
    // equivalentes) solo cuando ese tab se abre — igual que "Bajas" y "Mov.
    // Posiciones" (ver comentario de abajo).
    //
    // "Bajas" y "Mov. Posiciones" (mov_pos_detalle) tampoco viajan por acá: se
    // movieron a fetch client-side cacheado en IndexedDB (ver
    // PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md) — mandarlos
    // embebidos en el documento RSC en cada carga/refresh era la causa
    // principal de los ~89MB/17-21s medidos en ese plan. `BajasTab` y
    // `MovimientosTab` ahora hacen su propio fetch (cache-first) vía
    // `VacantesService`, igual que ya hacía `MovimientosPersonalTab`.

    return (
        <RequirePermission permission={PLANTILLA_TAB_PERMISSIONS}>
            <Suspense fallback={<PlantillaEmpleadosSkeleton />}>
                <PlantillaEmpleadosData criticalDataPromise={criticalDataPromise} />
            </Suspense>
        </RequirePermission>
    );
}
