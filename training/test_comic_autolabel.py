"""Automatic labels from OCR words + detector boxes. Run: python test_comic_autolabel.py"""
import numpy as np
from PIL import Image, ImageDraw

from comic_autolabel import free_kind, label_page, merge_words, split_touching

H = 30  # word height in these tests


def word(x, y, text, w=None, conf=0.9):
    return {'bbox': [x, y, w or 18 * len(text), H], 'text': text, 'conf': conf}


bubble_a = [word(100, 100, 'WHERE'), word(200, 100, 'ARE'), word(110, 135, 'YOU'), word(180, 135, 'GOING?')]
bubble_b = [word(700, 100, 'HELLO'), word(700, 135, 'THERE')]

# words in one bubble merge; two bubbles stay apart
regions = merge_words(bubble_a + bubble_b)
assert len(regions) == 2, regions
assert sorted(len(r['words']) for r in regions) == [2, 4]

# a lone short word on the art is junk; the same word inside a detected bubble is kept
junk = [word(400, 600, 'HO')]
assert label_page(junk, []) == []
kept = label_page(junk, [{'bbox': [380, 580, 120, 80], 'category': 'bubble', 'score': 0.8}])
assert kept == [{'bbox': [380, 580, 120, 80], 'category': 'bubble', 'text': 'HO'}], kept

# a detected box with no English in it (e.g. Japanese sound effects) gets no label
assert label_page([], [{'bbox': [0, 0, 100, 100], 'category': 'sfx', 'score': 0.9}]) == []

# English outside any detected box: several words -> caption, few -> free-text (or sfx), box padded around the words
out = label_page(bubble_a, [])
assert len(out) == 1 and out[0]['category'] == 'caption' and out[0]['text'] == 'WHERE ARE YOU GOING?', out
x, y, w, h = out[0]['bbox']
assert x < 100 and y < 100 and x + w > 200 + 54 and y + h > 135 + H, out[0]['bbox']
sign = label_page([word(50, 50, 'BAKERY')], [])
assert [a['category'] for a in sign] == ['free-text'], sign

# low-confidence scraps are not English
assert label_page([word(10, 10, 'XQZT', conf=0.3)], []) == []

# CLAP and THROB become sfx, a sign's words become free-text; so do drawn-out sounds; a detected art-text box is sorted too
assert free_kind('CLAP') == 'sfx' and free_kind('THROB THROB') == 'sfx' and free_kind('Grooo') == 'sfx' and free_kind('Shhh...') == 'sfx'
assert free_kind('BAKERY') == 'free-text' and free_kind('The next day...') == 'free-text' and free_kind('EXIT') == 'free-text'
clap = label_page([word(400, 600, 'CLAP')], [{'bbox': [380, 580, 120, 80], 'category': 'art-text', 'score': 0.8}])
assert [a['category'] for a in clap] == ['sfx'], clap
assert [a['category'] for a in label_page([word(50, 50, 'CLAP!')], [])] == ['sfx']


def page(draw) -> np.ndarray:
    im = Image.new('RGB', (500, 300), (110, 110, 110))
    draw(ImageDraw.Draw(im))
    return np.asarray(im)


# two touching bubbles (each with its own outline) become two boxes
touching = page(lambda d: (d.ellipse([20, 60, 250, 240], fill='white', outline='black', width=3),
                           d.ellipse([247, 60, 480, 240], fill='white', outline='black', width=3)))
boxes = sorted(split_touching(touching, [20, 60, 461, 181], [[90, 140, 90, 20], [320, 140, 90, 20]]))
assert len(boxes) == 2 and boxes[0][0] < 30 and boxes[0][0] + boxes[0][2] < 255 and boxes[1][0] > 240, boxes

# a bubble with joined lobes (one paper region, a neck between) stays one box
lobes = page(lambda d: (d.ellipse([20, 60, 250, 240], fill='black'), d.ellipse([230, 60, 480, 240], fill='black'),
                        d.ellipse([23, 63, 247, 237], fill='white'), d.ellipse([233, 63, 477, 237], fill='white'),
                        d.rectangle([200, 120, 280, 180], fill='white')))
boxes = split_touching(lobes, [20, 60, 461, 181], [[90, 140, 90, 20], [320, 140, 90, 20]])
assert len(boxes) == 1 and boxes[0][2] > 400, boxes
print('comic autolabel checks passed')
