import json

log_file = "/home/edgar/.gemini/antigravity-cli/brain/22c2d371-5a7e-404c-9c71-e039e52c00a1/.system_generated/logs/transcript_full.jsonl"

found = False
with open(log_file, "r") as f:
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" in data:
                for call in data["tool_calls"]:
                    name = call.get("function", {}).get("name", "")
                    if "replace_file_content" in name:
                        args_str = call.get("function", {}).get("arguments", "{}")
                        try:
                            args = json.loads(args_str)
                            if "MovimientosPersonalTab.jsx" in args.get("TargetFile", ""):
                                for chunk in args.get("ReplacementChunks", []):
                                    if "pieSlices" in chunk.get("TargetContent", ""):
                                        with open("recovered_stats.txt", "w") as out:
                                            out.write(chunk.get("TargetContent", ""))
                                        found = True
                        except Exception as e:
                            pass
        except:
            pass

if found:
    print("Found it!")
else:
    print("Still not found.")
