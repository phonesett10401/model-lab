"""Shared bits for the comic text detector: classes, licence allow-list, frozen splits, attribution log."""
import csv
import json
import hashlib
from dataclasses import astuple, dataclass, fields
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / 'data/comic'
RUNS = HERE / 'runs/comic'
ATTRIBUTION = HERE / 'attribution/comic-v1.csv'

CLASSES = ['bubble', 'caption', 'sfx', 'art-text']
STYLES = ['manga', 'modern-western', 'old-pd']
# MandaX is a business: commercial use and changes must be allowed. No NC, no academic-only, no share-alike.
ALLOWED_LICENCES = {'CC BY 4.0', 'CC0', 'Public domain', 'KOGL Type 1', 'Black Jack free reuse'}


@dataclass
class Page:
    file: str
    source: str
    group: str
    style: str
    split: str
    author: str
    licence: str
    link: str
    date: str


COLUMNS = [f.name for f in fields(Page)]


def split_for(group: str) -> str:
    """15% test, 15% val, 70% train, decided by the group (episode/chapter/book) so near-identical pages stay together."""
    n = int(hashlib.sha256(group.encode('utf8')).hexdigest(), 16) % 100
    return 'test' if n < 15 else 'val' if n < 30 else 'train'


def _check(p: Page) -> None:
    if p.licence not in ALLOWED_LICENCES:
        raise ValueError(f'{p.file}: licence {p.licence!r} is not allowed')
    if p.style not in STYLES:
        raise ValueError(f'{p.file}: unknown style {p.style!r}')
    if not all(getattr(p, k) for k in COLUMNS if k != 'split'):
        raise ValueError(f'{p.file}: missing field')


def load_attribution(path: Path = ATTRIBUTION) -> list[Page]:
    if not Path(path).exists():
        return []
    with open(path, newline='', encoding='utf8') as f:
        pages = [Page(**row) for row in csv.DictReader(f)]
    for p in pages:
        _check(p)
    return pages


def write_coco(path: Path, items: list[tuple[str, int, int, list[dict]]]) -> None:
    """items: (file, width, height, [{'bbox': [x, y, w, h], 'category': name, 'text'?: str}])."""
    coco = {'images': [], 'annotations': [], 'categories': [{'id': i, 'name': n} for i, n in enumerate(CLASSES)]}
    for image_id, (file, w, h, anns) in enumerate(items):
        coco['images'].append({'id': image_id, 'file_name': file, 'width': w, 'height': h})
        for a in anns:
            x, y, bw, bh = a['bbox']
            coco['annotations'].append({'id': len(coco['annotations']), 'image_id': image_id, 'category_id': CLASSES.index(a['category']),
                                        'bbox': [x, y, bw, bh], 'area': bw * bh, 'iscrowd': 0, **({'text': a['text']} if 'text' in a else {})})
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(coco), encoding='utf8')


def add_pages(path: Path, pages: list[Page]) -> None:
    """Appends new pages. A group keeps the split it already has, so the test set never moves."""
    old = load_attribution(path)
    split_of = {p.group: p.split for p in old}
    known = {p.file for p in old}
    new = []
    for p in pages:
        _check(p)
        if p.file in known:
            continue
        split = split_of.setdefault(p.group, split_for(p.group))
        if p.split and p.split != split:
            raise ValueError(f'{p.file}: group {p.group} is in {split}, not {p.split}')
        p.split = split
        new.append(p)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fresh = not path.exists()
    with open(path, 'a', newline='', encoding='utf8') as f:
        w = csv.writer(f)
        if fresh:
            w.writerow(COLUMNS)
        w.writerows(astuple(p) for p in new)
