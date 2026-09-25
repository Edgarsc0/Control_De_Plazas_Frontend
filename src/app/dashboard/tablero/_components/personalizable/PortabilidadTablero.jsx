"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import ExportarTableroModal from "./ExportarTableroModal";
import ImportarTableroModal from "./ImportarTableroModal";
import { aplicarImportacion, leerArchivoTablero, nombreArchivoExportacion } from "./portabilidadTablero";

const claseBoton =
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#621f32] dark:hover:text-[#bc955c] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer";

/** Mensaje de resultado compartido con la administración de usuarios. */
export function mensajeImportacion(resultado, omitidos) {
  const avisos = [];
  if (omitidos) avisos.push(`${omitidos} módulo(s) no reconocido(s) se omitieron`);
  if (resultado.recortados) avisos.push(`${resultado.recortados} escritorio(s) no cupieron`);
  if (resultado.desbordados) avisos.push(`${resultado.desbordados} módulo(s) no cupieron y pasaron a un escritorio nuevo`);
  return `Importación lista.${avisos.length ? ` ${avisos.join("; ")}.` : ""}`;
}

/**
 * Botones "Exportar dashboard" / "Importar" del tablero propio.
 * `escritorioActivo` es el escritorio en pantalla (destino "actual").
 */
export default function PortabilidadTablero({ widgets, nombres, escritorioActivo, onImportar }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [pendiente, setPendiente] = useState(null); // { escritorios, omitidos }

  const alElegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    try {
      setPendiente(await leerArchivoTablero(archivo));
    } catch (err) {
      toast.error(err.message || "No se pudo importar el archivo.");
    }
  };

  const confirmarImportacion = (importados, opciones) => {
    const resultado = aplicarImportacion(widgets, nombres, importados, opciones);
    if (resultado.agregados === 0) {
      toast.error("Se alcanzó el máximo de escritorios permitido.");
      return;
    }
    onImportar(resultado.widgets, resultado.nombres);
    toast.success(mensajeImportacion(resultado, pendiente?.omitidos));
    setPendiente(null);
  };

  return (
    <>
      <div className="flex items-center gap-1 mr-2">
        <button type="button" onClick={() => setExportando(true)} className={claseBoton} title="Exportar dashboard">
          <Download className="size-3.5" />
          <span>Exportar dashboard</span>
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className={claseBoton} title="Importar dashboard">
          <Upload className="size-3.5" />
          <span>Importar</span>
        </button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={alElegirArchivo} className="hidden" />
      </div>

      <ExportarTableroModal
        open={exportando}
        onClose={() => setExportando(false)}
        widgets={widgets}
        nombres={nombres}
        nombreArchivo={nombreArchivoExportacion()}
        descripcion="Elige los escritorios que quieres incluir. Podrás cargar el archivo en otra computadora con «Importar»."
        onExportado={(n) => toast.success(n === 1 ? "Escritorio exportado." : `${n} escritorios exportados.`)}
      />

      <ImportarTableroModal
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        importados={pendiente?.escritorios ?? []}
        widgets={widgets}
        nombres={nombres}
        escritorioActual={escritorioActivo ?? 0}
        onConfirmar={confirmarImportacion}
      />
    </>
  );
}
