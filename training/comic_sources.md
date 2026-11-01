# Comic finder round 3: sources

Every source considered for training the round 3 text finder, its licence status, style, how it maps to the one
labelling target (`bubble`, `caption`, `free-text`, `sfx`; see `comic_common.CLASSES`) and whether it is kept.
Pages of sources whose art belongs to publishers stay in `training/data/comic3` (git-ignored) and a private Kaggle
dataset: never committed, never shown on the site (owner, 2026-10-25). Import with `python comic_import.py <source> <folder>`.

| Source | Style | Licence status | Labels → target | Status |
|---|---|---|---|---|
| Kaggle `naufalahnaf17/manga-text-detection` | manga | Apache 2.0 (labels); publishers' art | text boxes → grown to their bubble, else dropped | waiting: needs the owner's Kaggle token |
| Kaggle `swm16a4/mangatextbox-detection` | manga, manhwa | unknown; publishers' art | text boxes → grown, else dropped | waiting: Kaggle token |
| Kaggle `gamingartist2345/speech-bubble-masks` | unknown | unknown | masks → one box per region | waiting: Kaggle token |
| Kaggle `hieupham154/lie-eater-speech-bubbles` | webtoon | MIT (from Roboflow CC BY 4.0) | bubble boxes | waiting: Kaggle token |
| Kaggle `aasimsani/ampd-base` (AMP-D) | synthetic manga | LGPL 3.0 | generated bubbles | waiting: Kaggle token |
| Roboflow `crepidules-workspace/manga-bubble-detection` | manga | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export (owner) |
| Roboflow `moon-6f9b2/cg-manhua-bubbles-10k` | manhua | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| Roboflow `comic-speech-bubbles/comicbubbles` | modern Western | CC BY 4.0 (labels); publishers' art | bubble boxes | waiting: Roboflow export |
| GitHub `xulihang/balloon-dataset` | webtoon | none shown | — | **dropped** (2026-11-02): the repo holds 8 pages and one ImageTrans project file, no usable labels; its models are not data |
| DCM772 (IAPR TC10) | old American | public-domain pages; masks' terms to check | balloon masks | to try (no account expected) |
| Comix v0.1 (Hugging Face) | old American | CC0 | ours (Task 3) | Task 3 |
