"""Build test clips with sounds at KNOWN times (FSD50K only says which sounds, not when), from test clips only.

Each 10 s clip: a quiet test negative as background, 1-3 sounds cut from test clips that contain exactly one of our
sounds (their loudest stretch, 0.3-3 s), placed at random times; 40% of clips with 2+ sounds force an overlap.
Usage: python sounds_synth.py
"""
import csv
import json

import numpy as np
import soundfile as sf

from sounds_common import DATA, SR
from sounds_train import load, path

N_CLIPS, CLIP_S = 100, 10


def loudest(x, max_s=3.0):
    hop = SR // 20
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x), hop)])
    on = np.where(e >= e.max() * 0.25)[0]
    a, b = on[0] * hop, min(len(x), (on[-1] + 1) * hop)
    return a, min(b, a + int(max_s * SR))


def place(bg, parts, rng, overlap=False):
    mix, truth = bg.copy(), []
    for k, (label, snd) in enumerate(parts):
        room = len(mix) - len(snd)
        if overlap and k == 1:
            first = truth[0]
            lo = max(0, int(first['start'] * SR) - len(snd) + SR // 10)
            at = int(rng.integers(lo, min(room, int(first['end'] * SR) - SR // 10) + 1))
        else:
            at = int(rng.integers(0, room + 1))
        mix[at:at + len(snd)] += snd
        truth.append({'label': label, 'start': round(at / SR, 3), 'end': round((at + len(snd)) / SR, 3)})
    return np.clip(mix, -1, 1), truth


def main():
    rng = np.random.default_rng(0)
    rows = [r for r in csv.DictReader(open(DATA / 'clips.csv', encoding='utf8')) if r['split'] == 'test']
    singles = [r for r in rows if r['sounds'] and '|' not in r['sounds']]
    negatives = [r for r in rows if not r['sounds']]
    out = DATA / 'synth'
    out.mkdir(parents=True, exist_ok=True)
    truth_all = []
    for i in range(N_CLIPS):
        n_bg = negatives[rng.integers(len(negatives))]
        bg = np.resize(load(path(n_bg)), CLIP_S * SR)
        bg = bg / (np.abs(bg).max() + 1e-9) * 0.03
        picks = [singles[j] for j in rng.choice(len(singles), rng.integers(1, 4), replace=False)]
        parts = []
        for r in picks:
            x = load(path(r))
            a, b = loudest(x)
            if b - a >= int(0.3 * SR):
                parts.append((r['sounds'], x[a:b] / (np.abs(x[a:b]).max() + 1e-9) * rng.uniform(0.3, 0.9)))
        if not parts:
            continue
        mix, truth = place(bg, parts, rng, overlap=len(parts) > 1 and rng.random() < 0.4)
        sf.write(out / f'{i}.wav', mix, SR, subtype='PCM_16')
        truth_all.append({'file': f'{i}.wav', 'events': truth, 'credits': [n_bg['fname']] + [r['fname'] for r in picks]})
    (out / 'truth.json').write_text(json.dumps(truth_all, indent=1), encoding='utf8')
    print(f'{len(truth_all)} synthetic clips')


if __name__ == '__main__':
    main()
