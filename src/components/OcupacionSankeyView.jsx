import { motion } from 'motion/react';
import { SankeyChart } from "@/components/ui/BentoMiniComponents";
import { GitBranch, Building2, Layers, Info, MousePointer2 } from "lucide-react";

export default function OcupacionSankeyView({ sankeyData, handleDrillDown }) {
    return (
        <div className="size-full flex flex-col bg-transparent">
            {/* Legend Area */}
            <div className="px-8 pt-8 pb-4 flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                    <LegendItem
                        icon={<Building2 className="size-3.5" />}
                        label="Origen"
                        value="Oficios de Solicitud"
                        color="text-[#621f32]"
                        bg="bg-[#621f32]/5"
                    />
                    <div className="h-8 w-px bg-gray-200 hidden sm:block" />
                    <LegendItem
                        icon={<Layers className="size-3.5" />}
                        label="Destino"
                        value="Niveles"
                        color="text-[#bc955c]"
                        bg="bg-[#bc955c]/5"
                    />
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm"
                >
                    <div className="p-1.5 bg-[#621f32]/10 rounded-lg">
                        <MousePointer2 className="size-3.5 text-[#621f32]" />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                        Interactúa con los flujos para ver detalle
                    </p>
                </motion.div>
            </div>

            {/* Chart Container */}
            <div className="flex-1 min-h-[500px] relative px-8 pb-8 flex items-center justify-center">
                {sankeyData ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="w-full max-w-6xl bg-white rounded-[2.5rem] p-8 shadow-inner-white border border-gray-50 flex justify-center"
                    >
                        <SankeyChart
                            data={sankeyData}
                            width={1000}
                            height={540}
                            onLinkClick={(source, target) => handleDrillDown(source, target)}
                            onNodeClick={(source, target) => handleDrillDown(source, target)}
                        />
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center gap-6 py-20">
                        <div className="relative">
                            <div className="size-16 border-4 border-[#621f32]/5 rounded-full" />
                            <div className="absolute inset-0 size-16 border-4 border-[#621f32] border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">
                            Mapeando Estructura...
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Insight */}
            <div className="px-8 pb-6 flex items-center gap-4">
                {/* react-doctor-disable-next-line react-doctor/design-no-space-on-flex-children */}
                <div className="flex -space-x-2">
                    <div className="size-2.5 rounded-full bg-[#621f32] ring-2 ring-white" />
                    <div className="size-2.5 rounded-full bg-[#bc955c] ring-2 ring-white" />
                </div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Deslgose de flujos proporcionales entre unidades y niveles
                </p>
            </div>
        </div>
    );
}

function LegendItem({ icon, label, value, color, bg }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`p-2.5 ${bg} ${color} rounded-xl shadow-sm ring-1 ring-black/5`}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</span>
                <span className="text-xs font-black text-gray-900 leading-none">{value}</span>
            </div>
        </div>
    );
}
