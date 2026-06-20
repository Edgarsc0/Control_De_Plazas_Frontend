import re

with open("found_pie.txt", "r") as f:
    lines = f.readlines()

in_diff = False
recovered_lines = []

for line in lines:
    if line.startswith("[diff_block_start]"):
        in_diff = True
        continue
    if line.startswith("[diff_block_end]"):
        in_diff = False
        continue
        
    if in_diff:
        if line.startswith("-"):
            # This line was removed, we want to restore it!
            # Let's remove the leading "-" and keep the rest.
            content = line[1:]
            # Only start adding if we hit something meaningful
            recovered_lines.append(content)

with open("recovered_pie.jsx", "w") as out:
    for line in recovered_lines:
        out.write(line)
