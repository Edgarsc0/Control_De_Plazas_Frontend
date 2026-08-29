"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { VacantesService } from "@/services/vacantes.service";

const DEBOUNCE_MS = 300;
const MIN_CARACTERES = 2;

// Estado del autollenado por fila (INACTIVO/BUSCANDO/OK/ERROR) — definido en
// AnuenciaTab.jsx, se recibe por prop para pintar el mismo ícono a la derecha
// de la celda.
const ESTADO = { INACTIVO: "inactivo", BUSCANDO: "buscando", OK: "ok", ERROR: "error" };

/**
 * Celda "Código Federal de Puesto" con autocompletado: mientras se escribe,
 * propone (con debounce) los códigos que coinciden — igual que el buscador de
 * Cadena de Mando en Plantilla Detalle, pero contra el backend en vez de un
 * dataset ya cargado en cliente (aquí no hay uno). Al elegir una sugerencia
 * (clic o Enter sobre la resaltada) se dispara el mismo autollenado que
 * confirmar el código a mano (blur/Enter).
 *
 * El dropdown se porta a `document.body` con posición `fixed` calculada por
 * `getBoundingClientRect()` — mismo patrón que `CopyCellMenu.jsx` — porque la
 * celda vive dentro de la tabla con `overflow-x-auto` y un `absolute` normal
 * quedaría recortado al hacer scroll horizontal.
 */
export default function CodigoFederalCell({ className, valor, onChange, onConfirmar, estado }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState(null);

  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const peticionRef = useRef(null);

  // Limpia timers/peticiones pendientes si la celda se desmonta a medio
  // debounce (p.ej. al cambiar de hoja antes de que responda el back).
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      peticionRef.current?.abort();
    };
  }, []);

  // Busca sugerencias — se llama SÓLO desde el propio `onChange` del input
  // (ver abajo), nunca desde un efecto atado a `valor`: un efecto así se
  // vuelve a disparar cada vez que `valor` cambia por CUALQUIER motivo,
  // incluyendo que la fila llegue de fuera ya con su código (al cargar un
  // anexo del historial, restaurar el borrador de localStorage, o cambiar de
  // hoja) — esos cambios no pasan por acá, así que ni un guard de "primer
  // render" los filtra si el valor real llega en un render posterior al
  // montaje (que es justo lo que pasa: la hoja monta vacía y el efecto que
  // restaura los datos corre después). Atarlo directamente al evento de
  // teclear es la única forma de garantizar que sólo se busque cuando el
  // usuario en verdad está escribiendo en esta celda.
  const buscarSugerencias = (termino) => {
    clearTimeout(debounceRef.current);
    peticionRef.current?.abort();

    const limpio = termino.trim();
    if (limpio.length < MIN_CARACTERES) {
      setSugerencias([]);
      setMostrar(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      peticionRef.current = controller;
      setCargando(true);
      try {
        const res = await VacantesService.getAnuenciaSugerencias(limpio, { signal: controller.signal });
        const data = await res.json();
        setSugerencias(Array.isArray(data) ? data : []);
        setMostrar(true);
        setActiveIndex(-1);
      } catch (err) {
        if (err.name !== "AbortError") setSugerencias([]);
      } finally {
        setCargando(false);
      }
    }, DEBOUNCE_MS);
  };

  const manejarCambio = (e) => {
    const nuevo = e.target.value;
    onChange(nuevo);
    buscarSugerencias(nuevo);
  };

  // Reposiciona el dropdown si la ventana cambia de tamaño; lo cierra apenas
  // hay scroll (mismo criterio que los dropdowns de filtro de Cuadros de
  // Vacancia) en vez de perseguir la celda con un listener de scroll.
  useEffect(() => {
    if (!mostrar) return;
    const actualizarRect = () => {
      const el = wrapperRef.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    actualizarRect();
    const cerrar = () => setMostrar(false);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", actualizarRect);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", actualizarRect);
    };
  }, [mostrar]);

  const elegir = (sug) => {
    onChange(sug.codigo);
    setSugerencias([]);
    setMostrar(false);
    onConfirmar(sug.codigo);
  };

  const handleKeyDown = (e) => {
    if (mostrar && sugerencias.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, sugerencias.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Escape") {
        setMostrar(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && sugerencias[activeIndex]) {
          elegir(sugerencias[activeIndex]);
        } else {
          setMostrar(false);
          onConfirmar(e.currentTarget.value);
        }
        return;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      onConfirmar(e.currentTarget.value);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex items-center">
      <input
        type="text"
        value={valor}
        onChange={manejarCambio}
        onFocus={() => sugerencias.length > 0 && setMostrar(true)}
        onBlur={(e) => {
          const valorActual = e.currentTarget.value;
          // Deja pasar el clic sobre una sugerencia (onMouseDown la evita) antes
          // de cerrar; si no se eligió ninguna, confirma lo que quedó escrito.
          setTimeout(() => setMostrar(false), 150);
          onConfirmar(valorActual);
        }}
        onKeyDown={handleKeyDown}
        placeholder="06-H00-001794"
        className={`${className} pr-6`}
      />
      <span className="absolute right-1.5 pointer-events-none">
        {cargando ? (
          <Loader2 className="size-3 animate-spin text-slate-400" />
        ) : estado === ESTADO.BUSCANDO ? (
          <Loader2 className="size-3 animate-spin text-slate-400" />
        ) : estado === ESTADO.OK ? (
          <CheckCircle2 className="size-3 text-emerald-600" />
        ) : estado === ESTADO.ERROR ? (
          <AlertTriangle className="size-3 text-amber-600" />
        ) : null}
      </span>

      {mostrar &&
        sugerencias.length > 0 &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) }}
            className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-72 overflow-y-auto custom-scrollbar"
          >
            {/* Sólo trae posiciones VACANTES (ver AnuenciaSugerenciasView) — el
                Anexo 2 es para solicitar ocupación, así que no tiene sentido
                sugerir una ya ocupada. Si el usuario escribe/pega el código
                exacto de una ocupada, eso lo sigue avisando el autollenado
                normal (`onConfirmar`), no esta lista. */}
            {sugerencias.map((sug, idx) => (
              <button
                key={sug.posicion}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(sug)}
                className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors cursor-pointer ${
                  idx === activeIndex ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">{sug.codigo}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {sug.denominacion_puesto || "Sin denominación"}
                </p>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
