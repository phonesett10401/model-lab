"""Automatic labels: English words found by OCR (docTR, Apache-2.0), shaped and typed by the detector's boxes.

The owner chose this over hand labelling (2026-10-24). The report card says so: test labels are machine-made and
reviewed by Claude, not by a person.

Run: python comic_autolabel.py <pepper|blackjack|commons> --run r1-dfine
Writes data/comic/<source>_labels.json (read by comic_train.py) and caches OCR words in data/comic/ocr/.
"""
import argparse
import json
import re
import statistics

import comic_common as c

MIN_CONF = 0.5  # OCR words below this are noise
FREE_MIN_LETTERS = 4  # English outside any detected box needs at least this many letters...
FREE_MIN_CONF = 0.6  # ...read this confidently, or it is junk from the art
INSIDE = 0.6  # a region belongs to a detected box when this share of it lies inside
SOURCES = {'pepper': 'Pepper&Carrot', 'blackjack': 'Black Jack', 'commons': 'Wikimedia Commons'}


def _letters(s: str) -> int:
    return len(re.findall(r'[A-Za-z]', s))


def _union(boxes):
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[0] + b[2] for b in boxes)
    y1 = max(b[1] + b[3] for b in boxes)
    return [x0, y0, x1 - x0, y1 - y0]


def _inside_share(r, b):
    ix = max(0, min(r[0] + r[2], b[0] + b[2]) - max(r[0], b[0]))
    iy = max(0, min(r[1] + r[3], b[1] + b[3]) - max(r[1], b[1]))
    return ix * iy / (r[2] * r[3]) if r[2] * r[3] else 0.0


def merge_words(words: list[dict]) -> list[dict]:
    """Groups OCR words ({'bbox', 'text', 'conf'}) that sit together (one bubble, one caption) into regions."""
    words = [w for w in words if w['conf'] >= MIN_CONF and _letters(w['text']) >= 1]
    if not words:
        return []
    h = statistics.median(w['bbox'][3] for w in words)
    gx, gy = 0.8 * h, 0.5 * h
    parent = list(range(len(words)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(words):
        ax, ay, aw, ah = a['bbox']
        for j in range(i + 1, len(words)):
            bx, by, bw, bh = words[j]['bbox']
            if ax - gx < bx + bw and bx < ax + aw + gx and ay - gy < by + bh and by < ay + ah + gy:
                parent[find(i)] = find(j)
    groups = {}
    for i, w in enumerate(words):
        groups.setdefault(find(i), []).append(w)
    regions = []
    for ws in groups.values():
        ws.sort(key=lambda w: (round(w['bbox'][1] / h), w['bbox'][0]))
        regions.append({'bbox': _union([w['bbox'] for w in ws]), 'words': ws, 'text': ' '.join(w['text'] for w in ws)})
    return regions


def label_page(words: list[dict], detected: list[dict]) -> list[dict]:
    """Labels ({'bbox', 'category', 'text'}): detected boxes that hold English, plus confident English elsewhere."""
    regions = merge_words(words)
    out, matched = [], {}
    for r in regions:
        best = max(detected, key=lambda d: _inside_share(r['bbox'], d['bbox']), default=None)
        if best is not None and _inside_share(r['bbox'], best['bbox']) >= INSIDE:
            matched.setdefault(id(best), (best, []))[1].append(r)
            continue
        letters = _letters(r['text'])
        conf = statistics.mean(w['conf'] for w in r['words'])
        if letters >= FREE_MIN_LETTERS and conf >= FREE_MIN_CONF:
            h = statistics.median(w['bbox'][3] for w in r['words'])
            x, y, w, hh = r['bbox']
            pad = 0.4 * h
            out.append({'bbox': [x - pad, y - pad, w + 2 * pad, hh + 2 * pad],
                        'category': 'caption' if len(r['words']) >= 3 else 'art-text', 'text': r['text']})
    for d, rs in matched.values():
        rs.sort(key=lambda r: (r['bbox'][1], r['bbox'][0]))
        out.insert(0, {'bbox': list(d['bbox']), 'category': d['category'], 'text': ' '.join(r['text'] for r in rs)})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('source', choices=SOURCES)
    ap.add_argument('--run', required=True)
    a = ap.parse_args()

    import onnxruntime as ort
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor
    from PIL import Image

    from comic_diff import split_blob, text_boxes
    from comic_evaluate import predict

    ocr = ocr_predictor(det_arch='db_resnet50', reco_arch='crnn_vgg16_bn', pretrained=True).cuda()
    d = c.RUNS / a.run
    session = ort.InferenceSession(str(d / 'model.onnx'), providers=['CPUExecutionProvider'])
    kind = (d / 'kind.txt').read_text().strip()
    cache = c.DATA / 'ocr'
    cache.mkdir(parents=True, exist_ok=True)
    items = []
    pages = [p for p in c.load_attribution() if p.source.startswith(SOURCES[a.source])]
    for n, p in enumerate(pages, 1):
        path = c.DATA / 'images' / p.file
        im = Image.open(path).convert('RGB')
        W, H = im.size
        cached = cache / f'{p.file}.json'
        if cached.exists():
            words = json.loads(cached.read_text(encoding='utf8'))
        else:
            res = ocr(DocumentFile.from_images([str(path)]))
            words = [{'bbox': [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H], 'text': w.value, 'conf': float(w.confidence)}
                     for b in res.pages[0].blocks for l in b.lines for w in l.words for (x0, y0), (x1, y1) in [w.geometry]]
            cached.write_text(json.dumps(words), encoding='utf8')
        detected = [{'bbox': b, 'category': c.CLASSES[k], 'score': s} for k, s, b in predict(session, kind, im) if s >= 0.3]
        if a.source == 'pepper':  # exact bubble outlines from the text-vs-art comparison come first
            art = Image.open(c.DATA / 'art' / p.file).convert('RGB')
            # Touching bubbles form one blob: split it into one box per separate word group (owner's request, 2026-10-24).
            regions = merge_words(words)
            exact = [{'bbox': list(part), 'category': 'bubble', 'score': 1.0}
                     for b in text_boxes(im, art)
                     for part in split_blob(im, art, b, [r['bbox'] for r in regions if _inside_share(r['bbox'], list(b)) >= INSIDE])]
            detected = exact + [d for d in detected if all(_inside_share(d['bbox'], e['bbox']) < 0.3 for e in exact)]
        items.append((p.file, W, H, label_page(words, detected)))
        if n % 25 == 0:
            print(n, 'of', len(pages), flush=True)
    out = c.DATA / f'{a.source}_labels.json'
    out.write_text(json.dumps(c.coco_dict(items)), encoding='utf8')
    print(len(items), 'pages,', sum(len(i[3]) for i in items), 'labels ->', out)


if __name__ == '__main__':
    main()
