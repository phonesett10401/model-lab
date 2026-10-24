"""Scoring for the comic text detector. Run: python test_comic_evaluate.py"""
import comic_common as c
from pathlib import Path
from comic_evaluate import by_style, evaluate


def gt_for(n_images, style_files=None):
    items = []
    for i in range(n_images):
        items.append((f'p{i}.jpg', 1000, 1000, [{'bbox': [10 + 100 * k, 10, 80, 60], 'category': c.CLASSES[k]} for k in range(4)]))
    coco = {'images': [], 'annotations': [], 'categories': [{'id': i, 'name': n} for i, n in enumerate(c.CLASSES)]}
    for image_id, (f, w, h, anns) in enumerate(items):
        coco['images'].append({'id': image_id, 'file_name': f, 'width': w, 'height': h})
        for a in anns:
            coco['annotations'].append({'id': len(coco['annotations']), 'image_id': image_id, 'category_id': c.CLASSES.index(a['category']),
                                        'bbox': a['bbox'], 'area': 4800, 'iscrowd': 0})
    return coco


gt = gt_for(5)
perfect = [{'image_id': a['image_id'], 'category_id': a['category_id'], 'bbox': a['bbox'], 'score': 0.9} for a in gt['annotations']]

# perfect predictions score 1
r = evaluate(gt, perfect)
assert abs(r['map50'] - 1) < 1e-6, r
assert r['recall_all'] == 1, 'every labelled box found'
for cls in c.CLASSES:
    m = r['per_class'][cls]
    assert abs(m['ap50'] - 1) < 1e-6 and m['precision'] == 1 and m['recall'] == 1, (cls, m)

# no predictions score 0 recall
r = evaluate(gt, [])
assert r['recall_all'] == 0
assert r['map50'] == 0 and all(m['recall'] == 0 and m['ap50'] == 0 for m in r['per_class'].values()), r

# a style with too few test pages is not measured
gt = gt_for(12)
pages = [c.Page(f'p{i}.jpg', 'S', f'g{i}', 'manga' if i < 9 else 'old-pd', 'test', 'A', 'CC0', 'x', 'd') for i in range(12)]
styles = by_style(pages, gt, [{'image_id': a['image_id'], 'category_id': a['category_id'], 'bbox': a['bbox'], 'score': 0.9}
                              for a in gt['annotations']])
assert styles['manga'] is None, 'only 9 manga test pages'
assert styles['old-pd'] is None and styles['modern-western'] is None
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
       c.Page('b.jpg', 'Wikimedia Commons', 'h', 'old-pd', 'train', 'A', 'Public domain', 'x', 'd')]
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
print('comic owner-check checks passed')
