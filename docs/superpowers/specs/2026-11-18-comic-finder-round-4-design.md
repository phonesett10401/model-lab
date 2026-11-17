# Comic text finder, round 4: fine-tuning on hard pages

Date: 2026-11-18. Builds on round 3 (`2026-10-26-comic-finder-round-3-design.md`; model `r3-full-l2-fp16`, D-FINE L,
live since PR #2).

## Why

Measuring the live translator on real pages (2026-11-17) showed that the lettering is now about as good as it gets in
code. What is left are **finder mistakes** that only training fixes:

- **False boxes on art**: round 3 makes 1.8–3.6 boxes per page that cover no text, against 0.8–1.1 for round 2. Most
  are dropped later because they read as junk, but one that reads as letters gets Burmese drawn on it (a face on
  Black Jack v6 p.182).
- **Two bubbles in one box**, and boxes cutting cloud or spiky bubbles.
- **Missed text** in styles training never saw: Bleach-style modern manga, see-through bubbles ("OPEN YOUR FRIGGIN'
  EYES!"), webtoon, manhua.
- **Small pages**: training pages are all 1600 px wide; visitors upload 800–1000 px scans.

## Goal

A finder that misses fewer bubbles in every style and makes **at most as many extra boxes as round 2** (about 1 per
page), with no style getting worse. It ships only if the measurement says so.

## Non-goals

- Lettering, OCR and translation (code; done for now).
- A new model family or size: same D-FINE L, same ONNX shape, so the site needs no change except the model file.

## Data (owner decision 2026-11-17: use all the data; kept private)

All new pages stay in `training/data/comic3/<source>/` (git-ignored) and the private Kaggle dataset. Never in the repo or on
the site.

| Source | What it adds | Who |
|---|---|---|
| **Hard-case pages from the owner**: Bleach, modern manga, Western comics, webtoon, whatever they actually translate | the styles and mistakes seen in use | owner drops pages into `training/incoming/comic4/<series>/<chapter>/` |
| The 3 Roboflow exports still waiting (manhua 10k, Western `comicbubbles`, webtoon) | manhua, Western, webtoon | owner exports from Roboflow (Claude never signs in) |
| **Pages with no text**: covers, splash pages, close-up faces | teaches "no box here"; fixes false boxes | Claude picks from pages we already have, plus some of the owner's |
| **Downscaled copies** (900 and 1100 px wide) of a share of training pages | small scans | Claude, in the split script |
| All of round 3's training data | keeps what already works | already there |

Target: about **400–600 owner pages** across at least 4 series (more is better; 50 per series is a useful minimum).

### Downloaded 2026-11-18 (Roboflow API, owner's key; `training/incoming/comic4/roboflow/`, git-ignored)

| Set | Style | Pages | Boxes | Licence (labels) | Note |
|---|---|---|---|---|---|
| `crepidules-workspace/manga-bubble-detection` v1 | manga | 602 | 3,538 | Public Domain | small pages (200–600 px) |
| `comic-speech-bubbles/comicbubbles` v1 | modern Western (Spider-Man) | 90 | 689 | CC BY 4.0 | 8 bubble types → bubble |
| `wip-sama-wip-sama-smastermega/webtoon-segmented` v5 | webtoon | 400 | 1,432 | CC BY 4.0 | has sfx and see-through balloons |
| `manhwadev/manhua-bubbles-6fho3` v2 | manhua/manhwa | 7,038 | 18,740 | MIT | includes Roboflow's augmented copies: keep one per page (about 2,900) |
| `saif-cxjs3/manhua-bubbles-1wbtl-jqnou` v1 | manhua/manhwa | 5,302 | 12,994 | MIT | may share pages with the one above: dedupe |
| `alexheh/webtoon-bubble-detection-osuqx-xqdqa` v1 | webtoon | 198 | 3,566 | CC BY 4.0 | narration, sfx, small text classes |
| `rf100-vl/speech-bubbles-detection-r22zt-ou0u6-jols` v1 | manga | 1,806 | 11,767 | MIT | bubble shape classes |
| `ashu-biqfs/manga-segment_v2` v8 | manga/comics | 754 | 60,419 | MIT | word-level `text` boxes: use only balloon and caption classes |

Gone from Roboflow (404): `moon-6f9b2/cg-manhua-bubbles-10k` and `testspace-r2sxk/webtoon-bbox-detection`; the manhua
and webtoon sets above replace them. `dataset-xd7q9/manga-speech-bubble-detection-hdgal` had no export.

Also from Kaggle and Hugging Face (`training/incoming/comic4/kaggle`, `/hf`):

| Set | Style | Pages | Labels | Licence (labels) | Note |
|---|---|---|---|---|---|
| Kaggle `shinyunaa/ppocrv5-det-manhwa` | manhwa (Korean text) | 1,300 | text lines with transcriptions (PaddleOCR) | MIT | lines include sound effects; grow lines to their bubble, as with `manga-text-detection` |
| HF `PSImera/manga_bubbles_detect` | manga (Japanese raws) | 2,671 | bubble boxes (YOLO) | CC BY-NC 4.0 | whole bubbles |
| HF `Hares08/webtoon_yolo26n_dataset` | webtoon | 38,970 tiles | text lines (YOLO) | Apache 2.0 | tiles of tall strips; grow lines to bubbles; sample a few thousand |

Looked at and skipped: Manga109 and sets built on it (`hal-utokyo/*`, `bluolightning/manga109s-*`, owner declined
Manga109); `MS92/MangaSegmentation` (gated); text-only or caption sets (`zacharymeurer/webtoons-comic-pages-and-text`,
`jhc90/webtoon_*`, `MangaliCa`); Korean-only `eldwinsianto/webtoon-text`; AMP-D (11.5 GB synthetic, Japanese).

Every set's art belongs to publishers: training only, private, as with round 3. Each set is checked on inspection
(augmented copies, duplicates across sets, stretched images, label quality) before it goes in; unusable ones are
dropped and listed. A held-out share of each new style becomes a test set.

**Imported 2026-11-18:** 9 sets, 17,152 pages and pieces (manhwa 9,596, webtoon 2,352, manga 5,117, Western 87), in
`data/comic3/<source>/` so the round 3 split script takes them. The two text-line sets were dropped (their lines don't
grow to closed bubbles). Final per-set counts and mappings: `training/comic_sources.md`.

### Labels

1. Automatic first: the round 3 finder plus the OCR's word boxes (`comic_autolabel.py`, as in round 3).
2. Claude checks every owner page and corrects boxes: whole bubbles, one box per bubble, sound effects as `sfx`.
3. The owner spot-checks about 20 pages and says if anything is off.

### Test pages (never trained on)

- From the owner's pages: **whole chapters held out**, at least one per series (about 15% of the pages). Labels checked
  as above.
- The 28 labelled pages used to measure the live pipeline (`static/zz-eval`, local only) and the round 3 test sets
  stay as they are, so round 3 and round 4 are compared on the same pages.

## Training

- **Fine-tune from round 3's weights**, not from scratch: D-FINE's tuning flag (`-t`, from `runs/comic/r3-full-l2/best_stg2.pth`, the checkpoint the live `r3-full-l2-fp16` ONNX was exported from; shipped in the dataset as `weights/`),
  through a new `--tune <checkpoint>` option in `comic_train.py` and the Kaggle notebook.
- About 20 epochs with a lower learning rate. Estimate: **6–10 GPU hours** on Kaggle's free T4 ×2 (about a third of the
  weekly allowance). If the time runs out mid-run, resume on Kaggle or the laptop as in round 3.
- One short trial first (about 5 epochs) to check that the new data loads and the loss falls, then the full run.

## Measuring and the ship rule

Round 3 against round 4, same scripts, same pages:

1. **Finder alone** (`comic_evaluate.py`): bubbles found, text found, and extra boxes per page, per style, plus the owner's
   held-out chapters.
2. **Whole pipeline** (the live-pipeline harness on the 28 pages, plus the owner's held-out pages): bubbles cleanly
   translated, English left, and art pixels changed.

Ships if: the pipeline result is better on the owner's pages, extra boxes per page drop, and no style loses more than
1 point of bubbles found. Otherwise round 3 stays live, and the report says why.

Shipping means replacing the model file, updating `src/lib/data/comic-translator.json` from the script, and adding
credits for any new sources. Publishers' art never appears on the site.

## Order of work

1. **Owner (optional):** drop pages of series they translate into `training/incoming/comic4/<series>/<chapter>/`. The outside sets are downloaded and imported (2026-11-18).
2. **Claude:** import, auto-label and check the labels, choose the held-out chapters, add the no-text and downscaled pages,
   and build the new splits and the private Kaggle dataset version.
3. **Owner:** upload the dataset version and run the trial, then the full run, on Kaggle (Claude gives the exact commands).
4. **Claude:** export the ONNX, measure both ways, and report.
5. If it passes: a PR with the model and the numbers. `/code-review`, then merge.

## Left to the builder

The exact learning rate and epoch count (from the trial), the share of downscaled copies (about 20%), how many no-text
pages to add (about 10% of training pages), and the minimum box size to label.
