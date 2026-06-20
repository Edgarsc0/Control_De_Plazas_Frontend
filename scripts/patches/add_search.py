import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/TorreCaballito3DTab.jsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    'import { VacantesService } from "@/services/vacantes.service";',
    'import { VacantesService } from "@/services/vacantes.service";\nimport { Search, MapPin } from "lucide-react";'
)

# 2. Add state variables inside the component
state_code = """
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        setIsSearching(true);
        VacantesService.searchTorreCaballito(searchQuery)
          .then(res => res.json())
          .then(data => {
             setSearchResults(data.results || []);
             setShowDropdown(true);
          })
          .catch(err => console.error(err))
          .finally(() => setIsSearching(false));
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectEmployee = (emp) => {
    if (!emp.piso_num) {
       alert(`El empleado ${emp.Nombres} no tiene un piso asignado específico en la base de datos.`);
       return;
    }
    
    setSearchQuery(emp.Nombres);
    setShowDropdown(false);
    
    // Animar la cámara hacia el piso
    const targetPisoNum = parseInt(emp.piso_num);
    const geometryPiso = targetPisoNum - 1; 
    
    // Similar to floor click logic
    const heightPerFloor = 0.45;
    const offset = geometryPiso * heightPerFloor;
    const originalY = 1.0;
    const clickY = originalY + offset;

    const angle = Math.PI / 4;
    const distance = 8;
    const cx = Math.sin(angle) * distance;
    const cz = Math.cos(angle) * distance;
    const cy = clickY + 2;

    setTargetCamera({ position: [cx, cy, cz], lookAt: [0, clickY, 0] });
    setSelectedFloor(geometryPiso);

    // Fetch UA detail or floor detail
    // We can simulate clicking the floor
    const pisoName = `P${emp.piso_num.padStart(2, '0')}`;
    
    // Find info from fetched data
    const info = data.find(d => d.pisoLabel === pisoName);
    if (info) {
      setDisplayInfo(info);
      setSelectedUaRemote(null);
      setUaDetails(null);
    }
  };
"""

content = content.replace(
    '  const [empleadosModalTitle, setEmpleadosModalTitle] = useState("");',
    '  const [empleadosModalTitle, setEmpleadosModalTitle] = useState("");\n' + state_code
)

# 3. Add UI
ui_code = """
      {/* Search Bar */}
      <div className="absolute top-6 left-6 z-40 w-80">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
               <div className="size-4 border-2 border-[#621f32] border-t-transparent rounded-full animate-spin" />
            ) : (
               <Search className="size-4 text-slate-400" />
            )}
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-[#bc955c]/50 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all"
            placeholder="Buscar empleado por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
        </div>
        
        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto custom-scrollbar overflow-hidden flex flex-col py-2 animate-in fade-in slide-in-from-top-4 duration-200">
            {searchResults.map((emp, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectEmployee(emp)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-1 border-b border-slate-100 last:border-0"
              >
                <div className="font-bold text-sm text-slate-800 truncate">{emp.Nombres}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  <span className="truncate flex-1" title={emp["Unidad Administrativa"]}>{emp["Unidad Administrativa"]}</span>
                </div>
                {emp.piso_num ? (
                  <div className="flex items-center gap-1.5 mt-1 text-[#621f32] bg-[#621f32]/5 w-fit px-2 py-0.5 rounded-md">
                    <MapPin className="size-3" />
                    <span className="font-black text-xs">Piso {emp.piso_num}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400 bg-slate-100 w-fit px-2 py-0.5 rounded-md">
                    <span className="font-bold text-[10px]">Piso no asignado</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
"""

content = content.replace(
    '      <div className="absolute bottom-6 left-6 pointer-events-none bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200">',
    ui_code + '\n      <div className="absolute bottom-6 left-6 pointer-events-none bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200">'
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/TorreCaballito3DTab.jsx', 'w') as f:
    f.write(content)
