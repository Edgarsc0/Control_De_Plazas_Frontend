import { Noto_Sans } from "next/font/google";
import "./globals.css";
import Banner from "@/components/layout/Banner";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import { Fade } from "@/components/shared/Reveal";
import { TooltipProvider } from "@/components/ui/tooltip"
import { ZafiroUpdatesProvider } from "@/context/ZafiroUpdatesContext"
import { PageTabsProvider } from "@/context/PageTabsContext"
import { ToastProvider } from "@/hooks/useToast"
import { AuthProvider } from "@/hooks/useAuth"
import Toaster from "@/components/ui/Toaster"
import { MaintenanceProvider, MaintenanceGate } from "@/context/MaintenanceContext"
import MaintenanceScreen from "@/components/system/MaintenanceScreen"
import PresenceHeartbeat from "@/components/system/PresenceHeartbeat"


const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-noto-sans",
});

export const metadata = {
  title: {
    default: "Sistema de Control de Plazas | ANAM",
    template: "%s | SCP ANAM",
  },
  description:
    "Sistema de Control de Plazas de la Agencia Nacional de Aduanas de México (ANAM).",
  // Con esto iOS usa apple-icon.png (el isotipo ANAM) como ícono al anclar a
  // inicio en vez de generar una letra a partir del título, y abre en modo
  // standalone (sin la barra de Safari) para que se sienta como app nativa.
  appleWebApp: {
    capable: true,
    title: "Control de Plazas",
    statusBarStyle: "default",
  },
  // Next 16 solo emite el "mobile-web-app-capable" genérico (appleWebApp de
  // arriba); iOS más viejo solo reconoce el prefijado "apple-", así que se
  // agrega a mano para no perder el modo standalone en esos dispositivos.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// userScalable/maximumScale en 1: el sistema se navega con gestos (arrastrar
// tablas, deslizar tabs) sobre todo en celular, y sin esto un pellizco
// accidental deja al usuario haciendo zoom en vez de desplazarse.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#621f32",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${notoSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col relative">
        <div className="absolute inset-0 -z-10 bg-[url('/pleca.png')] bg-cover bg-no-repeat opacity-5"></div>

        {/* Banner fuera de cualquier animación */}
        <Banner />
        <AuthProvider>
          <ToastProvider>
            <MaintenanceProvider>
            <PageTabsProvider>
              <PresenceHeartbeat />
              <Fade>
                {/* pt-16 fijo (no pt-[var(--navbar-h)]): el override móvil de
                    --stack-h/--navbar-h en globals.css (@media
                    max-width:767px) se pierde en la build de Tailwind v4 y
                    nunca llega a aplicarse, así que esas variables se quedan
                    en su valor de :root (el de escritorio) también en móvil
                    — dejaba hueco fantasma bajo el Navbar. El Navbar en
                    móvil NUNCA creció (sigue en h-16 = 4rem, ver Navbar.jsx,
                    solo `md:h-20` cambió), así que hardcodear `pt-16` aquí
                    es siempre correcto y no depende de que ese override
                    llegue a aplicarse. Escritorio sí puede usar
                    md:pt-[var(--stack-h)] normal: el breakpoint ahí lo pone
                    Tailwind (`md:`), no una media query sobre la variable. */}
                <main className="flex-grow relative z-10 flex flex-col pt-16 md:pt-[var(--stack-h)] pb-nav-safe md:pb-0">
                  <ZafiroUpdatesProvider>
                    <Navbar />
                    <TooltipProvider>
                      <MaintenanceGate screen={<MaintenanceScreen />}>
                        {children}
                      </MaintenanceGate>
                    </TooltipProvider>
                  </ZafiroUpdatesProvider>
                </main>
              </Fade>
              <BottomNav />
              <Toaster position="top-right" />
            </PageTabsProvider>
            </MaintenanceProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}