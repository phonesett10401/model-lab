"""Synthetic lettered pages with exact labels. Run: python test_comic_synth.py"""
import random

import numpy as np
from PIL import Image

import comic_common as c
from comic_synth import make_page


def art(seed):
    rng = np.random.default_rng(seed)
    return Image.fromarray(rng.integers(30, 90, (900, 1200, 3), dtype=np.uint8))


# labels sit inside the page and around the text
for seed in range(20):
    base = art(seed)
    page, labels = make_page(base, random.Random(seed), [])
    W, H = page.size
    inside = np.zeros((H, W), bool)
    for l in labels:
        x, y, w, h = l['bbox']
        assert x >= 0 and y >= 0 and x + w <= W and y + h <= H, (seed, l)
        assert l['category'] in c.CLASSES and l['text'], l
        inside[y:y + h, x:x + w] = True
    changed = np.abs(np.asarray(page, np.int16) - np.asarray(base, np.int16)).max(2) > 0
    assert not (changed & ~inside).any(), f'seed {seed}: drawing outside its boxes'

# all four kinds appear
kinds = {l['category'] for s in range(50) for l in make_page(art(s), random.Random(s), [])[1]}
assert kinds == set(c.CLASSES), kinds

# same seed, same page
a = make_page(art(3), random.Random(7), [])
b = make_page(art(3), random.Random(7), [])
assert a[0].tobytes() == b[0].tobytes() and a[1] == b[1]
print('comic synth checks passed')
