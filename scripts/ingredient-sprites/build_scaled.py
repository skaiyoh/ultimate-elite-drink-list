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

# Alpha below this in the rembg mask is treated as background before scaling.
# u2net feathers its edges, and that halo carries blended background colour.
SOURCE_ALPHA_CUT = 140
# Coverage a destination pixel needs to survive as opaque. 128 keeps the
# silhouette closest to the soft original; lower values fatten the sprite.
EDGE_ALPHA_CUT = 128


def hard_resize(rgba: Image.Image, w: int, h: int) -> Image.Image:
    """Downscale to a hard-edged sprite: every pixel fully opaque or fully clear.

    Resizing RGBA directly is wrong twice over. The filter averages each edge
    pixel's colour against its transparent neighbours -- whose RGB is usually
    black -- so edges come out both faded and darkened. And at 32px a bottle is
    ~9px wide, so nearly every pixel is an edge pixel.

    The fix is to premultiply by alpha before filtering, divide it back out
    after, then threshold coverage to 0 or 255. Dividing alpha back out is what
    restores full-saturation colour on the boundary instead of a wash toward
    black.
    """
    src = np.asarray(rgba, dtype=np.float32)
    rgb = src[:, :, :3]
    # Cut u2net's feathered halo first, so no background-tinted pixel is fed in.
    a = (src[:, :, 3] >= SOURCE_ALPHA_CUT).astype(np.float32)

    premul = Image.fromarray(np.clip(rgb * a[:, :, None], 0, 255).astype(np.uint8), "RGB")
    cover = Image.fromarray((a * 255).astype(np.uint8), "L")
    premul_s = np.asarray(premul.resize((w, h), Image.LANCZOS), dtype=np.float32)
    cover_s = np.asarray(cover.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0

    # Un-premultiply. Guard the divide: where coverage rounds to nothing the
    # colour is meaningless anyway and the pixel is about to be cut.
    safe = np.maximum(cover_s, 1e-4)[:, :, None]
    straight = np.clip(premul_s / safe, 0, 255)

    opaque = (cover_s * 255.0 >= EDGE_ALPHA_CUT)
    if not opaque.any():                     # a sprite this thin would vanish
        opaque = cover_s >= cover_s.max()
    out = np.dstack([straight.astype(np.uint8), (opaque * 255).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


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
        # Crop against the same cut the resize will use, or the box includes
        # feathered halo and the bottle ends up inset from its own edges.
        ys, xs = np.where(a >= SOURCE_ALPHA_CUT)
        cut = cut.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

        entry = {"source": f"{slug}-{idx}.png", "ml": meta["ml"],
                 "height_mm": meta["height_mm"], "sizes": {}}
        for canvas in CANVAS:
            h = max(1, round(canvas * meta["height_mm"] / ref_mm))
            w = max(1, round(cut.width * h / cut.height))
            d = OUT / "front-facing" / f"{canvas}px"
            d.mkdir(parents=True, exist_ok=True)
            hard_resize(cut, w, h).save(d / f"{slug}.png")
            entry["sizes"][f"{canvas}px"] = {"w": w, "h": h, "canvas": canvas}
        manifest[slug] = entry
        previews.append((slug, hard_resize(cut, entry["sizes"]["64px"]["w"],
                                           entry["sizes"]["64px"]["h"]),
                         entry["sizes"]["64px"]))
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
    for slug, sprite, s in previews:
        # Nearest-upscale the real sprite, so the preview shows shipped pixels.
        spr = sprite.resize((s["w"] * Z, s["h"] * Z), Image.NEAREST)
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
