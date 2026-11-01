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
print('ok', len(CASES), 'cases')
