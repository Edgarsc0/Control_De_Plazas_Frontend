"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo, use, Suspense } from "react";
import { Zoom } from "react-awesome-reveal";
import {
  Users,
  Briefcase,
  Globe,
  LayoutList,
  BarChart3,
  ArrowLeftRight,
  UserCog,
  UserMinus,
  Database,
  Layers,
  GitCompareArrows
} from "lucide-react";
import { useRefreshOnZafiroUpdate } from "@/context/ZafiroUpdatesContext";
import { useRegisterPageTabs } from "@/context/PageTabsContext";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import PageTabBar from "@/components/ui/PageTabBar";
import PlantillaDetalleTab from "./_components/tabs/plantilla-detalle/PlantillaDetalleTab";
import EstatusTab from "./_components/tabs/estatus/EstatusTab";
import MovimientosTab from "./_components/tabs/movimientos/MovimientosTab";
import AlineacionOrganizacionalTab from "./_components/tabs/movimientos/AlineacionOrganizacionalTab";
import MovimientosPersonalTab from "./_components/tabs/mov-posiciones/MovimientosPersonalTab";
import MapaTab from "./_components/tabs/mapa/MapaTab";
import BajasTab from "./_components/tabs/bajas/BajasTab";
import TorreCaballito3DTab from "./_components/tabs/torre-3d/TorreCaballito3DTab";
import CuadrosVacanciaTab from "./_components/tabs/cuadros-vacancia/CuadrosVacanciaTab";
import CatalogosEstructuraTab from "./_components/tabs/catalogos-estructura/CatalogosEstructuraTab";
import { CATALOGOS_CONFIG, CATALOGOS_ORDER } from "./_components/tabs/catalogos-estructura/catalogosConfig";

const TABS = [
  { id: "detalle", label: "Plantilla Detalle", icon: LayoutList, permission: PERMISSIONS.VIEW_PLANTILLA_DETALLE },
  { id: "estatus", label: "Estatus Nómina", icon: BarChart3, permission: PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA },
  { id: "movimientos", label: "Mov. Posiciones", icon: ArrowLeftRight, permission: PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES },
  { id: "movimientos_personal", label: "Movimientos", icon: UserCog, permission: PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS },
  { id: "bajas", label: "Empleados Bajas", icon: UserMinus, permission: PERMISSIONS.VIEW_PLANTILLA_BAJAS },
  { id: "mapa", label: "Distribución Geográfica", icon: Globe, permission: PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA },
  { id: "catalogos_estructura", label: "Catálogos", icon: Database, permission: PERMISSIONS.VIEW_PLANTILLA_CATALOGOS }
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
  const [, , , cuadrosResult, desgloseResult, ocupadosResult] = use(secondaryDataPromise);
  const cuadrosData = cuadrosResult.status === 'fulfilled' ? (cuadrosResult.value || []) : [];
  const desgloseJerarquicoData = desgloseResult.status === 'fulfilled' ? (desgloseResult.value || []) : [];
  const ocupadosJerarquicoData = ocupadosResult.status === 'fulfilled' ? (ocupadosResult.value || []) : [];
  return (
    <CuadrosVacanciaTab
      cuadrosData={cuadrosData}
      desgloseJerarquicoData={desgloseJerarquicoData}
      ocupadosJerarquicoData={ocupadosJerarquicoData}
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
  const { isLoading: authLoading, hasPermission } = useAuth();
  // Mientras cargan los permisos se muestran todos los tabs (optimista, sin
  // parpadeo) — el backend igual exige el permiso real en cada endpoint.
  const visibleTabs = useMemo(
    () => TABS.filter((t) => authLoading || hasPermission(t.permission)),
    [authLoading, hasPermission]
  );
  const [activeTab, setActiveTab] = useState("detalle");
  useEffect(() => {
    if (!authLoading && visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [authLoading, visibleTabs, activeTab]);
  const [activeEstatusSubTab, setActiveEstatusSubTab] = useState("nivel");
  const [activeMapaSubTab, setActiveMapaSubTab] = useState("nacional");
  const [activeMovimientosSubTab, setActiveMovimientosSubTab] = useState("tabla");
  const [alineacionVisited, setAlineacionVisited] = useState(false);
  useEffect(() => {
    if (activeMovimientosSubTab === "alineacion") setAlineacionVisited(true);
  }, [activeMovimientosSubTab]);
  const [activeCatalogoSubTab, setActiveCatalogoSubTab] = useState(CATALOGOS_ORDER[0]);
  const [movCardTitle, setMovCardTitle] = useState("Posiciones Activas");
  const [isPending, startTransition] = useTransition();
  // Refs independientes por tab: los 4 tabs con tabla densa se mantienen
  // montados a la vez (ver comentario de `visitedTabs`), así que compartir un
  // único cardRef causaba que React lo reasignara al último `<div ref={cardRef}>`
  // montado en el árbol (normalmente un tab oculto con `display:none`), rompiendo
  // el clamp de scroll de abajo (offsetTop de un nodo oculto es 0 → maxScroll 0 →
  // el scroll saltaba siempre hasta arriba).
  const cardRefDetalle = useRef(null);
  const cardRefMovimientos = useRef(null);
  const cardRefCuadros = useRef(null);
  const cardRefAlineacion = useRef(null);
  const cardRefMovPersonal = useRef(null);
  const cardRefBajas = useRef(null);
  const activeCardRef =
    activeTab === "detalle" ? cardRefDetalle :
    activeTab === "movimientos" ? (activeMovimientosSubTab === "cuadros" ? cardRefCuadros : activeMovimientosSubTab === "alineacion" ? cardRefAlineacion : cardRefMovimientos) :
    activeTab === "movimientos_personal" ? cardRefMovPersonal :
    activeTab === "bajas" ? cardRefBajas :
    null;
  useRefreshOnZafiroUpdate();
  const isTightLayout = activeTab === "detalle" || (activeTab === "movimientos" && activeMovimientosSubTab !== "cuadros") || activeTab === "movimientos_personal" || activeTab === "bajas" || activeTab === "mapa" || activeTab === "catalogos_estructura";

  // Tabs con datos propios (filtros, orden, fetch en cliente) que ya se visitaron:
  // se mantienen montados y se ocultan con CSS al cambiar de tab, en vez de
  // desmontarse, para no perder su estado ni volver a pedir datos al backend.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["detalle"]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);
  // En móvil la tarjeta de header sólo aparece cuando el tab activo tiene
  // sub-controles (Agrupar/Ver); el cambio de tab principal vive en el Drawer
  // del BottomNav.

  const handleSelectTab = useCallback((id) => {
    startTransition(() => setActiveTab(id));
  }, [startTransition]);

  // Publica los tabs de esta página al BottomNav para abrirlos en un Drawer
  // (móvil). El check sigue a activeTab; al desmontar se limpia el registro.
  useRegisterPageTabs({
    tabs: visibleTabs,
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
    if (!isTableTab || !activeCardRef) return;

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
      if (!activeCardRef.current) return;

      // Calculate absolute page-relative offset top
      let el = activeCardRef.current;
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
  }, [activeTab, activeMovimientosSubTab]);

  const subtabConfigs = {
    estatus: {
      options: [{ id: "nivel", label: "Por Nivel" }, { id: "ua", label: "Por UA" }],
      active: activeEstatusSubTab,
      setActive: setActiveEstatusSubTab,
    },
    movimientos: {
      options: [
        { id: "tabla", label: "Tabla Principal" },
        { id: "cuadros", label: "Cuadros Vacancia" },
        { id: "alineacion", label: "Comprobar Alineación", icon: GitCompareArrows },
      ],
      active: activeMovimientosSubTab,
      setActive: setActiveMovimientosSubTab,
    },
    mapa: {
      options: [{ id: "nacional", label: "Mapa Nacional" }, { id: "caballito", label: "Torre Caballito" }],
      active: activeMapaSubTab,
      setActive: setActiveMapaSubTab,
    },
    catalogos_estructura: {
      options: [
        ...CATALOGOS_ORDER.map((key) => ({
          id: key,
          label: CATALOGOS_CONFIG[key].label,
          icon: CATALOGOS_CONFIG[key].icon,
        })),
        { id: "niveles_jerarquicos", label: "Niveles Jerárquicos por Plaza", icon: Layers },
      ],
      active: activeCatalogoSubTab,
      setActive: setActiveCatalogoSubTab,
    },
  };

  return (
    <section className={`bg-transparent relative transition-all duration-300 overflow-hidden ${isTightLayout ? "pb-0" : "pb-20"}`}>
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      {/* Barra de tabs fija: esquina superior derecha bajo Navbar (top-20 + h-16 = top-36 = 144px) */}
      <PageTabBar
        tabs={visibleTabs}
        activeTab={activeTab}
        onSelect={handleSelectTab}
        subtabConfigs={subtabConfigs}
      />

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
                      ) : activeTab === "catalogos_estructura" ? (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                          Catálogos Estructura Organizacional
                        </span>
                      ) : activeTab === "movimientos" && activeMovimientosSubTab === "cuadros" ? (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                          Cuadros de Vacancia
                        </span>
                      ) : activeTab === "movimientos" && activeMovimientosSubTab === "alineacion" ? (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                          Comprobar Alineación Organizacional
                        </span>
                      ) : (
                        <>
                          Plantilla de <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                            {activeTab === "bajas"
                              ? "Empleados Bajas"
                              : activeTab === "movimientos"
                                ? movCardTitle
                                : "Empleados Activos"}
                          </span>
                        </>
                      )}
                    </h2>
                    <p className="mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                      {activeTab === "catalogos_estructura"
                        ? "Administración y consulta de catálogos base que definen la estructura organizacional, puestos, acciones y tabuladores presupuestales de la ANAM."
                        : activeTab === "movimientos_personal"
                          ? "Gestión, consulta e histórico de los movimientos de personal, incluyendo altas, bajas y cambios de adscripción en la ANAM."
                          : activeTab === "movimientos" && activeMovimientosSubTab === "alineacion"
                            ? "Comparación campo a campo entre MOV_POS y EMPLEADOS_COMPLETOS_SIG para las plazas activas: detecta discrepancias entre la estructura de la plaza y los datos de la persona que la ocupa."
                            : "Detalle completo de plazas, estatus administrativo y estructura funcional en la ANAM."}
                    </p>
                  </div>
                </div>
              </div>
            </Zoom>
          )}
        </div>

        <div className="w-full mt-2">
          {/* Tabs con estado propio (filtros, orden, scroll, datos por fetch de cliente):
              se mantienen montados una vez visitados y se ocultan con CSS al salir,
              en vez de desmontarse, para no perder su estado ni re-fetchear. */}
          {visitedTabs.has("detalle") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE) && (
            <div className={activeTab === "detalle" ? "block" : "hidden"}>
              <PlantillaDetalleTab
                detalle={detalle}
                resumen={resumen}
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefDetalle}
              />
            </div>
          )}
          {visitedTabs.has("estatus") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA) && (
            <div className={activeTab === "estatus" ? "block" : "hidden"}>
              <EstatusTab
                estatusPorNivelUa={estatusPorNivelUa}
                activeSubTab={activeEstatusSubTab}
                detalle={detalle}
              />
            </div>
          )}
          {visitedTabs.has("movimientos") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div className={activeTab === "movimientos" && activeMovimientosSubTab === "tabla" ? "block" : "hidden"}>
              <MovimientosTab
                movPosData={movPosData}
                detalle={detalle}
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefMovimientos}
                onCardTitleChange={setMovCardTitle}
              />
            </div>
          )}
          {activeTab === "movimientos" && activeMovimientosSubTab === "cuadros" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div ref={cardRefCuadros}>
              <Suspense fallback={SECONDARY_TAB_SKELETON}>
                <CuadrosVacanciaSection
                  secondaryDataPromise={secondaryDataPromise}
                  onSwitchToTablaPrincipal={() => setActiveMovimientosSubTab("tabla")}
                />
              </Suspense>
            </div>
          )}
          {alineacionVisited && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div className={activeTab === "movimientos" && activeMovimientosSubTab === "alineacion" ? "block" : "hidden"}>
              <AlineacionOrganizacionalTab
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefAlineacion}
              />
            </div>
          )}
          {visitedTabs.has("movimientos_personal") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS) && (
            <div className={activeTab === "movimientos_personal" ? "block" : "hidden"}>
              <MovimientosPersonalTab
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefMovPersonal}
              />
            </div>
          )}
          {visitedTabs.has("bajas") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_BAJAS) && (
            <div className={activeTab === "bajas" ? "block" : "hidden"}>
              <Suspense fallback={SECONDARY_TAB_SKELETON}>
                <BajasTabSection
                  secondaryDataPromise={secondaryDataPromise}
                  isPending={isPending}
                  startTransition={startTransition}
                  cardRef={cardRefBajas}
                />
              </Suspense>
            </div>
          )}
          {visitedTabs.has("catalogos_estructura") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_CATALOGOS) && (
            <div className={activeTab === "catalogos_estructura" ? "block" : "hidden"}>
              <CatalogosEstructuraTab activeCatalog={activeCatalogoSubTab} />
            </div>
          )}
          {activeTab === "mapa" && activeMapaSubTab === "nacional" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA) && (
            <MapaTab
              distribucionGeografica={distribucionGeografica}
            />
          )}
          {activeTab === "mapa" && activeMapaSubTab === "caballito" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA) && (
            <div className="w-full h-[calc(100vh-144px)] min-h-[500px] overflow-hidden relative">
              <TorreCaballito3DTab />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
