"""Flag Open Images photos where a crab, lobster, starfish or seahorse isn't a live animal (cooked food,
a dried souvenir, a market stall). Uses an open CLIP model on the GPU as a zero-shot judge.

Writes meta/not_alive.json (ids to drop, with the judge's score) and a contact sheet of dropped and kept
examples to meta/foodfilter_sheet.jpg, so a person can check the judge before trusting it.
"""
import json
from pathlib import Path

import open_clip
import torch
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent / 'data' / 'openimages'
CHECK = {'crab', 'lobster', 'starfish', 'seahorse'}
ALIVE = ['a photo of a live {} in the sea', 'a photo of a live {} in an aquarium', 'a photo of a live {} on a beach']
NOT_ALIVE = ['a photo of cooked {} on a plate', 'a photo of {} as food at a restaurant', 'a photo of {} for sale at a fish market',
             'a photo of a dried {} souvenir', 'a photo of a {} toy']
THRESHOLD = 0.5  # drop when the "not alive" prompts together get more than half the probability


def sheet(items, title, path, n=24):
    thumbs = []
    for iid, p in items[:n]:
        im = Image.open(ROOT / 'images' / f'{iid}.jpg').convert('RGB')
        im.thumbnail((200, 200))
        canvas = Image.new('RGB', (200, 216), 'white')
        canvas.paste(im, (0, 0))
        ImageDraw.Draw(canvas).text((4, 202), f'not alive {p:.0%}', fill='black')
        thumbs.append(canvas)
    grid = Image.new('RGB', (200 * 6, 216 * ((len(thumbs) + 5) // 6) + 24), 'white')
    ImageDraw.Draw(grid).text((6, 6), title, fill='black')
    for i, t in enumerate(thumbs):
        grid.paste(t, (200 * (i % 6), 24 + 216 * (i // 6)))
    grid.save(path, quality=85)


if __name__ == '__main__':
    selected = json.loads((ROOT / 'meta' / 'selected.json').read_text(encoding='utf8'))
    todo = {iid: sorted({b['cls'] for b in v['boxes']} & CHECK) for iid, v in selected.items()
            if {b['cls'] for b in v['boxes']} & CHECK and (ROOT / 'images' / f'{iid}.jpg').exists()}
    model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k', device='cuda')
    tok = open_clip.get_tokenizer('ViT-B-32')
    scores = {}
    with torch.no_grad():
        text_cache = {}
        for iid, classes in todo.items():
            img = model.encode_image(preprocess(Image.open(ROOT / 'images' / f'{iid}.jpg').convert('RGB')).unsqueeze(0).cuda())
            img = img / img.norm(dim=-1, keepdim=True)
            worst = 0.0
            for c in classes:  # a photo is "not alive" if any of its checked creatures looks like food or a souvenir
                if c not in text_cache:
                    t = model.encode_text(tok([p.format(c) for p in ALIVE + NOT_ALIVE]).cuda())
                    text_cache[c] = t / t.norm(dim=-1, keepdim=True)
                probs = (100 * img @ text_cache[c].T).softmax(dim=-1)[0]
                worst = max(worst, float(probs[len(ALIVE):].sum()))
            scores[iid] = worst
    drop = {i: round(p, 3) for i, p in scores.items() if p > THRESHOLD}
    (ROOT / 'meta' / 'not_alive.json').write_text(json.dumps(drop, indent=1), encoding='utf8')
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    sheet([kv for kv in ranked if kv[1] > THRESHOLD][::max(1, len(drop) // 24)], f'DROPPED ({len(drop)} of {len(scores)}), evenly sampled', ROOT / 'meta' / 'foodfilter_dropped.jpg')
    sheet([kv for kv in ranked if kv[1] <= THRESHOLD][:24], 'KEPT, the 24 closest to the line', ROOT / 'meta' / 'foodfilter_borderline_kept.jpg')
    print(f'checked {len(scores)} photos, dropping {len(drop)}')
