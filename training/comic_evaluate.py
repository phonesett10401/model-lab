"""Scores the comic text detector, using the exported ONNX file (exactly what the browser will run).

Run: python comic_evaluate.py <run> <val|test>
On `test` it writes src/lib/data/comic-translator.json. Numbers there come only from this script, never typed by hand.
"""
import collections
import contextlib
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

import comic_common as c

CONF = 0.3  # boxes at or above this count as the model's answer for precision/recall
IOU = 0.5
MIN_STYLE_PAGES = 10
SIZE = 1024
OUT = c.HERE.parent / 'src/lib/data/comic-translator.json'


def _iou(a, b):
    ix = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / (a[2] * a[3] + b[2] * b[3] - inter) if inter else 0.0


def evaluate(gt: dict, pred: list[dict]) -> dict:
    """{'per_class': {cls: {'precision', 'recall', 'ap50'}}, 'map50'}; a class with no boxes in gt gets None."""
    from pycocotools.coco import COCO
    from pycocotools.cocoeval import COCOeval

    per_class = {}
    with contextlib.redirect_stdout(io.StringIO()):
        g = COCO()
        g.dataset = json.loads(json.dumps(gt))
        # pycocotools reads annotation id 0 as "unmatched", so ids must start at 1.
        for i, a in enumerate(g.dataset['annotations'], start=1):
            a['id'] = i
        g.createIndex()
        ap = {}
        if pred:
            e = COCOeval(g, g.loadRes(json.loads(json.dumps(pred))), 'bbox')
            e.params.iouThrs = np.array([IOU])
            e.evaluate()
            e.accumulate()
            for k in range(len(c.CLASSES)):
                p = e.eval['precision'][0, :, k, 0, -1]
                ap[k] = float(p[p > -1].mean()) if (p > -1).any() else None
    for k, name in enumerate(c.CLASSES):
        truth = collections.defaultdict(list)
        for a in gt['annotations']:
            if a['category_id'] == k:
                truth[a['image_id']].append(a['bbox'])
        n_truth = sum(len(v) for v in truth.values())
        if not n_truth:
            per_class[name] = None
            continue
        hits = n_pred = 0
        for image_id in {im['id'] for im in gt['images']}:
            free = list(truth.get(image_id, []))
            for p in sorted((p for p in pred if p['image_id'] == image_id and p['category_id'] == k and p['score'] >= CONF),
                            key=lambda p: -p['score']):
                n_pred += 1
                best = max(free, key=lambda t: _iou(t, p['bbox']), default=None)
                if best is not None and _iou(best, p['bbox']) >= IOU:
                    hits += 1
                    free.remove(best)
        per_class[name] = {'precision': hits / n_pred if n_pred else 0.0, 'recall': hits / n_truth,
                           'ap50': ap.get(k) or 0.0}
    scored = [m['ap50'] for m in per_class.values() if m]
    return {'per_class': per_class, 'map50': float(np.mean(scored)) if scored else 0.0}


def subset(gt: dict, image_ids: set) -> dict:
    return {**gt, 'images': [i for i in gt['images'] if i['id'] in image_ids],
            'annotations': [a for a in gt['annotations'] if a['image_id'] in image_ids]}


def by_style(pages: list[c.Page], gt: dict, pred: list[dict], min_pages: int = MIN_STYLE_PAGES) -> dict:
    """Scores per style; a style with fewer than min_pages pages is None ("not yet measured")."""
    style_of = {p.file: p.style for p in pages}
    out = {}
    for style in c.STYLES:
        ids = {i['id'] for i in gt['images'] if style_of.get(i['file_name']) == style}
        out[style] = None if len(ids) < min_pages else {
            **evaluate(subset(gt, ids), [p for p in pred if p['image_id'] in ids]), 'pages': len(ids)}
    return out


def predict(session, kind: str, im: Image.Image) -> list[tuple[int, float, list[float]]]:
    """(class, score, [x, y, w, h]) in page pixels, scores down to 0.01 so AP sees the whole curve."""
    W, H = im.size
    if kind == 'dfine':
        x = np.asarray(im.convert('RGB').resize((SIZE, SIZE), Image.BILINEAR), np.float32).transpose(2, 0, 1)[None] / 255
        labels, boxes, scores = session.run(None, {'images': x, 'orig_target_sizes': np.array([[W, H]], np.int64)})
        return [(int(l), float(s), [float(b[0]), float(b[1]), float(b[2] - b[0]), float(b[3] - b[1])])
                for l, b, s in zip(labels[0], boxes[0], scores[0]) if s >= 0.01]
    import torch
    from torchvision.ops import batched_nms
    r = min(SIZE / H, SIZE / W)
    canvas = np.full((SIZE, SIZE, 3), 114, np.float32)
    canvas[:round(H * r), :round(W * r)] = np.asarray(im.convert('RGB').resize((round(W * r), round(H * r)), Image.BILINEAR), np.float32)
    (out,) = session.run(None, {'images': canvas[:, :, ::-1].transpose(2, 0, 1)[None].copy()})
    o = torch.from_numpy(out[0])
    cls_score, cls = o[:, 5:].max(1)
    score = o[:, 4] * cls_score
    keep = score >= 0.01
    o, score, cls = o[keep], score[keep], cls[keep]
    xyxy = torch.stack([o[:, 0] - o[:, 2] / 2, o[:, 1] - o[:, 3] / 2, o[:, 0] + o[:, 2] / 2, o[:, 1] + o[:, 3] / 2], 1) / r
    keep = batched_nms(xyxy, score, cls, 0.45)
    return [(int(cls[i]), float(score[i]), [float(xyxy[i, 0]), float(xyxy[i, 1]), float(xyxy[i, 2] - xyxy[i, 0]), float(xyxy[i, 3] - xyxy[i, 1])])
            for i in keep.tolist()]


def run_model(run: str, gt: dict) -> list[dict]:
    import onnxruntime as ort
    d = c.RUNS / run
    # CPU, like the browser (and onnxruntime's GPU mode can't find cuDNN on this machine).
    session = ort.InferenceSession(str(d / 'model.onnx'), providers=['CPUExecutionProvider'])
    kind = (d / 'kind.txt').read_text().strip()
    preds = []
    for img in gt['images']:
        for k, s, b in predict(session, kind, Image.open(c.DATA / 'images' / img['file_name'])):
            preds.append({'image_id': img['id'], 'category_id': k, 'bbox': b, 'score': s})
    return preds


def table(r: dict) -> str:
    rows = [f'{n:<9} ' + ('-' if m is None else f"AP50 {m['ap50']:.3f}  P {m['precision']:.3f}  R {m['recall']:.3f}")
            for n, m in r['per_class'].items()]
    return '\n'.join(rows + [f"mAP@50   {r['map50']:.3f}"])


def main() -> None:
    run, split = sys.argv[1:3]
    gt = json.loads((c.DATA / 'annotations' / f'{split}.json').read_text(encoding='utf8'))
    pred = run_model(run, gt)
    pages = c.load_attribution()
    result = evaluate(gt, pred)
    styles = by_style(pages, gt, pred)
    print(f'{run} on {split}: {len(gt["images"])} pages\n{table(result)}')
    for s, r in styles.items():
        print(f'-- {s}: ' + ('not yet measured (fewer than 10 pages)' if r is None else f"{r['pages']} pages, mAP@50 {r['map50']:.3f}"))
    if split != 'test':
        return
    used = collections.Counter(p.source for p in pages if p.split == 'train')
    OUT.write_text(json.dumps({
        'run': run,
        'data': [{'label': f'Training pages: {s}', 'value': n} for s, n in sorted(used.items())]
                + [{'label': 'Test pages (real, never trained on)', 'value': len(gt['images'])}],
        'metrics': {n: (None if m is None else round(m['ap50'], 3)) for n, m in result['per_class'].items()},
        'map50': round(result['map50'], 3),
        'styles': {s: (None if r is None else {'pages': r['pages'], 'map50': round(r['map50'], 3)}) for s, r in styles.items()},
    }, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    print('wrote', OUT)


if __name__ == '__main__':
    main()
