"""Comix story pages are picked per book. Run: python test_comic_comix.py"""
import io
import json
import tarfile
import tempfile
from pathlib import Path

from comic_comix import story_pages

with tempfile.TemporaryDirectory() as d:
    tar = Path(d) / 'pages.tar'
    with tarfile.open(tar, 'w') as t:
        def add(name, data):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
        for book, n in (('c1', 10), ('c2', 3)):
            for p in range(n):
                stem = f'{book}_p{p:03d}'
                add(f'{stem}.json', json.dumps({'book_id': book, 'page_number': p, 'page_class': 'Cover' if p == 0 else 'Story'}).encode())
                add(f'{stem}.jpg', b'jpg' + stem.encode())
    got = story_pages(tar, per_book=4)
    assert sorted(got) == ['c1', 'c2'], got
    assert len(got['c1']) == 4 and len(got['c2']) == 2, {k: len(v) for k, v in got.items()}  # covers left out
    assert all(not s.endswith('p000') for v in got.values() for s, _ in v)
    assert got['c1'][0] == ('c1_p001', b'jpgc1_p001')
print('comic comix checks passed')
