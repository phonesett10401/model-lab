"""Round 3's splits: test pages never leak into training. Run: python test_comic_split3.py"""
import comic_common as c
from comic_split3 import MIN_TEST, assign, style_counts, to_test97


def page(file, source, group, style='manga', split=''):
    return c.Page(file=file, source=source, group=group, style=style, split=split, author='A', licence='x', link='x', date='d')


pages = ([page(f'bj{v}_{i}.jpg', 'Black Jack', f'blackjack-v{v:02d}', split='test' if v in (2, 6) else 'train') for v in range(1, 8) for i in range(5)]
         + [page(f'mt_{i}.jpg', 'manga-text-detection', 'manga-text-detection') for i in range(40)]
         + [page(f'le_{i}.jpg', 'lie-eater', 'lie-eater') for i in range(200)]
         + [page(f'synth3_{i}.jpg', 'Synthetic lettering on Pepper&Carrot art (round 3)', 'pepper-ep04', 'modern-western') for i in range(20)])
split = assign(pages, held_out={'manga-text-detection'}, dropped={'bj1_0.jpg'})

# no page, book, episode or series in two splits (a dict holds one split per page; groups of our own pages stay whole)
groups = {}
for p in pages:
    if p.file in split and p.source == 'Black Jack':
        groups.setdefault(p.group, set()).add(split[p.file])
assert all(len(s) == 1 for s in groups.values()), groups
assert groups['blackjack-v02'] == {'test'} and groups['blackjack-v06'] == {'test'}

# held-out sources appear only in test; other imported sources never do (they have no book IDs to split by)
assert all(split[p.file] == 'test' for p in pages if p.source == 'manga-text-detection')
assert {split[p.file] for p in pages if p.source == 'lie-eater'} == {'train', 'val'}
# synthetic pages train only, even when their art page's episode is a test episode; reviewed drops are left out
assert all(split[p.file] == 'train' for p in pages if p.file.startswith('synth3_'))
assert 'bj1_0.jpg' not in split

# every style with data has a test set of at least MIN_TEST pages; styles without one are reported, not hidden
counts = style_counts(pages, split)
assert counts['manga'] >= MIN_TEST == 30 and counts['manhua'] == 0, counts

# test97: a box for every round-2 labelled bubble (grown where a bubble a little bigger is found, kept as found where not)
import numpy as np
from PIL import Image, ImageDraw
im = Image.new('RGB', (400, 300), (110, 110, 110))
ImageDraw.Draw(im).ellipse([40, 40, 260, 220], fill='white', outline='black', width=3)
old = [{'bbox': [48, 50, 205, 165], 'category': 'bubble', 'text': 'HI'}, {'bbox': [300, 250, 50, 20], 'category': 'art-text', 'text': 'CLAP'},
       {'bbox': [320, 20, 40, 20], 'category': 'bubble', 'text': 'x'}]
new = to_test97(np.asarray(im), old)
assert len([l for l in new if l['category'] == 'bubble']) == 2, new
assert new[0]['bbox'][2] > 200 and [l['category'] for l in new][1] == 'sfx', new
# two joined bubbles, each labelled: growing either takes in both, so each keeps its own box (never two copies of one)
im = Image.new('RGB', (500, 300), (110, 110, 110))
g = ImageDraw.Draw(im)
for box in ([40, 60, 240, 240], [200, 80, 340, 220]):
    g.ellipse(box, outline='black', width=3)
for box in ([43, 63, 237, 237], [203, 83, 337, 217]):
    g.ellipse(box, fill='white')
old = [{'bbox': [80, 110, 110, 70], 'category': 'bubble'}, {'bbox': [230, 120, 90, 60], 'category': 'bubble'}]
assert to_test97(np.asarray(im), old) == old, to_test97(np.asarray(im), old)
print('comic split3 checks passed')
