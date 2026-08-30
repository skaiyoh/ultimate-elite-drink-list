"""Dry-run candidate search terms before spending bandwidth on downloads.

The first pass failed because terms were descriptive ("white peach fruit" ->
apple specimens). Commons indexes brand names well, so most replacements name a
specific product.
"""
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from download_ingredient_photos import search_commons

CANDIDATES = {
    "cachaca":          ["cachaça 51 garrafa", "cachaca bottle brand", "Velho Barreiro cachaça"],
    "club-soda":        ["Schweppes soda water bottle", "club soda bottle", "seltzer bottle brand"],
    "cranberry-juice":  ["Ocean Spray cranberry", "cranberry juice bottle", "cranberry juice carton"],
    "cream-of-coconut": ["Coco Lopez", "cream of coconut can", "coconut cream can"],
    "creme-de-violette":["violette liqueur bottle", "Rothman Winter creme de violette", "crème de violette liqueur"],
    "egg-white":        ["egg white bowl", "separated egg white glass", "raw egg white"],
    "gin":              ["Gordon's gin bottle", "Tanqueray bottle", "Beefeater gin bottle"],
    "grenadine":        ["grenadine bottle", "Rose's grenadine", "grenadine syrup bottle"],
    "heavy-cream":      ["whipping cream bottle", "heavy cream bottle dairy", "cream bottle milk glass"],
    "honey":            ["honey jar label", "honey bottle squeeze", "jar of honey white background"],
    "orange-juice":     ["orange juice carton", "Tropicana orange juice", "orange juice bottle"],
    "peach":            ["Prunus persica fruit", "peach fruit white background", "peaches whole and half"],
    "prosecco":         ["prosecco bottle white background", "Valdobbiadene prosecco bottle", "prosecco bottle label"],
    "simple-syrup":     ["Monin syrup bottle", "sugar syrup bottle", "gomme syrup bottle"],
    "tomato-juice":     ["tomato juice bottle", "tomato juice can", "Sacramento tomato juice"],
    "tonic-water":      ["Schweppes tonic water bottle", "Fever-Tree tonic water", "tonic water bottle label"],
    "vodka":            ["Absolut vodka bottle", "Smirnoff bottle", "Stolichnaya bottle"],
    "cognac":           ["Hennessy bottle white background", "Remy Martin bottle", "cognac bottle label"],
    "scotch-whisky":    ["Johnnie Walker bottle", "Glenfiddich bottle", "Laphroaig bottle"],
    "sweet-vermouth":   ["Martini Rosso bottle", "Carpano Antica bottle", "vermouth rosso bottle label"],
    "coffee-liqueur":   ["Kahlua bottle", "Tia Maria bottle", "coffee liqueur bottle label"],
    "creme-de-cacao":   ["creme de cacao bottle", "Bols creme de cacao", "cacao liqueur bottle"],
    "grapefruit-soda":  ["Squirt soda bottle", "Ting grapefruit soda", "grapefruit soda bottle"],
    "orgeat":           ["orgeat syrup bottle", "sirop d'orgeat bouteille", "almond syrup bottle"],
}

for slug, terms in CANDIDATES.items():
    print(f"\n### {slug}")
    for t in terms:
        try:
            hits = search_commons(t, 3)
        except Exception as e:
            print(f"   {t!r:42} ERROR {e}")
            continue
        titles = ", ".join(h["title"].replace("File:", "")[:44] for h in hits[:4]) or "(none)"
        print(f"   {len(hits):>2}  {t!r:42} {titles}")
