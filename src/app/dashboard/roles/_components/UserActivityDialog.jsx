'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
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

function buildChartData(summary) {
    return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, '0')}h`,
        visitasDelDia: summary?.hourly_distribution_day?.[hour] ?? 0,
        promedioHistorico: summary?.hourly_average_all_time?.[hour] ?? 0,
    }));
}

function StatCard({ label, value, sub }) {
    return (
        <div className="flex-1 min-w-[150px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
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
    const peakAverage = summary ? Math.max(0, ...summary.hourly_average_all_time) : 0;

    return (
        <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="lg:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="size-5 text-[#621f32]" /> Actividad de {entry?.email}
                    </DialogTitle>
                    <DialogDescription>
                        Cada petición que ese usuario le hace al backend cuenta como una visita.
                        Elige un día para ver su distribución en las 24 horas.
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
                            <StatCard label="Visitas del día" value={summary.total_visits_day} />
                            <StatCard label="Pico promedio/hora" value={peakAverage} sub="histórico completo" />
                            <StatCard
                                label="Página más visitada"
                                value={summary.top_page_all_time?.path || '—'}
                                sub={
                                    summary.top_page_all_time
                                        ? `${summary.top_page_all_time.count} veces · histórico`
                                        : 'sin datos'
                                }
                            />
                        </div>

                        <div className="h-64 rounded-2xl border border-slate-200 bg-white p-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={1} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="visitasDelDia" name="Visitas ese día" fill="#621f32" radius={[4, 4, 0, 0]} />
                                    <Line
                                        type="monotone"
                                        dataKey="promedioHistorico"
                                        name="Promedio histórico"
                                        stroke="#bc955c"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2">
                                Visitas del {date} ({summary.visits.length})
                            </h4>
                            <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                                {summary.visits.length === 0 ? (
                                    <p className="text-sm text-slate-400 px-4 py-6 text-center">Sin visitas ese día.</p>
                                ) : (
                                    summary.visits.map((v, i) => (
                                        <div key={`${v.time}-${i}`} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                                            <span className="font-mono text-slate-400 shrink-0">{v.time}</span>
                                            <span className="font-bold text-slate-500 shrink-0 w-12">{v.method}</span>
                                            <span className="text-slate-700 truncate">{v.path}</span>
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
