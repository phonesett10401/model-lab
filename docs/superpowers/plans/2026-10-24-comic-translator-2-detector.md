# Comic translator, plan 2 of 3: data, labels and the text detector

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trained, measured text-region detector (classes `bubble`, `caption`, `sfx`, `art-text`) exported to ONNX for the browser, built only from openly licensed or synthetic comic pages, with every page's source and licence logged and a frozen test set.

**Architecture:** Local Python pipeline in `training/` (same style as the sea and sound pipelines: one script per step, plain `assert` test scripts). Labels are COCO JSON, tool-neutral. The first labels come for free (Pepper&Carrot's text-vs-art-only pages, and synthetic pages); a first model then drafts boxes for the other sources, and the owner corrects them in Label Studio. Two Apache-2.0 detectors (D-FINE, YOLOX) are trained on the same data; the better one on validation pages is exported.

**Tech Stack:** Python 3.12 conda env `modellab-train` (PyTorch cu128, RTX 5060), Pillow, NumPy, pycocotools (BSD), onnxruntime; vendored D-FINE and YOLOX (Apache-2.0, pinned commits, git-ignored like EfficientAT); Label Studio (Apache-2.0) in its own conda env `comiclabel`.

**Spec:** `docs/superpowers/specs/2026-10-24-comic-translator-design.md` (sections Data, Report card, Decisions).

**Plan 3 (not here):** the detector + OCR in `/comic-translator`, tiling for tall pages, finished examples, OCR and "every English text replaced" scores, home link.

## Global Constraints

- Only sources whose licence allows **commercial use and changes**: CC BY 4.0, CC0 / public domain, KOGL Type 1, Black Jack ni Yoroshiku's free reuse. **No NC, no academic-only, no CC BY-SA** (owner hasn't opted in). Check each source's licence page **before** downloading.
- Every page is logged in `training/attribution/comic-v1.csv` with columns `file,source,group,style,split,author,licence,link,date`.
- Never Ultralytics or any AGPL code in this model's training or export.
- No MandaX artist pages in plan 2 (they need written opt-in, not collected yet).
- Drafting and labelling run locally (our own detector, docTR OCR). Openly licensed training/test pages may be reviewed by Claude (owner-approved, 2026-10-24); **MandaX artists' pages never are**, and no comic image goes to any other online service.
- The **test split is frozen**: once a page is in `test`, it never moves, and test pages are never used for training or for choosing between models (validation does that).
- Numbers on the site come only from `comic_evaluate.py` output; never typed. A style with fewer than 10 test pages reports `null` ("not yet measured").
- Datasets, runs, weights and vendored repos stay local (git-ignored). Commit only scripts, tests, the attribution CSV and the final small JSON of numbers.
- No Claude attribution in commits. Don't push to master; ask before any push.
- Logins (Manga on Web, Digital Comic Museum) are done **by the owner**; the scripts read the files they saved.

## Review Focus

1. **Pages from one episode or book landing in both train and test** (near-duplicate panels inflate scores): splits are decided per `group` (episode/chapter/book), never per page. Test in Task 2 (`one group, one split`).
2. **A non-commercial or share-alike source sneaking in** through a new source script: the attribution loader refuses any licence outside the allow-list. Test in Task 2 (`refuses NC and SA licences`).
3. **Comparing text pages with art-only pages picks up tiny art differences** (JPEG noise, a redrawn line) as fake bubbles: boxes smaller than a minimum area or with low difference density are dropped. Test in Task 3 (`ignores compression noise`).
4. **Adding a new source later reshuffles the existing test set**: split assignment is a pure function of `group`, written once to the CSV and checked to be unchanged on re-run. Test in Task 2 (`existing splits never move`).
5. **A trained model that scores well on validation but was never checked after ONNX export** (export bugs drop boxes): the export step compares ONNX and PyTorch boxes on validation pages. Test in Task 7 (`onnx matches torch`).

---

### Task 1: Detector trial runs (D-FINE and YOLOX)

**Files:**
- Create: `training/comic_vendor.md` (pinned commits, setup commands, findings), `training/.gitignore` additions (`vendor/D-FINE/`, `vendor/YOLOX/`, `data/comic/`, `runs/comic/`)

**Interfaces:**
- Produces: for each candidate, a working command to train on a COCO dataset with 4 classes at input 1024, and a working command to export ONNX that runs in `onnxruntime` (Python) with 4 classes. Recorded in `comic_vendor.md`.

- [ ] **Step 1:** Clone D-FINE (`github.com/Peterande/D-FINE`) and YOLOX (`github.com/Megvii-BaseDetection/YOLOX`) into `training/vendor/`, confirm each repo's `LICENSE` file is Apache-2.0, and record the commit hashes in `comic_vendor.md`.
- [ ] **Step 2:** Make a 20-image toy COCO set (4 classes, white pages with drawn rectangles of 4 colours, made by a throwaway script in the scratchpad) and train each candidate's smallest model for 2 epochs at input 1024 on the GPU.
  Expected: both finish without errors; loss goes down.
- [ ] **Step 3:** Export both to ONNX with 4 classes (D-FINE: `tools/deployment/export_onnx.py`; if it refuses a non-COCO class count, use the route the D-FINE docs give for custom classes and record it). Load each in `onnxruntime` and run one toy image.
  Expected: boxes come out with class ids 0–3.
- [ ] **Step 4:** If a candidate cannot train or export with custom classes, drop it and record why. If both fail, **stop and report to the owner** (the spec's licence choice needs revisiting).
- [ ] **Step 5:** Commit `comic_vendor.md` and the `.gitignore` lines: `chore(comic): detector trial runs, pinned vendors`.

### Task 2: Attribution, licences and frozen splits

**Files:**
- Create: `training/comic_common.py`, `training/attribution/comic-v1.csv` (header only)
- Test: `training/test_comic_common.py`

**Interfaces:**
- Produces (`comic_common.py`):
  - `CLASSES = ['bubble', 'caption', 'sfx', 'art-text']`
  - `STYLES = ['manga', 'modern-western', 'old-pd']`
  - `ALLOWED_LICENCES = {'CC BY 4.0', 'CC0', 'Public domain', 'KOGL Type 1', 'Black Jack free reuse'}`
  - `@dataclass Page(file: str, source: str, group: str, style: str, split: str, author: str, licence: str, link: str, date: str)`
  - `split_for(group: str) -> str`: `'test'` / `'val'` / `'train'` from a SHA-256 of `group` (15% / 15% / 70%).
  - `load_attribution(path) -> list[Page]` (raises `ValueError` on a licence outside the allow-list, an unknown style, or a missing field)
  - `add_pages(path, pages: list[Page]) -> None` (appends; keeps any existing row's split; refuses a page whose group already has a different split)
  - `DATA = Path('training/data/comic')`, `RUNS = Path('training/runs/comic')`

- [ ] **Step 1: Write failing tests** in `test_comic_common.py`:
  - `one group, one split`: 200 pages in 20 groups → every group's pages share one split; all three splits appear.
  - `split is stable`: `split_for('pepper-ep12')` returns the same value across two calls and two processes (compare with a hard-coded expected value computed once and pasted in the test).
  - `refuses NC and SA licences`: a row with `CC BY-NC 4.0` or `CC BY-SA 4.0` → `ValueError`.
  - `existing splits never move`: write rows, then `add_pages` with new pages in new groups → old rows unchanged byte-for-byte.
- [ ] **Step 2:** Run `C:\Users\phone\miniconda3\envs\modellab-train\python.exe training/test_comic_common.py`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `comic_common.py`.
- [ ] **Step 4:** Run. Expected: `comic common checks passed`.
- [ ] **Step 5:** Commit `feat(comic-train): attribution, licence allow-list, frozen group splits`.

### Task 3: Pepper&Carrot pages and free labels

**Files:**
- Create: `training/comic_pepper.py`, `training/comic_diff.py`
- Test: `training/test_comic_diff.py`

**Interfaces:**
- Consumes: `Page`, `add_pages`, `split_for`, `DATA`.
- Produces:
  - `comic_diff.text_boxes(text_page: Image, art_page: Image, min_area_frac=0.0008, min_density=0.15) -> list[tuple[int,int,int,int]]` (x, y, w, h of regions where the pages differ, after merging nearby blobs)
  - `comic_pepper.py` CLI: downloads English hi-res pages and their `gfx-only` art pages for every episode from `https://www.peppercarrot.com/0_sources/` (path pattern `<episode>/hi-res/en_Pepper-and-Carrot_by-David-Revoy_E<NN>P<PP>.<ext>` and `<episode>/hi-res/gfx-only/…`; verify on the first episode and adjust), resizes to 1600 px wide, saves to `DATA/images/`, writes `DATA/pepper_draft.json` (COCO, every box class `bubble`), and logs each page: source `Pepper&Carrot`, group `pepper-ep<NN>`, style `modern-western`, author `David Revoy`, licence `CC BY 4.0`, link to the episode page, today's date. 1 request per second.

- [ ] **Step 1: Write failing tests** in `test_comic_diff.py` (synthetic pairs made in the test with Pillow):
  - `finds a bubble`: art page = gradient image; text page = same + white ellipse with black text at (300,200,400,180) → one box with IoU ≥ 0.9.
  - `ignores compression noise`: text page = art page saved and reloaded as JPEG quality 70 → zero boxes.
  - `keeps two bubbles apart`: two ellipses 120 px apart → two boxes.
- [ ] **Step 2:** Run `…python.exe training/test_comic_diff.py`. Expected: FAIL.
- [ ] **Step 3:** Implement `text_boxes`: absolute difference → grey → threshold 40 → morphological close (radius 6 px at 1600 px wide) → connected components → drop small (`min_area_frac` of page area) or sparse (`min_density`) regions.
- [ ] **Step 4:** Run. Expected: `comic diff checks passed`.
- [ ] **Step 5:** Run `comic_pepper.py` on episode 1 only (`--episodes 1`). Expected: images saved, CSV rows added, draft JSON boxes drawn on a preview PNG in the scratchpad look right (check by eye). Then run all episodes.
- [ ] **Step 6:** Commit scripts, test and CSV: `feat(comic-train): Pepper&Carrot pages with free bubble labels`.

### Task 4: Synthetic pages

**Files:**
- Create: `training/comic_synth.py`
- Test: `training/test_comic_synth.py`

**Interfaces:**
- Consumes: `CLASSES`, `Page`, `add_pages`, `DATA`; art-only pages from Task 3.
- Produces: `make_page(art: Image, rng: random.Random, fonts: list[Path]) -> tuple[Image, list[dict]]` (each dict `{'bbox': [x,y,w,h], 'category': 'bubble'|'caption'|'sfx'|'art-text', 'text': str}`); CLI writes N pages to `DATA/images/synth_*.png` and `DATA/synth.json` (COCO, with `text` kept as an extra field for plan 3's OCR score). Group = `synth-<art page group>` so synthetic pages share the split of their art page. Style `modern-western`, licence `CC BY 4.0` (inherits the art), author `David Revoy (art); synthetic lettering`.
- Fonts: OFL comic fonts (Comic Neue, Bangers, Patrick Hand) downloaded from Google Fonts into `training/vendor/fonts/` with their licences.
- Text: English lines from a small public-domain phrase list in the script (no scraped text).

- [ ] **Step 1: Write failing tests:**
  - `labels sit inside the page and around the text`: for 20 seeds, every bbox is inside the image and every text pixel drawn falls inside its bbox.
  - `all four kinds appear`: 50 pages contain every category at least once.
  - `same seed, same page`: two calls with seed 7 give identical bytes.
- [ ] **Step 2:** Run `…python.exe training/test_comic_synth.py`. Expected: FAIL.
- [ ] **Step 3:** Implement: `bubble` = white ellipse with black outline and a tail; `caption` = rectangular box (pale fill); `sfx` = big outlined letters, rotated ±20°, no box; `art-text` = small plain text on the art (a sign). 2–6 items per page, no overlaps.
- [ ] **Step 4:** Run. Expected: `comic synth checks passed`.
- [ ] **Step 5:** Generate 600 pages. Commit: `feat(comic-train): synthetic lettered pages with exact labels`.

### Task 5: Train, evaluate, pick (round 1)

**Files:**
- Create: `training/comic_train.py`, `training/comic_evaluate.py`
- Test: `training/test_comic_evaluate.py`

**Interfaces:**
- Consumes: Task 1 commands; COCO files from Tasks 3–4; `load_attribution`.
- Produces:
  - `comic_train.py <dfine|yolox> <run-name>`: builds `DATA/coco_{train,val}.json` from all labelled sets by split, trains at input 1024, saves to `RUNS/<run-name>/`.
  - `evaluate(gt_coco: dict, pred: list[dict]) -> dict` returning `{'per_class': {cls: {'precision','recall','ap50'}}, 'map50': float}` at confidence 0.3 and IoU 0.5 (pycocotools for AP).
  - `comic_evaluate.py <run> <split>`: runs the model, prints the table per class and **per style**, and (for `test`) writes `src/lib/data/comic-translator.json` = `{ data: [...counts], metrics: {...}, styles: { manga: …|null, 'modern-western': …|null, 'old-pd': …|null } }`.

- [ ] **Step 1: Write failing tests** in `test_comic_evaluate.py`:
  - `perfect predictions score 1`: predictions equal to ground truth → every class AP 1.0, precision 1.0, recall 1.0.
  - `no predictions score 0 recall`: → recall 0, AP 0.
  - `a style with too few test pages is not measured`: 9 test pages of `manga` → `styles.manga` is `None`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement both scripts.
- [ ] **Step 4:** Run tests. Expected: `comic evaluate checks passed`.
- [ ] **Step 5:** Train both candidates on round-1 data; run `comic_evaluate.py <run> val` for each. Pick by validation mAP@50, tie → smaller ONNX. Record the numbers and the pick in `comic_vendor.md`. **Do not run on `test` yet.**
- [ ] **Step 6:** Commit scripts and test: `feat(comic-train): train and evaluate both detectors`.

### Task 6: More sources, with drafts the owner corrects

> **Changed 2026-10-24 (owner's decision):** no Label Studio. Labels come from `comic_autolabel.py` (docTR OCR words + round-1 detector boxes), Claude reviews every test/validation page by eye (`attribution/comic-v1-review.csv`), and the report card says the test labels are machine-made and Claude-reviewed. Black Jack comes from the Internet Archive copy of the official English edition (Manga on Web closed); old public-domain pages from Wikimedia Commons.

**Files:**
- Create: `training/comic_incoming.py`, `training/comic_draft.py`, `training/comic_labelstudio.md` (setup and steps for the owner)
- Test: `training/test_comic_incoming.py`

**Interfaces:**
- Consumes: the round-1 model; `add_pages`.
- Produces:
  - `comic_incoming.py <source-folder> --source … --style … --licence … --author … --link …`: registers pages the owner saved in `training/incoming/comic/<source>/<group>/…` (folder name = group), resizes to 1600 px wide, logs them.
  - `comic_draft.py <run> <source>`: writes Label Studio pre-annotations (JSON) with the model's boxes.
  - Label Studio export (COCO) → `DATA/<source>_labels.json`, read by `comic_train.py`.

- [ ] **Step 1: Write failing tests:** `groups come from folders` (pages in `incoming/x/ch01/` and `incoming/x/ch02/` get groups `x-ch01`, `x-ch02`); `licence must be allowed` (`--licence "CC BY-SA 4.0"` → exits with an error, nothing logged).
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: pass.
- [ ] **Step 5 (owner):** Read the current terms on Manga on Web and confirm Black Jack ni Yoroshiku's free reuse still allows commercial use and changes. Download about 100 pages from several volumes into `training/incoming/comic/blackjack/<volume>/`. Register with style `manga`, licence `Black Jack free reuse`.
- [ ] **Step 6 (owner):** From Digital Comic Museum, download about 100 pages of books marked public domain (several books) into `training/incoming/comic/dcm/<book>/`. Register with style `old-pd`, licence `Public domain`.
- [ ] **Step 7:** Draft boxes for both sources; the owner corrects them in Label Studio (`comic_labelstudio.md` walks through it: `conda create -n comiclabel python=3.12`, `pip install label-studio`, import images + pre-annotations, correct, export COCO). Also correct the class on Pepper&Carrot boxes (captions, sound effects) if time allows.
- [ ] **Step 8:** Commit scripts, test, doc and CSV: `feat(comic-train): register owner-downloaded sources and draft labels`.

### Task 7: Final training, test numbers and ONNX

**Files:**
- Create: `training/comic_export.py`
- Modify: `training/comic_vendor.md`, `docs/superpowers/HANDOFF.md`
- Output: `static/models/comic-text-detector.onnx` (kept out of git until plan 3 decides; see Step 5), `src/lib/data/comic-translator.json`

**Interfaces:**
- Consumes: everything above.
- Produces: `comic_export.py <run>` → ONNX at input 1024, plus a check against PyTorch.

- [ ] **Step 1:** Retrain the picked candidate on all labelled data (train split). Check validation.
- [ ] **Step 2: Export test** `onnx matches torch`: `comic_export.py` exports, then runs 20 validation pages through both; every box matches (same class, IoU ≥ 0.98, score within 0.01).
  Expected: `onnx matches torch` printed. If not, fix the export, don't loosen the check.
- [ ] **Step 3:** Run `comic_evaluate.py <run> test` **once**. It writes `src/lib/data/comic-translator.json`. Styles with fewer than 10 test pages show `null`.
- [ ] **Step 4:** Report to the owner: per-class and per-style numbers, page counts per source, model size, and the worst misses (3 test pages with boxes drawn, saved to the scratchpad).
- [ ] **Step 5:** Ask the owner whether the ONNX file goes into `static/models/` now or in plan 3 (it ships to every visitor who uses the page).
- [ ] **Step 6:** Update HANDOFF (pipeline order, sources, numbers, where weights live). Commit `feat(comic-train): final detector, test numbers` (numbers JSON, scripts, CSV, HANDOFF).

## Owner time this plan needs

- Task 6: downloading about 200 pages (two sites, owner's logins), and correcting drafted boxes in Label Studio. Corrections are the big one: roughly a minute a page for drafts that are mostly right.
- Task 7: one review of the numbers and the ONNX decision.
