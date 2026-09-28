"""Checks for the Open Images selection rules. Run: python test_openimages_select.py"""
import csv
import tempfile
from pathlib import Path

import openimages_select as sel

CLASSES = [('/m/fish', 'Fish'), ('/m/shark', 'Shark'), ('/m/squid', 'Squid'), ('/m/crab', 'Crab'), ('/m/oyster', 'Oyster')]
BY = sel.CC_BY


def write(d, name, header, rows):
    with open(d / name, 'w', newline='', encoding='utf8') as f:
        w = csv.writer(f)
        if header:
            w.writerow(header)
        w.writerows(rows)


def box(iid, label, group='0', depiction='0'):
    return [iid, 'xclick', label, '1', '0.1', '0.5', '0.1', '0.5', '0', '0', group, depiction, '0']


with tempfile.TemporaryDirectory() as tmp:
    d = Path(tmp)
    write(d, 'classes.csv', None, CLASSES)
    bh = ['ImageID', 'Source', 'LabelName', 'Confidence', 'XMin', 'XMax', 'YMin', 'YMax', 'IsOccluded', 'IsTruncated', 'IsGroupOf', 'IsDepiction', 'IsInside']
    rows = [box('ok', '/m/shark'), box('group', '/m/fish', group='1'), box('toy', '/m/crab', depiction='1'),
            box('unboxed', '/m/crab'), box('shark-is-fish', '/m/shark'), box('rotated', '/m/crab'),
            box('nc', '/m/crab'), box('oyster-only', '/m/oyster')]
    rows += [box(f'crab{i}', '/m/crab') for i in range(sel.MIN_BOXES)]
    rows += [box(f'shark{i}', '/m/shark') for i in range(sel.MIN_BOXES)]  # enough sharks that the class survives
    rows += [box('squidphoto', '/m/squid'), box('squidphoto', '/m/crab')]
    write(d, 'bbox.csv', bh, rows)
    write(d, 'human_labels.csv', ['ImageID', 'Source', 'LabelName', 'Confidence'], [
        ['unboxed', 'verification', '/m/fish', '1'],        # a fish is confirmed but only the crab is boxed
        ['shark-is-fish', 'verification', '/m/fish', '1'],  # "Fish" is satisfied by the shark box
        ['ok', 'verification', '/m/crab', '0'],            # confirmed absent: fine
    ])
    ids = {r[0] for r in rows}
    write(d, 'images.csv', ['ImageID', 'Rotation', 'License', 'Author', 'OriginalLandingURL'],
          [[i, '90.0' if i == 'rotated' else '0.0', 'https://creativecommons.org/licenses/by-nc/2.0/' if i == 'nc' else BY, 'a', 'u'] for i in ids])

    kept, info, counts, why = sel.select(d)
    assert 'ok' in kept and 'shark-is-fish' in kept, kept.keys()
    for gone in ['group', 'toy', 'unboxed', 'rotated', 'nc', 'oyster-only', 'squidphoto']:
        assert gone not in kept, gone
    assert 'squid' not in counts and counts['crab'] == sel.MIN_BOXES, counts  # squid (1 box) dropped with its photo
    assert sel.split_of('abc') == sel.split_of('abc')  # stable
print('selection checks passed')
