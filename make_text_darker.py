import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/EmpleadosTableModal.jsx', 'r') as f:
    content = f.read()

# Make main table text darker
content = content.replace('text-slate-600', 'text-slate-900')
content = content.replace('text-slate-500', 'text-slate-800')

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/EmpleadosTableModal.jsx', 'w') as f:
    f.write(content)
