"""Shared bits for the comic text detector: classes, styles, licence records, frozen splits, attribution log."""
import csv
import json
import hashlib
from dataclasses import astuple, dataclass, fields
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / 'data/comic'
RUNS = HERE / 'runs/comic'
ATTRIBUTION = HERE / 'attribution/comic-v1.csv'
# Claude's by-eye review of the automatic labels on validation and test pages: file,verdict(ok|drop),note
REVIEW = HERE / 'attribution/comic-v1-review.csv'
# Claude's by-eye count of English the automatic labels missed, on a sample of test pages: file,labelled,missed,note
MISSED = HERE / 'attribution/comic-v1-missed.csv'

# Round 3's one labelling target: one box per closed bubble or narration box, meaningful text on the art (translated)
# and sound effects (left as drawn).
CLASSES = ['bubble', 'caption', 'free-text', 'sfx']
# Round 2's data (data/comic) and model (final2-dfine) use this order.
CLASSES_V2 = ['bubble', 'caption', 'sfx', 'art-text']
STYLES = ['modern-western', 'old-american', 'manga', 'manhua', 'webtoon']
# Round 2 called old American pages 'old-pd'.
OLD_STYLES = {'old-pd': 'old-american'}


def licence_status(page) -> str:
    """The page's recorded licence. Owner, 2026-10-25: any source that improves accuracy may be used for training (not
    Manga109), as long as its licence status is recorded and credited; publishers' art is never shown or committed."""
    if not page.licence.strip():
        raise ValueError(f'{page.file}: no licence recorded')
    return page.licence


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
    licence_status(p)
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
        p.style = OLD_STYLES.get(p.style, p.style)
        _check(p)
    return pages


def dropped(path: Path = REVIEW) -> set[str]:
    """Pages whose automatic labels were judged clearly wrong in review: left out of every split."""
    if not Path(path).exists():
        return set()
    with open(path, newline='', encoding='utf8') as f:
        return {r['file'] for r in csv.DictReader(f) if r['verdict'] == 'drop'}


def coco_dict(items: list[tuple[str, int, int, list[dict]]], classes: list[str] = CLASSES) -> dict:
    """items: (file, width, height, [{'bbox': [x, y, w, h], 'category': name, 'text'?: str}]); `classes` gives the ids."""
    coco = {'images': [], 'annotations': [], 'categories': [{'id': i, 'name': n} for i, n in enumerate(classes)]}
    # ids start at 1: pycocotools reads annotation id 0 as "unmatched".
    for image_id, (file, w, h, anns) in enumerate(items, start=1):
        coco['images'].append({'id': image_id, 'file_name': file, 'width': w, 'height': h})
        for a in anns:
            x, y, bw, bh = a['bbox']
            coco['annotations'].append({'id': len(coco['annotations']) + 1, 'image_id': image_id, 'category_id': classes.index(a['category']),
                                        'bbox': [x, y, bw, bh], 'area': bw * bh, 'iscrowd': 0, **({'text': a['text']} if 'text' in a else {})})
    return coco


def write_coco(path: Path, items: list[tuple[str, int, int, list[dict]]], classes: list[str] = CLASSES) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(coco_dict(items, classes)), encoding='utf8')


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
