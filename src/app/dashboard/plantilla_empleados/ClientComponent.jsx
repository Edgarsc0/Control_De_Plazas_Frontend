"use client";

import { useState, useTransition, useEffect, useRef, use, Suspense } from "react";
import { Zoom } from "react-awesome-reveal";
import {
  LayoutDashboard,
  ChevronRight,
  Users,
  Briefcase,
  Globe
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useRefreshOnZafiroUpdate } from "@/context/ZafiroUpdatesContext";
import PlantillaDetalleTab from "./_components/tabs/plantilla-detalle/PlantillaDetalleTab";
import EstatusTab from "./_components/tabs/estatus/EstatusTab";
import MovimientosTab from "./_components/tabs/movimientos/MovimientosTab";
import MovimientosPersonalTab from "./_components/tabs/mov-posiciones/MovimientosPersonalTab";
import MapaTab from "./_components/tabs/mapa/MapaTab";
import BajasTab from "./_components/tabs/bajas/BajasTab";
import TorreCaballito3DTab from "./_components/tabs/torre-3d/TorreCaballito3DTab";
import CuadrosVacanciaTab from "./_components/tabs/cuadros-vacancia/CuadrosVacanciaTab";

const SECONDARY_TAB_SKELETON = (
  <div className="flex items-center justify-center py-24">
    <div className="size-8 border-[4px] border-[#621f32]/20 border-t-[#621f32] rounded-full animate-spin" />
  </div>
);

// Los tabs "Bajas" y "Cuadros de Vacancia" solo necesitan datos secundarios.
// `use()` suspende este subárbol hasta que la promesa resuelva, sin bloquear
// el resto de la página (que ya está montada con los datos críticos).
function BajasTabSection({ secondaryDataPromise, isPending, startTransition, cardRef }) {
  const [bajasResult, motivosResult, historicoResult] = use(secondaryDataPromise);
  const bajasData = bajasResult.status === 'fulfilled' ? (bajasResult.value || []) : [];
  const bajasMotivos = motivosResult.status === 'fulfilled' ? (motivosResult.value || []) : [];
  const bajasHistorico = historicoResult.status === 'fulfilled' ? (historicoResult.value || []) : [];
  return (
    <BajasTab
      bajasData={bajasData}
      bajasMotivos={bajasMotivos}
      bajasHistorico={bajasHistorico}
      isPending={isPending}
      startTransition={startTransition}
      cardRef={cardRef}
    />
  );
}

function CuadrosVacanciaSection({ secondaryDataPromise, onSwitchToTablaPrincipal }) {
  const [, , , cuadrosResult, desgloseResult] = use(secondaryDataPromise);
  const cuadrosData = cuadrosResult.status === 'fulfilled' ? (cuadrosResult.value || []) : [];
  const desgloseJerarquicoData = desgloseResult.status === 'fulfilled' ? (desgloseResult.value || []) : [];
  return (
    <CuadrosVacanciaTab
      cuadrosData={cuadrosData}
      desgloseJerarquicoData={desgloseJerarquicoData}
      onSwitchToTablaPrincipal={onSwitchToTablaPrincipal}
    />
  );
}

export default function PlantillaEmpleadosDetalle({
  resumen,
  detalle = [],
  estatusPorNivelUa = { por_nivel: {}, por_ua: {} },
  distribucionGeografica = [],
  movPosData = [],
  secondaryDataPromise
}) {
  const [activeTab, setActiveTab] = useState("detalle");
  const [activeEstatusSubTab, setActiveEstatusSubTab] = useState("nivel");
  const [activeMapaSubTab, setActiveMapaSubTab] = useState("nacional");
  const [activeMovimientosSubTab, setActiveMovimientosSubTab] = useState("tabla");
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef(null);
  useRefreshOnZafiroUpdate();
  const isTightLayout = activeTab === "detalle" || activeTab === "movimientos" || activeTab === "movimientos_personal" || activeTab === "bajas" || activeTab === "organigrama" || activeTab === "mapa";

  // Prevent page scroll when on the map tab
  useEffect(() => {
    if (activeTab === "mapa") {
      document.documentElement.classList.add("overflow-hidden");
      document.body.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, [activeTab]);

  // Window scroll clamping to prevent scrolling below the table
  useEffect(() => {
    const isTableTab = isTightLayout && activeTab !== "mapa";
    if (!isTableTab) return;

    const handleWindowScroll = () => {
      if (!cardRef.current) return;

      // Calculate absolute page-relative offset top
      let el = cardRef.current;
      let absoluteTop = 0;
      while (el) {
        absoluteTop += el.offsetTop;
        el = el.offsetParent;
      }

      // 144px is the height of the fixed top navigation + banner (scroll-mt-36)
      const maxScroll = Math.max(0, absoluteTop - 144);
      if (window.scrollY > maxScroll) {
        window.scrollTo(window.scrollX, maxScroll);
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [activeTab]);

  return (
    <section className={`bg-transparent relative transition-all duration-300 overflow-hidden ${isTightLayout ? "pb-0" : "pb-20"}`}>
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      <div className={`mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 ${activeTab === "mapa" ? "p-0" : isTightLayout ? "pt-4 pb-0" : "pt-12 pb-12"}`}>
        <div className={`w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 transition-all duration-300 ${isTightLayout ? "gap-2" : "gap-6"}`}>

          <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full transition-all duration-300 ${isTightLayout ? "mb-2" : "mb-6"} ${activeTab === "mapa" ? "absolute top-4 left-0 right-0 mx-auto z-50 pointer-events-none" : "relative"}`}>
            <div className="pointer-events-auto flex items-center">
            <Zoom triggerOnce>
              <nav className="flex text-sm font-medium" aria-label="Breadcrumb">
                <ol className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md">
                  <li className="inline-flex items-center text-gray-400">
                    <Link href="/dashboard" className="inline-flex items-center text-xs hover:text-[#621f32] dark:hover:text-[#bc955c] transition-colors duration-200">
                      <LayoutDashboard className="size-3.5 mr-1.5" />
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <div className="flex items-center gap-1.5">
                      <ChevronRight className="size-3 text-gray-300 dark:text-gray-600" />
                      <span className="text-[#621f32] dark:text-[#bc955c] font-black uppercase tracking-wider text-[10px]">
                        Plantilla de Empleados
                      </span>
                    </div>
                  </li>
                </ol>
              </nav>
            </Zoom>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md w-full lg:w-auto z-10 pointer-events-auto">
              <div className="flex p-0.5 gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto">
                {[
                  { id: "detalle", label: "Plantilla Detalle" },
                  { id: "estatus", label: "Estatus Nómina" },
                  { id: "movimientos", label: "Mov. Posiciones" },
                  { id: "movimientos_personal", label: "Movimientos" },
                  { id: "bajas", label: "Empleados Bajas" },
                  { id: "mapa", label: "Distribución Geográfica" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => startTransition(() => setActiveTab(tab.id))}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer text-center ${activeTab === tab.id
                      ? "bg-gradient-to-r from-[#621f32] to-[#8d2c48] text-white shadow-md shadow-[#621f32]/20"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="min-h-[36px] flex items-center justify-center w-full sm:w-auto">
                <AnimatePresence mode="wait">
                  {activeTab === "estatus" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto"
                    >
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 select-none hidden sm:inline">
                        Agrupar:
                      </span>
                      {[
                        { id: "nivel", label: "Por Nivel" },
                        { id: "ua", label: "Por UA" }
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveEstatusSubTab(sub.id)}
                          className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer text-center ${activeEstatusSubTab === sub.id
                            ? "bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f] shadow-md shadow-[#bc955c]/20"
                            : "text-slate-500 hover:text-[#621f32] dark:text-slate-400 dark:hover:text-[#bc955c]"
                            }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {activeTab === "movimientos" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto"
                    >
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 select-none hidden sm:inline">
                        Ver:
                      </span>
                      {[
                        { id: "tabla", label: "Tabla Principal" },
                        { id: "cuadros", label: "Cuadros Vacancia" }
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveMovimientosSubTab(sub.id)}
                          className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer text-center ${activeMovimientosSubTab === sub.id
                            ? "bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f] shadow-md shadow-[#bc955c]/20"
                            : "text-slate-500 hover:text-[#621f32] dark:text-slate-400 dark:hover:text-[#bc955c]"
                            }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {activeTab === "mapa" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/30 dark:border-slate-800/30 w-full sm:w-auto"
                    >
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 select-none hidden sm:inline">
                        Ver:
                      </span>
                      {[
                        { id: "nacional", label: "Mapa Nacional" },
                        { id: "caballito", label: "Torre Caballito" }
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveMapaSubTab(sub.id)}
                          className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer text-center ${activeMapaSubTab === sub.id
                            ? "bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f] shadow-md shadow-[#bc955c]/20"
                            : "text-slate-500 hover:text-[#621f32] dark:text-slate-400 dark:hover:text-[#bc955c]"
                            }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {activeTab !== "mapa" && (
          <Zoom triggerOnce>
            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 ${isTightLayout ? "mb-4" : "mb-12"}`}>
              <div className="flex items-start sm:items-center gap-6">
                <div className="relative p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Users className="size-10 text-white" />
                </div>
                <div className="max-w-screen-md">
                  <h2 className="text-4xl sm:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
                    {activeTab === "movimientos_personal" ? (
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                        Movimientos de personal
                      </span>
                    ) : activeTab === "movimientos" && activeMovimientosSubTab === "cuadros" ? (
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                        Cuadros de Vacancia
                      </span>
                    ) : (
                      <>
                        Plantilla de <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">{activeTab === "bajas" ? "Empleados Bajas" : "Empleados Activos"}</span>
                      </>
                    )}
                  </h2>
                  {activeTab !== "movimientos_personal" && (
                    <p className="mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                      Detalle completo de plazas, estatus administrativo y estructura funcional en la ANAM.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Zoom>
          )}
        </div>

        <div className="w-full mt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "detalle" && (
                <PlantillaDetalleTab
                  detalle={detalle}
                  resumen={resumen}
                  isPending={isPending}
                  startTransition={startTransition}
                  cardRef={cardRef}
                />
              )}
              {activeTab === "estatus" && (
                <EstatusTab
                  estatusPorNivelUa={estatusPorNivelUa}
                  activeSubTab={activeEstatusSubTab}
                  detalle={detalle}
                />
              )}
              {activeTab === "movimientos" && activeMovimientosSubTab === "tabla" && (
                <MovimientosTab
                  movPosData={movPosData}
                  detalle={detalle}
                  isPending={isPending}
                  startTransition={startTransition}
                  cardRef={cardRef}
                />
              )}
              {activeTab === "movimientos" && activeMovimientosSubTab === "cuadros" && (
                <Suspense fallback={SECONDARY_TAB_SKELETON}>
                  <CuadrosVacanciaSection
                    secondaryDataPromise={secondaryDataPromise}
                    onSwitchToTablaPrincipal={() => setActiveMovimientosSubTab("tabla")}
                  />
                </Suspense>
              )}
              {activeTab === "movimientos_personal" && (
                <MovimientosPersonalTab
                  isPending={isPending}
                  startTransition={startTransition}
                  cardRef={cardRef}
                />
              )}
              {activeTab === "bajas" && (
                <Suspense fallback={SECONDARY_TAB_SKELETON}>
                  <BajasTabSection
                    secondaryDataPromise={secondaryDataPromise}
                    isPending={isPending}
                    startTransition={startTransition}
                    cardRef={cardRef}
                  />
                </Suspense>
              )}
              {activeTab === "mapa" && activeMapaSubTab === "nacional" && (
                <MapaTab
                  distribucionGeografica={distribucionGeografica}
                />
              )}
              {activeTab === "mapa" && activeMapaSubTab === "caballito" && (
                <div className="w-full h-[calc(100vh-144px)] min-h-[500px] overflow-hidden relative">
                  <TorreCaballito3DTab />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
