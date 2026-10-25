"""Automatic labels from OCR words + detector boxes. Run: python test_comic_autolabel.py"""
from comic_autolabel import label_page, merge_words

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

# English outside any detected box: several words -> caption, few -> art-text, box padded around the words
out = label_page(bubble_a, [])
assert len(out) == 1 and out[0]['category'] == 'caption' and out[0]['text'] == 'WHERE ARE YOU GOING?', out
x, y, w, h = out[0]['bbox']
assert x < 100 and y < 100 and x + w > 200 + 54 and y + h > 135 + H, out[0]['bbox']
sign = label_page([word(50, 50, 'BAKERY')], [])
assert [a['category'] for a in sign] == ['art-text'], sign

# low-confidence scraps are not English
assert label_page([word(10, 10, 'XQZT', conf=0.3)], []) == []
print('comic autolabel checks passed')
