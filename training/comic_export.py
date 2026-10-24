"""Exports a trained comic text detector to ONNX at 1024 px: runs/comic/<run>/model.onnx.

Run: python comic_export.py <run>
Uses plain torch.onnx.export: the vendors' own export scripts don't work here (D-FINE's is fixed at 640 px,
YOLOX's calls a torch function PyTorch 2.11 removed). See comic_vendor.md.
"""
import sys

import torch

import comic_common as c

SIZE = 1024


def load(run: str):
    """The trained PyTorch model wrapped to take the same inputs and give the same outputs as the ONNX file."""
    d = c.RUNS / run
    kind = (d / 'kind.txt').read_text().strip()
    if kind == 'dfine':
        sys.path.insert(0, str(c.HERE / 'vendor/D-FINE'))
        from src.core import YAMLConfig
        ckpt = next(p for p in (d / 'best_stg2.pth', d / 'best_stg1.pth', d / 'last.pth') if p.exists())
        cfg = YAMLConfig(str(d / 'config.yml'))
        state = torch.load(ckpt, map_location='cpu', weights_only=False)
        cfg.model.load_state_dict(state['ema']['module'] if 'ema' in state else state['model'])

        class Model(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.model, self.post = cfg.model.deploy(), cfg.postprocessor.deploy()

            def forward(self, images, orig_target_sizes):
                return self.post(self.model(images), orig_target_sizes)

        return kind, Model().eval()
    from yolox.exp import get_exp
    exp = get_exp(str(d / 'exp.py'), None)
    model = exp.get_model().eval()
    ckpt = next(p for p in (d / 'best_ckpt.pth', d / 'latest_ckpt.pth') if p.exists())
    model.load_state_dict(torch.load(ckpt, map_location='cpu', weights_only=False)['model'])
    model.head.decode_in_inference = True
    return kind, model


def export(run: str) -> None:
    kind, model = load(run)
    out = c.RUNS / run / 'model.onnx'
    if kind == 'dfine':
        torch.onnx.export(model, (torch.rand(1, 3, SIZE, SIZE), torch.tensor([[SIZE, SIZE]])), str(out),
                          input_names=['images', 'orig_target_sizes'], output_names=['labels', 'boxes', 'scores'],
                          opset_version=17, dynamo=False)
    else:
        torch.onnx.export(model, torch.rand(1, 3, SIZE, SIZE), str(out), input_names=['images'], output_names=['output'],
                          opset_version=17, dynamo=False)
    print(f'{out} ({out.stat().st_size / 1e6:.1f} MB)')


def boxes_match(torch_boxes, onnx_boxes, min_score=0.3) -> bool:
    """(class, score, [x, y, w, h]) lists agree: every box at or above min_score has a twin, same class, IoU >= 0.98,
    score within 0.01."""
    from comic_evaluate import _iou
    a = [b for b in torch_boxes if b[1] >= min_score]
    b = [x for x in onnx_boxes if x[1] >= min_score]
    if len(a) != len(b):
        return False
    free = list(b)
    for k, s, box in a:
        twin = next((x for x in free if x[0] == k and abs(x[1] - s) <= 0.01 and _iou(x[2], box) >= 0.98), None)
        if twin is None:
            return False
        free.remove(twin)
    return True


def check(run: str, pages: int = 20) -> None:
    """Runs validation pages through the trained model and the ONNX file; any disagreement fails."""
    import json

    import numpy as np
    import onnxruntime as ort
    from PIL import Image

    from comic_evaluate import predict
    kind, model = load(run)
    session = ort.InferenceSession(str(c.RUNS / run / 'model.onnx'), providers=['CPUExecutionProvider'])
    val = json.loads((c.DATA / 'annotations/val.json').read_text(encoding='utf8'))
    for img in val['images'][:pages]:
        im = Image.open(c.DATA / 'images' / img['file_name']).convert('RGB')
        W, H = im.size
        with torch.no_grad():
            if kind == 'dfine':
                x = torch.from_numpy(np.asarray(im.resize((SIZE, SIZE), Image.BILINEAR), np.float32).transpose(2, 0, 1)[None] / 255)
                labels, boxes, scores = model(x, torch.tensor([[W, H]]))
                ours = [(int(l), float(s), [float(b[0]), float(b[1]), float(b[2] - b[0]), float(b[3] - b[1])])
                        for l, b, s in zip(labels[0], boxes[0], scores[0])]
            else:
                raise SystemExit('check is written for D-FINE (the picked detector)')
        if not boxes_match(ours, predict(session, kind, im)):
            raise SystemExit(f'ONNX disagrees with the trained model on {img["file_name"]}')
    print('onnx matches torch on', min(pages, len(val['images'])), 'validation pages')


if __name__ == '__main__':
    export(sys.argv[1])
    if '--check' in sys.argv:
        check(sys.argv[1])
