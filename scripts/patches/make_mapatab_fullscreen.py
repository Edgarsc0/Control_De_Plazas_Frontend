import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/MapaTab.jsx', 'r') as f:
    content = f.read()

# Make the outer container full width/height without margins/padding
content = content.replace(
    '<div className="w-full flex justify-center mt-4 px-2 sm:px-4 pb-4">',
    '<div className="w-full h-[calc(100vh-144px)] flex justify-center">'
)

content = content.replace(
    '<div className="w-full max-w-[1920px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/80 shadow-2xl overflow-hidden p-3 h-[calc(100vh-190px)] min-h-[650px] flex flex-col relative">',
    '<div className="w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col relative">'
)

# Float the header
content = content.replace(
    '<div className="p-4 border-b border-slate-200/50 dark:border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/30 dark:bg-slate-900/10 z-10">',
    '<div className="absolute bottom-6 left-6 right-6 lg:left-auto p-4 rounded-2xl flex flex-col items-start gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 shadow-xl border border-slate-200 dark:border-slate-800/80 pointer-events-auto">'
)

# Remove Map borders and padding
content = content.replace(
    '<div className="flex-1 w-full rounded-[1.8rem] overflow-hidden relative border border-slate-200/55 dark:border-slate-800/60 bg-slate-100 dark:bg-slate-950">',
    '<div className="flex-1 w-full overflow-hidden relative">'
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/MapaTab.jsx', 'w') as f:
    f.write(content)
