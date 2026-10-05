'use client';

import { useEffect, useState } from 'react';
import { Clock, Eye, ListChecks } from 'lucide-react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { VisitsService } from '@/services/visits.service';

export function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function buildChartData(summary) {
    return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}h`,
        minutosDelDia: Math.round(((summary?.hourly_active_seconds_day?.[hour] ?? 0) / 60) * 10) / 10,
        promedioHistorico:
            Math.round(((summary?.hourly_average_active_seconds_all_time?.[hour] ?? 0) / 60) * 10) / 10,
    }));
}

function StatCard({ icon: Icon, label, value, sub }) {
    return (
        <div className="flex-1 min-w-[150px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-400">
                {Icon && <Icon className="size-3" />} {label}
            </p>
            <p
                className="text-lg font-black text-slate-800 truncate"
                title={typeof value === 'string' ? value : undefined}
            >
                {value}
            </p>
            {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
        </div>
    );
}

/**
 * Distribución de horas y páginas visitadas por un usuario en un día dado:
 * extraído de la pestaña "Detalle del día" de UserActivityDialog.jsx (Roles >
 * Usuarios) para poder reutilizarlo también desde el widget de mapa de calor
 * del tablero personalizable (UsuarioMapaCalorWidget.jsx), que abre esta
 * misma vista al dar clic en un día.
 */
export default function DayActivityPanel({ email, date }) {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!email || !date) return undefined;
        let activo = true;
        setIsLoading(true);
        setError(null);
        VisitsService.getUserVisits(email, date)
            .then((res) => {
                if (!res.ok) throw new Error('No se pudo cargar la actividad.');
                return res.json();
            })
            .then((d) => {
                if (activo) setSummary(d);
            })
            .catch((err) => {
                if (activo) {
                    setError(err.message || 'No se pudo cargar la actividad.');
                    setSummary(null);
                }
            })
            .finally(() => {
                if (activo) setIsLoading(false);
            });
        return () => {
            activo = false;
        };
    }, [email, date]);

    if (error) return <p className="text-sm text-red-500">{error}</p>;

    if (isLoading && !summary) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                Cargando actividad...
            </div>
        );
    }

    if (!summary) return null;

    const chartData = buildChartData(summary);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <StatCard icon={ListChecks} label="Visitas del día" value={summary.sessions_count_day} />
                <StatCard
                    icon={Clock}
                    label="Tiempo activo del día"
                    value={formatDuration(summary.total_active_seconds_day)}
                />
                <StatCard
                    icon={Eye}
                    label="Vista más visitada"
                    value={summary.top_view_all_time?.label || '—'}
                    sub={
                        summary.top_view_all_time
                            ? `${summary.top_view_all_time.count} veces · histórico`
                            : 'sin datos'
                    }
                />
            </div>

            <div className="h-64 rounded-2xl border border-slate-200 bg-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={36}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            allowDecimals={false}
                            label={{ value: 'min', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }}
                        />
                        <Tooltip formatter={(value) => `${value} min`} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="minutosDelDia" name="Minutos activo ese día" fill="#621f32" radius={[4, 4, 0, 0]} />
                        <Line
                            type="monotone"
                            dataKey="promedioHistorico"
                            name="Promedio histórico (min)"
                            stroke="#bc955c"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">
                    Visitas del {date} ({summary.sessions.length})
                </h4>
                <div className="max-h-56 overflow-y-auto space-y-2">
                    {summary.sessions.length === 0 ? (
                        <p className="text-sm text-slate-400 px-4 py-6 text-center rounded-2xl border border-slate-200">
                            Sin visitas ese día.
                        </p>
                    ) : (
                        summary.sessions.map((s, i) => (
                            <div key={`${s.start}-${i}`} className="rounded-2xl border border-slate-200 px-3 py-2">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                                    <span>
                                        {s.start} — {s.end}
                                    </span>
                                    <span className="text-slate-400">{formatDuration(s.duration_seconds)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {s.views.map((v) => (
                                        <span
                                            key={v.label}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]"
                                        >
                                            {v.label}
                                            {v.count > 1 && <span className="text-slate-400">×{v.count}</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
