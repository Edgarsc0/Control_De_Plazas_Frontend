// Catálogo UN: clave normalizada a 5 dígitos con ceros a la izquierda
export const UN_CATALOG = {
  "00001": "Agencia Nacional de Aduanas de México",
  "00002": "Órgano Interno de Control",
  "00003": "Dirección General de Evaluación",
  "00004": "Dirección General de Procesamiento Electrónico de Datos Aduaneros",
  "00100": "Dirección General de Operación Aduanera",
  "00200": "Dirección General de Investigación Aduanera",
  "00300": "Dirección General de Atención Aduanera y Asuntos Internacionales",
  "00400": "Dirección General de Modernización, Equipamiento e Infraestructura Aduanera",
  "00500": "Dirección General Jurídica de Aduanas",
  "00600": "Dirección General de Recaudación",
  "00700": "Dirección General de Tecnologías de la Información",
  "00800": "Dirección General de Planeación Aduanera",
  "00900": "Unidad de Administración y Finanzas",
};

// Catálogo UA: clave normalizada a 3 dígitos con ceros a la izquierda
export const UA_CATALOG = {
  "001": "Agencia Nacional de Aduanas de México",
  "002": "Órgano Interno de Control",
  "003": "Dirección General de Evaluación",
  "004": "Dirección General de Procesamiento Electrónico de Datos Aduaneros",
  "100": "Dirección General de Operación Aduanera",
  "101": "Aduana de Agua Prieta (Sonora)",
  "102": "Aduana de Ciudad Acuña (Coahuila)",
  "103": "Aduana de Ciudad Camargo (Tamaulipas)",
  "104": "Aduana de Ciudad Hidalgo (Chiapas)",
  "105": "Aduana de Ciudad Juárez (Chihuahua)",
  "106": "Aduana de Ciudad Miguel Alemán (Tamaulipas)",
  "107": "Aduana de Ciudad Reynosa (Tamaulipas)",
  "108": "Aduana de Colombia (Nuevo León)",
  "109": "Aduana de Matamoros (Tamaulipas)",
  "110": "Aduana de Mexicali (Baja California)",
  "111": "Aduana de Naco (Sonora)",
  "112": "Aduana de Nogales (Sonora)",
  "113": "Aduana de Nuevo Laredo (Tamaulipas)",
  "114": "Aduana de Ojinaga (Chihuahua)",
  "115": "Aduana de Piedras Negras (Coahuila)",
  "116": "Aduana de Puerto Palomas (Chihuahua)",
  "117": "Aduana de San Luis Río Colorado (Sonora)",
  "118": "Aduana de Sonoyta (Sonora)",
  "119": "Aduana de Tecate (Baja California)",
  "120": "Aduana de Tijuana (Baja California)",
  "121": "Aduana de Subteniente López (Quintana Roo)",
  "122": "Aduana de Acapulco (Guerrero)",
  "123": "Aduana de Altamira (Tamaulipas)",
  "124": "Aduana de Cancún (Quintana Roo)",
  "125": "Aduana de Ciudad del Carmen (Campeche)",
  "126": "Aduana de Coatzacoalcos (Veracruz)",
  "127": "Aduana de Dos Bocas (Tabasco)",
  "128": "Aduana de Ensenada (Baja California)",
  "129": "Aduana de Guaymas (Sonora)",
  "130": "Aduana de La Paz (Baja California Sur)",
  "131": "Aduana de Lázaro Cárdenas (Michoacán)",
  "132": "Aduana de Manzanillo (Colima)",
  "133": "Aduana de Mazatlán (Sinaloa)",
  "134": "Aduana de Progreso (Yucatán)",
  "135": "Aduana de Salina Cruz (Oaxaca)",
  "136": "Aduana de Tampico (Tamaulipas)",
  "137": "Aduana de Tuxpan (Veracruz)",
  "138": "Aduana de Veracruz (Veracruz)",
  "139": "Aduana AICM (Ciudad de México)",
  "140": "Aduana Aeropuerto Felipe Ángeles (Estado de México)",
  "141": "Aduana de Aguascalientes (Aguascalientes)",
  "142": "Aduana de Chihuahua (Chihuahua)",
  "143": "Aduana de Guadalajara (Jalisco)",
  "144": "Aduana de Guanajuato (Guanajuato)",
  "145": "Aduana de Monterrey (Nuevo León)",
  "146": "Aduana de Puebla (Puebla)",
  "147": "Aduana de Querétaro (Querétaro)",
  "148": "Aduana de Toluca (Estado de México)",
  "149": "Aduana de Torreón (Coahuila)",
  "150": "Aduana de México (Ciudad de México)",
  "200": "Dirección General de Investigación Aduanera",
  "300": "Dirección General de Atención Aduanera y Asuntos Internacionales",
  "400": "Dirección General de Modernización, Equipamiento e Infraestructura Aduanera",
  "500": "Dirección General Jurídica de Aduanas",
  "600": "Dirección General de Recaudación",
  "700": "Dirección General de Tecnologías de la Información",
  "800": "Dirección General de Planeación Aduanera",
  "900": "Unidad de Administración y Finanzas",
  "909": "Dirección Operativa de Administración y Finanzas (CDMX)",
  "922": "Dirección Operativa de Administración y Finanzas (Chichimequillas, Qro.)",
};

// Normaliza código UN (→ 5 dígitos) y devuelve "CODE (NOMBRE)" o "CODE" si no existe
export const labelUN = (code) => {
  if (!code && code !== 0) return "—";
  const raw = String(code).trim();
  const padded = raw.replace(/\D/g, "").padStart(5, "0");
  const name = UN_CATALOG[padded];
  return name ? `${raw} (${name})` : raw;
};

// Normaliza código UA (→ 3 dígitos) y devuelve "CODE (NOMBRE)" o "CODE" si no existe
export const labelUA = (code) => {
  if (!code && code !== 0) return "—";
  const raw = String(code).trim();
  const padded = raw.replace(/\D/g, "").padStart(3, "0");
  const name = UA_CATALOG[padded];
  return name ? `${raw} (${name})` : raw;
};
