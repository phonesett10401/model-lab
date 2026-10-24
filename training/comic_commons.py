"""Old public-domain comic pages from Wikimedia Commons (no login), for the 'old-pd' style.

Run: python comic_commons.py [--per-category 6] [--total 150]
Walks Category:Public domain comics one level down, keeps files whose own licence is public domain (never anything
AI-generated, never anything from 1970 on), saves them to incoming/comic/commons/<category>/ and registers them.
"""
import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import comic_common as c
from comic_incoming import register

API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'AI-Model-Lab comic-translator dataset (github.com/phonesett10401/model-lab)'}
ROOT = 'Category:Public domain comics'
INCOMING = c.HERE / 'incoming/comic/commons'
MIN_SIDE = 800


def ext_of(url: str) -> str:
    """File extension from a download link, ignoring its query string (Commons links carry tracking parameters)."""
    return Path(urllib.parse.urlparse(url).path).suffix.lower()


def keep(f: dict) -> bool:
    """f: title, mime, width, height, licence (LicenseShortName), categories."""
    return (f['mime'] in ('image/jpeg', 'image/png')
            and max(f['width'], f['height']) >= MIN_SIDE
            and (f['licence'].lower().startswith('public domain') or f['licence'].upper().startswith('PD'))
            and not any('ai-generated' in cat.lower() for cat in f['categories']))


def fetch(url: str) -> bytes:
    """One request every 2 s; on 429/503, wait as asked (or back off) and try again."""
    for wait in (5, 15, 45, 120, 300):
        time.sleep(2)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
            time.sleep(int(e.headers.get('Retry-After') or wait))
    raise RuntimeError(f'still rate-limited: {url}')


def api(**params) -> dict:
    return json.loads(fetch(API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})))


def plain(s: str) -> str:
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def files_in(category: str, limit: int) -> list[dict]:
    d = api(action='query', generator='categorymembers', gcmtitle=category, gcmtype='file', gcmlimit=50,
            prop='imageinfo', iiprop='url|size|mime|extmetadata', iiurlwidth=1600)
    out = []
    for p in d.get('query', {}).get('pages', {}).values():
        info = p['imageinfo'][0]
        meta = info.get('extmetadata', {})
        f = {'title': p['title'], 'mime': info['mime'], 'width': info['width'], 'height': info['height'], 'url': info.get('thumburl') or info['url'],
             'page': info['descriptionurl'], 'licence': plain(meta.get('LicenseShortName', {}).get('value')),
             'categories': plain(meta.get('Categories', {}).get('value')).split('|'),
             'author': plain(meta.get('Artist', {}).get('value')) or 'Unknown (public domain)',
             'date': plain(meta.get('DateTimeOriginal', {}).get('value'))}
        # Old comics only: anything dated 1970 or later is a different style (and often not old public domain).
        years = [int(y) for y in re.findall(r'\b(1[89]\d\d|20\d\d)\b', f['title'] + ' ' + f['date'])]
        if keep(f) and not any(y >= 1970 for y in years):
            out.append(f)
    return sorted(out, key=lambda f: f['title'])[:limit]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--per-category', type=int, default=6)
    ap.add_argument('--total', type=int, default=150)
    a = ap.parse_args()
    subcats = [m['title'] for m in api(action='query', list='categorymembers', cmtitle=ROOT, cmtype='subcat', cmlimit=500)
               ['query']['categorymembers'] if 'ai-generated' not in m['title'].lower()]
    meta, n = {}, 0
    for cat in subcats:
        if n >= a.total:
            break
        folder = INCOMING / re.sub(r'[^A-Za-z0-9]+', '-', cat.removeprefix('Category:')).strip('-')[:60]
        for f in files_in(cat, a.per_category):
            stem = re.sub(r'[^A-Za-z0-9]+', '-', Path(f['title'].removeprefix('File:')).stem).strip('-')[:80]
            dest = folder / f'{stem}{ext_of(f["url"])}'
            if not dest.exists():
                folder.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(fetch(f['url']))
            meta[stem] = (f['author'][:120], f['page'])
            n += 1
        print(cat, '->', n, 'files so far')
    for folder in sorted(p for p in INCOMING.iterdir() if p.is_dir()):
        register(folder, source='Wikimedia Commons', style='old-pd', licence='Public domain',
                 author='see link', link=ROOT, meta=meta, group_prefix='commons')
    print(n, 'Commons files registered')


if __name__ == '__main__':
    main()
