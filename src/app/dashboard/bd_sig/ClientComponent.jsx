'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// react-konva/konva necesitan `window` y `canvas`: el diagrama (y el JSON de ~630 KB
// con el catálogo) se carga solo en el cliente y en su propio chunk.
const DiagramaBD = dynamic(() => import('./_components/DiagramaBD'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-stack-nav-dvh md:h-stack-dvh flex items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> Cargando diagrama…
    </div>
  ),
});

export default function ClientComponent() {
  return <DiagramaBD />;
}
