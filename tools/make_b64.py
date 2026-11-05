import base64, pathlib

root = pathlib.Path(r"C:\Users\13042\Documents\drone-exploded-view")
glb = (root / "assets" / "sf-x500.glb").read_bytes()
b64 = base64.b64encode(glb).decode("ascii")
out = root / "assets" / "model-b64.js"
header = (
    "/* 自动生成：assets/sf-x500.glb 的 base64 内联副本。\n"
    " * 目的：浏览器在 file:// 下不允许 fetch 本地文件，内联后双击 index.html 也能加载模型。\n"
    " * 重新生成：python tools/make_b64.py\n"
    " */\n"
)
with out.open("w", encoding="utf-8", newline="\n") as f:
    f.write(header)
    f.write("window.APP = window.APP || {};\nAPP.MODEL_B64 =\n'")
    # 每 20000 字符断行，避免出现超长单行
    for i in range(0, len(b64), 20000):
        chunk = b64[i:i + 20000]
        f.write(chunk)
        f.write("' +\n'" if i + 20000 < len(b64) else "';\n")
print("wrote", out, out.stat().st_size, "bytes; glb", len(glb), "b64", len(b64))
