"""Picking story pages from a Black Jack volume. Run: python test_comic_blackjack.py"""
from comic_blackjack import pick, safe_name

got = pick(210, 25)
assert len(got) == 25 and len(set(got)) == 25, got
assert min(got) >= 3 and max(got) <= 210 - 3, 'covers, contents and the terms page are skipped'
assert got == sorted(got) and pick(210, 25) == got, 'evenly spaced and repeatable'
assert pick(10, 25) == list(range(3, 7)), 'a short volume gives what it has'
assert safe_name('../../evil/p 001.jpg') == 'p-001.jpg', 'no paths out of the folder'
print('comic blackjack checks passed')
