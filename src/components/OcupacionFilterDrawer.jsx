import { motion, AnimatePresence } from 'motion/react';
import { X, Search, XCircle, CheckSquare, Square, Check, SlidersHorizontal } from "lucide-react";

export default function OcupacionFilterDrawer({
    isOpen,
    onClose,
    searchTerm,
    setSearchTerm,
    allOffices,
    excludedOffices,
    filteredOffices,
    toggleOffice,
    resetFilters,
    excludeAll
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - Simplified, no blur for performance */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4 sm:p-6"
                    >
                        {/* Modal Container - Hardware accelerated */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white w-full max-w-2xl max-h-[75vh] mt-20 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative border border-gray-100 transform-gpu"
                        >
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-[#621f32]/5 rounded-xl">
                                        <SlidersHorizontal className="size-5 text-[#621f32]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Filtros de Oficios</h3>
                                        <p className="text-gray-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-0.5">Gestión de visualización</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-900 group"
                                >
                                    <X className="size-5 group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            {/* Search and Quick Selection */}
                            <div className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 space-y-4">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-300 group-focus-within:text-[#621f32] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar oficio..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-11 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-[#621f32]/5 focus:border-[#621f32]/20 transition-all placeholder:text-gray-300 shadow-sm"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm("")}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                        >
                                            <XCircle className="size-3.5 text-gray-400 hover:text-[#621f32]" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 flex gap-2">
                                        <button
                                            onClick={resetFilters}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:border-[#621f32]/30 hover:text-[#621f32] transition-all shadow-sm active:scale-95"
                                        >
                                            <CheckSquare className="size-3.5" />
                                            Todos
                                        </button>
                                        <button
                                            onClick={excludeAll}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:border-[#621f32]/30 hover:text-[#621f32] transition-all shadow-sm active:scale-95"
                                        >
                                            <Square className="size-3.5" />
                                            Ninguno
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-center px-4 py-2 bg-[#621f32]/5 rounded-xl border border-[#621f32]/10 min-w-[120px]">
                                        <span className="text-[10px] font-black text-[#621f32] uppercase tracking-tighter">
                                            {allOffices.length - excludedOffices.length} / {allOffices.length} Activos
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* List Area */}
                            <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-6">
                                    {filteredOffices.length === 0 ? (
                                        <div className="col-span-full py-12 text-center flex flex-col items-center gap-3">
                                            <div className="p-3 bg-gray-50 rounded-full">
                                                <Search className="size-6 text-gray-200" />
                                            </div>
                                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Sin coincidencias</p>
                                        </div>
                                    ) : (
                                        filteredOffices.map((office) => {
                                            const isExcluded = excludedOffices.includes(office);
                                            return (
                                                <button
                                                    key={office}
                                                    onClick={() => toggleOffice(office)}
                                                    className={`
                                                        flex items-center justify-between p-3 rounded-xl transition-all border text-left group
                                                        ${!isExcluded 
                                                            ? 'bg-white border-gray-100 shadow-sm hover:border-[#621f32]/20' 
                                                            : 'bg-gray-50/40 border-transparent opacity-60 hover:opacity-100'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-2.5 truncate">
                                                        <div className={`
                                                            size-5 rounded-md flex items-center justify-center transition-all duration-300 flex-shrink-0
                                                            ${!isExcluded 
                                                                ? 'bg-[#621f32] text-white shadow-md shadow-[#621f32]/20' 
                                                                : 'bg-white border-2 border-gray-200 text-transparent group-hover:border-[#621f32]/30'
                                                            }
                                                        `}>
                                                            <Check className={`size-3 transition-transform ${!isExcluded ? 'scale-100' : 'scale-0'}`} />
                                                        </div>
                                                        <span className={`text-[10px] font-bold tracking-tight truncate uppercase transition-colors ${!isExcluded ? 'text-gray-900' : 'text-gray-400'}`}>
                                                            {office === '(vacío)' ? 'Sin Registro' : office}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex items-center justify-center">
                                <button
                                    onClick={onClose}
                                    className="w-full max-w-[280px] py-3 bg-[#621f32] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-[#621f32]/20 hover:bg-[#4a1726] hover:-translate-y-0.5 transition-all active:scale-95"
                                >
                                    Aplicar Filtros
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
