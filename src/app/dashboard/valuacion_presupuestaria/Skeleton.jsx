'use client';

import React from 'react';

export default function Skeleton() {
    return (
        <div className="w-full max-w-[1700px] mx-auto px-2 md:px-4 space-y-8 font-sans pb-20 animate-pulse">
            {/* Main Navigation Tabs Skeleton */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl w-max border border-gray-200 shadow-sm mx-auto lg:mx-0">
                <div className="w-32 h-10 bg-gray-200 rounded-xl"></div>
                <div className="w-32 h-10 bg-gray-200 rounded-xl"></div>
            </div>

            <div className="space-y-8">
                {/* Header Section Skeleton */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gray-200"></div>
                    <div className="flex items-center gap-5">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 w-14 h-14"></div>
                        <div className="space-y-2">
                            <div className="h-8 w-64 bg-gray-200 rounded"></div>
                            <div className="h-3 w-48 bg-gray-100 rounded"></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 w-full lg:w-auto">
                        <div className="h-3 w-32 bg-gray-100 rounded"></div>
                        <div className="flex gap-2">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="w-10 h-10 bg-gray-100 rounded-xl"></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Step 1: Selection Layout Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {/* Column 1: Catalog Skeleton */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                        <div className="p-5 border-b border-gray-100 bg-gray-50/30 space-y-4">
                            <div className="h-4 w-32 bg-gray-200 rounded"></div>
                            <div className="h-12 w-full bg-gray-50 rounded-xl"></div>
                        </div>
                        <div className="flex-1 p-5 space-y-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex justify-between items-center py-2">
                                    <div className="space-y-2">
                                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                                        <div className="h-3 w-32 bg-gray-100 rounded"></div>
                                    </div>
                                    <div className="h-10 w-24 bg-gray-100 rounded-lg"></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Active Selection Skeleton */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100 bg-gray-50/30">
                            <div className="h-4 w-32 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
                            <div className="h-3 w-32 bg-gray-100 rounded"></div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 mt-auto">
                            <div className="w-full h-16 bg-gray-200 rounded-2xl"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
