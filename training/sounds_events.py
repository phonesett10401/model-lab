"""Turn per-slice scores into sound events. Same rule as src/lib/runtime/events.ts (shared cases in events-cases.json)."""
import numpy as np

STEP_S, WIN_S = 0.5, 1.0
PAD_S = (WIN_S - STEP_S) / 2  # a slice's middle part is where its sound most likely is


def events(scores, thresholds, seconds, labels):
    scores = np.asarray(scores, dtype=float)
    count = len(scores)
    out = []
    for c, label in enumerate(labels):
        hit = scores[:, c] >= thresholds[c]
        on = [bool(hit[i] or (0 < i < count - 1 and hit[i - 1] and hit[i + 1])) for i in range(count)]
        i = 0
        while i < count:
            if not on[i]:
                i += 1
                continue
            j = i
            while j + 1 < count and on[j + 1]:
                j += 1
            start = 0.0 if i == 0 else i * STEP_S + PAD_S
            end = seconds if j == count - 1 else min(seconds, j * STEP_S + WIN_S - PAD_S)
            out.append({'label': label, 'start': round(start, 2), 'end': round(end, 2),
                        'score': round(float(scores[i:j + 1, c].max()), 4)})
            i = j + 1
    return sorted(out, key=lambda e: (e['start'], labels.index(e['label'])))
