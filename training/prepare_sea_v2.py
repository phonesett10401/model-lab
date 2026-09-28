"""Merge Aquarium Combined v6 (already prepared in data/aquarium-v6) with the selected Open Images photos
into data/sea-v2, one YOLO dataset with a single class list.

Aquarium keeps its original split (its test photos stay frozen). Open Images photos use the stable
70/20/10 split from openimages_select.py. Photos the food filter flagged, or that failed to download,
are left out; a class that falls below 150 boxes is dropped with every photo that shows it.
Writes data/sea-v2/data.yaml and data/sea-v2/attribution.csv (source, author, licence for every photo).
"""
import csv
import json
import shutil
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
AQ = HERE / 'data' / 'aquarium-v6'
OI = HERE / 'data' / 'openimages'
OUT = HERE / 'data' / 'sea-v2'
AQ_CLASSES = ['fish', 'jellyfish', 'penguin', 'puffin', 'shark', 'starfish', 'stingray']
NEW_CLASSES = ['dolphin', 'whale', 'sea turtle', 'seahorse', 'sea lion', 'seal', 'crab', 'lobster']
MIN_BOXES = 150


def yolo_line(cls, b):
    return f"{cls} {(b['x0'] + b['x1']) / 2:.6f} {(b['y0'] + b['y1']) / 2:.6f} {b['x1'] - b['x0']:.6f} {b['y1'] - b['y0']:.6f}"


if __name__ == '__main__':
    selected = json.loads((OI / 'meta' / 'selected.json').read_text(encoding='utf8'))
    not_alive = json.loads((OI / 'meta' / 'not_alive.json').read_text(encoding='utf8'))
    oi = {i: v for i, v in selected.items() if i not in not_alive and (OI / 'images' / f'{i}.jpg').exists()}

    # Drop classes that end up too thin (e.g. lobster after the food filter), with their photos.
    counts = Counter(b['cls'] for v in oi.values() for b in v['boxes'])
    aq_counts = Counter()
    for f in (AQ / 'labels').rglob('*.txt'):
        for line in f.read_text().splitlines():
            if line.strip():
                aq_counts[AQ_CLASSES[int(line.split()[0])]] += 1
    total = counts + aq_counts
    weak = {c for c in NEW_CLASSES + AQ_CLASSES if total[c] < MIN_BOXES}
    classes = [c for c in AQ_CLASSES + NEW_CLASSES if c not in weak]
    assert not (weak & set(AQ_CLASSES)), f'an Aquarium class became too thin: {weak}'  # would need its Aquarium photos dropped too
    oi = {i: v for i, v in oi.items() if not ({b['cls'] for b in v['boxes']} & weak)}

    if OUT.exists():
        shutil.rmtree(OUT)
    rows = [('file', 'source', 'split', 'author', 'licence', 'link')]
    for split in ('train', 'val', 'test'):
        (OUT / 'images' / split).mkdir(parents=True)
        (OUT / 'labels' / split).mkdir(parents=True)
        for img in (AQ / 'images' / split).iterdir():
            name = 'aq_' + img.name
            shutil.copy2(img, OUT / 'images' / split / name)
            lines = [f"{classes.index(AQ_CLASSES[int(l.split()[0])])} {l.split(' ', 1)[1]}"
                     for l in (AQ / 'labels' / split / (img.stem + '.txt')).read_text().splitlines() if l.strip()]
            (OUT / 'labels' / split / (Path(name).stem + '.txt')).write_text('\n'.join(lines))
            rows.append((name, 'Aquarium Combined v6 (Roboflow)', split, 'Roboflow', 'CC BY 4.0', 'https://universe.roboflow.com/brad-dwyer/aquarium-combined'))
    for iid, v in oi.items():
        name = f'oi_{iid}.jpg'
        shutil.copy2(OI / 'images' / f'{iid}.jpg', OUT / 'images' / v['split'] / name)
        (OUT / 'labels' / v['split'] / f'oi_{iid}.txt').write_text('\n'.join(yolo_line(classes.index(b['cls']), b) for b in v['boxes']))
        rows.append((name, 'Open Images V7', v['split'], v['author'], 'CC BY 2.0', v['landing']))

    with open(OUT / 'attribution.csv', 'w', newline='', encoding='utf8') as f:
        csv.writer(f).writerows(rows)
    (OUT / 'data.yaml').write_text(f"path: {OUT.as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n"
                                   + ''.join(f'  {i}: {c}\n' for i, c in enumerate(classes)), encoding='utf8')

    final = Counter()
    per_split = Counter()
    for f in (OUT / 'labels').rglob('*.txt'):
        per_split[f.parent.name] += 1
        for line in f.read_text().splitlines():
            if line.strip():
                final[classes[int(line.split()[0])]] += 1
    print('classes:', classes, '| dropped as too thin:', sorted(weak) or 'none')
    print('photos per split:', dict(per_split))
    for c in classes:
        print(f'  {c:11} boxes {final[c]:6}  (aquarium {aq_counts[c]}, open images {final[c] - aq_counts[c]})')
