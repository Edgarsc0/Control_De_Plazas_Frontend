const djangoApi =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api';

export const CatTipoOficioService = {
  getTiposAsunto: async () => {
    const res = await fetch(`${djangoApi}/cat-tipo-oficio/tipos-asunto/`);
    return res.json();
  },

  createRelacionAsuntoOficio: async (idAsuntoSCG, idTipoAsunto) => {
    const res = await fetch(`${djangoApi}/cat-tipo-oficio/relaciones-asunto-oficio/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idAsuntoSCG,
        idTipoAsunto,
      }),
    });
    return res.json();
  },

  deleteRelacionAsuntoOficio: async (idRelacion) => {
    const res = await fetch(`${djangoApi}/cat-tipo-oficio/relaciones-asunto-oficio/${idRelacion}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Error al eliminar la relacion');
    }
    return true;
  },

  getRelacionesAsuntoOficio: async (idAsuntoSCG) => {
    const url = idAsuntoSCG 
      ? `${djangoApi}/cat-tipo-oficio/relaciones-asunto-oficio/?idAsuntoSCG=${idAsuntoSCG}`
      : `${djangoApi}/cat-tipo-oficio/relaciones-asunto-oficio/`;
    const res = await fetch(url);
    return res.json();
  },

  getAsuntosValuacion: async () => {
    const res = await fetch(`${djangoApi}/cat-tipo-oficio/asuntos-valuacion/`);
    return res.json();
  }
};
