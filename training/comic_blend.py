"""Blends two D-FINE checkpoints of one model into a new run: w x the second + (1 - w) x the first (their EMA weights).
The live finder is round 3's weights with 30% of round 4's (round 4 was fine-tuned from round 3, so the two average
cleanly): python comic_blend.py r3-full-l2 r4-dfine-l 0.3 r34-mix30, then python comic_export.py r34-mix30 --fp16."""
import shutil
import sys

import torch

import comic_common as c


def blend(a: dict, b: dict, w: float) -> dict:
    assert a.keys() == b.keys(), 'not the same model'
    return {k: w * b[k] + (1 - w) * a[k] if b[k].is_floating_point() else b[k] for k in b}  # counters stay as in b


def main(first: str, second: str, w: float, out: str) -> None:
    load = lambda run: torch.load(c.RUNS / run / 'best_stg2.pth', map_location='cpu', weights_only=False)['ema']['module']
    d = c.RUNS / out
    d.mkdir(exist_ok=True)
    torch.save({'model': blend(load(first), load(second), w)}, d / 'best_stg2.pth')
    for f in ('config.yml', 'kind.txt'):
        shutil.copy(c.RUNS / second / f, d / f)
    print('wrote', d)


if __name__ == '__main__':
    if sys.argv[1:2] == ['--test']:
        a, b = {'w': torch.zeros(2), 'n': torch.tensor(1)}, {'w': torch.ones(2), 'n': torch.tensor(5)}
        m = blend(a, b, 0.3)
        assert torch.allclose(m['w'], torch.full((2,), 0.3)) and m['n'] == 5, m
        print('comic blend checks passed')
    else:
        main(sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4])
