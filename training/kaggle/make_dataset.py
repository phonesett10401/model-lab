"""Builds the folder for the private Kaggle dataset: our training code (code/) and every image the round 3 splits use
(data/, same layout as training/data), plus dataset-metadata.json marked private.

Run from training/: python kaggle/make_dataset.py <out folder> <kaggle username>
Then (the owner): kaggle datasets create -p <out folder> --dir-mode zip   (first time)
             or: kaggle datasets version -p <out folder> --dir-mode zip -m "<what changed>"
"""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent.parent
SPLITS = ['train', 'val', 'test', 'test97-bubbles']
CODE = ['comic_common.py', 'comic_train.py']


def files(ann_dir: Path) -> set[str]:
    """Image paths (relative to training/data) named in the split files and the per-style test files."""
    out = set()
    for f in [ann_dir / f'{s}.json' for s in SPLITS] + sorted(ann_dir.glob('test-*.json')):
        if f.exists():
            out |= {i['file_name'] for i in json.loads(f.read_text(encoding='utf8'))['images']}
    return out


def main() -> None:
    out, user = Path(sys.argv[1]), sys.argv[2]
    data = HERE / 'data'
    ann = data / 'comic3/annotations'
    (out / 'code/kaggle').mkdir(parents=True, exist_ok=True)
    for f in CODE:
        shutil.copy2(HERE / f, out / 'code' / f)
    shutil.copy2(HERE / 'kaggle/requirements.txt', out / 'code/kaggle/requirements.txt')
    shutil.copytree(ann, out / 'data/comic3/annotations', dirs_exist_ok=True)
    names = files(ann)
    for name in sorted(names):
        dest = out / 'data' / name
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(data / name, dest)
    (out / 'dataset-metadata.json').write_text(json.dumps({
        'title': 'comic finder round 3 (private)', 'id': f'{user}/comic-finder-round-3', 'licenses': [{'name': 'other'}],
        'isPrivate': True}, indent=2))
    print(len(names), 'images,', sum(p.stat().st_size for p in (out / 'data').rglob('*') if p.is_file()) // 2**20, 'MB ->', out)


if __name__ == '__main__':
    main()
