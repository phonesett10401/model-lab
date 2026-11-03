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
# joined bubbles (lobes with a neck between, as in a chain of speech bubbles): the extent around one text box stops at
# its own lobe when another bubble's text (`others`) lies in the same paper; a single oval with two paragraphs stays whole
im = Image.new('RGB', (500, 300), (110, 110, 110))
g = ImageDraw.Draw(im)
g.ellipse([20, 60, 250, 240], fill='black'); g.ellipse([230, 60, 480, 240], fill='black')
g.ellipse([23, 63, 247, 237], fill='white'); g.ellipse([233, 63, 477, 237], fill='white')
g.rectangle([200, 130, 280, 170], fill='white')
lobes = np.asarray(im)
left, right = (90, 140, 90, 20), (320, 140, 90, 20)
whole = bubble_extent(lobes, left)
assert whole and whole[2] > 400, whole  # without others: the whole joined region, as before
got = bubble_extent(lobes, left, others=[right])
assert got and got[0] < 30 and got[0] + got[2] < 260 and got[2] > 180, got
got = bubble_extent(lobes, right, others=[left])
assert got and got[0] > 210 and got[0] + got[2] > 470, got
# grow passes others through (a wide text box: its crop holds the whole chain)
assert grow(lobes, [40, 100, 220, 80])[2] > 400
got = grow(lobes, [40, 100, 220, 80], others=[list(right)])
assert got and got[0] < 30 and got[0] + got[2] < 260, got
im = Image.new('RGB', (500, 300), (110, 110, 110))
ImageDraw.Draw(im).ellipse([20, 20, 480, 280], fill='white', outline='black', width=3)
got = bubble_extent(np.asarray(im), (150, 90, 200, 30), others=[(150, 170, 200, 30)])
assert got and got[2] > 440 and got[3] > 250, got
print('ok', len(CASES), 'cases')
