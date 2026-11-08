"""Round 3 training: larger D-FINE sizes, the Kaggle notebook's pins, and resuming a stopped run.
Run: python test_comic_train.py [--slow]   (--slow trains a tiny run on the GPU, stops it after one epoch and resumes it)"""
import hashlib
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import comic_common as c
from comic_train import dfine_config, train_command

HERE = Path(__file__).parent

# the config uses the requested size, round 3's four classes and the comic3 splits (file names relative to the data root)
cfg = dfine_config('r3-test', 40, size='l', data='comic3', data_root=Path('/kaggle/input/comic3/data'), runs=Path('/kaggle/working/runs'),
                   vendor=Path('/kaggle/working/D-FINE'))
assert 'configs/dfine/custom/dfine_hgnetv2_l_custom.yml' in cfg and f'num_classes: {len(c.CLASSES)}' in cfg, cfg
assert 'ann_file: /kaggle/input/comic3/data/comic3/annotations/train.json' in cfg and 'img_folder: /kaggle/input/comic3/data\n' in cfg, cfg
assert 'output_dir: /kaggle/working/runs/r3-test' in cfg and 'epochs: 40' in cfg
# round 2's nano config is unchanged
old = dfine_config('r2', 80)
assert 'dfine_hgnetv2_n_custom.yml' in old and f'num_classes: {len(c.CLASSES_V2)}' in old

# resume continues from last.pth with the same config
cmd, cwd = train_command('dfine', 'r3-test', resume=True, runs=Path('/runs'), vendor=Path('/v'))
assert cmd[-2:] == ['-r', str(Path('/runs/r3-test/last.pth'))] and cwd == str(Path('/v')), cmd

# a run stopped on Kaggle resumes on the laptop: same settings, this machine's folders
from comic_train import resume_config
with tempfile.TemporaryDirectory() as d:
    run = Path(d) / 'r3'
    run.mkdir()
    (run / 'config.yml').write_text(cfg)
    (run / 'settings.json').write_text('{"run": "r3-test", "epochs": 40, "size": "l", "data": "comic3"}')
    local = resume_config(run, data_root=Path('C:/data'), runs=Path(d), vendor=Path('C:/vendor/D-FINE'))
    assert local == dfine_config('r3-test', 40, size='l', data='comic3', data_root=Path('C:/data'), runs=Path(d), vendor=Path('C:/vendor/D-FINE'))
    assert 'kaggle' not in local and 'epochs: 40' in local and 'dfine_hgnetv2_l_custom.yml' in local

# the requirements pin the D-FINE commit and the torch version
req = (HERE / 'kaggle/requirements.txt').read_text(encoding='utf8')
notebook = (HERE / 'kaggle/comic_train_notebook.py').read_text(encoding='utf8')
assert 'torch==' in req and 'torchvision==' in req, req
assert '956d170' in notebook and 'requirements.txt' in notebook and '--resume' in notebook

if '--slow' in sys.argv:
    # A 10-epoch toy run, stopped once epoch 1's last.pth exists, then resumed: it carries on from epoch 2, same config.
    # (D-FINE writes last.pth only before its last 8 epochs, the no-augmentation stage, so the toy run needs 10.)
    import json
    import random

    import torch
    from PIL import Image

    from comic_synth import make_page
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / 'data/comic3/annotations').mkdir(parents=True)
        (d / 'data/toy').mkdir()
        items = []
        for i in range(4):
            page, labels = make_page(Image.new('RGB', (640, 480), (90, 110, 130)), random.Random(i), [])
            page.save(d / f'data/toy/p{i}.jpg')
            items.append((f'toy/p{i}.jpg', 640, 480, labels))
        for s in ('train', 'val'):
            c.write_coco(d / f'data/comic3/annotations/{s}.json', items)
        run = d / 'runs/toy'
        run.mkdir(parents=True)
        (run / 'config.yml').write_text(dfine_config('toy', 10, size='n', data='comic3', data_root=d / 'data', runs=d / 'runs', batch=2, workers=0))
        before = hashlib.sha256((run / 'config.yml').read_bytes()).hexdigest()
        cmd, cwd = train_command('dfine', 'toy', runs=d / 'runs')
        p = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        while not (run / 'last.pth').exists() and p.poll() is None:
            time.sleep(1)
        time.sleep(3)  # let the save finish
        p.kill()
        p.wait()
        assert torch.load(run / 'last.pth', map_location='cpu', weights_only=False)['last_epoch'] == 0
        cmd, cwd = train_command('dfine', 'toy', resume=True, runs=d / 'runs')
        out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        assert out.returncode == 0, out.stdout[-2000:] + out.stderr[-2000:]
        got = torch.load(run / 'last.pth', map_location='cpu', weights_only=False)['last_epoch']
        assert got == 1, (got, out.stdout[-3000:])
        assert 'Epoch: [0/10]' not in out.stdout and 'Epoch: [1/10]' in out.stdout, out.stdout[-2000:]
        assert hashlib.sha256((run / 'config.yml').read_bytes()).hexdigest() == before
print('comic train checks passed')
