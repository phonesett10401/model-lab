"""Event merging must match the shared cases the site's TypeScript also runs. Run: python test_sounds_events.py"""
import json
from pathlib import Path

import numpy as np

import sounds_common as c
import sounds_events as ev

cases = json.loads((Path(__file__).parent.parent / 'src/lib/runtime/events-cases.json').read_text(encoding='utf8'))
for w in cases['windows']:
    assert c.window_starts(w['n']) == w['starts'], w
for k in cases['events']:
    got = ev.events(np.array(k['scores']), k['thresholds'], k['seconds'], k['labels'])
    assert got == k['expected'], (k['name'], got)
print('event checks passed')
