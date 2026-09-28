"""Train a YOLO26 Nano detector on a prepared dataset. Usage: python train.py <data.yaml> <run-name>

Augmentation (training images only; Ultralytics never augments val/test): horizontal flip,
rotation up to ±15°, brightness/hue/saturation shifts, plus its default mosaic.
Early stopping picks the best epoch on the validation split; the test split is never touched here.
"""
import sys
from pathlib import Path

from ultralytics import YOLO

if __name__ == '__main__':  # required on Windows, where data-loader workers re-import this file
    data, name = sys.argv[1], sys.argv[2]
    YOLO('yolo26n.pt').train(
        data=data, imgsz=640, epochs=150, patience=40, batch=16, workers=4, seed=0, deterministic=True,
        fliplr=0.5, degrees=15, hsv_h=0.02, hsv_s=0.5, hsv_v=0.2,
        project=str(Path(__file__).parent / 'runs'), name=name, exist_ok=True,
    )
