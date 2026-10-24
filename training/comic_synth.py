"""Synthetic lettered pages: English bubbles, captions, sound effects and signs drawn on art-only pages, with exact labels.

Run: python comic_synth.py [--pages 600]
Reads art-only pages from data/comic/art/ (Pepper&Carrot), writes data/comic/images/synth_*.jpg and data/comic/synth.json,
and logs each page in the same group as its art page, so it always shares that page's split.
"""
import argparse
import datetime
import random
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import comic_common as c

FONTS = c.HERE / 'vendor/fonts'
PHRASES = [
    'WHERE ARE YOU GOING?', 'I told you so!', 'Wait for me!', 'This is the best day ever.', 'Not again...',
    'Who left the door open?', 'We have to hurry!', 'Look out!', 'I can explain everything.', 'Is anyone home?',
    'Later that night...', 'Meanwhile, in the forest', 'The next morning', 'Three days later...', 'Back at the house',
    'Are you sure about this?', 'Hmm... interesting.', 'Let me try one more time.', 'That was close!', 'Thank you so much!',
]
SFX = ['BOOM!', 'CRASH', 'ZAP!', 'WHOOSH', 'BANG!', 'POP', 'THUD', 'SPLASH', 'KRAK!', 'ZZZ']
SIGNS = ['OPEN', 'CLOSED', 'EXIT', 'BAKERY', 'NO ENTRY', 'SHOP', 'POTIONS', 'LIBRARY']


def font(fonts: list[Path], rng: random.Random, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(rng.choice(fonts)), size) if fonts else ImageFont.load_default(size)


def tile(kind: str, rng: random.Random, fonts: list[Path], scale: float) -> tuple[Image.Image, str]:
    """One lettered item on a transparent tile, and its text."""
    if kind in ('bubble', 'caption'):
        text = rng.choice(PHRASES[:10] if kind == 'bubble' else PHRASES[10:15] + PHRASES[15:])
        f = font(fonts, rng, round(rng.uniform(22, 34) * scale))
        lines = textwrap.wrap(text, width=rng.randint(10, 16), break_long_words=False)
        boxes = [f.getbbox(l) for l in lines]
        tw = max(b[2] - b[0] for b in boxes)
        lh = max(b[3] - b[1] for b in boxes) * 1.3
        th = round(lh * len(lines))
        pad = round(18 * scale)
        if kind == 'bubble':
            w, h = round(tw * 1.45 + 2 * pad), round(th * 1.6 + 2 * pad)
            tail = round(h * 0.35)
            im = Image.new('RGBA', (w, h + tail))
            g = ImageDraw.Draw(im)
            cx = w // 2 + rng.randint(-w // 4, w // 4)
            g.polygon([(cx - w // 10, h - 10), (cx + w // 10, h - 10), (cx + rng.randint(-w // 5, w // 5), h + tail - 1)], fill='white', outline='black')
            g.ellipse([1, 1, w - 2, h - 2], fill='white', outline='black', width=3)
            top = (h - th) // 2
        else:
            w, h = tw + 2 * pad, th + 2 * pad
            im = Image.new('RGBA', (w, h))
            g = ImageDraw.Draw(im)
            g.rectangle([0, 0, w - 1, h - 1], fill=(255, 244, 200), outline='black', width=3)
            top = pad
        for i, l in enumerate(lines):
            g.text((w // 2, top + round(i * lh)), l, font=f, fill='black', anchor='mt')
        return im, text
    if kind == 'sfx':
        text = rng.choice(SFX)
        f = font(fonts, rng, round(rng.uniform(60, 110) * scale))
        b = f.getbbox(text, stroke_width=4)
        im = Image.new('RGBA', (b[2] - b[0] + 8, b[3] - b[1] + 8))
        colour = rng.choice([(230, 40, 30), (250, 200, 0), (255, 255, 255), (40, 120, 230)])
        ImageDraw.Draw(im).text((4 - b[0], 4 - b[1]), text, font=f, fill=colour, stroke_width=4, stroke_fill='black')
        return im.rotate(rng.uniform(-20, 20), expand=True, resample=Image.BICUBIC), text
    text = rng.choice(SIGNS)
    f = font(fonts, rng, round(rng.uniform(16, 26) * scale))
    b = f.getbbox(text)
    im = Image.new('RGBA', (b[2] - b[0] + 4, b[3] - b[1] + 4))
    ImageDraw.Draw(im).text((2 - b[0], 2 - b[1]), text, font=f, fill=rng.choice(['white', 'black', (60, 30, 10)]))
    return im, text


def make_page(art: Image.Image, rng: random.Random, fonts: list[Path]) -> tuple[Image.Image, list[dict]]:
    page = art.convert('RGB').copy()
    W, H = page.size
    scale = W / 1600
    kinds = rng.choices(c.CLASSES, weights=[5, 2, 2, 1], k=rng.randint(2, 6))
    labels, taken = [], []
    for kind in kinds:
        im, text = tile(kind, rng, fonts, scale)
        crop = im.getbbox()
        if not crop:
            continue
        im = im.crop(crop)
        w, h = im.size
        if w >= W or h >= H:
            continue
        for _ in range(50):
            x, y = rng.randint(0, W - w), rng.randint(0, H - h)
            if all(x + w <= a or a + aw <= x or y + h <= b or b + bh <= y for a, b, aw, bh in taken):
                page.paste(im, (x, y), im)
                taken.append((x, y, w, h))
                labels.append({'bbox': [x, y, w, h], 'category': kind, 'text': text})
                break
    return page, labels


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', type=int, default=600)
    args = ap.parse_args()
    fonts = sorted(FONTS.glob('*.ttf'))
    assert fonts, f'put the OFL fonts in {FONTS} first (see comic_vendor.md)'
    arts = [p for p in c.load_attribution() if p.source == 'Pepper&Carrot']
    rng = random.Random(2026)
    items, pages = [], []
    today = datetime.date.today().isoformat()
    for i in range(args.pages):
        src = arts[i % len(arts)]
        page, labels = make_page(Image.open(c.DATA / 'art' / src.file), rng, fonts)
        file = f'synth_{i:04d}.jpg'
        page.save(c.DATA / 'images' / file, quality=92)
        items.append((file, page.width, page.height, labels))
        pages.append(c.Page(file=file, source='Synthetic lettering on Pepper&Carrot art', group=src.group,
                            style='modern-western', split='', author='David Revoy (art); synthetic lettering',
                            licence='CC BY 4.0', link=src.link, date=today))
    c.write_coco(c.DATA / 'synth.json', items)
    c.add_pages(c.ATTRIBUTION, pages)
    print(len(items), 'synthetic pages')


if __name__ == '__main__':
    main()
