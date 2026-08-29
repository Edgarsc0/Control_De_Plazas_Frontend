"use client";

import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Contador numérico para "Número de plazas" / "Número de Horas" en la
 * captura del Anexo 2 — reemplaza el spinner nativo de `<input type="number">`
 * (feo y, peor, permitía llegar a negativos escribiendo "-3" a mano) por
 * botones propios con la paleta del sistema, acotados a `[0, ∞)`.
 */
export default function NumeroStepper({ valor, onChange }) {
  const clamp = (n) => (Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);

  const step = (delta) => {
    const actual = Number(valor);
    onChange(String(clamp((Number.isFinite(actual) ? actual : 0) + delta)));
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw.trim() === "") {
      onChange("");
      return;
    }
    const n = Number(raw);
    onChange(Number.isFinite(n) ? String(clamp(n)) : "");
  };

  const botonClase =
    "flex items-center justify-center h-[15px] w-4 text-[#621f32] dark:text-[#bc955c] bg-[#621f32]/[0.06] hover:bg-[#621f32]/15 dark:bg-[#bc955c]/[0.08] dark:hover:bg-[#bc955c]/20 transition-colors cursor-pointer";

  return (
    <div className="flex items-center justify-center h-full w-full">
      <input
        type="text"
        inputMode="numeric"
        min={0}
        value={valor}
        onChange={handleChange}
        className="w-9 h-full bg-transparent text-[11px] text-center text-slate-800 dark:text-slate-100 outline-none"
      />
      <div className="flex flex-col shrink-0 rounded-md overflow-hidden border border-[#621f32]/15 dark:border-[#bc955c]/20">
        <button type="button" tabIndex={-1} onClick={() => step(1)} className={botonClase} title="Aumentar">
          <ChevronUp className="size-2.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(-1)}
          disabled={Number(valor) <= 0 || valor === ""}
          className={`${botonClase} border-t border-[#621f32]/15 dark:border-[#bc955c]/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#621f32]/[0.06] dark:disabled:hover:bg-[#bc955c]/[0.08]`}
          title="Disminuir"
        >
          <ChevronDown className="size-2.5" />
        </button>
      </div>
    </div>
  );
}
