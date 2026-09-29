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
SKIP = set()   # clips rejected at the owner's listening check (fname)
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
    test = [r for r in csv.DictReader(open(DATA / 'clips.csv', encoding='utf8'))
            if r['split'] == 'test' and 3 <= float(r['seconds']) <= 15 and r['fname'] not in SKIP]
    found = []
    for r in test:
        x = load(DATA / 'audio' / 'test' / f"{r['fname']}.wav")
        s = scores(sess, x)
        ev = events(s, th, len(x) / SR, CLASSES)
        truth = set(filter(None, r['sounds'].split('|')))
        found.append(dict(r=r, x=x, s=s, ev=ev, truth=truth, said={e['label'] for e in ev}))
    clean = [f for f in found if f['truth'] and f['said'] == f['truth']]
    picks = []
    for sound, title in WANT:
        c = [f for f in clean if f['truth'] == {sound}]
        if c:
            picks.append((sound.replace(' ', '-'), title, max(c, key=lambda f: max(e['score'] for e in f['ev'])), None))
        else:
            print(f'no clean clip for {sound}; skipped')
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
        {'label': 'Second by second', 'value': f"{tl['segment']['f1']:.2f} F1 on which sounds are on in each second of the same mixes"},
        {'label': 'Listens in', 'value': '1 second slices, every half second; live mode uses the same slices'},
        {'label': 'Known gaps', 'value': f'Only {len(CLASSES)} sounds; phone mics sound different from the training clips; quiet sounds under speech get missed'},
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
