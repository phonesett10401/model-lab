"""Pepper&Carrot (David Revoy, CC BY 4.0): English pages + their art-only twins, with free text boxes from the difference.

Run: python comic_pepper.py [--episodes 1 2 ...]   (default: every episode)
Writes data/comic/images/pepper_*.jpg, data/comic/art/pepper_*.jpg, data/comic/pepper_draft.json, and logs pages.
"""
import argparse
import datetime
import re
import time
import urllib.request
from pathlib import Path

from PIL import Image

import comic_common as c
from comic_diff import text_boxes, usable_page

BASE = 'https://www.peppercarrot.com/0_sources/'
UA = {'User-Agent': 'AI-Model-Lab comic-translator dataset (github.com/phonesett10401/model-lab)'}
WIDTH = 1600


def get(url: str) -> bytes:
    time.sleep(1)  # be polite: one request a second
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def links(url: str, pattern: str) -> list[str]:
    return sorted(set(re.findall(pattern, get(url).decode('utf8'))))


def fetch(url: str, dest: Path) -> Image.Image:
    if not dest.exists():
        im = Image.open(__import__('io').BytesIO(get(url))).convert('RGB')
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, quality=92)
    return Image.open(dest).convert('RGB')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--episodes', type=int, nargs='*')
    args = ap.parse_args()
    today = datetime.date.today().isoformat()
    folders = links(BASE, r'href="(ep\d+_[^"/]+)/"')
    for folder in folders:
        ep = int(folder[2:4])
        if args.episodes and ep not in args.episodes:
            continue
        pages = []
        # P00 is the title strip and the bare E<NN> file is the cover: story pages are P01 onwards.
        for name in links(f'{BASE}{folder}/hi-res/', r'href="(en_Pepper-and-Carrot_by-David-Revoy_E\d+P(?!00)\d+\.jpg)"'):
            tag = name.split('_')[-1].removesuffix('.jpg')  # E01P01
            file = f'pepper_{tag}.jpg'
            text = fetch(f'{BASE}{folder}/hi-res/{name}', c.DATA / 'images' / file)
            art = fetch(f'{BASE}{folder}/hi-res/gfx-only/{name.replace("en_", "gfx_", 1)}', c.DATA / 'art' / file)
            boxes = text_boxes(text, art)
            if not usable_page(text.width, text.height, boxes):
                print('skip (spacer strip or credits):', file)
                continue
            pages.append(c.Page(file=file, source='Pepper&Carrot', group=f'pepper-ep{ep:02d}', style='modern-western', split='',
                                author='David Revoy', licence='CC BY 4.0', link=f'{BASE}{folder}/', date=today))
            print(file, len(boxes), 'boxes')
        c.add_pages(c.ATTRIBUTION, pages)
    write_draft()


def write_draft() -> None:
    """Rebuilds pepper_draft.json from every logged Pepper&Carrot page (all boxes start as 'bubble')."""
    items = []
    for p in c.load_attribution():
        if p.source != 'Pepper&Carrot':
            continue
        text = Image.open(c.DATA / 'images' / p.file).convert('RGB')
        art = Image.open(c.DATA / 'art' / p.file).convert('RGB')
        items.append((p.file, text.width, text.height, [{'bbox': list(b), 'category': 'bubble'} for b in text_boxes(text, art)]))
    c.write_coco(c.DATA / 'pepper_draft.json', items)
    print(len(items), 'pages in pepper_draft.json')


if __name__ == '__main__':
    main()
