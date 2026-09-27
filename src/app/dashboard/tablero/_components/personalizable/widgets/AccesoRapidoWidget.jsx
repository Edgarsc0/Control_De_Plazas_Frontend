"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useElementSize } from "./useElementSize";

/**
 * Widget "acceso rápido": tarjeta clicable hacia una página del sistema (una
 * por cada módulo de `MODULES`, ver widgetRegistry.js). A diferencia del resto
 * del catálogo, no hace fetch propio ni tiene estado — es pura navegación, por
 * eso una sola fábrica basta para las N páginas en vez de un archivo por
 * módulo.
 *
 * Se puede achicar hasta 1 celda (ver minW/minH en el registro). El icono va
 * arriba y el texto "Ir a <página>" queda anclado abajo (`justify-between`):
 * ese texto es lo único que identifica el destino, así que se conserva en
 * cualquier tamaño salvo el extremo de 1 celda, donde solo cabe el icono
 * (con `title` como tooltip nativo). La descripción larga solo aparece si
 * sobra espacio de verdad.
 *
 * @param {import('@/config/modules').MODULES[number]} mod
 * @returns Componente sin props, listo para WIDGET_REGISTRY.
 */
export function crearAccesoRapidoWidget(mod) {
  return function AccesoRapidoWidget() {
    const [ref, { width, height }] = useElementSize();
    const soloIcono = height < 56 || width < 56;
    const conDescripcion = height >= 170 && width >= 190;

    return (
      <Link
        ref={ref}
        href={mod.href}
        title={mod.title}
        className={`group relative flex w-full h-full overflow-hidden text-white ${soloIcono ? "items-center justify-center p-2" : "flex-col justify-between p-3"}`}
        style={{ backgroundColor: mod.color }}
      >
        <mod.icon className="absolute -right-6 -bottom-6 size-40 opacity-[0.28] group-hover:opacity-[0.38] group-hover:scale-110 transition-all duration-500 pointer-events-none" />

        <div className="p-1.5 rounded-lg shrink-0 bg-white/15 relative z-10 w-fit transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
          <mod.icon className="size-4" />
        </div>

        {!soloIcono && (
          <div className="relative z-10 min-w-0">
            {conDescripcion && (
              <p className="text-[11px] text-white/75 mb-1 line-clamp-2">{mod.description}</p>
            )}
            <span className="inline-flex items-center gap-1 flex-wrap text-[11px] font-black leading-snug">
              Ir a {mod.title}
              <ChevronRight className="size-3.5 shrink-0 -translate-x-1 group-hover:translate-x-0 transition-transform" />
            </span>
          </div>
        )}
      </Link>
    );
  };
}
