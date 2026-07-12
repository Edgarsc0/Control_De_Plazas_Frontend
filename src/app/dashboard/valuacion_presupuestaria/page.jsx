import ClientComponent from './ClientComponent';
import { Suspense } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import Skeleton from './Skeleton';
import RequirePermission from '@/components/auth/RequirePermission';
import { PERMISSIONS } from '@/config/permissions';

const VALUACION_TAB_PERMISSIONS = [
  PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA,
  PERMISSIONS.EDIT_VALUACION_PARAMETROS,
];

export const dynamic = 'force-dynamic';

export const metadata = { title: "Valuación Presupuestaria" };

async function getData() {
  try {
    const [catRes, constRes, concRes] = await Promise.all([
      PresupuestoService.getCatalogoPlazas(),
      PresupuestoService.getConstantes(),
      PresupuestoService.getConceptos(),
    ]);

    let catalogo = [];
    let constantes = [];
    let conceptos = [];

    if (catRes.ok) catalogo = await catRes.json();
    if (constRes.ok) constantes = await constRes.json();
    if (concRes.ok) conceptos = await concRes.json();

    return { catalogo, constantes, conceptos };
  } catch (error) {
    console.error('Error fetching initial data on server:', error);
    return { catalogo: [], constantes: [], conceptos: [] };
  }
}

async function PageContent() {
  const data = await getData();
  return (
    <ClientComponent
      initialCatalogo={data.catalogo}
      initialConstantes={data.constantes}
      initialConceptos={data.conceptos}
    />
  );
}

export default function Page() {
  return (
    <RequirePermission permission={VALUACION_TAB_PERMISSIONS}>
      <section className="bg-transparent w-full">
        <Suspense fallback={<Skeleton />}>
          <PageContent />
        </Suspense>
      </section>
    </RequirePermission>
  );
}
