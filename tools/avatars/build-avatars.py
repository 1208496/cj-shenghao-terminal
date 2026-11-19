"""四宫格原图 → 192px WebP 头像 → 清单 manifest.json（方案二图库仓用）。

用法：
  python tools/avatars/build-avatars.py --src C:\\path\\to\\grids --map B
  python tools/avatars/build-avatars.py --src ... --map A --dry-run

分档映射（--map）：
  B（推荐，与 YG 出图分组一一对应）：b1 1-49 / b2 50-69 / b3 70-79 / b4 80-89 / b5 90-100
  A（沿用 rc.31 现有区间）        ：b1 1-19 / b2 20-49 / b3 50-69 / b4 70-89 / b5 90-100
                                    其中 70分 与 80分 两组都进 b4，50以下 拆给 b1/b2

输出：
  assets/avatars/<tier>/<tier>-NNNN.webp    成品（进图库仓）
  assets/avatars/manifest.json              清单
  .work/avatars-out/sheet-<tier>.png        实际尺寸预览（44/96/192 三档）
"""
import argparse
import hashlib
import json
import os
import re
import shutil
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "avatars")
WORK = os.path.join(ROOT, ".work", "avatars-out")

SIZE = 192
QUALITY = 80
HARD_LIMIT = 20 * 1024

CROP_SIDE = 1.0    # 1.0 = 整格直接用（YG 2026-11-19 指定：按宫格截取，不做头部特写）
CROP_X = 0.50      # 水平中心
CROP_Y = 0.00      # 顶部留白

# 个别分组可以单独收紧到头部（YG 点名的组）：{源分组名: (边长比例, 顶部留白)}
CROP_OVERRIDE = {
    "90分": (0.70, 0.01),
}

MAPS = {
    "B": {
        "tiers": [
            ("b1", 1, 49),
            ("b2", 50, 69),
            ("b3", 70, 79),
            ("b4", 80, 89),
            ("b5", 90, 100),
        ],
        "groups": {"50以下": ["b1"], "60分": ["b2"], "70分": ["b3"], "80分": ["b4"], "90分": ["b5"]},
    },
    "A": {
        "tiers": [
            ("b1", 1, 19),
            ("b2", 20, 49),
            ("b3", 50, 69),
            ("b4", 70, 89),
            ("b5", 90, 100),
        ],
        "groups": {"50以下": ["b1", "b2"], "60分": ["b3"], "70分": ["b4"], "80分": ["b4"], "90分": ["b5"]},
    },
}


def group_of(name):
    stem = os.path.splitext(name)[0]
    m = re.match(r"^(.*?)(\d*)$", stem)
    return (m.group(1) or stem).strip() or stem


def crop_box(cw, ch, side_ratio=CROP_SIDE, top_ratio=CROP_Y):
    side = int(min(cw, ch) * side_ratio)
    left = max(0, min(int(cw * CROP_X - side / 2), cw - side))
    top = max(0, min(int(ch * top_ratio), ch - side))
    return (left, top, left + side, top + side)


def split_cells(path, rows, cols):
    img = Image.open(path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    cw, ch = w // cols, h // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            cells.append(img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    return cells


def encode(cell, side_ratio=CROP_SIDE, top_ratio=CROP_Y):
    box = crop_box(cell.width, cell.height, side_ratio, top_ratio)
    face = cell.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    import io
    for q in (QUALITY, 72):
        buf = io.BytesIO()
        face.save(buf, "WEBP", quality=q, method=6)
        raw = buf.getvalue()
        if len(raw) <= HARD_LIMIT or q == 72:
            return face, raw, q
    return face, raw, 72


def sheet(tier, faces):
    """按实际展示尺寸拼预览：44 / 96 / 192 三行，每行最多 8 张，超出的另起一块。"""
    pad, label_w = 8, 70
    cell = SIZE + pad
    chunks = [faces[i:i + 8] for i in range(0, len(faces), 8)] or [[]]
    per_row = max((len(c) for c in chunks), default=1) or 1
    width = label_w + per_row * cell
    block_h = (SIZE + pad) * 3 + 10
    sh = Image.new("RGB", (width, block_h * len(chunks)), (26, 26, 28))
    d = ImageDraw.Draw(sh)
    for bi, chunk in enumerate(chunks):
        base_y = bi * block_h
        for row, scale in enumerate((44, 96, SIZE)):
            y = base_y + row * (SIZE + pad) + pad
            d.text((6, y + SIZE // 2), f"{scale}px", fill=(220, 220, 220))
            for i, (name, face) in enumerate(chunk):
                thumb = face.resize((scale, scale), Image.LANCZOS)
                sh.paste(thumb, (label_w + i * cell, y))
    path = os.path.join(WORK, f"sheet-{tier}.png")
    sh.save(path, "PNG")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--map", default="B", choices=sorted(MAPS))
    ap.add_argument("--grid", default="2x2")
    ap.add_argument("--version", default="2026.11.19-1")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    rows, cols = (int(x) for x in args.grid.lower().split("x"))
    plan = MAPS[args.map]

    os.makedirs(WORK, exist_ok=True)
    files = sorted(
        f for f in os.listdir(args.src)
        if os.path.splitext(f)[1].lower() in (".jfif", ".jpg", ".jpeg", ".png", ".webp")
    )
    groups = {}
    for name in files:
        groups.setdefault(group_of(name), []).append(name)

    missing = [g for g in groups if g not in plan["groups"]]
    if missing:
        raise SystemExit(f"未在映射里的分组：{missing}")

    staged = []  # (tier, face, raw, q, source)
    for group, names in groups.items():
        tiers = plan["groups"][group]
        cells = []
        for name in names:
            for idx, cell in enumerate(split_cells(os.path.join(args.src, name), rows, cols), 1):
                cells.append((f"{os.path.splitext(name)[0]}#{idx}", cell))
        for i, (label, cell) in enumerate(cells):
            tier = tiers[i * len(tiers) // len(cells)] if len(tiers) > 1 else tiers[0]
            side_ratio, top_ratio = CROP_OVERRIDE.get(group, (CROP_SIDE, CROP_Y))
            face, raw, q = encode(cell, side_ratio, top_ratio)
            staged.append((tier, face, raw, q, label))

    # 落盘：每档从 0001 重新编号（本期是整批替换测试图，旧号作废）
    counters = {}
    items = []
    for tier, face, raw, q, label in staged:
        counters[tier] = counters.get(tier, 0) + 1
        name = f"{tier}-{counters[tier]:04d}.webp"
        items.append({
            "id": f"{tier}-{counters[tier]:04d}",
            "tier": tier,
            "file": f"{tier}/{name}",
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "retired": False,
            "_face": face,
            "_raw": raw,
            "_src": label,
            "_q": q,
        })

    if args.dry_run:
        for it in items:
            print(f"  {it['file']:>16}  {it['bytes']:>6} B  q{it['_q']}  <- {it['_src']}")
        print(f"DRY_RUN_OK {len(items)} items")
        return

    # 清掉旧测试图目录，整批重出
    for tier, _, _ in plan["tiers"]:
        d = os.path.join(OUT, tier)
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
    for it in items:
        with open(os.path.join(OUT, it["file"].replace("/", os.sep)), "wb") as fh:
            fh.write(it["_raw"])

    by_tier = {}
    for it in items:
        by_tier.setdefault(it["tier"], []).append((it["id"], it["_face"]))
    for tier, faces in by_tier.items():
        print("SHEET", sheet(tier, faces))

    manifest = {
        "schema": 1,
        "version": args.version,
        "assetRef": "PENDING",
        "basePath": "assets/avatars",
        "tiers": [{"id": t, "min": lo, "max": hi} for t, lo, hi in plan["tiers"]],
        "items": [{k: v for k, v in it.items() if not k.startswith("_")} for it in items],
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)

    total = sum(it["bytes"] for it in items)
    print(f"BUILD_OK map={args.map} items={len(items)} bytes={total} avg={total // len(items)}")
    for tier, lo, hi in plan["tiers"]:
        n = sum(1 for it in items if it["tier"] == tier)
        print(f"  {tier} ({lo}-{hi}): {n} 张")


if __name__ == "__main__":
    main()
