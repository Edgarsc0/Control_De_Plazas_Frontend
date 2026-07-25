'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Clock, Eye, ListChecks } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisitsService } from '@/services/visits.service';

function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDuration(totalSeconds) {
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

export default function UserActivityDialog({ entry, onClose }) {
    const [date, setDate] = useState(todayStr());
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!entry) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await VisitsService.getUserVisits(entry.email, date);
            if (!response.ok) throw new Error('No se pudo cargar la actividad.');
            setSummary(await response.json());
        } catch (err) {
            setError(err.message || 'No se pudo cargar la actividad.');
            setSummary(null);
        } finally {
            setIsLoading(false);
        }
    }, [entry, date]);

    useEffect(() => {
        if (entry) load();
    }, [entry, load]);

    useEffect(() => {
        if (!entry) setDate(todayStr());
    }, [entry]);

    const chartData = buildChartData(summary);

    return (
        <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="lg:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="size-5 text-[#621f32]" /> Actividad de {entry?.email}
                    </DialogTitle>
                    <DialogDescription>
                        Cada visita agrupa los heartbeats de presencia consecutivos (hasta 90s de hueco) del
                        usuario. Elige un día para ver cuántas visitas hizo, cuánto tiempo estuvo activo y qué
                        páginas vio en cada una.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Día</label>
                    <input
                        type="date"
                        value={date}
                        max={todayStr()}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                {isLoading && !summary ? (
                    <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                        Cargando actividad...
                    </div>
                ) : summary ? (
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
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
