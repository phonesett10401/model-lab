"""Checks for the Freesound top-up rules. Run: python test_sounds_topup.py"""
import sounds_topup as t

ok = {'id': 5, 'license': 'https://creativecommons.org/licenses/by/4.0/', 'duration': 3.0}
assert t.usable(ok, known=set())
assert not t.usable(ok | {'license': 'http://creativecommons.org/licenses/by-nc/3.0/'}, known=set())
assert not t.usable(ok, known={'5'})                    # already in FSD50K (could be a test clip): never reuse
assert not t.usable(ok | {'duration': 45.0}, known=set())
assert not t.usable(ok | {'duration': 0.2}, known=set())
rows = [{'split': 'train', 'sounds': 'siren'}] * 40 + [{'split': 'train', 'sounds': 'speech|siren'}] * 10 + \
       [{'split': 'test', 'sounds': 'siren'}] * 99
n = t.need(rows)
assert n['siren'] == t.TARGET - 50 and n['speech'] == t.TARGET - 10 and n['dog bark'] == t.TARGET, n
print('top-up checks passed')
