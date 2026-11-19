"""生成测试用头像（192x192 WebP，占位色块 + 编号），并按方案的分档目录落盘。

用法：
  python tools/avatars/make-test-avatars.py
输出：
  assets/avatars/<tier>/<tier>-000N.webp
  .work/avatar-test/manifest.json   （含 base64，供内联清单使用）
"""
import base64
import hashlib
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets", "avatars")
MANIFEST_OUT = os.path.join(ROOT, ".work", "avatar-test", "manifest.json")

# 方案 1.3 的分档
TIERS = [
    ("b1", 1, 19, 2),
    ("b2", 20, 49, 3),
    ("b3", 50, 69, 4),
    ("b4", 70, 89, 4),
    ("b5", 90, 100, 3),
]
PALETTE = {
    "b1": (108, 116, 128),
    "b2": (120, 132, 108),
    "b3": (104, 128, 140),
    "b4": (136, 116, 108),
    "b5": (150, 120, 96),
}

def font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()

def main():
    os.makedirs(MANIFEST_OUT and os.path.dirname(MANIFEST_OUT), exist_ok=True)
    items = []
    for tier, tier_min, tier_max, count in TIERS:
        tier_dir = os.path.join(OUT_DIR, tier)
        os.makedirs(tier_dir, exist_ok=True)
        base = PALETTE[tier]
        for i in range(1, count + 1):
            img = Image.new("RGB", (192, 192))
            d = ImageDraw.Draw(img)
            # 简单渐变底，便于肉眼区分不同图
            for y in range(192):
                k = y / 191
                d.line([(0, y), (191, y)], fill=(
                    int(base[0] * (0.65 + 0.45 * k)),
                    int(base[1] * (0.65 + 0.45 * k)),
                    int(base[2] * (0.65 + 0.45 * k)),
                ))
            label = f"{tier}-{i:04d}"
            f = font(30)
            tw = d.textlength(label, font=f)
            d.text(((192 - tw) / 2, 120), label, fill=(250, 250, 250), font=f)
            f2 = font(22)
            sub = f"{tier_min}-{tier_max}"
            tw2 = d.textlength(sub, font=f2)
            d.text(((192 - tw2) / 2, 56), sub, fill=(240, 240, 240), font=f2)
            name = f"{tier}-{i:04d}.webp"
            path = os.path.join(tier_dir, name)
            img.save(path, "WEBP", quality=80, method=6)
            raw = open(path, "rb").read()
            items.append({
                "id": f"{tier}-{i:04d}",
                "tier": tier,
                "file": f"{tier}/{name}",
                "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "retired": False,
                "data": "data:image/webp;base64," + base64.b64encode(raw).decode("ascii"),
            })
    manifest = {
        "schema": 1,
        "version": "2026.11.18-test",
        "assetRef": "TEST",
        "basePath": "assets/avatars",
        "tiers": [{"id": t, "min": lo, "max": hi} for t, lo, hi, _ in TIERS],
        "items": items,
    }
    with open(MANIFEST_OUT, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    total = sum(x["bytes"] for x in items)
    print(f"AVATARS_OK {len(items)} files, {total} bytes, avg {total // len(items)} B")
    for t, lo, hi, n in TIERS:
        print(f"  {t} ({lo}-{hi}): {n}")

if __name__ == "__main__":
    main()
