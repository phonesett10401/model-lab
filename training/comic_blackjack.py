"""Give My Regards to Black Jack (Shuho Sato, Sato Manga Works): the official English edition from Manga on Web.

Terms of Use (effective 15 Sept 2012, printed at the end of every volume): free reproduction, public transmission and
adaptation, commercial or not, of Sato Manga Works' own data for the original 13 volumes (not "The New Give My Regards
to Black Jack", not scans of printed books); every use must credit "Give My Regards to Black Jack / Shuho Sato /
Manga on Web / http://mangaonweb.com"; uses are to be reported afterwards to Sato Manga Works.
Manga on Web closed (its domain is for sale), so the files come from the Internet Archive copy of that data.

Run: python comic_blackjack.py [--volumes 1 2 4 6 8 12] [--pages 25]
"""
import argparse
import io
import re
import time
import urllib.request
import zipfile

import comic_common as c
from comic_incoming import register

ITEM = 'https://archive.org/download/manga_Black_Jack_ni_Yoroshiku/'
UA = {'User-Agent': 'AI-Model-Lab comic-translator dataset (github.com/phonesett10401/model-lab)'}
INCOMING = c.HERE / 'incoming/comic/blackjack'
SKIP = 3  # cover and contents at the start, terms of use at the end
CREDIT = 'Give My Regards to Black Jack / Shuho Sato / Manga on Web / http://mangaonweb.com'


def pick(n: int, k: int) -> list[int]:
    """k evenly spaced page indexes, leaving out the first and last SKIP pages."""
    lo, hi = SKIP, n - SKIP
    if hi - lo <= k:
        return list(range(lo, max(lo, hi)))
    return [lo + round(i * (hi - lo - 1) / (k - 1)) for i in range(k)]


def safe_name(name: str) -> str:
    """Archive entry name -> plain file name (no folders, no '..')."""
    base = name.replace('\\', '/').rsplit('/', 1)[-1]
    stem, _, ext = base.rpartition('.')
    return re.sub(r'[^A-Za-z0-9]+', '-', stem).strip('-') + '.' + ext.lower()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--volumes', type=int, nargs='*', default=[1, 2, 4, 6, 8, 12])  # 2 and 6 fall in the test split
    ap.add_argument('--pages', type=int, default=25)
    a = ap.parse_args()
    for v in a.volumes:
        assert 1 <= v <= 13, 'only the original 13 volumes are covered by the terms'
        folder = INCOMING / f'v{v:02d}'
        if not folder.exists():
            url = f'{ITEM}Black%20Jack%20ni%20Yoroshiku%20v{v:02d}.cbz'
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
                data = r.read()
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                names = sorted(n for n in z.namelist() if n.lower().endswith(('.jpg', '.jpeg', '.png')))
                folder.mkdir(parents=True)
                for i in pick(len(names), a.pages):
                    (folder / safe_name(names[i])).write_bytes(z.read(names[i]))
            time.sleep(2)
        print(f'v{v:02d}:', len(list(folder.iterdir())), 'pages')
    pages = register(INCOMING, source='Black Jack ni Yoroshiku (Give My Regards to Black Jack)', style='manga',
                     licence='Black Jack free reuse', author='Shuho Sato (Sato Manga Works)', link=CREDIT)
    print(len(pages), 'pages registered')


if __name__ == '__main__':
    main()
