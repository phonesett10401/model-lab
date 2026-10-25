"""Registers comic pages saved under training/incoming/comic/<source>/<group>/ (one folder per volume, chapter or book).

Run: python comic_incoming.py incoming/comic/blackjack --source "Black Jack ni Yoroshiku (Shuho Sato)" --style manga \
        --licence "Black Jack free reuse" --author "Shuho Sato" --link https://mangaonweb.com/
Pages are resized to 1600 px wide into data/comic/images/<source>_<group>_<page>.jpg and logged in the attribution CSV.
"""
import argparse
import datetime
from pathlib import Path

from PIL import Image

import comic_common as c

WIDTH = 1600
EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def register(folder: Path, *, source: str, style: str, licence: str, author: str, link: str,
             attribution: Path = c.ATTRIBUTION, images: Path = c.DATA / 'images', group_prefix: str | None = None,
             meta: dict[str, tuple[str, str]] | None = None) -> list[c.Page]:
    """Groups come from subfolders (<folder>-<sub>); with group_prefix, a flat folder is one group <prefix>-<folder>.
    meta maps a file stem to its own (author, link)."""
    folder = Path(folder)
    base = group_prefix or folder.name
    meta = meta or {}
    today = datetime.date.today().isoformat()
    pages, todo = [], []
    for f in sorted(p for p in folder.rglob('*') if p.suffix.lower() in EXTS):
        sub = f.parent.name if f.parent != folder else (folder.name if group_prefix else None)
        group = f'{base}-{sub}' if sub else base
        file = f'{base}_{sub}_{f.stem}.jpg' if sub else f'{base}_{f.stem}.jpg'
        who, where = meta.get(f.stem, (author, link))
        page = c.Page(file=file, source=source, group=group, style=style, split='', author=who,
                      licence=licence, link=where, date=today)
        c._check(page)  # refuse a bad licence before anything is written
        pages.append(page)
        todo.append((f, images / file))
    known = {p.file for p in c.load_attribution(attribution)}
    for src, dest in todo:
        if dest.name in known or dest.exists():
            continue
        im = Image.open(src).convert('RGB')
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS).save(dest, quality=92)
    c.add_pages(attribution, pages)
    return pages


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', type=Path)
    for k in ('source', 'style', 'licence', 'author', 'link'):
        ap.add_argument(f'--{k}', required=True)
    a = ap.parse_args()
    pages = register(a.folder, source=a.source, style=a.style, licence=a.licence, author=a.author, link=a.link)
    print(len(pages), 'pages registered from', a.folder)


if __name__ == '__main__':
    main()
