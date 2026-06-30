'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { Calculator, Settings2, Book, ChevronDown, Layers, FileText, Variable } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegisterPageTabs } from '@/context/PageTabsContext';

import SimuladorValuacion from './_components/SimuladorValuacion';
import ParametrosValuacion from './_components/ParametrosValuacion';
import AsuntosValuacion from './_components/AsuntosValuacion';

const TABS = [
    { id: 'simulador', label: 'Simulador', icon: Calculator },
    { id: 'parametros', label: 'Parámetros', icon: Settings2 },
    { id: 'asuntos', label: 'Asuntos de Plazas', icon: Book },
];

export default function ValuacionPresupuestaria({
    initialCatalogo = [],
    initialConstantes = [],
    initialConceptos = []
}) {
    const [activeTab, setActiveTab] = useState('simulador');
    const [activeParamTab, setActiveParamTab] = useState('catalogo');
    const [openSubtabId, setOpenSubtabId] = useState(null);
    const tabsBarRef = useRef(null);

    const [catalogo, setCatalogo] = useState(initialCatalogo);
    const [constantes, setConstantes] = useState(initialConstantes);
    const [conceptos, setConceptos] = useState(initialConceptos);

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [paramSearchTerm, setParamSearchTerm] = useState('');
    const [selectedAsuntoForSimulation, setSelectedAsuntoForSimulation] = useState(null);
    const [, startTransition] = useTransition();

    const handleSelectTab = useCallback((id) => {
        startTransition(() => setActiveTab(id));
    }, [startTransition]);

    useRegisterPageTabs({
        tabs: TABS,
        activeTab,
        onSelect: handleSelectTab,
        title: 'Valuación Presupuestaria',
    });

    const handleNavigateToSimulador = (asunto) => {
        setSelectedAsuntoForSimulation(asunto);
        startTransition(() => setActiveTab('simulador'));
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [catRes, constRes, concRes] = await Promise.all([
                PresupuestoService.getCatalogoPlazas(),
                PresupuestoService.getConstantes(),
                PresupuestoService.getConceptos()
            ]);
            if (catRes.ok) setCatalogo(await catRes.json());
            if (constRes.ok) setConstantes(await constRes.json());
            if (concRes.ok) setConceptos(await concRes.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (tabsBarRef.current && !tabsBarRef.current.contains(e.target)) {
                setOpenSubtabId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) return <LoadingOverlay isLoading />;

    const subtabConfigs = {
        parametros: {
            options: [
                { id: 'catalogo', label: 'Catálogo Plazas', icon: Layers },
                { id: 'conceptos', label: 'Conceptos Pres.', icon: FileText },
                { id: 'constantes', label: 'Constantes', icon: Variable },
            ],
            active: activeParamTab,
            setActive: setActiveParamTab,
        },
    };

    return (
        <div
            className="w-full font-sans"
            style={{ minHeight: '100vh' }}
        >
            {/* ── Fixed tab bar ─────────────────────────────────────────────── */}
            <div
                ref={tabsBarRef}
                className="fixed top-36 left-0 right-0 z-30 hidden sm:flex items-stretch bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-md"
            >
                {TABS.map((tab) => {
                    const subtabConfig = subtabConfigs[tab.id];
                    const isActive = activeTab === tab.id;
                    const isDropdownOpen = openSubtabId === tab.id;
                    return (
                        <div
                            key={tab.id}
                            className="relative flex-1"
                            onMouseEnter={() => subtabConfig && setOpenSubtabId(tab.id)}
                            onMouseLeave={() => subtabConfig && setOpenSubtabId(null)}
                        >
                            <button
                                onClick={() => {
                                    if (activeTab !== tab.id) {
                                        startTransition(() => setActiveTab(tab.id));
                                        setOpenSubtabId(subtabConfig ? tab.id : null);
                                    } else {
                                        setOpenSubtabId(isDropdownOpen ? null : (subtabConfig ? tab.id : null));
                                    }
                                }}
                                className={`flex items-center justify-center gap-1.5 w-full whitespace-nowrap px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer border-r border-slate-200/50 ${
                                    isActive
                                        ? 'bg-gradient-to-b from-[#621f32] to-[#8d2c48] text-white'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon className="size-3.5 flex-shrink-0" />
                                {tab.label}
                                {subtabConfig && (
                                    <ChevronDown
                                        className={`size-3 ml-0.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>
                            <AnimatePresence>
                                {isDropdownOpen && subtabConfig && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute top-full left-0 bg-white/95 backdrop-blur-md border border-t-0 border-slate-200/50 shadow-lg z-40 min-w-full"
                                    >
                                        {subtabConfig.options.map((sub) => {
                                            const SubIcon = sub.icon;
                                            return (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => {
                                                        if (activeTab !== tab.id) {
                                                            startTransition(() => setActiveTab(tab.id));
                                                        }
                                                        subtabConfig.setActive(sub.id);
                                                        setOpenSubtabId(null);
                                                    }}
                                                    className={`w-full text-left flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap border-b border-slate-100 last:border-b-0 ${
                                                        subtabConfig.active === sub.id
                                                            ? 'bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f]'
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-[#621f32]'
                                                    }`}
                                                >
                                                    <SubIcon className="size-3 shrink-0" />
                                                    {sub.label}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* ── Content ───────────────────────────────────────────────────── */}
            <div className={`pt-14 ${activeTab === 'parametros' ? 'pb-0' : 'pb-24 py-8 px-4 lg:px-6 max-w-[1700px] mx-auto'}`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'simulador' && (
                            <SimuladorValuacion
                                catalogo={catalogo}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                selectedAsunto={selectedAsuntoForSimulation}
                                onCloseAsunto={() => setSelectedAsuntoForSimulation(null)}
                            />
                        )}
                        {activeTab === 'parametros' && (
                            <ParametrosValuacion
                                activeParamTab={activeParamTab}
                                catalogo={catalogo}
                                setCatalogo={setCatalogo}
                                constantes={constantes}
                                setConstantes={setConstantes}
                                conceptos={conceptos}
                                setConceptos={setConceptos}
                                paramSearchTerm={paramSearchTerm}
                                setParamSearchTerm={setParamSearchTerm}
                                fetchInitialData={fetchInitialData}
                            />
                        )}
                        {activeTab === 'asuntos' && (
                            <AsuntosValuacion onNavigateToSimulador={handleNavigateToSimulador} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
