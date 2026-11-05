import json
import struct
import sys

path = sys.argv[1]
with open(path, "rb") as fh:
    data = fh.read()

magic, version, length = struct.unpack("<III", data[:12])
off = 12
chunks = []
while off < length:
    clen, ctype = struct.unpack("<II", data[off:off + 8])
    body = data[off + 8: off + 8 + clen]
    chunks.append((ctype, body))
    off += 8 + clen

gltf = json.loads(chunks[0][1].decode("utf-8"))

print("asset:", gltf.get("asset"))
print("scenes:", len(gltf.get("scenes", [])), "nodes:", len(gltf.get("nodes", [])),
      "meshes:", len(gltf.get("meshes", [])), "materials:", len(gltf.get("materials", [])))
print("extensionsUsed:", gltf.get("extensionsUsed"))

nodes = gltf["nodes"]
parent = {}
for i, n in enumerate(nodes):
    for c in n.get("children", []):
        parent[c] = i


def depth(i):
    d = 0
    while i in parent:
        i = parent[i]
        d += 1
    return d


for i, n in enumerate(nodes):
    mesh = n.get("mesh")
    tris = 0
    if mesh is not None:
        prim = gltf["meshes"][mesh]["primitives"][0]
        acc = gltf["accessors"][prim["indices"]] if "indices" in prim else None
        tris = (acc["count"] // 3) if acc else 0
    extras = n.get("extras")
    print(f"{i:3d} {'  ' * depth(i)}{n.get('name', '<unnamed>')}"
          f"{' [mesh ' + str(mesh) + ', ' + str(tris) + ' tris]' if mesh is not None else ''}"
          f"{' extras=' + json.dumps(extras, ensure_ascii=False) if extras else ''}"
          f"{' T=' + str(n['translation']) if 'translation' in n else ''}")

print("\nmaterials:")
for i, m in enumerate(gltf.get("materials", [])):
    pbr = m.get("pbrMetallicRoughness", {})
    print(f"  {i:2d} {m.get('name')} base={pbr.get('baseColorFactor')} metal={pbr.get('metallicFactor')} rough={pbr.get('roughnessFactor')}")
