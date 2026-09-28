"""Fine-tune EfficientAT (AudioSet-pretrained MobileNet) on 1 s slices of our sounds.

Multi-label: one sigmoid per sound, so overlapping sounds are both "on". Augmentation (training only): a second clip
mixed in half the time (labels combined: teaches overlap), gain -12..+6 dB, background noise 30% of the time.
Crops of labelled clips favour loud parts (FSD50K says which sounds, not when). Balanced sampling so rare sounds
are seen as often as common ones; negatives make up about a fifth of each batch. The best epoch is picked on the
validation clips (mean average precision, clip-level: a clip's score is its highest slice); test clips are untouched.
Audio is read from disk per crop (only a loudness envelope per clip stays in memory).
Usage: python sounds_train.py <mn04|mn10>
"""
import csv
import json
import sys

import numpy as np
import soundfile as sf
import torch
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

from sounds_common import CLASSES, DATA, RUNS, SR, WIN, window_starts
from sounds_model import Net

EPOCHS, BATCH, STEPS_PER_EPOCH = 40, 64, 400
HOP = SR // 10  # loudness envelope resolution


def load(path):
    x, sr = sf.read(path, dtype='float32')
    assert sr == SR, (path, sr)
    return x


def envelope(x):
    return np.array([np.sqrt(np.mean(x[i:i + HOP] ** 2) + 1e-10) for i in range(0, len(x), HOP)])


def crop_start(n, env, rng, weighted):
    """Where a 1 s crop of an n-sample clip starts (only called when n > WIN)."""
    starts = n - WIN + 1
    if not weighted:
        return int(rng.integers(0, starts))
    centre = rng.choice(len(env), p=env / env.sum()) * HOP + HOP // 2
    return int(np.clip(centre - WIN // 2 + rng.integers(-SR // 4, SR // 4 + 1), 0, starts - 1))


def pad(x, rng):
    out = np.zeros(WIN, np.float32)
    at = rng.integers(0, WIN - len(x) + 1)
    out[at:at + len(x)] = x
    return out


def crop(x, rng, weighted):
    if len(x) <= WIN:
        return pad(x, rng)
    at = crop_start(len(x), envelope(x), rng, weighted)
    return x[at:at + WIN].copy()


def target(sounds):
    y = np.zeros(len(CLASSES), np.float32)
    for s in filter(None, sounds.split('|')):
        y[CLASSES.index(s)] = 1
    return y


def rows(split):
    return [r for r in csv.DictReader(open(DATA / 'clips.csv', encoding='utf8')) if r['split'] == split]


def path(r):
    return DATA / 'audio' / r['split'] / f"{r['fname']}.wav"


class Slices(Dataset):
    def __init__(self, clips, seed=0):
        self.clips, self.rng = clips, np.random.default_rng(seed)
        self.y = [target(r['sounds']) for r in clips]
        self.n, self.env = [], []
        for r in clips:
            x = load(path(r))
            self.n.append(len(x))
            self.env.append(envelope(x) if self.y[len(self.n) - 1].any() and len(x) > WIN else None)

    def __len__(self):
        return STEPS_PER_EPOCH * BATCH

    def one(self, i):
        p, n = path(self.clips[i]), self.n[i]
        if n <= WIN:
            return pad(load(p), self.rng), self.y[i]
        at = crop_start(n, self.env[i], self.rng, weighted=self.env[i] is not None)
        x, _ = sf.read(p, start=at, stop=at + WIN, dtype='float32')
        return x, self.y[i]

    def __getitem__(self, i):
        x, y = self.one(i)
        if self.rng.random() < 0.5:
            x2, y2 = self.one(self.rng.integers(len(self.clips)))
            x, y = x + x2 * self.rng.uniform(0.3, 1.0), np.maximum(y, y2)
        x = x * 10 ** (self.rng.uniform(-12, 6) / 20)
        if self.rng.random() < 0.3:
            rms = np.sqrt(np.mean(x ** 2) + 1e-10)
            x = x + self.rng.standard_normal(WIN).astype(np.float32) * rms / 10 ** (self.rng.uniform(10, 30) / 20)
        return np.clip(x, -1, 1).astype(np.float32), y


def weights(clips):
    count = np.zeros(len(CLASSES))
    for r in clips:
        count += target(r['sounds'])
    n_neg = sum(1 for r in clips if not r['sounds'])
    w = []
    for r in clips:
        y = target(r['sounds'])
        w.append((1 / count[y > 0]).max() if y.any() else 0.25 * len(CLASSES) / n_neg)
    return w


@torch.no_grad()
def clip_scores(net, x):
    xs = [np.pad(x[s:s + WIN], (0, max(0, s + WIN - len(x)))) for s in window_starts(len(x))]
    dev = next(net.parameters()).device
    return torch.sigmoid(net(torch.from_numpy(np.stack(xs)).to(dev))).cpu().numpy()


def average_precision(y, s):
    """Mean precision at each true clip's rank (nan when a sound has no true clips)."""
    order = np.argsort(-s, kind='stable')
    y = y[order]
    if y.sum() == 0:
        return float('nan')
    hits = np.cumsum(y)
    return float(np.mean((hits / np.arange(1, len(y) + 1))[y == 1]))


def evaluate(net, clips):
    """Clip-level AP per sound (a clip's score is its highest slice). Reads each clip from disk as it goes."""
    net.eval()
    S = np.stack([clip_scores(net, load(path(r))).max(0) for r in clips])
    Y = np.stack([target(r['sounds']) for r in clips])
    return {c: average_precision(Y[:, i], S[:, i]) for i, c in enumerate(CLASSES)}, S, Y


def main(size):
    torch.manual_seed(0)
    out = RUNS / f'sounds-v1-{size}'
    out.mkdir(parents=True, exist_ok=True)
    train, val = rows('train'), rows('val')
    data = Slices(train)
    loader = DataLoader(data, batch_size=BATCH, sampler=WeightedRandomSampler(weights(train), len(data), generator=torch.Generator().manual_seed(0)), num_workers=0)
    net = Net(size, classes=len(CLASSES)).cuda()
    head = list(net.backbone.classifier.parameters())
    body = [p for p in net.parameters() if all(p is not h for h in head)]
    opt = torch.optim.AdamW([{'params': body, 'lr': 1e-4}, {'params': head, 'lr': 1e-3}], weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, EPOCHS)
    loss_fn = torch.nn.BCEWithLogitsLoss()
    best, log = -1.0, []
    for epoch in range(EPOCHS):
        net.train()
        total = 0.0
        for x, y in loader:
            opt.zero_grad()
            loss = loss_fn(net(x.cuda()), y.cuda())
            loss.backward()
            opt.step()
            total += loss.item()
        sched.step()
        ap, _, _ = evaluate(net, val)
        m = float(np.nanmean(list(ap.values())))
        log.append({'epoch': epoch, 'loss': total / len(loader), 'val_map': m})
        print(f'epoch {epoch}: loss {total / len(loader):.4f} val mAP {m:.3f}', flush=True)
        if m > best:
            best = m
            torch.save(net.state_dict(), out / 'best.pt')
        (out / 'log.json').write_text(json.dumps(log, indent=1))
    print('best val mAP', round(best, 3))


if __name__ == '__main__':
    main(sys.argv[1])
