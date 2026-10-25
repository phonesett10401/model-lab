"""Trains a comic text detector (D-FINE or YOLOX, both Apache-2.0) on every labelled page, split by the attribution log.

Run: python comic_train.py <dfine|yolox> <run-name> [--epochs 80]
Labels: a source's owner-corrected <name>_labels.json wins over its draft; synthetic pages train only (never val/test).
Then: python comic_export.py <run-name> and python comic_evaluate.py <run-name> val
"""
import argparse
import json
import subprocess
import sys

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
                {'bbox': a['bbox'], 'category': c.CLASSES[a['category_id']], **({'text': a['text']} if 'text' in a else {})}
                for a in anns.get(im['id'], [])])
    counts = {}
    gone = c.dropped()
    for split in ('train', 'val', 'test'):
        items = [(p.file, *labels[p.file]) for p in c.load_attribution()
                 if p.split == split and p.file in labels and p.file not in gone and (split == 'train' or not p.source.startswith('Synthetic'))]
        c.write_coco(c.DATA / 'annotations' / f'{split}.json', items)
        counts[split] = len(items)
    return counts


def dfine_config(run: str, epochs: int) -> str:
    out = c.RUNS / run
    stop = max(1, epochs - 8)  # last epochs without heavy augmentation, as D-FINE does
    ann, imgs = (c.DATA / 'annotations').as_posix(), (c.DATA / 'images').as_posix()
    return f"""__include__: ['{(VENDOR / 'D-FINE/configs/dfine/custom/dfine_hgnetv2_n_custom.yml').as_posix()}']
output_dir: {out.as_posix()}
num_classes: {len(c.CLASSES)}
epochs: {epochs}
eval_spatial_size: [1024, 1024]
train_dataloader:
  total_batch_size: 4
  num_workers: 4
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
        self.num_classes = {len(c.CLASSES)}
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


def train_command(kind: str, run: str, resume: bool = False) -> tuple[list[str], str]:
    """The vendor training command and its folder; resume continues from the last saved epoch."""
    out = c.RUNS / run
    if kind == 'dfine':
        cmd = [PY, 'train.py', '-c', str(out / 'config.yml'), '--use-amp', '--seed=0']
        return cmd + (['-r', str(out / 'last.pth')] if resume else []), str(VENDOR / 'D-FINE')
    cmd = [PY, 'tools/train.py', '-f', str(out / 'exp.py'), '-d', '1', '-b', '4', '--fp16']
    return cmd + (['--resume', '-c', str(out / 'latest_ckpt.pth')] if resume else []), str(VENDOR / 'YOLOX')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['dfine', 'yolox'])
    ap.add_argument('run')
    ap.add_argument('--epochs', type=int, default=80)
    ap.add_argument('--resume', action='store_true', help='continue from the last saved epoch, same data and settings')
    args = ap.parse_args()
    out = c.RUNS / args.run
    if not args.resume:
        print('pages per split:', build_annotations())
        out.mkdir(parents=True, exist_ok=True)
        (out / 'kind.txt').write_text(args.kind)
        if args.kind == 'dfine':
            (out / 'config.yml').write_text(dfine_config(args.run, args.epochs))
        else:
            (out / 'exp.py').write_text(yolox_exp(args.run, args.epochs))
    cmd, cwd = train_command(args.kind, args.run, args.resume)
    subprocess.run(cmd, cwd=cwd, check=True)


if __name__ == '__main__':
    main()
