import os
import sys
import urllib.request

BASE = "https://cdn.jsdelivr.net/npm/three@0.147.0"
OUT = sys.argv[1]

files = {
    "three.min.js": f"{BASE}/build/three.min.js",
    "OrbitControls.js": f"{BASE}/examples/js/controls/OrbitControls.js",
    "GLTFLoader.js": f"{BASE}/examples/js/loaders/GLTFLoader.js",
    "CSS2DRenderer.js": f"{BASE}/examples/js/renderers/CSS2DRenderer.js",
    "RoomEnvironment.js": f"{BASE}/examples/js/environments/RoomEnvironment.js",
}

os.makedirs(OUT, exist_ok=True)
for name, url in files.items():
    dest = os.path.join(OUT, name)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        print("skip", name, os.path.getsize(dest))
        continue
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    print("saved", name, len(data))
