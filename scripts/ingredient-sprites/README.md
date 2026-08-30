# Ingredient sprites

Front-facing bottle sprites for the back bar, cut from openly-licensed Wikimedia
Commons photos and scaled to real-world bottle proportions.

Output (tracked): `assets/ingredient-sprites/`
Source photos (**not** tracked, ~417 MB): `assets/ingredient-photos/`

## Pipeline

| step | script | what it does |
|---|---|---|
| 1 | `download_ingredient_photos.py` | first pass, 61 ingredients x 3 photos from Commons |
| 2 | `probe.py` | dry-run candidate search terms (no downloads) |
| 3 | `refetch.py` | second pass with brand-specific terms, appended as `-4/-5/-6` |
| 4 | `make_sheets.py` / `sheets_v2.py` | contact sheets for manual classification |
| 5 | `build_scaled.py` | rembg cutout -> crop -> scale -> 32/64px + `manifest.json` |

Steps 1-4 need `requests` and `pillow`; step 5 also needs `rembg[cpu]` and `numpy`.

```
python -m venv .venv && .venv/bin/python -m pip install requests pillow numpy "rembg[cpu]"
.venv/bin/python scripts/ingredient-sprites/build_scaled.py
```

## Two things that will bite you

**Do not run step 5 from the repo root.** The repo has a `coverage/` directory
(vitest output). Python puts the cwd first on `sys.path`, so numba's
`import coverage` picks up that folder instead of the real package and rembg
fails with `module 'coverage' has no attribute 'types'`. Run from
`scripts/ingredient-sprites/`, which is what the paths assume.

**Search terms must name brands or binomials, not descriptions.** The first pass
used descriptive terms and Commons returned entirely wrong subjects: `"white
peach fruit"` gave apple specimens, `"creme de violette"` gave airliners,
`"grenadine"` gave photos of people, `"cream carton"` gave ice cream. Compare
`probe.py`'s replacements -- `"Prunus persica fruit"`, `"Rothman Winter creme de
violette"`, `"Gordon's gin bottle"`.

## Data files

- `picks-final.json` — the hand-classified pick per ingredient. All 61 are
  bucketed: `front_facing` (33, shipped), `marginal` (7, angled or multi-bottle),
  `no_front_facing_label` (3, nothing usable on Commons),
  `no_label_by_nature` (18, produce and pantry items).
- `bottle-sizes.json` — real height in mm per format, against a fixed
  330 mm -> 64 px reference. Height rather than volume drives scale because
  bottles aren't self-similar: Cointreau (700 ml) is 245 mm, Dolin (750 ml) is
  310 mm. The reference is fixed, not max-of-set, so adding bottles later
  doesn't resize the ones already placed.

Heights are typical values for each format, not measurements of the photos.
`gin` is the least certain — the Gordon's bottle may be a 375 ml flask rather
than the 700 ml assumed.

## Licensing

Every photo is openly licensed but most require attribution, recorded per
ingredient in `assets/ingredient-photos/<slug>/credits.json` (untracked, so keep
it if you redistribute). Roughly two-thirds are CC BY-SA, which is share-alike.
`manifest.json` records which source file each sprite came from.
