import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/ClientComponent.jsx', 'r') as f:
    content = f.read()

content = content.replace('text-slate-600', 'text-slate-900')
content = content.replace('text-slate-500', 'text-slate-800')

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/ClientComponent.jsx', 'w') as f:
    f.write(content)
