"""Importing other bubble datasets into the one labelling target. Run: python test_comic_import.py"""
import json
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import comic_common as c
from comic_import import Source, dedupe, import_source


def bubble_page(w=400, h=300, bubbles=((200, 150, 120, 80),), busy=False) -> Image.Image:
    """Grey (or busy) art with white, black-outlined oval bubbles (cx, cy, rx, ry), each with a bar of letters."""
    rng = np.random.default_rng(1)
    art = rng.integers(0, 255, (h, w, 3), np.uint8) if busy else np.full((h, w, 3), 110, np.uint8)
    im = Image.fromarray(art)
    d = ImageDraw.Draw(im)
    for cx, cy, rx, ry in bubbles:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill='white', outline='black', width=3)
        d.rectangle([cx - rx // 2, cy - 5, cx + rx // 2, cy + 5], fill='black')
    return im


def kw(name, fmt, classes, **more):
    return Source(name=name, format=fmt, style='manga', licence='Apache 2.0 (labels); art belongs to publishers',
                  author='Test', link='https://example.org/' + name, classes=classes, **more)


with tempfile.TemporaryDirectory() as d:
    d = Path(d)

    # masks become one box per closed bubble (two bubbles in one mask: two boxes, each around its own oval)
    (d / 'm/images').mkdir(parents=True), (d / 'm/masks').mkdir()
    bubble_page(bubbles=((100, 150, 70, 60), (290, 150, 80, 60))).save(d / 'm/images/p1.png')
    mask = Image.new('L', (400, 300), 0)
    ImageDraw.Draw(mask).ellipse([30, 90, 170, 210], fill=255)
    ImageDraw.Draw(mask).ellipse([210, 90, 370, 210], fill=255)
    mask.save(d / 'm/masks/p1.png')
    got = import_source(kw('masks', 'masks', {}), d / 'm')
    boxes = sorted(a['bbox'] for a in got[0].anns)
    assert [a['category'] for a in got[0].anns] == ['bubble', 'bubble'], got[0].anns
    assert len(boxes) == 2 and abs(boxes[0][0] - 30) <= 2 and abs(boxes[1][0] - 210) <= 2 and abs(boxes[1][2] - 161) <= 2, boxes

    # text-only labels grow to their bubble or are dropped (a text box on busy art has no closed bubble)
    (d / 't/images').mkdir(parents=True)
    bubble_page().save(d / 't/images/a.png')
    bubble_page(busy=True, bubbles=()).save(d / 't/images/b.png')
    coco = {'images': [{'id': 1, 'file_name': 'a.png', 'width': 400, 'height': 300}, {'id': 2, 'file_name': 'b.png', 'width': 400, 'height': 300}],
            'categories': [{'id': 7, 'name': 'text'}],
            'annotations': [{'id': 1, 'image_id': 1, 'category_id': 7, 'bbox': [150, 140, 100, 20]},
                            {'id': 2, 'image_id': 2, 'category_id': 7, 'bbox': [150, 140, 100, 20]}]}
    (d / 't/labels.json').write_text(json.dumps(coco))
    got = {p.page.file: p.anns for p in import_source(kw('text', 'coco', {'text': 'text'}), d / 't')}
    [a] = got['text_a.jpg']
    assert a['category'] == 'bubble' and 80 <= a['bbox'][0] <= 86 and 228 <= a['bbox'][2] <= 241 and a['bbox'][3] > 140, a  # the whole oval
    assert got.get('text_b.jpg', []) == [], got  # no bubble around it: dropped, never kept as a bubble

    # sound-effect classes map to sfx; unknown classes are left out
    (d / 'y/images').mkdir(parents=True), (d / 'y/labels').mkdir()
    bubble_page().save(d / 'y/images/q.png')
    (d / 'y/data.yaml').write_text("names: ['balloon', 'onomatopoeia', 'face']\n")
    (d / 'y/labels/q.txt').write_text('0 0.5 0.5 0.6 0.55\n1 0.1 0.1 0.1 0.1\n2 0.8 0.8 0.1 0.1\n')
    got = import_source(kw('yolo', 'yolo', {'balloon': 'bubble', 'onomatopoeia': 'sfx'}), d / 'y')
    assert sorted(a['category'] for a in got[0].anns) == ['bubble', 'sfx'], got[0].anns
    [b] = [a['bbox'] for a in got[0].anns if a['category'] == 'bubble']
    assert b[0] == 80 and b[2] == 240 and abs(b[1] - 67.5) <= 1 and abs(b[3] - 165) <= 1, b

    # near-duplicates across sources are removed (the same page re-uploaded smaller and re-saved as JPEG)
    (d / 'dup/images').mkdir(parents=True)
    bubble_page().resize((300, 225)).save(d / 'dup/images/a-copy.jpg', quality=80)
    (d / 'dup/labels.json').write_text(json.dumps({**coco, 'images': [{'id': 1, 'file_name': 'a-copy.jpg', 'width': 300, 'height': 225}],
                                                   'annotations': [{'id': 1, 'image_id': 1, 'category_id': 7, 'bbox': [112, 105, 75, 15]}]}))
    first = import_source(kw('text', 'coco', {'text': 'text'}), d / 't')
    second = import_source(kw('dup', 'coco', {'text': 'text'}), d / 'dup')
    kept = dedupe(first + second)
    assert [p.page.file for p in kept] == ['text_a.jpg', 'text_b.jpg'], [p.page.file for p in kept]

    # every imported page has a source, style and recorded licence (and a style the target knows)
    for p in first + second:
        assert p.page.source and p.page.style in c.STYLES and c.licence_status(p.page), p.page
        assert all(a['category'] in c.CLASSES for a in p.anns)

print('comic import checks passed')
