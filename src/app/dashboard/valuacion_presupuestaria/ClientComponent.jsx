'use client';

import React, { useState, useEffect } from 'react';
import { PresupuestoService } from '@/services/presupuesto.service';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { Calculator, Settings2, Book, Search } from 'lucide-react';

import SimuladorValuacion from './_components/SimuladorValuacion';
import ParametrosValuacion from './_components/ParametrosValuacion';
import AsuntosValuacion from './_components/AsuntosValuacion';

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

    const handleNavigateToSimulador = (asunto) => {
        setSelectedAsuntoForSimulation(asunto);
        setActiveTab('simulador');
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

    return (
        <div className={`w-full mx-auto px-3 md:px-6 pb-24 space-y-8 font-sans transition-all duration-300 ${
            selectedAsuntoForSimulation ? 'max-w-[1720px]' : 'max-w-[1340px]'
        }`}
            style={{ minHeight: '100vh' }}>

            {/* ── MAIN TAB BAR ─────────────────────────────────────────────── */}
            <div className=" flex items-center gap-1 bg-white rounded-2xl p-1.5 w-max
                            border border-gray-200/80 shadow-sm mx-auto lg:mx-0">
                {[
                    { id: 'simulador', label: 'Simulador', icon: Calculator },
                    { id: 'parametros', label: 'Parámetros', icon: Settings2 },
                    { id: 'asuntos', label: 'Asuntos de solicitud de ocupación de plazas', icon: Book }
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2.5 px-7 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200
                            ${activeTab === id
                                ? 'bg-[#621f32] text-white shadow-lg shadow-[#621f32]/30'
                                : 'text-gray-400 hover:text-[#621f32] hover:bg-gray-50'}`}
                    >
                        <Icon className={`w-3.5 h-3.5 ${activeTab === id ? 'text-amber-400' : ''}`} />
                        {label}
                    </button>
                ))}
            </div>

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
                    setActiveParamTab={setActiveParamTab}
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

        </div>
    );
}
