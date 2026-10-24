"""Draft boxes to Label Studio tasks and the owner's corrected export back to COCO. Run: python test_comic_draft.py"""
from comic_draft import coco_from_export, tasks_from_boxes

boxes = {'p1.jpg': (1600, 2400, [{'bbox': [100, 200, 400, 300], 'category': 'bubble'}, {'bbox': [900, 50, 200, 120], 'category': 'sfx'}]),
         'p2.jpg': (1600, 1000, [])}
tasks = tasks_from_boxes(boxes, 'round1')
assert len(tasks) == 2 and tasks[0]['data']['image'].endswith('d=images/p1.jpg'), tasks[0]['data']
r = tasks[0]['predictions'][0]['result']
assert [x['value']['rectanglelabels'] for x in r] == [['bubble'], ['sfx']]
assert abs(r[0]['value']['x'] - 100 / 1600 * 100) < 1e-9 and abs(r[0]['value']['height'] - 300 / 2400 * 100) < 1e-9

# The owner accepts the drafts, deletes the sfx, adds a caption: Label Studio's JSON export holds the corrected boxes.
done = [dict(t, annotations=[{'result': t['predictions'][0]['result'][:1] + [{
    'type': 'rectanglelabels', 'original_width': 1600, 'original_height': 2400,
    'value': {'x': 50.0, 'y': 50.0, 'width': 10.0, 'height': 5.0, 'rectanglelabels': ['caption']}}]}]) for t in tasks[:1]]
done.append(dict(tasks[1], annotations=[{'result': [], 'was_cancelled': True}]))  # skipped page: left out
coco = coco_from_export(done)
assert [i['file_name'] for i in coco['images']] == ['p1.jpg'], 'cancelled pages are left out'
got = [(a['category_id'], [round(v) for v in a['bbox']]) for a in coco['annotations']]
assert got == [(0, [100, 200, 400, 300]), (1, [800, 1200, 160, 120])], got
print('comic draft checks passed')
