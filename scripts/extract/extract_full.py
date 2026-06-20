import json

log_file = "/home/edgar/.gemini/antigravity-cli/brain/22c2d371-5a7e-404c-9c71-e039e52c00a1/.system_generated/logs/transcript_full.jsonl"

found_chunks = []

with open(log_file, "r") as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get("content", "")
            if "MovimientosPersonalTab.jsx" in content and "pieSlices.map" in content:
                found_chunks.append(content)
            elif "MovimientosPersonalTab.jsx" in content and "pieSlices.map" not in content and "pieSlices" in content:
                # also might be rendered differently
                if "<svg" in content or "pie" in content:
                    found_chunks.append(content)
        except:
            pass

with open("found_pie.txt", "w") as out:
    for c in found_chunks:
        out.write(c)
        out.write("\n" + "="*80 + "\n")
