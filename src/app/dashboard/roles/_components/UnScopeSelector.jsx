'use client';

import { AlertTriangle } from 'lucide-react';
import { UN_CATALOG } from '@/utils/catalogosUnUa';

const UN_ENTRIES = Object.entries(UN_CATALOG);

/**
 * Selector de "alcance de datos" de un rol: sin restricción (null) o
 * restringido a una lista de códigos de Unidad de Negocio (string[],
 * incluida vacía = el rol no ve ningún registro — ver RolUnScope en el
 * backend, es el mismo contrato).
 */
export default function UnScopeSelector({ value, onChange }) {
    const isRestricted = Array.isArray(value);

    const toggleCode = (code) => {
        const current = value || [];
        const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
        onChange(next);
    };

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
                    Limitar a UN específicas
                </button>
            </div>

            {isRestricted && (
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                            {value.length} de {UN_ENTRIES.length} seleccionadas
                        </span>
                        <button
                            type="button"
                            onClick={() => onChange(value.length === UN_ENTRIES.length ? [] : UN_ENTRIES.map(([code]) => code))}
                            className="text-[11px] font-bold text-[#621f32] hover:underline cursor-pointer"
                        >
                            {value.length === UN_ENTRIES.length ? 'Ninguna' : 'Seleccionar todas'}
                        </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                        {UN_ENTRIES.map(([code, nombre]) => (
                            <label
                                key={code}
                                className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={value.includes(code)}
                                    onChange={() => toggleCode(code)}
                                    className="mt-0.5 accent-[#621f32]"
                                />
                                <span className="text-sm text-slate-700">
                                    <span className="font-mono text-xs text-slate-400 mr-1.5">{code}</span>
                                    {nombre}
                                </span>
                            </label>
                        ))}
                    </div>

                    {value.length === 0 && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">Este rol no verá ningún registro.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
