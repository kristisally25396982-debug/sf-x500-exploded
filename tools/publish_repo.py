"""把 drone-exploded-view 发布到 GitHub（本机没有 git，改用 Git Database API）。

用法：python tools/publish_repo.py [--repo NAME]
"""
import base64
import json
import pathlib
import subprocess
import sys
import tempfile

OWNER = "kristisally25396982-debug"
REPO = "sf-x500-exploded"
ROOT = pathlib.Path(r"C:\Users\13042\Documents\drone-exploded-view")

SKIP_DIRS = {"shot", }
SKIP_NAMES = {"assembled.png", "exploded.png"}  # 预览图放仓库根，其余 shot*.png 不上传


def gh(args, body=None):
    cmd = ["gh", "api"] + args
    tmp = None
    try:
        if body is not None:
            fd, tmp = tempfile.mkstemp(suffix=".json")
            with open(fd, "w", encoding="utf-8") as f:
                json.dump(body, f)
            cmd += ["--input", tmp]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print("FAILED:", " ".join(cmd[:4]))
            print(res.stderr.strip()[:600])
            sys.exit(1)
        out = res.stdout.strip()
        return json.loads(out) if out else {}
    finally:
        if tmp:
            pathlib.Path(tmp).unlink(missing_ok=True)


def main():
    # 1. 仓库
    existing = subprocess.run(
        ["gh", "api", f"repos/{OWNER}/{REPO}", "--jq", ".full_name"],
        capture_output=True, text=True
    )
    if existing.returncode != 0:
        print("creating repo…")
        subprocess.run(
            ["gh", "repo", "create", f"{OWNER}/{REPO}", "--public",
             "--description",
             "SF-X500 quadcopter exploded-view lab — three.js, 17 interactive parts, no build step.",
             ],
            check=True
        )
    else:
        print("repo exists:", existing.stdout.strip())

    # 1b. 空仓库上 Git Data API 会 409，先用 Contents API 打一个初始提交
    probe = subprocess.run(["gh", "api", f"repos/{OWNER}/{REPO}/git/refs/heads/main"],
                           capture_output=True, text=True)
    if probe.returncode != 0:
        print("seeding initial commit…")
        gh([f"repos/{OWNER}/{REPO}/contents/.gitkeep", "-X", "PUT"],
           {"message": "chore: init", "content": base64.b64encode(b"").decode("ascii")})

    # 2. 收集文件
    files = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT).as_posix()
        if p.name.startswith("shot") or p.suffix == ".pyc":
            continue
        if rel.startswith("__pycache__"):
            continue
        files.append((rel, p))
    files.sort()

    # 3. 逐个建 blob
    tree = []
    for rel, path in files:
        data = path.read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        blob = gh([f"repos/{OWNER}/{REPO}/git/blobs", "-X", "POST"], {"content": b64, "encoding": "base64"})
        tree.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print(f"  blob {rel} ({len(data)} B)")

    # 4. tree + commit + ref
    new_tree = gh([f"repos/{OWNER}/{REPO}/git/trees", "-X", "POST"],
                  {"tree": tree})

    parent_probe = subprocess.run(
        ["gh", "api", f"repos/{OWNER}/{REPO}/git/refs/heads/main", "--jq", ".object.sha"],
        capture_output=True, text=True)
    parents = [parent_probe.stdout.strip()] if parent_probe.returncode == 0 and parent_probe.stdout.strip() else []

    commit = gh([f"repos/{OWNER}/{REPO}/git/commits", "-X", "POST"],
                {"message": "feat: SF-X500 exploded view lab\n\n17 interactive parts, slider-driven explode, BOM panel, part cards, labels/wireframe toggles. Runs by double-clicking index.html (model inlined as base64).",
                 "tree": new_tree["sha"],
                 "parents": parents})
    print("commit:", commit["sha"])

    if parents:
        gh([f"repos/{OWNER}/{REPO}/git/refs/heads/main", "-X", "PATCH"], {"sha": commit["sha"], "force": True})
        print("ref fast-forwarded")
    else:
        gh([f"repos/{OWNER}/{REPO}/git/refs", "-X", "POST"],
           {"ref": "refs/heads/main", "sha": commit["sha"]})
        print("ref created")

    # 5. GitHub Pages
    pages = subprocess.run(["gh", "api", f"repos/{OWNER}/{REPO}/pages"], capture_output=True, text=True)
    if pages.returncode != 0:
        try:
            gh([f"repos/{OWNER}/{REPO}/pages", "-X", "POST"], {"source": {"branch": "main", "path": "/"}})
            print("pages enabled")
        except SystemExit:
            print("pages: skipped (needs manual enable)")
    else:
        print("pages already enabled")

    print("done:", f"https://github.com/{OWNER}/{REPO}")


if __name__ == "__main__":
    main()
