"""Text boxes from a lettered page and its art-only twin. Run: python test_comic_diff.py"""
import io

import numpy as np
from PIL import Image, ImageDraw

from comic_diff import text_boxes


def art(w=1600, h=1200):
    x = np.linspace(0, 255, w, dtype=np.uint8)
    y = np.linspace(40, 200, h, dtype=np.uint8)
    rgb = np.stack([np.tile(x, (h, 1)), np.tile(y[:, None], (1, w)), np.full((h, w), 120, np.uint8)], -1)
    return Image.fromarray(rgb)


def bubble(im, x, y, w, h):
    g = ImageDraw.Draw(im)
    g.ellipse([x, y, x + w, y + h], fill='white', outline='black', width=4)
    g.text((x + w // 4, y + h // 2 - 10), 'HELLO THERE', fill='black')


def iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    return inter / (aw * ah + bw * bh - inter)


# finds a bubble
a = art()
t = a.copy()
bubble(t, 300, 200, 400, 180)
boxes = text_boxes(t, a)
assert len(boxes) == 1, boxes
assert iou(boxes[0], (300, 200, 401, 181)) >= 0.9, boxes

# ignores compression noise
buf = io.BytesIO()
a.save(buf, 'JPEG', quality=70)
noisy = Image.open(io.BytesIO(buf.getvalue())).convert('RGB')
assert text_boxes(noisy, a) == [], text_boxes(noisy, a)

# keeps two bubbles apart
t2 = a.copy()
bubble(t2, 200, 300, 300, 160)
bubble(t2, 620, 300, 300, 160)
assert len(text_boxes(t2, a)) == 2, text_boxes(t2, a)

# only real story pages are used
from comic_diff import usable_page  # noqa: E402
assert usable_page(1600, 2000, [(0, 0, 400, 300)])
assert not usable_page(1600, 32, []), 'a thin strip is not a page'
assert not usable_page(1600, 2000, [(0, 0, 1600, 1000)]), 'mostly text is a credits page'
print('comic diff checks passed')
