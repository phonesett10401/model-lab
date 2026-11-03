"""Automatic labels: English words found by OCR (docTR, Apache-2.0), shaped and typed by the detector's boxes.

The owner chose this over hand labelling (2026-10-24). The report card says so: test labels are machine-made and
reviewed by Claude, not by a person.

Run: python comic_autolabel.py <pepper|blackjack|commons|comix> --run final2-dfine
Writes data/comic3/<source>/labels.json in round 3's target (comic_common.CLASSES; pages stay in data/comic/images)
and caches OCR words in data/comic/ocr/.
"""
import argparse
import json
import re
import statistics

import numpy as np

import comic_common as c
from comic_bubble import bubble_extent

MIN_CONF = 0.5  # OCR words below this are noise
FREE_MIN_LETTERS = 4  # English outside any detected box needs at least this many letters...
FREE_MIN_CONF = 0.6  # ...read this confidently, or it is junk from the art
INSIDE = 0.6  # a region belongs to a detected box when this share of it lies inside
SOURCES = {'pepper': 'Pepper&Carrot', 'blackjack': 'Black Jack', 'commons': 'Wikimedia Commons', 'comix': 'Comix'}
# Sound-effect words (left as drawn on the page); any word with a letter drawn out 3+ times ("Grooo", "Shhh") is one too.
SFX = set('''aah argh ba bam bang bash beep blam blip bloop bonk boom bop brr bzz chomp chug clack clang clank clap
clatter click clink clomp clonk crack crash creak crunch ding dong doki drip fwoosh fwip gasp glug gong grr growl gulp
ha hah haha hehe hiss honk huff hmph kaboom kapow knock krak munch pant plip plonk plop pow puff purr rattle ring rip
roar rumble rustle shff shing sizzle slam slap slash slurp smack snap snick sniff snore sob splash splat squeak squish
stomp swish swoosh tap thud thump thunk throb thwack tick tock tink twang vroom wham whack whap whir whoosh whump wobble
yawn zap zip zoom'''.split())


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


def free_kind(text: str) -> str:
    """Text without a box: 'sfx' when every word is a sound (left as drawn), else 'free-text' (translated)."""
    words = re.findall(r'[A-Za-z]+', text)
    sound = lambda w: w.lower() in SFX or re.search(r'([a-z])\1\1', w.lower()) is not None
    return 'sfx' if words and all(sound(w) for w in words) else 'free-text'


def split_touching(rgb: np.ndarray, box: list, groups: list[list[float]]) -> list[list[int]]:
    """One changed blob holding 2+ word groups: each group's bubble (the closed paper region around it) is one box.
    When a group's bubble takes in another group (bubbles joined into a chain), that group gets its own text box,
    padded a little, instead: round 3 counts each bubble, and one box over the chain taught the finder to box chains.
    So does a group with no closed bubble around it (a chain opening onto the page margin, as in Pepper&Carrot)."""
    if len(groups) < 2:
        return [list(box)]
    H, W = rgb.shape[:2]
    x, y, w, h = (int(round(v)) for v in box)
    m = max(w, h)  # room for the whole bubble around a box that holds only part of it
    cx, cy = max(0, x - m), max(0, y - m)
    crop = rgb[cy:min(H, y + h + m), cx:min(W, x + w + m)]
    out = []
    for i, (gx, gy, gw, gh) in enumerate(groups):
        e = bubble_extent(crop, (gx - cx, gy - cy, gw, gh))
        e = e and [cx + e[0], cy + e[1], e[2], e[3]]
        if e is None or any(_holds(e, o) for j, o in enumerate(groups) if j != i):
            e = _padded([gx, gy, gw, gh])
        if all(_inside_share(e, o) < 0.8 for o in out):
            out.append(e)
    return out


def _holds(b, o) -> bool:
    """Box b holds box o's middle."""
    return b[0] <= o[0] + o[2] / 2 <= b[0] + b[2] and b[1] <= o[1] + o[3] / 2 <= b[1] + b[3]


def _padded(b) -> list[int]:
    """A text box padded by a fifth of its shorter side (about a bubble's margin round its text)."""
    p = 0.2 * min(b[2], b[3])
    return [round(b[0] - p), round(b[1] - p), round(b[2] + 2 * p), round(b[3] + 2 * p)]


def _square(rgb: np.ndarray, box: list) -> bool:
    """A grown box whose four corners are its paper is a rectangular narration box; an oval's corners are not paper."""
    x, y, w, h = (int(v) for v in box)
    px = rgb[y:y + h, x:x + w].reshape(-1, 3).astype(int)
    if len(px) == 0:
        return False
    keys, counts = np.unique(px // 16, axis=0, return_counts=True)
    paper = px[(px // 16 == keys[counts.argmax()]).all(1)].mean(0)
    i = 3
    corners = [rgb[y + i, x + i], rgb[y + i, x + w - 1 - i], rgb[y + h - 1 - i, x + i], rgb[y + h - 1 - i, x + w - 1 - i]]
    return all((np.abs(c.astype(int) - paper) <= 40).all() for c in corners)


def refine(rgb: np.ndarray, labels: list[dict], words: list[list[float]]) -> list[dict]:
    """Round 3's target for the finder's bubble and caption boxes: one box over several bubbles is split (one per word
    group's closed paper region), each is grown to its whole bubble, and a grown box is a caption when it is square
    (paper in its corners), else a bubble. A box with no closed bubble around it is kept as found."""
    from comic_bubble import grow
    out = []
    for l in labels:
        if l['category'] not in ('bubble', 'caption'):
            out.append(l)
            continue
        groups = [g for g in words if _inside_share(g, l['bbox']) >= INSIDE]
        parts = split_touching(rgb, l['bbox'], groups) if len(groups) >= 2 else [l['bbox']]
        if parts == [list(l['bbox'])]:
            grown = grow(rgb, l['bbox'])
            if grown and any(_holds(grown, w) for w in words if _inside_share(w, l['bbox']) < INSIDE):
                grown = None  # joined to another bubble: kept as found
            parts = [grown] if grown else []
        if not parts:
            out.append(l)
            continue
        for p in parts:
            if all(_inside_share(p, o['bbox']) < 0.8 or _inside_share(o['bbox'], p) < 0.8 for o in out):
                out.append({**l, 'bbox': list(p), 'category': 'caption' if _square(rgb, p) else 'bubble'})
    return out


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
        kind = free_kind(r['text'])
        if (letters >= FREE_MIN_LETTERS or kind == 'sfx') and conf >= FREE_MIN_CONF:
            h = statistics.median(w['bbox'][3] for w in r['words'])
            x, y, w, hh = r['bbox']
            pad = 0.4 * h
            out.append({'bbox': [x - pad, y - pad, w + 2 * pad, hh + 2 * pad],
                        'category': 'sfx' if kind == 'sfx' else 'caption' if len(r['words']) >= 3 else 'free-text', 'text': r['text']})
    for d, rs in matched.values():
        rs.sort(key=lambda r: (r['bbox'][1], r['bbox'][0]))
        text = ' '.join(r['text'] for r in rs)
        # Round 2's art-text is sorted into sound effects and meaningful text.
        out.insert(0, {'bbox': list(d['bbox']), 'category': free_kind(text) if d['category'] == 'art-text' else d['category'], 'text': text})
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

    from comic_diff import text_boxes
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
        detected = [{'bbox': b, 'category': c.CLASSES_V2[k], 'score': s} for k, s, b in predict(session, kind, im) if s >= 0.3]
        if a.source == 'pepper':  # exact bubble outlines from the text-vs-art comparison come first
            art = Image.open(c.DATA / 'art' / p.file).convert('RGB')
            # Touching bubbles form one blob: one box per closed paper region (lobes joined by a neck stay one).
            regions = merge_words(words)
            rgb = np.asarray(im)
            exact = [{'bbox': list(part), 'category': 'bubble', 'score': 1.0}
                     for b in text_boxes(im, art)
                     for part in split_touching(rgb, list(b), [r['bbox'] for r in regions if _inside_share(r['bbox'], list(b)) >= INSIDE])]
            detected = exact + [d for d in detected if all(_inside_share(d['bbox'], e['bbox']) < 0.3 for e in exact)]
        items.append((p.file, W, H, refine(np.asarray(im), label_page(words, detected), [r['bbox'] for r in merge_words(words)])))
        if n % 25 == 0:
            print(n, 'of', len(pages), flush=True)
    out = c.HERE / 'data/comic3' / a.source / 'labels.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(c.coco_dict(items)), encoding='utf8')
    print(len(items), 'pages,', sum(len(i[3]) for i in items), 'labels ->', out)


if __name__ == '__main__':
    main()
