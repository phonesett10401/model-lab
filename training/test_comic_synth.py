"""Synthetic lettered pages with exact labels, round 3's target. Run: python test_comic_synth.py"""
import random

import numpy as np
from PIL import Image

import comic_common as c
from comic_bubble import bubble_extent
from comic_synth import KINDS, make_page


def art(seed, size=(1200, 900)):
    rng = np.random.default_rng(seed)
    return Image.fromarray(rng.integers(30, 90, (size[1], size[0], 3), dtype=np.uint8))


# labels sit inside the page; nothing is drawn outside a box except panel borders (drawn first, part of the art)
pages = [make_page(art(s), random.Random(s), []) for s in range(50)]
for s, (page, labels) in enumerate(pages):
    W, H = page.size
    inside = np.zeros((H, W), bool)
    for l in labels:
        x, y, w, h = l['bbox']
        assert x >= 0 and y >= 0 and x + w <= W and y + h <= H, (s, l)
        assert l['category'] in c.CLASSES and l['text'] and l['kind'] in KINDS, l
        inside[y:y + h, x:x + w] = True
    base = np.asarray(art(s), np.int16)
    if page.size == art(s).size:
        changed = np.abs(np.asarray(page, np.int16) - base).max(2) > 0
        border = (np.asarray(page) == 0).all(2)  # panel borders are pure black lines
        assert not (changed & ~inside & ~border).any(), f'seed {s}: drawing outside its boxes'

# each new kind appears in a 50-page sample, and all four classes do
assert {l['kind'] for _, ls in pages for l in ls} == set(KINDS), {l['kind'] for _, ls in pages for l in ls}
assert {l['category'] for _, ls in pages for l in ls} == set(c.CLASSES)

# the one-target rule: joined lobes are one box (the bubble finder agrees), touching bubbles are two
for page, labels in pages:
    rgb = np.asarray(page)
    for l in labels:
        if l['kind'] in ('joined', 'touching') and l['category'] == 'bubble':
            x, y, w, h = l['bbox']
            m = 12
            crop = rgb[max(0, y - m):y + h + m, max(0, x - m):x + w + m]
            e = bubble_extent(crop, (min(m, x) + w // 4, min(m, y) + h // 4, w // 2, h // 2))
            assert e is not None and abs(e[2] - w) <= 0.12 * w and abs(e[3] - h) <= 0.12 * h, (l, e)
touching = [l for _, ls in pages for l in ls if l['kind'] == 'touching']
assert len(touching) % 2 == 0 and touching, 'touching bubbles come in pairs, each its own box'

# tall webtoon pages
page, labels = make_page(art(1), random.Random(1), [], tall=True)
assert page.height >= 3 * page.width and labels

# same seed, same page
a = make_page(art(3), random.Random(7), [])
b = make_page(art(3), random.Random(7), [])
assert a[0].tobytes() == b[0].tobytes() and a[1] == b[1]
print('comic synth checks passed')
