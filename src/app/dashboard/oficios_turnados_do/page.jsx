import { ControlGestionService } from '@/services/control_gestion.service';
import { Suspense } from 'react';
import OficiosTurnadosDO from './ClientComponent';

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
    <section className="bg-transparent pb-20">
      <div className="py-12 px-4 mx-auto max-w-[1600px] lg:px-6">
        <Suspense fallback={<div>Cargando oficios turnados...</div>}>
          <OficiosTurnadosDO oficiosTurnados={oficiosTurnadosResponse.model} />
        </Suspense>
      </div>
    </section>
  );
}
