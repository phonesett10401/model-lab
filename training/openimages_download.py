"""Download the photos listed in meta/selected.json from Open Images' public storage (no key needed).

Each photo is shrunk to at most 1024 px on its long side and re-saved without EXIF data: Open Images boxes
are drawn on the raw pixels, so a leftover EXIF rotation tag would make the loader turn the photo away from its boxes.
Safe to re-run: photos already on disk are skipped.
"""
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).parent / 'data' / 'openimages'
URL = 'https://open-images-dataset.s3.amazonaws.com/train/{}.jpg'
MAX_SIDE = 1024


def fetch(iid):
    out = ROOT / 'images' / f'{iid}.jpg'
    if out.exists():
        return 'skipped'
    try:
        r = requests.get(URL.format(iid), timeout=60)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert('RGB')
        im.thumbnail((MAX_SIDE, MAX_SIDE))
        im.save(out, quality=90)  # no exif= argument, so no EXIF is written
        return 'ok'
    except Exception as e:
        return f'failed: {type(e).__name__}'


if __name__ == '__main__':
    ids = list(json.loads((ROOT / 'meta' / 'selected.json').read_text(encoding='utf8')))
    (ROOT / 'images').mkdir(exist_ok=True)
    results = {}
    with ThreadPoolExecutor(16) as pool:
        for n, (iid, res) in enumerate(zip(ids, pool.map(fetch, ids)), 1):
            results[iid] = res
            if n % 500 == 0:
                print(n, 'of', len(ids), flush=True)
    failed = {i: r for i, r in results.items() if r.startswith('failed')}
    print('done:', len(ids) - len(failed), 'ok or skipped,', len(failed), 'failed')
    (ROOT / 'meta' / 'download_failures.json').write_text(json.dumps(failed, indent=1), encoding='utf8')
