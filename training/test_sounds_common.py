"""Checks for shared Sound detective settings. Run: python test_sounds_common.py"""
import sounds_common as c

assert c.CLASSES[0] == 'dog bark' and c.CLASSES[-1] == 'speech' and len(c.CLASSES) == 17, c.CLASSES
assert c.fsd_ok('http://creativecommons.org/licenses/by/3.0/')
assert c.fsd_ok('http://creativecommons.org/publicdomain/zero/1.0/')
assert not c.fsd_ok('http://creativecommons.org/licenses/by-nc/3.0/')
assert not c.fsd_ok('http://creativecommons.org/licenses/sampling+/1.0/')
assert c.topup_ok('https://creativecommons.org/licenses/by/4.0/')
assert c.topup_ok('http://creativecommons.org/publicdomain/zero/1.0/')
assert not c.topup_ok('http://creativecommons.org/licenses/by-nc/4.0/')
# Slices: one for anything up to 1 s; then every 0.5 s until the tail is covered (last one zero-padded).
assert c.window_starts(100) == [0]
assert c.window_starts(32000) == [0]
assert c.window_starts(48000) == [0, 16000]
assert c.window_starts(50000) == [0, 16000, 32000]
get_mn = c.efficientat()
assert callable(get_mn)
print('common checks passed')
