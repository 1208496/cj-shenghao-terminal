"""把四宫格原图拆成单格，并生成「裁切框预览图」便于肉眼核对。

用法：
  python tools/avatars/split-grids.py --src C:\\path\\to\\grids
输出：
  .work/avatars-src/cells/<组名>/<原文件名>-<序号>.png   单格原尺寸
  .work/avatars-src/preview-<组名>.png                   带裁切框的九/十六宫格预览
  .work/avatars-src/source-map.json                      组 → 源文件 → 单格 清单
"""
import argparse
import json
import os
import re
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = os.path.join(ROOT, ".work", "avatars-src")

# 人像取景：单格里头顶大约留 8% 空白，取偏上的正方形，保证 44px 小头像里脸部够大。
CROP_SIDE = 0.74   # 正方形边长 = 单格边长 × 该比例
CROP_X = 0.50      # 裁切框水平中心（相对单格宽度）
CROP_Y = 0.02      # 裁切框顶部（相对单格高度）


def group_of(name):
    stem = os.path.splitext(name)[0]
    m = re.match(r"^(.*?)(\d*)$", stem)
    return (m.group(1) or stem).strip() or stem


def crop_box(cw, ch):
    side = int(min(cw, ch) * CROP_SIDE)
    left = int(cw * CROP_X - side / 2)
    left = max(0, min(left, cw - side))
    top = max(0, min(int(ch * CROP_Y), ch - side))
    return (left, top, left + side, top + side)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--grid", default="2x2")
    ap.add_argument("--side", type=float, default=CROP_SIDE)
    ap.add_argument("--top", type=float, default=CROP_Y)
    args = ap.parse_args()
    globals()["CROP_SIDE"], globals()["CROP_Y"] = args.side, args.top
    rows, cols = (int(x) for x in args.grid.lower().split("x"))

    os.makedirs(WORK, exist_ok=True)
    files = sorted(os.listdir(args.src))
    files = [f for f in files if os.path.splitext(f)[1].lower() in (".jfif", ".jpg", ".jpeg", ".png", ".webp")]
    groups = {}
    for name in files:
        groups.setdefault(group_of(name), []).append(name)

    source_map = {}
    for group, names in groups.items():
        cell_dir = os.path.join(WORK, "cells", group)
        os.makedirs(cell_dir, exist_ok=True)
        tiles = []
        for name in names:
            img = Image.open(os.path.join(args.src, name)).convert("RGB")
            w, h = img.size
            cw, ch = w // cols, h // rows
            for r in range(rows):
                for c in range(cols):
                    box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
                    cell = img.crop(box)
                    idx = r * cols + c + 1
                    out = os.path.join(cell_dir, f"{os.path.splitext(name)[0]}-{idx}.png")
                    cell.save(out, "PNG")
                    tiles.append((f"{os.path.splitext(name)[0]}#{idx}", cell))
            source_map.setdefault(group, []).append({
                "file": name, "size": [w, h], "cell": [cw, ch],
                "crop": list(crop_box(cw, ch)),
            })

        # 预览：单格缩到 300，画裁切框
        thumb = 300
        per_row = 4
        n = len(tiles)
        rows_n = (n + per_row - 1) // per_row
        sheet = Image.new("RGB", (per_row * thumb, rows_n * (thumb + 22)), (24, 24, 26))
        d = ImageDraw.Draw(sheet)
        for i, (label, cell) in enumerate(tiles):
            small = cell.resize((thumb, thumb), Image.LANCZOS)
            box = crop_box(cell.width, cell.height)
            k = thumb / cell.width
            rect = [v * k for v in box]
            dd = ImageDraw.Draw(small)
            dd.rectangle(rect, outline=(255, 60, 60), width=2)
            x = (i % per_row) * thumb
            y = (i // per_row) * (thumb + 22)
            sheet.paste(small, (x, y))
            d.text((x + 4, y + thumb + 5), label, fill=(230, 230, 230))
        sheet_path = os.path.join(WORK, f"preview-{group}-s{CROP_SIDE:.2f}.png")
        sheet.save(sheet_path, "PNG")
        print(f"PREVIEW {group}: {n} tiles -> {sheet_path}")

    with open(os.path.join(WORK, "source-map.json"), "w", encoding="utf-8") as fh:
        json.dump(source_map, fh, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in groups.values())
    print(f"SPLIT_OK groups={len(groups)} files={total} tiles={sum(len(v)*rows*cols for v in groups.values())}")


if __name__ == "__main__":
    main()
