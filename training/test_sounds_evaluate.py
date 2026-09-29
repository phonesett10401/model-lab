"""Checks for the evaluation maths. Run: python test_sounds_evaluate.py"""
import numpy as np

import sounds_evaluate as e

truth = [{'label': 'a', 'start': 2.0, 'end': 3.0}, {'label': 'b', 'start': 5.0, 'end': 6.0}]
pred = [{'label': 'a', 'start': 2.25, 'end': 3.25, 'score': 0.9},   # matched (onset 0.25 s off)
        {'label': 'b', 'start': 6.0, 'end': 7.0, 'score': 0.8},     # onset 1 s off: miss + false alarm
        {'label': 'a', 'start': 8.0, 'end': 9.0, 'score': 0.7}]     # false alarm
tp, fp, fn, err = e.match(truth, pred)
assert (tp, fp, fn) == (1, 2, 1) and err == [0.25], (tp, fp, fn, err)
y = np.array([1, 1, 0, 0, 0])
s = np.array([0.9, 0.6, 0.55, 0.2, 0.1])
assert abs(e.best_threshold(y, s) - 0.6) < 1e-9       # 0.6 keeps both positives and drops 0.55
print('evaluation checks passed')

# Per-sound thresholds are tuned on slices (the way the timeline works), not on whole clips.
labels = ['a', 'b']
scores = np.array([[0.1, 0.0], [0.6, 0.0], [0.1, 0.0], [0.1, 0.0], [0.4, 0.0], [0.1, 0.0]])  # 3.5 s clip
clips = [(scores, 3.5, [{'label': 'a', 'start': 0.75, 'end': 1.25}])]  # the 0.6 bump is real, the 0.4 one isn't
th = e.tune_event_thresholds(clips, labels, fallback=[0.9, 0.9])
assert th[0] == 0.6 and th[1] == 0.9, th   # highest threshold that still finds it and drops the 0.4 false alarm; b keeps its fallback
# Segment score: which sounds are on in each 1 s segment.
p, r = e.segment_pr([{'label': 'a', 'start': 0.2, 'end': 1.5}], [{'label': 'a', 'start': 1.2, 'end': 2.5}], 3.0)
assert (round(p, 2), round(r, 2)) == (0.5, 0.5), (p, r)   # truth covers segments 0,1; prediction 1,2
print('tuning checks passed')
