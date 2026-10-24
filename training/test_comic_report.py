"""The report-card numbers say exactly what was measured. Run: python test_comic_report.py"""
import tempfile
from pathlib import Path

import comic_common as c
from comic_evaluate import build_report, evaluate, missed_text

page = lambda f, split, src='Pepper&Carrot': c.Page(f, src, f'g-{f}', 'modern-western', split, 'A', 'CC BY 4.0', 'x', 'd')
gt = {'images': [{'id': 1, 'file_name': 't1.jpg', 'width': 100, 'height': 100}, {'id': 2, 'file_name': 't2.jpg', 'width': 100, 'height': 100}],
      'annotations': [{'id': i, 'image_id': im, 'category_id': 0, 'bbox': [10 * i, 10, 8, 8], 'area': 64, 'iscrowd': 0}
                      for i, im in ((1, 1), (2, 1), (3, 1), (4, 2))],
      'categories': [{'id': i, 'name': n} for i, n in enumerate(c.CLASSES)]}
pred = [{'image_id': a['image_id'], 'category_id': 0, 'bbox': a['bbox'], 'score': 0.9} for a in gt['annotations'][:3]]
pages = [page('t1.jpg', 'test'), page('t2.jpg', 'test'), page('tr.jpg', 'train')]
train = {'images': [{'file_name': 'tr.jpg'}]}

with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    review = d / 'review.csv'
    review.write_text('file,verdict,note\nt9.jpg,drop,x\nc1.jpg,drop,credits\nc2.jpg,drop,credits\n', encoding='utf8')
    test_pages = pages + [page('t9.jpg', 'test'), page('c1.jpg', 'train'), page('c2.jpg', 'train')]
    missed = d / 'missed.csv'
    missed.write_text('file,labelled,missed,note,owner_check\nt1.jpg,2,1,old count,agree\n', encoding='utf8')

    # the miss share uses today's label count for each page (3 boxes on t1), not the count written down earlier (2)
    m = missed_text(missed, gt)
    assert m['labelled'] == 3 and m['missed_share'] == 0.25, m

    result = evaluate(gt, pred)
    r = build_report('run1', gt, result, {'manga': None, 'modern-western': None, 'old-pd': None}, test_pages, train, missed, review)
    labels = {x['label']: x['value'] for x in r['data']}

    # drops are counted for the test set, with the total named apart
    assert '1 test page dropped in review (3 pages in all)' in labels['Test labels'], labels['Test labels']
    # the circularity is disclosed
    assert 'earlier version of this detector' in labels['Test labels']
    # precision and recall per type, not only AP
    assert r['metrics']['bubble']['recall'] == 0.75 and r['metrics']['bubble']['precision'] == 1.0, r['metrics']
    assert r['metrics']['sfx'] is None
    assert r['found']['worst_case_of_all_text'] == round(0.75 * (1 - 0.25), 3), r['found']
print('comic report checks passed')
