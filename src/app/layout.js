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
            <PageTabsProvider>
              <PresenceHeartbeat />
              <Fade>
                {/* pt-[var(--navbar-h)] fijo: el override móvil de --stack-h
                    en globals.css (@media max-width:767px) se pierde en la
                    build de Tailwind v4 y nunca llega a aplicarse, así que
                    --stack-h se queda en 9rem (banner+navbar) también en
                    móvil aunque el Banner esté oculto ahí — dejaba 80px de
                    hueco fantasma bajo el Navbar. Aquí se resuelve el
                    breakpoint con clases de Tailwind, que sí funcionan. */}
                <main className="flex-grow relative z-10 flex flex-col pt-[var(--navbar-h)] md:pt-[var(--stack-h)] pb-nav-safe md:pb-0">
                  <ZafiroUpdatesProvider>
                    <Navbar />
                    <TooltipProvider>
                      {children}
                    </TooltipProvider>
                  </ZafiroUpdatesProvider>
                </main>
              </Fade>
              <BottomNav />
              <Toaster position="top-right" />
            </PageTabsProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}