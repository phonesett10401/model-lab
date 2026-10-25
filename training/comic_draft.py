"""Draft boxes for Label Studio, and the owner's corrected export back into our COCO labels. See comic_labelstudio.md.

Drafts:  python comic_draft.py tasks <pepper|blackjack|commons> [--run <run>] [--from-coco pepper_draft.json]
         (--run uses our trained model; with --from-coco too, the model only adds boxes the existing ones missed)
Labels:  python comic_draft.py labels <pepper|blackjack|commons> <label-studio-export.json>
"""
import argparse
import json
from pathlib import Path

from PIL import Image

import comic_common as c

SOURCES = {'pepper': 'Pepper&Carrot', 'blackjack': 'Black Jack', 'commons': 'Wikimedia Commons'}
TASKS = c.DATA / 'labelstudio'


def tasks_from_boxes(boxes: dict[str, tuple[int, int, list[dict]]], model_version: str) -> list[dict]:
    """boxes: file -> (width, height, [{'bbox': [x, y, w, h], 'category'}]). Label Studio wants percentages."""
    tasks = []
    for file, (W, H, anns) in boxes.items():
        result = [{'from_name': 'label', 'to_name': 'image', 'type': 'rectanglelabels', 'original_width': W, 'original_height': H,
                   'value': {'x': x / W * 100, 'y': y / H * 100, 'width': w / W * 100, 'height': h / H * 100,
                             'rectanglelabels': [a['category']]}}
                  for a in anns for x, y, w, h in [a['bbox']]]
        tasks.append({'data': {'image': f'/data/local-files/?d=images/{file}', 'file': file},
                      'predictions': [{'model_version': model_version, 'result': result}]})
    return tasks


def coco_from_export(export: list[dict]) -> dict:
    """Label Studio JSON export -> COCO. Pages the owner skipped (cancelled) or never opened are left out."""
    items = []
    for t in export:
        done = [a for a in t.get('annotations', []) if not a.get('was_cancelled')]
        if not done:
            continue
        file = t['data']['file']
        W = H = None
        anns = []
        for r in done[-1]['result']:
            if r.get('type') != 'rectanglelabels':
                continue
            W, H, v = r['original_width'], r['original_height'], r['value']
            anns.append({'bbox': [v['x'] * W / 100, v['y'] * H / 100, v['width'] * W / 100, v['height'] * H / 100],
                         'category': v['rectanglelabels'][0]})
        if W is None:
            W, H = Image.open(c.DATA / 'images' / file).size
        items.append((file, W, H, anns))
    return c.coco_dict(items)


def _iou(a, b):
    ix = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / (a[2] * a[3] + b[2] * b[3] - inter) if inter else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    t = sub.add_parser('tasks')
    t.add_argument('source', choices=SOURCES)
    t.add_argument('--run')
    t.add_argument('--from-coco')
    lab = sub.add_parser('labels')
    lab.add_argument('source', choices=SOURCES)
    lab.add_argument('export', type=Path)
    a = ap.parse_args()
    if a.cmd == 'labels':
        out = c.DATA / f'{a.source}_labels.json'
        out.write_text(json.dumps(coco_from_export(json.loads(a.export.read_text(encoding='utf8')))), encoding='utf8')
        print('wrote', out)
        return
    files = [p.file for p in c.load_attribution() if p.source.startswith(SOURCES[a.source])]
    boxes = {f: (*Image.open(c.DATA / 'images' / f).size, []) for f in files}
    if a.from_coco:
        coco = json.loads((c.DATA / a.from_coco).read_text(encoding='utf8'))
        name = {i['id']: i['file_name'] for i in coco['images']}
        for x in coco['annotations']:
            if name[x['image_id']] in boxes:
                boxes[name[x['image_id']]][2].append({'bbox': x['bbox'], 'category': c.CLASSES[x['category_id']]})
    if a.run:
        import onnxruntime as ort
        from comic_evaluate import predict
        d = c.RUNS / a.run
        session = ort.InferenceSession(str(d / 'model.onnx'), providers=['CPUExecutionProvider'])
        kind = (d / 'kind.txt').read_text().strip()
        for f, (W, H, anns) in boxes.items():
            for k, score, b in predict(session, kind, Image.open(c.DATA / 'images' / f)):
                if score >= 0.3 and all(_iou(b, x['bbox']) < 0.3 for x in anns):
                    anns.append({'bbox': b, 'category': c.CLASSES[k]})
    TASKS.mkdir(parents=True, exist_ok=True)
    out = TASKS / f'{a.source}_tasks.json'
    out.write_text(json.dumps(tasks_from_boxes(boxes, a.run or a.from_coco or 'empty')), encoding='utf8')
    print(len(boxes), 'pages ->', out)


if __name__ == '__main__':
    main()
