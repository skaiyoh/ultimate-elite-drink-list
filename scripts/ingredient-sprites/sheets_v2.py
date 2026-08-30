"""Contact sheets for pass-2 images only (index >= 4)."""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2] / "assets/ingredient-photos"
OUT = Path(__file__).resolve().parents[2] / "assets/sprite-pilot/contact-sheets-v2"
OUT.mkdir(parents=True, exist_ok=True)
CELL, PAD, LABEL_H, PER = 240, 8, 22, 8


def fnt(sz, bold=False):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial"
                                  + (" Bold" if bold else "") + ".ttf", sz)
    except Exception:
        return ImageFont.load_default()


F, FB = fnt(14), fnt(17, True)
groups = []
for d in sorted(ROOT.iterdir()):
    if not d.is_dir():
        continue
    new = sorted(p for p in d.glob("*.png")
                 if (m := re.search(r"-(\d+)\.png$", p.name)) and int(m.group(1)) >= 4)
    if new:
        groups.append((d.name, new))

for n in range(0, len(groups), PER):
    chunk = groups[n:n + PER]
    W = PAD + 3 * (CELL + PAD)
    RH = LABEL_H + CELL + PAD
    sheet = Image.new("RGB", (W, PAD + len(chunk) * RH), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for r, (slug, paths) in enumerate(chunk):
        y = PAD + r * RH
        d.text((PAD, y + 2), slug, font=FB, fill=(255, 210, 90))
        for c, p in enumerate(paths[:3]):
            x = PAD + c * (CELL + PAD)
            by = y + LABEL_H
            d.rectangle([x, by, x + CELL, by + CELL], fill=(45, 45, 52))
            im = Image.open(p).convert("RGB")
            im.thumbnail((CELL - 4, CELL - 4), Image.LANCZOS)
            sheet.paste(im, (x + (CELL - im.width) // 2, by + (CELL - im.height) // 2))
            d.rectangle([x, by, x + 20, by + 18], fill=(0, 0, 0))
            d.text((x + 6, by + 2), p.stem.rsplit("-", 1)[-1], font=F, fill=(120, 255, 160))
    path = OUT / f"v2-sheet-{n // PER + 1:02d}.png"
    sheet.save(path)
    print(f"{path.name}: {', '.join(s for s, _ in chunk)}")
