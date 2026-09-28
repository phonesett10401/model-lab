"""The ONNX-friendly front end must equal EfficientAT's own AugmentMelSTFT (eval mode). Run: python test_sounds_model.py"""
import sys

import torch

import sounds_common as c
import sounds_model as m

sys.path.insert(0, str(c.VENDOR))
from models.preprocess import AugmentMelSTFT  # the reference the pretrained weights were trained with

ref = AugmentMelSTFT(n_mels=128, sr=32000, win_length=800, hopsize=320, n_fft=1024, freqm=0, timem=0).eval()
ours = m.Frontend().eval()
torch.manual_seed(0)
for n in (c.WIN, 20000, 47123):
    x = torch.randn(2, n) * 0.1
    a, b = ref(x), ours(x)
    assert a.shape == b.shape, (a.shape, b.shape)
    assert torch.allclose(a, b, atol=1e-3), (a - b).abs().max()
net = m.Net('mn04', classes=len(c.CLASSES)).eval()
with torch.no_grad():
    y1, y3 = net(torch.zeros(1, c.WIN)), net(torch.randn(3, c.WIN) * 0.1)
assert y1.shape == (1, 17) and y3.shape == (3, 17), (y1.shape, y3.shape)
print('model checks passed')
