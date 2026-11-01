# Comic finder round 3: sources

Every source considered for training the round 3 text finder, its licence status, style, how it maps to the one
labelling target (`bubble`, `caption`, `free-text`, `sfx`; see `comic_common.CLASSES`) and whether it is kept.
Pages of sources whose art belongs to publishers stay in `training/data/comic3` (git-ignored) and a private Kaggle
dataset: never committed, never shown on the site (owner, 2026-10-25). Import with `python comic_import.py <source> <folder>`.

| Source | Style | Licence status | Labels → target | Status |
|---|---|---|---|---|
| Kaggle `naufalahnaf17/manga-text-detection` | manga (Indonesian scanlations) | Apache 2.0 (labels); publishers' art | text boxes (`textrotation`) → grown to their bubble; a page with any box that doesn't grow (24% of boxes: sound effects, spiky or panel-crossing bubbles) is left out whole, so no bubble is left unlabelled | **kept** (2026-11-02): 120 of 450 pages, 560 bubbles |
| Kaggle `swm16a4/mangatextbox-detection` | manga (Japanese) | unknown; publishers' art | `text_bubble` → bubble (already whole bubbles); `clean_text` and `messy_text` left out (growing `messy_text`, text on the art and big sound effects, took pale art) | **kept** (2026-11-02): 543 pages, 2,517 bubbles |
| Kaggle `gamingartist2345/speech-bubble-masks` | manga (Japanese) | unknown | masks | **dropped** (2026-11-02): 998 of 1,026 images are 1654×1170 two-page spreads of 1990s manga, i.e. Manga109, which the owner declined; local copy deleted |
| Kaggle `hieupham154/lie-eater-speech-bubbles` | manga (English edition of *Usogui*, not a webtoon) | MIT (from Roboflow CC BY 4.0); publishers' art | `bubble` → bubble (whole bubbles) | **kept** (2026-11-02): 399 pages after removing Roboflow's augmented copies (1,147 files), 2,375 bubbles |
| Kaggle `aasimsani/ampd-base` (AMP-D) | synthetic manga | LGPL 3.0 | generated bubbles | **not downloaded**: 11.5 GB of synthetic pages with Japanese text; our own synthetic pages (Task 4) come first |
| Roboflow `crepidules-workspace/manga-bubble-detection` | manga | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export (owner) |
| Roboflow `moon-6f9b2/cg-manhua-bubbles-10k` | manhua | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| Roboflow `comic-speech-bubbles/comicbubbles` | modern Western | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| GitHub `xulihang/balloon-dataset` | webtoon | none shown | — | **dropped** (2026-11-02): the repo holds 8 pages and one ImageTrans project file, no usable labels; its models are not data |
| DCM772 (IAPR TC10) | old American | public-domain pages; masks' terms to check | balloon masks | to try (no account expected) |
| Comix v0.1 (Hugging Face `comix-v0_1-pages-tiny`) | old American | CC0 | ours (`comic_comix.py`, then `comic_autolabel.py comix`); their labels are machine-made | Task 3 |

No webtoon source is in yet: the one webtoon set in the design turned out to be manga. A webtoon test set needs one (Task 5).
