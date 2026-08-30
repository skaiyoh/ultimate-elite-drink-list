"""Method B sprites scaled to real-world bottle proportions.

Every sprite previously filled the full canvas height, so a 148ml Peychaud's
rendered as tall as a 750ml rum. Here each bottle's pixel height comes from the
real height of its format, against a fixed 330mm -> 64px reference. The
reference is fixed rather than max-of-set so adding bottles later doesn't
silently rescale the ones already placed.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rembg import new_session, remove

PROJECT = Path(__file__).resolve().parents[2]
SRC = PROJECT / "assets/ingredient-photos"
OUT = PROJECT / "assets/ingredient-sprites"
CANVAS = (32, 64)


def fnt(sz, bold=False):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial"
                                  + (" Bold" if bold else "") + ".ttf", sz)
    except Exception:
        return ImageFont.load_default()


def main():
    here = Path(__file__).resolve().parent
    pick_file = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "picks-final.json"
    size_file = Path(sys.argv[2]) if len(sys.argv) > 2 else here / "bottle-sizes.json"
    picks = json.loads(pick_file.read_text())["front_facing"]
    ref = json.loads(size_file.read_text())
    sizes, ref_mm, ref_px = ref["sizes"], ref["_reference_mm"], ref["_reference_px"]
    session = new_session("u2net")
    manifest, previews = {}, []

    for slug, idx in sorted(picks.items()):
        meta = sizes.get(slug)
        if meta is None:
            print(f"  {slug:22} NO SIZE DATA -- skipped")
            continue
        im = Image.open(SRC / slug / f"{slug}-{idx}.png").convert("RGB")
        im.thumbnail((1200, 1200), Image.LANCZOS)
        cut = remove(im, session=session)
        a = np.array(cut)[:, :, 3]
        ys, xs = np.where(a > 8)
        cut = cut.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

        entry = {"source": f"{slug}-{idx}.png", "ml": meta["ml"],
                 "height_mm": meta["height_mm"], "sizes": {}}
        for canvas in CANVAS:
            h = max(1, round(canvas * meta["height_mm"] / ref_mm))
            w = max(1, round(cut.width * h / cut.height))
            d = OUT / "front-facing" / f"{canvas}px"
            d.mkdir(parents=True, exist_ok=True)
            cut.resize((w, h), Image.LANCZOS).save(d / f"{slug}.png")
            entry["sizes"][f"{canvas}px"] = {"w": w, "h": h, "canvas": canvas}
        manifest[slug] = entry
        previews.append((slug, cut, entry["sizes"]["64px"]))
        print(f"  {slug:22} {meta['ml']:>4}ml {meta['height_mm']:>4}mm  "
              f"64px:{entry['sizes']['64px']['w']}x{entry['sizes']['64px']['h']}"
              f"  32px:{entry['sizes']['32px']['w']}x{entry['sizes']['32px']['h']}")

    (OUT / "manifest.json").write_text(json.dumps(
        {"reference_mm": ref_mm, "reference_px": ref_px, "sprites": manifest}, indent=2))
    baseline(previews, OUT / "_scale-preview.png", ref_px)
    print(f"\n  manifest -> {OUT/'manifest.json'}")


def baseline(previews, dest, ref_px):
    """Bottom-aligned on one shelf line -- the only way to see if scale reads right."""
    Z, PAD = 4, 10
    previews.sort(key=lambda p: -p[2]["h"])
    W = PAD + sum(p[2]["w"] * Z + PAD for p in previews)
    H = ref_px * Z + 60
    im = Image.new("RGB", (W, H), (26, 24, 30))
    d = ImageDraw.Draw(im)
    base = H - 40
    d.line([(0, base), (W, base)], fill=(120, 100, 70), width=3)
    x = PAD
    for slug, cut, s in previews:
        spr = cut.resize((s["w"] * Z, s["h"] * Z), Image.NEAREST)
        im.paste(spr, (x, base - spr.height), spr)
        d.text((x, base + 6), slug[:14], font=fnt(10), fill=(140, 230, 255))
        d.text((x, base + 19), f"{s['w']}x{s['h']}", font=fnt(10), fill=(150, 150, 160))
        x += s["w"] * Z + PAD
    d.text((PAD, 8), "SCALED TO REAL BOTTLE HEIGHT  (64px set, shown 4x, common baseline)",
           font=fnt(14, True), fill=(255, 210, 90))
    im.save(dest)
    print(f"  preview  -> {dest}")


if __name__ == "__main__":
    main()
