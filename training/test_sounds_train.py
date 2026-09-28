"""Checks for training helpers. Run: python test_sounds_train.py"""
import numpy as np

import sounds_common as c
import sounds_train as t

rng = np.random.default_rng(0)
short = np.ones(8000, np.float32)
assert t.crop(short, rng, weighted=True).shape == (c.WIN,)            # short clips are zero-padded to 1 s
loud = np.zeros(10 * c.SR, np.float32)
loud[7 * c.SR:7 * c.SR + 4000] = 1.0                                   # a click at 7 s in 10 s of silence
hits = sum(t.crop(loud, np.random.default_rng(i), weighted=True).any() for i in range(50))
assert hits >= 45, hits                                                # energy-weighted crops find the sound
y = t.target('cat meow|speech')
assert y.sum() == 2 and y[c.CLASSES.index('speech')] == 1
assert t.target('').sum() == 0
assert abs(t.average_precision(np.array([1, 0, 1, 0]), np.array([0.9, 0.8, 0.7, 0.1])) - (1 + 2 / 3) / 2) < 1e-9
assert np.isnan(t.average_precision(np.array([0, 0]), np.array([0.5, 0.1])))
print('training checks passed')
