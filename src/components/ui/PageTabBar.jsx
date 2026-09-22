'use client';

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Barra de tabs fija (desktop) tipo pill flotante con indicador animado.
 * En móvil la navegación de tabs vive en el Drawer del BottomNav
 * (ver PageTabsContext); esta barra sólo se muestra en md+. El breakpoint debe
 * coincidir con el `md:hidden` del BottomNav: con `sm:` ambas navegaciones se
 * mostraban a la vez entre 640 y 767px.
 *
 * @param {{id:string,label:string,icon?:Function}[]} tabs
 * @param {string} activeTab
 * @param {(id:string)=>void} onSelect
 * @param {Record<string, {options:{id:string,label:string,icon?:Function,tourId?:string}[], active:string, setActive:(id:string)=>void}>} [subtabConfigs]
 * @param {string} [layoutId] - id único del layoutId de motion; sólo hace falta cambiarlo si hay 2 barras montadas a la vez.
 * @param {string|null} [forceOpenTabId] - fuerza abierto el dropdown de subtabs de este tab (ignorando hover)
 *   y evita que se cierre solo (ni por mouseleave ni por clic fuera) — usado por los ProductTour que necesitan
 *   señalar una opción dentro del dropdown antes de que el usuario la elija.
 * @param {object} [ref] - reenviado al `<div>` fijo raíz (`position:fixed`), para que quien la use
 *   pueda medir su alto real (`getBoundingClientRect()`) y posicionar contenido justo debajo,
 *   en vez de adivinarlo con un padding-top fijo (ver CuadrosVacanciaTab en plantilla_empleados).
 */
const PageTabBar = forwardRef(function PageTabBar({ tabs, activeTab, onSelect, subtabConfigs = {}, layoutId = 'pageTabActivePill', forceOpenTabId = null }, ref) {
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
    // Mientras `forceOpenTabId` está activo, ignora el cierre por mouseleave:
    // el dropdown debe quedarse abierto para que el tour pueda señalarlo, sin
    // depender de que el mouse se quede encima.
    const closeDropdown = useCallback(() => {
        if (forceOpenTabId) return;
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            setOpenSubtabId(null);
            setDropdownPos(null);
            closeTimerRef.current = null;
        }, 120);
    }, [forceOpenTabId]);

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
            // Forzado por un tour: sólo se cierra al elegir una opción (ver
            // `onClick` de cada opción, que llama `closeDropdownNow` directo),
            // nunca por un clic fuera mientras el tour lo tiene abierto.
            if (forceOpenTabId) return;
            if (
                barRef.current && !barRef.current.contains(e.target) &&
                !e.target.closest('[data-page-tab-dropdown]')
            ) {
                closeDropdownNow();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeDropdownNow, forceOpenTabId]);

    // El tour externo pide abrir el dropdown de `forceOpenTabId` (ver
    // `openDropdown` — calcula la posición desde el `<div>` real del tab en
    // `tabRefs`, así que funciona igual que abrirlo con el mouse).
    const prevForceOpenTabIdRef = useRef(null);
    useEffect(() => {
        if (forceOpenTabId) {
            openDropdown(forceOpenTabId);
        } else if (prevForceOpenTabIdRef.current) {
            // Dejó de forzarse: como nunca hubo un mouseleave real que
            // programara el cierre (se abrió por código, no por hover), hay
            // que cerrarlo explícito — si no, se queda pegado abierto.
            closeDropdownNow();
        }
        prevForceOpenTabIdRef.current = forceOpenTabId;
    }, [forceOpenTabId, openDropdown, closeDropdownNow]);

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
        <div ref={ref} className="fixed top-40 inset-x-0 z-30 hidden md:flex justify-center">
            <div
                ref={barRef}
                className="relative flex items-center justify-between gap-1 p-1 w-full max-w-full overflow-x-auto rounded-none [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
            >
                {/* Fondo con blur aislado en capa propia: si comparte elemento con
                    el pill animado, Chrome/Firefox recalculan el backdrop-filter en
                    cada frame del spring aunque el pill sólo use transform, causando
                    la traba visible. Separado, el fondo no repinta durante la animación. */}
                <div className="absolute inset-0 -z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm" aria-hidden="true" />
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
                                        className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-[#621f32] to-[#8d2c48] shadow-sm shadow-[#621f32]/15"
                                        transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
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
                            style={{
                                position: 'fixed',
                                top: dropdownPos.top,
                                left: dropdownPos.left,
                                minWidth: Math.max(200, dropdownPos.width)
                            }}
                            className="p-1 rounded-xl bg-white/98 backdrop-blur-md border border-slate-200/60 shadow-[0_12px_36px_rgba(98,31,50,0.08),0_4px_12px_rgba(0,0,0,0.03)] z-[60]"
                        >
                            {subtabConfigs[openSubtabId].options.map((sub) => {
                                const SubIcon = sub.icon;
                                const isSubActive = subtabConfigs[openSubtabId].active === sub.id;
                                return (
                                    <button
                                        key={sub.id}
                                        data-tour={sub.tourId}
                                        onClick={() => {
                                            if (activeTab !== openSubtabId) onSelect(openSubtabId);
                                            subtabConfigs[openSubtabId].setActive(sub.id);
                                            closeDropdownNow();
                                        }}
                                        className={`w-full text-left flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                                            isSubActive
                                                ? 'bg-[#8d2c48]/12 text-[#621f32] shadow-sm shadow-[#8d2c48]/5'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-[#621f32]'
                                        }`}
                                    >
                                        {SubIcon && (
                                            <SubIcon
                                                className={`size-3.5 shrink-0 transition-transform duration-200 ${
                                                    isSubActive ? 'scale-105 text-[#621f32]' : 'text-slate-400'
                                                    }`}
                                            />
                                        )}
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
});

export default PageTabBar;
