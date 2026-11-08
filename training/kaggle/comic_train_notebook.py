# The Kaggle notebook for round 3 of the comic text finder: paste this into one code cell (see README.md).
# Settings: Accelerator "GPU T4 x2" (not P100: these torch builds don't run on it), Internet on, Persistence "Files only".
# Input: the private dataset made with `kaggle datasets create` (code/ and data/ inside). To resume, also add the
# previous run's output as an input and set RESUME_FROM to its folder.
import os
import shutil
import subprocess
import sys
from pathlib import Path

SIZE = 'l'            # D-FINE size: m, l or x
EPOCHS = 40
RUN = f'r3-dfine-{SIZE}'
RESUME_FROM = ''      # e.g. '/kaggle/input/comic-r3-run/r3-dfine-l' (a folder holding last.pth and config.yml)

# Kaggle mounts inputs at /kaggle/input/<slug> or, on newer images, deeper (/kaggle/input/datasets/<owner>/<slug>).
found = sorted(Path('/kaggle/input').glob('**/code/comic_train.py'))
if not found:
    sys.exit('dataset not found under /kaggle/input: ' + ', '.join(str(p) for p in Path('/kaggle/input').glob('*/*')))
DATASET = found[0].parent.parent
WORK = Path('/kaggle/working')
VENDOR = WORK / 'D-FINE'
RUNS = WORK / 'runs'


def sh(*cmd, cwd=None):
    print('$', ' '.join(map(str, cmd)), flush=True)
    subprocess.run(list(map(str, cmd)), cwd=cwd, check=True)


sh(sys.executable, '-m', 'pip', 'install', '-q', '-r', DATASET / 'code/kaggle/requirements.txt')
if not VENDOR.exists():
    sh('git', 'clone', '-q', 'https://github.com/Peterande/D-FINE', VENDOR)
    sh('git', 'checkout', '-q', '956d170', cwd=VENDOR)  # the commit pinned in training/comic_vendor.md

args = [sys.executable, DATASET / 'code/comic_train.py', 'dfine', RUN, '--data', 'comic3', '--size', SIZE,
        '--epochs', EPOCHS, '--data-root', DATASET / 'data', '--runs', RUNS, '--vendor', VENDOR]
if RESUME_FROM:
    # Same config as the stopped run (its paths point at this notebook's folders, which are the same on every run).
    shutil.copytree(RESUME_FROM, RUNS / RUN, dirs_exist_ok=True)
    args.append('--resume')
os.environ['PYTHONPATH'] = str(DATASET / 'code')
sh(*args, cwd=DATASET / 'code')
