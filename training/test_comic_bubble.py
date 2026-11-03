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
assert got and got[0] < 30 and got[0] + got[2] < 280 and got[2] > 180, got
got = bubble_extent(lobes, right, others=[left])
assert got and got[0] > 200 and got[0] + got[2] > 470, got
# a chain with a small bubble in it (its piece vanishes before the necks break) still splits
im = Image.new('RGB', (600, 300), (110, 110, 110))
g = ImageDraw.Draw(im)
for e in ([20, 60, 230, 240], [250, 120, 330, 180], [350, 60, 580, 240]):
    g.ellipse(e, fill='black')
for e in ([23, 63, 227, 237], [253, 123, 327, 177], [353, 63, 577, 237]):
    g.ellipse(e, fill='white')
g.rectangle([215, 142, 365, 158], fill='white')
chain = np.asarray(im)
got = bubble_extent(chain, (80, 140, 90, 20), others=[(270, 145, 40, 10), (410, 140, 110, 20)])
assert got and got[0] < 30 and got[0] + got[2] < 250, got
# a chain whose first bubble opens onto the page margin (no outlines, as in Pepper&Carrot): the others still split off
im = Image.new('RGB', (600, 300), (110, 110, 110))
g = ImageDraw.Draw(im)
g.ellipse([20, 60, 260, 240], fill='white'); g.ellipse([300, 60, 580, 240], fill='white')
g.rectangle([240, 140, 320, 160], fill='white'); g.rectangle([100, 0, 180, 80], fill='white')
open_chain = np.asarray(im)
got = bubble_extent(open_chain, (390, 140, 110, 20), others=[(90, 140, 90, 20)])
assert got and got[0] > 260 and got[0] + got[2] > 570, got
got = bubble_extent(open_chain, (90, 140, 90, 20), others=[(390, 140, 110, 20)])  # the bubble, not the margin strip
assert got and got[1] > 20 and got[0] < 30 and got[0] + got[2] < 300, got
# ...and when that first bubble is small and joined wide (a spiky "What?!" on a bigger bubble), its piece vanishes before
# anything comes apart: the bigger bubble is still found on its own, without the small one and the margin
im = Image.new('RGB', (600, 300), (110, 110, 110))
g = ImageDraw.Draw(im)
g.ellipse([200, 50, 560, 260], fill='white'); g.rectangle([40, 130, 260, 170], fill='white'); g.rectangle([60, 0, 100, 150], fill='white')
spiky = np.asarray(im)
got = bubble_extent(spiky, (300, 140, 160, 30), others=[(110, 140, 60, 20)])
assert got and got[0] > 150 and got[1] > 30 and got[0] + got[2] > 550, got
# ...and on a real page, where white page margin runs all round the crop (so the panel art inside it is enclosed too)
im = Image.new('RGB', (640, 360), 'white')
g = ImageDraw.Draw(im)
g.rectangle([20, 20, 620, 340], fill=(110, 110, 110))
g.ellipse([40, 80, 280, 260], fill='white'); g.ellipse([320, 80, 600, 260], fill='white')
g.rectangle([260, 160, 340, 180], fill='white'); g.rectangle([120, 0, 200, 100], fill='white')
for x in range(120, 200, 12):
    g.text((x, 165), 'W', fill='black')
paged = np.asarray(im)
got = bubble_extent(paged, (410, 160, 110, 20), others=[(110, 160, 90, 20)])
assert got and got[0] > 280 and got[0] + got[2] < 625 and got[1] > 50, got
# grow passes others through (a wide text box: its crop holds the whole chain)
assert grow(lobes, [40, 100, 220, 80])[2] > 400
got = grow(lobes, [40, 100, 220, 80], others=[list(right)])
assert got and got[0] < 30 and got[0] + got[2] < 280, got
im = Image.new('RGB', (500, 300), (110, 110, 110))
ImageDraw.Draw(im).ellipse([20, 20, 480, 280], fill='white', outline='black', width=3)
got = bubble_extent(np.asarray(im), (150, 90, 200, 30), others=[(150, 170, 200, 30)])
assert got and got[2] > 440 and got[3] > 250, got
print('ok', len(CASES), 'cases')
