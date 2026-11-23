# Comic text finder, round 3: proper bubbles in many styles

Date: 2026-10-26. Owner: Phone Sett. Builds on plans 1–3 of the comic translator (`docs/superpowers/specs/2026-10-24-comic-translator-design.md`, PR #1, branch `claude/friendly-shaw-952d0e`).

## Why

The comic translator (English → Burmese, on the AI Model Lab site) finds text with a small D-FINE nano detector trained on automatic labels. In testing the owner kept finding bubbles it **missed completely**: no box touches them, so they stay in English on the finished page ("If you only feel brave…" on Pepper&Carrot 39-08 is the clearest case). Partial boxes, split boxes, twins and joined neighbours are now handled in code (box growing, `joinSame`, `joinStacked`, `dropTwins`); only a better detector fixes complete misses.

Measured on the 97 test pages (final run of round 2): the finder did not find 59 of 496 labelled pieces of text. About 20 were sound effects (out of scope now), about 8 label noise, 3 credits pages, about 15 small bubbles and about 11 big multi-line bubbles, mostly on the newest Pepper&Carrot episodes (39, 40), which training never saw (training stopped at episode 38). Training had only 5 big bubbles among 436 synthetic pages, and its automatic labels join touching bubbles.

## Who it is for

The lab is a site the owner shares with people who **use** the tools (not MandaX, not research-only). The translator must work on comics people bring, in **many styles**.

## Goal

The finder catches **proper speech bubbles and narration boxes** in many styles (modern Western, old American, manga, manhua, webtoon) so that a complete miss becomes rare in every style. The owner asked to get "as near as possible to 100%"; the honest target is the best measured result per style, reported with its misses.

## Non-goals

- Sound effects: the page leaves them as drawn. The finder still labels them (`sfx`) so it can tell them apart from meaningful text; the page drops them.
- OCR and translation quality (fixed in code; not this project).
- Retraining the OCR.

## Anti-goals (a failure even if the number goes up)

- A score that is only agreement with our own automatic labels on our own pages, presented as accuracy in general.
- Test pages that leak into training.
- Showing pages whose art belongs to a publisher on the site (report card examples, previews).
- A model so slow that translating a page feels stuck on a normal computer.

## Decisions the owner made (2026-10-25)

- **Use every dataset that improves accuracy**, including Kaggle/Roboflow sets whose art belongs to publishers, for training only (never shown or redistributed). Not Manga109 (the owner declined).
- **A bigger model is fine, and no phones** (2026-10-26): the translator is used on computers, so download size is not a limit; it must still be **fast** there.
- **Train on Kaggle's free GPUs**; if the weekly GPU time runs out mid-run, download the checkpoint and continue on the laptop (`comic_train.py --resume`).
- Test labels: datasets with human-drawn labels use those; pages we label ourselves are checked page by page by Claude and spot-checked by the owner (as round 2). *(Proposed by Claude; the owner did not object.)*

## Data

Each source is converted to one target (see "One labelling target"). Kept local or in a **private** Kaggle dataset; never committed, never on the site.

| Source | Style | Labels | Licence / note |
|---|---|---|---|
| Pepper&Carrot, all episodes and pages not yet used | modern Western | ours (automatic) | CC BY 4.0 |
| Give My Regards to Black Jack, more volumes | manga (English) | ours | Sato Manga Works free reuse; owner reports the use afterwards |
| Comix v0.1 (Hugging Face `emanuelevivoli/comix-v0_1-*`, Digital Comic Museum pages) | 1940s–50s American | ours (theirs are machine masks) | CC0 |
| DCM772 (IAPR TC10) | 1940s–50s American | human balloon masks | public-domain pages; check the download's terms for the masks |
| Kaggle `naufalahnaf17/manga-text-detection` | manga | human text boxes (COCO) | Apache 2.0 on labels; art belongs to publishers |
| Kaggle `swm16a4/mangatextbox-detection` | manga, manhwa | human text boxes | unknown; publishers' art |
| Kaggle `gamingartist2345/speech-bubble-masks` | unknown | bubble masks | unknown |
| Kaggle `hieupham154/lie-eater-speech-bubbles` | webtoon | bubble boxes | MIT (from Roboflow CC BY 4.0); one webtoon |
| Roboflow Universe bubble sets (e.g. `crepidules-workspace/manga-bubble-detection`, `moon-6f9b2/cg-manhua-bubbles-10k`, `comic-speech-bubbles/comicbubbles`) | manga, manhua, Western | human bubble boxes/masks | CC BY 4.0 on labels; publishers' art |
| xulihang/balloon-dataset (GitHub) | manga, manhua, webtoon | human balloons | no licence shown |
| Kaggle `aasimsani/ampd-base` (AMP-D) and its generator | synthetic manga | generated bubbles | LGPL 3.0; Japanese text |
| Our own synthetic pages | big multi-line bubbles, bubbles crossing panel borders, webtoon-tall pages | generated | our art sources must be open (Pepper&Carrot art, CC0) |

Sources that turn out unusable on inspection (wrong content, broken labels, no images) are dropped and listed in the report.

## One labelling target

The finder predicts **one box per speech bubble or narration box**, covering the bubble (outline included), not just its text, and one box per piece of **meaningful text without a box** (narration written on the art, signs, labels, whispers, "The next day…"). Classes: `bubble`, `caption`, `free-text` (meaningful text on the art: translated), `sfx` (sound effects: left as drawn). Converting sources:

- Bubble masks or bubble boxes: use them.
- Text-only boxes (e.g. manga text detection): grow each to its bubble with the existing bubble-shape code (`bubbleExtent`, seeded inside the text box); drop the box if no closed bubble is found, or keep it as text-in-bubble only if the builder finds that helps.
- Sound-effect classes: map to `sfx`. "Text outside a bubble" classes: `free-text` unless the text is a sound effect (decided by its reading where the source has text, else kept out of training).
- Our own labels: today's `art-text` is split into `free-text` and `sfx` (Claude-checked on validation and test pages).
- Our automatic labeller: split touching bubbles with the bubble shape (each closed paper region is one bubble).

## Model

- Same family, D-FINE (Apache-2.0), at a bigger size: **M, L or X** (L is about 31M parameters, X about 62M; nano is 4M), picked by measurement: the most accurate size that meets the speed limit. Nano stays as the baseline.
- Input 1024 as now (tiled for tall pages); the browser code (`detect.ts`) keeps its interface. `MODEL_URL`, `MODEL_MB` and the size note change; the model may be stored at half precision (fp16) to halve the download if accuracy is unchanged.
- Speed limit: detection of an average page in **about 2 seconds** on the owner's laptop in a desktop browser (WebGPU where available, WASM otherwise), and a long webtoon page in under about 10 seconds. Phones are not a target.

## Training

- Data preparation and labelling on the laptop (conda env `comictrain`); upload as a private Kaggle dataset.
- Training in a Kaggle notebook (GPU P100 or 2× T4); checkpoints saved every epoch as notebook output. Pinned: the D-FINE commit (`956d170`), PyTorch and package versions, written down so the laptop can resume the same run.
- Owner steps: create/sign in to Kaggle, accept GPU terms, run or approve the notebook. Claude never signs in or stores Kaggle keys in the repo.

## Measuring

- A **held-out test set per style** (no overlap with training: split by book/episode/series, never by page). Human-labelled sources use their labels; our own pages get Claude-checked labels and an owner spot-check.
- Main number: **share of proper bubbles found** (box covering at least half of the bubble), per style and overall, plus AP@50 per class, for old (round 2) and new model on the same test pages.
- The pipeline run (`pnpm eval:comic`) is repeated on the original 97 test pages so the report card's numbers stay comparable.
- The report card names every dataset used (with credits), says which labels were machine-made, and shows how it fails (missed bubbles per style).

## Calls made after the builder check (Claude's, for the owner to check)

- **Held-out test sets per style:** where a source has book/episode/series IDs (Pepper&Carrot, Black Jack, Comix, DCM772), split by those. Where it has none (most Kaggle/Roboflow sets) or is one series (the webtoon set), **hold out a whole source** as that style's test set. Roboflow near-duplicates (augmented copies) are removed by image hashing before splitting. Five styles are measured: modern Western, old American, manga, manhua, webtoon; `STYLES` in the training code grows to match.
- **Comparing old and new models:** scored the way the site uses them: the old model's boxes are **grown with `growToBubbles`** before scoring (the page does that now). The 97 test pages are **relabelled to whole bubbles** (grown from the current text labels with the bubble-shape code, Claude-checked page by page, owner spot-check), so old and new are scored against the same whole-bubble labels. The old text-box numbers stay in the report as round 2's.
- **Joined bubbles:** one box per **closed paper region**: lobes joined by a neck are one bubble; bubbles that only touch, each with its own outline, are separate; a narration box inside a bubble is its own `caption`. Converted sources are re-cut to this rule with the bubble-shape code where their convention differs. This matches what the page does (`joinSame` merges a bubble group into one region).
- **Licence allow-list:** `ALLOWED_LICENCES` in `training/comic_common.py` (written for MandaX, "no NC") is **replaced deliberately** by the owner's 2026-10-25 rule: any source that improves accuracy may be used for training; each source's licence status is recorded in the attribution file and credited on the report card.

## Shipping rule and budget (Claude's proposals; the owner did not answer, so these stand until changed)

- Ship the new finder only if it misses fewer proper bubbles in **every** style, is **no worse** on the 97 original test pages, and meets the speed limit on the owner's laptop. Otherwise take the next size down that does.
- Budget: about 60 Kaggle GPU hours (two free weeks), then stop and report what was reached.
- The trained model file is served to every visitor; that is covered by the owner's "use all that improves accuracy" for a tool they share, with every source credited on the report card.
- The owner signs in to Kaggle and accepts its terms; Claude prepares the notebook and data.

## Related: lettering

How the translated text is drawn (erasing only the letters, text shaped to the box, meaningful text on the art without a box) is its own design: `2026-10-26-comic-lettering-round-2-design.md`. It needs `free-text` boxes from this finder only for text on the art; bubbles and captions work with today's finder.

## What's left to the builder

- Exact sample counts per source and balancing between styles.
- Augmentations and epochs; S vs M after a short trial.
- How to read each source's format.
- Whether a source is worth keeping after a look at its labels.
- The synthetic page generator details.
