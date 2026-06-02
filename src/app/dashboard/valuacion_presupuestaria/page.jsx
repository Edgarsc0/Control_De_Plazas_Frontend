import ClientComponent from './ClientComponent';
import { Suspense } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import Skeleton from './Skeleton';

export const dynamic = 'force-dynamic';

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
    <section className="bg-transparent pb-20">
      <div className="py-12 px-4 mx-auto max-w-[1700px] lg:px-6">
        <Suspense fallback={<Skeleton />}>
          <PageContent />
        </Suspense>
      </div>
    </section>
  );
}
