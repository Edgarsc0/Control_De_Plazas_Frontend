'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PageTabBar from '@/components/ui/PageTabBar';
import { Calculator, Settings2, Book, Layers, FileText, Variable } from 'lucide-react';
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
            style={{ minHeight: 'calc(100vh - var(--stack-h,9rem))' }}
        >
            {/* ── Fixed tab bar ─────────────────────────────────────────────── */}
            <PageTabBar
                tabs={TABS}
                activeTab={activeTab}
                onSelect={handleSelectTab}
                subtabConfigs={subtabConfigs}
            />

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
