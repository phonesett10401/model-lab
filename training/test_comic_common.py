"""Licence allow-list and frozen group splits for the comic text detector. Run: python test_comic_common.py"""
import subprocess
import sys
import tempfile
from pathlib import Path

import comic_common as c


def page(file, group, licence='CC BY 4.0'):
    return c.Page(file=file, source='Test', group=group, style='modern-western', split='', author='A',
                  licence=licence, link='https://example.org', date='2026-10-24')


# Round 3's one labelling target and five measured styles; round 2's data keeps its own class order.
assert c.CLASSES == ['bubble', 'caption', 'free-text', 'sfx']
assert c.CLASSES_V2 == ['bubble', 'caption', 'sfx', 'art-text']
assert c.STYLES == ['modern-western', 'old-american', 'manga', 'manhua', 'webtoon']
# Any recorded licence may be used for training (owner, 2026-10-25); an empty one may not.
assert c.licence_status(page('a.png', 'g', licence='unknown (publisher art)')) == 'unknown (publisher art)'
try:
    c.licence_status(page('b.png', 'g', licence=''))
    raise AssertionError('an empty licence passed')
except ValueError:
    pass

with tempfile.TemporaryDirectory() as d:
    csv = Path(d) / 'a.csv'

    # one group, one split
    c.add_pages(csv, [page(f'{g}-{i}.png', f'g{g}') for g in range(100) for i in range(2)])
    rows = c.load_attribution(csv)
    by_group = {}
    for r in rows:
        by_group.setdefault(r.group, set()).add(r.split)
    assert all(len(s) == 1 for s in by_group.values()), 'a group spans splits'
    assert {s for v in by_group.values() for s in v} == {'train', 'val', 'test'}

    # existing splits never move
    before = csv.read_bytes()
    c.add_pages(csv, [page('new-1.png', 'brand-new-group')])
    assert csv.read_bytes().startswith(before), 'old rows changed'

    # refuses a page with no licence recorded
    try:
        c.add_pages(csv, [page('bad.png', 'bad', '')])
    except ValueError:
        pass
    else:
        raise AssertionError('accepted an empty licence')
    assert 'bad.png' not in csv.read_text(encoding='utf8')

# split is stable, across processes too
assert c.split_for('pepper-ep12') == 'train'
other = subprocess.run([sys.executable, '-c', "import comic_common as c; print(c.split_for('pepper-ep12'))"],
                       capture_output=True, text=True, cwd=Path(__file__).parent).stdout.strip()
assert other == 'train', other
# pages dropped in Claude's review are left out
with tempfile.TemporaryDirectory() as d:
    review = Path(d) / 'review.csv'
    assert c.dropped(review) == set(), 'no review yet'
    review.write_text('file,verdict,note\na.jpg,ok,\nb.jpg,drop,labels miss two bubbles\n', encoding='utf8')
    assert c.dropped(review) == {'b.jpg'}
print('comic common checks passed')
