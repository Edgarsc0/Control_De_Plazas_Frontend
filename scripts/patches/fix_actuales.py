import re
import os

files_to_fix = [
    ("PlantillaDetalleTab.jsx", "detalle"),
    ("MovimientosTab.jsx", "movPosData"),
    ("BajasTab.jsx", "bajasData")
]

base_path = "/home/edgar/ANAM/EjeCentral/eje_central_front/src/components/"

for filename, data_var in files_to_fix:
    filepath = os.path.join(base_path, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # The block we want to replace looks like:
    #                      if (filterDropdownTab === 'actuales') {
    #                        const counts = {};
    #                        filteredSortedData.forEach(row => {
    #                          const val = activeFilterDropdown === "estado_nomina" ? mapEstadoNomina(row[activeFilterDropdown]) : String(row[activeFilterDropdown] || "").trim();
    #                          counts[val] = (counts[val] || 0) + 1;
    #                        });
    #                        baseUniqueValues = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a,b) => b.count - a.count);
    #                      }

    # We need to construct the new block.
    # We will use regex to find the block and replace it.
    
    # We will build a replacement string that uses data_var instead of filteredSortedData
    # and implements the filtering logic inline.
    
    # In PlantillaDetalleTab.jsx there is `mapEstadoNomina`. In the others, there might not be. 
    # Let's check if mapEstadoNomina is used in the current block in the file.
    
    # Regex to find the block
    pattern = r"if \(filterDropdownTab === 'actuales'\) \{\s*const counts = \{\};\s*filteredSortedData\.forEach\(row => \{\s*const val = (.*?);\s*counts\[val\] = \(counts\[val\] \|\| 0\) \+ 1;\s*\}\);\s*baseUniqueValues = Object\.entries\(counts\)\.map\(\(\[value, count\]\) => \(\{ value, count \}\)\)\.sort\(\(a,b\) => b\.count - a\.count\);\s*\}"

    match = re.search(pattern, content)
    if not match:
        print(f"Pattern not found in {filename}!")
        continue
        
    val_assignment = match.group(1) # e.g. `activeFilterDropdown === "estado_nomina" ? mapEstadoNomina(row[activeFilterDropdown]) : String(row[activeFilterDropdown] || "").trim()`
    
    # Let's extract the global search checking logic and text filters logic from the filteredSortedData useMemo
    # They are standard across these files. We'll generate equivalent JS.
    
    # JS Code to insert:
    new_block = f"""if (filterDropdownTab === 'actuales') {{
                        const counts = {{}};
                        {data_var}.forEach(row => {{
                          if (deferredGlobalSearch) {{
                            const searchText = deferredGlobalSearch.toLowerCase();
                            if (!Object.entries(row).some(([key, val]) => (key === "estado_nomina" && typeof mapEstadoNomina !== 'undefined' ? mapEstadoNomina(val) : String(val || "")).toLowerCase().includes(searchText))) return;
                          }}
                          for (const [colKey, selectedVals] of Object.entries(columnFilters)) {{
                            if (colKey === activeFilterDropdown) continue; // Ignore active column's selected checkboxes
                            if (!selectedVals.includes(colKey === "estado_nomina" && typeof mapEstadoNomina !== 'undefined' ? mapEstadoNomina(row[colKey]) : String(row[colKey] || "").trim())) return;
                          }}
                          for (const [colKey, filterObj] of Object.entries(deferredTextFilters)) {{
                            if (!filterObj || !filterObj.value || !filterObj.value.trim()) continue;
                            const searchText = filterObj.value;
                            const condition = filterObj.condition || ((typeof isMonoColumn !== 'undefined' && isMonoColumn(colKey)) ? "starts_with" : "contains");
                            const valStr = colKey === "estado_nomina" && typeof mapEstadoNomina !== 'undefined' ? mapEstadoNomina(row[colKey]) : String(row[colKey] || "");
                            const lowerVal = valStr.toLowerCase().trim();
                            const lowerSearch = searchText.toLowerCase().trim();
                            let pass = false;
                            switch (condition) {{
                              case "contains": pass = lowerVal.includes(lowerSearch); break;
                              case "not_contains": pass = !lowerVal.includes(lowerSearch); break;
                              case "starts_with": pass = lowerVal.startsWith(lowerSearch); break;
                              case "not_starts_with": pass = !lowerVal.startsWith(lowerSearch); break;
                              case "ends_with": pass = lowerVal.endsWith(lowerSearch); break;
                              case "not_ends_with": pass = !lowerVal.endsWith(lowerSearch); break;
                              case "equals": pass = lowerVal === lowerSearch; break;
                              case "not_equals": pass = lowerVal !== lowerSearch; break;
                              default: pass = lowerVal.includes(lowerSearch); break;
                            }}
                            if (!pass) return;
                          }}
                          const val = {val_assignment};
                          counts[val] = (counts[val] || 0) + 1;
                        }});
                        baseUniqueValues = Object.entries(counts).map(([value, count]) => ({{ value, count }})).sort((a,b) => b.count - a.count);
                      }}"""
                      
    new_content = content[:match.start()] + new_block + content[match.end():]
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print(f"Fixed {filename}")
