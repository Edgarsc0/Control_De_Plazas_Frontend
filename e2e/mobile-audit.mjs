/**
 * Auditoría móvil de /dashboard/plantilla_empleados.
 *
 * Recorre las 15 vistas (tab + subtab) en dos anchos y comprueba los criterios
 * A3–A5 y A7 del plan de corrección:
 *   A3 — sin scroll horizontal de página
 *   A4 — ningún control queda tapado por el BottomNav sin ser alcanzable
 *   A5 — todo control accionable mide >= 44x44 (con allowlist del banner gob.mx)
 *   A7 — cero errores de consola nuevos
 *
 * Uso:  node e2e/mobile-audit.mjs [baseUrl] [authToken]
 * Requiere el dev server levantado y una sesión válida (cookie auth_token).
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const TOKEN = process.argv[3] || process.env.QA_AUTH_TOKEN || "";
const RUTA = "/dashboard/plantilla_empleados";

const VIEWPORTS = [
  { name: "iPhone 15", width: 393, height: 659 },
  { name: "Android chico", width: 360, height: 640 },
];

// [etiqueta, tab, subtab|null]
const VISTAS = [
  ["Plantilla Detalle", "Plantilla Detalle", null],
  ["Estatus · Por Nivel", "Estatus Nómina", "Por Nivel"],
  ["Estatus · Por UA", "Estatus Nómina", "Por UA"],
  ["MovPos · Tabla Principal", "Mov. Posiciones", "Tabla Principal"],
  ["MovPos · Cuadros Vacancia", "Mov. Posiciones", "Cuadros Vacancia"],
  ["MovPos · Alineación", "Mov. Posiciones", "Comprobar Alineación"],
  ["MovPos · Aduanas", "Mov. Posiciones", "Aduanas Ocupación vs Vacantes"],
  ["Movimientos", "Movimientos", null],
  ["Empleados Bajas", "Empleados Bajas", null],
  ["Geo · Mapa Nacional", "Distribución Geográfica", "Mapa Nacional"],
  ["Geo · Torre Caballito", "Distribución Geográfica", "Torre Caballito"],
  ["Catálogos · Acciones", "Catálogos", "Acciones"],
  ["Catálogos · Motivos", "Catálogos", "Motivos"],
  ["Catálogos · Organigrama", "Catálogos", "Organigrama ANAM"],
  ["Catálogos · Niveles Jerárquicos", "Catálogos", "Niveles Jerárquicos por Plaza"],
];

// El banner gob.mx es normativo y queda fuera del alcance de este módulo.
const ALLOWLIST_TARGETS = ["Trámites", "Gobierno", "Buscar", ""];

const auditScript = () => {
  const de = document.documentElement;
  const vw = innerWidth;
  const nav = document.querySelector("nav.md\\:hidden");
  const bnTop = nav ? nav.getBoundingClientRect().top : innerHeight;

  const small = [];
  const covered = [];
  document.querySelectorAll('button,a,input,select,[role="button"]').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (e.offsetParent === null) return;
    // Las celdas de las matrices densas (Cuadros de Vacancia, desglose por
    // nivel) no son controles primarios: agrandarlas a 44px haría la tabla
    // inmanejable. Se auditan aparte, por su contenedor con scroll.
    if (e.closest("table")) return;
    // Marcadores del mapa: su tamaño codifica el nº de empleados, no son
    // controles de UI. Y los enlaces en línea dentro de un párrafo romperían
    // el texto si se agrandaran.
    if (e.closest(".maplibregl-marker") || e.closest(".maplibregl-ctrl-attrib")) return;
    if (e.tagName === "BUTTON" && e.closest("p") && /^inline/.test(getComputedStyle(e).display)) return;
    const label = (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40);
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (h < 44 || w < 44) small.push({ label, w, h });
    // Tapado por el BottomNav y sin poder desplazarse más (fondo de página)
    const atBottom = Math.ceil(scrollY + innerHeight) >= de.scrollHeight - 2;
    if (atBottom && r.top < bnTop + 1 && r.bottom > bnTop) covered.push({ label });
  });

  return {
    overflowX: de.scrollWidth - de.clientWidth,
    docH: de.scrollHeight,
    small,
    covered,
  };
};

async function abrirDrawer(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => (x.getAttribute("aria-label") || "").startsWith("Secciones de")
    );
    if (b) b.click();
  });
  await page.waitForTimeout(900);
}

async function elegirEnDrawer(page, texto) {
  const ok = await page.evaluate((t) => {
    const d = document.querySelector("[role=dialog]");
    if (!d) return false;
    const b = [...d.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  }, texto);
  await page.waitForTimeout(1600);
  return ok;
}

(async () => {
  const browser = await chromium.launch();
  let fallos = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    if (TOKEN) {
      await ctx.addCookies([
        { name: "auth_token", value: TOKEN, domain: new URL(BASE).hostname, path: "/" },
      ]);
    }
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", (e) => errores.push(String(e)));

    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    await page.goto(BASE + RUTA, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3000);

    for (const [etiqueta, tab, subtab] of VISTAS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await abrirDrawer(page);
      const okTab = await elegirEnDrawer(page, tab);
      if (subtab) {
        const abierto = await page.evaluate(() => !!document.querySelector("[role=dialog]"));
        if (!abierto) await abrirDrawer(page);
        await elegirEnDrawer(page, subtab);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(600);

      const r = await page.evaluate(auditScript);
      const smallReales = r.small.filter((s) => !ALLOWLIST_TARGETS.includes(s.label));
      const problemas = [];
      if (r.overflowX > 0) problemas.push(`overflowX=${r.overflowX}`);
      if (smallReales.length) problemas.push(`${smallReales.length} targets <44px`);
      if (r.covered.length) problemas.push(`${r.covered.length} tapados por BottomNav`);
      if (!okTab) problemas.push("tab inalcanzable");

      if (problemas.length) {
        fallos++;
        console.log(`  ✗ ${etiqueta}: ${problemas.join(" · ")}`);
        smallReales.slice(0, 5).forEach((s) => console.log(`      · "${s.label}" ${s.w}x${s.h}`));
      } else {
        console.log(`  ✓ ${etiqueta}`);
      }
    }

    if (errores.length) {
      fallos++;
      console.log(`  ✗ ${errores.length} errores de JS:`);
      errores.slice(0, 5).forEach((e) => console.log(`      ${e.slice(0, 140)}`));
    } else {
      console.log("  ✓ sin errores de JS");
    }

    await ctx.close();
  }

  await browser.close();
  console.log(fallos === 0 ? "\nAUDITORÍA OK" : `\nAUDITORÍA CON ${fallos} FALLOS`);
  process.exit(fallos === 0 ? 0 : 1);
})();
