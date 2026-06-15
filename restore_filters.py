import os

# 1. Read PlantillaDetalleTab.jsx lines 859 to 972 (0-indexed: 858 to 972)
with open("src/components/PlantillaDetalleTab.jsx", "r") as f:
    plantilla_lines = f.readlines()
    
# 858 is line 859, 972 is line 973, we want lines 859 up to 972 inclusive:
# So [858:972]
filter_row = plantilla_lines[858:972]

# 2. Read MovimientosPersonalTab.jsx
with open("src/components/MovimientosPersonalTab.jsx", "r") as f:
    movimientos_lines = f.readlines()

# 3. Find the target line
insert_idx = -1
for i, line in enumerate(movimientos_lines):
    if "{/* TR Filter Headers go here ... (Wait, text filters are disabled for simplicity, but let's add them back) */}" in line:
        insert_idx = i
        break

if insert_idx == -1:
    print("Could not find the insertion point.")
else:
    # We replace that line with the filter_row
    new_lines = movimientos_lines[:insert_idx] + filter_row + movimientos_lines[insert_idx+1:]
    
    with open("src/components/MovimientosPersonalTab.jsx", "w") as f:
        f.writelines(new_lines)
    print("Filter row restored successfully!")
