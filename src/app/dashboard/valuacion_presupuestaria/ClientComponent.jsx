'use client';

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PageTabBar from '@/components/ui/PageTabBar';
import { Calculator, Settings2, Book, Layers, FileText, Variable } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegisterPageTabs } from '@/context/PageTabsContext';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/config/permissions';

import SimuladorValuacion from './_components/SimuladorValuacion';
import ParametrosValuacion from './_components/ParametrosValuacion';
import AsuntosValuacion from './_components/AsuntosValuacion';

const TABS = [
    { id: 'simulador', label: 'Simulador', icon: Calculator, permission: PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA },
    { id: 'parametros', label: 'Parámetros', icon: Settings2, permission: PERMISSIONS.EDIT_VALUACION_PARAMETROS },
    { id: 'asuntos', label: 'Asuntos de Plazas', icon: Book, permission: PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA },
];

export default function ValuacionPresupuestaria({
    initialCatalogo = [],
    initialConstantes = [],
    initialConceptos = []
}) {
    const { isLoading: authLoading, hasPermission: rawHasPermission } = useAuth();
    // Durante la carga inicial de permisos se muestran los botones de tab de
    // forma optimista (arriba), pero el CONTENIDO real solo se muestra cuando
    // el permiso ya se confirmó — evita el flash de datos reales sin permiso.
    const hasPermission = useCallback(
        (codename) => !authLoading && rawHasPermission(codename),
        [authLoading, rawHasPermission]
    );
    // Mientras cargan los permisos se muestran todos los tabs (optimista, sin
    // parpadeo) — el backend igual exige el permiso real en cada endpoint.
    const visibleTabs = useMemo(
        () => TABS.filter((t) => authLoading || hasPermission(t.permission)),
        [authLoading, hasPermission]
    );

    const [activeTab, setActiveTab] = useState('simulador');
    const [activeParamTab, setActiveParamTab] = useState('catalogo');

    useEffect(() => {
        if (!authLoading && visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [authLoading, visibleTabs, activeTab]);

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

    // Se registra aquí (no más abajo) para que el detector de presencia
    // (PresenceHeartbeat) también vea el sub-tab activo dentro de "Parámetros".
    const subtabConfigs = useMemo(() => ({
        parametros: {
            options: [
                { id: 'catalogo', label: 'Catálogo Plazas', icon: Layers },
                { id: 'conceptos', label: 'Conceptos Pres.', icon: FileText },
                { id: 'constantes', label: 'Constantes', icon: Variable },
            ],
            active: activeParamTab,
            setActive: setActiveParamTab,
        },
    }), [activeParamTab]);

    useRegisterPageTabs({
        tabs: visibleTabs,
        activeTab,
        onSelect: handleSelectTab,
        title: 'Valuación Presupuestaria',
        subtabConfigs,
    });

    const handleNavigateToSimulador = (asunto) => {
        setSelectedAsuntoForSimulation(asunto);
        startTransition(() => setActiveTab('simulador'));
    };

    // El asunto guardado vuelve del backend sin `oficioInfo` (ese enriquecido lo
    // arma AsuntosValuacion), así que se conserva el que ya tenía en memoria.
    const handleValuacionGuardada = useCallback((asuntoActualizado) => {
        setSelectedAsuntoForSimulation((prev) =>
            prev ? { ...prev, ...asuntoActualizado, oficioInfo: prev.oficioInfo } : prev
        );
    }, []);

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

    return (
        <div
            className="w-full font-sans"
            style={{ minHeight: 'calc(100vh - var(--stack-h,9rem))' }}
        >
            {/* ── Fixed tab bar ─────────────────────────────────────────────── */}
            <PageTabBar
                tabs={visibleTabs}
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
                        {activeTab === 'simulador' && hasPermission(PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA) && (
                            <SimuladorValuacion
                                catalogo={catalogo}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                selectedAsunto={selectedAsuntoForSimulation}
                                onCloseAsunto={() => setSelectedAsuntoForSimulation(null)}
                                onValuacionGuardada={handleValuacionGuardada}
                            />
                        )}
                        {activeTab === 'parametros' && hasPermission(PERMISSIONS.EDIT_VALUACION_PARAMETROS) && (
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
                        {activeTab === 'asuntos' && hasPermission(PERMISSIONS.VIEW_VALUACION_PRESUPUESTARIA) && (
                            <AsuntosValuacion onNavigateToSimulador={handleNavigateToSimulador} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
