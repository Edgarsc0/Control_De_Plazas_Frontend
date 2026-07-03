'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Barra de tabs fija (desktop) tipo pill flotante con indicador animado.
 * En móvil la navegación de tabs vive en el Drawer del BottomNav
 * (ver PageTabsContext); esta barra sólo se muestra en sm+.
 *
 * @param {{id:string,label:string,icon?:Function}[]} tabs
 * @param {string} activeTab
 * @param {(id:string)=>void} onSelect
 * @param {Record<string, {options:{id:string,label:string,icon?:Function}[], active:string, setActive:(id:string)=>void}>} [subtabConfigs]
 * @param {string} [layoutId] - id único del layoutId de motion; sólo hace falta cambiarlo si hay 2 barras montadas a la vez.
 */
export default function PageTabBar({ tabs, activeTab, onSelect, subtabConfigs = {}, layoutId = 'pageTabActivePill' }) {
    const [openSubtabId, setOpenSubtabId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState(null);
    const barRef = useRef(null);
    const tabRefs = useRef(new Map());
    const closeTimerRef = useRef(null);

    const openDropdown = useCallback((tabId) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        const el = tabRefs.current.get(tabId);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
        setOpenSubtabId((prev) => (prev === tabId ? prev : tabId));
    }, []);

    // Cierre con pequeño delay: al mover el mouse del tab al dropdown
    // (portal, fuera del árbol DOM del wrapper) se dispara mouseleave
    // antes del mouseenter del dropdown; sin este margen se ve un parpadeo
    // de cierre/apertura.
    const closeDropdown = useCallback(() => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            setOpenSubtabId(null);
            setDropdownPos(null);
            closeTimerRef.current = null;
        }, 120);
    }, []);

    const closeDropdownNow = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setOpenSubtabId(null);
        setDropdownPos(null);
    }, []);

    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                barRef.current && !barRef.current.contains(e.target) &&
                !e.target.closest('[data-page-tab-dropdown]')
            ) {
                closeDropdownNow();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeDropdownNow]);

    // El pill bar tiene overflow-x-auto, lo que obliga overflow-y a auto
    // (regla CSS: un eje "auto" fuerza al otro a dejar "visible"). El menú
    // colgante quedaba clippeado por eso; se saca por portal y se reposiciona
    // en scroll/resize.
    useEffect(() => {
        if (!openSubtabId) return;
        const reposition = () => openDropdown(openSubtabId);
        window.addEventListener('resize', reposition);
        barRef.current?.addEventListener('scroll', reposition);
        return () => {
            window.removeEventListener('resize', reposition);
            barRef.current?.removeEventListener('scroll', reposition);
        };
    }, [openSubtabId, openDropdown]);

    return (
        <div className="fixed top-36 inset-x-0 z-30 hidden sm:flex justify-center">
            <div
                ref={barRef}
                className="flex items-center justify-between gap-1 p-1 w-full max-w-full overflow-x-auto rounded-none bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
            >
                {tabs.map((tab) => {
                    const subtabConfig = subtabConfigs[tab.id];
                    const isActive = activeTab === tab.id;
                    const isDropdownOpen = openSubtabId === tab.id;
                    const Icon = tab.icon;
                    return (
                        <div
                            key={tab.id}
                            ref={(el) => {
                                if (el) tabRefs.current.set(tab.id, el);
                                else tabRefs.current.delete(tab.id);
                            }}
                            className="relative flex-1"
                            onMouseEnter={() => subtabConfig && openDropdown(tab.id)}
                            onMouseLeave={() => subtabConfig && closeDropdown()}
                        >
                            <button
                                onClick={() => {
                                    if (activeTab !== tab.id) {
                                        onSelect(tab.id);
                                        if (subtabConfig) openDropdown(tab.id); else closeDropdownNow();
                                    } else if (isDropdownOpen) {
                                        closeDropdownNow();
                                    } else if (subtabConfig) {
                                        openDropdown(tab.id);
                                    }
                                }}
                                className={`relative flex w-full items-center justify-center gap-1.5 whitespace-nowrap px-4 py-1.5 rounded-lg text-[13px] font-bold transition-colors duration-200 cursor-pointer ${
                                    isActive ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId={layoutId}
                                        className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-[#621f32] to-[#8d2c48] shadow-md shadow-[#621f32]/25"
                                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                                    />
                                )}
                                {Icon && <Icon className="size-[15px] flex-shrink-0" />}
                                {tab.label}
                                {subtabConfig && (
                                    <ChevronDown
                                        className={`size-[13px] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {openSubtabId && dropdownPos && subtabConfigs[openSubtabId] && (
                        <motion.div
                            data-page-tab-dropdown
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            onMouseEnter={() => openDropdown(openSubtabId)}
                            onMouseLeave={closeDropdown}
                            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                            className="p-1.5 rounded-lg bg-white/95 backdrop-blur-md border border-slate-200/70 shadow-xl shadow-slate-900/10 z-[60]"
                        >
                            {subtabConfigs[openSubtabId].options.map((sub) => {
                                const SubIcon = sub.icon;
                                const isSubActive = subtabConfigs[openSubtabId].active === sub.id;
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => {
                                            if (activeTab !== openSubtabId) onSelect(openSubtabId);
                                            subtabConfigs[openSubtabId].setActive(sub.id);
                                            closeDropdownNow();
                                        }}
                                        className={`w-full text-left flex items-center gap-2 px-3.5 py-2.5 rounded-md text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                                            isSubActive
                                                ? 'bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f]'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-[#621f32]'
                                        }`}
                                    >
                                        {SubIcon && <SubIcon className="size-3.5 shrink-0" />}
                                        {sub.label}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
