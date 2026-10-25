"""The exported ONNX must give the same boxes as the trained model. Run: python test_comic_export.py"""
from comic_export import boxes_match

a = [(0, 0.90, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80]), (1, 0.05, [5, 5, 5, 5])]
assert boxes_match(a, a)
assert boxes_match(a, [(0, 0.905, [10.2, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'tiny float differences are fine; low scores ignored'
assert not boxes_match(a, [(0, 0.90, [10, 10, 100, 50])]), 'a missing box fails'
assert not boxes_match(a, [(1, 0.90, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a changed class fails'
assert not boxes_match(a, [(0, 0.80, [10, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a changed score fails'
assert not boxes_match(a, [(0, 0.90, [30, 10, 100, 50]), (2, 0.60, [300, 40, 80, 80])]), 'a moved box fails'
print('comic export checks passed')
