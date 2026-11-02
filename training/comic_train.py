"""Trains a comic text detector (D-FINE or YOLOX, both Apache-2.0).

Round 2: python comic_train.py <dfine|yolox> <run-name> [--epochs 80]
  Labels: a source's owner-corrected <name>_labels.json wins over its draft; synthetic pages train only (never val/test).
Round 3: python comic_train.py dfine <run-name> --data comic3 --size m|l|x [--epochs 40] [--resume]
  Reads data/comic3/annotations (written by comic_split3.py); on Kaggle pass --data-root, --runs and --vendor
  (see kaggle/README.md). --resume continues from <runs>/<run>/last.pth with the same config.
Then: python comic_export.py <run-name> and python comic_evaluate.py <run-name> val
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import comic_common as c

VENDOR = c.HERE / 'vendor'
PY = sys.executable
# Label files in the order they are read; a later file for the same page replaces an earlier one.
# commons_labels.json is left out (2026-10-24): the Commons pages are mostly covers, not story pages.
LABEL_FILES = ['synth.json', 'pepper_draft.json', 'pepper_labels.json', 'blackjack_labels.json', 'dcm_labels.json']


def build_annotations() -> dict[str, int]:
    labels = {}
    for name in LABEL_FILES:
        path = c.DATA / name
        if not path.exists():
            continue
        coco = json.loads(path.read_text(encoding='utf8'))
        anns = {}
        for a in coco['annotations']:
            anns.setdefault(a['image_id'], []).append(a)
        for im in coco['images']:
            labels[im['file_name']] = (im['width'], im['height'], [
                {'bbox': a['bbox'], 'category': c.CLASSES_V2[a['category_id']], **({'text': a['text']} if 'text' in a else {})}
                for a in anns.get(im['id'], [])])
    counts = {}
    gone = c.dropped()
    for split in ('train', 'val', 'test'):
        items = [(p.file, *labels[p.file]) for p in c.load_attribution()
                 if p.split == split and p.file in labels and p.file not in gone and (split == 'train' or not p.source.startswith('Synthetic'))]
        c.write_coco(c.DATA / 'annotations' / f'{split}.json', items, c.CLASSES_V2)
        counts[split] = len(items)
    return counts


# Batch per size at input 1024 (fits a 16 GB T4; x needs two).
BATCH = {'n': 4, 's': 4, 'm': 4, 'l': 4, 'x': 2}


def dfine_config(run: str, epochs: int, size: str = 'n', data: str = 'comic', data_root=None, runs=None, vendor=None,
                 batch: int | None = None, workers: int = 4) -> str:
    """D-FINE config. data='comic' is round 2 (data/comic, 4 old classes); 'comic3' is round 3 (one target, file names
    relative to the data root)."""
    out = (runs or c.RUNS) / run
    stop = max(1, epochs - 8)  # last epochs without heavy augmentation, as D-FINE does
    if data == 'comic3':
        root = data_root or c.HERE / 'data'
        ann, imgs, classes = (root / 'comic3/annotations').as_posix(), root.as_posix(), c.CLASSES
    else:
        ann, imgs, classes = (c.DATA / 'annotations').as_posix(), (c.DATA / 'images').as_posix(), c.CLASSES_V2
    base = (vendor or VENDOR / 'D-FINE') / f'configs/dfine/custom/dfine_hgnetv2_{size}_custom.yml'
    return f"""__include__: ['{base.as_posix()}']
output_dir: {out.as_posix()}
num_classes: {len(classes)}
epochs: {epochs}
eval_spatial_size: [1024, 1024]
train_dataloader:
  total_batch_size: {batch or BATCH[size]}
  num_workers: {workers}
  dataset:
    img_folder: {imgs}
    ann_file: {ann}/train.json
    transforms:
      ops:
        - {{type: RandomPhotometricDistort, p: 0.5}}
        - {{type: RandomZoomOut, fill: 0}}
        - {{type: RandomIoUCrop, p: 0.8}}
        - {{type: SanitizeBoundingBoxes, min_size: 1}}
        - {{type: Resize, size: [1024, 1024]}}
        - {{type: SanitizeBoundingBoxes, min_size: 1}}
        - {{type: ConvertPILImage, dtype: 'float32', scale: True}}
        - {{type: ConvertBoxes, fmt: 'cxcywh', normalize: True}}
      policy:
        epoch: {stop}
  collate_fn:
    base_size: 1024
    stop_epoch: {stop}
val_dataloader:
  total_batch_size: 4
  num_workers: 0
  dataset:
    img_folder: {imgs}
    ann_file: {ann}/val.json
    transforms:
      ops:
        - {{type: Resize, size: [1024, 1024]}}
        - {{type: ConvertPILImage, dtype: 'float32', scale: True}}
"""
# No horizontal flip: mirrored lettering never appears in real comics.


def yolox_exp(run: str, epochs: int) -> str:
    return f'''import torch.nn as nn
import yolox.layers
from yolox.data import COCODataset, TrainTransform, ValTransform
from yolox.exp import Exp as BaseExp

# YOLOX's fast COCO scorer needs a C++ compiler; without it, its own fallback to pycocotools is used.
if hasattr(yolox.layers, 'COCOeval_opt'):
    del yolox.layers.COCOeval_opt


class Exp(BaseExp):
    def __init__(self):
        super().__init__()
        self.depth, self.width = 0.33, 0.25
        self.num_classes = {len(c.CLASSES_V2)}
        self.data_dir = r"{c.DATA}"
        self.train_ann, self.val_ann = 'train.json', 'val.json'
        self.input_size = self.test_size = (1024, 1024)
        self.random_size = (28, 36)
        self.mosaic_scale = (0.5, 1.5)
        self.enable_mixup = False
        self.flip_prob = 0.0  # mirrored lettering never appears in real comics
        self.max_epoch, self.warmup_epochs, self.no_aug_epochs = {epochs}, 3, 8
        self.eval_interval = 5
        self.data_num_workers = 4
        self.output_dir = r"{c.RUNS}"
        self.exp_name = "{run}"

    def get_dataset(self, cache=False, cache_type="ram"):
        return COCODataset(data_dir=self.data_dir, json_file=self.train_ann, name='images', img_size=self.input_size,
                           preproc=TrainTransform(max_labels=50, flip_prob=self.flip_prob, hsv_prob=self.hsv_prob),
                           cache=cache, cache_type=cache_type)

    def get_eval_dataset(self, **kwargs):
        return COCODataset(data_dir=self.data_dir, json_file=self.val_ann, name='images', img_size=self.test_size,
                           preproc=ValTransform(legacy=False))

    def get_model(self, sublinear=False):
        def init_yolo(M):
            for m in M.modules():
                if isinstance(m, nn.BatchNorm2d):
                    m.eps, m.momentum = 1e-3, 0.03
        if 'model' not in self.__dict__:
            from yolox.models import YOLOX, YOLOPAFPN, YOLOXHead
            in_channels = [256, 512, 1024]
            backbone = YOLOPAFPN(self.depth, self.width, in_channels=in_channels, depthwise=True)
            head = YOLOXHead(self.num_classes, self.width, in_channels=in_channels, depthwise=True)
            self.model = YOLOX(backbone, head)
        self.model.apply(init_yolo)
        self.model.head.initialize_biases(1e-2)
        return self.model
'''


def resume_config(run_dir: Path, data_root=None, runs=None, vendor=None) -> str:
    """A stopped run's config for this machine: the settings it started with (settings.json), this machine's folders.
    A run stopped on Kaggle resumes on the laptop this way."""
    st = json.loads((run_dir / 'settings.json').read_text(encoding='utf8'))
    return dfine_config(st['run'], st['epochs'], st['size'], st['data'], data_root, runs, vendor)


def train_command(kind: str, run: str, resume: bool = False, runs=None, vendor=None) -> tuple[list[str], str]:
    """The vendor training command and its folder; resume continues from the last saved epoch."""
    out = (runs or c.RUNS) / run
    if kind == 'dfine':
        cmd = [PY, 'train.py', '-c', str(out / 'config.yml'), '--use-amp', '--seed=0']
        return cmd + (['-r', str(out / 'last.pth')] if resume else []), str(vendor or VENDOR / 'D-FINE')
    cmd = [PY, 'tools/train.py', '-f', str(out / 'exp.py'), '-d', '1', '-b', '4', '--fp16']
    return cmd + (['--resume', '-c', str(out / 'latest_ckpt.pth')] if resume else []), str(VENDOR / 'YOLOX')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['dfine', 'yolox'])
    ap.add_argument('run')
    ap.add_argument('--epochs', type=int, default=80)
    ap.add_argument('--resume', action='store_true', help='continue from the last saved epoch, same data and settings')
    ap.add_argument('--size', default='n', choices=sorted(BATCH), help='D-FINE size')
    ap.add_argument('--data', default='comic', choices=['comic', 'comic3'], help='comic3: round 3 splits from comic_split3.py')
    ap.add_argument('--data-root', type=Path, help='folder holding comic/ and comic3/ (default training/data)')
    ap.add_argument('--runs', type=Path, help='where runs are written (default training/runs/comic)')
    ap.add_argument('--vendor', type=Path, help='the D-FINE checkout (default training/vendor/D-FINE)')
    args = ap.parse_args()
    out = (args.runs or c.RUNS) / args.run
    if not args.resume:
        if args.data == 'comic':
            print('pages per split:', build_annotations())
        out.mkdir(parents=True, exist_ok=True)
        (out / 'kind.txt').write_text(args.kind)
        if args.kind == 'dfine':
            (out / 'config.yml').write_text(dfine_config(args.run, args.epochs, args.size, args.data, args.data_root, args.runs, args.vendor))
            (out / 'settings.json').write_text(json.dumps({'run': args.run, 'epochs': args.epochs, 'size': args.size, 'data': args.data}))
        else:
            (out / 'exp.py').write_text(yolox_exp(args.run, args.epochs))
    elif args.kind == 'dfine' and (out / 'settings.json').exists():
        local = resume_config(out, args.data_root, args.runs, args.vendor)
        if local != (out / 'config.yml').read_text():  # stopped on another machine: same settings, this machine's folders
            (out / 'config.yml').write_text(local)
    cmd, cwd = train_command(args.kind, args.run, args.resume, args.runs, args.vendor)
    subprocess.run(cmd, cwd=cwd, check=True)


if __name__ == '__main__':
    main()
