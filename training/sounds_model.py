"""The Sound detective network: EfficientAT's MobileNet with its spectrogram front end rewritten as fixed layers.

Frontend reproduces EfficientAT's AugmentMelSTFT in eval mode (pre-emphasis, 1024-point STFT with an 800-sample
Hann window every 320 samples, Kaldi mel banks 0-15 kHz, log, fast normalisation) using only conv/pad/matmul,
so the whole thing exports to one ONNX file and the browser feeds it raw 32 kHz audio.
"""
import math

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

from sounds_common import SR, efficientat

SIZES = {'mn04': ('mn04_as', 0.4), 'mn10': ('mn10_as', 1.0)}


def kaldi_mel_banks(n_mels, n_fft, sr, low, high):
    """torchaudio.compliance.kaldi.get_mel_banks (no VTLN warp), padded with a zero column like EfficientAT does."""
    mel = lambda f: 1127.0 * np.log(1.0 + f / 700.0)
    bins = n_fft // 2
    ml, mh = mel(low), mel(high)
    delta = (mh - ml) / (n_mels + 1)
    b = np.arange(n_mels)[:, None]
    left, center, right = ml + b * delta, ml + (b + 1) * delta, ml + (b + 2) * delta
    m = mel(sr / n_fft * np.arange(bins))[None, :]
    up, down = (m - left) / (center - left), (right - m) / (right - center)
    return np.pad(np.maximum(0.0, np.minimum(up, down)), ((0, 0), (0, 1)))


class Frontend(nn.Module):
    def __init__(self, sr=SR, n_fft=1024, win=800, hop=320, n_mels=128):
        super().__init__()
        self.n_fft, self.hop, self.off = n_fft, hop, (n_fft - win) // 2  # torch.stft centres a short window in the frame
        w = torch.hann_window(win, periodic=False, dtype=torch.float64)
        k = torch.arange(n_fft // 2 + 1, dtype=torch.float64)[:, None]
        n = torch.arange(win, dtype=torch.float64)[None, :] + self.off
        ang = 2 * math.pi * k * n / n_fft
        self.register_buffer('basis', torch.cat([torch.cos(ang) * w, -torch.sin(ang) * w]).float()[:, None, :])
        fmax = sr // 2 - 1000  # EfficientAT: fmax=None with fmax_aug_range=2000
        self.register_buffer('mel', torch.from_numpy(kaldi_mel_banks(n_mels, n_fft, sr, 0.0, fmax)).float())
        self.register_buffer('pre', torch.tensor([[[-0.97, 1.0]]]))

    def forward(self, audio):
        x = F.conv1d(audio[:, None, :], self.pre)                      # pre-emphasis: [B,1,T-1]
        frames = x.shape[-1] // self.hop + 1
        x = F.pad(x, (self.n_fft // 2, self.n_fft // 2), mode='reflect')[..., self.off:]
        spec = F.conv1d(x, self.basis, stride=self.hop)[..., :frames]  # [B, 2*513, frames]: real then imaginary
        half = spec.shape[1] // 2
        power = spec[:, :half] ** 2 + spec[:, half:] ** 2
        return (torch.log(torch.matmul(self.mel, power) + 1e-5) + 4.5) / 5.0


class Net(nn.Module):
    """Raw 1 s audio in, one logit per sound out. Calls features + classifier directly: EfficientAT's forward()
    squeezes, which would drop the batch axis for a batch of one in an exported graph."""

    def __init__(self, size='mn04', classes=17, pretrained=True):
        super().__init__()
        name, width = SIZES[size]
        self.front = Frontend()
        self.backbone = efficientat()(num_classes=classes, pretrained_name=name if pretrained else None, width_mult=width)

    def forward(self, audio):
        x = self.front(audio)[:, None]  # [B,1,128,frames]
        return self.backbone.classifier(self.backbone.features(x))


def audioset_net(size='mn10'):
    """The pretrained 527-class AudioSet model, used to double-check Freesound top-up clips."""
    return Net(size, classes=527)
