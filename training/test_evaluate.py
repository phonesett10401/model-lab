"""Checks for the failure counting in evaluate.py. Run: python test_evaluate.py"""
from evaluate import compare, iou

fish, shark = 0, 4
box = (10, 10, 50, 50)
far = (200, 200, 240, 240)

assert abs(iou(box, box) - 1) < 1e-6 and iou(box, far) == 0

# Right name, right place: no failures.
assert compare([(fish, box)], [(fish, box, 0.9)]) == ([], [], [])
# Nothing predicted: the fish is missed.
assert compare([(fish, box)], []) == ([(fish, box)], [], [])
# A box where nothing is: a false box.
assert compare([], [(shark, far, 0.8)]) == ([], [(shark, far, 0.8)], [])
# Right place, wrong name: counted as wrong name, not as a miss or a false box.
missed, false, wrong = compare([(fish, box)], [(shark, box, 0.7)])
assert (missed, false) == ([], []) and wrong == [((fish, box), (shark, box, 0.7))]
# Two predictions on one creature: the more confident one matches, the other is a false box.
missed, false, wrong = compare([(fish, box)], [(fish, box, 0.6), (fish, box, 0.9)])
assert missed == [] and wrong == [] and false == [(fish, box, 0.6)]
print('evaluate checks passed')
