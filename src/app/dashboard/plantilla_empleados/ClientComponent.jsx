"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo, use, Suspense } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Zoom } from "@/components/shared/Reveal";

gsap.registerPlugin(useGSAP);
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
  GitCompareArrows,
  FileSpreadsheet,
  UserCheck,
  Building2,
  TrendingUp,
  Table2
} from "lucide-react";
import { useRefreshOnZafiroUpdate, useZafiroUpdates } from "@/context/ZafiroUpdatesContext";
import { useRegisterPageTabs } from "@/context/PageTabsContext";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/config/permissions";
import PageTabBar from "@/components/ui/PageTabBar";
import TourGroup from "@/components/shared/tour/TourGroup";
import PlantillaDetalleTab from "./_components/tabs/plantilla-detalle/PlantillaDetalleTab";
import EstatusTab from "./_components/tabs/estatus/EstatusTab";
import MovimientosTab from "./_components/tabs/movimientos/MovimientosTab";
import AlineacionOrganizacionalTab from "./_components/tabs/movimientos/AlineacionOrganizacionalTab";
import AduanasOcupacionVacanciaTab from "./_components/tabs/movimientos/AduanasOcupacionVacanciaTab";
import AnuenciaTab from "./_components/tabs/anuencia/AnuenciaTab";
import MovimientosPersonalTab from "./_components/tabs/mov-posiciones/MovimientosPersonalTab";
import MapaTab from "./_components/tabs/mapa/MapaTab";
import BajasTab from "./_components/tabs/bajas/BajasTab";
import TorreCaballito3DTab from "./_components/tabs/torre-3d/TorreCaballito3DTab";
import CuadrosVacanciaTab, { CuadrosVacanciaSkeleton } from "./_components/tabs/cuadros-vacancia/CuadrosVacanciaTab";
import CatalogosEstructuraTab from "./_components/tabs/catalogos-estructura/CatalogosEstructuraTab";
import { CATALOGOS_CONFIG, CATALOGOS_ORDER } from "./_components/tabs/catalogos-estructura/catalogosConfig";
import { useCeldaUpdatesRealtime } from "./_hooks/useCeldaUpdatesRealtime";
import { useAnuenciaAnexoUpdatesRealtime } from "./_hooks/useAnuenciaAnexoUpdatesRealtime";
import { VacantesService } from "@/services/vacantes.service";
import { getDataset, setDataset, patchDataset } from "@/lib/plantillaBrowserCache";

const TABS = [
  { id: "detalle", label: "Plantilla Detalle", icon: LayoutList, permission: PERMISSIONS.VIEW_PLANTILLA_DETALLE },
  { id: "estatus", label: "Estatus Nómina", icon: BarChart3, permission: PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA },
  { id: "movimientos", label: "Mov. Posiciones", icon: ArrowLeftRight, permission: PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES },
  { id: "movimientos_personal", label: "Movimientos", icon: UserCog, permission: PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS },
  { id: "bajas", label: "Empleados Bajas", icon: UserMinus, permission: PERMISSIONS.VIEW_PLANTILLA_BAJAS },
  { id: "mapa", label: "Distribución Geográfica", icon: Globe, permission: PERMISSIONS.VIEW_PLANTILLA_GEOGRAFIA },
  { id: "catalogos_estructura", label: "Catálogos", icon: Database, permission: PERMISSIONS.VIEW_PLANTILLA_CATALOGOS }
];

// "Bajas" ya no depende de `secondaryDataPromise`: hace su propio fetch
// cache-first (IndexedDB) dentro de `BajasTab`, igual que
// `MovimientosPersonalTab`. Ver PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md.

// "Movimientos" (Mov. Posiciones): igual que Bajas, `movPosData` ya no viaja
// por `secondaryDataPromise` — `MovimientosTab` hace su propio fetch
// cache-first (IndexedDB), disparado por evento ZAFIRO en vez de por
// `router.refresh()` de toda la página.
function MovimientosTabSection({ detalle, isPending, startTransition, cardRef, onCardTitleChange }) {
  return (
    <MovimientosTab
      detalle={detalle}
      isPending={isPending}
      startTransition={startTransition}
      cardRef={cardRef}
      onCardTitleChange={onCardTitleChange}
    />
  );
}

function CuadrosVacanciaSection({ secondaryDataPromise, onSwitchToTablaPrincipal, activeSectionTab, setActiveSectionTab }) {
  const [cuadrosResult, desgloseResult, ocupadosResult, conteoPlazasSerieResult] = use(secondaryDataPromise);
  const cuadrosData = cuadrosResult.status === 'fulfilled' ? (cuadrosResult.value || []) : [];
  const desgloseJerarquicoData = desgloseResult.status === 'fulfilled' ? (desgloseResult.value || []) : [];
  const ocupadosJerarquicoData = ocupadosResult.status === 'fulfilled' ? (ocupadosResult.value || []) : [];
  const conteoPlazasSerieData = conteoPlazasSerieResult.status === 'fulfilled' ? (conteoPlazasSerieResult.value || []) : [];
  return (
    <CuadrosVacanciaTab
      cuadrosData={cuadrosData}
      desgloseJerarquicoData={desgloseJerarquicoData}
      ocupadosJerarquicoData={ocupadosJerarquicoData}
      conteoPlazasSerieData={conteoPlazasSerieData}
      onSwitchToTablaPrincipal={onSwitchToTablaPrincipal}
      activeSectionTab={activeSectionTab}
      setActiveSectionTab={setActiveSectionTab}
    />
  );
}

// Dataset "plantilla_detalle" (empleados_completos_activos_detalle) — ya no
// llega por props desde el Server Component (ver
// PLAN_CACHE_NAVEGADOR_PLANTILLA_EMPLEADOS_2026-09-16.md): se cachea en
// IndexedDB del navegador sin TTL. Es el más volátil de los 3 datasets del
// plan: además del ciclo ETL de ~30 min, cualquier usuario puede editar una
// celda en cualquier momento y esa edición se difunde en vivo por SSE a
// todos los navegadores conectados (ver useCeldaUpdatesRealtime más abajo).
const DETALLE_CACHE_KEY = "plantilla_detalle";

export default function PlantillaEmpleadosDetalle({
  resumen,
  estatusPorNivelUa = { por_nivel: {}, por_ua: {} },
  distribucionGeografica = [],
  secondaryDataPromise
}) {
  const { isLoading: authLoading, hasPermission, email } = useAuth();
  // Ya no hay dato inicial síncrono por prop: arranca vacío y se llena en el
  // efecto cache-first de abajo (IndexedDB, casi instantáneo si ya había
  // cache; red solo en frío). Estado local (no una prop cruda) porque
  // también hay que reflejar ediciones de celda (CeldaOverride, tab Detalle)
  // al instante y sin refetch, compartido con los demás tabs que leen
  // `detalle` (Estatus, Mov. Posiciones).
  const [detalleData, setDetalleData] = useState([]);
  // Skeleton dedicado SOLO para el refresh que dispara
  // NivelesJerarquicosPlazaSubtab tras bulk-assign (no para cualquier
  // actualización, ej. "aplicar prioridad" no lo activa): se prende a mano
  // justo antes del bulk-assign (ver startRefrescoDetalleTrasNivelJerarquico)
  // y se apaga cuando el refetch de abajo efectivamente trae datos. El
  // timeout de seguridad evita un skeleton pegado si el refresh nunca trae
  // datos distintos.
  const [isRefrescandoDetalleTrasNivel, setIsRefrescandoDetalleTrasNivel] = useState(false);
  // Carga inicial (lectura de IndexedDB y, en frío, el fetch de red que la
  // sigue): sin esto la tabla queda en blanco ("Sin coincidencias") mientras
  // `getDataset` resuelve, porque `detalleData` arranca en `[]` y ninguna
  // otra bandera de loading está prendida todavía en el primer montaje.
  const [isCargandoDetalleInicial, setIsCargandoDetalleInicial] = useState(true);
  const refrescoNivelJerarquicoTimeoutRef = useRef(null);
  const startRefrescoDetalleTrasNivelJerarquico = useCallback(() => {
    setIsRefrescandoDetalleTrasNivel(true);
    clearTimeout(refrescoNivelJerarquicoTimeoutRef.current);
    // Medido con playwright contra el servidor: el fetch podía tardar hasta
    // ~22s en un run real — este timeout es solo un techo de seguridad, no
    // el tiempo esperado normal.
    refrescoNivelJerarquicoTimeoutRef.current = setTimeout(() => {
      setIsRefrescandoDetalleTrasNivel(false);
    }, 30000);
  }, []);

  // Refetch de red forzado (bypass de IndexedDB) + reemplazo total del
  // cache. Se usa cuando ya sabemos con certeza que el dato cacheado quedó
  // obsoleto: evento real de ZAFIRO (señal a del plan) o aviso manual desde
  // otro tab (`notifyLocalUpdate`, ver ZafiroUpdatesContext — cubre acciones
  // como "aplicar prioridad"/bulk-assign de nivel jerárquico, que cambian
  // EMPLEADOS_COMPLETOS_SIG fuera del ciclo del ETL).
  const refetchDetalle = useCallback(async () => {
    try {
      const response = await VacantesService.getEmpleadosCompletosActivosDetalle();
      if (response.ok) {
        const fresh = (await response.json()) || [];
        setDetalleData(fresh);
        await setDataset(DETALLE_CACHE_KEY, fresh);
      }
    } catch (err) {
      console.error("Error al refrescar plantilla_detalle:", err);
    } finally {
      setIsRefrescandoDetalleTrasNivel(false);
      setIsCargandoDetalleInicial(false);
      clearTimeout(refrescoNivelJerarquicoTimeoutRef.current);
    }
  }, []);

  // Cache-first (IndexedDB, sin TTL): solo pega a red si este navegador
  // nunca cacheó `plantilla_detalle` todavía.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getDataset(DETALLE_CACHE_KEY);
      if (cached && !cancelled) {
        setDetalleData(cached);
        setIsCargandoDetalleInicial(false);
        return;
      }
      if (!cancelled) await refetchDetalle();
    })();
    return () => { cancelled = true; };
  }, [refetchDetalle]);

  // Señal (a) del plan: evento real de ZAFIRO (o `notifyLocalUpdate` manual)
  // → refetch completo, siempre por red (nunca sirve la copia de IndexedDB,
  // que en este punto ya sabemos desactualizada).
  const { subscribe } = useZafiroUpdates();
  useEffect(() => subscribe(refetchDetalle), [subscribe, refetchDetalle]);

  const updateDetalleCell = useCallback((posicion, columna, valorNuevo) => {
    setDetalleData((prev) => prev.map((row) =>
      row.posicion === posicion ? { ...row, [columna]: valorNuevo } : row
    ));
    // Señales (b)/(c) del plan: edición propia o `cell_update` ajeno (ver
    // handleRemoteCellUpdate, que reusa este mismo reducer) — parche
    // quirúrgico sin refetch, para que una recarga posterior ya vea el
    // cambio aunque no haya llegado el próximo evento de ZAFIRO.
    patchDataset(DETALLE_CACHE_KEY, (rows) => rows.map((row) =>
      row.posicion === posicion ? { ...row, [columna]: valorNuevo } : row
    ));
  }, []);
  // Avisa al usuario (badge en "Historial de Cambios") cuando otra persona edita
  // una celda mientras tiene la tabla abierta — se resetea al abrir ese modal
  // (ver PlantillaDetalleTab). `usuario` viaje en el mensaje SSE (username =
  // email, ver authentication.views); se excluye si el cambio es del propio
  // usuario (eco de su propia edición, username == email).
  const [remoteUpdatesCount, setRemoteUpdatesCount] = useState(0);
  const handleRemoteCellUpdate = useCallback((posicion, columna, valorNuevo, usuario) => {
    updateDetalleCell(posicion, columna, valorNuevo);
    if (usuario && usuario !== email) {
      setRemoteUpdatesCount((c) => c + 1);
    }
  }, [updateDetalleCell, email]);
  // Al reconectar el SSE (el backend corta el stream cada pocos minutos, ver
  // SSE_MAX_LIFETIME_SECONDS) puede haberse perdido algún cell_update de otro
  // usuario durante el hueco de reconexión — este canal no tiene fallback por
  // BD como el de ZAFIRO, así que se resincroniza pidiendo la tabla completa
  // (mismo refetch forzado que la señal (a), también reemplaza el cache).
  useCeldaUpdatesRealtime(handleRemoteCellUpdate, refetchDetalle);
  const clearRemoteUpdatesCount = useCallback(() => setRemoteUpdatesCount(0), []);
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
  const isCuadrosVacanciaSubtab = activeTab === "movimientos" && activeMovimientosSubTab === "cuadros";
  // Sub-navegación interna del subtab "Cuadros de Vacancia" (Tendencia
  // Histórica / Comparativo por Barras / Cuadros y Detalle de Vacantes) —
  // vive aquí (no dentro de CuadrosVacanciaTab) porque la barra se renderiza
  // a nivel de página, pegada debajo de PageTabBar, no dentro del propio tab.
  const [activeSectionTab, setActiveSectionTab] = useState("tendencia");
  // Borde inferior real (px, relativo al viewport) del PageTabBar fijo,
  // medido en vivo con getBoundingClientRect().bottom — no depende de dónde
  // arranca el flujo normal de la página (a diferencia de un padding-top
  // Tailwind adivinado): como PageTabBar es `position:fixed`, ese valor no
  // cambia con el scroll, así que sirve tal cual como `top` sticky de la
  // barra de "Cuadros de Vacancia" (ver más abajo) sin necesitar además un
  // margin-top calculado a mano. En móvil PageTabBar es `hidden` y mide
  // (0,0,0,0), así que este valor ya sale en 0 ahí sin lógica de breakpoint
  // aparte.
  const pageTabBarRef = useRef(null);
  // DevTools confirmó que `position: sticky` DENTRO del wrapper `flex
  // flex-col` de más abajo NO respeta margin-top como flujo de bloque normal
  // (el margin-top calculado era correcto — 39.5px — pero la barra igual
  // renderizaba mucho más abajo, pegada al contenido siguiente). Por eso la
  // barra de "Cuadros de Vacancia" usa `position: fixed` (como PageTabBar:
  // cero ambigüedad, no depende del contexto flex del padre) en vez de
  // sticky. Para que el contenido de abajo (título, gráficas) no quede
  // tapado por PageTabBar + esta barra fija, el wrapper recibe un
  // padding-top = (borde inferior de PageTabBar + alto de esta barra) MENOS
  // el top real del propio wrapper (S) — las tres cosas medidas con
  // getBoundingClientRect. pageTabBarBottom/cuadrosNavHeight son coordenadas/
  // medidas de VIEWPORT; usarlas directo como padding-top (que es relativo a
  // S) sin restar S fue justo lo que dejó un hueco enorme la vez anterior.
  const cuadrosSectionRef = useRef(null);
  const cuadrosNavRef = useRef(null);
  const [pageTabBarBottom, setPageTabBarBottom] = useState(0);
  const [cuadrosContentPaddingTop, setCuadrosContentPaddingTop] = useState(0);
  useEffect(() => {
    const barEl = pageTabBarRef.current;
    const navEl = cuadrosNavRef.current;
    const sectionEl = cuadrosSectionRef.current;
    if (!barEl) return;
    const measure = () => {
      const barBottom = barEl.getBoundingClientRect().bottom;
      setPageTabBarBottom(barBottom);
      const navHeight = navEl ? navEl.getBoundingClientRect().height : 0;
      if (sectionEl) {
        setCuadrosContentPaddingTop(Math.max(0, barBottom + navHeight - sectionEl.getBoundingClientRect().top));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(barEl);
    if (navEl) observer.observe(navEl);
    if (sectionEl) observer.observe(sectionEl);
    return () => observer.disconnect();
  }, [isCuadrosVacanciaSubtab]);
  const [activeMovPersonalSubTab, setActiveMovPersonalSubTab] = useState("movimientos");
  const [alineacionVisited, setAlineacionVisited] = useState(false);
  useEffect(() => {
    if (activeMovimientosSubTab === "alineacion") setAlineacionVisited(true);
  }, [activeMovimientosSubTab]);
  const [aduanasVisited, setAduanasVisited] = useState(false);
  useEffect(() => {
    if (activeMovimientosSubTab === "aduanas") setAduanasVisited(true);
  }, [activeMovimientosSubTab]);
  // La captura del Anexo 2 se mantiene montada una vez visitada: cambiar de
  // sub-tab no debe perder lo que el usuario lleva escrito.
  const [anuenciaVisited, setAnuenciaVisited] = useState(false);
  useEffect(() => {
    if (activeMovimientosSubTab === "anuencia") setAnuenciaVisited(true);
  }, [activeMovimientosSubTab]);
  // Tour de descubrimiento del proceso de Anuencia (una sola vez por
  // navegador, ver ProductTour/TourGroup más abajo): mientras está en `true`,
  // `PageTabBar` mantiene forzado el dropdown de subtabs de "Mov. Posiciones"
  // abierto para poder señalar la opción "Anuencia" antes de que el usuario
  // la elija (ver prop `forceOpenTabId`).
  const [anuenciaTourDropdownForced, setAnuenciaTourDropdownForced] = useState(false);
  // Mismo mecanismo para el tour de descubrimiento de "Rotación de
  // personal" (switch Titulares de Aduanas/Directores Generales dentro de
  // RotacionAduanasSubTab), pero forzando el dropdown de subtabs de
  // "Movimientos" (movimientos_personal) en vez del de "Mov. Posiciones".
  const [rotacionTourDropdownForced, setRotacionTourDropdownForced] = useState(false);
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
  const cardRefAduanas = useRef(null);
  const cardRefAnuencia = useRef(null);
  const cardRefMovPersonal = useRef(null);
  const cardRefBajas = useRef(null);
  const activeCardRef =
    activeTab === "detalle" ? cardRefDetalle :
    activeTab === "movimientos" ? (activeMovimientosSubTab === "cuadros" ? cardRefCuadros : activeMovimientosSubTab === "alineacion" ? cardRefAlineacion : activeMovimientosSubTab === "aduanas" ? cardRefAduanas : activeMovimientosSubTab === "anuencia" ? cardRefAnuencia : cardRefMovimientos) :
    activeTab === "movimientos_personal" ? cardRefMovPersonal :
    activeTab === "bajas" ? cardRefBajas :
    null;
  useRefreshOnZafiroUpdate();
  // "cuadros" y "anuencia" son tarjetas de contenido (no tablas densas a todo
  // lo ancho), así que conservan el layout holgado.
  const isTightLayout = activeTab === "detalle" || (activeTab === "movimientos" && activeMovimientosSubTab !== "cuadros" && activeMovimientosSubTab !== "anuencia") || activeTab === "movimientos_personal" || activeTab === "bajas" || activeTab === "mapa" || activeTab === "catalogos_estructura";
  // Subtab "rotacion": sin título ni tarjetas de stats (ver más abajo), la
  // tabla debe pegarse directo bajo el PageTabBar — mismo criterio de
  // clearance que usa MapaTab (md:pt-9), no el pt-14 de los demás subtabs
  // (ese extra colchón era para separar el título, que aquí no existe).
  const isRotacionSubtab = activeTab === "movimientos_personal" && activeMovPersonalSubTab === "rotacion";

  // Tabs con datos propios (filtros, orden, fetch en cliente) que ya se visitaron:
  // se mantienen montados y se ocultan con CSS al cambiar de tab, en vez de
  // desmontarse, para no perder su estado ni volver a pedir datos al backend.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["detalle"]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // Red de seguridad para Mov. Posiciones y Bajas: su propio `subscribe()`
  // (dentro de MovimientosTab.jsx/BajasTab.jsx) solo escucha mientras el tab
  // está montado — si el usuario nunca lo visitó en la sesión, un evento real
  // de ZAFIRO (o de Anexo2) no le llega a nadie y el cache de IndexedDB (sin
  // TTL) se queda con el dato viejo indefinidamente hasta que por fin se
  // visite (bug confirmado en pruebas 2026-09-17: 0 requests de red, cache
  // sin tocar, UI mostrando el valor de antes del cambio). Igual que
  // `detalleData` arriba, estos listeners viven aquí (siempre montados)
  // como respaldo — pero solo hacen trabajo si el tab en cuestión NUNCA se
  // montó todavía; si ya está montado, su propio subscribe ya se encarga y
  // esto se salta para no duplicar el fetch.
  const visitedTabsRef = useRef(visitedTabs);
  visitedTabsRef.current = visitedTabs;

  const backgroundRefetchMovPos = useCallback(async () => {
    try {
      const res = await VacantesService.getMovPosDetalle({ is_latest: "true" });
      if (res.ok) {
        const data = await res.json();
        await setDataset("mov_pos_detalle", data);
      }
    } catch (err) {
      console.error("Error al refrescar cache de mov_pos_detalle en background:", err);
    }
  }, []);

  useEffect(() => subscribe(() => {
    if (visitedTabsRef.current.has("movimientos")) return;
    backgroundRefetchMovPos();
  }), [subscribe, backgroundRefetchMovPos]);

  // Cambios en Anexo 2 también afectan mov_pos_detalle (columna "En
  // Anuencia") — señal adicional no contemplada en el plan original de
  // cache, pero que MovimientosTab.jsx ya trata como crítica (ver
  // useAnuenciaAnexoUpdatesRealtime allá). Mismo hueco si el tab nunca se
  // visitó, mismo respaldo aquí.
  useAnuenciaAnexoUpdatesRealtime(() => {
    if (visitedTabsRef.current.has("movimientos")) return;
    backgroundRefetchMovPos();
  });

  useEffect(() => subscribe(async () => {
    if (visitedTabsRef.current.has("bajas")) return;
    try {
      const [bajasRes, motivosRes, historicoRes] = await Promise.all([
        VacantesService.getBajasSig(),
        VacantesService.getBajasMotivos(),
        VacantesService.getBajasHistorico(),
      ]);
      const [bajas, motivos, historico] = await Promise.all([
        bajasRes.ok ? bajasRes.json() : null,
        motivosRes.ok ? motivosRes.json() : null,
        historicoRes.ok ? historicoRes.json() : null,
      ]);
      await Promise.all([
        bajas != null ? setDataset("bajas_sig", bajas) : null,
        motivos != null ? setDataset("bajas_motivos", motivos) : null,
        historico != null ? setDataset("bajas_historico", historico) : null,
      ]);
    } catch (err) {
      console.error("Error al refrescar cache de bajas en background:", err);
    }
  }), [subscribe]);

  // Fade+slide corto al cambiar de tab/subtab: los paneles ya están montados y
  // solo se togglean con block/hidden (ver comentario más abajo), así que se
  // anima el wrapper que los contiene en vez de cada panel por separado.
  const tabContentRef = useRef(null);
  useGSAP(
    () => {
      if (!tabContentRef.current) return;
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, y: 10 },
        // clearProps quita el transform inline al terminar: si se queda (aunque
        // sea translate(0,0)), el wrapper pasa a ser containing block de sus
        // descendientes position:fixed (p.ej. el botón flotante de "Movimientos
        // realizados hoy" en PlantillaDetalleTab), que dejan de posicionarse
        // contra el viewport y caen mucho más abajo de lo esperado.
        { opacity: 1, y: 0, duration: 0.18, ease: "power2.out", clearProps: "transform" }
      );
    },
    {
      scope: tabContentRef,
      dependencies: [activeTab, activeMovimientosSubTab, activeMapaSubTab, activeCatalogoSubTab, activeMovPersonalSubTab],
      revertOnUpdate: true,
    }
  );
  // En móvil la tarjeta de header sólo aparece cuando el tab activo tiene
  // sub-controles (Agrupar/Ver); el cambio de tab principal vive en el Drawer
  // del BottomNav.

  const handleSelectTab = useCallback((id) => {
    startTransition(() => setActiveTab(id));
  }, [startTransition]);

  const subtabConfigs = useMemo(() => ({
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
        { id: "aduanas", label: "Aduanas Ocupación vs Vacantes", icon: Globe },
        { id: "anuencia", label: "Anuencia", icon: FileSpreadsheet, tourId: "movpos-anuencia-subtab-option" },
      ],
      active: activeMovimientosSubTab,
      setActive: setActiveMovimientosSubTab,
    },
    mapa: {
      options: [{ id: "nacional", label: "Mapa Nacional" }, { id: "caballito", label: "Torre Caballito" }],
      active: activeMapaSubTab,
      setActive: setActiveMapaSubTab,
    },
    movimientos_personal: {
      options: [
        { id: "movimientos", label: "Movimientos de Personal", icon: Briefcase },
        { id: "bitacora", label: "Bitácora de Movimientos", icon: UserCheck },
        { id: "rotacion", label: "Rotación de personal", icon: Building2, tourId: "movpersonal-rotacion-subtab-option" },
      ],
      active: activeMovPersonalSubTab,
      setActive: setActiveMovPersonalSubTab,
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
  }), [
    activeEstatusSubTab,
    activeMovimientosSubTab,
    activeMapaSubTab,
    activeCatalogoSubTab,
    activeMovPersonalSubTab,
  ]);

  // Pasos del tour de Anuencia (ver `anuenciaTourDropdownForced` arriba). El
  // primer paso vive en el dropdown de subtabs (fuera de cualquier tab de
  // contenido, por eso el tour vive aquí y no dentro de MovimientosTab/
  // AnuenciaTab); los siguientes señalan encabezados/botones DENTRO de
  // AnuenciaTab (ver `data-tour-anexo2-col`/`data-tour` en ese archivo), que
  // sólo existen en el DOM una vez montado — por eso el paso 2 selecciona el
  // subtab en su `onEnter`, justo antes de necesitarlos.
  const anuenciaTourSteps = useMemo(() => [
    {
      id: "subtab",
      selector: '[data-tour="movpos-anuencia-subtab-option"]',
      title: "Proceso de Anuencia",
      body: 'Da clic en "Anuencia" para capturar las plazas a solicitar, su fecha de alta y generar el Anexo 3.',
      onEnter: () => setAnuenciaTourDropdownForced(true),
    },
    {
      id: "codigo",
      selector: '[data-tour-anexo2-col="codigo"]',
      title: "Código de la plaza",
      body: "Escribe aquí el Código Federal de Puesto (o el identificador de plaza eventual / folio de honorarios); el resto de la fila se autocompleta. Prueba con una plaza de ejemplo.",
      onEnter: () => {
        setAnuenciaTourDropdownForced(false);
        setActiveMovimientosSubTab("anuencia");
      },
    },
    {
      id: "fecha-alta",
      selector: '[data-tour-anexo2-col="fecha_alta_solicitada"]',
      title: "Fecha de alta solicitada",
      body: "Aquí capturas la fecha de alta solicitada para esa plaza.",
    },
    {
      id: "oficio",
      selector: '[data-tour-anexo2-col="oficio_autorizacion"]',
      title: "Oficio de autorización presupuestaria",
      body: "Y aquí el oficio de autorización presupuestaria correspondiente.",
    },
    {
      id: "anexo2",
      selector: '[data-tour="anuencia-descargar-anexo2"]',
      title: "Descarga el Anexo 2",
      body: "Cuando termines de capturar todas las plazas, descarga el Anexo 2 con este botón.",
    },
    {
      id: "anexo3",
      selector: '[data-tour="anuencia-generar-anexo3"]',
      title: "Genera el Anexo 3",
      body: "Y da clic aquí para generar el Anexo 3 (FUMP) a partir de las plazas capturadas. ¡Listo!",
    },
  ], []);
  const anuenciaTourEnabled = activeTab === "movimientos" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES);
  // Si el usuario sale de "Mov. Posiciones" a la mitad del tour, ProductTour
  // oculta y reinicia su paso solo (ver `enabled` ahí abajo), pero no avisa
  // — sin esto, el dropdown se quedaría forzado abierto para siempre.
  useEffect(() => {
    if (!anuenciaTourEnabled) setAnuenciaTourDropdownForced(false);
  }, [anuenciaTourEnabled]);

  // Pasos del tour de "Rotación de personal" (switch Titulares de Aduanas/
  // Directores Generales, ver RotacionAduanasSubTab.jsx). Mismo patrón que
  // el de Anuencia: el paso 1 vive en el dropdown de subtabs de
  // "Movimientos" (fuera de MovimientosPersonalTab, por eso el tour vive
  // aquí); el paso 2 hace clic en el subtab (montando el componente, que
  // trae su propio spinner de carga — ProductTour reintenta ubicar el
  // selector hasta 4s, así que espera a que termine de cargar) y señala el
  // botón "Titulares de Aduanas"; el paso 3 señala "Directores Generales".
  const rotacionTourSteps = useMemo(() => [
    {
      id: "subtab",
      selector: '[data-tour="movpersonal-rotacion-subtab-option"]',
      title: "Rotación de personal",
      body: 'Da clic en "Rotación de personal" para ver la línea de tiempo de titulares de aduanas y direcciones generales.',
      onEnter: () => setRotacionTourDropdownForced(true),
    },
    {
      id: "aduanas",
      selector: '[data-tour="rotacion-fuente-aduanas"]',
      title: "Rotación de Titulares de Aduanas",
      body: "Aquí ves la línea de tiempo de quién ha sido titular de cada aduana: cuándo entró, cuándo salió y hacia dónde se fue.",
      onEnter: () => {
        setRotacionTourDropdownForced(false);
        setActiveMovPersonalSubTab("rotacion");
      },
    },
    {
      id: "dg",
      selector: '[data-tour="rotacion-fuente-dg"]',
      title: "Nuevo: Directores Generales",
      body: "Da clic aquí para ver la misma rotación, pero de las 12 direcciones generales — mismo formato, mismos filtros y el mismo Excel exportable.",
    },
  ], []);
  const rotacionTourEnabled = activeTab === "movimientos_personal" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS);
  useEffect(() => {
    if (!rotacionTourEnabled) setRotacionTourDropdownForced(false);
  }, [rotacionTourEnabled]);

  const tabTours = useMemo(() => [
    { tourId: "movpos-anuencia-v1", steps: anuenciaTourSteps, enabled: anuenciaTourEnabled },
    { tourId: "movpersonal-rotacion-v1", steps: rotacionTourSteps, enabled: rotacionTourEnabled },
  ], [anuenciaTourSteps, anuenciaTourEnabled, rotacionTourSteps, rotacionTourEnabled]);

  // Publica los tabs de esta página al BottomNav para abrirlos en un Drawer
  // (móvil). El check sigue a activeTab; al desmontar se limpia el registro.
  // subtabConfigs también se publica: el Drawer necesita listar los subtabs
  // del tab activo (antes sólo llegaban a la PageTabBar de desktop).
  useRegisterPageTabs({
    tabs: visibleTabs,
    activeTab,
    onSelect: handleSelectTab,
    title: "Plantilla de Empleados",
    subtabConfigs,
  });

  // Prevent page scroll on tabs con layout de canvas a sangre (altura exacta
  // h-stack-dvh, sin scroll de documento): sólo el mapa usa esa arquitectura.
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
    // "aduanas" queda fuera del clamp: sus tablas fluyen con altura natural
    // (no una sola card de altura fija), así que clampear el scroll de la
    // ventana a su offsetTop impedía bajar a ver contenido más abajo.
    const isAduanas = activeTab === "movimientos" && activeMovimientosSubTab === "aduanas";
    const isTableTab = isTightLayout && activeTab !== "mapa" && !isAduanas;
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

  return (
    <section className={`bg-transparent relative transition-all duration-300 overflow-hidden ${isTightLayout ? "pb-0" : "pb-20"}`}>
      <div className="absolute -top-40 -right-40 size-[32rem] bg-gradient-to-br from-[#621f32]/8 to-transparent rounded-full blur-[100px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 -left-40 size-[40rem] bg-gradient-to-tr from-[#bc955c]/8 to-transparent rounded-full blur-[120px] -z-10" />

      {/* Barra de tabs fija: esquina superior derecha bajo Navbar (top-20 + h-16 = top-36 = 144px) */}
      <PageTabBar
        ref={pageTabBarRef}
        tabs={visibleTabs}
        activeTab={activeTab}
        onSelect={handleSelectTab}
        subtabConfigs={subtabConfigs}
        forceOpenTabId={anuenciaTourDropdownForced ? "movimientos" : rotacionTourDropdownForced ? "movimientos_personal" : null}
      />
      <TourGroup tours={tabTours} />

      {/* pt-14 sólo despeja el PageTabBar fijo (md+); en móvil esa barra está
          oculta (hidden md:flex), así que ahí no hace falta ese hueco. */}
      {/* "mapa" se excluye: reserva su propio espacio para el PageTabBar con
          md:pt-9 dentro de su propio contenedor (altura exacta h-stack-dvh);
          dejar el pt-14 de aquí ENCIMA duplicaba el hueco bajo el tab bar. */}
      {/* "cuadros" (subtab de Cuadros de Vacancia): padding-top calculado
          = borde inferior real de PageTabBar + alto real de la barra de
          sub-navegación fija (ambos medidos, nunca adivinados), para que el
          título/gráficas de abajo empiecen justo debajo de las dos barras
          fijas y no queden tapados por ellas. */}
      <div ref={cuadrosSectionRef} className={`mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 ${activeTab === "mapa" ? "p-0" : isRotacionSubtab ? "pt-3 md:pt-9 pb-0" : isTightLayout ? "pt-3 md:pt-14 pb-0" : "pt-3 md:pt-14 pb-12"}`} style={isCuadrosVacanciaSubtab ? { paddingTop: cuadrosContentPaddingTop, paddingBottom: 48 } : undefined}>
        {/* Sub-navegación de "Cuadros de Vacancia": `position: fixed` (no
            `sticky` — un `sticky` dentro del `flex flex-col` de este wrapper
            NO respeta margin-top como flujo de bloque normal, confirmado en
            DevTools: el margin-top calculado era correcto pero la barra
            renderizaba muy abajo igual) — ver activeSectionTab arriba. Fija
            en `top: pageTabBarBottom`, a todo lo ancho del viewport
            (inset-x-0), igual que PageTabBar. z-20 para quedar por debajo de
            PageTabBar (z-30) si algún dropdown de éste se abre encima. */}
        {isCuadrosVacanciaSubtab && (
          <div
            ref={cuadrosNavRef}
            className="fixed inset-x-0 z-20 flex border-b border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl overflow-x-auto custom-scrollbar"
            style={{ top: pageTabBarBottom }}
          >
            {[
              { id: 'tendencia', label: 'Tendencia Histórica', icon: TrendingUp },
              { id: 'barras', label: 'Comparativo por Barras', icon: BarChart3 },
              { id: 'cuadros', label: 'Cuadros y Detalle de Vacantes', icon: Table2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSectionTab(id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 border-b-2 font-black uppercase tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap transition-all cursor-pointer ${activeSectionTab === id
                  ? 'border-[#bc955c] text-[#10243e] dark:text-[#bc955c] bg-gradient-to-b from-[#bc955c]/10 to-transparent'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <div className={`w-full max-w-screen-xl mx-auto flex flex-col px-4 lg:px-6 transition-all duration-300 ${isTightLayout ? "gap-2" : "gap-6"}`}>

          {activeTab !== "mapa" && !isRotacionSubtab && (
            <Zoom triggerOnce>
              <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 ${isTightLayout ? "mb-4" : "mb-12"}`}>
                <div className="flex flex-col gap-3 w-full md:w-auto">
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
                      ) : activeTab === "movimientos" && activeMovimientosSubTab === "aduanas" ? (
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#621f32] via-[#852a44] to-[#bc955c] dark:from-[#e44a75] dark:via-[#bc955c] dark:to-[#ffda8a]">
                          Aduanas: Ocupación vs Vacantes
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
                    <p className="hidden md:block mt-3 text-gray-500 dark:text-gray-400 sm:text-lg font-medium leading-relaxed">
                      {activeTab === "catalogos_estructura"
                        ? "Administración y consulta de catálogos base que definen la estructura organizacional, puestos, acciones y tabuladores presupuestales de la ANAM."
                        : activeTab === "movimientos_personal"
                          ? "Gestión, consulta e histórico de los movimientos de personal, incluyendo altas, bajas y cambios de adscripción en la ANAM."
                          : activeTab === "movimientos" && activeMovimientosSubTab === "alineacion"
                            ? "Comparación campo a campo entre MOV_POS y EMPLEADOS_COMPLETOS_SIG para las plazas activas: detecta discrepancias entre la estructura de la plaza y los datos de la persona que la ocupa."
                            : activeTab === "movimientos" && activeMovimientosSubTab === "aduanas"
                              ? "Ocupación y vacancia de cada aduana, desglosadas por Nivel Jerárquico y Nivel, ubicadas sobre el mapa nacional."
                              : "Detalle completo de plazas, estatus administrativo y estructura funcional en la ANAM."}
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </Zoom>
          )}
        </div>

        {/* El tab de mapa calcula su alto exacto contra el viewport
            (`100dvh - stack - bottomnav`); el `mt-2` lo empujaba 8px y dejaba el
            borde inferior del mapa por debajo del BottomNav. */}
        <div className={`w-full ${activeTab === "mapa" || isRotacionSubtab ? "mt-0" : "mt-2"}`} ref={tabContentRef}>
          {/* Tabs con estado propio (filtros, orden, scroll, datos por fetch de cliente):
              se mantienen montados una vez visitados y se ocultan con CSS al salir,
              en vez de desmontarse, para no perder su estado ni re-fetchear. */}
          {visitedTabs.has("detalle") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_DETALLE) && (
            <div className={activeTab === "detalle" ? "block" : "hidden"}>
              <PlantillaDetalleTab
                detalle={detalleData}
                onCellEdited={updateDetalleCell}
                resumen={resumen}
                isPending={isPending}
                isLoading={isCargandoDetalleInicial || isRefrescandoDetalleTrasNivel}
                startTransition={startTransition}
                cardRef={cardRefDetalle}
                remoteUpdatesCount={remoteUpdatesCount}
                onClearRemoteUpdates={clearRemoteUpdatesCount}
                isActiveTab={activeTab === "detalle"}
              />
            </div>
          )}
          {visitedTabs.has("estatus") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_ESTATUS_NOMINA) && (
            <div className={activeTab === "estatus" ? "block" : "hidden"}>
              <EstatusTab
                estatusPorNivelUa={estatusPorNivelUa}
                activeSubTab={activeEstatusSubTab}
                detalle={detalleData}
              />
            </div>
          )}
          {visitedTabs.has("movimientos") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div className={activeTab === "movimientos" && activeMovimientosSubTab === "tabla" ? "block" : "hidden"}>
              <MovimientosTabSection
                detalle={detalleData}
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefMovimientos}
                onCardTitleChange={setMovCardTitle}
              />
            </div>
          )}
          {activeTab === "movimientos" && activeMovimientosSubTab === "cuadros" && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div ref={cardRefCuadros}>
              <Suspense fallback={<CuadrosVacanciaSkeleton />}>
                <CuadrosVacanciaSection
                  secondaryDataPromise={secondaryDataPromise}
                  onSwitchToTablaPrincipal={() => setActiveMovimientosSubTab("tabla")}
                  activeSectionTab={activeSectionTab}
                  setActiveSectionTab={setActiveSectionTab}
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
          {aduanasVisited && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div className={activeTab === "movimientos" && activeMovimientosSubTab === "aduanas" ? "block" : "hidden"}>
              <AduanasOcupacionVacanciaTab cardRef={cardRefAduanas} />
            </div>
          )}
          {anuenciaVisited && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOV_POSICIONES) && (
            <div className={activeTab === "movimientos" && activeMovimientosSubTab === "anuencia" ? "block" : "hidden"}>
              <AnuenciaTab cardRef={cardRefAnuencia} />
            </div>
          )}
          {visitedTabs.has("movimientos_personal") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_MOVIMIENTOS) && (
            <div className={activeTab === "movimientos_personal" ? "block" : "hidden"}>
              <MovimientosPersonalTab
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefMovPersonal}
                activeSubTab={activeMovPersonalSubTab}
                setActiveSubTab={setActiveMovPersonalSubTab}
              />
            </div>
          )}
          {visitedTabs.has("bajas") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_BAJAS) && (
            <div className={activeTab === "bajas" ? "block" : "hidden"}>
              <BajasTab
                isPending={isPending}
                startTransition={startTransition}
                cardRef={cardRefBajas}
              />
            </div>
          )}
          {visitedTabs.has("catalogos_estructura") && hasPermission(PERMISSIONS.VIEW_PLANTILLA_CATALOGOS) && (
            <div className={activeTab === "catalogos_estructura" ? "block" : "hidden"}>
              <CatalogosEstructuraTab
                activeCatalog={activeCatalogoSubTab}
                onBeforeRefreshDetalle={startRefrescoDetalleTrasNivelJerarquico}
              />
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
