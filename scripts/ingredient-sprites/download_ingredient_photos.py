#!/usr/bin/env python3
"""
Download ingredient photos for the Back Bar reference into per-ingredient folders.

Source: Wikimedia Commons — openly licensed, no API key, no scraping of
search engines. Each image is saved as PNG alongside a credits.json holding
the license and author, which most CC licenses require you to keep.

Usage:
    pip install requests pillow
    python download_ingredient_photos.py
    python download_ingredient_photos.py --per-item 5 --out ./photos
    python download_ingredient_photos.py --only gin campari lime
"""

import argparse
import io
import json
import re
import sys
import time
from pathlib import Path

try:
    import requests
    from PIL import Image
except ImportError:
    sys.exit("Missing deps. Run:  pip install requests pillow")

API = "https://commons.wikimedia.org/w/api.php"

# Wikimedia blocks generic agents. Put a real contact here.
HEADERS = {"User-Agent": "UltimateEliteBartending/1.0 (https://github.com/skaiyoh/ultimate-elite-bartending)"}

# Ingredient -> Commons search term. The search term is tuned separately
# because "Sugar" alone returns diagrams, "sugar cubes" returns photos.
INGREDIENTS = {
    # Base spirits
    "bourbon": "bourbon whiskey bottle",
    "rye-whiskey": "rye whiskey bottle",
    "irish-whiskey": "Irish whiskey bottle",
    "scotch-whisky": "Scotch whisky bottle",
    "gin": "gin bottle",
    "vodka": "vodka bottle",
    "white-rum": "white rum bottle",
    "dark-rum": "dark rum bottle",
    "blanco-tequila": "tequila blanco bottle",
    "cognac": "cognac bottle",
    "pisco": "pisco bottle",
    "cachaca": "cachaca bottle",
    # Liqueurs, fortified, sparkling
    "sweet-vermouth": "vermouth rosso bottle",
    "dry-vermouth": "dry vermouth bottle",
    "campari": "Campari bottle",
    "aperol": "Aperol bottle",
    "triple-sec": "Cointreau bottle",
    "maraschino-liqueur": "maraschino liqueur bottle",
    "creme-de-violette": "creme de violette",
    "green-chartreuse": "Chartreuse liqueur bottle",
    "coffee-liqueur": "coffee liqueur bottle",
    "creme-de-cacao": "creme de cacao",
    "amaretto": "amaretto bottle",
    "absinthe": "absinthe bottle",
    "prosecco": "prosecco bottle",
    # Bitters, syrups, sweeteners
    "angostura-bitters": "Angostura bitters bottle",
    "peychauds-bitters": "Peychaud's bitters",
    "simple-syrup": "sugar syrup",
    "honey": "honey jar",
    "grenadine": "grenadine syrup",
    "orgeat": "orgeat syrup almond",
    "passion-fruit": "passion fruit",
    "sugar-cubes": "sugar cubes",
    # Produce and garnish
    "lime": "lime fruit",
    "lemon": "lemon fruit",
    "orange": "orange fruit",
    "grapefruit": "grapefruit fruit",
    "mint": "mint leaves Mentha",
    "ginger": "ginger root rhizome",
    "maraschino-cherries": "maraschino cherries",
    "green-olives": "green olives",
    "celery": "celery stalks",
    "peach": "white peach fruit",
    "nutmeg": "nutmeg seed",
    # Juices, mixers, dairy
    "cranberry-juice": "cranberry juice glass",
    "pineapple-juice": "pineapple juice glass",
    "tomato-juice": "tomato juice glass",
    "orange-juice": "orange juice glass",
    "cream-of-coconut": "coconut cream",
    "tonic-water": "tonic water bottle",
    "club-soda": "soda water sparkling",
    "ginger-beer": "ginger beer bottle",
    "grapefruit-soda": "grapefruit soda",
    "cola": "cola glass",
    "espresso": "espresso coffee cup",
    "heavy-cream": "cream carton",
    "egg-white": "egg white separated",
    # Pantry
    "coarse-salt": "coarse sea salt",
    "black-pepper": "black peppercorns",
    "worcestershire-sauce": "Worcestershire sauce bottle",
    "hot-sauce": "hot sauce bottle",
}


def search_commons(term, limit):
    """Return imageinfo dicts for photo files matching `term`."""
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {term}",
        "gsrnamespace": "6",          # File: namespace
        "gsrlimit": str(limit * 3),   # over-fetch, many results are unusable
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime",
        "iiurlwidth": "1200",
    }
    r = requests.get(API, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    out = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        if not info.get("thumburl"):
            continue
        if info.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        meta = info.get("extmetadata", {})
        out.append({
            "title": page.get("title", ""),
            "url": info["thumburl"],
            "descpage": info.get("descriptionurl", ""),
            "license": meta.get("LicenseShortName", {}).get("value", "unknown"),
            "artist": re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "unknown")),
        })
    return out[: limit * 3]


def save_png(url, dest):
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    img.save(dest, "PNG", optimize=True)
    return dest.stat().st_size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ingredient-photos", help="output folder")
    ap.add_argument("--per-item", type=int, default=3, help="images per ingredient")
    ap.add_argument("--only", nargs="*", help="limit to these ingredient slugs")
    ap.add_argument("--delay", type=float, default=0.4, help="seconds between requests")
    args = ap.parse_args()

    targets = INGREDIENTS
    if args.only:
        targets = {k: v for k, v in INGREDIENTS.items() if k in set(args.only)}
        missing = set(args.only) - set(targets)
        if missing:
            print(f"! unknown slugs ignored: {', '.join(sorted(missing))}")
        if not targets:
            sys.exit("Nothing to do.")

    root = Path(args.out)
    root.mkdir(parents=True, exist_ok=True)
    ok = fail = 0

    for i, (slug, term) in enumerate(sorted(targets.items()), 1):
        folder = root / slug
        folder.mkdir(exist_ok=True)
        print(f"[{i}/{len(targets)}] {slug} ← \"{term}\"")

        try:
            hits = search_commons(term, args.per_item)
        except Exception as e:
            print(f"    search failed: {e}")
            fail += 1
            continue

        credits, saved = [], 0
        for hit in hits:
            if saved >= args.per_item:
                break
            dest = folder / f"{slug}-{saved + 1}.png"
            try:
                size = save_png(hit["url"], dest)
            except Exception as e:
                print(f"    skip ({e})")
                continue
            credits.append({
                "file": dest.name,
                "source": hit["descpage"],
                "license": hit["license"],
                "author": hit["artist"],
            })
            print(f"    {dest.name}  {size // 1024} KB  [{hit['license']}]")
            saved += 1
            time.sleep(args.delay)

        if credits:
            (folder / "credits.json").write_text(json.dumps(credits, indent=2))
            ok += 1
        else:
            print("    nothing usable found — try a different search term")
            fail += 1
        time.sleep(args.delay)

    print(f"\nDone. {ok} folders filled, {fail} came up empty. → {root.resolve()}")


if __name__ == "__main__":
    main()
