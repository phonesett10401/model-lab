"""The Python bubble shape gives the same extents as the page's bubbleExtent. Run: python test_comic_bubble.py"""
import base64
import json
import zlib
from pathlib import Path

import numpy as np

from comic_bubble import bubble_extent

CASES = json.loads((Path(__file__).parent.parent / 'src/lib/comic/bubble-cases.json').read_text(encoding='utf8'))
for c in CASES:
    rgb = np.frombuffer(zlib.decompress(base64.b64decode(c['rgb'])), np.uint8).reshape(c['h'], c['w'], 3)
    seed = tuple(c['seed'][k] for k in 'xywh') if c['seed'] else None
    got = bubble_extent(rgb, seed)
    want = c['extent']
    if want is None:
        assert got is None, f"{c['name']}: {got}, expected none"
    else:
        assert got is not None and all(abs(a - b) <= 1 for a, b in zip(got, want)), f"{c['name']}: {got}, expected {want}"

# grow: a text box in a bubble grows to the bubble; one in a white panel (a closed paper area much bigger than any
# bubble around that text) is not a bubble when the box is meant to be near a bubble's size
from PIL import Image, ImageDraw
from comic_bubble import grow
im = Image.new('RGB', (600, 500), (110, 110, 110))
g = ImageDraw.Draw(im)
g.ellipse([40, 40, 240, 200], fill='white', outline='black', width=3)
g.rectangle([300, 40, 580, 300], fill='white', outline='black', width=4)
got = grow(np.asarray(im), [80, 80, 120, 80])
assert got and got[2] > 190 and got[3] > 150, got
assert grow(np.asarray(im), [380, 100, 100, 60], most=4) is None and grow(np.asarray(im), [380, 100, 100, 60]), "panel"
print('ok', len(CASES), 'cases')
