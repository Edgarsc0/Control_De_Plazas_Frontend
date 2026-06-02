import React from 'react';

export default function DashboardSkeleton() {
    return (
        <div className="w-full flex flex-col items-center">
            {/* Header Skeleton - Réplica exacta del Dashboard real */}
            <div className="w-full max-w-screen-xl px-4 lg:px-6 py-12">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-16 animate-pulse">
                    {/* Icono Estilizado Skeleton */}
                    <div className="p-5 bg-gray-200/80 rounded-3xl shadow-lg flex-shrink-0 size-24"></div>

                    <div className="max-w-screen-md flex-1 space-y-4">
                        {/* Título Skeleton */}
                        <div className="h-10 bg-gray-200/80 rounded-lg w-2/3"></div>
                        {/* Descripción Skeleton */}
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200/60 rounded-md w-full"></div>
                            <div className="h-4 bg-gray-200/60 rounded-md w-5/6"></div>
                        </div>
                    </div>
                </div>

                {/* Bento Grid Skeleton - Sincronizado con ClientComponent.jsx */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 auto-rows-[240px]">

                    {/* Card 1: Eficiencia (col-span-2) */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex items-center justify-between gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="flex justify-between items-start">
                                <div className="size-12 bg-gray-200 rounded-xl"></div>
                                <div className="w-20 h-5 bg-gray-200 rounded-full"></div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
                                <div className="h-4 bg-gray-200/60 rounded-md w-1/2"></div>
                            </div>
                            <div className="h-12 bg-gray-200 rounded-lg w-1/2"></div>
                        </div>
                        <div className="size-32 bg-gray-200/80 rounded-full"></div>
                    </div>

                    {/* Card 2: Dashboard (col-span-2) */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="size-12 bg-gray-200 rounded-xl"></div>
                            <div className="w-24 h-6 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-8 bg-gray-200 rounded-md w-1/2"></div>
                            <div className="h-20 bg-gray-200/40 rounded-xl w-full"></div>
                        </div>
                    </div>

                    {/* Card 3: RH (col-span-2) */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="size-12 bg-gray-200 rounded-xl"></div>
                            <div className="w-20 h-5 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="h-10 bg-gray-200 rounded-md w-full"></div>
                                <div className="h-4 bg-gray-200/60 rounded-md w-3/4"></div>
                            </div>
                            <div className="space-y-3">
                                {/* react-doctor-disable-next-line react-doctor/no-array-index-as-key */}
                                {[1, 2, 3].map(i => <div key={i} className="h-2 bg-gray-200 rounded-full w-full"></div>)}
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Legalidad (col-span-2) */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="size-12 bg-gray-200 rounded-xl"></div>
                            <div className="w-24 h-5 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-6 bg-gray-200 rounded-md w-1/3"></div>
                            <div className="space-y-3">
                                {/* react-doctor-disable-next-line react-doctor/no-array-index-as-key */}
                                {[1, 2].map(i => <div key={i} className="h-3 bg-gray-200/60 rounded-full w-full"></div>)}
                            </div>
                        </div>
                    </div>

                    {/* Card 5: Control (col-span-2) */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="size-12 bg-gray-200 rounded-xl"></div>
                            <div className="w-28 h-6 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="h-12 bg-gray-200/50 rounded-lg w-full"></div>
                        <div className="h-16 bg-gray-200 rounded-lg w-full"></div>
                    </div>

                    {/* Card 6: Red (col-span-1) */}
                    <div className="lg:col-span-1 bg-white/40 backdrop-blur-md rounded-[28px] border border-gray-200/50 p-8 animate-pulse flex flex-col gap-6">
                        <div className="size-12 bg-gray-200 rounded-xl"></div>
                        <div className="h-6 bg-gray-200 rounded-md w-full"></div>
                        <div className="grid grid-cols-3 gap-2 mt-auto">
                            {/* react-doctor-disable-next-line react-doctor/no-array-index-as-key */}
                            {[1, 2, 3].map(i => <div key={i} className="h-6 bg-gray-200/40 rounded-full w-full"></div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
