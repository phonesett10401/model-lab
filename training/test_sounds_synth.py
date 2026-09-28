"""Checks for the synthetic timeline clips. Run: python test_sounds_synth.py"""
import numpy as np

import sounds_common as c
import sounds_synth as s

x = np.zeros(5 * c.SR, np.float32)
x[2 * c.SR:int(2.5 * c.SR)] = 0.5
a, b = s.loudest(x)
assert abs(a / c.SR - 2.0) < 0.11 and abs(b / c.SR - 2.5) < 0.11, (a / c.SR, b / c.SR)
bg = np.zeros(s.CLIP_S * c.SR, np.float32)
part = ('knocking', np.full(c.SR // 2, 0.5, np.float32))
mix, truth = s.place(bg, [part, ('speech', np.full(c.SR, 0.2, np.float32))], np.random.default_rng(1), overlap=True)
assert len(mix) == len(bg) and len(truth) == 2
k = next(t for t in truth if t['label'] == 'knocking')
i0 = int(round(k['start'] * c.SR))
assert np.allclose(mix[i0:i0 + 100], 0.5, atol=0.21)                   # the knock is where the truth says
sp = next(t for t in truth if t['label'] == 'speech')
assert sp['start'] < k['end'] and k['start'] < sp['end']                # overlap requested -> they overlap
print('synth checks passed')
