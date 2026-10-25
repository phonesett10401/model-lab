# Comic finder round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrain the comic text finder (D-FINE, a larger size) on many styles and sources so it catches proper speech bubbles, narration boxes and meaningful text on the art, measured per style on held-out pages, and ship it if it beats round 2.

**Architecture:** Python in `training/` (conda env `comictrain`) imports every source into one COCO dataset with one labelling target (one box per closed bubble, plus `free-text` and `sfx`), using a Python port of the page's bubble-shape code so both sides draw the same boxes. Training runs in a Kaggle notebook on a private Kaggle dataset, resumable on the laptop. The evaluation scores old and new finders the way the site uses them, per style; the browser swaps model file, classes and size note.

**Tech Stack:** Python 3.12, PyTorch, D-FINE (`956d170`, Apache-2.0), onnx/onnxruntime, Kaggle notebooks (P100 / 2× T4), SvelteKit browser runtime (onnxruntime-web).

**Spec:** `docs/superpowers/specs/2026-10-26-comic-finder-round-3-design.md`

## Global Constraints

- One box per **closed paper region** (lobes joined by a neck are one; bubbles that only touch are separate; a narration box inside a bubble is its own `caption`). Classes: `bubble`, `caption`, `free-text` (translated), `sfx` (left as drawn).
- Every source may be used for training (owner, 2026-10-25), except Manga109. Pages whose art belongs to a publisher are never shown on the site or committed; they live in `training/data` (git-ignored) and a **private** Kaggle dataset only. Every source is recorded in `training/attribution/comic-v3.csv` with its licence status and credited on the report card.
- Test pages never leak into training: split by book/episode/series where known; otherwise a whole source is held out; near-duplicates removed by image hash before splitting.
- Pepper&Carrot test episodes stay test: 04, 08, 14, 16, 30, 39, 40. Black Jack test volumes stay test: 2, 6.
- Styles measured: `modern-western`, `old-american`, `manga`, `manhua`, `webtoon`.
- Model: D-FINE `m`, `l` or `x` at input 1024 (tiled for tall pages); the most accurate size whose detection of an average page takes about **2 s** on the owner's laptop in a desktop browser (WebGPU, else WASM) and a long webtoon page under about **10 s**. Phones are not a target. fp16 storage allowed if accuracy is unchanged.
- Ship only if: fewer missed proper bubbles in **every** style, **no worse** on the 97 original test pages, and within the speed limit; else the next size down that is. Budget about **60 Kaggle GPU hours**, then report.
- Owner steps (Claude never signs in or stores their keys in the repo): Kaggle sign-in and API token (in `training/.env`, git-ignored, never printed), Roboflow key if a Roboflow export needs one, Hugging Face login if a dataset is gated, running/approving the Kaggle notebook, the test-label spot check, the speed check on their laptop.
- Numbers on the site come from files written by scripts, never typed by hand. Commits: no Claude co-author lines; keep each file's line endings (LF; `src/lib/types.ts` CRLF).

## Review Focus

1. A source whose labels box only the text (manga text detection): converted by growing to the bubble; a text box with no closed bubble is dropped, never kept as a bubble. Test in Task 2 (`text-only labels grow to their bubble or are dropped`).
2. The same page in two sources (Roboflow re-uploads to Kaggle): removed by image hash before splitting, so it cannot sit in train and test. Test in Task 2 (`near-duplicates across sources are removed`).
3. A training run stopped by Kaggle's 12-hour session limit: resumes from the last checkpoint on Kaggle or the laptop with the same pinned versions and gives the same next epoch. Test in Task 6 (`resume continues the same run`).
4. The old finder scored on whole-bubble labels: its boxes are grown first, as the page does, so it is not penalised for drawing text-tight boxes. Test in Task 7 (`old boxes are grown before scoring`).
5. The browser receiving a 4-class model whose class order differs from today's: `free-text` and `sfx` map correctly, `sfx` is still dropped by `cleanUp`, and old saved pages with `art-text` still load. Test in Task 8 (`new class list maps and sound effects are dropped`).

---

### Task 1: One labelling target and a Python bubble shape

**Files:**
- Modify: `training/comic_common.py` (`CLASSES = ['bubble', 'caption', 'free-text', 'sfx']`, `STYLES = ['modern-western', 'old-american', 'manga', 'manhua', 'webtoon']`, `ALLOWED_LICENCES` replaced by `licence_status(page) -> str` that only requires a non-empty recorded licence; comment says the 2026-10-25 rule)
- Create: `training/comic_bubble.py` (`bubble_extent(rgb: np.ndarray, seed: tuple[int, int, int, int]) -> tuple[int, int, int, int] | None`, same rule as `bubbleExtent` in `src/lib/comic/bubble.ts`)
- Create: `src/lib/comic/bubble-cases.json` (shared cases: small synthetic crops + expected extents, generated once by a script, used by both test suites)
- Test: `training/test_comic_common.py`, `training/test_comic_bubble.py`, `src/lib/comic/bubble.test.ts` (reads the same cases)

**Interfaces:**
- Produces: `bubble_extent(...)` (Python), the new `CLASSES`/`STYLES`, `licence_status(page)`.

- [ ] **Step 1: Write the failing tests**: Python `bubble_extent` matches every case in `bubble-cases.json` (same extents within 1 px) and the TS `bubbleExtent` does too; `CLASSES` and `STYLES` hold the new lists; a page with an empty licence fails `licence_status`, any non-empty one passes.
- [ ] **Step 2: Run** `python test_comic_bubble.py`, `python test_comic_common.py` (from `training/`) and `pnpm vitest run src/lib/comic/bubble.test.ts` — Expected: Python FAILS (missing), TS passes.
- [ ] **Step 3: Implement** the port with numpy (seeded low-contrast flood, gap closing, hull) and the `comic_common.py` changes.
- [ ] **Step 4: Run** the three tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(comic-train): one labelling target (bubble, caption, free-text, sfx) and the bubble shape in Python`

### Task 2: Import every source into the one target

**Files:**
- Create: `training/comic_import.py` (`python comic_import.py <source> <downloaded folder>`; one reader per source format: COCO, YOLO, masks, VOC; writes pages + labels into `training/data/comic3/<source>/` and rows into `training/attribution/comic-v3.csv`)
- Create: `training/comic_sources.md` (each source: link, licence status, style, how it maps, kept or dropped and why)
- Test: `training/test_comic_import.py` (small fixture folders per format under `training/fixtures/comic3/`)

**Interfaces:**
- Consumes: Task 1 `bubble_extent`, `CLASSES`, `STYLES`.
- Produces: `import_source(name: str, folder: Path) -> list[Page]` with boxes in the one target; `dedupe(pages: list[Page]) -> list[Page]` (perceptual hash).

Sources (spec table): Kaggle `naufalahnaf17/manga-text-detection`, `swm16a4/mangatextbox-detection`, `gamingartist2345/speech-bubble-masks`, `hieupham154/lie-eater-speech-bubbles`, `aasimsani/ampd-base`; Roboflow `crepidules-workspace/manga-bubble-detection`, `moon-6f9b2/cg-manhua-bubbles-10k`, `comic-speech-bubbles/comicbubbles`; GitHub `xulihang/balloon-dataset`; DCM772; Comix v0.1.

- [ ] **Step 1: Write the failing tests**: `masks become one box per closed bubble`, `text-only labels grow to their bubble or are dropped`, `sound-effect classes map to sfx`, `near-duplicates across sources are removed`, `every imported page has a source, style and recorded licence`.
- [ ] **Step 2: Run** `python test_comic_import.py` — Expected: FAIL.
- [ ] **Step 3: Implement** the readers and the mapping; the owner downloads sources that need an account (Kaggle API token in `training/.env`; Roboflow export; Hugging Face login for Comix if gated); Claude runs the import on each and looks at 10 random pages per source with their boxes drawn, recording keep/drop in `comic_sources.md`.
- [ ] **Step 4: Run** the tests — Expected: PASS; `comic_sources.md` lists every source with a decision.
- [ ] **Step 5: Commit** `feat(comic-train): import every bubble dataset into one target, with credits and dedupe`

### Task 3: More pages of our own, labelled with the new rule

**Files:**
- Modify: `training/comic_pepper.py` (all episodes not yet used, test episodes stay test), `training/comic_blackjack.py` (more volumes, test volumes 2 and 6 stay test)
- Modify: `training/comic_autolabel.py` (split touching bubbles with `bubble_extent`; `art-text` becomes `free-text` or `sfx`: words from the OCR checked against a sound-effect list and Claude's page review)
- Test: `training/test_comic_autolabel.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: our own pages in `training/data/comic3/{pepper,blackjack,comix}/` in the one target.

- [ ] **Step 1: Write the failing tests**: `two touching bubbles become two boxes`, `a bubble with joined lobes stays one box`, `CLAP and THROB become sfx, a sign's words become free-text`.
- [ ] **Step 2: Run** `python test_comic_autolabel.py` — Expected: FAIL.
- [ ] **Step 3: Implement**, download, label; Claude reviews every validation and test page (as round 2), writing `training/attribution/comic-v3-review.csv`.
- [ ] **Step 4: Run** the tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(comic-train): our own pages labelled one box per bubble, free text apart from sound effects`

### Task 4: Synthetic pages for the hard cases

**Files:**
- Modify: `training/comic_synth.py` (big multi-line bubbles, bubbles crossing panel borders, joined and touching bubbles, tall webtoon pages, manga-style round bubbles, free text on the art, tinted/gradient/dark narration boxes; open art only: Pepper&Carrot art and CC0)
- Test: `training/test_comic_synth.py`

**Interfaces:**
- Produces: synthetic pages in `training/data/comic3/synth/` with exact boxes.

- [ ] **Step 1: Write the failing tests**: each new kind appears in a 50-page sample; every box lies inside its page; boxes follow the one-target rule (joined lobes one box, touching bubbles two).
- [ ] **Step 2: Run** `python test_comic_synth.py` — Expected: FAIL.
- [ ] **Step 3: Implement** and generate (about 2,000 pages; the builder balances counts).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(comic-train): synthetic pages for big, joined, touching, tall and tinted bubbles`

### Task 5: Splits and test sets per style (and the 97 pages relabelled)

**Files:**
- Create: `training/comic_split3.py` (writes `training/data/comic3/annotations/{train,val,test}.json` and `test-<style>.json`)
- Create: `training/data/comic3/annotations/test97-bubbles.json` (the 97 round-2 test pages relabelled to whole bubbles: grown from their text labels with `bubble_extent`, Claude-checked, owner spot-check of 10 pages)
- Test: `training/test_comic_split3.py`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: the split files; `held_out_sources` listed in `comic_sources.md`.

- [ ] **Step 1: Write the failing tests**: `no page, book, episode or series is in two splits`, `held-out sources appear only in test`, `every style has a test set of at least 30 pages`, `test97 has a box for every round-2 labelled bubble`.
- [ ] **Step 2: Run** `python test_comic_split3.py` — Expected: FAIL.
- [ ] **Step 3: Implement**; Claude checks `test97-bubbles.json` page by page; the owner spot-checks 10 (recorded in `attribution/comic-v3-spotcheck.csv`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(comic-train): per-style test sets, held-out sources, the 97 test pages as whole bubbles`

### Task 6: Train on Kaggle, resumable on the laptop

**Files:**
- Modify: `training/comic_train.py` (`python comic_train.py dfine <run> --size m|l|x [--epochs N] [--resume] [--data comic3]`; the config includes `dfine_hgnetv2_<size>_custom.yml`; 4 classes; checkpoints every epoch)
- Create: `training/kaggle/comic_train_notebook.py` (the notebook's code: installs the pinned D-FINE commit and versions from `training/kaggle/requirements.txt`, mounts the private dataset, runs `comic_train.py`, writes checkpoints to `/kaggle/working/<run>/`)
- Create: `training/kaggle/README.md` (owner steps: sign in, create the private dataset with `kaggle datasets create`, accept GPU, run; how to download a checkpoint and resume on the laptop)
- Test: `training/test_comic_train.py`

**Interfaces:**
- Produces: `training/runs/comic/r3-dfine-<size>/` with `last.pth`, `best.pth`.

- [ ] **Step 1: Write the failing tests**: `config uses the requested size`, `resume continues the same run` (a 2-epoch toy run stopped after epoch 1 and resumed gives epoch 2 from `last.pth`, same config hash), `requirements pin the D-FINE commit and torch version`.
- [ ] **Step 2: Run** `python test_comic_train.py` — Expected: FAIL.
- [ ] **Step 3: Implement**; the owner uploads the dataset and runs short trials of `m` and `l` (about 3 h each) to pick the size, then the full run (budget about 60 GPU hours in all).
- [ ] **Step 4: Run** the tests — Expected: PASS; a resumed trial continues on the laptop.
- [ ] **Step 5: Commit** `feat(comic-train): larger D-FINE sizes, Kaggle notebook and laptop resume`

### Task 7: Measure old against new, per style, and the speed

**Files:**
- Modify: `training/comic_evaluate.py` (`bubbles_found(gt, pred) -> dict` = share of proper bubbles with a predicted box covering at least half of each, per style and overall; old-model boxes grown with `bubble_extent` before scoring; writes `src/lib/data/comic-translator.json` v3 fields)
- Create: `.superpowers/bench/detect-speed.mjs` (times `comicDetector().detect` in a desktop browser on 20 test pages and 3 long webtoon pages, WebGPU then WASM)
- Test: `training/test_comic_evaluate.py`

**Interfaces:**
- Consumes: Task 5 test files, Task 6 runs, Task 1 `bubble_extent`.
- Produces: per-style found shares, AP@50 per class, and speed per size for the ship decision.

- [ ] **Step 1: Write the failing tests**: `old boxes are grown before scoring`, `a bubble half covered counts as found, a third does not`, `results are reported per style and for test97`.
- [ ] **Step 2: Run** `python test_comic_evaluate.py` — Expected: FAIL.
- [ ] **Step 3: Implement**; run on round 2 (`final2-dfine`) and each round 3 size; the owner runs `detect-speed.mjs` on their laptop.
- [ ] **Step 4: Run** the tests — Expected: PASS; a table of found share per style (old vs new), test97, and seconds per page per size.
- [ ] **Step 5: Commit** `feat(comic-train): per-style found share and speed, old against new`

### Task 8: Ship the new finder (only if it meets the rule)

**Files:**
- Modify: `training/comic_export.py` (size-aware, optional fp16), `static/models/comic-text-detector.onnx`
- Modify: `src/lib/comic/detect.ts` (`MODEL_MB`, `CLASSES = ['bubble', 'caption', 'free-text', 'sfx']`), `src/lib/comic/types.ts` (`RegionClass` adds `'free-text'`, keeps `'art-text'` for older saved boxes, treated like `free-text`), `src/lib/comic/translate-server.ts` (accepts `free-text`), `src/lib/components/ComicTranslator.svelte` (kind picker), `src/lib/entries.ts` (report card: per-style rows, every source credited, labels note), `src/lib/data/comic-translator.json`
- Test: `src/lib/comic/detect.test.ts`, `e2e/comic.e2e.ts`

**Interfaces:**
- Consumes: Task 7's decision and the chosen run.

- [ ] **Step 1: Write the failing tests**: `new class list maps and sound effects are dropped` (a fake 4-class output with `free-text` and `sfx` → `free-text` kept, `sfx` dropped), `states the real model size` (reads the new file size), report card shows a found share per style and credits every source.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/comic/detect.test.ts` and the report-card e2e — Expected: FAIL.
- [ ] **Step 3: Implement**; export with `python comic_export.py r3-dfine-<size>` and its check (`boxes_match` on 20 pages).
- [ ] **Step 4: Gates**: `pnpm check`, `pnpm vitest run`, `E2E_PORT=4180 pnpm exec playwright test`, `VERCEL_ENV=production pnpm build`, `training/test_comic_*.py`; `pnpm eval:comic` on the 97 pages when the free quota allows; light/dark/desktop look at both comic pages.
- [ ] **Step 5: Commit** `feat(comic): round 3 finder (D-FINE <size>): proper bubbles in five styles`
