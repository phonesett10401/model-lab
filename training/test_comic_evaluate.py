"""Scoring for the comic text detector. Run: python test_comic_evaluate.py"""
import comic_common as c
from pathlib import Path
from comic_evaluate import bubbles_found, by_style, evaluate, found_by_set, grow_preds, text_gt


def gt_for(n_images, style_files=None):
    items = []
    for i in range(n_images):
        items.append((f'p{i}.jpg', 1000, 1000, [{'bbox': [10 + 100 * k, 10, 80, 60], 'category': c.CLASSES_V2[k]} for k in range(4)]))
    coco = {'images': [], 'annotations': [], 'categories': [{'id': i, 'name': n} for i, n in enumerate(c.CLASSES_V2)]}
    for image_id, (f, w, h, anns) in enumerate(items):
        coco['images'].append({'id': image_id, 'file_name': f, 'width': w, 'height': h})
        for a in anns:
            coco['annotations'].append({'id': len(coco['annotations']), 'image_id': image_id, 'category_id': c.CLASSES_V2.index(a['category']),
                                        'bbox': a['bbox'], 'area': 4800, 'iscrowd': 0})
    return coco


gt = gt_for(5)
perfect = [{'image_id': a['image_id'], 'category_id': a['category_id'], 'bbox': a['bbox'], 'score': 0.9} for a in gt['annotations']]

# perfect predictions score 1
r = evaluate(gt, perfect)
assert abs(r['map50'] - 1) < 1e-6, r
assert r['recall_all'] == 1, 'every labelled box found'
for cls in c.CLASSES_V2:
    m = r['per_class'][cls]
    assert abs(m['ap50'] - 1) < 1e-6 and m['precision'] == 1 and m['recall'] == 1, (cls, m)

# no predictions score 0 recall
r = evaluate(gt, [])
assert r['recall_all'] == 0
assert r['map50'] == 0 and all(m['recall'] == 0 and m['ap50'] == 0 for m in r['per_class'].values()), r

# a style with too few test pages is not measured
gt = gt_for(12)
pages = [c.Page(f'p{i}.jpg', 'S', f'g{i}', 'manga' if i < 9 else 'old-american', 'test', 'A', 'CC0', 'x', 'd') for i in range(12)]
styles = by_style(pages, gt, [{'image_id': a['image_id'], 'category_id': a['category_id'], 'bbox': a['bbox'], 'score': 0.9}
                              for a in gt['annotations']])
assert styles['manga'] is None, 'only 9 manga test pages'
assert styles['old-american'] is None and styles['modern-western'] is None
pages = [c.Page(f'p{i}.jpg', 'S', f'g{i}', 'manga', 'test', 'A', 'CC0', 'x', 'd') for i in range(12)]
styles = by_style(pages, gt, [])
assert styles['manga'] is not None and styles['manga']['map50'] == 0 and styles['manga']['pages'] == 12
print('comic evaluate checks passed')

# resuming continues from the last saved epoch
from comic_train import train_command  # noqa: E402
cmd, _ = train_command('dfine', 'r1-dfine', resume=True)
assert cmd[cmd.index('-r') + 1].endswith('last.pth'), cmd
cmd, _ = train_command('yolox', 'r1-yolox', resume=True)
assert '--resume' in cmd and cmd[cmd.index('-c') + 1].endswith('latest_ckpt.pth'), cmd
assert '-r' not in train_command('dfine', 'x', resume=False)[0]
print('comic resume checks passed')

# the report counts pages actually trained on, not every page in the log
from comic_evaluate import training_counts  # noqa: E402
log = [c.Page('a.jpg', 'Pepper&Carrot', 'g', 'modern-western', 'train', 'A', 'CC BY 4.0', 'x', 'd'),
       c.Page('b.jpg', 'Wikimedia Commons', 'h', 'old-american', 'train', 'A', 'Public domain', 'x', 'd')]
assert training_counts(log, {'images': [{'file_name': 'a.jpg'}]}) == {'Pepper&Carrot': 1}
print('comic training count checks passed')

# Claude's count of English the automatic labels missed gives a worst-case "share of all text found"
import tempfile  # noqa: E402
from comic_evaluate import missed_text  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    p = Path(d) / 'missed.csv'
    assert missed_text(p) is None, 'no count yet'
    p.write_text('file,labelled,missed,note\na.jpg,8,2,POOF\nb.jpg,10,0,\n', encoding='utf8')
    m = missed_text(p)
    assert m == {'pages': 2, 'labelled': 18, 'missed': 2, 'missed_share': 0.1, 'owner_checked': 0, 'owner_agreed': 0}, m
print('comic missed-text checks passed')

# the owner's spot-check of Claude's miss counts is reported with the totals
with tempfile.TemporaryDirectory() as d:
    p = Path(d) / 'missed.csv'
    p.write_text('file,labelled,missed,note,owner_check\na.jpg,8,2,x,agree\nb.jpg,10,0,,1\nc.jpg,5,0,,\n', encoding='utf8')
    m = missed_text(p)
    assert m['owner_checked'] == 2 and m['owner_agreed'] == 1, m
    assert m['missed'] == 3, 'an owner correction replaces Claude count'

# Round 3's measure: the share of proper bubbles (bubble, caption) a box at or above CONF covers at least half of;
# one predicted box finds one bubble at most (a box over a whole row of bubbles finds one of them, not all).
fg = {'images': [{'id': 1, 'file_name': 'a.jpg', 'width': 600, 'height': 400}],
      'categories': [{'id': i, 'name': n} for i, n in enumerate(c.CLASSES)],
      'annotations': [{'id': 1, 'image_id': 1, 'category_id': 0, 'bbox': [0, 0, 100, 100]},
                      {'id': 2, 'image_id': 1, 'category_id': 1, 'bbox': [200, 0, 90, 90]},
                      {'id': 3, 'image_id': 1, 'category_id': 3, 'bbox': [400, 0, 50, 50]}]}  # sfx: not a proper bubble
half = {'image_id': 1, 'category_id': 0, 'bbox': [0, 0, 50, 100], 'score': 0.9}
third = {'image_id': 1, 'category_id': 0, 'bbox': [200, 0, 30, 90], 'score': 0.9}
r = bubbles_found(fg, [half, third], c.CLASSES)
assert (r['found'], r['total']) == (1, 2), r
low = {**half, 'score': 0.1}
assert bubbles_found(fg, [low], c.CLASSES)['found'] == 0
wide = {'image_id': 1, 'category_id': 0, 'bbox': [0, 0, 300, 100], 'score': 0.9}
assert bubbles_found(fg, [wide], c.CLASSES)['found'] == 1
# a sound-effect box doesn't find a bubble (the page would leave it in the art)
assert bubbles_found(fg, [{**half, 'category_id': 3}], c.CLASSES)['found'] == 0

# old (round 2) boxes are text-sized: grown to the bubble around them before scoring
import numpy as np
from PIL import Image, ImageDraw
im = Image.new('RGB', (600, 400), (110, 110, 110))
ImageDraw.Draw(im).ellipse([20, 20, 300, 250], fill='white', outline='black', width=3)
og = {**fg, 'annotations': [{'id': 1, 'image_id': 1, 'category_id': 0, 'bbox': [20, 20, 281, 231]}]}
text = {'image_id': 1, 'category_id': 0, 'bbox': [110, 110, 100, 40], 'score': 0.9}
assert bubbles_found(og, [text], c.CLASSES_V2)['found'] == 0
grown = grow_preds([text], {1: np.asarray(im)}, c.CLASSES_V2)
assert bubbles_found(og, grown, c.CLASSES_V2)['found'] == 1, grown

# results come per set: each style's test file and test97
sets = {'manga': og, 'test97': fg}
res = found_by_set(sets, lambda name, gt: [text] if name == 'manga' else [half])
assert res['manga']['share'] == 0.0 and res['test97']['share'] == 0.5, res
assert found_by_set(sets, lambda name, gt: grow_preds([text], {1: np.asarray(im)}, c.CLASSES_V2))['manga']['share'] == 1.0

# text found: each answer box stands for the text inside it (the union of the text boxes whose middles it holds); a
# tight box on the words of a big bubble finds it, though it covers under half of the bubble's box
big = {**fg, 'annotations': [{'id': 1, 'image_id': 1, 'category_id': 0, 'bbox': [0, 0, 300, 300]},
                             {'id': 2, 'image_id': 1, 'category_id': 0, 'bbox': [400, 0, 100, 100]}]}
tight = {'image_id': 1, 'category_id': 0, 'bbox': [100, 100, 100, 40], 'score': 0.9}
assert bubbles_found(big, [tight], c.CLASSES)['found'] == 0
tg = text_gt(big, {1: [[110, 110, 80, 20], [110, 125, 60, 10]]})
assert tg['annotations'][0]['bbox'] == [110, 110, 80, 25] and tg['annotations'][1]['bbox'] == [400, 0, 100, 100], tg
assert bubbles_found(tg, [tight], c.CLASSES)['found'] == 1
print('comic owner-check checks passed')

# round 3's report card: per style, the share found by the new and the old finder (bubbles and texts), test pages per
# style, training pages per source, and every source credited once
from comic_evaluate import build_report3
pg = lambda f, src, style: c.Page(file=f, source=src, group=src, style=style, split='', author='A ' + src, licence='L', link='https://x/' + src, date='d')
pages = [pg('a.jpg', 'Pepper&Carrot', 'modern-western'), pg('b.jpg', 'Comix', 'old-american'), pg('m.jpg', 'manga-text-detection', 'manga')]
train = {'images': [{'file_name': 'comic/images/a.jpg'}, {'file_name': 'comic3/comix/images/b.jpg'}]}
found = {'new': {'manga': {'found': 9, 'total': 10, 'pages': 3}, 'test97': {'found': 4, 'total': 5, 'pages': 2}},
         'old': {'manga': {'found': 8, 'total': 10, 'pages': 3}, 'test97': {'found': 5, 'total': 5, 'pages': 2}},
         'new_text': {'manga': {'found': 10, 'total': 10, 'pages': 3}, 'test97': {'found': 5, 'total': 5, 'pages': 2}},
         'old_text': {'manga': {'found': 7, 'total': 10, 'pages': 3}, 'test97': {'found': 4, 'total': 5, 'pages': 2}}}
pages.append(pg('old.jpg', 'Wikimedia Commons', 'old-american'))  # in the log, but in no split this round: not credited
rep = build_report3('r3', 'r2', found, train, pages, used={'a.jpg', 'b.jpg', 'm.jpg'})
assert rep['run'] == 'r3' and rep['old_run'] == 'r2'
assert rep['styles']['manga'] == {'pages': 3, 'bubbles': {'new': 0.9, 'old': 0.8}, 'texts': {'new': 1.0, 'old': 0.7}}, rep['styles']
assert rep['styles']['test97']['bubbles'] == {'new': 0.8, 'old': 1.0}
assert {'label': 'Training pages: Pepper&Carrot', 'value': 1} in rep['data'] and {'label': 'Training pages: Comix', 'value': 1} in rep['data']
assert sorted(x['source'] for x in rep['credits']) == ['Comix', 'Pepper&Carrot', 'manga-text-detection'], rep['credits']
assert rep['credits'][0].keys() == {'source', 'author', 'licence', 'link'}
print('comic report3 checks passed')
