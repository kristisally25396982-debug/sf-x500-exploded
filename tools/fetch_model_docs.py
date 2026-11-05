import base64, pathlib, subprocess, json

root = pathlib.Path(r"C:\Users\13042\Documents\drone-exploded-view")
dest = root / "models"
dest.mkdir(exist_ok=True)

for name in ("SOURCES.md", "LICENSE.txt"):
    raw = subprocess.run(
        ["gh", "api", f"repos/kristisally25396982-debug/skyforge-drone-lab/contents/models/{name}",
         "--jq", ".content"],
        capture_output=True, text=True, check=True
    ).stdout.strip()
    data = base64.b64decode(raw)
    (dest / name).write_bytes(data)
    print(name, len(data), "bytes")
