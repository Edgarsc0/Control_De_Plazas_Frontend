import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/ClientComponent.jsx', 'r') as f:
    content = f.read()

# Backgrounds
content = content.replace('bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950', 'bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200')
content = content.replace('bg-slate-900/80', 'bg-white/90')
content = content.replace('bg-slate-900/95', 'bg-white/95')
content = content.replace('bg-slate-900/50', 'bg-white/80')
content = content.replace('bg-slate-800/50', 'bg-slate-50')
content = content.replace('bg-slate-800/40', 'bg-slate-100')
content = content.replace('bg-slate-800/30', 'bg-slate-50')
content = content.replace('bg-slate-700/60', 'bg-slate-200')
content = content.replace('bg-slate-700/50', 'bg-slate-200')
content = content.replace('bg-slate-950/50', 'bg-slate-100')
content = content.replace('bg-slate-950/80', 'bg-slate-900/30') # Backdrop for modal
content = content.replace('bg-slate-900', 'bg-white')
content = content.replace('bg-slate-800', 'bg-slate-50')

# Borders
content = content.replace('border-slate-700/50', 'border-slate-200')
content = content.replace('border-slate-700/30', 'border-slate-200')
content = content.replace('border-slate-700/80', 'border-slate-200')
content = content.replace('border-slate-700', 'border-slate-200')
content = content.replace('border-slate-800', 'border-slate-200')

# Text Colors
content = content.replace('text-white', 'text-[#621f32]')
content = content.replace('text-slate-400', 'text-slate-500')
content = content.replace('text-slate-300', 'text-slate-600')
content = content.replace('text-slate-200', 'text-slate-700')
content = content.replace('text-slate-500', 'text-slate-500')
content = content.replace('text-sky-300', 'text-[#bc955c]')
content = content.replace('text-sky-200', 'text-slate-700')
content = content.replace('text-sky-400', 'text-[#621f32]')
content = content.replace('text-rose-400', 'text-[#621f32]')
content = content.replace('text-rose-300', 'text-[#621f32]')

# Highlight Colors
content = content.replace('bg-sky-500/10', 'bg-[#bc955c]/10')
content = content.replace('bg-rose-500/10', 'bg-[#bc955c]/10')
content = content.replace('bg-sky-900/40', 'bg-[#bc955c]/10')
content = content.replace('bg-sky-900/30', 'bg-[#bc955c]/10')
content = content.replace('border-sky-700/50', 'border-[#bc955c]/30')
content = content.replace('border-sky-500/50', 'border-[#bc955c]/30')
content = content.replace('bg-sky-500', 'bg-[#621f32]')
content = content.replace('bg-rose-500', 'bg-[#bc955c]')

# Hover Text
content = content.replace('hover:text-white', 'hover:text-[#621f32]')

# Some specific text fixes
content = content.replace('text-[#621f32] font-bold text-lg', 'text-[#621f32] font-bold text-lg')

# Wait, `text-white` when used inside `bg-[#621f32]` should remain white.
# So I'll revert text-[#621f32] to text-white conditionally for those buttons.
content = content.replace('bg-[#621f32] text-[#621f32]', 'bg-[#621f32] text-white')
content = content.replace('bg-[#bc955c] text-[#621f32]', 'bg-[#bc955c] text-white')

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/app/prueba2/ClientComponent.jsx', 'w') as f:
    f.write(content)
