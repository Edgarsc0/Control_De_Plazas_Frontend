import json

log_file = "/home/edgar/.gemini/antigravity-cli/brain/22c2d371-5a7e-404c-9c71-e039e52c00a1/.system_generated/logs/transcript_full.jsonl"

with open(log_file, "r") as f:
    for line in f:
        data = json.loads(line)
        if "tool_calls" in data:
            for call in data["tool_calls"]:
                if call.get("function", {}).get("name") in ["default_api:multi_replace_file_content", "default_api:replace_file_content"]:
                    args_str = call.get("function", {}).get("arguments", "{}")
                    try:
                        args = json.loads(args_str)
                        if "MovimientosPersonalTab.jsx" in args.get("TargetFile", ""):
                            for chunk in args.get("ReplacementChunks", []):
                                if "Bitácora" in chunk.get("TargetContent", "") or "Bitácora" in chunk.get("ReplacementContent", ""):
                                    print("Found a chunk with Bitacora!")
                                    with open("recovered_chunk.txt", "w") as out:
                                        out.write(chunk.get("TargetContent", ""))
                    except Exception as e:
                        pass
