import { motion } from 'motion/react';
import { 
    BarChart3, 
    TrendingUp, 
    Users, 
    Target, 
    Award, 
    PieChart, 
    Activity,
    ArrowUpRight,
    Search
} from "lucide-react";
import { Counter } from "@/components/ui/BentoMiniComponents";

export default function OcupacionStatsView({
    officesTop,
    maxOffice,
    levels,
    levelTotals,
    maxLevel,
    filteredTotal,
    officesCount,
    meanPerOffice,
    medianPerOffice,
    topOffice,
    topLevel,
    animateStats
}) {
    const levelColor = (lvl) => {
        const colors = {
            'P33': 'bg-[#621f32]',
            'D312': 'bg-[#bc955c]',
            'P13': 'bg-[#4a1726]',
            'A212': 'bg-[#111827]',
            'S305': 'bg-[#8a2b46]',
        };
        return colors[lvl] || 'bg-gray-400';
    };

    const levelColorHex = (lvl) => {
        const colors = {
            'P33': '#621f32',
            'D312': '#bc955c',
            'P13': '#4a1726',
            'A212': '#111827',
            'S305': '#8a2b46', 
        };
        return colors[lvl] || '#9ca3af';
    };

    return (
        <div className="size-full p-8 lg:p-12 bg-gray-50/10">
            {/* Upper Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard 
                    icon={<Users className="size-5" />}
                    label="Total de Plazas"
                    value={<Counter target={filteredTotal} />}
                    subtitle="Registros procesados"
                    color="text-[#621f32]"
                    bg="bg-[#621f32]/5"
                />
                <StatCard 
                    icon={<Activity className="size-5" />}
                    label="Total de oficios"
                    value={<Counter target={officesCount} />}
                    subtitle="Registros únicos"
                    color="text-[#bc955c]"
                    bg="bg-[#bc955c]/5"
                />
                <StatCard 
                    icon={<TrendingUp className="size-5" />}
                    label="Media"
                    value={meanPerOffice.toFixed(1)}
                    subtitle="PLazas por oficio (promedio)"
                    color="text-[#621f32]"
                    bg="bg-[#621f32]/5"
                />
                <StatCard 
                    icon={<Target className="size-5" />}
                    label="Mediana"
                    value={<Counter target={medianPerOffice} />}
                    subtitle="Valor central"
                    color="text-[#4a1726]"
                    bg="bg-[#4a1726]/5"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Top Offices Section */}
                <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 ring-1 ring-black/[0.02]">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Distribución</p>
                            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                                Top 10 oficios con mas plazas 
                            </h3>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-2xl">
                            <BarChart3 className="size-5 text-gray-400" />
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {officesTop.map((o) => (
                            <div key={o.name} className="group cursor-default">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[11px] font-black text-gray-600 truncate max-w-[240px] group-hover:text-[#621f32] transition-colors uppercase tracking-tight">
                                        {o.name}
                                    </span>
                                    <span className="text-sm font-black text-[#621f32] tabular-nums">
                                        {o.value.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: animateStats ? `${(o.value / (maxOffice || 1)) * 100}%` : '0%' }}
                                        transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                                        className="h-full bg-gradient-to-r from-[#621f32] to-[#8a2b46] rounded-full relative"
                                    >
                                        <div className="absolute inset-0 bg-white/10" />
                                    </motion.div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Levels Section */}
                <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 ring-1 ring-black/[0.02] flex flex-col">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Segmentación</p>
                            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                                Niveles
                            </h3>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-2xl">
                            <PieChart className="size-5 text-gray-400" />
                        </div>
                    </div>

                    <div className="space-y-7 flex-1">
                        {levels.map((lvl) => {
                            const val = (levelTotals && levelTotals[lvl]) || 0;
                            const percentage = (val / (maxLevel || 1)) * 100;
                            return (
                                <div key={lvl} className="group">
                                    <div className="flex justify-between items-end mb-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-3.5 rounded-full ${levelColor(lvl)} shadow-sm ring-2 ring-white`} />
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{lvl}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-gray-900 leading-none">{val.toLocaleString()}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Plazas</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 h-3 rounded-xl overflow-hidden p-0.5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: animateStats ? `${percentage}%` : '0%' }}
                                            style={{ backgroundColor: levelColorHex(lvl) }}
                                            transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                                            className="h-full rounded-lg relative shadow-sm"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                                        </motion.div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Best Performers Highlights */}
                    <div className="mt-12 pt-8 border-t border-gray-100 grid grid-cols-2 gap-4">
                        <HighlightCard 
                            icon={<Award className="size-4" />}
                            label="Oficio con mas plazas"
                            value={topOffice.name}
                            count={topOffice.value}
                            color="text-[#bc955c]"
                            bg="bg-[#bc955c]/5"
                        />
                        <HighlightCard 
                            icon={<Target className="size-4" />}
                            label="Nivel con mas plazas"
                            value={topLevel}
                            count={levelTotals && levelTotals[topLevel]}
                            color="text-[#621f32]"
                            bg="bg-[#621f32]/5"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, subtitle, color, bg }) {
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-4 ${bg} ${color} rounded-2xl group-hover:scale-110 transition-transform duration-500`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{label}</p>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{value}</div>
                </div>
            </div>
            <div className="w-full h-px bg-gray-50 mb-3" />
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{subtitle}</span>
                <ArrowUpRight className="size-3 text-gray-200 group-hover:text-gray-400 transition-colors" />
            </div>
        </div>
    );
}

function HighlightCard({ icon, label, value, count, color, bg }) {
    return (
        <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 ${bg} ${color} rounded-lg group-hover:rotate-12 transition-transform`}>
                    {icon}
                </div>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</span>
            </div>
            <p className="text-xs font-black text-gray-900 truncate mb-1" title={value}>{value}</p>
            <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black ${color} tabular-nums`}>{count?.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">Registros</span>
            </div>
        </div>
    );
}
