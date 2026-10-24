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
        state = torch.load(ckpt, map_location='cpu')
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
    model.load_state_dict(torch.load(ckpt, map_location='cpu')['model'])
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


if __name__ == '__main__':
    export(sys.argv[1])
