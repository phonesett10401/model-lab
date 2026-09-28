"""Download the selected FSD50K clips one by one from the Hugging Face mirror, convert to 32 kHz mono, drop clips
over 30 s. Resumable: clips already on disk are skipped. Usage: python sounds_download.py"""
import csv
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from math import gcd

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
