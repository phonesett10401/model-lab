"""Convert the Aquarium Combined v6 COCO export into a YOLO dataset under training/data/aquarium-v6.

Keeps Roboflow's original train/valid/test split (the test split is our frozen test set) and
drops zero-size boxes (two broken shark entries in test). All 7 classes stay: dropping a class
while keeping its photos would leave those creatures unboxed and teach the model they're background.
"""
import json
import shutil
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads' / 'Aquarium Combined.v6i.coco')
OUT = Path(__file__).parent / 'data' / 'aquarium-v6'
CLASSES = ['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray']
SPLITS = {'train': 'train', 'valid': 'val', 'test': 'test'}

totals = dict.fromkeys(CLASSES, 0)
dropped = []
for src_split, split in SPLITS.items():
    coco = json.loads((SRC / src_split / '_annotations.coco.json').read_text(encoding='utf8'))
    names = {c['id']: c['name'] for c in coco['categories']}
    boxes = {}
    for a in coco['annotations']:
        boxes.setdefault(a['image_id'], []).append(a)
    (OUT / 'images' / split).mkdir(parents=True, exist_ok=True)
    (OUT / 'labels' / split).mkdir(parents=True, exist_ok=True)
    for im in coco['images']:
        W, H = im['width'], im['height']
        lines = []
        for a in boxes.get(im['id'], []):
            x, y, w, h = a['bbox']
            if w <= 0 or h <= 0:
                dropped.append((split, im['file_name'], names[a['category_id']]))
                continue
            name = names[a['category_id']]
            totals[name] += 1
            lines.append(f"{CLASSES.index(name)} {(x + w / 2) / W:.6f} {(y + h / 2) / H:.6f} {w / W:.6f} {h / H:.6f}")
        shutil.copy2(SRC / src_split / im['file_name'], OUT / 'images' / split / im['file_name'])
        # An image with no boxes still gets an (empty) label file: it's a "nothing here" example.
        (OUT / 'labels' / split / Path(im['file_name']).with_suffix('.txt').name).write_text('\n'.join(lines), encoding='utf8')

(OUT / 'data.yaml').write_text(
    f"path: {OUT.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n"
    + ''.join(f"  {i}: {n}\n" for i, n in enumerate(CLASSES)),
    encoding='utf8',
)

# Self-check against the counts verified earlier from the same export.
assert totals == {'fish': 2673, 'jellyfish': 694, 'penguin': 516, 'puffin': 284, 'shark': 352, 'starfish': 116, 'stingray': 184}, totals
assert [d[2] for d in dropped] == ['shark', 'shark'], dropped
print('boxes per class:', totals, '| total', sum(totals.values()))
print('dropped zero-size boxes:', dropped)
print('written to', OUT)
