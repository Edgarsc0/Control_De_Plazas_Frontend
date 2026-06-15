import re

with open("src/components/PlantillaDetalleTab.jsx", "r") as f:
    text = f.read()

table_start = text.find("className=\"overflow-auto relative flex-1 mx-2")
if table_start != -1:
    table_start = text.rfind("<div ", 0, table_start)
    
table_end = text.find("</table>", table_start)

if table_start != -1 and table_end != -1:
    with open("table_template.txt", "w") as out:
        out.write(text[table_start:table_end+8] + "\n</div>")
        print("Template created!")
else:
    print("Not found")
