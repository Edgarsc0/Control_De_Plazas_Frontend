import { ControlGestionService } from '@/services/control_gestion.service';
import { Suspense } from 'react';
import OficiosTurnadosDO from './ClientComponent';

// La data depende de la sesión (apiFetch usa la cookie de token), por lo que la
// ruta es dinámica: se omite el prerender estático.
export const dynamic = 'force-dynamic';

export default async function OficiosTurnadosDOSSR() {
  const oficiosTurnadosResponse =
    await ControlGestionService.getOficiosTurnados({
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
    });

  return (
    <section className="bg-transparent pb-0 w-full">
      <Suspense fallback={<div className="text-center py-12 font-semibold text-slate-500">Cargando oficios turnados...</div>}>
        <OficiosTurnadosDO oficiosTurnados={oficiosTurnadosResponse.model} />
      </Suspense>
    </section>
  );
}
