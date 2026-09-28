"""Choose Open Images photos for the sea creature detector. Reads training/data/openimages/meta/*.csv
(pre-filtered to our creatures) and writes meta/selected.json. No downloads here.

Rules (see the v2 design):
- drop photos with group boxes (one box around a whole school) or depictions (drawings, toys, statues)
- drop rotated photos (their boxes are for the rotated view)
- only CC BY 2.0 photos, so any of them can be shown on the site with credit
- drop photos where people confirmed one of our creatures (or a parent like "Fish") but it has no box
- cap photos whose only creature is fish, so fish doesn't drown out the rest
"""
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

META = Path(__file__).parent / 'data' / 'openimages' / 'meta'
MIN_BOXES = 150
FISH_ONLY_CAP = 1500
CC_BY = 'https://creativecommons.org/licenses/by/2.0/'

# Open Images label → our class. Goldfish are fish; Rays and skates are our stingray class.
OURS = {'Fish': 'fish', 'Goldfish': 'fish', 'Shark': 'shark', 'Rays and skates': 'stingray', 'Seahorse': 'seahorse',
        'Jellyfish': 'jellyfish', 'Starfish': 'starfish', 'Penguin': 'penguin', 'Dolphin': 'dolphin', 'Whale': 'whale',
        'Sea lion': 'sea lion', 'Harbor seal': 'seal', 'Sea turtle': 'sea turtle', 'Crab': 'crab', 'Lobster': 'lobster', 'Squid': 'squid'}
# A confirmed parent label means one of these creatures is in the photo, so it needs at least one box from its group.
PARENTS = {'Fish': {'Fish', 'Goldfish', 'Shark', 'Rays and skates', 'Seahorse'},
           'Marine mammal': {'Dolphin', 'Whale', 'Sea lion', 'Harbor seal'},
           'Marine invertebrates': {'Crab', 'Jellyfish', 'Lobster', 'Squid', 'Starfish', 'Shrimp', 'Isopod'},
           'Turtle': {'Sea turtle', 'Tortoise'}}


def bucket(image_id, salt=''):
    """Stable 0–99 number per photo, so splits and caps never change between runs."""
    return int(hashlib.md5((salt + image_id).encode()).hexdigest(), 16) % 100


def split_of(image_id):
    b = bucket(image_id)
    return 'train' if b < 70 else 'val' if b < 90 else 'test'


def select(meta=META):
    names = {r[0]: r[1] for r in csv.reader(open(meta / 'classes.csv', encoding='utf8'))}
    boxes = defaultdict(list)
    for r in csv.DictReader(open(meta / 'bbox.csv', encoding='utf8')):
        boxes[r['ImageID']].append(r)
    confirmed = defaultdict(set)
    for r in csv.DictReader(open(meta / 'human_labels.csv', encoding='utf8')):
        if r['Confidence'] == '1' and names.get(r['LabelName']) in set(OURS) | set(PARENTS):
            confirmed[r['ImageID']].add(names[r['LabelName']])
    info = {r['ImageID']: r for r in csv.DictReader(open(meta / 'images.csv', encoding='utf8'))}

    why = Counter()
    kept = {}
    for iid, bs in boxes.items():
        ours = [b for b in bs if names[b['LabelName']] in OURS]
        if not ours:
            why['no box of ours'] += 1; continue
        if any(b['IsGroupOf'] == '1' or b['IsDepiction'] == '1' for b in ours):
            why['group box or depiction'] += 1; continue
        meta_row = info.get(iid)
        if not meta_row or meta_row['Rotation'] not in ('', '0', '0.0'):
            why['rotated or no metadata'] += 1; continue
        if meta_row['License'] != CC_BY:
            why['licence not CC BY 2.0'] += 1; continue
        boxed = {names[b['LabelName']] for b in bs}
        unboxed = [l for l in confirmed[iid] if not (({l} | PARENTS.get(l, set())) & boxed)]
        if unboxed:
            why['confirmed creature without a box'] += 1; continue
        kept[iid] = [{'cls': OURS[names[b['LabelName']]], 'x0': float(b['XMin']), 'x1': float(b['XMax']),
                      'y0': float(b['YMin']), 'y1': float(b['YMax'])} for b in ours]

    fish_only = [i for i, bs in kept.items() if {b['cls'] for b in bs} == {'fish'}]
    over = sorted(fish_only, key=lambda i: bucket(i, 'cap'))[FISH_ONLY_CAP:]
    for i in over:
        del kept[i]
    why['fish-only over the cap'] = len(over)

    # A class with too few boxes is dropped, and so is every photo showing it: keeping those photos
    # would leave that creature unboxed, teaching the model it's background.
    counts = Counter(b['cls'] for bs in kept.values() for b in bs)
    weak = {c for c, n in counts.items() if n < MIN_BOXES}
    for iid in [i for i, bs in kept.items() if any(b['cls'] in weak for b in bs)]:
        del kept[iid]
        why[f'shows a dropped class ({", ".join(sorted(weak))})'] += 1
    counts = Counter(b['cls'] for bs in kept.values() for b in bs)
    return kept, info, counts, why


if __name__ == '__main__':
    kept, info, counts, why = select()
    print('dropped:', dict(why))
    print('kept photos:', len(kept))
    for c, n in counts.most_common():
        print(f'  {c:11} boxes {n:6}')
    out = {iid: {'split': split_of(iid), 'boxes': bs, 'author': info[iid]['Author'], 'landing': info[iid]['OriginalLandingURL'],
                 'license': info[iid]['License']} for iid, bs in kept.items()}
    (META / 'selected.json').write_text(json.dumps(out), encoding='utf8')
    print('splits:', dict(Counter(v['split'] for v in out.values())))
    sys.exit(0)
