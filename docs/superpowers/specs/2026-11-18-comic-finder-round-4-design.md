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

## Round 4 result (2026-11-19): not shipped

12 epochs from round 3's weights (7 h 55 min on Kaggle, 8,616 pages an epoch). Bubbles found, live-size (fp16) model,
`comic_evaluate.py found`:

| Test set | Pages | Round 3 | Round 4 |
|---|---|---|---|
| manhua (new) | 500 | 88.2% | 99.1% |
| webtoon (new) | 187 | 83.7% | 91.7% |
| manga | 170 | 93.6% | 93.2% |
| modern Western | 47 | 94.8% | 93.1% |
| old American | 42 | 88.3% | 82.2% |
| test97 | 97 | 92.4% | 89.7% |

Extra boxes a page fell everywhere except manga (1.8 → 2.0). Three styles lost more than 1 point, so the ship rule
failed and round 3 stays live. Cause: the new sets were 54% of training pages; old American (Comix, 684 pages) fell to
8% of the mix and got nothing new, and real Western pages were 283.

## Round 4b: same data, rebalanced

Goal: keep round 4's manhua and webtoon gains and win back old American, Western and test97. Same ship rule.

- **Start from round 4's weights** (`runs/comic/r4-dfine-l/best_stg2.pth`), not round 3's: the new styles are already
  learned, so this run only has to pull the mix back. 6 epochs (about 3.5 h), same learning rate (0.0001).
- **Halve the new sets' caps** (`TRAIN_CAP`): manhua-a 450, manhua-b 300, webtoon-bubbles 350, hf-manga-bubbles 400,
  bubble-shapes 400, manga-bubble 250, manga-segment 150 (2,300 pages, down from 4,600).
- **Repeat the styles that lost ground** (new `REPEAT` in `comic_split3.py`: a source's training pages listed n times in
  train.json, each entry its own image id): Comix ×2, real Pepper&Carrot ×2, Black Jack ×2, rf-comicbubbles ×3. Old
  American goes from 8% to about 18% of the mix.
- About 7,600 pages an epoch. Test sets unchanged, so round 3, round 4 and round 4b are compared on the same pages.
- If 4b still loses more than 1 point on a style: one more try from round 3's weights with the 4b mix and 12 epochs
  (about 7.5 h); if that fails too, round 3 stays and round 5 needs new Western and old-American pages.

Work: `REPEAT` plus a test; new caps; rebuild splits; dataset version with round 4's checkpoint as the only file in
`weights/`; push a private kernel `comic-finder-r4b-l` (6 epochs); measure as above, plus the 28-page pipeline check.

### Round 4b result (2026-11-19): not shipped

6 epochs from round 4's weights (3 h 24 min, 7,561 entries an epoch; best validation AP 0.514 at epoch 1, round 4
ended at 0.529). Bubbles found, fp16, same pages:

| Test set | Round 3 | Round 4 | Round 4b |
|---|---|---|---|
| manhua | 88.2% | 99.1% | 98.9% |
| webtoon | 83.7% | 91.7% | 89.0% |
| manga | 93.6% | 93.2% | 91.4% |
| modern Western | 94.8% | 93.1% | 90.4% |
| old American | 88.3% | 82.2% | 80.7% |
| test97 | 92.4% | 89.7% | 86.9% |

Extra boxes a page fell further (test97 3.4 → 2.3, manga 2.0 → 1.4), but bubbles found fell in every style, including
the ones it repeated. Repeating old pages did not win them back, so the fallback (round 3's weights, 4b mix) is unlikely
to either. Round 3 stays live; the 28-page pipeline check was skipped because the finder already fails the rule.

## Left to the builder

The exact learning rate and epoch count (from the trial), the share of downscaled copies (about 20%), how many no-text
pages to add (about 10% of training pages), and the minimum box size to label.
