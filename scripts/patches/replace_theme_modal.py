import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/EmpleadosTableModal.jsx', 'r') as f:
    content = f.read()

# Backgrounds
content = content.replace('bg-slate-950/80', 'bg-slate-900/50') # Modal backdrop
content = content.replace('bg-slate-900', 'bg-white')
content = content.replace('bg-slate-800/90', 'bg-slate-50/90')
content = content.replace('bg-slate-800/80', 'bg-slate-50/80')
content = content.replace('bg-slate-800/50', 'bg-slate-50')
content = content.replace('bg-slate-800/40', 'bg-slate-100')
content = content.replace('bg-slate-800', 'bg-white')
content = content.replace('bg-slate-950/50', 'bg-slate-100')
content = content.replace('bg-slate-950', 'bg-slate-50')
content = content.replace('bg-slate-700/50', 'bg-slate-100')
content = content.replace('bg-slate-700', 'bg-slate-100')
content = content.replace('bg-sky-900/30', 'bg-[#bc955c]/20')
content = content.replace('bg-sky-500/20', 'bg-[#bc955c]/20')

# Borders
content = content.replace('border-slate-700/80', 'border-slate-200')
content = content.replace('border-slate-700', 'border-slate-200')
content = content.replace('border-slate-800/50', 'border-slate-200')
content = content.replace('border-slate-800', 'border-slate-200')
content = content.replace('border-slate-600', 'border-slate-200')
content = content.replace('border-sky-800', 'border-[#bc955c]/50')
content = content.replace('border-sky-500', 'border-[#621f32]')
content = content.replace('border-sky-900/50', 'border-[#bc955c]/50')

# Text Colors
content = content.replace('text-white', 'text-[#621f32]')
content = content.replace('text-slate-400', 'text-slate-500')
content = content.replace('text-slate-300', 'text-slate-600')
content = content.replace('text-slate-200', 'text-slate-700')
content = content.replace('text-slate-500', 'text-slate-500')
content = content.replace('text-sky-400', 'text-[#621f32]')

# Highlights and focus
content = content.replace('focus:border-sky-500', 'focus:border-[#621f32]')
content = content.replace('focus:ring-sky-500', 'focus:ring-[#621f32]')
content = content.replace('bg-sky-600', 'bg-[#621f32]')
content = content.replace('bg-sky-500', 'bg-[#621f32]')
content = content.replace('text-sky-500', 'text-[#621f32]')

# Hover text overrides
content = content.replace('hover:text-white', 'hover:text-[#621f32]')
content = content.replace('hover:bg-slate-700', 'hover:bg-slate-100')

# Restore button text colors
content = content.replace('bg-[#621f32] text-[#621f32]', 'bg-[#621f32] text-white')
content = content.replace('bg-[#bc955c] text-[#621f32]', 'bg-[#bc955c] text-white')
content = content.replace('bg-sky-600 text-[#621f32]', 'bg-[#621f32] text-white')

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/EmpleadosTableModal.jsx', 'w') as f:
    f.write(content)
