"""Shared settings for the Sound detective pipeline (model No. 4)."""
import math
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / 'data' / 'sounds-v1'
RUNS = HERE / 'runs'
VENDOR = HERE / 'vendor' / 'EfficientAT'
SR = 32000
WIN = SR          # 1 s slices
STEP = SR // 2    # a slice every 0.5 s
MAX_SECONDS = 30

# Our sound -> the FSD50K labels (AudioSet ontology) that count as it. Order = the model's output order.
SOUNDS = {
    'dog bark': ['Bark'],
    'cat meow': ['Meow'],
    'doorbell': ['Doorbell'],
    'knocking': ['Knock'],
    'running tap': ['Water_tap_and_faucet'],
    'keyboard typing': ['Computer_keyboard'],
    'glass breaking': ['Shatter'],
    'siren': ['Siren'],
    'car horn': ['Vehicle_horn_and_car_horn_and_honking'],
    'engine / traffic': ['Traffic_noise_and_roadway_noise', 'Car_passing_by', 'Idling', 'Engine_starting',
                         'Accelerating_and_revving_and_vroom'],
    'rain': ['Rain', 'Raindrop'],
    'thunder': ['Thunder'],
    'clapping': ['Clapping', 'Applause'],
    'crying': ['Crying_and_sobbing'],
    'laughing': ['Laughter'],
    'footsteps': ['Walk_and_footsteps'],
    'speech': ['Speech'],
}
CLASSES = list(SOUNDS)
OK_FSD_LICENCES = {'http://creativecommons.org/licenses/by/3.0/', 'http://creativecommons.org/publicdomain/zero/1.0/'}


def fsd_ok(url):
    return url in OK_FSD_LICENCES


def topup_ok(url):
    """Freesound licence URLs vary in scheme and version; allow CC0 and plain CC BY only."""
    return '/publicdomain/zero/' in url or '/licenses/by/' in url


def window_starts(n):
    """Start sample of every 1 s slice for a clip of n samples (same rule as src/lib/runtime/audio.ts)."""
    count = 1 if n <= WIN else math.ceil((n - WIN) / STEP) + 1
    return [i * STEP for i in range(count)]


def efficientat():
    """EfficientAT's MobileNet factory (vendored at training/vendor/EfficientAT, MIT licence)."""
    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))
    here = os.getcwd()
    os.chdir(VENDOR)  # its helpers read metadata/*.csv relative to the working directory at import time
    try:
        from models.mn.model import get_model
    finally:
        os.chdir(here)
    return get_model
