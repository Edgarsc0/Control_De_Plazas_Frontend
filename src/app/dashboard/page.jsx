import Dashboard from './ClientComponent';
import { VacantesService } from '@/services/vacantes.service';
import { Suspense } from 'react';
import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { OcupacionService } from '@/services/ocupacion.service';
import { cookies } from 'next/headers';
import { ControlGestionService } from '@/services/control_gestion.service';
export const dynamic = 'force-dynamic';

async function DashboardData() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  // Fetch all dashboard data concurrently
  const [
    vacantesResult,
    empleadosResult,
    ocupacionResult,
    oficiosResult
  ] = await Promise.allSettled([
    VacantesService.getVacantesPorNivelResumen().then(res => res.json()),
    VacantesService.getEmpleadosCompletosEstatusResumen().then(res => res.json()),
    OcupacionService.getOcupacionPorOficios({
      headers: { Authorization: `Token ${token}` },
    }).then(res => res.ok ? res.json() : { filas: [], columnas: [] }),
    ControlGestionService.getOficiosTurnados({
      idUnidadResponsable: 11,
      fechaInicio: null,
      fechaFin: null,
      folio: null,
      ordenamiento: 'fecha',
      direccion: 'DESC',
      limite: 10000,
      offset: 0,
      idUnidadResponsableUsuario: '1',
      idUsuario: 9999,
      idUsuarioRol: 1,
      skipCatalogCross: true, // Optimización: saltarse el cruce de catálogos en dashboard principal
    })
  ]);

  const resumenVacantes = vacantesResult.status === 'fulfilled' ? vacantesResult.value : [];
  const resumenEmpleados = empleadosResult.status === 'fulfilled' ? empleadosResult.value : [];
  const resumenOcupacion = ocupacionResult.status === 'fulfilled' ? ocupacionResult.value : { filas: [], columnas: [] };
  const oficiosTurnadosData = oficiosResult.status === 'fulfilled' ? oficiosResult.value : { status: 500, model: { distribucionPorStatus: [], detalleTurnados: [] } };

  return (
    <Dashboard
      resumenVacantes={resumenVacantes}
      resumenEmpleados={resumenEmpleados}
      ocupacion={resumenOcupacion}
      oficiosTurnados={oficiosTurnadosData}
    />
  );
}

export default function DashboardServerCompoment() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  );
}
