"""Pick the detector's sample and failure photos from the frozen TEST split, record the model's real
outputs for them, and write src/lib/data/sea-creature-detector.json for the site. No number here is typed by hand.

Usage: python pick_examples.py
"""
import csv
import json
import shutil
from collections import Counter
from pathlib import Path

from ultralytics import YOLO
from evaluate import compare, truth

HERE = Path(__file__).parent
DATA = HERE / 'data' / 'sea-v2'
RUN = HERE / 'runs' / 'sea-v2-yolo26n'
SITE = HERE.parent
OUT_JSON = SITE / 'src' / 'lib' / 'data' / 'sea-creature-detector.json'
OUT_IMG = SITE / 'static' / 'samples' / 'sea'
THRESHOLD = 0.45
SQUARE = dict(imgsz=640, rect=False)
PAIR_NOTES = {
    frozenset({'seal', 'sea lion'}): 'Seals and sea lions look alike, and it often swaps them.',
    frozenset({'whale', 'dolphin'}): 'Whales and dolphins share a shape; at a distance it can swap them.',
}
# Rejected at human review: a walrus labelled "seal"; an orca labelled "dolphin" (with a watermark); a child as the main subject.
SKIP = {'oi_1ab339d4231ca8cc.jpg', 'oi_70e4c253551475d0.jpg', 'oi_8f6679d10b325117.jpg'}


def credit(name, attr):
    a = attr[name]
    if a['source'].startswith('Aquarium'):
        return 'Photo: Roboflow, Aquarium Combined dataset · CC BY 4.0'
    return f"Photo: {a['author']} on Flickr, via Open Images · CC BY 2.0"


def main():
    model = YOLO(RUN / 'weights' / 'best.pt')
    names = model.names
    attr = {r['file']: r for r in csv.DictReader(open(DATA / 'attribution.csv', encoding='utf8'))}
    rows = []
    for img in sorted((DATA / 'images' / 'test').iterdir()):
        if img.name in SKIP:
            continue
        r = model.predict(img, conf=THRESHOLD, verbose=False, **SQUARE)[0]
        h, w = r.orig_shape
        gt = truth(DATA / 'labels' / 'test' / (img.stem + '.txt'), w, h)
        pred = [(int(c), tuple(b), float(s)) for c, b, s in zip(r.boxes.cls.tolist(), r.boxes.xyxy.tolist(), r.boxes.conf.tolist())]
        missed, false, wrong = compare(gt, pred)
        expected = [{'label': names[c], 'score': round(s, 4), 'box': [round(b[0] / w, 4), round(b[1] / h, 4), round(b[2] / w, 4), round(b[3] / h, 4)]}
                    for c, b, s in sorted(pred, key=lambda p: -p[2])]
        rows.append(dict(img=img, gt=gt, pred=pred, missed=missed, false=false, wrong=wrong, expected=expected,
                         classes={names[c] for c, _ in gt}))

    clean = [r for r in rows if not (r['missed'] or r['false'] or r['wrong']) and r['gt']]
    picks = []  # (id, title, row, failure)

    aq = [r for r in clean if r['img'].name.startswith('aq_')]
    busiest = max(aq, key=lambda r: (len(r['classes']), len(r['gt'])))
    picks.append(('aquarium', 'Aquarium tank', busiest, None))
    for cls, title in [('dolphin', 'Dolphin'), ('sea turtle', 'Sea turtle')]:
        only = [r for r in clean if r['img'].name.startswith('oi_') and r['classes'] == {cls}]
        best = max(only, key=lambda r: max((b[2] - b[0]) * (b[3] - b[1]) for _, b in r['gt']))
        picks.append((cls.replace(' ', '-'), title, best, None))

    for pair, title in [(('seal', 'sea lion'), 'Seal or sea lion?'), (('whale', 'dolphin'), 'Whale or dolphin?')]:
        cands = [r for r in rows if len(r['gt']) == 1 and r['wrong'] and {names[r['wrong'][0][0][0]], names[r['wrong'][0][1][0]]} == set(pair)]
        r = max(cands, key=lambda r: r['wrong'][0][1][2])
        (tc, _), (pc, _, ps) = r['wrong'][0]
        fail = {'truth': names[tc], 'said': names[pc], 'score': round(ps, 4), 'why': PAIR_NOTES[frozenset(pair)]}
        picks.append((pair[0].replace(' ', '-') + '-or-' + pair[1].replace(' ', '-'), title, r, fail))

    fishy = [r for r in rows if r['classes'] == {'fish'} and len(r['missed']) >= 2 and not r['false'] and not r['wrong'] and r['pred']]
    r = max(fishy, key=lambda r: len(r['missed']))
    n = len(r['missed'])
    fail = {'truth': f"{len(r['gt'])} fish", 'said': f"{len(r['pred'])} fish", 'score': round(max(p[2] for p in r['pred']), 4),
            'why': f'It missed {n} of the fish: small, distant or blurred fish are its most common miss.'}
    picks.append(('missed-fish', 'School of fish', r, fail))

    if OUT_IMG.exists():
        shutil.rmtree(OUT_IMG)
    OUT_IMG.mkdir(parents=True)
    samples, failures = [], []
    for sid, title, r, fail in picks:
        shutil.copy2(r['img'], OUT_IMG / f'{sid}.jpg')
        creatures = ', '.join(sorted(r['classes']))
        s = {'id': sid, 'title': title, 'input': {'type': 'image', 'src': f'/samples/sea/{sid}.jpg', 'alt': f'Test photo showing {creatures}'},
             'credit': credit(r['img'].name, attr), 'expected': r['expected']}
        if fail:
            s['knownFailure'] = True
            failures.append({**fail, 'sampleId': sid})
        samples.append(s)
        print(f'{sid:22} {r["img"].name}  truth={sorted(names[c] for c, _ in r["gt"])}  said={[e["label"] for e in r["expected"]]}')

    report = json.loads((RUN / 'report' / 'metrics.json').read_text(encoding='utf8'))
    counts = Counter(s for s in ('train', 'val', 'test') for _ in (DATA / 'images' / s).iterdir())
    boxes = sum(1 for f in (DATA / 'labels').rglob('*.txt') for l in f.read_text().splitlines() if l.strip())
    data = [
        {'label': 'Sources', 'value': 'Aquarium Combined (Roboflow, CC BY 4.0) and Open Images V7 (CC BY 2.0)'},
        {'label': 'Photos', 'value': f"{sum(counts.values()):,} photos, {boxes:,} labelled creatures"},
        {'label': 'Split', 'value': f"{counts['train']:,} train · {counts['val']:,} validation · {counts['test']:,} test"},
        {'label': 'Base model', 'value': 'YOLO26 Nano (Ultralytics, AGPL-3.0), 2.5M parameters'},
        {'label': 'Test score', 'value': f"{report['overall']['mAP50']:.2f} mAP@50 on {report['test_images']} held-out photos"},
        {'label': 'Shows a creature from', 'value': f'{round(THRESHOLD * 100)}% confidence'},
        {'label': 'Known gaps', 'value': 'No octopus, manta ray or orca; mixes up seals and sea lions; misses small, distant fish'},
        {'label': 'Photo credits', 'value': 'Every training photo’s author is listed in training/attribution/sea-v2.csv in the project repository'},
    ]
    out = {'classes': [names[i] for i in sorted(names)], 'threshold': THRESHOLD, 'data': data,
           'metrics': {c: v['mAP50'] for c, v in report['per_class'].items()}, 'samples': samples, 'failures': failures}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, indent='\t', ensure_ascii=False) + '\n', encoding='utf8')
    (HERE / 'attribution').mkdir(exist_ok=True)
    shutil.copy2(DATA / 'attribution.csv', HERE / 'attribution' / 'sea-v2.csv')
    print('failures:', [(f['truth'], f['said'], f['score']) for f in failures])


if __name__ == '__main__':
    main()
