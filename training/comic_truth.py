"""True English text of Pepper&Carrot val/test pages, from the comic's own SVG sources (CC BY 4.0, David Revoy).

Run: python comic_truth.py
Writes data/comic/truth.json and src/lib/data/comic-truth-pepper.json = {file: [text, ...]}, used to score the
browser OCR (plan 3). One request a second.
"""
import json
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

import comic_common as c

RAW = 'https://framagit.org/peppercarrot/webcomics/-/raw/master/'
UA = {'User-Agent': 'AI-Model-Lab comic-translator dataset (github.com/phonesett10401/model-lab)'}
OUT = c.HERE.parent / 'src/lib/data/comic-truth-pepper.json'


def svg_url(link: str, file: str) -> str:
    """Page link (the episode's source folder) + our file name pepper_E01P03.jpg -> the English SVG."""
    folder = link.rstrip('/').rsplit('/', 1)[-1]
    tag = file.removeprefix('pepper_').removesuffix('.jpg')
    return f'{RAW}{folder}/lang/en/{tag}.svg'


def svg_text(svg: str) -> list[str]:
    """The text of each <text> element (its <tspan>s joined), skipping empty ones."""
    root = ET.fromstring(svg)
    out = []
    for el in root.iter():
        if el.tag.rsplit('}', 1)[-1] == 'text':
            t = re.sub(r'\s+', ' ', ' '.join(el.itertext())).strip()  # each tspan is a line: keep a space between lines
            if t:
                out.append(t)
    return out


def main() -> None:
    truth = {}
    for p in c.load_attribution():
        if p.source != 'Pepper&Carrot' or p.split not in ('val', 'test') or p.file in c.dropped():
            continue
        time.sleep(1)
        try:
            with urllib.request.urlopen(urllib.request.Request(svg_url(p.link, p.file), headers=UA), timeout=60) as r:
                truth[p.file] = svg_text(r.read().decode('utf8'))
        except urllib.error.HTTPError as e:
            print('no English SVG for', p.file, e.code)  # left out of the OCR score
    text = json.dumps(truth, indent=1, ensure_ascii=False) + '\n'
    (c.DATA / 'truth.json').write_text(text, encoding='utf8')
    OUT.write_text(text, encoding='utf8')
    print(len(truth), 'pages ->', OUT)


if __name__ == '__main__':
    main()
