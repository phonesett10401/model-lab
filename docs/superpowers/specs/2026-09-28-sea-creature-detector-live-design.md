# Sea creature detector: live on the site (design)

Date: 2026-09-28. Owner-approved design; this spec records it for the implementation plan.

## Goal

Put the trained v2 detector (YOLO26 Nano, 14 creatures) on the site as the first real, measured model. It replaces the planned "Creature categorizer" entry, runs entirely in the visitor's browser, and shows a report card built only from measured numbers.

## Decisions (owner)

- **Name:** "Sea creature detector". **Address:** `/models/sea-creature-detector`, with a permanent redirect from `/models/creature-categorizer` (`vercel.json` `redirects`). Entry number stays 1.
- **Classes kept separate**, including seal and sea lion; the confusion is shown as a known weakness.
- **Repo is public** (required by the model's AGPL-3.0 licence). Draft and audit sources may stay in the repo; the production build still leaves them out.
- The intro video keeps its old on-screen name for now (re-rendering is out of scope).

## The model file (measured)

- `training/runs/sea-v2-yolo26n/weights/best.onnx`, 9.8 MB, opset 18, 15 standard operators.
- Input `images`: float32 `[1, 3, 640, 640]`, RGB, values 0–1.
- Output `output0`: float32 `[1, 18, 8400]`: for each of 8,400 candidates, box centre x, centre y, width, height (in 640-pixel input space), then 14 class scores (already sigmoid). **No NMS inside** (`end2end: False`).
- Class order: fish, jellyfish, penguin, puffin, shark, starfish, stingray, dolphin, whale, sea turtle, seahorse, sea lion, seal, crab.
- Verified: gives the same answers as the PyTorch model on all 767 test photos when both use a square 640 input.

## Architecture

1. **Types** (`src/lib/types.ts`): `ModelEntry` gains `task?: 'classify' | 'detect'` (default classify). `Prediction` gains optional `box?: [x0, y0, x1, y1]` as fractions of the original photo. `Sample` gains optional `credit?: string`. Existing entries are unaffected.
2. **Detector maths** (`src/lib/runtime/yolo.ts`, pure functions, unit-tested):
   - `letterbox(w, h, size=640)` → scale and padding, matching Ultralytics (`LetterBox`, centred, grey 114 padding).
   - `decode(output, meta, conf)` → candidates above `conf`, boxes mapped back to the original photo.
   - `nms(boxes, iou=0.7)` → per-class non-maximum suppression, matching Ultralytics defaults.
3. **Runtime** (`src/lib/runtime/sea-detector.ts`): registered in `registry` under the entry's slug. Lazily imports `onnxruntime-web` (WebAssembly backend, engine files self-hosted from the site's own assets, no third-party requests). `load()` streams the model with real byte progress; `classify()` letterboxes the photo on a canvas, runs the session, decodes, applies NMS, and returns predictions with boxes. Main thread (≈ well under a second per photo); a Web Worker is deferred until it is measurably needed.
4. **Model asset:** `static/models/sea-creature-detector-v2.onnx` (committed; 9.8 MB is far below GitHub's 100 MB file limit). The home page never requests it.
5. **Workbench UI:** for `task: 'detect'`, the result shows the photo with drawn boxes and labels (SVG over the image) and a text list ("3 fish, 1 shark" plus each score), which is also the accessible description. Display threshold **45%**, stated on the page. With nothing above it: "No sea creatures found", listing the 14 it knows. Classifier entries keep prediction bars.
6. **Report card** (all values measured on the frozen test set, square 640 input):
   - Data: sources (Aquarium Combined v6, Roboflow, CC BY 4.0; Open Images V7, CC BY 2.0), 7,637 photos, split 5,312 / 1,558 / 767, base model YOLO26 Nano (Ultralytics, AGPL-3.0), known gaps (no octopus, manta or orca; seal vs sea lion; small wild fish).
   - Metrics: "Detection score per creature (mAP@50)" with the 14 per-class values from the full test set.
   - How it fails: 3–4 real test photos with a real confusion or miss, each with "Try this one".
   - Samples: 3–4 test photos. Aquarium photos credited to Roboflow (CC BY 4.0); Open Images photos credited to their Flickr author (CC BY 2.0). Only test-split photos are used.
   - Sample `expected` values are recorded from the ONNX model with the same pipeline, not typed by hand.

## Honesty rules (unchanged, applied)

No number without measurement; the threshold, test-set size and sources are stated; failure examples are real model outputs.

## Testing

- Unit: `letterbox`, `decode`, `nms` (known inputs → known outputs).
- Parity: a script runs the site's decode + NMS maths on the real ONNX output for several test photos and compares with Ultralytics' own predictions (same boxes and classes within a small tolerance).
- E2E (Chromium): the model page loads the model, a sample runs, boxes and the text list appear, and the report card shows measured values; the old address redirects; `/` never requests the model or the engine files; axe passes on the model page.
- Existing unit, e2e and a11y suites stay green; the production build still contains no draft or audit content strings.

## Out of scope

Web Worker, fp16/int8 shrinking, WebGPU backend, re-rendering the intro video, the text/audio/table models.
