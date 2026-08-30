"""Second pass with brand-specific terms, appended alongside the originals.

Descriptive terms failed the first time ("white peach fruit" -> apple specimens);
Commons indexes brand and binomial names far better. New files continue the
existing numbering so nothing already classified is overwritten.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from download_ingredient_photos import search_commons, save_png
import time

ROOT = Path(__file__).resolve().parents[2] / "assets/ingredient-photos"

TERMS = {
    "tonic-water":       "Schweppes tonic water bottle",
    "vodka":             "Smirnoff bottle",
    "scotch-whisky":     "Laphroaig bottle",
    "creme-de-violette": "Rothman Winter creme de violette",
    "egg-white":         "egg white bowl",
    "gin":               "Gordon's gin bottle",
    "grenadine":         "grenadine bottle",
    "cranberry-juice":   "cranberry juice bottle",
    "peach":             "Prunus persica fruit",
    "creme-de-cacao":    "creme de cacao bottle",
    "orgeat":            "orgeat syrup bottle",
    "simple-syrup":      "Monin syrup bottle",
    "cognac":            "cognac bottle label",
    "sweet-vermouth":    "Martini Rosso bottle",
    "honey":             "honey jar label",
    "orange-juice":      "orange juice bottle",
    "coffee-liqueur":    "Kahlua bottle",
    "prosecco":          "Valdobbiadene prosecco bottle",
    "grapefruit-soda":   "grapefruit soda bottle",
    "tomato-juice":      "tomato juice can",
    "club-soda":         "seltzer bottle brand",
    "cachaca":           "cachaça 51 garrafa",
    "cream-of-coconut":  "cream of coconut can",
    "heavy-cream":       "cream bottle milk glass",
}
PER = 3

for i, (slug, term) in enumerate(sorted(TERMS.items()), 1):
    folder = ROOT / slug
    folder.mkdir(parents=True, exist_ok=True)
    start = len(list(folder.glob("*.png")))
    print(f"[{i}/{len(TERMS)}] {slug} <- {term!r} (appending from -{start+1})", flush=True)
    try:
        hits = search_commons(term, PER)
    except Exception as e:
        print(f"    search failed: {e}", flush=True)
        continue

    cpath = folder / "credits.json"
    credits = json.loads(cpath.read_text()) if cpath.exists() else []
    have = {c.get("source") for c in credits}
    saved = 0
    for hit in hits:
        if saved >= PER:
            break
        if hit["descpage"] in have:      # same file already downloaded first pass
            continue
        dest = folder / f"{slug}-{start + saved + 1}.png"
        try:
            size = save_png(hit["url"], dest)
        except Exception as e:
            print(f"    skip ({e})", flush=True)
            continue
        credits.append({"file": dest.name, "source": hit["descpage"],
                        "license": hit["license"], "author": hit["artist"],
                        "search_term": term, "pass": 2})
        print(f"    {dest.name}  {size//1024} KB  [{hit['license']}]", flush=True)
        saved += 1
        time.sleep(0.4)
    if saved:
        cpath.write_text(json.dumps(credits, indent=2))
    else:
        print("    nothing new", flush=True)
    time.sleep(0.4)
print("\ndone", flush=True)
