# Comic text detector: vendored detectors (plan 2, task 1)

Both are Apache-2.0 (checked each repo's `LICENSE`). Cloned into `training/vendor/` (git-ignored), pinned:

| Repo | Commit | Date |
|---|---|---|
| https://github.com/Peterande/D-FINE | `956d170` | 2026-08-19 |
| https://github.com/Megvii-BaseDetection/YOLOX | `6ddff48` | 2025-06-08 |

## Environment

Own conda env so the sea and sound pipelines keep their packages:

```
conda create -y --clone modellab-train -n comictrain
C:\Users\phone\miniconda3\envs\comictrain\python.exe -m pip install faster-coco-eval calflops tensorboard scipy loguru pycocotools onnx onnxsim tabulate thop ninja transformers
C:\Users\phone\miniconda3\envs\comictrain\python.exe -m pip install --no-build-isolation --no-deps -e training/vendor/YOLOX
```

PyTorch stays 2.11 + cu128 (RTX 5060).

## Trial runs (20 toy pages, 4 classes, input 1024)

- **D-FINE nano** (`configs/dfine/custom/dfine_hgnetv2_n_custom.yml` + our overrides: `num_classes: 4`, `eval_spatial_size: [1024, 1024]`, dataset paths, `num_workers: 0` on Windows). Train: `python train.py -c <cfg> --use-amp --seed=0` from the D-FINE folder. 2 epochs: box losses fell (bbox 0.93 → 0.91, giou 1.59 → 1.50). ONNX: 15 MB, outputs `labels, boxes, scores` already filtered (no NMS needed in the browser), inputs `images` (RGB 0–1) and `orig_target_sizes`.
- **YOLOX nano** (exp file: depth 0.33, width 0.25, depthwise, `num_classes = 4`, `input_size = test_size = (1024, 1024)`; data in `<dir>/annotations/{train,val}.json` + `<dir>/train2017`, `<dir>/val2017`). Train: `python tools/train.py -f <exp> -d 1 -b 4 --fp16` from the YOLOX folder. 10 epochs: total loss 60 → about 20. ONNX: 3.8 MB, output `[1, 21504, 4 + 1 + classes]` decoded boxes (the browser must run NMS), input BGR 0–255.

## Export: use our own script, not the repos'

- D-FINE's `tools/deployment/export_onnx.py` traces with a fixed 640 px input, so a 1024 model fails.
- YOLOX's `tools/export_onnx.py` calls `torch.onnx._export`, which PyTorch 2.11 removed.
- Both export fine with plain `torch.onnx.export(..., opset_version=17, dynamo=False)` at 1024 (D-FINE: wrap `cfg.model.deploy()` + `cfg.postprocessor.deploy()`; YOLOX: `model.head.decode_in_inference = True`). This becomes `training/comic_export.py` in task 7.

Both candidates can train and export with 4 classes, so both go on to round 1 (task 5).
