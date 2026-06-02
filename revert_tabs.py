import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'r') as f:
    content = f.read()

# Revert justify-start back to justify-between
content = content.replace(
    'justify-start gap-4 lg:gap-12 w-full',
    'justify-between gap-4 w-full'
)

# Fix the absolute container centering
content = content.replace(
    'absolute top-4 left-4 right-4 z-50 pointer-events-none',
    'absolute top-4 left-0 right-0 mx-auto z-50 pointer-events-none'
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/dashboard/plantilla_empleados/ClientComponent.jsx', 'w') as f:
    f.write(content)
