"""Scoring for the comic text detector. Run: python test_comic_evaluate.py"""
import comic_common as c
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
for cls in c.CLASSES:
    m = r['per_class'][cls]
    assert abs(m['ap50'] - 1) < 1e-6 and m['precision'] == 1 and m['recall'] == 1, (cls, m)

# no predictions score 0 recall
r = evaluate(gt, [])
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
