"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Html, ContactShadows } from "@react-three/drei";
import { VacantesService } from "@/services/vacantes.service";
import { Search, MapPin } from "lucide-react";
import EmpleadosTableModal from "./EmpleadosTableModal";
import * as THREE from "three";

const extractFloorNumber = (pisoStr) => {
  if (!pisoStr) return 0;
  if (pisoStr.includes(" PB")) return 0;
  const match = pisoStr.match(/P(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Heatmap color logic
const getColor = (count, maxCount) => {
  if (count === 0) return new THREE.Color("#0f172a"); // Dark slate for empty floors
  if (maxCount === 0) return new THREE.Color("#fbbf24"); 
  const ratio = Math.min(count / maxCount, 1);
  const c1 = new THREE.Color("#fcd34d"); // Light yellow
  const c2 = new THREE.Color("#e11d48"); // Deep red
  return c1.lerp(c2, ratio);
};

// UA Color Palette
const PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#84cc16",
  "#d946ef", "#0ea5e9", "#eab308", "#22c55e", "#6366f1"
];
const getUaColor = (uaName) => {
  if (!uaName || uaName === "No Asignada") return new THREE.Color("#475569");
  let hash = 0;
  for (let i = 0; i < uaName.length; i++) {
    hash = uaName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return new THREE.Color(PALETTE[Math.abs(hash) % PALETTE.length]);
};

// Individual Floor Component
const Floor = ({ yPosition, width, depth, height, count, maxCount, pisoLabel, uas, dominantUa, mode, onHover, onClick, isSelected, isHoveredRemote }) => {
  const [hovered, setHovered] = useState(false);
  const isHovered = hovered || isHoveredRemote;
  
  const baseColor = useMemo(() => {
    if (count === 0) return new THREE.Color("#0f172a");
    if (mode === "heat") return getColor(count, maxCount);
    return getUaColor(dominantUa);
  }, [count, maxCount, mode, dominantUa]);
  
  const isEmpty = count === 0;

  return (
    <group 
      position={[0, yPosition, 0]}
      scale={isSelected ? [1.08, 1.05, 1.08] : [1, 1, 1]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover({ pisoLabel, count, yPosition, uas, dominantUa });
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        onHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick({ pisoLabel, count, yPosition, uas, dominantUa });
      }}
    >
      {/* The main glass volume */}
      <mesh>
        <boxGeometry args={[width, height * 0.95, depth]} />
        {isEmpty ? (
          <meshPhysicalMaterial 
            color={isSelected ? "#0ea5e9" : "#0f172a"}
            transparent 
            opacity={isSelected ? 0.6 : 0.3}
            roughness={0}
            metalness={1}
            transmission={0.9} // ultra clear glass
            ior={1.5}
            envMapIntensity={2}
            emissive={isSelected ? "#0284c7" : "#000000"}
            emissiveIntensity={isSelected ? 1 : 0}
          />
        ) : (
          <meshStandardMaterial 
            color={isSelected ? "#ffffff" : baseColor} 
            emissive={isSelected ? (mode === "heat" ? "#38bdf8" : "#ffffff") : baseColor}
            emissiveIntensity={isSelected ? 2.5 : (isHovered ? 0.8 : 0.4)}
            roughness={0.2}
            metalness={0.1}
          />
        )}
      </mesh>

      {/* Solid floor slab separating the floors */}
      <mesh position={[0, -height / 2 + 0.05, 0]}>
        <boxGeometry args={[width + 0.2, 0.1, depth + 0.2]} />
        <meshStandardMaterial color={isSelected ? "#0ea5e9" : "#1e293b"} roughness={0.8} metalness={0.2} emissive={isSelected ? "#0ea5e9" : "#000000"} emissiveIntensity={isSelected ? 1 : 0} />
      </mesh>
      
      {/* Highlight glowing border when hovered or selected */}
      {(isHovered || isSelected) && !isEmpty && (
        <lineSegments position={[0, -height / 2 + 0.05, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(width + 0.3, 0.2, depth + 0.3)]} />
          <lineBasicMaterial color={isSelected ? "#ffffff" : "#ffffff"} linewidth={isSelected ? 5 : 2} />
        </lineSegments>
      )}
    </group>
  );
};

// The yellow Caballito statue approximation at the base
const ElCaballito = () => {
  return (
    <group position={[12, 4, 12]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0, 2, 8, 4]} />
        <meshStandardMaterial color="#facc15" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, -3.5, 0]}>
        <boxGeometry args={[3, 1, 3]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <lineSegments position={[0, 0, 0]}>
        <edgesGeometry args={[new THREE.CylinderGeometry(0, 2, 8, 4)]} />
        <lineBasicMaterial color="#a16207" />
      </lineSegments>
    </group>
  );
};

const TorreCaballito = ({ data, hoverInfo, setHoverInfo, selectedInfo, setSelectedInfo, mode, hoveredUaRemote, selectedUaRemote }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalFloors = 32;
  const floorHeight = 1.8; // Made taller
  const buildingWidth = 20;
  const buildingDepth = 15;

  // Generate 32 floors
  const floors = Array.from({ length: totalFloors }).map((_, i) => {
    const floorData = data.find(d => extractFloorNumber(d.piso) === i);
    const count = floorData ? floorData.count : 0;
    const uas = floorData && floorData.uas ? floorData.uas : [];
    const pisoLabel = floorData ? floorData.piso : (i === 0 ? "Planta Baja" : `Piso ${i}`);
    const yPosition = (i * floorHeight) + (floorHeight / 2);
    
    // Find dominant UA
    let dominantUa = null;
    if (uas.length > 0) {
      dominantUa = uas.reduce((prev, current) => (prev.count > current.count) ? prev : current).nombre;
    }
    
    const isSelected = selectedInfo?.pisoLabel === pisoLabel || (mode === "ua" && dominantUa && selectedUaRemote === dominantUa);
    const isHoveredRemote = hoverInfo?.pisoLabel === pisoLabel || (mode === "ua" && dominantUa && hoveredUaRemote === dominantUa);

    return (
      <Floor
        key={i}
        yPosition={yPosition}
        width={buildingWidth}
        depth={buildingDepth}
        height={floorHeight}
        count={count}
        maxCount={maxCount}
        pisoLabel={pisoLabel}
        uas={uas}
        dominantUa={dominantUa}
        mode={mode}
        onHover={setHoverInfo}
        onClick={setSelectedInfo}
        isSelected={isSelected}
        isHoveredRemote={isHoveredRemote}
      />
    );
  });

  const buildingTotalHeight = totalFloors * floorHeight;

  return (
    <group position={[0, 0, 0]}>
      {/* Ground Plaza Base */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[30, 32, 1, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Concrete Inner Core (Elevator shaft) */}
      <mesh position={[0, buildingTotalHeight / 2, 0]}>
        <boxGeometry args={[buildingWidth * 0.4, buildingTotalHeight, buildingDepth * 0.4]} />
        <meshStandardMaterial color="#020617" roughness={1} metalness={0} />
      </mesh>

      {/* Exterior Vertical Columns for Architectural Detail */}
      {[-buildingWidth/2 + 0.5, 0, buildingWidth/2 - 0.5].map((x, i) => (
        <mesh key={`col-front-${i}`} position={[x, buildingTotalHeight / 2, buildingDepth/2 + 0.1]}>
          <boxGeometry args={[0.5, buildingTotalHeight, 0.5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {[-buildingWidth/2 + 0.5, 0, buildingWidth/2 - 0.5].map((x, i) => (
        <mesh key={`col-back-${i}`} position={[x, buildingTotalHeight / 2, -buildingDepth/2 - 0.1]}>
          <boxGeometry args={[0.5, buildingTotalHeight, 0.5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Building Floors */}
      {floors}
      
      {/* Roof structure / Helipad */}
      <group position={[0, buildingTotalHeight, 0]}>
        {/* Roof Base */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[buildingWidth - 2, 2, buildingDepth - 2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Helipad "H" Markings (resting directly on the roof base) */}
        <group position={[0, 2.01, 0]}>
          {/* Left bar */}
          <mesh position={[-1.5, 0, 0]}>
            <boxGeometry args={[0.6, 0.05, 4]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Right bar */}
          <mesh position={[1.5, 0, 0]}>
            <boxGeometry args={[0.6, 0.05, 4]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Center bar */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[3, 0.05, 0.6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>

      {/* The El Caballito Statue */}
      <ElCaballito />
    </group>
  );
};

const CameraRig = () => {
  const [intro, setIntro] = useState(true);
  
  useEffect(() => {
    // End intro animation after 3.5 seconds
    const t = setTimeout(() => setIntro(false), 3500);
    return () => clearTimeout(t);
  }, []);

  useFrame((state) => {
    if (intro) {
      const time = state.clock.getElapsedTime();
      
      // Math function to ease out the animation smoothly
      // time goes from 0 to 3.5. Let's create an eased progress 0..1
      const progress = Math.min(time / 3.5, 1);
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      // Start super close and low [radius: 20, height: 5]
      // End further out and higher [radius: 100, height: 65]
      const radius = 20 + easeOutCubic * 80; 
      const height = 5 + easeOutCubic * 60; 
      const angle = time * 0.8; // Spin while pulling back
      
      state.camera.position.x = Math.sin(angle) * radius;
      state.camera.position.z = Math.cos(angle) * radius;
      state.camera.position.y = height;
      state.camera.lookAt(0, 25, 0); // Keep focused on the middle of the building
    }
  });

  return !intro ? (
    <OrbitControls 
      enablePan={false} 
      minPolarAngle={0} 
      maxPolarAngle={Math.PI / 2 - 0.02} // Prevent going below ground
      minDistance={10} 
      maxDistance={400} 
      target={[0, 25, 0]} 
      autoRotate={true}
      autoRotateSpeed={2.5} 
      makeDefault
    />
  ) : null;
};

export default function TorreCaballito3DTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [hoveredUaRemote, setHoveredUaRemote] = useState(null);
  const [selectedUaRemote, setSelectedUaRemote] = useState(null);
  const [viewMode, setViewMode] = useState("heat"); // "heat" | "ua"
  
  const [empleadosData, setEmpleadosData] = useState(null);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [empleadosModalTitle, setEmpleadosModalTitle] = useState("");

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

  
  const displayInfo = selectedInfo || hoverInfo;

  const uniqueUas = useMemo(() => {
    const uasSet = new Set();
    data.forEach(floor => {
      if (floor.uas && floor.uas.length > 0) {
        const dom = floor.uas.reduce((prev, current) => (prev.count > current.count) ? prev : current).nombre;
        uasSet.add(dom);
      }
    });
    return Array.from(uasSet).sort();
  }, [data]);

  const sortedFloors = useMemo(() => {
    return [...data].sort((a, b) => b.count - a.count).filter(d => d.count > 0);
  }, [data]);

  const displayUaRemote = selectedUaRemote || hoveredUaRemote;
  
  const uaDetails = useMemo(() => {
    if (!displayUaRemote || viewMode !== "ua") return null;
    let totalActivos = 0;
    const pisosList = [];
    
    data.forEach(floor => {
      if (floor.uas) {
        const uaMatch = floor.uas.find(u => u.nombre === displayUaRemote);
        if (uaMatch && uaMatch.count > 0) {
          totalActivos += uaMatch.count;
          pisosList.push({ piso: floor.piso, count: uaMatch.count });
        }
      }
    });
    
    pisosList.sort((a, b) => b.count - a.count);
    
    return {
      nombre: displayUaRemote,
      total: totalActivos,
      pisos: pisosList
    };
  }, [displayUaRemote, data, viewMode]);

  useEffect(() => {
    VacantesService.getTorreCaballito3D()
      .then((res) => res.json())
      .then((fetchedData) => {
        setData(fetchedData);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-transparent text-[#621f32]">
        <div className="w-12 h-12 border-4 border-[#621f32] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-[#621f32] animate-pulse">Construyendo Torre Caballito en 3D...</h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-transparent overflow-hidden relative">
      <Canvas camera={{ position: [20, 5, 20], fov: 45 }}>
        {/* Environment and Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 50, 20]} intensity={1.5} castShadow />
        <pointLight position={[-20, 30, -20]} intensity={1} color="#38bdf8" />
        <Environment preset="city" />
        
        {/* The 3D Tower */}
        <TorreCaballito 
          data={data} 
          hoverInfo={hoverInfo}
          setHoverInfo={setHoverInfo} 
          selectedInfo={selectedInfo} 
          setSelectedInfo={setSelectedInfo} 
          mode={viewMode}
          hoveredUaRemote={hoveredUaRemote}
          selectedUaRemote={selectedUaRemote}
        />
        
        {/* Soft shadow on the ground */}
        <ContactShadows resolution={2048} scale={100} blur={2.5} opacity={0.6} far={20} color="#000000" position={[0, -0.49, 0]} />
        
        {/* Camera Intro Animation and Controls */}
        <CameraRig />
      </Canvas>
      
      {/* UI Overlay: Title & Mode Toggle */}
      <div className="absolute top-6 left-6 pointer-events-auto flex flex-col gap-4">
        <div className="pointer-events-none">
          <h2 className="text-3xl font-black text-[#621f32] drop-shadow-md">Torre del Caballito</h2>
          <p className="text-slate-800 font-medium text-lg">Paseo de la Reforma 10</p>
        </div>
        
        {/* Toggle Switch */}
        <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 flex w-max shadow-lg">
          <button 
            onClick={() => {
              setViewMode("heat");
              setSelectedInfo(null);
              setHoverInfo(null);
              setSelectedUaRemote(null);
              setHoveredUaRemote(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "heat" ? "bg-[#bc955c] text-white shadow-md" : "text-slate-800 hover:text-[#621f32]"}`}
          >
            Mapa de Calor
          </button>
          <button 
            onClick={() => {
              setViewMode("ua");
              setSelectedInfo(null);
              setHoverInfo(null);
              setSelectedUaRemote(null);
              setHoveredUaRemote(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "ua" ? "bg-[#621f32] text-white shadow-md" : "text-slate-800 hover:text-[#621f32]"}`}
          >
            Color por Unidad
          </button>
        </div>

        {/* Legend for Heatmap mode */}
        {viewMode === "heat" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200 w-max pointer-events-none">
              <div className="w-4 h-4 rounded-full bg-[#fcd34d]" />
              <span className="text-xs text-slate-900 font-bold uppercase tracking-wider">Menos</span>
              <div className="w-32 h-1.5 rounded-full bg-gradient-to-r from-[#fcd34d] to-[#e11d48]" />
              <span className="text-xs text-slate-900 font-bold uppercase tracking-wider">Más Empleados</span>
              <div className="w-4 h-4 rounded-full bg-[#e11d48]" />
            </div>

            {/* Ranked Floors List */}
            {sortedFloors.length > 0 && (
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 w-80 pointer-events-auto flex flex-col shadow-lg max-h-[50vh]">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 shrink-0">Ranking de Pisos</h4>
                <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                  {sortedFloors.map((floor, idx) => {
                    const color = getColor(floor.count, Math.max(...data.map(d => d.count))).getHexString();
                    return (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center gap-3 bg-slate-100 p-2 rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                        onMouseEnter={() => setHoverInfo({ 
                          pisoLabel: floor.piso, 
                          count: floor.count, 
                          uas: floor.uas,
                          dominantUa: floor.uas?.length > 0 ? floor.uas.reduce((p, c) => p.count > c.count ? p : c).nombre : null
                        })}
                        onMouseLeave={() => setHoverInfo(null)}
                        onClick={() => setSelectedInfo({ 
                          pisoLabel: floor.piso, 
                          count: floor.count, 
                          uas: floor.uas,
                          dominantUa: floor.uas?.length > 0 ? floor.uas.reduce((p, c) => p.count > c.count ? p : c).nombre : null
                        })}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `#${color}` }} />
                          <span className="text-sm text-slate-900 font-medium">{floor.piso}</span>
                        </div>
                        <span className="font-bold text-[#621f32] bg-[#bc955c]/10 px-2 py-0.5 rounded text-xs shrink-0">{floor.count} emp.</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend for UA mode */}
        {viewMode === "ua" && uniqueUas.length > 0 && (
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 w-80 pointer-events-auto max-h-[60vh] overflow-y-auto custom-scrollbar shadow-lg">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Leyenda de Unidades</h4>
            <div className="flex flex-col gap-2.5">
              {uniqueUas.map((ua, idx) => {
                const color = getUaColor(ua).getHexString();
                const isLegendSelected = selectedUaRemote === ua;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-3 cursor-pointer p-2 rounded-lg transition-colors border ${isLegendSelected ? 'bg-[#bc955c]/10 border-[#bc955c]/30' : 'border-transparent hover:bg-slate-100 hover:border-slate-200'}`}
                    onMouseEnter={() => setHoveredUaRemote(ua)}
                    onMouseLeave={() => setHoveredUaRemote(null)}
                    onClick={() => setSelectedUaRemote(selectedUaRemote === ua ? null : ua)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0 mt-0.5 shadow-sm" style={{ backgroundColor: `#${color}` }} />
                    <span className={`text-xs leading-snug ${isLegendSelected ? 'text-[#621f32] font-bold' : 'text-slate-900'}`}>{ua}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Hover Info Panel (Top Right Sidebar) */}
      <div className={`absolute bottom-6 right-6 w-80 transition-all duration-300 ${displayInfo || uaDetails ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 pointer-events-none"}`}>
        {(displayInfo || uaDetails) && (
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh] pointer-events-auto">
            
            {displayInfo ? (
              <>
                {/* Header for Floor Detail */}
                <div className={`p-4 border-b shrink-0 ${selectedInfo ? 'bg-[#bc955c]/10 border-[#bc955c]/30' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col pr-4">
                      {viewMode === "ua" && displayInfo.dominantUa ? (
                        <>
                          <span className="text-xs text-slate-800 font-bold uppercase tracking-wider mb-1">{displayInfo.pisoLabel}</span>
                          <h3 className={`font-bold text-base leading-snug ${selectedInfo ? 'text-[#bc955c]' : 'text-slate-700'}`}>
                            {displayInfo.dominantUa}
                          </h3>
                        </>
                      ) : (
                        <h3 className={`font-black text-xl leading-none ${selectedInfo ? 'text-[#621f32]' : 'text-[#621f32]'}`}>
                          {displayInfo.pisoLabel}
                        </h3>
                      )}
                    </div>
                    {selectedInfo && (
                      <button 
                        onClick={() => setSelectedInfo(null)}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-800 hover:text-[#621f32]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-800 text-xs font-bold uppercase tracking-wider">Total Activos en Piso</span>
                    <span className="font-black text-3xl text-[#621f32]">{displayInfo.count}</span>
                  </div>
                </div>
                
                {/* Scrollable UAs list for Floor */}
                <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2 custom-scrollbar">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Unidades Administrativas</h4>
                  {displayInfo.uas && displayInfo.uas.length > 0 ? (
                    displayInfo.uas.map((ua, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/60 transition-colors">
                        <span className="text-slate-900 text-sm font-medium leading-snug flex-1">{ua.nombre}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[#621f32] bg-[#bc955c]/10 px-2 py-0.5 rounded text-sm">{ua.count}</span>
                          <button
                            onClick={() => {
                              setLoadingEmpleados(true);
                              setEmpleadosModalTitle(`Empleados de ${ua.nombre} en ${displayInfo.pisoLabel}`);
                              VacantesService.getTorreCaballitoEmpleados(displayInfo.pisoLabel, ua.nombre)
                                .then(res => res.json())
                                .then(data => setEmpleadosData(data))
                                .catch(err => console.error(err))
                                .finally(() => setLoadingEmpleados(false));
                            }}
                            className="p-1.5 bg-slate-200 hover:bg-[#621f32] hover:text-white rounded text-slate-800 transition-colors"
                            title="Ver empleados"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-800 text-sm italic">Piso vacío o no asignado</div>
                  )}
                </div>
              </>
            ) : uaDetails ? (
              <>
                {/* Header for UA Detail */}
                <div className={`p-4 border-b shrink-0 ${selectedUaRemote ? 'bg-[#bc955c]/10 border-[#bc955c]/30' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col pr-4">
                      <span className="text-xs text-slate-800 font-bold uppercase tracking-wider mb-1">Unidad Administrativa</span>
                      <h3 className={`font-bold text-base leading-snug ${selectedUaRemote ? 'text-[#bc955c]' : 'text-slate-700'}`}>
                        {uaDetails.nombre}
                      </h3>
                    </div>
                    {selectedUaRemote && (
                      <button 
                        onClick={() => setSelectedUaRemote(null)}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-800 hover:text-[#621f32]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-800 text-xs font-bold uppercase tracking-wider">Total Empleados Global</span>
                    <span className="font-black text-3xl text-[#621f32]">{uaDetails.total}</span>
                  </div>
                </div>
                
                {/* Scrollable Pisos list for UA */}
                <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2 custom-scrollbar">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Distribución por Pisos</h4>
                  {uaDetails.pisos.map((piso, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/60 transition-colors">
                      <span className="text-slate-900 text-sm font-medium leading-snug flex-1">{piso.piso}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-[#bc955c] bg-[#bc955c]/10 px-2 py-0.5 rounded text-sm">{piso.count}</span>
                        <button
                          onClick={() => {
                            setLoadingEmpleados(true);
                            setEmpleadosModalTitle(`Empleados de ${uaDetails.nombre} en ${piso.piso}`);
                            VacantesService.getTorreCaballitoEmpleados(piso.piso, uaDetails.nombre)
                              .then(res => res.json())
                              .then(data => setEmpleadosData(data))
                              .catch(err => console.error(err))
                              .finally(() => setLoadingEmpleados(false));
                          }}
                          className="p-1.5 bg-slate-200 hover:bg-[#621f32] hover:text-white rounded text-slate-800 transition-colors"
                          title="Ver empleados"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

          </div>
        )}
      </div>
      

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

      <div className="absolute bottom-6 left-6 pointer-events-none bg-white/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200">
        <p className="text-slate-800 text-xs font-semibold">Haz scroll para acercar/alejar • Arrastra para rotar</p>
      </div>

      {/* Empleados Detail Modal */}
      {(empleadosData || loadingEmpleados) && (
        <EmpleadosTableModal 
          data={empleadosData} 
          loading={loadingEmpleados} 
          title={empleadosModalTitle} 
          onClose={() => {
            setEmpleadosData(null);
            setLoadingEmpleados(false);
          }} 
        />
      )}
    </div>
  );
}
