"""Build labeled contact sheets so every candidate photo can be eyeballed at once."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "assets/ingredient-photos"
OUT = REPO / "assets/sprite-pilot/contact-sheets"
OUT.mkdir(parents=True, exist_ok=True)
CELL, PAD, LABEL_H, PER_SHEET = 240, 8, 22, 8

def font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

F, FB = font(14), font(17)

slugs = sorted(d.name for d in ROOT.iterdir() if d.is_dir())
sheets = [slugs[i:i + PER_SHEET] for i in range(0, len(slugs), PER_SHEET)]

for n, group in enumerate(sheets, 1):
    rows = len(group)
    W = PAD + 3 * (CELL + PAD)
    RH = LABEL_H + CELL + PAD
    sheet = Image.new("RGB", (W, PAD + rows * RH), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for r, slug in enumerate(group):
        y = PAD + r * RH
        d.text((PAD, y + 2), slug, font=FB, fill=(255, 210, 90))
        for c, img_path in enumerate(sorted(ROOT.joinpath(slug).glob("*.png"))):
            x = PAD + c * (CELL + PAD)
            box_y = y + LABEL_H
            d.rectangle([x, box_y, x + CELL, box_y + CELL], fill=(45, 45, 52))
            im = Image.open(img_path).convert("RGB")
            im.thumbnail((CELL - 4, CELL - 4), Image.LANCZOS)
            sheet.paste(im, (x + (CELL - im.width) // 2, box_y + (CELL - im.height) // 2))
            tag = img_path.stem.rsplit("-", 1)[-1]
            d.rectangle([x, box_y, x + 20, box_y + 18], fill=(0, 0, 0))
            d.text((x + 6, box_y + 2), tag, font=F, fill=(120, 255, 160))
    p = OUT / f"sheet-{n:02d}.png"
    sheet.save(p)
    print(f"{p.name}: {', '.join(group)}")
