'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DayActivityPanel, { formatDuration } from '@/components/shared/DayActivityPanel';
import { VisitsService } from '@/services/visits.service';

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function pad(n) {
    return String(n).padStart(2, '0');
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthOf(dateStr) {
    return dateStr.slice(0, 7);
}

function shiftDate(dateStr, deltaDays) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shiftMonth(monthStr, deltaMonths) {
    const [y, m] = monthStr.split('-').map(Number);
    const dt = new Date(y, m - 1 + deltaMonths, 1);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

function buildMonthGrid(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    return cells;
}

function monthLabel(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function intensityClass(seconds) {
    if (!seconds) return 'bg-slate-100';
    if (seconds < 15 * 60) return 'bg-[#621f32]/25';
    if (seconds < 60 * 60) return 'bg-[#621f32]/45';
    if (seconds < 3 * 60 * 60) return 'bg-[#621f32]/70';
    return 'bg-[#621f32]';
}

function NavButton({ onClick, disabled, children, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="flex items-center justify-center size-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
            {children}
        </button>
    );
}

function MonthHeatmap({ month, data, selectedDate, onSelectDate, onPrevMonth, onNextMonth }) {
    const cells = buildMonthGrid(month);
    const days = data?.days || {};
    const nextDisabled = month >= currentMonthStr();

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Mapa de calor · {monthLabel(month)}
                </h4>
                <div className="flex items-center gap-1">
                    <NavButton onClick={onPrevMonth} label="Mes anterior">
                        <ChevronLeft className="size-4" />
                    </NavButton>
                    <NavButton onClick={onNextMonth} disabled={nextDisabled} label="Mes siguiente">
                        <ChevronRight className="size-4" />
                    </NavButton>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((w, i) => (
                    <div key={`w-${i}`} className="text-center text-[10px] font-bold text-slate-400">
                        {w}
                    </div>
                ))}
                {cells.map((dateStr, i) => {
                    if (!dateStr) return <div key={`empty-${i}`} />;
                    const seconds = days[dateStr] || 0;
                    const isFuture = dateStr > todayStr();
                    const isSelected = dateStr === selectedDate;
                    const dayNum = Number(dateStr.slice(8, 10));
                    return (
                        <button
                            key={dateStr}
                            type="button"
                            disabled={isFuture}
                            onClick={() => onSelectDate(dateStr)}
                            title={`${dateStr} · ${formatDuration(seconds)}`}
                            className={`aspect-square rounded-md text-[10px] font-bold flex items-center justify-center transition
                                ${isFuture ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-[#bc955c]'}
                                ${intensityClass(seconds)}
                                ${seconds >= 60 * 60 ? 'text-white' : 'text-slate-500'}
                                ${isSelected ? 'ring-2 ring-[#621f32]' : ''}`}
                        >
                            {dayNum}
                        </button>
                    );
                })}
            </div>

            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                <span>Menos</span>
                <span className="size-3 rounded bg-slate-100" />
                <span className="size-3 rounded bg-[#621f32]/25" />
                <span className="size-3 rounded bg-[#621f32]/45" />
                <span className="size-3 rounded bg-[#621f32]/70" />
                <span className="size-3 rounded bg-[#621f32]" />
                <span>Más</span>
            </div>
        </div>
    );
}

export default function UserActivityDialog({ entry, onClose }) {
    const [tab, setTab] = useState('detalle');
    const [date, setDate] = useState(todayStr());

    const [heatmapMonth, setHeatmapMonth] = useState(currentMonthStr());
    const [heatmapData, setHeatmapData] = useState(null);
    const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);

    const loadHeatmap = useCallback(async () => {
        if (!entry) return;
        setIsLoadingHeatmap(true);
        try {
            const response = await VisitsService.getUserVisitsHeatmap(entry.email, heatmapMonth);
            if (!response.ok) throw new Error('No se pudo cargar el mapa de calor.');
            setHeatmapData(await response.json());
        } catch {
            setHeatmapData(null);
        } finally {
            setIsLoadingHeatmap(false);
        }
    }, [entry, heatmapMonth]);

    useEffect(() => {
        if (entry) loadHeatmap();
    }, [entry, loadHeatmap]);

    useEffect(() => {
        if (!entry) {
            setTab('detalle');
            setDate(todayStr());
            setHeatmapMonth(currentMonthStr());
        }
    }, [entry]);

    const goToDate = (newDate) => {
        if (newDate > todayStr()) return;
        setDate(newDate);
        setHeatmapMonth(monthOf(newDate));
    };

    const selectDateFromHeatmap = (newDate) => {
        goToDate(newDate);
        setTab('detalle');
    };

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

                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
                    {[
                        { id: 'detalle', label: 'Detalle del día' },
                        { id: 'heatmap', label: 'Mapa de calor' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                tab === t.id
                                    ? 'bg-white text-[#621f32] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'heatmap' ? (
                    <div className="space-y-2">
                        <MonthHeatmap
                            month={heatmapMonth}
                            data={heatmapData}
                            selectedDate={date}
                            onSelectDate={selectDateFromHeatmap}
                            onPrevMonth={() => setHeatmapMonth((m) => shiftMonth(m, -1))}
                            onNextMonth={() => setHeatmapMonth((m) => shiftMonth(m, 1))}
                        />
                        {isLoadingHeatmap && !heatmapData && (
                            <p className="text-xs text-slate-400">Cargando mapa de calor...</p>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-700">Día</label>
                            <NavButton onClick={() => goToDate(shiftDate(date, -1))} label="Día anterior">
                                <ChevronLeft className="size-4" />
                            </NavButton>
                            <input
                                type="date"
                                value={date}
                                max={todayStr()}
                                onChange={(e) => goToDate(e.target.value)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-[#621f32] focus:ring-1 focus:ring-[#621f32]"
                            />
                            <NavButton
                                onClick={() => goToDate(shiftDate(date, 1))}
                                disabled={date >= todayStr()}
                                label="Día siguiente"
                            >
                                <ChevronRight className="size-4" />
                            </NavButton>
                        </div>

                        <DayActivityPanel email={entry?.email} date={date} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
