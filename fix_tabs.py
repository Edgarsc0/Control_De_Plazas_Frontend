import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'r') as f:
    content = f.read()

# Make the layout justify-start so tabs aren't pushed to the extreme right
content = content.replace(
    'justify-between gap-4 w-full transition-all duration-300',
    'justify-start gap-4 lg:gap-12 w-full transition-all duration-300'
)

# Fill tabs and breadcrumbs with white color (opaque instead of translucent)
content = content.replace(
    'bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm',
    'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md'
)

# Also inner containers
content = content.replace(
    'bg-slate-100/50 dark:bg-slate-950/40 border',
    'bg-slate-100/90 dark:bg-slate-950/90 border'
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'w') as f:
    f.write(content)
