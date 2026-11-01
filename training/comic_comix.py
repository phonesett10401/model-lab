"""Comix v0.1 (Hugging Face emanuelevivoli/comix-v0_1-pages-tiny): 1940s-50s American comic pages from the Digital
Comic Museum, CC0. Their labels are machine-made, so pages get our own (comic_autolabel.py comix).

Run: python comic_comix.py incoming/comic3/comix-tiny [--per-book 12]
Story pages (not covers or ads) are copied to incoming/comic/comix/<book>/ and registered, one group per book.
"""
import argparse
import json
import tarfile
from pathlib import Path

import comic_common as c
from comic_incoming import register

INCOMING = c.HERE / 'incoming/comic/comix'
LINK = 'https://huggingface.co/datasets/emanuelevivoli/comix-v0_1-pages-tiny'


def story_pages(tar_path: Path, per_book: int) -> dict[str, list[tuple[str, bytes]]]:
    """book id -> [(page id, jpg bytes)], story pages only, at most per_book a book (evenly spread). Reads members by
    name only: nothing in the tar is extracted to disk as it is."""
    meta, jpgs = {}, {}
    with tarfile.open(tar_path) as t:
        for m in t:
            if not m.isfile():
                continue
            stem, _, ext = Path(m.name).name.partition('.')
            if ext == 'json':
                meta[stem] = json.load(t.extractfile(m))
            elif ext == 'jpg':
                jpgs[stem] = t.extractfile(m).read()
    books: dict[str, list[tuple[int, str]]] = {}
    for stem, j in meta.items():
        if j.get('page_class') == 'Story' and stem in jpgs:
            books.setdefault(j['book_id'], []).append((j.get('page_number', 0), stem))
    out = {}
    for book, pages in books.items():
        pages.sort()
        step = max(1, len(pages) / per_book)
        out[book] = [(stem, jpgs[stem]) for _, stem in (pages[int(i * step)] for i in range(min(per_book, len(pages))))]
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', type=Path)
    ap.add_argument('--per-book', type=int, default=12)
    a = ap.parse_args()
    for tar in sorted(a.folder.glob('*.tar')):
        for book, pages in story_pages(tar, a.per_book).items():
            (INCOMING / book).mkdir(parents=True, exist_ok=True)
            for stem, data in pages:
                (INCOMING / book / f'{stem}.jpg').write_bytes(data)
        print(tar.name, 'done', flush=True)
    pages = register(INCOMING, source='Comix v0.1 (Digital Comic Museum)', style='old-american', licence='CC0',
                     author='Digital Comic Museum contributors (Comix v0.1, E. Vivoli et al.)', link=LINK)
    print(len(pages), 'pages registered')


if __name__ == '__main__':
    main()
