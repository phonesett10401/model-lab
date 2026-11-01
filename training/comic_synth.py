"""Synthetic lettered pages for round 3: the hard cases the finder missed, drawn on art-only pages, with exact labels in
the one target (one box per closed bubble; joined lobes one box, touching bubbles two; free text apart from sound effects).

Run: python comic_synth.py [--pages 2000]
Reads art-only pages from data/comic/art/ (Pepper&Carrot, CC BY 4.0), writes data/comic3/synth/images/synth3_*.jpg and
data/comic3/synth/labels.json, and logs each page in attribution/comic-v3.csv in the same group as its art page.
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
SPEECH = PHRASES[:10] + PHRASES[15:]
NARRATION = PHRASES[10:15]

# What a page can hold, each labelled by the one-target rule.
KINDS = ['bubble', 'big', 'round', 'joined', 'touching', 'border', 'caption', 'tinted', 'free', 'sfx']
WEIGHTS = [4, 3, 2, 2, 2, 2, 1, 2, 2, 2]
CATEGORY = {'caption': 'caption', 'tinted': 'caption', 'free': 'free-text', 'sfx': 'sfx'}  # the rest are bubbles


def font(fonts: list[Path], rng: random.Random, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(rng.choice(fonts)), size) if fonts else ImageFont.load_default(size)


def _lines(text: str, f, width: int) -> tuple[list[str], int, int, float]:
    lines = textwrap.wrap(text, width=width, break_long_words=False) or [text]
    boxes = [f.getbbox(l) for l in lines]
    lh = max(b[3] - b[1] for b in boxes) * 1.3
    return lines, max(b[2] - b[0] for b in boxes), round(lh * len(lines)), lh


def _write(g: ImageDraw.ImageDraw, lines: list[str], f, cx: int, top: int, lh: float, fill='black') -> None:
    for i, l in enumerate(lines):
        g.text((cx, top + round(i * lh)), l, font=f, fill=fill, anchor='mt')


def _oval(text: str, f, width: int, scale: float, rng: random.Random, tail: bool, round_: bool = False) -> Image.Image:
    """A white oval bubble around the text (outline 3 px), with a tail or not, on a transparent tile."""
    lines, tw, th, lh = _lines(text, f, width)
    pad = round(18 * scale)
    w, h = round(tw * 1.45 + 2 * pad), round(th * 1.6 + 2 * pad)
    if round_:
        w = h = max(w, h)
    t = round(h * 0.35) if tail else 0
    im = Image.new('RGBA', (w, h + t))
    g = ImageDraw.Draw(im)
    if tail:
        cx = w // 2 + rng.randint(-w // 4, w // 4)
        g.polygon([(cx - w // 10, h - 10), (cx + w // 10, h - 10), (cx + rng.randint(-w // 5, w // 5), h + t - 1)],
                  fill='white', outline='black')
    g.ellipse([1, 1, w - 2, h - 2], fill='white', outline='black', width=3)
    _write(g, lines, f, w // 2, (h - th) // 2, lh)
    return im


def _whole(im: Image.Image, kind: str, text: str) -> list[dict]:
    x0, y0, x1, y1 = im.getbbox()
    return [{'bbox': [x0, y0, x1 - x0, y1 - y0], 'category': CATEGORY.get(kind, 'bubble'), 'text': text, 'kind': kind}]


def tile(kind: str, rng: random.Random, fonts: list[Path], scale: float) -> tuple[Image.Image, list[dict]]:
    """One lettered item on a transparent tile, and its labels (bbox in tile pixels, category, text, kind)."""
    size = lambda lo, hi: font(fonts, rng, round(rng.uniform(lo, hi) * scale))
    if kind in ('bubble', 'border'):
        text = rng.choice(SPEECH)
        im = _oval(text, size(22, 34), rng.randint(10, 16), scale, rng, tail=True)
        return im, _whole(im, kind, text)
    if kind == 'big':  # many lines in one bubble (round 2's synthetic pages had five of these in all)
        text = ' '.join(rng.sample(SPEECH, rng.randint(3, 5)))
        im = _oval(text, size(20, 30), rng.randint(14, 22), scale, rng, tail=rng.random() < 0.6)
        return im, _whole(im, kind, text)
    if kind == 'round':  # manga-style: near-round, a narrow column of text, no tail
        text = rng.choice(SPEECH)
        im = _oval(text, size(20, 30), rng.randint(6, 9), scale, rng, tail=False, round_=True)
        return im, _whole(im, kind, text)
    if kind in ('joined', 'touching'):
        f = size(22, 32)
        texts = [rng.choice(PHRASES[:10]), rng.choice(PHRASES[15:])]
        parts = [_oval(t, f, 11, scale, rng, tail=False) for t in texts]
        (w1, h1), (w2, h2) = parts[0].size, parts[1].size
        # joined: the lobes overlap by a quarter (one paper region, one box); touching: the outlines just meet (two boxes)
        dx = w1 - (w1 // 4 if kind == 'joined' else 3)
        dy = rng.randint(0, max(0, abs(h1 - h2) // 2))
        spots = ((0, 0, w1, h1), (dx, dy, w2, h2))
        im = Image.new('RGBA', (dx + w2, max(h1, dy + h2)))
        if kind == 'touching':
            labels = []
            for (x0, y0, _, _), part, t in zip(spots, parts, texts):
                im.alpha_composite(part, (x0, y0))
                b = part.getbbox()
                labels.append({'bbox': [x0 + b[0], y0 + b[1], b[2] - b[0], b[3] - b[1]], 'category': 'bubble', 'text': t, 'kind': kind})
            return im, labels
        g = ImageDraw.Draw(im)
        for x0, y0, w, h in spots:  # outlines first, then both insides: no line runs through the overlap
            g.ellipse([x0 + 1, y0 + 1, x0 + w - 2, y0 + h - 2], fill='black')
        for x0, y0, w, h in spots:
            g.ellipse([x0 + 4, y0 + 4, x0 + w - 5, y0 + h - 5], fill='white')
        for (x0, y0, w, h), t in zip(spots, texts):
            lines, _, th, lh = _lines(t, f, 11)
            _write(g, lines, f, x0 + w // 2, y0 + (h - th) // 2, lh)
        return im, _whole(im, kind, ' '.join(texts))
    if kind in ('caption', 'tinted'):
        text = rng.choice(NARRATION + PHRASES[15:])
        f = size(22, 32)
        lines, tw, th, lh = _lines(text, f, rng.randint(12, 20))
        pad = round(16 * scale)
        w, h = tw + 2 * pad, th + 2 * pad
        im = Image.new('RGBA', (w, h))
        g = ImageDraw.Draw(im)
        ink = 'black'
        style = 'cream' if kind == 'caption' else rng.choice(['tint', 'gradient', 'dark'])
        if style == 'cream':
            g.rectangle([0, 0, w - 1, h - 1], fill=(255, 244, 200), outline='black', width=3)
        elif style == 'tint':
            g.rectangle([0, 0, w - 1, h - 1], fill=tuple(rng.randint(150, 240) for _ in range(3)), outline='black', width=2)
        elif style == 'gradient':
            a, z = [tuple(rng.randint(150, 250) for _ in range(3)) for _ in range(2)]
            for y in range(h):
                g.line([(0, y), (w - 1, y)], fill=tuple(round(a[k] + (z[k] - a[k]) * y / max(1, h - 1)) for k in range(3)))
            g.rectangle([0, 0, w - 1, h - 1], outline='black', width=2)
        else:
            g.rectangle([0, 0, w - 1, h - 1], fill=tuple(rng.randint(10, 60) for _ in range(3)), outline=(200, 200, 200), width=2)
            ink = 'white'
        _write(g, lines, f, w // 2, pad, lh, ink)
        return im, _whole(im, kind, text)
    if kind == 'sfx':
        text = rng.choice(SFX)
        f = size(60, 110)
        b = f.getbbox(text, stroke_width=4)
        im = Image.new('RGBA', (b[2] - b[0] + 8, b[3] - b[1] + 8))
        colour = rng.choice([(230, 40, 30), (250, 200, 0), (255, 255, 255), (40, 120, 230)])
        ImageDraw.Draw(im).text((4 - b[0], 4 - b[1]), text, font=f, fill=colour, stroke_width=4, stroke_fill='black')
        im = im.rotate(rng.uniform(-20, 20), expand=True, resample=Image.BICUBIC)
        return im, _whole(im, kind, text)
    # free text on the art: a sign, or narration written without a box
    text = rng.choice(SIGNS + NARRATION)
    f = size(18, 30)
    b = f.getbbox(text)
    im = Image.new('RGBA', (b[2] - b[0] + 4, b[3] - b[1] + 4))
    ImageDraw.Draw(im).text((2 - b[0], 2 - b[1]), text, font=f, fill=rng.choice(['white', 'black', (60, 30, 10)]))
    return im, _whole(im, kind, text)


def tall_art(art: Image.Image, rng: random.Random) -> Image.Image:
    """A long webtoon strip: the art cut into panels stacked down a white page 3.5 to 5 times as tall as wide."""
    art = art.convert('RGB')
    W = art.width
    out = Image.new('RGB', (W, round(W * rng.uniform(3.5, 5))), 'white')
    y = rng.randint(40, 200)
    while y < out.height - 140:
        h = min(rng.randint(W // 3, W), art.height, out.height - y - 40)
        top = rng.randint(0, art.height - h)
        out.paste(art.crop((0, top, W, top + h)), (0, y))
        y += h + rng.randint(80, 400)
    return out


def make_page(art: Image.Image, rng: random.Random, fonts: list[Path], tall: bool = False) -> tuple[Image.Image, list[dict]]:
    page = tall_art(art, rng) if tall else art.convert('RGB').copy()
    W, H = page.size
    scale = W / 1600
    kinds = rng.choices(KINDS, weights=WEIGHTS, k=rng.randint(3, 7) * (3 if tall else 1))
    labels, taken, placed, borders = [], [], [], []
    for kind in kinds:
        im, rel = tile(kind, rng, fonts, scale)
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
                if kind == 'border':  # a panel border running under the bubble
                    across = rng.random() < 0.5
                    borders.append([(0, y + h // 2), (W - 1, y + h // 2)] if across else [(x + w // 2, 0), (x + w // 2, H - 1)])
                placed.append((im, x, y))
                taken.append((x, y, w, h))
                labels += [{**l, 'bbox': [x + l['bbox'][0] - crop[0], y + l['bbox'][1] - crop[1], *l['bbox'][2:]]} for l in rel]
                break
    # Borders first, then every item over them: a border never cuts through another bubble.
    draw = ImageDraw.Draw(page)
    for line in borders:
        draw.line(line, fill=(0, 0, 0), width=4)
    for im, x, y in placed:
        page.paste(im, (x, y), im)
    return page, labels


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', type=int, default=2000)
    args = ap.parse_args()
    fonts = sorted(FONTS.glob('*.ttf'))
    assert fonts, f'put the OFL fonts in {FONTS} first (see comic_vendor.md)'
    arts = [p for p in c.load_attribution() if p.source == 'Pepper&Carrot']
    rng = random.Random(2027)
    out = c.HERE / 'data/comic3/synth'
    (out / 'images').mkdir(parents=True, exist_ok=True)
    items, pages = [], []
    today = datetime.date.today().isoformat()
    for i in range(args.pages):
        src = arts[i % len(arts)]
        tall = i % 8 == 7  # one page in eight is a webtoon strip
        page, labels = make_page(Image.open(c.DATA / 'art' / src.file), rng, fonts, tall=tall)
        file = f'synth3_{i:04d}.jpg'
        page.save(out / 'images' / file, quality=92)
        items.append((file, page.width, page.height, labels))
        pages.append(c.Page(file=file, source='Synthetic lettering on Pepper&Carrot art (round 3)', group=src.group,
                            style='webtoon' if tall else 'modern-western', split='', author='David Revoy (art); synthetic lettering',
                            licence='CC BY 4.0', link=src.link, date=today))
    c.write_coco(out / 'labels.json', items)
    c.add_pages(c.HERE / 'attribution/comic-v3.csv', pages)
    print(len(items), 'synthetic pages')


if __name__ == '__main__':
    main()
