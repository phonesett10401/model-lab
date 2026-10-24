"""Which Wikimedia Commons files may go into the comic dataset. Run: python test_comic_commons.py"""
from comic_commons import keep

ok = {'title': 'File:Mike Lancer in Green Hornet Comics 10.jpg', 'mime': 'image/jpeg', 'width': 1400, 'height': 2000,
      'licence': 'Public domain', 'categories': ['Public domain comics', 'Green Hornet Comics']}
assert keep(ok)
assert not keep({**ok, 'licence': 'CC BY-SA 4.0'}), 'only public domain'
assert not keep({**ok, 'categories': ok['categories'] + ['AI-generated comics illustrations']}), 'never AI-generated'
assert not keep({**ok, 'title': 'File:x.pdf', 'mime': 'application/pdf'}), 'images only'
assert not keep({**ok, 'width': 500, 'height': 700}), 'too small to read lettering'
assert keep({**ok, 'licence': 'PD-US-not renewed'}), 'PD tags count as public domain'
from comic_commons import ext_of  # noqa: E402
assert ext_of('https://upload.wikimedia.org/a/b/Fl065.jpg/1600px-Fl065.jpg?utm_source=commons.wikimedia.org&utm_content=thumbnail') == '.jpg'
assert ext_of('https://upload.wikimedia.org/a/b/Page.PNG') == '.png'
print('comic commons checks passed')
