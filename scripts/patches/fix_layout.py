import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'r') as f:
    content = f.read()

# 1. Define isTightLayout
content = content.replace(
    '  const cardRef = useRef(null);',
    '  const cardRef = useRef(null);\n  const isTightLayout = activeTab === "detalle" || activeTab === "movimientos" || activeTab === "bajas" || activeTab === "organigrama" || (activeTab === "mapa" && activeMapaSubTab === "caballito");'
)

# 2. Replace long conditions with isTightLayout
content = content.replace('activeTab === "detalle" || activeTab === "movimientos" || activeTab === "bajas" || activeTab === "organigrama"', 'isTightLayout')
content = content.replace('activeTab === "detalle" || activeTab === "movimientos" || activeTab === "bajas"', 'isTightLayout')

# 3. Hide header if activeTab === "mapa" && activeMapaSubTab === "caballito"
# Find the exact string `<Zoom triggerOnce>\n            <div className={`flex flex-col md:flex-row`
# and wrap it.
content = content.replace(
    '<Zoom triggerOnce>\n            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 ${isTightLayout ? "mb-4" : "mb-12"}`}>',
    '{!(activeTab === "mapa" && activeMapaSubTab === "caballito") && (\n          <Zoom triggerOnce>\n            <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-8 transition-all duration-300 ${isTightLayout ? "mb-4" : "mb-12"}`}>'
)
content = content.replace(
    '              </div>\n            </div>\n          </Zoom>\n        </div>\n\n        <div className="w-full mt-2">',
    '              </div>\n            </div>\n          </Zoom>\n          )}\n        </div>\n\n        <div className="w-full mt-2">'
)

# 4. Change height of TorreCaballito container to be taller
content = content.replace('h-[calc(100vh-250px)] min-h-[600px]', 'h-[calc(100vh-170px)] min-h-[600px]')

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'w') as f:
    f.write(content)
