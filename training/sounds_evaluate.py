"""Measure both sizes on the frozen test clips, pick one, set per-sound thresholds on validation clips, measure
timing on the synthetic clips, export ONNX (the file the site runs) and check it matches PyTorch.
Usage: python sounds_evaluate.py
"""
import json
import shutil
from collections import Counter

import numpy as np
import onnxruntime as ort
import torch

from sounds_common import CLASSES, DATA, HERE, RUNS, SR, WIN
from sounds_events import events
from sounds_model import Net
from sounds_train import clip_scores, evaluate, load, path, rows

REPORT = RUNS / 'sounds-v1-report'
SITE_MODEL = HERE.parent / 'static' / 'models' / 'sound-detective-v1.onnx'
GRID = np.round(np.arange(0.10, 0.901, 0.05), 2)
MN10_MARGIN = 0.03  # the bigger model must beat the small one by this much mAP to be worth its download


def match(truth, pred, collar=0.5):
    used, tp, err = set(), 0, []
    for t in truth:
        best = None
        for k, p in enumerate(pred):
            d = abs(p['start'] - t['start'])
            if k not in used and p['label'] == t['label'] and d <= collar and (best is None or d < best[1]):
                best = (k, d)
        if best:
            used.add(best[0])
            tp += 1
            err.append(round(best[1], 3))
    return tp, len(pred) - len(used), len(truth) - tp, err


def best_threshold(y, s):
    def f1(th):
        p = s >= th
        tp = (p & (y == 1)).sum()
        return 2 * tp / max(1, p.sum() + (y == 1).sum())
    # Highest F1; ties go to the higher threshold (fewer false alarms).
    return float(max(GRID, key=lambda th: (round(f1(th), 9), th)))


def load_net(size):
    net = Net(size, classes=len(CLASSES), pretrained=False)
    net.load_state_dict(torch.load(RUNS / f'sounds-v1-{size}' / 'best.pt', map_location='cuda'))
    return net.cuda().eval()


class Scores(torch.nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, audio):
        return torch.sigmoid(self.net(audio))


def export(net, out):
    torch.onnx.export(Scores(net.cpu()), torch.zeros(2, WIN), out, input_names=['audio'], output_names=['scores'],
                      dynamic_axes={'audio': {0: 'slices'}, 'scores': {0: 'slices'}}, opset_version=17, dynamo=False)


def main():
    REPORT.mkdir(parents=True, exist_ok=True)
    test, val = rows('test'), rows('val')
    sizes = {}
    for size in ('mn04', 'mn10'):
        ap, _, _ = evaluate(load_net(size), test)
        export(load_net(size), REPORT / f'{size}.onnx')
        sizes[size] = {'map': round(float(np.nanmean(list(ap.values()))), 4),
                       'mb': round((REPORT / f'{size}.onnx').stat().st_size / 1e6, 1), 'ap': ap}
        print(size, sizes[size]['map'], f"{sizes[size]['mb']} MB", flush=True)
    size = 'mn10' if sizes['mn10']['map'] - sizes['mn04']['map'] >= MN10_MARGIN else 'mn04'
    net = load_net(size)
    _, Sv, Yv = evaluate(net, val)
    thresholds = [best_threshold(Yv[:, i], Sv[:, i]) for i in range(len(CLASSES))]
    # Clip-level mix-ups on test: a sound it said that the clip doesn't have, next to what the clip does have.
    _, St, Yt = evaluate(net, test)
    confusions = Counter()
    for s, y in zip(St, Yt):
        for i in np.where((s >= thresholds) & (y == 0))[0]:
            for j in np.where(y == 1)[0]:
                confusions[(CLASSES[j], CLASSES[i])] += 1
    # Timing on synthetic clips with known times.
    synth = json.loads((DATA / 'synth' / 'truth.json').read_text(encoding='utf8'))
    TP = FP = FN = 0
    errs = []
    for clip in synth:
        x = load(DATA / 'synth' / clip['file'])
        pred = events(clip_scores(net, x), thresholds, len(x) / SR, CLASSES)
        tp, fp, fn, err = match(clip['events'], pred)
        TP, FP, FN, errs = TP + tp, FP + fp, FN + fn, errs + err
    p, r = TP / max(1, TP + FP), TP / max(1, TP + FN)
    # The exported file must give PyTorch's answers, batch of one included.
    onnx = REPORT / f'{size}.onnx'
    sess = ort.InferenceSession(str(onnx), providers=['CPUExecutionProvider'])
    firsts = [load(path(r))[:WIN] for r in test[:3]]
    xs = np.stack([np.pad(x, (0, WIN - len(x))) for x in firsts]).astype(np.float32)
    got = sess.run(None, {'audio': xs})[0]
    want = torch.sigmoid(net.cpu()(torch.from_numpy(xs))).detach().numpy()
    assert got.shape == (3, len(CLASSES)) and np.abs(got - want).max() < 1e-4, np.abs(got - want).max()
    assert sess.run(None, {'audio': xs[:1]})[0].shape == (1, len(CLASSES))
    shutil.copy2(onnx, REPORT / 'sound-detective-v1.onnx')
    shutil.copy2(onnx, SITE_MODEL)
    report = {'size': size, 'sizes': {k: {'map': v['map'], 'mb': v['mb']} for k, v in sizes.items()},
              'per_sound': {c: round(v, 4) for c, v in sizes[size]['ap'].items()}, 'thresholds': thresholds,
              'timeline': {'precision': round(p, 3), 'recall': round(r, 3), 'f1': round(2 * p * r / max(1e-9, p + r), 3),
                           'onset_error_s': round(float(np.mean(errs)), 2) if errs else None, 'clips': len(synth)},
              'test_clips': len(test),
              'confusions': [{'truth': a, 'said': b, 'count': n} for (a, b), n in confusions.most_common(10)]}
    (REPORT / 'metrics.json').write_text(json.dumps(report, indent=1), encoding='utf8')
    print(json.dumps({k: report[k] for k in ('size', 'sizes', 'timeline')}, indent=1))


if __name__ == '__main__':
    main()
