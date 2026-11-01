"""Imports other comic bubble datasets into round 3's one labelling target (comic_common.CLASSES).

Run: python comic_import.py <source> <downloaded folder>   (sources are listed in SOURCES; see comic_sources.md)
Pages are written to data/comic3/<source>/images/<source>_<stem>.jpg with labels in data/comic3/<source>/labels.json,
and logged in attribution/comic-v3.csv. Publishers' pages stay here and in a private Kaggle dataset: never committed,
never shown on the site.
"""
import argparse
import datetime
import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml
from PIL import Image
from scipy import ndimage

import comic_common as c
from comic_bubble import bubble_extent

DATA3 = c.HERE / 'data/comic3'
ATTRIBUTION3 = c.HERE / 'attribution/comic-v3.csv'
EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
# Masks: a region smaller than this share of the page is a speck, not a bubble.
MIN_REGION = 0.0005
# Pages whose 64-bit difference hashes differ in at most this many bits are the same page.
SAME_PAGE_BITS = 6


@dataclass
class Source:
    name: str
    format: str  # coco | yolo | masks | voc
    style: str
    licence: str
    author: str
    link: str
    # The source's class names -> one of CLASSES, or 'text' (a text-only box: grown to its bubble or dropped).
    # Classes not listed are left out. Masks have no classes: every region is a bubble.
    classes: dict[str, str] = field(default_factory=dict)
    group: str | None = None  # every page in one group (a single series) unless the reader finds books


@dataclass
class Imported:
    page: c.Page
    image: Path
    size: tuple[int, int]
    anns: list[dict]  # [{'bbox': [x, y, w, h], 'category': one of CLASSES}]


def _images(folder: Path) -> dict[str, Path]:
    return {p.name: p for p in sorted(folder.rglob('*')) if p.suffix.lower() in EXTS and 'mask' not in p.parent.name.lower()}


def _read_coco(folder: Path) -> list[tuple[Path, list[tuple[str, list[float]]]]]:
    files = _images(folder)
    out = []
    for js in sorted(folder.rglob('*.json')):
        coco = json.loads(js.read_text(encoding='utf8'))
        if 'images' not in coco:
            continue
        names = {k['id']: k['name'] for k in coco.get('categories', [])}
        by_image: dict[int, list] = {}
        for a in coco.get('annotations', []):
            by_image.setdefault(a['image_id'], []).append((names.get(a['category_id'], ''), a['bbox']))
        for im in coco['images']:
            path = files.get(Path(im['file_name']).name)
            if path:
                out.append((path, by_image.get(im['id'], [])))
    return out


def _read_yolo(folder: Path) -> list[tuple[Path, list[tuple[str, list[float]]]]]:
    names = next((yaml.safe_load(y.read_text(encoding='utf8'))['names'] for y in sorted(folder.rglob('*.yaml'))), [])
    names = list(names.values()) if isinstance(names, dict) else names
    labels = {p.stem: p for p in folder.rglob('*.txt') if p.parent.name == 'labels'}
    out = []
    for path in _images(folder).values():
        w, h = Image.open(path).size
        anns = []
        if path.stem in labels:
            for line in labels[path.stem].read_text(encoding='utf8').split('\n'):
                v = line.split()
                if len(v) != 5:
                    continue  # segmentation rows and blanks are not boxes
                k, cx, cy, bw, bh = int(v[0]), *map(float, v[1:])
                anns.append((names[k] if k < len(names) else '', [(cx - bw / 2) * w, (cy - bh / 2) * h, bw * w, bh * h]))
        out.append((path, anns))
    return out


def _read_voc(folder: Path) -> list[tuple[Path, list[tuple[str, list[float]]]]]:
    files = _images(folder)
    out = []
    for x in sorted(folder.rglob('*.xml')):
        root = ET.parse(x).getroot()
        path = files.get(root.findtext('filename') or '') or files.get(x.stem + '.jpg') or files.get(x.stem + '.png')
        if not path:
            continue
        anns = []
        for o in root.iter('object'):
            b = o.find('bndbox')
            x0, y0, x1, y1 = (float(b.findtext(k)) for k in ('xmin', 'ymin', 'xmax', 'ymax'))
            anns.append((o.findtext('name') or '', [x0, y0, x1 - x0, y1 - y0]))
        out.append((path, anns))
    return out


def _read_masks(folder: Path) -> list[tuple[Path, list[tuple[str, list[float]]]]]:
    """Each image has a mask of the same name in a folder whose name holds 'mask'; each connected region is a bubble."""
    masks = {p.stem: p for p in folder.rglob('*') if p.suffix.lower() in EXTS and 'mask' in p.parent.name.lower()}
    out = []
    for path in _images(folder).values():
        if path.stem not in masks:
            continue
        m = np.asarray(Image.open(masks[path.stem]).convert('L')) > 127
        lab, n = ndimage.label(m)
        anns = []
        for k, sl in enumerate(ndimage.find_objects(lab), start=1):
            if (lab[sl] == k).sum() < MIN_REGION * m.size:
                continue
            anns.append(('bubble', [sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start]))
        out.append((path, anns))
    return out


READERS = {'coco': _read_coco, 'yolo': _read_yolo, 'voc': _read_voc, 'masks': _read_masks}


def grow(rgb: np.ndarray, box: list[float]) -> list[int] | None:
    """A text-only box grown to the whole bubble around it, or None when there is no closed bubble. The crop reaches
    1.5× the box's longer side on every side (a one-line box at the top of a tall bubble still sees the whole bubble)."""
    H, W = rgb.shape[:2]
    x, y, w, h = box
    pad = 1.5 * max(w, h)
    cx, cy = max(0, int(x - pad)), max(0, int(y - pad))
    cw, ch = min(W, int(np.ceil(x + w + pad))) - cx, min(H, int(np.ceil(y + h + pad))) - cy
    if cw < 8 or ch < 8:
        return None
    e = bubble_extent(rgb[cy:cy + ch, cx:cx + cw], (x - cx, y - cy, w, h))
    return [cx + e[0], cy + e[1], e[2], e[3]] if e else None


def import_source(src: Source, folder: Path) -> list[Imported]:
    """Every page of a downloaded source, with its boxes in the one target. Nothing is written."""
    today = datetime.date.today().isoformat()
    out = []
    for path, raw in READERS[src.format](Path(folder)):
        im = Image.open(path).convert('RGB')
        rgb = None
        anns = []
        for name, box in raw:
            kind = 'bubble' if src.format == 'masks' else src.classes.get(name)
            if kind == 'text':
                rgb = np.asarray(im) if rgb is None else rgb
                grown = grow(rgb, box)
                if grown:
                    anns.append({'bbox': grown, 'category': 'bubble'})
            elif kind in c.CLASSES:
                anns.append({'bbox': [round(v, 1) for v in box], 'category': kind})
        page = c.Page(file=f'{src.name}_{path.stem}.jpg', source=src.name, group=src.group or src.name, style=src.style,
                      split='', author=src.author, licence=src.licence, link=src.link, date=today)
        c._check(page)
        out.append(Imported(page, path, im.size, _dedupe_boxes(anns)))
    return out


def _dedupe_boxes(anns: list[dict]) -> list[dict]:
    """Two text boxes in one bubble grow to the same bubble: keep it once."""
    seen, out = set(), []
    for a in anns:
        key = (a['category'], *(round(v) for v in a['bbox']))
        if key not in seen:
            seen.add(key)
            out.append(a)
    return out


def _hash(path: Path) -> int:
    """64-bit difference hash: robust to resizing and JPEG re-saving."""
    g = np.asarray(Image.open(path).convert('L').resize((9, 8), Image.Resampling.BILINEAR), np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def dedupe(pages: list[Imported]) -> list[Imported]:
    """Drops a page that is the same as an earlier one (also across sources), so one page can't sit in two splits."""
    kept, hashes = [], []
    for p in pages:
        h = _hash(p.image)
        if any(bin(h ^ k).count('1') <= SAME_PAGE_BITS for k in hashes):
            continue
        hashes.append(h)
        kept.append(p)
    return kept


def save(pages: list[Imported], name: str, out: Path = DATA3, attribution: Path = ATTRIBUTION3) -> None:
    folder = out / name
    (folder / 'images').mkdir(parents=True, exist_ok=True)
    for p in pages:
        Image.open(p.image).convert('RGB').save(folder / 'images' / p.page.file, quality=92)
    c.write_coco(folder / 'labels.json', [(p.page.file, *p.size, p.anns) for p in pages])
    c.add_pages(attribution, [p.page for p in pages])


# The sources in the round 3 design. Classes are filled in after looking at each download (comic_sources.md).
SOURCES: dict[str, Source] = {}

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('source', choices=sorted(SOURCES))
    ap.add_argument('folder', type=Path)
    a = ap.parse_args()
    known = []
    for f in sorted(DATA3.glob('*/labels.json')):
        if f.parent.name != a.source:
            known += [Imported(p, f.parent / 'images' / p.file, (0, 0), []) for p in c.load_attribution(ATTRIBUTION3)
                      if p.source == f.parent.name]
    pages = [p for p in dedupe(known + import_source(SOURCES[a.source], a.folder)) if p.page.source == a.source]
    save(pages, a.source)
    print(a.source, len(pages), 'pages,', sum(len(p.anns) for p in pages), 'boxes')
