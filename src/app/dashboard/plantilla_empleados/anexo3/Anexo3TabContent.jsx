"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import Anexo3Editor from "../_components/tabs/anuencia/Anexo3Editor";
import { CANAL_ANEXO3, leerDatosAnexo3, borrarDatosAnexo3 } from "../_components/tabs/anuencia/anexo3TabChannel";

/**
 * Puente entre la pestaña del Anexo 2 (AnuenciaTab.jsx) y esta pestaña nueva:
 * lee la captura de `hojas` que dejó la otra pestaña en localStorage (ver
 * anexo3TabChannel.js) y, al cerrarse — con el botón o cerrando la pestaña a
 * secas —, avisa por BroadcastChannel para que el Anexo 2 se vuelva a poder
 * editar.
 */
export default function Anexo3TabContent() {
    const [id, setId] = useState(null);
    const [datos, setDatos] = useState(undefined); // undefined = cargando, null = no encontrado

    useEffect(() => {
        const idParam = new URLSearchParams(window.location.search).get("id");
        setId(idParam);
        setDatos(idParam ? leerDatosAnexo3(idParam) : null);
    }, []);

    const avisarCierre = useCallback(() => {
        if (!id) return;
        const canal = new BroadcastChannel(CANAL_ANEXO3);
        canal.postMessage({ id, tipo: "cerrado" });
        canal.close();
        borrarDatosAnexo3(id);
    }, [id]);

    // Cubre tanto el botón "Cerrar" del editor como que cierren la pestaña
    // directamente (botón X del navegador, Ctrl+W, etc.).
    useEffect(() => {
        if (!id) return undefined;
        window.addEventListener("pagehide", avisarCierre);
        return () => window.removeEventListener("pagehide", avisarCierre);
    }, [id, avisarCierre]);

    const handleCerrar = () => {
        avisarCierre();
        window.close();
    };

    // Portal a document.body: el layout de la app le da a <main> su propio
    // contexto de apilamiento (position:relative + z-10), así que cualquier
    // z-index puesto DENTRO de <main> —por alto que sea— nunca gana contra el
    // Banner/Navbar del sitio (fixed, z-40/z-50, hijos directos de <body>).
    // Sin este portal, el encabezado del editor (con los botones de guardar
    // versión / ver versiones) queda pintado por DEBAJO de esos elementos, es
    // decir, invisible aunque el código sí se esté renderizando.
    if (typeof document === "undefined") return null;

    let contenido;
    if (datos === undefined) {
        contenido = (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-950">
                <Loader2 className="size-8 animate-spin text-[#621f32] dark:text-[#bc955c]" />
            </div>
        );
    } else if (!datos) {
        contenido = (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-2 text-center bg-white dark:bg-slate-950 px-6">
                <AlertTriangle className="size-8 text-amber-500" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    No se encontró la captura del Anexo 2 para esta pestaña.
                </p>
                <p className="text-xs text-slate-400">
                    Vuelve a la pestaña del Anexo 2 y da clic en &quot;Generar Anexo 3&quot; de nuevo.
                </p>
            </div>
        );
    } else {
        contenido = (
            <Anexo3Editor
                hojas={datos.hojas}
                nombreArchivo={datos.nombreArchivo}
                anexoIdActual={datos.anexoIdActual}
                onCerrar={handleCerrar}
            />
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950">{contenido}</div>,
        document.body
    );
}
