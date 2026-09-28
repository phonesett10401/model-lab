# Sound detective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train a 16-sound event detector on licence-clean FSD50K (+ Freesound top-up) audio and ship it as model No. 4 of the lab: record, upload or listen live, and see which sounds happen when, on lanes, entirely in the browser.

**Architecture:** Python pipeline in `training/` (select → download → top-up → train EfficientAT MobileNet → evaluate → export ONNX → pick examples → site JSON). The ONNX file takes raw 32 kHz audio slices (1 s) and contains the spectrogram as fixed convolution layers, so the browser only decodes and slices audio. The site reuses the Sea creature detector's engine loading, adds an `events` task (timeline lanes + event list), and a live mode that streams mic audio through the same scoring and event-merging code.

**Tech Stack:** Python 3.12 + PyTorch 2.11 (conda env `modellab-train`), EfficientAT (MIT, vendored), soundfile, scipy, huggingface_hub, onnxruntime; SvelteKit 2 + Svelte 5 runes + TypeScript, onnxruntime-web 1.30 (WASM), Web Audio (OfflineAudioContext, AudioWorklet), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-sound-detective-design.md`

**Spec deviation (decided while planning, recorded in the spec by Task 3):** the spec put the log-mel spectrogram in JS (`mel.ts`). This plan bakes it into the ONNX model as fixed conv layers instead, so the browser cannot compute it differently from training. Same behaviour, one less thing to keep in sync; the parity tests still run end to end.

## Global Constraints

- Python: `C:\Users\phone\miniconda3\envs\modellab-train\python.exe` (below: `PY`). Run training scripts from `training/`.
- Keys only from `training/.env` (`HF_TOKEN`, `FREESOUND_API_KEY`); never print or commit them.
- Licences kept: CC0 and CC BY only (FSD50K metadata URLs `http://creativecommons.org/publicdomain/zero/1.0/` and `http://creativecommons.org/licenses/by/3.0/`; Freesound top-up: any `/publicdomain/zero/` or `/licenses/by/` URL). Never BY-NC or Sampling+.
- Audio format everywhere after download: 32 kHz mono. Slice (window) = 1 s = 32000 samples; step = 0.5 s = 16000 samples. Clips longer than 30 s: training drops them; the site examines only the first 30 s. Site minimum clip: 0.5 s.
- Numbers on the site come only from scripts (`sounds_pick_examples.py` writes `src/lib/data/sound-detective.json`). Never type a metric.
- Data, audio, runs, weights, vendor code stay git-ignored. Attribution for every training clip: `training/attribution/sounds-v1.csv` (committed).
- Commits: no `Co-Authored-By` / Claude attribution lines. Never `git push` without the owner's yes (pushing `master` deploys production).
- Entry: slug `sound-detective`, no. 4, name "Sound detective", `input: 'audio'`, `task: 'events'`.
- Copy: "No sounds it knows" (nothing found); "Too short to hear anything. Record a little longer."; "Only the first 30 seconds were checked."; "Your device is busy, some moments were skipped."; live stops after 2 minutes, when the tab is hidden, or on leaving the page.
- Sound list and order (the model's output order):
  `dog bark, cat meow, doorbell, knocking, running tap, keyboard typing, glass breaking, siren, car horn, engine / traffic, rain, thunder, clapping, crying, laughing, footsteps, speech`
  (17 entries: the spec's table lists 16 names but "engine / traffic" is one sound; the table has 7 home + 3 street + 2 weather + 5 people = 17. Ruling made in planning: ship all 17 that pass the clip minimum; the spec's "16" is a miscount of its own table.)

## Review Focus

1. **A recording with long silence then one short sound** (a single knock at 9 s of a 15 s clip): expect exactly one event near 9 s, no events elsewhere. Pinned by the synthetic timeline evaluation (Task 8/9) and the events shared cases (Task 6, "single window in middle").
2. **Phone recordings (WebM/Opus from MediaRecorder, 48 kHz)** decode and resample in the browser: expect the same result path as uploads. Pinned in Task 14 e2e by uploading a WebM made from a sample clip (Chromium) — decode path identical to recording.
3. **A 44.1 kHz stereo upload**: expect mono mix + resample, results close to the 32 kHz original. Pinned in Task 14 e2e (stereo fixture, same labels as the source sample).
4. **Starting live listening before the model is downloaded**: expect the progress bar first, then listening begins (no lost first seconds, no crash). Pinned in Task 15 e2e ("live waits for the download").
5. **Leaving the page while listening**: the mic must turn off (no live tracks). Pinned in Task 15 e2e (navigate away → zero live tracks), mirroring `e2e/mic.e2e.ts`.

---

## Part A — Training pipeline

### Task 1: Environment, vendored EfficientAT, shared settings

**Files:**
- Create: `training/sounds_common.py`
- Create: `training/test_sounds_common.py`
- Modify: `.gitignore` (add `training/vendor/`)

**Interfaces:**
- Produces: `sounds_common` constants `HERE, DATA, RUNS, VENDOR, SR=32000, WIN=32000, STEP=16000, MAX_SECONDS=30, SOUNDS (ordered dict sound→[FSD50K labels]), CLASSES (list), OK_FSD_LICENCES (set), fsd_ok(url)->bool, topup_ok(url)->bool, window_starts(n)->list[int], efficientat()` (adds VENDOR to `sys.path` and returns `get_mn`).

- [ ] **Step 1: Install packages and vendor EfficientAT**

```bash
PY=C:/Users/phone/miniconda3/envs/modellab-train/python.exe
$PY -m pip install soundfile scipy "torchaudio==2.11.0" --index-url https://download.pytorch.org/whl/cu128 --extra-index-url https://pypi.org/simple
git clone --depth 1 https://github.com/fschmid56/EfficientAT training/vendor/EfficientAT
git -C training/vendor/EfficientAT rev-parse HEAD
```
Expected: installs succeed; a commit hash prints (record it in the ledger — the pinned version).

Append to `.gitignore` under the model-training block:
```
training/vendor/
```

- [ ] **Step 2: Write the failing test**

`training/test_sounds_common.py`:
```python
"""Checks for shared Sound detective settings. Run: python test_sounds_common.py"""
import sounds_common as c

assert c.CLASSES[0] == 'dog bark' and c.CLASSES[-1] == 'speech' and len(c.CLASSES) == 17, c.CLASSES
assert c.fsd_ok('http://creativecommons.org/licenses/by/3.0/')
assert c.fsd_ok('http://creativecommons.org/publicdomain/zero/1.0/')
assert not c.fsd_ok('http://creativecommons.org/licenses/by-nc/3.0/')
assert not c.fsd_ok('http://creativecommons.org/licenses/sampling+/1.0/')
assert c.topup_ok('https://creativecommons.org/licenses/by/4.0/')
assert c.topup_ok('http://creativecommons.org/publicdomain/zero/1.0/')
assert not c.topup_ok('http://creativecommons.org/licenses/by-nc/4.0/')
# Slices: one for anything up to 1 s; then every 0.5 s until the tail is covered (last one zero-padded).
assert c.window_starts(100) == [0]
assert c.window_starts(32000) == [0]
assert c.window_starts(48000) == [0, 16000]
assert c.window_starts(50000) == [0, 16000, 32000]
get_mn = c.efficientat()
assert callable(get_mn)
print('common checks passed')
```

- [ ] **Step 3: Run it to verify it fails**

Run (from `training/`): `$PY test_sounds_common.py`
Expected: `ModuleNotFoundError: No module named 'sounds_common'`

- [ ] **Step 4: Write `training/sounds_common.py`**

```python
"""Shared settings for the Sound detective pipeline (model No. 4)."""
import math
import sys
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / 'data' / 'sounds-v1'
RUNS = HERE / 'runs'
VENDOR = HERE / 'vendor' / 'EfficientAT'
SR = 32000
WIN = SR          # 1 s slices
STEP = SR // 2    # a slice every 0.5 s
MAX_SECONDS = 30

# Our sound -> the FSD50K labels (AudioSet ontology) that count as it. Order = the model's output order.
SOUNDS = {
    'dog bark': ['Bark'],
    'cat meow': ['Meow'],
    'doorbell': ['Doorbell'],
    'knocking': ['Knock'],
    'running tap': ['Water_tap_and_faucet'],
    'keyboard typing': ['Computer_keyboard'],
    'glass breaking': ['Shatter'],
    'siren': ['Siren'],
    'car horn': ['Vehicle_horn_and_car_horn_and_honking'],
    'engine / traffic': ['Traffic_noise_and_roadway_noise', 'Car_passing_by', 'Idling', 'Engine_starting',
                         'Accelerating_and_revving_and_vroom'],
    'rain': ['Rain', 'Raindrop'],
    'thunder': ['Thunder'],
    'clapping': ['Clapping', 'Applause'],
    'crying': ['Crying_and_sobbing'],
    'laughing': ['Laughter'],
    'footsteps': ['Walk_and_footsteps'],
    'speech': ['Speech'],
}
CLASSES = list(SOUNDS)
OK_FSD_LICENCES = {'http://creativecommons.org/licenses/by/3.0/', 'http://creativecommons.org/publicdomain/zero/1.0/'}


def fsd_ok(url):
    return url in OK_FSD_LICENCES


def topup_ok(url):
    """Freesound licence URLs vary in scheme and version; allow CC0 and plain CC BY only."""
    return '/publicdomain/zero/' in url or ('/licenses/by/' in url)


def window_starts(n):
    """Start sample of every 1 s slice for a clip of n samples (same rule as src/lib/runtime/audio.ts)."""
    count = 1 if n <= WIN else math.ceil((n - WIN) / STEP) + 1
    return [i * STEP for i in range(count)]


def efficientat():
    """EfficientAT's MobileNet factory (vendored at training/vendor/EfficientAT, MIT licence)."""
    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))
    from models.mn.model import get_model
    return get_model
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `$PY test_sounds_common.py`
Expected: `common checks passed`. If the EfficientAT import fails on `ConvNormActivation` (newer torchvision), add in `efficientat()` before the import: `import torchvision.ops.misc as m; m.ConvNormActivation = getattr(m, 'ConvNormActivation', m.Conv2dNormActivation)` and ledger a ruling.

- [ ] **Step 6: Commit**

```bash
git add .gitignore training/sounds_common.py training/test_sounds_common.py
git commit -m "feat(training): sound detective shared settings and vendored EfficientAT"
```

### Task 2: Clip selection (FSD50K)

**Files:**
- Create: `training/sounds_select.py`
- Create: `training/test_sounds_select.py`

**Interfaces:**
- Consumes: `sounds_common.SOUNDS, CLASSES, fsd_ok`.
- Produces: `select(dev_rows, eval_rows, dev_info, eval_info, seed=0) -> list[dict]` with keys `fname, split ('train'|'val'|'test'), source ('fsd50k'), sounds ('|'-joined, '' for negatives), licence, uploader, url, fsd_split ('dev'|'eval')`; writes `DATA/selection.csv` when run as a script; constants `MAX_PER_SOUND=1000, NEG_TRAIN=3000, NEG_VAL=300, NEG_TEST=2000, AMBIGUOUS`.

- [ ] **Step 1: Write the failing test**

`training/test_sounds_select.py`:
```python
"""Checks for the FSD50K selection rules. Run: python test_sounds_select.py"""
import sounds_select as sel

BY = 'http://creativecommons.org/licenses/by/3.0/'
NC = 'http://creativecommons.org/licenses/by-nc/3.0/'


def row(fname, labels, split='train'):
    return {'fname': fname, 'labels': ','.join(labels), 'split': split}


def info(lic=BY):
    return {'license': lic, 'uploader': 'someone'}


dev = [row('1', ['Bark', 'Dog', 'Animal']), row('2', ['Bark'], 'val'), row('3', ['Bark']),
       row('4', ['Music', 'Guitar']),                       # a clean negative
       row('5', ['Human_voice']),                           # ambiguous: might hide speech, never a negative
       row('6', ['Meow', 'Speech']),                        # two sounds at once
       row('7', ['Laughter'])]
dev_info = {'1': info(), '2': info(), '3': info(NC), '4': info(), '5': info(), '6': info(), '7': info('http://creativecommons.org/licenses/sampling+/1.0/')}
ev = [row('10', ['Bark']), row('11', ['Music'])]
ev_info = {'10': info(), '11': info()}

out = {r['fname']: r for r in sel.select(dev, [{k: v for k, v in r.items() if k != 'split'} for r in ev], dev_info, ev_info)}
assert out['1']['sounds'] == 'dog bark' and out['1']['split'] == 'train', out['1']
assert out['2']['split'] == 'val'
assert '3' not in out and '7' not in out            # BY-NC and Sampling+ are dropped
assert out['4']['sounds'] == '' and out['4']['split'] == 'train'   # negative
assert '5' not in out                                # ambiguous parent label
assert out['6']['sounds'] == 'cat meow|speech'
assert out['10']['split'] == 'test' and out['11']['sounds'] == ''
assert out['1']['url'] == 'https://freesound.org/s/1/'
# Caps: never more than MAX_PER_SOUND train clips of one sound, chosen reproducibly.
many = [row(str(100 + i), ['Speech']) for i in range(sel.MAX_PER_SOUND + 50)]
many_info = {r['fname']: info() for r in many}
a = [r['fname'] for r in sel.select(many, [], many_info, {}) if r['split'] == 'train']
b = [r['fname'] for r in sel.select(many, [], many_info, {}) if r['split'] == 'train']
assert len(a) == sel.MAX_PER_SOUND and a == b
print('selection checks passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_select.py`
Expected: `ModuleNotFoundError: No module named 'sounds_select'`

- [ ] **Step 3: Write `training/sounds_select.py`**

```python
"""Pick FSD50K clips for the Sound detective: our 17 sounds plus "nothing I know" negatives.

Rules: licence CC0 or CC BY only; a clip counts as every sound it's labelled with (several at once is fine);
negatives are clips with none of our sounds AND none of the broad labels that could hide one (AMBIGUOUS);
FSD50K's own split is kept (dev train/val -> train/val, eval -> test), so test clips never reach training.
Train clips per sound are capped so a common sound (speech) can't drown the rest.

Usage: python sounds_select.py   (writes data/sounds-v1/selection.csv)
"""
import csv
import json
import random

from huggingface_hub import hf_hub_download

from sounds_common import CLASSES, DATA, SOUNDS, fsd_ok

REPO = 'Fhrozen/FSD50k'
MAX_PER_SOUND = 1000
NEG_TRAIN, NEG_VAL, NEG_TEST = 3000, 300, 2000
# Parent labels that may contain one of our sounds without naming it: such clips are never negatives.
AMBIGUOUS = {'Human_voice', 'Human_group_actions', 'Typing', 'Dog', 'Cat', 'Domestic_animals_and_pets', 'Glass',
             'Door', 'Car', 'Motor_vehicle_(road)', 'Vehicle', 'Engine', 'Thunderstorm', 'Water', 'Crowd', 'Chatter',
             'Conversation', 'Alarm', 'Domestic_sounds_and_home_sounds', 'Hands', 'Tap', 'Liquid'}
FIELDS = ['fname', 'split', 'source', 'sounds', 'licence', 'uploader', 'url', 'fsd_split']


def sounds_of(labels):
    return [c for c in CLASSES if labels & set(SOUNDS[c])]


def select(dev_rows, eval_rows, dev_info, eval_info, seed=0):
    rng = random.Random(seed)
    pos, neg = [], {'train': [], 'val': [], 'test': []}
    for rows, meta, fsd in ((dev_rows, dev_info, 'dev'), (eval_rows, eval_info, 'eval')):
        for r in rows:
            m = meta[r['fname']]
            if not fsd_ok(m['license']):
                continue
            labels = set(r['labels'].split(','))
            split = r['split'] if fsd == 'dev' else 'test'
            rec = {'fname': r['fname'], 'split': split, 'source': 'fsd50k', 'licence': m['license'],
                   'uploader': m['uploader'], 'url': f"https://freesound.org/s/{r['fname']}/", 'fsd_split': fsd}
            found = sounds_of(labels)
            if found:
                pos.append({**rec, 'sounds': '|'.join(found)})
            elif not labels & AMBIGUOUS:
                neg[split].append({**rec, 'sounds': ''})
    # Cap train clips per sound: shuffle once, then keep a clip while every sound on it is under the cap.
    rng.shuffle(pos)
    kept, per = [], {c: 0 for c in CLASSES}
    for r in pos:
        s = r['sounds'].split('|')
        if r['split'] == 'train' and any(per[c] >= MAX_PER_SOUND for c in s):
            continue
        if r['split'] == 'train':
            for c in s:
                per[c] += 1
        kept.append(r)
    for split, cap in (('train', NEG_TRAIN), ('val', NEG_VAL), ('test', NEG_TEST)):
        rng.shuffle(neg[split])
        kept += neg[split][:cap]
    return sorted(kept, key=lambda r: (r['split'], int(r['fname'])))


def load():
    get = lambda p: hf_hub_download(REPO, p, repo_type='dataset')
    rows = lambda p: list(csv.DictReader(open(get(p), encoding='utf8')))
    info = lambda p: json.load(open(get(p), encoding='utf8'))
    return (rows('labels/dev.csv'), rows('labels/eval.csv'),
            info('metadata/dev_clips_info_FSD50K.json'), info('metadata/eval_clips_info_FSD50K.json'))


if __name__ == '__main__':
    picked = select(*load())
    DATA.mkdir(parents=True, exist_ok=True)
    with open(DATA / 'selection.csv', 'w', newline='', encoding='utf8') as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        w.writerows(picked)
    for split in ('train', 'val', 'test'):
        n = {c: sum(1 for r in picked if r['split'] == split and c in r['sounds'].split('|')) for c in CLASSES}
        print(split, n, 'negatives', sum(1 for r in picked if r['split'] == split and not r['sounds']))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$PY test_sounds_select.py`
Expected: `selection checks passed`

- [ ] **Step 5: Run the selection**

Run: `HF_HUB_DISABLE_SYMLINKS_WARNING=1 $PY sounds_select.py`
Expected: three lines of counts per split. Planning-time counts (before the cap and negatives) were roughly dev: dog bark 149, cat meow 136, doorbell 96, keyboard typing 109, siren 68, car horn 104, crying 81, others ≥ 224. Train counts below 150 are expected for those seven; Task 5 tops them up.

- [ ] **Step 6: Commit**

```bash
git add training/sounds_select.py training/test_sounds_select.py
git commit -m "feat(training): FSD50K clip selection for the sound detective"
```

### Task 3: Spectrogram front end as fixed layers

**Files:**
- Create: `training/sounds_model.py`
- Create: `training/test_sounds_model.py`
- Modify: `docs/superpowers/specs/2026-09-29-sound-detective-design.md` (record the deviation)

**Interfaces:**
- Consumes: `sounds_common.SR, WIN, efficientat`.
- Produces: `kaldi_mel_banks(n_mels, n_fft, sr, low, high) -> np.ndarray [n_mels, n_fft//2+1]`; `Frontend(nn.Module)`: `forward(audio [B,T] float) -> [B,128,frames]`; `Net(nn.Module)`: `Net(size='mn04'|'mn10', classes=17, pretrained=True)`, `forward(audio [B,WIN]) -> logits [B,classes]`; `SIZES = {'mn04': ('mn04_as', 0.4), 'mn10': ('mn10_as', 1.0)}`; `audioset_net(size) -> Net` with EfficientAT's 527-class AudioSet head (used by Task 5).

- [ ] **Step 1: Write the failing test**

`training/test_sounds_model.py`:
```python
"""The ONNX-friendly front end must equal EfficientAT's own AugmentMelSTFT (eval mode). Run: python test_sounds_model.py"""
import sys

import numpy as np
import torch

import sounds_common as c
import sounds_model as m

sys.path.insert(0, str(c.VENDOR))
from models.preprocess import AugmentMelSTFT  # the reference the pretrained weights were trained with

ref = AugmentMelSTFT(n_mels=128, sr=32000, win_length=800, hopsize=320, n_fft=1024, freqm=0, timem=0).eval()
ours = m.Frontend().eval()
torch.manual_seed(0)
for n in (c.WIN, 20000, 47123):
    x = torch.randn(2, n) * 0.1
    a, b = ref(x), ours(x)
    assert a.shape == b.shape, (a.shape, b.shape)
    assert torch.allclose(a, b, atol=1e-3), (a - b).abs().max()
net = m.Net('mn04', classes=len(c.CLASSES)).eval()
with torch.no_grad():
    y1, y3 = net(torch.zeros(1, c.WIN)), net(torch.randn(3, c.WIN) * 0.1)
assert y1.shape == (1, 17) and y3.shape == (3, 17), (y1.shape, y3.shape)
print('model checks passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_model.py`
Expected: `ModuleNotFoundError: No module named 'sounds_model'`

- [ ] **Step 3: Write `training/sounds_model.py`**

```python
"""The Sound detective network: EfficientAT's MobileNet with its spectrogram front end rewritten as fixed layers.

Frontend reproduces EfficientAT's AugmentMelSTFT in eval mode (pre-emphasis, 1024-point STFT with an 800-sample
Hann window every 320 samples, Kaldi mel banks 0-15 kHz, log, fast normalisation) using only conv/pad/matmul,
so the whole thing exports to one ONNX file and the browser feeds it raw 32 kHz audio.
"""
import math

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

from sounds_common import SR, efficientat

SIZES = {'mn04': ('mn04_as', 0.4), 'mn10': ('mn10_as', 1.0)}


def kaldi_mel_banks(n_mels, n_fft, sr, low, high):
    """torchaudio.compliance.kaldi.get_mel_banks (no VTLN warp), padded with a zero column like EfficientAT does."""
    mel = lambda f: 1127.0 * np.log(1.0 + f / 700.0)
    bins = n_fft // 2
    ml, mh = mel(low), mel(high)
    delta = (mh - ml) / (n_mels + 1)
    b = np.arange(n_mels)[:, None]
    left, center, right = ml + b * delta, ml + (b + 1) * delta, ml + (b + 2) * delta
    m = mel(sr / n_fft * np.arange(bins))[None, :]
    up, down = (m - left) / (center - left), (right - m) / (right - center)
    return np.pad(np.maximum(0.0, np.minimum(up, down)), ((0, 0), (0, 1)))


class Frontend(nn.Module):
    def __init__(self, sr=SR, n_fft=1024, win=800, hop=320, n_mels=128):
        super().__init__()
        self.n_fft, self.hop, self.off = n_fft, hop, (n_fft - win) // 2  # torch.stft centres a short window in the frame
        w = torch.hann_window(win, periodic=False, dtype=torch.float64)
        k = torch.arange(n_fft // 2 + 1, dtype=torch.float64)[:, None]
        n = torch.arange(win, dtype=torch.float64)[None, :] + self.off
        ang = 2 * math.pi * k * n / n_fft
        self.register_buffer('basis', torch.cat([torch.cos(ang) * w, -torch.sin(ang) * w]).float()[:, None, :])
        fmax = sr // 2 - 1000  # EfficientAT: fmax=None with fmax_aug_range=2000
        self.register_buffer('mel', torch.from_numpy(kaldi_mel_banks(n_mels, n_fft, sr, 0.0, fmax)).float())
        self.register_buffer('pre', torch.tensor([[[-0.97, 1.0]]]))

    def forward(self, audio):
        x = F.conv1d(audio[:, None, :], self.pre)                      # pre-emphasis: [B,1,T-1]
        frames = x.shape[-1] // self.hop + 1
        x = F.pad(x, (self.n_fft // 2, self.n_fft // 2), mode='reflect')[..., self.off:]
        spec = F.conv1d(x, self.basis, stride=self.hop)[..., :frames]  # [B, 2*513, frames]: real then imaginary
        half = spec.shape[1] // 2
        power = spec[:, :half] ** 2 + spec[:, half:] ** 2
        return (torch.log(torch.matmul(self.mel, power) + 1e-5) + 4.5) / 5.0


class Net(nn.Module):
    """Raw 1 s audio in, one logit per sound out. Calls features + classifier directly: EfficientAT's forward()
    squeezes, which would drop the batch axis for a batch of one in an exported graph."""

    def __init__(self, size='mn04', classes=17, pretrained=True):
        super().__init__()
        name, width = SIZES[size]
        self.front = Frontend()
        self.backbone = efficientat()(num_classes=classes, pretrained_name=name if pretrained else None, width_mult=width)

    def forward(self, audio):
        x = self.front(audio)[:, None]  # [B,1,128,frames]
        return self.backbone.classifier(self.backbone.features(x))


def audioset_net(size='mn10'):
    """The pretrained 527-class AudioSet model, used to double-check Freesound top-up clips."""
    net = Net(size, classes=527)
    return net
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$PY test_sounds_model.py`
Expected: `model checks passed` (first run downloads the mn04 weights from EfficientAT's GitHub releases). If the atol fails by a small margin (< 5e-3) because of float32 DFT round-off, ledger a ruling and keep atol at the measured max ×2; a larger gap is a bug (check the window offset and reflect padding).

- [ ] **Step 5: Record the deviation in the spec**

In the spec's §4 runtime list, replace step 2 (`Log-mel spectrogram in JS (src/lib/runtime/mel.ts), matching Python's numbers.`) with:
```
2. The spectrogram is part of the ONNX model (fixed conv layers equal to EfficientAT's front end, tested in `training/test_sounds_model.py`), so the browser only decodes, resamples and slices audio.
```
and in §5 replace `mel matches Python reference values on a fixed clip;` with `slicing matches Python's window_starts;`.

- [ ] **Step 6: Commit**

```bash
git add training/sounds_model.py training/test_sounds_model.py docs/superpowers/specs/2026-09-29-sound-detective-design.md
git commit -m "feat(training): spectrogram front end as fixed layers, equal to EfficientAT's"
```

### Task 4: Download and resample the selected clips

**Files:**
- Create: `training/sounds_download.py`

**Interfaces:**
- Consumes: `DATA/selection.csv` (Task 2), `sounds_common`.
- Produces: `DATA/audio/<split>/<fname>.wav` (32 kHz mono int16); `DATA/clips.csv` with columns `fname, split, source, sounds, licence, uploader, url, seconds` (rows only for clips kept: ≤ 30 s, readable); `to_32k(x, sr) -> np.ndarray float32 mono`.

- [ ] **Step 1: Write the script**

```python
"""Download the selected FSD50K clips one by one from the Hugging Face mirror, convert to 32 kHz mono, drop clips
over 30 s. Resumable: clips already on disk are skipped. Usage: python sounds_download.py"""
import csv
import os
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from dotenv import load_dotenv
from huggingface_hub import hf_hub_download
from scipy.signal import resample_poly

from sounds_common import DATA, HERE, MAX_SECONDS, SR

load_dotenv(HERE / '.env')
REPO = 'Fhrozen/FSD50k'
FIELDS = ['fname', 'split', 'source', 'sounds', 'licence', 'uploader', 'url', 'seconds']


def to_32k(x, sr):
    x = x.mean(axis=1) if x.ndim == 2 else x
    if sr != SR:
        g = gcd(SR, sr)
        x = resample_poly(x, SR // g, sr // g)
    return np.clip(x, -1, 1).astype(np.float32)


def fetch(r):
    out = DATA / 'audio' / r['split'] / f"{r['fname']}.wav"
    if not out.exists():
        with tempfile.TemporaryDirectory() as tmp:
            p = hf_hub_download(REPO, f"clips/{r['fsd_split']}/{r['fname']}.wav", repo_type='dataset',
                                local_dir=tmp, token=os.getenv('HF_TOKEN') or None)
            x, sr = sf.read(p, dtype='float32')
            if len(x) / sr > MAX_SECONDS:
                return None
            out.parent.mkdir(parents=True, exist_ok=True)
            sf.write(out, to_32k(x, sr), SR, subtype='PCM_16')
    seconds = sf.info(out).duration
    return {k: r[k] for k in FIELDS[:-1]} | {'seconds': f'{seconds:.3f}'}


if __name__ == '__main__':
    rows = list(csv.DictReader(open(DATA / 'selection.csv', encoding='utf8')))
    with ThreadPoolExecutor(8) as pool:
        done = [x for x in pool.map(fetch, rows) if x]
    with open(DATA / 'clips.csv', 'w', newline='', encoding='utf8') as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        w.writerows(done)
    print(f'kept {len(done)} of {len(rows)} clips (the rest were over {MAX_SECONDS} s)')
```

- [ ] **Step 2: Try it on 20 clips first**

Temporarily run with a slice: `$PY -c "import sounds_download as d, csv; rows=list(csv.DictReader(open(d.DATA/'selection.csv',encoding='utf8')))[:20]; print([d.fetch(r) for r in rows][:2])"`
Expected: two dicts with `seconds`; files exist under `data/sounds-v1/audio/`; `sf.info` of one shows 32000 Hz, 1 channel.

- [ ] **Step 3: Run the full download in the background**

Run: `$PY sounds_download.py > sounds-download.log 2>&1` (background; roughly 12–15k clips, a few GB).
Expected on completion: `kept N of M clips`.

- [ ] **Step 4: Commit**

```bash
git add training/sounds_download.py
git commit -m "feat(training): download selected FSD50K clips as 32 kHz mono"
```

### Task 5: Freesound top-up for short sounds, then owner checkpoint

**Files:**
- Create: `training/sounds_topup.py`
- Create: `training/test_sounds_topup.py`

**Interfaces:**
- Consumes: `DATA/clips.csv` (Task 4), `sounds_model.audioset_net` (Task 3), `sounds_download.to_32k` (Task 4), `FREESOUND_API_KEY`.
- Produces: extra rows appended to `DATA/clips.csv` with `fname = fs_<id>`, `split = train`, `source = freesound`; audio in `DATA/audio/train/fs_<id>.wav`; `DATA/review.html` (5 random kept top-up clips per sound, for the owner to listen to); constants `MIN_TRAIN=150, TARGET=200, AUDIOSET_MIN=0.3, QUERIES`; pure helpers `usable(result, known_ids) -> bool`, `need(clips_rows) -> dict[sound,int]`.

- [ ] **Step 1: Write the failing test**

`training/test_sounds_topup.py`:
```python
"""Checks for the Freesound top-up rules. Run: python test_sounds_topup.py"""
import sounds_topup as t

ok = {'id': 5, 'license': 'https://creativecommons.org/licenses/by/4.0/', 'duration': 3.0}
assert t.usable(ok, known=set())
assert not t.usable(ok | {'license': 'http://creativecommons.org/licenses/by-nc/3.0/'}, known=set())
assert not t.usable(ok, known={'5'})                    # already in FSD50K (could be a test clip): never reuse
assert not t.usable(ok | {'duration': 45.0}, known=set())
assert not t.usable(ok | {'duration': 0.2}, known=set())
rows = [{'split': 'train', 'sounds': 'siren'}] * 40 + [{'split': 'train', 'sounds': 'speech|siren'}] * 10 + \
       [{'split': 'test', 'sounds': 'siren'}] * 99
n = t.need(rows)
assert n['siren'] == t.TARGET - 50 and n['speech'] == t.TARGET - 10 and n['dog bark'] == t.TARGET, n
print('top-up checks passed')
```

(`need` returns, for each sound with fewer than `MIN_TRAIN` train clips, how many more are needed to reach `TARGET`; 0 otherwise. Test clips don't count.)

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_topup.py`
Expected: `ModuleNotFoundError: No module named 'sounds_topup'`

- [ ] **Step 3: Write `training/sounds_topup.py`**

```python
"""Top up sounds with too few FSD50K clips from Freesound (CC0 / CC BY only, train split only).

Each downloaded clip must also convince EfficientAT's pretrained AudioSet model that the sound is really there
(max over 1 s slices of its AudioSet classes >= AUDIOSET_MIN), like the CLIP food filter for Open Images.
Freesound ids already in FSD50K are never reused, so no test clip can leak into training.
Usage: python sounds_topup.py   (appends to data/sounds-v1/clips.csv, writes data/sounds-v1/review.html)
"""
import csv
import io
import os
import random
import time

import numpy as np
import requests
import soundfile as sf
import torch
from dotenv import load_dotenv
from huggingface_hub import hf_hub_download

from sounds_common import CLASSES, DATA, HERE, SOUNDS, SR, WIN, topup_ok, window_starts
from sounds_download import FIELDS, to_32k
from sounds_model import audioset_net

load_dotenv(HERE / '.env')
MIN_TRAIN, TARGET, AUDIOSET_MIN = 150, 200, 0.3
QUERIES = {'dog bark': 'dog bark', 'cat meow': 'cat meow', 'doorbell': 'doorbell', 'knocking': 'knocking door',
           'running tap': 'tap water running', 'keyboard typing': 'keyboard typing', 'glass breaking': 'glass break',
           'siren': 'siren', 'car horn': 'car horn', 'engine / traffic': 'traffic', 'rain': 'rain',
           'thunder': 'thunder', 'clapping': 'clapping', 'crying': 'crying', 'laughing': 'laughing',
           'footsteps': 'footsteps', 'speech': 'speech'}
AUDIOSET_CSV = 'http://storage.googleapis.com/us_audioset/youtube_corpus/v1/csv/class_labels_indices.csv'


def usable(res, known):
    return topup_ok(res['license']) and str(res['id']) not in known and 0.5 <= res['duration'] <= 30


def need(rows):
    have = {c: 0 for c in CLASSES}
    for r in rows:
        if r['split'] == 'train':
            for c in filter(None, r['sounds'].split('|')):
                have[c] += 1
    return {c: (TARGET - n if n < MIN_TRAIN else 0) for c, n in have.items()}


def search(sound, key, page):
    r = requests.get('https://freesound.org/apiv2/search/text/', timeout=30, params={
        'query': QUERIES[sound], 'token': key, 'page': page, 'page_size': 150,
        'filter': 'license:("Attribution" OR "Creative Commons 0") duration:[0.5 TO 30]',
        'fields': 'id,name,license,username,duration,previews'})
    if r.status_code == 404:
        return []
    r.raise_for_status()  # the status only; never print the request URL (it holds the key)
    return r.json()['results']


def audioset_indices():
    """AudioSet output index for each of our sounds, via the FSD50K vocabulary's AudioSet ids (mids)."""
    vocab = {row[1]: row[2] for row in csv.reader(open(hf_hub_download('Fhrozen/FSD50k', 'labels/vocabulary.csv', repo_type='dataset'), encoding='utf8'))}
    idx = {row['mid']: int(row['index']) for row in csv.DictReader(io.StringIO(requests.get(AUDIOSET_CSV, timeout=30).text))}
    return {c: [idx[vocab[l]] for l in SOUNDS[c] if vocab[l] in idx] for c in CLASSES}


@torch.no_grad()
def audioset_score(net, x, ids):
    xs = [np.pad(x[s:s + WIN], (0, max(0, s + WIN - len(x)))) for s in window_starts(len(x))]
    p = torch.sigmoid(net(torch.from_numpy(np.stack(xs)).cuda()))
    return float(p[:, ids].max())


def main():
    key = os.getenv('FREESOUND_API_KEY')
    rows = list(csv.DictReader(open(DATA / 'clips.csv', encoding='utf8')))
    known = {r['fname'] for r in rows} | {r['fname'] for r in csv.DictReader(open(DATA / 'selection.csv', encoding='utf8'))}
    wanted = {c: n for c, n in need(rows).items() if n}
    print('top-up needed:', wanted)
    net, ids = audioset_net('mn10').cuda().eval(), audioset_indices()
    added, review = [], {}
    for sound, n in wanted.items():
        got, page = [], 1
        while len(got) < n and page <= 4:
            for res in search(sound, key, page):
                if len(got) >= n or not usable(res, known):
                    continue
                mp3 = requests.get(res['previews']['preview-hq-mp3'], timeout=30).content
                x, sr = sf.read(io.BytesIO(mp3), dtype='float32')
                x = to_32k(x, sr)
                score = audioset_score(net, x, ids[sound])
                if score < AUDIOSET_MIN:
                    continue
                fname = f"fs_{res['id']}"
                sf.write(DATA / 'audio' / 'train' / f'{fname}.wav', x, SR, subtype='PCM_16')
                known.add(str(res['id']))
                got.append({'fname': fname, 'split': 'train', 'source': 'freesound', 'sounds': sound,
                            'licence': res['license'], 'uploader': res['username'],
                            'url': f"https://freesound.org/s/{res['id']}/", 'seconds': f'{len(x) / SR:.3f}'})
                time.sleep(0.2)
            page += 1
        print(f'{sound}: added {len(got)} of {n} needed')
        added += got
        review[sound] = random.Random(0).sample(got, min(5, len(got)))
    with open(DATA / 'clips.csv', 'a', newline='', encoding='utf8') as f:
        csv.DictWriter(f, FIELDS).writerows(added)
    html = ['<!doctype html><meta charset=utf-8><title>Top-up review</title><h1>Listen: does each clip contain the sound?</h1>']
    for sound, clips in review.items():
        html.append(f'<h2>{sound}</h2>' + ''.join(f'<p>{c["fname"]} <audio controls src="audio/train/{c["fname"]}.wav"></audio></p>' for c in clips))
    (DATA / 'review.html').write_text('\n'.join(html), encoding='utf8')


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$PY test_sounds_topup.py`
Expected: `top-up checks passed`

- [ ] **Step 5: Run the top-up**

Run: `$PY sounds_topup.py`
Expected: `top-up needed: {...}` then one `added X of Y needed` line per sound. If the preview MP3 can't be read (`sf.read` error: libsndfile without MP3), ledger a ruling and decode with `pnpm exec remotion ffmpeg` from `video/` into WAV instead.

- [ ] **Step 6: Commit**

```bash
git add training/sounds_topup.py training/test_sounds_topup.py
git commit -m "feat(training): Freesound top-up for short sounds, double-checked by the AudioSet model"
```

- [ ] **Step 7: OWNER CHECKPOINT (required by the spec: dropped/merged sounds are reported before training)**

Print final train/val/test counts per sound from `clips.csv`. Any sound still under 150 train clips: propose drop or merge. Open `training/data/sounds-v1/review.html` for the owner (reveal the file) and ask them to spot-check the top-up clips by ear. Wait for the owner's go-ahead and ledger their decision. If a sound is dropped: remove it from `SOUNDS` in `sounds_common.py`, update the `CLASSES` assertions in `test_sounds_common.py` and the Global Constraints list, re-run Tasks 1–2 tests, commit.

### Task 6: Event merging, shared with the site

**Files:**
- Create: `src/lib/runtime/events-cases.json` (shared test cases, read by Python and TypeScript)
- Create: `training/sounds_events.py`
- Create: `training/test_sounds_events.py`

**Interfaces:**
- Produces: `sounds_events.events(scores [count][C] array, thresholds [C], seconds float, labels) -> list[dict(label,start,end,score)]`, constants `STEP_S=0.5, WIN_S=1.0, PAD_S=0.25`. The TypeScript port (Task 11) must pass the same `events-cases.json`.

Rule (both languages): a slice is on for a sound when its score ≥ that sound's threshold; a single off slice between two on slices is bridged; each run of on slices is one event. Event start = run's first slice start + 0.25 s (0 if it's the first slice); end = run's last slice start + 0.75 s (the clip length if it's the last slice), capped at the clip length. Score = the highest raw score in the run. Times rounded to 2 decimals. Sorted by start, then by sound order.

- [ ] **Step 1: Write the shared cases**

`src/lib/runtime/events-cases.json`:
```json
{
	"windows": [
		{ "n": 100, "starts": [0] },
		{ "n": 32000, "starts": [0] },
		{ "n": 48000, "starts": [0, 16000] },
		{ "n": 50000, "starts": [0, 16000, 32000] }
	],
	"events": [
		{ "name": "single slice in the middle", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.0,
		  "scores": [[0.1, 0], [0.9, 0], [0.1, 0], [0.1, 0], [0.1, 0]],
		  "expected": [{ "label": "a", "start": 0.75, "end": 1.25, "score": 0.9 }] },
		{ "name": "a one-slice gap is bridged", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.0,
		  "scores": [[0.1, 0], [0.8, 0], [0.2, 0], [0.7, 0], [0.1, 0]],
		  "expected": [{ "label": "a", "start": 0.75, "end": 2.25, "score": 0.8 }] },
		{ "name": "a two-slice gap splits, first slice starts at zero", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.5,
		  "scores": [[0.9, 0], [0.1, 0], [0.1, 0], [0.6, 0], [0.1, 0], [0.1, 0]],
		  "expected": [{ "label": "a", "start": 0, "end": 0.75, "score": 0.9 }, { "label": "a", "start": 1.75, "end": 2.25, "score": 0.6 }] },
		{ "name": "two sounds overlap", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.0,
		  "scores": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.8], [0.1, 0.8], [0.1, 0.1]],
		  "expected": [{ "label": "a", "start": 0.75, "end": 1.75, "score": 0.9 }, { "label": "b", "start": 1.25, "end": 2.25, "score": 0.8 }] },
		{ "name": "reaches the end of the clip", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.0,
		  "scores": [[0.1, 0], [0.1, 0], [0.1, 0], [0.9, 0], [0.9, 0]],
		  "expected": [{ "label": "a", "start": 1.75, "end": 3.0, "score": 0.9 }] },
		{ "name": "each sound has its own threshold", "labels": ["a", "b"], "thresholds": [0.5, 0.3], "seconds": 3.0,
		  "scores": [[0.4, 0.1], [0.4, 0.4], [0.4, 0.1], [0.4, 0.1], [0.4, 0.1]],
		  "expected": [{ "label": "b", "start": 0.75, "end": 1.25, "score": 0.4 }] },
		{ "name": "silence", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 3.0,
		  "scores": [[0.1, 0.1], [0.1, 0.1], [0.1, 0.1], [0.1, 0.1], [0.1, 0.1]],
		  "expected": [] },
		{ "name": "a clip shorter than one slice", "labels": ["a", "b"], "thresholds": [0.5, 0.5], "seconds": 0.8,
		  "scores": [[0.9, 0.1]],
		  "expected": [{ "label": "a", "start": 0, "end": 0.8, "score": 0.9 }] }
	]
}
```

- [ ] **Step 2: Write the failing Python test**

`training/test_sounds_events.py`:
```python
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `$PY test_sounds_events.py`
Expected: `ModuleNotFoundError: No module named 'sounds_events'`

- [ ] **Step 4: Write `training/sounds_events.py`**

```python
"""Turn per-slice scores into sound events. Same rule as src/lib/runtime/events.ts (shared cases in events-cases.json)."""
import numpy as np

STEP_S, WIN_S = 0.5, 1.0
PAD_S = (WIN_S - STEP_S) / 2  # a slice's middle part is where its sound most likely is


def events(scores, thresholds, seconds, labels):
    scores = np.asarray(scores, dtype=float)
    count = len(scores)
    out = []
    for c, label in enumerate(labels):
        on = scores[:, c] >= thresholds[c]
        on = [bool(on[i] or (0 < i < count - 1 and on[i - 1] and on[i + 1])) for i in range(count)]
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `$PY test_sounds_events.py`
Expected: `event checks passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/runtime/events-cases.json training/sounds_events.py training/test_sounds_events.py
git commit -m "feat(training): sound event merging with cases shared with the site"
```

### Task 7: Training

**Files:**
- Create: `training/sounds_train.py`
- Create: `training/test_sounds_train.py`

**Interfaces:**
- Consumes: `DATA/clips.csv` + audio (Tasks 4–5), `sounds_model.Net` (Task 3), `sounds_common`.
- Produces: `RUNS/sounds-v1-<size>/best.pt` (state dict of `Net`), `RUNS/sounds-v1-<size>/log.json` (per-epoch val mAP); helpers `load(path)`, `crop(x, rng, weighted)`, `target(sounds_str) -> np.ndarray[17]`, `clip_scores(net, x) -> np.ndarray[count, 17]` (sigmoid, slices per `window_starts`), `average_precision(y, s)`.

- [ ] **Step 1: Write the failing test**

`training/test_sounds_train.py`:
```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_train.py`
Expected: `ModuleNotFoundError: No module named 'sounds_train'`

- [ ] **Step 3: Write `training/sounds_train.py`**

```python
"""Fine-tune EfficientAT (AudioSet-pretrained MobileNet) on 1 s slices of our sounds.

Multi-label: one sigmoid per sound, so overlapping sounds are both "on". Augmentation (training only): a second clip
mixed in half the time (labels combined: teaches overlap), gain -12..+6 dB, background noise 30% of the time.
Crops of labelled clips favour loud parts (FSD50K says which sounds, not when). Balanced sampling so rare sounds
are seen as often as common ones; negatives make up about a fifth of each batch. The best epoch is picked on the
validation clips (mean average precision, clip-level: a clip's score is its highest slice); test clips are untouched.
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


def load(path):
    x, sr = sf.read(path, dtype='float32')
    assert sr == SR, (path, sr)
    return x


def crop(x, rng, weighted):
    if len(x) <= WIN:
        out = np.zeros(WIN, np.float32)
        at = rng.integers(0, WIN - len(x) + 1)
        out[at:at + len(x)] = x
        return out
    starts = len(x) - WIN + 1
    if not weighted:
        at = rng.integers(0, starts)
    else:
        hop = SR // 10
        e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-10) for i in range(0, len(x), hop)])
        centre = rng.choice(len(e), p=e / e.sum()) * hop + hop // 2
        at = int(np.clip(centre - WIN // 2 + rng.integers(-SR // 4, SR // 4 + 1), 0, starts - 1))
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
        self.audio = [load(path(r)) for r in clips]  # a few GB at most; keeps epochs fast
        self.y = [target(r['sounds']) for r in clips]

    def __len__(self):
        return STEPS_PER_EPOCH * BATCH

    def one(self, i):
        return crop(self.audio[i], self.rng, weighted=self.y[i].any()), self.y[i]

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


def evaluate(net, clips, audio=None):
    net.eval()
    audio = audio or [load(path(r)) for r in clips]
    S = np.stack([clip_scores(net, x).max(0) for x in audio])
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
    val_audio = [load(path(r)) for r in val]
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
        ap, _, _ = evaluate(net, val, val_audio)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$PY test_sounds_train.py`
Expected: `training checks passed`

- [ ] **Step 5: Smoke-run one short epoch**

Run: `$PY -c "import sounds_train as t; t.EPOCHS=1; t.STEPS_PER_EPOCH=5; t.main('mn04')"`
Expected: `epoch 0: loss ... val mAP ...` and `best val mAP ...`; `runs/sounds-v1-mn04/best.pt` exists.

- [ ] **Step 6: Commit, then train both sizes in the background**

```bash
git add training/sounds_train.py training/test_sounds_train.py
git commit -m "feat(training): sound detective training (EfficientAT fine-tune, multi-label)"
```
Run (background, one after the other): `$PY sounds_train.py mn04 > runs-sounds-mn04.log 2>&1 && $PY sounds_train.py mn10 > runs-sounds-mn10.log 2>&1`
Expected on completion: each log ends with `best val mAP X`. Tell the owner the val numbers when done.

### Task 8: Synthetic timeline test clips

**Files:**
- Create: `training/sounds_synth.py`
- Create: `training/test_sounds_synth.py`

**Interfaces:**
- Consumes: test-split rows and audio from `clips.csv`.
- Produces: `loudest(x, max_s=3.0) -> (start, end)` samples of the loudest stretch; `place(bg, parts, rng) -> (mix, truth)`; script writes `DATA/synth/<i>.wav` (10 s, 32 kHz) and `DATA/synth/truth.json` = list of `{file, events:[{label,start,end}], credits:[fname...]}`; `N_CLIPS=100, CLIP_S=10`.

- [ ] **Step 1: Write the failing test**

`training/test_sounds_synth.py`:
```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_synth.py`
Expected: `ModuleNotFoundError: No module named 'sounds_synth'`

- [ ] **Step 3: Write `training/sounds_synth.py`**

```python
"""Build test clips with sounds at KNOWN times (FSD50K only says which sounds, not when), from test clips only.

Each 10 s clip: a quiet test negative (or soft noise) as background, 1-3 sounds cut from test clips that contain
exactly one of our sounds (their loudest stretch, 0.3-3 s), placed at random times; 40% of clips force an overlap.
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
```

- [ ] **Step 4: Run the test to verify it passes, then build the clips**

Run: `$PY test_sounds_synth.py` → `synth checks passed`
Run: `$PY sounds_synth.py` → `100 synthetic clips` (or slightly fewer if some picks were too short; ≥ 95 expected).

- [ ] **Step 5: Commit**

```bash
git add training/sounds_synth.py training/test_sounds_synth.py
git commit -m "feat(training): synthetic test clips with known sound times"
```

### Task 9: Evaluate, set thresholds, pick size, export ONNX

**Files:**
- Create: `training/sounds_evaluate.py`
- Create: `training/test_sounds_evaluate.py`

**Interfaces:**
- Consumes: `best.pt` of both sizes (Task 7), synth clips (Task 8), `sounds_events.events` (Task 6), `sounds_train.evaluate/clip_scores/rows/load/path` (Task 7).
- Produces: `match(truth, pred, collar=0.5) -> (tp, fp, fn, onset_errors)`; `best_threshold(y, s) -> float` (F1-maximising on val, grid 0.10–0.90 step 0.05); `RUNS/sounds-v1-report/metrics.json` = `{size, sizes:{mn04:{map, mb}, mn10:{map, mb}}, per_sound:{sound: ap}, thresholds:[17], timeline:{f1, precision, recall, onset_error_s}, test_clips, confusions:[{truth, said, count}]}`; `RUNS/sounds-v1-report/sound-detective-v1.onnx`; copies it to `static/models/sound-detective-v1.onnx`. Size rule: mn10 only if its test mAP beats mn04 by ≥ 0.03.

- [ ] **Step 1: Write the failing test**

`training/test_sounds_evaluate.py`:
```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$PY test_sounds_evaluate.py`
Expected: `ModuleNotFoundError: No module named 'sounds_evaluate'`

- [ ] **Step 3: Write `training/sounds_evaluate.py`**

```python
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

from sounds_common import CLASSES, DATA, HERE, RUNS, WIN
from sounds_events import events
from sounds_model import Net
from sounds_train import clip_scores, evaluate, load, rows

REPORT = RUNS / 'sounds-v1-report'
SITE_MODEL = HERE.parent / 'static' / 'models' / 'sound-detective-v1.onnx'
GRID = np.round(np.arange(0.10, 0.901, 0.05), 2)


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
    test_audio = [load(DATA / 'audio' / 'test' / f"{r['fname']}.wav") for r in test]
    sizes = {}
    for size in ('mn04', 'mn10'):
        ap, _, _ = evaluate(load_net(size), test, test_audio)
        export(load_net(size), REPORT / f'{size}.onnx')
        sizes[size] = {'map': round(float(np.nanmean(list(ap.values()))), 4),
                       'mb': round((REPORT / f'{size}.onnx').stat().st_size / 1e6, 1), 'ap': ap}
        print(size, sizes[size]['map'], f"{sizes[size]['mb']} MB")
    size = 'mn10' if sizes['mn10']['map'] - sizes['mn04']['map'] >= 0.03 else 'mn04'
    net = load_net(size)
    _, Sv, Yv = evaluate(net, val)
    thresholds = [best_threshold(Yv[:, i], Sv[:, i]) for i in range(len(CLASSES))]
    # Clip-level mix-ups on test: a sound it said that the clip doesn't have, next to what the clip does have.
    _, St, Yt = evaluate(net, test, test_audio)
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
        pred = events(clip_scores(net, x), thresholds, len(x) / 32000, CLASSES)
        tp, fp, fn, err = match(clip['events'], pred)
        TP, FP, FN, errs = TP + tp, FP + fp, FN + fn, errs + err
    p, r = TP / max(1, TP + FP), TP / max(1, TP + FN)
    # The exported file must give PyTorch's answers, batch of one included.
    onnx = REPORT / f'{size}.onnx'
    sess = ort.InferenceSession(str(onnx), providers=['CPUExecutionProvider'])
    xs = np.stack([np.pad(test_audio[k][:WIN], (0, max(0, WIN - len(test_audio[k])))) for k in range(3)]).astype(np.float32)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$PY test_sounds_evaluate.py`
Expected: `evaluation checks passed`

- [ ] **Step 5: Run the evaluation**

Run: `$PY sounds_evaluate.py > runs-sounds-eval.log 2>&1`
Expected: the log ends with the chosen size, both sizes' mAP and MB, and the timeline numbers; `static/models/sound-detective-v1.onnx` exists. If `dynamo=False` is rejected by this torch version, drop the argument and ledger a ruling; the ORT parity assert is the real check. Report the numbers to the owner.

- [ ] **Step 6: Commit**

```bash
git add training/sounds_evaluate.py training/test_sounds_evaluate.py static/models/sound-detective-v1.onnx
git commit -m "feat(training): measure the sound detective, set thresholds, export ONNX"
```

### Task 10: Sample clips, failures and the site's data file

**Files:**
- Create: `training/sounds_pick_examples.py`
- Create (generated): `src/lib/data/sound-detective.json`, `static/samples/sounds/*.wav`, `training/attribution/sounds-v1.csv`, `e2e/fixtures/sounds-silence.wav`, `e2e/fixtures/sounds-short.wav`, `e2e/fixtures/sounds-long.wav`, `e2e/fixtures/sounds-stereo-44k.wav`

**Interfaces:**
- Consumes: `REPORT/sound-detective-v1.onnx` + `metrics.json` (Task 9), test rows (Task 4–5), `sounds_events.events`.
- Produces: `sound-detective.json` = `{classes, thresholds, threshold (lowest), window: 1, step: 0.5, data:[{label,value}], metrics:{sound: ap}, samples:[Sample with input {type:'audio', src, description} and expected:[{label, score, start, end}] + credit fields], failures:[{truth, said, score, why, sampleId}]}` — the shape `entries.ts` (Task 14) reads.

- [ ] **Step 1: Write the script**

```python
"""Pick the Sound detective's sample and failure clips from the frozen TEST split, record the exported ONNX model's
real outputs for them, and write src/lib/data/sound-detective.json. No number here is typed by hand.
Also writes the e2e audio fixtures derived from a sample. Usage: python sounds_pick_examples.py
"""
import csv
import json
import shutil

import numpy as np
import onnxruntime as ort
import soundfile as sf
from scipy.signal import resample_poly

from sounds_common import CLASSES, DATA, HERE, RUNS, SR, WIN, window_starts
from sounds_events import events
from sounds_train import load

SITE = HERE.parent
REPORT = RUNS / 'sounds-v1-report'
OUT_JSON = SITE / 'src' / 'lib' / 'data' / 'sound-detective.json'
OUT_AUDIO = SITE / 'static' / 'samples' / 'sounds'
FIX = SITE / 'e2e' / 'fixtures'
MARGIN = 0.05  # failure examples must clear the threshold by this much, so browser drift can't hide them
WANT = [('dog bark', 'Dog barking'), ('glass breaking', 'Glass breaking'), ('siren', 'Siren'), ('doorbell', 'Doorbell')]
WHY = {frozenset({'footsteps', 'knocking'}): 'Footsteps and knocking are both short thumps.',
       frozenset({'rain', 'running tap'}): 'Rain and a running tap are both steady splashing.',
       frozenset({'engine / traffic', 'rain'}): 'Distant traffic and rain are both steady hiss.',
       frozenset({'crying', 'laughing'}): 'Crying and laughing share the same bursts of voice.'}
LIC = {'/publicdomain/zero/': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
       '/licenses/by/3.0': ('CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'),
       '/licenses/by/4.0': ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')}


def licence(url):
    return next(v for k, v in LIC.items() if k in url)


def scores(sess, x):
    xs = np.stack([np.pad(x[s:s + WIN], (0, max(0, s + WIN - len(x)))) for s in window_starts(len(x))]).astype(np.float32)
    return sess.run(None, {'audio': xs})[0]


def main():
    rep = json.loads((REPORT / 'metrics.json').read_text(encoding='utf8'))
    th = rep['thresholds']
    sess = ort.InferenceSession(str(REPORT / 'sound-detective-v1.onnx'), providers=['CPUExecutionProvider'])
    test = [r for r in csv.DictReader(open(DATA / 'clips.csv', encoding='utf8')) if r['split'] == 'test' and 3 <= float(r['seconds']) <= 15]
    found = []
    for r in test:
        x = load(DATA / 'audio' / 'test' / f"{r['fname']}.wav")
        s = scores(sess, x)
        ev = events(s, th, len(x) / SR, CLASSES)
        truth = set(filter(None, r['sounds'].split('|')))
        said = {e['label'] for e in ev}
        found.append(dict(r=r, x=x, s=s, ev=ev, truth=truth, said=said))
    clean = [f for f in found if f['truth'] and f['said'] == f['truth']]
    picks = []
    for sound, title in WANT:
        c = [f for f in clean if f['truth'] == {sound}]
        if c:
            picks.append((sound.replace(' ', '-'), title, max(c, key=lambda f: max(e['score'] for e in f['ev'])), None))
    # Overlap: a clean clip with two sounds whose events overlap in time.
    both = [f for f in clean if len(f['truth']) >= 2 and any(a['label'] != b['label'] and a['start'] < b['end'] and b['start'] < a['end'] for a in f['ev'] for b in f['ev'])]
    if both:
        picks.append(('overlap', 'Two sounds at once', max(both, key=lambda f: len(f['ev'])), None))
    # Failures: a confident false alarm next to a real sound, and a sound it missed.
    alarms = [(f, e) for f in found if f['truth'] for e in f['ev'] if e['label'] not in f['truth'] and e['score'] >= th[CLASSES.index(e['label'])] + MARGIN]
    if alarms:
        f, e = max(alarms, key=lambda fe: fe[1]['score'])
        t = sorted(f['truth'])[0]
        why = WHY.get(frozenset({t, e['label']}), f"It heard {e['label']} where there was only {', '.join(sorted(f['truth']))}.")
        picks.append(('false-alarm', f"{t.capitalize()} (it gets this wrong)", f, {'truth': t, 'said': e['label'], 'score': e['score'], 'why': why}))
    missed = [f for f in found if len(f['truth']) == 1 and not f['said']]
    if missed:
        f = max(missed, key=lambda f: float(f['s'][:, CLASSES.index(next(iter(f['truth'])))].max()))
        t = next(iter(f['truth']))
        top = float(f['s'][:, CLASSES.index(t)].max())
        picks.append(('missed', f"{t.capitalize()} (it misses this)", f, {'truth': t, 'said': 'nothing', 'score': round(top, 4),
                      'why': f'Its {t} score peaked at {round(top * 100)}%, under the {round(th[CLASSES.index(t)] * 100)}% bar.'}))
    if OUT_AUDIO.exists():
        shutil.rmtree(OUT_AUDIO)
    OUT_AUDIO.mkdir(parents=True)
    samples, failures = [], []
    for sid, title, f, fail in picks:
        sf.write(OUT_AUDIO / f'{sid}.wav', f['x'], SR, subtype='PCM_16')
        # Re-read what the site will serve (16-bit) so the recorded outputs match that exact file.
        x16 = load(OUT_AUDIO / f'{sid}.wav')
        ev = events(scores(sess, x16), th, len(x16) / SR, CLASSES)
        name, url = licence(f['r']['licence'])
        s = {'id': sid, 'title': title, 'input': {'type': 'audio', 'src': f'/samples/sounds/{sid}.wav',
             'description': f"Test clip with {', '.join(sorted(f['truth'])) or 'no sound it knows'}"},
             'credit': f"Sound: {f['r']['uploader']} on Freesound", 'creditUrl': f['r']['url'], 'license': name, 'licenseUrl': url,
             'expected': [{'label': e['label'], 'score': e['score'], 'start': e['start'], 'end': e['end']} for e in ev]}
        if fail:
            s['knownFailure'] = True
            failures.append({**fail, 'sampleId': sid})
        samples.append(s)
        print(f"{sid:14} {f['r']['fname']} truth={sorted(f['truth'])} said={[e['label'] for e in ev]}")
    clips = list(csv.DictReader(open(DATA / 'clips.csv', encoding='utf8')))
    count = lambda split: sum(1 for r in clips if r['split'] == split)
    sz = rep['sizes'][rep['size']]
    other = 'mn10' if rep['size'] == 'mn04' else 'mn04'
    tl = rep['timeline']
    data = [
        {'label': 'Sources', 'value': 'FSD50K (Freesound, CC0 and CC BY clips only), topped up from Freesound'},
        {'label': 'Clips', 'value': f"{len(clips):,} clips ({sum(1 for r in clips if not r['sounds']):,} with none of its sounds)"},
        {'label': 'Split', 'value': f"{count('train'):,} train · {count('val'):,} validation · {count('test'):,} test"},
        {'label': 'Base model', 'value': f"EfficientAT MobileNet {rep['size']} (MIT licence), pretrained on AudioSet"},
        {'label': 'Test score', 'value': f"{sz['map']:.2f} mean average precision on {rep['test_clips']:,} held-out clips"},
        {'label': 'Size trade-off', 'value': f"{rep['size']}: {sz['map']:.2f} for {sz['mb']} MB; {other}: {rep['sizes'][other]['map']:.2f} for {rep['sizes'][other]['mb']} MB"},
        {'label': 'Timing', 'value': f"Finds {round(tl['recall'] * 100)}% of sounds within 0.5 s of when they start ({tl['clips']} test mixes); {round(tl['precision'] * 100)}% of what it marks is right"},
        {'label': 'Listens in', 'value': '1 second slices, every half second; live mode uses the same slices'},
        {'label': 'Known gaps', 'value': 'Only 17 sounds; phone mics sound different from the training clips; quiet sounds under speech get missed'},
        {'label': 'Sound credits', 'value': 'Every training clip’s author is listed in training/attribution/sounds-v1.csv in the project repository'},
    ]
    out = {'classes': CLASSES, 'thresholds': th, 'threshold': min(th), 'window': 1, 'step': 0.5, 'data': data,
           'metrics': rep['per_sound'], 'samples': samples, 'failures': failures}
    OUT_JSON.write_text(json.dumps(out, indent='\t', ensure_ascii=False) + '\n', encoding='utf8')
    (HERE / 'attribution').mkdir(exist_ok=True)
    with open(HERE / 'attribution' / 'sounds-v1.csv', 'w', newline='', encoding='utf8') as fh:
        w = csv.writer(fh)
        w.writerow(['file', 'author', 'link', 'licence'])
        w.writerows([[r['fname'], r['uploader'], r['url'], r['licence']] for r in clips])
    # e2e fixtures from the first sample
    first = load(OUT_AUDIO / f"{samples[0]['id']}.wav")
    rng = np.random.default_rng(0)
    sf.write(FIX / 'sounds-silence.wav', (rng.standard_normal(3 * SR) * 1e-4).astype(np.float32), SR, subtype='PCM_16')
    sf.write(FIX / 'sounds-short.wav', first[: int(0.3 * SR)], SR, subtype='PCM_16')
    sf.write(FIX / 'sounds-long.wav', np.tile(first, int(np.ceil(35 * SR / len(first))))[: 35 * SR], SR, subtype='PCM_16')
    st = resample_poly(first, 441, 320).astype(np.float32)
    sf.write(FIX / 'sounds-stereo-44k.wav', np.stack([st, st], axis=1), 44100, subtype='PCM_16')
    print('failures:', [(f['truth'], f['said'], f['score']) for f in failures])


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run it**

Run: `$PY sounds_pick_examples.py`
Expected: one line per sample (4 wanted + overlap + up to 2 failures), `failures: [...]`; `src/lib/data/sound-detective.json` exists. If a wanted sound has no clean clip, it's skipped (the printout shows which) — acceptable; ledger it. At least 3 samples must exist.

- [ ] **Step 3: Listen check (owner rule: no misleading samples)**

Reveal `static/samples/sounds/` to the owner and ask them to confirm each clip sounds like its title (like the rejected walrus/orca photos last time). If one is wrong, add its fname to a `SKIP` set at the top of the script (`test = [r for r in ... if r['fname'] not in SKIP ...]`), re-run, ledger it.

- [ ] **Step 4: Commit**

```bash
git add training/sounds_pick_examples.py training/attribution/sounds-v1.csv src/lib/data/sound-detective.json static/samples/sounds e2e/fixtures/sounds-*.wav
git commit -m "feat(training): sound detective samples, failures and report data from the test split"
```

---

## Part B — The site

### Task 11: Types, events and headline in TypeScript

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/runtime/events.ts`
- Create: `src/lib/runtime/events.test.ts`

**Interfaces:**
- Produces: `Prediction.start?: number; Prediction.end?: number` (seconds); `ModelEntry.task?: 'classify' | 'detect' | 'events'`; from `events.ts`: `STEP_S=0.5, WIN_S=1, toEvents(scores: Float32Array, count: number, labels: string[], thresholds: number[], seconds: number): Prediction[]`, `summarizeEvents(p: Prediction[]): string`, `lanes(p: Prediction[]): string[]`, `clock(s: number): string`.

- [ ] **Step 1: Types**

In `src/lib/types.ts`, in `Prediction` after `box?`:
```ts
	/** Sound events only: when it starts and ends, in seconds from the start of the clip. */
	start?: number;
	end?: number;
```
and change `task?: 'classify' | 'detect';` to:
```ts
	/** 'detect' draws boxes; 'events' marks sounds on a timeline; default 'classify' shows the top answers. */
	task?: 'classify' | 'detect' | 'events';
```

- [ ] **Step 2: Write the failing test**

`src/lib/runtime/events.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clock, lanes, summarizeEvents, toEvents } from './events';
import { windowStarts } from './audio';

const cases = JSON.parse(readFileSync('src/lib/runtime/events-cases.json', 'utf8')) as {
	windows: { n: number; starts: number[] }[];
	events: { name: string; labels: string[]; thresholds: number[]; seconds: number; scores: number[][]; expected: unknown[] }[];
};

describe('the same event rule as training (shared cases)', () => {
	for (const w of cases.windows) it(`slices for ${w.n} samples`, () => expect(windowStarts(w.n)).toEqual(w.starts));
	for (const k of cases.events)
		it(k.name, () => {
			const got = toEvents(Float32Array.from(k.scores.flat()), k.scores.length, k.labels, k.thresholds, k.seconds);
			expect(got.map((p) => ({ ...p, score: Math.round(p.score * 1e4) / 1e4 }))).toEqual(k.expected);
		});
});

it('headline counts countable sounds and names steady ones, in order of first appearance', () => {
	const p = (label: string, start: number) => ({ label, start, end: start + 0.5, score: 0.9 });
	expect(summarizeEvents([p('speech', 0.2), p('dog bark', 0.5), p('dog bark', 3), p('knocking', 5)])).toBe('speech, 2 dog barks, 1 knock');
	expect(summarizeEvents([p('rain', 0), p('rain', 4)])).toBe('rain');
});

it('lanes list each sound once, first heard first', () => {
	expect(lanes([{ label: 'b', score: 1, start: 0 }, { label: 'a', score: 1, start: 1 }, { label: 'b', score: 1, start: 2 }])).toEqual(['b', 'a']);
});

it('clock shows minutes, seconds and tenths', () => {
	expect(clock(0.75)).toBe('0:00.8');
	expect(clock(65.25)).toBe('1:05.3');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test:unit --run src/lib/runtime/events.test.ts`
Expected: FAIL — cannot resolve `./events` / `./audio`.

- [ ] **Step 4: Write `src/lib/runtime/events.ts`**

```ts
import type { Prediction } from '$lib/types';

export const STEP_S = 0.5;
export const WIN_S = 1;
const PAD_S = (WIN_S - STEP_S) / 2; // a slice's middle part is where its sound most likely is
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Per-slice scores ([count × labels], row-major) → sound events. Same rule as training/sounds_events.py. */
export function toEvents(scores: Float32Array, count: number, labels: string[], thresholds: number[], seconds: number): Prediction[] {
	const out: Prediction[] = [];
	const n = labels.length;
	labels.forEach((label, c) => {
		const raw = (i: number) => scores[i * n + c];
		const hit = (i: number) => raw(i) >= thresholds[c];
		const on = Array.from({ length: count }, (_, i) => hit(i) || (i > 0 && i < count - 1 && hit(i - 1) && hit(i + 1)));
		for (let i = 0; i < count; i++) {
			if (!on[i]) continue;
			let j = i;
			while (j + 1 < count && on[j + 1]) j++;
			let score = 0;
			for (let k = i; k <= j; k++) score = Math.max(score, raw(k));
			const start = i === 0 ? 0 : i * STEP_S + PAD_S;
			const end = j === count - 1 ? seconds : Math.min(seconds, j * STEP_S + WIN_S - PAD_S);
			out.push({ label, start: r2(start), end: r2(end), score });
			i = j;
		}
	});
	return out.sort((a, b) => a.start! - b.start! || labels.indexOf(a.label) - labels.indexOf(b.label));
}

/** Short, separate sounds are counted ("2 dog barks"); steady ones are just named ("rain"). */
const COUNTED: Record<string, [string, string]> = {
	'dog bark': ['dog bark', 'dog barks'], 'cat meow': ['meow', 'meows'], doorbell: ['doorbell ring', 'doorbell rings'],
	knocking: ['knock', 'knocks'], 'glass breaking': ['glass break', 'glass breaks'], 'car horn': ['car horn', 'car horns'],
	thunder: ['thunderclap', 'thunderclaps']
};

export const lanes = (p: Prediction[]) => [...new Set(p.map((x) => x.label))];

export function summarizeEvents(p: Prediction[]): string {
	return lanes(p).map((label) => {
		const n = p.filter((x) => x.label === label).length;
		const noun = COUNTED[label];
		return noun ? `${n} ${noun[n === 1 ? 0 : 1]}` : label;
	}).join(', ');
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
```

- [ ] **Step 5: Write the slicing part of `src/lib/runtime/audio.ts`** (Task 12 adds decoding to this file)

```ts
export const SR = 32000;
export const WIN = SR;
export const STEP = SR / 2;
export const MAX_SECONDS = 30;
export const MIN_SECONDS = 0.5;

/** Start sample of every 1 s slice (same rule as training/sounds_common.py window_starts). */
export function windowStarts(n: number): number[] {
	const count = n <= WIN ? 1 : Math.ceil((n - WIN) / STEP) + 1;
	return Array.from({ length: count }, (_, i) => i * STEP);
}

/** All slices of a clip in one [count × WIN] batch; the last one is zero-padded. */
export function slices(x: Float32Array): { data: Float32Array; count: number } {
	const starts = windowStarts(x.length);
	const data = new Float32Array(starts.length * WIN);
	starts.forEach((s, i) => data.set(x.subarray(s, Math.min(x.length, s + WIN)), i * WIN));
	return { data, count: starts.length };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test:unit --run src/lib/runtime/events.test.ts`
Expected: all pass (4 window cases, 8 event cases, 3 more).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/runtime/events.ts src/lib/runtime/events.test.ts src/lib/runtime/audio.ts
git commit -m "feat: sound events, headline and slicing, matching the training rule"
```

### Task 12: Shared engine loading, audio decoding, the Sound detective runtime

**Files:**
- Create: `src/lib/runtime/engine.ts`
- Modify: `src/lib/runtime/sea-detector.ts` (use `engine.ts`)
- Modify: `src/lib/runtime/audio.ts` (add decoding + WAV)
- Create: `src/lib/runtime/audio.test.ts`
- Create: `src/lib/runtime/sound-detective.ts`
- Create: `src/lib/runtime/sound-detective.test.ts`
- Modify: `src/lib/runtime/index.ts`

**Interfaces:**
- Consumes: `toEvents` (Task 11), `slices, SR, MAX_SECONDS, MIN_SECONDS` (Task 11), `sound-detective.json` (Task 10).
- Produces: `engine.ts`: `ENGINE_URL, ENGINE_MB, openSession(modelUrl, modelMB, onProgress) -> Promise<{ ort, session }>`; `audio.ts`: `decode32kMono(blob) -> Promise<Float32Array>`, `wavBlob(x, sr?) -> Blob`, `encodeWav(x, sr) -> Uint8Array`; `index.ts`: `UserError`, `ClipInfo = { seconds: number; trimmed: boolean; peaks: number[] }`, `Runtime` gains optional `lastClip?: ClipInfo | null` and `scoreSlices?(data: Float32Array, count: number): Promise<Float32Array>` and `detectSamples?(x: Float32Array): Promise<Prediction[]>` and `thresholds?: number[]`; `sound-detective.ts`: `MODEL_URL='/models/sound-detective-v1.onnx', MODEL_MB, CLASSES, soundDetective()`.

- [ ] **Step 1: Write the failing tests**

`src/lib/runtime/audio.test.ts`:
```ts
import { expect, it } from 'vitest';
import { encodeWav, slices, WIN } from './audio';

it('packs every slice into one batch, zero-padding the last', () => {
	const x = new Float32Array(50000).fill(0.5);
	const { data, count } = slices(x);
	expect(count).toBe(3);
	expect(data.length).toBe(3 * WIN);
	expect(data[2 * WIN + 17999]).toBe(0.5); // sample 49999 of the clip
	expect(data[2 * WIN + 18000]).toBe(0); // padding
});

it('writes a 16-bit mono WAV the browser can play', () => {
	const bytes = encodeWav(new Float32Array([0, 1, -1]), 32000);
	const v = new DataView(bytes.buffer);
	expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
	expect(v.getUint32(24, true)).toBe(32000);
	expect(v.getUint16(34, true)).toBe(16);
	expect(v.getInt16(46, true)).toBe(32767);
	expect(v.getInt16(48, true)).toBe(-32768);
	expect(bytes.length).toBe(44 + 6);
});
```

`src/lib/runtime/sound-detective.test.ts`:
```ts
import { statSync } from 'node:fs';
import { expect, it } from 'vitest';
import sounds from '$lib/data/sound-detective.json';
import { CLASSES, MODEL_MB, MODEL_URL } from './sound-detective';
import { registry } from './index';

const mb = (path: string) => Math.round(statSync(path).size / 1e5) / 10;

it('the download size shown to visitors matches the real file', () => expect(MODEL_MB).toBe(mb(`static${MODEL_URL}`)));
it('knows its sounds in the model’s output order', () => expect(CLASSES).toEqual(sounds.classes));
it('has one threshold per sound', () => expect(sounds.thresholds).toHaveLength(CLASSES.length));
it('is registered for the live entry', () => expect(typeof registry['sound-detective']).toBe('function'));
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test:unit --run src/lib/runtime/audio.test.ts src/lib/runtime/sound-detective.test.ts`
Expected: FAIL — `encodeWav` not exported; `./sound-detective` not found.

- [ ] **Step 3: Write `src/lib/runtime/engine.ts`** (moved from `sea-detector.ts`, plus: skip the engine once ONNX Runtime is running)

```ts
// The engine files as Vite's own hashed, same-origin assets: one copy in the build, cached as immutable.
// (These imports are just URLs; nothing is fetched until a visitor runs a model.)
import engineUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import engineGlueUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

export const ENGINE_URL = engineUrl;
export const ENGINE_MB = 14.2;
export type Ort = typeof import('onnxruntime-web/wasm');
type Session = import('onnxruntime-web/wasm').InferenceSession;

let engineReady = false; // once ONNX Runtime has started, a second model needs only its own file

/** Streams a file, reporting bytes received so far. */
async function fetchBytes(url: string, onBytes: (got: number) => void): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`download failed: ${url} ${res.status}`);
	const reader = res.body.getReader();
	const parts: Uint8Array[] = [];
	let got = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		got += value.length;
		onBytes(got);
	}
	const bytes = new Uint8Array(got);
	let at = 0;
	for (const p of parts) { bytes.set(p, at); at += p.length; }
	return bytes;
}

/**
 * Downloads a model AND the engine ourselves, with one progress bar over both (the engine is the bigger part).
 * Handing ONNX Runtime the engine bytes means a dropped download just fails this try: if ONNX Runtime fetched
 * the engine itself and that failed, it would refuse every later try until the page was reloaded.
 */
export async function openSession(modelUrl: string, modelMB: number, onProgress: (p: number | null) => void): Promise<{ ort: Ort; session: Session }> {
	const ort = await import('onnxruntime-web/wasm');
	ort.env.wasm.wasmPaths = { mjs: engineGlueUrl, wasm: engineUrl };
	ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
	const total = (modelMB + (engineReady ? 0 : ENGINE_MB)) * 1e6; // sizes are checked against the real files by unit tests
	const got = { model: 0, engine: 0 };
	const report = () => onProgress(Math.min(1, (got.model + got.engine) / total));
	const [model, engine] = await Promise.all([
		fetchBytes(modelUrl, (n) => { got.model = n; report(); }),
		engineReady ? null : fetchBytes(ENGINE_URL, (n) => { got.engine = n; report(); })
	]); // a failed download throws here, so the caller's next try starts over
	if (engine) ort.env.wasm.wasmBinary = engine;
	const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
	engineReady = true;
	return { ort, session };
}
```

- [ ] **Step 4: Point `sea-detector.ts` at it**

In `src/lib/runtime/sea-detector.ts`: delete the two `?url` imports, `ENGINE_MB`, `ENGINE_URL`, `fetchBytes`; add at the top:
```ts
import { openSession, type Ort } from './engine';
export { ENGINE_MB, ENGINE_URL } from './engine';
```
and replace the body of `load` with:
```ts
		async load(onProgress) {
			if (session) return;
			({ ort, session } = await openSession(MODEL_URL, MODEL_MB, onProgress));
		},
```
with the declarations `let ort: Ort | undefined; let session: import('onnxruntime-web/wasm').InferenceSession | undefined;` (drop the local `type Ort`). `sizeLabel` keeps `${MODEL_MB} MB model + ${ENGINE_MB} MB engine` (import `ENGINE_MB` for local use too: `import { ENGINE_MB, openSession, type Ort } from './engine';` plus the re-export line).

Run: `pnpm test:unit --run src/lib/runtime/sea-detector.test.ts`
Expected: PASS (3 tests) — the move didn't change sizes or exports.

- [ ] **Step 5: Add decoding and WAV to `src/lib/runtime/audio.ts`**

Append:
```ts
/** Browser-only: decode any audio the browser can read, mixed to mono at 32 kHz (decodeAudioData resamples to the context's rate). */
export async function decode32kMono(blob: Blob): Promise<Float32Array> {
	const ctx = new OfflineAudioContext(1, 1, SR);
	const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
	if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
	const out = new Float32Array(audio.length);
	for (let c = 0; c < audio.numberOfChannels; c++) {
		const ch = audio.getChannelData(c);
		for (let i = 0; i < out.length; i++) out[i] += ch[i] / audio.numberOfChannels;
	}
	return out;
}

export function encodeWav(x: Float32Array, sr = SR): Uint8Array {
	const bytes = new Uint8Array(44 + x.length * 2);
	const v = new DataView(bytes.buffer);
	const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
	text(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); text(8, 'WAVE');
	text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
	v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
	text(36, 'data'); v.setUint32(40, x.length * 2, true);
	x.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) < 0 ? Math.max(-1, s) * 32768 : Math.min(1, s) * 32767, true));
	return bytes;
}

export const wavBlob = (x: Float32Array, sr = SR) => new Blob([encodeWav(x, sr)], { type: 'audio/wav' });
```

- [ ] **Step 6: Extend `src/lib/runtime/index.ts`**

```ts
import type { ModelEntry, ModelInput, Prediction } from '$lib/types';
import { demoRuntime } from './demo';

/** An error whose message is meant for the visitor (anything else shows the generic "failed to run"). */
export class UserError extends Error {}

export interface ClipInfo {
	seconds: number;
	trimmed: boolean;
	peaks: number[];
}

export interface Runtime {
	/** Shown in the loading state, e.g. "23 MB". */
	sizeLabel: string;
	load(onProgress: (p: number | null) => void): Promise<void>;
	classify(input: ModelInput): Promise<Prediction[]>;
	/** Sound models: the clip the last result describes (length, whether it was cut, waveform). */
	lastClip?: ClipInfo | null;
	/** Sound models: per-sound thresholds, and scoring for live listening. */
	thresholds?: number[];
	labels?: string[];
	scoreSlices?(data: Float32Array, count: number): Promise<Float32Array>;
}

/** Real models register here: slug → lazy import of their runtime. */
export const registry: Record<string, () => Promise<Runtime>> = {
	'sea-creature-detector': () => import('./sea-detector').then((m) => m.seaDetector()),
	'sound-detective': () => import('./sound-detective').then((m) => m.soundDetective())
};
```
(keep `getRuntime` unchanged below).

- [ ] **Step 7: Write `src/lib/runtime/sound-detective.ts`**

```ts
import sounds from '$lib/data/sound-detective.json';
import type { ModelInput, Prediction } from '$lib/types';
import { peaks } from '$lib/waveform';
import { decode32kMono, MAX_SECONDS, MIN_SECONDS, SR, slices } from './audio';
import { ENGINE_MB, openSession, type Ort } from './engine';
import { toEvents } from './events';
import { UserError, type ClipInfo, type Runtime } from './index';

export const MODEL_URL = '/models/sound-detective-v1.onnx';
export const MODEL_MB = 0; // set to the real size in Step 8; a unit test checks it against the file
export const CLASSES: string[] = sounds.classes;
const THRESHOLDS: number[] = sounds.thresholds;

function create(): Runtime {
	let ort: Ort | undefined;
	let session: import('onnxruntime-web/wasm').InferenceSession | undefined;
	const rt: Runtime = {
		sizeLabel: `${MODEL_MB} MB model + ${ENGINE_MB} MB engine`,
		lastClip: null,
		thresholds: THRESHOLDS,
		labels: CLASSES,
		async load(onProgress) {
			if (session) return;
			({ ort, session } = await openSession(MODEL_URL, MODEL_MB, onProgress));
		},
		async scoreSlices(data, count) {
			if (!ort || !session) throw new Error('model not loaded');
			const out = await session.run({ audio: new ort.Tensor('float32', data, [count, SR]) });
			return out.scores.data as Float32Array;
		},
		async classify(input: ModelInput): Promise<Prediction[]> {
			if (input.type !== 'audio') throw new Error('the sound detective takes audio');
			const all = await decode32kMono(input.blob);
			if (all.length < MIN_SECONDS * SR) throw new UserError('Too short to hear anything. Record a little longer.');
			const x = all.subarray(0, MAX_SECONDS * SR);
			const { data, count } = slices(x);
			const scores = await rt.scoreSlices!(data, count);
			const clip: ClipInfo = { seconds: x.length / SR, trimmed: all.length > x.length, peaks: peaks(x, 120) };
			rt.lastClip = clip;
			return toEvents(scores, count, CLASSES, THRESHOLDS, clip.seconds);
		}
	};
	return rt;
}

let shared: Runtime | undefined;
/** One instance per page, so the model downloads once however many times the bench is shown. */
export const soundDetective = () => (shared ??= create());
```

- [ ] **Step 8: Set the real size, run the tests**

Run: `node -e "console.log(Math.round(require('fs').statSync('static/models/sound-detective-v1.onnx').size/1e5)/10)"` and put the printed value in `MODEL_MB`.
Run: `pnpm test:unit --run`
Expected: all unit tests pass (the 51 existing + the new ones).

- [ ] **Step 9: Commit**

```bash
git add src/lib/runtime
git commit -m "feat: sound detective runtime, shared engine loading, audio decoding"
```

### Task 13: The entry, the result display and error wording

**Files:**
- Modify: `src/lib/bench.ts`
- Modify: `src/lib/bench.test.ts`
- Create: `src/lib/components/EventTimeline.svelte`
- Create: `src/lib/components/EventList.svelte`
- Modify: `src/lib/components/Workbench.svelte`
- Modify: `src/lib/entries.ts`

**Interfaces:**
- Consumes: `summarizeEvents, lanes, clock` (Task 11); `UserError`, `lastClip` (Task 12).
- Produces: `BenchEvent 'done'` gains `events?: boolean`; `EventTimeline` props `{ predictions: Prediction[]; seconds: number; bars?: number[]; from?: number }`; `EventList` props `{ predictions: Prediction[]; src: string | null; max?: number }` with `li[data-label][data-start][data-end][data-score]`; the entry `sound-detective`.

- [ ] **Step 1: Write the failing bench test**

Add to `src/lib/bench.test.ts` (it already imports `step` from `./bench`):
```ts
it('sound events keep every event, in time order; none found is the unsure state', () => {
	const ev = [{ label: 'speech', score: 0.4, start: 2, end: 3 }, { label: 'dog bark', score: 0.9, start: 0.5, end: 1 }];
	const r = step({ kind: 'examining', last: null }, { type: 'done', predictions: ev, threshold: 0.5, events: true });
	expect(r).toEqual({ kind: 'result', predictions: [ev[1], ev[0]], unsure: false }); // no threshold filter: the runtime already applied each sound's own
	expect(step({ kind: 'examining', last: null }, { type: 'done', predictions: [], threshold: 0.5, events: true })).toMatchObject({ unsure: true });
});
```
Run: `pnpm test:unit --run src/lib/bench` → FAIL (the speech event is filtered out by the detect/classify path).

- [ ] **Step 2: Make it pass in `src/lib/bench.ts`**

In `BenchEvent`, `done` becomes `{ type: 'done'; predictions: Prediction[]; threshold: number; detect?: boolean; events?: boolean }`, and in `step` before `if (e.detect)`:
```ts
			if (e.events) {
				// Sound events arrive already thresholded (each sound has its own bar); keep them in time order.
				const predictions = [...e.predictions].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
				return { kind: 'result', predictions, unsure: predictions.length === 0 };
			}
```
Run: `pnpm test:unit --run src/lib/bench` → PASS.

- [ ] **Step 3: Write `src/lib/components/EventTimeline.svelte`**

```svelte
<script lang="ts">
	import { clock, lanes } from '$lib/runtime/events';
	import type { Prediction } from '$lib/types';

	// `from`: live mode shows a moving window of `seconds`, starting at `from`.
	let { predictions, seconds, bars = [], from = 0 }: { predictions: Prediction[]; seconds: number; bars?: number[]; from?: number } = $props();
	const names = $derived(lanes(predictions));
	const at = (t: number) => Math.max(0, Math.min(100, ((t - from) / Math.max(seconds, 0.01)) * 100));
</script>

<!-- A picture of the list below it (which carries the same events for screen readers and keyboards). -->
<figure class="timeline" aria-hidden="true">
	{#if bars.length}<div class="wave">{#each bars as b, i (i)}<i style="transform: scaleY({Math.max(0.04, b)})"></i>{/each}</div>{/if}
	{#each names as name (name)}
		<div class="lane" data-lane={name}>
			<span class="mono name">{name}</span>
			<div class="track">
				{#each predictions.filter((p) => p.label === name) as p, i (i)}
					<span class="ev" style="left: {at(p.start ?? 0)}%; width: {Math.max(0, at(p.end ?? 0) - at(p.start ?? 0))}%"></span>
				{/each}
			</div>
		</div>
	{/each}
	<div class="axis mono faint"><span>{clock(from)}</span><span>{clock(from + seconds)}</span></div>
</figure>

<style>
	.timeline { display: grid; gap: 0.35rem; margin: 0; min-width: 0; }
	.wave { height: 40px; display: flex; align-items: center; gap: 1px; background: var(--plate); border: 1px solid var(--hairline); padding: 0 2px; }
	.wave i { flex: 1; height: 100%; background: var(--ink-soft); transform-origin: center; }
	.lane { display: grid; gap: 0.15rem; }
	.name { font-size: 0.75rem; color: var(--ink-soft); }
	.track { position: relative; height: 14px; background: var(--plate); border: 1px solid var(--hairline); }
	.ev { position: absolute; top: 0; bottom: 0; min-width: 3px; background: var(--red); }
	.axis { display: flex; justify-content: space-between; font-size: 0.75rem; }
</style>
```

- [ ] **Step 4: Write `src/lib/components/EventList.svelte`**

```svelte
<script lang="ts">
	import { clock } from '$lib/runtime/events';
	import type { Prediction } from '$lib/types';

	let { predictions, src, max = 20 }: { predictions: Prediction[]; src: string | null; max?: number } = $props();
	let player: HTMLAudioElement | undefined;
	let loaded = '';

	/** Plays just this stretch of the clip. */
	function play(p: Prediction) {
		if (!src) return;
		player ??= new Audio();
		if (loaded !== src) { player.src = loaded = src; }
		const stopAt = p.end ?? 0;
		player.ontimeupdate = () => { if (player!.currentTime >= stopAt) player!.pause(); };
		player.currentTime = p.start ?? 0;
		void player.play();
	}
	$effect(() => () => player?.pause());
</script>

<!-- Keyed by position: the same sound can happen several times. -->
<ol class="events" aria-label="Sounds heard">
	{#each predictions.slice(0, max) as p, i (i)}
		<li data-label={p.label} data-start={p.start} data-end={p.end} data-score={p.score}>
			<button class="btn ghost play" disabled={!src} onclick={() => play(p)} aria-label="Play {p.label}, {clock(p.start ?? 0)} to {clock(p.end ?? 0)}">▶</button>
			<span>{p.label}</span>
			<span class="mono faint">{clock(p.start ?? 0)}–{clock(p.end ?? 0)}</span>
			<span class="mono">{Math.round(p.score * 100)}%</span>
		</li>
	{/each}
</ol>
{#if predictions.length > max}<p class="mono faint">+{predictions.length - max} more</p>{/if}

<style>
	.events { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
	li { display: grid; grid-template-columns: 44px 1fr auto auto; gap: var(--space-1); align-items: center; }
	.play { min-height: 44px; padding: 0; }
</style>
```

- [ ] **Step 5: Wire the Workbench**

In `src/lib/components/Workbench.svelte`:
- imports: add `import EventTimeline from './EventTimeline.svelte';`, `import EventList from './EventList.svelte';`, `import { summarizeEvents } from '$lib/runtime/events';`, and change the runtime import to `import { getRuntime, UserError, type ClipInfo, type Runtime } from '$lib/runtime';`
- after `const detect = ...` add `const events = $derived(entry.task === 'events');`
- after `let shownCredit` add `let clip = $state<ClipInfo | null>(null);`
- in `run`: `bench = step(bench, { type: 'done', predictions, threshold: entry.unsureBelow, detect, events });` preceded by `clip = runtime.lastClip ?? null;` inside the same `if (isLatest())` (use braces); and the catch becomes:
```ts
		} catch (e) {
			if (isLatest()) bench = step(bench, { type: 'fail', reason: e instanceof UserError ? e.message : 'The model failed to run. Try again.' });
		}
```
- in `.out`, before `{:else if bench.kind === 'result' && detect}` add:
```svelte
				{:else if bench.kind === 'result' && events}
					<p class="answer serif">{bench.unsure ? 'No sounds it knows' : summarizeEvents(bench.predictions)}</p>
					{#if clip?.trimmed}<p class="note warn">Only the first 30 seconds were checked.</p>{/if}
					{#if bench.unsure}
						<p class="note warn">Nothing it knows cleared its confidence bar. It listens for: {entry.labels.join(', ')}.</p>
					{:else}
						<EventTimeline predictions={bench.predictions} seconds={clip?.seconds ?? 0} bars={clip?.peaks ?? []} />
						<EventList predictions={bench.predictions} src={shownAudio} />
						<p class="mono faint">Each sound has its own confidence bar, set on held-out clips.</p>
					{/if}
```
- in the error branch, `{#if detect}<DetectionList …/>{:else}…` becomes `{#if events}<EventList predictions={previous} src={null} />{:else if detect}<DetectionList predictions={previous} />{:else}<PredictionBars predictions={previous} />{/if}`.

- [ ] **Step 6: Add the entry in `src/lib/entries.ts`**

Top: `import sounds from './data/sound-detective.json';`. After `gender`:
```ts
// Numbers, samples and failures come from the evaluation (training/sounds_pick_examples.py), never typed by hand.
const soundDetective: ModelEntry = {
	kind: 'model', slug: 'sound-detective', no: 4, name: 'Sound detective',
	purpose: 'Listens to a recording and marks which everyday sounds happen, and when.',
	status: 'live', task: 'events', input: 'audio', labels: sounds.classes, unsureBelow: sounds.threshold,
	samples: sounds.samples as Sample[],
	report: {
		data: sounds.data,
		metrics: { title: 'Score per sound (average precision)', rows: Object.entries(sounds.metrics).map(([label, value]) => ({ label, value })) },
		failures: sounds.failures as Failure[]
	}
};
```
and `creature, produce, gender, soundDetective,` in `allEntries`.

- [ ] **Step 7: Check it builds and the unit suite passes**

Run: `pnpm check` then `pnpm test:unit --run`
Expected: 0 errors; all unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bench.ts src/lib/bench.test.ts src/lib/components/EventTimeline.svelte src/lib/components/EventList.svelte src/lib/components/Workbench.svelte src/lib/entries.ts
git commit -m "feat: sound detective entry with timeline lanes, event list and clear errors"
```

### Task 14: Clip e2e tests

**Files:**
- Create: `e2e/sounds.e2e.ts`
- Modify: `e2e/a11y.e2e.ts`
- Modify: `e2e/pages.e2e.ts`

**Interfaces:**
- Consumes: samples in `sound-detective.json` (Task 10), fixtures (Task 10), the UI (Task 13).

- [ ] **Step 1: Make the WebM fixture (Review Focus 2) and the MP3 fixture**

From `video/`: 
```bash
pnpm exec remotion ffmpeg -y -i ../e2e/fixtures/sounds-stereo-44k.wav -c:a libopus ../e2e/fixtures/sounds-recording.webm
pnpm exec remotion ffmpeg -y -i ../e2e/fixtures/sounds-stereo-44k.wav -c:a libmp3lame -b:a 128k ../e2e/fixtures/sounds-stereo-44k.mp3
```
Expected: both files exist. If Remotion's stripped ffmpeg lacks an encoder, ledger a ruling: skip that fixture and its test (`test.skip` with the reason), never fake it.

- [ ] **Step 2: Write `e2e/sounds.e2e.ts`**

```ts
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Parity: the page must reproduce the outputs recorded from the exported model by sounds_pick_examples.py.
const sounds = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')) as {
	classes: string[];
	samples: { id: string; title: string; credit: string; expected: { label: string; score: number; start: number; end: number }[] }[];
};

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90_000);

const demo = (page: Page) => page.locator('.demo');
async function runs(page: Page, act: () => Promise<void>, until: RegExp | string = /result|unsure/) {
	const started = demo(page).evaluate((d: HTMLElement) => new Promise<void>((resolve) => {
		const o = new MutationObserver(() => { if (d.dataset.state === 'examining') { o.disconnect(); resolve(); } });
		o.observe(d, { attributes: true, attributeFilter: ['data-state'] });
	}));
	await act();
	await started;
	await expect(demo(page)).toHaveAttribute('data-state', until, { timeout: 60_000 });
}
const heard = (page: Page) => page.locator('.events li[data-label]').evaluateAll((els) => els.map((e) => ({
	label: e.getAttribute('data-label')!, start: Number(e.getAttribute('data-start')), end: Number(e.getAttribute('data-end')), score: Number(e.getAttribute('data-score'))
})));
const upload = (page: Page, file: string) => page.locator('input[type=file][accept^="audio"]').setInputFiles(file);

test('every sample gives the sounds, times and scores the model was measured with', async ({ page }) => {
	await page.goto('/models/sound-detective');
	for (const s of sounds.samples) {
		await runs(page, () => page.getByRole('button', { name: s.title, exact: true }).click());
		const got = await heard(page);
		expect(got.map((g) => g.label), s.id).toEqual(s.expected.map((e) => e.label));
		s.expected.forEach((e, i) => {
			expect(Math.abs(got[i].start - e.start), `${s.id} ${e.label} start`).toBeLessThanOrEqual(0.25);
			expect(Math.abs(got[i].end - e.end), `${s.id} ${e.label} end`).toBeLessThanOrEqual(0.25);
			expect(Math.abs(got[i].score - e.score), `${s.id} ${e.label} score`).toBeLessThan(0.03);
		});
		await expect(page.getByText(s.credit)).toBeVisible();
	}
});

test('overlapping sounds sit on separate lanes', async ({ page }) => {
	const s = sounds.samples.find((x) => x.id === 'overlap');
	test.skip(!s, 'no overlap sample was found in the test clips');
	await page.goto('/models/sound-detective');
	await runs(page, () => page.getByRole('button', { name: s!.title, exact: true }).click(), 'result');
	const labels = [...new Set(s!.expected.map((e) => e.label))];
	for (const l of labels) await expect(page.locator(`.timeline [data-lane="${l}"]`)).toHaveCount(1);
});

test('a silent clip says it heard nothing it knows', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await runs(page, () => upload(page, 'e2e/fixtures/sounds-silence.wav'), 'unsure');
	await expect(page.locator('.answer')).toHaveText('No sounds it knows');
});

test('a clip that is too short says so', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await upload(page, 'e2e/fixtures/sounds-short.wav');
	await expect(page.getByRole('alert')).toHaveText('Too short to hear anything. Record a little longer.', { timeout: 60_000 });
});

test('a long upload is cut to 30 seconds, with a note', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
	await runs(page, () => upload(page, 'e2e/fixtures/sounds-long.wav'));
	await expect(page.getByText('Only the first 30 seconds were checked.')).toBeVisible();
	for (const g of await heard(page)) expect(g.end).toBeLessThanOrEqual(30);
});

for (const [file, what] of [['sounds-stereo-44k.wav', 'stereo 44.1 kHz WAV'], ['sounds-stereo-44k.mp3', 'stereo MP3'], ['sounds-recording.webm', 'a phone-style WebM recording']] as const)
	test(`${what} finds the same sounds as the original sample`, async ({ page, browserName }) => {
		test.skip(file.endsWith('.webm') && browserName === 'webkit', 'Safari records MP4, not WebM');
		const first = sounds.samples[0];
		await page.goto('/models/sound-detective');
		await expect(page.getByRole('button', { name: 'Upload' })).toBeEnabled();
		await runs(page, () => upload(page, `e2e/fixtures/${file}`));
		expect([...new Set((await heard(page)).map((g) => g.label))].sort()).toEqual([...new Set(first.expected.map((e) => e.label))].sort());
	});

test('a failed model download shows an error, and the next try works', async ({ page }) => {
	let first = true;
	await page.route('**/models/sound-detective-v1.onnx', (route) => (first ? ((first = false), route.abort()) : route.continue()));
	await page.goto('/models/sound-detective');
	const s = sounds.samples[0];
	await page.getByRole('button', { name: s.title, exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('failed to run');
	await page.getByRole('button', { name: s.title, exact: true }).click();
	await expect(demo(page)).toHaveAttribute('data-state', /result|unsure/, { timeout: 60_000 });
});

test('the home page never downloads the sound model', async ({ page }) => {
	const heavy: string[] = [];
	page.on('request', (r) => { if (/sound-detective-v1\.onnx$|worklets\/capture/.test(r.url())) heavy.push(r.url()); });
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(heavy).toEqual([]);
});
```

- [ ] **Step 3: Accessibility and page tests**

In `e2e/a11y.e2e.ts`: add `'/models/sound-detective'` to `paths`, and after the detector's "after a result" loop add:
```ts
for (const scheme of ['light', 'dark'] as const)
	test(`axe: the sound detective after a result (${scheme})`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await page.goto('/models/sound-detective');
		const first = JSON.parse((await import('node:fs')).readFileSync('src/lib/data/sound-detective.json', 'utf8')).samples[0];
		await page.getByRole('button', { name: first.title, exact: true }).click();
		await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure/, { timeout: 60_000 });
		const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
		expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
	});
```
In `e2e/pages.e2e.ts` add:
```ts
test('the sound detective page shows its measured report card', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await expect(page.getByRole('heading', { level: 1, name: 'Sound detective' })).toBeVisible();
	await expect(page.getByText('LIVE', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('SCORE PER SOUND (AVERAGE PRECISION)')).toBeVisible();
	await expect(page.getByRole('listitem', { name: /^speech, \d+ percent$/ })).toBeVisible();
	await expect(page).toHaveTitle('Sound detective · AI Model Lab');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/sound-detective\.png$/);
});
```

- [ ] **Step 4: Link preview image**

Run `pnpm build`, then `pnpm preview --port 4173` in the background, then `pnpm og`. Expected: `static/og/sound-detective.png` printed among the others. Stop the preview server (PowerShell: `Get-NetTCPConnection -LocalPort 4173 | % { Stop-Process -Id $_.OwningProcess -Force }`).

- [ ] **Step 5: Run the e2e tests**

Run: `pnpm test:e2e e2e/sounds.e2e.ts e2e/a11y.e2e.ts e2e/pages.e2e.ts > .superpowers/e2e-sounds.log 2>&1; tail -30 .superpowers/e2e-sounds.log`
Expected: all pass (the WebKit WebM case skipped). A parity failure means the browser path differs from Python (check `decode32kMono` output length vs the WAV, then the slice layout) — debug, don't loosen tolerances.

- [ ] **Step 6: Commit**

```bash
git add e2e/sounds.e2e.ts e2e/a11y.e2e.ts e2e/pages.e2e.ts e2e/fixtures/sounds-recording.webm e2e/fixtures/sounds-stereo-44k.mp3 static/og/sound-detective.png
git commit -m "test: sound detective parity, odd uploads, errors, accessibility"
```

### Task 15: Live listening

**Files:**
- Create: `src/lib/live.ts`
- Create: `src/lib/live.test.ts`
- Create: `static/worklets/capture.js`
- Modify: `src/lib/components/inputs/AudioInput.svelte`
- Modify: `src/lib/components/Workbench.svelte`
- Create: `e2e/live.e2e.ts`
- Modify: `playwright.config.ts` (live tests: Chromium only)

**Interfaces:**
- Consumes: `toEvents` (Task 11), `SR, WIN, STEP, MAX_SECONDS, slices, wavBlob` (Tasks 11–12), `Runtime.scoreSlices/thresholds/labels` (Task 12), `EventTimeline` (Task 13), `micErrorMessage` (existing), `UserError`.
- Produces: `LIVE_LIMIT_MS = 120_000`; `LiveView = { predictions: Prediction[]; now: string[]; from: number; skipped: number }`; `class LiveScorer { constructor(score, labels, thresholds, onView); push(chunk: Float32Array): void; samples(): Float32Array; skipped: number }`; `startListening(rt: Runtime, h: { onView(v: LiveView): void; onStop(samples: Float32Array): void }): Promise<() => void>`.

- [ ] **Step 1: Write the failing unit test**

`src/lib/live.test.ts`:
```ts
import { expect, it } from 'vitest';
import { LiveScorer, type LiveView } from './live';

const SR = 32000;
function setup() {
	const calls: { x: Float32Array; resolve: (s: Float32Array) => void }[] = [];
	const views: LiveView[] = [];
	const scorer = new LiveScorer(
		(x) => new Promise((resolve) => calls.push({ x: x.slice(), resolve })),
		['a', 'b'], [0.5, 0.5], (v) => views.push(v)
	);
	return { calls, views, scorer };
}
const tone = (n: number, v: number) => new Float32Array(n).fill(v);

it('scores a 1 s slice once a second has arrived, then every half second', async () => {
	const { calls, scorer } = setup();
	scorer.push(tone(SR - 1, 0.1));
	expect(calls).toHaveLength(0);
	scorer.push(tone(1, 0.1));
	expect(calls).toHaveLength(1);
	expect(calls[0].x).toHaveLength(SR);
	calls[0].resolve(new Float32Array([0.9, 0.1]));
	await Promise.resolve();
	scorer.push(tone(SR / 2, 0.2));
	expect(calls).toHaveLength(2);
	expect(calls[1].x[SR - 1]).toBeCloseTo(0.2); // the newest half second is at the end of the slice
});

it('skips slices while the device is still busy, and counts them', () => {
	const { calls, scorer } = setup();
	scorer.push(tone(SR, 0));
	scorer.push(tone(SR, 0)); // two more slices due while the first is still scoring
	expect(calls).toHaveLength(1);
	expect(scorer.skipped).toBe(2);
});

it('turns scores into events on the stream’s own clock and says what is heard now', async () => {
	const { calls, views, scorer } = setup();
	scorer.push(tone(SR, 0));
	calls[0].resolve(new Float32Array([0.9, 0.1]));
	await new Promise((r) => setTimeout(r));
	const v = views.at(-1)!;
	expect(v.now).toEqual(['a']);
	expect(v.predictions.map((p) => p.label)).toEqual(['a']);
	expect(v.from).toBe(0);
});

it('keeps only the last 30 seconds for the result', () => {
	const { scorer } = setup();
	scorer.push(tone(10 * SR, 0.1));
	scorer.push(tone(25 * SR, 0.3));
	const s = scorer.samples();
	expect(s).toHaveLength(30 * SR);
	expect(s[0]).toBeCloseTo(0.1); // 35 s pushed: seconds 5–10 of the first tone remain
	expect(s[s.length - 1]).toBeCloseTo(0.3);
});
```
Run: `pnpm test:unit --run src/lib/live.test.ts` → FAIL (no `./live`).

- [ ] **Step 2: Write `src/lib/live.ts`**

```ts
import { micErrorMessage } from '$lib/input-checks';
import { MAX_SECONDS, SR, STEP, WIN } from '$lib/runtime/audio';
import { toEvents } from '$lib/runtime/events';
import { UserError, type Runtime } from '$lib/runtime';
import type { Prediction } from '$lib/types';

export const LIVE_LIMIT_MS = 120_000;
const KEEP = MAX_SECONDS * SR;

export interface LiveView {
	predictions: Prediction[];
	/** Sounds in the newest slice. */
	now: string[];
	/** Seconds since listening began at the left edge of the 30 s view. */
	from: number;
	skipped: number;
}

/** Keeps the last 30 s of the stream, scores a 1 s slice every 0.5 s (skipping when still busy), builds the view. */
export class LiveScorer {
	private ring = new Float32Array(KEEP);
	private total = 0; // samples ever received
	private due = WIN; // score when this many samples have arrived
	private busy = false;
	private scored: { at: number; s: Float32Array }[] = []; // at = slice start, in stream samples
	skipped = 0;

	constructor(
		private score: (x: Float32Array) => Promise<Float32Array>,
		private labels: string[],
		private thresholds: number[],
		private onView: (v: LiveView) => void
	) {}

	push(chunk: Float32Array) {
		for (let i = 0; i < chunk.length; i++) this.ring[(this.total + i) % KEEP] = chunk[i];
		this.total += chunk.length;
		while (this.total >= this.due) {
			const at = this.due - WIN;
			this.due += STEP;
			if (this.busy) this.skipped++;
			else void this.run(at);
		}
	}

	private read(start: number, n: number): Float32Array {
		const out = new Float32Array(n);
		for (let i = 0; i < n; i++) out[i] = this.ring[(start + i) % KEEP];
		return out;
	}

	samples(): Float32Array {
		const n = Math.min(this.total, KEEP);
		return this.read(this.total - n, n);
	}

	private async run(at: number) {
		this.busy = true;
		try {
			const s = await this.score(this.read(at, WIN));
			this.scored.push({ at, s });
			const oldest = this.total - KEEP;
			this.scored = this.scored.filter((x) => x.at >= oldest);
			this.onView(this.view());
		} finally {
			this.busy = false;
		}
	}

	private view(): LiveView {
		const n = this.labels.length;
		const first = this.scored[0].at;
		const count = (this.scored.at(-1)!.at - first) / STEP + 1;
		const grid = new Float32Array(count * n); // skipped slices stay 0: nothing claimed for moments not heard
		for (const x of this.scored) grid.set(x.s, ((x.at - first) / STEP) * n);
		const offset = first / SR;
		const predictions = toEvents(grid, count, this.labels, this.thresholds, (this.scored.at(-1)!.at + WIN - first) / SR)
			.map((p) => ({ ...p, start: p.start! + offset, end: p.end! + offset }));
		const last = this.scored.at(-1)!.s;
		return {
			predictions,
			now: this.labels.filter((_, c) => last[c] >= this.thresholds[c]),
			from: Math.max(0, this.total / SR - MAX_SECONDS),
			skipped: this.skipped
		};
	}
}

/** Browser-only. Opens the mic and streams it through the model. Returns stop(); stopping hands back the last ≤30 s. */
export async function startListening(rt: Runtime, h: { onView(v: LiveView): void; onStop(samples: Float32Array): void }): Promise<() => void> {
	if (!rt.scoreSlices || !rt.labels || !rt.thresholds) throw new Error('this model cannot listen live');
	if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined')
		throw new UserError('Live listening isn’t supported in this browser. Record instead.');
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
	} catch (err) {
		throw new UserError(micErrorMessage((err as DOMException).name));
	}
	let ctx: AudioContext;
	let node: AudioWorkletNode;
	try {
		ctx = new AudioContext({ sampleRate: SR }); // the browser resamples the mic to 32 kHz for us
		await ctx.audioWorklet.addModule('/worklets/capture.js');
		const source = ctx.createMediaStreamSource(stream);
		node = new AudioWorkletNode(ctx, 'capture');
		source.connect(node).connect(ctx.destination); // the worklet outputs silence; connecting keeps it running
	} catch {
		stream.getTracks().forEach((t) => t.stop());
		throw new UserError('Live listening isn’t supported in this browser. Record instead.');
	}
	const scorer = new LiveScorer((x) => rt.scoreSlices!(x, 1), rt.labels, rt.thresholds, h.onView);
	node.port.onmessage = (e: MessageEvent<Float32Array>) => scorer.push(e.data);
	let stopped = false;
	const onHide = () => { if (document.visibilityState === 'hidden') stop(); };
	const limit = setTimeout(stop, LIVE_LIMIT_MS);
	document.addEventListener('visibilitychange', onHide);
	function stop() {
		if (stopped) return;
		stopped = true;
		clearTimeout(limit);
		document.removeEventListener('visibilitychange', onHide);
		node.port.onmessage = null;
		stream.getTracks().forEach((t) => t.stop());
		void ctx.close();
		h.onStop(scorer.samples());
	}
	return stop;
}
```
Run: `pnpm test:unit --run src/lib/live.test.ts` → PASS (4 tests).

- [ ] **Step 3: Write `static/worklets/capture.js`**

```js
// Sound detective live mode: collects microphone samples (already 32 kHz, mixed to mono) in 4096-sample chunks
// and posts them to the page. Outputs silence. Nothing is stored here.
class Capture extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buf = new Float32Array(4096);
		this.n = 0;
	}
	process(inputs) {
		const ch = inputs[0];
		if (ch && ch.length) {
			for (let i = 0; i < ch[0].length; i++) {
				let v = 0;
				for (let c = 0; c < ch.length; c++) v += ch[c][i];
				this.buf[this.n++] = v / ch.length;
				if (this.n === this.buf.length) {
					this.port.postMessage(this.buf, [this.buf.buffer]);
					this.buf = new Float32Array(4096);
					this.n = 0;
				}
			}
		}
		return true;
	}
}
registerProcessor('capture', Capture);
```

- [ ] **Step 4: The Listen live button in `AudioInput.svelte`**

Props become:
```ts
	let {
		disabled, examining, shown = $bindable(null), onsubmit, onerror,
		canListen = false, listening = false, onlisten = () => {}, onstoplisten = () => {}
	}: {
		disabled: boolean; examining: boolean; shown: string | null; onsubmit: (i: ModelInput) => void; onerror: (r: string) => void;
		canListen?: boolean; listening?: boolean; onlisten?: () => void; onstoplisten?: () => void;
	} = $props();
```
In `.actions`, change Record to `disabled={disabled || starting || listening}` and add after Upload:
```svelte
		{#if canListen}
			<button class="btn" aria-pressed={listening} disabled={(disabled && !listening) || recording} onclick={() => (listening ? onstoplisten() : onlisten())}>{listening ? '■ Stop listening' : '◉ Listen live'}</button>
		{/if}
```
and change the empty-waveform hint to `{disabled ? 'Demo opens when this model is measured' : canListen ? 'Record up to 15 seconds, upload a clip, or listen live' : 'Record up to 15 seconds, or upload a clip'}`.

- [ ] **Step 5: Live mode in `Workbench.svelte`**

Script additions:
```ts
	import { startListening, type LiveView } from '$lib/live';
	import { wavBlob } from '$lib/runtime/audio';

	let listening = $state<LiveView | null>(null);
	let stopLive: (() => void) | null = null;
	let liveUrl: string | null = null;
	let leaving = false;

	/** Downloads the model if needed (progress bar), reusing run()'s loading. Returns false if it failed or was superseded. */
	async function ensureLoaded(isLatest: () => boolean): Promise<boolean> {
		if (loaded) return true;
		bench = step(bench, { type: 'load' });
		await runtime!.load((p) => { if (isLatest()) bench = step(bench, { type: 'progress', value: p }); });
		loaded = true;
		return isLatest();
	}

	async function listen() {
		if (!runtime) return;
		const isLatest = latest();
		shownCredit = null;
		try {
			if (!(await ensureLoaded(isLatest))) return;
			stopLive = await startListening(runtime, {
				onView: (v) => { if (isLatest()) listening = v; },
				onStop: (samples) => {
					listening = null;
					stopLive = null;
					if (leaving || !isLatest() || samples.length === 0) return;
					const blob = wavBlob(samples);
					if (liveUrl) URL.revokeObjectURL(liveUrl);
					shownAudio = liveUrl = URL.createObjectURL(blob);
					run({ type: 'audio', blob }, isLatest);
				}
			});
			if (isLatest()) listening ??= { predictions: [], now: [], from: 0, skipped: 0 };
		} catch (e) {
			if (isLatest()) bench = step(bench, { type: 'fail', reason: e instanceof UserError ? e.message : 'The model failed to run. Try again.' });
		}
	}
	$effect(() => () => { leaving = true; stopLive?.(); if (liveUrl) URL.revokeObjectURL(liveUrl); });
```
In `run`, replace the inline loading block with `if (!(await ensureLoaded(isLatest))) return;` (keeping the rest).
`view` becomes: `const view = $derived(listening ? 'listening' : !checked ? 'ready' : …existing…);`
Pass to `AudioInput`: `disabled={!live || busy || !!listening} canListen={events} listening={!!listening} onlisten={listen} onstoplisten={() => stopLive?.()}`; the samples buttons get `disabled={busy || !!listening}`.
In `.out`, first branch after `not-live`:
```svelte
				{:else if listening}
					<p class="mono live" role="status"><span class="dot" aria-hidden="true"></span> Listening</p>
					<p class="answer serif">{listening.now.length ? listening.now.join(' + ') : 'Listening…'}</p>
					<EventTimeline predictions={listening.predictions} seconds={30} from={listening.from} />
					{#if listening.skipped}<p class="note warn">Your device is busy, some moments were skipped.</p>{/if}
					<p class="mono faint">Stops by itself after 2 minutes. Nothing is recorded or uploaded.</p>
```
Style: `.live { color: var(--red); display: flex; align-items: center; gap: 0.4rem; } .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--red); }`.

Run: `pnpm check` → 0 errors; `pnpm test:unit --run` → all pass.

- [ ] **Step 6: Write `e2e/live.e2e.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const sounds = JSON.parse(readFileSync('src/lib/data/sound-detective.json', 'utf8')) as { samples: { id: string; expected: { label: string }[] }[] };
const clip = sounds.samples[0];
test.use({
	viewport: { width: 1280, height: 900 },
	permissions: ['microphone'],
	launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${resolve(`static/samples/sounds/${clip.id}.wav`)}`] }
});
test.setTimeout(90_000);

const liveTracks = (page: import('@playwright/test').Page) => page.evaluate(() =>
	(window as unknown as { streams: MediaStream[] }).streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { streams: MediaStream[] };
		w.streams = [];
		const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); w.streams.push(s); return s; };
	});
});

test('live listening waits for the download, then marks the sound as it plays', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /loading|listening/);
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await expect(page.getByRole('status')).toContainText('Listening');
	await expect(page.locator(`.timeline [data-lane="${clip.expected[0].label}"]`)).toHaveCount(1, { timeout: 20_000 });
	await page.getByRole('button', { name: '■ Stop listening' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure/, { timeout: 30_000 });
	expect(await liveTracks(page)).toBe(0);
});

test('live listening stops by itself after 2 minutes', async ({ page }) => {
	await page.clock.install();
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await page.clock.fastForward(120_000);
	await expect(page.locator('.demo')).toHaveAttribute('data-state', /result|unsure|examining/, { timeout: 30_000 });
	expect(await liveTracks(page)).toBe(0);
});

test('hiding the tab stops listening', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('.demo')).not.toHaveAttribute('data-state', 'listening');
	expect(await liveTracks(page)).toBe(0);
});

test('leaving the page turns the microphone off', async ({ page }) => {
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.locator('.demo')).toHaveAttribute('data-state', 'listening', { timeout: 60_000 });
	await page.getByRole('link', { name: 'AI MODEL LAB' }).click(); // client-side navigation: same window, component destroyed
	await page.waitForTimeout(500);
	expect(await liveTracks(page)).toBe(0);
});

test('a blocked microphone says so', async ({ page }) => {
	await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
	await page.goto('/models/sound-detective');
	await page.getByRole('button', { name: '◉ Listen live' }).click();
	await expect(page.getByRole('alert')).toContainText('Microphone access was blocked', { timeout: 60_000 });
});
```

- [ ] **Step 7: Chromium only for live tests**

In `playwright.config.ts`, change the webkit project to `testIgnore: ['**/intro-video.e2e.ts', '**/live.e2e.ts']` (Chromium's fake microphone has no WebKit equivalent). Leave chromium as is.

- [ ] **Step 8: Run the live tests**

Run: `pnpm test:e2e e2e/live.e2e.ts > .superpowers/e2e-live.log 2>&1; tail -30 .superpowers/e2e-live.log`
Expected: 5 passed. The home link is the header wordmark `AI MODEL LAB` (`src/routes/+layout.svelte:33`).

- [ ] **Step 9: Commit**

```bash
git add src/lib/live.ts src/lib/live.test.ts static/worklets/capture.js src/lib/components/inputs/AudioInput.svelte src/lib/components/Workbench.svelte e2e/live.e2e.ts playwright.config.ts
git commit -m "feat: live listening for the sound detective (auto-stop, hidden tab, busy device)"
```

### Task 16: Full suite, production check, docs

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Modify: memory `project-scope.md` (outside the repo; not committed)

- [ ] **Step 1: Full test suite**

Run: `pnpm test:unit --run > .superpowers/unit.log 2>&1; tail -5 .superpowers/unit.log` then `pnpm test:e2e > .superpowers/e2e.log 2>&1; tail -15 .superpowers/e2e.log`
Expected: all unit pass; e2e passes with only the known skips. Any test elsewhere that counted live models (e.g. archive listings) and now sees four entries: update its expectation to the new real count and ledger it.

- [ ] **Step 2: Python checks**

Run from `training/`: `for t in test_sounds_*.py; do $PY $t; done`
Expected: every script prints its `... checks passed` line.

- [ ] **Step 3: Production build check**

Run: `VERCEL_ENV=production pnpm build` then check drafts stay out: `grep -rl "Dive sound sorter" build/ | head` → no output; and the new page is there: `ls build/models/sound-detective.html`.

- [ ] **Step 4: Update the handoff**

In `docs/superpowers/HANDOFF.md`: "What this is" → two live models; add a "Sound detective" bullet under Models and training (pipeline order: `sounds_select.py → sounds_download.py → sounds_topup.py → sounds_train.py mn04|mn10 → sounds_synth.py → sounds_evaluate.py → sounds_pick_examples.py`; the spectrogram lives inside the ONNX file; live mode uses `static/worklets/capture.js`); Current state → new test counts; the numbers from `metrics.json` (mAP, size, timing).

- [ ] **Step 5: Commit, then ask about pushing**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff covers the sound detective"
```
Ask the owner before `git push` (it deploys production).
