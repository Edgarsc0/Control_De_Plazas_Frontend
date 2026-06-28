import { Noto_Sans } from "next/font/google";
import "./globals.css";
import Banner from "@/components/layout/Banner";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import { Fade, Slide, Zoom } from "react-awesome-reveal";
import { TooltipProvider } from "@/components/ui/tooltip"
import { ZafiroUpdatesProvider } from "@/context/ZafiroUpdatesContext"
import { PageTabsProvider } from "@/context/PageTabsContext"
import { ToastProvider } from "@/hooks/useToast"
import Toaster from "@/components/ui/Toaster"


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
        <ToastProvider>
          <PageTabsProvider>
            <Fade>
              <main className="flex-grow relative z-10 flex flex-col pt-[var(--stack-h)] pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom))] md:pb-0">
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
      </body>
    </html>
  );
}