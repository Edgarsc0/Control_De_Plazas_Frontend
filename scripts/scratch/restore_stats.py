import os

with open("recovered_pie.jsx", "r") as f:
    recovered_lines = f.readlines()

# 1-indexed lines 269 to 591 -> 0-indexed 268 to 591
stats_block = recovered_lines[268:591]

with open("src/components/MovimientosPersonalTab.jsx", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "{/* ... (Statistics content kept same) ... */}" in line:
        insert_idx = i
        break

new_lines = lines[:insert_idx] + stats_block + lines[insert_idx+1:]

with open("src/components/MovimientosPersonalTab.jsx", "w") as f:
    f.writelines(new_lines)

print("Stats restored successfully!")
