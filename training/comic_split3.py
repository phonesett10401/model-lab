"""Round 3's splits and test sets per style, plus the 97 round-2 test pages relabelled to whole bubbles.

Run: python comic_split3.py
Reads data/comic3/<source>/labels.json (our own pages point into data/comic/images, imported and synthetic pages into
data/comic3/<source>/images) and writes data/comic3/annotations/{train,val,test}.json, test-<style>.json and
test97-bubbles.json. File names in them are relative to training/data.

Rules: our own pages keep their split, decided by episode, volume or book (Pepper&Carrot test episodes and Black Jack
volumes 2 and 6 stay test). Imported sources have no book IDs: a whole source is held out as a test set (HELD_OUT), the
rest are split into train and val by page and never reach test. Synthetic pages train only. Pages dropped in review are
left out.
"""
import hashlib
import json
from collections import Counter
from dataclasses import replace

import numpy as np
from PIL import Image

import comic_common as c
from comic_autolabel import free_kind
from comic_bubble import grow

C3 = c.HERE / 'data/comic3'
OWN = {'pepper': 'Pepper&Carrot', 'blackjack': 'Black Jack', 'comix': 'Comix'}  # data/comic3 folder -> v1 source prefix
HELD_OUT = {'manga-text-detection'}
MIN_TEST = 30
VAL = 10  # percent of an imported source's pages that go to val
# Claude's hand-fixed labels for 42 Comix test pages (3 a book), file -> labels: Comix test pages are autolabels, too
# rough to measure with (boxes over several bubbles or into panels on 106 of 168, looked at 2026-11-02).
REVIEWED = c.HERE / 'attribution/comic-v3-reviewed.json'


def assign(pages: list[c.Page], held_out: set[str], dropped: set[str]) -> dict[str, str]:
    """file -> 'train' | 'val' | 'test'."""
    out = {}
    for p in pages:
        if p.file in dropped:
            continue
        if p.source.startswith('Synthetic'):
            out[p.file] = 'train'
        elif p.source in held_out:
            out[p.file] = 'test'
        elif p.split:  # our own pages: split by episode, volume or book
            out[p.file] = p.split
        else:
            out[p.file] = 'val' if int(hashlib.sha256(p.file.encode()).hexdigest(), 16) % 100 < VAL else 'train'
    return out


def reviewed_test(pages: list[c.Page], split: dict[str, str], items: dict[str, tuple], reviewed: dict[str, list]) -> None:
    """Comix test pages: the reviewed ones take their reviewed labels, the rest leave the test set (in place)."""
    for p in pages:
        if p.source.startswith(OWN['comix']) and split.get(p.file) == 'test':
            if p.file in reviewed:
                f, w, h, _ = items[p.file]
                items[p.file] = (f, w, h, reviewed[p.file])
            else:
                del split[p.file]


def style_counts(pages: list[c.Page], split: dict[str, str]) -> dict[str, int]:
    """Test pages per style (every style listed, 0 where there is none yet)."""
    n = Counter(p.style for p in pages if split.get(p.file) == 'test')
    return {s: n[s] for s in c.STYLES}


def to_test97(rgb: np.ndarray, labels: list[dict]) -> list[dict]:
    """Round 2's reviewed test labels in round 3's target: bubbles and captions grown to the whole bubble where one is
    found (else kept as found), art-text sorted into free-text or sfx. A grown box that takes in another label's middle
    has run into joined bubbles: that label keeps its own box."""
    def holds(b, o):
        return b[0] <= o[0] + o[2] / 2 <= b[0] + b[2] and b[1] <= o[1] + o[3] / 2 <= b[1] + b[3]
    out = []
    for l in labels:
        if l['category'] == 'art-text':
            out.append({**l, 'category': free_kind(l.get('text', ''))})
        elif l['category'] in ('bubble', 'caption'):
            # Reviewed round-2 boxes are near whole bubbles already: growing more than a quarter ran into the panel
            # (black-and-white bubbles open onto it) in ~50 of 57 such boxes when looked at, 2026-11-02.
            g = grow(rgb, l['bbox'], most=1.25)
            ok = g and not any(holds(g, o['bbox']) for o in labels if o is not l)
            out.append({**l, 'bbox': g if ok else l['bbox']})
        else:
            out.append(l)
    return out


def _items(coco: dict, prefix: str) -> dict[str, tuple]:
    names = {k['id']: k['name'] for k in coco['categories']}
    by = {}
    for a in coco['annotations']:
        by.setdefault(a['image_id'], []).append({'bbox': a['bbox'], 'category': names[a['category_id']], **({'text': a['text']} if 'text' in a else {})})
    return {i['file_name']: (f"{prefix}/{i['file_name']}", i['width'], i['height'], by.get(i['id'], [])) for i in coco['images']}


def main() -> None:
    own = c.load_attribution()
    imported = c.load_attribution(c.HERE / 'attribution/comic-v3.csv')
    items, pages = {}, []
    for folder in sorted(p.parent for p in C3.glob('*/labels.json')):
        coco = json.loads((folder / 'labels.json').read_text(encoding='utf8'))
        if folder.name in OWN:
            got = _items(coco, 'comic/images')
            pages += [p for p in own if p.file in got and p.source.startswith(OWN[folder.name])]
        else:
            got = _items(coco, f'comic3/{folder.name}/images')
            # The import log's split is the source's hash, not a decision: this script decides imported pages' splits.
            pages += [replace(p, split='') for p in imported if p.file in got]
        items.update(got)
    split = assign(pages, HELD_OUT, c.dropped())
    reviewed_test(pages, split, items, json.loads(REVIEWED.read_text(encoding='utf8')))
    out = C3 / 'annotations'
    for s in ('train', 'val', 'test'):
        c.write_coco(out / f'{s}.json', [items[p.file] for p in pages if split.get(p.file) == s])
    for style in c.STYLES:
        test = [items[p.file] for p in pages if split.get(p.file) == 'test' and p.style == style]
        if test:
            c.write_coco(out / f'test-{style}.json', test)

    # The 97 round-2 test pages, as whole bubbles.
    old = json.loads((c.DATA / 'annotations/test.json').read_text(encoding='utf8'))
    names = {k['id']: k['name'] for k in old['categories']}
    by = {}
    for a in old['annotations']:
        by.setdefault(a['image_id'], []).append({'bbox': a['bbox'], 'category': names[a['category_id']], **({'text': a['text']} if 'text' in a else {})})
    t97 = []
    for i in old['images']:
        rgb = np.asarray(Image.open(c.DATA / 'images' / i['file_name']).convert('RGB'))
        t97.append((f"comic/images/{i['file_name']}", i['width'], i['height'], to_test97(rgb, by.get(i['id'], []))))
    c.write_coco(out / 'test97-bubbles.json', t97)

    counts = Counter(split.values())
    print('pages:', dict(counts), '| test97:', len(t97))
    for style, n in style_counts(pages, split).items():
        print(f'  test {style}: {n} pages' + ('' if n >= MIN_TEST else '  <- not yet measured (too few)'))


if __name__ == '__main__':
    main()
