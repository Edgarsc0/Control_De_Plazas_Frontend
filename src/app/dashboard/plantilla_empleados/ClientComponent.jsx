"use client";

import { useState, useTransition, useEffect, useRef, useCallback, use, Suspense } from "react";
import { Zoom } from "react-awesome-reveal";
import {
  ChevronDown,
  Users,
  Briefcase,
  Globe,
  LayoutList,
  BarChart3,
  ArrowLeftRight,
  UserCog,
  UserMinus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRefreshOnZafiroUpdate } from "@/context/ZafiroUpdatesContext";
import { useRegisterPageTabs } from "@/context/PageTabsContext";
import PlantillaDetalleTab from "./_components/tabs/plantilla-detalle/PlantillaDetalleTab";
import EstatusTab from "./_components/tabs/estatus/EstatusTab";
import MovimientosTab from "./_components/tabs/movimientos/MovimientosTab";
import MovimientosPersonalTab from "./_components/tabs/mov-posiciones/MovimientosPersonalTab";
import MapaTab from "./_components/tabs/mapa/MapaTab";
import BajasTab from "./_components/tabs/bajas/BajasTab";
import TorreCaballito3DTab from "./_components/tabs/torre-3d/TorreCaballito3DTab";
import CuadrosVacanciaTab from "./_components/tabs/cuadros-vacancia/CuadrosVacanciaTab";

const TABS = [
  { id: "detalle", label: "Plantilla Detalle", icon: LayoutList },
  { id: "estatus", label: "Estatus Nómina", icon: BarChart3 },
  { id: "movimientos", label: "Mov. Posiciones", icon: ArrowLeftRight },
  { id: "movimientos_personal", label: "Movimientos", icon: UserCog },
  { id: "bajas", label: "Empleados Bajas", icon: UserMinus },
  { id: "mapa", label: "Distribución Geográfica", icon: Globe }
];

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
  const [openSubtabId, setOpenSubtabId] = useState(null);
  const tabsBarRef = useRef(null);
  useRefreshOnZafiroUpdate();
  const isTightLayout = activeTab === "detalle" || activeTab === "movimientos" || activeTab === "movimientos_personal" || activeTab === "bajas" || activeTab === "organigrama" || activeTab === "mapa";
  // En móvil la tarjeta de header sólo aparece cuando el tab activo tiene
  // sub-controles (Agrupar/Ver); el cambio de tab principal vive en el Drawer
  // del BottomNav.

  const handleSelectTab = useCallback((id) => {
    startTransition(() => setActiveTab(id));
  }, [startTransition]);

  // Publica los tabs de esta página al BottomNav para abrirlos en un Drawer
  // (móvil). El check sigue a activeTab; al desmontar se limpia el registro.
  useRegisterPageTabs({
    tabs: TABS,
    activeTab,
    onSelect: handleSelectTab,
    title: "Plantilla de Empleados",
  });

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

    // El clamp es para la tabla sticky de DESKTOP. En móvil la lista de tarjetas
    // fluye en el flujo normal: aplicar el clamp ahí impide bajar la página
    // (sólo se verían las primeras tarjetas). Por eso se omite en < md.
    if (typeof window !== "undefined" && window.innerWidth < 768) return;

    // Altura de la navegación fija (banner + navbar). Se resuelve desde la
    // variable CSS --stack-h (fuente única) en vez del 144 mágico repetido.
    const cs = getComputedStyle(document.documentElement);
    const rootFont = parseFloat(cs.fontSize) || 16;
    const rawStack = cs.getPropertyValue("--stack-h").trim();
    const stackH = rawStack.endsWith("rem")
      ? parseFloat(rawStack) * rootFont
      : parseFloat(rawStack) || 144;

    const handleWindowScroll = () => {
      if (!cardRef.current) return;

      // Calculate absolute page-relative offset top
      let el = cardRef.current;
      let absoluteTop = 0;
      while (el) {
        absoluteTop += el.offsetTop;
        el = el.offsetParent;
      }

      const maxScroll = Math.max(0, absoluteTop - stackH);
      if (window.scrollY > maxScroll) {
        window.scrollTo(window.scrollX, maxScroll);
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tabsBarRef.current && !tabsBarRef.current.contains(e.target)) {
        setOpenSubtabId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <section className={`bg-transparent relative transition-all duration-300 overflow-hidden ${isTightLayout ? "pb-0" : "pb-20"}`}>
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      {/* Barra de tabs fija: esquina superior derecha bajo Navbar (top-20 + h-16 = top-36 = 144px) */}
      <div ref={tabsBarRef} className="fixed top-36 left-0 right-0 z-30 hidden sm:flex items-stretch bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-md">
        {TABS.map((tab) => {
          const subtabConfig = {
            estatus: {
              options: [{ id: "nivel", label: "Por Nivel" }, { id: "ua", label: "Por UA" }],
              active: activeEstatusSubTab,
              setActive: setActiveEstatusSubTab,
            },
            movimientos: {
              options: [{ id: "tabla", label: "Tabla Principal" }, { id: "cuadros", label: "Cuadros Vacancia" }],
              active: activeMovimientosSubTab,
              setActive: setActiveMovimientosSubTab,
            },
            mapa: {
              options: [{ id: "nacional", label: "Mapa Nacional" }, { id: "caballito", label: "Torre Caballito" }],
              active: activeMapaSubTab,
              setActive: setActiveMapaSubTab,
            },
          }[tab.id];
          const isActive = activeTab === tab.id;
          const isDropdownOpen = openSubtabId === tab.id;
          return (
            <div
              key={tab.id}
              className="relative flex-1"
              onMouseEnter={() => {
                if (subtabConfig) {
                  setOpenSubtabId(tab.id);
                }
              }}
              onMouseLeave={() => {
                if (subtabConfig) {
                  setOpenSubtabId(null);
                }
              }}
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
                className={`flex items-center justify-center gap-1.5 w-full whitespace-nowrap px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer border-r border-slate-200/50 ${isActive
                  ? "bg-gradient-to-b from-[#621f32] to-[#8d2c48] text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
              >
                <tab.icon className="size-3.5 flex-shrink-0" />
                {tab.label}
                {subtabConfig && (
                  <ChevronDown className={`size-3 ml-0.5 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                )}
              </button>
              <AnimatePresence>
                {isDropdownOpen && subtabConfig && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 bg-white/95 backdrop-blur-md border border-t-0 border-slate-200/50 shadow-lg z-40 min-w-full"
                  >
                    {subtabConfig.options.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          if (activeTab !== tab.id) {
                            startTransition(() => setActiveTab(tab.id));
                          }
                          subtabConfig.setActive(sub.id);
                          setOpenSubtabId(null);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap border-b border-slate-100 last:border-b-0 ${subtabConfig.active === sub.id
                          ? "bg-gradient-to-r from-[#bc955c] to-[#d0ab75] text-[#3e131f]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-[#621f32]"
                          }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className={`mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 ${activeTab === "mapa" ? "p-0" : isTightLayout ? "pt-14 pb-0" : "pt-14 pb-12"}`}>
        <div className={`w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 transition-all duration-300 ${isTightLayout ? "gap-2" : "gap-6"}`}>

          {activeTab !== "mapa" && (
            <Zoom triggerOnce>
              <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 ${isTightLayout ? "mb-4" : "mb-12"}`}>
                <div className="flex items-start sm:items-center gap-6">
                  <div className="relative p-4 sm:p-5 bg-gradient-to-tr from-[#621f32] to-[#8d2c48] rounded-[1.8rem] sm:rounded-[2.2rem] shadow-xl shadow-[#621f32]/20 flex-shrink-0 group overflow-hidden transition-all duration-300 hover:scale-105">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Users className="size-8 sm:size-10 text-white" />
                  </div>
                  <div className="max-w-screen-md">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl tracking-tight font-black text-gray-900 dark:text-white leading-tight">
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
