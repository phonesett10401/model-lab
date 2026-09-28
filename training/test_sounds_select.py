"""Checks for the FSD50K selection rules. Run: python test_sounds_select.py"""
import sounds_select as sel

BY = 'http://creativecommons.org/licenses/by/3.0/'
NC = 'http://creativecommons.org/licenses/by-nc/3.0/'


def row(fname, labels, split='train'):
    return {'fname': fname, 'labels': ','.join(labels), 'split': split}


def info(lic=BY):
    return {'license': lic, 'uploader': 'someone'}


dev = [row('1', ['Bark', 'Dog', 'Animal']), row('2', ['Bark'], 'val'), row('3', ['Bark']),
       row('4', ['Music', 'Guitar']),                       # a clean negative
       row('5', ['Human_voice']),                           # ambiguous: might hide speech, never a negative
       row('6', ['Meow', 'Speech']),                        # two sounds at once
       row('7', ['Laughter'])]
dev_info = {'1': info(), '2': info(), '3': info(NC), '4': info(), '5': info(), '6': info(), '7': info('http://creativecommons.org/licenses/sampling+/1.0/')}
ev = [row('10', ['Bark']), row('11', ['Music'])]
ev_info = {'10': info(), '11': info()}

out = {r['fname']: r for r in sel.select(dev, [{k: v for k, v in r.items() if k != 'split'} for r in ev], dev_info, ev_info)}
assert out['1']['sounds'] == 'dog bark' and out['1']['split'] == 'train', out['1']
assert out['2']['split'] == 'val'
assert '3' not in out and '7' not in out            # BY-NC and Sampling+ are dropped
assert out['4']['sounds'] == '' and out['4']['split'] == 'train'   # negative
assert '5' not in out                                # ambiguous parent label
assert out['6']['sounds'] == 'cat meow|speech'
assert out['10']['split'] == 'test' and out['11']['sounds'] == ''
assert out['1']['url'] == 'https://freesound.org/s/1/'
# Caps: never more than MAX_PER_SOUND train clips of one sound, chosen reproducibly.
many = [row(str(100 + i), ['Speech']) for i in range(sel.MAX_PER_SOUND + 50)]
many_info = {r['fname']: info() for r in many}
a = [r['fname'] for r in sel.select(many, [], many_info, {}) if r['split'] == 'train']
b = [r['fname'] for r in sel.select(many, [], many_info, {}) if r['split'] == 'train']
assert len(a) == sel.MAX_PER_SOUND and a == b
print('selection checks passed')
