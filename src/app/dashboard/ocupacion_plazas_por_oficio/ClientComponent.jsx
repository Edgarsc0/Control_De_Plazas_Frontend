"use client";

import { Briefcase } from "lucide-react"
import { Zoom } from "@/components/shared/Reveal";
import SolicitudesOcupacionTable from './_components/SolicitudesOcupacionTable';

export default function OcupacionPlazasPorOficio() {
    return (
        <section className="bg-transparent relative transition-all duration-300 overflow-hidden h-full min-h-0 flex flex-col">
            <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
            <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

            <div className="w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 pt-3 md:pt-8 gap-2">
                <Zoom triggerOnce>
                    <div className="flex items-start sm:items-center gap-6 mb-4">
                        <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Briefcase className="size-8 sm:size-10 text-white" />
                        </div>
                        <div className="max-w-screen-md">
                            <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
                                Ocupación de <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">Plazas por Oficio</span>
                            </h2>
                            <p className="hidden md:block mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                                Oficios de solicitud de ocupación de plazas de nueva creación: Resolución y Oficio de Notificación de Ocupación.
                            </p>
                        </div>
                    </div>
                </Zoom>
            </div>

            <SolicitudesOcupacionTable />
        </section>
    );
}
