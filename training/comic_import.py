"""Imports other comic bubble datasets into round 3's one labelling target (comic_common.CLASSES).

Run: python comic_import.py <source> <downloaded folder>   (sources are listed in SOURCES; see comic_sources.md)
Pages are written to data/comic3/<source>/images/<source>_<stem>.jpg with labels in data/comic3/<source>/labels.json,
and logged in attribution/comic-v3.csv. Publishers' pages stay here and in a private Kaggle dataset: never committed,
never shown on the site.
"""
import argparse
import datetime
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, replace
from pathlib import Path

import numpy as np
import yaml
from PIL import Image
from scipy import ndimage

import comic_common as c
from comic_bubble import grow

DATA3 = c.HERE / 'data/comic3'
ATTRIBUTION3 = c.HERE / 'attribution/comic-v3.csv'
EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
# Masks: a region smaller than this share of the page is a speck, not a bubble.
MIN_REGION = 0.0005
# A strip taller than this many widths (a webtoon episode) is cut into pieces about PIECE widths tall, each cut
# between bubbles, so the finder sees page-shaped pictures as it does in the translator.
TALL = 2.5
PIECE = 1.5
# Pages whose 64-bit difference hashes differ in at most this many bits are the same page.
SAME_PAGE_BITS = 6
# A hash with fewer bits set than this is a nearly blank page (a white webtoon tile): never called a repeat.
BLANK_BITS = 8


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
    complete: bool = True  # False when a text box had no bubble to grow to: its bubble would be left unlabelled
    top: int = 0  # a piece of a tall strip: its first row in the image (size is the piece's own)

    def picture(self) -> Image.Image:
        im = Image.open(self.image).convert('RGB')
        return im.crop((0, self.top, im.width, self.top + self.size[1])) if self.top or 0 < self.size[1] < im.height else im


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
    labels = {p.stem: p for p in folder.rglob('*.txt') if 'labels' in p.parts}  # labels/ or labels/<split>/
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
    """Each image has a mask in a folder whose name holds 'mask', named the same or with Mask for Image
    (Image_001.png / Mask_001.png); each connected region is a bubble."""
    key = lambda stem: re.sub(r'(?i)^(image|mask)[_-]?', '', stem)
    masks = {key(p.stem): p for p in folder.rglob('*') if p.suffix.lower() in EXTS and 'mask' in p.parent.name.lower()}
    out = []
    for path in _images(folder).values():
        if key(path.stem) not in masks:
            continue
        m = np.asarray(Image.open(masks[key(path.stem)]).convert('L')) > 127
        lab, n = ndimage.label(m)
        anns = []
        for k, sl in enumerate(ndimage.find_objects(lab), start=1):
            if (lab[sl] == k).sum() < MIN_REGION * m.size:
                continue
            anns.append(('bubble', [sl[1].start, sl[0].start, sl[1].stop - sl[1].start, sl[0].stop - sl[0].start]))
        out.append((path, anns))
    return out


def _read_paddle(folder: Path) -> list[tuple[Path, list[tuple[str, list[float]]]]]:
    """PaddleOCR detection labels: one row per page, `<image path><tab><json list of {points}>`; each text line is 'line'."""
    files = _images(folder)
    out = []
    for txt in sorted(folder.rglob('*.txt')):
        for row in txt.read_text(encoding='utf8').splitlines():
            name, _, js = row.partition('\t')
            path = files.get(Path(name).name)
            if not path or not js:
                continue
            anns = []
            for t in json.loads(js):
                xs, ys = [q[0] for q in t['points']], [q[1] for q in t['points']]
                anns.append(('line', [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)]))
            out.append((path, anns))
    return out


READERS = {'coco': _read_coco, 'yolo': _read_yolo, 'voc': _read_voc, 'masks': _read_masks, 'paddle': _read_paddle}


def convert(src: Source, path: Path, raw: list[tuple[str, list[float]]], today: str = '') -> Imported:
    """One page's raw labels (source class, [x, y, w, h]) in the one target."""
    im = Image.open(path).convert('RGB')
    rgb = None
    anns = []
    complete = True
    for name, box in raw:
        kind = 'bubble' if src.format == 'masks' else src.classes.get(name)
        if kind == 'text':
            rgb = np.asarray(im) if rgb is None else rgb
            grown = grow(rgb, box)
            if grown:
                anns.append({'bbox': grown, 'category': 'bubble'})
            else:
                complete = False
        elif kind in c.CLASSES:
            anns.append({'bbox': [round(v, 1) for v in box], 'category': kind})
    page = c.Page(file=f'{src.name}_{path.stem}.jpg', source=src.name, group=src.group or src.name, style=src.style,
                  split='', author=src.author, licence=src.licence, link=src.link, date=today or datetime.date.today().isoformat())
    c._check(page)
    return Imported(page, path, im.size, _dedupe_boxes(anns), complete)


def split_tall(p: Imported) -> list[Imported]:
    """A tall strip as page-shaped pieces. Each cut is at the row nearest PIECE widths down (between 1 and 2 widths)
    that no box crosses; a box that still crosses a cut (no free row) is dropped and its piece marked incomplete."""
    w, h = p.size
    if h <= TALL * w:
        return [p]
    spans = [(a['bbox'][1], a['bbox'][1] + a['bbox'][3]) for a in p.anns]
    free = lambda y: all(not (y0 < y < y1) for y0, y1 in spans)
    out, top = [], 0
    while top < h:
        end = h if h - top <= 2 * w else min(range(int(top + w), int(top + 2 * w)), key=lambda y: (not free(y), abs(y - top - PIECE * w)))
        anns, complete = [], p.complete
        for a in p.anns:
            x, y, bw, bh = a['bbox']
            if y >= top and y + bh <= end:
                anns.append({**a, 'bbox': [x, round(y - top, 1), bw, bh]})
            elif y < end and y + bh > top:
                complete = False
        page = replace(p.page, file=p.page.file.replace('.jpg', f'_{len(out):02d}.jpg'))
        out.append(Imported(page, p.image, (w, end - top), anns, complete, p.top + top))
        top = end
    return out


def import_source(src: Source, folder: Path, sample: int = 0) -> list[Imported]:
    """Every page of a downloaded source (or `sample` of them, the same ones each run), with its boxes in the one target.
    A page where a text box had no bubble to grow to is left out whole: a bubble left unlabelled would teach the finder
    to skip it. Nothing is written."""
    today = datetime.date.today().isoformat()
    raw_pages = READERS[src.format](Path(folder))
    if sample and len(raw_pages) > sample:
        keep = np.random.default_rng(0).choice(len(raw_pages), sample, replace=False)
        raw_pages = [raw_pages[k] for k in sorted(keep)]
    pages = (piece for path, raw in raw_pages for piece in split_tall(convert(src, path, raw, today)))
    return [p for p in pages if p.complete]


def _dedupe_boxes(anns: list[dict]) -> list[dict]:
    """Two text boxes in one bubble grow to the same bubble: keep it once."""
    seen, out = set(), []
    for a in anns:
        key = (a['category'], *(round(v) for v in a['bbox']))
        if key not in seen:
            seen.add(key)
            out.append(a)
    return out


def _hash(p: Imported) -> int:
    """64-bit difference hash: robust to resizing and JPEG re-saving."""
    g = np.asarray(p.picture().convert('L').resize((9, 8), Image.Resampling.BILINEAR), np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def dedupe(pages: list[Imported]) -> list[Imported]:
    """Drops a page that is the same as an earlier one (also across sources), so one page can't sit in two splits."""
    kept, hashes = [], np.zeros(len(pages), np.uint64)
    for p in pages:
        h = np.uint64(_hash(p))
        if kept and np.bitwise_count(h) >= BLANK_BITS and np.bitwise_count(hashes[:len(kept)] ^ h).min() <= SAME_PAGE_BITS:
            continue
        hashes[len(kept)] = h
        kept.append(p)
    return kept


def save(pages: list[Imported], name: str, out: Path = DATA3, attribution: Path = ATTRIBUTION3) -> None:
    folder = out / name
    (folder / 'images').mkdir(parents=True, exist_ok=True)
    for p in pages:
        p.picture().save(folder / 'images' / p.page.file, quality=92)
    c.write_coco(folder / 'labels.json', [(p.page.file, *p.size, p.anns) for p in pages])
    c.add_pages(attribution, [p.page for p in pages])


# The sources in the round 3 design; how each maps was decided by looking at its pages (comic_sources.md).
K = 'https://www.kaggle.com/datasets/'
SOURCES: dict[str, Source] = {s.name: s for s in [
    Source('manga-text-detection', 'coco', 'manga', 'Apache 2.0 (labels); art belongs to its publishers', 'naufalahnaf17 (Kaggle)',
           K + 'naufalahnaf17/manga-text-detection', {'textrotation': 'text', 'words': 'text'}),
    Source('mangatextbox', 'yolo', 'manga', 'unknown (Kaggle); art belongs to its publishers', 'swm16a4 (Kaggle)',
           K + 'swm16a4/mangatextbox-detection', {'text_bubble': 'bubble'}),
    Source('lie-eater', 'yolo', 'manga', 'MIT (Kaggle; labels from Roboflow, CC BY 4.0); art belongs to its publishers', 'hieupham154 (Kaggle)',
           K + 'hieupham154/lie-eater-speech-bubbles', {'bubble': 'bubble'}),
]}

# Round 4 (docs/superpowers/specs/2026-11-18-comic-finder-round-4-design.md): bubble shapes all map to bubble;
# narration and system boxes to caption; text on the art to free-text; word-level text, titles, panels and watermarks
# are left out (their bubbles are labelled on their own).
R = 'https://universe.roboflow.com/'
H = 'https://huggingface.co/datasets/'
PUB = 'art belongs to its publishers'
ROUND4 = [
    Source('rf-manga-bubble', 'coco', 'manga', f'Public Domain (labels, Roboflow); {PUB}', 'crepidules-workspace (Roboflow)',
           R + 'crepidules-workspace/manga-bubble-detection', {'bubble': 'bubble'}),
    Source('rf-comicbubbles', 'coco', 'modern-western', f'CC BY 4.0 (labels, Roboflow); {PUB}', 'comic-speech-bubbles (Roboflow)',
           R + 'comic-speech-bubbles/comicbubbles',
           {**{k: 'bubble' for k in ('general-speech-bubble', 'speech-cluster-bubble', 'irregular-speech-bubble', 'irregular-thought-bubble',
                                     'thought-bubble', 'unattributed-speech-bubble', 'stylized-speech-bubble', 'digitized-speech-bubble',
                                     'combination-cluster-bubble')},
            'information-bubble': 'caption', 'in-story-media-text': 'free-text'}),
    Source('rf-webtoon-segmented', 'coco', 'webtoon', f'CC BY 4.0 (labels, Roboflow); {PUB}', 'wip-sama (Roboflow)',
           R + 'wip-sama-wip-sama-smastermega/webtoon-segmented',
           {**{f'balloon-{a}-{b}': 'bubble' for a in ('undefined', 'jagged', 'circular', 'spiky', 'rectangular', 'cloudy')
               for b in ('solid', 'transparent')}, 'text-outside': 'free-text', 'sfx': 'sfx'}),
    Source('rf-manhua-a', 'coco', 'manhua', f'MIT (labels, Roboflow); {PUB}', 'manhwaDev (Roboflow)', R + 'manhwadev/manhua-bubbles-6fho3',
           {'speech_bubble': 'bubble', 'thinking_bubble': 'bubble', 'system_box': 'caption', 'panel_text': 'free-text', 'sfx_sound': 'sfx'}),
    Source('rf-manhua-b', 'coco', 'manhua', f'MIT (labels, Roboflow); {PUB}', 'saif (Roboflow)', R + 'saif-cxjs3/manhua-bubbles-1wbtl-jqnou',
           {**{k: 'bubble' for k in ('speech_bubble', 'hexagon_bubble', 'sqare_bubble', 'scream_bubble', 'think_bubble', 'spiked_bubble',
                                     'wiggle_bubble', 'cloud_bubble')},
            'system_bubble': 'caption', 'standalone_text': 'free-text', 'background_text': 'free-text', 'sfx_sound': 'sfx'}),
    Source('rf-webtoon-bubbles', 'coco', 'webtoon', f'CC BY 4.0 (labels, Roboflow); {PUB}', 'AlexHeh (Roboflow)',
           R + 'alexheh/webtoon-bubble-detection-osuqx-xqdqa',
           {'dialog': 'bubble', 'thought': 'bubble', 'continuation': 'bubble', 'narration': 'caption', 'sound-effect': 'sfx',
            'only-text': 'free-text', 'small-text': 'free-text', 'misc-text': 'free-text'}),
    Source('rf-bubble-shapes', 'coco', 'manga', f'MIT (labels, Roboflow 100-VL); {PUB}', 'Roboflow 100-VL',
           R + 'rf100-vl/speech-bubbles-detection-r22zt-ou0u6-jols',
           {k: 'bubble' for k in ('Elipse', 'thorn', 'cloude', 'rectangle', 'other', 'sea_uchirin')}),
    Source('rf-manga-segment', 'coco', 'manga', f'MIT (labels, Roboflow); {PUB}', 'Ashu (Roboflow)', R + 'ashu-biqfs/manga-segment_v2',
           {'speech-balloon': 'bubble', 'thought-balloon': 'bubble', 'caption-box': 'caption'}),
    Source('hf-manga-bubbles', 'yolo', 'manga', f'CC BY-NC 4.0 (labels, Hugging Face); {PUB}', 'PSImera (Hugging Face)',
           H + 'PSImera/manga_bubbles_detect', {'location-of-bubbles': 'bubble'}),
    Source('hf-webtoon-lines', 'yolo', 'webtoon', f'Apache 2.0 (labels, Hugging Face); {PUB}', 'Hares08 (Hugging Face)',
           H + 'Hares08/webtoon_yolo26n_dataset', {'text_line': 'text'}),
    Source('kg-manhwa-lines', 'paddle', 'manhua', f'MIT (labels, Kaggle); {PUB}', 'shinyunaa (Kaggle)', K + 'shinyunaa/ppocrv5-det-manhwa',
           {'line': 'text'}),
]
SOURCES.update({s.name: s for s in ROUND4})

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('source', choices=sorted(SOURCES))
    ap.add_argument('folder', type=Path)
    ap.add_argument('--sample', type=int, default=0, help='import only this many pages (the same ones each run)')
    a = ap.parse_args()
    known = []
    for f in sorted(DATA3.glob('*/labels.json')):
        if f.parent.name != a.source:
            known += [Imported(p, f.parent / 'images' / p.file, (0, 0), []) for p in c.load_attribution(ATTRIBUTION3)
                      if p.source == f.parent.name]
    pages = [p for p in dedupe(known + import_source(SOURCES[a.source], a.folder, a.sample)) if p.page.source == a.source]
    save(pages, a.source)
    print(a.source, len(pages), 'pages,', sum(len(p.anns) for p in pages), 'boxes')
