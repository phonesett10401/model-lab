"""Evaluate a trained run on its frozen test split, export ONNX, and pick failure examples.

Usage: python evaluate.py <data.yaml> <run-name>
Writes runs/<run-name>/report/: metrics.json, failures/*.jpg, and weights/best.onnx next to best.pt.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

CONF, IOU = 0.25, 0.5  # a prediction counts when confident ≥ 25% and overlapping a true box by ≥ 50%
# Measure exactly as the site runs it: the ONNX file takes a full 640×640 square, so no 'rect' (minimal-padding) input here.
SQUARE = dict(imgsz=640, rect=False)


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def truth(label_file, w, h):
    rows = [l.split() for l in label_file.read_text().splitlines() if l.strip()]
    return [(int(c), ((x - bw / 2) * w, (y - bh / 2) * h, (x + bw / 2) * w, (y + bh / 2) * h))
            for c, x, y, bw, bh in ((r[0], *map(float, r[1:])) for r in rows)]


def compare(gt, pred):
    """Greedy match by confidence. Returns (missed truths, false predictions, wrong-name pairs)."""
    used, false, wrong = set(), [], []
    for c, box, conf in sorted(pred, key=lambda p: -p[2]):
        best = max(((iou(box, g[1]), i) for i, g in enumerate(gt) if i not in used), default=(0, -1))
        if best[0] < IOU:
            false.append((c, box, conf))
        else:
            used.add(best[1])
            if gt[best[1]][0] != c:
                wrong.append((gt[best[1]], (c, box, conf)))
    missed = [g for i, g in enumerate(gt) if i not in used]
    return missed, false, wrong


if __name__ == '__main__':
    data, name = Path(sys.argv[1]), sys.argv[2]
    # Optional file-name prefix to score one source on its own, e.g. aq_ (aquarium) or oi_ (Open Images).
    prefix = sys.argv[3] if len(sys.argv) > 3 else ''
    tag = f'-{prefix.rstrip("_")}' if prefix else ''
    run = Path(__file__).parent / 'runs' / name
    report = run / f'report{tag}'
    (report / 'failures').mkdir(parents=True, exist_ok=True)
    model = YOLO(run / 'weights' / 'best.pt')
    names = model.names
    root = data.parent
    test_images = sorted(p for p in (root / 'images' / 'test').iterdir() if p.name.startswith(prefix))
    val_data = data
    if prefix:  # a data file whose test split is just this source's photos (labels are found by swapping images/ → labels/)
        listing = run / f'test{tag}.txt'
        listing.write_text('\n'.join(p.as_posix() for p in test_images), encoding='utf8')
        val_data = run / f'data{tag}.yaml'
        val_data.write_text(data.read_text(encoding='utf8').replace('test: images/test', f'test: {listing.as_posix()}'), encoding='utf8')

    # 1. Test-split metrics, once.
    m = model.val(data=str(val_data), split='test', batch=16, **SQUARE, plots=True, project=str(run), name=f'test{tag}', exist_ok=True)
    per_class = {names[c]: {'mAP50': round(float(m.box.ap50[i]), 3), 'precision': round(float(m.box.p[i]), 3), 'recall': round(float(m.box.r[i]), 3)}
                 for i, c in enumerate(m.box.ap_class_index)}
    overall = {'mAP50': round(float(m.box.map50), 3), 'mAP50-95': round(float(m.box.map), 3), 'precision': round(float(m.box.mp), 3), 'recall': round(float(m.box.mr), 3)}

    # 2. Per-image comparison on the test images, for failure examples.
    rows = []
    for img in test_images:
        r = model.predict(img, conf=CONF, verbose=False, **SQUARE)[0]
        h, w = r.orig_shape
        gt = truth(root / 'labels' / 'test' / (img.stem + '.txt'), w, h)
        pred = [(int(c), tuple(b), float(s)) for c, b, s in zip(r.boxes.cls.tolist(), r.boxes.xyxy.tolist(), r.boxes.conf.tolist())]
        missed, false, wrong = compare(gt, pred)
        rows.append({'image': img.name, 'truth': len(gt), 'missed': len(missed), 'false': len(false), 'wrong_name': len(wrong),
                     '_draw': (img, gt, pred, missed, false, wrong)})

    # 3. Draw the 8 worst images: truth in white, model in red, misses in yellow.
    for row in sorted(rows, key=lambda r: -(r['missed'] + r['false'] + 2 * r['wrong_name']))[:8]:
        img, gt, pred, missed, false, wrong = row.pop('_draw')
        im = cv2.imread(str(img))
        for c, b in gt:
            cv2.rectangle(im, tuple(map(int, b[:2])), tuple(map(int, b[2:])), (255, 255, 255), 2)
        for c, b in missed:
            cv2.rectangle(im, tuple(map(int, b[:2])), tuple(map(int, b[2:])), (0, 220, 255), 3)
        for c, b, s in pred:
            cv2.rectangle(im, tuple(map(int, b[:2])), tuple(map(int, b[2:])), (60, 60, 255), 2)
            cv2.putText(im, f'{names[c]} {s:.0%}', (int(b[0]), max(12, int(b[1]) - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (60, 60, 255), 2)
        cv2.imwrite(str(report / 'failures' / img.name), im)
    for row in rows:
        row.pop('_draw', None)

    # 4. Export ONNX and check it agrees with the PyTorch model on a test image.
    onnx_path = Path(model.export(format='onnx', imgsz=640, simplify=True))
    sample = next((root / 'images' / 'test').iterdir())
    # CPU for both: the site runs ONNX on the visitor's CPU/WebGPU, and it stops Ultralytics auto-installing onnxruntime-gpu.
    a = model.predict(sample, conf=CONF, device='cpu', verbose=False, **SQUARE)[0].boxes
    b = YOLO(onnx_path, task='detect').predict(sample, imgsz=640, conf=CONF, device='cpu', verbose=False)[0].boxes
    agree = len(a) == len(b) and (len(a) == 0 or np.allclose(np.sort(a.conf.cpu().numpy()), np.sort(b.conf.cpu().numpy()), atol=0.02))

    out = {
        'run': name, 'test_images': len(rows), 'overall': overall, 'per_class': per_class,
        'totals': {k: sum(r[k] for r in rows) for k in ('truth', 'missed', 'false', 'wrong_name')},
        'onnx': {'file': onnx_path.name, 'mb': round(onnx_path.stat().st_size / 1e6, 1), 'matches_pytorch': bool(agree)},
        'class_order': [names[i] for i in sorted(names)], 'conf': CONF, 'iou': IOU, 'per_image': rows,
    }
    (report / 'metrics.json').write_text(json.dumps(out, indent=2), encoding='utf8')
    print(json.dumps({k: v for k, v in out.items() if k != 'per_image'}, indent=2))
