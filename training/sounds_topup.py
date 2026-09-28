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


def polite_get(url, **kw):
    """Freesound answers bursts with 403/429 for a while: back off and retry instead of failing."""
    for wait in (0, 5, 15, 30, 60, 120):
        time.sleep(wait)
        r = requests.get(url, timeout=30, **kw)
        if r.status_code not in (403, 429, 503):
            return r
    return r


def search(sound, key, page):
    r = polite_get('https://freesound.org/apiv2/search/text/', params={
        'query': QUERIES[sound], 'token': key, 'page': page, 'page_size': 150,
        'filter': 'license:("Attribution" OR "Creative Commons 0") duration:[0.5 TO 30]',
        'fields': 'id,name,license,username,duration,previews'})
    if r.status_code == 404:
        return []
    if not r.ok:  # the status only; never print the request URL (it holds the key)
        raise SystemExit(f'Freesound search failed: HTTP {r.status_code}')
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
                resp = polite_get(res['previews']['preview-hq-mp3'])
                try:
                    x, sr = sf.read(io.BytesIO(resp.content), dtype='float32')
                except sf.LibsndfileError:
                    continue  # not audio (an error page): skip this clip
                time.sleep(0.3)
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
            page += 1
        print(f'{sound}: added {len(got)} of {n} needed', flush=True)
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
