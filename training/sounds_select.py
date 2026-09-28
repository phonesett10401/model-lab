"""Pick FSD50K clips for the Sound detective: our 17 sounds plus "nothing I know" negatives.

Rules: licence CC0 or CC BY only; a clip counts as every sound it's labelled with (several at once is fine);
negatives are clips with none of our sounds AND none of the broad labels that could hide one (AMBIGUOUS);
FSD50K's own split is kept (dev train/val -> train/val, eval -> test), so test clips never reach training.
Train clips per sound are capped so a common sound (speech) can't drown the rest.

Usage: python sounds_select.py   (writes data/sounds-v1/selection.csv)
"""
import csv
import json
import random

from huggingface_hub import hf_hub_download

from sounds_common import CLASSES, DATA, SOUNDS, fsd_ok

REPO = 'Fhrozen/FSD50k'
MAX_PER_SOUND = 1000
NEG_TRAIN, NEG_VAL, NEG_TEST = 3000, 300, 2000
# Parent labels that may contain one of our sounds without naming it: such clips are never negatives.
AMBIGUOUS = {'Human_voice', 'Human_group_actions', 'Typing', 'Dog', 'Cat', 'Domestic_animals_and_pets', 'Glass',
             'Door', 'Car', 'Motor_vehicle_(road)', 'Vehicle', 'Engine', 'Thunderstorm', 'Water', 'Crowd', 'Chatter',
             'Conversation', 'Alarm', 'Domestic_sounds_and_home_sounds', 'Hands', 'Tap', 'Liquid'}
FIELDS = ['fname', 'split', 'source', 'sounds', 'licence', 'uploader', 'url', 'fsd_split']


def sounds_of(labels):
    return [c for c in CLASSES if labels & set(SOUNDS[c])]


def select(dev_rows, eval_rows, dev_info, eval_info, seed=0):
    rng = random.Random(seed)
    pos, neg = [], {'train': [], 'val': [], 'test': []}
    for rows, meta, fsd in ((dev_rows, dev_info, 'dev'), (eval_rows, eval_info, 'eval')):
        for r in rows:
            m = meta[r['fname']]
            if not fsd_ok(m['license']):
                continue
            labels = set(r['labels'].split(','))
            split = r['split'] if fsd == 'dev' else 'test'
            rec = {'fname': r['fname'], 'split': split, 'source': 'fsd50k', 'licence': m['license'],
                   'uploader': m['uploader'], 'url': f"https://freesound.org/s/{r['fname']}/", 'fsd_split': fsd}
            found = sounds_of(labels)
            if found:
                pos.append({**rec, 'sounds': '|'.join(found)})
            elif not labels & AMBIGUOUS:
                neg[split].append({**rec, 'sounds': ''})
    # Cap train clips per sound: shuffle once, then keep a clip while every sound on it is under the cap.
    rng.shuffle(pos)
    kept, per = [], {c: 0 for c in CLASSES}
    for r in pos:
        s = r['sounds'].split('|')
        if r['split'] == 'train' and any(per[c] >= MAX_PER_SOUND for c in s):
            continue
        if r['split'] == 'train':
            for c in s:
                per[c] += 1
        kept.append(r)
    for split, cap in (('train', NEG_TRAIN), ('val', NEG_VAL), ('test', NEG_TEST)):
        rng.shuffle(neg[split])
        kept += neg[split][:cap]
    return sorted(kept, key=lambda r: (r['split'], int(r['fname'])))


def load():
    get = lambda p: hf_hub_download(REPO, p, repo_type='dataset')
    rows = lambda p: list(csv.DictReader(open(get(p), encoding='utf8')))
    info = lambda p: json.load(open(get(p), encoding='utf8'))
    return (rows('labels/dev.csv'), rows('labels/eval.csv'),
            info('metadata/dev_clips_info_FSD50K.json'), info('metadata/eval_clips_info_FSD50K.json'))


if __name__ == '__main__':
    picked = select(*load())
    DATA.mkdir(parents=True, exist_ok=True)
    with open(DATA / 'selection.csv', 'w', newline='', encoding='utf8') as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        w.writerows(picked)
    for split in ('train', 'val', 'test'):
        n = {c: sum(1 for r in picked if r['split'] == split and c in r['sounds'].split('|')) for c in CLASSES}
        print(split, n, 'negatives', sum(1 for r in picked if r['split'] == split and not r['sounds']))
