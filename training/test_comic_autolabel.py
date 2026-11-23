"""Automatic labels from OCR words + detector boxes. Run: python test_comic_autolabel.py"""
import numpy as np
from PIL import Image, ImageDraw

from comic_autolabel import free_kind, label_page, merge_words, refine, split_touching

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

# joined bubbles (one paper region holding two texts, a neck between): one box per text, the text padded a little,
# never one box over the chain (round 3 counts each bubble; changed 2026-11-04)
lobes = page(lambda d: (d.ellipse([20, 60, 250, 240], fill='black'), d.ellipse([230, 60, 480, 240], fill='black'),
                        d.ellipse([23, 63, 247, 237], fill='white'), d.ellipse([233, 63, 477, 237], fill='white'),
                        d.rectangle([200, 120, 280, 180], fill='white')))
boxes = sorted(split_touching(lobes, [20, 60, 461, 181], [[90, 140, 90, 20], [320, 140, 90, 20]]))
assert len(boxes) == 2 and boxes[0][0] + boxes[0][2] < 200 and boxes[1][0] > 300, boxes
assert boxes[0][0] < 90 and boxes[0][2] > 90, boxes  # padded around the text

# refine: a text-tight box grows to its whole bubble and stays a bubble; a rectangular box becomes a caption; one box
# over two bubbles becomes two; a box with no closed bubble around it is kept as it is
scene = page(lambda d: (d.ellipse([20, 40, 230, 260], fill='white', outline='black', width=3),
                        d.rectangle([300, 40, 480, 140], fill=(250, 244, 220), outline='black', width=3),
                        d.ellipse([260, 170, 380, 290], fill='white', outline='black', width=3),
                        d.ellipse([383, 170, 495, 290], fill='white', outline='black', width=3)))
labels = [{'bbox': [80, 130, 90, 30], 'category': 'caption', 'text': 'HELLO THERE'},
          {'bbox': [330, 70, 120, 30], 'category': 'bubble', 'text': 'Later that day'},
          {'bbox': [280, 200, 200, 60], 'category': 'bubble', 'text': 'Hi Yes'},
          {'bbox': [5, 5, 10, 10], 'category': 'bubble', 'text': 'x'}]
words = [[80, 130, 90, 30], [330, 70, 120, 30], [290, 215, 60, 20], [410, 215, 60, 20], [5, 5, 10, 10]]
out = refine(scene, labels, words)
got = sorted((l['category'], l['bbox'][0] // 10) for l in out)
assert got == [('bubble', 0), ('bubble', 2), ('bubble', 26), ('bubble', 38), ('caption', 30)], (got, out)
oval = [l for l in out if 15 < l['bbox'][0] < 30][0]['bbox']
assert oval[2] > 190 and oval[3] > 200, oval  # the whole oval, not the text
# ...and a chain that opens onto the page margin (no closed bubble at all, as in Pepper&Carrot): one padded box per text
open_chain = page(lambda d: (d.ellipse([20, 60, 250, 240], fill='white'), d.ellipse([230, 60, 480, 240], fill='white'),
                             d.rectangle([100, 0, 160, 80], fill='white')))
boxes = sorted(split_touching(open_chain, [20, 60, 461, 181], [[90, 140, 90, 20], [320, 140, 90, 20]]))
assert len(boxes) == 2 and boxes[0][0] + boxes[0][2] < 200 and boxes[1][0] > 300, boxes
# ...but a caption with two paragraphs and no closed outline stays one box (narration isn't a chain of bubbles)
assert split_touching(open_chain, [20, 60, 461, 181], [[90, 140, 90, 20], [320, 140, 90, 20]], pad_open=False) == [[20, 60, 461, 181]]
cap = refine(open_chain, [{'bbox': [20, 60, 461, 181], 'category': 'caption', 'text': 'a b'}], [[90, 140, 90, 20], [320, 140, 90, 20]])
assert len(cap) == 1 and cap[0]['bbox'] == [20, 60, 461, 181], cap
# refine: a text box whose bubble would take in another text (joined bubbles) is not grown
joined = [{'bbox': [90, 140, 90, 20], 'category': 'bubble', 'text': 'Hi'}]
out = refine(lobes, joined, [[90, 140, 90, 20], [320, 140, 90, 20]])
assert len(out) == 1 and out[0]['bbox'][2] < 150, out
# a padded text box at the page edge stays on the page
edge = sorted(split_touching(open_chain, [20, 60, 461, 181], [[90, 140, 90, 20], [400, 140, 99, 20]]))
assert all(b[0] >= 0 and b[0] + b[2] <= 500 for b in edge), edge
refine(open_chain, [{'bbox': [20, 60, 461, 181], 'category': 'bubble', 'text': 'a b'}], [[90, 140, 90, 20], [400, 140, 99, 20]])
print('comic autolabel checks passed')
