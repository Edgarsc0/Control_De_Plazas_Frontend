import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'r') as f:
    content = f.read()

# Hide header for both mapa subtabs
content = content.replace('{!(activeTab === "mapa" && activeMapaSubTab === "caballito") && (', '{activeTab !== "mapa" && (')

# Make the breadcrumbs and tabs container absolute if activeTab === "mapa"
content = content.replace(
    '<div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full transition-all duration-300 ${isTightLayout ? "mb-2" : "mb-6"}`}>',
    '<div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full transition-all duration-300 ${isTightLayout ? "mb-2" : "mb-6"} ${activeTab === "mapa" ? "absolute top-4 left-4 right-4 z-50 pointer-events-none" : "relative"}`}>\n            <div className="pointer-events-auto flex items-center">'
)
content = content.replace(
    '</nav>\n            </Zoom>',
    '</nav>\n            </div>\n            </Zoom>'
)

content = content.replace(
    '<div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm w-full lg:w-auto z-10">',
    '<div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm w-full lg:w-auto z-10 pointer-events-auto">'
)

# Remove the padding top/bottom wrapper logic when it's mapa
content = content.replace(
    '<div className={`mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 ${isTightLayout ? "pt-4 pb-0" : "pt-12 pb-12"}`}>',
    '<div className={`mx-auto w-full max-w-full flex flex-col items-center transition-all duration-300 ${activeTab === "mapa" ? "p-0" : isTightLayout ? "pt-4 pb-0" : "pt-12 pb-12"}`}>'
)

# Expand Torre Caballito height
content = content.replace(
    '<div className="w-full h-[calc(100vh-250px)] min-h-[500px] rounded-2xl overflow-hidden relative">',
    '<div className="w-full h-[calc(100vh-144px)] min-h-[500px] overflow-hidden relative">'
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'w') as f:
    f.write(content)
