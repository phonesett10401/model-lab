"""Registering pages the owner (or a downloader) saved under incoming/comic/<source>/<group>/. Run: python test_comic_incoming.py"""
import tempfile
from pathlib import Path

from PIL import Image

import comic_common as c
from comic_incoming import register

with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    for group in ('ch01', 'ch02'):
        (d / 'incoming/x' / group).mkdir(parents=True)
        for i in range(2):
            Image.new('RGB', (800, 1200), 'white').save(d / 'incoming/x' / group / f'p{i}.png')
    csv, images = d / 'a.csv', d / 'images'
    kw = dict(source='X comics', style='manga', author='A. Author', link='https://example.org', attribution=csv, images=images)

    # licence must be allowed: nothing saved or logged
    try:
        register(d / 'incoming/x', licence='CC BY-SA 4.0', **kw)
    except ValueError:
        pass
    else:
        raise AssertionError('accepted CC BY-SA')
    assert not csv.exists() and not images.exists()

    # groups come from folders
    pages = register(d / 'incoming/x', licence='Black Jack free reuse', **kw)
    assert sorted({p.group for p in pages}) == ['x-ch01', 'x-ch02'], pages
    rows = c.load_attribution(csv)
    assert len(rows) == 4 and all((images / r.file).exists() for r in rows)
    assert Image.open(images / rows[0].file).width == 1600, 'resized to the common width'

    # registering again adds nothing
    register(d / 'incoming/x', licence='Black Jack free reuse', **kw)
    assert len(c.load_attribution(csv)) == 4

    # per-file author and link, and a group prefix for flat folders
    flat = d / 'commons/Planet-Comics'
    flat.mkdir(parents=True)
    Image.new('RGB', (900, 1300), 'white').save(flat / 'page-a.jpg')
    pages = register(flat, source='Wikimedia Commons', style='old-pd', licence='Public domain', author='see link',
                     link='x', attribution=csv, images=images, group_prefix='commons',
                     meta={'page-a': ('Fiction House', 'https://commons.wikimedia.org/wiki/File:Page_a.jpg')})
    assert pages[0].group == 'commons-Planet-Comics' and pages[0].file == 'commons_Planet-Comics_page-a.jpg', pages[0]
    assert (pages[0].author, pages[0].link) == ('Fiction House', 'https://commons.wikimedia.org/wiki/File:Page_a.jpg')
print('comic incoming checks passed')
