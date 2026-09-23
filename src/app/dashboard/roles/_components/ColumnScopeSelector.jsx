'use client';

import { useMemo, useState } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { PLANTILLA_DETALLE_COLUMNS_CATALOG } from '@/config/plantillaDetalleColumns';

/**
 * Selector de "alcance de columnas" de un rol para la tabla Plantilla
 * Detalle: sin restricción (null) o restringido a una lista de claves de
 * columna (string[], incluida vacía). Mismo contrato que RolColumnScope en
 * el backend, que además se encarga de que las columnas no permitidas ni
 * siquiera viajen en la respuesta — este selector solo decide QUÉ puede
 * elegir ver el usuario, no es lo que hace cumplir la restricción.
 */
export default function ColumnScopeSelector({ value, onChange }) {
    const isRestricted = Array.isArray(value);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return PLANTILLA_DETALLE_COLUMNS_CATALOG;
        return PLANTILLA_DETALLE_COLUMNS_CATALOG.filter((c) => c.label.toLowerCase().includes(q));
    }, [search]);

    const toggleKey = (key) => {
        const current = value || [];
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        onChange(next);
    };

    const principales = filtered.filter((c) => c.isBasic);
    const extras = filtered.filter((c) => !c.isBasic);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${!isRestricted ? 'bg-white text-[#621f32] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Sin restricción
                </button>
                <button
                    type="button"
                    onClick={() => onChange(value || [])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isRestricted ? 'bg-white text-[#621f32] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Limitar columnas visibles
                </button>
            </div>

            {isRestricted && (
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                            {value.length} de {PLANTILLA_DETALLE_COLUMNS_CATALOG.length} columnas seleccionadas
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                onChange(
                                    value.length === PLANTILLA_DETALLE_COLUMNS_CATALOG.length
                                        ? []
                                        : PLANTILLA_DETALLE_COLUMNS_CATALOG.map((c) => c.key)
                                )
                            }
                            className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                        >
                            {value.length === PLANTILLA_DETALLE_COLUMNS_CATALOG.length ? 'Ninguna' : 'Seleccionar todas'}
                        </button>
                    </div>

                    <div className="relative flex items-center pl-3 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-[#621f32]/10 focus-within:border-[#621f32]/40">
                        <Search className="size-3.5 text-slate-400 mr-2 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar columna..."
                            className="flex-1 bg-transparent text-xs outline-none placeholder-slate-400 text-slate-700"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                                <X className="size-3.5 text-slate-400" />
                            </button>
                        )}
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {principales.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 px-1.5 mb-0.5">Campo Principal</p>
                                {principales.map((col) => (
                                    <label
                                        key={col.key}
                                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={value.includes(col.key)}
                                            onChange={() => toggleKey(col.key)}
                                            className="accent-[#621f32]"
                                        />
                                        <span className="text-sm text-slate-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {extras.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 px-1.5 mb-0.5">Campo Extra</p>
                                {extras.map((col) => (
                                    <label
                                        key={col.key}
                                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={value.includes(col.key)}
                                            onChange={() => toggleKey(col.key)}
                                            className="accent-[#621f32]"
                                        />
                                        <span className="text-sm text-slate-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {filtered.length === 0 && (
                            <p className="text-sm text-slate-400 px-1.5">Sin columnas que coincidan con &quot;{search}&quot;.</p>
                        )}
                    </div>

                    {value.length === 0 && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">
                                Este rol solo verá identificadores básicos (posición, estatus) — ninguna columna adicional.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
